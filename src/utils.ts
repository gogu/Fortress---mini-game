import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "./constants";

export function spawnParticles(scene: Phaser.Scene, x: number, y: number, color: number) {
  const particles = scene.add.particles(x, y, "white-pixel", {
    speed: { min: 50, max: 150 },
    angle: { min: 0, max: 360 },
    scale: { start: 1, end: 0 },
    lifespan: 200,
    quantity: 6,
    tint: color,
    emitting: false
  });
  particles.explode();
  scene.time.delayedCall(300, () => particles.destroy());
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
  const text = scene.add.text(x + Phaser.Math.Between(-10, 10), y + Phaser.Math.Between(-10, 10), `${prefix}✖️${mult}`, {
    fontSize: "20px",
    color: "#ffff00"
  });
  scene.tweens.add({
    targets: text,
    y: text.y - 80,
    alpha: 0,
    duration: 400,
    onComplete: () => text.destroy()
  });
}
