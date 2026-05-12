import Phaser from "phaser";
import { DEFAULT_START_LEVEL } from "../constants";

export interface IEnemySpawnDef {
  time: number;      // Offset from wave start in ms
  lane: number;      // 0-4
  color: number;     // 0-2 (index in MODES)
  isElite?: boolean;
}

export interface IWaveConfig {
  waveId: number;
  delayBeforeStart: number;
  delayAfterWave?: number; // New: Optional delay after all spawns in this wave are done
  spawns: IEnemySpawnDef[];
}

export interface ILevelConfig {
  id: number;
  name: string;
  enemySpawnInterval: number;
  enemySpawnSquads: number;
  enemySpeed: number;
  eliteSpawnChance: number;
  colorWeights?: number[]; // [cyan, orange, purple] e.g., [0.5, 0.3, 0.2]
  friendlySpawnInterval: number;
  friendlyUnitCost: number;
  nextLevelCondition: {
    type: "time" | "score";
    value: number;
  };
  waves?: IWaveConfig[];
}

export class LevelManager extends Phaser.Events.EventEmitter {
  private levels: ILevelConfig[] = [];
  private currentLevelIndex: number = -1;
  private timeInLevel: number = 0;
  private isCompleted: boolean = false;
  private levelCompletionSignaled: boolean = false;

  constructor() {
    super();
  }

  public init(data: { levels: ILevelConfig[] }) {
    this.levels = data.levels;
    this.currentLevelIndex = 0;
    this.timeInLevel = 0;
    this.isCompleted = false;
    this.levelCompletionSignaled = false;
  }

  public start(startLevelIndex: number = 0) {
    if (this.levels.length > 0) {
      this.currentLevelIndex = Phaser.Math.Clamp(startLevelIndex, 0, this.levels.length - 1);
      this.levelCompletionSignaled = false;
      this.emit("level_changed", this.getCurrentConfig());
    }
  }

  public update(delta: number, successCounts: number[]) {
    if (this.isCompleted || this.currentLevelIndex === -1 || this.levelCompletionSignaled) return;

    this.timeInLevel += delta;

    const currentConfig = this.getCurrentConfig();
    if (!currentConfig) return;

    let conditionMet = false;
    if (currentConfig.nextLevelCondition.type === "time") {
      if (this.timeInLevel >= currentConfig.nextLevelCondition.value) {
        conditionMet = true;
      }
    } else if (currentConfig.nextLevelCondition.type === "score") {
      // Current game win condition is every color >= value
      if (successCounts.every(count => count >= currentConfig.nextLevelCondition.value)) {
        conditionMet = true;
      }
    }

    if (conditionMet) {
      this.levelCompletionSignaled = true;
      this.emit("level_completed", currentConfig);
    }
  }

  public advanceLevel() {
    if (this.currentLevelIndex < this.levels.length - 1) {
      this.currentLevelIndex++;
      this.timeInLevel = 0;
      this.levelCompletionSignaled = false;
      this.emit("level_changed", this.getCurrentConfig());
    } else {
      this.isCompleted = true;
      this.emit("game_completed");
    }
  }

  public jumpToLevel(levelId: number) {
    const index = this.levels.findIndex(l => l.id === levelId);
    if (index !== -1) {
      this.currentLevelIndex = index;
      this.timeInLevel = 0;
      this.levelCompletionSignaled = false;
      this.isCompleted = false;
      this.emit("level_changed", this.getCurrentConfig());
    }
  }

  public getCurrentConfig(): ILevelConfig | null {
    if (this.currentLevelIndex >= 0 && this.currentLevelIndex < this.levels.length) {
      return this.levels[this.currentLevelIndex];
    }
    return null;
  }

  public getProgress(): number {
    const config = this.getCurrentConfig();
    if (!config) return 0;

    if (config.nextLevelCondition.type === "time") {
      return Math.min(this.timeInLevel / config.nextLevelCondition.value, 1);
    }
    // For score, it's more complex as we have multiple colors, 
    // but we can return the minimum progress among colors.
    return 0; // Handled specifically in UI if needed
  }
}
