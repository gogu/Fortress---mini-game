import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "./constants";

export function spawnParticles(scene: Phaser.Scene, x: number, y: number, color: number) {
  const particles = scene.add.particles(x, y, "white-pixel", {
    speed: { min: 40, max: 200 },
    angle: { min: 0, max: 360 },
    rotate: { min: 0, max: 360 },
    // Graffiti brush look: randomized long/short strokes
    scaleX: { 
      onEmit: () => Phaser.Math.Between(4, 12),
      onUpdate: (p: any, k: string, t: number) => 12 * (1 - t) 
    },
    scaleY: { 
      onEmit: () => Phaser.Math.Between(1, 4),
      onUpdate: (p: any, k: string, t: number) => 4 * (1 - t) 
    },
    alpha: { start: 1, end: 0 },
    lifespan: { min: 300, max: 600 },
    quantity: 12,
    tint: color,
    blendMode: 'MULTIPLY', // Makes it look more like ink on paper
    emitting: false
  });
  particles.explode();
  scene.time.delayedCall(700, () => particles.destroy());
}

export function getMultiplier(x: number, y: number) {
  const col = Math.floor(x / (SCREEN_WIDTH / 3));
  const row = Math.floor(y / (SCREEN_HEIGHT / 3));
  
  if (row === 1) return 1; // Middle row
  if (col === 0) return 3; // Left column
  return 2; // Others
}

export function spawnMultiplier(scene: Phaser.Scene, x: number, y: number, mult: number, prefix = "") {
  if (mult < 1) return; 
  const text = scene.add.text(x + Phaser.Math.Between(-10, 10), y + Phaser.Math.Between(-10, 10), `${prefix}x${mult}`, {
    fontFamily: "WuXin",
    fontSize: "22px",
    color: "#ffffff",
    stroke: "#000000",
    strokeThickness: 5
  });
  text.setDepth(100);

  // Animation sequence: Instant appear & decelerate up -> Pause 0.2s -> Fade out
  scene.tweens.add({
    targets: text,
    y: text.y - 60,
    duration: 300,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      scene.time.delayedCall(200, () => {
        if (text.active) {
          scene.tweens.add({
            targets: text,
            y: text.y - 40,
            alpha: 0,
            duration: 400,
            ease: 'Linear',
            onComplete: () => text.destroy()
          });
        }
      });
    }
  });
}
