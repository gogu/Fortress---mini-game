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

    // Load background
    this.load.image("bg_notebook", "/src/assets/bg/bg_main_notebook.png");

    // Load building assets
    this.load.image("bldg_fortress", "/src/assets/buildings/bldg_fortress.png");
    this.load.image("bldg_cannon_barrel", "/src/assets/buildings/bldg_cannon_barrel.png");
    this.load.image("bldg_barracks", "/src/assets/buildings/bldg_barracks.png");

    // Load UI assets
    this.load.image("ui_health_bar_frame", "/src/assets/ui/ui_health_bar_frame.png");
    this.load.image("ui_health_bar_fill", "/src/assets/ui/ui_health_bar_fill.png");
    this.load.image("ui_icon_coin", "/src/assets/ui/ui_icon_coin.png");

    // Load Item assets
    this.load.image("item_drop_bomb", "/src/assets/items/item_drop_bomb.png");
    this.load.image("item_drop_health", "/src/assets/items/item_drop_health.png");
    this.load.image("item_drop_rage", "/src/assets/items/item_drop_rage.png");
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
