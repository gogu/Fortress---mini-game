export const MODES = (k: any) => [
  { name: "RAPID", color: k.rgb(0, 242, 255), cd: 2.0, dmg: 1 },
  { name: "BLAST", color: k.rgb(255, 140, 0), cd: 2.0, dmg: 5 },
  { name: "PIERCE", color: k.rgb(160, 32, 240), cd: 2.0, dmg: 3 },
];

export const SCREEN_WIDTH = 800;
export const SCREEN_HEIGHT = 600;
export const HEALTH_MAX = 100;
export const ENEMY_SPEED = 150;
export const FRIENDLY_SPEED = 100;
export const ITEM_SPEED = 60;
export const BULLET_SPEED = 1000;
export const SQUAD_SIZE = 3;
export const UNIT_COST = 1;

export const LANES = (k: any) => {
  const startY = 150;
  const spacing = 100;
  return [0, 1, 2, 3, 4].map(i => startY + i * spacing);
};
