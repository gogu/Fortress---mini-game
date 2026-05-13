import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "../constants";

/**
 * A reusable Scanline effect component that adds a CRT-like overlay.
 */
export class ScanlineOverlay extends Phaser.GameObjects.TileSprite {
  constructor(scene: Phaser.Scene, depth: number = 99, alpha: number = 0.6, verticalMargin: number = 30) {
    // Ensure the texture exists in the scene
    if (!scene.textures.exists("scanline_texture")) {
      const graphics = scene.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0x000000, 0.2);
      graphics.fillRect(0, 0, 2, 2);
      graphics.generateTexture("scanline_texture", 2, 4);
      graphics.destroy();
    }

    const height = SCREEN_HEIGHT - verticalMargin * 2;
    super(scene, 0, verticalMargin, SCREEN_WIDTH, height, "scanline_texture");
    
    scene.add.existing(this);
    this.setOrigin(0)
      .setDepth(depth)
      .setAlpha(alpha);
  }
}
