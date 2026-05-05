import { BULLET_SPEED, ENEMY_SPEED, FRIENDLY_SPEED, LANES } from "./constants";

// Cache for shared squad targeting to avoid redundant searches per frame
const squadTargetCache: Record<string, { frame: number, target: any }> = {};

export function setupFriendlyPool(k: any, pool: any[], onSuccess: (color: any) => void) {
  const lanes = LANES(k);
  return (pos: any, color: any, squadId: string, laneIndex: number) => {
    let f = pool.find((item) => !item.active);
    if (!f) {
      f = k.add([
        k.circle(15),
        k.pos(pos),
        k.color(color),
        k.outline(2, k.rgb(255, 255, 255)),
        k.anchor("center"),
        k.area(),
        "friendly",
        {
          active: true,
          col: color,
          squadId: squadId,
          isStalemated: false,
          stalemateTarget: null,
          hasScored: false,
          laneIndex: laneIndex,
        },
      ]);
      f.onUpdate(() => {
        if (!f.active) return;

        // Scoring: Cross the right edge
        if (!f.hasScored && f.pos.x > k.width()) {
          f.hasScored = true;
          onSuccess(f.col);
        }

        // Instant Resume Logic: If target is destroyed, resume movement
        if (f.isStalemated) {
          if (f.stalemateTarget && !f.stalemateTarget.active) {
            f.isStalemated = false;
            f.stalemateTarget = null;
          }
          return;
        }

        const currentFrame = k.time();
        const visionRadius = k.width() * 0.25;
        
        let target = null;

        if (squadTargetCache[f.squadId] && squadTargetCache[f.squadId].frame === currentFrame) {
          target = squadTargetCache[f.squadId].target;
          if (target && !target.active) target = null;
        } else {
          const enemies = k.get("enemy").filter((e: any) => 
            e.active && 
            Math.abs(e.laneIndex - f.laneIndex) <= 1 &&
            f.pos.dist(e.pos) < visionRadius &&
            e.pos.x >= f.pos.x
          );

          let minDist = Infinity;
          for (const e of enemies) {
            const d = f.pos.dist(e.pos);
            if (d < minDist) {
              minDist = d;
              target = e;
            }
          }
          squadTargetCache[f.squadId] = { frame: currentFrame, target: target };
        }

        if (target) {
          const dir = target.pos.sub(f.pos).unit();
          let moveVec = dir.scale(FRIENDLY_SPEED);
          f.move(moveVec);
        } else {
          // Steering back to lane center
          const targetY = lanes[f.laneIndex];
          const diffY = targetY - f.pos.y;
          const steerY = k.clamp(diffY * 2, -FRIENDLY_SPEED * 0.5, FRIENDLY_SPEED * 0.5);
          f.move(FRIENDLY_SPEED, steerY);
        }

        if (f.pos.x > k.width() + 100 || f.pos.x < -100 || f.pos.y > k.height() + 100 || f.pos.y < -100) {
          f.active = false;
          f.hidden = true;
          f.paused = true;
        }
      });
      pool.push(f);
    } else {
      f.active = true;
      f.hidden = false;
      f.paused = false;
      f.pos = k.vec2(pos);
      f.color = color;
      f.col = color;
      f.squadId = squadId;
      f.isStalemated = false;
      f.stalemateTarget = null;
      f.hasScored = false;
      f.laneIndex = laneIndex;
    }
    return f;
  };
}

export function setupBulletPool(k: any, bulletPool: any[], updateCombo: Function) {
  return function getBullet() {
    let b = bulletPool.find(p => !p.active);
    if (!b) {
      b = k.add([
        k.rect(24, 6),
        k.pos(0, 0),
        k.rotate(0),
        k.color(255, 255, 255),
        k.area(),
        "bullet",
        { active: false, dmg: 1, moveDir: k.vec2(0), hasHit: false, isBlast: false, isPierce: false, isRage: false }
      ]);
      b.onUpdate(() => {
        if (!b.active) return;
        b.move(b.moveDir.x * BULLET_SPEED, b.moveDir.y * BULLET_SPEED);
        if (b.pos.x < 0 || b.pos.x > k.width() || b.pos.y < 0 || b.pos.y > k.height()) {
          b.active = false;
          b.hidden = true;
          b.paused = true;
          if (!b.hasHit && !b.isRage) updateCombo(0);
        }
      });
      bulletPool.push(b);
    }
    return b;
  };
}

export function setupEnemyPool(k: any, enemyPool: any[]) {
  const eliteColors = [
    k.rgb(0, 242, 255),
    k.rgb(255, 140, 0),
    k.rgb(160, 32, 240)
  ];

  const getEnemy = () => {
    let e = enemyPool.find(p => !p.active);
    if (!e) {
      e = k.add([
        k.pos(0, 0),
        k.color(255, 255, 255),
        k.anchor("center"),
        k.scale(1),
        k.area({ shape: new k.Rect(k.vec2(-15, -15), 30, 30) }),
        k.z(20),
        "enemy",
        { 
          active: false, 
          hp: 1, 
          maxHp: 1, 
          speed: ENEMY_SPEED, 
          col: k.WHITE, 
          squadId: "", 
          isStalemated: false, 
          stalemateTarget: null, 
          isElite: false,
          eliteTimer: 0,
          eliteColorIdx: 0,
          laneIndex: 0,
        },
        {
          id: "enemy_draw",
          draw() {
            if (this.isElite) {
              k.drawPolygon({
                pts: [k.vec2(0, -18), k.vec2(18, 18), k.vec2(-18, 18)],
                color: this.color,
                outline: { width: 2, color: k.WHITE },
              });
            } else {
              k.drawRect({
                width: 30,
                height: 30,
                color: this.color,
                outline: { width: 2, color: k.WHITE },
                anchor: "center",
              });
            }
          }
        }
      ]);
      e.onUpdate(() => {
        if (!e.active) return;

        if (e.isElite) {
          e.eliteTimer += k.dt();
          if (e.eliteTimer >= 3) {
            e.eliteTimer = 0;
            e.eliteColorIdx = (e.eliteColorIdx + 1) % 3;
            const newCol = eliteColors[e.eliteColorIdx];
            e.color = newCol;
            e.col = newCol;
          }
        }

        // Instant Resume Logic: If target is destroyed, resume movement
        if (e.isStalemated) {
          if (e.stalemateTarget && !e.stalemateTarget.active) {
            e.isStalemated = false;
            e.stalemateTarget = null;
          }
          return;
        }

        e.move(-e.speed, 0);

        if (e.pos.x < -100 || e.pos.x > k.width() + 100) {
          e.active = false;
          e.hidden = true;
          e.paused = true;
        }
      });
      enemyPool.push(e);
    }
    return e;
  };

  return function spawnEnemy(targetColor: any, speed: number, squadId: string, laneIndex: number, pos?: any, isElite: boolean = false) {
    const e = getEnemy();
    e.active = true;
    e.hidden = false;
    e.paused = false;
    e.pos = pos ? k.vec2(pos) : k.vec2(k.width() + 50, k.rand(100, k.height() - 100));
    
    e.color = targetColor;
    e.speed = speed;
    e.hp = 1;
    e.maxHp = 1;
    e.col = targetColor;
    e.squadId = squadId;
    e.isStalemated = false;
    e.stalemateTarget = null;
    e.isElite = isElite;
    e.eliteTimer = 0;
    e.eliteColorIdx = 0;
    e.laneIndex = laneIndex;
    
    e.outline = { width: 2, color: k.WHITE };
  };
}

export function spawnItem(k: any, pos: any, type: "bomb" | "health" | "rage", targetPos: any, onCollect: () => void) {
  const colors = {
    bomb: k.rgb(255, 50, 50),
    health: k.rgb(50, 255, 50),
    rage: k.rgb(255, 100, 255)
  };

  const texts = {
    bomb: "BOMB",
    health: "HEAL",
    rage: "RAGE"
  };

  const item = k.add([
    k.rect(40, 40),
    k.pos(pos),
    k.color(colors[type]),
    k.outline(3, k.WHITE),
    k.anchor("center"),
    k.area(),
    k.z(50),
    "item",
    { type: type, originalY: pos.y, spawnTime: k.time(), collected: false }
  ]);

  item.add([
    k.text(texts[type], { size: 12 }),
    k.anchor("center"),
    k.color(0, 0, 0),
  ]);

  item.onUpdate(() => {
    if (item.collected) return;

    const age = k.time() - item.spawnTime;
    
    if (age < 0.5) {
      // Initial drift
      item.move(-40, Math.sin(age * 10) * 20);
    } else {
      // Absorb towards target
      const dir = targetPos.sub(item.pos).unit();
      const dist = targetPos.dist(item.pos);
      
      // Accelerate as it gets closer
      const speed = k.map(dist, 0, k.width(), 800, 200);
      item.move(dir.scale(speed));

      if (dist < 20) {
        item.collected = true;
        onCollect();
        k.destroy(item);
      }
    }

    if (item.pos.x < -100) k.destroy(item);
  });
}
