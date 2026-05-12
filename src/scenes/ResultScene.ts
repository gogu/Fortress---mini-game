import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT, DEFAULT_START_LEVEL } from "../constants";
import { HandDrawnButton } from "../ui/HandDrawnButton";
import { PaperTransition } from "../ui/PaperTransition";

export interface ResultData {
  isVictory: boolean;
  gold: number;
  successCounts: number[];
  _useTearTransition?: boolean;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super("ResultScene");
  }

  create(data: ResultData) {
    PaperTransition.setupReveal(this, data);
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
    const restartBtn = new HandDrawnButton(this, {
      x: 0,
      y: 100,
      text: "RETRY",
      onClick: () => {
        this.sound.play("change", { volume: 0.5 });
        PaperTransition.tearTo(this, "GameScene", { startLevelIndex: DEFAULT_START_LEVEL - 1 });
      }
    });

    statsContainer.add(restartBtn);

    // Retro scanline effect for this specific UI
    for (let i = 0; i < SCREEN_HEIGHT; i += 4) {
      this.add.rectangle(SCREEN_WIDTH / 2, i, SCREEN_WIDTH, 1, 0x000000, 0.1).setDepth(100);
    }
  }
}
