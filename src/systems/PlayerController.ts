import Phaser from "phaser";
import { MODES } from "../constants";

export class PlayerController {
  private scene: Phaser.Scene;
  
  // --- Weapon State ---
  private weaponMode: number = 0;
  private lastShotTime: number = 0;
  
  // --- Cheat State ---
  private eKeyCount: number = 0;
  private eKeyLastTime: number = 0;
  private pKeyCount: number = 0;
  private pKeyLastTime: number = 0;
  private gKeyCount: number = 0;
  private gKeyLastTime: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupInput();
  }

  private setupInput() {
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.emitShoot(true);
      } else if (pointer.rightButtonDown()) {
        this.switchMode();
      }
    });
    
    // Prevent context menu on right click
    if (this.scene.game.canvas) {
      this.scene.game.canvas.oncontextmenu = (e) => e.preventDefault();
    }

    this.scene.input.keyboard?.on("keydown-SPACE", () => this.switchMode());
    this.scene.input.keyboard?.on("keydown-R", () => {
      this.scene.events.emit("requestBomb");
    });
    
    // Cheat Code: Spawn Elite (E x 3)
    this.scene.input.keyboard?.on("keydown-E", () => {
      const now = this.scene.time.now;
      if (now - this.eKeyLastTime > 500) {
        this.eKeyCount = 1;
      } else {
        this.eKeyCount++;
      }
      this.eKeyLastTime = now;
      
      if (this.eKeyCount >= 3) {
        this.scene.events.emit("cheat_spawnElite");
        this.eKeyCount = 0;
      }
    });

    // Cheat Code: Skip Level (P x 3)
    this.scene.input.keyboard?.on("keydown-P", () => {
      const now = this.scene.time.now;
      if (now - this.pKeyLastTime > 500) {
        this.pKeyCount = 1;
      } else {
        this.pKeyCount++;
      }
      this.pKeyLastTime = now;
      
      if (this.pKeyCount >= 3) {
        this.scene.events.emit("cheat_skipLevel");
        this.pKeyCount = 0;
      }
    });

    // Cheat Code: Add Gold (G x 3)
    this.scene.input.keyboard?.on("keydown-G", () => {
      const now = this.scene.time.now;
      if (now - this.gKeyLastTime > 500) {
        this.gKeyCount = 1;
      } else {
        this.gKeyCount++;
      }
      this.gKeyLastTime = now;
      
      if (this.gKeyCount >= 3) {
        this.scene.events.emit("cheat_addGold", 100);
        this.gKeyCount = 0;
      }
    });
  }

  private switchMode() {
    this.weaponMode = (this.weaponMode + 1) % MODES.length;
    this.scene.events.emit("weaponModeChanged", this.weaponMode);
  }

  private emitShoot(playFailSound: boolean = false) {
    this.scene.events.emit("requestShoot", playFailSound);
  }

  public getWeaponMode(): number {
    return this.weaponMode;
  }

  public getLastShotTime(): number {
    return this.lastShotTime;
  }

  public setLastShotTime(time: number) {
    this.lastShotTime = time;
  }

  public update(time: number, delta: number) {
    // Continuous shooting logic could move here if needed, 
    // but for now it's handled by GameScene's handleRageMode.
  }
}
