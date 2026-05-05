import kaboom from "kaboom";
import "./index.css";
import { MODES, SCREEN_WIDTH, SCREEN_HEIGHT, SQUAD_SIZE, LANES } from "./constants";
import { spawnParticles, getMultiplier, spawnMultiplier } from "./utils";
import { setupBulletPool, setupEnemyPool, setupFriendlyPool, spawnItem } from "./entities";

const canvas = document.getElementById("game") as HTMLCanvasElement;
canvas.oncontextmenu = (e) => e.preventDefault();

const k = kaboom({
  global: false,
  canvas: canvas,
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  scale: 1,
  background: [5, 5, 6],
});

// Load sounds
k.loadSound("change", "/src/sfx/change.wav");
k.loadSound("hitHurt", "/src/sfx/hitHurt.wav");
k.loadSound("laserShoot", "/src/sfx/laserShoot.wav");
k.loadSound("laserShootFailed", "/src/sfx/laserShootFailed.wav");
k.loadSound("playerHurt", "/src/sfx/playerHurt.wav");

k.scene("main", () => {
  // Configuration
  const modes = MODES(k);
  const lanes = LANES(k);
  
  // State
  let health = 100;
  let combo = 0;
  let gold = 0;
  let killSequence: any[] = [];
  let weaponMode = 0;
  let lastShotTime = 0;
  let lastHurtTime = 0;
  let controlMode: "fortress" | "barracks" = "fortress";
  let ratios = [1, 1, 1]; // Ratios for colors 0, 1, 2
  let successCounts = [0, 0, 0];
  let bombs = 0;
  let rageRemaining = 0;
  
  const bulletPool: any[] = [];
  const enemyPool: any[] = [];
  const friendlyPool: any[] = [];

  // Background
  k.add([
    k.rect(k.width(), k.height()),
    k.color(5, 5, 10),
    k.z(0),
  ]);

  // HUD & UI Elements
  const goldLabel = k.add([
    k.text("GOLD: 0", { size: 24 }),
    k.pos(k.width() / 2, 35),
    k.anchor("center"),
    k.color(255, 215, 0),
    k.scale(1),
    k.z(100),
  ]);

  const successLabel = k.add([
    k.text("PROGRESS: R 0/50 | G 0/50 | B 0/50", { size: 14 }),
    k.pos(k.width() / 2, 60),
    k.anchor("center"),
    k.color(200, 200, 200),
    k.scale(1),
    k.z(100),
  ]);

  const comboLabel = k.add([
    k.text("COMBO: 0", { size: 36 }),
    k.pos(k.width() / 2, 100),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.opacity(0),
    k.scale(1),
    k.z(100),
  ]);

  const bombLabel = k.add([
    k.text("BOMBS: 0/2", { size: 16 }),
    k.pos(k.width() - 20, 50),
    k.anchor("topright"),
    k.color(255, 100, 100),
    k.z(100),
  ]);

  const rageLabel = k.add([
    k.text("RAGE: 0s", { size: 16 }),
    k.pos(k.width() - 20, 75),
    k.anchor("topright"),
    k.color(255, 100, 255),
    k.opacity(0),
    k.z(100),
  ]);

  const sequenceSlots = [0, 1, 2].map((i) => {
    return k.add([
      k.rect(12, 12),
      k.pos(k.width() - 20 - (2 - i) * 18, 110),
      k.anchor("topright"),
      k.color(50, 50, 50),
      k.opacity(0.3),
      k.outline(1, k.rgb(100, 100, 100)),
      k.z(100),
    ]);
  });

  // Helpers
  function updateSequenceUI() {
    for (let i = 0; i < 3; i++) {
      const slot = sequenceSlots[i];
      if (killSequence[i]) {
        slot.color = killSequence[i];
        slot.opacity = 1;
      } else {
        slot.color = k.rgb(50, 50, 50);
        slot.opacity = 0.3;
      }
    }
  }

  function transitionSequenceFailure() {
    sequenceSlots.forEach((s, i) => {
      const baseX = k.width() - 20 - (2 - i) * 18;
      k.wait(i * 0.05, () => {
        k.tween(s.pos.x, baseX + 10, 0.05, (v) => s.pos.x = v, k.easings.easeInOutQuad)
          .then(() => k.tween(s.pos.x, baseX - 10, 0.05, (v) => s.pos.x = v, k.easings.easeInOutQuad))
          .then(() => s.pos.x = baseX);
      });
    });
  }

  function updateCombo(val: number) {
    if (val > 0) {
      combo += val;
      comboLabel.text = `COMBO: ${combo}`;
      comboLabel.opacity = 0.5;
      comboLabel.scale = k.vec2(1.1);
      k.wait(0.05, () => comboLabel.scale = k.vec2(1));
      if (combo > 0 && combo % 10 === 0) {
        updateGold(10);
      }
    } else {
      combo = 0;
      comboLabel.opacity = 0;
      killSequence = [];
      updateSequenceUI();
    }
  }

  function updateGold(val: number) {
    gold += val;
    goldLabel.text = `GOLD: ${gold}`;
    goldLabel.scale = k.vec2(1.2);
    k.wait(0.1, () => goldLabel.scale = k.vec2(1));
  }

  function updateSuccessProgress() {
    successLabel.text = `PROGRESS: R ${successCounts[0]}/50 | G ${successCounts[1]}/50 | B ${successCounts[2]}/50`;
    successLabel.scale = k.vec2(1.1);
    k.wait(0.1, () => successLabel.scale = k.vec2(1));
  }

  // Pools
  const getBullet = setupBulletPool(k, bulletPool, updateCombo);
  const spawnEnemy = setupEnemyPool(k, enemyPool);
  const spawnFriendly = setupFriendlyPool(k, friendlyPool, (col) => {
    const idx = modes.findIndex(m => m.color.r === col.r && m.color.g === col.g && m.color.b === col.b);
    if (idx !== -1) {
      successCounts[idx]++;
      updateSuccessProgress();
      if (successCounts.every(c => c >= 50)) {
        k.go("win", { score: combo });
      }
    }
  });

  // Buildings
  const fortress = k.add([
    k.rect(60, 60),
    k.pos(120, k.height() / 2),
    k.color(40, 40, 50),
    k.outline(4, k.rgb(100, 100, 150)),
    k.anchor("center"),
    k.area(),
    k.z(10),
    "fortress",
  ]);

  const barracks = k.add([
    k.rect(60, 60),
    k.pos(50, k.height() / 2 + 80),
    k.color(40, 40, 50),
    k.outline(4, k.rgb(100, 150, 100)),
    k.anchor("center"),
    k.area(),
    k.z(10),
    "barracks",
  ]);

  const fortressIndicator = fortress.add([
    k.rect(70, 70),
    k.color(255, 255, 255),
    k.opacity(0),
    k.anchor("center"),
    k.outline(2, k.WHITE),
  ]);

  const barracksIndicator = barracks.add([
    k.rect(70, 70),
    k.color(255, 255, 255),
    k.opacity(0),
    k.anchor("center"),
    k.outline(2, k.WHITE),
  ]);

  const ratioText = barracks.add([
    k.text("1 : 1 : 1", { size: 12 }),
    k.pos(0, -50),
    k.anchor("center"),
    k.color(200, 200, 200),
  ]);

  const core = fortress.add([
    k.rect(20, 20),
    k.color(modes[weaponMode].color),
    k.anchor("center"),
    k.opacity(1),
    k.pos(0, 0),
  ]);

  // Actions
  const switchMode = () => {
    weaponMode = (weaponMode + 1) % 3;
    k.play("change", { volume: 0.5 });
    k.shake(2);
    core.color = modes[weaponMode].color;
    k.add([
      k.text(modes[weaponMode].name, { size: 24 }),
      k.pos(fortress.pos.add(0, -60)),
      k.anchor("center"),
      k.color(modes[weaponMode].color),
      k.move(k.UP, 100),
      k.opacity(1),
      k.lifespan(0.5),
    ]);
  };

  function shoot(playFailSound = false, overrideDir?: any) {
    const mode = modes[weaponMode];
    const now = k.time();
    const isRage = rageRemaining > 0;

    if (!isRage && now - lastShotTime < mode.cd) {
      if (playFailSound) k.play("laserShootFailed", { volume: 0.3 });
      return;
    }
    
    // Rage mode firing rate
    const actualCd = isRage ? 0.1 : mode.cd;
    if (now - lastShotTime < actualCd) return;

    lastShotTime = now;

    k.play("laserShoot", { volume: 0.4 });
    if (!isRage) k.shake(2);

    const mousePos = k.mousePos();
    const dir = overrideDir || mousePos.sub(fortress.pos).unit();
    const ang = Math.atan2(dir.y, dir.x) * (180 / Math.PI);
    
    const sprayCount = isRage ? 3 : 1;
    for (let i = 0; i < sprayCount; i++) {
        const b = getBullet();
        b.active = true;
        b.hidden = false;
        b.paused = false;
        b.pos = fortress.pos;
        
        let finalDir = dir;
        if (isRage && sprayCount > 1) {
            const spread = 0.2;
            const offset = (i - 1) * spread;
            finalDir = dir.add(dir.y * offset, -dir.x * offset).unit();
        }
        
        b.angle = Math.atan2(finalDir.y, finalDir.x) * (180 / Math.PI);
        b.moveDir = finalDir;
        b.color = isRage ? k.rgb(k.rand(200, 255), k.rand(100, 255), k.rand(200, 255)) : mode.color;
        b.dmg = isRage ? 2 : mode.dmg;
        b.hasHit = false;
        b.isBlast = (weaponMode === 1) || isRage;
        b.isPierce = (weaponMode === 2) || isRage;
        b.isRage = isRage;
    }
  }

  // Production counters
  let totalProduced = 0;
  let producedCounts = [0, 0, 0];

  function getNextColorIndex() {
    const totalRatio = ratios.reduce((a, b) => a + b, 0);
    if (totalRatio === 0) return 0;

    // Pick the index that is furthest behind its target ratio
    let bestIndex = 0;
    let maxGap = -Infinity;

    for (let i = 0; i < 3; i++) {
      const targetCount = (totalProduced + 1) * (ratios[i] / totalRatio);
      const gap = targetCount - producedCounts[i];
      if (gap > maxGap) {
        maxGap = gap;
        bestIndex = i;
      }
    }

    producedCounts[bestIndex]++;
    totalProduced++;
    return bestIndex;
  }

  // Input
  k.onKeyPress("tab", () => {
    controlMode = controlMode === "fortress" ? "barracks" : "fortress";
    k.play("change", { volume: 0.3 });
  });

  // Increase Ratios
  k.onKeyPress("1", () => {
    if (controlMode === "barracks") ratios[0] = Math.min(ratios[0] + 1, 9);
  });
  k.onKeyPress("2", () => {
    if (controlMode === "barracks") ratios[1] = Math.min(ratios[1] + 1, 9);
  });
  k.onKeyPress("3", () => {
    if (controlMode === "barracks") ratios[2] = Math.min(ratios[2] + 1, 9);
  });

  // Decrease Ratios
  k.onKeyPress("q", () => {
    if (controlMode === "barracks") ratios[0] = Math.max(ratios[0] - 1, 0);
  });
  k.onKeyPress("w", () => {
    if (controlMode === "barracks") ratios[1] = Math.max(ratios[1] - 1, 0);
  });
  k.onKeyPress("e", () => {
    if (controlMode === "barracks") ratios[2] = Math.max(ratios[2] - 1, 0);
  });

  k.onKeyPress("r", () => {
    if (bombs > 0) {
      bombs--;
      k.play("laserShoot", { volume: 1, detune: -500 });
      k.shake(20);
      k.get("enemy").forEach((e: any) => {
        if (e.active) {
          e.hp = 0;
          k.play("hitHurt", { volume: 0.2 });
          spawnParticles(k, e.pos, e.color);
          const mult = getMultiplier(k, e.pos);
          e.active = false;
          e.hidden = true;
          e.paused = true;
          updateCombo(1);
          updateGold(mult);
          spawnMultiplier(k, e.pos, mult);
        }
      });
      // Flash screen
      const flash = k.add([
        k.rect(k.width(), k.height()),
        k.color(255, 255, 255),
        k.opacity(1),
        k.z(1000)
      ]);
      flash.onUpdate(() => {
        flash.opacity -= k.dt() * 5;
        if (flash.opacity <= 0) k.destroy(flash);
      });
    }
  });

  k.onKeyPress("space", () => {
    if (controlMode === "fortress") switchMode();
  });
  k.onMousePress("right", () => {
    if (controlMode === "fortress") switchMode();
  });
  k.onMousePress("left", () => {
    if (controlMode === "fortress") shoot(true);
  });

  // Production Logic
  let squadCounter = 0;
  k.loop(3, () => {
    if (gold >= SQUAD_SIZE) {
      const totalRatio = ratios.reduce((a, b) => a + b, 0);
      if (totalRatio === 0) return;

      updateGold(-SQUAD_SIZE);
      
      const squadId = `f_squad_${squadCounter++}`;
      const laneIdx = k.choose([0, 1, 2, 3, 4]);
      const spawnPos = k.vec2(0, lanes[laneIdx]);

      for (let i = 0; i < SQUAD_SIZE; i++) {
        const colorIndex = getNextColorIndex();
        k.wait(i * 0.15, () => {
           spawnFriendly(spawnPos, modes[colorIndex].color, squadId, laneIdx);
        });
      }
    }
  });

  // Main Loop Spawners
  let enemySquadCounter = 0;
  k.loop(3, () => {
    const colorIndex = k.choose([0, 1, 2]);
    const squadId = `e_squad_${enemySquadCounter++}`;
    const laneIdx = k.choose([0, 1, 2, 3, 4]);
    const spawnPos = k.vec2(k.width() + 50, lanes[laneIdx]);

    for (let i = 0; i < SQUAD_SIZE; i++) {
      k.wait(i * 0.15, () => {
        spawnEnemy(modes[colorIndex].color, 150, squadId, laneIdx, spawnPos, false);
      });
    }
  });

  // Individual Elite Spawn Logic (~10% chance relative to squads)
  k.loop(10, () => {
    if (k.chance(0.33)) {
      const colorIndex = k.choose([0, 1, 2]);
      const squadId = `elite_${enemySquadCounter++}`;
      const laneIdx = k.choose([0, 1, 2, 3, 4]);
      const spawnPos = k.vec2(k.width() + 50, lanes[laneIdx]);
      spawnEnemy(modes[colorIndex].color, 160, squadId, laneIdx, spawnPos, true);
    }
  });

  // Collisions
  k.onCollide("friendly", "enemy", (f, e) => {
    if (!f.active || !e.active) return;
    
    // Elite vs Friendly special case: 0.1s stalemate, elite kills friendly without taking damage
    if (e.isElite) {
      if (f.isStalemated || e.isStalemated) return;
      f.isStalemated = true;
      e.isStalemated = true;
      f.stalemateTarget = e;
      e.stalemateTarget = f;
      
      k.wait(0.1, () => {
        if (f.active && e.active && f.stalemateTarget === e) {
          f.active = false;
          f.hidden = true;
          f.paused = true;
          f.isStalemated = false;
          f.stalemateTarget = null;
          
          e.isStalemated = false;
          e.stalemateTarget = null;
        } else {
          if (f.active) { f.isStalemated = false; f.stalemateTarget = null; }
          if (e.active) { e.isStalemated = false; e.stalemateTarget = null; }
        }
      });
      return;
    }

    // Squad-wide Stalemate logic for normal enemies
    const fSquad = k.get("friendly").filter((u: any) => u.active && u.squadId === f.squadId);
    const eSquad = k.get("enemy").filter((u: any) => u.active && u.squadId === e.squadId);

    // If already in a stalemate handled by another pair in the squad, just link them
    if (f.isStalemated || e.isStalemated) {
      if (f.isStalemated && !e.isStalemated) {
         e.isStalemated = true;
         e.stalemateTarget = f;
      }
      return;
    }

    // Calculate duration based on numerical difference
    // Time = 2s / (1 + diff). 0 diff = 2s, 1 diff = 1s, 2 diff = 0.66s
    const diff = Math.abs(fSquad.length - eSquad.length);
    const duration = 2 / (1 + diff);

    // Set entire squads to stalemate
    fSquad.forEach((u: any) => {
      u.isStalemated = true;
      if (u === f) u.stalemateTarget = e;
    });
    eSquad.forEach((u: any) => {
      u.isStalemated = true;
      if (u === e) u.stalemateTarget = f;
    });

    k.wait(duration, () => {
      // Resolution for the specific colliding pair
      if (f.active && e.active && f.stalemateTarget === e) {
        if (f.col.r === e.col.r && f.col.g === e.col.g && f.col.b === e.col.b) {
          e.hp -= 1;
          f.active = false;
          f.hidden = true;
          f.paused = true;
          
          if (e.hp <= 0) {
            k.play("hitHurt", { volume: 0.4 });
            spawnParticles(k, e.pos, e.color);
            const mult = getMultiplier(k, e.pos);
            e.active = false;
            e.hidden = true;
            e.paused = true;
            updateCombo(1);
            updateGold(mult);
            spawnMultiplier(k, e.pos, mult);
          } else {
            e.isStalemated = false;
            e.stalemateTarget = null;
          }
          f.stalemateTarget = null;
        } else {
          f.isStalemated = false;
          f.stalemateTarget = null;
          e.isStalemated = false;
          e.stalemateTarget = null;
        }
      }

      // Ensure squad members who didn't have a specific target also resume if they were stuck
      fSquad.forEach((u: any) => {
        if (u.active && u.isStalemated && (!u.stalemateTarget || !u.stalemateTarget.active)) {
          u.isStalemated = false;
          u.stalemateTarget = null;
        }
      });
      eSquad.forEach((u: any) => {
        if (u.active && u.isStalemated && (!u.stalemateTarget || !u.stalemateTarget.active)) {
          u.isStalemated = false;
          u.stalemateTarget = null;
        }
      });
    });
  });

  k.onCollide("bullet", "enemy", (b, e) => {
    if (!b.active || !e.active) return;

    const isMismatch = (b.color.r !== e.col.r || b.color.g !== e.col.g || b.color.b !== e.col.b);
    if (isMismatch && !b.isRage) {
      b.active = false;
      b.hidden = true;
      b.paused = true;
      updateCombo(0);
      spawnParticles(k, b.pos, k.rgb(150, 150, 150));
      return;
    }

    b.hasHit = true;
    e.hp -= b.dmg;

    if (!b.isPierce) {
      if (b.isBlast) {
         k.add([
           k.circle(50),
           k.pos(b.pos),
           k.color(b.color),
           k.opacity(0.3),
           k.lifespan(0.1),
           k.area(),
           "explosion",
           { dmg: b.dmg * 2, col: b.color }
         ]);
      }
      b.active = false;
      b.hidden = true;
      b.paused = true;
    }

    if (e.hp <= 0) {
      k.play("hitHurt", { volume: 0.4 });
      spawnParticles(k, e.pos, e.color);
      const mult = getMultiplier(k, e.pos);
      e.active = false;
      e.hidden = true;
      e.paused = true;
      updateCombo(1);
      updateGold(mult);
      spawnMultiplier(k, e.pos, mult);
      
      if (e.isElite) {
          const itemType = k.choose(["bomb", "health", "rage"]);
          spawnItem(k, e.pos, itemType as any, fortress.pos, () => {
            k.play("hitHurt", { volume: 0.6, detune: 500 });
            if (itemType === "bomb") {
                bombs = Math.min(bombs + 1, 2);
            } else if (itemType === "health") {
                health = 100;
            } else if (itemType === "rage") {
                rageRemaining = 6;
            }
          });
      }

      lastShotTime = k.time() - (modes[weaponMode].cd - 0.1);
      killSequence.push(e.color);
      updateSequenceUI();
      
      if (killSequence.length >= 3) {
        transitionSequenceFailure();
        killSequence = [];
        k.wait(0.5, updateSequenceUI);
      }
    }
  });

  k.onCollide("explosion", "enemy", (ex, e) => {
    if (!e.active || ex.col.r !== e.col.r) return;
    e.hp -= ex.dmg;
    if (e.hp <= 0) {
      k.play("hitHurt", { volume: 0.3 });
      spawnParticles(k, e.pos, e.color);
      const mult = getMultiplier(k, e.pos);
      e.active = false;
      e.hidden = true;
      e.paused = true;
      updateCombo(1);
      updateGold(mult);
      spawnMultiplier(k, e.pos, mult);
    }
  });


  k.onCollide("enemy", "fortress", (e) => {
    if (!e.active) return;
    e.active = false;
    e.hidden = true;
    e.paused = true;
    health -= 10;
    updateCombo(0);
    k.shake(8);
    const now = k.time();
    if (now - lastHurtTime > 0.2) {
      k.play("playerHurt", { volume: 0.7 });
      lastHurtTime = now;
    }
    if (health <= 0) k.go("gameover", { score: combo });
  });

  // Rendering & HUD
  k.onDraw(() => {
    // Draw lanes
    lanes.forEach(y => {
      k.drawLine({
        p1: k.vec2(0, y),
        p2: k.vec2(k.width(), y),
        color: k.WHITE,
        opacity: 0.1,
        width: 1,
      });
    });

    const dist = Math.min(fortress.pos.dist(k.mousePos()), k.width() * 0.8);
    const dir = k.mousePos().sub(fortress.pos).unit();
    for (let i = 40; i < dist; i += 40) {
      k.drawCircle({ pos: fortress.pos.add(dir.scale(i)), radius: 1.5, color: modes[weaponMode].color, opacity: 0.15 });
    }
  });

  const healthFill = k.add([k.rect(200, 20), k.pos(20, 20), k.color(255, 0, 0), k.z(101)]);
  k.add([k.rect(200, 20), k.pos(20, 20), k.color(0, 0, 0), k.outline(2, k.WHITE), k.z(100)]);

  const fpsLabel = k.add([
    k.text("FPS: 0", { size: 14 }),
    k.pos(k.width() - 20, 20),
    k.anchor("topright"),
    k.color(0, 255, 0),
    k.z(200),
  ]);

  k.onUpdate(() => {
    healthFill.width = (health / 100) * 200;
    core.opacity = 0.5 + k.wave(0, 0.5, k.time() * 5);
    fpsLabel.text = `FPS: ${k.debug.fps()}`;

    // Indicators
    fortressIndicator.opacity = controlMode === "fortress" ? 0.3 : 0;
    barracksIndicator.opacity = controlMode === "barracks" ? 0.3 : 0;
    
    // Ratios display
    ratioText.text = `${ratios[0]} : ${ratios[1]} : ${ratios[2]}`;

    // Item HUD update
    if (rageRemaining > 0) {
      rageRemaining -= k.dt();
      rageLabel.opacity = 1;
      rageLabel.text = `RAGE: ${rageRemaining.toFixed(1)}s`;
      if (rageRemaining <= 0) {
        rageRemaining = 0;
        rageLabel.opacity = 0;
      }
    }
    bombLabel.text = `BOMBS: ${bombs}/2`;
  });
});

k.scene("gameover", ({ score }) => {
  k.add([k.text("DEFENSE BREACHED", { size: 48 }), k.pos(k.center()), k.anchor("center")]);
  k.add([k.text(`BEST COMBO: ${score}`, { size: 24 }), k.pos(k.width()/2, k.height()/2 + 60), k.anchor("center")]);
  k.onKeyPress("space", () => k.go("main"));
  k.onMousePress(() => k.go("main"));
});

k.scene("win", ({ score }) => {
  k.add([k.text("VICTORY", { size: 64 }), k.pos(k.center()), k.anchor("center"), k.color(255, 215, 0)]);
  k.add([k.text("Baseline Secured | Each class reached 50", { size: 20 }), k.pos(k.width()/2, k.height()/2 + 60), k.anchor("center")]);
  k.add([k.text(`FINAL COMBO: ${score}`, { size: 24 }), k.pos(k.width()/2, k.height()/2 + 100), k.anchor("center")]);
  k.add([k.text("Press Space to Restart", { size: 16 }), k.pos(k.width()/2, k.height() - 50), k.anchor("center")]);
  k.onKeyPress("space", () => k.go("main"));
});

k.go("main");
