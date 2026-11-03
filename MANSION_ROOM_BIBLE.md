# MANSION ROOM BIBLE

SILID — the ancestral house as it is actually built in `src/world/plan.js`,
`src/world/architecture.js` and `src/world/props.js`.

Every table below is generated from the running build: `scripts/dump_rooms.cjs`
reads the placed furniture, the interaction points and the lights out of
`window.__silid` and writes `reports/mansion/rooms.json`; this document is
rendered from that file by `scripts/gen_docs.py`. If a room is bare, the
table says it is bare — this is an inventory, not a wish list.

## Coordinate system and levels

+x east, +z north, +y up. The entrance face is z = +11. The inner courtyard
is x 8..20, z -5..2 and is a hole in every slab above the ground floor and in
the roof; the stair tower stands at (-1.5, 7.5) and is a hole of r = 2.45 in
every slab above it. Slabs are 0.30 m; room rectangles are clear interior
dimensions; walls are generated on the shared boundary lines.

| Level | Name | Floor y | Height | Rooms |
|---|---|---|---|---|
| B1 | Basement | -3.4 | 3.4 | 8 |
| GF | Ground Floor | 0 | 4.2 | 17 |
| F2 | Second floor (family) | 4.2 | 3.8 | 13 |
| F3 | Third floor (older rooms) | 8.0 | 3.6 | 11 |
| F4 | Fourth floor (roof and secrets) | 11.6 | 3.0 | 8 |

## Floors at a glance

- **B1 — Basement**: 8 rooms, 11 furniture pieces, 15 interaction points, 2 room lights.
- **GF — Ground Floor**: 17 rooms, 73 furniture pieces, 83 interaction points, 17 room lights.
- **F2 — Second floor (family)**: 13 rooms, 44 furniture pieces, 51 interaction points, 11 room lights.
- **F3 — Third floor (older rooms)**: 11 rooms, 34 furniture pieces, 36 interaction points, 9 room lights.
- **F4 — Fourth floor (roof and secrets)**: 8 rooms, 20 furniture pieces, 21 interaction points, 5 room lights.

The interaction count includes every inspectable piece (beds, aparadors,
cabinets, sinks, the stove) plus drawers, pickups, the fuse panel and the
generator. Doors are counted separately, in `MANSION_INTERACTION_CATALOG.md`.

## B1 — Basement

| Room | Use | Area m² | Furnished with | Interactive | Lights |
|---|---|---|---|---|---|
| B-01 Basement Landing | Foot of the service stair; circulation only. Nothing may stand in the shaft. | 28 | console | 1 | 0 |
| B-02 Storage Cellar | Household storage. Shelves and crates along the walls, a clear route to the wine cellar. | 81.4 | bookshelf×2 | 2 | 0 |
| B-03 Wine Cellar | Bottle storage and the family's overflow. Cool, damp, one working lamp. | 51.8 | bookshelf×2 | 2 | 0 |
| B-04 Generator Room | The generator, its fuel, and the fuse panel on the east wall. The mandatory repair happens here. | 60 | console | 4 | 1 |
| B-05 Workshop | Workshop: bench, tools, the ceramic fuse, and the maintenance record. | 80 | dining_table, bookshelf, bench | 4 | 1 |
| B-06 Service Passage | East-west service corridor linking the basement rooms. Kept empty so it can be run through. | 66 | — | 0 | 0 |
| B-07 Old Cellar | Old cellar under the courtyard side; unpainted concrete, stored household goods. | 28 | bookshelf×2 | 2 | 0 |
| B-08 Tunnel Junction | Tunnel junction: the service passage leaves the house here. | 40 | — | 0 | 0 |

## GF — Ground Floor

| Room | Use | Area m² | Furnished with | Interactive | Lights |
|---|---|---|---|---|---|
| GF-00 Service Hall | North-south service corridor from the kitchen wing to the foyer back wall. | 66 | console | 1 | 0 |
| GF-01 Kitchen | Working kitchen: range, sink, counters, base cabinets and three drawers. | 49 | cabinet_base×5, counter_top×3, wall_cabinet×2, sink_unit, cooker, +1 more | 16 | 2 |
| GF-02 Pantry | Dry goods pantry between kitchen and laundry. | 28 | bookshelf×2 | 2 | 0 |
| GF-03 Laundry | Laundry: washer, basin, storage. | 28 | washer, sink_unit | 2 | 1 |
| GF-04 Staff Room | Staff bedroom off the service wing; lived-in, modest. | 28 | nightstand×2, bed, wardrobe, dresser | 5 | 2 |
| GF-05 Guest Room 1 | Small guest room at the front of the service wing. | 21 | nightstand×2, bed, wardrobe, dresser | 5 | 2 |
| GF-06 Library / Study | Library and study: desk, shelves, the notebook, and a pedestal of three drawers. | 72 | bookshelf×3, desk, dining_chair, armchair, +0 more | 10 | 1 |
| GF-07 Dining Room | Formal dining for twelve, with the sideboard and the long table. | 72 | dining_chair×8, dining_table, dresser, +0 more | 10 | 0 |
| GF-08 Family Lounge | Informal family lounge, opening onto the courtyard. | 54 | sofa, coffee_table, armchair, side_table, console | 5 | 1 |
| GF-09 Guest Room 3 | Guest room on the courtyard's north side. | 36 | nightstand×2, bed, wardrobe, dresser | 5 | 2 |
| GF-10 Wine Room | Wine room with a courtyard door; storage, not a corridor. | 42 | bookshelf×2 | 2 | 0 |
| GF-11 Inner Courtyard | The inner courtyard: open to the sky on every floor, ringed by balustrades above. The well stands here. | 84 | — | 0 | 0 |
| GF-12 Gallery / Reception Hall | Reception gallery: the spine of the ground floor, four arches, portraits, console and a chair. | 88 | console, armchair | 2 | 1 |
| GF-13 Formal Living Room | Formal living room: sofa, armchairs, centre table, and the front windows. | 81 | sofa, coffee_table, armchair, side_table, console | 5 | 1 |
| GF-14 Foyer | Entrance foyer: the front door, console, portraits, the player's phone, and the foot of the stair. | 81 | console | 4 | 1 |
| GF-15 Sitting Room | Sitting room east of the foyer; small, domestic, a place to wait. | 36 | sofa, coffee_table, armchair, side_table | 4 | 1 |
| GF-16 Guest Room 4 | Large front guest room on the east side; the roof level's bell room stands over it. | 117 | nightstand×2, bed, wardrobe, dresser | 5 | 2 |

## F2 — Second floor (family)

| Room | Use | Area m² | Furnished with | Interactive | Lights |
|---|---|---|---|---|---|
| FF2-01 Upper Landing | Upper landing: the spine of the family floor, from the prayer room to the stair hall. | 120 | console | 1 | 0 |
| FF2-02 South Walkway | South walkway linking the east and west ends of the family floor. | 84 | — | 0 | 0 |
| FF2-03 Master Bedroom | Master bedroom: bed, dresser with three drawers, aparador, the brass key. | 72 | nightstand×2, bed, wardrobe, dresser | 9 | 2 |
| FF2-04 Her Dressing Room | Her dressing room between the master bedroom and the master bath. | 15 | wardrobe×2, bench, dresser | 4 | 0 |
| FF2-05 Master Bath | Master bath: tub, basin, wc, storage. | 15 | bath_tub, basin, wc, shower, side_table | 5 | 1 |
| FF2-06 Bedroom 3 | Bedroom 3 with a nightstand of two drawers. | 63 | nightstand×2, bed, wardrobe, dresser | 7 | 2 |
| FF2-07 Prayer Room | Prayer room at the west end: altar, pews, family saints. | 63 | console, bench | 2 | 0 |
| FF2-08 Linen Room | Linen room: shelves, folded bedding, spare pillows. | 20 | bookshelf×2 | 2 | 0 |
| FF2-09 Family Sitting Room | Family sitting room at the front of the west wing. | 54 | sofa, coffee_table, armchair, side_table, console | 5 | 1 |
| FF2-10 Bedroom 2 | Bedroom 2, front west. | 36 | nightstand×2, bed, wardrobe, dresser | 5 | 2 |
| FF2-11 Bedroom 5 | Bedroom 5, front east, beside the stair hall. | 30 | bed, nightstand, wardrobe | 3 | 1 |
| FF2-12 Study / Library | Small study/library off the south walkway. | 36 | bookshelf×3, desk, dining_chair, armchair, +0 more | 6 | 1 |
| FF2-13 Grand Stair Hall | Grand stair hall: the well, the balustrade, and the flight down to the foyer. | 77 | console | 2 | 1 |

## F3 — Third floor (older rooms)

| Room | Use | Area m² | Furnished with | Interactive | Lights |
|---|---|---|---|---|---|
| FF3-01 Upper Gallery Walkway | Upper gallery walkway: the long spine of the third floor. | 120 | console | 1 | 0 |
| FF3-02 South Walkway | South walkway; the locked study opens off it. | 84 | — | 0 | 0 |
| FF3-03 Ancestral Portrait Gallery | Ancestral portrait gallery: the family in order, oldest to newest. | 72 | console, armchair | 2 | 1 |
| FF3-04 Music Room | Music room: piano, chairs, sheet music. | 63 | console, armchair, side_table | 3 | 0 |
| FF3-05 Guest Bedroom 2 | Guest bedroom 2 at the west end. | 63 | nightstand×2, bed, wardrobe, dresser | 5 | 2 |
| FF3-06 Master Suite | Master suite on the third floor, kept for the eldest. | 48 | nightstand×2, bed, wardrobe, dresser | 5 | 2 |
| FF3-07 Family Room | Family room off the south walkway. | 36 | sofa, coffee_table, armchair, side_table, console | 5 | 1 |
| FF3-08 Sewing / Craft Room | Sewing and craft room: table, machine, fabric, a spare fuse. | 36 | dining_table, bookshelf, bench | 4 | 1 |
| FF3-09 Private Bedroom 3 | Private bedroom 3, reached through the sewing room. | 36 | bed, wardrobe, dresser | 3 | 0 |
| FF3-10 Locked Historical Study | Locked historical study. The brass key from the master bedroom opens it. | 36 | bookshelf×3, desk, dining_chair, armchair, +0 more | 6 | 1 |
| FF3-12 Grand Stair Hall | Grand stair hall, third floor. | 63 | console | 2 | 1 |

## F4 — Fourth floor (roof and secrets)

| Room | Use | Area m² | Furnished with | Interactive | Lights |
|---|---|---|---|---|---|
| FF4-01 Observation Gallery | Observation gallery on the roof: the stair arrives here, and the east roof deck opens off it. | 99 | console, armchair | 3 | 1 |
| FF4-02 Archive / Library | Archive and library on the roof level: ledgers, boxes, the family record. | 88 | bookshelf×3, desk, dining_chair, armchair, +0 more | 6 | 1 |
| FF4-03 Observatory | Observatory: the telescope under the open roof. | 36 | side_table | 1 | 0 |
| FF4-04 Bell / Clock Room | Bell and clock room on the solid south-east roof; the bell frame stands in the middle. | 36 | — | 0 | 0 |
| FF4-05 Roof Lantern | Roof lantern over the stair hall: glazing, storage, a way onto the deck. | 30 | bookshelf×2 | 2 | 0 |
| FF4-06 Maintenance Room | Maintenance room: tools, spare parts, a spare fuse. | 64 | dining_table, bookshelf, bench | 4 | 1 |
| FF4-07 Caretaker's Room | Caretaker's room: bed, table, belongings, the last person to live here. | 36 | nightstand×2, bed, wardrobe, dresser | 5 | 2 |
| FF4-10 Roof Deck |  | 1012 (gross; the pavilions stand on it) | bench | 0 | 0 |

## Standing furniture set

All furniture is modelled in `scripts/build_furniture.py` and loaded from
`public/assets/models/furniture.glb`; it is not boxes. Each piece is validated
on placement (inside the clear room rect, clear of door approaches, not
overlapping another piece) and the rejected count is reported by the audit.

## Rooms with no furnished interior

- **B1 B-06 Service Passage** (corridor): East-west service corridor linking the basement rooms. Kept empty so it can be run through.
- **B1 B-08 Tunnel Junction** (tunnel): Tunnel junction: the service passage leaves the house here.
- **GF GF-11 Inner Courtyard** (courtyard): The inner courtyard: open to the sky on every floor, ringed by balustrades above. The well stands here.
- **F2 FF2-02 South Walkway** (corridor): South walkway linking the east and west ends of the family floor.
- **F3 FF3-02 South Walkway** (corridor): South walkway; the locked study opens off it.
- **F4 FF4-04 Bell / Clock Room** (bell): Bell and clock room on the solid south-east roof; the bell frame stands in the middle.

These are corridors, the open courtyard, the tunnel junction and the bell
room. The bell room and the observatory hold built-in architecture (a bell
frame, a telescope) rather than GLB furniture; the courtyard holds the well.

## What the bible does not claim

The room programme is 57 rooms, all of them reachable and all of them
furnished except the circulation and open-air spaces above. It is not the
four printed sheets room for room: corridors shown on the drawings that would
produce dead geometry are merged into the gallery and the walkways, and some
printed rooms are merged into larger ones (see the comment at the top of
`plan.js`). The furnishing is a standing set — beds, tables, seating,
shelving, kitchen equipment — not a bespoke prop pass per room.
