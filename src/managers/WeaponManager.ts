import Phaser from "phaser";
import { Bullet } from "../entities";
import { MODES, SCREEN_WIDTH, SCREEN_HEIGHT } from "../constants";

export class WeaponManager {
  private scene: Phaser.Scene;
  private bullets: Phaser.Physics.Arcade.Group;
  
  private fortress: Phaser.GameObjects.Sprite;
  private fortressCore: Phaser.GameObjects.Sprite;
  private cdBar: Phaser.GameObjects.Graphics;
  private aimLine: Phaser.GameObjects.Graphics;
  
  private weaponMode: number = 0;
  private lastShotTime: number = 0;
  private rageRemaining: number = 0;

  constructor(scene: Phaser.Scene, fortress: Phaser.GameObjects.Sprite, fortressCore: Phaser.GameObjects.Sprite) {
    this.scene = scene;
    this.fortress = fortress;
    this.fortressCore = fortressCore;
    
    this.bullets = scene.physics.add.group({ classType: Bullet, runChildUpdate: true });
    
    this.cdBar = scene.add.graphics();
    this.aimLine = scene.add.graphics();
    this.aimLine.setDepth(-0.4);

    this.setupEventHandlers();

    // Cleanup on scene shutdown
    this.scene.events.once("shutdown", () => {
      this.cleanup();
    });
  }

  private setupEventHandlers() {
    this.scene.events.on("weaponModeChanged", this.handleWeaponModeChanged, this);
    this.scene.events.on("requestShoot", this.handleRequestShoot, this);
    this.scene.events.on("updateRage", this.handleUpdateRage, this);
  }

  private cleanup() {
    this.scene.events.off("weaponModeChanged", this.handleWeaponModeChanged, this);
    this.scene.events.off("requestShoot", this.handleRequestShoot, this);
    this.scene.events.off("updateRage", this.handleUpdateRage, this);
    this.aimLine.destroy();
    this.cdBar.destroy();
  }

  private handleRequestShoot(playFailSound: boolean) {
    this.shoot(playFailSound);
  }

  private handleUpdateRage(rage: number) {
    this.rageRemaining = rage;
  }

  private handleWeaponModeChanged(mode: number) {
    this.weaponMode = mode;
    this.scene.sound.play("change", { volume: 0.5 });
    this.scene.cameras.main.shake(100, 0.005);
    
    // Update Glow
    const glow = this.fortress.getData('glow');
    if (glow) glow.color = MODES[this.weaponMode].color;
    
    // Popup Text
    const txt = this.scene.add.text(this.fortress.x, this.fortress.y - 60, MODES[this.weaponMode].name, {
      fontFamily: "WuXin",
      fontSize: "24px",
      color: Phaser.Display.Color.IntegerToColor(MODES[this.weaponMode].color).rgba,
      stroke: "#ffffff",
      strokeThickness: 4
    }).setOrigin(0.5);
    
    this.scene.tweens.add({
      targets: txt,
      y: txt.y - 40,
      alpha: 0,
      duration: 500,
      onComplete: () => txt.destroy()
    });
  }

  public shoot(playFailSound: boolean = false) {
    const now = this.scene.time.now;
    const mode = MODES[this.weaponMode];
    const isRage = this.rageRemaining > 0;

    if (!isRage && now < this.lastShotTime + (mode.cd * 1000)) {
      if (playFailSound) this.scene.sound.play("laserShootFailed", { volume: 0.3 });
      return;
    }

    const actualCd = isRage ? 100 : mode.cd * 1000;
    if (now < this.lastShotTime + actualCd) return;

    this.lastShotTime = now;
    // Notify Controller of the actual shot time if it's tracking it
    this.scene.events.emit("shotFired", now);
    
    this.scene.sound.play("laserShoot", { volume: 0.4 });
    if (!isRage) this.scene.cameras.main.shake(100, 0.002);

    const pointer = this.scene.input.activePointer;
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

  public update(time: number, delta: number) {
    this.updateBarrelRotation();
    this.updateAimLine();
    this.updateCDBar(time);
    
    // Auto-shoot in rage mode
    if (this.rageRemaining > 0 && time > this.lastShotTime + 100) {
      this.shoot();
    }
  }

  private updateBarrelRotation() {
    const pointer = this.scene.input.activePointer;
    const angle = Phaser.Math.Angle.Between(this.fortressCore.x, this.fortressCore.y, pointer.x, pointer.y);
    this.fortressCore.setRotation(angle);
  }

  private updateAimLine() {
    this.aimLine.clear();
    const pointer = this.scene.input.activePointer;
    const mode = MODES[this.weaponMode];
    const isRage = this.rageRemaining > 0;
    const color = isRage ? 0xffffff : mode.color;

    const barrelLength = (1 - this.fortressCore.originX) * this.fortressCore.width * this.fortressCore.scaleX;
    const startX = this.fortressCore.x + Math.cos(this.fortressCore.rotation) * barrelLength;
    const startY = this.fortressCore.y + Math.sin(this.fortressCore.rotation) * barrelLength;

    this.aimLine.lineStyle(2, color, 0.6);
    
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
    
    const x = this.fortress.x - 30;
    const y = this.fortress.y - 80;
    const width = 60;
    const height = 10;

    if (progress >= 1) return;

    this.drawWobblyRect(x, y, width, height, 0xffffff, 0x000000, 0.4);
    
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
      { x: x, y: y }, { x: x + w, y: y }, { x: x + w, y: y + h }, { x: x, y: y + h }
    ];
    
    const wp = points.map(p => ({
      x: p.x + (Math.random() - 0.5) * wobble,
      y: p.y + (Math.random() - 0.5) * wobble
    }));

    this.cdBar.fillStyle(fillColor, fillAlpha);
    this.cdBar.beginPath();
    this.cdBar.moveTo(wp[0].x, wp[0].y);
    for (let i = 1; i < wp.length; i++) this.cdBar.lineTo(wp[i].x, wp[i].y);
    this.cdBar.closePath();
    this.cdBar.fillPath();

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

  public getBullets(): Phaser.Physics.Arcade.Group {
    return this.bullets;
  }
  
  public resetCooldown() {
    this.lastShotTime = 0;
  }
}
