import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "../constants";

export class LoadingScene extends Phaser.Scene {
  private progressGraphics!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;

  constructor() {
    super("LoadingScene");
  }

  preload() {
    this.createLoadingUI();

    // --- Load Fonts ---
    // Phaser 3.60+ supports font loading directly
    this.load.font("WuXin", "assets/fonts/WuXinShouXieTi-2.otf");
    this.load.font("Yozai", "assets/fonts/Yozai-Regular.ttf");

    // Load sounds
    this.load.audio("change", "sfx/change.wav");
    this.load.audio("hitHurt", "sfx/hitHurt.wav");
    this.load.audio("laserShoot", "sfx/laserShoot.wav");
    this.load.audio("laserShootFailed", "sfx/laserShootFailed.wav");
    this.load.audio("playerHurt", "sfx/playerHurt.wav");
    this.load.audio("completed", "sfx/completed.wav");
    this.load.audio("score", "sfx/score.wav");
    this.load.audio("transition", "sfx/transition.wav");
    this.load.audio("level_intro", "sfx/level_intro.wav");
    this.load.audio("congratulations", "sfx/congratulations.mp3");

    // Load background
    this.load.image("bg_notebook", "assets/bg/bg_main_notebook.png");

    // Load building assets
    this.load.image("bldg_fortress", "assets/buildings/bldg_fortress.png");
    this.load.image("bldg_cannon_barrel", "assets/buildings/bldg_cannon_barrel.png");
    this.load.image("bldg_barracks", "assets/buildings/bldg_barracks.png");

    // Load UI assets
    this.load.image("ui_health_bar_frame", "assets/ui/ui_health_bar_frame.png");
    this.load.image("ui_health_bar_fill", "assets/ui/ui_health_bar_fill.png");
    this.load.image("ui_icon_coin", "assets/ui/ui_icon_coin.png");
    this.load.image("ui_pause", "assets/ui/ui_pause.png");
    this.load.image("ui_bomb", "assets/ui/ui_bomb.png");
    this.load.image("ui_combo_bg", "assets/ui/ui_combo_bg.png");

    // Load Item assets
    this.load.image("item_drop_bomb", "assets/items/item_drop_bomb.png");
    this.load.image("item_drop_health", "assets/items/item_drop_health.png");
    this.load.image("item_drop_rage", "assets/items/item_drop_rage.png");

    // Load Unit assets
    this.load.spritesheet("friend_cyan", "assets/units/friend_cyan.png", {
      frameWidth: 184,
      frameHeight: 123
    });
    this.load.spritesheet("friend_orange", "assets/units/friend_orange.png", {
      frameWidth: 184,
      frameHeight: 123
    });
    this.load.spritesheet("friend_purple", "assets/units/friend_purple.png", {
      frameWidth: 184,
      frameHeight: 123
    });

    this.load.spritesheet("enemy_cyan", "assets/units/enemy_cyan.png", {
      frameWidth: 184,
      frameHeight: 123
    });
    this.load.spritesheet("enemy_orange", "assets/units/enemy_orange.png", {
      frameWidth: 184,
      frameHeight: 123
    });
    this.load.spritesheet("enemy_purple", "assets/units/enemy_purple.png", {
      frameWidth: 184,
      frameHeight: 123
    });
    this.load.spritesheet("enemy_elite", "assets/units/enemy_elite.png", {
      frameWidth: 368,
      frameHeight: 246
    });

    // Load Level Configuration
    this.load.json("levels", "levels.json");

    // Events
    this.load.on("loaderror", (file: any) => {
      console.error("Failed to load asset:", file.key, file.url);
    });

    this.load.on("progress", (value: number) => {
      this.updateProgressBar(value);
    });

    this.load.on("complete", () => {
      this.time.delayedCall(500, () => {
        this.scene.start("StartScene");
      });
    });
  }

  create() {
    // Create white pixel texture for particles
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, 1, 1);
    graphics.generateTexture("white-pixel", 1, 1);
    graphics.destroy();
  }

  private createLoadingUI() {
    this.loadingText = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 40, "LOADING...", {
      fontFamily: "Arial, sans-serif",
      fontSize: "32px",
      color: "#000000"
    }).setOrigin(0.5);

    this.progressGraphics = this.add.graphics();
    this.updateProgressBar(0);
  }

  private updateProgressBar(value: number) {
    this.progressGraphics.clear();
    
    const w = 400;
    const h = 30;
    const x = SCREEN_WIDTH / 2 - w / 2;
    const y = SCREEN_HEIGHT / 2;
    
    // Draw Frame (Hand-drawn look)
    this.drawWobblyRect(x, y, w, h, 0x000000, 3);
    
    // Draw Fill
    if (value > 0) {
      const fillW = (w - 10) * value;
      if (fillW > 5) {
        this.progressGraphics.fillStyle(0x000000, 0.8);
        this.progressGraphics.fillRect(x + 5, y + 5, fillW, h - 10);
      }
    }
  }

  private drawWobblyRect(x: number, y: number, w: number, h: number, color: number, thickness: number) {
    const wobble = 2;
    const points = [
      { x: x, y: y },
      { x: x + w, y: y },
      { x: x + w, y: y + h },
      { x: x, y: y + h }
    ];
    
    const wp = points.map(p => ({
      x: p.x + (Math.random() - 0.5) * wobble,
      y: p.y + (Math.random() - 0.5) * wobble
    }));

    this.progressGraphics.lineStyle(thickness, color, 1);
    
    for (let pass = 0; pass < 2; pass++) {
      this.progressGraphics.beginPath();
      this.progressGraphics.moveTo(wp[0].x + (Math.random()-0.5) * wobble, wp[0].y + (Math.random()-0.5) * wobble);
      for (let i = 0; i < wp.length; i++) {
        const next = wp[(i + 1) % wp.length];
        const midX = (wp[i].x + next.x) / 2 + (Math.random() - 0.5) * wobble;
        const midY = (wp[i].y + next.y) / 2 + (Math.random() - 0.5) * wobble;
        
        this.progressGraphics.lineTo(midX, midY);
        this.progressGraphics.lineTo(next.x + (Math.random()-0.5) * wobble, next.y + (Math.random()-0.5) * wobble);
      }
      this.progressGraphics.strokePath();
    }
  }
}
