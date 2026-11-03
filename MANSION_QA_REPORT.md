# MANSION QA REPORT

What was tested, on what, with what result. Nothing here is inferred from a
successful build: every check below drove the running game through its own
controller, interaction path or browser probe, and the raw output is in
`reports/`.

## Environment

- Windows, Node 24.19, Vite 5.4, three 0.160.1, Playwright 1.64 (headless).
- Dev server: `npm run dev` on `http://127.0.0.1:5333`, probed through
  `?probe=1`, which boots the world with the player free and publishes
  `window.__silid` after architecture, furniture and the game exist.
- Production build: `npm run build` → `dist/` (passed, 4.6 s, 881 kB JS).

## Test runs

| Test | Script | Result | Evidence |
|---|---|---|---|
| Architecture audit: doors cut, colliders, floor holes, per-room floor/free sample | `scripts/audit_mansion.cjs` | **pass** — 64 openings, 0 missing, 0 without collider, 854 architecture + 185 prop colliders; only the stair halls fail the 9/9 floor sample, because their samples are in the well | `reports/audit.json` |
| Stair traversal, all floors, both directions, real controller | `scripts/traverse_mansion.cjs` | **pass** — GF→F2 127 steps, F2→F3 128, F3→F4 128, F4→F3 133, F3→F2 132, F2→GF 133; `ALL FLOORS REACHED: true  BASEMENT BOTH WAYS: true` | `reports/traverse.log` |
| Story chain: notebook → fuse → diesel → panel → generator → gate | `scripts/story_test.cjs` | **pass** — each pickup gained through the prompt path; fuse fitted; generator powered; gate open | `reports/story_test.json` |
| Locked study: refused without key, opens with it, doorway walkable | `scripts/story_test.cjs` | **pass** — `open:false` then `unlocked:true`, `blockedAtDoor:false`, `blockedBeyond:false` | `reports/story_test.json` |
| Furniture examine: prompt, authored text, repeat look | `scripts/story_test.cjs` | **pass** — `E inspect the counter`, text delivered, second look prefixed `Again` | `reports/story_test.json` |
| Drawers: five cabinets, open travel, search, close | `scripts/drawer_test.cjs` | **pass** — 0.30 m travel on all five, each searched and closed again; drawer group is 4 meshes (interior, front, runners) not a solid cube | `reports/drawers.json` |
| Fuse panel: open cover, fit fuse, close | `scripts/apparatus_test.cjs` | **pass** — cover −1.45 rad open, fuse seated and visible, cover back to 0 | `reports/apparatus.json` |
| Generator start | `scripts/apparatus_test.cjs` | **pass** — `powered:true` with fuel + fuse | `reports/apparatus.json` |
| Door leaves open and release their collider | `scripts/story_test.cjs` | **pass** — one door per floor: `open:true`, `colliderDisabled:true`, leaf at 1.35 rad | `reports/story_test.json` |
| Production build | `npm run build` | **pass** | terminal, this session |

## Live screenshots

Captured from the running game with the real player and flashlight
(`scripts/shoot_mansion.cjs`; Playwright CDP capture, 1280×720). Full size in
`reports/mansion/`, downscaled copies in `reports/mansion/small/`.

| Shot | What it shows | Verdict |
|---|---|---|
| `01_foyer_stair` | Foot of the tower from the foyer: first treads, skirt, iron handrail, newel | pass |
| `02_stair_midflight` | Down the flight from the second-floor landing: continuous swept handrail on both edges, stone treads, well | pass |
| `03_f2_landing` | The landing fan meeting the second-floor slab, with the flight arriving | pass |
| `04_f2_hall` | Second-floor stair hall, floor and doorway | pass |
| `05_f3_landing` | Third-floor landing and the well | pass |
| `06_f4_landing` | Fourth-floor arrival at the Observation Gallery | pass |
| `07_basement_stair` | Looking up the basement flight from the landing: treads, riser faces, handrails on both sides | pass |
| `08_basement_landing` | Basement landing and the foot of the flight | pass |
| `09_drawer_closed` / `10_drawer_open` | A cabinet drawer closed and pulled open, with its interior visible | pass |
| `11_courtyard_rail` | Roof deck, HUD reading `Roof Deck`, stone-and-iron balustrade over the four-storey courtyard void | pass |

Two defects were found by looking at these frames and then fixed and
re-photographed: the handrail was a chain of detached per-step bars (now a swept
tube), and the stair-hall rugs floated across the stairwell (now kept clear of
the stair radius).

## Performance (headless Chromium, the shots run)

| View | Draw calls | Triangles | FPS |
|---|---|---|---|
| Stair hall, both flights and rails in frame | 194–195 | 1.03 M | 33–42 |
| Furniture close-up | ~144 | 981 k | 28 |
| Courtyard from the roof | 195 | 1.03 M | 33 |

Texture memory stays bounded by the material loader (512 px cap, 4× anisotropy,
98 textures resident after the whole house is dressed). Lights are budgeted: a
fixed pool of six slots tracks the nearest room lights, so the number of
authored lamps does not change the shader cost.

## What the tests do not cover

- **Interactive play with pointer lock.** Every probe drives `player.update`
  and `game.update` directly and teleports between stand points. Mouse look,
  pointer-lock acquisition, footstep audio and the intro sequence are exercised
  only by the opening tests that predate this pass.
- **Audio.** The generator loop, creaks and footsteps were not measured; the
  call sites are in the tested interaction paths but the output is not asserted.
- **Controllers and mobile input.** Not present, not tested.
- **Long sessions.** No soak test for GPU memory or leak behaviour; the shots run
  is about 90 s of rendering per page.
- **The enemy.** There is none to test (see `MANSION_PUZZLE_AND_SECRET_MAP.md`).

## Residual defects

1. **F4 → F3 lands 0.14 m low** on the last tread before the landing fan. The
   player can step off; the other descents land exactly.
2. **The phone passcode (6294) has no in-world clue.** The phone's apps are
   optional flavour, but a player who wants them must guess.
3. **Stale npm scripts.** `npm run logic`, `npm run qc`, `npm run corridor`,
   `npm run smoke:paint` and `npm run smoke:rite` point at files that do not
   exist in this tree (`scripts/mansion_logic.mjs`, `scripts/corridor_graph.cjs`,
   `scripts/paint_smoke.mjs`, `scripts/rite_smoke.mjs`). They failed before this
   pass and still fail; the working QA scripts are listed under `qa:` in
   `package.json`.
4. **The courtyard is a light well, not a room.** No furniture, no interaction;
   the working well is outdoors by the ruins.
5. **Bare passages.** The two basement service passages, the F2/F3 south
   walkways and the bell room contain no GLB furniture. The bell room has its
   frame; the walkways are corridors.

## Reproducing

```bash
npm run dev                 # serves http://127.0.0.1:5333
npm run qa:audit            # architecture + room floor sample
npm run qa:traverse         # walk every floor, both directions
npm run qa:story            # the full escape chain, the locked room, inspection
npm run qa:drawers          # every functional drawer
npm run qa:apparatus        # fuse panel + generator
npm run qa:shots            # the screenshot set above
npm run qa:docs             # regenerate the room bible + interaction catalog
```
