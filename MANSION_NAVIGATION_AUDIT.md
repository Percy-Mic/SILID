# MANSION NAVIGATION AUDIT

How the house is put together, what was broken, what was changed, and what the
running game now actually does when a player walks it. Every number here comes
from a probe against the live build (`http://127.0.0.1:5333/?probe=1`), not from
reading the source and assuming.

## Method

| Script | What it does |
|---|---|
| `scripts/audit_mansion.cjs` | Reports door cuts, floor holes, collider counts, the stair helix sample, and a 3×3 floor/free-space sample of every room. |
| `scripts/traverse_mansion.cjs` | Drives the real player controller up and down every stair, from the foyer to the roof and into the basement and back, and records the step count and foot height at each landing. |
| `scripts/why_blocked.cjs`, `scripts/probe_spot.cjs` | Name the collider that stops a walk at a given point, and report floor height / room / blocked state at a coordinate. |
| `scripts/drawer_test.cjs`, `scripts/story_test.cjs`, `scripts/apparatus_test.cjs` | Interaction and story paths (see `MANSION_QA_REPORT.md`). |

## The levels

| Level | Floor y | Clear height | Rooms | Openings in the slab |
|---|---|---|---|---|
| B1 Basement | −3.40 | 3.40 | 8 | none (it is the bottom) |
| GF Ground | 0.00 | 4.20 | 17 | inner courtyard x 8..20, z −5..2; basement stair x −16.9..−14.5, z −10.9..−6.05 |
| F2 Family | 4.20 | 3.80 | 13 | courtyard; stair tower r 2.45 at (−1.5, 7.5) |
| F3 Older rooms | 8.00 | 3.60 | 11 | courtyard; stair tower |
| F4 Roof | 11.60 | 3.00 | 8 | courtyard; stair tower |

Slabs are 0.30 m thick. The courtyard is a real void through four floors and the
roof; it is ringed on F2 and F3 by the walls of the rooms that face it (a light
well, as in the reference plans), and it is overlooked at roof level from the
Observation Gallery and the roof deck by the stone-and-iron balustrade.

## The stair tower

One continuous spiral, three flights, one per floor change:

- centre (−1.5, 7.5); inner radius 0.55, outer 2.30, walkable width 1.75 m;
- 26 treads per flight, rise 4.20 / 3.80 / 3.60; run 0.26 m per tread;
- floor opening r = 2.45 m in every slab, so the tread stops 0.15 m short of the
  cut edge and the player's shoulder never catches the slab;
- a 13-piece landing fan at the head of each flight, overlapping the slab by
  half a metre — the stair meets the floor instead of ending at the lip;
- a continuous 28 mm iron handrail swept along the helix at each tread edge,
  with one baluster every fourth tread, and a matching collider chain on both
  edges from tread 2 to tread 23 (the ends are left open for the landing);
- a cast newel column up the middle, which closes the well.

**Why the tower was rebuilt.** The old flight was 3.25 m in radius in a 3.5 m
half-width hall, leaving 0.25 m between the tread edge and the plaster — enough
for the player capsule to jam, not enough to stand. The floor openings were also
cut against the wall headers, so the capsule touched the header at the top
tread. The tower is now narrower than the hall by design and every landing is a
sector the floor query knows about (`architecture.extraFloors`).

## The basement stair

A straight flight in the service hall, west of the foyer, not a second spiral:

- opening in the ground slab x −16.9..−14.5, z −10.9..−6.05;
- 26 treads, 0.21 m rise, 0.26 m going, from y 0 down to −3.40;
- 2.40 m clear width; a handrail on the open east side with posts every third
  tread;
- the foot of the flight opens into the Basement Landing (B-01), which wraps
  around the stair so nothing stands in the shaft;
- the south edge of the opening was pulled 0.65 m clear of the basement landing
  wall. With the opening hard against that wall the collision capsule touched the
  header and the stair was impassable — that was one of the original blockers.

## Doors and passages

- 64 openings: 60 hinged leaves with colliders, 4 cased arches (no leaf).
- `architecture.missingDoors` is empty: every authored door landed on a wall and
  was cut. `doorsWithoutCollider` is empty: no hinged door is decorative.
- A door's collider is disabled while its leaf is more than 0.25 rad open, so a
  player can never be trapped behind a door that is visibly open.
- The only locked leaf is the third-floor historical study (F3, x = 13 on the
  z = 4 wall). It is refused without the key and opens with it; see
  `MANSION_PUZZLE_AND_SECRET_MAP.md`.

## Traversal results (live controller)

`scripts/traverse_mansion.cjs`, walking the actual player with the actual
collision, from a standing start on each level:

| Route | Result | Sim steps | Foot height on arrival | Room on arrival |
|---|---|---|---|---|
| GF → F2 | reached | 127 | 4.20 | Grand Stair Hall |
| F2 → F3 | reached | 128 | 8.00 | Grand Stair Hall |
| F3 → F4 | reached | 128 | 11.60 | Observation Gallery |
| F4 → F3 | reached | 133 | 7.86 | Grand Stair Hall |
| F3 → F2 | reached | 132 | 4.20 | Grand Stair Hall |
| F2 → GF | reached | 133 | 0.00 | Foyer |
| GF → B1 | reached | — | −3.38 | Basement Landing |
| B1 → GF | reached | — | −0.08 | Service Hall |

Final line of the run: `ALL FLOORS REACHED: true  BASEMENT BOTH WAYS: true`.

The F4 → F3 descent ends 0.14 m below the third-floor datum, on the last tread
against the landing fan; the player can step off. It is recorded as a residual
imperfection rather than a blocker: the F3 → F2 and F2 → GF descents end exactly
on the floor.

## Room floor audit

`audit_mansion.cjs` samples a 3×3 grid in every room and asks the floor query
and the collision capsule. Every room returns floor at its own level on at least
7 of 9 samples except the four stair halls, which is expected: their samples
fall in the stairwell. No room has zero free samples, i.e. no room is filled
with furniture or wall.

| Room | Floor OK / 9 | Free / 9 | Why |
|---|---|---|---|
| GF-14 Foyer | 8 | 9 | one sample inside the basement stair opening |
| FF2-13 Grand Stair Hall | 5 | 7 | four samples inside the stairwell |
| FF3-12 Grand Stair Hall | 3 | 7 | six samples inside the stairwell / on treads |
| FF4-01 Observation Gallery | 5 | 8 | samples inside the stairwell and courtyard |
| FF4-10 Roof Deck | 7 | 8 | samples inside the courtyard and stairwell |

## Defects found and fixed in this pass

1. **Stair tower jammed.** Radius reduced to 2.30 m, opening to 2.45 m, landing
   fan added at each arrival, handrail and collider chain rebuilt.
2. **Basement stair blocked at the top tread.** Slab opening pulled 0.65 m off
   the wall header; the flight is now walkable both ways.
3. **Stairs drawn in the wrong place.** Step geometry was rotated around the
   world origin after translation, which put the whole flight in the foyer floor
   while its ramp, hole and balustrade stayed at the tower. Rotation now happens
   before the translate, about the tread's own centre, and the offset is from
   the tower centre.
4. **Courtyard balustrade was missing where it mattered.** Stone kerb, iron
   rail and a collider now ring the courtyard edge at roof level, so the player
   can look four storeys down without walking off.
5. **Bell room stood over the void.** It was authored at x 8..14, z −6..0,
   directly over the courtyard hole, with no floor: furniture hung in the air.
   It now stands on the solid south-east roof over Guest Room 4, with doors onto
   the deck.
6. **Rugs floated across the stairwell.** Every stair-hall rug was centred on
   the room and so hung over the open well. `rug()` now keeps clear of the stair
   radius and shrinks or declines rather than float.
7. **The roof deck had no room.** Walking the east or west roof showed
   `PROVINCIAL ROAD` in the HUD and left the deck outside the room audit. The
   deck is now room FF4-10, listed last so every enclosed pavilion wins the
   lookup.
8. **HUD lost the floor mid-flight.** `currentLevel()` used a ±1.5 m window and
   returned null between floors, so the HUD said `PROVINCIAL ROAD` while the
   player climbed the stair. It now returns the nearest floor at or below the
   player's feet.

## Known residual issues

- **F4 → F3 lands 0.14 m low.** Cosmetic; the landing is reachable.
- **F2/F3 courtyard rails are inside walls.** The balustrade is built on every
  floor, but at F2 and F3 the courtyard edge is the wall line of the surrounding
  rooms, so the rail is embedded. It is the roof-level rail that is seen.
- **No collision on thin trim** (skirting, picture frames, curtain edges). This
  is deliberate: they are 20–40 mm proud and would catch the capsule.
- **The inner courtyard has no furniture and no interaction.** It is an
  architectural light well; the working well is outdoors, beside the ruins
  (`src/world/landmarks.js`).
- **No lift, no ramp, no alternative route.** Every floor is reached by the
  tower or the basement flight; that is the design, and both were walked.
