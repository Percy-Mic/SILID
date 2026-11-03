# The cast — where it stands and what happens next

## What already exists

`SILID_Cast_CharMorph_v1.blend` (13.7 MB) holds a generated, rigged human:

| | |
|---|---|
| body | `CHR_Marco` — 34,148 triangles, 1.72 m tall, 1.47 m across the shoulders |
| rig | `CHR_Marco_rig` — 702 bones (a Rigify rig: 164 of them deform, the rest are face/muscle controls) |
| materials | `charmorph_skin_v2`, real eyes (`MBlab_human_eyes`, `charmorph_iris`, `charmorph_cornea`), teeth, tongue, lashes, nails |
| hair | `hair01_human_male` (7,608 tris) |
| plus | `charmorph_metarig_mb_male_tweaked`, studio lights, a portrait camera, and 220 `WGT-*` rig widgets |

That is a **castable** character: the hard parts (believable proportions,
skinning, a face that can move, a rig structured for animation) were done by the
generator. The character phase therefore starts from it rather than from a base
mesh.

`_build/export_cast_glb.py` proves the whole path to the game:

```bash
"$B" -b --factory-startup --python Blender/AssetLibrary/Working/Characters/_build/export_cast_glb.py
#   -> public/assets/blender/cast/CHR_Marco.glb   2.50 MB, 34,148 tris, skinned
#   -> _build/cast_export.json                    what was kept, what was dropped
```

Two things it had to fix, both worth keeping in mind for every character:

* **the rig widgets do not ship.** 220 `WGT_*` meshes are control shapes a
  rigger drags around. They are geometry, they weigh as much as the character,
  and nothing renders them. The export drops them by name.
* **the shape keys do not ship either.** A CharMorph face carries several
  hundred shape keys (expression, muscle, age). Exported, each key is a full
  position array for every vertex: the first attempt produced a **248 MB** GLB
  for a 34,000-triangle character. With morphs off it is 2.5 MB. Expressions, if
  the game wants them, come back later as a small named subset.

## The licence position — read before shipping

* **Poly Haven (surfaces, HDRIs, models): CC0.** No attribution, commercial use
  and redistribution allowed. The house's 25 surfaces all come from there.
* **CharMorph / MB-Lab content: MIXED, and NOT yet cleared.** The Addon code is
  GPL and the generator's own asset set includes CC-BY and AGPL content as well
  as CC0. `CHR_Marco` was generated from that library, so **its licence has to be
  settled before a commercial release** — either by confirming the specific
  asset licences in the CharMorph documentation, or by regenerating the cast
  from a source whose licence is unambiguous (below).
* **MakeHuman 1.3 + MPFB2: core graphics assets are CC0** (code is AGPL/GPL,
  which does not affect the exported mesh). This is the clean route to a new
  cast, and it is a Blender addon, so the whole pipeline stays in Blender.
  * <https://static.makehumancommunity.org/about/license.html>
  * <https://static.makehumancommunity.org/mpfb/>
* **Mixamo (Adobe): free, royalty-free for personal/commercial projects** per
  Adobe's FAQ, and it is the intended source of MOTION, not of character art.
  Downloads are not redistributable as standalone assets, so the clips get
  retargeted and baked onto our own skeleton and the source FBX files stay out
  of the repo. <https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html>
* **Quaternius Universal Base Characters: CC0, rigged, glTF** — the fallback if a
  licence-clean, animation-ready body is needed faster than realism allows. Its
  look is stylised, which is the trade.
* **Reallusion CC base meshes**: free to use but under a content EULA that
  restricts embedding in applications. Not chosen.

## The cast the game needs

| character | role | who they are |
|---|---|---|
| **Rowena** | player | early twenties, small; first person, so her body matters for co-op and cutscenes |
| **the caretaker** | antagonist | a tall adult MAN, sixty-odd, in a barong and trousers — he walks, he is tired, he is not a ghost, and he does not stop. He is the reason every room has two ways out. |
| **Nestor** | co-op | thirties, stocky, the one who carries things |
| **Chito** | co-op | a teenager, quick, panics |
| **the household** | set dressing | two or three seated/standing figures for the chapel and the sala — the family that did not leave |

The antagonist being human is a design constraint, not a detail: he needs weight
(footsteps on boards), breath, a silhouette readable at 4 m in torch light, and
clothes that move. All of that is animation and material work, not monster work.

## Order of work

1. **settle the generator.** Verify CharMorph against Blender 4.2 in place
   (its release notes claim "4 compatibility", not 4.2). If it is unstable,
   install MPFB2 and generate from there. Either way, record the licence of every
   asset the characters are built from, in `ASSET_LICENCES.md`.
2. **generate five bodies** to the table above, at real heights, and keep them
   in one `SILID_Cast_v2.blend`.
3. **dress them.** Period-correct 1990s rural clothing. Cloth and leather
   surfaces come from the same CC0 Poly Haven set the house uses
   (`fabricLinen`, `fabricVelvet`, `leather`), so the cast and the house are lit
   from one material library.
4. **bake the game materials.** glTF carries albedo, normal and roughness maps,
   not Blender's layered skin shader. Bake a small set per character: skin
   (base/normal/roughness), eyes, hair cards, and one cloth set per garment.
5. **motion.** Idle (breathing), walk, run, crouch-walk, a stumble, a door push,
   and the antagonist's heavy approach. Retarget onto our rig, bake to the deform
   bones, and export as named clips.
6. **ship** one GLB per character plus `cast_manifest.json` (heights, bone names
   the game binds by, clip list, material roles) — the same contract pattern the
   house uses, so the game never guesses.
7. **bind it.** First-person view model for Rowena; a third-person body for her
   in co-op; the caretaker's chase state machine fed by the house manifest's room
   graph.

## Rules learned the hard way (keep these)

* Never export a rig with its widgets.
* Never export several hundred shape keys "just in case".
* Deform bones only: 164 is a game skeleton, 702 is a rig.
* One character, one GLB, one manifest row — the game should never parse a
  character's name to find its left hand.
