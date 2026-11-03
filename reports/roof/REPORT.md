# SILID — rooftop access and roof reconstruction

## What exists now

**Roof.** The fourth level is a roof terrace, not a storey. The main building carries a
sloping mansard roof with iron ridge cresting built in `facade.js`; on the terrace stand the
pavilion roofs (hip and gable), brick chimneys, iron guard cresting and the stone parapet that
is the deck's edge. The terrace floor is the F4 slab at **y = 11.6 m**. `wide_02_threequarter.png`
and `close_02_front.png` show the roofline against the four-storey elevation; `wide_03_deck.png`
shows the deck between the pavilions.

**Ladder.** A permanent steel service ladder on the **rear (north) wall at x = −13.3, z = −11.42**,
from grade (y = 0) to the landing at **y = 11.6**. It sits in the one bay that is clear of rear
windows on all four levels (windows end at −14.96 and −10.04). Two 50 mm rails on standoff
brackets, rungs every 250 mm, a hoop over the top rungs. Its collider is the frame's own line,
0–11.6 m.

**Landing.** A **3.0 × 1.45 m** steel platform at 11.6 m, reaching 0.57 m through the wall line
to the door threshold, guarded by rails on its three open sides (colliders `rail`, 11.6–12.65).
The stone parapet's rear run is broken over exactly the landing's width (−14.3…−11.3) so the
platform's rails, not a 1 m kerb, are the guard there.

**Door.** A real hinged service door in the F4 rear wall at **x = −12.2, 1.0 m wide**, cut by the
plan's door pass; it opens outward onto the landing and onto the deck beyond. It is set 1.1 m
east of the ladder on purpose: centred, the ladder's own prompt beat the door's at the head of
the climb.

**Climb.** `E` at the foot (`kind: 'ladder'`, `dir: 'up'`) enters `Player.beginClimb`; `W/S`
drive the feet at 2.0 m/s on the ladder's centre line, `A/D` are ignored, and the mode ends only
when a landing is reached. At the top the body is set down at the **door**, not on the rungs
(`topX/topZ/topYaw`), squares up with the door, and the same key takes it back down. No
teleport: 5.82 s of sim time over 349 frames for 11.6 m.

## Files changed for this request

| File | Change |
| --- | --- |
| `src/world/architecture.js` | service ladder + landing + roof deck (boardwalk, tank, vent, lamps, rail colliders); ladder moved to x = −13.3; landing widened to 3.0 m; parapet break aligned to it |
| `src/world/plan.js` | roof-deck service door cut at x = −12.2, w = 1.0 |
| `src/player/player.js` | ladder climb state (`beginClimb` / `finishClimb`, climb branch in `update`) |
| `src/game/game.js` | `ladder` interaction, dismount `topX` carry, prompt labels |
| `src/main.js` | both ladder interactables (foot and head) with their stand points |
| `src/world/facade.js` | mansard roof planes, ridge caps, cresting, downpipes/leaders (earlier pass of this request) |
| `scripts/roof_route.cjs` | end-to-end route probe: sim-stepped, screenshots at each leg |
| `scripts/roof_climb.cjs` | real-keyboard climb probe (state-waited) |
| `scripts/roof_keys.cjs` | short real-keyboard smoke test of the input path |
| `scripts/roof_wide.cjs`, `scripts/roof_close.cjs` | wide/close inspection shots + render cost |

## Tests actually run

1. **`node scripts/scan_apps.cjs`** — passes (phone wiring verdict unchanged).
2. **`npx vite build`** — succeeds; 33 modules, 1,009 kB bundle (287 kB gzip), no errors.
3. **`node scripts/roof_route.cjs`** — drives `player.update()` + `game.update()` exactly as the
   frame loop does, and `game.interact()` exactly as `E` does. Result (`reports/roof/route.json`):

   | leg | evidence |
   | --- | --- |
   | far (4 m out) | no prompt |
   | base | `ladder` prompt |
   | E | climbing; a second E does not restart (same target) |
   | W up | 349 frames = 5.82 s; foot 11.6; dismount (−12.2, −11.75) facing the door |
   | door | opens; `open: true` |
   | through | 38 frames to z = −10.39 on the deck, floor 11.6 |
   | outer rail | walking at the drop stops at z = −11.95, foot stays 11.6 |
   | back | 29 frames to the landing |
   | aim | `ladder` prompt; S down 349 frames = 5.82 s to foot 0 |
   | console | no page or console errors |

4. **`node scripts/roof_keys.cjs`** — real key events: `E` enters the climb, holding `W` raises
   the feet. Confirms the input path; the headless software renderer draws under 1 fps here, so
   speed is measured in the frame-stepped probe instead.
5. **Screenshots from the running scene** (`reports/roof/`): `01_ladder_base`, `02_climb_mid`,
   `03_landing_door`, `04_door_open`, `05_deck_from_door`, `06_top_of_ladder`, `07_ground_again`,
   plus `wide_01_rear`, `wide_02_threequarter`, `wide_03_deck`, `wide_04_ladder_elevation`,
   `close_01_landing`, `close_02_front`.
6. **Render cost** at the deck view (`reports/roof/cost.json`): 130 draw calls, ~1.04 M triangles,
   46 programs. This environment cannot report meaningful frame rate.

## Known limitations

- The headless renderer runs below 1 fps, so the climb's *speed* cannot be timed on the wall
  clock here; it is measured in sim frames. The dev server on a real GPU will run the climb in
  ~5.8 s.
- The wide exterior shots use a free camera; the sky dome follows the *player*, so
  `wide_02_threequarter.png` shows the moon as a nearby disc. That is a probe artifact, not a
  scene bug — player-view frames (`05_deck_from_door`, `wide_03_deck`) show the sky correctly.
- The landing at night is lit only by the bulkhead lamp above the door and whatever the player
  carries; the door reads warm at its base, the rails silhouette. No shadows are cast from the
  deck lamps (kept shadowless for cost).
- The roof pavilion surfaces are the shared tile material from the earlier roof pass; no
  per-pavilion texture variation was added.
- Cannot be verified here: frame rate and thermals on the target integrated-GPU machine.
