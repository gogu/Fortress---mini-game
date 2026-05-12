import Phaser from "phaser";
import { Enemy, Friendly, spawnItem } from "../entities";
import { 
  MODES, SCREEN_WIDTH, SCREEN_HEIGHT, SQUAD_SIZE, LANES, 
  ENEMY_GOAL_X, FRIENDLY_GOAL_X, FRIENDLY_SPEED, SCORE_PER_UNIT 
} from "../constants";
import { spawnParticles, getMultiplier, spawnMultiplier } from "../utils";
import { ILevelConfig, IWaveConfig, IEnemySpawnDef } from "./LevelManager";

export class EntityManager {
  private scene: Phaser.Scene;
  private enemies: Phaser.Physics.Arcade.Group;
  private friendlies: Phaser.Physics.Arcade.Group;
  
  private totalProduced: number = 0;
  private stalematedPairs: Set<string> = new Set();
  
  private barracks: Phaser.GameObjects.Sprite;
  private fortress: Phaser.GameObjects.Sprite;

  // --- Wave State ---
  private currentWaveIndex: number = 0;
  private waveStartTime: number = 0;
  private spawnQueue: IEnemySpawnDef[] = [];
  private isWaitingForNextWave: boolean = false;
  private allWavesFinished: boolean = false;
  private currentLevelConfig: ILevelConfig | null = null;

  constructor(scene: Phaser.Scene, barracks: Phaser.GameObjects.Sprite, fortress: Phaser.GameObjects.Sprite) {
    this.scene = scene;
    this.barracks = barracks;
    this.fortress = fortress;
    
    this.enemies = scene.physics.add.group({ classType: Enemy, runChildUpdate: true });
    this.friendlies = scene.physics.add.group({ classType: Friendly, runChildUpdate: true });
    
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.scene.events.on("friendlyReachedEnd", (x: number, y: number, color: number) => {
      this.handleFriendlyReachedEnd(x, y, color);
    });
    
    this.scene.events.on("friendlyUpdate", (f: Friendly) => {
      this.updateFriendlyAI(f);
    });
  }

  public startPreciseLevel(config: ILevelConfig) {
    this.currentLevelConfig = config;
    this.currentWaveIndex = 0;
    this.spawnQueue = [];
    this.isWaitingForNextWave = false;
    this.allWavesFinished = false;

    if (config.waves && config.waves.length > 0) {
      this.loadWave(config.waves[this.currentWaveIndex]);
    } else {
      this.allWavesFinished = true;
      this.scene.events.emit("allWavesCompleted");
    }
  }

  private loadWave(wave: IWaveConfig) {
    this.isWaitingForNextWave = true;
    
    this.scene.time.delayedCall(wave.delayBeforeStart, () => {
      this.isWaitingForNextWave = false;
      this.waveStartTime = this.scene.time.now;
      this.spawnQueue = [...wave.spawns].sort((a, b) => a.time - b.time);
    });
  }

  public update(time: number, delta: number) {
    this.updateUnitLogic();
    this.checkBoundaries();
    this.processSpawnQueue(time);
  }

  private processSpawnQueue(time: number) {
    if (this.allWavesFinished || this.isWaitingForNextWave) return;

    if (this.spawnQueue.length > 0) {
      const elapsedSinceWaveStart = time - this.waveStartTime;
      
      while (this.spawnQueue.length > 0 && this.spawnQueue[0].time <= elapsedSinceWaveStart) {
        const spawnDef = this.spawnQueue.shift()!;
        this.spawnSpecificEnemy(spawnDef);
      }
    }

    // Check if wave is finished
    if (this.spawnQueue.length === 0 && this.currentLevelConfig?.waves) {
      const currentWave = this.currentLevelConfig.waves[this.currentWaveIndex];
      const delay = currentWave.delayAfterWave || 0;

      this.isWaitingForNextWave = true;

      this.scene.time.delayedCall(delay, () => {
        if (this.currentWaveIndex < this.currentLevelConfig!.waves!.length - 1) {
          this.currentWaveIndex++;
          this.loadWave(this.currentLevelConfig!.waves![this.currentWaveIndex]);
        } else {
          this.allWavesFinished = true;
          this.isWaitingForNextWave = false;
          this.scene.events.emit("allWavesCompleted");
        }
      });
    }
  }

  private spawnSpecificEnemy(def: IEnemySpawnDef) {
    const e = this.enemies.get() as Enemy;
    if (e) {
      const laneY = LANES[def.lane];
      let spawnY = laneY + Phaser.Math.Between(-10, 10);
      const verticalPadding = def.isElite ? 90 : 60;
      spawnY = Phaser.Math.Clamp(spawnY, verticalPadding, SCREEN_HEIGHT - verticalPadding);
      
      const speed = this.currentLevelConfig?.enemySpeed || 50;
      e.spawn(SCREEN_WIDTH + 50, spawnY, MODES[def.color].color, speed, `wave_enemy_${this.scene.time.now}`, def.lane, !!def.isElite);
    }
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
        this.scene.events.emit("baseDamaged", 10, e.x, e.y);
        e.deactivate();
      }
    });
  }

  // --- Spawning Logic ---

  public spawnEnemySquad(config: any) {
    const laneIndices = Phaser.Utils.Array.NumberArray(0, LANES.length - 1) as number[];
    Phaser.Utils.Array.Shuffle(laneIndices);

    for (let s = 0; s < config.enemySpawnSquads; s++) {
      const laneIndex = laneIndices[s % laneIndices.length];
      const colorIndex = this.getRandomColorIndex(config.colorWeights);
      const squadId = `e_squad_${this.scene.time.now}_${s}`;
      const laneY = LANES[laneIndex];

      for (let i = 0; i < SQUAD_SIZE; i++) {
        this.scene.time.delayedCall(i * 150, () => {
          const e = this.enemies.get() as Enemy;
          if (e) {
            let spawnY = laneY + Phaser.Math.Between(-20, 20);
            spawnY = Phaser.Math.Clamp(spawnY, 60, SCREEN_HEIGHT - 60);
            e.spawn(SCREEN_WIDTH + 50, spawnY, MODES[colorIndex].color, config.enemySpeed, squadId, laneIndex, false);
          }
        });
      }
    }
  }

  public spawnElite(config: any) {
    const colorIndex = Phaser.Math.Between(0, 2);
    const laneIndex = Phaser.Math.Between(0, LANES.length - 1);
    const e = this.enemies.get() as Enemy;
    if (e) {
      let spawnY = LANES[laneIndex];
      spawnY = Phaser.Math.Clamp(spawnY, 90, SCREEN_HEIGHT - 90);
      e.spawn(SCREEN_WIDTH + 50, spawnY, MODES[colorIndex].color, config.enemySpeed + 10, "elite", laneIndex, true);
    }
  }

  public autoProduce(config: any, currentGold: number): number {
    const squadCost = config.friendlyUnitCost * SQUAD_SIZE;
    if (currentGold < squadCost) return 0;
    
    const squadId = `f_squad_${this.totalProduced}`;
    const laneIndex = Phaser.Math.Between(0, LANES.length - 1);
    
    for (let i = 0; i < SQUAD_SIZE; i++) {
      const colorIndex = (this.totalProduced + i) % MODES.length;
      this.scene.time.delayedCall(i * 150, () => {
        const f = this.friendlies.get() as Friendly;
        if (f) f.spawn(this.barracks.x, this.barracks.y, MODES[colorIndex].color, squadId, laneIndex);
      });
    }
    this.totalProduced++;
    return squadCost;
  }

  private getRandomColorIndex(weights?: number[]): number {
    if (!weights || weights.length === 0) return Phaser.Math.Between(0, MODES.length - 1);
    const sum = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * sum;
    for (let i = 0; i < weights.length; i++) {
      if (rand < weights[i]) return i;
      rand -= weights[i];
    }
    return weights.length - 1;
  }

  // --- Handlers ---

  private handleFriendlyReachedEnd(x: number, y: number, color: number) {
    const lightPoint = this.scene.add.circle(x, y, 8, color).setDepth(10);
    if (lightPoint.postFX) lightPoint.postFX.addGlow(color, 4, 0, false, 0.1, 10);

    const uiScene = this.scene.scene.get("UIScene") as any;
    const targetPos = uiScene.getSuccessCounterPosition(color);

    if (targetPos) {
      const particles = this.scene.add.particles(0, 0, 'white-pixel', {
        speed: { min: 20, max: 50 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: color,
        lifespan: 300,
        frequency: 30,
        follow: lightPoint
      }).setDepth(9);

      const finalX = targetPos.x + 8;
      const finalY = targetPos.y;
      const midX = x - (x - finalX) * 0.5;
      const midY = finalY - 100;
      
      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(x, y),
        new Phaser.Math.Vector2(midX, midY),
        new Phaser.Math.Vector2(finalX, finalY)
      );

      const orbData = { t: 0 };
      this.scene.tweens.add({
        targets: orbData, t: 1, duration: 800, ease: "Sine.easeInOut",
        onUpdate: () => {
          const vec = curve.getPoint(orbData.t);
          lightPoint.setPosition(vec.x, vec.y);
          lightPoint.setScale(1 - (orbData.t * 0.5));
        },
        onComplete: () => {
          particles.stop();
          this.scene.time.delayedCall(300, () => particles.destroy());
          const flash = this.scene.add.circle(finalX, finalY, 15, color).setDepth(11).setAlpha(0.8);
          this.scene.tweens.add({ targets: flash, scale: 2, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
          lightPoint.destroy();
          this.scene.events.emit("scorePoint", color);
        }
      });
    } else {
      lightPoint.destroy();
      this.scene.events.emit("scorePoint", color);
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

    let vx = 0; let vy = 0;
    if (target) {
      const angle = Phaser.Math.Angle.Between(f.x, f.y, (target as Enemy).x, (target as Enemy).y);
      const vec = this.scene.physics.velocityFromRotation(angle, FRIENDLY_SPEED);
      vx = vec.x; vy = vec.y;
    } else {
      vx = FRIENDLY_SPEED;
      vy = (LANES[f.laneIndex] - f.y) * 2;
    }

    const separationRadius = 30; const separationForce = 50;
    let sepX = 0; let sepY = 0;

    this.friendlies.getChildren().forEach(obj => {
      const other = obj as Friendly;
      if (other !== f && other.active && !other.isStalemated && f.laneIndex === other.laneIndex) {
        const dist = Phaser.Math.Distance.Between(f.x, f.y, other.x, other.y);
        if (dist > 0 && dist < separationRadius) {
          const pushX = f.x - other.x; const pushY = f.y - other.y;
          const len = Math.sqrt(pushX * pushX + pushY * pushY);
          const weight = 1 - (dist / separationRadius);
          sepX += (pushX / len) * separationForce * weight;
          sepY += (pushY / len) * separationForce * weight;
        }
      }
    });

    f.body.setVelocity(vx + sepX, vy + sepY);
  }

  public getEnemies() { return this.enemies; }
  public getFriendlies() { return this.friendlies; }
  public clearAll() {
    (this.enemies.getChildren() as any[]).forEach(e => { if(e.shadowGraphics) e.shadowGraphics.clear(); });
    (this.friendlies.getChildren() as any[]).forEach(f => { if(f.shadowGraphics) f.shadowGraphics.clear(); });
    this.enemies.clear(true, true);
    this.friendlies.clear(true, true);
    this.stalematedPairs.clear();
  }

  /**
   * Immediately clears all units from the field.
   * Enemies will trigger their death logic (particles, sound, gold).
   */
  public clearField(triggerEnemyDeath: boolean = true) {
    if (triggerEnemyDeath) {
      const activeEnemies = (this.enemies.getChildren() as Enemy[]).filter(e => e.active);
      activeEnemies.forEach(e => this.killEnemy(e));
    } else {
      (this.enemies.getChildren() as any[]).forEach(e => { if(e.shadowGraphics) e.shadowGraphics.clear(); });
      this.enemies.clear(true, true);
    }

    (this.friendlies.getChildren() as any[]).forEach(f => { if(f.shadowGraphics) f.shadowGraphics.clear(); f.deactivate(); });
    this.friendlies.clear(true, true);
    this.stalematedPairs.clear();
  }

  public killEnemy(enemy: Enemy) {
    enemy.deactivate();
    this.scene.sound.play("hitHurt", { volume: 0.4 });
    spawnParticles(this.scene, enemy.x, enemy.y, enemy.col);
    
    const mult = getMultiplier(enemy.x, enemy.y);
    this.scene.events.emit("enemyKilled", enemy, mult);
    spawnMultiplier(this.scene, enemy.x, enemy.y, mult);

    if (enemy.isElite) {
      const type = Phaser.Utils.Array.GetRandom(["bomb", "health", "rage"]);
      spawnItem(this.scene, enemy.x, enemy.y, type as any, this.fortress, () => this.scene.events.emit("itemCollected", type));
    }
  }

  public handleFriendlyEnemyCollision(friendly: Friendly, enemy: Enemy) {
    const pairKey = `${friendly.squadId}_${enemy.squadId}`;
    if (this.stalematedPairs.has(pairKey) || friendly.isStalemated || enemy.isStalemated) return;
    this.stalematedPairs.add(pairKey);

    if (enemy.isElite) {
      const fSquad = (this.friendlies.getChildren() as Friendly[]).filter(u => u.active && u.squadId === friendly.squadId);
      fSquad.forEach((member, index) => {
        this.scene.time.delayedCall(index * 100, () => {
          if (member.active) {
            spawnParticles(this.scene, member.x, member.y, member.col);
            member.deactivate();
          }
        });
      });
      enemy.isStalemated = true;
      if (enemy.body) enemy.body.setVelocity(0, 0);
      this.scene.time.delayedCall(200, () => {
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

    this.scene.time.delayedCall(duration, () => {
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
}
