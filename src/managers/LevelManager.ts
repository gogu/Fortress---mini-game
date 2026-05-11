import Phaser from "phaser";

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
}

export class LevelManager extends Phaser.Events.EventEmitter {
  private levels: ILevelConfig[] = [];
  private currentLevelIndex: number = -1;
  private timeInLevel: number = 0;
  private isCompleted: boolean = false;

  constructor() {
    super();
  }

  public init(data: { levels: ILevelConfig[] }) {
    this.levels = data.levels;
    this.currentLevelIndex = 0;
    this.timeInLevel = 0;
    this.isCompleted = false;
  }

  public start() {
    if (this.levels.length > 0) {
      this.currentLevelIndex = 0;
      this.emit("level_changed", this.getCurrentConfig());
    }
  }

  public update(delta: number, successCounts: number[]) {
    if (this.isCompleted || this.currentLevelIndex === -1) return;

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
      this.advanceLevel();
    }
  }

  public advanceLevel() {
    if (this.currentLevelIndex < this.levels.length - 1) {
      this.currentLevelIndex++;
      this.timeInLevel = 0;
      this.emit("level_changed", this.getCurrentConfig());
    } else {
      this.isCompleted = true;
      this.emit("game_completed");
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
