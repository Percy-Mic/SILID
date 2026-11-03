# SILID — door system pass

Date: 2026-10-29 · Three.js + Vite · live game, not a mock

## 1. What changed

### One leaf generator, six configurations

`doorLeafGeometry(leafW, leafH, style)` in [architecture.js](../../src/world/architecture.js)
builds the leaf as a slab, a face frame on **both** faces, recessed panels with a
bead moulding, hardware and three hinges. A style is chosen from the rooms the
opening serves (`doorStyle`), not from the floor:

| style | build | hardware | doors |
|---|---|---|---|
| `entrance` | four panels, deep face frame, meeting stiles | brass ring pull on a rosette, escutcheon | 1 (pair) |
| `formal` | three panels, mullion, low mid rail | brass knob, shank, escutcheon, keyhole plate | 28 |
| `bedroom` | two tall panels | brass knob, escutcheon | 17 |
| `bath` | one panel | brass knob, privacy slide | 2 |
| `service` | vertical boards, no raised panels | iron lever on a backplate, keyhole, kick plate | 10 |
| `utility` (basement) | as service | iron | 9 |

67 leaves across B1 9 · GF 24 · F2 14 · F3 11 · F4 9, plus 4 cased arches
(unchanged, no leaf, always passable).

The second geometry group is now given its own material: the old leaf mesh was
handed a single walnut material for all groups, so the “brass” knob and
escutcheon were painted wood. Each leaf is now `[walnut, brass|wroughtIron]` —
two draw calls instead of one, which is the cost of visible metal. A new
`wroughtIron` flat material was added to [materials.js](../../src/world/materials.js)
rather than reusing `corrugated_iron_02` on 5 cm hinge plates.

Hinges are three cast plates and a knuckle on the hinged edge, at 0.22 m,
mid-height and head-0.22 m, on both faces. They are part of the leaf geometry,
so every door shows its hinges when open.

Leaf size follows the opening: slab 55 mm, face frames 19 mm, hardware bbox
157 mm; single leaves are `w − 0.05`, the entrance pair `(w − 0.012)/2` per leaf
so the meeting stile has a 6 mm gap.

### Main entrance

The 2.2 m opening held one 2.15 m leaf. It is now a **pair**, each leaf hinged
on its own jamb and swinging inward, with four panels per leaf, brass ring pulls
and escutcheons, three hinges per leaf, a central latch plate, a 6 mm meeting
gap, the existing stone threshold and the existing 0.48 m portal jambs and arch.

The opening height was **not** raised: changing it would have moved the wall
cut, the casing, the facade lintel and the porch hood, which the brief rules out
(“do not move major walls arbitrarily”). The pair reads as imposing through
depth, panel work and hardware rather than through extra height.

### Swings are resolved against the walls

`pickSwingSign` scores both swing arcs against the colliders already standing
and takes the clear side. Before this, the bath leaf between Linen Room, Her
Dressing Room and Master Bath swept 50% of its arc through the dressing-room
wall; the audit now measures 0% blocked on every door.

### Gameplay

Preserved: prompt range/facing, `E` interaction, collider, level tests, lock
predicate, inventory key, Resident slam stun. Added/changed:

- both entrance leaves animate together (`target2 = −target`), including when
  the Resident forces a door;
- closing is refused while the player stands in the opening — otherwise the
  leaf collider re-enables with the capsule inside it and `blocked()` would not
  let them step out;
- lock: the F3 historical study still requires the brass key and still says
  where the key is; unlocking now plays a latch;
- sound: new `latch()` (two short band-passed clicks) plus `creak(heavy)` — the
  entrance pair is lower and longer. Latch on the handle, creak on the leaf,
  latch again 420 ms after a close when the leaf has settled. No per-frame
  sounds;
- the creak now goes through the existing `noise()` → `Resident.hear()` channel:
  3.2 m for an interior leaf, 5.5 m for the entrance pair. Tested: at 1.3 m the
  Resident switches to `investigate` with the door as `lastKnown`; at 6.1 m it
  stays on `patrol`.

### Two facade bugs that were burying the entrance

The audit found the doors were not the only thing in the doorway. Both are in
[facade.js](../../src/world/facade.js) and both are the same mistake — geometry
built at the wall's centre because its station along the wall was never applied:

1. **Pilasters**: `at` was computed and then unused, so every pilaster on a wall
   stacked into one shaft. On the south face that shaft stood full height in
   front of the entrance. Now each is slid to its station.
2. **Window dressings**: `dressing()` never used the window's centre either, so
   every jamb, sill, drip, tympanum, hood and keystone on a wall was stacked at
   the wall centre. On the south face this put a 1.08 m window's stone jambs and
   sill directly across the entrance doors. A `slideOnWall()` helper now places
   all of them at `(a+b)/2`.

This also restores the stone surrounds to the windows they belong to. It is a
whole-elevation visual change and needs the exterior pass to be re-reviewed on
its own merits; it is reported here because without it the entrance was not
usable as an entrance.

## 2. Files

| file | change |
|---|---|
| [architecture.js](../../src/world/architecture.js) | style-aware leaf generator, `doorStyle`, `pickSwingSign`, paired entrance build, per-door `style`/`leafW`/`swingSign` |
| [game.js](../../src/game/game.js) | paired animation, `swingSign`, doorway-close guard, latch/creak, door noise, latch on unlock |
| [audio.js](../../src/game/audio.js) | `latch()`, `creak(heavy)` |
| [materials.js](../../src/world/materials.js) | `wroughtIron` flat material |
| [resident.js](../../src/game/resident.js) | forced doors use `swingSign` and both entrance leaves |
| [facade.js](../../src/world/facade.js) | pilaster placement, `slideOnWall`, all window dressings placed |
| [doors_probe.cjs](../../scripts/doors_probe.cjs) | new live geometry + interaction audit |
| [door_shots.cjs](../../scripts/door_shots.cjs) | new door screenshots |

Backups: `_backup/doors_2026-10-29/` holds the committed (`HEAD`) versions of
architecture, materials, game and audio. `facade.js` and `resident.js` are
untracked in this checkout, so only their current versions (`.after`) could be
kept; the three facade edits are exactly the two placement fixes and the
`slideOnWall` helper described above.

No external assets were downloaded for this pass. Wood, stone, glass and the
shell are the existing Poly Haven CC0 sets recorded in
[ASSET_LICENSES.md](../../ASSET_LICENSES.md); brass, iron and the shell panel are
procedural materials. Nothing here needs a new licence entry.

## 3. Verification (live game, `?probe=1`)

### Door audit — `node scripts/doors_probe.cjs`

Writes [doors_audit.json](doors_audit.json).

- 67 doors, 1 paired entrance, 4 arches.
- Collider ↔ opening mismatch: **0**. Duplicate keys: **0**.
- Leaves thinner than 70 mm: **0** (thinnest bbox 157 mm including hardware).
- Swing arc ≥ 15% blocked: **0** (all 66 single leaves 0%, both entrance leaves
  0%).
- Doors with fewer than two adjacent rooms: four, and all four are legitimate
  one-sided doors — the entrance (porch), the B1 tunnel mouth, the west service
  door out of the Staff Room, and the F2 door whose other side is the Study
  across a thick wall (the room probe at 0.5 m lands in the wall).

### Interaction matrix (real prompt → `game.interact()` → 90 fixed steps)

| door | prompt | opens | collider off | centre passable | closes | collider back |
|---|---|---|---|---|---|---|
| entrance, from porch | door | 1.35 / −1.35 | yes | yes | 0.01 / −0.01 | yes |
| entrance, from foyer | door | 1.35 / −1.35 | yes | yes | 0.01 / −0.01 | yes |
| GF bedroom (Service Hall) | door | 1.35 | yes | yes | 0.01 | yes |
| GF formal living | door | 1.35 | yes | yes | 0.01 | yes |
| B1 storage cellar | door | 1.35 | yes | yes | 0.01 | yes |
| F3 locked study, no key | door | no | — | — | — | — |
| F3 locked study, key | door | yes | yes | — | — | — |

Locked line read from the HUD: “Locked. The brass key is upstairs, in the
master bedroom.”

### Player fairness

- Walk from the foyer (0, 8.8) out to the drive (0, 25.4): continuous, foot
  height 0 → 0.08, no step or snag at the threshold.
- Stand in the open doorway and press E: door stays open, message “Step clear of
  the doorway first.” Step 1.8 m clear and press E: closes to 0.01 rad and the
  collider is restored.
- Resident hearing: near door (1.3 m) → `investigate`, `lastKnown` at the door;
  far door (6.1 m) → stays `patrol`, `lastKnown` null.

### Existing scripts

- `node scripts/audit_mansion.cjs` → [mansion_audit.json](mansion_audit.json):
  `doorCount 67`, `archCount 4`, `missingDoors []`, `doorsWithoutCollider []`,
  `errors []`. Stair ramps, floor holes, landings and room samples unchanged.
- `node scripts/scan_apps.cjs` → phone wiring verdict OK (guard against
  collateral damage to the other UI system).
- `npm run build` → success, 985.23 kB JS (278.29 kB gzip), Vite 5.4.21.

### Performance

- All door geometry in the house: **81,880 triangles across 68 leaf meshes**
  (~1.2k per leaf).
- Foyer view with the entrance pair visible: 193 calls / 1,113,534 triangles.
  Same frame with every door hidden: 189 calls / 1,110,510 triangles. The doors
  in that view cost **4 draw calls and ~3k triangles**.
- Spawn view: 160 calls / 1,070,986 triangles, 23–25 fps in headless Chromium.
- This is software/headless Chromium on the development machine, **not** the
  Intel HD Graphics 4600 target. The door cost is small, but no real-GPU
  profile was taken.

## 4. Screenshots

All from the live game with a temporary inspection light (the night scene would
otherwise be black); the light is not part of the game.

| file | shows |
|---|---|
| [entrance_elevation.png](entrance_elevation.png) | south elevation, entrance bay and window surrounds after the placement fix |
| [entrance_closed.png](entrance_closed.png) | paired entrance closed: panels, ring pulls, escutcheons, threshold, portal |
| [entrance_hardware.png](entrance_hardware.png) | close inspection: meeting stile, ring pulls, escutcheons, hinge plates |
| [entrance_open_center.png](entrance_open_center.png) | pair open onto the real foyer and grand stair |
| [entrance_open_from_foyer.png](entrance_open_from_foyer.png) | open leaves from inside, porch beyond |
| [entrance_open_from_porch.png](entrance_open_from_porch.png) | open leaves from the drive side |
| [bedroom_closed.png](bedroom_closed.png) | bedroom leaf, two panels, brass, casing |
| [bedroom_open.png](bedroom_open.png) | bedroom leaf open into the furnished room |
| [service_kitchen.png](service_kitchen.png) | boarded service leaf, iron lever and keyhole |
| [bath_dressing.png](bath_dressing.png) | bath leaf, single panel, privacy slide |
| [utility_basement.png](utility_basement.png) | basement utility leaf, iron furniture |

## 5. Remaining issues and unverified features

- **No concealed door was added.** The plan has no hidden room or passage that
  a concealed entrance could open into; the hiding system uses armoires and the
  iron bed. The B1 tunnel mouth is a normal 1.8 m utility door, not a secret
  panel. Adding one would need a room the layout does not have.
- **Door state is not persisted.** There is no save/load system in the project
  (`restartRun` rebuilds the run), so doors are live-session state only.
- **Locks are story-level, not per-door.** Only the F3 study has a lock
  predicate and it uses the single brass key; there are no separate keys,
  pickable locks or keyring UI.
- **Open angle is 77°**, not 90°. Open leaves still narrow the opening
  visually, and the collider is disabled entirely while open, so the player can
  walk through the last 13% of the arc near the jambs. This is inherited
  behaviour; changing it would need a swept collider.
- **The entrance seam** is 6 mm and is closed by the latch plates; at night a
  hairline of light can still show between the leaves when the foyer is lit.
- **Facade change is broader than doors.** The pilaster and window-dressing
  placement fix changes every elevation. Only the south elevation and the
  entrance were re-shot here; the other sides need a fresh exterior review.
- **Headless only.** No test on the Intel HD 4600 machine, no thermal or
  long-session profiling, and no enemy pathing test through the entrance pair
  (the Resident's forced-open path was changed but not driven live at the
  entrance).
- **Doors were not walked through individually on every floor.** Colliders,
  swings and openings were measured for all 67; the prompt/animation loop was
  exercised on six representative doors, not all 67.
