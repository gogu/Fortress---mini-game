import Phaser from "phaser";
import { SCREEN_WIDTH } from "../constants";

export class UIScene extends Phaser.Scene {
  private goldLabel!: Phaser.GameObjects.Text;
  private successLabel!: Phaser.GameObjects.Text;
  private comboLabel!: Phaser.GameObjects.Text;
  private bombLabel!: Phaser.GameObjects.Text;
  private rageLabel!: Phaser.GameObjects.Text;
  private sequenceSlots: Phaser.GameObjects.Rectangle[] = [];

  private ratioLabel!: Phaser.GameObjects.Text;
  private healthFill!: Phaser.GameObjects.Rectangle;

  constructor() {
    super("UIScene");
  }

  create() {
    this.goldLabel = this.add.text(SCREEN_WIDTH / 2, 35, "GOLD: 0", { fontSize: "24px", color: "#ffd700" }).setOrigin(0.5);
    this.successLabel = this.add.text(SCREEN_WIDTH / 2, 60, "PROGRESS: R 0/50 | G 0/50 | B 0/50", { fontSize: "14px", color: "#c8c8c8" }).setOrigin(0.5);
    this.comboLabel = this.add.text(SCREEN_WIDTH / 2, 100, "COMBO: 0", { fontSize: "36px", color: "#ffffff" }).setOrigin(0.5).setAlpha(0);
    this.bombLabel = this.add.text(SCREEN_WIDTH - 20, 50, "BOMBS: 0/2", { fontSize: "16px", color: "#ff6464" }).setOrigin(1, 0);
    this.rageLabel = this.add.text(SCREEN_WIDTH - 20, 75, "RAGE: 0s", { fontSize: "16px", color: "#ff64ff" }).setOrigin(1, 0).setAlpha(0);
    this.ratioLabel = this.add.text(50, 150, "1 : 1 : 1", { fontSize: "12px", color: "#c8c8c8" }).setOrigin(0.5);

    // Health Bar
    this.add.rectangle(20, 20, 200, 20, 0x000000).setOrigin(0).setStrokeStyle(2, 0xffffff);
    this.healthFill = this.add.rectangle(20, 20, 200, 20, 0xff0000).setOrigin(0);

    for (let i = 0; i < 3; i++) {
      const slot = this.add.rectangle(SCREEN_WIDTH - 20 - (2 - i) * 18, 110, 12, 12, 0x323232).setOrigin(1, 0).setAlpha(0.3).setStrokeStyle(1, 0x646464);
      this.sequenceSlots.push(slot);
    }

    // Event listeners from GameScene
    const gameScene = this.scene.get("GameScene");
    gameScene.events.on("updateHealth", (health: number) => {
      this.healthFill.width = (health / 100) * 200;
    });

    gameScene.events.on("updateRatios", (ratios: number[]) => {
      this.ratioLabel.setText(`${ratios[0]} : ${ratios[1]} : ${ratios[2]}`);
    });
    
    gameScene.events.on("updateBarracksPos", (x: number, y: number) => {
      this.ratioLabel.setPosition(x, y - 50);
    });

    gameScene.events.on("updateGold", (gold: number) => {
      this.goldLabel.setText(`GOLD: ${gold}`);
      this.tweens.add({ targets: this.goldLabel, scale: 1.2, duration: 100, yoyo: true });
    });

    gameScene.events.on("updateSuccess", (counts: number[]) => {
      this.successLabel.setText(`PROGRESS: R ${counts[0]}/50 | G ${counts[1]}/50 | B ${counts[2]}/50`);
      this.tweens.add({ targets: this.successLabel, scale: 1.1, duration: 100, yoyo: true });
    });

    gameScene.events.on("updateCombo", (combo: number) => {
      if (combo > 0) {
        this.comboLabel.setText(`COMBO: ${combo}`).setAlpha(0.5);
        this.tweens.add({ targets: this.comboLabel, scale: 1.1, duration: 50, yoyo: true });
      } else {
        this.comboLabel.setAlpha(0);
      }
    });

    gameScene.events.on("updateBombs", (bombs: number) => {
      this.bombLabel.setText(`BOMBS: ${bombs}/2`);
    });

    gameScene.events.on("updateRage", (rage: number) => {
      if (rage > 0) {
        this.rageLabel.setText(`RAGE: ${rage.toFixed(1)}s`).setAlpha(1);
      } else {
        this.rageLabel.setAlpha(0);
      }
    });

    gameScene.events.on("updateSequence", (sequence: number[]) => {
      for (let i = 0; i < 3; i++) {
        const slot = this.sequenceSlots[i];
        if (sequence[i] !== undefined) {
          slot.setFillStyle(sequence[i]).setAlpha(1);
        } else {
          slot.setFillStyle(0x323232).setAlpha(0.3);
        }
      }
    });

    gameScene.events.on("sequenceFailure", () => {
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
    });
  }
}
