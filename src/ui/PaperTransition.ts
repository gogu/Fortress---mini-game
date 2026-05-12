import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "../constants";

export class PaperTransition {
  /**
   * Transitions to a new scene using a paper tear effect.
   */
  static tearTo(fromScene: Phaser.Scene, toSceneKey: string, data: any = {}) {
    data._useTearTransition = true;
    fromScene.scene.start(toSceneKey, data);
  }

  /**
   * Call this at the start of create() in the target scene.
   */
  static setupReveal(scene: Phaser.Scene, data: any) {
    if (!data || !data._useTearTransition) return;

    if (scene.cache.audio.exists("transition")) {
      scene.time.delayedCall(600, () => {
        scene.sound.play("transition", { volume: 0.5 });
      });
    }

    const maskGraphics = scene.make.graphics({ x: 0, y: 0 });
    const mask = maskGraphics.createGeometryMask();
    scene.cameras.main.setMask(mask);

    // Visual "tear edge" - a jagged white line
    const tearEdge = scene.add.graphics().setDepth(2000);
    const tearShadow = scene.add.graphics().setDepth(1999);
    
    const tearLine = { x: -50 };
    const segments = 30;
    const segmentHeight = (SCREEN_HEIGHT + 40) / segments;
    const wobble = 12;
    
    // Generate initial random offsets for the edge
    const offsets = Array.from({ length: segments + 1 }, () => Math.random() * wobble);

    const updateMask = () => {
      // 1. Update Mask
      maskGraphics.clear();
      maskGraphics.fillStyle(0xffffff);
      maskGraphics.beginPath();
      maskGraphics.moveTo(-50, -20);
      
      for (let i = 0; i <= segments; i++) {
        const y = i * segmentHeight - 20;
        const curWobble = offsets[i] + (Math.random() - 0.5) * 3; // Micro-vibration
        maskGraphics.lineTo(tearLine.x + curWobble, y);
      }

      maskGraphics.lineTo(-50, SCREEN_HEIGHT + 20);
      maskGraphics.closePath();
      maskGraphics.fillPath();

      // 2. Update Tear Edge Visuals
      tearEdge.clear();
      tearShadow.clear();
      
      // Draw shadow
      tearShadow.lineStyle(10, 0x000000, 0.1);
      tearShadow.beginPath();
      tearShadow.moveTo(tearLine.x + offsets[0] + 5, -20);
      for (let i = 1; i <= segments; i++) {
        tearShadow.lineTo(tearLine.x + offsets[i] + 5, i * segmentHeight - 20);
      }
      tearShadow.strokePath();

      // Draw white torn edge
      tearEdge.lineStyle(4, 0xffffff, 1);
      tearEdge.beginPath();
      tearEdge.moveTo(tearLine.x + offsets[0], -20);
      for (let i = 1; i <= segments; i++) {
        const y = i * segmentHeight - 20;
        tearEdge.lineTo(tearLine.x + offsets[i], y);
      }
      tearEdge.strokePath();
    };

    scene.tweens.add({
      targets: tearLine,
      x: SCREEN_WIDTH + 100,
      duration: 1200,
      ease: "Cubic.easeInOut",
      onUpdate: updateMask,
      onComplete: () => {
        scene.cameras.main.clearMask();
        maskGraphics.destroy();
        tearEdge.destroy();
        tearShadow.destroy();
      }
    });
  }
}
