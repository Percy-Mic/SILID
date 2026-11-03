# SILID — world validation (measured)

Everything below was produced by running the game in a real browser
(Chromium via Playwright against `npm run dev`, port 5333) and stepping the
player through the world with the game's own update loop. No result here is
inferred from a successful build.

Layout of record: [`src/world/plan.js`](src/world/plan.js) — six levels, one
coordinate system (metres, +x east, +z south toward the entrance, +y up).
The mansion footprint is x −24…22, z −11…11; the entrance is at z = +11;
the inner courtyard is the hole x 8…20, z −5…2 on every level.

## Automated checks and what they reported

| Check | Command | Result |
| --- | --- | --- |
| Boots, no page errors | `node scripts/shots3.cjs` | ready; 39–213 draw calls, ~205–225 k triangles, 39–57 fps at 1024×600 on this machine's ANGLE/D3D11 |
| Every room connected, each level | `node scripts/reach.cjs` | 0 unreachable rooms on B1, GF, F2, F3, F4 (doors opened; cased arches are permanently open) |
| Walk in the front door | `node scripts/entrance.cjs` | door opens, player walks from the porch (z 12.6) into the foyer and through the arch into the gallery |
| Spiral stair, all floors | `node scripts/climb.cjs` | foot 0 → 11.6, ends in the F4 Observation Gallery |
| Basement service stair | `node scripts/descend.cjs` | foot 0 → −3.22 at the Basement Landing |
| Tunnel and cave | `node scripts/stairprobe.cjs` | tunnel traversed to x 35.7, cave interior to x 47.6, both at −3.42, collision stops at the cave wall |
| Full objective loop | `node scripts/e2e.cjs` | front door → diesel → fuse → generator powers → gate opens → `ended: true`, no page errors |

## Defects found and fixed in this pass

1. **The spiral staircase was built at the world origin.** `buildStairs`
   translated each tread to `(cos·r, y, sin·r)` without the tower centre, so
   the geometry stood in the master bedroom while the ramp query, balustrade
   and floor holes stayed in the foyer. Walking the stairs worked; looking at
   them showed a pile of planks in an upstairs bedroom. Now offset from
   `STAIR.cx/cz`, with solid edge bands, a baluster and handrail segment on
   every tread, and a central newel column.
2. **Cased arches were solid, invisible doors.** Every `arch` door got a leaf
   and a collider, so the foyer could not be entered from the gallery (and the
   gallery could not be entered from the foyer). Arches now have no leaf and no
   collider.
3. **The stair ramp claimed the slab above it.** `stairHeightAt` accepted any
   ramp tread within 2.4 m of the foot, so the whole helix footprint read as a
   2.4 m step and blocked the foyer's doorway. A ramp now only counts if it is
   within one climbable step above (0.55 m) or 1.2 m below the foot.
4. **The ground-floor service hall was severed by the basement stair.** The
   stairwell hole cut the full width of the 3 m hall at z 4…10, so the staff
   room and guest room doors opened onto mid-flight. The stair moved to the
   north end of the hall (hole x −17.2…−14.2, z −11…−5.4), the hall is
   continuous, and the basement stair now lands in a landing that wraps the
   shaft instead of crossing a wall.
5. **Rooms with no doors, and rooms that did not touch anything.**
   - B1: generator room and workshop were sealed behind an unassigned strip;
     the wine cellar was isolated by a 1 m gap. Rooms now tile the footprint and
     each opens off the service passage.
   - GF: guest room 3, wine room and guest room 4 had no doors or overlapped the
     courtyard hole; the courtyard overlapped two rooms. Room rectangles
     re-tiled, doors added from the courtyard side.
   - F2: linen room and family sitting room had no doorways.
   - F3: the two parallel walkways were separated by an unbroken wall; the
     master suite, grand stair hall, sewing room and private bedroom 3 were
     unreachable; three doors opened into voids between rooms.
   - F4: the roof lantern had no door, and the observatory overlapped it.
6. **A crate 5 cm the wrong side of a doorway sealed the cellar landing.**
   Furniture clearance around doors was 0.55 m; it is now 1.1 m.
7. **Paintings sat inside the plaster.** Portrait offset was 0.03 m; the
   interior wall is 0.22 m thick. Now 0.12 m, on the wall face.
8. **Wardrobe doors hung off the side of the carcass on east/west walls** —
   the panels were offset along world z regardless of rotation.
9. **Story objects floated in the wrong room.** The notebook and brass key
   still had coordinates from the pre-rebuild plan (hovering over the dining
   room). They are now on the library desk and on the master bedroom floor.
10. **The generator was one unlabelled box.** It now has a concrete pad,
    radiator and louvres, rocker cover, exhaust stack and wall sleeve, fuel
    line, and a wired distribution board with dials and conduit.
11. **The flashlight hotspot clipped to white within a metre**, erasing the
    surface detail it exists to reveal. Intensity 17 → 12, penumbra 0.52 → 0.78,
    decay 1.4 → 1.3; walls, brick and plaster now keep their texture up close.

12. **Every tree in the estate was walk-through.** `buildArchitecture()` starts
    by emptying `architecture.colliders`, and the forest — which appends its 341
    trunk colliders to that same list — was built before the house, so the
    colliders were wiped a few seconds after they were made. Collider kinds at
    runtime were `wall 189, door 59, rail 84, tunnel 2, cave 13, gate 1, car 4`
    and no `tree` at all; `player.blocked()` returned false at every forest
    point. The boot order is now terrain → house → forest → underground →
    furniture → landmarks, and the runtime reports `tree 341`. Re-walked the
    road-to-porch route afterwards with collision live: 10/10 waypoints reached
    in 27 s, centreline clear at 0.4 m sampling with ±0.7 m offsets.
13. **Wood and stone shared one texture, non-deterministically.** `SETS.stone`
    and `SETS.wood` both live in `public/assets/textures/estate`, and the load
    cache was keyed by that folder name, so the two parallel loads overwrote
    each other and every material took whichever finished last. The
    `Props_GF_wood` mesh and the `Exterior_F4` stone mesh returned the *same*
    decoded image. The cache is now keyed by material set; the two meshes hold
    different images.

## Landmarks

| Object | Placement | Measured |
| --- | --- | --- |
| Old Forest Well (CC-BY 4.0, see `ASSET_LICENSES.md`) | ruins clearing, (10.6, −20.4), yaw 0.42 | 1.41 × 2.00 × 1.40 m, 9 meshes, 8 768 tris; bounding box bottom at terrain −0.02 m; the rendered terrain under the rim edge stands 0.012–0.043 m proud of the base, so the drum is planted, not floating |
| Well collision | 18 segments at r = 0.64 m, y −0.48…+1.17 | blocks the walker from all 16 sampled rim approaches; free standing 2.4 m away; no prop collider within the clearing |
| Well reach | from the north yard (−2, −13.5) | 5/5 waypoints walked in 8 s, ending 3.2 m from the rim; line of sight to the base is unobstructed from 3 m, 9 m and 14 m |
| Cost | one 5.86 MB download (compressed from 11.2 MB by `scripts/compress_glb_textures.py`), 9 draw calls | boot 4.9 s end-to-end in this harness; 12 of the resident textures are the well's 1024 px maps |

## The ruins

Identity: the estate's old stone storehouse, in the clearing behind the
mansion, with the well in its yard. Built by [src/world/ruins.js](src/world/ruins.js)
from four materials merged into five meshes.

| Aspect | Measured |
| --- | --- |
| Fabric | 5 merged meshes, 3 412 triangles; 6.89 × 2.75 × 6.18 m including rubble and foundation stubs; standing walls 2.55 m at the north, 2.35 m west, 1.95 m east, a 0.58–0.66 m fallen stub south |
| Grounding | wall feet sunk 0.15 m (bbox min −0.145); the lowest point of the whole ruin is −0.195, the quarter-buried base of the largest rubble stone; no wall, stub or stone floats |
| Opens | one 1.10 m doorway with a worn 0.13 m sill; a window void in the east wall (sill 1.0 m, head 1.75 m); the south-east floor corner is gone to soil |
| Walkable | floor slabs registered in `architecture.extraFloors`: standing inside reports foot 0.055 m on `stone`, on the sill 0.135 m, on the missing corner 0.005 m on `dirt` |
| Traversal | 8 collision segments (`kind: 'ruin'`); a wall blocks at (6.55, −16.0), the interior is clear at (9.9, −16.5); walked from the yard through the doorway to the far wall 5/5 waypoints in 4 s |
| Clearances | 1.34 m between the north wall's outer face and the well's rim; 2.97 m to the mansion's rear wall; no prop collider inside the footprint; the doorway's 1.10 m leaves 0.42 m of lateral clearance for a 0.34 m walker, so it must be entered centred |
| Rubble | 41 stones and fallen blocks; candidates rejected if they would sink into an accepted stone, so the pile touches and leans instead of interpenetrating |

## Sky, wind and roofs

| Aspect | Measured |
| --- | --- |
| Night sky | 1 300 field stars + 900 Milky Way points on a 190 m sphere, 0 of them below the horizon, inside a 200 m gradient dome with a haze band; star size is in pixels so they stay 1–2 px instead of becoming blobs |
| Moon | placed on the same normalised direction as the scene's directional light (dot 0.99 against the light vector), with a sprite halo; sky and lighting cannot disagree |
| Stars actually render | 573 pixels brighter than luma 70 in the upper half of a 1024 × 600 frame pointed at the zenith, 255 of them in the top quarter |
| Foliage motion | vertex-shader sway on 8 material programs, phase from each instance's world position, amplitude 1.9 cm on a fern to ~10 cm in a 14 m canopy, faded out past 55 m |
| Motion proven, not assumed | static camera, two frames 1.6 s apart: 4 120 pixels changed (0.82 %). Setting the sway amplitude to 0 and repeating: **0 pixels changed**. Restoring it: 4 125 pixels. The moving pixels are the wind and nothing else |
| Roofs | 5 hipped roofs replace the flat iron slabs on the F4 pavilions; eaves at 14.76 m, ridges 15.71–16.28 m (pitch ≈19°), 24 slope triangles with 0 downward-facing normals, 5 ceilings, no two roof rectangles overlap, the F4 rooms still stand at 11.6 m and stay unblocked underneath |
| Cost | 3 extra draw calls for roofs; 4 for the sky; the sky is ~3 500 vertices and no textures except a 128 px halo |

## Known gaps (not fixed here)

- Interior dressing is still thin on the upper floors: several bedrooms hold a
  bed, a wardrobe and little else; F4's maintenance, caretaker and archive
  rooms are sparse. The room register in `plan.js` is the place to add pieces.
- The interior plaster textures are blotchy at close range; their stain scale
  should be reduced. This is a material change, not a geometry one.
- The library/library-side wall showed one painting whose canvas reads oddly
  at grazing angles; frame/canvas UVs need a pass.
- No second full playthrough was run with the enemy AI enabled after the
  layout changes; enemy navigation was not re-validated in this pass.
- The brass key is now flavour only: the F3 door that `isDoorLocked()` names
  was the one opening into a void between rooms, so it was removed. Either a
  real locked door should be restored on the historical study or the key and
  its puzzle text should be cut.
