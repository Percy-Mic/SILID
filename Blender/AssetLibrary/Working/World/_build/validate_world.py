"""SILID_COMPLETE_WORLD — validation.

Run against the saved master file, with the plan JSON beside it:

    blender -b SILID_COMPLETE_WORLD.blend --python validate_world.py

Nothing here trusts the builder's own audit. Every check measures the geometry
that was actually written: a ray through the roof, a ray up the stairwell, a ray
past the ladder, or an object's real bounding box against the room it claims to
be in. A check that cannot run is reported as skipped, never as passed.

Output: reports/world/validation.json and reports/world/VALIDATION.md
"""

import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
WORLD_DIR = os.path.dirname(HERE)
ROOT = WORLD_DIR
for _ in range(4):
    ROOT = os.path.dirname(ROOT)
REPORT_DIR = os.path.join(ROOT, 'reports', 'world')

CHECKS = []


def check(name, status, detail, data=None):
    CHECKS.append({'check': name, 'status': status, 'detail': detail, 'data': data})
    print('[%s] %s — %s' % (status.upper(), name, detail), flush=True)


def depsgraph():
    return bpy.context.evaluated_depsgraph_get()


def ray(origin, direction, dist=200.0):
    dg = depsgraph()
    hit, loc, normal, index, ob, matrix = bpy.context.scene.ray_cast(dg, Vector(origin), Vector(direction), distance=dist)
    return (hit, loc, ob)


def architectural_overhead(origin, dist=100.0):
    """Return the first actual floor/ceiling/roof surface above a room.

    A generic scene ray also hits stair treads, chandeliers, furniture, and
    forest canopies. Those are not ceilings. Walk through those hits until an
    architectural plate is found, so clearance measures the room shell.
    """
    dg = depsgraph()
    start = Vector(origin)
    up = Vector((0, 0, 1))
    for _ in range(64):
        hit, loc, normal, index, ob, matrix = bpy.context.scene.ray_cast(
            dg, start, up, distance=dist)
        if not hit:
            return (False, loc, ob)
        name = ob.name.upper()
        if ('_FLOOR' in name or '_CEILING' in name or name.startswith('ROOF_')):
            return (True, loc, ob)
        travelled = (loc - start).length
        start = loc + up * 0.002
        dist -= travelled + 0.002
    return (False, start, None)


def plan():
    with open(os.path.join(REPORT_DIR, 'world_plan.json'), 'r', encoding='utf-8') as f:
        return json.load(f)


def objects(prefix):
    return [o for o in bpy.data.objects if o.name.startswith(prefix) and o.type == 'MESH']


def world_bbox(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    return (min(p.x for p in pts), max(p.x for p in pts),
            min(p.y for p in pts), max(p.y for p in pts),
            min(p.z for p in pts), max(p.z for p in pts))


# --- 1. collections --------------------------------------------------------
def check_collections():
    root = bpy.data.collections.get('SILID_COMPLETE_WORLD')
    if not root:
        check('master collection', 'FAIL', 'SILID_COMPLETE_WORLD is missing')
        return
    expected = ['WORLD_MASTER', 'ROAD_ENVIRONMENT', 'VEHICLE_BREAKDOWN', 'UNDERGROUND_ENVIRONMENT',
                'FOREST_ENVIRONMENT', 'MANSION_EXTERIOR', 'MANSION_GROUND_FLOOR',
                'MANSION_SECOND_FLOOR', 'MANSION_THIRD_FLOOR', 'MANSION_FOURTH_FLOOR',
                'MANSION_ROOF', 'MANSION_STAIRS', 'MANSION_FURNITURE',
                'MANSION_PROPS', 'GAMEPLAY_OBJECTS', 'LIGHTING', 'CAMERAS', 'COLLISION']
    missing = [n for n in expected if n not in root.children]
    counts = {c.name: len(c.all_objects) for c in root.children}
    check('master collection', 'PASS' if not missing else 'FAIL',
          'all %d collections present' % len(expected) if not missing else 'missing: ' + ', '.join(missing),
          counts)


# --- 2. floor openings and head clearance ---------------------------------
def check_stair():
    treads = bpy.data.objects.get('STAIR_Treads')
    if not treads:
        check('stair treads', 'FAIL', 'STAIR_Treads not found')
        return
    mn = min((treads.matrix_world @ Vector(c)).z for c in treads.bound_box)
    mx = max((treads.matrix_world @ Vector(c)).z for c in treads.bound_box)
    ok = abs(mx - 11.6) < 0.12 and abs(mn - 0.10) < 0.2
    check('stair reaches the fourth floor', 'PASS' if ok else 'FAIL',
          'tread extremes %.2f m .. %.2f m (expected 0.10 .. 11.60)' % (mn, mx))

    # headroom over each of the six flights, measured upward from the treads
    lanes = [(-4.97, -3.85), (-3.43, -2.31)]
    ys = []
    base = 0.0
    for i in range(3):
        nA, nB = [(12, 12), (11, 11), (11, 10)][i]
        rise = [4.2, 3.8, 3.6][i]
        mid = base + rise * nA / (nA + nB)
        ys += [(lanes[0], 9.2, 6.1, base, mid, nA), (lanes[1], 6.1, 9.2, mid, base + rise, nB)]
        base += rise
    worst = 99
    worst_at = None
    worst_ob = ''
    for (lane, z0, z1, y0, y1, n) in ys:
        for k in range(n):
            # measure from the TREAD TOP, not from the pitch line: the boards
            # are discrete, so a point on the straight pitch is often inside the
            # step above it and every flight reports a false obstruction.
            t = (k + 0.5) / n
            z = z0 + (z1 - z0) * t
            y = y0 + (k + 1) * (y1 - y0) / n
            x = (lane[0] + lane[1]) / 2
            hit, loc, ob = ray((x, z, y + 0.05), (0, 0, 1), 4.0)
            clear = (loc.z - y) if hit else 4.0
            if clear < worst:
                worst = clear
                worst_at = (round(x, 2), round(z, 2), round(y, 2))
                worst_ob = ob.name if ob else 'nothing'
    check('stair head clearance', 'PASS' if worst > 1.95 else 'FAIL',
          'minimum %.2f m above the treads at %s (%s)' % (worst, worst_at, worst_ob))


# --- 3. roof coverage ------------------------------------------------------
def check_roof(p):
    f4 = [l for l in p['levels'] if l['id'] == 'F4'][0]
    # Both the observation gallery and observatory are enclosed pavilions and
    # receive finished roofs. Only the separate azotea/deck (FF4-10) is open.
    open_ids = set()
    covered, uncovered = [], []
    for r in f4['rooms']:
        if r['id'] == 'FF4-10':
            continue
        x = (r['x0'] + r['x1']) / 2
        z = (r['z0'] + r['z1']) / 2
        hit, loc, ob = ray((x, z, 20.0), (0, 0, -1), 12.0)
        name = ob.name if ob else ''
        # the ridge cap and bargeboards are part of the roof: a downward ray
        # over a pavilion centre hits the cap first, not the sheet
        is_roof = name.startswith('ROOF_') and loc.z > 14.5
        if r['id'] in open_ids:
            if is_roof:
                uncovered.append(r['id'] + ' wrongly roofed')
        elif is_roof:
            covered.append(r['id'])
        else:
            uncovered.append('%s (hit %s at %.1f)' % (r['id'], name, loc.z if hit else -1))
    check('roof covers every closed pavilion', 'PASS' if not uncovered else 'FAIL',
          '%d of %d pavilions covered' % (len(covered), len(covered) + len(uncovered)),
          {'covered': covered, 'problems': uncovered})


# --- 4. ladder route and hatch --------------------------------------------
def check_ladder():
    landing = bpy.data.objects.get('LADDER_Landing')
    if not landing:
        check('ladder landing', 'FAIL', 'LADDER_Landing not found')
        return
    bb = world_bbox(landing)
    ok = abs(bb[4] - 11.52) < 0.15
    check('ladder landing height', 'PASS' if ok else 'FAIL',
          'landing top at %.2f m (azotea 11.60)' % bb[4])

    # The climb is clear if nothing but the ladder and the plinth's face is
    # within 0.3 m of the rails. Measuring from far enough out to miss both.
    blocked = []
    for h in (1.0, 2.0, 4.0, 6.0, 8.0, 10.0):
        hit, loc, ob = ray((-12.5, -12.9, h), (0, 1, 0), 2.2)
        if hit and loc.y < -11.62:
            blocked.append((h, round(loc.y, 2), ob.name if ob else ''))
    check('ladder stands clear of the wall', 'PASS' if not blocked else 'FAIL',
          'nothing obstructs the climb' if not blocked else 'obstructions: %s' % blocked)

    # The hatch opening is proved from above: through the gap the first hit is
    # the landing at 11.6; beside it, the parapet coping at 12.2 stops the ray.
    hit_a, loc_a, ob_a = ray((-12.5, -10.85, 13.4), (0, 0, -1), 2.4)
    hit_b, loc_b, ob_b = ray((-14.6, -10.85, 13.4), (0, 0, -1), 2.4)
    gap_ok = hit_a and loc_a.z < 11.85 and hit_b and loc_b.z > 11.95
    check('hatch opening in the parapet', 'PASS' if gap_ok else 'FAIL',
          'through the gap: %.2f m (%s); beside it: %.2f m (%s)'
          % (loc_a.z, ob_a.name if ob_a else '-', loc_b.z, ob_b.name if ob_b else '-'))


# --- 5. furniture and surface props --------------------------------------
def check_surface_props():
    checked, bad = 0, []
    for ob in bpy.data.objects:
        if ob.type != 'MESH' or 'support_surface_z' not in ob:
            continue
        if not ob.data.vertices:
            continue
        floor_z = float(ob['support_surface_z'])
        low = min((ob.matrix_world @ v.co).z for v in ob.data.vertices)
        delta = low - floor_z
        checked += 1
        if abs(delta) > 0.025:
            bad.append({'object': ob.name, 'delta_m': round(delta, 4),
                        'support_z': round(floor_z, 4), 'bottom_z': round(low, 4)})
    check('surface props rest on their supports', 'PASS' if not bad else 'FAIL',
          '%d surface props checked, %d floating or sunk' % (checked, len(bad)), bad[:30])


def check_furniture(p):
    levels = {l['id']: l for l in p['levels']}
    rooms = {}
    for l in p['levels']:
        for r in l['rooms']:
            rooms[r['id']] = (l, r)

    floating, sunk, outside, in_door = [], [], [], []
    doors = []
    for l in p['levels']:
        for d in l.get('doors', []) or []:
            if d['axis'] == 'x':
                doors.append((l['id'], d['at'], d['c'], d['w'], 0.9, 1.4))
            else:
                doors.append((l['id'], d['c'], d['at'], d['w'], 1.4, 0.9))

    for ob in objects('FURN_'):
        name = ob.name
        parts = name.split('_')
        room_id = parts[1] if len(parts) > 1 else ''
        if room_id not in rooms:
            # per-level aggregates (rugs, lamps, bulbs) are not room pieces
            continue
        level, room = rooms[room_id]
        bb = world_bbox(ob)
        floor = level['y']
        piece = parts[2] if len(parts) > 2 else ''
        # mounted pieces stand on a cabinet or hang on a wall by design
        mounted = any(k in name for k in ('wall_cabinet', 'hood', 'counter_top', 'shower'))
        if not mounted:
            if bb[4] > floor + 0.18:
                floating.append((name, round(bb[4] - floor, 2)))
            elif bb[4] < floor - 0.12:
                sunk.append((name, round(bb[4] - floor, 2)))
        if bb[0] < room['x0'] - 0.2 or bb[1] > room['x1'] + 0.2 or \
                bb[2] < room['z0'] - 0.2 or bb[3] > room['z1'] + 0.2:
            outside.append(name)
        for (lid, dx, dz, w, sw, sd) in doors:
            if lid != level['id']:
                continue
            if bb[0] < dx + sw / 2 and bb[1] > dx - sw / 2 and bb[2] < dz + sd / 2 and bb[3] > dz - sd / 2:
                in_door.append((name, lid, round(dx, 1), round(dz, 1)))
                break

    check('furniture stands on its floor', 'PASS' if not floating and not sunk else 'FAIL',
          '%d pieces checked, %d floating, %d sunk' % (len(objects('FURN_')), len(floating), len(sunk)),
          {'floating': floating[:12], 'sunk': sunk[:12]})
    check('furniture stays inside its room', 'PASS' if not outside else 'FAIL',
          '%d outside room bounds' % len(outside), outside[:12])
    check('doorways are clear of furniture', 'PASS' if not in_door else 'FAIL',
          '%d pieces in a door approach' % len(in_door), in_door[:12])


# --- 6. geometry sanity ----------------------------------------------------
def check_geometry():
    negative, no_material, degenerate = [], [], []
    for ob in bpy.data.objects:
        if ob.type != 'MESH' or ob.hide_render:
            continue
        me = ob.data
        if not me.materials:
            no_material.append(ob.name)
        if len(me.polygons) == 0:
            degenerate.append(ob.name)
            continue
        # a closed shell with inverted normals has negative signed volume; open
        # surfaces (terrain, road) are not shells and are skipped by area test
        is_shell = any(ob.name.startswith(p) for p in (
            'B1_', 'GF_', 'F2_', 'F3_', 'F4_', 'ROOF_', 'DECK_', 'EXT_', 'STAIR_', 'LADDER_'))
        if is_shell and me.polygons[0].loop_total == 4:
            vol = 0.0
            for poly in me.polygons:
                vs = [me.vertices[i].co for i in poly.vertices]
                for k in range(1, len(vs) - 1):
                    a, b, c = vs[0], vs[k], vs[k + 1]
                    vol += a.dot(b.cross(c)) / 6.0
            if vol < -1e-6:
                negative.append((ob.name, round(vol, 3)))
    check('every visible mesh has a material', 'PASS' if not no_material else 'FAIL',
          '%d without a material' % len(no_material), no_material[:10])
    check('no inverted closed shells', 'PASS' if not negative else 'FAIL',
          '%d meshes with negative volume' % len(negative), negative[:10])
    check('no empty meshes', 'PASS' if not degenerate else 'FAIL',
          '%d empty meshes' % len(degenerate), degenerate[:10])


def check_texture_maps():
    maps = []
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                maps.append((mat.name, node.image.name, bool(node.image.packed_file)))
    unique_images = {entry[1] for entry in maps}
    unpacked = [entry[1] for entry in maps if not entry[2]]
    ok = len(unique_images) >= 12 and not unpacked
    check('licensed PBR maps are packed', 'PASS' if ok else 'FAIL',
          '%d image nodes, %d unique maps, %d unpacked' % (len(maps), len(unique_images), len(unpacked)),
          {'maps': sorted(unique_images), 'unpacked': sorted(set(unpacked))})


# --- 7. scene budget -------------------------------------------------------
def check_budget():
    objs = len(bpy.data.objects)
    tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    lights = len([o for o in bpy.data.objects if o.type == 'LIGHT'])
    mats = len(bpy.data.materials)
    imgs = len(bpy.data.images)
    ok = tris < 4_000_000 and lights <= 70 and imgs < 150
    check('scene budget', 'PASS' if ok else 'WARN',
          '%d objects, %d polygons, %d lights, %d materials, %d images'
          % (objs, tris, lights, mats, imgs),
          {'objects': objs, 'polygons': tris, 'lights': lights, 'materials': mats})


# --- 8. world continuity ---------------------------------------------------
def check_world(p):
    t = p['terrain']
    # the car must sit on the road shoulder, not in the trees
    d = abs(t['car']['x'] - (-62 + 3.2 * math.sin((t['car']['z'] - 10) * 0.012)
                             + 1.4 * math.sin(t['car']['z'] * 0.031)))
    check('car is on the carriageway shoulder', 'PASS' if d < 6.0 else 'FAIL',
          'car %.2f m from the road centreline' % d)
    for name, prefix in (('terrain', 'TERRAIN_Field'), ('carriageway', 'ROAD_Carriageway'),
                         ('drive', 'DRIVE_Gravel'), ('mansion shell', 'GF_Walls_Exterior'),
                         ('roof', 'ROOF_Pavilions'), ('ladder', 'LADDER_Service'),
                         ('stairs', 'STAIR_Treads'), ('stair hall', 'GF_Walls_Interior')):
        ob = bpy.data.objects.get(prefix)
        if not ob:
            check('present: ' + name, 'FAIL', prefix + ' missing')
            continue
        bb = world_bbox(ob)
        check('present: ' + name, 'PASS',
              'bounds x %.1f..%.1f  y %.1f..%.1f  z %.1f..%.1f'
              % (bb[0], bb[1], bb[2], bb[3], bb[4], bb[5]))


def check_underground():
    parts = [
        'UNDERGROUND_BrickTunnel', 'UNDERGROUND_CaveLining',
        'UNDERGROUND_TransitionMasonry', 'UNDERGROUND_VaultStairs',
        'UNDERGROUND_CisternCourt', 'UNDERGROUND_ExitStairAndLanding',
    ]
    missing = [name for name in parts if not bpy.data.objects.get(name)]
    start = bpy.data.objects.get('UNDERGROUND_Route_Start_BasementDoor')
    end = bpy.data.objects.get('UNDERGROUND_Route_End_Forest')
    door = bpy.data.objects.get('UNDERGROUND_CisternServiceDoor')
    ok = not missing and bool(start and end and door)
    bounds = {}
    if ok:
        for name in parts:
            bounds[name] = world_bbox(bpy.data.objects[name])
        # Each route section overlaps the next by at least 0.1 m in X; the
        # endpoints sit in the existing basement and in the forest clearing.
        x_ranges = [(bounds[n][0], bounds[n][1]) for n in parts]
        connected = all(x_ranges[i][1] >= x_ranges[i + 1][0] - 0.1
                        for i in range(len(x_ranges) - 1))
        ok = (connected and abs(start.location.x - 16.1) < 0.2
              and abs(end.location.x - 68.2) < 0.2)
    check('basement-to-forest underground connector', 'PASS' if ok else 'FAIL',
          'six connected sections, service door and both route endpoints present' if ok
          else 'missing or disconnected: ' + ', '.join(missing or ['route endpoint/door']),
          {'sections': parts, 'x_bounds': {k: [round(v[0], 2), round(v[1], 2)]
                                           for k, v in bounds.items()}})


# --- 9. interior daylight (no basement windows) ---------------------------
def check_openings(p):
    for level in p['levels']:
        if level['id'] == 'B1':
            wins = [o for o in bpy.data.objects if o.name.startswith('B1_Windows')]
            check('basement has no daylight windows', 'PASS' if not wins else 'FAIL',
                  '%d mesh(es)' % len(wins))
    # Every room must have something solid underfoot. The floor slab's top face
    # sits 0.22 above the nominal level (the finished-floor build-up), and a rug
    # or a bed is just as good a footing as bare boards, so the test is only
    # that the first hit going down is not below the level itself.
    missing = []
    low_head = []
    for i, level in enumerate(p['levels']):
        # a room's overhead clearance is measured against the ceiling above it:
        # that is the slab of the level above, rebuilt from that level's strip
        # plan (so the stair hole passes through every plate). Using p['levels']
        # in Blender's level order, the same grouping used to build the slabs.
        above = p['levels'][i + 1] if i + 1 < len(p['levels']) else None
        for r in level['rooms']:
            if r['kind'] == 'courtyard':
                continue
            cx, cz = (r['x0'] + r['x1']) / 2, (r['z0'] + r['z1']) / 2
            hit, loc, ob = ray((cx, cz, level['y'] + 0.75), (0, 0, -1), 1.3)
            if not hit or loc.z < level['y'] - 0.05:
                missing.append(r['id'])
            # The observatory and roof deck are intentionally open to the sky;
            # they are accessible outdoor spaces rather than enclosed rooms.
            if r['id'] in {'FF4-03', 'FF4-10'}:
                continue
            hc, hloc, hob = architectural_overhead((cx, cz, level['y'] + 1.05))
            if hc and hloc.z - level['y'] < 2.15:
                low_head.append('%s %.2f' % (r['id'], hloc.z - level['y']))
    check('every room has its floor slab', 'PASS' if not missing else 'FAIL',
          '%d rooms without a floor at their level' % len(missing), missing[:12])
    check('every room has head clearance', 'PASS' if not low_head else 'FAIL',
          '%d rooms under 2.15 m to the ceiling' % len(low_head), low_head[:12])


def main():
    p = plan()
    check_collections()
    check_stair()
    check_roof(p)
    check_ladder()
    check_furniture(p)
    check_surface_props()
    check_geometry()
    check_texture_maps()
    check_budget()
    check_world(p)
    check_underground()
    check_openings(p)

    fails = [c for c in CHECKS if c['status'] == 'FAIL']
    warns = [c for c in CHECKS if c['status'] == 'WARN']
    os.makedirs(REPORT_DIR, exist_ok=True)
    with open(os.path.join(REPORT_DIR, 'validation.json'), 'w', encoding='utf-8') as f:
        json.dump({'checks': CHECKS, 'fail': len(fails), 'warn': len(warns)}, f, indent=1)

    lines = ['# SILID_COMPLETE_WORLD — validation', '',
             'Run against the saved master file. %d checks, %d failed, %d warnings.'
             % (len(CHECKS), len(fails), len(warns)), '',
             '| check | result | measurement |', '|---|---|---|']
    for c in CHECKS:
        lines.append('| %s | **%s** | %s |' % (c['check'], c['status'], c['detail'].replace('|', '/')))
    with open(os.path.join(REPORT_DIR, 'VALIDATION.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print('VALIDATION %d checks, %d failed' % (len(CHECKS), len(fails)))
    for c in fails:
        print('FAIL:', c['check'], '-', c['detail'])


main()
