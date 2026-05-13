/** Available weapon modes and their properties */
export const MODES = [
  { name: "RAPID", color: 0x00acd9, cd: 0.1, dmg: 1 },
  { name: "BLAST", color: 0xff8c00, cd: 1.5, dmg: 5 },
  { name: "PIERCE", color: 0xa020f0, cd: 1.0, dmg: 3 },
];

/** Game screen width in pixels */
export const SCREEN_WIDTH = 800;
/** Game screen height in pixels */
export const SCREEN_HEIGHT = 600;

/** Maximum health for the player's fortress */
export const HEALTH_MAX = 100;
/** Base movement speed for normal enemies */
export const ENEMY_SPEED = 60;
/** Health points for normal enemies */
export const ENEMY_HP = 1;
/** Health points for elite enemies */
export const ENEMY_ELITE_HP = 1;

/** Movement speed for friendly units */
export const FRIENDLY_SPEED = 120;
/** Number of units in a friendly or enemy squad */
export const SQUAD_SIZE = 3;

/** Travel speed of projectiles */
export const BULLET_SPEED = 1000;

/** Score awarded per enemy unit defeated */
export const SCORE_PER_UNIT = 1;
/** Default points required to win a level (if not overridden by level config) */
export const WIN_CONDITION = 50;
/** Milliseconds between enemy wave spawns */
export const ENEMY_SPAWN_INTERVAL = 3000;
/** Number of squads to spawn per interval */
export const ENEMY_SPAWN_SQUADS_PER_INTERVAL = 2;

/** Starting gold for the player */
export const INITIAL_GOLD = 100;
/** Cost in gold to use a bomb */
export const BOMB_COST = 100;
/** Base duration in ms for a squad-on-squad stalemate */
export const STALEMATE_BASE_DURATION = 2000;

/** The default level to jump to (1-based index) */
export const DEFAULT_START_LEVEL = 4;

/** Y-coordinates for the horizontal lanes */
export const LANES = [120, 220, 320, 420, 520];

/** X-coordinate target for friendly units reaching the enemy side */
export const FRIENDLY_GOAL_X = SCREEN_WIDTH - 60;
/** X-coordinate target for enemy units reaching the player side */
export const ENEMY_GOAL_X = 60;

/** Whether to display technical debug visuals */
export const SHOW_DEBUG_VISUALS = false;
