import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    // Load sounds
    this.load.audio("change", "/src/sfx/change.wav");
    this.load.audio("hitHurt", "/src/sfx/hitHurt.wav");
    this.load.audio("laserShoot", "/src/sfx/laserShoot.wav");
    this.load.audio("laserShootFailed", "/src/sfx/laserShootFailed.wav");
    this.load.audio("playerHurt", "/src/sfx/playerHurt.wav");
  }

  create() {
    // Create white pixel texture for particles
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, 1, 1);
    graphics.generateTexture("white-pixel", 1, 1);
    graphics.destroy();

    this.scene.start("GameScene");
    this.scene.start("UIScene");
  }
}
