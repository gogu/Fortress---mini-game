import Phaser from "phaser";
import "./index.css";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "./constants";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { UIScene } from "./scenes/UIScene";
import { ResultScene } from "./scenes/ResultScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  parent: "game-container",
  backgroundColor: "#efeadc",
  pixelArt: true, // Optimized for hand-drawn/pixel style, disables antialiasing
  render: {
    powerPreference: 'high-performance',
    batchSize: 512,
    roundPixels: true,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, GameScene, UIScene, ResultScene],
};

document.fonts.ready.then(() => {
  new Phaser.Game(config);
});
