import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    // Load sounds
    this.load.audio("change", "/sfx/change.wav");
    this.load.audio("hitHurt", "/sfx/hitHurt.wav");
    this.load.audio("laserShoot", "/sfx/laserShoot.wav");
    this.load.audio("laserShootFailed", "/sfx/laserShootFailed.wav");
    this.load.audio("playerHurt", "/sfx/playerHurt.wav");

    // Load background
    this.load.image("bg_notebook", "/assets/bg/bg_main_notebook.png");

    // Load building assets
    this.load.image("bldg_fortress", "/assets/buildings/bldg_fortress.png");
    this.load.image("bldg_cannon_barrel", "/assets/buildings/bldg_cannon_barrel.png");
    this.load.image("bldg_barracks", "/assets/buildings/bldg_barracks.png");

    // Load UI assets
    this.load.image("ui_health_bar_frame", "/assets/ui/ui_health_bar_frame.png");
    this.load.image("ui_health_bar_fill", "/assets/ui/ui_health_bar_fill.png");
    this.load.image("ui_icon_coin", "/assets/ui/ui_icon_coin.png");
    this.load.image("ui_pause", "/assets/ui/ui_pause.png");
    this.load.image("ui_bomb", "/assets/ui/ui_bomb.png");
    this.load.image("ui_combo_bg", "/assets/ui/ui_combo_bg.png");

    // Load Item assets
    this.load.image("item_drop_bomb", "/assets/items/item_drop_bomb.png");
    this.load.image("item_drop_health", "/assets/items/item_drop_health.png");
    this.load.image("item_drop_rage", "/assets/items/item_drop_rage.png");

    // Load Unit assets
    this.load.spritesheet("friend_cyan", "/assets/units/friend_cyan.png", {
      frameWidth: 184,
      frameHeight: 123
    });
    this.load.spritesheet("friend_orange", "/assets/units/friend_orange.png", {
      frameWidth: 184,
      frameHeight: 123
    });
    this.load.spritesheet("friend_purple", "/assets/units/friend_purple.png", {
      frameWidth: 184,
      frameHeight: 123
    });

    this.load.spritesheet("enemy_cyan", "/assets/units/enemy_cyan.png", {
      frameWidth: 184,
      frameHeight: 123
    });
    this.load.spritesheet("enemy_orange", "/assets/units/enemy_orange.png", {
      frameWidth: 184,
      frameHeight: 123
    });
    this.load.spritesheet("enemy_purple", "/assets/units/enemy_purple.png", {
      frameWidth: 184,
      frameHeight: 123
    });
    this.load.spritesheet("enemy_elite", "/assets/units/enemy_elite.png", {
      frameWidth: 368,
      frameHeight: 246
    });
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
