import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

let html = '';
try {
  html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
} catch {
  assert.fail('index.html must exist before the game core can be tested');
}
const source = html.match(/TESTABLE_CORE_START([\s\S]*?)TESTABLE_CORE_END/);
assert.ok(source, 'index.html must expose a testable core block');
const context = { console };
vm.runInNewContext(`${source[1]}\nthis.GameCore = GameCore;`, context);
const core = context.GameCore;

test('overlap only returns true for intersecting rectangles', () => {
  assert.equal(core.rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 2, h: 2 }), true);
  assert.equal(core.rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 2, h: 2 }), false);
});

test('player lands on a solid and becomes grounded', () => {
  const player = core.createPlayer(20, 0);
  const solids = [{ x: 0, y: 100, w: 200, h: 24 }];
  for (let frame = 0; frame < 120 && !player.grounded; frame += 1) {
    core.stepPlayer(player, { left: false, right: false }, solids, 1 / 60);
  }
  assert.equal(player.y, 64);
  assert.equal(player.grounded, true);
});

test('player jumps from the ground once and cannot jump in midair', () => {
  const player = core.createPlayer(20, 64);
  player.grounded = true;
  assert.equal(core.startJump(player), true);
  assert.ok(Math.abs(player.vy + 14) < 0.001);
  core.stepPlayer(player, { left: false, right: false }, [], 1 / 60);
  assert.equal(player.grounded, false);
  assert.ok(player.vy < 0);
  player.grounded = false;
  assert.equal(core.startJump(player), false);
});

test('keyboard and touch jump requests use the same direct jump behavior', () => {
  const keyboardPlayer = core.createPlayer(20, 64);
  const touchPlayer = core.createPlayer(20, 64);
  keyboardPlayer.grounded = true;
  touchPlayer.grounded = true;
  assert.equal(core.startJump(keyboardPlayer), true);
  assert.equal(core.startJump(touchPlayer), true);
  assert.equal(keyboardPlayer.vy, touchPlayer.vy);
});

test('crouching player can jump without standing up first', () => {
  const player = core.createPlayer(20, 64);
  player.grounded = true;
  core.stepPlayer(player, { left: false, right: false, down: true }, [{ x: 0, y: 100, w: 200, h: 24 }], 1 / 60);
  assert.equal(player.crouching, true);
  assert.equal(core.startJump(player), true);
  assert.equal(player.crouching, true);
  assert.equal(player.h, 18);
  assert.ok(player.vy < 0);
});

test('player can crouch in midair to shrink the hitbox', () => {
  const player = core.createPlayer(20, 64);
  player.grounded = false;
  core.stepPlayer(player, { left: false, right: false, down: true }, [], 0);
  assert.equal(player.crouching, true);
  assert.equal(player.h, 18);
  assert.equal(player.y, 82);
});

test('high stamina with run intent boosts jump height and costs extra stamina', () => {
  const player = core.createPlayer(20, 64);
  player.grounded = true;
  const profile = core.getPlayerMovementProfile(player, { left: false, right: true, run: true });
  assert.equal(profile.mode, 'run');
  assert.equal(core.startJump(player, profile.jumpHeightMultiplier), true);
  assert.ok(Math.abs(player.vy + 14 * Math.sqrt(1.2)) < 0.001);
  assert.equal(player.stamina, 99);
});

test('non-weak stamina above 20 can also enter run mode', () => {
  const player = core.createPlayer(20, 64);
  player.stamina = 45;
  const profile = core.getPlayerMovementProfile(player, { left: false, right: true, run: true });
  assert.equal(profile.mode, 'run');
  assert.equal(profile.speedMultiplier, 1.2);
  assert.equal(profile.jumpHeightMultiplier, 1.2);
});

test('random question rewards always assign one red, one green and one yellow mushroom', () => {
  const blocks = [
    { kind: 'question', reward: 'coin' },
    { kind: 'question', reward: 'coin' },
    { kind: 'question', reward: 'coin' },
    { kind: 'question', reward: 'coin' }
  ];
  core.assignRandomQuestionRewards(blocks, () => 0.3);
  const rewards = blocks.map((block) => block.reward);
  assert.equal(rewards.includes('red-mushroom'), true);
  assert.equal(rewards.includes('green-mushroom'), true);
  assert.equal(rewards.includes('yellow-mushroom'), true);
});

test('yellow mushroom boosts current movement and jump multipliers by 1.5 for 10 seconds', () => {
  const player = core.createPlayer(20, 64);
  player.stamina = 5;
  const effect = core.applyPowerupEffect(player, 'yellow-mushroom');
  const runProfile = core.getPlayerMovementProfile(player, { left: false, right: true, run: true });
  const normalProfile = core.getPlayerMovementProfile(player, { left: false, right: true, run: false });
  assert.equal(effect.damage, false);
  assert.equal(player.speedBoostTimer, 10);
  assert.equal(runProfile.mode, 'run');
  assert.ok(Math.abs(runProfile.speedMultiplier - 1.8) < 0.001);
  assert.ok(Math.abs(runProfile.jumpHeightMultiplier - 1.8) < 0.001);
  assert.equal(normalProfile.speedMultiplier, 1.5);
  assert.equal(normalProfile.jumpHeightMultiplier, 1.5);
  core.updatePlayerStamina(player, 'run', true, 1);
  assert.equal(player.stamina, 5);
});

test('yellow mushroom allows an immediate second jump on the first boosted takeoff', () => {
  const player = core.createPlayer(20, 64);
  player.grounded = true;
  core.applyPowerupEffect(player, 'yellow-mushroom');
  assert.equal(player.airJumpsRemaining, 1);
  assert.equal(core.startJump(player, 1.5), true);
  assert.equal(player.airJumpsRemaining, 1);
  assert.equal(core.startJump(player, 1.5), true);
  assert.equal(player.airJumpsRemaining, 0);
  assert.equal(core.startJump(player, 1.5), false);
});

test('green mushroom forces a 10 second weak state regardless of stamina', () => {
  const player = core.createPlayer(20, 64);
  player.stamina = 95;
  const effect = core.applyPowerupEffect(player, 'green-mushroom');
  const profile = core.getPlayerMovementProfile(player, { left: false, right: true, run: true });
  assert.equal(effect.damage, false);
  assert.equal(player.weakTimer, 10);
  assert.equal(profile.mode, 'slow');
  core.updatePlayerStamina(player, 'slow', true, 1);
  assert.equal(player.stamina, 95);
});

test('player does not hit a platform outside its horizontal span', () => {
  const player = core.createPlayer(120, 432);
  player.grounded = true;
  core.startJump(player);
  core.stepPlayer(player, { left: false, right: false }, [{ x: 450, y: 390, w: 190, h: 24 }], 1 / 60);
  assert.ok(player.y < 431, `player was stopped by a distant platform at y=${player.y}`);
  assert.ok(player.vy < 0, 'player should still be moving upward');
});

test('player cannot land on a platform outside its horizontal span', () => {
  const player = core.createPlayer(120, 350);
  player.vy = 10;
  core.stepPlayer(player, { left: false, right: false }, [{ x: 450, y: 390, w: 190, h: 24 }], 1 / 60);
  assert.equal(player.grounded, false);
  assert.ok(player.y > 350, `player was snapped onto a distant platform at y=${player.y}`);
});

test('flower patch behaves like a one-way platform', () => {
  const patch = core.createFlowerPatch(100, 426, 64, 36);
  const solid = core.getFlowerPatchSolid(patch);
  const fromBelow = core.createPlayer(112, solid.y + 8);
  fromBelow.vy = -12;
  core.stepPlayer(fromBelow, { left: false, right: false }, [solid], 1 / 60);
  assert.ok(fromBelow.y < solid.y + 8, `player was blocked from below at y=${fromBelow.y}`);
  const onTop = core.createPlayer(112, solid.y - 34);
  onTop.vy = 10;
  core.stepPlayer(onTop, { left: false, right: false }, [solid], 1 / 60);
  assert.equal(onTop.grounded, true);
  assert.equal(onTop.y + onTop.h, solid.y);
});

test('flower patch disappears 0.5 seconds after the first stomp', () => {
  const patch = core.createFlowerPatch(100, 426, 64, 36);
  const solid = core.getFlowerPatchSolid(patch);
  const player = core.createPlayer(112, solid.y - 36);
  player.grounded = true;
  let triggered = false;
  core.stepFlowerPatch(patch, player, 0.1, () => { triggered = true; });
  assert.equal(triggered, true);
  assert.equal(patch.triggered, true);
  assert.equal(patch.active, true);
  assert.notEqual(patch.shakeOffset, 0);
  core.stepFlowerPatch(patch, player, 0.4);
  assert.equal(patch.active, false);
});

test('flower patch solid sits high enough to preserve crouch passage calculations', () => {
  const patch = core.createFlowerPatch(100, 420, 64, 36);
  const solid = core.getFlowerPatchSolid(patch);
  assert.equal(solid.h, 12);
  assert.equal(solid.y, 408);
});

test('level flower patches keep the first two fixed and safe while later ones stay random', () => {
  const values = [0.2, 0, 1, 1, 0.95, 0.4];
  let index = 0;
  const patches = core.createLevelFlowerPatches([[80, 426], [260, 426], [100, 426]], () => values[index++]);
  assert.equal(patches.length, 3);
  assert.equal(patches[0].x, 80);
  assert.equal(patches[0].y, 426);
  assert.equal(patches[0].hasSnapper, false);
  assert.equal(patches[1].x, 260);
  assert.equal(patches[1].hasSnapper, false);
  assert.equal(patches[2].w, 32);
  assert.equal(patches[2].h, 18);
  assert.equal(patches[2].x, 244);
  assert.equal(patches[2].y, 338);
  assert.equal(patches[2].hasSnapper, true);
});

test('flower patch placement prefers moving upward instead of downward', () => {
  const patch = core.createFlowerPatch(1120, 426, 64, 36);
  const obstacles = [{ x: 1120, y: 394, w: 84, h: 74, kind: 'pipe' }];
  core.adjustFlowerPatchPlacement(patch, obstacles, 18);
  assert.equal(core.isFlowerPatchPlacementClear(patch, obstacles, 18), true);
  assert.ok(patch.y <= 426, `patch moved downward to y=${patch.y}`);
});

test('snapper waits 0.2 seconds with a warning shake before bursting upward', () => {
  const patch = core.createFlowerPatch(100, 426, 64, 36);
  patch.hasSnapper = true;
  const solid = core.getFlowerPatchSolid(patch);
  const player = core.createPlayer(112, solid.y - 36);
  player.grounded = true;
  let warned = 0;
  core.stepFlowerPatch(patch, player, 0.1, null, () => { warned += 1; });
  assert.equal(patch.triggered, true);
  assert.equal(patch.snapperProgress, 0);
  assert.notEqual(patch.shakeOffset, 0);
  assert.equal(warned, 1);
  assert.equal(patch.snapperWarned, true);
  core.stepFlowerPatch(patch, player, 0.09, null, () => { warned += 1; });
  assert.equal(warned, 1);
  assert.equal(patch.snapperProgress, 0);
  core.stepFlowerPatch(patch, player, 0.03, null, () => { warned += 1; });
  assert.ok(patch.snapperProgress > 0, `snapper did not burst upward: ${patch.snapperProgress}`);
});

test('snapper bite sets a temporary bite animation timer', () => {
  const patch = core.createFlowerPatch(100, 426, 64, 36);
  patch.hasSnapper = true;
  patch.triggered = true;
  patch.snapperDelay = 0;
  patch.snapperProgress = 1;
  const player = core.createPlayer(112, 360);
  let bit = false;
  core.stepFlowerPatch(patch, player, 0.016, null, () => { bit = true; });
  assert.equal(bit, true);
  assert.ok(patch.snapperBiteTimer > 0);
});

test('player reaches roughly half the previous jump height', () => {
  const player = core.createPlayer(20, 64);
  player.grounded = true;
  const startY = player.y;
  core.startJump(player);
  let apexY = startY;
  for (let frame = 0; frame < 90; frame += 1) {
    core.stepPlayer(player, { left: false, right: false }, [], 1 / 60);
    apexY = Math.min(apexY, player.y);
    if (player.vy >= 0) break;
  }
  const jumpHeight = startY - apexY;
  assert.ok(jumpHeight > 125 && jumpHeight < 140, `jump height was ${jumpHeight}`);
});

test('mid stamina keeps normal speed and drains 2 per second while moving', () => {
  const player = core.createPlayer(20, 64);
  player.stamina = 50;
  core.stepPlayer(player, { left: false, right: true, run: true }, [], 1);
  assert.equal(player.vx, 260);
  assert.equal(player.stamina, 48);
});

test('low stamina forces slow walking and recovers only when stopped', () => {
  const player = core.createPlayer(20, 64);
  player.stamina = 20;
  player.grounded = true;
  core.stepPlayer(player, { left: false, right: true, run: true }, [{ x: 0, y: 100, w: 200, h: 24 }], 1);
  assert.equal(player.vx, 130);
  assert.equal(player.stamina, 20);
  const profile = core.getPlayerMovementProfile(player, { left: false, right: false, run: false });
  assert.equal(core.startJump(player, profile.jumpHeightMultiplier), true);
  assert.ok(Math.abs(player.vy + 14 * Math.sqrt(0.6)) < 0.001);
  assert.equal(player.stamina, 19);
  player.grounded = true;
  player.vx = 0;
  core.stepPlayer(player, { left: false, right: false, run: false }, [{ x: 0, y: 100, w: 200, h: 24 }], 1);
  assert.equal(player.stamina, 21);
});

test('player crouches to half height while keeping feet planted', () => {
  const player = core.createPlayer(20, 64);
  player.grounded = true;
  const standingBottom = player.y + player.h;
  core.stepPlayer(player, { left: false, right: false, down: true }, [{ x: 0, y: 100, w: 200, h: 24 }], 1 / 60);
  assert.equal(player.crouching, true);
  assert.equal(player.h, 18);
  assert.equal(player.y + player.h, standingBottom);
});

test('crouching player can pass through a tunnel too short to stand in', () => {
  const player = core.createPlayer(20, 164);
  player.grounded = true;
  const solids = [
    { x: 0, y: 200, w: 300, h: 100 },
    { x: 0, y: 164, w: 300, h: 18 }
  ];
  core.stepPlayer(player, { left: false, right: true, down: true }, solids, 1 / 60);
  assert.equal(player.crouching, true);
  assert.ok(player.x > 20, `player did not move through the low tunnel: x=${player.x}`);
});

test('player stays crouched until there is room to stand', () => {
  const player = core.createPlayer(20, 182);
  player.grounded = true;
  player.crouching = true;
  player.h = 18;
  const ceiling = { x: 0, y: 164, w: 300, h: 18 };
  core.stepPlayer(player, { left: false, right: false, down: false }, [ceiling], 1 / 60);
  assert.equal(player.crouching, true);
  assert.equal(player.h, 18);
});

test('player stands back up when the ceiling clears', () => {
  const player = core.createPlayer(20, 182);
  player.grounded = true;
  player.crouching = true;
  player.h = 18;
  core.stepPlayer(player, { left: false, right: false, down: false }, [{ x: 0, y: 200, w: 200, h: 24 }], 1 / 60);
  assert.equal(player.crouching, false);
  assert.equal(player.h, 36);
  assert.equal(player.y + player.h, 200);
});

test('player clears the tallest level obstacle with one jump', () => {
  const player = core.createPlayer(3600, 432);
  player.grounded = true;
  const solids = [
    { x: 0, y: 468, w: 5000, h: 100 },
    { x: 3665, y: 360, w: 84, h: 108 }
  ];
  core.startJump(player);
  for (let frame = 0; frame < 120; frame += 1) {
    core.stepPlayer(player, { left: false, right: true }, solids, 1 / 60);
  }
  assert.ok(player.x > 3749, `player remained at x=${player.x}`);
});

test('stacked standable layers are pulled apart even when they overlap vertically', () => {
  const upper = { x: 824, y: 318, w: 32, h: 32 };
  const lower = { x: 790, y: 330, w: 170, h: 24 };
  core.ensureMinimumPassageGap([lower, upper], [upper], 18);
  assert.equal(lower.y - (upper.y + upper.h), 18);
  assert.equal(upper.y, 280);
});

test('collecting a coin marks it collected and increments score', () => {
  const result = core.collectCoin({ x: 10, y: 10, w: 20, h: 20 }, { x: 15, y: 15, w: 12, h: 12, collected: false });
  assert.equal(result.collected, true);
  assert.equal(result.score, 100);
  assert.equal(result.coins, 1);
});

test('collecting the explosive grants one bomb and deactivates the pickup', () => {
  const bomb = core.createBomb(20, 20);
  const result = core.collectBomb({ x: 10, y: 10, w: 24, h: 30 }, bomb);
  assert.equal(result.collected, true);
  assert.equal(result.hasBomb, true);
  assert.equal(bomb.active, false);
});

test('bomb detonates the tower only when the player is close and armed', () => {
  const tower = core.createTower(100, 100);
  const player = { x: 65, y: 282, w: 28, h: 36 };
  assert.equal(core.detonateTower(player, tower, false, 48).detonated, false);
  assert.equal(tower.destroyed, false);
  const result = core.detonateTower(player, tower, true, 48);
  assert.equal(result.detonated, true);
  assert.equal(result.hasBomb, false);
  assert.equal(tower.destroyed, true);
});

test('tower laser stays hidden until the player enters range and then grows more slowly from zero', () => {
  const tower = core.createTower(100, 100);
  const player = { x: 250, y: 180, w: 28, h: 36 };
  core.stepTowerLaser(tower, { x: -520, y: 0, w: 28, h: 36 }, 1 / 60);
  assert.equal(tower.beamActive, false);
  assert.equal(tower.beamLength, 0);
  core.stepTowerLaser(tower, player, 0.25);
  assert.equal(tower.beamActive, true);
  assert.equal(tower.beamLength, 80);
});

test('tower laser turns toward the player at 0.5x of the configured speed', () => {
  const tower = core.createTower(100, 100);
  tower.beamAngle = 0;
  tower.beamTurnSpeed = 0.5;
  core.stepTowerLaser(tower, { x: 86, y: 0, w: 28, h: 36 }, 1);
  assert.ok(Math.abs(tower.beamAngle + 0.25) < 0.001, `laser turned too far: ${tower.beamAngle}`);
});

test('tower laser runs for 5 seconds and then waits 1 second before it can fire again', () => {
  const tower = core.createTower(100, 100);
  const player = { x: 250, y: 180, w: 28, h: 36 };
  core.stepTowerLaser(tower, player, 5);
  assert.equal(tower.beamActive, false);
  assert.equal(tower.beamLength, 0);
  assert.equal(tower.beamCooldownTimer, 1);
  core.stepTowerLaser(tower, player, 0.5);
  assert.equal(tower.beamActive, false);
  assert.equal(tower.beamCooldownTimer, 0.5);
  core.stepTowerLaser(tower, player, 0.5);
  assert.equal(tower.beamActive, false);
  assert.equal(tower.beamCooldownTimer, 0);
  core.stepTowerLaser(tower, player, 0.25);
  assert.equal(tower.beamActive, true);
  assert.equal(tower.beamLength, 80);
});

test('laser contact only damages while the beam is active', () => {
  const tower = core.createTower(100, 100);
  tower.beamAngle = Math.PI;
  tower.beamActive = true;
  tower.beamLength = tower.beamMaxLength;
  const hit = core.resolveLaserContact({ x: -120, y: 106, w: 28, h: 36 }, tower);
  const miss = core.resolveLaserContact({ x: 86, y: 0, w: 28, h: 36 }, tower);
  assert.equal(hit.type, 'damage');
  assert.equal(miss.type, 'none');
  tower.beamActive = false;
  assert.equal(core.resolveLaserContact({ x: -120, y: 106, w: 28, h: 36 }, tower).type, 'none');
  tower.destroyed = true;
  assert.equal(core.resolveLaserContact({ x: -120, y: 106, w: 28, h: 36 }, tower).type, 'none');
});

test('debug invincibility toggles and blocks damage resolution', () => {
  assert.equal(core.toggleDebugInvincible(false), true);
  assert.equal(core.toggleDebugInvincible(true), false);
  assert.equal(core.resolveDamage(false).type, 'damage');
  assert.equal(core.resolveDamage(true).type, 'blocked');
});

test('enemy contact distinguishes a stomp from side damage', () => {
  const stomp = core.resolveEnemyContact({ x: 10, y: 10, w: 24, h: 30, vy: 100 }, { x: 10, y: 35, w: 24, h: 24, alive: true, type: 'scout' });
  assert.equal(stomp.type, 'stomp');
  assert.equal(stomp.score, 200);
  const turtle = core.resolveEnemyContact({ x: 10, y: 24, w: 24, h: 30, vy: 100 }, { x: 10, y: 35, w: 34, h: 30, alive: true, type: 'turtle', shell: false });
  assert.equal(turtle.type, 'stomp-shell');
  const boss = core.resolveEnemyContact({ x: 18, y: 36, w: 24, h: 30, vy: 120 }, { x: 10, y: 40, w: 42, h: 42, alive: true, type: 'archerBoss' });
  assert.equal(boss.type, 'stomp');
  const side = core.resolveEnemyContact({ x: 2, y: 34, w: 24, h: 30, vy: 0 }, { x: 20, y: 25, w: 24, h: 24, alive: true, type: 'scout' });
  assert.equal(side.type, 'damage');
});

test('enemy stays on the ground instead of being teleported to the ground edge', () => {
  const enemy = { x: 220, y: 438, w: 34, h: 30, vx: -48, vy: 0, minX: 160, maxX: 420, alive: true, walk: 0 };
  core.stepEnemy(enemy, [{ x: 0, y: 468, w: 1120, h: 100, kind: 'ground' }], 1 / 60);
  assert.ok(enemy.x < 220 && enemy.x > 200, `enemy moved to an invalid x=${enemy.x}`);
  assert.equal(enemy.y, 438);
  assert.equal(enemy.vy, 0);
});

test('enemy chooses a random spawn point inside its patrol range', () => {
  const enemy = core.createEnemy(100, 438, 80, 180, 48, 1, () => 0.5);
  assert.equal(enemy.x, 130);
  assert.equal(core.randomizeEnemySpawn(enemy, () => 0.25), 105);
  assert.equal(enemy.spawnX, 105);
});

test('turtle shell rolls at triple base speed after it is activated', () => {
  const enemy = core.createEnemy(100, 438, 80, 180, 40, 1, () => 0.5, 'turtle');
  enemy.shell = true;
  enemy.vx = 1;
  core.stepEnemy(enemy, [{ x: 0, y: 468, w: 400, h: 100, kind: 'ground' }], 1 / 60);
  assert.equal(enemy.vx, 120);
});

test('turtle spike arc covers players inside the upper 120 degree sector only', () => {
  const enemy = core.createEnemy(100, 438, 80, 180, 40, 1, () => 0.5, 'turtle');
  const above = { x: 105, y: 360, w: 24, h: 30 };
  assert.equal(core.isPlayerInTurtleSpikeArc(enemy, above), true);
  assert.equal(core.shouldTurtleTriggerSpike(enemy, above), true);
  enemy.spikeUsed = true;
  assert.equal(core.shouldTurtleTriggerSpike(enemy, above), false);
  enemy.spikeUsed = false;
  assert.equal(core.isPlayerInTurtleSpikeArc(enemy, { x: 170, y: 380, w: 24, h: 30 }), false);
  assert.equal(core.isPlayerInTurtleSpikeArc(enemy, { x: 105, y: 470, w: 24, h: 30 }), false);
});

test('archer boss uses double fire rate, larger body settings and two lives', () => {
  const enemy = core.createEnemy(100, 426, 80, 180, 62, 1, () => 0.5, 'archerBoss');
  assert.equal(enemy.shootInterval, 1.1);
  assert.equal(enemy.w, 42);
  assert.equal(enemy.h, 42);
  assert.equal(enemy.hp, 2);
  assert.equal(enemy.maxHp, 2);
});

test('archer boss loses one life before being defeated', () => {
  const enemy = core.createEnemy(100, 426, 80, 180, 62, 1, () => 0.5, 'archerBoss');
  const first = core.consumeEnemyLife(enemy);
  assert.equal(first.defeated, false);
  assert.equal(enemy.alive, true);
  assert.equal(enemy.hp, 1);
  const second = core.consumeEnemyLife(enemy);
  assert.equal(second.defeated, true);
  assert.equal(enemy.alive, false);
  assert.equal(enemy.hp, 0);
});

test('enemy becomes enraged after three failed shots', () => {
  const enemy = core.createEnemy(100, 438, 80, 180, 48, 1);
  core.registerEnemyShotFailure(enemy);
  core.registerEnemyShotFailure(enemy);
  assert.equal(enemy.enraged, false);
  core.registerEnemyShotFailure(enemy);
  assert.equal(enemy.enraged, true);
  const boss = core.createEnemy(100, 438, 80, 180, 62, 2, () => 0.5, 'archerBoss');
  core.registerEnemyShotFailure(boss);
  core.registerEnemyShotFailure(boss);
  core.registerEnemyShotFailure(boss);
  assert.equal(boss.enraged, false);
});

test('projectile moves with its velocity while active', () => {
  const projectile = core.createProjectile(10, 20, 120, -30);
  core.stepProjectile(projectile, [], 0.5);
  assert.equal(projectile.x, 70);
  assert.equal(projectile.y, 5);
  assert.equal(projectile.active, true);
  assert.equal(projectile.kind, 'bullet');
});

test('boss projectiles can be marked as arrows without affecting base movement', () => {
  const projectile = core.createProjectile(10, 20, 120, -30, 99, 'arrow');
  core.stepProjectile(projectile, [], 0.5);
  assert.equal(projectile.x, 70);
  assert.equal(projectile.y, 5);
  assert.equal(projectile.kind, 'arrow');
});

test('turtle spike projectiles use their own kind without affecting base movement', () => {
  const projectile = core.createProjectile(10, 20, -120, -215, 7, 'spike');
  core.stepProjectile(projectile, [], 0.5);
  assert.equal(projectile.kind, 'spike');
  assert.equal(projectile.x, -50);
  assert.equal(projectile.y, -87.5);
});

test('turtle starts with a one-time spike charge available', () => {
  const enemy = core.createEnemy(100, 438, 80, 180, 40, 1, () => 0.5, 'turtle');
  assert.equal(enemy.spikeUsed, false);
  assert.equal(enemy.spikeChargeTimer, 0);
});

test('projectile becomes inactive when it hits a solid', () => {
  const projectile = core.createProjectile(10, 10, 120, 0);
  core.stepProjectile(projectile, [{ x: 65, y: 0, w: 20, h: 40 }], 0.5);
  assert.equal(projectile.active, false);
});

test('projectile contact reports damage only when it overlaps the player', () => {
  const projectile = core.createProjectile(20, 20, 0, 0);
  assert.equal(core.resolveProjectileContact({ x: 10, y: 10, w: 24, h: 30 }, projectile).type, 'damage');
  projectile.active = false;
  assert.equal(core.resolveProjectileContact({ x: 10, y: 10, w: 24, h: 30 }, projectile).type, 'none');
});

test('reaching the flag returns the win signal', () => {
  assert.equal(core.reachedFlag({ x: 100, y: 100, w: 24, h: 32 }, { x: 110, y: 90, w: 24, h: 80 }), true);
});
