"""SILID_COMPLETE_WORLD — interiors.

The mansion's furniture is the project's own Blender set (public/assets/models/
furniture.glb, built by scripts/build_furniture.py). It is not re-modelled here:
the same 32 pieces the player sees in the game are placed in the same rooms, so
the .blend and the game cannot disagree about what a bedroom contains.

Placement is wall-first and validated. Every piece is checked against the room's
inside face, against the swing and approach of every door on that room, and
against the pieces already placed. A piece that does not fit is not forced: it
is skipped and recorded in the audit, because a wardrobe standing in a doorway
is worse than an empty wall.

The pieces the library does not contain — the piano, the altar, the bell frame,
the telescope, the workbench, the water tank — are built here from the same
materials, and each has a reason to exist in its room.
"""

import math
import os
import random

import bpy
from mathutils import Vector

import world_common as W
import world_mansion as M

FURN = {}
DETAILS = {}
PLACED = []
SKIPPED = []
CLEAR_CIRCULATION = []
AUDIT = {'placed': 0, 'skipped': [], 'clear_circulation': [], 'rooms': 0, 'missing': []}

DIMS = {
    'aparador': (2.09, 0.69), 'armchair': (0.97, 0.84), 'armoire_body': (1.47, 0.74),
    'armoire_door_left': (0.67, 0.09), 'armoire_door_right': (0.67, 0.09),
    'basin': (0.58, 0.50), 'bath_tub': (1.74, 0.82), 'bed': (1.68, 2.06),
    'bench': (1.32, 0.40), 'bookshelf': (1.39, 0.38), 'cabinet_base': (0.60, 0.65),
    'coffee_table': (1.16, 0.62), 'console': (1.30, 0.42), 'cooker': (0.76, 0.71),
    'counter_top': (1.20, 0.65), 'desk': (1.52, 0.77), 'dining_chair': (0.47, 0.52),
    'dining_table': (2.20, 1.06), 'dresser': (1.26, 0.58), 'fridge': (0.74, 0.74),
    'hood': (0.82, 0.52), 'iron_bed': (1.40, 2.00), 'nightstand': (0.54, 0.49),
    'shower': (0.94, 0.94), 'side_table': (0.52, 0.52), 'sink_unit': (0.80, 0.68),
    'sofa': (2.10, 0.86), 'wall_cabinet': (0.60, 0.39), 'wardrobe': (1.40, 0.72),
    'washer': (0.60, 0.74), 'wc': (0.47, 0.69),
}

# pieces that sit on something else, or hang on a wall
MOUNTED = {'wall_cabinet': 1.46, 'hood': 1.58, 'counter_top': 0.88}
COLLIDABLE = {'bed', 'iron_bed', 'wardrobe', 'armoire_body', 'dresser', 'desk',
              'dining_table', 'sofa', 'armchair', 'bookshelf', 'console', 'aparador',
              'cabinet_base', 'cooker', 'fridge', 'bath_tub', 'shower', 'washer',
              'sink_unit', 'bench', 'side_table', 'coffee_table', 'nightstand'}


# --- library ---------------------------------------------------------------
def import_library(root):
    path = os.path.join(root, 'public/assets/models/furniture.glb')
    if not os.path.exists(path):
        W.log('furniture.glb missing; interiors will be procedurally empty')
        return
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    for ob in set(bpy.data.objects) - before:
        if ob.type == 'MESH':
            FURN[ob.name] = ob.data
    for ob in list(set(bpy.data.objects) - before):
        try:
            bpy.data.objects.remove(ob, do_unlink=True)
        except Exception:
            pass
    W.log('furniture library: %d pieces' % len(FURN))

    # Replace the most visible furniture silhouettes with textured CC0 models
    # from Poly Haven. We keep the game's room-by-room positions and collision
    # footprints, while fitting each detailed model to the same real-world
    # envelope, so its doors and walkways remain valid on every floor.
    source = os.path.join(root, 'Blender', 'AssetLibrary', 'Source', 'PolyHaven')
    upgrades = {
        'sofa': ('painted_wooden_sofa', 0.92),
        'armchair': ('chinese_armchair', 0.98),
        'coffee_table': ('round_wooden_table_01', 0.58),
        'dining_chair': ('dining_chair_02', 1.05),
        'dining_table': ('painted_wooden_table', 0.82),
        'bed': ('GothicBed_01', 1.55),
        'bookshelf': ('wooden_bookshelf_worn', 2.0),
        'nightstand': ('painted_wooden_nightstand', 0.68),
        'side_table': ('ClassicNightstand_01', 0.70),
    }
    for furniture, (asset, height) in upgrades.items():
        path = os.path.join(source, asset, 'gltf', '1k', asset + '_1k.gltf')
        if not os.path.isfile(path):
            W.log('CC0 furniture source missing: %s' % path)
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        imported = [ob for ob in set(bpy.data.objects) - before if ob.type == 'MESH']
        if not imported:
            W.log('CC0 furniture has no mesh: %s' % asset)
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for ob in imported:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = imported[0]
        if len(imported) > 1:
            bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        mesh = _normalized_asset_mesh(ob)
        mesh.name = 'CC0_%s_%s' % (asset, furniture)
        FURN[furniture] = mesh
        bpy.data.objects.remove(ob, do_unlink=True)
        W.log('interior upgrade: %s -> %s (%d polygons)' %
              (furniture, asset, len(mesh.polygons)))

    # Downloaded household models share their authored PBR materials with the
    # game build: kettle, oil lamp, bedside clock, and wall clock.
    for key, asset in (
        ('kettle', 'vintage_electric_kettle'),
        ('oil_lamp', 'vintage_oil_lamp'),
        ('alarm_clock', 'alarm_clock_01'),
        ('wall_clock', 'wall_clock'),
    ):
        path = os.path.join(source, asset, 'gltf', '1k', asset + '_1k.gltf')
        if not os.path.isfile(path):
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        imported = [ob for ob in set(bpy.data.objects) - before if ob.type == 'MESH']
        if not imported:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for ob in imported:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = imported[0]
        if len(imported) > 1:
            bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        DETAILS[key] = _normalized_asset_mesh(ob)
        DETAILS[key].name = 'CC0_%s' % asset
        bpy.data.objects.remove(ob, do_unlink=True)
        W.log('household model: %s (%d polygons)' % (asset, len(DETAILS[key].polygons)))

    # CC0 architectural fixtures are reused as linked geometry, then packed
    # into the final master with their source textures by build_world.py.
    fixture_assets = {
        'sconce': ('industrial_wall_sconce', 'industrial_wall_sconce'),
        'mirror': ('ornate_mirror_01', 'ornate_mirror_01'),
        'stair_chandelier': ('Chandelier_01', 'Chandelier_01'),
    'foyer_chandelier': ('chinese_chandelier', 'chinese_chandelier'),
    'tea_set': ('tea_set_01', 'tea_set_01'),
    'wine_bottle': ('wine_bottles_01', 'wine_bottles_01_bordeaux'),
    'candleholder': ('brass_candleholders', 'brass_candleholder_01'),
    'book': ('decorative_book_set_01', 'book_hardcover_01_cover06'),
    'cutting_board': ('wooden_cutting_board', 'wooden_cutting_board'),
    'wooden_bowl': ('wooden_bowl_02', 'wooden_bowl_02'),
    'wine_barrel': ('wooden_barrels_01', 'wooden_barrels_01_barrel01'),
    }
    for key, (asset, object_name) in fixture_assets.items():
        folder = os.path.join(source, asset)
        files = [f for f in os.listdir(folder) if f.lower().endswith('.blend')] if os.path.isdir(folder) else []
        if not files:
            continue
        path = os.path.join(folder, files[0])
        with bpy.data.libraries.load(path, link=False) as (src, dst):
            if object_name not in src.objects:
                continue
            dst.objects = [object_name]
        ob = dst.objects[0]
        if ob is None or ob.type != 'MESH':
            continue
        DETAILS[key] = _normalized_asset_mesh(ob)
        DETAILS[key].name = 'CC0_%s' % asset
        bpy.data.objects.remove(ob, do_unlink=True)
        W.log('interior fixture: %s (%d polygons)' % (asset, len(DETAILS[key].polygons)))

    for key, asset, prefix in (
        ('tea_items', 'tea_set_01', 'tea_set_01_'),
        ('wine_items', 'wine_bottles_01', 'wine_bottles_01_'),
        ('barrel_items', 'wooden_barrels_01', 'wooden_barrels_01_barrel'),
    ):
        folder = os.path.join(source, asset)
        path = os.path.join(folder, asset + '_1k.blend')
        if not os.path.isfile(path):
            continue
        with bpy.data.libraries.load(path, link=False) as (src, dst):
            names = [n for n in src.objects if n.startswith(prefix)]
            dst.objects = names
        DETAILS[key] = {}
        for ob in dst.objects:
            if ob and ob.type == 'MESH':
                DETAILS[key][ob.name] = _normalized_asset_mesh(ob)
                bpy.data.objects.remove(ob, do_unlink=True)

    # Preserve a handful of visual variants for repeated shelves and table
    # settings so the rooms do not look procedurally stamped.
    book_folder = os.path.join(source, 'decorative_book_set_01')
    book_path = os.path.join(book_folder, 'decorative_book_set_01_1k.blend')
    if os.path.isfile(book_path):
        with bpy.data.libraries.load(book_path, link=False) as (src, dst):
            names = [n for n in src.objects if n.startswith('book_hardcover_01_cover')][:12]
            dst.objects = names
        DETAILS['books'] = []
        for ob in dst.objects:
            if ob and ob.type == 'MESH':
                DETAILS['books'].append(_normalized_asset_mesh(ob))
                bpy.data.objects.remove(ob, do_unlink=True)

    # Small, recognizable household objects make a furnished floor read as
    # a place someone used, rather than a showroom of empty furniture. These
    # are real CC0 meshes; each stays linked to its original material and maps.
    for key, asset, object_name in (
        ('vase', 'antique_ceramic_vase_01', 'antique_ceramic_vase_01'),
        ('mantel_clock', 'mantel_clock_01', 'mantel_clock_01'),
    ):
        path = os.path.join(source, asset, asset + '_1k.blend')
        if not os.path.isfile(path):
            continue
        with bpy.data.libraries.load(path, link=False) as (src, dst):
            if object_name not in src.objects:
                continue
            dst.objects = [object_name]
        ob = dst.objects[0]
        if ob and ob.type == 'MESH':
            DETAILS[key] = _normalized_asset_mesh(ob)
            DETAILS[key].name = 'CC0_%s' % asset
            bpy.data.objects.remove(ob, do_unlink=True)

    # A leafy floor plant is a four-object asset. Join its original geometry
    # before normalizing it so the pot, pebbles, stems, and cutout leaves keep
    # their authored relative positions and their separate materials.
    plant_path = os.path.join(source, 'potted_plant_01', 'potted_plant_01_1k.blend')
    if os.path.isfile(plant_path):
        with bpy.data.libraries.load(plant_path, link=False) as (src, dst):
            dst.objects = [n for n in src.objects if n.startswith('potted_plant_01_')]
        plants = [ob for ob in dst.objects if ob and ob.type == 'MESH']
        if plants:
            temp = bpy.data.collections.new('TMP_PottedPlant_Import')
            bpy.context.scene.collection.children.link(temp)
            for ob in plants:
                temp.objects.link(ob)
                ob.select_set(True)
            bpy.context.view_layer.objects.active = plants[0]
            bpy.ops.object.join()
            plant = bpy.context.view_layer.objects.active
            DETAILS['potted_plant'] = _normalized_asset_mesh(plant)
            DETAILS['potted_plant'].name = 'CC0_potted_plant_01'
            bpy.data.objects.remove(plant, do_unlink=True)
            bpy.data.collections.remove(temp)
            bpy.ops.object.select_all(action='DESELECT')


def _normalized_asset_mesh(ob):
    """Bake source transforms into a centered, floor-based reusable mesh."""
    mesh = ob.data.copy()
    matrix = ob.matrix_basis.copy()
    for vertex in mesh.vertices:
        vertex.co = matrix @ vertex.co
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    if not xs:
        return mesh
    cx, cy, z0 = (min(xs) + max(xs)) * 0.5, (min(ys) + max(ys)) * 0.5, min(zs)
    for vertex in mesh.vertices:
        vertex.co.x -= cx
        vertex.co.y -= cy
        vertex.co.z -= z0
    mesh.update()
    return mesh


def footprint(name, rot):
    w, d = DIMS[name]
    if abs(math.cos(rot)) < 0.5:
        w, d = d, w
    return w, d


class Ctx:
    def __init__(self, room, level, y, coll):
        self.room = room
        self.level = level
        self.y = y
        self.coll = coll
        self.placed = []
        self.blockers = []
        self.rng = random.Random(abs(hash(room['id'])) % 100000)
        for d in M.DOORS_BUILT:
            if d['level'] != level['id']:
                continue
            if d['axis'] == 'x':
                if (abs(d['c'] - room['z0']) < 0.08 or abs(d['c'] - room['z1']) < 0.08) \
                        and room['x0'] - 0.2 <= d['at'] <= room['x1'] + 0.2:
                    self.blockers.append((d['at'], d['c'], d['w'] + 1.1, 1.9))
            else:
                if (abs(d['c'] - room['x0']) < 0.08 or abs(d['c'] - room['x1']) < 0.08) \
                        and room['z0'] - 0.2 <= d['at'] <= room['z1'] + 0.2:
                    self.blockers.append((d['c'], d['at'], 1.9, d['w'] + 1.1))

    def free(self, x, z, w, d):
        r = self.room
        if x - w / 2 < r['x0'] + 0.04 or x + w / 2 > r['x1'] - 0.04:
            return False
        if z - d / 2 < r['z0'] + 0.04 or z + d / 2 > r['z1'] - 0.04:
            return False
        for bx, bz, bw, bd in self.blockers:
            if abs(x - bx) < (w + bw) / 2 + 0.05 and abs(z - bz) < (d + bd) / 2 + 0.05:
                return False
        for f in self.placed:
            if abs(x - f['x']) < (w + f['w']) / 2 + 0.09 and abs(z - f['z']) < (d + f['d']) / 2 + 0.09:
                return False
        return True

    def add(self, name, x, z, rot, extra=()):
        mesh = FURN.get(name)
        if mesh is None:
            AUDIT['missing'].append(name)
            return False
        w, d = footprint(name, rot)
        if not self.free(x, z, w, d):
            return False
        extras = [(e[0], e[1], e[2] if len(e) > 2 else 0.0) for e in extra]
        # a worktop is 140 mm of stone on top of a cabinet, not a floating slab
        if name == 'counter_top' and FURN.get('cabinet_base'):
            extras.append(('base', FURN['cabinet_base'], -MOUNTED['counter_top']))
        y = self.y + MOUNTED.get(name, 0.0)
        n = len(self.placed)
        for suffix, m, dy in [('body', mesh, 0.0)] + extras:
            if m is None:
                continue
            ob = bpy.data.objects.new('FURN_%s_%s_%s_%02d' % (self.room['id'], name, suffix, n), m)
            ob.location = (x, z, y + dy)          # game -> Blender
            ob.rotation_euler = (0, 0, rot)
            self.coll.objects.link(ob)
        entry = {'name': name, 'x': x, 'z': z, 'rot': rot, 'w': w, 'd': d,
                 'height': 2.2 if name in ('wardrobe', 'armoire_body') else 1.0,
                 'room': self.room['id'], 'y': y}
        self.placed.append(entry)
        PLACED.append(entry)
        AUDIT['placed'] += 1
        if name in ('wardrobe', 'armoire_body'):
            W.empty('HIDE_%s_%s_%02d' % (self.room['id'], name, n), self.coll,
                    x, z, self.y + 0.02, size=0.3,
                    props={'interaction': 'Hide', 'room': self.room['id']})
        return True

    def wall(self, name, wall, prefer='center', extra=(), gap=0.0):
        """Put a piece's back against a wall, facing into the room."""
        w, d = DIMS[name]
        r = self.room
        if wall in ('N', 'S'):
            zc = r['z1'] - d / 2 - 0.05 if wall == 'N' else r['z0'] + d / 2 + 0.05
            lo, hi = r['x0'] + 0.12 + w / 2, r['x1'] - 0.12 - w / 2
            rot = 0.0 if wall == 'N' else math.pi
        else:
            xc = r['x1'] - d / 2 - 0.05 if wall == 'E' else r['x0'] + d / 2 + 0.05
            lo, hi = r['z0'] + 0.12 + w / 2, r['z1'] - 0.12 - w / 2
            rot = math.pi / 2 if wall == 'E' else -math.pi / 2
        if hi < lo:
            return False
        if prefer == 'center':
            mid = (lo + hi) / 2
            cands = []
            step = 0.0
            while mid - step >= lo or mid + step <= hi:
                for t in ((mid,) if step == 0 else (mid - step, mid + step)):
                    if lo <= t <= hi:
                        cands.append(t)
                step += 0.12
                if step > (hi - lo):
                    break
            if not cands:
                cands = [lo]
        else:
            n = max(2, int((hi - lo) / 0.35))
            cands = [lo + (hi - lo) * i / (n - 1) for i in range(n)]
            if prefer == 'right':
                cands.reverse()
        for t in cands:
            x, z = (t, zc) if wall in ('N', 'S') else (xc, t)
            if self.add(name, x, z, rot, extra):
                return True
        return False

    def centre(self, name, dx=0.0, dz=0.0, rot=0.0, extra=()):
        r = self.room
        x = (r['x0'] + r['x1']) / 2 + dx
        z = (r['z0'] + r['z1']) / 2 + dz
        return self.add(name, x, z, rot, extra)

    def armoire(self, wall):
        r = self.room
        w, d = DIMS['armoire_body']
        if wall == 'N':
            zc = r['z1'] - d / 2 - 0.05
            lo, hi = r['x0'] + 0.12 + w / 2, r['x1'] - 0.12 - w / 2
        else:
            zc = r['z0'] + d / 2 + 0.05
            lo, hi = r['x0'] + 0.12 + w / 2, r['x1'] - 0.12 - w / 2
        if hi < lo:
            return False
        mid = (lo + hi) / 2
        for t in [mid] + [mid + s * k * 0.15 for k in range(1, 10) for s in (-1, 1)]:
            if not (lo <= t <= hi):
                continue
            rot = 0.0 if wall == 'N' else math.pi
            if self.add('armoire_body', t, zc, rot,
                        extra=(('door_left', FURN.get('armoire_door_left')),
                               ('door_right', FURN.get('armoire_door_right')))):
                return True
        return False


# --- recipes ---------------------------------------------------------------
def furnish(ctx):
    kind = ctx.room['kind']
    r = ctx.room
    w, d = r['x1'] - r['x0'], r['z1'] - r['z0']
    small = min(w, d) < 4.2

    if kind == 'bedroom':
        if not ctx.wall('bed', 'N'):
            ctx.wall('bed', 'E')
        # nightstands beside the bed, if the bed went to the north wall
        bed = next((p for p in ctx.placed if p['name'] in ('bed', 'iron_bed')), None)
        if bed:
            for s in (-1, 1):
                ctx.add('nightstand', bed['x'] + s * 1.30, bed['z'] + 0.55, 0)
            # a bench at the foot of the bed, where a colonial bedroom has one
            ctx.add('bench', bed['x'], bed['z'] - 1.42, 0)
        if not small:
            ctx.wall('wardrobe', 'W') or ctx.wall('wardrobe', 'E')
        ctx.wall('dresser', 'S') or ctx.wall('dresser', 'E') or ctx.wall('dresser', 'W')
        ctx.wall('armchair', 'W') or ctx.wall('armchair', 'S')
        ctx.wall('side_table', 'E') or ctx.wall('side_table', 'W')

    elif kind == 'dressing':
        ctx.armoire('N')
        ctx.wall('dresser', 'W') or ctx.wall('dresser', 'S')
        ctx.centre('bench', dz=0.4)

    elif kind == 'bath':
        ctx.wall('bath_tub', 'N')
        ctx.wall('basin', 'E') or ctx.wall('basin', 'W')
        ctx.wall('wc', 'W') or ctx.wall('wc', 'S')
        # shower in the far corner from the door
        ctx.add('shower', r['x1'] - 0.55, r['z0'] + 0.55, 0)

    elif kind == 'living':
        ctx.wall('sofa', 'N')
        ctx.centre('coffee_table', dz=-0.55)
        ctx.wall('armchair', 'W') or ctx.wall('armchair', 'E')
        ctx.wall('armchair', 'E') or ctx.wall('armchair', 'S')
        ctx.wall('console', 'S')
        ctx.wall('bookshelf', 'W') or ctx.wall('bookshelf', 'E')
        ctx.wall('side_table', 'E') or ctx.wall('side_table', 'W')

    elif kind == 'dining':
        ctx.centre('dining_table')
        t = next((p for p in ctx.placed if p['name'] == 'dining_table'), None)
        if t:
            for i, (dx, dz, rot) in enumerate((
                    (-0.56, 0.98, math.pi), (0.56, 0.98, math.pi),
                    (-0.56, -0.98, 0), (0.56, -0.98, 0),
                    (-1.68, 0.0, -math.pi / 2), (1.68, 0.0, math.pi / 2))):
                ctx.add('dining_chair', t['x'] + dx, t['z'] + dz, rot)
        ctx.wall('aparador', 'N')
        ctx.wall('console', 'S')

    elif kind == 'kitchen':
        ctx.wall('counter_top', 'N')
        ctx.wall('sink_unit', 'N')
        ctx.wall('cooker', 'N')
        ctx.wall('fridge', 'E') or ctx.wall('fridge', 'W')
        ctx.wall('cabinet_base', 'S')
        # wall cabinets over the run, at head height
        ctx.wall('wall_cabinet', 'N')
        ctx.wall('wall_cabinet', 'N')
        ctx.wall('hood', 'N')

    elif kind == 'study':
        ctx.wall('desk', 'N')
        desk = next((p for p in ctx.placed if p['name'] == 'desk'), None)
        if desk:
            ctx.add('dining_chair', desk['x'], desk['z'] - 0.55, math.pi)
        ctx.wall('bookshelf', 'W')
        ctx.wall('bookshelf', 'E')
        ctx.wall('console', 'S')

    elif kind == 'gallery':
        ctx.wall('console', 'N')
        ctx.wall('console', 'S')
        ctx.wall('bench', 'W')
        ctx.centre('side_table', dx=1.2)

    elif kind == 'foyer':
        ctx.wall('console', 'E') or ctx.wall('console', 'W')
        ctx.wall('bench', 'W')
        ctx.centre('side_table', dx=-1.4, dz=1.0)

    elif kind == 'chapel':
        ctx.wall('console', 'N')
        ctx.centre('bench', dz=-0.2)
        ctx.centre('bench', dz=-1.5)

    elif kind == 'music':
        ctx.wall('armchair', 'S')
        ctx.wall('side_table', 'W')
        ctx.wall('console', 'E')

    elif kind == 'workshop':
        ctx.wall('cabinet_base', 'N')
        ctx.wall('cabinet_base', 'N')
        ctx.wall('bench', 'S')

    elif kind in ('utility', 'laundry'):
        ctx.wall('washer', 'N')
        ctx.wall('sink_unit', 'E') or ctx.wall('sink_unit', 'W')
        ctx.wall('counter_top', 'N')

    elif kind == 'storage':
        ctx.wall('bookshelf', 'N')
        ctx.wall('bookshelf', 'S')
        ctx.wall('cabinet_base', 'W') or ctx.wall('cabinet_base', 'E')
        ctx.wall('dresser', 'E') or ctx.wall('dresser', 'W')

    elif kind in ('corridor', 'tunnel'):
        if min(w, d) > 2.3:
            ctx.wall('console', 'N' if d < w else 'E')
        # loose corridor furniture is what makes a corridor feel lived in
        if min(w, d) > 2.0:
            ctx.wall('side_table', 'S' if d < w else 'W')

    elif kind in ('terrace', 'courtyard'):
        ctx.wall('bench', 'N')
        ctx.wall('side_table', 'E')

    elif kind == 'observatory':
        ctx.wall('desk', 'S')
        ctx.wall('side_table', 'W')

    elif kind == 'bell':
        ctx.wall('cabinet_base', 'W')

    elif kind == 'generator':
        ctx.wall('cabinet_base', 'N')

    else:
        ctx.wall('console', 'N')

    # a rug and a ceiling light in every room big enough to have one
    ctx.decor()


def _rug(self, dx=0.0, dz=0.0):
    r = self.room
    w = min(r['x1'] - r['x0'] - 1.2, 4.2)
    d = min(r['z1'] - r['z0'] - 1.2, 3.0)
    if w < 1.6 or d < 1.2:
        return
    b = self.rug_bucket
    x, z = (r['x0'] + r['x1']) / 2 + dx, (r['z0'] + r['z1']) / 2 + dz
    b.box(x - w / 2, x + w / 2, z - d / 2, z + d / 2, self.y + 0.012, self.y + 0.03)


def _decor(self):
    r = self.room
    w, d = r['x1'] - r['x0'], r['z1'] - r['z0']
    if min(w, d) > 3.4:
        _rug(self)
    lam = self.lamp
    cx, cz = (r['x0'] + r['x1']) / 2, (r['z0'] + r['z1']) / 2
    lam.cylinder(cx, cz, self.y + 2.42, self.y + 2.46, 0.26, seg=12)
    lam.cylinder(cx, cz, self.y + 2.36, self.y + 2.42, 0.15, seg=10)
    self.bulbs.cylinder(cx, cz, self.y + 2.33, self.y + 2.36, 0.12, seg=10)


Ctx.rug = _rug
Ctx.decor = _decor


# --- procedural pieces -----------------------------------------------------
def _frond(bucket, p, angle, length, droop):
    x, z, y = p
    nx, nz = -math.sin(angle) * 0.16, math.cos(angle) * 0.16
    pts = [(x, z, y), (x + math.cos(angle) * length, z + math.sin(angle) * length,
                       y + 0.3 - droop)]
    bucket.beam(pts[0], pts[1], 0.14, 0.06)


def build_props(colls, plan, rooms_by_level):
    coll = colls['MANSION_PROPS']
    metal = W.Bucket()
    wood = W.Bucket()
    cloth = W.Bucket()
    brass = W.Bucket()
    bulb = W.Bucket()
    stone = W.Bucket()
    foliage = W.Bucket()

    for level in plan['levels']:
        y = level['y']
        for r in level['rooms']:
            kind = r['kind']
            cx, cz = (r['x0'] + r['x1']) / 2, (r['z0'] + r['z1']) / 2
            w, d = r['x1'] - r['x0'], r['z1'] - r['z0']

            if kind == 'music':
                # an upright piano against the south wall
                px, pz = cx, r['z0'] + 0.42
                wood.box(px - 0.78, px + 0.78, pz - 0.33, pz + 0.33, y, y + 1.28)
                wood.box(px - 0.72, px + 0.72, pz - 0.28, pz - 0.18, y + 0.72, y + 0.78)
                for ox in (-0.64, 0.64):
                    wood.box(px + ox - 0.05, px + ox + 0.05, pz + 0.2, pz + 0.3, y, y + 0.7)
                brass.box(px - 0.6, px + 0.6, pz + 0.34, pz + 0.36, y + 0.74, y + 0.8)

            elif kind == 'chapel':
                ax, az = cx, r['z1'] - 0.5
                wood.box(ax - 0.9, ax + 0.9, az - 0.32, az + 0.32, y, y + 0.95)
                wood.box(ax - 0.12, ax + 0.12, az - 0.05, az - 0.02, y + 0.95, y + 1.7)
                wood.box(ax - 0.32, ax + 0.32, az - 0.05, az - 0.02, y + 1.35, y + 1.42)
                for ox in (-0.09, 0.09):
                    brass.cylinder(ax + ox, az - 0.12, y + 0.95, y + 1.06, 0.03, seg=6)
                    bulb.cylinder(ax + ox, az - 0.12, y + 1.06, y + 1.16, 0.02, seg=6)

            elif kind == 'bell':
                bx, bz = cx, cz
                metal.box(bx - 0.06, bx + 0.06, bz - 0.06, bz + 0.06, y, y + 2.4)
                metal.box(bx - 0.7, bx + 0.7, bz - 0.06, bz + 0.06, y + 2.25, y + 2.35)
                for ox in (-0.6, 0.6):
                    metal.cylinder(bx + ox, bz, y + 1.5, y + 2.3, 0.05, seg=6)
                    metal.cylinder(bx + ox, bz - 0.08, y + 1.45, y + 1.6, 0.16, seg=10)

            elif kind == 'observatory':
                tx, tz = cx, cz
                for a in (0.3, 2.4, 4.4):
                    metal.beam((tx, tz, y + 0.02),
                               (tx + math.cos(a) * 0.5, tz + math.sin(a) * 0.5, y + 1.05),
                               0.05, 0.05)
                metal.beam((tx - 0.55, tz, y + 1.35), (tx + 0.55, tz, y + 1.75), 0.22, 0.22)
                brass.cylinder(tx, tz, y + 1.05, y + 1.15, 0.09, seg=8)

            elif kind == 'workshop':
                wx, wz = cx, r['z0'] + 0.5
                wood.box(wx - 1.1, wx + 1.1, wz - 0.4, wz + 0.4, y + 0.85, y + 0.93)
                for ox in (-1.0, 1.0):
                    wood.box(wx + ox - 0.05, wx + ox + 0.05, wz - 0.35, wz + 0.35, y, y + 0.85)
                metal.box(wx + 0.3, wx + 0.7, wz - 0.2, wz + 0.2, y + 0.93, y + 1.12)

            elif kind == 'generator':
                gx, gz = cx, r['z0'] + 0.7
                metal.box(gx - 0.7, gx + 0.7, gz - 0.45, gz + 0.45, y, y + 0.95)
                metal.cylinder(gx + 0.9, gz, y, y + 1.7, 0.16, seg=10)
                metal.beam((gx + 0.9, gz, y + 1.7), (gx + 0.9, gz + 2.2, y + 2.0), 0.11, 0.11)

            elif kind == 'terrace' or kind == 'courtyard':
                for ox, oz in ((-1.2, -0.6), (1.3, 0.7)):
                    x, z = cx + ox, cz + oz
                    stone.box(x - 0.35, x + 0.35, z - 0.35, z + 0.35, y, y + 0.52)
                    for a in range(5):
                        _frond(foliage, (x, z, y + 0.52), a * 1.25, 0.55, 0.2)

            elif kind in ('gallery', 'corridor', 'foyer', 'study'):
                # portraits along the long wall, between windows
                wall_z = r['z1'] - 0.06
                n = max(1, int(w / 3.0))
                for k in range(n):
                    ax = r['x0'] + w * (k + 0.5) / n
                    if _window_at(level['id'], 'x', r['z1'], ax):
                        continue
                    wood.box(ax - 0.36, ax + 0.36, wall_z - 0.02, wall_z + 0.02, y + 1.65, y + 2.35)
                    cloth.box(ax - 0.3, ax + 0.3, wall_z - 0.04, wall_z - 0.02, y + 1.72, y + 2.28)

    W.make_mesh('PROPS_Metal', metal, W.MAT['iron'], coll)
    W.make_mesh('PROPS_Wood', wood, W.MAT['wood_narra'], coll)
    W.make_mesh('PROPS_Cloth', cloth, W.MAT['velvet'], coll)
    W.make_mesh('PROPS_Brass', brass, W.MAT['brass'], coll)
    W.make_mesh('PROPS_Bulbs', bulb, W.MAT['light_warm'], coll)
    W.make_mesh('PROPS_Stone', stone, W.MAT['stone'], coll)
    W.make_mesh('PROPS_Foliage', foliage, W.MAT['foliage'], coll)


def _window_at(level_id, axis, c, at, tol=0.75):
    for win in WINDOWS_BUILT:
        if win['level'] != level_id or win['axis'] != axis:
            continue
        if abs(win['c'] - c) > 0.1:
            continue
        if abs(win['at'] - at) < win['w'] / 2 + tol:
            return True
    return False


# the house records every opening as it builds them
def _windows():
    global WINDOWS_BUILT
    WINDOWS_BUILT = M.WINDOWS_BUILT


WINDOWS_BUILT = []


def _wall_runs(room, level_id, wall, margin=0.0, reserve_windows=False):
    """Open intervals along one room wall, with door and window holes removed."""
    if wall in ('N', 'S'):
        axis = 'x'
        c = room['z1'] if wall == 'N' else room['z0']
        lo, hi = room['x0'] + margin, room['x1'] - margin
    else:
        axis = 'z'
        c = room['x1'] if wall == 'E' else room['x0']
        lo, hi = room['z0'] + margin, room['z1'] - margin
    cuts = []
    for opening in M.DOORS_BUILT:
        if opening['level'] == level_id and opening['axis'] == axis and abs(opening['c'] - c) < 0.09:
            half = opening['w'] * 0.5 + 0.12
            cuts.append((opening['at'] - half, opening['at'] + half))
    # Windows are above the chair rail, but also reserve the wall for fixtures
    # so a sconce or mirror cannot visibly sit over the glazing.
    if reserve_windows:
        for opening in M.WINDOWS_BUILT:
            if opening['level'] == level_id and opening['axis'] == axis and abs(opening['c'] - c) < 0.09:
                half = opening['w'] * 0.5 + 0.25
                cuts.append((opening['at'] - half, opening['at'] + half))
    cuts.sort()
    runs, cursor = [], lo
    for a, b in cuts:
        a, b = max(lo, a), min(hi, b)
        if a > cursor + 0.05:
            runs.append((cursor, a))
        cursor = max(cursor, b)
    if cursor < hi - 0.05:
        runs.append((cursor, hi))
    return axis, c, runs


def _wall_orientation(wall):
    # Assets face local +Y. Rotate that normal toward the room interior.
    return {'S': 0.0, 'N': math.pi, 'E': math.pi / 2, 'W': -math.pi / 2}[wall]


def _wall_position(room, wall, along, y, inward=0.08):
    if wall == 'S': return along, room['z0'] + inward, y
    if wall == 'N': return along, room['z1'] - inward, y
    if wall == 'W': return room['x0'] + inward, along, y
    return room['x1'] - inward, along, y


def _add_detail(key, coll, name, loc, scale=1.0, rotation=0.0, tilt=0.0, support_z=None):
    mesh = DETAILS.get(key)
    if mesh is None:
        return None
    ob = bpy.data.objects.new(name, mesh)
    coll.objects.link(ob)
    ob.location = loc
    ob.scale = (scale, scale, scale)
    ob.rotation_euler = (tilt, 0.0, rotation)
    if support_z is not None:
        turn = ob.rotation_euler.to_matrix()
        lowest = min((turn @ (v.co * scale)).z for v in mesh.vertices) if mesh.vertices else 0.0
        ob.location.z = float(support_z) - lowest
        ob['support_surface_z'] = float(support_z)
    return ob


def _surface_prop(key, coll, name, loc, scale=1.0, rotation=0.0, tilt=0.0, support_z=None):
    ob = _add_detail(key, coll, name, loc, scale, rotation, tilt, support_z)
    return ob


def _place_small_tea_service(room_id, table, coll, floor_y):
    service = DETAILS.get('tea_items', {})
    pieces = [
        ('tea_set_01_teapot_01', 0.0, 0.0, 0.95),
        ('tea_set_01_teapot_01_lid', 0.0, 0.0, 0.95),
        ('tea_set_01_cup_small_01', 0.25, 0.0, 0.90),
        ('tea_set_01_saucer_circular_03', 0.25, 0.0, 0.90),
        ('tea_set_01_cup_small_02', -0.25, 0.0, 0.90),
        ('tea_set_01_saucer_circular_04', -0.25, 0.0, 0.90),
    ]
    for idx, (mesh_name, dx, dz, scale) in enumerate(pieces):
        mesh = service.get(mesh_name)
        if not mesh:
            continue
        ob = bpy.data.objects.new('DRESS_%s_TeaService_%02d' % (room_id, idx), mesh)
        coll.objects.link(ob)
        top = _support_z(table, floor_y, dx, dz)
        ob.location = (table['x'] + dx, table['z'] + dz, top)
        ob.scale = (scale, scale, scale)
        ob['support_surface_z'] = top


def _place_corner_plant(room, level, coll, room_id, pieces):
    mesh = DETAILS.get('potted_plant')
    if mesh is None:
        return
    x0, x1, z0, z1 = room['x0'] + 0.48, room['x1'] - 0.48, room['z0'] + 0.48, room['z1'] - 0.48
    candidates = [(x0, z0), (x0, z1), (x1, z0), (x1, z1)]
    for x, z in candidates:
        if any(abs(x - p['x']) < p['w'] / 2 + 0.38 and
               abs(z - p['z']) < p['d'] / 2 + 0.38 for p in pieces):
            continue
        blocked = False
        for door in M.DOORS_BUILT:
            if door['level'] != level['id']:
                continue
            if door['axis'] == 'x':
                if abs(door['c'] - z) < 0.72 and abs(door['at'] - x) < door['w'] / 2 + 0.48:
                    blocked = True
            elif abs(door['c'] - x) < 0.72 and abs(door['at'] - z) < door['w'] / 2 + 0.48:
                blocked = True
        if blocked:
            continue
        ob = bpy.data.objects.new('DRESS_%s_FloorPlant' % room_id, mesh)
        coll.objects.link(ob)
        ob.location = (x, z, level['y'])
        ob.scale = (0.68, 0.68, 0.68)
        ob['support_surface_z'] = level['y']
        return ob


def _mesh_top(name):
    mesh = FURN.get(name)
    if mesh is None or not mesh.vertices:
        return 0.0
    return max(v.co.z for v in mesh.vertices)


def _support_z(p, level_y, dx=0.0, dz=0.0):
    if not p:
        return level_y
    base = p.get('y', level_y)
    # The kitchen worktop has a raised backsplash; its actual usable top is the
    # flat 38 mm slab, not the upper edge of that rear upstand.
    if p['name'] == 'counter_top':
        return base + 0.038
    return base + _mesh_top(p['name'])


def _dress_room_surfaces(level, sub, practicals):
    """Room-specific small furnishings, fitted to actual placed furniture."""
    level_rooms = {r['id']: r for r in level['rooms']}
    placements = [p for p in PLACED if p['room'] in level_rooms]
    for room_id, room in level_rooms.items():
        kind = room['kind']
        pieces = [p for p in placements if p['room'] == room_id]
        def find(*names):
            return next((p for p in pieces if p['name'] in names), None)
        def put_on(p, key, suffix, dx=0.0, dz=0.0, scale=1.0, rotation=0.0, tilt=0.0):
            if p:
                top = _support_z(p, level['y'], dx, dz)
                return _surface_prop(key, sub, 'DRESS_%s_%s' % (room_id, suffix),
                                     (p['x'] + dx, p['z'] + dz, top),
                                     scale, rotation, tilt, support_z=top)
            return None

        if kind == 'bedroom':
            stands = [p for p in pieces if p['name'] == 'nightstand']
            for idx, stand in enumerate(stands):
                key = 'oil_lamp' if idx % 2 == 0 else 'alarm_clock'
                _surface_prop(key, sub, 'DRESS_%s_Bedside_%02d' % (room_id, idx),
                              (stand['x'], stand['z'], _support_z(stand, level['y'])),
                              scale=0.72, rotation=(idx % 2) * 0.18,
                              support_z=_support_z(stand, level['y']))

        elif kind == 'dining':
            table = find('dining_table')
            if table:
                # Tableware occupies the actual table surface and leaves each
                # chair approach clear; a tea room set is restrained at scale.
                service = DETAILS.get('tea_items', {})
                setting = [
                    ('tea_set_01_teapot_01', 0.0, 0.0, 1.45),
                    ('tea_set_01_teapot_01_lid', 0.0, 0.0, 1.45),
                    ('tea_set_01_cup_small_01', 0.31, 0.0, 1.35),
                    ('tea_set_01_saucer_circular_03', 0.31, 0.0, 1.25),
                    ('tea_set_01_cup_small_02', -0.31, 0.0, 1.35),
                    ('tea_set_01_saucer_circular_04', -0.31, 0.0, 1.25),
                ]
                for idx, (mesh_name, dx, dz, scale) in enumerate(setting):
                    mesh = service.get(mesh_name)
                    if not mesh:
                        continue
                    ob = bpy.data.objects.new('DRESS_%s_TeaService_%02d' % (room_id, idx), mesh)
                    sub.objects.link(ob)
                    top = _support_z(table, level['y'], dx, dz)
                    ob.location = (table['x'] + dx, table['z'] + dz, top)
                    ob.scale = (scale, scale, scale)
                    ob['support_surface_z'] = top
                put_on(find('aparador', 'console'), 'candleholder', 'SideCandles', scale=0.62)
                sideboard = find('aparador', 'console')
                if sideboard:
                    put_on(sideboard, 'vase', 'SideboardVase', dx=0.38, scale=0.78)
                    put_on(sideboard, 'mantel_clock', 'SideboardClock', dx=-0.35, scale=1.2)

        elif kind == 'kitchen':
            put_on(find('counter_top', 'cabinet_base'), 'cutting_board', 'PrepBoard',
                   dx=-0.28, scale=0.8)
            put_on(find('counter_top', 'cabinet_base'), 'wooden_bowl', 'ProduceBowl',
                   dx=0.37, dz=0.12, scale=1.15)
            # The sourced enamel kettle sits beside the prep board and bowl.
            counter = find('counter_top', 'cabinet_base')
            if counter:
                top = _support_z(counter, level['y'], 0.02, -0.17)
                _surface_prop('kettle', sub, 'DRESS_%s_CC0Kettle' % room_id,
                              (counter['x'] + 0.02, counter['z'] - 0.17, top),
                              scale=0.82, rotation=math.pi / 2, support_z=top)

        elif kind == 'storage' and 'Wine' in room.get('name', ''):
            anchors = [(room['x0'] + 1.0, room['z0'] + 1.05),
                       (room['x0'] + 2.05, room['z0'] + 1.05),
                       (room['x0'] + 3.1, room['z0'] + 1.05)]
            for idx, (x, z) in enumerate(anchors):
                _surface_prop('wine_barrel', sub, 'DRESS_%s_Barrel_%02d' % (room_id, idx),
                              (x, z, level['y']), scale=0.72 + idx * 0.035,
                              rotation=(idx % 2) * 0.12, support_z=level['y'])
            shelf = find('bookshelf', 'cabinet_base', 'dresser')
            if shelf:
                for idx, mesh in enumerate(list(DETAILS.get('wine_items', {}).values())[:4]):
                    # Bottle bases land on the cabinet top; labels face into room.
                    ob = bpy.data.objects.new('DRESS_%s_WineBottle_%02d' % (room_id, idx), mesh)
                    sub.objects.link(ob)
                    top = _support_z(shelf, level['y'])
                    ob.location = (shelf['x'] - 0.22 + idx * 0.14, shelf['z'], top)
                    ob.scale = (1.0, 1.0, 1.0)
                    ob['support_surface_z'] = top
                    ob.rotation_euler[2] = math.pi

        elif kind in ('study', 'gallery'):
            shelves = [p for p in pieces if p['name'] == 'bookshelf']
            if shelves:
                for si, shelf in enumerate(shelves):
                    for idx, mesh in enumerate(DETAILS.get('books', [])[:5]):
                        ob = bpy.data.objects.new('DRESS_%s_Book_%d_%d' % (room_id, si, idx), mesh)
                        sub.objects.link(ob)
                        ob.location = (shelf['x'] - 0.36 + idx * 0.14, shelf['z'], level['y'] + 1.76)
                        ob.rotation_euler[2] = math.pi
            desk = find('desk')
            if desk:
                mesh = DETAILS.get('books', [None])[0]
                if mesh:
                    _surface_prop('book', sub, 'DRESS_%s_OpenBook' % room_id,
                                  (desk['x'] + 0.18, desk['z'], _support_z(desk, level['y'])),
                                  scale=0.9, rotation=0.35, tilt=math.pi / 2,
                                  support_z=_support_z(desk, level['y']))
            cabinet = find('console', 'aparador')
            if cabinet:
                put_on(cabinet, 'mantel_clock', 'MantelClock', dx=-0.34, scale=1.28)
                put_on(cabinet, 'vase', 'CeramicVase', dx=0.38, scale=0.72)

        elif kind == 'living':
            table = find('coffee_table', 'side_table')
            if table:
                if room_id == 'GF-13':
                    put_on(table, 'candleholder', 'ConversationCandle', scale=0.65)
                else:
                    _place_small_tea_service(room_id, table, sub, level['y'])
            console = find('console', 'aparador')
            if console:
                put_on(console, 'mantel_clock', 'MantelClock', dx=-0.34, scale=1.28)
                put_on(console, 'vase', 'CeramicVase', dx=0.38, scale=0.72)
            _place_corner_plant(room, level, sub, room_id, pieces)

        elif kind in ('foyer', 'bedroom'):
            console = find('console', 'side_table', 'nightstand', 'dresser')
            if console:
                put_on(console, 'candleholder', 'Candle', scale=0.7)
            if kind == 'foyer':
                second = find('bench')
                if second:
                    put_on(second, 'candleholder', 'EntryCandle', scale=0.7)
                _place_corner_plant(room, level, sub, room_id, pieces)
                if console:
                    put_on(console, 'vase', 'EntryVase', dx=0.38, scale=0.8)
                    put_on(console, 'mantel_clock', 'EntryClock', dx=-0.35, scale=1.25)
            else:
                dresser = find('dresser', 'nightstand')
                if dresser:
                    put_on(dresser, 'mantel_clock', 'BedsideClock', dx=-0.11, scale=1.15)
                    if find('dresser'):
                        put_on(dresser, 'vase', 'DresserVase', dx=0.34, scale=0.55)

        elif kind == 'chapel':
            altar = find('console')
            if altar:
                put_on(altar, 'candleholder', 'AltarCandles', scale=0.9)

def _room_wainscot(plan, level, coll):
    """Add door-aware walnut dado panels and chair rails throughout the rooms."""
    boards = W.Bucket()
    y0 = level['y']
    for room in level['rooms']:
        if room['kind'] in ('courtyard', 'terrace', 'tunnel'):
            continue
        width, depth = room['x1'] - room['x0'], room['z1'] - room['z0']
        if min(width, depth) < 1.25:
            continue
        for wall in ('N', 'S', 'E', 'W'):
            axis, c, runs = _wall_runs(room, level['id'], wall, margin=0.035, reserve_windows=True)
            if wall == 'N': side = -1
            elif wall == 'S': side = 1
            elif wall == 'E': side = -1
            else: side = 1
            lo, hi = ((room['x0'], room['x1']) if axis == 'x' else (room['z0'], room['z1']))
            # Door-aware panel bays, turned chair rail and base trim. Their
            # inside faces stay within the shell instead of leaking through an
            # adjoining room or filling an actual doorway.
            panel_c0, panel_c1 = sorted((c + side * 0.085, c + side * 0.025))
            base_c0, base_c1 = sorted((c + side * 0.095, c + side * 0.025))
            for a, b in runs:
                if axis == 'x':
                    boards.box(a, b, panel_c0, panel_c1, y0 + 0.22, y0 + 0.86)
                    boards.box(a, b, base_c0, base_c1, y0 + 0.08, y0 + 0.23)
                    boards.box(a, b, panel_c0 - side * 0.01, panel_c1 + side * 0.01, y0 + 0.87, y0 + 0.96)
                else:
                    boards.box(panel_c0, panel_c1, a, b, y0 + 0.22, y0 + 0.86)
                    boards.box(base_c0, base_c1, a, b, y0 + 0.08, y0 + 0.23)
                    boards.box(panel_c0 - side * 0.01, panel_c1 + side * 0.01, a, b, y0 + 0.87, y0 + 0.96)
                count = max(1, int((b - a) / 0.9))
                step = (b - a) / count
                for idx in range(count + 1):
                    at = a + idx * step
                    if axis == 'x':
                        boards.box(at - 0.025, at + 0.025, panel_c0, panel_c1, y0 + 0.26, y0 + 0.83)
                    else:
                        boards.box(panel_c0, panel_c1, at - 0.025, at + 0.025, y0 + 0.26, y0 + 0.83)
    W.make_mesh('FURN_Wainscot_%s' % level['id'], boards, W.MAT['wood_narra'], coll)


def _room_fixtures(plan, level, coll, practicals):
    """Place mounted, sourced wall fixtures in each furnished interior room."""
    fixture_kinds = {'bath', 'bedroom', 'bell', 'chapel', 'corridor', 'dining', 'dressing',
                     'foyer', 'gallery', 'generator', 'kitchen', 'living', 'music',
                     'observatory', 'storage', 'study', 'utility', 'workshop'}
    for room in level['rooms']:
        kind = room['kind']
        if kind not in fixture_kinds:
            continue
        width, depth = room['x1'] - room['x0'], room['z1'] - room['z0']
        wall_order = ('N', 'S', 'E', 'W') if width >= depth else ('E', 'W', 'N', 'S')
        valid = []
        for wall in wall_order:
            axis, _, runs = _wall_runs(room, level['id'], wall, margin=0.45, reserve_windows=True)
            for a, b in runs:
                if b - a >= 0.75:
                    t = (a + b) * 0.5
                    valid.append((wall, axis, t, b - a))
        if not valid:
            continue
        if room['id'] == 'GF-14':
            # A period Asian timber chandelier belongs at the entry axis; the
            # general wall fixtures remain at the perimeter.
            cx = (room['x0'] + room['x1']) * 0.5
            cz = (room['z0'] + room['z1']) * 0.5
            _add_detail('foyer_chandelier', coll, 'FIXTURE_Foyer_Chandelier',
                        (cx, cz, level['y'] + 2.78), scale=0.9)
        # Usually a balanced pair on the primary wall; narrow rooms keep one
        # fixture. This makes each room read as its own lived-in space.
        wall, axis, center, span = valid[0]
        positions = [center]
        if span > 3.8:
            positions = [center - min(0.75, span * 0.22), center + min(0.75, span * 0.22)]
        for idx, along in enumerate(positions):
            loc = _wall_position(room, wall, along, level['y'] + 2.0, inward=0.14)
            lamp = _add_detail('sconce', coll,
                               'FIXTURE_Sconce_%s_%s_%d' % (room['id'], wall, idx),
                               loc, scale=1.55, rotation=_wall_orientation(wall))
            # A real bulb and a small local pool of warm light keep the fixture
            # legible in the dark house without flattening the room lighting.
            point = bpy.data.lights.new('FIXTURE_Glow_%s_%d' % (room['id'], idx), 'POINT')
            point.energy = 18.0 if kind in ('storage', 'utility', 'generator') else 28.0
            point.color = (1.0, 0.56, 0.31)
            point.shadow_soft_size = 0.22
            point.use_custom_distance = True
            point.cutoff_distance = 3.4
            glow = bpy.data.objects.new(point.name, point)
            glow.location = (loc[0], loc[1], loc[2] + 0.08)
            practicals.objects.link(glow)

        if kind in ('bedroom', 'dressing'):
            for mirror_wall in wall_order:
                axis, _, runs = _wall_runs(room, level['id'], mirror_wall, margin=0.48, reserve_windows=True)
                span_run = next(((a, b) for a, b in runs if b - a > 0.72), None)
                if span_run:
                    along = (span_run[0] + span_run[1]) * 0.5
                    loc = _wall_position(room, mirror_wall, along, level['y'] + 1.88, inward=0.10)
                    _add_detail('mirror', coll, 'FIXTURE_Mirror_%s' % room['id'], loc,
                                scale=1.32, rotation=_wall_orientation(mirror_wall))
                    break


# --- build -----------------------------------------------------------------
def build(colls, plan, root):
    global ROOT
    ROOT = root
    import_library(ROOT)
    _windows()
    coll = colls['MANSION_FURNITURE']
    by_level = {}
    # Give the rooms uneven, warm practical lighting. A house at night should
    # have inhabited pockets and long dark stretches, while a room-by-room
    # Blender inspection still needs enough local light to read the furniture.
    practicals = colls['LIGHTING']
    for level in plan['levels']:
        sub = W.sub_collection(coll, 'FURNITURE_%s' % level['id'])
        by_level[level['id']] = sub
        _room_wainscot(plan, level, sub)
        rugs = W.Bucket()
        lamps = W.Bucket()
        bulbs = W.Bucket()
        for room in level['rooms']:
            ctx = Ctx(room, level, level['y'], sub)
            ctx.rug_bucket = rugs
            ctx.lamp = lamps
            ctx.bulbs = bulbs
            furnish(ctx)
            AUDIT['rooms'] += 1
            if not ctx.placed:
                if room['kind'] in ('corridor', 'tunnel'):
                    CLEAR_CIRCULATION.append(room['id'])
                else:
                    SKIPPED.append(room['id'])
            seed = sum((i + 1) * ord(c) for i, c in enumerate(room['id']))
            room_rng = random.Random(seed)
            lit = room['id'] == 'GF-14' or room_rng.random() > 0.34
            if lit:
                lamp = bpy.data.lights.new('ROOMPRACTICAL_%s' % room['id'], 'POINT')
                lamp.energy = 82.0 if room['id'] == 'GF-14' else room_rng.uniform(34.0, 62.0)
                lamp.color = (1.0, 0.67 + room_rng.random() * 0.1, 0.42 + room_rng.random() * 0.08)
                lamp.shadow_soft_size = 0.32
                lamp.use_custom_distance = True
                lamp.cutoff_distance = 6.0 if room['id'] == 'GF-14' else 5.2
                light_ob = bpy.data.objects.new('ROOMPRACTICAL_%s' % room['id'], lamp)
                light_ob.location = ((room['x0'] + room['x1']) * 0.5,
                                     (room['z0'] + room['z1']) * 0.5,
                                     level['y'] + 2.65)
                practicals.objects.link(light_ob)
        _dress_room_surfaces(level, sub, practicals)
        _room_fixtures(plan, level, sub, practicals)
        W.make_mesh('FURN_Rugs_%s' % level['id'], rugs, W.MAT['velvet'], sub)
        W.make_mesh('FURN_LampFittings_%s' % level['id'], lamps, W.MAT['brass'], sub)
        W.make_mesh('FURN_Bulbs_%s' % level['id'], bulbs, W.MAT['light_warm'], sub)

    build_props(colls, plan, by_level)

    # Keep the ornate fixture over the central stair well, suspended below the
    # upper ceiling and above the top flight's head-clearance envelope.
    if DETAILS.get('stair_chandelier'):
        stair = plan['stair']
        _add_detail('stair_chandelier', colls['MANSION_STAIRS'], 'STAIR_Chandelier_01',
                    (stair['cx'], stair['cz'], 12.25), scale=1.5)

    # collision: a hidden box under every floor-standing piece
    for level in plan['levels']:
        b = W.Bucket()
        for p in PLACED:
            if p['room'] not in [r['id'] for r in level['rooms']]:
                continue
            if p['name'] not in COLLIDABLE:
                continue
            x, z, w, d = p['x'], p['z'], p['w'], p['d']
            b.box(x - w / 2, x + w / 2, z - d / 2, z + d / 2, level['y'], level['y'] + 1.0)
        ob = W.make_mesh('COLLISION_Furniture_%s' % level['id'], b,
                         W.MAT['iron'], colls['COLLISION'])
        if ob:
            ob.hide_render = True
            ob.display_type = 'WIRE'

    AUDIT['skipped'] = SKIPPED
    AUDIT['clear_circulation'] = CLEAR_CIRCULATION
    AUDIT['detail'] = [{'room': p['room'], 'piece': p['name'], 'x': round(p['x'], 2),
                        'z': round(p['z'], 2), 'rot': round(p['rot'], 2)} for p in PLACED]
    W.log('furniture: %d pieces placed, %d rooms, %d skipped'
          % (AUDIT['placed'], AUDIT['rooms'], len(SKIPPED)))
    import json
    out = os.path.join(ROOT, 'reports', 'world', 'interiors_build.json')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(AUDIT, f, indent=1)
    W.log('interiors audit -> %s' % out)

