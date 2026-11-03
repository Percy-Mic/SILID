# Stair collision — treads, risers, landings

Measured in the running Vite scene (`http://127.0.0.1:5333/?probe=1`), not inferred
from source.

## The defect

For every flight, the collision surface was compared against the actual tread
mesh at 48–49 points along the run: what `floorHeightAt()` reports, versus a
downward raycast onto `StairTreads`.

**Before the fix**

| Flight | Riser | Error at the boards |
|---|---|---|
| GF → F2, lane A | 0.175 m | −0.175 to −0.350 m |
| GF → F2, lane B | 0.175 m | −0.175 to −0.350 m |
| F2 → F3, lane A | 0.173 m | −0.173 to −0.345 m |
| F2 → F3, lane B | 0.173 m | −0.173 to −0.345 m |
| F3 → F4, lane A | 0.171 m | −0.171 to −0.343 m |
| F3 → F4, lane B | 0.171 m | −0.171 to −0.343 m |
| GF → B1 (basement) | 0.200 m | 0 |

The body was held **one whole riser inside the board it was walking over**. It
did not fall through — the query held it up — but the eye sat 17–35 cm low and
the legs clipped through the front of every step. The basement flight was
already correct, which is what identified the cause.

**The cause.** The two builders number treads differently. `flight()` draws
tread *k* with its top at `yLow + (k+1)·riser` — the first board you step on is
already one riser up. `stairHeightAt()` computed `y0 + (i/steps)·Δ`, i.e. it
treated index *i* as the board below. The basement stair counts its first step
from the floor it lands on, so it was accidentally right.

## The fix — `src/world/architecture.js`

1. `buildStairs()` marks its four floor-to-floor ramps `yMode: 'riserAbove'`, and
   `stairHeightAt()` adds the +1 only for those. The basement flight keeps its
   existing convention (verified: still 0 error).
2. **Nose.** Each tread board overhangs the riser below it (14 mm on the grand
   stair, 25 mm on the basement's). The collision split now happens at the nose
   rather than at the riser face, so that overhanging sliver belongs to the
   step above — `nose` on each ramp, applied as `z + sign(z1−z0)·nose`.
3. **Hard ends.** The flight test used to extend 0.15 m past each end, which was
   harmless while the query was a riser low. With the tread counted correctly
   that band would lift a body still standing on the foyer floor, so the band now
   stops 0.02 m outside the boards.

## After the fix

| Flight | Error |
|---|---|
| GF → F2, lane A / B | 0 / 0 |
| F2 → F3, lane A / B | 0 / 0 |
| F3 → F4, lane A / B | 0 / 0 |
| GF → B1 | 0 |

All three half landings (2.10, 6.10, 9.886 m) and the flight-to-landing
transitions match the board surface to **0.000 m** at nine points each.

The remaining measured deltas sit inside the tread's nosing (±1.4 cm / ±2.5 cm),
where the drawn board is ahead of the collision step and the sample is a
floating-point tie between two boards; nothing walks there for more than a frame.

## Climb still works

`scripts/traverse_mansion.cjs` drives the real `Player` up lane A, across the
half landing and down lane B with `KeyW` held — no teleporting:

| Leg | Arrives | Stalled |
|---|---|---|
| GF → F2 → F3 → F4 | 4.2 / 8.0 / 11.6 | no |
| F4 → F3 → F2 → GF | 8.0 / 4.2 / 0.0 | no |
| Half landing, west lane → east lane | 6.1 | no |
| GF → B1 and B1 → GF | −3.38 / 0.0 | no |

`ALL FLOORS REACHED: true  BASEMENT BOTH WAYS: true`

`npx vite build` passes.

## Tooling added

- `scripts/stair_collision_audit.cjs` — the measurement above; writes
  `reports/stair_check/collision_audit.json`.

## Not fixed

- The bottom tread of the basement flight is level with the basement floor
  (a 17-riser flight that ends flush). Cosmetic, does not affect walking.
- The unsupported masonry block in the foyer and the bare curtain rod on the
  foyer wall, noted in `REPORT.md`, are unrelated to collision and still open.
