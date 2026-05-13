import Phaser from "phaser";
import { 
  MODES, SCREEN_WIDTH, SCREEN_HEIGHT, LANES, 
  HEALTH_MAX, SHOW_DEBUG_VISUALS, FRIENDLY_GOAL_X, ENEMY_GOAL_X, SCORE_PER_UNIT,
  INITIAL_GOLD, BOMB_COST
} from "../constants";
import { spawnParticles, getMultiplier, spawnMultiplier } from "../utils";
import { Enemy } from "../entities";
import { LevelManager, ILevelConfig } from "../managers/LevelManager";
import { PlayerController } from "../systems/PlayerController";
import { WeaponManager } from "../managers/WeaponManager";
import { EntityManager } from "../managers/EntityManager";
import { CollisionSystem } from "../systems/CollisionSystem";
import { PaperTransition } from "../ui/PaperTransition";

export class GameScene extends Phaser.Scene {
  // --- State ---
  private health!: number;
  private combo!: number;
  private gold!: number;
  private lastHurtTime!: number;
  private successCounts!: number[];
  private bombs!: number;
  private rageRemaining!: number;

  // --- Managers & Systems ---
  private levelManager!: LevelManager;
  private playerController!: PlayerController;
  private weaponManager!: WeaponManager;
  private entityManager!: EntityManager;
  private collisionSystem!: CollisionSystem;

  // --- Timers ---
  private enemySpawnEvent!: Phaser.Time.TimerEvent;
  private eliteSpawnEvent!: Phaser.Time.TimerEvent;
  private friendlySpawnEvent!: Phaser.Time.TimerEvent;

  // --- Objects ---
  private fortress!: Phaser.GameObjects.Sprite;
  private fortressCore!: Phaser.GameObjects.Sprite;
  private barracks!: Phaser.GameObjects.Sprite;
  private buildingsContainer!: Phaser.GameObjects.Container;

  // --- UI Elements ---
  private comboBg!: Phaser.GameObjects.Image;
  private comboLabel!: Phaser.GameObjects.Text;
  private comboFadeTween?: Phaser.Tweens.Tween;

  constructor() {
    super("GameScene");
  }

  init() {
    this.health = HEALTH_MAX;
    this.combo = 0;
    this.gold = INITIAL_GOLD;
    this.lastHurtTime = 0;
    this.successCounts = [0, 0, 0];
    this.bombs = 2;
    this.rageRemaining = 0;

    this.levelManager = new LevelManager();

    if (this.scene.isActive("UIScene")) {
      this.scene.stop("UIScene");
    }
  }

  create(data: any) {
    PaperTransition.setupReveal(this, data);

    this.createAnimations();
    this.setupComboUI();
    if (SHOW_DEBUG_VISUALS) {
      this.setupVisualization();
    }
    this.setupGoalLines();
    this.setupBuildings();
    
    // Initialize Managers & Systems
    this.playerController = new PlayerController(this);
    this.weaponManager = new WeaponManager(this, this.fortress, this.fortressCore);
    this.entityManager = new EntityManager(this, this.barracks, this.fortress);
    this.collisionSystem = new CollisionSystem(this, this.entityManager, this.weaponManager);

    this.setupEventHandlers();

    // Cleanup on scene shutdown
    this.events.once("shutdown", () => {
      this.cleanup();
    });
    
    // Level Manager Setup
    const levelData = this.cache.json.get("levels");
    this.levelManager.init(levelData);
    this.levelManager.on("level_completed", (config: ILevelConfig) => {
      this.handleLevelCompleted(config);
    });
    this.levelManager.on("level_changed", (config: ILevelConfig) => {
      this.handleLevelChanged(config);
    });
    this.levelManager.on("game_completed", () => {
      this.scene.stop("UIScene");
      PaperTransition.tearTo(this, "ResultScene", { isVictory: true, gold: this.gold, successCounts: this.successCounts });
    });
    
    // Initial UI Sync & Level Start
    this.time.delayedCall(1000, () => {
      // Sync basic state
      this.events.emit("updateGold", this.gold);
      this.events.emit("updateSuccess", this.successCounts);
      this.events.emit("updateCombo", this.combo);
      this.events.emit("updateBombs", this.bombs);
      this.events.emit("updateHealth", this.health);
      
      // Start Level Manager
      const startLevelIndex = data?.startLevelIndex ?? 0;
      this.levelManager.start(startLevelIndex);
    });

    if (!this.scene.isActive("UIScene")) {
      this.scene.launch("UIScene");
    }

    // Fade in buildings
    this.tweens.add({
      targets: this.buildingsContainer,
      alpha: 1,
      duration: 800
    });
  }

  update(time: number, delta: number) {
    this.levelManager.update(delta, this.successCounts, this.combo);
    this.handleRageMode(time, delta);
    
    this.weaponManager.update(time, delta);
    this.entityManager.update(time, delta);
  }

  private createAnimations() {
    const animConfigs = [
      { key: "friend_cyan_walk", texture: "friend_cyan", frames: 8 },
      { key: "friend_orange_walk", texture: "friend_orange", frames: 8 },
      { key: "friend_purple_walk", texture: "friend_purple", frames: 8 },
      { key: "enemy_cyan_walk", texture: "enemy_cyan", frames: 9 },
      { key: "enemy_orange_walk", texture: "enemy_orange", frames: 7 },
      { key: "enemy_purple_walk", texture: "enemy_purple", frames: 6 },
      { key: "enemy_elite_walk", texture: "enemy_elite", frames: 9 }
    ];

    animConfigs.forEach(conf => {
      if (!this.anims.exists(conf.key)) {
        this.anims.create({
          key: conf.key,
          frames: this.anims.generateFrameNumbers(conf.texture, { start: 0, end: conf.frames - 1 }),
          frameRate: 8,
          repeat: -1
        });
      }
    });
  }

  private setupEventHandlers() {
    this.events.on("requestComboUpdate", this.handleRequestComboUpdate, this);
    this.events.on("bulletMissed", this.handleBulletMissed, this);
    this.events.on("scorePoint", this.handleFriendlyScore, this);
    this.events.on("baseDamaged", this.takeDamage, this);
    this.events.on("enemyKilled", this.handleEnemyKilled, this);
    this.events.on("itemCollected", this.handleItemCollect, this);
    this.events.on("spawnEnergyOrb", this.spawnEnergyOrb, this);
    this.events.on("requestBomb", this.useBomb, this);
    this.events.on("allWavesCompleted", this.handleAllWavesCompleted, this);

    // Cheat Events
    this.events.on("cheat_spawnElite", this.handleCheatSpawnElite, this);
    this.events.on("cheat_skipLevel", this.handleCheatSkipLevel, this);
    this.events.on("cheat_jumpToLevel", this.handleCheatJumpToLevel, this);
    this.events.on("cheat_addGold", this.updateGold, this);

    // Fortress vs Enemy collision
    this.physics.add.overlap(this.entityManager.getEnemies(), [this.fortress, this.barracks], (obj1, obj2) => {
      const enemy = (obj1 instanceof Enemy) ? obj1 : obj2 as Enemy;
      if (enemy && enemy.active && enemy.deactivate) {
        this.takeDamage(10, enemy.x, enemy.y);
        enemy.deactivate();
      }
    });
  }

  private cleanup() {
    this.events.off("requestComboUpdate", this.handleRequestComboUpdate, this);
    this.events.off("bulletMissed", this.handleBulletMissed, this);
    this.events.off("scorePoint", this.handleFriendlyScore, this);
    this.events.off("baseDamaged", this.takeDamage, this);
    this.events.off("enemyKilled", this.handleEnemyKilled, this);
    this.events.off("itemCollected", this.handleItemCollect, this);
    this.events.off("spawnEnergyOrb", this.spawnEnergyOrb, this);
    this.events.off("requestBomb", this.useBomb, this);
    this.events.off("allWavesCompleted", this.handleAllWavesCompleted, this);
    this.events.off("cheat_spawnElite", this.handleCheatSpawnElite, this);
    this.events.off("cheat_skipLevel", this.handleCheatSkipLevel, this);
    this.events.off("cheat_jumpToLevel", this.handleCheatJumpToLevel, this);
    this.events.off("cheat_addGold", this.updateGold, this);

    if (this.enemySpawnEvent) this.enemySpawnEvent.destroy();
    if (this.eliteSpawnEvent) this.eliteSpawnEvent.destroy();
    if (this.friendlySpawnEvent) this.friendlySpawnEvent.destroy();
  }

  private handleRequestComboUpdate(val: number) { this.updateCombo(val); }
  private handleBulletMissed() { this.updateCombo(0); }
  private handleEnemyKilled(enemy: Enemy, mult: number) {
    this.updateCombo(1);
    this.updateGold(mult);
  }
  private handleAllWavesCompleted() {
    const config = this.levelManager.getCurrentConfig();
    if (config) this.startRandomSpawning(config);
  }
  private handleCheatSpawnElite() {
    this.entityManager.spawnElite(this.levelManager.getCurrentConfig());
  }
  private handleCheatSkipLevel() {
    this.levelManager.advanceLevel();
  }
  private handleCheatJumpToLevel(levelId: number) {
    this.levelManager.jumpToLevel(levelId);
  }

  private handleLevelCompleted(config: ILevelConfig) {
    // 1. Stop all spawning logic as the absolute first step
    if (this.enemySpawnEvent) this.enemySpawnEvent.destroy();
    if (this.eliteSpawnEvent) this.eliteSpawnEvent.destroy();
    if (this.friendlySpawnEvent) this.friendlySpawnEvent.destroy();
    this.entityManager.stopSpawning();

    // 2. Play effects
    if (this.cache.audio.exists("completed")) {
      this.sound.play("completed", { volume: 0.6 });
    }
    
    // 3. Clear field: Enemies die, Friendlies disappear
    const activeEnemies = (this.entityManager.getEnemies().getChildren() as Enemy[]).some(e => e.active);
    if (activeEnemies) {
      this.sound.play("hitHurt", { volume: 0.5 });
    }
    this.entityManager.clearField(true, false);
    
    // Clear projectiles
    this.weaponManager.getBullets().clear(true, true);
    
    // Fly-in "Completed!" Text
    const completedText = this.add.text(SCREEN_WIDTH + 200, SCREEN_HEIGHT / 2, "COMPLETED!", {
      fontFamily: "Yozai",
      fontSize: "80px",
      color: "#000000",
      stroke: "#ffffff",
      strokeThickness: 12
    }).setOrigin(0.5).setDepth(1000);

    this.tweens.add({
      targets: completedText,
      x: SCREEN_WIDTH / 2,
      ease: "Back.easeOut",
      duration: 800,
      onComplete: () => {
        this.time.delayedCall(1000, () => {
          this.tweens.add({
            targets: completedText,
            x: -200,
            alpha: 0,
            duration: 500,
            ease: "Cubic.easeIn",
            onComplete: () => {
              completedText.destroy();
              this.levelManager.advanceLevel();
            }
          });
        });
      }
    });
  }

  private handleLevelChanged(config: ILevelConfig) {
    if (this.cache.audio.exists("level_intro")) {
      this.sound.play("level_intro", { volume: 0.8 });
    }
    
    // Ensure timers are definitely cleared
    if (this.enemySpawnEvent) this.enemySpawnEvent.destroy();
    if (this.eliteSpawnEvent) this.eliteSpawnEvent.destroy();
    if (this.friendlySpawnEvent) this.friendlySpawnEvent.destroy();

    this.entityManager.stopSpawning();
    this.entityManager.clearAll();
    this.weaponManager.getBullets().clear(true, true);

    this.successCounts = [0, 0, 0];
    this.updateCombo(0);

    this.events.emit("levelChanged", config);
    this.events.emit("updateSuccess", this.successCounts);

    const title = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, config.name, {
      fontFamily: "Yozai", fontSize: "64px", color: "#000000", stroke: "#ffffff", strokeThickness: 8
    }).setOrigin(0.5).setAlpha(0).setDepth(100);

    this.tweens.chain({
      targets: title,
      tweens: [
        { alpha: 1, duration: 500 }, { alpha: 1, duration: 1000 }, { alpha: 0, duration: 500 }
      ],
      onComplete: () => title.destroy()
    });

    this.startLevelSpawning(config);
  }

  private startLevelSpawning(config: ILevelConfig) {
    if (config.waves && config.waves.length > 0) {
      // Use Precise Wave Spawning
      this.entityManager.startPreciseLevel(config);
    } else {
      // Fallback: Use Legacy Random Spawning
      this.startRandomSpawning(config);
    }

    // Friendly production remains consistent across both modes
    this.friendlySpawnEvent = this.time.addEvent({
      delay: config.friendlySpawnInterval, callback: () => {
        const cost = this.entityManager.autoProduce(config, this.gold);
        if (cost > 0) this.updateGold(-cost);
      }, loop: true
    });
  }

  private startRandomSpawning(config: ILevelConfig) {
    this.entityManager.spawnEnemySquad(config);
    this.enemySpawnEvent = this.time.addEvent({
      delay: config.enemySpawnInterval, callback: () => this.entityManager.spawnEnemySquad(config), loop: true
    });
    this.eliteSpawnEvent = this.time.addEvent({
      delay: 10000, callback: () => { if (Math.random() < config.eliteSpawnChance) this.entityManager.spawnElite(config); }, loop: true
    });
  }

  private handleRageMode(time: number, delta: number) {
    if (this.rageRemaining > 0) {
      this.rageRemaining -= delta / 1000;
      this.events.emit("updateRage", this.rageRemaining);
      if (this.rageRemaining <= 0) {
        this.rageRemaining = 0;
        this.events.emit("updateRage", 0);
      }
    }
  }

  private useBomb() {
    if (this.bombs <= 0) return;
    
    if (this.gold < BOMB_COST) {
      this.sound.play("laserShootFailed", { volume: 0.5 });
      return;
    }

    this.updateGold(-BOMB_COST);
    this.bombs--;
    this.events.emit("updateBombs", this.bombs);
    
    this.sound.play("hitHurt", { volume: 0.8 });
    this.cameras.main.flash(500, 255, 255, 255);
    
    this.entityManager.getEnemies().getChildren().forEach(obj => {
      const e = obj as Enemy;
      if (e.active) this.time.delayedCall(Phaser.Math.Between(0, 200), () => { 
        if (e.active) this.entityManager.killEnemy(e, false); 
      });
    });
  }

  private spawnEnergyOrb(startX: number, startY: number, color: number) {
    const orb = this.add.circle(startX, startY, 6, color).setDepth(10);
    if (orb.postFX) orb.postFX.addGlow(color, 2, 0, false, 0.1, 5);

    const particles = this.add.particles(0, 0, 'white-pixel', {
      speed: { min: 10, max: 30 }, scale: { start: 0.3, end: 0 }, alpha: { start: 0.6, end: 0 },
      tint: color, lifespan: 200, frequency: 20, follow: orb
    }).setDepth(9);

    this.tweens.add({
      targets: orb, x: this.fortressCore.x, y: this.fortressCore.y, duration: 400, ease: "Cubic.easeIn",
      onComplete: () => {
        particles.stop(); this.time.delayedCall(200, () => particles.destroy());
        const flash = this.add.circle(this.fortressCore.x, this.fortressCore.y, 12, color).setDepth(11).setAlpha(0.8);
        this.tweens.add({ targets: flash, scale: 2, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
        orb.destroy();
        this.weaponManager.resetCooldown();
      }
    });
  }

  private takeDamage(amount: number, sourceX?: number, sourceY?: number) {
    const now = this.time.now;
    if (now < this.lastHurtTime + 200) return;
    this.health -= amount;
    this.lastHurtTime = now;
    this.updateCombo(0);
    this.cameras.main.shake(300, 0.02);
    this.cameras.main.flash(200, 255, 0, 0);

    const exX = sourceX ?? this.fortress.x;
    const exY = sourceY ?? this.fortress.y;
    const explosion = this.add.circle(exX, exY, 20, 0xff0000, 0.8).setDepth(20);
    this.tweens.add({ targets: explosion, scale: 5, alpha: 0, duration: 400, ease: 'Cubic.easeOut', onComplete: () => explosion.destroy() });
    spawnParticles(this, exX, exY, 0xff0000);

    this.sound.play("playerHurt", { volume: 0.8 });
    this.events.emit("updateHealth", this.health);
    if (this.health <= 0) {
      this.scene.stop("UIScene");
      PaperTransition.tearTo(this, "ResultScene", { isVictory: false, gold: this.gold, successCounts: this.successCounts });
    }
  }

  private handleItemCollect(type: "bomb" | "health" | "rage") {
    this.sound.play("hitHurt", { volume: 0.6, detune: 500 });
    if (type === "bomb") {
      this.bombs = Math.min(this.bombs + 1, 2);
      this.events.emit("updateBombs", this.bombs);
    } else if (type === "health") {
      this.health = 100;
      this.events.emit("updateHealth", this.health);
    } else if (type === "rage") {
      this.rageRemaining = 6;
    }
  }

  private handleFriendlyScore(color: number) {
    if (this.cache.audio.exists("score")) {
      this.sound.play("score", { volume: 0.4 });
    }
    const idx = MODES.findIndex(m => m.color === color);
    if (idx === -1) return;
    this.successCounts[idx] += SCORE_PER_UNIT;
    this.events.emit("updateSuccess", this.successCounts);
  }

  private updateGold(val: number) {
    this.gold += val;
    this.events.emit("updateGold", this.gold);
  }

  private updateCombo(val: number) {
    if (val > 0) {
      if (this.combo < 99) {
        this.combo += val;
        if (this.combo > 99) this.combo = 99;
        if (this.combo % 10 === 0) this.updateGold(10);
      }
      if (this.comboFadeTween) { this.comboFadeTween.stop(); this.comboFadeTween = undefined; }
      this.comboLabel.setText(`${this.combo}`).setAlpha(1);
      this.comboBg.setAlpha(1);
      if (!this.tweens.isTweening(this.comboBg)) {
        this.comboBg.setScale(0.5);
        this.tweens.add({ targets: [this.comboBg], scale: { from: 0.6, to: 0.5 }, duration: 100, ease: "Back.easeOut" });
      }
      this.comboFadeTween = this.tweens.add({
        targets: [this.comboLabel, this.comboBg], alpha: 0.3, delay: 1500, duration: 1000, ease: "Linear"
      });
    } else {
      this.combo = 0;
      if (this.comboFadeTween) { this.comboFadeTween.stop(); this.comboFadeTween = undefined; }
      this.comboLabel.setAlpha(0); this.comboBg.setAlpha(0);
    }
    this.events.emit("updateCombo", this.combo);
  }

  // --- Setup Methods ---
  private setupComboUI() {
    this.comboBg = this.add.image(SCREEN_WIDTH / 2 + 55, 120, "ui_combo_bg").setOrigin(0.5).setScale(0.5).setAlpha(0).setDepth(-0.8);
    this.comboLabel = this.add.text(SCREEN_WIDTH / 2 + 80, 105, "0", { 
      fontFamily: "WuXin", fontSize: "100px", color: "#000000", fontStyle: "bold",
    }).setOrigin(0.5).setAlpha(0).setDepth(-0.8);
  }

  private setupVisualization() {
    const debugGraphics = this.add.graphics().setDepth(100);
    debugGraphics.lineStyle(2, 0x00ff00, 0.8);
    debugGraphics.strokeRect(40, 30, SCREEN_WIDTH - 60, SCREEN_HEIGHT - 60);
    const safeTopY = 60; const safeBottomY = SCREEN_HEIGHT - 60;
    debugGraphics.lineStyle(2, 0xff0000, 0.8);
    debugGraphics.beginPath();
    for (let x = 40; x < SCREEN_WIDTH - 20; x += 20) {
      debugGraphics.moveTo(x, safeTopY); debugGraphics.lineTo(x + 10, safeTopY);
      debugGraphics.moveTo(x, safeBottomY); debugGraphics.lineTo(x + 10, safeBottomY);
    }
    debugGraphics.strokePath();
    debugGraphics.lineStyle(1, 0x0000ff, 0.5);
    LANES.forEach(laneY => {
        debugGraphics.beginPath(); debugGraphics.moveTo(40, laneY); debugGraphics.lineTo(SCREEN_WIDTH - 20, laneY); debugGraphics.strokePath();
    });
  }

  private setupGoalLines() {
    const graphics = this.add.graphics().setDepth(-0.5);
    const dashLength = 20; const gapLength = 15; const jitter = 2.5;
    const drawLine = (x: number, color: number, alpha: number) => {
      for (let pass = 0; pass < 2; pass++) {
        graphics.lineStyle(pass === 0 ? 3 : 2, color, pass === 0 ? alpha : alpha * 0.5);
        for (let y = 40; y < SCREEN_HEIGHT - 50; y += dashLength + gapLength) {
          graphics.beginPath(); graphics.moveTo(x + (Math.random() - 0.5) * jitter, y + (Math.random() - 0.5) * jitter);
          graphics.lineTo(x + (Math.random() - 0.5) * jitter, y + dashLength / 2 + (Math.random() - 0.5) * jitter);
          graphics.lineTo(x + (Math.random() - 0.5) * jitter, y + dashLength + (Math.random() - 0.5) * jitter);
          graphics.strokePath();
        }
      }
    };
    drawLine(FRIENDLY_GOAL_X, 0x4a4a4a, 0.6);
    drawLine(ENEMY_GOAL_X, 0xff0000, 0.4);
  }

  private setupBuildings() {
    this.buildingsContainer = this.add.container(0, 0).setAlpha(0);

    this.fortress = this.add.sprite(130, SCREEN_HEIGHT / 2, "bldg_fortress").setScale(0.5).setOrigin(0.5);
    this.physics.add.existing(this.fortress, true);
    if (this.fortress.body) (this.fortress.body as Phaser.Physics.Arcade.StaticBody).setSize(120, 160);
    this.fortressCore = this.add.sprite(this.fortress.x + 35, this.fortress.y, "bldg_cannon_barrel").setScale(0.5).setOrigin(0.2, 0.5);
    if (this.fortress.postFX) {
      const glow = this.fortress.postFX.addGlow(MODES[0].color, 4, 0, false, 0.1, 10);
      this.fortress.setData('glow', glow);
    }
    this.barracks = this.add.sprite(160, SCREEN_HEIGHT / 2 + 120, "bldg_barracks").setScale(0.5).setOrigin(0.8);
    this.physics.add.existing(this.barracks, true);
    if (this.barracks.body) (this.barracks.body as Phaser.Physics.Arcade.StaticBody).setSize(120, 100);

    this.buildingsContainer.add([this.fortress, this.fortressCore, this.barracks]);
  }
}
