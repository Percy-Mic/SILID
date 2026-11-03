# Staircase traversal test — live Vite server

Run against `http://127.0.0.1:5333/?probe=1` (the running dev server), driving the
real `Player` and `Game` classes. The probe does **not** teleport between floors:
it places the body at the foot of a flight and holds `KeyW`, steering at
waypoints along the two lanes of the U — up lane A, across the half landing,
back down lane B, and off onto the floor above. A leg fails if the body stops
moving for three consecutive frames.

Harness: `scripts/traverse_mansion.cjs`. Raw output:
`traverse_final.json`, summarised in `traverse_summary.json`.

## Results

| Leg | Start | End foot Y | Level reached | Room | Stalled |
|---|---|---|---|---|---|
| GF → F2 | 0.0 | 4.2 | F2 | Grand Stair Hall | no |
| F2 → F3 | 4.2 | 8.0 | F3 | Grand Stair Hall | no |
| F3 → F4 | 8.0 | 11.6 | F4 | Observation Gallery | no |
| F4 → F3 | 11.6 | 8.0 | F3 | Grand Stair Hall | no |
| F3 → F2 | 8.0 | 4.2 | F2 | Grand Stair Hall | no |
| F2 → GF | 4.2 | 0.0 | GF | Foyer | no |
| Half landing (west lane → east lane) | 6.1 | 6.1 | F2 | — | no |
| GF → B1 (service flight) | 0.0 | −3.38 | B1 | Basement Landing | no |
| B1 → GF (service flight) | −3.38 | 0.0 | GF | Service Hall | no |

`ALL FLOORS REACHED: true  BASEMENT BOTH WAYS: true`

Each storey-to-storey leg took 141–143 simulated steps (≈ 4.7 s of held
forward input at 33 ms per step); the downhill legs also leave the stair and
walk clear of the head, so they take 169. No leg was blocked by a slab, a
closing head, a wall, or a rail.

Floor elevations in use: **GF 0.0 · F2 4.2 · F3 8.0 · F4 11.6 · B1 −3.4**
(storey rises 4.2 / 3.8 / 3.6, matching `LEVELS` in `src/world/plan.js`).

## What the renderer shows

Captured at the foot of the stair and at the head of lane B on each floor
(`1_foyer_foot.png` … `4_arrive_f4.png`). The opening in each slab is real and
the flights rise through it; the railings follow the edge of the openings; the
half landing carries a body from one lane to the other at constant height.

## Problems seen while testing (not fixed by this run)

- **A pale masonry block stands in the middle of the foyer** to the east of the
  stair foot (visible in `1_foyer_foot.png`, and in your own foyer screenshot).
  It reads as a pier with nothing on top. Not identified yet.
- **A bare dark rod floats on the foyer wall** at about head height, with no
  curtain on it — the same detail visible in your dining-room screenshot.
- The half-landing soffit above the west flight is unlit and the ceiling edge
  above it is a hard black line in `2_arrive_f2.png`.

## Reproduce

```
npm run dev
node scripts/traverse_mansion.cjs
```
