# Super Pixel Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, offline-capable, single-file side-scrolling platform game with local CC0 assets, keyboard and touch controls, and tested core game rules.

**Architecture:** `index.html` contains the responsive shell, Canvas renderer, level data, input, audio, state machine, and the testable pure game core. `tests/game.test.mjs` extracts the marked core block from the HTML and runs the same rule functions under Node's built-in test runner. `assets/` stores the small local asset set and license record.

**Tech Stack:** HTML5, CSS, Canvas 2D, vanilla JavaScript, Node.js built-in `node:test`, local PNG assets.

**Spec:** `docs/superpowers/specs/2026-09-08-super-pixel-run-design.md`

## Global Constraints

- The game must run by opening `index.html` directly.
- No framework, bundler, CDN, network requests, or server-side code is required at runtime.
- Use a fixed logical Canvas viewport of `960 x 540` and preserve pixel-crisp rendering.
- Keep the level approximately `6400` logical pixels wide and make required progression reachable.
- Prefer CC0 Kenney platformer assets and record source, author, pack, date, and license in `assets/LICENSES.txt`.
- Missing images and blocked audio must never prevent gameplay.
- Write tests before production game logic and watch the tests fail for the missing behavior.

## File Map

- Create: `index.html` - complete playable game and marked testable core.
- Create: `tests/game.test.mjs` - Node tests that execute the testable core extracted from `index.html`.
- Create: `assets/LICENSES.txt` - asset provenance and license notes.
- Create: `assets/tiles/` - downloaded terrain and platform images used by the renderer.
- Create: `assets/characters/` - downloaded character or enemy images used by the renderer.
- Create: `assets/items/` - downloaded coin, mushroom, flag, and UI images used by the renderer.
- Create: `assets/audio/` - optional locally stored sound effects if a suitable CC0 pack is available.

### Task 1: Add Failing Core Tests

**Files:**
- Create: `tests/game.test.mjs`
- Read: `docs/superpowers/specs/2026-09-08-super-pixel-run-design.md`

**Interfaces:**
- Consumes: `index.html` markers `TESTABLE_CORE_START` and `TESTABLE_CORE_END`.
- Produces: assertions for exported functions `rectsOverlap`, `createPlayer`, `stepPlayer`, `collectCoin`, `resolveEnemyContact`, and `reachedFlag`.

- [ ] **Step 1: Write the failing test**

Create a test helper that reads `index.html`, extracts the text between the two markers, evaluates it in a VM context, and reads `context.GameCore`. Add tests for these exact behaviors:

```js
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.match(/TESTABLE_CORE_START([\\s\\S]*?)TESTABLE_CORE_END/);
assert.ok(source, 'index.html must expose a testable core block');
const context = { console };
vm.runInNewContext(`${source[1]}\\nthis.GameCore = GameCore;`, context);
const core = context.GameCore;

test('overlap only returns true for intersecting rectangles', () => {
  assert.equal(core.rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 2, h: 2 }), true);
  assert.equal(core.rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 2, h: 2 }), false);
});

test('player lands on a solid and becomes grounded', () => {
  const player = core.createPlayer(20, 0);
  player.vy = 180;
  core.stepPlayer(player, { left: false, right: false, jumpPressed: false }, [{ x: 0, y: 100, w: 200, h: 24 }], 0.5);
  assert.equal(player.y, 68);
  assert.equal(player.grounded, true);
});

test('player cannot jump in midair but can jump from the ground', () => {
  const player = core.createPlayer(20, 68);
  player.grounded = true;
  core.stepPlayer(player, { left: false, right: false, jumpPressed: true }, [], 1 / 60);
  assert.ok(player.vy < 0);
  player.grounded = false;
  player.vy = 0;
  core.stepPlayer(player, { left: false, right: false, jumpPressed: true }, [], 1 / 60);
  assert.equal(player.vy, 0);
});

test('collecting a coin marks it collected and increments score', () => {
  const result = core.collectCoin({ x: 10, y: 10, w: 20, h: 20 }, { x: 15, y: 15, w: 12, h: 12, collected: false });
  assert.deepEqual(result, { collected: true, score: 100, coins: 1 });
});

test('enemy contact distinguishes a stomp from side damage', () => {
  const stomp = core.resolveEnemyContact({ x: 10, y: 10, w: 24, h: 30, vy: 100 }, { x: 10, y: 35, w: 24, h: 24, alive: true });
  assert.deepEqual(stomp, { type: 'stomp', score: 200 });
  const side = core.resolveEnemyContact({ x: 10, y: 20, w: 24, h: 30, vy: 0 }, { x: 10, y: 25, w: 24, h: 24, alive: true });
  assert.deepEqual(side, { type: 'damage' });
});

test('reaching the flag returns the win signal', () => {
  assert.equal(core.reachedFlag({ x: 100, y: 100, w: 24, h: 32 }, { x: 110, y: 90, w: 24, h: 80 }), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/game.test.mjs`

Expected: FAIL because `index.html` and the `TESTABLE_CORE` block do not exist yet. Fix only test syntax or extraction errors if the command errors instead of reporting missing implementation.

### Task 2: Download and Record Local Assets

**Files:**
- Create: `assets/tiles/`
- Create: `assets/characters/`
- Create: `assets/items/`
- Create: `assets/audio/`
- Create: `assets/LICENSES.txt`

**Interfaces:**
- Consumes: the documented Kenney CC0 platformer source.
- Produces: stable relative paths for the asset manifest in `index.html`.

- [ ] **Step 1: Download only the selected files**

Use a temporary download directory and copy a minimal set of PNG files from the GitHub mirror into the named folders. Keep the original filenames where practical; use explicit paths and do not clone the entire mirror. If a sprite is inconvenient to extract, keep the image fallback for that role and download the terrain/items that provide the strongest visual identity.

- [ ] **Step 2: Record provenance**

Write `assets/LICENSES.txt` with the Kenney Platformer Art Deluxe or Platformer Pack Redux name, author `Kenney`, source links, download date `2026-09-08`, and `CC0 1.0 Universal` license. Note any file that is intentionally not used at runtime.

- [ ] **Step 3: Verify files are readable**

Run: `Get-ChildItem assets -Recurse | Select-Object FullName,Length`

Expected: the asset folders contain non-empty local files and the license record names every external source used.

### Task 3: Implement the Testable Physics Core

**Files:**
- Create: `index.html`
- Modify: `tests/game.test.mjs` only if the actual contract needs a test correction.

**Interfaces:**
- Consumes: horizontal input `{ left, right }`, solid rectangles, coin rectangles, enemy rectangles, and flag rectangles.
- Produces: `GameCore = { rectsOverlap, createPlayer, startJump, stepPlayer, collectCoin, resolveEnemyContact, reachedFlag }` inside the marked core block.

- [ ] **Step 1: Add the minimal testable core**

Place a pure JavaScript block in `index.html` with the two markers. Use a player object with `x`, `y`, `w`, `h`, `vx`, `vy`, `grounded`, and `facing`. Keep the player jump in the reference game's fixed-step style: `PLAYER_GRAVITY_PER_FRAME = 0.72` and `PLAYER_MAX_FALL_SPEED = 15`, scaled by `dt * 60` so the behavior stays stable across frame rates. Set `PLAYER_JUMP_VELOCITY` to the reference velocity `-14` multiplied by `sqrt(2)` so the apex is twice as high. Resolve horizontal overlap before vertical overlap, set `grounded` only when landing, and expose `startJump(player)` as the only jump operation.

- [ ] **Step 2: Run the focused tests**

Run: `node --test tests/game.test.mjs`

Expected: PASS for overlap, landing, jump gating, coin collection, enemy contact, and flag completion.

- [ ] **Step 3: Refactor only after green**

Keep the functions pure and small. Do not move them to another file because the runtime must remain a single-file game and the tests intentionally exercise the same inline source.

### Task 4: Add Runtime, Level, and Renderer

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `GameCore`, the asset manifest, and level arrays.
- Produces: `createLevel()`, `resetGame()`, `update(dt)`, `render()`, and the playable 6400px world.

- [ ] **Step 1: Add the responsive shell and Canvas**

Create a dark neutral page frame, a 16:9 game stage, an accessible Canvas label, HUD slots, title/win/game-over overlays, and touch controls. Set Canvas width and height to `960` and `540`; use CSS `image-rendering: pixelated` and disable smoothing in the context.

- [ ] **Step 2: Add level data**

Create solids for a continuous ground with designed gaps, raised platforms, pipe shapes, and the final flag area. Add blocks, coins, at least five enemies, at least two mushrooms, and a flag trigger near the world end. Normalize every level object to finite positive dimensions before storing it.

- [ ] **Step 3: Add camera and layered rendering**

Track `camera.x` toward the player while clamping it to the world width. Render a blue sky, slow parallax clouds/hills, local assets when loaded, and Canvas fallback shapes for terrain, character, coins, enemies, mushrooms, blocks, pipe, and flag. Draw HUD in screen coordinates after world rendering.

- [ ] **Step 4: Add the game state machine and update loop**

Implement `title`, `playing`, `paused`, `gameover`, and `won` states. On each frame, cap the delta to `0.033`, update the player and enemies only in `playing`, handle item collection and enemy contact, decrement time, and call `requestAnimationFrame` continuously. Enter game over when time or lives reach zero; freeze the world on win.

- [ ] **Step 5: Run the focused tests and open the game**

Run: `node --test tests/game.test.mjs`

Open: `index.html` in a browser.

Expected: the title screen displays, Start begins play, the player moves and jumps, the camera follows, and the level renders even if an asset is unavailable.

### Task 5: Add Input, Audio, Polish, and Accessibility

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: browser keyboard/pointer events and optional local audio files.
- Produces: desktop and mobile input, audio feedback, overlays, and resilient controls.

- [ ] **Step 1: Add keyboard controls**

Map ArrowLeft/A to `left`, ArrowRight/D to `right`, and ArrowUp/W/Space to the shared direct `jumpPlayer()` call; P or the pause button pauses/resumes, and R resets from any non-title state. Prevent page scrolling only for gameplay keys while the Canvas or game shell is active.

- [ ] **Step 2: Add touch controls**

Use pointer capture on fixed left, right, and jump buttons. Set and clear held states for movement, call the same direct `jumpPlayer()` function from the jump button, unlock the next jump on `pointerup`, and release all states on `pointercancel`, `blur`, and `visibilitychange`.

- [ ] **Step 3: Add audio fallback behavior**

Create an AudioContext lazily after the first input gesture. Prefer local sound files if present, but use short oscillator envelopes for jump, coin, stomp, hurt, and win when no file is available. Catch rejected audio operations and continue silently.

- [ ] **Step 4: Polish feedback**

Add particles for coins and stomps, a brief damage flash, score popups, animated coin bobbing, enemy walk frames, a flag wave, and a short countdown warning under ten seconds. Keep effects bounded so the main loop remains responsive.

- [ ] **Step 5: Verify controls and overlays**

Run: `node --test tests/game.test.mjs`

Manually verify title start, pause/resume, restart, keyboard focus, touch movement, touch jump, audio after a gesture, enemy damage, respawn, game over, win, and narrow viewport layout.

### Task 6: Final Verification

**Files:**
- Modify: `index.html` only for verified defects.
- Modify: `tests/game.test.mjs` only for verified rule gaps.

- [ ] **Step 1: Run automated verification**

Run: `node --test tests/game.test.mjs`

Expected: all tests pass with no warnings or uncaught errors.

- [ ] **Step 2: Inspect local asset references**

Run: `rg -n "assets/|LICENSES|TESTABLE_CORE" index.html assets tests`

Expected: every runtime asset path is relative, the license file exists, and the test markers appear exactly once.

- [ ] **Step 3: Perform browser smoke test**

Open `index.html`, start the game, complete or restart the level, resize to a narrow viewport, and confirm there is no blank Canvas, overlap in the HUD, stuck input, or page scroll during play.

- [ ] **Step 4: Report limitations accurately**

State that the folder is not a Git repository, so no commit was created. Report automated test output and any browser checks that could not be performed.
