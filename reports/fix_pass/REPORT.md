# Fix pass — floating geometry and facade defects

Verified in the running game (`http://127.0.0.1:5333`), not by reading source alone.
Screenshots in this folder were captured from the live scene with a temporary
inspection light, so they are brighter than play.

## 1. The floating slab in the Front Drawing Room bay

**Symptom.** A dark, rectangular panel hung in mid-air across the wall between
the two south windows of `GF-17`, overlapping the glass. Reported from a
player screenshot and reproduced from the bay interior.

**Diagnosis.** A raycast through the offending pixel, with the camera matrix
refreshed, named the geometry: `Props_GF_woodDark` with `Props_GF_marble` just
behind it — a hanging **portrait** (wood frame, marble mount). `portrait()` is
supposed to refuse to hang a frame over a window, and it does — for a window
whose wall line matches the room boundary. A bay's wall stands 0.21 m outside
the room's boundary line, so the test `|win.c - line| <= 0.03` never matched and
every bay window accepted a frame hung straight over the aperture.

**Fix.** `src/world/props.js`: the wall-vs-window test is now a *band*
(`WIN_BAND = 0.6 m`) rather than a 30 mm match on a single coordinate, in both
`portrait()` and `wallSpans()`. The same latent flaw would have let a wardrobe
stand in a bay window; that is closed too.

**Result.** `01_bay_before.png` → `02_bay_after.png`: the panel is gone, both
windows read cleanly.

## 2. Persiana leaves standing off the wall with nothing behind them

**Symptom.** In the same bay, the folded louvred shutters were mounted 75 mm off
the plaster, so each 0.43 m leaf read as a slab hovering over the wall.

**Fix.** `src/world/facade.js`: leaves hang at 14 mm — flat against the wall, as
a folded persiana actually hangs — and each one now has three hinge straps and
knuckles back to its jamb (new `ironwork` bucket). A leaf whose outer edge would
run past the end of a bay wall is cut down instead of overhanging into air
(`u0`/`u1` are now recorded by `src/world/extensions.js` for bay windows).

## 3. Downpipes standing up through the porch canopy

**Symptom.** Two 11.3 m downpipes were dropped on the middle of the front face,
straight up through the portico roof — they read as naked poles in the drive.

**Fix.** `src/world/facade.js` `rainGoods()`: stations inside the porch span
(|x| < 6.35 m on the south face) are discarded, so the water goods run on the
open wall either side.

**Result.** `04_entry.png` — no poles through the canopy.

## Checks run

| Check | Result |
|---|---|
| `npx vite build` | pass, no new warnings beyond the existing chunk-size notice |
| `node scripts/scan_apps.cjs` | pass, "Phone interface is on the model and wired" |
| Live scene boot (`?probe=1`) | no page errors; only the expected Pointer Lock gesture notice |
| Prop support audit over all 182 placed pieces | no solid piece off its floor, no wall piece detached from a wall |
| Bay interior re-shot | defect gone |

## Still open — not fixed in this pass

These are real and were seen while checking the above. They are **not** done:

- **Roof silhouette.** The building is a four-storey block whose rooftop level
  is an open terrace for most of its length; only the pavilions carry pitched
  roofs, so from the drive the top reads as a parapet band with two small
  gables. A believable mansard/hip over the main block needs the terrace
  re-planned, not just a mesh added — that is a design change, not a fix.
- **Kitchen joinery.** The tall units and the wall cabinets read as plain white
  boxes; they need doors, frames and handles modelled.
- **Ceilings.** Board ceilings in the dining room and kitchen are very dark and
  flat, and the plaster above window heads is bare white.
- One thin dark element still hangs near the east corner of the drawing-room
  bay in external views; it has not been identified yet.

## Commands

```
npm install
npm run dev          # http://127.0.0.1:5333
npx vite build
node scripts/scan_apps.cjs
```
