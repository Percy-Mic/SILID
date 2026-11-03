# East and west elevations — cross-gables and a projecting bay

Verified in the running Vite scene (`http://127.0.0.1:5333/?probe=1`).

## What was wrong

The front elevation has had two gabled pavilions for a while, but both side
elevations were a four-storey wall with a dead-flat parapet line and a thin roof
edge on top. The cause is structural, not cosmetic: every pavilion on the roof
turns its gable ends north and south, and none of them faces east or west, so
from the grounds the house had no roofline at all.

## What was added

**Three cross-gables** (`crossGable()` in `src/world/facade.js`). A cross-gable
is a gabled wing whose ridge runs out through a pavilion's flank, with its own
gable-end wall, rakes, bargeboards, ridge cap and a louvred vent in the
triangle. They stand on the pavilion roofs at the roof deck (EAVE = 14.72 m), so
nothing on the fourth floor moves and the walkable terrace is untouched.

| Wing | Flank | Centre (z) | Width | Projection | Ridge |
|---|---|---|---|---|---|
| Archive (west) | x = −22 | −5.4 | 5.4 m | 2.15 m | 18.04 m |
| Maintenance (west) | x = −22 | 6.0 | 4.8 m | 2.00 m | 17.89 m |
| Bell room (east) | x = +14 | 7.0 | 5.6 m | 2.25 m | 18.59 m |

Each ridge sits just above the pavilion ridge it crosses (17.9 m), which is what
makes the gable read against the sky instead of being swallowed by the roof —
at 3.15 m the first attempt landed 4 cm under the main ridge and vanished.

**A projecting bay on the west elevation** (`westBay()`): a *media agua*, the
ground-floor window bay carried out past the wall on a stone plinth, glazed on
its three outer faces, under its own shallow hip.

- Centred on the west window at z = 2, 3.2 m wide, projecting 1.34 m.
- Clear of the service door at z = 6 and of the next window at z = −2 by 1.9 m.
- Stone plinth to 1.0 m, capiz lights with timber mullions to 3.18 m, head beam
  and cornice, shallow hip to 3.97 m — under the first-floor line at 4.2 m.
- Gutter and a shoe down to the plinth; the house's own window stays behind it,
  so from inside the room the bay reads as a shallow alcove, not a lost window.
- Three colliders (outer face and both returns) so it cannot be walked through.
- Shrubs are no longer planted inside its footprint.

## A bug this exposed

The east wing was invisible from outside even though it existed: its gable-end
triangle was wound so the normal pointed **into** the house, and the render
material is single-sided, so the wall was back-face culled. A horizontal raycast
from x = +30 named it — `Facade_dark` (the vent) was hit at x = 16.30 while the
lime wall in front of it was not there at all. Winding is now taken from `dir`,
and the limewash material is double-sided so a mis-wound gable can never again
disappear silently.

After the fix, a ray from outside hits `Facade_lime` at:

| Height | East (x) | West (x) |
|---|---|---|
| 15.2 m | 16.25 | −24.15 |
| 16.0 m | 16.25 | −24.15 |
| 16.8 m | 16.25 | −24.15 |
| 17.6 m | 16.25 | −24.15 |
| 18.2 m | 16.25 | — (west ridge is 18.04) |

## Checks run

| Check | Result |
|---|---|
| `npx vite build` | pass (only the existing chunk-size notice) |
| Live scene boot | no page errors |
| Both ramps of every gable end hit from outside | pass (table above) |
| West and east elevations re-shot from the grounds | gables read against the sky |
| West bay close-up | plinth, glazing, mullions, hip, gutter and downpipe all present |

## Known limitations

- The east elevation is heavily screened by trees at eye level; `05_east_from_southeast.png`
  is taken from a raised camera just above the treeline. From the ground the
  east gable is often hidden by foliage, which is a scene-vegetation issue, not
  a facade one.
- The cross-gables rise into the pavilion roof planes where they cross. The
  junction is a plain intersection: there are no valley flashings modelled
  between the wing and the pavilion roof. Not visible from the grounds, visible
  if you stand on the terrace and look up close.
- No collider is added for the gables: they sit 3 m above the terrace roof
  surface and are unreachable.

## Reproduce

```
npm run dev
# then, in the scene console: window.__silid.spawnAt(x, z, y, yaw, pitch)
```
