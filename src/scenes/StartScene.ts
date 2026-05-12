import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "../constants";
import { HandDrawnButton } from "../ui/HandDrawnButton";
import { PaperTransition } from "../ui/PaperTransition";

export class StartScene extends Phaser.Scene {
  constructor() {
    super("StartScene");
  }

  create() {
    const title = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 80, "FORTRESS", {
      fontFamily: "WuXin",
      fontSize: "80px",
      color: "#000000",
      stroke: "#ffffff",
      strokeThickness: 10
    }).setOrigin(0.5);

    const startBtn = new HandDrawnButton(this, {
      x: SCREEN_WIDTH / 2,
      y: SCREEN_HEIGHT / 2 + 100,
      text: "START",
      onClick: () => {
        startBtn.disableInteractive();
        PaperTransition.tearTo(this, "GameScene");
      }
    });
  }
}
