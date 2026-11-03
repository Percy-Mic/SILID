# MANSION INTERACTION CATALOG

Every interactive object in the built house, generated from the running game
(`scripts/dump_catalog.cjs` → `reports/mansion/catalog.json`). Objects that
are not in this document are scenery by decision, not by omission.

## How interaction works

`Game.nearestInteraction()` scores every candidate against the player's view
ray: horizontal facing must be within 68°, the object must be within 3.0 m,
and the winner is the smallest angular miss, not the nearest object. That is
what stops a column of drawers from fighting for one prompt. Doors are only
offered on their own floor (±1.6 m of foot height). A target more than 3 m
away or behind the player is not offered at all, so nothing can be activated
through a wall.

| Verb | Target kind | What happens | Persistent state |
|---|---|---|---|
| `open the door` / `close the door` | door | The leaf swings 1.35 rad over
 ~0.4 s; the collider is disabled while open. | `door.open`, `door.collider.disabled` |
| `try the lock` | locked door | Refused with the reason; with `key` in the
 inventory the lock gives on the same press. | `door.unlocked` |
| `open drawer` / `search` / `close` | drawer | The drawer slides 0.30 m on
 its runners; an open drawer with contents is searched before it is closed. | `drawer.open`, `drawer.contents.taken` |
| `take <item>` | pickup | The item enters the inventory and its marker is hidden. | `inventory`, `state.hasFuel/hasFuse/hasKey` |
| `read <document>` | read | The text is shown and the document is added to the inventory. | `inventory` |
| `inspect <object>` | inspect | Authored text about the object; a second look is recorded as a repeat. | `game.seen` |
| `open the fuse panel` / `fit the fuse` / `close the panel` | fusebox | The cover swings 1.45 rad; the ceramic fuse seats in the carrier. | `panel.open`, `panel.fuseInstalled`, `state.fuseInstalled` |
| `repair` | generator | Checks fuel and fuse, then starts the set: lights, porch lamp, gate power. | `state.powered`, `state.phase` |
| `open` | gate | After power, the gate leaves swing and the act ends. | `state.gateOpen` |

## Totals

| Kind | Count |
|---|---|
| inspect | 182 |
| drawer | 13 |
| pickup | 8 |
| read | 1 |
| fusebox | 1 |
| generator | 1 |
| door (hinged) | 60 |
| arch (cased opening, no leaf) | 4 |

## Doors and passages

### B1 — 9 openings

| Axis | Position (c, at) | Width | Type | Lock |
|---|---|---|---|---|
| x | -5.4, -18 | 1.1 | hinged | — |
| x | 2, -16 | 1 | hinged | — |
| x | 2, -4 | 1 | hinged | — |
| x | 2, 3 | 1 | hinged | — |
| x | 2, 10.5 | 1 | hinged | — |
| x | 4, 3 | 1 | hinged | — |
| x | 4, 10.5 | 1 | hinged | — |
| z | -8, -2 | 1 | hinged | — |
| z | 16, 6 | 1.8 | hinged | — |

### GF — 21 openings

| Axis | Position (c, at) | Width | Type | Lock |
|---|---|---|---|---|
| x | 11, 0 | 2.2 | entrance | — |
| x | 2, 0 | 2.8 | arch | — |
| x | 2, -10 | 1.2 | hinged | — |
| x | 2, 6.5 | 1 | hinged | — |
| z | 8, 0 | 2.6 | arch | — |
| z | -14, 0 | 2.2 | arch | — |
| x | -2, -10 | 1.2 | hinged | — |
| x | -2, -2.5 | 1.6 | arch | — |
| x | -2, 5 | 1.2 | hinged | — |
| z | -17, -4.8 | 1 | hinged | — |
| z | -17, -2 | 1 | hinged | — |
| z | -17, 2 | 1 | hinged | — |
| z | -17, 6 | 1 | hinged | — |
| z | -17, 9.5 | 1 | hinged | — |
| z | -14, -3.5 | 1 | hinged | — |
| z | -14, 6 | 1 | hinged | — |
| z | -24, 6 | 1.2 | hinged | — |
| z | 8, -3.5 | 1 | hinged | — |
| x | -5, 11.5 | 1.1 | hinged | — |
| x | -5, 17 | 1 | hinged | — |
| x | 2, 15 | 1.1 | hinged | — |

### F2 — 14 openings

| Axis | Position (c, at) | Width | Type | Lock |
|---|---|---|---|---|
| x | -2, -2 | 1.4 | hinged | — |
| x | -2, -10.5 | 1 | hinged | — |
| x | -2, -18 | 1 | hinged | — |
| z | 2, -8 | 1 | hinged | — |
| z | 5, -8 | 1 | hinged | — |
| x | -6, 5 | 1 | hinged | — |
| x | 2, -18 | 1 | hinged | — |
| x | 4, -9 | 1 | hinged | — |
| x | 4, 7 | 1 | hinged | — |
| x | 4, 14 | 1 | hinged | — |
| z | 10, 6 | 1 | hinged | — |
| z | 5, 6 | 1.3 | hinged | — |
| x | -2, 5.5 | 1 | hinged | — |
| x | 4, -17 | 1 | hinged | — |

### F3 — 11 openings

| Axis | Position (c, at) | Width | Type | Lock |
|---|---|---|---|---|
| x | -2, -2 | 1.4 | hinged | — |
| x | -2, -10.5 | 1 | hinged | — |
| x | -2, -18 | 1 | hinged | — |
| x | 2, -18 | 1.6 | hinged | — |
| x | 2, 6 | 1.6 | hinged | — |
| x | 4, -18 | 1 | hinged | — |
| x | 4, -9 | 1 | hinged | — |
| x | 4, 13 | 1 | hinged | — |
| x | 4, 3 | 1.4 | hinged | — |
| z | 2, -8 | 1 | hinged | — |
| z | 8, -8 | 1 | hinged | — |

### F4 — 9 openings

| Axis | Position (c, at) | Width | Type | Lock |
|---|---|---|---|---|
| x | 0, -18 | 1 | hinged | — |
| x | -5, -7 | 1 | hinged | — |
| x | 4, 11 | 1.2 | hinged | — |
| z | 8, 7 | 1 | hinged | — |
| z | 5, 8 | 1.2 | hinged | — |
| x | 2, -18 | 1 | hinged | — |
| x | 4, -10 | 1 | hinged | — |
| z | -6, 6 | 1 | hinged | — |
| x | -6, 2 | 1 | hinged | — |

The `try the lock` door is the third-floor historical study (F3, x = 13 on
the z = 4 wall). The key is the pickup in the master bedroom (F2 FF2-03).

## Stateful containers

| Cabinet | Room | Drawers | Contents |
|---|---|---|---|
| master_dresser | F2 FF2-03 Master Bedroom | 3 | letter |
| bedroom3_nightstand | F2 FF2-06 Bedroom 3 | 2 | photograph |
| study_pedestal | GF GF-06 Library / Study | 3 | ledgerpage |
| kitchen_drawers | GF GF-01 Kitchen | 3 | matches |
| foyer_console | GF GF-14 Foyer | 2 | — |

## Pickups and documents

| ID | Name | Where | Effect |
|---|---|---|---|
| fuel | a jerry can of diesel | B1 B-04 Generator Room at (1.1, -2.95, -6.6) | Diesel for the generator; sets `hasFuel`. |
| fuse | a ceramic fuse | B1 B-05 Workshop at (10, -2.45, 1.45) | Ceramic fuse; seats in the panel carrier. Three copies exist (workshop, sewing room, maintenance) so the mandatory one cannot be lost. |
| phone | a smart phone | GF GF-14 Foyer at (-0.5, 0.05, 6.45) | Del's phone; three markers (foyer, F2 stair hall, F3 stair hall) so the handheld UI is reachable from any floor. |
| phone | a smart phone | F2 FF2-13 Grand Stair Hall at (-0.5, 4.25, 7.45) | Del's phone; three markers (foyer, F2 stair hall, F3 stair hall) so the handheld UI is reachable from any floor. |
| fuse | a ceramic fuse | F3 FF3-08 Sewing / Craft Room at (5, 8.95, -5.55) | Ceramic fuse; seats in the panel carrier. Three copies exist (workshop, sewing room, maintenance) so the mandatory one cannot be lost. |
| phone | a smart phone | F3 FF3-12 Grand Stair Hall at (-0.5, 8.05, 7.45) | Del's phone; three markers (foyer, F2 stair hall, F3 stair hall) so the handheld UI is reachable from any floor. |
| fuse | a ceramic fuse | F4 FF4-10 Roof Deck at (-18, 12.55, 9.45) | Ceramic fuse; seats in the panel carrier. Three copies exist (workshop, sewing room, maintenance) so the mandatory one cannot be lost. |
| note | a wet notebook | GF GF-06 Library / Study at (-10, 0.82, -2.8) | The caretaker's notebook; adds `note` to the inventory and prints the legible line. |
| key | a brass key | F2 FF2-03 Master Bedroom at (-3.2, 4.26, -4.2) | Brass key to the third-floor historical study; sets `hasKey`. |

## Machinery

| Object | Room | Verbs | Dependencies |
|---|---|---|---|
| Generator | B1 B-04 Generator Room | inspect, repair | diesel (`fuel`), a fuse fitted in the panel or carried; then powers the house |
| Fuse panel | B1 B-04 east wall | open cover, fit fuse, close | `fuse` in inventory; `hasFuse` or `fuseInstalled` |
| Estate gate | drive, south of the house | open | `state.powered` |

## Inspectable objects

182 pieces carry authored text. They are grouped here by
object; the unique IDs are in the appendix and in `catalog.json`.

| Object | Template | Count | Rooms |
|---|---|---|---|
| the aparador | wardrobe | 14 | FF2-03 Master Bedroom, FF2-04 Her Dressing Room, FF2-06 Bedroom 3, FF2-10 Bedroom 2, FF2-11 Bedroom 5, FF3-05 Guest Bedroom 2, FF3-06 Master Suite, FF3-09 Private Bedroom 3, FF4-10 Roof Deck, GF-04 Staff Room, GF-05 Guest Room 1, GF-09 Guest Room 3, GF-16 Guest Room 4 |
| the armchair | armchair | 13 | FF2-09 Family Sitting Room, FF2-12 Study / Library, FF3-03 Ancestral Portrait Gallery, FF3-04 Music Room, FF3-07 Family Room, FF3-10 Locked Historical Study, FF4-10 Roof Deck, GF-06 Library / Study, GF-08 Family Lounge, GF-12 Gallery / Reception Hall, GF-13 Formal Living Room, GF-15 Sitting Room |
| the bath | bath_tub | 1 | FF2-05 Master Bath |
| the bed | bed | 12 | FF2-03 Master Bedroom, FF2-06 Bedroom 3, FF2-10 Bedroom 2, FF2-11 Bedroom 5, FF3-05 Guest Bedroom 2, FF3-06 Master Suite, FF3-09 Private Bedroom 3, FF4-10 Roof Deck, GF-04 Staff Room, GF-05 Guest Room 1, GF-09 Guest Room 3, GF-16 Guest Room 4 |
| the bedside table | nightstand | 21 | FF2-03 Master Bedroom, FF2-06 Bedroom 3, FF2-10 Bedroom 2, FF2-11 Bedroom 5, FF3-05 Guest Bedroom 2, FF3-06 Master Suite, FF4-10 Roof Deck, GF-04 Staff Room, GF-05 Guest Room 1, GF-09 Guest Room 3, GF-16 Guest Room 4 |
| the bench | bench | 6 | B-05 Workshop, FF2-04 Her Dressing Room, FF2-07 Prayer Room, FF3-08 Sewing / Craft Room, FF4-10 Roof Deck |
| the cabinet | cabinet_base | 5 | GF-01 Kitchen |
| the centre table | coffee_table | 5 | FF2-09 Family Sitting Room, FF3-07 Family Room, GF-08 Family Lounge, GF-13 Formal Living Room, GF-15 Sitting Room |
| the chair | dining_chair | 12 | FF2-12 Study / Library, FF3-10 Locked Historical Study, FF4-10 Roof Deck, GF-06 Library / Study, GF-07 Dining Room |
| the console table | console | 17 | B-01 Basement Landing, B-04 Generator Room, FF2-01 Upper Landing, FF2-07 Prayer Room, FF2-09 Family Sitting Room, FF2-13 Grand Stair Hall, FF3-01 Upper Gallery Walkway, FF3-03 Ancestral Portrait Gallery, FF3-04 Music Room, FF3-07 Family Room, FF3-12 Grand Stair Hall, FF4-10 Roof Deck, GF-00 Service Hall, GF-08 Family Lounge, GF-12 Gallery / Reception Hall, GF-13 Formal Living Room, GF-14 Foyer |
| the counter | counter_top | 3 | GF-01 Kitchen |
| the desk | desk | 4 | FF2-12 Study / Library, FF3-10 Locked Historical Study, FF4-10 Roof Deck, GF-06 Library / Study |
| the dining table | dining_table | 4 | B-05 Workshop, FF3-08 Sewing / Craft Room, FF4-10 Roof Deck, GF-07 Dining Room |
| the dresser | dresser | 13 | FF2-03 Master Bedroom, FF2-04 Her Dressing Room, FF2-06 Bedroom 3, FF2-10 Bedroom 2, FF3-05 Guest Bedroom 2, FF3-06 Master Suite, FF3-09 Private Bedroom 3, FF4-10 Roof Deck, GF-04 Staff Room, GF-05 Guest Room 1, GF-07 Dining Room, GF-09 Guest Room 3, GF-16 Guest Room 4 |
| the refrigerator | fridge | 1 | GF-01 Kitchen |
| the shelves | bookshelf | 29 | B-02 Storage Cellar, B-03 Wine Cellar, B-05 Workshop, B-07 Old Cellar, FF2-08 Linen Room, FF2-12 Study / Library, FF3-08 Sewing / Craft Room, FF3-10 Locked Historical Study, FF4-10 Roof Deck, GF-02 Pantry, GF-06 Library / Study, GF-10 Wine Room |
| the shower | shower | 1 | FF2-05 Master Bath |
| the side table | side_table | 8 | FF2-05 Master Bath, FF2-09 Family Sitting Room, FF3-04 Music Room, FF3-07 Family Room, FF4-10 Roof Deck, GF-08 Family Lounge, GF-13 Formal Living Room, GF-15 Sitting Room |
| the sink | sink_unit | 2 | GF-01 Kitchen, GF-03 Laundry |
| the sofa | sofa | 5 | FF2-09 Family Sitting Room, FF3-07 Family Room, GF-08 Family Lounge, GF-13 Formal Living Room, GF-15 Sitting Room |
| the stove | cooker | 1 | GF-01 Kitchen |
| the toilet | wc | 1 | FF2-05 Master Bath |
| the wall cupboard | wall_cabinet | 2 | GF-01 Kitchen |
| the wash basin | basin | 1 | FF2-05 Master Bath |
| the washing machine | washer | 1 | GF-03 Laundry |

## Appendix — every inspectable ID

```
inspect:B1:B-01:0:console	B1 B-01 Basement Landing
inspect:B1:B-02:1:bookshelf	B1 B-02 Storage Cellar
inspect:B1:B-02:2:bookshelf	B1 B-02 Storage Cellar
inspect:B1:B-03:3:bookshelf	B1 B-03 Wine Cellar
inspect:B1:B-03:4:bookshelf	B1 B-03 Wine Cellar
inspect:B1:B-04:5:console	B1 B-04 Generator Room
inspect:B1:B-05:6:dining_table	B1 B-05 Workshop
inspect:B1:B-05:7:bookshelf	B1 B-05 Workshop
inspect:B1:B-05:8:bench	B1 B-05 Workshop
inspect:B1:B-07:9:bookshelf	B1 B-07 Old Cellar
inspect:B1:B-07:10:bookshelf	B1 B-07 Old Cellar
inspect:GF:GF-00:11:console	GF GF-00 Service Hall
inspect:GF:GF-01:12:cabinet_base	GF GF-01 Kitchen
inspect:GF:GF-01:13:cabinet_base	GF GF-01 Kitchen
inspect:GF:GF-01:14:sink_unit	GF GF-01 Kitchen
inspect:GF:GF-01:15:cabinet_base	GF GF-01 Kitchen
inspect:GF:GF-01:16:counter_top	GF GF-01 Kitchen
inspect:GF:GF-01:17:counter_top	GF GF-01 Kitchen
inspect:GF:GF-01:18:wall_cabinet	GF GF-01 Kitchen
inspect:GF:GF-01:19:cooker	GF GF-01 Kitchen
inspect:GF:GF-01:21:cabinet_base	GF GF-01 Kitchen
inspect:GF:GF-01:22:cabinet_base	GF GF-01 Kitchen
inspect:GF:GF-01:23:counter_top	GF GF-01 Kitchen
inspect:GF:GF-01:24:fridge	GF GF-01 Kitchen
inspect:GF:GF-01:25:wall_cabinet	GF GF-01 Kitchen
inspect:GF:GF-02:26:bookshelf	GF GF-02 Pantry
inspect:GF:GF-02:27:bookshelf	GF GF-02 Pantry
inspect:GF:GF-03:28:washer	GF GF-03 Laundry
inspect:GF:GF-03:29:sink_unit	GF GF-03 Laundry
inspect:GF:GF-04:30:bed	GF GF-04 Staff Room
inspect:GF:GF-04:31:nightstand	GF GF-04 Staff Room
inspect:GF:GF-04:32:nightstand	GF GF-04 Staff Room
inspect:GF:GF-04:33:wardrobe	GF GF-04 Staff Room
inspect:GF:GF-04:34:dresser	GF GF-04 Staff Room
inspect:GF:GF-05:35:bed	GF GF-05 Guest Room 1
inspect:GF:GF-05:36:nightstand	GF GF-05 Guest Room 1
inspect:GF:GF-05:37:nightstand	GF GF-05 Guest Room 1
inspect:GF:GF-05:38:wardrobe	GF GF-05 Guest Room 1
inspect:GF:GF-05:39:dresser	GF GF-05 Guest Room 1
inspect:GF:GF-06:40:desk	GF GF-06 Library / Study
inspect:GF:GF-06:41:dining_chair	GF GF-06 Library / Study
inspect:GF:GF-06:42:bookshelf	GF GF-06 Library / Study
inspect:GF:GF-06:43:bookshelf	GF GF-06 Library / Study
inspect:GF:GF-06:44:bookshelf	GF GF-06 Library / Study
inspect:GF:GF-06:45:armchair	GF GF-06 Library / Study
inspect:GF:GF-07:46:dining_table	GF GF-07 Dining Room
inspect:GF:GF-07:47:dining_chair	GF GF-07 Dining Room
inspect:GF:GF-07:48:dining_chair	GF GF-07 Dining Room
inspect:GF:GF-07:49:dining_chair	GF GF-07 Dining Room
inspect:GF:GF-07:50:dining_chair	GF GF-07 Dining Room
inspect:GF:GF-07:51:dining_chair	GF GF-07 Dining Room
inspect:GF:GF-07:52:dining_chair	GF GF-07 Dining Room
inspect:GF:GF-07:53:dining_chair	GF GF-07 Dining Room
inspect:GF:GF-07:54:dining_chair	GF GF-07 Dining Room
inspect:GF:GF-07:55:dresser	GF GF-07 Dining Room
inspect:GF:GF-08:56:sofa	GF GF-08 Family Lounge
inspect:GF:GF-08:57:coffee_table	GF GF-08 Family Lounge
inspect:GF:GF-08:58:armchair	GF GF-08 Family Lounge
inspect:GF:GF-08:59:side_table	GF GF-08 Family Lounge
inspect:GF:GF-08:60:console	GF GF-08 Family Lounge
inspect:GF:GF-09:61:bed	GF GF-09 Guest Room 3
inspect:GF:GF-09:62:nightstand	GF GF-09 Guest Room 3
inspect:GF:GF-09:63:nightstand	GF GF-09 Guest Room 3
inspect:GF:GF-09:64:wardrobe	GF GF-09 Guest Room 3
inspect:GF:GF-09:65:dresser	GF GF-09 Guest Room 3
inspect:GF:GF-10:66:bookshelf	GF GF-10 Wine Room
inspect:GF:GF-10:67:bookshelf	GF GF-10 Wine Room
inspect:GF:GF-12:68:console	GF GF-12 Gallery / Reception Hall
inspect:GF:GF-12:69:armchair	GF GF-12 Gallery / Reception Hall
inspect:GF:GF-13:70:sofa	GF GF-13 Formal Living Room
inspect:GF:GF-13:71:coffee_table	GF GF-13 Formal Living Room
inspect:GF:GF-13:72:armchair	GF GF-13 Formal Living Room
inspect:GF:GF-13:73:side_table	GF GF-13 Formal Living Room
inspect:GF:GF-13:74:console	GF GF-13 Formal Living Room
inspect:GF:GF-14:75:console	GF GF-14 Foyer
inspect:GF:GF-15:76:sofa	GF GF-15 Sitting Room
inspect:GF:GF-15:77:coffee_table	GF GF-15 Sitting Room
inspect:GF:GF-15:78:armchair	GF GF-15 Sitting Room
inspect:GF:GF-15:79:side_table	GF GF-15 Sitting Room
inspect:GF:GF-16:80:bed	GF GF-16 Guest Room 4
inspect:GF:GF-16:81:nightstand	GF GF-16 Guest Room 4
inspect:GF:GF-16:82:nightstand	GF GF-16 Guest Room 4
inspect:GF:GF-16:83:wardrobe	GF GF-16 Guest Room 4
inspect:GF:GF-16:84:dresser	GF GF-16 Guest Room 4
inspect:F2:FF2-01:85:console	F2 FF2-01 Upper Landing
inspect:F2:FF2-03:86:bed	F2 FF2-03 Master Bedroom
inspect:F2:FF2-03:87:nightstand	F2 FF2-03 Master Bedroom
inspect:F2:FF2-03:88:nightstand	F2 FF2-03 Master Bedroom
inspect:F2:FF2-03:89:wardrobe	F2 FF2-03 Master Bedroom
inspect:F2:FF2-03:90:dresser	F2 FF2-03 Master Bedroom
inspect:F2:FF2-04:91:wardrobe	F2 FF2-04 Her Dressing Room
inspect:F2:FF2-04:92:wardrobe	F2 FF2-04 Her Dressing Room
inspect:F2:FF2-04:93:bench	F2 FF2-04 Her Dressing Room
inspect:F2:FF2-04:94:dresser	F2 FF2-04 Her Dressing Room
inspect:F2:FF2-05:95:bath_tub	F2 FF2-05 Master Bath
inspect:F2:FF2-05:96:basin	F2 FF2-05 Master Bath
inspect:F2:FF2-05:97:wc	F2 FF2-05 Master Bath
inspect:F2:FF2-05:98:shower	F2 FF2-05 Master Bath
inspect:F2:FF2-05:99:side_table	F2 FF2-05 Master Bath
inspect:F2:FF2-06:100:bed	F2 FF2-06 Bedroom 3
inspect:F2:FF2-06:101:nightstand	F2 FF2-06 Bedroom 3
inspect:F2:FF2-06:102:nightstand	F2 FF2-06 Bedroom 3
inspect:F2:FF2-06:103:wardrobe	F2 FF2-06 Bedroom 3
inspect:F2:FF2-06:104:dresser	F2 FF2-06 Bedroom 3
inspect:F2:FF2-07:105:console	F2 FF2-07 Prayer Room
inspect:F2:FF2-07:106:bench	F2 FF2-07 Prayer Room
inspect:F2:FF2-08:107:bookshelf	F2 FF2-08 Linen Room
inspect:F2:FF2-08:108:bookshelf	F2 FF2-08 Linen Room
inspect:F2:FF2-09:109:sofa	F2 FF2-09 Family Sitting Room
inspect:F2:FF2-09:110:coffee_table	F2 FF2-09 Family Sitting Room
inspect:F2:FF2-09:111:armchair	F2 FF2-09 Family Sitting Room
inspect:F2:FF2-09:112:side_table	F2 FF2-09 Family Sitting Room
inspect:F2:FF2-09:113:console	F2 FF2-09 Family Sitting Room
inspect:F2:FF2-10:114:bed	F2 FF2-10 Bedroom 2
inspect:F2:FF2-10:115:nightstand	F2 FF2-10 Bedroom 2
inspect:F2:FF2-10:116:nightstand	F2 FF2-10 Bedroom 2
inspect:F2:FF2-10:117:wardrobe	F2 FF2-10 Bedroom 2
inspect:F2:FF2-10:118:dresser	F2 FF2-10 Bedroom 2
inspect:F2:FF2-11:119:bed	F2 FF2-11 Bedroom 5
inspect:F2:FF2-11:120:nightstand	F2 FF2-11 Bedroom 5
inspect:F2:FF2-11:121:wardrobe	F2 FF2-11 Bedroom 5
inspect:F2:FF2-12:122:desk	F2 FF2-12 Study / Library
inspect:F2:FF2-12:123:dining_chair	F2 FF2-12 Study / Library
inspect:F2:FF2-12:124:bookshelf	F2 FF2-12 Study / Library
inspect:F2:FF2-12:125:bookshelf	F2 FF2-12 Study / Library
inspect:F2:FF2-12:126:bookshelf	F2 FF2-12 Study / Library
inspect:F2:FF2-12:127:armchair	F2 FF2-12 Study / Library
inspect:F2:FF2-13:128:console	F2 FF2-13 Grand Stair Hall
inspect:F3:FF3-01:129:console	F3 FF3-01 Upper Gallery Walkway
inspect:F3:FF3-03:130:console	F3 FF3-03 Ancestral Portrait Gallery
inspect:F3:FF3-03:131:armchair	F3 FF3-03 Ancestral Portrait Gallery
inspect:F3:FF3-04:132:console	F3 FF3-04 Music Room
inspect:F3:FF3-04:133:armchair	F3 FF3-04 Music Room
inspect:F3:FF3-04:134:side_table	F3 FF3-04 Music Room
inspect:F3:FF3-05:135:bed	F3 FF3-05 Guest Bedroom 2
inspect:F3:FF3-05:136:nightstand	F3 FF3-05 Guest Bedroom 2
inspect:F3:FF3-05:137:nightstand	F3 FF3-05 Guest Bedroom 2
inspect:F3:FF3-05:138:wardrobe	F3 FF3-05 Guest Bedroom 2
inspect:F3:FF3-05:139:dresser	F3 FF3-05 Guest Bedroom 2
inspect:F3:FF3-06:140:bed	F3 FF3-06 Master Suite
inspect:F3:FF3-06:141:nightstand	F3 FF3-06 Master Suite
inspect:F3:FF3-06:142:nightstand	F3 FF3-06 Master Suite
inspect:F3:FF3-06:143:wardrobe	F3 FF3-06 Master Suite
inspect:F3:FF3-06:144:dresser	F3 FF3-06 Master Suite
inspect:F3:FF3-07:145:sofa	F3 FF3-07 Family Room
inspect:F3:FF3-07:146:coffee_table	F3 FF3-07 Family Room
inspect:F3:FF3-07:147:armchair	F3 FF3-07 Family Room
inspect:F3:FF3-07:148:side_table	F3 FF3-07 Family Room
inspect:F3:FF3-07:149:console	F3 FF3-07 Family Room
inspect:F3:FF3-08:150:dining_table	F3 FF3-08 Sewing / Craft Room
inspect:F3:FF3-08:151:bookshelf	F3 FF3-08 Sewing / Craft Room
inspect:F3:FF3-08:152:bench	F3 FF3-08 Sewing / Craft Room
inspect:F3:FF3-09:153:bed	F3 FF3-09 Private Bedroom 3
inspect:F3:FF3-09:154:wardrobe	F3 FF3-09 Private Bedroom 3
inspect:F3:FF3-09:155:dresser	F3 FF3-09 Private Bedroom 3
inspect:F3:FF3-10:156:desk	F3 FF3-10 Locked Historical Study
inspect:F3:FF3-10:157:dining_chair	F3 FF3-10 Locked Historical Study
inspect:F3:FF3-10:158:bookshelf	F3 FF3-10 Locked Historical Study
inspect:F3:FF3-10:159:bookshelf	F3 FF3-10 Locked Historical Study
inspect:F3:FF3-10:160:bookshelf	F3 FF3-10 Locked Historical Study
inspect:F3:FF3-10:161:armchair	F3 FF3-10 Locked Historical Study
inspect:F3:FF3-12:162:console	F3 FF3-12 Grand Stair Hall
inspect:F4:FF4-01:163:console	F4 FF4-10 Roof Deck
inspect:F4:FF4-01:164:armchair	F4 FF4-10 Roof Deck
inspect:F4:FF4-02:165:desk	F4 FF4-10 Roof Deck
inspect:F4:FF4-02:166:dining_chair	F4 FF4-10 Roof Deck
inspect:F4:FF4-02:167:bookshelf	F4 FF4-10 Roof Deck
inspect:F4:FF4-02:168:bookshelf	F4 FF4-10 Roof Deck
inspect:F4:FF4-02:169:bookshelf	F4 FF4-10 Roof Deck
inspect:F4:FF4-02:170:armchair	F4 FF4-10 Roof Deck
inspect:F4:FF4-03:171:side_table	F4 FF4-10 Roof Deck
inspect:F4:FF4-05:172:bookshelf	F4 FF4-10 Roof Deck
inspect:F4:FF4-05:173:bookshelf	F4 FF4-10 Roof Deck
inspect:F4:FF4-06:174:dining_table	F4 FF4-10 Roof Deck
inspect:F4:FF4-06:175:bookshelf	F4 FF4-10 Roof Deck
inspect:F4:FF4-06:176:bench	F4 FF4-10 Roof Deck
inspect:F4:FF4-07:177:bed	F4 FF4-10 Roof Deck
inspect:F4:FF4-07:178:nightstand	F4 FF4-10 Roof Deck
inspect:F4:FF4-07:179:nightstand	F4 FF4-10 Roof Deck
inspect:F4:FF4-07:180:wardrobe	F4 FF4-10 Roof Deck
inspect:F4:FF4-07:181:dresser	F4 FF4-10 Roof Deck
inspect:F4:FF4-10:182:bench	F4 FF4-10 Roof Deck
```
