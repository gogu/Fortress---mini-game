export function spawnParticles(k: any, pos: any, color: any) {
  for (let i = 0; i < 6; i++) {
    const angle = k.rand(0, 360);
    k.add([
      k.pos(pos),
      k.rect(k.rand(2, 4), k.rand(2, 4)),
      k.color(color),
      k.move(k.Vec2.fromAngle(angle), k.rand(50, 150)),
      k.lifespan(0.2),
      k.rotate(angle),
    ]);
  }
}

export function getMultiplier(k: any, pos: any) {
  const col = Math.floor(pos.x / (k.width() / 3));
  const row = Math.floor(pos.y / (k.height() / 3));
  
  if (row === 1) return 1; // Middle row
  if (col === 0) return 3; // Left column
  return 2; // Others
}

export function spawnMultiplier(k: any, pos: any, mult: number, prefix = "") {
  if (mult < 1) return; 
  k.add([
    k.text(`${prefix}✖️${mult}`, { size: 20 }),
    k.pos(pos.add(k.rand(-10, 10), k.rand(-10, 10))),
    k.color(255, 255, 0),
    k.move(k.UP, 80),
    k.lifespan(0.4, { fade: 0.2 }),
    k.z(50),
  ]);
}
