# SILID — road and environment materials repair

2026-10-27. Scope of this pass: restore the realistic rural-asphalt road, put the
environment materials on a correct real-world scale, and make the car read as a
physical object on that road. Architecture, layout, story, inventory, enemy and
control systems were not touched.

The work was done against the actual project (`C:\Users\Admin\Downloads\SILID-main`,
Three.js 0.160 + Vite 5) and the actual supplied scene
(`Blender/AssetLibrary/Working/Opening/SILID_Act1.blend`), not from a mock-up.

---

## 1. What the supplied blend actually contains

Read headlessly with `scripts/inspect_blend.py` and `scripts/probe_road_uv.py`
(Blender 4.2.23). This is the reference for "the way the road looked before":

| item | fact from the file |
|---|---|
| carriageway | `SM_Road_Act1`, 5.8 m wide × 141 m long, 0.24 m thick slab |
| road material | `PBR_asphalt_02` — `asphalt_02` 2k diffuse + OpenGL normal + roughness |
| road tiling | slab UVs are in **metres**; Mapping scale `0.3125` = **one repeat per 3.2 m** |
| centre line | 22 × `SM_RoadDash_*`, 0.14 m × 2.6 m, **6.4 m pitch** |
| edge lines | `SM_RoadEdge_E/W`, 0.10 m × 138 m, inset from the asphalt edge |
| repairs | 9 × `SM_RoadPatch_*` (~1 every 15.7 m), 5 × `SM_RoadCrack_*` (~1 every 28 m) |
| line paint | `ACT1_line`, base colour 0.62/0.60/0.50, roughness 0.9 |
| car | a modelled `CAR_*` vehicle (body 4 822 faces, four 4 016-face tyres, engine bay, bonnet, interior) with `CAR_Paint` (metallic 0.4, **roughness 1.0**) and `Glass` |
| missing maps | 7 of 31 images have no path because they are packed; all 24 file-backed images resolve to `Blender/AssetLibrary/Source/PolyHaven/` |

The blend's markings, tile size and line paint are the specification used below.
The original file is untouched; the edited copy is
`Blender/AssetLibrary/Working/Opening/SILID_Act1_road_work.blend` (both are
git-ignored on purpose — `Working/**/*.blend` is a ~600 MB build tree).

## 2. Defects found in the game (not in the blend)

1. **The road was tiled 13× too densely.** `buildRoad()` wrote
   `uv = (0..1 across, z*0.1 along)` and then `tileMaps(asphalt, 1.6, 40)`.
   Across, a 7.2 m carriageway got 1.6 repeats (4.5 m per tile); along, 400 m got
   1 600 repeats (**0.25 m per tile**). A 3.2 m asphalt photograph at 0.25 m
   repeats is mip-mush, which is why the tarmac rendered as a flat black plane.
2. **The road colour double-darkened the photograph.** The material tint was
   `0x6c6d6b` (0.42) multiplied over an already dark asphalt map, where the
   blend multiplies the same map by a near-white 0.8.
3. **The road floated 70 mm above the ground.** The ribbon sat at a constant
   `y = 0.075`; `heightAt()` — which grounds the player and the vehicle — returns
   `0.005` there. The SUV's tyres and the player's boots stood inside the tarmac,
   and the verge strips were straight `PlaneGeometry` anchored to `ROAD_X`,
   ignoring the bend, which is the "floating slab" visible at the roadside.
4. **`material.clone()` shares texture objects.** Any `tileMaps()` call on a
   clone rewrote the repeat of every mesh using the same texture (and was
   rewritten by whichever code ran last). The compacted-soil band was being reset
   to 2×4 and the grass verge to 1×1 after being set correctly.
5. **The carriageway was only two vertices wide.** With a 50 mm crown, the
   straight chord between the edge vertices sat below the terrain in the middle
   of the road, so the forest floor poked up through the tarmac. That was the
   "smooth streaky surface" left after fixing (1).
6. **No markings, patches, cracks or broken edge** — the road was bare asphalt,
   though the blend's road has all four.
7. **Car materials.** The blend's paint roughness of 1.0 is a placeholder, and in
   the game the paint was `metalness 0.04` at 0.74 roughness under a sky with
   **no environment map**, so the body was a black silhouette with no shoulder
   highlight. Tyres were 18-sided.

## 3. What changed

### `src/world/terrain.js` (+233/−51)
- `heightAt()` now includes the carriageway crown (50 mm at the centreline,
  falling to the verge), so the visible road, the walker and the vehicle are one
  surface. This also removed the 70 mm step under the tyres.
- New road builder: bands that follow the centreline and sample `heightAt()`,
  with **UVs in metres** and enough cross-section columns (13 across the
  carriageway) for the crown to be real geometry.
- Surface programme, in order: 2.35 m mud verge (12 m apron) → 4 m compacted
  soil shoulders → 2.0 m broken-asphalt edge strips → 7.2 m carriageway at the
  blend's **3.2 m** tile → 26 resurfaced patches (2.08 m `asphalt_01`) → 14
  tar-sealed cracks → 2.6 m centre dashes on a 6.4 m cadence → 0.10 m edge lines
  at ±3.3 m → a 4 m grass verge with a wandering, non-straight outer edge.
- Everything is a decal a few millimetres above the asphalt with polygon offset;
  nothing here is a collision surface, and the carriageway stays smooth enough to
  drive.
- `CARRIAGE = 7.2` is now a named export next to `CAR`: the width the opening
  sequence's pull-off (`PULL_OFF = 4.3`) already depended on.

### `src/world/materials.js` (+88)
- `TILE` / `tileOf()`: the real-world size of one texture repeat for every
  surface that uses it, taken from the Poly Haven asset dimensions.
- `tileAtMetres()`: sets `1/tile` and **clones the texture objects first**, so a
  material that is given its own scale owns its maps (fixes defect 4).
- New sets: `asphalt_01` (roadPatch), `worn_asphalt` (roadEdge), `mud_forest`
  (groundMud), `tree_bark_03` (barkMoss).
- `CAP_BY_SET = { asphalt: 1024 }`: the carriageway alone gets 1k (≈320 px per
  metre at the 3.2 m tile); every other surface stays at the 512 px budget that
  keeps the whole texture set inside an Intel HD 4600's shared memory.
- Asphalt tints corrected toward the blend's near-white base.

### `src/world/car.js` (+55/−20)
- Paint is a dielectric (`metalness 0.06`, roughness 0.38) with a clearcoat-like
  sheen; glass 0.09 roughness / 0.2 metallic / 0.58 opacity; chrome 1.0 metallic;
  rubber 0.94 roughness; trim, cloth and headlamp glass brought in line with the
  blend's `ACT1_*` materials; tail lamps slightly stronger.
- Headlight cones: 0.42 rad, 0.55 penumbra, 55 m, aimed lower so the beam falls
  along the tarmac instead of flooding the trees.
- Tyres 24-sided, rims 16-sided (≈1 k extra triangles for all four wheels).

### `src/world/forest.js` (+13/−2)
- The banyan and subcanopy archetypes now use the mossy `tree_bark_03` bark
  (3 repeats around, 6 along a swept trunk), the rest keep `bark_brown_02`. Same
  instancing, one extra material; the wood is no longer one tree repeated 600
  times.

### The blend working copy
`scripts/edit_opening_road.py` edits only the road material and the car:
- `PBR_asphalt_02`: normal strength 1.0 → 0.7 (a full-strength 2k normal on a
  3.2 m tile reads as noise); tiling confirmed at 0.3125 (1 repeat / 3.2 m) — no
  change needed, it was already right.
- `CAR_Paint`: roughness 1.0 → 0.45 (metallic 0.4 kept).
- `Glass`: roughness → 0.12, metallic → 0.45, base → (0.10, 0.14, 0.15).
- Nothing added, deleted or moved; no other object or material touched. Report:
  `reports/road/blender_materials.json`.

## 4. Materials selected

All CC0 1.0 (Poly Haven), 1k JPG, downloaded 2026-10-27. Per-map URL, byte count
and md5 are in `Blender/AssetLibrary/Source/PolyHaven/<slug>.provenance.json`;
the tracked record is in `ASSET_LICENSES.md`.

| slug | used as | real tile | why this one |
|---|---|---|---|
| `asphalt_02` (already present) | carriageway | 3.2 m | the blend's own road asphalt — keeping it is what preserves the previous look |
| `asphalt_01` | patches / resurfacing | 2.08 m | same aggregate family, worn and laid differently, so repairs read as repairs |
| `worn_asphalt` | broken edge | 2.0 m | cracked, gravelly asphalt with leaf litter — the failure at the edge of the tarmac |
| `mud_forest` | verge | 2.35 m | wet compacted forest mud with leaves and sticks, for the roadside transition |
| `tree_bark_03` | balete / subcanopy bark | 1.0 m | deep fissures with moss in the crevices — variation against `bark_brown_02` |

`rural_asphalt_road` from the brief is an **HDRI**, not a texture; it was not used
for the road surface. The road is lit by the game's own night sky and lamps.

## 5. Verification

Run against the live dev server (`npm run dev`, port 5333) and headless Chromium
through `?probe=1`, i.e. the real renderer and the real player controller.

| check | result |
|---|---|
| `npm run build` | clean (913 kB bundle, 4.5 s) |
| `node scripts/scan_apps.cjs` | app wiring present in `src/game/game.js` |
| `node scripts/opening_e2e.cjs` | car parks on the shoulder, door opens to 1.05 rad, player 1.8 m from the car, bonnet/ignition/trunk interactions answered, `errors: []` |
| `node scripts/audit_mansion.cjs` | all sampled rooms free on their floor, `errors: []` |
| `node scripts/stealth_test.cjs` | hiding/peeking/detection checks all true, `errors: []` |
| runtime console | no page errors or console errors across every screenshot run |
| texture scale probe | `SM_Road` 0.3125 (3.2 m), patch 0.4808 (2.08 m), break 0.5 (2.0 m), verge 0.4255 (2.35 m), soil/grass 0.25 (4 m) |
| scene cost at the road | 39–125 draw calls, ~692 k triangles, 31–34 textures |
| car contact | `carBodyY` 0.011 vs road surface 0.016 → wheels 5 mm into the tarmac (was 70 mm) |

Screenshots (real frames from the running game):

- `reports/road/before_after_road.png` — before/after at identical coordinates:
  tarmac close-up, road ahead, verge, car.
- `reports/road/before/` and `reports/road/after/` — the individual 1280×720
  frames (`01_surface_closeup`, `02_road_ahead`, `03_shoulder_verge`,
  `04_car_rear`, `05_car_front`, `06_car_threequarter`, `07_road_far`).
- `reports/look/e_down.png`, `e_closeup.png`, `e_edge.png` — torch on the road,
  showing the aggregate and the tar cracks the moonlight does not reveal.
- `reports/road/after/car_torch_side.png` — torch on the car.
- `reports/road/blender/01_road_driver_eye.png` … `04_car_threequarter.png` —
  Cycles renders of the **edited blend**, for comparison with the game.

## 6. Remaining limitations (honest list)

- **Carriageway width.** The game keeps its authored 7.2 m carriageway so the
  opening sequence's pull-off and colliders stay valid; the blend's slab is
  5.8 m. The markings are laid out for 7.2 m (edge lines at ±3.3 m), the dash
  cadence and widths are the blend's.
- **The car is still a constructed model**, not the blend's modelled SUV. Its
  materials, lamps and wheel silhouettes were improved. `public/assets/models/car.glb`
  is unusable as a whole vehicle: 40 separate nodes (`UCR_GENSUV_*` kit parts)
  whose combined bounding box is 21.7 × 4.4 × 11.9 m — the exploded damage
  variant the current car was written to replace. Swapping in the blend's car
  would require re-binding the wheels, driver's door, bonnet, headlight spots,
  tail/indicator/cluster materials and dash light that `opening.js` drives, so it
  was not done inside a road/materials pass.
- **The game has no environment map**, so the blend's metallic 0.4 paint cannot
  look the same in-game. The game uses a dielectric paint; the blend keeps 0.4.
- **Texture repetition.** `asphalt_02`'s tar cracks repeat every 3.2 m, which is
  visible at very close range. Enlarging the tile would break the authored scale;
  a second detail layer would cost another texture set on this GPU.
- **The car sits 5 mm into the asphalt** (the walker/vehicle are grounded on
  `heightAt`, the road mesh is 5 mm above it to avoid z-fighting).
- **Blender's EEVEE renders every lit surface black in this headless session**
  (the sky still draws), so the blend evidence renders use Cycles CPU. This is a
  renderer/driver issue on this machine, not a scene problem.
- **Not added:** the blend's delineator posts, power poles and gate furniture.
  They are scene dressing outside the road surface, and this pass deliberately
  did not add props.
- `ASSET_LICENSES.md` claims its tables are generated by
  `scripts/asset_licenses.mjs` and that maps are fetched by
  `scripts/fetch_pbr_textures.mjs`; neither file exists in the repository. The
  new rows were recorded by hand in the same format and the provenance JSONs
  written beside the source maps.
- No FPS figure is claimed. The headless renderer is not the target GPU; the
  measured draw calls and triangles above are the comparable numbers.

## 7. Reproducing

```
npm run dev                                        # game at :5333
node scripts/shoot_road.cjs reports/road/after     # road/car screenshots
node scripts/_look.cjs "e_down=-63.2,1,0,3.14159,-1.45"   # torch close-up
node scripts/_roadprobe.cjs                        # live tile/UV/repeat check

# blend inspection and evidence renders
blender -b Blender/AssetLibrary/Working/Opening/SILID_Act1_road_work.blend \
        -P scripts/inspect_blend.py
SILID_ENGINE=CYCLES SILID_SAMPLES=16 \
blender -b Blender/AssetLibrary/Working/Opening/SILID_Act1_road_work.blend \
        -P scripts/render_opening_road.py
```

Original blend and original JS backups:
`_backup/opening_2026-10-27/` (`SILID_Act1.original.blend`, `terrain.js`,
`car.js`, `materials.js`, `forest.js`, `sky.js`).
