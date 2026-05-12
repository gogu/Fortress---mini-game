import Phaser from "phaser";
import { Bullet, Enemy, Friendly } from "../entities";
import { EntityManager } from "../managers/EntityManager";
import { WeaponManager } from "../managers/WeaponManager";
import { spawnParticles } from "../utils";

export class CollisionSystem {
  private scene: Phaser.Scene;
  private entityManager: EntityManager;
  private weaponManager: WeaponManager;

  constructor(scene: Phaser.Scene, entityManager: EntityManager, weaponManager: WeaponManager) {
    this.scene = scene;
    this.entityManager = entityManager;
    this.weaponManager = weaponManager;
    
    this.setupCollisions();
  }

  private setupCollisions() {
    const bullets = this.weaponManager.getBullets();
    const enemies = this.entityManager.getEnemies();
    const friendlies = this.entityManager.getFriendlies();

    // Bullet vs Enemy
    this.scene.physics.add.overlap(bullets, enemies, (b, e) => {
      this.handleBulletEnemyCollision(b as Bullet, e as Enemy);
    });

    // Friendly vs Enemy
    this.scene.physics.add.overlap(friendlies, enemies, (f, e) => {
      this.entityManager.handleFriendlyEnemyCollision(f as Friendly, e as Enemy);
    });

    // Enemy vs Building (Fortress/Barracks handled by GameScene or a specific BuildingManager, 
    // but for now we'll keep it simple and just use the overlaps from GameScene if preferred,
    // or pass buildings here).
  }

  private handleBulletEnemyCollision(bullet: Bullet, enemy: Enemy) {
    if (!bullet.active || !enemy.active) return;
    if (bullet.isPierce && bullet.hitTargets.has(enemy)) return;
    if (!bullet.isPierce && bullet.hasHit) return;

    if (bullet.col !== enemy.col && !bullet.isRage) {
      if (!bullet.hasHit) {
        this.scene.events.emit("requestComboUpdate", 0);
      }
      bullet.deactivate();
      spawnParticles(this.scene, bullet.x, bullet.y, 0x969696);
      return;
    }

    bullet.hasHit = true;
    bullet.hitTargets.add(enemy);
    enemy.hp -= bullet.dmg;

    if (!bullet.isPierce) {
      if (bullet.isBlast) this.createExplosion(bullet.x, bullet.y, bullet.col, bullet.dmg * 2);
      bullet.deactivate();
    }

    if (enemy.hp <= 0) {
      this.entityManager.killEnemy(enemy);
      this.scene.events.emit("spawnEnergyOrb", enemy.x, enemy.y, enemy.col);
    }
  }

  private createExplosion(x: number, y: number, color: number, dmg: number) {
    const circle = this.scene.add.circle(x, y, 50, color, 0.3);
    this.scene.physics.add.existing(circle);
    if (circle.body && 'setCircle' in circle.body) (circle.body as Phaser.Physics.Arcade.Body).setCircle(50);
    
    this.scene.physics.add.overlap(circle, this.entityManager.getEnemies(), (_, e) => {
      const target = e as Enemy;
      if (target.active && target.col === color) {
        target.hp -= dmg;
        if (target.hp <= 0) this.entityManager.killEnemy(target);
      }
    });
    this.scene.time.delayedCall(100, () => circle.destroy());
  }
}
