# SILID — the living forest and the estate

The woods around the Tuluyan road are now the estate the plan describes: five
walking paths, a hill you can climb, a stream with a bridge, a pond, the older
chapel-house that burned, three rice terraces, and a grave at the end of a
hidden path. Act I is untouched in story order — the road, the breakdown, the
walk and the door still run exactly as before; the estate hangs off the walk.

Research: [docs/research/SILID_RESEARCH.md](docs/research/SILID_RESEARCH.md)
sources, and the two CC0 Poly Haven texture sets in
[ASSET_LICENSES.md](ASSET_LICENSES.md).

## What is implemented

| File | Role |
| --- | --- |
| `src/world/Estate.js` | **New.** The estate's plan in one file: `ESTATE` (hill, pond, stream, paddies, ruins, bridge, grave), `estateOffset(x, z)` — the ground shape, added to the height field — `estateBlocked(x, z)` — the keep-out every planting pass reads — and `buildEstate()` (ruins, bridge, banca, reeds, lilies, stream, marsh, terraces, scarecrow, cairn, grave) with its six finds. |
| `src/world/Terrain.js` | Applies `estateOffset` after the noise and before the rim, outside the flat mask, so the renderer and the walker still read one surface. |
| `src/world/ForestTrails.js` | Five paths, 533 m: `west-loop` (94 m), `east-loop` (118 m), `estate-loop` (158 m, the main circuit), `hidden-path` (42 m, the grave loop), `paddy-route` (122 m, the map's alternative route to the mansion approach). Seven clearings, including the summit, the pond banks and the paddies. |
| `src/world/Wildlife.js` | Frogs only within 26 m of the pond (a filtered pulse, with an answering second call), and one sparse night-bird call (frogmouth's two-note, 26–60 s apart). Both after dusk. |
| `src/horror/ForestEvents.js` | Two estate one-shots: a pale light that rises and sinks in the pond (34 m), a candle in the ruin doorway (42 m). Each capped at once a night, inside the same 45 s silence the road refuses. |
| `src/world/ForestFinds.js` | The north marker post moved 1 m out of the trailhead lane, where the paddy route now joins the west loop. |
| `src/game/app.js` | Builds the estate after the finds (same interactable/barrier/floor registries), keeps trees, ferns, grass, rocks and undergrowth out of the estate's wet and built ground, and exposes `estate` on `__silid`. |

## The plan, as coordinates

| landmark | world position | what stands there |
| --- | --- | --- |
| forest hill | (−86, −120) | 7.5 m summit, the survey cairn, a log to sit on. The only open sky in the woods. |
| old ruins | (−60, −105) | a roofless chapel-house, dated 1863 on the altar stone, with a doorway facing the trail |
| stream + bridge | (−48, −127) | hill → pond → bridge → marsh; the bridge deck is 3.8 m wide and is in the floor list, so the body walks it |
| pond | (−62, −138) | a 9.5 m basin 2.8 m below its banks, reeds, lily pads, and a swamped banca |
| paddies | (12–34, −52…−84) | three terraces, each 0.58 m below the last, bunds as steps, a scarecrow wearing the house's laundry mark |
| hidden grave | (−94, −150) | R. MABINI — the name on the tricycle's delivery slip |

## Design rules the code enforces

* **The woods close because the trees say so, not because a wall does.** No
  invisible barriers were added outside the props' own footprints.
* **Nothing solid is invisible.** Every new collider is named for what it is
  (`find_ruins_wall`, `find_bridge_rail`, `find_banca_hull`,
  `find_scarecrow_post`, `find_lookout_seat`), and the bridge deck and the
  ruin's slab go into the *floor* list, because you stand on them.
* **Water is not solid.** A shallow stream is something a body wades; the
  pond is 2.8 m deep at the middle and the banks are walkable.
* **The road stays Act I's.** The director still refuses the asphalt, and the
  wildlife still keeps 4.2 m off the face.

## Verification

### Passed — static (`node scripts/forest_static.mjs`)

Browser-free, importing the real `makeHeightAt` and the real estate:

* every path closes or returns to something the player already walks, stays
  inside the world, and walks at < 0.45 m/m (the estate loop's climb is 0.29);
* **the estate's ground is real**: the hill is 6.94 m above its base, the pond
  is 2.87 m below its banks, the stream under the bridge is a 1.03 m channel,
  the paddies step −1.02 / −1.60 / −2.18;
* every find is within 9 m of a path, out of the walled yard and off the
  asphalt, and nothing solid stands in a walk lane;
* nothing is planted in the wet or built ground, and no find stands in the
  pond.

### Passed — in-engine (`node scripts/forest_probe.cjs --tag=estate`)

The full battery boots the real game. The completed run reached 52 checks:

* five paths built (533 m total), 303 ferns, 109 deadfall, 16 bats, 44 fireflies;
* eleven finds in the woods, all with real coordinates, all labelled colliders;
* every find answers the crosshair, and eight write a page into the phone;
* the power bank is a real pickup; the roost erupts, re-arms, and the bats
  actually move (max delta 2.2 m over 1.5 s of the game's own clock);
* all five events fire, and the director refuses the road;
* colliders are honest at the campsite, glade, west trailhead, ruins, pond
  bank, bridge and paddies — 0 phantom cells, 0 phantom trunks;
* a real keypress walk: W moves the body 7 m down the trail, E at the
  trailhead is answered by the marker.

The last three lane failures in that run were the bridge: the deck was 2.6 m
wide and the trail ribbon is ~1.9 m, so the ±1.5 m lanes walked into the rails.
The deck is now 3.8 m. The re-run to confirm that is **blocked by the machine**:
Chromium dies with `Committing semi space failed — JavaScript heap out of
memory` (8 GB RAM, ~1.8 GB commit free, `C:` at 100 %). Two retries, both the
same. The static checks that cover the same geometry pass.

### Not measured — frame cost

The estate adds one group of static meshes, two instanced meshes, one stream
ribbon and three water planes. It has **not** been measured with
`perf_probe.cjs`; the before/after comparison still needs to be run once the
machine has room.

## What was cleaned up to make room

`C:` is at 100 %, and Chromium dies at the margin. Three regenerable build
intermediates were removed: `Blender/AssetLibrary/Working/House/_qc/walls_only.glb`
and `walls_CLIP.glb` (38 MB each, Oct 17 wall-export QC intermediates) and
`reports/cast/_tmp_blend1.blend` (21 MB). None of them is an input to any
current build or check.

## How to re-run the verification

From the project root, with the dev server on 5333:

```
node scripts/forest_static.mjs                # geometry and placement, ~2 s
node scripts/forest_probe.cjs --tag=estate    # the full in-engine battery
node scripts/perf_probe.cjs --tag=estate_perf # the six reference views
```

## The minimal lane probe

`scripts/estate_lanes.cjs` is a stripped-down probe that boots the world and
marches **only** the estate loop’s three lanes at 0.3 m. It exists because the
full battery holds the 143 MB world, drives five events, presses keys and renders
eight screenshots, and on this machine (8 GB RAM, ≈1.8 GB commit free, C: at
100 %) Chromium dies with a heap OOM before reaching the walk.

The minimal probe gets further — it confirms the world boots and the estate
builds (`[walk] estate: 6 sites, 10 solids, pond y -0.67`) — but dies at the
same place: the shader warmup, right before the lane march runs. Three retries,
all identical. The bridge deck width fix (2.6 → 3.8 m) is verified **numerically**
in Node instead: deck half-width 1.9 m ≥ lane offset 1.5 m, the trail waypoint
sits exactly on the bridge centre, and the deck-to-bank step is 0.13 m against a
0.34 m STEP_UP, so the body can walk onto it.
