import Phaser from "phaser";
import { SCREEN_WIDTH, WIN_CONDITION } from "../constants";

export class UIScene extends Phaser.Scene {
  private goldLabel!: Phaser.GameObjects.Text;
  private successLabel!: Phaser.GameObjects.Text;
  private comboLabel!: Phaser.GameObjects.Text;
  private bombLabel!: Phaser.GameObjects.Text;
  private rageLabel!: Phaser.GameObjects.Text;
  private fpsLabel!: Phaser.GameObjects.Text;
  private sequenceSlots: Phaser.GameObjects.Rectangle[] = [];

  private ratioLabel!: Phaser.GameObjects.Text;
  
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
    this.sequenceSlots = [];
  }

  create() {
    this.createTopBar();
    this.createHealthBar();
    this.createIndicators();
    this.setupEventBindings();
  }

  private createTopBar() {
    this.goldLabel = this.add.text(SCREEN_WIDTH / 2, 35, "GOLD: 0", { fontSize: "24px", color: "#8b4513" }).setOrigin(0.5);
    this.successLabel = this.add.text(SCREEN_WIDTH / 2, 60, `PROGRESS: R 0/${WIN_CONDITION} | G 0/${WIN_CONDITION} | B 0/${WIN_CONDITION}`, { fontSize: "14px", color: "#444444" }).setOrigin(0.5);
    this.comboLabel = this.add.text(SCREEN_WIDTH / 2, 100, "COMBO: 0", { fontSize: "36px", color: "#333333" }).setOrigin(0.5).setAlpha(0);
    this.bombLabel = this.add.text(SCREEN_WIDTH - 20, 50, "BOMBS: 0/2", { fontSize: "16px", color: "#8b0000" }).setOrigin(1, 0);
    this.rageLabel = this.add.text(SCREEN_WIDTH - 20, 75, "RAGE: 0s", { fontSize: "16px", color: "#4b0082" }).setOrigin(1, 0).setAlpha(0);
    this.fpsLabel = this.add.text(SCREEN_WIDTH - 20, 20, "FPS: 0", { fontSize: "14px", color: "#2f4f4f" }).setOrigin(1, 0);
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
      .setDisplaySize(this.hbFillWidth, this.hbFillHeight);

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
      { fontSize: "12px", color: "#ffffff", fontStyle: "bold" }
    ).setOrigin(0.5);
  }

  private createIndicators() {
    this.ratioLabel = this.add.text(50, 150, "1 : 1 : 1", { fontSize: "12px", color: "#444444" }).setOrigin(0.5);

    for (let i = 0; i < 3; i++) {
      const slot = this.add.rectangle(SCREEN_WIDTH - 20 - (2 - i) * 18, 110, 12, 12, 0x323232)
        .setOrigin(1, 0)
        .setAlpha(0.3)
        .setStrokeStyle(1, 0x646464);
      this.sequenceSlots.push(slot);
    }
  }

  private setupEventBindings() {
    const gameScene = this.scene.get("GameScene");

    gameScene.events.on("updateHealth", this.onUpdateHealth, this);
    gameScene.events.on("updateRatios", this.onUpdateRatios, this);
    gameScene.events.on("updateBarracksPos", this.onUpdateBarracksPos, this);
    gameScene.events.on("updateGold", this.onUpdateGold, this);
    gameScene.events.on("updateSuccess", this.onUpdateSuccess, this);
    gameScene.events.on("updateCombo", this.onUpdateCombo, this);
    gameScene.events.on("updateBombs", this.onUpdateBombs, this);
    gameScene.events.on("updateRage", this.onUpdateRage, this);
    gameScene.events.on("updateSequence", this.onUpdateSequence, this);
    gameScene.events.on("sequenceFailure", this.onSequenceFailure, this);

    this.events.on("shutdown", () => {
      gameScene.events.off("updateHealth", this.onUpdateHealth, this);
      gameScene.events.off("updateRatios", this.onUpdateRatios, this);
      gameScene.events.off("updateBarracksPos", this.onUpdateBarracksPos, this);
      gameScene.events.off("updateGold", this.onUpdateGold, this);
      gameScene.events.off("updateSuccess", this.onUpdateSuccess, this);
      gameScene.events.off("updateCombo", this.onUpdateCombo, this);
      gameScene.events.off("updateBombs", this.onUpdateBombs, this);
      gameScene.events.off("updateRage", this.onUpdateRage, this);
      gameScene.events.off("updateSequence", this.onUpdateSequence, this);
      gameScene.events.off("sequenceFailure", this.onSequenceFailure, this);
    });
  }

  // --- Event Handlers ---

  private onUpdateHealth(health: number) {
    const currentWidth = (health / 100) * this.hbFillWidth;
    this.healthMaskShape.clear();
    this.healthMaskShape.fillStyle(0xffffff);
    this.healthMaskShape.fillRect(this.hbFillX, this.hbFillY, currentWidth, this.hbFillHeight);
    this.healthText.setText(`${Math.max(0, Math.floor(health))}/100`);
  }

  private onUpdateRatios(ratios: number[]) {
    this.ratioLabel.setText(`${ratios[0]} : ${ratios[1]} : ${ratios[2]}`);
  }
  
  private onUpdateBarracksPos(x: number, y: number) {
    this.ratioLabel.setPosition(x, y - 50);
  }

  private onUpdateGold(gold: number) {
    this.goldLabel.setText(`GOLD: ${gold}`);
    this.tweens.add({ targets: this.goldLabel, scale: 1.2, duration: 100, yoyo: true });
  }

  private onUpdateSuccess(counts: number[]) {
    this.successLabel.setText(`PROGRESS: R ${counts[0]}/${WIN_CONDITION} | G ${counts[1]}/${WIN_CONDITION} | B ${counts[2]}/${WIN_CONDITION}`);
    this.tweens.add({ targets: this.successLabel, scale: 1.1, duration: 100, yoyo: true });
  }

  private onUpdateCombo(combo: number) {
    if (combo > 0) {
      this.comboLabel.setText(`COMBO: ${combo}`).setAlpha(0.5);
      this.tweens.add({ targets: this.comboLabel, scale: 1.1, duration: 50, yoyo: true });
    } else {
      this.comboLabel.setAlpha(0);
    }
  }

  private onUpdateBombs(bombs: number) {
    this.bombLabel.setText(`BOMBS: ${bombs}/2`);
  }

  private onUpdateRage(rage: number) {
    if (rage > 0) {
      this.rageLabel.setText(`RAGE: ${rage.toFixed(1)}s`).setAlpha(1);
    } else {
      this.rageLabel.setAlpha(0);
    }
  }

  private onUpdateSequence(sequence: number[]) {
    for (let i = 0; i < 3; i++) {
      const slot = this.sequenceSlots[i];
      if (sequence[i] !== undefined) {
        slot.setFillStyle(sequence[i]).setAlpha(1);
      } else {
        slot.setFillStyle(0x323232).setAlpha(0.3);
      }
    }
  }

  private onSequenceFailure() {
    this.sequenceSlots.forEach((slot, i) => {
      const baseX = slot.x;
      this.tweens.add({
        targets: slot,
        x: baseX + 10,
        duration: 50,
        yoyo: true,
        delay: i * 50,
        onComplete: () => { slot.x = baseX; }
      });
    });
  }

  update() {
    this.fpsLabel.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
  }
}
