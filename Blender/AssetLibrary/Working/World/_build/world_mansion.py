"""SILID_COMPLETE_WORLD — the mansion.

Built from the numbers in plan.js, not from a second floor plan typed into
Python. Walls are derived from the rooms' shared edges, so a room added to the
game appears here, and a wall that is shared is built once. Openings are cut
through those walls: every door in plan.js is a hole with a leaf, every facade
run gets its capiz windows at 4.2 m centres, and every hole gets its lintel.

The roof is the game's roof: a hipped or gabled iron roof over each rooftop
pavilion, starting at the pavilion ceilings (14.72), with the three projecting
cross-gables on the east and west flanks that were added to break up the
elevations. The azotea is a floor at 11.6 with a parapet, the service ladder
climbs the rear wall at x = -12.5, and the hatch through the parapet is real.

Stairs are the game's continuous four-storey stair: two 1.12 m lanes between
z = 9.20 and z = 6.10, a half landing at z = 4.25..6.10, and 12/12, 11/11,
11/10 risers for the three storeys. Nothing here teleports or fakes a floor.
"""

import math

import bpy

import world_common as W

EAVE = 14.72
PARA = 11.6
TE = 0.42
TI = 0.30
WINDOWS = dict(spacing=4.2, width=1.08, sill=0.85, head=3.2)

WALL_EXT = {'B1': 'concrete', 'GF': 'stone', 'F2': 'wood_timber', 'F3': 'wood_timber', 'F4': 'lime'}
WALL_INT = {'B1': 'concrete', 'GF': 'plaster_blue', 'F2': 'wallpaper', 'F3': 'wallpaper', 'F4': 'plaster_warm'}
FLOOR_MAT = {'woodFloor': 'wood_floor', 'woodFloorOld': 'wood_floor_old',
             'concreteFloor': 'concrete_floor', 'concrete': 'concrete'}
CEIL_MAT = {'wallPlaster': 'plaster_warm', 'woodGrey': 'wood_timber', 'concrete': 'concrete'}

AUDIT = {'unmatched_doors': [], 'windows': 0, 'doors': 0, 'levels': [], 'rooms': 0}

# Every opening built, for the interiors pass: portraits and shelves must not
# be hung across a window, and furniture must not stand in a doorway.
WINDOWS_BUILT = []
DOORS_BUILT = []


# --- small geometry helpers ------------------------------------------------
def vertical_panel(bucket, pts, y0, y1):
    """A thin plan-shaped slab standing up: door leaves, shutters, glass."""
    base = len(bucket.verts)
    for p in pts:
        bucket.verts.append((p[0], p[1], y0))
    for p in pts:
        bucket.verts.append((p[0], p[1], y1))
    n = len(pts)
    bucket.faces.append(tuple(range(base + n - 1, base - 1, -1)))
    bucket.faces.append(tuple(range(base + n, base + 2 * n)))
    for k in range(n):
        a, b = base + k, base + (k + 1) % n
        bucket.faces.append((a, b, b + n, a + n))


def split_at(spans, breaks):
    out = []
    for a, b in spans:
        pts = [a] + sorted(set(x for x in breaks if a + 0.01 < x < b - 0.01)) + [b]
        out += [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    return out


def merge_intervals(items, tol=0.03):
    if not items:
        return []
    items = sorted(items)
    out = [list(items[0])]
    for a, b in items[1:]:
        if a <= out[-1][1] + tol:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return [tuple(v) for v in out]


def in_room(rooms, x, z, eps=0.06):
    for r in rooms:
        if r['x0'] - eps <= x <= r['x1'] + eps and r['z0'] - eps <= z <= r['z1'] + eps:
            return True
    return False


def in_hole(level, x, z, eps=0.02):
    for h in level.get('holes', []) or []:
        if h.get('kind') == 'rect':
            if h['x0'] - eps <= x <= h['x1'] + eps and h['z0'] - eps <= z <= h['z1'] + eps:
                return True
    return False


def edge_walls(level):
    """Unique wall lines from the room rectangles: shared walls appear once."""
    horiz, vert = {}, {}
    for r in level['rooms']:
        for z in (r['z0'], r['z1']):
            horiz.setdefault(round(z, 3), []).append((r['x0'], r['x1']))
        for x in (r['x0'], r['x1']):
            vert.setdefault(round(x, 3), []).append((r['z0'], r['z1']))
    return ({k: merge_intervals(v) for k, v in horiz.items()},
            {k: merge_intervals(v) for k, v in vert.items()})


# --- floors and ceilings ---------------------------------------------------
def slab_cells(level):
    """The floor plan as non-overlapping cells, holes removed.

    A union of room rectangles with rectangular holes cannot be built as one
    plate: the courtyard would be covered and the stair would be sealed. Cutting
    a grid at every room and hole boundary and keeping the covered cells is the
    smallest correct answer, and it never double-builds a shared floor.
    """
    xs, zs = set(), set()
    for r in level['rooms']:
        xs.update((r['x0'], r['x1']))
        zs.update((r['z0'], r['z1']))
    for h in level.get('holes', []) or []:
        if h.get('kind') == 'rect':
            xs.update((h['x0'], h['x1']))
            zs.update((h['z0'], h['z1']))
    xs, zs = sorted(xs), sorted(zs)
    cells = []
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            a0, a1 = xs[i], xs[i + 1]
            b0, b1 = zs[j], zs[j + 1]
            if a1 - a0 < 1e-3 or b1 - b0 < 1e-3:
                continue
            cx, cz = (a0 + a1) / 2, (b0 + b1) / 2
            if in_room(level['rooms'], cx, cz) and not in_hole(level, cx, cz):
                cells.append((a0, a1, b0, b1))
    return cells


def above_of(level, levels):
    """The level object immediately above `level` in the stack.

    plan.js LEVELS do not carry above/below links, so the neighbours are
    derived from the sequence. The GF slab is the cellar ceiling; an F2 slab is
    the GF ceiling; F3 the F2 ceiling; F4 the F3 ceiling. The top level puts a
    roof above it, not another slab.
    """
    idx = [l['id'] for l in levels].index(level['id'])
    return levels[idx + 1] if idx + 1 < len(levels) else None


def build_galleries(colls, level, log):
    """Floor the strips the plan leaves unassigned at the edge of the house.

    The room schedule does not tile the 46 x 22 m envelope: on F2 and F3 the
    front rooms stop at z = 10 and leave a metre of veranda, and there is a 6 m
    recess in the attic front where no room was ever scheduled. Left alone those
    strips are holes straight through the elevation — black rectangles with
    windows floating in them. They are floored here, and railed where they meet
    the outside, which turns each one into the recessed gallery an old house of
    this plan actually has. Nothing is added to any named room.
    """
    if level['id'] == 'B1':
        return
    coll = colls[W.LEVEL_COLLECTION[level['id']]]
    y = level['y']
    M = level['footprint']
    rooms = level['rooms']
    xs, zs = set(), set()
    xs.update((M['x0'], M['x1']))
    zs.update((M['z0'], M['z1']))
    for r in rooms:
        xs.update((r['x0'], r['x1']))
        zs.update((r['z0'], r['z1']))
    for h in level.get('holes', []) or []:
        if h.get('kind') == 'rect':
            xs.update((h['x0'], h['x1']))
            zs.update((h['z0'], h['z1']))
    xs, zs = sorted(xs), sorted(zs)
    floor = W.Bucket()
    rail = W.Bucket()
    posts = W.Bucket()
    added = 0
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            a0, a1, b0, b1 = xs[i], xs[i + 1], zs[j], zs[j + 1]
            if a1 - a0 < 0.2 or b1 - b0 < 0.2:
                continue
            cx, cz = (a0 + a1) / 2, (b0 + b1) / 2
            if in_room(rooms, cx, cz) or in_hole(level, cx, cz):
                continue
            # only the perimeter band; an unassigned pocket in the middle of
            # the plan is a service void, not a gallery
            near = min(cx - M['x0'], M['x1'] - cx, cz - M['z0'], M['z1'] - cz)
            if near > 3.2:
                continue
            floor.box(a0, a1, b0, b1, y - 0.10, y)
            added += 1
            # rail only on a side that is actually the outside face
            sides = []
            if abs(b0 - M['z0']) < 0.05:
                sides.append((a0, a1, M['z0'], True))
            if abs(b1 - M['z1']) < 0.05:
                sides.append((a0, a1, M['z1'], True))
            if abs(a0 - M['x0']) < 0.05:
                sides.append((b0, b1, M['x0'], False))
            if abs(a1 - M['x1']) < 0.05:
                sides.append((b0, b1, M['x1'], False))
            for along0, along1, fixed, horiz in sides:
                n = max(2, int((along1 - along0) / 0.55))
                for k in range(n + 1):
                    t = along0 + (along1 - along0) * k / n
                    if horiz:
                        posts.box(t - 0.035, t + 0.035, fixed - 0.035, fixed + 0.035, y, y + 0.95)
                    else:
                        posts.box(fixed - 0.035, fixed + 0.035, t - 0.035, t + 0.035, y, y + 0.95)
                if horiz:
                    rail.box(along0, along1, fixed - 0.05, fixed + 0.05, y + 0.95, y + 1.02)
                else:
                    rail.box(fixed - 0.05, fixed + 0.05, along0, along1, y + 0.95, y + 1.02)
    if added:
        W.make_mesh('%s_GalleryFloors' % level['id'], floor, W.MAT['wood_floor_old'], coll)
        W.make_mesh('%s_GalleryRails' % level['id'], rail, W.MAT['wood_dark'], coll)
        W.make_mesh('%s_GalleryPosts' % level['id'], posts, W.MAT['iron'], coll)
    log('%s galleries: %d perimeter cells floored' % (level['id'], added))


def build_slabs(colls, level, levels, log):
    """Floor and ceiling for one storey.

    The floor is that level's slab. The ceiling is the slab above it, rebuilt
    from the level above's strip plan so that the stair hole (and any other
    opening) is cut through every plate that sits above it: a stair that climbs
    from the foyer to F4 must not hit a GF ceiling, an F2 ceiling or an F3
    ceiling on the way up.

    Open walkways on the level above are kept clear of its ceiling plate: a
    corridor like the F3 south walkway is open to the roof, so the slab that
    sits above the level below it (the F2 ceiling plate) should not cover it.
    Those cells are removed from the above level's cells before the plate is
    built.
    """
    coll = colls[W.LEVEL_COLLECTION[level['id']]]
    y = level['y']
    h = level['h']
    fmat = W.MAT.get(FLOOR_MAT.get(level.get('floor'), 'wood_floor'), W.MAT['wood_floor'])
    ckey = level.get('ceiling')
    cmat = W.MAT.get(CEIL_MAT.get(ckey, 'plaster_warm')) if ckey else None

    floor = W.Bucket()
    floor_cells = slab_cells(level)
    for a0, a1, b0, b1 in floor_cells:
        floor.box(a0, a1, b0, b1, y - 0.30, y)
    W.make_mesh('%s_Floor' % level['id'], floor, fmat, coll)

    cell_count = len(floor_cells)
    if cmat:
        above = above_of(level, levels)
        cells = slab_cells(above) if above else floor_cells
        # strip open walkways off the above level's ceiling plate
        cells = [c for c in cells if not any(
            r['kind'] == 'corridor' and r['x0'] <= c[0] and c[1] <= r['x1']
            and r['z0'] <= c[2] and c[3] <= r['z1']
            for r in above['rooms'])]
        cell_count = len(cells)
        ceil = W.Bucket()
        for a0, a1, b0, b1 in cells:
            ceil.box(a0, a1, b0, b1, y + h, y + h + 0.22)
        W.make_mesh('%s_Ceiling' % level['id'], ceil, cmat, coll)
    log('%s floor %d cells, ceiling %d cells, %d rooms' % (
        level['id'], len(floor_cells), cell_count, len(level['rooms'])))


# --- walls, doors, windows -------------------------------------------------
def build_walls(colls, level, log):
    coll = colls[W.LEVEL_COLLECTION[level['id']]]
    y, h = level['y'], level['h']
    rooms = level['rooms']
    doors = level.get('doors', []) or []
    ext = W.Bucket()
    inte = W.Bucket()
    joinery = W.Bucket()
    glass = W.Bucket()
    stone_trim = W.Bucket()
    loggia_posts = W.Bucket()

    door_by = {}
    for d in doors:
        key = (d['axis'], round(float(d['c']), 3))
        door_by.setdefault(key, []).append(d)

    horiz, vert = edge_walls(level)
    ext_name = WALL_EXT[level['id']]
    int_name = WALL_INT[level['id']]
    built_doors = 0
    built_windows = 0

    def process(axis, c, spans):
        nonlocal built_doors, built_windows
        for a0, a1 in spans:
            if a1 - a0 < 0.25:
                continue
            mid = (a0 + a1) / 2
            p_in = (mid, c) if axis == 'x' else (c, mid)
            off = 0.55
            qa = (mid, c + off) if axis == 'x' else (c + off, mid)
            qb = (mid, c - off) if axis == 'x' else (c - off, mid)
            ia, ib = in_room(rooms, *qa), in_room(rooms, *qb)
            ha, hb = in_hole(level, *qa), in_hole(level, *qb)
            exterior = ia != ib and not (ha or hb)
            thickness = TE if exterior else TI
            bucket = ext if exterior else inte

            # The observation gallery is open to the sky, so its front must not
            # be a 3 m wall: it is a colonnade over the azotea. This is the one
            # opening that is not a plan.js door, and it is what stops the top
            # of a 46 m elevation reading as a white band.
            loggia = False
            if level['id'] == 'F4' and exterior and axis == 'x' and abs(c - 11.0) < 0.05:
                inner = qa if ia else qb
                for room in rooms:
                    if room['id'] == 'FF4-01' and room['x0'] - 0.1 <= inner[0] <= room['x1'] + 0.1 \
                            and room['z0'] - 0.1 <= inner[1] <= room['z1'] + 0.1:
                        loggia = True

            wall_doors = door_by.get((axis, round(c, 3)), [])
            openings = []
            door_spans = []
            if loggia:
                openings.append((a0 + 0.35, a1 - 0.35, y + 0.86, y + 2.72))
                n = max(2, int((a1 - a0) / 2.3))
                for k in range(n + 1):
                    t = a0 + (a1 - a0) * k / n
                    loggia_posts.box(t - 0.13, t + 0.13, c - 0.20, c + 0.20, y, y + 2.72)
            for d in wall_doors:
                if not (a0 - 0.01 <= d['at'] <= a1 + 0.01):
                    continue
                w = float(d['w'])
                oy1 = y + (2.95 if d.get('arch') or d.get('entrance') else 2.42)
                openings.append((d['at'] - w / 2, d['at'] + w / 2, y, oy1))
                door_spans.append((d['at'] - w / 2 - 0.55, d['at'] + w / 2 + 0.55))
                if not d.get('arch'):
                    add_door_leaf(joinery, axis, c, d, y, thickness, rooms)
                add_door_frame(joinery, axis, c, d, y, thickness)
                built_doors += 1
                DOORS_BUILT.append({'level': level['id'], 'axis': axis, 'c': c,
                                    'at': float(d['at']), 'w': w, 'y': y})

            # windows on a facade run, at 4.2 m centres, kept clear of openings.
            # A cellar wall is against earth, not sky: no windows down there.
            wins = []
            if exterior and level['id'] != 'B1' and not loggia:
                sill = WINDOWS['sill']
                head = min(WINDOWS['head'], h - 0.42)
                if head - sill > 0.7:
                    # A room's piece of facade deserves a window even when the
                    # piece is short. With 0.9 m margins and a 4.2 m centre a
                    # 3 m bedroom wall got nothing at all, which is how a 46 m
                    # elevation ended up with eight windows.
                    u0, u1 = a0 + 0.55, a1 - 0.55
                    if u1 - u0 >= 1.1:
                        n = max(1, int(round((u1 - u0) / 3.4)))
                        step = (u1 - u0) / n
                        for i in range(n):
                            at = u0 + step * (i + 0.5)
                            w = WINDOWS['width'] if step > 2.1 else 0.86
                            if any(at + w / 2 > s0 and at - w / 2 < s1 for s0, s1 in door_spans):
                                continue
                            if at - w / 2 < a0 + 0.28 or at + w / 2 > a1 - 0.28:
                                continue
                            wins.append((at, w, y + sill, y + head))
            for at, w, oy0, oy1 in wins:
                openings.append((at - w / 2, at + w / 2, oy0, oy1))
                add_window(joinery, glass, stone_trim, axis, c, at, w, oy0, oy1,
                           thickness, exterior, level)
                AUDIT['windows'] += 1
                built_windows += 1
                WINDOWS_BUILT.append({'level': level['id'], 'axis': axis, 'c': c,
                                      'at': at, 'w': w, 'y0': oy0, 'y1': oy1})

            W.wall_run(bucket, axis, c, a0, a1, thickness, y, y + h, openings)

            # a floor band on the outside of a facade, where the storey line is
            if exterior:
                if axis == 'x':
                    stone_trim.box(a0, a1, c - thickness / 2 - 0.06, c + thickness / 2 + 0.06,
                                   y + h - 0.16, y + h)
                else:
                    stone_trim.box(c - thickness / 2 - 0.06, c + thickness / 2 + 0.06, a0, a1,
                                   y + h - 0.16, y + h)

    # A wall run has to be judged in pieces. Classifying a 46 m facade from its
    # midpoint put every window inside the projecting bays, because at the
    # midpoint the bay happened to be behind the wall. Splitting at every room
    # edge, hole edge and door jamb gives each piece its own inside/outside.
    xb, zb = set(), set()
    for r in rooms:
        xb.update((r['x0'], r['x1']))
        zb.update((r['z0'], r['z1']))
    for hole in level.get('holes', []) or []:
        if hole.get('kind') == 'rect':
            xb.update((hole['x0'], hole['x1']))
            zb.update((hole['z0'], hole['z1']))
    for d in doors:
        w = float(d['w'])
        (xb if d['axis'] == 'x' else zb).update((d['at'] - w / 2, d['at'] + w / 2))

    for c, spans in sorted(horiz.items()):
        process('x', c, split_at(spans, xb))
    for c, spans in sorted(vert.items()):
        process('z', c, split_at(spans, zb))

    W.make_mesh('%s_Walls_Exterior' % level['id'], ext, W.MAT[ext_name], coll)
    W.make_mesh('%s_Walls_Interior' % level['id'], inte, W.MAT[int_name], coll)
    W.make_mesh('%s_Doors' % level['id'], joinery, W.MAT['wood_narra'], coll)
    W.make_mesh('%s_Windows' % level['id'], glass, W.MAT['capiz'], coll)
    W.make_mesh('%s_Bands' % level['id'], stone_trim, W.MAT['stone_dark'], coll)
    if len(loggia_posts):
        W.make_mesh('%s_LoggiaColumns' % level['id'], loggia_posts, W.MAT['lime'], coll)

    AUDIT['doors'] += built_doors
    AUDIT['levels'].append({'id': level['id'], 'doors': built_doors,
                            'windows': built_windows, 'rooms': len(rooms)})
    log('%s walls: %d doors, %d facade windows' % (level['id'], built_doors, AUDIT['windows']))

    for r in rooms:
        W.empty('ROOM_%s_%s' % (r['id'], r['name'].replace(' ', '_')), coll,
                (r['x0'] + r['x1']) / 2, (r['z0'] + r['z1']) / 2, y + 0.02,
                size=0.5, props={'room': r['id'], 'kind': r['kind'], 'level': level['id']})


def add_door_frame(bucket, axis, c, d, y, thickness):
    at, w = float(d['at']), float(d['w'])
    j = 0.07
    t = thickness + 0.03
    h = 2.95 if d.get('arch') or d.get('entrance') else 2.42
    for u in (at - w / 2 - j / 2, at + w / 2 + j / 2):
        if axis == 'x':
            bucket.box(u - j / 2, u + j / 2, c - t / 2, c + t / 2, y, y + h)
        else:
            bucket.box(c - t / 2, c + t / 2, u - j / 2, u + j / 2, y, y + h)
    if axis == 'x':
        bucket.box(at - w / 2 - j, at + w / 2 + j, c - t / 2, c + t / 2, y + h, y + h + 0.1)
    else:
        bucket.box(c - t / 2, c + t / 2, at - w / 2 - j, at + w / 2 + j, y + h, y + h + 0.1)


def add_door_leaf(bucket, axis, c, d, y, thickness, rooms):
    """One leaf, standing open at 30 degrees into the room it serves."""
    at, w = float(d['at']), float(d['w'])
    leaf = max(0.7, w - 0.06)
    hinge_left = int(abs(at) * 7) % 2 == 0
    hx = at - leaf / 2 if hinge_left else at + leaf / 2
    # which side of the wall is a room? open into it
    side = 1.0
    if axis == 'x':
        if not in_room(rooms, at, c + 0.7):
            side = -1.0
    else:
        if not in_room(rooms, c + 0.7, at):
            side = -1.0
    ang = math.radians(30) * side * (1 if hinge_left else -1)
    if axis == 'z':
        ang += math.pi / 2
    dx, dz = math.cos(ang), math.sin(ang)
    px, pz = -dz * 0.024, dx * 0.024
    h = 2.30
    pts = [(hx - px, c - pz), (hx + px, c + pz),
           (hx + dx * leaf + px, c + dz * leaf + pz),
           (hx + dx * leaf - px, c + dz * leaf - pz)]
    if axis == 'z':
        pts = [(c - pz, hx - px), (c + pz, hx + px),
               (c + dz * leaf + pz, hx + dx * leaf + px),
               (c + dz * leaf - pz, hx + dx * leaf - px)]
    vertical_panel(bucket, pts, y + 0.02, y + h)


def add_window(joinery, glass, trim, axis, c, at, w, y0, y1, thickness, exterior, level):
    half = thickness / 2
    j = 0.055

    def bx(u0, u1, y0_, y1_, c0, c1):
        if axis == 'x':
            joinery.box(u0, u1, c0, c1, y0_, y1_)
        else:
            joinery.box(c0, c1, u0, u1, y0_, y1_)

    # jambs, head, sill
    bx(at - w / 2 - j, at - w / 2, y0, y1, c - half - 0.02, c + half + 0.02)
    bx(at + w / 2, at + w / 2 + j, y0, y1, c - half - 0.02, c + half + 0.02)
    bx(at - w / 2, at + w / 2, y1, y1 + 0.07, c - half - 0.02, c + half + 0.02)
    bx(at - w / 2 - 0.04, at + w / 2 + 0.04, y0 - 0.06, y0, c - half - 0.07, c + half + 0.07)
    # two sliding sashes and the transom above them
    bx(at - 0.02, at + 0.02, y0, y1, c - 0.02, c + 0.02)
    tr = y0 + (y1 - y0) * 0.70
    bx(at - w / 2, at + w / 2, tr, tr + 0.035, c - 0.02, c + 0.02)
    # capiz: a pane, very slightly translucent, set in the wall's middle
    if axis == 'x':
        glass.box(at - w / 2, at + w / 2, c - 0.012, c + 0.012, y0 + 0.01, y1 - 0.01)
    else:
        glass.box(c - 0.012, c + 0.012, at - w / 2, at + w / 2, y0 + 0.01, y1 - 0.01)
    # a projecting architrave on the weather side: a window set flush in a
    # flat wall has no shadow line and reads as a painted rectangle
    if exterior:
        out0, out1 = c + half + 0.01, c + half + 0.09
        if axis == 'x':
            trim.box(at - w / 2 - 0.12, at - w / 2, out0, out1, y0 - 0.10, y1 + 0.10)
            trim.box(at + w / 2, at + w / 2 + 0.12, out0, out1, y0 - 0.10, y1 + 0.10)
            trim.box(at - w / 2 - 0.14, at + w / 2 + 0.14, out0, out1, y1, y1 + 0.14)
            trim.box(at - w / 2 - 0.16, at + w / 2 + 0.16, out0 - 0.02, out1 + 0.03, y0 - 0.16, y0 - 0.02)
        else:
            trim.box(out0, out1, at - w / 2 - 0.12, at - w / 2, y0 - 0.10, y1 + 0.10)
            trim.box(out0, out1, at + w / 2, at + w / 2 + 0.12, y0 - 0.10, y1 + 0.10)
            trim.box(out0, out1, at - w / 2 - 0.14, at + w / 2 + 0.14, y1, y1 + 0.14)
            trim.box(out0 - 0.02, out1 + 0.03, at - w / 2 - 0.16, at + w / 2 + 0.16, y0 - 0.16, y0 - 0.02)

    # ventanilla: the slatted panels under a Filipino window's sill
    if level['id'] in ('GF', 'F2', 'F3') and y0 - level['y'] > 0.55:
        bx(at - w / 2, at + w / 2, y0 - 0.42, y0 - 0.36, c - half - 0.03, c + half + 0.03)
        bx(at - w / 2, at + w / 2, y0 - 0.28, y0 - 0.22, c - half - 0.03, c + half + 0.03)
    if exterior:
        # persiana leaves folded flat against the wall either side
        for s in (-1, 1):
            u0 = at + s * (w / 2 + 0.02)
            u1 = at + s * (w / 2 + 0.56)
            lo, hi = min(u0, u1), max(u0, u1)
            outer = half + 0.045
            if axis == 'x':
                joinery.box(lo, hi, c + (outer if s > 0 else -outer - 0.03),
                            c + (outer + 0.03 if s > 0 else -outer), y0, y1)
                # The paired leaves are operable louvered shutters, not flat
                # boards. Shallow horizontal slats catch a highlight and cast
                # small shadows while staying within the original leaf width.
                face0, face1 = c + (outer if s > 0 else -outer - 0.03), c + (outer + 0.03 if s > 0 else -outer)
                for k in range(1, 6):
                    cy = y0 + (y1 - y0) * k / 6
                    joinery.box(lo, hi, face0 - 0.025, face1 + 0.025, cy - 0.045, cy + 0.045)
            else:
                joinery.box(c + (outer if s > 0 else -outer - 0.03),
                            c + (outer + 0.03 if s > 0 else -outer), lo, hi, y0, y1)
                face0, face1 = c + (outer if s > 0 else -outer - 0.03), c + (outer + 0.03 if s > 0 else -outer)
                for k in range(1, 6):
                    cy = y0 + (y1 - y0) * k / 6
                    joinery.box(face0 - 0.025, face1 + 0.025, lo, hi, cy - 0.045, cy + 0.045)


# --- stairs ----------------------------------------------------------------
def build_stairs(colls, plan):
    coll = colls['MANSION_STAIRS']
    S = plan['stair']
    ax0, ax1 = S['ax'], S['ax'] + S['aw']
    bx0, bx1 = S['bx'], S['bx'] + S['bw']
    zn, zs = S['zn'], S['zs']
    land = S['landZ']
    tread = W.Bucket()
    riser = W.Bucket()
    string = W.Bucket()
    rail = W.Bucket()
    iron = W.Bucket()
    runner = W.Bucket()
    T = 0.055

    def flight(x0, x1, zlow, zhigh, ylow, yhigh, n):
        d = 1 if zhigh > zlow else -1
        going = abs(zhigh - zlow) / n
        rise = (yhigh - ylow) / n
        for k in range(n):
            yt = ylow + (k + 1) * rise
            zna = zlow + d * k * going
            zfa = zlow + d * (k + 1) * going
            tread.box(x0, x1, min(zna, zfa) - 0.014, max(zna, zfa) + 0.014, yt - T, yt)
            # A narrow worn runner sits inset from the nosing. Each tread is a
            # separate pad so it follows the stair pitch and never floats over
            # the risers as a single sloping plane would.
            cx = (x0 + x1) * 0.5
            runner.box(cx - 0.29, cx + 0.29,
                       min(zna, zfa) + 0.055, max(zna, zfa) - 0.055,
                       yt + 0.002, yt + 0.012)
            # riser closes the step under its own nose, not the next one up
            hgt = rise - T
            if hgt > 0:
                rz = zna + d * 0.012
                riser.box(x0 + 0.003, x1 - 0.003, rz - 0.015, rz + 0.015, yt - T - hgt, yt - T)
        # closed strings, sloped from foot to head
        for x in (x0 + 0.04, x1 - 0.04):
            string.beam((x, zlow, ylow - 0.02 - 0.36), (x, zhigh, yhigh - 0.02 - 0.36),
                        0.075, 0.34)

    def balustrade(x, z0, z1, y0, y1, foot_newel=False, head_newel=False):
        n = max(2, int(abs(z1 - z0) / 0.135))
        for i in range(1, n):
            t = i / n
            z = z0 + (z1 - z0) * t
            y = y0 + (y1 - y0) * t
            iron.cylinder(x, z, y - 0.02, y + 0.92, 0.018, seg=6)
            # Turned collars break up the plain pickets and read as forged
            # balusters in the warm light without changing their clear width.
            iron.cylinder(x, z, y + 0.10, y + 0.15, 0.027, seg=8)
            iron.cylinder(x, z, y + 0.76, y + 0.81, 0.027, seg=8)
        rail.beam((x, z0, y0 + 0.95), (x, z1, y1 + 0.95), 0.055, 0.065)
        if foot_newel:
            iron.cylinder(x, z0, y0 - 0.02, y0 + 1.1, 0.065, seg=8)
            iron.cylinder(x, z0, y0 + 1.08, y0 + 1.14, 0.085, seg=10)
        if head_newel:
            iron.cylinder(x, z1, y1 - 0.02, y1 + 1.1, 0.065, seg=8)
            iron.cylinder(x, z1, y1 + 1.08, y1 + 1.14, 0.085, seg=10)

    base = 0.0
    for i, rise in enumerate(S['rise']):
        nA, nB = S['risers'][i]
        mid = base + rise * nA / (nA + nB)
        flight(ax0, ax1, zs, zn, base, mid, nA)
        balustrade(ax1 - 0.07, zs, zn, base, mid, head_newel=True)
        rail.beam((ax0 + 0.085, zs, base + 0.95), (ax0 + 0.085, zn, mid + 0.95), 0.05, 0.06)

        # half landing
        tread.box(ax0, bx1, land, zn, mid - 0.14, mid)
        if i == 0:
            for ox in (0.0, 1.0):
                xx = ax0 + (bx1 - ax0) * ox
                iron.cylinder(xx, land, mid - 0.6, mid, 0.06, seg=8)

        flight(bx0, bx1, zn, zs, mid, base + rise, nB)
        balustrade(bx1 - 0.07, zn, zs, mid, base + rise, foot_newel=True, head_newel=True)
        balustrade(bx0 + 0.07, zn, zs, mid, base + rise)
        balustrade(bx1 - 0.07, land, zn, mid, mid, foot_newel=True)

        if i == 0:
            # cupboard under the first flights, cut to the discrete treads
            segs = 7
            for lane, z0, z1, ylo, yhi, n in (
                    ((bx0, bx1), zn, zs, mid, base + rise, nB),
                    ((ax0, ax1), zs, zn, base, mid, nA)):
                for k in range(segs):
                    za = z0 + (z1 - z0) * k / segs
                    zb = z0 + (z1 - z0) * (k + 1) / segs
                    ta = (za - z0) / (z1 - z0)
                    tb = (zb - z0) / (z1 - z0)
                    ka = max(0, min(n - 1, int(ta * n)))
                    kb = max(0, min(n - 1, int(tb * n)))
                    h0 = ylo + (min(ka, kb) / n) * (yhi - ylo) - 0.12
                    if h0 < 1.55:
                        continue
                    string.box(lane[0], lane[1], min(za, zb), max(za, zb), 0, h0)
        base += rise

    W.make_mesh('STAIR_Treads', tread, W.MAT['wood_floor_old'], coll)
    W.make_mesh('STAIR_Risers', riser, W.MAT['wood_dark'], coll)
    W.make_mesh('STAIR_Strings', string, W.MAT['wood_dark'], coll)
    W.make_mesh('STAIR_Rails', rail, W.MAT['wood_dark'], coll)
    W.make_mesh('STAIR_Balusters', iron, W.MAT['iron'], coll)
    treads = bpy.data.objects.get('STAIR_Treads')
    if treads:
        bevel = treads.modifiers.new('Soft worn tread edges', 'BEVEL')
        bevel.width = 0.018
        bevel.segments = 2
        bevel.limit_method = 'ANGLE'
        bevel.angle_limit = math.radians(25)
        treads.modifiers.new('Tread corner normals', 'WEIGHTED_NORMAL')
    W.make_mesh('STAIR_Runners', runner, W.MAT['velvet'], coll)

    # landing balustrades round the open well on the two floors above
    for y in (plan['levels'][1]['y'], plan['levels'][2]['y'], plan['levels'][3]['y']):
        b = W.Bucket()
        rail_b = W.Bucket()
        for x in (S['ax'] - 0.06, S['bx'] + S['bw'] + 0.06):
            rail_b.beam((x, land, y + 0.95), (x, zs, y + 0.95), 0.05, 0.06)
            for k in range(10):
                z = land + (zs - land) * k / 9
                b.cylinder(x, z, y, y + 0.92, 0.018, seg=5)
                b.cylinder(x, z, y + 0.10, y + 0.15, 0.026, seg=8)
                b.cylinder(x, z, y + 0.76, y + 0.81, 0.026, seg=8)
        b.box(S['ax'], S['bx'] + S['bw'], land - 0.06, land, y, y + 0.96)
        W.make_mesh('STAIR_WellRail_%0.1f' % y, rail_b, W.MAT['wood_dark'], coll)
        W.make_mesh('STAIR_WellBalusters_%0.1f' % y, b, W.MAT['iron'], coll)

    # the basement flight: concrete, 17 steps, handrail on the open side
    bs = W.Bucket()
    br = W.Bucket()
    bx0, bx1 = -16.9, -14.5
    zTop, zBot = -6.05, -10.45
    yTop, yBot = 0.0, -3.4
    steps = 17
    going = (zTop - zBot) / steps
    rr = (yTop - yBot) / steps
    for i in range(steps):
        z = zTop - (i + 0.5) * going
        top = yTop - (i + 1) * rr
        bs.box(bx0, bx1, z - abs(going) / 2 - 0.02, z + abs(going) / 2, top - 0.07, top)
        bs.box(bx0, bx1, z + 0.02, z + 0.05, top - rr, top - 0.07)
    for x in (bx0 + 0.06, bx1 - 0.06):
        bs.beam((x, zTop, yTop - 0.3), (x, zBot, yBot - 0.3), 0.13, 0.3)
    for t in (0, 0.33, 0.66, 1):
        z = zTop + (zBot - zTop) * t
        y = yTop + (yBot - yTop) * t
        br.cylinder(bx1 - 0.09, z, y, y + 0.95, 0.025, seg=6)
    br.beam((bx1 - 0.09, zTop, yTop + 0.95), (bx1 - 0.09, zBot, yBot + 0.95), 0.05, 0.06)
    W.make_mesh('STAIR_Basement', bs, W.MAT['concrete'], coll)
    W.make_mesh('STAIR_BasementRail', br, W.MAT['iron'], coll)
    W.log('stairs: 6 grand flights + basement flight')


# --- roofs -----------------------------------------------------------------
def hip_roof(roof, iron, x0, z0, x1, z1, yE, rise, ov):
    ox0, ox1, oz0, oz1 = x0 - ov, x1 + ov, z0 - ov, z1 + ov
    w, d = ox1 - ox0, oz1 - oz0
    ry = yE + rise
    cz = (oz0 + oz1) / 2
    cx = (ox0 + ox1) / 2
    if w >= d:
        rx0, rx1, rz = ox0 + d / 2, ox1 - d / 2, cz
        roof.prism([(ox0, oz0, yE), (ox1, oz0, yE), (rx1, rz, ry), (rx0, rz, ry)], 0.1)
        roof.prism([(ox1, oz1, yE), (ox0, oz1, yE), (rx0, rz, ry), (rx1, rz, ry)], 0.1)
        roof.tri_prism([(ox1, oz0, yE), (ox1, oz1, yE), (rx1, rz, ry)], 0.1)
        roof.tri_prism([(ox0, oz1, yE), (ox0, oz0, yE), (rx0, rz, ry)], 0.1)
        iron.beam((rx0, rz, ry - 0.02), (rx1, rz, ry - 0.02), 0.26, 0.1)
    else:
        rz0, rz1, rx = oz0 + w / 2, oz1 - w / 2, cx
        roof.prism([(ox0, oz0, yE), (ox1, oz0, yE), (rx, rz0, ry), (rx, rz0, ry)], 0.1)
        roof.prism([(ox1, oz0, yE), (ox1, oz1, yE), (rx, rz1, ry), (rx, rz1, ry)], 0.1)
        roof.prism([(ox1, oz1, yE), (ox0, oz1, yE), (rx, rz1, ry), (rx, rz1, ry)], 0.1)
        roof.prism([(ox0, oz1, yE), (ox0, oz0, yE), (rx, rz0, ry), (rx, rz0, ry)], 0.1)
        iron.beam((rx, rz0, ry - 0.02), (rx, rz1, ry - 0.02), 0.26, 0.1)
    # fascia on every eave, so the roof has an edge from below
    iron.beam((ox0, oz0, yE - 0.10), (ox1, oz0, yE - 0.10), 0.09, 0.18)
    iron.beam((ox1, oz1, yE - 0.10), (ox0, oz1, yE - 0.10), 0.09, 0.18)
    iron.beam((ox0, oz0, yE - 0.10), (ox0, oz1, yE - 0.10), 0.09, 0.18)
    iron.beam((ox1, oz0, yE - 0.10), (ox1, oz1, yE - 0.10), 0.09, 0.18)


def gable_roof(roof, iron, wall, x0, z0, x1, z1, yE, rise, ov):
    ox0, ox1, oz0, oz1 = x0 - ov, x1 + ov, z0 - ov, z1 + ov
    w, d = ox1 - ox0, oz1 - oz0
    ry = yE + rise
    cz = (oz0 + oz1) / 2
    if w >= d:
        roof.prism([(ox0, oz0, yE), (ox1, oz0, yE), (ox1, cz, ry), (ox0, cz, ry)], 0.1)
        roof.prism([(ox1, oz1, yE), (ox0, oz1, yE), (ox0, cz, ry), (ox1, cz, ry)], 0.1)
        for xx in (ox0, ox1):
            wall.tri_prism([(xx, oz0, yE), (xx, oz1, yE), (xx, cz, ry)], 0.22, axis='x')
        iron.beam((ox0, cz, ry - 0.02), (ox1, cz, ry - 0.02), 0.26, 0.1)
    else:
        roof.prism([(ox0, oz0, yE), (ox0, oz1, yE), (cxr(x0, x1), oz1, ry), (cxr(x0, x1), oz0, ry)], 0.1)
        iron.beam((cxr(x0, x1), oz0, ry - 0.02), (cxr(x0, x1), oz1, ry - 0.02), 0.26, 0.1)


def cxr(x0, x1):
    return (x0 + x1) / 2


def cross_gable(roof, wall, iron, wallx, direction, cz, half_w, depth, rise, yE):
    """A gable whose ridge runs out of a flank and whose end faces the garden."""
    x_out = wallx + direction * depth
    z0, z1 = cz - half_w, cz + half_w
    ry = yE + rise
    # the two roof planes, north and south of the ridge, from the wall to the end
    for s in (-1, 1):
        roof.prism([(wallx, cz, ry), (x_out, cz, ry),
                    (x_out, cz + s * half_w, yE), (wallx, cz + s * half_w, yE)], 0.1)
    # gable end: a triangle standing at the projecting face, limewashed
    wall.tri_prism([(x_out, z0, yE), (x_out, z1, yE), (x_out, cz, ry)], 0.26, axis='x')
    # bargeboards along the rakes, and a louvred vent in the gable face, so the
    # end does not read as a blank triangle or acquire a black cap at its tip
    for s in (-1, 1):
        iron.beam((wallx, cz + s * half_w, yE - 0.12), (x_out, cz + s * half_w, yE - 0.12), 0.08, 0.22)
        iron.beam((x_out, cz + s * half_w, yE - 0.12), (x_out, cz + s * 0.02, ry), 0.08, 0.18)
    vx = x_out + direction * 0.15
    for k in range(4):
        y = ry - 1.5 + k * 0.24
        iron.box(vx - 0.02, vx + 0.02, cz - 0.62, cz + 0.62, y, y + 0.10)


def build_roofs(colls, plan):
    coll = colls['MANSION_ROOF']
    roof = W.Bucket()
    iron = W.Bucket()
    wall = W.Bucket()
    gutter = W.Bucket()
    # The soffit is what an eave looks like from the ground. Without a projecting
    # band under the sheets, four storeys of wall meet a grey plane with no line
    # between them and the roof reads as a lid laid on the house.
    soffit = W.Bucket()
    f4 = [l for l in plan['levels'] if l['id'] == 'F4'][0]
    # Even the observation gallery and observatory need a complete weather
    # skin. Their former omission left broad open holes in the roof plan.
    # The only intentionally walkable uncovered zone is the labeled azotea.
    open_ids = set()
    gables = {'FF4-06', 'FF4-04'}
    count = 0
    for r in f4['rooms']:
        if r['id'] in open_ids or r['id'] == 'FF4-10':
            continue
        w, d = r['x1'] - r['x0'], r['z1'] - r['z0']
        rise = min(3.2, min(w, d) * 0.40)
        tight = r['id'] in ('FF4-06', 'FF4-07')
        ov = 0.5 if tight else 1.15
        if r['id'] in gables:
            gable_roof(roof, iron, wall, r['x0'], r['z0'], r['x1'], r['z1'], EAVE, rise, ov)
        else:
            hip_roof(roof, iron, r['x0'], r['z0'], r['x1'], r['z1'], EAVE, rise, ov)
        count += 1
        ox0, ox1, oz0, oz1 = r['x0'] - ov, r['x1'] + ov, r['z0'] - ov, r['z1'] + ov
        soffit.box(ox0, ox1, oz0, oz0 + 0.14, EAVE - 0.30, EAVE)
        soffit.box(ox0, ox1, oz1 - 0.14, oz1, EAVE - 0.30, EAVE)
        soffit.box(ox0, ox0 + 0.14, oz0, oz1, EAVE - 0.30, EAVE)
        soffit.box(ox1 - 0.14, ox1, oz0, oz1, EAVE - 0.30, EAVE)
        # a gutter on the long eaves and a downpipe at both ends
        for x in (r['x0'] - ov, r['x1'] + ov):
            gutter.beam((x, r['z0'] - ov, EAVE - 0.06), (x, r['z1'] + ov, EAVE - 0.06), 0.14, 0.12)
        for z in (r['z0'] - ov, r['z1'] + ov):
            gutter.beam((r['x0'] - ov, z, EAVE - 0.06), (r['x1'] + ov, z, EAVE - 0.06), 0.14, 0.12)

    # the three cross-gables on the flanks
    cross_gable(roof, wall, iron, -22.0, -1, -5.4, 2.7, 2.15, 3.2, EAVE)
    cross_gable(roof, wall, iron, -22.0, -1, 6.0, 2.4, 2.0, 3.05, EAVE)
    cross_gable(roof, wall, iron, 14.0, 1, 7.0, 2.8, 2.25, 3.75, EAVE)

    # parapet round the azotea: a low solid curb, then a turned balustrade.
    # A 1.12 m solid wall round a 46 m front is a white band that hides every
    # pavilion behind it; the balustrade is what an azotea actually has.
    deck = W.Bucket()
    coping = W.Bucket()
    bal = W.Bucket()
    bal_rail = W.Bucket()
    M = plan['foot']
    ladder_x = -12.5
    gap = (ladder_x - 0.55, ladder_x + 0.55)
    LOW = 0.62

    def balustrade(fixed, a0, a1, horiz, skip=None):
        spans = W.subtract_spans(a0, a1, [skip]) if skip else [(a0, a1)]
        for s0, s1 in spans:
            n = max(2, int((s1 - s0) / 0.52))
            for k in range(n + 1):
                t = s0 + (s1 - s0) * k / n
                if skip and skip[0] - 0.02 <= t <= skip[1] + 0.02:
                    continue
                if horiz:
                    bal.box(t - 0.032, t + 0.032, fixed - 0.032, fixed + 0.032, PARA + 0.70, PARA + 1.16)
                else:
                    bal.box(fixed - 0.032, fixed + 0.032, t - 0.032, t + 0.032, PARA + 0.70, PARA + 1.16)
            if horiz:
                bal_rail.box(s0, s1, fixed - 0.06, fixed + 0.06, PARA + 1.16, PARA + 1.24)
            else:
                bal_rail.box(fixed - 0.06, fixed + 0.06, s0, s1, PARA + 1.16, PARA + 1.24)

    for x0, x1, z0, z1 in ((M['x0'], M['x1'], M['z0'], M['z0'] + 0.3),
                           (M['x0'], M['x1'], M['z1'] - 0.3, M['z1'])):
        if z0 < 0:      # the rear wall is the one at z = -11, not the +z front
            deck.box(M['x0'], gap[0], z0, z1, PARA, PARA + LOW)
            deck.box(gap[1], M['x1'], z0, z1, PARA, PARA + LOW)
            coping.box(M['x0'] - 0.03, gap[0], z0 - 0.04, z1 + 0.04, PARA + LOW, PARA + LOW + 0.08)
            coping.box(gap[1], M['x1'] + 0.03, z0 - 0.04, z1 + 0.04, PARA + LOW, PARA + LOW + 0.08)
            balustrade(z0 + 0.15, M['x0'], M['x1'], True, skip=gap)
        else:
            deck.box(M['x0'], M['x1'], z0, z1, PARA, PARA + LOW)
            coping.box(M['x0'] - 0.03, M['x1'] + 0.03, z0 - 0.04, z1 + 0.04, PARA + LOW, PARA + LOW + 0.08)
            balustrade(z1 - 0.15, M['x0'], M['x1'], True)
    for z0, z1, x0, x1 in ((M['z0'], M['z1'], M['x0'], M['x0'] + 0.3),
                           (M['z0'], M['z1'], M['x1'] - 0.3, M['x1'])):
        deck.box(x0, x1, z0, z1, PARA, PARA + LOW)
        coping.box(x0 - 0.04, x1 + 0.04, z0 - 0.03, z1 + 0.03, PARA + LOW, PARA + LOW + 0.08)
        balustrade(x0 + 0.15, M['z0'], M['z1'], False)

    # roof-deck service fittings: tank, vent, repair patches
    tank = W.Bucket()
    tx, tz = 17.5, -7.0
    for ox, oz in ((-0.55, -0.55), (0.55, -0.55), (0.55, 0.55), (-0.55, 0.55)):
        tank.beam((tx + ox, tz + oz, PARA), (tx + ox, tz + oz, PARA + 0.9), 0.1, 0.1)
    tank.cylinder(tx, tz, PARA + 0.9, PARA + 2.05, 0.78, seg=16)
    tank.cylinder(tx, tz, PARA + 2.05, PARA + 2.12, 0.82, seg=16)
    vent = W.Bucket()
    vent.cylinder(-18.0, -9.2, PARA, PARA + 1.35, 0.14, seg=10)
    vent.cylinder(-18.0, -9.2, PARA + 1.35, PARA + 1.5, 0.28, seg=10)

    # hatch cover, hinged open against the parapet
    hat = W.Bucket()
    vertical_panel(hat, [(ladder_x - 0.55, -10.55), (ladder_x + 0.55, -10.55),
                         (ladder_x + 0.55, -10.6), (ladder_x - 0.55, -10.6)],
                   PARA + 0.02, PARA + 1.14)

    W.make_mesh('ROOF_Pavilions', roof, W.MAT['roof_slate'], coll)
    W.make_mesh('ROOF_Ironwork', iron, W.MAT['iron'], coll)
    W.make_mesh('ROOF_GableEnds', wall, W.MAT['lime'], coll)
    W.make_mesh('ROOF_Gutters', gutter, W.MAT['roof_rust'], coll)
    W.make_mesh('ROOF_Eaves', soffit, W.MAT['wood_timber'], coll)
    W.make_mesh('DECK_Parapet', deck, W.MAT['stone'], coll)
    W.make_mesh('DECK_Coping', coping, W.MAT['stone_dark'], coll)
    W.make_mesh('DECK_Balusters', bal, W.MAT['wood_dark'], coll)
    W.make_mesh('DECK_BalustradeRail', bal_rail, W.MAT['wood_dark'], coll)
    W.make_mesh('DECK_WaterTank', tank, W.MAT['roof_rust'], coll)
    W.make_mesh('DECK_Vent', vent, W.MAT['iron'], coll)
    W.make_mesh('DECK_HatchCover', hat, W.MAT['roof_iron'], coll)
    W.log('roof: %d covered upper rooms + 3 cross-gables, walkable deck and service hatch' % count)


# --- ladder and access -----------------------------------------------------
def build_ladder(colls):
    coll = colls['GAMEPLAY_OBJECTS']
    steel = W.Bucket()
    brass = W.Bucket()
    lx, lz = -12.5, -11.0
    rail_x = (lx - 0.38, lx + 0.38)
    # 0.46 m off the plaster, so the ladder clears the 0.35 m plinth at its
    # foot. At 0.34 the bottom two rungs were inside the stone.
    stand = 0.46
    top = 12.92
    for rx in rail_x:
        steel.box(rx - 0.03, rx + 0.03, lz - stand - 0.04, lz - stand + 0.02, 0.08, top)
    rung = 0.25
    y = 0.28
    while y < top - 0.25:
        steel.box(rail_x[0], rail_x[1], lz - stand - 0.03, lz - stand + 0.01, y, y + 0.035)
        y += 0.30
    for by in (1.2, 3.0, 4.8, 6.6, 8.4, 10.2, 11.8):
        steel.box(rail_x[0] - 0.02, rail_x[0] + 0.02, lz - stand, lz - 0.02, by, by + 0.06)
        steel.box(rail_x[1] - 0.02, rail_x[1] + 0.02, lz - stand, lz - 0.02, by, by + 0.06)
    # The landing is outside the parapet (z < -11), not inside the deck. It was
    # drawn on the house side of the wall, where it filled the hatch opening and
    # there was nothing to step onto from the ladder.
    land = W.Bucket()
    land.box(lx - 0.62, lx + 0.62, -11.75, -11.0, PARA - 0.08, PARA)
    land.box(lx - 0.62, lx + 0.62, -11.75, -11.69, PARA, PARA + 1.0)
    land.box(lx - 0.62, lx - 0.57, -11.75, -11.0, PARA, PARA + 1.0)
    land.box(lx + 0.57, lx + 0.62, -11.75, -11.0, PARA, PARA + 1.0)
    brass.cylinder(lx + 0.3, -10.6, PARA + 0.05, PARA + 0.09, 0.06, seg=8)

    W.make_mesh('LADDER_Service', steel, W.MAT['iron'], coll)
    W.make_mesh('LADDER_Landing', land, W.MAT['iron'], coll)
    W.empty('LADDER_ClimbPoint', coll, lx, lz - stand - 0.55, 0.0, size=0.4,
            props={'interaction': 'Climb Ladder', 'topY': PARA, 'axis': 'ladder'})
    W.log('ladder at x %.1f, rear wall, 0.0 -> %.1f' % (lx, PARA))


# --- exterior: plinth, portico, steps, balcony, downpipes ------------------
def build_exterior(colls, plan):
    coll = colls['MANSION_EXTERIOR']
    M = plan['foot']
    plinth = W.Bucket()
    band = W.Bucket()
    portico = W.Bucket()
    roof_b = W.Bucket()
    iron = W.Bucket()
    stone = W.Bucket()

    # battered stone plinth: the house stands on something
    for x0, x1, z0, z1 in ((M['x0'] - 0.35, M['x1'] + 0.35, M['z0'] - 0.35, M['z0']),
                           (M['x0'] - 0.35, M['x1'] + 0.35, M['z1'], M['z1'] + 0.35),
                           (M['x0'] - 0.35, M['x0'], M['z0'], M['z1']),
                           (M['x1'], M['x1'] + 0.35, M['z0'], M['z1'])):
        plinth.box(x0, x1, z0, z1, -0.25, 0.55)
        band.box(x0 - 0.06, x1 + 0.06, z0 - 0.06, z1 + 0.06, 0.55, 0.72)

    # portico: four turned posts under a hipped canopy, over the entrance
    for px in (-4.2, -1.4, 1.4, 4.2):
        stone.box(px - 0.24, px + 0.24, 13.16, 13.64, 0.0, 0.42)
        portico.cylinder(px, 13.4, 0.42, 3.36, 0.14, seg=10)
        iron.box(px - 0.2, px + 0.2, 13.2, 13.6, 3.3, 3.42)
    portico.box(-5.2, 5.2, 13.05, 13.75, 3.3, 3.46)
    # canopy roof (shallow hip) and its ridge
    hip_roof(roof_b, iron, -5.35, 11.0, 5.35, 15.4, 3.46, 1.05, 0.35)

    # entrance steps from the gravel to the porch
    for k in range(4):
        stone.box(-3.2 - k * 0.12, 3.2 + k * 0.12, 15.55 + k * 0.34, 15.9 + k * 0.34,
                  0.0, 0.18 * (4 - k))
    # the balcony over the entrance, off the second-floor door
    balc = W.Bucket()
    balc.box(-4.9, -1.6, 11.0, 13.15, 4.05, 4.2)
    for px in (-4.85, -1.65):
        iron.box(px - 0.04, px + 0.04, 13.05, 13.13, 4.2, 5.1)
    iron.box(-4.9, -1.6, 13.05, 13.13, 5.05, 5.13)

    # downpipes at the corners and the middle of each long elevation
    pipes = W.Bucket()
    for x, z in ((M['x0'] - 0.24, M['z0'] - 0.24), (M['x0'] - 0.24, M['z1'] + 0.24),
                 (M['x1'] + 0.24, M['z0'] - 0.24), (M['x1'] + 0.24, M['z1'] + 0.24),
                 (-12.0, M['z0'] - 0.24), (10.0, M['z1'] + 0.24)):
        pipes.cylinder(x, z, 0.0, EAVE, 0.055, seg=8)

    # A raised parapet over the entrance: the one piece of silhouette this
    # elevation lacked. It is exterior only — it stands on the azotea parapet
    # and changes no room, wall or walkable surface.
    ped = W.Bucket()
    ped.box(-5.6, 5.6, 10.72, 11.02, PARA + 1.12, PARA + 1.55)
    ped.box(-4.4, 4.4, 10.74, 11.02, PARA + 1.55, PARA + 1.95)
    ped.box(-3.1, 3.1, 10.76, 11.02, PARA + 1.95, PARA + 2.30)
    ped.box(-5.72, 5.72, 10.66, 11.06, PARA + 1.48, PARA + 1.62)
    ped.box(-4.52, 4.52, 10.68, 11.06, PARA + 1.88, PARA + 2.0)
    ped.box(-3.22, 3.22, 10.70, 11.06, PARA + 2.23, PARA + 2.36)
    ped.box(-0.55, 0.55, 10.70, 11.10, PARA + 1.7, PARA + 2.05)

    W.make_mesh('EXT_Plinth', plinth, W.MAT['stone'], coll)
    W.make_mesh('EXT_CentralPediment', ped, W.MAT['lime'], coll)
    W.make_mesh('EXT_PlinthBand', band, W.MAT['stone_dark'], coll)
    W.make_mesh('EXT_PorticoPosts', portico, W.MAT['wood_timber'], coll)
    W.make_mesh('EXT_PorticoRoof', roof_b, W.MAT['roof_iron'], coll)
    W.make_mesh('EXT_PorticoIron', iron, W.MAT['iron'], coll)
    W.make_mesh('EXT_Steps', stone, W.MAT['stone'], coll)
    W.make_mesh('EXT_Balcony', balc, W.MAT['stone'], coll)
    W.make_mesh('EXT_Downpipes', pipes, W.MAT['roof_rust'], coll)
    W.log('exterior: plinth, portico, steps, balcony, downpipes')


# --- entry -----------------------------------------------------------------
def build(colls, plan):
    for level in plan['levels']:
        build_galleries(colls, level, W.log)
        build_slabs(colls, level, plan['levels'], W.log)
        build_walls(colls, level, W.log)
        AUDIT['rooms'] += len(level['rooms'])
    build_stairs(colls, plan)
    build_roofs(colls, plan)
    build_ladder(colls)
    build_exterior(colls, plan)
    W.log('mansion: %d rooms across %d levels, %d doors, %d windows'
          % (AUDIT['rooms'], len(plan['levels']), AUDIT['doors'], AUDIT['windows']))

    # audit beside the file, so the validator and a human can both read it
    import json
    import os
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))),
        'reports', 'world', 'mansion_build.json')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(AUDIT, f, indent=1)
    W.log('audit -> %s' % out)
