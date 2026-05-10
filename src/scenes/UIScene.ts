import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT, WIN_CONDITION, MODES } from "../constants";

export class UIScene extends Phaser.Scene {
  private goldLabel!: Phaser.GameObjects.Text;
  private goldIcon!: Phaser.GameObjects.Image;
  private currentGold: number = 0;
  private goldMask!: Phaser.Display.Masks.GeometryMask;
  private nextGoldLabel?: Phaser.GameObjects.Text;
  private goldStartY: number = 350; // Target Y coordinate over the Barracks
  private victoryLabel!: Phaser.GameObjects.Text;
  private successTexts: Phaser.GameObjects.Text[] = [];
  private comboLabel!: Phaser.GameObjects.Text;
  private comboBg!: Phaser.GameObjects.Image;
  private rageLabel!: Phaser.GameObjects.Text;
  private fpsLabel!: Phaser.GameObjects.Text;
  private pausedLabel!: Phaser.GameObjects.Text;
  private bombBtn!: Phaser.GameObjects.Image;
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

  create() {
    this.createTopBar();
    this.createHealthBar();
    this.createVictoryProgress();
    this.createGoldUI();
    this.createBombButton();
    this.setupEventBindings();
  }

  private createGoldUI() {
    const startX = 90;
    const startY = this.goldStartY;

    // Hard white outline using a slightly larger, white-tinted silhouette behind the icon
    this.add.image(startX, startY, "ui_icon_coin")
      .setOrigin(0.5)
      .setScale(0.6)
      .setTintFill(0xffffff);

    // Main Gold Icon
    this.goldIcon = this.add.image(startX, startY, "ui_icon_coin").setOrigin(0.5).setScale(0.5);

    // Gold Label with hard white stroke
    this.goldLabel = this.add.text(this.goldIcon.x + this.goldIcon.displayWidth/2 + 5, startY, "0", { 
      fontFamily: "WuXin",
      fontSize: "22px", 
      color: "#8b4513",
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
  }

  private createTopBar() {
    // Top Right: Pause Button
    const pauseBtn = this.add.image(SCREEN_WIDTH - 60, 65, "ui_pause")
      .setOrigin(0.5)
      .setScale(0.5)
      .setInteractive({ useHandCursor: true });

    pauseBtn.on("pointerover", () => {
      pauseBtn.setScale(0.55);
      pauseBtn.setTint(0xdddddd);
    });

    pauseBtn.on("pointerout", () => {
      pauseBtn.setScale(0.5);
      pauseBtn.clearTint();
    });

    pauseBtn.on("pointerdown", () => {
      pauseBtn.setScale(0.45);
      pauseBtn.setTint(0xaaaaaa);
      this.togglePause();
    });

    pauseBtn.on("pointerup", () => {
      pauseBtn.setScale(0.55);
      pauseBtn.setTint(0xdddddd);
    });

    // Center: Combo
    this.comboBg = this.add.image(SCREEN_WIDTH / 2 + 55, 120, "ui_combo_bg")
      .setOrigin(0.5)
      .setScale(0.5)
      .setAlpha(0);
    
    this.comboLabel = this.add.text(SCREEN_WIDTH / 2 + 80, 105, "0", { 
      fontFamily: "WuXin",
      fontSize: "100px", 
      color: "#000000",
      fontStyle: "bold",
    }).setOrigin(0.5).setAlpha(0);
    
    // Paused Overlay Text
    this.pausedLabel = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, "PAUSED", {
      fontFamily: "WuXin",
      fontSize: "64px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 8
    }).setOrigin(0.5).setAlpha(0).setDepth(100);
// Right Side: Items (shifted down to avoid gold)
    this.rageLabel = this.add.text(SCREEN_WIDTH - 20, 170, "RAGE: 0s", { fontFamily: "WuXin", fontSize: "16px", color: "#4b0082" }).setOrigin(1, 0).setAlpha(0);

    // Bottom Left: FPS
    this.fpsLabel = this.add.text(20, SCREEN_HEIGHT - 20, "FPS: 0", { fontFamily: "WuXin", fontSize: "14px", color: "#2f4f4f" }).setOrigin(0, 1);

    // ESC Key to Pause
    this.input.keyboard?.on("keydown-ESC", () => {
      this.togglePause();
    });
  }

  private togglePause() {
    this.isPaused = !this.isPaused;
    const gameScene = this.scene.get("GameScene");

    if (this.isPaused) {
      gameScene.scene.pause();
      this.pausedLabel.setAlpha(1);
    } else {
      gameScene.scene.resume();
      this.pausedLabel.setAlpha(0);
    }
  }

  private createHealthBar() {
    const hbScale = 0.5;
    const hbX = 50;
    const hbY = 40;

    this.add.image(hbX, hbY, "ui_health_bar_frame")
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
  }

  private createVictoryProgress() {
    const startX = 60; // Moved right slightly
    const startY = 105; // Moved down 5 more pixels

    this.victoryLabel = this.add.text(startX, startY, "胜利目标:", { 
      fontFamily: "WuXin",
      fontSize: "14px", 
      color: "#444444", 
      fontStyle: "bold" 
    }).setOrigin(0, 0.5);

    let currentX = startX + 75; // Adjusted starting X for blocks

    this.successTexts = [];
    for (let i = 0; i < 3; i++) {
      // Color block (Using colors mapped from global MODES constants)
      this.add.rectangle(currentX, startY, 12, 12, MODES[i].color)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, 0x000000, 0.5);
      
      // Progress text
      const txt = this.add.text(currentX + 16, startY, `0/${WIN_CONDITION}`, { 
        fontFamily: "WuXin",
        fontSize: "12px", 
        color: "#333333" 
      }).setOrigin(0, 0.5);
      
      this.successTexts.push(txt);
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
    }

    this.bombBtn.on("pointerover", () => {
      if (this.bombBtn.alpha === 1) {
        this.bombBtn.setScale(0.55);
        this.bombBtn.setTint(0xdddddd);
      }
    });

    this.bombBtn.on("pointerout", () => {
      if (this.bombBtn.alpha === 1) {
        this.bombBtn.setScale(0.5);
        this.bombBtn.clearTint();
      }
    });

    this.bombBtn.on("pointerdown", () => {
      if (this.bombBtn.alpha === 1) {
        this.bombBtn.setScale(0.45);
        this.bombBtn.setTint(0xaaaaaa);
        this.scene.get("GameScene").events.emit("requestBomb");
      }
    });

    this.bombBtn.on("pointerup", () => {
      if (this.bombBtn.alpha === 1) {
        this.bombBtn.setScale(0.55);
        this.bombBtn.setTint(0xdddddd);
      }
    });
  }

  private setupEventBindings() {
    const gameScene = this.scene.get("GameScene");

    gameScene.events.on("updateHealth", this.onUpdateHealth, this);
    gameScene.events.on("updateGold", this.onUpdateGold, this);
    gameScene.events.on("updateSuccess", this.onUpdateSuccess, this);
    gameScene.events.on("updateCombo", this.onUpdateCombo, this);
    gameScene.events.on("updateBombs", this.onUpdateBombs, this);
    gameScene.events.on("updateRage", this.onUpdateRage, this);

    this.events.on("shutdown", () => {
      gameScene.events.off("updateHealth", this.onUpdateHealth, this);
      gameScene.events.off("updateGold", this.onUpdateGold, this);
      gameScene.events.off("updateSuccess", this.onUpdateSuccess, this);
      gameScene.events.off("updateCombo", this.onUpdateCombo, this);
      gameScene.events.off("updateBombs", this.onUpdateBombs, this);
      gameScene.events.off("updateRage", this.onUpdateRage, this);
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

    this.currentGold = gold;
  }

  private onUpdateSuccess(counts: number[]) {
    counts.forEach((count, i) => {
      const textObj = this.successTexts[i];
      if (textObj) {
        const prevText = textObj.text;
        const newText = `${count}/${WIN_CONDITION}`;
        
        if (prevText !== newText) {
          textObj.setText(newText);
          
          // Kill any existing tweens on this object to prevent scale accumulation
          this.tweens.killTweensOf(textObj);
          // Reset base scale before jumping
          textObj.setScale(1);
          
          // Jumping animation: scale up and back down
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

  private onUpdateCombo(combo: number) {
    if (combo > 0) {
      this.comboLabel.setText(`${combo}`).setAlpha(1);
      this.comboBg.setAlpha(1);
      if (this.tweens.isTweening(this.comboBg)) return;
      
      // Pop animation
      const originalScale = this.comboBg.scale;
      this.tweens.add({
        targets: [this.comboBg],
        scale: { from: originalScale * 1.2, to: originalScale },
        duration: 100,
        ease: "Back.easeOut"
      });
      this.comboBg.scale = originalScale;
    } else {
      this.comboLabel.setAlpha(0);
      this.comboBg.setAlpha(0);
    }
  }

  private onUpdateBombs(bombs: number) {
    for (let i = 0; i < 2; i++) {
      if (i < bombs) {
        this.bombLeds[i].setFillStyle(0x00ff00).setAlpha(1);
      } else {
        this.bombLeds[i].setFillStyle(0x005500).setAlpha(0.3);
      }
    }
    
    if (bombs > 0) {
      this.bombBtn.setAlpha(1);
      this.bombBtn.setTint(0xffffff);
      this.bombBtn.input!.cursor = "pointer";
    } else {
      this.bombBtn.setAlpha(0.5);
      this.bombBtn.setTint(0x666666);
      this.bombBtn.input!.cursor = "default";
    }
  }

  private onUpdateRage(rage: number) {
    if (rage > 0) {
      this.rageLabel.setText(`RAGE: ${rage.toFixed(1)}s`).setAlpha(1);
    } else {
      this.rageLabel.setAlpha(0);
    }
  }

  update() {
    this.fpsLabel.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
  }
}
