# Grand staircase — reconstruction report

Date: 2026-10-31
Scope: the main four-storey staircase in the foyer (the basement service stair is
separate and was not changed).

## 1. Measured plan (actual values in `src/world/plan.js`)

| Storey | Floor y | Clear height | Risers per flight pair | Riser | Flight run | Going |
|---|---|---|---|---|---|---|
| GF  | 0.000  | 4.2 | 12 + 12 = 24 | 0.1750 | z 9.20 → 6.10 | 0.2583 |
| F2  | 4.200  | 3.8 | 11 + 11 = 22 | 0.1727 | z 9.20 → 6.10 | 0.2818 |
| F3  | 8.000  | 3.6 | 11 + 10 = 21 | 0.1714 | z 9.20 → 6.10 | 0.2818 / 0.3100 |
| F4  | 11.600 | —   | roof level | | | |
| B1  | −3.400 | 3.0 | service stair, north end of the service hall | | | |

- **West lane (flight A):** x −4.97 … −3.85, 1.12 m wide, climbs north.
- **East lane (flight B):** x −3.43 … −2.31, 1.12 m wide, returns south.
- **Half landing:** x −4.97 … −2.31, z 4.25 … 6.10, at half the storey rise.
- **Open well between the flights:** 0.42 m.
- **Floor opening:** x −5.00 … −2.10, z 4.25 … 9.20, cut through F2, F3 and F4, so
  each flight climbs in a genuine open shaft rather than under a slab. The roof
  closes the shaft at 16.37 m.
- **Sections:** tread board 0.055 m thick with a 0.014 m nosing, riser board
  0.022 m, closed string 0.075 × 0.36 m, handrail 0.95 m above the pitch line,
  balusters at 0.135 m centres, turned newels at the open ends.

## 2. Defects found and repaired

1. **Open risers.** The riser board was placed at `zFar` — the *back* edge of its
   tread, one whole going up the flight — instead of at `zNear`, under the nose.
   Every step therefore stood open: a ray cast down the well from F3 passed
   between the treads and hit the F2 slab, and the staircase read as bright bars
   of floor below. Fixed by moving the board to the near edge, behind the
   nosing. Its height was already correct (`riser − tread thickness`, because
   the tread's own end face closes the rest of the step).

2. **Mirrored stringer.** The closed string's pitch was computed as
   `atan2(dy, dir · dz)`; `dir` folded the north-running west flight back onto
   +z, so that string was built as a mirror of its own flight. It crossed the
   treads at mid-flight, hung off the plaster and ended in mid air. Replaced
   with the signed `atan2(dy, dz)`, and the string lengthened from `run + 0.10`
   to `run + 0.34` so both ends bury themselves in the slab they land on instead
   of stopping in a blunt cut.

3. **Flight standing off the wall.** The west lane started at x −4.85, 150 mm
   clear of the foyer's west wall at x −5.00, with nothing on that side at all.
   `STAIR.ax` moved to −4.97: the stringer now sits against the plaster and the
   well between the flights widened from 0.30 m to 0.42 m.

4. **Bare wall on the wall side.** Added a timber wall rail on iron brackets
   (0.085 m off the plaster, 0.95 m over the pitch, flanged at both ends) for
   the west flight of every storey, matching the comment that had promised one
   and the turned balustrade on the well side.

## 3. Files changed

- `src/world/architecture.js` — riser placement, string pitch and length,
  `wallRail()` helper and its call on flight A.
- `src/world/plan.js` — `STAIR.ax` −4.85 → −4.97, with the reason recorded.
- `scripts/traverse_mansion.cjs` — lane centre updated for the moved flight,
  half-landing waypoint tolerance tightened so a successful crossing is not
  reported as a miss.
- `scripts/stair_shots.cjs` — evidence camera list, per-frame filter
  (`SILID_SHOTS`), and a night mode (`SILID_INSPECT=0`).
- Backups: `_backup/stairs_2026-10-31/{architecture.js,plan.js}`.

## 4. Tests actually run

1. **Real-controller traversal** (`scripts/traverse_mansion.cjs`) — drives the
   actual `Player` and floor queries, walking the U: GF→F2, F2→F3, F3→F4, then
   F4→F3, F3→F2, F2→GF, plus the half landing at constant height and the
   basement service stair both ways.
   Result: `ALL FLOORS REACHED: true`, `BASEMENT BOTH WAYS: true`; all six legs
   `reached: true`, `stuck: null`; the landing crossed from lane to lane at
   6.10 m.
2. **Head clearance**, first pass (raycast up from eye height at the stair
   head, half landing, foot and top tread of each storey): smallest gap above
   the eye **1.76 m** at the F3 stair head under the F4 slab. Superseded by the
   full-climb measurement in section 5, which found 1.72 m.
3. **In-game screenshots** on the running dev server, 1280×720:
   `01_foot`, `02_first_flight`, `03_half_landing`, `04_f2_arrival`,
   `05_well_from_f2_hall`, `06_looking_up`, `07_f3_flight`, `08_f3_arrival`,
   `09_f4_arrival`, `10_f4_landing`, `11_descend_from_f3`,
   `12_string_wall_side`, plus `01/04_*_night.png` under the game's own night
   lighting.
4. **Static checks:** `node --check` on both edited modules; `npx vite build`
   completes (only the pre-existing >500 kB chunk warning);
   `node scripts/scan_apps.cjs` still reports the phone interface wired.

## 5. Opening and head-clearance verification (`scripts/stair_verify.cjs`)

Measured in the running game after the repairs above. Exit code 0 = PASS.

**Floor openings.** Downward rays over the stairwell at 50 mm centres, tested
against each storey's own `Floor_<id>` mesh (not against the floor query, so a
slab that silently still covered the stair would show up):

| Level | void measured | plan | edge error | slab across stair | stray voids |
|---|---|---|---|---|---|
| F2 | x −4.95…−2.10, z 4.30…9.15 | x −5.00…−2.10, z 4.25…9.20 | 0.05 m | 0 | 0 |
| F3 | x −4.95…−2.10, z 4.30…9.15 | same | 0.05 m | 0 | 0 |
| F4 | x −4.95…−2.10, z 4.30…9.15 | same | 0.05 m | 0 | 0 |

The 0.05 m is the sample grid: the true edge falls between samples. Nothing
from any storey's slab crosses the stair, and there is no void outside the
intended opening — so no floor is missing where the player walks, and the
flights are not open into a room they should not be.

**Head clearance.** Upward ray from the real `Player`'s eye every sixth frame
of a full climb per storey — west lane, across the half landing, east lane,
then off onto the floor:

| Climb | minimum above eye | where it occurs | climbed to |
|---|---|---|---|
| GF→F2 | 1.94 m | F2 floor, under the F3 slab | 4.20 ✓ |
| F2→F3 | 1.74 m | F3 floor, under the F4 slab | 8.00 ✓ |
| F3→F4 | 1.72 m | F3 floor, under the F4 slab edge | 11.60 ✓ |

All three are simply the storey's own clearance (rise − 1.68 m eye − 0.165 m
slab). Nothing on the climb — beam, landing soffit, stringer or slab — comes
closer to the head than that. Stepping off on each floor puts the foot exactly
on the level (4.20 / 8.00 / 11.60), not inside the slab, with 1.74–1.94 m of
clearance above the eye.

Diagnostic note: an earlier version of this probe steered the landing turn at
z 6.2, which is 0.10 m outside the landing (it ends at 6.10); the body then
oscillated on the top tread. That was the probe's waypoint, not the staircase.
The turn is now taken at z 5.5, as the traversal test does.

## 6. Remaining issues / limitations

- The stair tower is tight: 1.12 m flights with a 0.42 m well. A broader well
  would need a wider shaft in the plan, which is outside this repair.
- The going varies between flights (0.258–0.310 m) because the run is fixed at
  3.10 m while riser counts differ per storey. Each flight is internally
  uniform and the difference is not readable in play, but a purist would make
  the run match the riser count.
- The interior face of the foyer's south wall renders with the exterior ashlar
  material in some views. This is pre-existing architecture, not the stair.
- The probe adds its own inspection light for the geometry shots. `01_foot`
  and `04_f2_arrival` were then re-shot under the game's own night lighting;
  the `_night` files are copies of those two, so those frames are the honest
  lighting reference.
