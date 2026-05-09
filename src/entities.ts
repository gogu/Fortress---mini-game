import Phaser from "phaser";
import { BULLET_SPEED, ENEMY_SPEED, FRIENDLY_SPEED, LANES, SCREEN_WIDTH, SCREEN_HEIGHT } from "./constants";

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

export class Enemy extends Phaser.GameObjects.Rectangle {
  declare body: Phaser.Physics.Arcade.Body;
  public hp: number = 1;
  public maxHp: number = 1;
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

  private eliteColors = [0x00f2ff, 0xff8c00, 0xa020f0];

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 30, 30, 0xffffff);
    scene.add.existing(this);
    scene.physics.add.existing(this);
  }

  spawn(x: number, y: number, color: number, speed: number, squadId: string, laneIndex: number, isElite: boolean) {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    
    this.col = color;
    this.speed = speed;
    this.hp = 1;
    this.squadId = squadId;
    this.laneIndex = laneIndex;
    this.isElite = isElite;
    this.eliteTimer = 0;
    this.isStalemated = false;
    this.stalemateTarget = null;

    this.setFillStyle(color);
    this.setStrokeStyle(2, 0xffffff);
    
    if (isElite) {
      this.setRotation(Math.PI / 4); // Rotate for elite look
    } else {
      this.setRotation(0);
    }

    if (this.body) {
      this.body.setVelocity(-speed, 0);
    }
  }

  preUpdate(time: number, delta: number) {
    if (!this.active) return;

    if (this.isElite) {
      this.eliteTimer += delta;
      if (this.eliteTimer >= 3000) {
        this.eliteTimer = 0;
        this.eliteColorIdx = (this.eliteColorIdx + 1) % 3;
        const newCol = this.eliteColors[this.eliteColorIdx];
        this.col = newCol;
        this.setFillStyle(newCol);
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
    if (this.body && 'setVelocity' in this.body) {
      this.body.setVelocity(0, 0);
    }
  }
}

export class Friendly extends Phaser.GameObjects.Arc {
  declare body: Phaser.Physics.Arcade.Body;
  public col: number = 0xffffff;
  public squadId: string = "";
  public isStalemated: boolean = false;
  public stalemateTarget: any = null;
  public stalemateOpponentSquadId: string | null = null;
  public hasScored: boolean = false;
  public laneIndex: number = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 15, 0, 360, false, 0xffffff);
    scene.add.existing(this);
    scene.physics.add.existing(this);
  }

  spawn(x: number, y: number, color: number, squadId: string, laneIndex: number) {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.setStrokeStyle(2, 0xffffff);
    
    this.col = color;
    this.setFillStyle(color);
    this.squadId = squadId;
    this.laneIndex = laneIndex;
    this.hasScored = false;
    this.isStalemated = false;
    this.stalemateTarget = null;
  }

  preUpdate(time: number, delta: number) {
    if (!this.active) return;

    if (!this.hasScored && this.x > SCREEN_WIDTH) {
      this.hasScored = true;
      this.scene.events.emit("friendlyScored", this.col);
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

    if (this.x > SCREEN_WIDTH + 100 || this.x < -100 || this.y > SCREEN_HEIGHT + 100 || this.y < -100) {
      this.deactivate();
    }
  }

  deactivate() {
    this.setActive(false);
    this.setVisible(false);
    if (this.body && 'setVelocity' in this.body) {
      this.body.setVelocity(0, 0);
    }
  }
}

export function spawnItem(scene: Phaser.Scene, x: number, y: number, type: "bomb" | "health" | "rage", target: Phaser.GameObjects.Components.Transform, onCollect: () => void) {
  const container = scene.add.container(x, y);
  
  // Use the loaded images
  const sprite = scene.add.image(0, 0, `item_drop_${type}`);
  
  // The images were resized to 256px height, so we scale them down to around 108px (previous 144 * 0.75)
  const targetSize = 108;
  const scale = targetSize / Math.max(sprite.width, sprite.height);
  sprite.setScale(scale);
  
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
    scaleX: scale * 1.2,
    scaleY: scale * 1.2,
    duration: 200,
    yoyo: true,
    repeat: 1 // Bounce twice
  });

  scene.events.on("update", (time: number, delta: number) => {
    if (collected || !container.active) return;

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
      container.destroy();
    }

    if (container.x < -100) container.destroy();
  });
}
