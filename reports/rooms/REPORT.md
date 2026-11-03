# Imported GLB rooms — integration report

Three captured/modelled interiors now stand in the mansion:

| Asset | House room | Storey | Entry | Placed at |
|---|---|---|---|---|
| `interrogation_room.glb` | B-05, renamed *Interrogation Room* | Basement, floor −3.40 | B-06 service passage, door at x 10.5 on z 2 | x 10.5, z 1.86, y −3.38 |
| `the_great_drawing_room.glb` | GF-13, *Formal Living Room* | Ground floor, floor 0.00 | gallery door at x −10 on z 2 | x −10, z 2.11, y 0.02 |
| `the_billiards_room.glb` | FF3-04, *Billiards Room* | Attic, floor 8.00 | gallery door at x −10.5 on z −2 | x −10.5, z −2.11, y 8.02 |

Source files stay in `Blender/AssetLibrary/`; the prepared copies are in
`public/assets/rooms/` and are what the game fetches. The originals are untouched.

## Preparation (`scripts/prep_rooms_blender.py`)

Each asset is a shell captured at an unknown scale and yaw with its doors baked into the
texture, so each one is re-framed rather than dropped in raw:

* **Scale.** The billiards scan is roughly 3× life size and is scaled to 0.32 so its 16 m floor
  becomes 5.13 × 7.01 m and its table lands at a true 0.85 m. The drawing room is 0.734 of its
  capture (11.95 m depth into GF-13's 8.78 m). The interrogation scan is already 1:1.
* **Yaw.** 0.25, 48.25 and 16.75 degrees, measured from the wall normals.
* **Frame.** Common frame: floor at y = 0, entry wall on z = 0, interior toward −z, centred on x = 0.
  That frame is what `glbRooms.js` places, so the game never guesses.
* **Doorway.** The scans' doors are closed leaves in the shell. A 1.0 / 1.2 / 1.3 m × 2.12 m
  aperture is cut where the house's own door meets it, finishing 3 cm under the house's 2.15 m
  door head so no band of corridor wall shows above the opening.
* **Ceiling.** Cut at 3.00 (basement), 4.18 (ground) and 3.50 m (attic) — matching each level's
  clear height rather than the capture's.
* **Budget.** Planar-dissolve then collapse to 130k / 200k / 200k triangles, UV seams delimited
  so the collapser cannot cross an atlas seam; textures capped at 512 px (cell) and 1536 px
  (the two large rooms), exported as JPEG inside the GLB. Files are 15 / 12 / 11 MB.

Materials are preserved: the scans' baked albedo is kept as the base map, with roughness 0.94
and metalness 0 so real lights (the mansion's lamps, the torch) fall on them. Nothing is
recoloured or replaced with a generic material.

## Game wiring (`src/world/glbRooms.js`, `src/main.js`, `src/world/props.js`, `src/world/plan.js`)

* `installRooms()` runs after `buildArchitecture()` and before `player.setWorld()`, so the
  collider array already holds the shells' side and back walls when the player receives it.
* `updateRooms()` is called from the existing frame loop: a room is fetched when the player is
  within 15 m and within 3.4 m of its floor, once. Three 11–15 MB files are never fetched at boot.
* No extra render loop: the imported meshes are lit by the scene; one shadowless point light and
  a shade per room, placed under the room's ceiling.
* `props.js` skips B-05, GF-13 and FF3-04 so the mansion's own furniture does not stand inside
  the imported interiors.
* `plan.js` names B-05 *Interrogation Room*, FF3-04 *Billiards Room*, and gives FF3-04 the door it
  was missing at z −2, x −10.5 (the attic's south block had no opening at all).
* Collision: the shells' side and back walls are registered as wall segments on the imported wall
  faces, so the strip of plan room outside the narrower shell is sealed off rather than walkable
  into the back of the scan. The billiards table gets a measured furniture box (ray-grid over the
  exported mesh: playing surface x −0.56..0.64, z −5.81..−3.61, rails included), not a guess.
* The billiards scan was captured with no ceiling (a ray straight up from its centre hits
  nothing). A plaster lid and cornice skirt close the top at 3.56 m, so the room is not open to
  the roof and the ragged top edge of the scanned walls is hidden.

## Verification actually run

* `scripts/prep_rooms_blender.py` through Blender 4.2 headless — exit 0, three `[prep]` records.
* Standalone asset inspection (`scripts/roomview.html`): each GLB loads, sizes 4.65×3.00×5.48,
  5.96×4.18×8.83 and 5.13×3.50×7.01 m; ceiling raycasts confirm the first two have ceilings and
  the billiards scan does not.
* In-game probe (`scripts/rooms_probe.cjs`, real Vite page, real `game.interact()` and
  `player.blocked()`), one pass per room — spawn in the corridor, open that storey's door, walk in
  at 3 cm steps, walk back out:

  | Room | Door | Walk in | Walk out | Tris | Materials |
  |---|---|---|---|---|---|
  | Interrogation | opened | reached z 0.58, 74 steps, no block | no block | 130,000 | 10 |
  | Drawing room | opened | reached z 4.41, 107 steps, no block | no block | 200,000 | 1 atlas |
  | Billiards | opened | reached z −4.41, 107 steps, no block | no block | 200,000 | 1 atlas |

  Frame at those points: 143–194 draw calls, 1.19–1.33 M triangles, 20–27 fps in software
  rendering at 800×450 — a real GPU is not the bottleneck here.
* `npx vite build` — exit 0, 33 modules, only the pre-existing chunk-size warning.
* `node scripts/scan_apps.cjs` — all checks OK.
* `node --check` on the changed game module — OK.

Screenshots: `reports/rooms/ingame/*.jpg` (each room and its doorway, from inside the running
game), plus `reports/rooms/*_entry.jpg` and `*_ceiling.jpg` from the asset viewer.
`reports/rooms/ingame/probe.log` is the raw probe output.

## Known limitations

* Each shell is narrower than the plan room it sits in (the plan's room keeps its walls and
  doorway). The leftover strip is sealed by colliders and unreachable, but it means B-05 and
  GF-13 are effectively the size of the scan, not of the plan rectangle.
* Furniture is visual except the billiards table; the settees, shelves and drawing-room chairs
  have no colliders. Adding boxes for all of it would block the narrow scan rooms.
* The interrogation scan's own ceiling sits at 2.36–2.97 m and reads as a dark, damaged soffit;
  it is the asset's appearance, not a lighting fault.
* The imported rooms neither cast nor receive shadows (deliberate, for the integrated-GPU target).
* The GLBs are fetched on approach; the first entry into a room pauses briefly while 11–15 MB
  parses, which is why the loader is warmed from 15 m out.
