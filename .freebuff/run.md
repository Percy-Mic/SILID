# Running this workspace

Two different things live here and they must not be confused:

* `npm run dev` (root `index.html` + `src/`) — the **old** game build. It is not
  the rebuild and it is not what the preview should show.
* `Blender/AssetLibrary/Working/House/` — the **rebuild**: the house authored in
  Blender, exported to a GLB, and walked in a first-person viewer.

## 1. Build the house (Blender, headless)

```bash
B="/c/Program Files/Blender Foundation/Blender 4.2/blender.exe"

# the whole set: 50 rooms over 4 storeys plus the silong and 12 tunnel areas,
# 58 doors/arches, 68 windows, 4 stair runs
"$B" -b --factory-startup \
  --python Blender/AssetLibrary/Working/House/_build/build_house.py

# open the four doors that lead OUTSIDE, then re-export the GLB
"$B" -b Blender/AssetLibrary/Working/House/SILID_House_v1.blend \
  --python Blender/AssetLibrary/Working/House/_build/cut_out_doors.py
```

Step 2 is not optional. Without it the exported walls arrive sealed: the front
door is a solid panel with a door casing in front of it, and the walkthrough
cannot leave the house.

**Use `cut_out_doors.py`, not `cut_openings.py`.** The latter subtracts every
opening with a boolean, and the walls are one mesh made of hundreds of touching
boxes: the EXACT solver welds the shared faces and dissolves the ones it thinks
are internal, so 30 openings punched 193 undeclared holes through the front
facade (215 on the east side) — walls you could see through everywhere except
at the door. `cut_out_doors.py` touches only the faces lying across the four
outside doors and clips them by hand, so the facade cannot spring leaks.

**The house is not in the plan's frame.** It was rotated +90° about X for glTF:
plan `(x, y, z)` lives at world `(x, -z, y)`, so the front wall sits at
`world y = +7.15` and there is no wall at `world z = -7` at all. Any script that
places geometry in plan coordinates will silently miss. `cut_out_doors.py`
converts explicitly, and `probe_openings.py` measures the result:

```bash
# which declared openings are still walled up? (blend, then the exported GLB)
"$B" -b Blender/AssetLibrary/Working/House/SILID_House_v1.blend \
  --python Blender/AssetLibrary/Working/House/_build/probe_openings.py
"$B" -b --factory-startup \
  --python Blender/AssetLibrary/Working/House/_build/probe_openings.py -- --glb
```

Artifacts:

| path | what |
|---|---|
| `Blender/.../House/SILID_House_v1.blend` | the authored set |
| `Blender/.../House/_qc/house_manifest.json` | rooms, openings, stairs — the contract the viewer and the game read |
| `Blender/.../House/_qc/build_report.json` | what was built |
| `public/assets/blender/house/SILID_House.glb` | the game copy (~87 MiB, Draco) |

## 2. Run the walkable viewer

```bash
node Blender/AssetLibrary/Working/House/_qc/walk_server.cjs 5333
```

Open <http://127.0.0.1:5333/>. It serves exactly four things: `walk.html`, the
house manifest, the GLB, and three.js + the Draco decoder from `node_modules`.

Controls: WASD move, SHIFT run, hold C crouch, E use what you have your hands
on / what you are looking at / what you are standing against (open a door, pull
a drawer, take what is in it, hide in a locker, climb the ladder), F torch,
L light, R back to the front door.

### Who owns E

`src/game/app.js` owns interaction and only there is the rule written down:
`useTarget()` picks in four tiers - hands (d <= `HANDS`, the hatch under your
boots), then the crosshair if it is out of arm's reach, then the arm's-length
ring (`ARM`, broken by facing, not distance), then the crosshair again. The HUD
prompt (`updatePrompt`) and `interact()` both call it, so what the prompt says is
what E does. Door state (`open`/`locked`/`unlocked`/`barred`) lives on the one
door record built from the manifest; `setDoorOpen()` only swings leaves.
`src/game/act1.js` owns the prologue's beats and registers its own things (the
gate, the car, the tool roll) through `ctx.addInteractable`; it holds no
door-opening rule of its own, which is what once made the front door a one-way
exit with the coordinates written out in two files.

The whole prologue is driven by `npm run qc`
(`Blender/AssetLibrary/Working/House/_qc/act1_pass.cjs`): it plays every beat in
a real browser and presses E on the real things.

The walker is not a floor plan any more: at load it rasterises the house's own
wall/counter/boundary triangles into a 10 cm occupancy grid that keeps each
column's height span, and the floor under your feet comes from a downward ray
against the real slabs and treads. That is what makes a doorway passable and the
wall beside it not, and what stops a 5.8 m/s run from stepping through a wall on
a dropped frame.

Nothing is open when you arrive. Every leaf starts shut, two of them are locked,
and the keys are in furniture:

| locked door | key | where |
|---|---|---|
| `palengke_hall` (the cold room, and the hatch) | `key_brass` | `cab_kusina`, the kitchen cabinet |
| `kwarto_kapilya` (the west chapel) | `key_iron` | `cab_kwarto`, the bedroom wardrobe |

`cab_silong` in the cellar holds nothing, because most drawers do. Standing at
a cabinet and pressing E searches it. The two knee-high openings in the warren
(`crawl_west`, `crawl_east`, 0.95 m) can only be passed while crouched: they are
the loops that let you lose a man who is running at full height. The chapel
door (`cross_chapel`) can be shut and barred from inside - the one safe room.
The viewer reads all of this from `house_manifest.json` (`locks`, `containers`,
and the door `y0`/`y1`), not from hardcoded ids.

The page must be served over HTTP (it uses ES modules and range requests); opening
`walk.html` from disk will not work.

### The carried phone (the game, not the viewer)

`src/game/phone.js` is the phone the player owns after the prologue: a 152 mm
body with a painted 512×1024 glass, raised with **P** once Act I has handed over
(`stage === 'done' | 'inside'`). Clicks are raycast onto the screen mesh, so
every control is a real hit region. The torch screen drives the same SpotLight
as F; the battery drains while the lamp is on and goes to power save at 5 %
rather than refusing (a house with one light and no socket must not be able to
strand the player).

| script | what it proves |
|---|---|
| `scripts/phone_probe.cjs` | pickup, taps, torch, notes, a failed call, put-away, walking after, three open/close cycles, power save — prints PASS-style state, and the battery/intensity numbers |
| `scripts/phone_pose.cjs` | the held pose and every screen, rendered from the real frame; writes `reports/phone/held_*.jpg` |
| `scripts/mansion_view.cjs` | the approach with yaw computed to the front door (the old perf 'mansion' view pointed into the woods) |
| `scripts/path_probe.cjs` | road → gate → porch, lane by lane, with a 1.72 m body |
| `scripts/door_blockers.cjs` | names what stands in the approach of a door the audit flagged |

## 3. What the viewer does with the manifest

The exported house keeps the plan's own axes (verified against the front door at
`z = -7` and the zaguan slab at `z = -5.57`), so `walk.html` reads room
rectangles, door spans and the stair ramp straight from
`house_manifest.json` and uses them both as the walkable volume and as the
collision test. There is no mesh raycasting in the movement path: if the player
is in a room rectangle and a door joins it to the next one, the step is allowed.

The yard is part of that volume. `SM_Yard` spans ±26 m at `y -0.64..-0.44` and
the rear steps are specced "three steps down to the yard", but the manifest has
no room for it — so every door tagged `OUT` dead-ended and the house could not
be left at all. `walk.html` pushes an `OUT` room (`y -0.44`, the grade) into the
room list; it is gated by the same door test, so the four outside doors open
onto it and walls and windows still hold.

## 4. Known state

* Doors: 35 leaf doors, all bound by name to their manifest opening, all start
  shut. A closed, locked or barred door is impassable in the walk model; an arch
  or tunnel mouth with no leaf never is.
* Walls: 3,424 samples along every room edge on every level of the exported GLB
  (stepped at 0.15 m, skipping porch/balcony rooms and the stair voids) found 0
  undeclared holes, and 798 samples strictly inside declared openings found 0
  walled up. Re-run it after any build change - it is the only check that proves
  the house is not a facade.
* Ceilings: the well is a hole in the floor above it AND in the ceiling of the
  storey below. Cutting only the floor left the first flight climbing into a
  plaster ceiling 29 cm above the top tread - the stair in the screenshot.
* Handrails: one raked plank per flight (an ngon), not a bar per step. The old
  bars stacked into a lattice across the well, and each flight now has a soffit
  so you see three staircases instead of three sets of floating treads.
* Stairs: three flights share one well, one storey apart; each arrives on the
  gallery landing 11 cm past the room rectangle, and the well head is open (a
  rail there blocked the next flight). The viewer carries a stair-head patch for
  that strip, and `stairLift` picks the flight whose RAMP is under your feet -
  picking by level dropped you to the bottom flight every time.
* The hatch is cut through the palengke floor, the plinth and the yard slab: the
  first two alone left a concrete lid 2 cm under the boards. E climbs it; the
  viewer needs no mesh collision to do it.
* Mouse-look needs pointer lock, which some embedded webviews refuse. WASD works
  regardless; a normal browser grants it.
* The GLB is ~87 MiB because the blend's textures are large: fine on localhost,
  too heavy to ship.
