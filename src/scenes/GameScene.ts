import Phaser from "phaser";
import { 
  MODES, SCREEN_WIDTH, SCREEN_HEIGHT, SQUAD_SIZE, LANES, 
  HEALTH_MAX, ENEMY_SPEED, FRIENDLY_SPEED, WIN_CONDITION, SHOW_DEBUG_VISUALS, SCORE_PER_UNIT,
  ENEMY_SPAWN_INTERVAL, ENEMY_SPAWN_SQUADS_PER_INTERVAL, FRIENDLY_GOAL_X, ENEMY_GOAL_X
} from "../constants";
import { spawnParticles, getMultiplier, spawnMultiplier } from "../utils";
import { Bullet, Enemy, Friendly, spawnItem } from "../entities";
import { LevelManager, ILevelConfig } from "../managers/LevelManager";

export class GameScene extends Phaser.Scene {
  // --- State ---
  private health!: number;
  private combo!: number;
  private gold!: number;
  private weaponMode!: number;
  private lastShotTime!: number;
  private lastHurtTime!: number;
  private successCounts!: number[];
  private bombs!: number;
  private rageRemaining!: number;

  private totalProduced!: number;
  private producedCounts!: number[];
  private stalematedPairs!: Set<string>;

  private levelManager!: LevelManager;
  
  // --- Cheat State ---
  private eKeyCount: number = 0;
  private eKeyLastTime: number = 0;
  private pKeyCount: number = 0;
  private pKeyLastTime: number = 0;
  private gKeyCount: number = 0;
  private gKeyLastTime: number = 0;
  
  // --- Groups ---
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private friendlies!: Phaser.Physics.Arcade.Group;

  // --- Timers ---
  private enemySpawnEvent!: Phaser.Time.TimerEvent;
  private eliteSpawnEvent!: Phaser.Time.TimerEvent;
  private friendlySpawnEvent!: Phaser.Time.TimerEvent;

  // --- Objects ---
  private fortress!: Phaser.GameObjects.Sprite;
  private fortressCore!: Phaser.GameObjects.Sprite;
  private barracks!: Phaser.GameObjects.Sprite;
  private cdBar!: Phaser.GameObjects.Graphics;
  private aimLine!: Phaser.GameObjects.Graphics;

  // --- UI Elements ---
  private comboBg!: Phaser.GameObjects.Image;
  private comboLabel!: Phaser.GameObjects.Text;
  private comboFadeTween?: Phaser.Tweens.Tween;

  constructor() {
    super("GameScene");
  }

  // --- Lifecycle ---

  init() {
    this.health = HEALTH_MAX;
    this.combo = 0;
    this.gold = 0;
    this.weaponMode = 0;
    this.lastShotTime = 0;
    this.lastHurtTime = 0;
    this.successCounts = [0, 0, 0];
    this.bombs = 0;
    this.rageRemaining = 0;

    this.totalProduced = 0;
    this.producedCounts = [0, 0, 0];
    this.stalematedPairs = new Set();

    this.levelManager = new LevelManager();

    // Safety: Ensure UIScene is stopped so it can be clean-launched in create()
    if (this.scene.isActive("UIScene")) {
      this.scene.stop("UIScene");
    }
  }

  create() {
    // Create Animations
    if (!this.anims.exists("friend_cyan_walk")) {
      this.anims.create({
        key: "friend_cyan_walk",
        frames: this.anims.generateFrameNumbers("friend_cyan", { start: 0, end: 7 }),
        frameRate: 8,
        repeat: -1
      });
    }
    if (!this.anims.exists("friend_orange_walk")) {
      this.anims.create({
        key: "friend_orange_walk",
        frames: this.anims.generateFrameNumbers("friend_orange", { start: 0, end: 7 }),
        frameRate: 8,
        repeat: -1
      });
    }
    if (!this.anims.exists("friend_purple_walk")) {
      this.anims.create({
        key: "friend_purple_walk",
        frames: this.anims.generateFrameNumbers("friend_purple", { start: 0, end: 7 }),
        frameRate: 8,
        repeat: -1
      });
    }

    // Enemy Animations
    if (!this.anims.exists("enemy_cyan_walk")) {
      this.anims.create({
        key: "enemy_cyan_walk",
        frames: this.anims.generateFrameNumbers("enemy_cyan", { start: 0, end: 8 }), // 9 frames
        frameRate: 8,
        repeat: -1
      });
    }
    if (!this.anims.exists("enemy_orange_walk")) {
      this.anims.create({
        key: "enemy_orange_walk",
        frames: this.anims.generateFrameNumbers("enemy_orange", { start: 0, end: 6 }), // 7 frames
        frameRate: 8,
        repeat: -1
      });
    }
    if (!this.anims.exists("enemy_purple_walk")) {
      this.anims.create({
        key: "enemy_purple_walk",
        frames: this.anims.generateFrameNumbers("enemy_purple", { start: 0, end: 5 }), // 6 frames
        frameRate: 8,
        repeat: -1
      });
    }
    if (!this.anims.exists("enemy_elite_walk")) {
      this.anims.create({
        key: "enemy_elite_walk",
        frames: this.anims.generateFrameNumbers("enemy_elite", { start: 0, end: 8 }), // 9 frames
        frameRate: 8,
        repeat: -1
      });
    }

    this.setupBackground();
    if (SHOW_DEBUG_VISUALS) {
      this.setupVisualization();
    }
    this.setupGoalLines();
    this.setupGroups();
    this.setupBuildings();
    this.setupInput();
    this.setupCollisions();
    this.setupEventHandlers();
    
    // Level Manager Setup
    const levelData = this.cache.json.get("levels");
    this.levelManager.init(levelData);
    this.levelManager.on("level_changed", (config: ILevelConfig) => {
      this.handleLevelChanged(config);
    });
    this.levelManager.on("game_completed", () => {
      this.scene.stop("UIScene");
      this.scene.start("ResultScene", { isVictory: true, gold: this.gold, successCounts: this.successCounts });
    });
    
    this.setupLoops();
    // Do NOT call levelManager.start() here. Wait for UIScene to signal.
    
    // Initial UI Sync
    this.time.delayedCall(100, () => {
      this.events.emit("updateGold", this.gold);
      this.events.emit("updateSuccess", this.successCounts);
      this.events.emit("updateCombo", this.combo);
      this.events.emit("updateBombs", this.bombs);
      this.events.emit("updateHealth", this.health);
    });

    if (!this.scene.isActive("UIScene")) {
      this.scene.launch("UIScene");
    }
  }

  update(time: number, delta: number) {
    this.levelManager.update(delta, this.successCounts);
    this.handleRageMode(time, delta);
    this.updateBarrelRotation();
    this.updateUnitLogic();
    this.checkBoundaries();
    this.updateCDBar(time);
    this.updateAimLine();
  }

  private handleLevelChanged(config: ILevelConfig) {
    // 1. Clear everything from the previous level
    if (this.enemySpawnEvent) this.enemySpawnEvent.destroy();
    if (this.eliteSpawnEvent) this.eliteSpawnEvent.destroy();
    if (this.friendlySpawnEvent) this.friendlySpawnEvent.destroy();

    this.enemies.clear(true, true);
    this.friendlies.clear(true, true);
    this.bullets.clear(true, true);

    // 2. Reset per-level stats (Gold accumulates, but others reset)
    this.successCounts = [0, 0, 0];
    this.updateCombo(0);

    // Notify UI immediately to show updated goals (DO THIS BEFORE EMITTING updateSuccess)
    this.events.emit("levelChanged", config);
    this.events.emit("updateSuccess", this.successCounts);

    // 3. Cinematic Level Title
    const title = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, config.name, {
      fontFamily: "WuXin",
      fontSize: "64px",
      color: "#000000",
      stroke: "#ffffff",
      strokeThickness: 8
    }).setOrigin(0.5).setAlpha(0).setDepth(100);

    // Sequence: Fade In -> Hold -> Fade Out
    this.tweens.chain({
      targets: title,
      tweens: [
        { alpha: 1, duration: 500, ease: "Power2" },
        { alpha: 1, duration: 1000 }, // Hold
        { alpha: 0, duration: 500, ease: "Power2" }
      ],
      onComplete: () => {
        title.destroy();
      }
    });

    // Start Spawning immediately (don't wait for title animation)
    this.startLevelSpawning(config);
  }

  private startLevelSpawning(config: ILevelConfig) {
    // Spawn the first squad immediately
    this.spawnEnemySquad();

    // Update enemy spawn timer for subsequent waves
    this.enemySpawnEvent = this.time.addEvent({
      delay: config.enemySpawnInterval,
      callback: this.spawnEnemySquad,
      callbackScope: this,
      loop: true
    });

    // Update elite spawn timer if needed
    this.eliteSpawnEvent = this.time.addEvent({
      delay: 10000,
      callback: () => {
        if (Math.random() < config.eliteSpawnChance) this.spawnElite();
      },
      callbackScope: this,
      loop: true
    });

    // Update friendly production timer
    this.friendlySpawnEvent = this.time.addEvent({
      delay: config.friendlySpawnInterval,
      callback: this.autoProduce,
      callbackScope: this,
      loop: true
    });
  }

  private updateAimLine() {
    this.aimLine.clear();
    const pointer = this.input.activePointer;
    const mode = MODES[this.weaponMode];
    const isRage = this.rageRemaining > 0;
    const color = isRage ? 0xffffff : mode.color;

    // Calculate barrel tip position
    const barrelLength = (1 - this.fortressCore.originX) * this.fortressCore.width * this.fortressCore.scaleX;
    const startX = this.fortressCore.x + Math.cos(this.fortressCore.rotation) * barrelLength;
    const startY = this.fortressCore.y + Math.sin(this.fortressCore.rotation) * barrelLength;

    this.aimLine.lineStyle(2, color, 0.6);
    
    // Draw dashed line towards pointer
    const dist = Phaser.Math.Distance.Between(startX, startY, pointer.x, pointer.y);
    const dashLen = 10;
    const gapLen = 10;
    const totalSteps = Math.floor(dist / (dashLen + gapLen));
    
    const cos = Math.cos(this.fortressCore.rotation);
    const sin = Math.sin(this.fortressCore.rotation);

    for (let i = 0; i < totalSteps; i++) {
      const x1 = startX + cos * i * (dashLen + gapLen);
      const y1 = startY + sin * i * (dashLen + gapLen);
      const x2 = x1 + cos * dashLen;
      const y2 = y1 + sin * dashLen;
      this.aimLine.lineBetween(x1, y1, x2, y2);
    }
  }

  private updateCDBar(time: number) {
    this.cdBar.clear();
    
    const mode = MODES[this.weaponMode];
    const isRage = this.rageRemaining > 0;
    const actualCd = isRage ? 100 : mode.cd * 1000;
    const elapsed = time - this.lastShotTime;
    const progress = Phaser.Math.Clamp(elapsed / actualCd, 0, 1);
    
    // Position above the fortress
    const x = this.fortress.x - 30;
    const y = this.fortress.y - 80;
    const width = 60;
    const height = 10;

    if (progress >= 1) return;

    // Draw background with hand-drawn white stroke
    this.drawWobblyRect(x, y, width, height, 0xffffff, 0x000000, 0.4);
    
    // Draw progress fill
    if (progress > 0) {
      const fillWidth = (width - 4) * progress;
      if (fillWidth > 0) {
        this.cdBar.fillStyle(mode.color, 0.8);
        this.cdBar.fillRect(x + 2, y + 2, fillWidth, height - 4);
      }
    }
  }

  private drawWobblyRect(x: number, y: number, w: number, h: number, strokeColor: number, fillColor: number, fillAlpha: number) {
    const wobble = 1.5;
    const points = [
      { x: x, y: y },
      { x: x + w, y: y },
      { x: x + w, y: y + h },
      { x: x, y: y + h }
    ];
    
    // Randomized points for wobbly look
    const wp = points.map(p => ({
      x: p.x + (Math.random() - 0.5) * wobble,
      y: p.y + (Math.random() - 0.5) * wobble
    }));

    // Fill
    this.cdBar.fillStyle(fillColor, fillAlpha);
    this.cdBar.beginPath();
    this.cdBar.moveTo(wp[0].x, wp[0].y);
    for (let i = 1; i < wp.length; i++) this.cdBar.lineTo(wp[i].x, wp[i].y);
    this.cdBar.closePath();
    this.cdBar.fillPath();

    // White Stroke (drawn twice for hand-drawn intensity)
    this.cdBar.lineStyle(2, strokeColor, 1);
    for (let pass = 0; pass < 2; pass++) {
      this.cdBar.beginPath();
      this.cdBar.moveTo(wp[0].x + (Math.random()-0.5), wp[0].y + (Math.random()-0.5));
      for (let i = 0; i < wp.length; i++) {
        const next = wp[(i + 1) % wp.length];
        this.cdBar.lineTo(next.x + (Math.random()-0.5), next.y + (Math.random()-0.5));
      }
      this.cdBar.strokePath();
    }
  }

  // --- Setup Methods ---

  private setupBackground() {
    this.add.rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 0xefeadc).setOrigin(0).setDepth(-2);
    const bg = this.add.image(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, "bg_notebook")
      .setScale(0.5)
      .setDepth(-1)
      .setAlpha(0.9);

    // Center: Combo (Depth -0.8 to render behind units (0) but above background (-1))
    this.comboBg = this.add.image(SCREEN_WIDTH / 2 + 55, 120, "ui_combo_bg")
      .setOrigin(0.5)
      .setScale(0.5)
      .setAlpha(0)
      .setDepth(-0.8);
    
    this.comboLabel = this.add.text(SCREEN_WIDTH / 2 + 80, 105, "0", { 
      fontFamily: "WuXin",
      fontSize: "100px", 
      color: "#000000",
      fontStyle: "bold",
    }).setOrigin(0.5).setAlpha(0).setDepth(-0.8);
  }

  private setupVisualization() {
    const debugGraphics = this.add.graphics();
    debugGraphics.setDepth(100); // Very high depth to ensure it's on top
    
    // 1. Draw the absolute mask bounds (Green outline)
    debugGraphics.lineStyle(2, 0x00ff00, 0.8);
    debugGraphics.strokeRect(40, 30, SCREEN_WIDTH - 60, SCREEN_HEIGHT - 60);
    
    // 2. Draw the proposed safe vertical bounds for Friendlies (Red dashed lines)
    // Friendlies are ~72px tall visually, let's say +/- 36 from origin.
    // So safe Y should be ~ 30 + 36 = 66 (top) and ~ 570 - 36 = 534 (bottom).
    // Let's use 60 and 540 for simplicity.
    const safeTopY = 60;
    const safeBottomY = SCREEN_HEIGHT - 60;
    
    debugGraphics.lineStyle(2, 0xff0000, 0.8);
    debugGraphics.beginPath();
    for (let x = 40; x < SCREEN_WIDTH - 20; x += 20) {
      debugGraphics.moveTo(x, safeTopY);
      debugGraphics.lineTo(x + 10, safeTopY);
      debugGraphics.moveTo(x, safeBottomY);
      debugGraphics.lineTo(x + 10, safeBottomY);
    }
    debugGraphics.strokePath();

    // 3. Draw horizontal lines for the LANES to see where units currently want to go (Blue)
    debugGraphics.lineStyle(1, 0x0000ff, 0.5);
    LANES.forEach(laneY => {
        debugGraphics.beginPath();
        debugGraphics.moveTo(40, laneY);
        debugGraphics.lineTo(SCREEN_WIDTH - 20, laneY);
        debugGraphics.strokePath();
    });
  }

  private setupGoalLines() {
    const graphics = this.add.graphics();
    graphics.setDepth(-0.5); // Above background (-1), below game elements (0)
    
    const dashLength = 20;
    const gapLength = 15;
    const jitter = 2.5;
    
    const drawLine = (x: number, color: number, alpha: number) => {
      // Draw twice for a slightly thicker, "ink-bleed" hand-drawn look
      for (let pass = 0; pass < 2; pass++) {
        graphics.lineStyle(pass === 0 ? 3 : 2, color, pass === 0 ? alpha : alpha * 0.5);
        
        for (let y = 10; y < SCREEN_HEIGHT - 10; y += dashLength + gapLength) {
          graphics.beginPath();
          let currentY = y;
          
          // Starting point with jitter
          graphics.moveTo(x + (Math.random() - 0.5) * jitter, currentY + (Math.random() - 0.5) * jitter);
          
          // Midpoint for wobbliness
          const midY = currentY + dashLength / 2;
          graphics.lineTo(x + (Math.random() - 0.5) * jitter, midY + (Math.random() - 0.5) * jitter);
          
          // Endpoint for the dash
          const endY = currentY + dashLength;
          graphics.lineTo(x + (Math.random() - 0.5) * jitter, endY + (Math.random() - 0.5) * jitter);
          
          graphics.strokePath();
        }
      }
    };

    // Friendly Goal Line (on the right)
    drawLine(FRIENDLY_GOAL_X, 0x4a4a4a, 0.6);
    
    // Enemy Goal Line (on the left)
    drawLine(ENEMY_GOAL_X, 0xff0000, 0.4);
  }

  private setupGroups() {
    this.bullets = this.physics.add.group({ classType: Bullet, runChildUpdate: true });
    this.enemies = this.physics.add.group({ classType: Enemy, runChildUpdate: true });
    this.friendlies = this.physics.add.group({ classType: Friendly, runChildUpdate: true });
  }

  private setupBuildings() {
    // Fortress Base
    this.fortress = this.add.sprite(130, SCREEN_HEIGHT / 2, "bldg_fortress").setScale(0.5).setOrigin(0.5);
    this.physics.add.existing(this.fortress, true);
    if (this.fortress.body) (this.fortress.body as Phaser.Physics.Arcade.StaticBody).setSize(120, 160);
    
    // Fortress Barrel
    this.fortressCore = this.add.sprite(this.fortress.x + 35, this.fortress.y, "bldg_cannon_barrel").setScale(0.5).setOrigin(0.2, 0.5);
    
    // Glow FX for Mode Hint
    if (this.fortress.postFX) {
      const glow = this.fortress.postFX.addGlow(MODES[0].color, 4, 0, false, 0.1, 10);
      this.fortress.setData('glow', glow);
    }

    // Barracks
    this.barracks = this.add.sprite(160, SCREEN_HEIGHT / 2 + 120, "bldg_barracks").setScale(0.5).setOrigin(0.8);
    this.physics.add.existing(this.barracks, true);
    if (this.barracks.body) (this.barracks.body as Phaser.Physics.Arcade.StaticBody).setSize(120, 100);

    // Cooldown Bar
    this.cdBar = this.add.graphics();

    // Aiming Line
    this.aimLine = this.add.graphics();
    this.aimLine.setDepth(-0.4);
  }

  private setupInput() {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.shoot(true);
      } else if (pointer.rightButtonDown()) {
        this.switchMode();
      }
    });
    
    if (this.game.canvas) {
      this.game.canvas.oncontextmenu = (e) => e.preventDefault();
    }

    this.input.keyboard?.on("keydown-SPACE", () => this.switchMode());
    this.input.keyboard?.on("keydown-R", () => this.useBomb());
    
    // Cheat Code: Spawn Elite
    this.input.keyboard?.on("keydown-E", () => {
      const now = this.time.now;
      if (now - this.eKeyLastTime > 500) {
        this.eKeyCount = 1;
      } else {
        this.eKeyCount++;
      }
      this.eKeyLastTime = now;
      
      if (this.eKeyCount >= 3) {
        this.spawnElite();
        this.eKeyCount = 0;
      }
    });

    // Cheat Code: Skip Level
    this.input.keyboard?.on("keydown-P", () => {
      const now = this.time.now;
      if (now - this.pKeyLastTime > 500) {
        this.pKeyCount = 1;
      } else {
        this.pKeyCount++;
      }
      this.pKeyLastTime = now;
      
      if (this.pKeyCount >= 3) {
        this.levelManager.advanceLevel();
        this.pKeyCount = 0;
      }
    });

    // Cheat Code: Add Gold
    this.input.keyboard?.on("keydown-G", () => {
      const now = this.time.now;
      if (now - this.gKeyLastTime > 500) {
        this.gKeyCount = 1;
      } else {
        this.gKeyCount++;
      }
      this.gKeyLastTime = now;
      
      if (this.gKeyCount >= 3) {
        this.updateGold(100);
        this.gKeyCount = 0;
      }
    });
  }

  private setupCollisions() {
    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => this.handleBulletEnemyCollision(b as Bullet, e as Enemy));
    this.physics.add.overlap(this.friendlies, this.enemies, (f, e) => this.handleFriendlyEnemyCollision(f as Friendly, e as Enemy));
    // Fortress/Barracks collision with enemies
    this.physics.add.overlap(this.enemies, [this.fortress, this.barracks], (obj1, obj2) => this.handleEnemyBuildingCollision(obj1 as any, obj2 as any));
  }

  private setupEventHandlers() {
    // Clear existing listeners to prevent accumulation if the scene instance is reused
    this.events.off("bulletMissed");
    this.events.off("friendlyReachedEnd");
    this.events.off("friendlyUpdate");
    this.events.off("requestBomb");
    this.events.off("startGame");

    this.events.on("bulletMissed", () => this.updateCombo(0));
    this.events.on("friendlyReachedEnd", (x: number, y: number, color: number) => this.handleFriendlyReachedEnd(x, y, color));
    this.events.on("friendlyUpdate", (f: Friendly) => this.updateFriendlyAI(f));
    this.events.on("requestBomb", () => this.useBomb());
    this.events.on("startGame", () => {
      this.levelManager.start();
    });
  }

  private setupLoops() {
    // Timers are now managed per-level in handleLevelChanged/startLevelSpawning
  }

  // --- Update Logic Helpers ---

  private handleRageMode(time: number, delta: number) {
    if (this.rageRemaining > 0) {
      this.rageRemaining -= delta / 1000;
      this.events.emit("updateRage", this.rageRemaining);
      if (time > this.lastShotTime + 100) this.shoot();
      if (this.rageRemaining <= 0) {
        this.rageRemaining = 0;
        this.events.emit("updateRage", 0);
      }
    }
  }

  private updateBarrelRotation() {
    const pointer = this.input.activePointer;
    const angle = Phaser.Math.Angle.Between(this.fortressCore.x, this.fortressCore.y, pointer.x, pointer.y);
    this.fortressCore.setRotation(angle);
  }

  private updateUnitLogic() {
    const activeFriendlies = this.friendlies.getChildren() as Friendly[];
    const activeEnemies = this.enemies.getChildren() as Enemy[];

    const checkWipe = (units: any[], opponentGroup: any[]) => {
      units.forEach(u => {
        if (u.active && u.isStalemated && u.stalemateOpponentSquadId) {
          const opponentSquadAlive = opponentGroup.some(o => o.active && o.squadId === u.stalemateOpponentSquadId);
          if (!opponentSquadAlive) {
            u.isStalemated = false;
            u.stalemateTarget = null;
            u.stalemateOpponentSquadId = null;
            if (u instanceof Enemy && u.body) u.body.setVelocity(-u.speed, 0);
          }
        }
      });
    };

    checkWipe(activeFriendlies, activeEnemies);
    checkWipe(activeEnemies, activeFriendlies);
  }

  private checkBoundaries() {
    (this.enemies.getChildren() as Enemy[]).forEach(e => {
      if (e.active && e.x < ENEMY_GOAL_X) {
        this.takeDamage(10, e.x, e.y);
        e.deactivate();
      }
    });
  }

  // --- Gameplay Actions ---

  private switchMode() {
    this.weaponMode = (this.weaponMode + 1) % MODES.length;
    this.sound.play("change", { volume: 0.5 });
    this.cameras.main.shake(100, 0.005);
    
    // Update Glow
    const glow = this.fortress.getData('glow');
    if (glow) glow.color = MODES[this.weaponMode].color;
    
    // Popup Text
    const txt = this.add.text(this.fortress.x, this.fortress.y - 60, MODES[this.weaponMode].name, {
      fontFamily: "WuXin",
      fontSize: "24px",
      color: Phaser.Display.Color.IntegerToColor(MODES[this.weaponMode].color).rgba,
      stroke: "#ffffff",
      strokeThickness: 4
    }).setOrigin(0.5);
    this.tweens.add({
      targets: txt,
      y: txt.y - 40,
      alpha: 0,
      duration: 500,
      onComplete: () => txt.destroy()
    });
  }

  private shoot(playFailSound = false) {
    const now = this.time.now;
    const mode = MODES[this.weaponMode];
    const isRage = this.rageRemaining > 0;

    if (!isRage && now < this.lastShotTime + (mode.cd * 1000)) {
      if (playFailSound) this.sound.play("laserShootFailed", { volume: 0.3 });
      return;
    }

    const actualCd = isRage ? 100 : mode.cd * 1000;
    if (now < this.lastShotTime + actualCd) return;

    this.lastShotTime = now;
    this.sound.play("laserShoot", { volume: 0.4 });
    if (!isRage) this.cameras.main.shake(100, 0.002);

    const pointer = this.input.activePointer;
    const dir = new Phaser.Math.Vector2(pointer.x - this.fortressCore.x, pointer.y - this.fortressCore.y).normalize();

    const barrelLength = (1 - this.fortressCore.originX) * this.fortressCore.width * this.fortressCore.scaleX;
    const spawnX = this.fortressCore.x + dir.x * barrelLength;
    const spawnY = this.fortressCore.y + dir.y * barrelLength;

    const sprayCount = isRage ? 3 : 1;
    for (let i = 0; i < sprayCount; i++) {
      const bullet = this.bullets.get() as Bullet;
      if (!bullet) continue;

      let finalDir = dir.clone();
      if (isRage && sprayCount > 1) {
        finalDir = new Phaser.Math.Vector2().setToPolar(dir.angle() + (i - 1) * 0.2);
      }
      
      const color = isRage ? 
        Phaser.Display.Color.GetColor(Phaser.Math.Between(200, 255), Phaser.Math.Between(100, 255), Phaser.Math.Between(200, 255)) : 
        mode.color;

      bullet.fire(spawnX, spawnY, finalDir.x, finalDir.y, isRage ? 2 : mode.dmg, isRage, 
                  this.weaponMode === 1 || isRage, this.weaponMode === 2 || isRage, color);
      bullet.setRotation(finalDir.angle());
    }
  }

  private autoProduce() {
    const config = this.levelManager.getCurrentConfig();
    if (!config) return;

    const squadCost = config.friendlyUnitCost * SQUAD_SIZE;
    if (this.gold < squadCost) return;
    this.updateGold(-squadCost);
    
    const squadId = `f_squad_${this.totalProduced}`;
    const laneIndex = Phaser.Math.Between(0, LANES.length - 1);
    
    for (let i = 0; i < SQUAD_SIZE; i++) {
      const colorIndex = (this.totalProduced + i) % MODES.length;
      this.time.delayedCall(i * 150, () => {
        const f = this.friendlies.get() as Friendly;
        if (f) f.spawn(this.barracks.x, this.barracks.y, MODES[colorIndex].color, squadId, laneIndex);
      });
    }
    this.totalProduced++;
  }

  private useBomb() {
    if (this.bombs <= 0) return;
    this.bombs--;
    this.events.emit("updateBombs", this.bombs);
    this.cameras.main.flash(500, 255, 255, 255);
    this.enemies.getChildren().forEach(obj => {
      const e = obj as Enemy;
      if (e.active) this.time.delayedCall(Phaser.Math.Between(0, 200), () => { if (e.active) this.killEnemy(e); });
    });
  }

  // --- Spawning ---

  private spawnEnemySquad() {
    const config = this.levelManager.getCurrentConfig();
    if (!config) return;

    const laneIndices = Phaser.Utils.Array.NumberArray(0, LANES.length - 1) as number[];
    Phaser.Utils.Array.Shuffle(laneIndices);

    for (let s = 0; s < config.enemySpawnSquads; s++) {
      const laneIndex = laneIndices[s % laneIndices.length];
      const colorIndex = this.getRandomColorIndex(config.colorWeights);
      const squadId = `e_squad_${this.time.now}_${s}`;
      const laneY = LANES[laneIndex];

      for (let i = 0; i < SQUAD_SIZE; i++) {
        this.time.delayedCall(i * 150, () => {
          const e = this.enemies.get() as Enemy;
          if (e) {
            let spawnY = laneY + Phaser.Math.Between(-20, 20);
            // Constrain Y to keep sprite within mask bounds (y:30 to 570)
            // Enemy scale is 0.5, so rough height is ~60px (±30 from origin)
            spawnY = Phaser.Math.Clamp(spawnY, 60, SCREEN_HEIGHT - 60);
            e.spawn(SCREEN_WIDTH + 50, spawnY, MODES[colorIndex].color, config.enemySpeed, squadId, laneIndex, false);
          }
        });
      }
    }
  }

  private getRandomColorIndex(weights?: number[]): number {
    if (!weights || weights.length === 0) {
      return Phaser.Math.Between(0, MODES.length - 1);
    }
    const sum = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * sum;
    for (let i = 0; i < weights.length; i++) {
      if (rand < weights[i]) return i;
      rand -= weights[i];
    }
    return weights.length - 1; // Fallback
  }

  private spawnElite() {
    const config = this.levelManager.getCurrentConfig();
    if (!config) return;

    const colorIndex = Phaser.Math.Between(0, 2);
    const laneIndex = Phaser.Math.Between(0, LANES.length - 1);
    const e = this.enemies.get() as Enemy;
    if (e) {
      let spawnY = LANES[laneIndex];
      // Elite scale is also 0.5, height is ~120px (±60 from origin)
      spawnY = Phaser.Math.Clamp(spawnY, 90, SCREEN_HEIGHT - 90);
      e.spawn(SCREEN_WIDTH + 50, spawnY, MODES[colorIndex].color, config.enemySpeed + 10, "elite", laneIndex, true);
    }
  }

  // --- Collision Handlers ---

  private handleBulletEnemyCollision(bullet: Bullet, enemy: Enemy) {
    if (!bullet.active || !enemy.active) return;
    if (bullet.isPierce && bullet.hitTargets.has(enemy)) return;
    if (!bullet.isPierce && bullet.hasHit) return;

    if (bullet.col !== enemy.col && !bullet.isRage) {
      if (!bullet.hasHit) {
        // Only break combo if the bullet hasn't hit any correct enemies yet
        this.updateCombo(0);
      }
      bullet.deactivate();
      spawnParticles(this, bullet.x, bullet.y, 0x969696);
      return;
    }

    bullet.hasHit = true;
    bullet.hitTargets.add(enemy);
    enemy.hp -= bullet.dmg;

    if (!bullet.isPierce) {
      if (bullet.isBlast) this.createExplosion(bullet.x, bullet.y, bullet.col, bullet.dmg * 2);
      bullet.deactivate();
    }

    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
      this.spawnEnergyOrb(enemy.x, enemy.y, enemy.col);
    }
  }

  private handleEnemyBuildingCollision(obj1: Phaser.GameObjects.GameObject, obj2: Phaser.GameObjects.GameObject) {
    const enemy = (obj1 instanceof Enemy ? obj1 : obj2) as Enemy;
    if (!enemy || !enemy.active) return;
    this.takeDamage(10, enemy.x, enemy.y);
    enemy.deactivate();
  }

  private handleFriendlyEnemyCollision(friendly: Friendly, enemy: Enemy) {
    if (!friendly.active || !enemy.active) return;
    const pairKey = `${friendly.squadId}_${enemy.squadId}`;
    if (this.stalematedPairs.has(pairKey) || friendly.isStalemated || enemy.isStalemated) return;

    this.stalematedPairs.add(pairKey);

    if (enemy.isElite) {
      // Elite kills entire squad rapidly
      const fSquad = (this.friendlies.getChildren() as Friendly[]).filter(u => u.active && u.squadId === friendly.squadId);
      
      fSquad.forEach((member, index) => {
        this.time.delayedCall(index * 100, () => {
          if (member.active) {
            spawnParticles(this, member.x, member.y, member.col);
            member.deactivate();
          }
        });
      });
      
      // Elite briefly pauses then continues
      enemy.isStalemated = true;
      if (enemy.body) enemy.body.setVelocity(0, 0);
      this.time.delayedCall(200, () => {
        if (enemy.active) {
          enemy.isStalemated = false;
          if (enemy.body) enemy.body.setVelocity(-enemy.speed, 0);
        }
      });
      return;
    }

    const fSquad = (this.friendlies.getChildren() as Friendly[]).filter(u => u.active && u.squadId === friendly.squadId);
    const eSquad = (this.enemies.getChildren() as Enemy[]).filter(u => u.active && u.squadId === enemy.squadId);
    const duration = 2000 / (1 + Math.abs(fSquad.length - eSquad.length));

    [...fSquad, ...eSquad].forEach(u => {
      if (u.active && !u.isStalemated) {
        u.isStalemated = true;
        u.stalemateOpponentSquadId = (u instanceof Friendly) ? enemy.squadId : friendly.squadId;
      }
    });

    this.time.delayedCall(duration, () => {
      if (friendly.active && enemy.active) {
        fSquad.forEach(f => {
          const matchingEnemy = eSquad.find(e => e.active && e.col === f.col);
          if (matchingEnemy) { matchingEnemy.hp -= 1; f.deactivate(); if (matchingEnemy.hp <= 0) this.killEnemy(matchingEnemy); }
        });
      }
      [...fSquad, ...eSquad].forEach(u => {
        if (u.active) {
          u.isStalemated = false;
          if (u instanceof Enemy) u.body.setVelocity(-u.speed, 0);
        }
      });
    });
  }

  private spawnEnergyOrb(startX: number, startY: number, color: number) {
    const orb = this.add.circle(startX, startY, 6, color);
    if (orb.postFX) {
      orb.postFX.addGlow(color, 2, 0, false, 0.1, 5);
    }
    orb.setDepth(10);

    // Create a simple trailing particle effect
    const particles = this.add.particles(0, 0, 'white-pixel', {
      speed: { min: 10, max: 30 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: color,
      lifespan: 200,
      frequency: 20,
      follow: orb
    });
    particles.setDepth(9);

    const targetX = this.fortressCore.x;
    const targetY = this.fortressCore.y;

    this.tweens.add({
      targets: orb,
      x: targetX,
      y: targetY,
      duration: 400,
      ease: "Cubic.easeIn",
      onComplete: () => {
        particles.stop();
        this.time.delayedCall(200, () => particles.destroy());

        // Flash effect upon absorption
        const flash = this.add.circle(targetX, targetY, 12, color)
          .setDepth(11)
          .setAlpha(0.8);
        
        this.tweens.add({
          targets: flash,
          scale: 2,
          alpha: 0,
          duration: 200,
          onComplete: () => flash.destroy()
        });

        orb.destroy();
        
        // Reset Cooldown
        this.lastShotTime = 0;
      }
    });
  }

  // --- Helper Methods ---

  private takeDamage(amount: number, sourceX?: number, sourceY?: number) {
    const now = this.time.now;
    if (now < this.lastHurtTime + 200) return;
    
    this.health -= amount;
    this.lastHurtTime = now;
    this.updateCombo(0);
    
    // More intense camera shake
    this.cameras.main.shake(300, 0.02);
    
    // Flash screen red (duration, red, green, blue)
    this.cameras.main.flash(200, 255, 0, 0);

    // Dramatic explosion effect at the source or center of base
    const exX = sourceX ?? this.fortress.x;
    const exY = sourceY ?? this.fortress.y;
    
    // Explosion shockwave
    const explosion = this.add.circle(exX, exY, 20, 0xff0000, 0.8).setDepth(20);
    this.tweens.add({
      targets: explosion,
      scale: 5,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => explosion.destroy()
    });

    // Spawn some red particles for debris
    spawnParticles(this, exX, exY, 0xff0000);

    this.sound.play("playerHurt", { volume: 0.8 });
    this.events.emit("updateHealth", this.health);
    
    if (this.health <= 0) {
      this.scene.stop("UIScene");
      this.scene.start("ResultScene", { isVictory: false, gold: this.gold, successCounts: this.successCounts });
    }
  }

  private killEnemy(enemy: Enemy) {
    enemy.deactivate();
    this.sound.play("hitHurt", { volume: 0.4 });
    spawnParticles(this, enemy.x, enemy.y, enemy.col);
    
    const mult = getMultiplier(enemy.x, enemy.y);
    this.updateCombo(1);
    this.updateGold(mult);
    spawnMultiplier(this, enemy.x, enemy.y, mult);

    if (enemy.isElite) {
      const type = Phaser.Utils.Array.GetRandom(["bomb", "health", "rage"]);
      spawnItem(this, enemy.x, enemy.y, type as any, this.fortress, () => this.handleItemCollect(type as any));
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

  private createExplosion(x: number, y: number, color: number, dmg: number) {
    const circle = this.add.circle(x, y, 50, color, 0.3);
    this.physics.add.existing(circle);
    if (circle.body && 'setCircle' in circle.body) (circle.body as Phaser.Physics.Arcade.Body).setCircle(50);
    this.physics.add.overlap(circle, this.enemies, (_, e) => {
      const target = e as Enemy;
      if (target.active && target.col === color) {
        target.hp -= dmg;
        if (target.hp <= 0) this.killEnemy(target);
      }
    });
    this.time.delayedCall(100, () => circle.destroy());
  }

  private handleFriendlyReachedEnd(x: number, y: number, color: number) {
    // Transform into a light point
    const lightPoint = this.add.circle(x, y, 8, color);
    if (lightPoint.postFX) {
      lightPoint.postFX.addGlow(color, 4, 0, false, 0.1, 10);
    }
    
    // Ensure it renders above other elements
    lightPoint.setDepth(10);

    // Get target coordinates from UIScene
    const uiScene = this.scene.get("UIScene") as any; // Cast to access custom method
    const targetPos = uiScene.getSuccessCounterPosition(color);

    if (targetPos) {
      // Create trailing particle effect
      const particles = this.add.particles(0, 0, 'white-pixel', {
        speed: { min: 20, max: 50 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: color,
        lifespan: 300,
        frequency: 30,
        follow: lightPoint
      });
      particles.setDepth(9);

      const finalX = targetPos.x + 8;
      const finalY = targetPos.y;

      // Define a curve
      const midX = x - (x - finalX) * 0.5;
      const midY = finalY - 100; // Curve upwards
      
      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(x, y),
        new Phaser.Math.Vector2(midX, midY),
        new Phaser.Math.Vector2(finalX, finalY)
      );

      // Tween along the curve
      const orbData = { t: 0 };
      this.tweens.add({
        targets: orbData,
        t: 1,
        duration: 800,
        ease: "Sine.easeInOut",
        onUpdate: () => {
          const vec = curve.getPoint(orbData.t);
          lightPoint.setPosition(vec.x, vec.y);
          // Scale down slightly as it moves
          lightPoint.setScale(1 - (orbData.t * 0.5));
        },
        onComplete: () => {
          particles.stop();
          this.time.delayedCall(300, () => particles.destroy());
          
          // Flash effect upon absorption
          const flash = this.add.circle(finalX, finalY, 15, color)
            .setDepth(11)
            .setAlpha(0.8);
          
          this.tweens.add({
            targets: flash,
            scale: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => flash.destroy()
          });

          lightPoint.destroy();
          this.handleFriendlyScore(color);
        }
      });
    } else {
      // Fallback if UI target not found
      lightPoint.destroy();
      this.handleFriendlyScore(color);
    }
  }

  private handleFriendlyScore(color: number) {
    const idx = MODES.findIndex(m => m.color === color);
    if (idx === -1) return;
    this.successCounts[idx] += SCORE_PER_UNIT;
    this.events.emit("updateSuccess", this.successCounts);
  }

  private updateFriendlyAI(f: Friendly) {
    const visionRadius = SCREEN_WIDTH * 0.25;
    let target: Enemy | null = null;

    this.enemies.getChildren().forEach(obj => {
      const e = obj as Enemy;
      if (!e.active) return;
      const dist = Phaser.Math.Distance.Between(f.x, f.y, e.x, e.y);
      if (dist < visionRadius && e.x >= f.x && Math.abs(e.laneIndex - f.laneIndex) <= 1) {
        if (!target || e.x < target.x) target = e;
      }
    });

    let vx = 0;
    let vy = 0;

    if (target) {
      const angle = Phaser.Math.Angle.Between(f.x, f.y, (target as Enemy).x, (target as Enemy).y);
      const vec = this.physics.velocityFromRotation(angle, FRIENDLY_SPEED);
      vx = vec.x;
      vy = vec.y;
    } else {
      vx = FRIENDLY_SPEED;
      vy = (LANES[f.laneIndex] - f.y) * 2;
    }

    // Separation Logic
    const separationRadius = 30;
    const separationForce = 50;
    let sepX = 0;
    let sepY = 0;

    this.friendlies.getChildren().forEach(obj => {
      const other = obj as Friendly;
      if (other !== f && other.active && !other.isStalemated && f.laneIndex === other.laneIndex) {
        const dist = Phaser.Math.Distance.Between(f.x, f.y, other.x, other.y);
        if (dist > 0 && dist < separationRadius) {
          const pushX = f.x - other.x;
          const pushY = f.y - other.y;
          // Normalize and scale by how close they are
          const len = Math.sqrt(pushX * pushX + pushY * pushY);
          const weight = 1 - (dist / separationRadius);
          sepX += (pushX / len) * separationForce * weight;
          sepY += (pushY / len) * separationForce * weight;
        }
      }
    });

    f.body.setVelocity(vx + sepX, vy + sepY);
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

      // --- UI Updates ---
      // Clear any existing fade tween
      if (this.comboFadeTween) {
        this.comboFadeTween.stop();
        this.comboFadeTween = undefined;
      }

      this.comboLabel.setText(`${this.combo}`).setAlpha(1);
      this.comboBg.setAlpha(1);
      
      // Prevent pop animation from interrupting itself too aggressively
      if (!this.tweens.isTweening(this.comboBg)) {
        // Pop animation
        const originalScale = 0.5; // Fixed scale
        this.comboBg.setScale(originalScale);
        this.tweens.add({
          targets: [this.comboBg],
          scale: { from: originalScale * 1.2, to: originalScale },
          duration: 100,
          ease: "Back.easeOut"
        });
      }

      // Add a delayed fade out to make it semi-transparent
      this.comboFadeTween = this.tweens.add({
        targets: [this.comboLabel, this.comboBg],
        alpha: 0.3,
        delay: 1500, // Wait 1.5s before fading
        duration: 1000, // Take 1s to fade
        ease: "Linear"
      });

    } else {
      this.combo = 0;
      
      // --- UI Updates ---
      if (this.comboFadeTween) {
        this.comboFadeTween.stop();
        this.comboFadeTween = undefined;
      }
      this.comboLabel.setAlpha(0);
      this.comboBg.setAlpha(0);
    }
    
    // Still emit for other systems if needed, though UI is handled locally now
    this.events.emit("updateCombo", this.combo);
  }
}
