# UNDERGROUND ROUTE — basement, tunnel, concealed forest exit

Written after a walk of the whole route in the running Vite build (not from
reading code). Probe output: `reports/underground/probe.json`. Screenshots:
`reports/underground/shots/`.

## The route, in world metres

`+x` east, `+z` north, `+y` up. The basement floor is the datum at `y = -3.40`
and the tunnel starts on it.

| # | segment | x | z | floor y | clear height |
|---|---------|---|---|---------|--------------|
| — | basement junction (east door in the utility basement) | 16.0 | 4.5…7.5 | -3.40 | 3.00 |
| A | brick service tunnel | 16.0 → 33.0 | 4.6…7.4 | -3.40 | 2.45 |
| B | limestone cave (rock passage) | 33.0 → 48.0 | 3.4…8.6 | -3.40 | 2.78 |
| C | transition chamber, framed portal | 48.0 → 49.0 | 4.6…7.4 | -3.40 → -3.25 | 2.20 |
| D | rising brick vault, 13 steps | 49.0 → 56.4 | 4.6…7.4 | -3.25 → -1.44 | 2.10 |
| E | cistern court, open to the sky | 56.4 → 61.8 | 3.0…9.0 | -1.44 | open |
| F | exit flight, stone stair | 61.8 → 67.0 | 7.2…8.6 | -1.44 → +0.85 | 2.29 |
| G | forest beyond the parapet | 67.0 → | 6.9…8.9 | +0.85 | open |

The court is the "recessed opening in a retaining wall": a masonry yard cut
2.3 m into the grounds behind the east wing, with a barred iron-strapped
service door at the bottom of the tunnel and a stone flight up the eastern
bank. From the trees you see a parapet and a grassy cutting, not a hatch.

Nothing intersects the house: the tunnel leaves east of the footprint
(x ≥ 16.0, house ends at x ≈ 15.9), and the terrain cut for the court sits
clear of the foundation.

## Files changed

- `src/world/underground.js` — the whole route rebuilt: continuous floors,
  walls with thickness, ceilings, the cave, the transition portal, the rising
  vault with 13 real treads, the open cistern court, the exit flight, the
  service door and its collider, plus the props that make it read as a
  service space (pipes, brackets, cable trays, maintenance marks, damp,
  debris). Exports `registerUndergroundInteractables()` and `caveCover()`.
- `src/world/terrain.js` — the CISTERN cutting: the terrain is dug and
  banked around the court and exit flight so the tunnel comes up into a real
  hole in the hillside instead of clipping the ground sheet.
- `src/world/plan.js` — basement footprint / level data the tunnel datum and
  east service door are derived from.
- `src/game/game.js` — the service door is a real interaction
  (`tunnelDoor`): toggles the leaf, swings the mesh, disables the collider
  while open, creaks, and speaks a line. Prompt reads "E open the service
  door" / "E close the service door". Also `undergroundPlace()`, the named
  section lookup for the HUD, so the location card no longer says
  "Tuluyan Road" while you are under the house.
- `scripts/underground_probe.cjs` — end-to-end walker (drives the real
  `Player`: same `blocked()`, same `floorHeightAt()`, same `extraFloors`, at
  60 Hz).
- `scripts/underground_shots.cjs` — the screenshot pass.
- `_backup/underground_2026-10-30/` — copies of `underground.js`, `game.js`,
  `terrain.js`, `plan.js` from before the work.

## Tests performed

`SILID_URL=http://127.0.0.1:5199/?probe=1 node scripts/underground_probe.cjs`
against the running dev server:

- **Legs that did not arrive: none.** Basement → east door → tunnel → cave →
  chamber → vault → court → flight → forest, then the same route back to the
  basement junction.
- **Service door:** prompt "E open the service door" while closed; after
  `E`, `openBefore: false → openAfter: true`, `colliderDisabled: true`.
- **Emergence:** `{x: 70.09, z: 7.9, y: 0.78, surface: "dirt"}` — on the
  forest floor.
- **Return:** back at `{x: 11.39, z: 6.0, y: -3.40}` in the basement.
- **Blocked points on the walked centreline: none.**
- **Biggest single-frame footY change: 0.032 m** — i.e. no jumps, every
  rise is a tread or a ramp the controller actually resolves.
- **Scene:** 493 draw calls, 1,231,854 triangles, 58 fps in the headless run.
- **Console:** one `pageerror`, `A user gesture is required to request
  Pointer Lock.` — Playwright has no user gesture; not a game fault.

HUD section labels read from the live DOM at each spot: Tunnel Junction /
Service Tunnel / Rock Passage / Vaulted Passage / Cistern Court / Cistern
Yard, all under BASEMENT, UNDERGROUND or CISTERN YARD instead of the road.

`node scripts/scan_apps.cjs` — phone wiring still OK, verdict unchanged.

Screenshots (running game, 1280×720): `01_basement_corridor`,
`02_basement_depth`, `03_tunnel_entrance`, `04_tunnel_vault`,
`05_court_lit`, `06_service_door`, `07_forest_emergence`.

## Remaining defects / limits

- The location card goes blank outdoors (pre-existing behaviour: the card is
  house-only); the forest emergence inherits it.
- The exit door is not locked — the brief allows an open route or a fair lock.
  It is open, so the escape cannot dead-end.
- Enemy AI was not re-tested underground; the existing resident navigates the
  house, and no encounter is staged in the tunnel.
- No audio was added for the tunnel beyond the existing creak on the door.
