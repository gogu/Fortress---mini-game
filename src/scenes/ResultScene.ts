import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "../constants";

export interface ResultData {
  isVictory: boolean;
  gold: number;
  successCounts: number[];
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super("ResultScene");
  }

  create(data: ResultData) {
    const { isVictory, gold, successCounts } = data;

    // Dim background
    this.add.rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 0x000000, 0.8).setOrigin(0);

    const titleText = isVictory ? "VICTORY ACHIEVED" : "DEFENSE BREACHED";
    const titleColor = isVictory ? "#4ade80" : "#f87171";

    // Title
    const title = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 150, titleText, {
      fontSize: "48px",
      fontFamily: "WuXin",
      color: titleColor,
      stroke: "#000",
      strokeThickness: 8,
    }).setOrigin(0.5);

    // Fade in animation for title
    title.setAlpha(0);
    this.tweens.add({
      targets: title,
      alpha: 1,
      y: title.y + 20,
      duration: 1000,
      ease: "Power2"
    });

    // Score Info
    const statsContainer = this.add.container(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
    
    const goldText = this.add.text(0, -40, `TOTAL GOLD: ${gold}`, {
      fontFamily: "WuXin",
      fontSize: "24px",
      color: "#ffd700"
    }).setOrigin(0.5);

    const progressText = this.add.text(0, 0, 
      `RED: ${successCounts[0]} | GREEN: ${successCounts[1]} | BLUE: ${successCounts[2]}`, 
      { fontFamily: "WuXin", fontSize: "18px", color: "#c8c8c8" }
    ).setOrigin(0.5);

    statsContainer.add([goldText, progressText]);
    statsContainer.setAlpha(0);

    this.time.delayedCall(800, () => {
      this.tweens.add({
        targets: statsContainer,
        alpha: 1,
        duration: 500
      });
    });

    // Restart Button
    const btnBg = this.add.rectangle(0, 100, 240, 60, 0x222222)
      .setStrokeStyle(2, 0x444444)
      .setInteractive({ useHandCursor: true });
    
    const btnText = this.add.text(0, 100, "PLAY AGAIN", {
      fontFamily: "WuXin",
      fontSize: "24px",
      color: "#ffffff"
    }).setOrigin(0.5);

    statsContainer.add([btnBg, btnText]);

    btnBg.on("pointerover", () => {
      btnBg.setStrokeStyle(4, 0xffffff);
      btnBg.setFillStyle(0x333333);
      this.sound.play("change", { volume: 0.2 });
    });

    btnBg.on("pointerout", () => {
      btnBg.setStrokeStyle(2, 0x444444);
      btnBg.setFillStyle(0x222222);
    });

    btnBg.on("pointerdown", () => {
      this.sound.play("change", { volume: 0.5 });
      this.cameras.main.fade(500, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("GameScene");
      });
    });

    // Retro scanline effect for this specific UI
    for (let i = 0; i < SCREEN_HEIGHT; i += 4) {
      this.add.rectangle(SCREEN_WIDTH / 2, i, SCREEN_WIDTH, 1, 0x000000, 0.1).setDepth(100);
    }
  }
}
