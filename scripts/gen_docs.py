# Generates MANSION_ROOM_BIBLE.md and MANSION_INTERACTION_CATALOG.md from the
# data the running game reports (reports/mansion/rooms.json and catalog.json).
# Nothing here invents geometry: if a room has no furniture or no interaction,
# the table says so.
import json
from collections import Counter, defaultdict

rooms = json.load(open('reports/mansion/rooms.json', encoding='utf8'))['rooms']
cat = json.load(open('reports/mansion/catalog.json', encoding='utf8'))
doors = cat['doors']
items = cat['items']

LEVEL_NAMES = {
    'B1': 'Basement', 'GF': 'Ground Floor', 'F2': 'Second floor (family)',
    'F3': 'Third floor (older rooms)', 'F4': 'Fourth floor (roof and secrets)',
}

USE = {
    'B-01': 'Foot of the service stair; circulation only. Nothing may stand in the shaft.',
    'B-02': 'Household storage. Shelves and crates along the walls, a clear route to the wine cellar.',
    'B-03': 'Bottle storage and the family\'s overflow. Cool, damp, one working lamp.',
    'B-04': 'The generator, its fuel, and the fuse panel on the east wall. The mandatory repair happens here.',
    'B-05': 'Workshop: bench, tools, the ceramic fuse, and the maintenance record.',
    'B-06': 'East-west service corridor linking the basement rooms. Kept empty so it can be run through.',
    'B-07': 'Old cellar under the courtyard side; unpainted concrete, stored household goods.',
    'B-08': 'Tunnel junction: the service passage leaves the house here.',
    'GF-00': 'North-south service corridor from the kitchen wing to the foyer back wall.',
    'GF-01': 'Working kitchen: range, sink, counters, base cabinets and three drawers.',
    'GF-02': 'Dry goods pantry between kitchen and laundry.',
    'GF-03': 'Laundry: washer, basin, storage.',
    'GF-04': 'Staff bedroom off the service wing; lived-in, modest.',
    'GF-05': 'Small guest room at the front of the service wing.',
    'GF-06': 'Library and study: desk, shelves, the notebook, and a pedestal of three drawers.',
    'GF-07': 'Formal dining for twelve, with the sideboard and the long table.',
    'GF-08': 'Informal family lounge, opening onto the courtyard.',
    'GF-09': 'Guest room on the courtyard\'s north side.',
    'GF-10': 'Wine room with a courtyard door; storage, not a corridor.',
    'GF-11': 'The inner courtyard: open to the sky on every floor, ringed by balustrades above. The well stands here.',
    'GF-12': 'Reception gallery: the spine of the ground floor, four arches, portraits, console and a chair.',
    'GF-13': 'Formal living room: sofa, armchairs, centre table, and the front windows.',
    'GF-14': 'Entrance foyer: the front door, console, portraits, the player\'s phone, and the foot of the stair.',
    'GF-15': 'Sitting room east of the foyer; small, domestic, a place to wait.',
    'GF-16': 'Large front guest room on the east side; the roof level\'s bell room stands over it.',
    'FF2-01': 'Upper landing: the spine of the family floor, from the prayer room to the stair hall.',
    'FF2-02': 'South walkway linking the east and west ends of the family floor.',
    'FF2-03': 'Master bedroom: bed, dresser with three drawers, aparador, the brass key.',
    'FF2-04': 'Her dressing room between the master bedroom and the master bath.',
    'FF2-05': 'Master bath: tub, basin, wc, storage.',
    'FF2-06': 'Bedroom 3 with a nightstand of two drawers.',
    'FF2-07': 'Prayer room at the west end: altar, pews, family saints.',
    'FF2-08': 'Linen room: shelves, folded bedding, spare pillows.',
    'FF2-09': 'Family sitting room at the front of the west wing.',
    'FF2-10': 'Bedroom 2, front west.',
    'FF2-11': 'Bedroom 5, front east, beside the stair hall.',
    'FF2-12': 'Small study/library off the south walkway.',
    'FF2-13': 'Grand stair hall: the well, the balustrade, and the flight down to the foyer.',
    'FF3-01': 'Upper gallery walkway: the long spine of the third floor.',
    'FF3-02': 'South walkway; the locked study opens off it.',
    'FF3-03': 'Ancestral portrait gallery: the family in order, oldest to newest.',
    'FF3-04': 'Music room: piano, chairs, sheet music.',
    'FF3-05': 'Guest bedroom 2 at the west end.',
    'FF3-06': 'Master suite on the third floor, kept for the eldest.',
    'FF3-07': 'Family room off the south walkway.',
    'FF3-08': 'Sewing and craft room: table, machine, fabric, a spare fuse.',
    'FF3-09': 'Private bedroom 3, reached through the sewing room.',
    'FF3-10': 'Locked historical study. The brass key from the master bedroom opens it.',
    'FF3-12': 'Grand stair hall, third floor.',
    'FF4-01': 'Observation gallery on the roof: the stair arrives here, and the east roof deck opens off it.',
    'FF4-02': 'Archive and library on the roof level: ledgers, boxes, the family record.',
    'FF4-03': 'Observatory: the telescope under the open roof.',
    'FF4-04': 'Bell and clock room on the solid south-east roof; the bell frame stands in the middle.',
    'FF4-05': 'Roof lantern over the stair hall: glazing, storage, a way onto the deck.',
    'FF4-06': 'Maintenance room: tools, spare parts, a spare fuse.',
    'FF4-07': 'Caretaker\'s room: bed, table, belongings, the last person to live here.',
}

KIND_DEFAULT = {
    'corridor': 'Circulation. Kept clear.',
    'bedroom': 'Bed, storage, a bedside table.',
    'storage': 'Shelves and stored household goods.',
    'living': 'Seating around a table.',
    'dining': 'Table, chairs, sideboard.',
    'study': 'Desk, shelves, papers.',
    'kitchen': 'Counters, cabinets, cooking equipment.',
    'bath': 'Fixtures against the walls, storage.',
    'utility': 'Service equipment and storage.',
    'gallery': 'Portraits and a console.',
    'foyer': 'Entrance furniture and the stair.',
    'workshop': 'Bench, tools, parts.',
    'chapel': 'Altar and seating.',
    'music': 'Instrument and seating.',
    'dressing': 'Dressing table and wardrobe.',
    'tunnel': 'Service passage.',
    'courtyard': 'Open to the sky; the well.',
    'bell': 'Bell frame under the roof.',
    'observatory': 'Telescope under the open roof.',
    'generator': 'Generator and fuel.',
}

out = []
w = out.append
w('# MANSION ROOM BIBLE')
w('')
w('SILID — the ancestral house as it is actually built in `src/world/plan.js`,')
w('`src/world/architecture.js` and `src/world/props.js`.')
w('')
w('Every table below is generated from the running build: `scripts/dump_rooms.cjs`')
w('reads the placed furniture, the interaction points and the lights out of')
w('`window.__silid` and writes `reports/mansion/rooms.json`; this document is')
w('rendered from that file by `scripts/gen_docs.py`. If a room is bare, the')
w('table says it is bare — this is an inventory, not a wish list.')
w('')
w('## Coordinate system and levels')
w('')
w('+x east, +z north, +y up. The entrance face is z = +11. The inner courtyard')
w('is x 8..20, z -5..2 and is a hole in every slab above the ground floor and in')
w('the roof; the stair tower stands at (-1.5, 7.5) and is a hole of r = 2.45 in')
w('every slab above it. Slabs are 0.30 m; room rectangles are clear interior')
w('dimensions; walls are generated on the shared boundary lines.')
w('')
w('| Level | Name | Floor y | Height | Rooms |')
w('|---|---|---|---|---|')
for lid in ['B1', 'GF', 'F2', 'F3', 'F4']:
    rs = [r for r in rooms if r['level'] == lid]
    y = {'B1': -3.4, 'GF': 0, 'F2': 4.2, 'F3': 8.0, 'F4': 11.6}[lid]
    h = {'B1': 3.4, 'GF': 4.2, 'F2': 3.8, 'F3': 3.6, 'F4': 3.0}[lid]
    w(f'| {lid} | {LEVEL_NAMES[lid]} | {y} | {h} | {len(rs)} |')
w('')
w('## Floors at a glance')
w('')
for lid in ['B1', 'GF', 'F2', 'F3', 'F4']:
    rs = [r for r in rooms if r['level'] == lid]
    total = sum(r['furnitureCount'] for r in rs)
    inter = sum(len(r['interactables']) for r in rs)
    lights = sum(r['lights'] for r in rs)
    w(f'- **{lid} — {LEVEL_NAMES[lid]}**: {len(rs)} rooms, {total} furniture pieces, {inter} interaction points, {lights} room lights.')
w('')
w('The interaction count includes every inspectable piece (beds, aparadors,')
w('cabinets, sinks, the stove) plus drawers, pickups, the fuse panel and the')
w('generator. Doors are counted separately, in `MANSION_INTERACTION_CATALOG.md`.')
w('')

for lid in ['B1', 'GF', 'F2', 'F3', 'F4']:
    w(f'## {lid} — {LEVEL_NAMES[lid]}')
    w('')
    w('| Room | Use | Area m² | Furnished with | Interactive | Lights |')
    w('|---|---|---|---|---|---|')
    for r in [x for x in rooms if x['level'] == lid]:
        furn = ', '.join(f'{k}×{v}' if v > 1 else k for k, v in
                         sorted(r['furniture'].items(), key=lambda kv: -kv[1])[:5])
        if r['furnitureCount'] == 0:
            furn = '—'
        elif r['furnitureCount'] > 5:
            furn += f', +{r["furnitureCount"] - sum(list(sorted(r["furniture"].values(), reverse=True))[:5])} more'
        note = USE.get(r['id']) or KIND_DEFAULT.get(r['kind'], '')
        area = f'{r["area"]:g} (gross; the pavilions stand on it)' if r['id'] == 'FF4-10' else f'{r["area"]:g}'
        w(f'| {r["id"]} {r["name"]} | {note} | {area} | {furn} | {len(r["interactables"])} | {r["lights"]} |')
    w('')

w('## Standing furniture set')
w('')
w('All furniture is modelled in `scripts/build_furniture.py` and loaded from')
w('`public/assets/models/furniture.glb`; it is not boxes. Each piece is validated')
w('on placement (inside the clear room rect, clear of door approaches, not')
w('overlapping another piece) and the rejected count is reported by the audit.')
w('')
w('## Rooms with no furnished interior')
w('')
for r in rooms:
    if r['furnitureCount'] == 0:
        w(f'- **{r["level"]} {r["id"]} {r["name"]}** ({r["kind"]}): {USE.get(r["id"], KIND_DEFAULT.get(r["kind"], ""))}')
w('')
w('These are corridors, the open courtyard, the tunnel junction and the bell')
w('room. The bell room and the observatory hold built-in architecture (a bell')
w('frame, a telescope) rather than GLB furniture; the courtyard holds the well.')
w('')
w('## What the bible does not claim')
w('')
w('The room programme is 57 rooms, all of them reachable and all of them')
w('furnished except the circulation and open-air spaces above. It is not the')
w('four printed sheets room for room: corridors shown on the drawings that would')
w('produce dead geometry are merged into the gallery and the walkways, and some')
w('printed rooms are merged into larger ones (see the comment at the top of')
w('`plan.js`). The furnishing is a standing set — beds, tables, seating,')
w('shelving, kitchen equipment — not a bespoke prop pass per room.')
open('MANSION_ROOM_BIBLE.md', 'w', encoding='utf8').write('\n'.join(out) + '\n')
print('room bible', len(out), 'lines')

# ---------------------------------------------------------------- catalog ----
by_kind = defaultdict(list)
for i in items:
    by_kind[i['kind']].append(i)
doors_by_level = defaultdict(list)
for d in doors:
    doors_by_level[d['level']].append(d)

c = []
w = c.append
w('# MANSION INTERACTION CATALOG')
w('')
w('Every interactive object in the built house, generated from the running game')
w('(`scripts/dump_catalog.cjs` → `reports/mansion/catalog.json`). Objects that')
w('are not in this document are scenery by decision, not by omission.')
w('')
w('## How interaction works')
w('')
w('`Game.nearestInteraction()` scores every candidate against the player\'s view')
w('ray: horizontal facing must be within 68°, the object must be within 3.0 m,')
w('and the winner is the smallest angular miss, not the nearest object. That is')
w('what stops a column of drawers from fighting for one prompt. Doors are only')
w('offered on their own floor (±1.6 m of foot height). A target more than 3 m')
w('away or behind the player is not offered at all, so nothing can be activated')
w('through a wall.')
w('')
w('| Verb | Target kind | What happens | Persistent state |')
w('|---|---|---|---|')
w('| `open the door` / `close the door` | door | The leaf swings 1.35 rad over')
w(' ~0.4 s; the collider is disabled while open. | `door.open`, `door.collider.disabled` |')
w('| `try the lock` | locked door | Refused with the reason; with `key` in the')
w(' inventory the lock gives on the same press. | `door.unlocked` |')
w('| `open drawer` / `search` / `close` | drawer | The drawer slides 0.30 m on')
w(' its runners; an open drawer with contents is searched before it is closed. | `drawer.open`, `drawer.contents.taken` |')
w('| `take <item>` | pickup | The item enters the inventory and its marker is hidden. | `inventory`, `state.hasFuel/hasFuse/hasKey` |')
w('| `read <document>` | read | The text is shown and the document is added to the inventory. | `inventory` |')
w('| `inspect <object>` | inspect | Authored text about the object; a second look is recorded as a repeat. | `game.seen` |')
w('| `open the fuse panel` / `fit the fuse` / `close the panel` | fusebox | The cover swings 1.45 rad; the ceramic fuse seats in the carrier. | `panel.open`, `panel.fuseInstalled`, `state.fuseInstalled` |')
w('| `repair` | generator | Checks fuel and fuse, then starts the set: lights, porch lamp, gate power. | `state.powered`, `state.phase` |')
w('| `open` | gate | After power, the gate leaves swing and the act ends. | `state.gateOpen` |')
w('')
w(f'## Totals')
w('')
w('| Kind | Count |')
w('|---|---|')
for k in ['inspect', 'drawer', 'pickup', 'read', 'fusebox', 'generator']:
    w(f'| {k} | {len(by_kind[k])} |')
w(f'| door (hinged) | {sum(1 for d in doors if not d["arch"])} |')
w(f'| arch (cased opening, no leaf) | {sum(1 for d in doors if d["arch"])} |')
w('')
w('## Doors and passages')
w('')
for lid in ['B1', 'GF', 'F2', 'F3', 'F4']:
    ds = doors_by_level[lid]
    w(f'### {lid} — {len(ds)} openings')
    w('')
    w('| Axis | Position (c, at) | Width | Type | Lock |')
    w('|---|---|---|---|---|')
    for d in ds:
        typ = 'entrance' if d['entrance'] else ('arch' if d['arch'] else 'hinged')
        w(f'| {d["axis"]} | {d["at"][0]:g}, {d["at"][1]:g} | {d["width"]:g} | {typ} | {"locked" if d["locked"] else "—"} |')
    w('')
w('The `try the lock` door is the third-floor historical study (F3, x = 13 on')
w('the z = 4 wall). The key is the pickup in the master bedroom (F2 FF2-03).')
w('')
w('## Stateful containers')
w('')
w('| Cabinet | Room | Drawers | Contents |')
w('|---|---|---|---|')
seen = set()
for i in by_kind['drawer']:
    unit = i['id'].split(':')[1]
    room = i['room']
    if unit in seen:
        continue
    seen.add(unit)
    ds = [x for x in by_kind['drawer'] if x['id'].split(':')[1] == unit]
    cont = [x['contents'] for x in ds if x['contents']]
    w(f'| {unit} | {room} | {len(ds)} | {", ".join(cont) if cont else "—"} |')
w('')
w('## Pickups and documents')
w('')
w('| ID | Name | Where | Effect |')
w('|---|---|---|---|')
effects = {
    'fuel': 'Diesel for the generator; sets `hasFuel`.',
    'fuse': 'Ceramic fuse; seats in the panel carrier. Three copies exist (workshop, sewing room, maintenance) so the mandatory one cannot be lost.',
    'key': 'Brass key to the third-floor historical study; sets `hasKey`.',
    'phone': 'Del\'s phone; three markers (foyer, F2 stair hall, F3 stair hall) so the handheld UI is reachable from any floor.',
    'note': 'The caretaker\'s notebook; adds `note` to the inventory and prints the legible line.',
}
for i in items:
    if i['kind'] in ('pickup', 'read') and not (i['kind'] == 'inspect'):
        nm = i['name']
        w(f'| {i["id"]} | {i["name"]} | {i["room"]} at ({i["at"][0]:g}, {i["at"][1]:g}, {i["at"][2]:g}) | {effects.get(i["id"], "—")} |')
w('')
w('## Machinery')
w('')
w('| Object | Room | Verbs | Dependencies |')
w('|---|---|---|---|')
w('| Generator | B1 B-04 Generator Room | inspect, repair | diesel (`fuel`), a fuse fitted in the panel or carried; then powers the house |')
w('| Fuse panel | B1 B-04 east wall | open cover, fit fuse, close | `fuse` in inventory; `hasFuse` or `fuseInstalled` |')
w('| Estate gate | drive, south of the house | open | `state.powered` |')
w('')
w('## Inspectable objects')
w('')
w(f'{len(by_kind["inspect"])} pieces carry authored text. They are grouped here by')
w('object; the unique IDs are in the appendix and in `catalog.json`.')
w('')
group = defaultdict(list)
for i in by_kind['inspect']:
    tmpl = i['id'].split(':')[-1]
    group[(i['name'], tmpl)].append(i['room'])
w('| Object | Template | Count | Rooms |')
w('|---|---|---|---|')
for (name, tmpl), rs in sorted(group.items()):
    rl = ', '.join(sorted({r.split(' ', 1)[1] if ' ' in r else r for r in rs}))
    w(f'| {name} | {tmpl} | {len(rs)} | {rl} |')
w('')
w('## Appendix — every inspectable ID')
w('')
w('```')
for i in by_kind['inspect']:
    w(f'{i["id"]}\t{i["room"]}')
w('```')
open('MANSION_INTERACTION_CATALOG.md', 'w', encoding='utf8').write('\n'.join(c) + '\n')
print('catalog', len(c), 'lines')
