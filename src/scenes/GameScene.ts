import Phaser from "phaser";
import { 
  MODES, SCREEN_WIDTH, SCREEN_HEIGHT, SQUAD_SIZE, LANES, 
  HEALTH_MAX, ENEMY_SPEED, FRIENDLY_SPEED, BULLET_SPEED, UNIT_COST 
} from "../constants";
import { spawnParticles, getMultiplier, spawnMultiplier } from "../utils";
import { Bullet, Enemy, Friendly, spawnItem } from "../entities";

export class GameScene extends Phaser.Scene {
  // State
  private health: number = HEALTH_MAX;
  private combo: number = 0;
  private gold: number = 0;
  private killSequence: number[] = [];
  private weaponMode: number = 0;
  private lastShotTime: number = 0;
  private lastHurtTime: number = 0;
  private successCounts: number[] = [0, 0, 0];
  private bombs: number = 0;
  private rageRemaining: number = 0;

  private stagingSquads: Record<number, number[]> = {};
  private stagingVisuals: Record<number, Phaser.GameObjects.Arc[]> = {};
  private dragGhost: Phaser.GameObjects.Arc | null = null;
  private dragColor: number | null = null;
  private stalematedPairs: Set<string> = new Set();
  
  // Groups
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private friendlies!: Phaser.Physics.Arcade.Group;

  // Objects
  private fortress!: Phaser.GameObjects.Rectangle;
  private fortressCore!: Phaser.GameObjects.Rectangle;

  constructor() {
    super("GameScene");
  }

  create() {
    // Background
    this.add.rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 0x05050a).setOrigin(0).setDepth(0);
    
    // Initialize Lanes & Staging Area
    LANES.forEach((y, i) => {
      this.add.grid(SCREEN_WIDTH/2, y, SCREEN_WIDTH, 2, 1, 1, 0xffffff, 0.1).setOrigin(0.5);
      this.stagingSquads[i] = [];
      this.stagingVisuals[i] = [];
    });

    // Initialize Groups
    this.bullets = this.physics.add.group({ classType: Bullet, runChildUpdate: true });
    this.enemies = this.physics.add.group({ classType: Enemy, runChildUpdate: true });
    this.friendlies = this.physics.add.group({ classType: Friendly, runChildUpdate: true });

    // Fortress
    this.fortress = this.add.rectangle(120, SCREEN_HEIGHT / 2, 60, 60, 0x282832).setStrokeStyle(4, 0x646496).setOrigin(0.5);
    this.physics.add.existing(this.fortress, true);
    if (this.fortress.body) (this.fortress.body as Phaser.Physics.Arcade.StaticBody).setSize(60, 60);
    this.fortressCore = this.add.rectangle(120, SCREEN_HEIGHT / 2, 20, 20, MODES[0].color).setOrigin(0.5);

    // Dispensers (New Barracks UI at the back)
    MODES.forEach((mode, i) => {
      const y = SCREEN_HEIGHT / 2 - 60 + i * 60;
      const dispenser = this.add.circle(40, y, 20, mode.color).setInteractive();
      dispenser.setStrokeStyle(3, 0xffffff);
      
      dispenser.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (this.gold >= UNIT_COST) {
          this.dragColor = mode.color;
          this.dragGhost = this.add.circle(pointer.x, pointer.y, 15, mode.color).setAlpha(0.5);
          this.sound.play("change", { volume: 0.2 });
        } else {
          this.sound.play("laserShootFailed", { volume: 0.3 });
        }
      });
    });

    // Global Input handling
    this.input.mouse?.disableContextMenu();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.switchMode();
      } else if (pointer.leftButtonDown() && !this.dragGhost && pointer.x > 80) {
        this.shoot(true);
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.dragGhost) {
        this.dragGhost.setPosition(pointer.x, pointer.y);
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.dragGhost && this.dragColor !== null) {
        if (pointer.x > 80) {
          const laneIndex = this.getClosestLane(pointer.y);
          this.addToStaging(laneIndex, this.dragColor);
        }
        this.dragGhost.destroy();
        this.dragGhost = null;
        this.dragColor = null;
      }
    });

    this.input.keyboard?.on("keydown-SPACE", () => this.switchMode());
    this.input.keyboard?.on("keydown-R", () => this.useBomb());

    // Collisions
    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => this.handleBulletEnemyCollision(b as Bullet, e as Enemy));
    this.physics.add.overlap(this.enemies, this.fortress, (e, f) => this.handleEnemyFortressCollision(e, f));
    this.physics.add.overlap(this.friendlies, this.enemies, (f, e) => this.handleFriendlyEnemyCollision(f as Friendly, e as Enemy));

    // Custom Events
    this.events.on("bulletMissed", () => this.updateCombo(0));
    this.events.on("friendlyScored", (color: number) => this.handleFriendlyScore(color));
    this.events.on("friendlyUpdate", (f: Friendly) => this.updateFriendlyAI(f));

    // Enemy Spawning Loops
    this.time.addEvent({ delay: 3000, callback: this.spawnEnemySquad, callbackScope: this, loop: true });
    this.time.addEvent({ delay: 10000, callback: () => { if (Math.random() < 0.33) this.spawnElite(); }, callbackScope: this, loop: true });

    // Initial Sync
    this.time.delayedCall(100, () => {
      this.events.emit("updateGold", this.gold);
      this.events.emit("updateSuccess", this.successCounts);
      this.events.emit("updateCombo", this.combo);
      this.events.emit("updateBombs", this.bombs);
      this.events.emit("updateHealth", this.health);
    });
  }

  update(time: number, delta: number) {
    if (this.rageRemaining > 0) {
      this.rageRemaining -= delta / 1000;
      this.events.emit("updateRage", this.rageRemaining);
      
      if (time > this.lastShotTime + 100) {
        this.shoot();
      }
      if (this.rageRemaining <= 0) {
        this.rageRemaining = 0;
        this.events.emit("updateRage", 0);
      }
    }
    
    this.fortressCore.setAlpha(0.5 + 0.3 * Math.sin(time / 200));

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

  private getClosestLane(y: number): number {
    let minDist = Infinity;
    let index = 0;
    LANES.forEach((laneY, i) => {
      const d = Math.abs(laneY - y);
      if (d < minDist) {
        minDist = d;
        index = i;
      }
    });
    return index;
  }

  private addToStaging(laneIndex: number, color: number) {
    this.updateGold(-UNIT_COST);
    const squad = this.stagingSquads[laneIndex];
    squad.push(color);

    const laneY = LANES[laneIndex];
    // Draw staging visuals visually behind/around fortress
    const visX = 70 + squad.length * 15; 
    const vis = this.add.circle(visX, laneY, 6, color).setAlpha(0.6);
    this.stagingVisuals[laneIndex].push(vis);

    if (squad.length === SQUAD_SIZE) {
      this.spawnStagedSquad(laneIndex);
    }
  }

  private spawnStagedSquad(laneIndex: number) {
    const squadColors = [...this.stagingSquads[laneIndex]];
    this.stagingSquads[laneIndex] = [];

    this.stagingVisuals[laneIndex].forEach(v => v.destroy());
    this.stagingVisuals[laneIndex] = [];

    const squadId = `f_squad_${this.time.now}_${laneIndex}`;
    squadColors.forEach((color, i) => {
      this.time.delayedCall(i * 150, () => {
        const f = this.friendlies.get() as Friendly;
        if (f) {
          f.spawn(100, LANES[laneIndex], color, squadId, laneIndex);
        }
      });
    });
  }

  private switchMode() {
    this.weaponMode = (this.weaponMode + 1) % MODES.length;
    this.sound.play("change", { volume: 0.5 });
    this.cameras.main.shake(100, 0.005);
    this.fortressCore.setFillStyle(MODES[this.weaponMode].color);
    
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
    const dir = new Phaser.Math.Vector2(pointer.x - this.fortress.x, pointer.y - this.fortress.y).normalize();

    const sprayCount = isRage ? 3 : 1;
    for (let i = 0; i < sprayCount; i++) {
      const bullet = this.bullets.get() as Bullet;
      if (bullet) {
        let finalDir = dir.clone();
        if (isRage && sprayCount > 1) {
          const angle = dir.angle() + (i - 1) * 0.2;
          finalDir = new Phaser.Math.Vector2().setToPolar(angle);
        }
        
        const color = isRage ? 
          Phaser.Display.Color.GetColor(Phaser.Math.Between(200, 255), Phaser.Math.Between(100, 255), Phaser.Math.Between(200, 255)) : 
          mode.color;

        bullet.fire(
          this.fortress.x, 
          this.fortress.y, 
          finalDir.x, 
          finalDir.y, 
          isRage ? 2 : mode.dmg, 
          isRage, 
          this.weaponMode === 1 || isRage, 
          this.weaponMode === 2 || isRage,
          color
        );
        bullet.setRotation(finalDir.angle());
      }
    }
  }

  private spawnEnemySquad() {
    const colorIndex = Phaser.Math.Between(0, 2);
    const squadId = `e_squad_${this.time.now}`;
    const laneIndex = Phaser.Math.Between(0, LANES.length - 1);
    const laneY = LANES[laneIndex];

    for (let i = 0; i < SQUAD_SIZE; i++) {
      this.time.delayedCall(i * 150, () => {
        const e = this.enemies.get() as Enemy;
        if (e) {
          e.spawn(SCREEN_WIDTH + 50, laneY + Phaser.Math.Between(-20, 20), MODES[colorIndex].color, ENEMY_SPEED, squadId, laneIndex, false);
        }
      });
    }
  }

  private spawnElite() {
    const colorIndex = Phaser.Math.Between(0, 2);
    const laneIndex = Phaser.Math.Between(0, LANES.length - 1);
    const e = this.enemies.get() as Enemy;
    if (e) {
      e.spawn(SCREEN_WIDTH + 50, LANES[laneIndex], MODES[colorIndex].color, ENEMY_SPEED + 10, "elite", laneIndex, true);
    }
  }

  private handleBulletEnemyCollision(bullet: Bullet, enemy: Enemy) {
    if (!bullet.active || !enemy.active) return;
    if (bullet.isPierce && bullet.hitTargets.has(enemy)) return;
    if (!bullet.isPierce && bullet.hasHit) return;

    const isMismatch = bullet.col !== enemy.col;
    if (isMismatch && !bullet.isRage) {
      bullet.deactivate();
      this.updateCombo(0);
      spawnParticles(this, bullet.x, bullet.y, 0x969696);
      return;
    }

    bullet.hasHit = true;
    bullet.hitTargets.add(enemy);
    enemy.hp -= bullet.dmg;

    if (!bullet.isPierce) {
      if (bullet.isBlast) {
        this.createExplosion(bullet.x, bullet.y, bullet.col, bullet.dmg * 2);
      }
      bullet.deactivate();
    }

    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
      const mode = MODES[this.weaponMode];
      const cdMs = mode.cd * 1000;
      this.lastShotTime = this.time.now - (cdMs - 100);
    }
  }

  private createExplosion(x: number, y: number, color: number, dmg: number) {
    const circle = this.add.circle(x, y, 50, color, 0.3);
    this.physics.add.existing(circle);
    if (circle.body && 'setCircle' in circle.body) {
      (circle.body as Phaser.Physics.Arcade.Body).setCircle(50);
    }
    
    this.physics.add.overlap(circle, this.enemies, (_, e) => {
      const enemy = e as Enemy;
      if (enemy.active && enemy.col === color) {
        enemy.hp -= dmg;
        if (enemy.hp <= 0) this.killEnemy(enemy);
      }
    });

    this.time.delayedCall(100, () => circle.destroy());
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
      spawnItem(this, enemy.x, enemy.y, type as any, this.fortress, () => {
        this.handleItemCollect(type as any);
      });
    }

    this.killSequence.push(enemy.col);
    this.events.emit("updateSequence", this.killSequence);
    if (this.killSequence.length >= 3) {
      this.time.delayedCall(500, () => {
        this.killSequence = [];
        this.events.emit("updateSequence", this.killSequence);
      });
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

  private handleEnemyFortressCollision(enemy: any, fortress: any) {
    if (!enemy || !enemy.active || enemy === this.fortress) return;
    
    if (typeof enemy.deactivate === 'function') {
      enemy.deactivate();
    } else {
      enemy.setActive(false);
      enemy.setVisible(false);
      if (enemy.body && 'setVelocity' in enemy.body) {
        enemy.body.setVelocity(0, 0);
      }
    }
    
    this.updateCombo(0);
    this.cameras.main.shake(100, 0.01);

    const now = this.time.now;
    if (now > this.lastHurtTime + 200) {
      this.health -= 10;
      this.lastHurtTime = now;
      this.sound.play("playerHurt", { volume: 0.7 });
      this.events.emit("updateHealth", this.health);
      
      if (this.health <= 0) {
        this.scene.start("GameScene");
      }
    }
  }

  private handleFriendlyEnemyCollision(friendly: Friendly, enemy: Enemy) {
    if (!friendly.active || !enemy.active) return;
    const pairKey = `${friendly.squadId}_${enemy.squadId}`;
    if (this.stalematedPairs.has(pairKey)) return;
    if (friendly.isStalemated || enemy.isStalemated) return;

    this.stalematedPairs.add(pairKey);

    if (enemy.isElite) {
      friendly.isStalemated = true;
      enemy.isStalemated = true;
      friendly.stalemateTarget = enemy;
      enemy.stalemateTarget = friendly;
      friendly.stalemateOpponentSquadId = enemy.squadId;
      enemy.stalemateOpponentSquadId = friendly.squadId;

      this.time.delayedCall(100, () => {
        if (friendly.active && enemy.active && friendly.stalemateTarget === enemy) {
          friendly.deactivate();
          enemy.isStalemated = false;
          enemy.stalemateTarget = null;
          enemy.stalemateOpponentSquadId = null;
          enemy.body.setVelocity(-enemy.speed, 0);
        } else {
          if (friendly.active) { friendly.isStalemated = false; friendly.stalemateTarget = null; friendly.stalemateOpponentSquadId = null; }
          if (enemy.active) { enemy.isStalemated = false; enemy.stalemateTarget = null; enemy.stalemateOpponentSquadId = null; }
        }
      });
      return;
    }

    const fSquad = (this.friendlies.getChildren() as Friendly[]).filter(u => u.active && u.squadId === friendly.squadId);
    const eSquad = (this.enemies.getChildren() as Enemy[]).filter(u => u.active && u.squadId === enemy.squadId);

    const diff = Math.abs(fSquad.length - eSquad.length);
    const duration = 2000 / (1 + diff);

    friendly.isStalemated = true;
    enemy.isStalemated = true;
    friendly.stalemateTarget = enemy;
    enemy.stalemateTarget = friendly;
    friendly.stalemateOpponentSquadId = enemy.squadId;
    enemy.stalemateOpponentSquadId = friendly.squadId;

    fSquad.forEach(u => {
      if (u.active && !u.isStalemated && Phaser.Math.Distance.Between(u.x, u.y, friendly.x, friendly.y) < 50) {
        u.isStalemated = true;
        u.stalemateOpponentSquadId = enemy.squadId;
      }
    });
    eSquad.forEach(u => {
      if (u.active && !u.isStalemated && Phaser.Math.Distance.Between(u.x, u.y, enemy.x, enemy.y) < 50) {
        u.isStalemated = true;
        u.stalemateOpponentSquadId = friendly.squadId;
      }
    });

    this.time.delayedCall(duration, () => {
      if (friendly.active && enemy.active) {
        const currentFSquad = (this.friendlies.getChildren() as Friendly[]).filter(u => u.active && u.squadId === friendly.squadId);
        const currentESquad = (this.enemies.getChildren() as Enemy[]).filter(u => u.active && u.squadId === enemy.squadId);
        currentFSquad.forEach(f => {
          const matchingEnemy = currentESquad.find(e => e.active && e.col === f.col);
          if (matchingEnemy) {
            matchingEnemy.hp -= 1;
            f.deactivate();
            if (matchingEnemy.hp <= 0) this.killEnemy(matchingEnemy);
          }
        });
      }

      const finalFSquad = (this.friendlies.getChildren() as Friendly[]).filter(u => u.active && u.squadId === friendly.squadId);
      const finalESquad = (this.enemies.getChildren() as Enemy[]).filter(u => u.active && u.squadId === enemy.squadId);

      finalFSquad.forEach(u => { u.isStalemated = false; u.stalemateTarget = null; u.stalemateOpponentSquadId = null; });
      finalESquad.forEach(u => {
        u.isStalemated = false;
        u.stalemateTarget = null;
        u.stalemateOpponentSquadId = null;
        u.body.setVelocity(-u.speed, 0);
      });
    });
  }

  private handleFriendlyScore(color: number) {
    const idx = MODES.findIndex(m => m.color === color);
    if (idx !== -1) {
      this.successCounts[idx]++;
      this.events.emit("updateSuccess", this.successCounts);
      if (this.successCounts.every(c => c >= 50)) {
        this.scene.start("GameScene");
      }
    }
  }

  private updateFriendlyAI(f: Friendly) {
    const visionRadius = SCREEN_WIDTH * 0.25;
    let target: Enemy | null = null;
    this.enemies.getChildren().forEach((obj) => {
      const e = obj as Enemy;
      if (!e.active) return;
      const dist = Phaser.Math.Distance.Between(f.x, f.y, e.x, e.y);
      if (dist < visionRadius && e.x >= f.x && Math.abs(e.laneIndex - f.laneIndex) <= 1) {
        if (!target || e.x < target.x) target = e;
      }
    });
    if (target) {
      const angle = Phaser.Math.Angle.Between(f.x, f.y, target.x, target.y);
      this.physics.velocityFromRotation(angle, FRIENDLY_SPEED, f.body.velocity);
    } else {
      const targetY = LANES[f.laneIndex];
      const dy = targetY - f.y;
      f.body.setVelocity(FRIENDLY_SPEED, dy * 2);
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
      this.events.emit("updateSequence", this.killSequence);
    }
    this.events.emit("updateCombo", this.combo);
  }

  private useBomb() {
    if (this.bombs <= 0) return;
    this.bombs--;
    this.events.emit("updateBombs", this.bombs);
    this.cameras.main.flash(500, 255, 255, 255);
    this.enemies.getChildren().forEach((obj) => {
      const e = obj as Enemy;
      if (e.active) {
        this.time.delayedCall(Phaser.Math.Between(0, 500), () => {
          if (e.active) this.killEnemy(e);
        });
      }
    });
  }
}
