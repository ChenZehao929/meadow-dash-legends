# Super Pixel Run Design

## Goal

Build a single-file, browser-playable side-scrolling platform game inspired by classic mushroom-and-brick platformers. The game must run by opening `index.html`, use local assets from `assets/`, and remain playable when optional media files fail to load.

## Scope

- One complete horizontal level, approximately 6400 logical pixels wide.
- Title screen, active play, pause, game over, and win states.
- Player movement, jump physics, solid-platform collision, camera follow, enemy stomping, damage, respawn, coins, breakable/question blocks, mushroom growth, a pipe set piece, and a flagpole finish.
- Three lives, score, coin counter, countdown timer, and restart controls.
- Keyboard controls and touch controls for narrow screens.
- A small test harness for pure game rules, separate from the runtime file.
- No framework, bundler, CDN, network requests, or server-side code.

The game will use original naming and presentation rather than Nintendo logos, characters, or proprietary sounds. The visual language can use recognizable genre conventions while the shipped art remains from the selected CC0 pack and small code-drawn fallbacks.

## Architecture

`index.html` owns the complete runtime: responsive shell, CSS, Canvas renderer, input handling, audio feedback, level data, game state, and the animation loop. The JavaScript is split into clearly marked inline sections so the pure rules can be extracted by tests without making the game depend on a second runtime file.

The game uses a fixed logical viewport of 960 by 540 and scales the Canvas with CSS. World coordinates stay independent from screen coordinates. The renderer draws background layers first, then world entities, then particles and HUD. The update loop advances only the active game state and uses a capped delta time to prevent large physics jumps after a tab switch.

## Asset Plan

Create an `assets/` directory with a small, curated set of locally stored platformer images and optional sound effects. Prefer Kenney platformer assets obtained from the documented CC0 source and record the source URL, author, pack name, download date, and license in `assets/LICENSES.txt`.

The runtime will load assets through a small manifest. If an image is missing or has not finished loading, its role is drawn with a Canvas fallback, so the game still presents a complete level. Sound effects are optional and are triggered only after a user gesture to satisfy browser autoplay rules.

## Gameplay Rules

The player has horizontal acceleration, friction, a maximum run speed, gravity, jump velocity, and a short coyote window. Horizontal movement is resolved against solid rectangles. Vertical movement resolves landing and head bumps separately and exposes `grounded` for jump logic.

The player starts in the small state. Collecting a mushroom changes the player to the big state and grants a brief transition lock. Contact with an enemy from above bounces the player and removes the enemy. Contact from another side reduces the player state or consumes one life. A short invulnerability timer prevents repeated damage during the same contact sequence.

Coins disappear when collected and increase both the coin counter and score. Question blocks can release a coin or mushroom once. Brick blocks can be hit from below and visibly change state. Falling below the world or losing all lives enters game over. Touching the flag trigger enters win state and freezes the level while showing the final score.

## Level Data

The level is represented by arrays of plain objects:

- `solids`: `{ x, y, w, h, kind }`
- `blocks`: `{ x, y, kind, used }`
- `coins`: `{ x, y, collected }`
- `enemies`: `{ x, y, w, h, vx, alive }`
- `powerups`: `{ x, y, w, h, kind, active }`
- `flag`: `{ x, y, w, h }`

The authored sequence teaches controls near spawn, introduces low-risk coins and blocks, adds staggered gaps and enemies, then builds toward a final elevated run and flagpole. All mandatory progression surfaces are reachable with the default jump parameters.

## UI and Accessibility

The shell uses a dark neutral frame around the game area, a bright sky gameplay palette, high-contrast HUD text, visible focus states, and buttons with descriptive labels. Keyboard focus remains usable for start, pause, restart, and overlay actions. Touch buttons use pointer events and do not require hover. The Canvas has an accessible label and the game can be paused with `P` or the pause button.

## Failure Handling

- Missing images: draw the fallback shape for that asset role and continue.
- Audio context blocked: defer audio until the next pointer or keyboard gesture; never block gameplay.
- Unexpected update errors: keep the overlay controls visible and expose a restart path rather than leaving a frozen blank canvas.
- Invalid level entries: normalize dimensions and clamp entity positions during level creation.

## Verification

`tests/game.test.mjs` extracts the `TESTABLE_CORE` block from `index.html` and evaluates the same pure functions used by the runtime. Tests cover rectangle overlap, solid landing, head bumps, jump gating, coin collection, enemy stomp versus side damage, life loss, and flag completion. After automated tests, manually open `index.html` and verify title start, movement, jump, block interactions, enemy contact, respawn, pause, restart, win, keyboard focus, and touch controls at desktop and narrow viewports.

