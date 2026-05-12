import Phaser from "phaser";
import { MODES } from "../constants";

export class PlayerController {
  private scene: Phaser.Scene;
  
  // --- Weapon State ---
  private weaponMode: number = 0;
  private lastShotTime: number = 0;
  
  // --- Cheat State ---
  private cheatBuffer: string = "";
  private lastCheatKeyTime: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupInput();

    // Cleanup on scene shutdown
    this.scene.events.once("shutdown", () => {
      this.cleanup();
    });
  }

  private setupInput() {
    this.scene.input.on("pointerdown", this.handlePointerDown, this);
    
    // Prevent context menu on right click
    if (this.scene.game.canvas) {
      this.scene.game.canvas.oncontextmenu = (e) => e.preventDefault();
    }

    this.scene.input.keyboard?.on("keydown-SPACE", this.switchMode, this);
    this.scene.input.keyboard?.on("keydown-R", this.handleBombRequest, this);
    
    // Generic Cheat Listener
    this.scene.input.keyboard?.on("keydown", this.handleKeyDown, this);
  }

  private cleanup() {
    this.scene.input.off("pointerdown", this.handlePointerDown, this);
    this.scene.input.keyboard?.off("keydown-SPACE", this.switchMode, this);
    this.scene.input.keyboard?.off("keydown-R", this.handleBombRequest, this);
    this.scene.input.keyboard?.off("keydown", this.handleKeyDown, this);
    
    if (this.scene.game.canvas) {
      this.scene.game.canvas.oncontextmenu = null;
    }
  }

  private handleKeyDown(event: KeyboardEvent) {
    const key = event.key.toUpperCase();
    const now = this.scene.time.now;

    // Clear buffer if too much time has passed
    if (now - this.lastCheatKeyTime > 2000) {
      this.cheatBuffer = "";
    }
    this.lastCheatKeyTime = now;

    // Use event.key directly to avoid "keydown-P" overhead
    if (/^[A-Z0-9]$/.test(key)) {
      this.cheatBuffer += key;
      if (this.cheatBuffer.length > 10) this.cheatBuffer = this.cheatBuffer.substring(1);
      this.checkCheats();
    }
  }

  private checkCheats() {
    // 1. P{n}P - Jump to Level
    const jumpMatch = this.cheatBuffer.match(/P(\d+)P$/);
    if (jumpMatch) {
      const levelId = parseInt(jumpMatch[1]);
      this.scene.events.emit("cheat_jumpToLevel", levelId);
      this.cheatBuffer = "";
      return;
    }

    // 2. EEE - Spawn Elite
    if (this.cheatBuffer.endsWith("EEE")) {
      this.scene.events.emit("cheat_spawnElite");
      this.cheatBuffer = "";
      return;
    }

    // 3. GGG - Add Gold
    if (this.cheatBuffer.endsWith("GGG")) {
      this.scene.events.emit("cheat_addGold", 100);
      this.cheatBuffer = "";
      return;
    }

    // 4. PPP - Skip Level (Legacy)
    if (this.cheatBuffer.endsWith("PPP")) {
      this.scene.events.emit("cheat_skipLevel");
      this.cheatBuffer = "";
      return;
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (pointer.leftButtonDown()) {
      this.emitShoot(true);
    } else if (pointer.rightButtonDown()) {
      this.switchMode();
    }
  }

  private handleBombRequest() {
    this.scene.events.emit("requestBomb");
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
