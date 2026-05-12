import Phaser from "phaser";
import { BULLET_SPEED, ENEMY_SPEED, FRIENDLY_SPEED, LANES, SCREEN_WIDTH, SCREEN_HEIGHT, MODES, ENEMY_HP, ENEMY_ELITE_HP, FRIENDLY_GOAL_X } from "./constants";

export class Bullet extends Phaser.GameObjects.Rectangle {
  declare body: Phaser.Physics.Arcade.Body;
  public dmg: number = 1;
  public hasHit: boolean = false;
  public isRage: boolean = false;
  public isBlast: boolean = false;
  public isPierce: boolean = false;
  public col: number = 0xffffff;
  public hitTargets: Set<any> = new Set();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 24, 6, 0xffffff);
    scene.add.existing(this);
    scene.physics.add.existing(this);
  }

  fire(x: number, y: number, velocityX: number, velocityY: number, dmg: number, isRage: boolean, isBlast: boolean, isPierce: boolean, color: number) {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.hasHit = false;
    this.hitTargets.clear();
    this.dmg = dmg;
    this.isRage = isRage;
    this.isBlast = isBlast;
    this.isPierce = isPierce;
    this.col = color;
    this.setFillStyle(color);
    if (this.body) {
      this.body.setAllowGravity(false);
      this.body.setVelocity(velocityX * BULLET_SPEED, velocityY * BULLET_SPEED);
    }
  }

  update() {
    if (this.x < 0 || this.x > SCREEN_WIDTH || this.y < 0 || this.y > SCREEN_HEIGHT) {
      this.deactivate(true);
    }
  }

  deactivate(missed: boolean = false) {
    if (!this.active) return;
    if (missed && !this.hasHit && !this.isRage) {
      this.scene.events.emit("bulletMissed");
    }
    this.setActive(false);
    this.setVisible(false);
    this.hitTargets.clear();
    if (this.body && 'setVelocity' in this.body) {
      this.body.setVelocity(0, 0);
    }
  }
}

export class Enemy extends Phaser.GameObjects.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  public hp: number = ENEMY_HP;
  public maxHp: number = ENEMY_HP;
  public speed: number = ENEMY_SPEED;
  public col: number = 0xffffff;
  public squadId: string = "";
  public isStalemated: boolean = false;
  public stalemateTarget: any = null;
  public stalemateOpponentSquadId: string | null = null;
  public isElite: boolean = false;
  public eliteTimer: number = 0;
  public eliteColorIdx: number = 0;
  public laneIndex: number = 0;

  private eliteColors = MODES.map(m => m.color);
  private eliteGlow: any = null;
  private eliteParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private shadowGraphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, "white-pixel");
    
    this.shadowGraphics = scene.add.graphics();
    this.shadowGraphics.setDepth(-1);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Pre-create particle emitter for elites (hidden by default)
    this.eliteParticles = scene.add.particles(0, 0, "white-pixel", {
      scale: { start: 5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      speed: { min: 10, max: 30 },
      angle: { min: 0, max: 360 },
      lifespan: 1000,
      frequency: 30,
      gravityY: -150, // Flames go up
      blendMode: 'ADD',
      emitting: false
    });
    this.eliteParticles.setDepth(this.depth - 1);
  }

  spawn(x: number, y: number, color: number, speed: number, squadId: string, laneIndex: number, isElite: boolean) {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    
    this.col = color;
    this.speed = speed;
    this.hp = ENEMY_HP;
    this.squadId = squadId;
    this.laneIndex = laneIndex;
    this.isElite = isElite;
    this.eliteTimer = 0;
    this.isStalemated = false;
    this.stalemateTarget = null;
    
    // Clear rotation and tint first
    this.setRotation(0);
    this.setTint(0xffffff);

    if (isElite) {
      this.setScale(0.5); // 50% size for elite (with 368x246 texture, visual size is preserved)
      this.setTexture("enemy_elite");
      this.play("enemy_elite_walk", true);
      this.hp = ENEMY_ELITE_HP;

      // Randomize initial color
      this.eliteColorIdx = Phaser.Math.Between(0, 2);
      const initialColor = this.eliteColors[this.eliteColorIdx];
      this.col = initialColor;

      // Add Glow if not already present
      if (this.postFX && !this.eliteGlow) {
        this.eliteGlow = this.postFX.addGlow(initialColor, 4, 0, false, 0.1, 10);
      } else if (this.eliteGlow) {
        this.eliteGlow.color = initialColor;
      }

      // Start Particles
      if (this.eliteParticles) {
        this.eliteParticles.setDepth(this.depth - 1);
        this.eliteParticles.startFollow(this);
        this.eliteParticles.start();
        this.eliteParticles.setParticleTint(initialColor);
      }
    } else {
      this.setScale(0.5); // 50% size for normal enemy
      if (this.postFX && this.eliteGlow) {
        this.postFX.remove(this.eliteGlow);
        this.eliteGlow = null;
      }
      if (this.eliteParticles) {
        this.eliteParticles.stop();
      }

      if (color === MODES[0].color) {
        this.setTexture("enemy_cyan");
        this.play("enemy_cyan_walk", true);
        this.setScale(0.55);
      } else if (color === MODES[1].color) {
        this.setTexture("enemy_orange");
        this.play("enemy_orange_walk", true);
      } else if (color === MODES[2].color) {
        this.setTexture("enemy_purple");
        this.play("enemy_purple_walk", true);
      } else {
        this.setTexture("white-pixel");
        this.setDisplaySize(30, 30);
        this.setTint(color);
        this.stop();
      }
    }

    if (this.body) {
      // Set hitbox appropriately based on texture and scale.
      if (this.texture.key !== "white-pixel") {
        if (isElite) {
          // Scaled by 0.5. Texture is 368x246.
          (this.body as Phaser.Physics.Arcade.Body).setSize(96, 120);
          (this.body as Phaser.Physics.Arcade.Body).setOffset(136, 62);
        } else {
          // Scaled by 0.5. Texture is 184x123.
          (this.body as Phaser.Physics.Arcade.Body).setSize(72, 72);
          (this.body as Phaser.Physics.Arcade.Body).setOffset(56, 26);
        }
      } else {
        (this.body as Phaser.Physics.Arcade.Body).setSize(30, 30);
        (this.body as Phaser.Physics.Arcade.Body).setOffset(0, 0);
      }
      this.body.setVelocity(-speed, 0);
    }

    this.drawShadow();
  }

  private drawShadow() {
    this.shadowGraphics.clear();
    const w = this.isElite ? 100 : 50;
    const h = this.isElite ? 24 : 12;
    const yOffset = this.isElite ? 65 : 30;
    const wobble = 2;
    
    this.shadowGraphics.fillStyle(0x000000, 0.12);
    
    const steps = 10;
    const points: {x: number, y: number}[] = [];
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const rx = (w / 2) + (Math.random() - 0.5) * wobble;
      const ry = (h / 2) + (Math.random() - 0.5) * wobble;
      points.push({ x: Math.cos(angle) * rx, y: Math.sin(angle) * ry + yOffset });
    }
    
    this.shadowGraphics.beginPath();
    this.shadowGraphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) this.shadowGraphics.lineTo(points[i].x, points[i].y);
    this.shadowGraphics.closePath();
    this.shadowGraphics.fillPath();
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    if (!this.active) return;
    
    this.shadowGraphics.setPosition(this.x, this.y);

    if (this.isElite) {
      this.eliteTimer += delta;
      if (this.eliteTimer >= 3000) {
        this.eliteTimer = 0;
        this.eliteColorIdx = (this.eliteColorIdx + 1) % 3;
        const newCol = this.eliteColors[this.eliteColorIdx];
        this.col = newCol;
        
        // Update visual effects instead of tint
        if (this.eliteGlow) {
          this.eliteGlow.color = newCol;
        }
        if (this.eliteParticles) {
          this.eliteParticles.setParticleTint(newCol);
        }
      }
    }

    if (this.isStalemated) {
      if (this.stalemateTarget && !this.stalemateTarget.active) {
        this.isStalemated = false;
        this.stalemateTarget = null;
        if (this.body) this.body.setVelocity(-this.speed, 0);
      } else {
        if (this.body) this.body.setVelocity(0, 0);
      }
      return;
    }

    if (this.x < -100) {
      this.deactivate();
    }
  }

  deactivate() {
    this.setActive(false);
    this.setVisible(false);
    this.shadowGraphics.clear();
    if (this.eliteParticles) {
      this.eliteParticles.stop();
    }
    if (this.body && 'setVelocity' in this.body) {
      this.body.setVelocity(0, 0);
    }
  }
}

export class Friendly extends Phaser.GameObjects.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  public col: number = 0xffffff;
  public squadId: string = "";
  public isStalemated: boolean = false;
  public stalemateTarget: any = null;
  public stalemateOpponentSquadId: string | null = null;
  public hasScored: boolean = false;
  public laneIndex: number = 0;
  private shadowGraphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, "white-pixel");

    this.shadowGraphics = scene.add.graphics();
    this.shadowGraphics.setDepth(-1);

    scene.add.existing(this);
    scene.physics.add.existing(this);
  }

  spawn(x: number, y: number, color: number, squadId: string, laneIndex: number) {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    
    this.col = color;
    this.squadId = squadId;
    this.laneIndex = laneIndex;
    this.hasScored = false;
    this.isStalemated = false;
    this.stalemateTarget = null;

    // Specific animation and scaling based on color
    if (color === MODES[0].color) {
      this.setTexture("friend_cyan");
      this.setScale(0.5);
      this.play("friend_cyan_walk", true);
      this.setTint(0xffffff);
    } else if (color === MODES[1].color) {
      this.setTexture("friend_orange");
      this.setScale(0.5);
      this.play("friend_orange_walk", true);
      this.setTint(0xffffff);
    } else if (color === MODES[2].color) {
      this.setTexture("friend_purple");
      this.setScale(0.5);
      this.play("friend_purple_walk", true);
      this.setTint(0xffffff);
    } else {
      this.setTexture("white-pixel");
      this.setDisplaySize(30, 30);
      this.setTint(color);
      this.stop();
    }

    if (this.body) {
      if (this.texture.key !== "white-pixel") {
        (this.body as Phaser.Physics.Arcade.Body).setSize(72, 72);
        (this.body as Phaser.Physics.Arcade.Body).setOffset(56, 26);
      } else {
        (this.body as Phaser.Physics.Arcade.Body).setSize(30, 30);
        (this.body as Phaser.Physics.Arcade.Body).setOffset(0, 0);
      }
    }

    this.drawShadow();
  }

  private drawShadow() {
    this.shadowGraphics.clear();
    const w = 50;
    const h = 12;
    const wobble = 2;
    
    this.shadowGraphics.fillStyle(0x000000, 0.12);
    
    const steps = 10;
    const points: {x: number, y: number}[] = [];
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const rx = (w / 2) + (Math.random() - 0.5) * wobble;
      const ry = (h / 2) + (Math.random() - 0.5) * wobble;
      points.push({ x: Math.cos(angle) * rx, y: Math.sin(angle) * ry + 30 });
    }
    
    this.shadowGraphics.beginPath();
    this.shadowGraphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) this.shadowGraphics.lineTo(points[i].x, points[i].y);
    this.shadowGraphics.closePath();
    this.shadowGraphics.fillPath();
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    if (!this.active) return;

    this.shadowGraphics.setPosition(this.x, this.y);

    // Check if the friendly crossed the finish line
    if (!this.hasScored && this.x > FRIENDLY_GOAL_X) {
      this.hasScored = true;
      this.scene.events.emit("friendlyReachedEnd", this.x, this.y, this.col);
      this.deactivate();
      return;
    }

    if (this.isStalemated) {
      if (this.stalemateTarget && !this.stalemateTarget.active) {
        this.isStalemated = false;
        this.stalemateTarget = null;
      } else {
        if (this.body) this.body.setVelocity(0, 0);
        return;
      }
    }

    // Logic for finding target (will be handled by GameScene to avoid redundant searches)
    this.scene.events.emit("friendlyUpdate", this);

    if (this.x < -100 || this.y > SCREEN_HEIGHT + 100 || this.y < -100) {
      this.deactivate();
    }
  }

  deactivate() {
    this.setActive(false);
    this.setVisible(false);
    this.shadowGraphics.clear();
    if (this.body && 'setVelocity' in this.body) {
      this.body.setVelocity(0, 0);
    }
  }
}

export function spawnItem(scene: Phaser.Scene, x: number, y: number, type: "bomb" | "health" | "rage", target: Phaser.GameObjects.Components.Transform, onCollect: () => void) {
  const container = scene.add.container(x, y);
  
  // Use the loaded images
  const sprite = scene.add.image(0, 0, `item_drop_${type}`);
  
  sprite.setScale(0.5);
  
  // Add a rotating rainbow glow effect
  let glow: any = null;
  if (sprite.postFX) {
    // Start with a default color, will be updated in the loop
    glow = sprite.postFX.addGlow(0xffffff, 4, 0, false, 0.1, 16);
  }
  
  container.add(sprite);
  
  let collected = false;
  let spawnTime = scene.time.now;

  // Scale bounce tween (pulsing effect)
  scene.tweens.add({
    targets: sprite,
    scaleX: 0.6, // 0.5 * 1.2
    scaleY: 0.6,
    duration: 200,
    yoyo: true,
    repeat: 1 // Bounce twice
  });

  const onUpdate = (time: number, delta: number) => {
    if (collected || !container.active) {
      scene.events.off("update", onUpdate);
      return;
    }

    // Update rainbow glow color
    if (glow) {
      const hue = (time / 2000) % 1; // Cycle through 0 to 1 every 2 seconds
      const color = Phaser.Display.Color.HSVToRGB(hue, 0.8, 1);
      glow.color = color.color;
    }
    
    // Absorbing logic with acceleration
    const age = (time - spawnTime) / 1000;
    const dx = target.x - container.x;
    const dy = target.y - container.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Start slow (100) and accelerate rapidly based on how long it has been alive
    const speed = 100 + (age * age * 1500); 
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;
    
    container.x += vx * (delta / 1000);
    container.y += vy * (delta / 1000);

    if (dist < 20) {
      collected = true;
      onCollect();
      scene.events.off("update", onUpdate);
      container.destroy();
    }

    if (container.x < -100) {
      scene.events.off("update", onUpdate);
      container.destroy();
    }
  };

  scene.events.on("update", onUpdate);
}
