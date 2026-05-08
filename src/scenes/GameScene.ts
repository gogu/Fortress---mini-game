import Phaser from "phaser";
import { 
  MODES, SCREEN_WIDTH, SCREEN_HEIGHT, SQUAD_SIZE, LANES, 
  HEALTH_MAX, ENEMY_SPEED, FRIENDLY_SPEED, WIN_CONDITION
} from "../constants";
import { spawnParticles, getMultiplier, spawnMultiplier } from "../utils";
import { Bullet, Enemy, Friendly, spawnItem } from "../entities";

export class GameScene extends Phaser.Scene {
  // --- State ---
  private health!: number;
  private combo!: number;
  private gold!: number;
  private killSequence!: number[];
  private weaponMode!: number;
  private lastShotTime!: number;
  private lastHurtTime!: number;
  private successCounts!: number[];
  private bombs!: number;
  private rageRemaining!: number;

  private totalProduced!: number;
  private producedCounts!: number[];
  private stalematedPairs!: Set<string>;
  
  // --- Groups ---
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private friendlies!: Phaser.Physics.Arcade.Group;

  // --- Objects ---
  private fortress!: Phaser.GameObjects.Sprite;
  private fortressCore!: Phaser.GameObjects.Sprite;
  private barracks!: Phaser.GameObjects.Sprite;

  constructor() {
    super("GameScene");
  }

  // --- Lifecycle ---

  init() {
    this.health = HEALTH_MAX;
    this.combo = 0;
    this.gold = 0;
    this.killSequence = [];
    this.weaponMode = 0;
    this.lastShotTime = 0;
    this.lastHurtTime = 0;
    this.successCounts = [0, 0, 0];
    this.bombs = 0;
    this.rageRemaining = 0;

    this.totalProduced = 0;
    this.producedCounts = [0, 0, 0];
    this.stalematedPairs = new Set();
  }

  create() {
    this.setupBackground();
    this.setupGroups();
    this.setupBuildings();
    this.setupInput();
    this.setupCollisions();
    this.setupEventHandlers();
    this.setupLoops();
    
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
    this.handleRageMode(time, delta);
    this.updateBarrelRotation();
    this.updateUnitLogic();
    this.checkBoundaries();
  }

  // --- Setup Methods ---

  private setupBackground() {
    this.add.rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 0xefeadc).setOrigin(0).setDepth(0);
    this.add.image(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, "bg_notebook")
      .setDisplaySize(SCREEN_WIDTH, SCREEN_HEIGHT)
      .setDepth(0)
      .setAlpha(0.9);
  }

  private setupGroups() {
    this.bullets = this.physics.add.group({ classType: Bullet, runChildUpdate: true });
    this.enemies = this.physics.add.group({ classType: Enemy, runChildUpdate: true });
    this.friendlies = this.physics.add.group({ classType: Friendly, runChildUpdate: true });
  }

  private setupBuildings() {
    // Fortress Base
    this.fortress = this.add.sprite(100, SCREEN_HEIGHT / 2, "bldg_fortress").setScale(0.5).setOrigin(0.5);
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
    this.barracks = this.add.sprite(150, SCREEN_HEIGHT / 2 + 120, "bldg_barracks").setScale(0.35).setOrigin(0.8);
    this.physics.add.existing(this.barracks, true);
    if (this.barracks.body) (this.barracks.body as Phaser.Physics.Arcade.StaticBody).setSize(120, 100);
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
  }

  private setupCollisions() {
    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => this.handleBulletEnemyCollision(b as Bullet, e as Enemy));
    this.physics.add.overlap(this.friendlies, this.enemies, (f, e) => this.handleFriendlyEnemyCollision(f as Friendly, e as Enemy));
    // Fortress/Barracks collision with enemies
    this.physics.add.overlap(this.enemies, [this.fortress, this.barracks], (e) => this.handleEnemyBuildingCollision(e as Enemy));
  }

  private setupEventHandlers() {
    this.events.on("bulletMissed", () => this.updateCombo(0));
    this.events.on("friendlyScored", (color: number) => this.handleFriendlyScore(color));
    this.events.on("friendlyUpdate", (f: Friendly) => this.updateFriendlyAI(f));
  }

  private setupLoops() {
    this.time.addEvent({ delay: 3000, callback: this.autoProduce, callbackScope: this, loop: true });
    this.time.addEvent({ delay: 3000, callback: this.spawnEnemySquad, callbackScope: this, loop: true });
    this.time.addEvent({ 
      delay: 10000, 
      callback: () => { if (Math.random() < 0.33) this.spawnElite(); }, 
      callbackScope: this, 
      loop: true 
    });
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
      if (e.active && e.x < 0) {
        this.takeDamage(10);
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
      fontSize: "24px",
      color: Phaser.Display.Color.IntegerToColor(MODES[this.weaponMode].color).rgba
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
    if (this.gold < SQUAD_SIZE) return;
    this.updateGold(-SQUAD_SIZE);
    
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
      if (e.active) this.time.delayedCall(Phaser.Math.Between(0, 500), () => { if (e.active) this.killEnemy(e); });
    });
  }

  // --- Spawning ---

  private spawnEnemySquad() {
    const colorIndex = Phaser.Math.Between(0, 2);
    const squadId = `e_squad_${this.time.now}`;
    const laneIndex = Phaser.Math.Between(0, LANES.length - 1);
    const laneY = LANES[laneIndex];

    for (let i = 0; i < SQUAD_SIZE; i++) {
      this.time.delayedCall(i * 150, () => {
        const e = this.enemies.get() as Enemy;
        if (e) e.spawn(SCREEN_WIDTH + 50, laneY + Phaser.Math.Between(-20, 20), MODES[colorIndex].color, ENEMY_SPEED, squadId, laneIndex, false);
      });
    }
  }

  private spawnElite() {
    const colorIndex = Phaser.Math.Between(0, 2);
    const laneIndex = Phaser.Math.Between(0, LANES.length - 1);
    const e = this.enemies.get() as Enemy;
    if (e) e.spawn(SCREEN_WIDTH + 50, LANES[laneIndex], MODES[colorIndex].color, ENEMY_SPEED + 10, "elite", laneIndex, true);
  }

  // --- Collision Handlers ---

  private handleBulletEnemyCollision(bullet: Bullet, enemy: Enemy) {
    if (!bullet.active || !enemy.active) return;
    if (bullet.isPierce && bullet.hitTargets.has(enemy)) return;
    if (!bullet.isPierce && bullet.hasHit) return;

    if (bullet.col !== enemy.col && !bullet.isRage) {
      bullet.deactivate();
      this.updateCombo(0);
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
      const cdMs = MODES[this.weaponMode].cd * 1000;
      this.lastShotTime = this.time.now - (cdMs - 100); // Kill reward CD
    }
  }

  private handleEnemyBuildingCollision(enemy: Enemy) {
    if (!enemy.active) return;
    this.takeDamage(10);
    enemy.deactivate();
  }

  private handleFriendlyEnemyCollision(friendly: Friendly, enemy: Enemy) {
    if (!friendly.active || !enemy.active) return;
    const pairKey = `${friendly.squadId}_${enemy.squadId}`;
    if (this.stalematedPairs.has(pairKey) || friendly.isStalemated || enemy.isStalemated) return;

    this.stalematedPairs.add(pairKey);

    if (enemy.isElite) {
      friendly.isStalemated = true;
      enemy.isStalemated = true;
      this.time.delayedCall(100, () => {
        if (friendly.active) friendly.deactivate();
        if (enemy.active) { enemy.isStalemated = false; enemy.body.setVelocity(-enemy.speed, 0); }
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

  // --- Helper Methods ---

  private takeDamage(amount: number) {
    const now = this.time.now;
    if (now < this.lastHurtTime + 200) return;
    
    this.health -= amount;
    this.lastHurtTime = now;
    this.updateCombo(0);
    this.cameras.main.shake(100, 0.01);
    this.sound.play("playerHurt", { volume: 0.7 });
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

    this.killSequence.push(enemy.col);
    this.events.emit("updateSequence", this.killSequence);
    if (this.killSequence.length >= 3) {
      this.time.delayedCall(500, () => { this.killSequence = []; this.events.emit("updateSequence", []); });
      this.events.emit("sequenceFailure");
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

  private handleFriendlyScore(color: number) {
    const idx = MODES.findIndex(m => m.color === color);
    if (idx === -1) return;
    this.successCounts[idx]++;
    this.events.emit("updateSuccess", this.successCounts);
    if (this.successCounts.every(c => c >= WIN_CONDITION)) {
      this.scene.stop("UIScene");
      this.scene.start("ResultScene", { isVictory: true, gold: this.gold, successCounts: this.successCounts });
    }
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

    if (target) {
      const angle = Phaser.Math.Angle.Between(f.x, f.y, (target as Enemy).x, (target as Enemy).y);
      this.physics.velocityFromRotation(angle, FRIENDLY_SPEED, f.body.velocity);
    } else {
      f.body.setVelocity(FRIENDLY_SPEED, (LANES[f.laneIndex] - f.y) * 2);
    }
  }

  private updateGold(val: number) {
    this.gold += val;
    this.events.emit("updateGold", this.gold);
  }

  private updateCombo(val: number) {
    if (val > 0) {
      this.combo += val;
      if (this.combo % 10 === 0) this.updateGold(10);
    } else {
      this.combo = 0;
      this.killSequence = [];
      this.events.emit("updateSequence", []);
    }
    this.events.emit("updateCombo", this.combo);
  }
}
