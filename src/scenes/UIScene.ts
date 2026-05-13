import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT, MODES, BOMB_COST } from "../constants";
import { GameScene } from "./GameScene";
import { ILevelConfig } from "../managers/LevelManager";
import { HandDrawnButton } from "../ui/HandDrawnButton";
import { PaperTransition } from "../ui/PaperTransition";

export class UIScene extends Phaser.Scene {
  private goldLabel!: Phaser.GameObjects.Text;
  private goldIcon!: Phaser.GameObjects.Image;
  private currentGold: number = 0;
  private currentBombs: number = 2;
  private goldMask!: Phaser.Display.Masks.GeometryMask;
  private nextGoldLabel?: Phaser.GameObjects.Text;
  private goldStartY: number = 350; // Target Y coordinate over the Barracks
  private victoryLabel!: Phaser.GameObjects.Text;
  private successTexts: Phaser.GameObjects.Text[] = [];
  private successBlocks: Phaser.GameObjects.Rectangle[] = [];
  private levelNameLabel!: Phaser.GameObjects.Text;
  private timerLabel!: Phaser.GameObjects.Text;
  private currentLevelConfig: ILevelConfig | null = null;
  private levelTimeElapsed: number = 0;

  private comboLabel!: Phaser.GameObjects.Text;
  private comboBg!: Phaser.GameObjects.Image;
  private rageLabel!: Phaser.GameObjects.Text;
  private fpsLabel!: Phaser.GameObjects.Text;
  private pausedLabel!: Phaser.GameObjects.Text;
  private pauseOverlayBg!: Phaser.GameObjects.Rectangle;
  private scanlineOverlay!: Phaser.GameObjects.TileSprite;
  private resumeBtn!: HandDrawnButton;
  private bombBtn!: Phaser.GameObjects.Image;
  private bombCostLabel!: Phaser.GameObjects.Text;
  private bombLeds: Phaser.GameObjects.Rectangle[] = [];
  private isPaused: boolean = false;

  // Health Bar components
  private healthFillImage!: Phaser.GameObjects.Image;
  private healthMaskShape!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private hbFillWidth!: number;
  private hbFillX!: number;
  private hbFillY!: number;
  private hbFillHeight!: number;

  constructor() {
    super("UIScene");
  }

  init() {
  }

  private mainUIContainer!: Phaser.GameObjects.Container;

  create() {
    // Check for tear transition from GameScene data
    const gameScene = this.scene.get("GameScene");
    const data = gameScene.scene.settings.data;
    PaperTransition.setupReveal(this, data);

    this.currentGold = 0;
    this.isPaused = false;
    this.successTexts = [];
    this.bombLeds = [];

    // Create all UI and wrap it in a container to manage visibility
    this.mainUIContainer = this.add.container(0, 0).setAlpha(0);

    this.createTopBar();
    this.createHealthBar();
    this.createVictoryProgress();
    this.createGoldUI();
    this.createBombButton();
    
    this.setupEventBindings();

    // Fade in main UI
    this.tweens.add({
      targets: this.mainUIContainer,
      alpha: 1,
      duration: 800
    });
  }

  private createTopBar() {
    // Top Right: Pause Button
    const pauseBtn = this.add.image(SCREEN_WIDTH - 60, 65, "ui_pause")
      .setOrigin(0.5)
      .setScale(0.5)
      .setInteractive({ useHandCursor: true });
    
    this.mainUIContainer.add(pauseBtn);

    pauseBtn.on("pointerover", () => {
      if (this.mainUIContainer.alpha < 1) return; // Prevent pause until UI shown
      pauseBtn.setScale(0.55);
      pauseBtn.setTint(0xdddddd);
    });

    pauseBtn.on("pointerout", () => {
      pauseBtn.setScale(0.5);
      pauseBtn.clearTint();
    });

    pauseBtn.on("pointerdown", () => {
      if (this.mainUIContainer.alpha < 1) return; // Prevent pause until UI shown
      pauseBtn.setScale(0.45);
      pauseBtn.setTint(0xaaaaaa);
      this.togglePause();
    });

    pauseBtn.on("pointerup", () => {
      pauseBtn.setScale(0.55);
      pauseBtn.setTint(0xdddddd);
    });

    // Paused Overlay Background (fully transparent)
    this.pauseOverlayBg = this.add.rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 0x000000, 0)
      .setOrigin(0)
      .setDepth(99)
      .setVisible(false);
      
    // Block interaction behind overlay when paused
    this.pauseOverlayBg.setInteractive();

    // Paused Overlay Text
    this.pausedLabel = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 60, "PAUSED", {
      fontFamily: "WuXin",
      fontSize: "64px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 8
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    // Resume Button
    this.resumeBtn = new HandDrawnButton(this, {
      x: SCREEN_WIDTH / 2,
      y: SCREEN_HEIGHT / 2 + 50,
      text: "Resume",
      onClick: () => this.togglePause()
    });
    this.resumeBtn.setVisible(false).setDepth(100);

    // Create Scanline Texture and Overlay
    this.createScanlineOverlay();

    // Right Side: Items (shifted down to avoid gold)
    this.rageLabel = this.add.text(SCREEN_WIDTH - 20, 180, "RAGE: 0s", { fontFamily: "WuXin", fontSize: "16px", color: "#4b0082" }).setOrigin(1, 0).setAlpha(0);
    this.mainUIContainer.add(this.rageLabel);

    // Bottom Left: FPS
    this.fpsLabel = this.add.text(20, SCREEN_HEIGHT - 10, "FPS: 0", { fontFamily: "WuXin", fontSize: "14px", color: "#2f4f4f" }).setOrigin(0, 1);
    this.mainUIContainer.add(this.fpsLabel);

    // ESC Key to Pause
    const escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey?.on("down", this.handleEscDown, this);

    // Auto-pause when game window loses focus
    this.game.events.on(Phaser.Core.Events.BLUR, this.handleBlur, this);

    this.events.once("shutdown", () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.handleBlur, this);
      escKey?.off("down", this.handleEscDown, this);
    });
  }

  private handleEscDown() {
    if (this.mainUIContainer.alpha < 1) return; // Prevent pause until UI shown
    this.togglePause();
  }

  private handleBlur() {
    if (this.mainUIContainer.alpha < 1) return; // Prevent pause until UI shown
    if (!this.isPaused && this.scene.isActive("GameScene")) {
      this.togglePause();
    }
  }

  private togglePause() {
    this.isPaused = !this.isPaused;
    const gameScene = this.scene.get("GameScene");

    if (this.isPaused) {
      gameScene.scene.pause();
      this.pauseOverlayBg.setVisible(true);
      this.scanlineOverlay.setVisible(true);
      this.pausedLabel.setVisible(true);
      this.resumeBtn.setVisible(true);
    } else {
      gameScene.scene.resume();
      this.pauseOverlayBg.setVisible(false);
      this.scanlineOverlay.setVisible(false);
      this.pausedLabel.setVisible(false);
      this.resumeBtn.setVisible(false);
    }
  }

  private createScanlineOverlay() {
    // Create a 2x4 texture for scanlines (one line dark, one line transparent)
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0x000000, 0.2);
    graphics.fillRect(0, 0, 2, 2);
    graphics.generateTexture("scanline", 2, 4);
    
    this.scanlineOverlay = this.add.tileSprite(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, "scanline")
      .setOrigin(0)
      .setDepth(99)
      .setAlpha(0.6)
      .setVisible(false);
  }

  private createHealthBar() {
    const hbScale = 0.5;
    const hbX = 50;
    const hbY = 40;

    const frame = this.add.image(hbX, hbY, "ui_health_bar_frame")
      .setOrigin(0)
      .setScale(hbScale);

    this.hbFillX = hbX + 235 * hbScale;
    this.hbFillY = hbY + 30 * hbScale;
    this.hbFillWidth = 300 * hbScale;
    this.hbFillHeight = 40 * hbScale;

    this.healthFillImage = this.add.image(this.hbFillX, this.hbFillY, "ui_health_bar_fill")
      .setOrigin(0)
      .setScale(0.5);

    this.healthMaskShape = this.add.graphics();
    this.healthMaskShape.fillStyle(0xffffff);
    this.healthMaskShape.fillRect(this.hbFillX, this.hbFillY, this.hbFillWidth, this.hbFillHeight);
    this.healthMaskShape.setVisible(false);

    const mask = new Phaser.Display.Masks.GeometryMask(this, this.healthMaskShape);
    this.healthFillImage.setMask(mask);

    this.healthText = this.add.text(
      hbX + 160 * hbScale, 
      hbY + 50 * hbScale, 
      "100/100", 
      { fontFamily: "WuXin", fontSize: "12px", color: "#ffffff", fontStyle: "bold" }
    ).setOrigin(0.5);

    this.mainUIContainer.add([frame, this.healthFillImage, this.healthText]);
  }

  private createVictoryProgress() {
    const startX = 60;
    const startY = 130;

    // Level Name Label
    this.levelNameLabel = this.add.text(startX, startY - 25, "Wave 1", {
      fontFamily: "Yozai",
      fontSize: "20px",
      color: "#000000",
      fontStyle: "bold"
    }).setOrigin(0, 0.5);

    this.victoryLabel = this.add.text(startX, startY, "目标:", { 
      fontFamily: "WuXin",
      fontSize: "14px", 
      color: "#444444", 
      fontStyle: "bold" 
    }).setOrigin(0, 0.5);

    this.timerLabel = this.add.text(startX + 45, startY, "00:00", {
      fontFamily: "WuXin",
      fontSize: "14px",
      color: "#333333"
    }).setOrigin(0, 0.5).setVisible(false);

    this.mainUIContainer.add([this.levelNameLabel, this.victoryLabel, this.timerLabel]);

    let currentX = startX + 45; 

    this.successTexts = [];
    this.successBlocks = [];
    for (let i = 0; i < 3; i++) {
      const block = this.add.rectangle(currentX, startY, 12, 12, MODES[i].color)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, 0x000000, 0.5);
      this.successBlocks.push(block);
      
      const txt = this.add.text(currentX + 16, startY, `0/0`, { 
        fontFamily: "WuXin",
        fontSize: "12px", 
        color: "#333333" 
      }).setOrigin(0, 0.5);
      
      this.successTexts.push(txt);
      this.mainUIContainer.add([block, txt]);
      currentX += 60;
    }
  }

  private createBombButton() {
    const btnX = SCREEN_WIDTH - 60;
    const btnY = 135; // Below pause button (which is at 65, + 70 spacing)

    this.bombBtn = this.add.image(btnX, btnY, "ui_bomb")
      .setOrigin(0.5)
      .setScale(0.5)
      .setInteractive({ useHandCursor: true });

    this.mainUIContainer.add(this.bombBtn);

    this.bombCostLabel = this.add.text(btnX, btnY - 25, `-${BOMB_COST}`, {
      fontFamily: "WuXin",
      fontSize: "14px",
      color: "#e29829",
      fontStyle: "bold",
      stroke: "#ffffff",
      strokeThickness: 3
    }).setOrigin(0.5);
    this.mainUIContainer.add(this.bombCostLabel);

    // Create 2 LED indicators below the bomb button
    this.bombLeds = [];
    const barWidth = 20;
    const barHeight = 8;
    const gap = 2;
    const barY = btnY + 34; // Reduced distance to button

    for (let i = 0; i < 2; i++) {
      const barX = btnX - (barWidth / 2 + gap / 2) + i * (barWidth + gap);
      const led = this.add.rectangle(barX, barY, barWidth, barHeight, 0x00ff00)
        .setAlpha(0.3)
        .setStrokeStyle(1, 0x005500);
      this.bombLeds.push(led);
      this.mainUIContainer.add(led);
    }

    this.bombBtn.on("pointerover", () => {
      if (this.mainUIContainer.alpha < 1) return;
      if (this.bombBtn.tintTopLeft === 0xffffff) {
        this.bombBtn.setScale(0.55);
        this.bombBtn.setTint(0xdddddd);
      }
    });

    this.bombBtn.on("pointerout", () => {
      // If it was hovered (0xdddddd), reset to default enabled (0xffffff)
      if (this.bombBtn.tintTopLeft === 0xdddddd) {
        this.bombBtn.setScale(0.5);
        this.bombBtn.setTint(0xffffff);
      }
    });

    this.bombBtn.on("pointerdown", () => {
      if (this.mainUIContainer.alpha < 1) return;
      if (this.bombBtn.tintTopLeft === 0xffffff || this.bombBtn.tintTopLeft === 0xdddddd) {
        this.bombBtn.setScale(0.45);
        this.bombBtn.setTint(0xaaaaaa);
        this.scene.get("GameScene").events.emit("requestBomb");
      }
    });

    this.bombBtn.on("pointerup", () => {
      if (this.bombBtn.tintTopLeft === 0xaaaaaa) {
        this.bombBtn.setScale(0.55);
        this.bombBtn.setTint(0xdddddd);
      }
    });
  }

  private createGoldUI() {
    const startX = 90;
    const startY = this.goldStartY;

    // Hard white outline using a slightly larger, white-tinted silhouette behind the icon
    const outline = this.add.image(startX, startY, "ui_icon_coin")
      .setOrigin(0.5)
      .setScale(0.6)
      .setTintFill(0xffffff);

    // Main Gold Icon
    this.goldIcon = this.add.image(startX, startY, "ui_icon_coin").setOrigin(0.5).setScale(0.5);

    // Gold Label with hard white stroke
    this.goldLabel = this.add.text(this.goldIcon.x + this.goldIcon.displayWidth/2 + 5, startY, "0", { 
      fontFamily: "WuXin",
      fontSize: "22px", 
      color: "#e29829",
      fontStyle: "bold",
      stroke: "#ffffff",
      strokeThickness: 5
    }).setOrigin(0, 0.5);

    // Create a mask for the gold rolling effect
    const maskShape = this.make.graphics();
    maskShape.fillStyle(0xffffff);
    // Mask covers the text area slightly around the baseline
    maskShape.fillRect(this.goldLabel.x, startY - 20, 200, 40);
    this.goldMask = maskShape.createGeometryMask();
    this.goldLabel.setMask(this.goldMask);

    this.mainUIContainer.add([outline, this.goldIcon, this.goldLabel]);
  }

  private setupEventBindings() {
    const gameScene = this.scene.get("GameScene");

    gameScene.events.on("updateHealth", this.onUpdateHealth, this);
    gameScene.events.on("updateGold", this.onUpdateGold, this);
    gameScene.events.on("updateSuccess", this.onUpdateSuccess, this);
    gameScene.events.on("updateBombs", this.onUpdateBombs, this);
    gameScene.events.on("updateRage", this.onUpdateRage, this);
    gameScene.events.on("levelChanged", this.onLevelChanged, this);

    this.events.once("shutdown", () => {
      gameScene.events.off("updateHealth", this.onUpdateHealth, this);
      gameScene.events.off("updateGold", this.onUpdateGold, this);
      gameScene.events.off("updateSuccess", this.onUpdateSuccess, this);
      gameScene.events.off("updateBombs", this.onUpdateBombs, this);
      gameScene.events.off("updateRage", this.onUpdateRage, this);
      gameScene.events.off("levelChanged", this.onLevelChanged, this);
    });
  }

  public getSuccessCounterPosition(color: number): { x: number, y: number } | null {
    const idx = MODES.findIndex(m => m.color === color);
    if (idx !== -1 && this.successTexts[idx]) {
      const textObj = this.successTexts[idx];
      return { x: textObj.x, y: textObj.y };
    }
    return null;
  }

  // --- Event Handlers ---

  private onUpdateHealth(health: number) {
    const currentWidth = (health / 100) * this.hbFillWidth;
    this.healthMaskShape.clear();
    this.healthMaskShape.fillStyle(0xffffff);
    this.healthMaskShape.fillRect(this.hbFillX, this.hbFillY, currentWidth, this.hbFillHeight);
    this.healthText.setText(`${Math.max(0, Math.floor(health))}/100`);
  }

  private onUpdateGold(gold: number) {
    if (this.currentGold === gold) return;

    const isIncrease = gold > this.currentGold;
    const direction = isIncrease ? -1 : 1; // -1 for up, 1 for down
    const offset = 30;
    const targetY = this.goldStartY;

    // 0. Clean up previous animation if still running
    if (this.nextGoldLabel) {
      this.tweens.killTweensOf([this.goldLabel, this.nextGoldLabel]);
      this.goldLabel.destroy();
      this.goldLabel = this.nextGoldLabel;
      this.goldLabel.setPosition(this.goldLabel.x, targetY).setAlpha(1);
      this.nextGoldLabel = undefined;
    }

    // 1. Prepare New Label
    this.nextGoldLabel = this.add.text(this.goldLabel.x, targetY - direction * offset, `${gold}`, this.goldLabel.style)
      .setOrigin(0, 0.5)
      .setMask(this.goldMask)
      .setAlpha(0);

    // 2. Animate Both
    const oldLabel = this.goldLabel;
    this.tweens.add({
      targets: oldLabel,
      y: targetY + direction * offset,
      alpha: 0,
      duration: 150,
      ease: "Quad.easeOut",
      onComplete: () => oldLabel.destroy()
    });

    this.tweens.add({
      targets: this.nextGoldLabel,
      y: targetY,
      alpha: 1,
      duration: 150,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.goldLabel = this.nextGoldLabel!;
        this.nextGoldLabel = undefined;
      }
    });

    if (!isIncrease && this.currentGold > 0) {
      const diff = this.currentGold - gold;
      this.spawnGoldPopText(`-${diff}`, "#ff4444");
    }

    this.currentGold = gold;
    this.refreshBombButton();
  }

  private spawnGoldPopText(text: string, color: string) {
    const popText = this.add.text(this.goldLabel.x + 20, this.goldStartY - 20, text, {
      fontFamily: "WuXin",
      fontSize: "24px",
      color: color,
      fontStyle: "bold",
      stroke: "#ffffff",
      strokeThickness: 4
    }).setOrigin(0, 0.5).setDepth(2000);

    this.tweens.add({
      targets: popText,
      y: popText.y - 60,
      alpha: 0,
      duration: 800,
      ease: "Cubic.easeOut",
      onComplete: () => popText.destroy()
    });
  }

  private refreshBombButton() {
    const canAfford = this.currentGold >= BOMB_COST;
    const hasBombs = this.currentBombs > 0;

    if (hasBombs && canAfford) {
      this.bombBtn.setTint(0xffffff);
      this.bombBtn.input!.cursor = "pointer";
      this.bombCostLabel.setColor("#E29829"); // Golden
    } else {
      this.bombBtn.setTint(0x888888);
      this.bombBtn.input!.cursor = "default";
      this.bombCostLabel.setColor("#a1a1a1"); // Red
    }
}

  private onLevelChanged(config: ILevelConfig) {
    this.currentLevelConfig = config;
    this.levelTimeElapsed = 0;
    this.levelNameLabel.setText(config.name);

    if (config.nextLevelCondition.type === "time") {
      this.timerLabel.setVisible(true);
      this.successBlocks.forEach(b => b.setVisible(false));
      this.successTexts.forEach(t => t.setVisible(false));
      this.victoryLabel.setText("坚持生存:");
      this.timerLabel.setX(this.victoryLabel.x + this.victoryLabel.width + 5);
    } else if (config.nextLevelCondition.type === "combo") {
      this.timerLabel.setVisible(false);
      this.successBlocks.forEach(b => b.setVisible(false));
      this.successTexts.forEach(t => t.setVisible(false));
      this.victoryLabel.setText(`目标连击: ${config.nextLevelCondition.value}`);
    } else {
      this.timerLabel.setVisible(false);
      this.successBlocks.forEach(b => b.setVisible(true));
      this.successTexts.forEach(t => t.setVisible(true));
      this.victoryLabel.setText("目标:");
      
      // Update success texts with new goal
      const gameScene = this.scene.get("GameScene") as any;
      if (gameScene.successCounts) {
        this.onUpdateSuccess(gameScene.successCounts);
      }
    }

    // Flash level name
    this.levelNameLabel.setScale(1.5);
    this.tweens.add({
      targets: this.levelNameLabel,
      scale: 1,
      duration: 500,
      ease: "Back.easeOut"
    });
  }

  private onUpdateSuccess(counts: number[]) {
    let goal: string | number = "--";

    if (this.currentLevelConfig) {
      if (this.currentLevelConfig.nextLevelCondition.type === "score") {
        goal = this.currentLevelConfig.nextLevelCondition.value;
      } else {
        goal = "∞"; 
      }
    }

    counts.forEach((count, i) => {
      const textObj = this.successTexts[i];
      if (textObj) {
        const prevText = textObj.text;
        const newText = `${count}/${goal}`;

        if (prevText !== newText) {
          textObj.setText(newText);

          this.tweens.killTweensOf(textObj);
          textObj.setScale(1);
          this.tweens.add({
            targets: textObj,
            scale: 1.4,
            duration: 100,
            yoyo: true,
            ease: "Quad.easeOut"
          });
        }
      }
    });
  }

  private onUpdateBombs(bombs: number) {
    this.currentBombs = bombs;
    for (let i = 0; i < 2; i++) {
      if (i < bombs) {
        this.bombLeds[i].setFillStyle(0x00ff00).setAlpha(1);
      } else {
        this.bombLeds[i].setFillStyle(0x005500).setAlpha(0.3);
      }
    }
    
    this.refreshBombButton();
  }

  private onUpdateRage(rage: number) {
    if (rage > 0) {
      this.rageLabel.setText(`RAGE: ${rage.toFixed(1)}s`).setAlpha(1);
    } else {
      this.rageLabel.setAlpha(0);
    }
  }

  update(time: number, delta: number) {
    this.fpsLabel.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);

    if (this.isPaused) return;

    if (this.currentLevelConfig && this.currentLevelConfig.nextLevelCondition.type === "time") {
      this.levelTimeElapsed += delta;
      const remaining = Math.max(0, this.currentLevelConfig.nextLevelCondition.value - this.levelTimeElapsed);
      const seconds = Math.floor(remaining / 1000);
      const ms = Math.floor((remaining % 1000) / 10);
      this.timerLabel.setText(`${seconds.toString().padStart(2, "0")}:${ms.toString().padStart(2, "0")}`);
    }
  }
}
