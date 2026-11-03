# ACT I — THE BREAKDOWN (the opening scene, as built)

Act I is the prologue the house never had: you drive in, the engine dies, you
open the bonnet and find the fault, you find that you have no tools, your phone
has no signal, you walk a road that has **nothing on it**, and the only light
left in the world is a house that is not on any of the signs. It ends inside a
locked room, holding a screwdriver somebody left there for you.

This document is the shot list, the beat list, and the proof that it plays.

---

## 1. The story, beat by beat

| # | beat | stage | what happens |
|---|------|-------|--------------|
| 1 | the drive | `drive` | Nine seconds of Tuluyan road from the driver's seat. 5.0 m/s, then the fuel pump gives up: a dropped cylinder, one flicker of the headlights, a long coast. Real time, not frame time — a cinematic that slows down with the renderer is a broken cinematic. |
| 2 | the stall | `exit` | Dead. Not a cough left in it. You get out on the **driver's side**, the door you have been sitting behind. The phone's lamp comes on — without it the shoulder is a black rectangle and the player is asked to inspect a car by touch. |
| 3 | the bonnet | `hood` | The catch is under the lip. `CAR_Hood` is a real hinged node; E lifts it 52° on the hinge and the bay comes up into the light. |
| 4 | the fault | `bay` | One target in the bay, not two: **the negative battery clamp**, proud of its post, arced for a hundred kilometres. A generic "the engine bay" scored better under the crosshair than the fault itself, which is how the one thing the scene is about became un-findable. |
| 5 | no tools | `tools` | The tool bag on the load floor behind the rear bench: a jack, a wheel brace, a rag, a glove with no pair. No screwdriver, no spanner, nothing that turns. The repair is an eight-millimetre spanner that is in the other car, and the other car is in Manila. |
| 6 | the phone | `tools` | P. A phone UI with 23:47, three missed calls from Mama, **4% battery, no service**. The player learns the two things the house is going to take from them: light and time. |
| 7 | **the empty road** | `walk` | You walk the way you were driving, looking for help. There is **no tindahan, no barangay hall, no house, no lamp, no dog, no jeep that did not come**. You shout once, the way you do, and your own voice comes back off the trees a second late — and under it, something that is not an echo. This is the first scare of the game and it is made of nothing. |
| 8 | the sighting | `walk` | A window, lit, at the end of the road. Not a streetlight. The forest arrives out of the fog before the house does (the house and 4.5 M triangles of woodland are culled until 45 m out). |
| 9 | the gate | `gate` | Iron leaves on stone piers, one ajar. It was never locked: the hinge screams once and that is the whole encounter. |
| 10 | the front door | `door` | Open. Not broken — open. The house has been waiting for someone to be curious. (The door is a real leaf: the beat opens it, because a door described as open that a body cannot walk through reads as a bug.) |
| 11 | the slam | `inside` | Two steps in and the door is shut behind you, locked from the inside, and there is no key on this side. The phone's torch is now the only light in the building. |
| 12 | the nook | `search` → `jam` | The hall. The drawers in the nook off the east side: opening one is what starts the story — a hand goes into a drawer, and the drawer has been emptied by hand, and **there is a note on top, where the next hand would find it**. |
| 13 | **the locked room** | `jam` → `wr` | The note says the door at the back will not open, that the key is in the house, and that you must not look for it. The door is `aklat_kwarto`, a warped leaf: the frame has swelled. The first shove gives a centimetre and jams — the paint by the handle is worn to bare wood, somebody else has been leaning on this — the second shove lets go all at once the way wet wood does. |
| 14 | **the first tool** | `wr` | Inside: a bed nobody has slept in, a chair turned to face the wall, and a canvas tool roll on the floor with a screwdriver, a candle stub and a spent match. You take the tool. Act II title card: **THE HOUSE THAT KEEPS** — the door has closed behind you. |

### The two notes (the loop of the whole game)

The victims' contract is the spine of the search-and-escape game, and it is
written down twice:

* **NOTE_NOOK** (in the nook drawers): `TAKE ONE — LEAVE ONE.` The house does not
  take what you carry, it takes what you need, so you will keep going in. Search
  in an order — the hall first, the drawers in the nook, because a drawer is
  where a hand goes without thinking. `DO NOT GO LOOKING FOR A KEY. THE KEY IS IN
  THE HOUSE. PUT YOUR SHOULDER IN THE DOOR.` What is behind it is not for us; it
  is for whoever comes next.
* **NOTE_TOOL** (rolled up with the screwdriver): `SO WE LEAVE ONE, EVERY TIME,
  WHERE THE NEXT ONE WILL LOOK FIRST.` Take it, then leave one for whoever comes
  after. The door only opens from outside; they take the tools off you when they
  take you in. And do not go up the stairs before the lights do.

That is why the first tool of a run is **findable** and not earned, and why the
locked room is a *hand-off between players who will never meet* rather than a
puzzle: the house is a machine for making victims leave tools for the next one.

---

## 2. Files

| path | what |
|---|---|
| [act1.js](Blender/AssetLibrary/Working/House/_qc/act1.js) | the whole prologue: beat machine, UI (objective, subtitle, phone, note, Act II card), the car's hinged parts, the watcher, procedural audio, and the two notes |
| [walk.html](Blender/AssetLibrary/Working/House/_qc/walk.html) | the walkthrough it runs inside: house, furniture, drawers, doors, locks, bag, floor probe, torch |
| [act1_pass.cjs](Blender/AssetLibrary/Working/House/_qc/act1_pass.cjs) | the Playwright pass that drives all 40 checks of Act I in a real browser |
| [prepare_range_rover.py](Blender/AssetLibrary/Source/Cars/prepare_range_rover.py) | the car: the downloaded Range Rover ("Range Rover" by IvOfficial, CC-BY 3.0) scaled, grounded, bonnet-cut onto a cowl hinge and exported as `rangerover_game.glb` |
| [build_act1.py](Blender/AssetLibrary/Working/Opening/_build/build_act1.py) | the Blender authoring of the road, the car, the gate, the watcher, the treeline — and the measured-surface binding |
| [SILID_Act1.glb](public/assets/blender/opening/SILID_Act1.glb) | the exported set (29 MB, 24 embedded CC0 textures) |
| [act1_manifest.json](Blender/AssetLibrary/Working/Opening/_build/act1_manifest.json) | the contract the game reads: car parts, hinges, road extents, beat zones, bound surfaces |
| [shots/](Blender/AssetLibrary/Working/Opening/_build/shots) | Blender stills of the road, the verge, the car on the shoulder, the open bonnet, the gate |

**Everything the story touches is a named node**, because the game moves it:
`CAR_root`, `CAR_Hood` (origin on the hinge), `CAR_Door_FL`, `CAR_Terminal`,
`CAR_ToolBag`, `CAR_Jack`, `GATE_L/GATE_R` (origin on the hinge posts),
`ANC_Watcher` (hidden until it should not be).

---

## 3. Running it

```bash
# 1. the walkable build (serves walk.html + the house + the act I set + three.js)
node Blender/AssetLibrary/Working/House/_qc/walk_server.cjs 5333
#   http://127.0.0.1:5333/            click START THE ENGINE
#   http://127.0.0.1:5333/?no-forest  ...without 4.5 M triangles of woodland (QC)

# 2. the automated Act I pass — 40 checks, end to end, in a real browser
node Blender/AssetLibrary/Working/House/_qc/act1_pass.cjs
node Blender/AssetLibrary/Working/House/_qc/act1_pass.cjs --headed --slow   # watch it

# 3. rebuild the Blender set (and its stills)
B="/c/Program Files/Blender Foundation/Blender 4.2/blender.exe"
"$B" -b --factory-startup --python Blender/AssetLibrary/Working/Opening/_build/build_act1.py
"$B" -b --factory-startup --python Blender/AssetLibrary/Working/Opening/_build/build_act1.py -- --shots
```

Controls: WASD move, SHIFT run, C crouch, **E** the thing under the crosshair,
**P** the phone, F torch, L light mode, R back to the door.

---

## 4. Materials: measured surfaces, not noise

The road, the verge, the concrete and the iron are real CC0 PBR — actual normal
and roughness maps, not procedural noise pretending to be:

```bash
node scripts/fetch_pbr_textures.mjs --only roadAsphalt --res 2k   # one surface
node scripts/fetch_pbr_textures.mjs --dry                        # what it would fetch
node scripts/asset_licenses.mjs                                  # rebuild ASSET_LICENSES.md
node scripts/asset_licenses.mjs --check                          # fail if it is stale
```

[ASSET_LICENSES.md](ASSET_LICENSES.md) is generated from the provenance files and
the role table, so the licence record cannot drift away from the assets: 28
assets, 26 roles, every row carrying its source page.

* Source: **Poly Haven**, licence **CC0 1.0** (no attribution required,
  commercial use and redistribution allowed). Per-asset provenance — source URL,
  authors, md5, byte size, date — lands in
  `Blender/AssetLibrary/Source/PolyHaven/<slug>.provenance.json`.
* One table, two consumers: `Source/PolyHaven/manifest.json` is read by the
  Blender builder (`silid_pbr.py`) **and** by the game (`src/world/pbr.js`), so
  the movie and the build cannot drift apart.
* Tiling is a real size, in metres, per role — the road repeats every 3.2 m, the
  verge every 4 m, leather every 1 m — and is exported as
  `KHR_texture_transform`, so every viewer tiles it identically.
* `kit.uv_triplanar()` writes UVs in **world metres** (axis by axis from the face
  normal), which is what lets a tile size live in a data table instead of in an
  unwrap somebody has to redo every time the geometry moves.

Bound in Act I (`apply_pbr` in `build_act1.py`): `roadAsphalt` (road, patches,
cracks — 2k, the hero surface), `groundDirt` (shoulders), `groundForest` (the
verge), `concrete` (culvert, kilometre stone, gate piers), `rustIron` (the gate),
`woodDeck` (poles, bed boards), `leather` (seats, dash), `fabricLinen` (the jack
and the tool bag). Day-scanned ground is tinted down and cooled for 11 pm — a
ratio, not a repaint: grain and normals stay.

---

## 5. Verification (what was actually run)

| check | result |
|---|---|
| `act1_pass.cjs` — every beat, door, lock, drawer, note and shove | **40 / 40 passed** |
| no tindahan anywhere in the set or the beat machine | pass asserts no shop target exists; GLB has no store node |
| the locked room | first shove refused (`jammed`, door still shut), second opens it, and the door is a working door afterwards with its fake lock gone |
| the first tool | `screwdriver` in the bag, note on screen, Act II card |
| the exported GLB | 501 meshes, 34 materials, 24 embedded CC0 textures, `KHR_texture_transform`, `KHR_draco_mesh_compression` |
| the licence record | `asset_licenses.mjs --check` passes: 28 assets, 26 roles, every row sourced |
| stage-machine regressions | fixed: `later(ms, ok, fn)` — a delayed cue only fires if the beat is still where it was when it was queued |

The pass found three real bugs that a human playtest would have hit later: a
pending "you have no tools" timer firing over a walk the player had already
started, a front door described as open that a body could not walk through, and
a note check that passed on the note's static HTML instead of on the note.

---

## 6. Blocker: the root game build is not in this checkout

`src/main.js` imports `./core/Opening.js`, `./core/Scenarios.js`,
`./world/House.js`, `./world/Roadside.js`, `./world/Cast.js` and the horror
directors, and the repo root has **no `index.html`, no `package.json` and no
`.git`**. Those files are missing from this working copy (they were present
earlier in this project's history). Consequence, stated plainly:

* Act I is **playable and verified** in the Blender-native build (the house
  viewer), which is the runnable build this workspace has.
* Wiring Act I into `src/main.js`'s `Opening` module **could not be done or
  verified** here, because that module is not on disk. Restoring the game shell
  is a prerequisite, not a detail.

---

## 7. Next milestones (not yet done)

1. **Restore the game shell** (`index.html`, `package.json`, `src/core/*`,
   `src/world/*`, `src/horror/*`) and port the Act I beat machine into the game's
   `Opening`, so the prologue runs inside the main build.
2. **A real car**: the shoulder car is authored in Blender (94 named parts) and
   has no measured paint. A licensed car model with separable hood/doors swapped
   in behind the same node names would lift the hero shot — the interface is
   already the manifest's part list.
3. **The endings**: the same treatment Act I got (beat sheet, states, verification
   pass) for the finale — the tunnel mouth, the chapel, the well.
4. **Characters**: the walker's protagonist, the co-op partners and the
   antagonist are cast work (`src/world/Cast.js`, `ANC_Watcher` today) that needs
   the game shell back before it can be assembled into the run.
