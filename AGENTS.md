# SILID — agent workflow notes

## Repo identity
- Name: SILID
- This is a WebGL/Three.js scene game, not a Vite SPA in the usual sense.
- The entry point is `src/main.js`. The page boots a title screen, then
  assembles the world asynchronously, then starts the opening sequence.
- App code lives mostly in `src/game/game.js`; phone UI code is also there.

## Verification
- There is no headless browser smoke test that can reach the phone UI from a
  cold boot today. The page stays on the title/boot screen in headless runs.
- The fastest verification of app wiring is a static scan, not a browser test.
  `node scripts/scan_apps.cjs` reports whether the app functions and wiring
  are present in `src/game/game.js`.
- For runtime checks, drive the actual scene through the player prompt path:
  wait for the "take" prompt, take the phone, then wait for the phone prompt,
  then interact. Do not assume the phone overlay appears on page load.

## Editing
- Prefer small, targeted edits in existing files over new files.
- When changing game behavior, check both `src/game/game.js` and the relevant
  world module if the change touches placement, colliders, or props.
- Keep the boot flow in mind: many systems are async and lazy. A feature that
  depends on something not yet loaded may need a deferred path.

## Style
- This codebase uses long, narrative comments on the important systems.
- Phone UI is built through inline DOM helpers (`phoneEl(...)`), not a
  component framework.
