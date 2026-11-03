# Mansion envelope rebuild — what changed and what was tested

SILID's house was already a complete, furnished, walkable four-storey building:
57 rooms, 66 doors, a spiral stair through three floors, a basement flight, an
inner courtyard, a rooftop level, a client-side solvability suite. What it was
not was Filipino. The exterior had been authored, in so many words, as "a
decayed high-Victorian manor": a mansard skirt, a round corner turret with a
cone, a front gable, chimney stacks, quoins, gothic hood moulds, a slate roof
and a concrete portico slab on stone piers. From the drive that is a French
château, which is the one thing the brief rules out.

So this pass rebuilt the **envelope** — everything outside the plaster line —
and left the plan, the interiors, the stairs, the colliders, the roof deck, the
ladder route and the underground connection alone. The house now reads as a
Filipino ancestral mansion: a stone ground floor carrying two timber storeys,
under low hipped roofs with deep eaves, with capiz windows, ventanillas,
persiana shutters and a timber portico.

## What the elevation is now

| Element | Before | Now |
|---|---|---|
| Ground floor | cold grey render with drawn ashlar | rubble-stone base course, stone corner piers |
| F2 / F3 | same grey render for four storeys | vertical board siding in stained narra tones, floor bands and drips at each storey line |
| F4 / attic | mansard slate hung outside the walls | limewashed pavilions, and the outer wall only where a pavilion stands against it — the rest of the rooftop edge is the azotea parapet |
| Roofs | mansard + gables + turret + chimneys, slate | hipped roofs over the pavilions, weathered corrugated iron, 0.95 m eaves, exposed rafter tails, fascia, ridge cap |
| Windows | stone surrounds under segmental arches | dark narra architraves, two sliding capiz sashes, fixed shell transom, louvred persiana either side, ventanilla under the sill, projecting board sill |
| Entrance | concrete canopy on stone piers | turned posts on stone plinths, calado frieze, boarded soffit, 30° hipped canopy |
| Balconies | bare concrete slabs | boarded azoteas on joists and brackets with turned-baluster rails |
| Foot of the wall | bare | fern clumps between the doors, downpipes and shoes in the bays clear of windows |

## Files changed

- `src/world/facade.js` — rewritten. It builds only what stands outside the
  plaster line: plinth and its colliders, corner piers, storey bands, the whole
  window dressing, the entrance, the portico, the pavilion hips, rain goods and
  the planting. One merged mesh per material.
- `src/world/materials.js` — new `facadeWood` (board siding) and `roofTin`
  (corrugated galvanised iron); `facade` repurposed as limewash; the drawn
  ashlar moved off the render and onto the dressed stone only; tile sizes for
  the new surfaces.
- `src/world/architecture.js` — the exterior wall is now materialed **per
  storey** (stone / boards / limewash) instead of one grey for the block; the
  F4 perimeter is split by `deckSpans()` so the azotea is open behind a parapet
  and closed only where a pavilion meets the perimeter or a door is cut; the two
  front balconies rebuilt in timber; exterior wall UVs corrected (the wall boxes
  carry UVs at 0.4 units per metre, so every exterior tile was 2.5× life size —
  which is why the stone read as vertical boards).

Nothing else in `src/` was touched by this pass. In particular the road, forest,
terrain, underground tunnel, props, interactions and story are untouched.

## Tests actually run

| Check | Command | Result |
|---|---|---|
| Production build | `npx vite build` | pass — 997 kB / 283 kB gzip |
| Boot + console | headless probe, `?probe=1` | no page errors; the `[facade]` fallback warning that caught two real bugs (`B is not defined` in `hipRoof`, and a missing `B` argument in `pavilionRoofs`) is now silent |
| Architecture audit | `node scripts/audit_mansion.cjs` | 66 doors, `missingDoors: []`, `doorsWithoutCollider: []`, 1169 colliders, `errors: []` |
| Roof route | `node scripts/roof_route.cjs` | ladder prompt → climb 11.6 m in 349 frames → service door → deck → back → descent, `errors: []` |
| App wiring | `node scripts/scan_apps.cjs` | pass |
| Visual | `scripts/exterior_shots.cjs`, `scripts/facade_close.cjs`, `scripts/facade_roof_shots.cjs` | screenshots in `reports/rebuild_final/`, `reports/rebuild_close/`, `reports/rebuild_roof/` |

The audit's room floor samples still pass; the only rooms below 9/9 remain the
stair halls, whose samples fall in the stairwell, exactly as before.

## Limits of this pass — read before calling it finished

- **The plan and interiors were not rebuilt.** They already survived a full QA
  pass (57 rooms, all reachable, all but six circulation/roof spaces furnished
  from a shared 26-piece Blender furniture set). No bespoke per-room prop pass
  happened this turn, so the furniture is still a standing set.
- **There is no `.blend` for the house.** The mansion is generated by
  `plan.js` → `architecture.js` → `facade.js`; `Blender/AssetLibrary/Working/`
  no longer contains a `House/` directory (the build scripts under it are
  referenced by `npm run build:house` but the folder is absent from this tree,
  and it is not inside `Blender.zip` either). Supplying a `.blend` would mean
  re-modelling the house in Blender, not exporting what exists — I did not
  fabricate one.
- **The night lighting is mood, not a render test.** The screenshots use a
  temporary hemisphere + directional light that the shot scripts add and never
  ship; the real game is much darker, and the capiz panes in particular read
  brighter in these frames than they will in play.
- **The pavilion roofs stop above the parapet.** They are hipped and overhang by
  0.95 m, but the house is still a four-storey block under them; a single
  sweeping roof over the whole footprint would have covered the playable roof
  deck.
- **No new downloaded assets.** Everything here is geometry and the Poly Haven
  textures the project already owned; `ASSET_LICENSES.md` is unchanged and
  accurate.
