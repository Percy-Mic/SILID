"""SILID_COMPLETE_WORLD — the site: ground, road, drive, water, forest, car.

Everything here is placed on `Terrain.height()`, the game's own analytic height
field, so the asphalt, the verge, the trees and the car's tyres all agree. The
road is not a flat plane laid over the ground: it is sampled along its own
centreline and crowned, exactly as terrain.js builds it.

The forest is made from five tree archetypes, each built once and then shared by
all of its instances (same mesh datablock). Variants are seeded, so a rebuild is
the same forest — a screenshot can be compared with the next one.
"""

import math
import os
import random

import bpy
import bmesh
from mathutils import Vector

import world_common as W

T = W.Terrain()


# --- surfaces --------------------------------------------------------------
def grid_mesh(name, rows, mat, coll, flip=False):
    """A ribbon/surface from a list of rows of (x, z, y) points."""
    verts = []
    cols = len(rows[0])
    for row in rows:
        for p in row:
            verts.append(tuple(p))
    faces = []
    for r in range(len(rows) - 1):
        for c in range(cols - 1):
            a = r * cols + c
            b = a + cols
            if flip:
                faces.append((a, a + 1, b + 1, b))
            else:
                faces.append((a, b, b + 1, a + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    W.world_uv(me)
    me.validate()
    me.update()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = False
    return ob


def road_ribbon(name, offset, width, lift, coll, mat, cols=5, step=1.5, wob=0.0):
    rows = []
    z = -175.0
    while z <= 215.0:
        cx = T.road_center(z)
        dz = 0.01
        tx = (T.road_center(z + dz) - T.road_center(z - dz)) / (2 * dz)
        ln = math.hypot(tx, 1.0)
        nx, nz = 1.0 / ln, -tx / ln
        off = offset + (wob * (math.sin(z * 0.21 + 1.7) * 0.6 + math.sin(z * 0.53) * 0.4) if wob else 0.0)
        row = []
        for j in range(cols):
            side = off - width / 2 + width * j / (cols - 1)
            x, zz = cx + nx * side, z + nz * side
            row.append((x, zz, T.height(x, zz) + lift))
        rows.append(row)
        z += step
    return grid_mesh(name, rows, mat, coll)


def curve_ribbon(name, points, width, lift, coll, mat, cols=3):
    """A drive along a sampled polyline, mitered by the local tangent."""
    rows = []
    n = len(points)
    for i, (x, z) in enumerate(points):
        px, pz = points[max(0, i - 1)]
        qx, qz = points[min(n - 1, i + 1)]
        dx, dz = qx - px, qz - pz
        ln = math.hypot(dx, dz) or 1.0
        nx, nz = -dz / ln, dx / ln
        row = []
        for j in range(cols):
            side = -width / 2 + width * j / (cols - 1)
            xx, zz = x + nx * side, z + nz * side
            row.append((xx, zz, T.height(xx, zz) + lift))
        rows.append(row)
    return grid_mesh(name, rows, mat, coll)


def catmull(points, samples=24):
    """Interpolate a drive through its control points, not around them."""
    out = []
    p = [points[0]] + list(points) + [points[-1]]
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for s in range(samples):
            t = s / samples
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t
                       + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                       + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            z = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t
                       + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                       + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, z))
    out.append(points[-1])
    return out


# --- terrain ---------------------------------------------------------------
def build_ground(coll):
    size = 400.0
    res = 2.0
    x0, z0 = -200.0, -190.0
    nx = int(size / res) + 1
    nz = int(size / res) + 1
    verts = []
    for iz in range(nz):
        z = z0 + iz * res
        for ix in range(nx):
            x = x0 + ix * res
            verts.append((x, z, T.height(x, z)))
    faces = []
    for iz in range(nz - 1):
        for ix in range(nx - 1):
            a = iz * nx + ix
            b = a + nx
            faces.append((a, b, b + 1, a + 1))
    me = bpy.data.meshes.new('TERRAIN_Field')
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    W.world_uv(me)

    # wet leaf litter in the hollows, drier grass on the rise — not a green wash
    colors = []
    for v in verts:
        wet = W._smooth((2.0 - v[2]) / 5.0) * 0.32
        colors += [0.92 - wet * 0.18, 0.90 - wet * 0.10, 0.80 - wet * 0.16, 1.0]
    layer = me.color_attributes.new(name='Field', type='FLOAT_COLOR', domain='POINT')
    layer.data.foreach_set('color', colors)

    mat = W.material('ground_field', 0x3a3f2e, rough=0.97, noise=(2.6, 0.28), bump=0.15)
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Field'
    attr.location = (-420, -220)
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.location = (-180, -220)
    mix.inputs['Factor'].default_value = 0.55
    if bsdf.inputs['Base Color'].links:
        src = bsdf.inputs['Base Color'].links[0].from_socket
        nt.links.new(src, mix.inputs[6])
    nt.links.new(attr.outputs['Color'], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    me.materials.append(mat)

    ob = bpy.data.objects.new('TERRAIN_Field', me)
    coll.objects.link(ob)
    return ob


def build_pond(coll):
    P = T.POND
    b = W.Bucket()
    seg = 64
    for k in range(seg):
        a0 = 2 * math.pi * k / seg
        a1 = 2 * math.pi * (k + 1) / seg
        b.verts += [
            (P['x'], P['z'], P['y']),
            (P['x'] + P['r'] * math.cos(a0), P['z'] + P['r'] * math.sin(a0), P['y']),
            (P['x'] + P['r'] * math.cos(a1), P['z'] + P['r'] * math.sin(a1), P['y']),
        ]
        i = k * 3
        b.faces.append((i, i + 1, i + 2))
    W.make_mesh('WATER_Pond', b, W.MAT['water'], coll)
    W.log('pond at %.0f,%.0f' % (P['x'], P['z']))


# --- road -------------------------------------------------------------------
def build_road(coll, colls):
    asphalt = W.MAT['asphalt']
    road_ribbon('ROAD_Carriageway', 0.0, T.CARRIAGE, 0.050, coll, asphalt, cols=7)
    road_ribbon('ROAD_Shoulder_E', T.CARRIAGE / 2 + 1.5, 3.0, 0.024, coll,
                W.MAT['gravel'], cols=3, wob=0.5)
    road_ribbon('ROAD_Shoulder_W', -T.CARRIAGE / 2 - 1.5, 3.0, 0.024, coll,
                W.MAT['gravel'], cols=3, wob=0.5)
    road_ribbon('ROAD_Drain_Edge_E', T.CARRIAGE / 2 + 3.4, 0.7, 0.010, coll,
                W.MAT['ground'], cols=2, wob=0.4)
    road_ribbon('ROAD_Drain_Edge_W', -T.CARRIAGE / 2 - 3.4, 0.7, 0.010, coll,
                W.MAT['ground'], cols=2, wob=0.4)

    # patched repairs: a provincial road is a history of holes
    rng = random.Random(41)
    patch = W.Bucket()
    for _ in range(11):
        z = rng.uniform(-150, 200)
        cx = T.road_center(z) + rng.uniform(-2.4, 2.4)
        w, d = rng.uniform(1.4, 3.4), rng.uniform(1.2, 3.0)
        y = T.height(cx, z) + 0.062
        patch.box(cx - w / 2, cx + w / 2, z - d / 2, z + d / 2, y - 0.02, y)
    W.make_mesh('ROAD_Repairs', patch, W.MAT['roof_rust'], coll)

    # concrete posts and their sagging wires along the east verge
    posts = []
    pole = W.Bucket()
    arms = W.Bucket()
    z = -160.0
    idx = 0
    while z < 205.0:
        cx = T.road_center(z) + 8.2
        gy = T.height(cx, z)
        W.empty('POLE_%02d' % idx, coll, cx, z, gy, size=0.3)
        pole.cylinder(cx, z, gy - 0.2, gy + 7.6, 0.115, seg=8)
        # crossarm
        arms.box(cx - 1.1, cx + 1.1, z - 0.06, z + 0.06, gy + 6.9, gy + 7.02)
        for ox in (-0.85, 0.0, 0.85):
            arms.cylinder(cx + ox, z, gy + 7.02, gy + 7.16, 0.05, seg=6)
        posts.append((cx, z, gy))
        z += 27.0
        idx += 1
    W.make_mesh('ROAD_Poles', pole, W.MAT['concrete'], coll)
    W.make_mesh('ROAD_PoleArms', arms, W.MAT['wood_timber'], coll)

    # wires: one curve object, three lines per span, with real sag
    cu = bpy.data.curves.new('ROAD_Wires', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 0.014
    cu.bevel_resolution = 1
    for a, b in zip(posts, posts[1:]):
        for ox, oy in ((-0.85, 0.0), (0.0, 0.0), (0.85, 0.0)):
            sp = cu.splines.new('POLY')
            pts = []
            for k in range(9):
                t = k / 8
                x = a[0] + (b[0] - a[0]) * t + ox
                z = a[1] + (b[1] - a[1]) * t
                sag = 4 * 0.45 * t * (1 - t)
                y = a[2] + (b[2] - a[2]) * t + 7.1 + oy - sag
                pts.append((x, z, y))
            sp.points.add(len(pts) - 1)
            for p, co in zip(sp.points, pts):
                p.co = (co[0], co[1], co[2], 1.0)
    ob = bpy.data.objects.new('ROAD_Wires', cu)
    cu.materials.append(W.MAT['iron'])
    coll.objects.link(ob)

    # reflector posts, alternating sides, plus one kilometre stone
    ref = W.Bucket()
    red = W.Bucket()
    z = -150.0
    side = 1
    while z < 200.0:
        cx = T.road_center(z) + side * (T.CARRIAGE / 2 + 4.1)
        gy = T.height(cx, z)
        ref.box(cx - 0.06, cx + 0.06, z - 0.06, z + 0.06, gy, gy + 0.95)
        red.box(cx - 0.07, cx + 0.07, z - 0.02, z + 0.02, gy + 0.78, gy + 0.86)
        side *= -1
        z += 23.0
    W.make_mesh('ROAD_ReflectorPosts', ref, W.MAT['lime'], coll)
    W.make_mesh('ROAD_Reflectors', red, W.MAT['tail_light'], coll)

    km = W.Bucket()
    kx, kz = T.road_center(12) + 5.6, 12.0
    ky = T.height(kx, kz)
    km.box(kx - 0.22, kx + 0.22, kz - 0.14, kz + 0.14, ky, ky + 0.8)
    km.box(kx - 0.26, kx + 0.26, kz - 0.18, kz + 0.18, ky + 0.8, ky + 0.9)
    W.make_mesh('ROAD_KmStone', km, W.MAT['lime'], coll)


# --- gate, drive, estate furniture -----------------------------------------
def build_drive(coll, colls):
    control = [(0.0, 12.4), (-1.6, 15.4), (-5.0, 18.2), (-10.0, 21.0),
               (-16.0, 24.4), (-24.0, 27.2), (-34.0, 29.6), (-44.0, 31.2),
               (-53.0, 32.0), (-58.5, 32.0)]
    pts = catmull(control, 14)
    curve_ribbon('DRIVE_Gravel', pts, 4.8, 0.035, coll, W.MAT['gravel'], cols=3)
    curve_ribbon('DRIVE_Rut_East', [(x + 0.0, z) for x, z in pts], 1.0, 0.045,
                 coll, W.MAT['stone_dark'], cols=2)
    curve_ribbon('DRIVE_Rut_West', pts, 0.9, 0.045, coll, W.MAT['stone_dark'], cols=2)

    # stone gate piers at the head of the drive, gates standing open
    gx, gz = -13.6, 22.6
    gy = T.height(gx, gz)
    stone = W.Bucket()
    iron = W.Bucket()
    for side in (-1, 1):
        px = gx + side * 3.4
        stone.box(px - 0.45, px + 0.45, gz - 0.45, gz + 0.45, gy - 0.2, gy + 3.05)
        stone.box(px - 0.58, px + 0.58, gz - 0.58, gz + 0.58, gy + 3.05, gy + 3.25)
        stone.box(px - 0.5, px + 0.5, gz - 0.5, gz + 0.5, gy + 3.25, gy + 3.38)
        # a gate leaf, hinged on the pier, swung back along the verge
        hx = px + side * -0.05
        for bar in range(7):
            bx = hx + (side * -1) * (0.25 + bar * 0.48)
            iron.beam((bx, gz, gy + 0.12), (bx, gz, gy + 2.35), 0.035, 0.035)
        iron.beam((hx, gz, gy + 0.15), (hx + side * -1 * 3.2, gz, gy + 0.15), 0.06, 0.06)
        iron.beam((hx, gz, gy + 2.3), (hx + side * -1 * 3.2, gz, gy + 2.3), 0.06, 0.06)
    W.make_mesh('GATE_Piers', stone, W.MAT['stone'], coll)
    W.make_mesh('GATE_Ironwork', iron, W.MAT['iron'], coll)
    W.log('gate at %.1f,%.1f' % (gx, gz))

    # lamps on both piers: the only warm light out here, and it is failing
    for side in (-1, 1):
        px = gx + side * 3.4
        lx, lz = px, gz - 0.55
        lamp = W.Bucket()
        lamp.box(lx - 0.12, lx + 0.12, lz - 0.12, lz + 0.12, gy + 2.55, gy + 2.85)
        lamp.box(lx - 0.15, lx + 0.15, lz - 0.15, lz + 0.15, gy + 2.85, gy + 3.02)
        W.make_mesh('GATE_Lamp_%d' % side, lamp, W.MAT['iron'], coll)
        W.empty('GATE_LampGlow_%d' % side, coll, lx, lz, gy + 2.7, size=0.2)

    # the pond's reed beds and the ruins east of the approach
    reeds = W.Bucket()
    rng = random.Random(77)
    for _ in range(260):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(T.POND['r'] * 0.72, T.POND['r'] * 1.02)
        x = T.POND['x'] + r * math.cos(a)
        z = T.POND['z'] + r * math.sin(a)
        h = rng.uniform(0.7, 1.6)
        reeds.beam((x, z, T.POND['y'] - 0.1), (x + rng.uniform(-0.15, 0.15), z + rng.uniform(-0.15, 0.15), T.POND['y'] + h),
                   0.02, 0.02)
    W.make_mesh('POND_Reeds', reeds, W.MAT['bamboo'], coll)

    ruins = W.Bucket()
    rx, rz = 10.0, -19.0
    for k, (ox, oz, w, d, h) in enumerate([(-2.2, 0.0, 4.4, 0.35, 1.9),
                                          (0.0, -2.4, 0.35, 4.6, 1.3),
                                          (2.4, 0.4, 3.0, 0.35, 0.8)]):
        y = T.height(rx + ox, rz + oz)
        ruins.box(rx + ox - w / 2, rx + ox + w / 2, rz + oz - d / 2, rz + oz + d / 2, y, y + h)
    W.make_mesh('RUINS_Walls', ruins, W.MAT['stone_dark'], coll)


# --- forest -----------------------------------------------------------------
def _icosphere(bucket, cx, cy, cz, r, subdiv=1, sx=1.0, sy=1.0, sz=1.0):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    base = len(bucket.verts)
    for v in bm.verts:
        bucket.verts.append((cx + v.co.x * sx, cy + v.co.y * sy, cz + v.co.z * sz))
    bm.verts.index_update()
    for f in bm.faces:
        bucket.faces.append(tuple(base + v.index for v in f.verts))
    bm.free()


def _taper(bucket, p0, p1, r0, r1, seg=7):
    x0, z0, y0 = p0
    x1, z1, y1 = p1
    dx, dz, dy = x1 - x0, z1 - z0, y1 - y0
    ln = math.sqrt(dx * dx + dz * dz) or 1e-6
    # a basis across the trunk
    ux, uz = -dz / ln, dx / ln
    base = len(bucket.verts)
    for k in range(seg):
        a = 2 * math.pi * k / seg
        bucket.verts.append((x0 + ux * r0 * math.cos(a), z0 + uz * r0 * math.cos(a), y0 + r0 * math.sin(a)))
    for k in range(seg):
        a = 2 * math.pi * k / seg
        bucket.verts.append((x1 + ux * r1 * math.cos(a), z1 + uz * r1 * math.cos(a), y1 + r1 * math.sin(a)))
    for k in range(seg):
        a, b = base + k, base + (k + 1) % seg
        bucket.faces.append((a, b, b + seg, a + seg))
    bucket.faces.append(tuple(range(base + seg, base + 2 * seg))[::-1])
    bucket.faces.append(tuple(range(base, base + seg)))


def _frond(bucket, base_pt, angle, length, droop, width=0.24):
    x, z, y = base_pt
    steps = 4
    pts = []
    for k in range(steps + 1):
        t = k / steps
        px = x + math.cos(angle) * length * t
        pz = z + math.sin(angle) * length * t
        py = y + 0.35 * t - droop * t * t
        pts.append((px, pz, py))
    # two edges, tapering to a point
    left, right = [], []
    for k, p in enumerate(pts):
        w = width * (1 - k / (steps + 1)) * (0.8 + 0.2 * math.sin(k))
        nx, nz = -math.sin(angle) * w, math.cos(angle) * w
        left.append((p[0] + nx, p[1] + nz, p[2]))
        right.append((p[0] - nx, p[1] - nz, p[2]))
    start = len(bucket.verts)
    for k in range(len(pts)):
        bucket.verts.append(left[k])
        bucket.verts.append(right[k])
    for k in range(len(pts) - 1):
        a = start + k * 2
        bucket.faces.append((a, a + 2, a + 3, a + 1))


def tree_meshes(colls, rng):
    """Five archetypes, each one mesh per material, shared by every instance."""
    variants = {}

    def make(kind, trunk_bucket, leaf_bucket):
        tr = W.make_mesh('TREE_%s_trunk' % kind, trunk_bucket, W.MAT['bark'], colls['FOREST_VEGETATION'])
        # a dead tree has no canopy; an empty bucket has no mesh, which is not
        # an error, and every instance of it must simply skip that half.
        # Leaves are smooth-shaded: a faceted crown reads as a paper lantern.
        lf = W.make_mesh('TREE_%s_leaf' % kind, leaf_bucket, W.MAT['foliage'],
                         colls['FOREST_VEGETATION'], smooth=True)
        variants[kind] = (tr, lf)

    # 1. rain tree: tall, wide, the canopy that closes the sky
    tr, lf = W.Bucket(), W.Bucket()
    h = 5.2
    _taper(tr, (0, 0, 0), (0.25, 0.15, h), 0.36, 0.17, 8)
    for k in range(9):
        a = 2 * math.pi * k / 9 + 0.4
        r = 0.9 + 0.8 * ((k * 5) % 4) / 3
        bx = 0.25 + math.cos(a) * r
        bz = 0.15 + math.sin(a) * r
        _taper(tr, (0.1, 0.05, h * 0.55), (bx, bz, h + 1.5 + 0.3 * (k % 3)), 0.12, 0.04, 5)
        _icosphere(lf, bx * 1.15, bz * 1.15, h + 1.55 + 0.35 * (k % 4), 1.55 + 0.3 * (k % 4), 1,
                   1.2, 1.15, 0.9)
    # a central mass ties the lobes into one crown instead of a ring of balloons
    _icosphere(lf, 0.2, 0.1, h + 2.5, 2.6, 1, 1.25, 1.15, 0.85)
    _icosphere(lf, -0.4, 0.3, h + 3.2, 1.9, 1, 1.1, 1.05, 0.85)
    make('rain', tr, lf)

    # 2. mango: lower, denser, the understorey's roof
    tr, lf = W.Bucket(), W.Bucket()
    h = 3.1
    _taper(tr, (0, 0, 0), (0.12, 0.18, h), 0.3, 0.15, 7)
    for k in range(4):
        a = 2 * math.pi * k / 4 + 1.1
        bx, bz = math.cos(a) * 1.1, math.sin(a) * 1.1
        _taper(tr, (0.05, 0.1, h * 0.7), (bx, bz, h + 1.2), 0.11, 0.045, 5)
    for (ox, oz, oy, r) in ((0, 0, h + 1.9, 2.05), (1.2, 0.6, h + 1.7, 1.55),
                            (-1.1, 0.7, h + 1.8, 1.5), (0.3, -0.9, h + 2.3, 1.4),
                            (-0.6, -0.5, h + 2.45, 1.25), (1.5, -0.4, h + 2.2, 1.1)):
        _icosphere(lf, ox, oz, oy, r, 1, 1.1, 1.05, 0.9)
    make('mango', tr, lf)

    # 3. coconut palm: a leaning stem and a crown of fronds
    tr, lf = W.Bucket(), W.Bucket()
    p = (0, 0, 0)
    for k in range(5):
        t = (k + 1) / 5
        q = (t * t * 1.1, t * 0.3, t * 8.4)
        _taper(tr, p, q, 0.22 - 0.03 * k, 0.2 - 0.03 * (k + 1), 7)
        p = q
    for k in range(11):
        _frond(lf, p, 2 * math.pi * k / 11 + 0.3, 2.9, 1.15, 0.34)
    make('palm', tr, lf)

    # 4. bamboo: a clump of culms, not a single stem
    tr, lf = W.Bucket(), W.Bucket()
    for k in range(13):
        a = 2 * math.pi * k / 13
        r = 0.35 + 0.55 * ((k * 7) % 5) / 5
        x, z = math.cos(a) * r, math.sin(a) * r
        top = 5.4 + (k * 3 % 7) * 0.45
        _taper(tr, (x, z, 0), (x + 0.25, z + 0.18, top), 0.045, 0.028, 5)
        for leaf in range(4):
            _frond(lf, (x + 0.2, z + 0.15, top - leaf * 0.45), 2 * math.pi * leaf / 4 + k, 1.25, 0.4, 0.2)
    make('bamboo', tr, lf)

    # 5. dead tree: no canopy, which is what makes a forest read as old
    tr, lf = W.Bucket(), W.Bucket()
    _taper(tr, (0, 0, 0), (0.15, 0.1, 5.6), 0.3, 0.08, 7)
    for k in range(6):
        a = 2 * math.pi * k / 6 + 0.8
        y0 = 2.6 + k * 0.45
        _taper(tr, (0.1, 0.05, y0), (math.cos(a) * 2.1, math.sin(a) * 2.1, y0 + 1.9), 0.07, 0.02, 4)
    make('dead', tr, lf)
    # These five meshes are templates for the hundreds of positioned trees.
    # Leaving them visible makes a second, unplaced forest appear at (0, 0, 0).
    for trunk, leaves in variants.values():
        for ob in (trunk, leaves):
            if ob is not None:
                ob.hide_render = True
                ob.hide_viewport = True
    variants['rain_distant'] = variants['rain']
    variants['mango_distant'] = variants['mango']

    # Poly Haven's Island Tree models replace the rain and mango silhouettes.
    # Their leaf cards retain alpha and PBR materials; a small decimation keeps
    # hundreds of repeated trees within a practical scene budget. A shared
    # shape key gives the canopy a slow wind sway when the Blender timeline is
    # played. The original CC0 source packages and provenance stay in Source/.
    source_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'Source', 'PolyHaven'))

    def imported_tree(asset_id, source_name, target_name, card_fraction=0.08):
        blend_path = os.path.join(source_dir, asset_id, asset_id + '_blend_1k.blend')
        if not os.path.isfile(blend_path):
            W.log('tree asset missing; retaining procedural %s' % target_name)
            return None
        with bpy.data.libraries.load(blend_path, link=False) as (data_from, data_to):
            if source_name not in data_from.objects:
                W.log('tree object missing: %s' % source_name)
                return None
            data_to.objects = [source_name]
        source_ob = data_to.objects[0]
        if source_ob is None or source_ob.type != 'MESH':
            return None
        forest = colls['FOREST_VEGETATION']
        forest.objects.link(source_ob)
        source_ob.name = target_name + '_SOURCE'
        # Reduce each material region independently. The original model has
        # alpha-cut leaf cards, fine trunk geometry, and branches. One global
        # decimator collapsed those cards into opaque-looking polygon blobs;
        # preserving the material regions keeps the leaf-card silhouette and
        # its UV alpha mask intact while trimming only the card density.
        ratios = {0: 0.08, 1: 1.0, 2: 0.01}
        parts = []
        for slot, ratio in ratios.items():
            if slot >= len(source_ob.data.materials):
                continue
            part = source_ob.copy()
            part.data = source_ob.data.copy()
            forest.objects.link(part)
            bm = bmesh.new()
            bm.from_mesh(part.data)
            remove_faces = [face for face in bm.faces if face.material_index != slot]
            bmesh.ops.delete(bm, geom=remove_faces, context='FACES')
            loose = [vertex for vertex in bm.verts if not vertex.link_faces]
            if loose:
                bmesh.ops.delete(bm, geom=loose, context='VERTS')
            bm.to_mesh(part.data)
            bm.free()
            part.data.update()
            if len(part.data.polygons) == 0:
                bpy.data.objects.remove(part, do_unlink=True)
                continue
            part.name = '%s_REGION_%d' % (target_name, slot)
            if slot != 1:
                mod = part.modifiers.new('Reduce material region', 'DECIMATE')
                mod.ratio = ratio
                bpy.context.view_layer.objects.active = part
                part.select_set(True)
                bpy.ops.object.modifier_apply(modifier=mod.name)
                part.select_set(False)
            if slot == 1:
                # Keep intact leaf-card islands while thinning their count. A
                # face-ratio collapse distorted card edges; sampling connected
                # components preserves the alpha-cut shape and UVs.
                bm = bmesh.new()
                bm.from_mesh(part.data)
                unseen = set(bm.faces)
                components = []
                while unseen:
                    seed = unseen.pop()
                    stack = [seed]
                    component = [seed]
                    while stack:
                        face = stack.pop()
                        for edge in face.edges:
                            for neighbor in edge.link_faces:
                                if neighbor in unseen:
                                    unseen.remove(neighbor)
                                    stack.append(neighbor)
                                    component.append(neighbor)
                    components.append(component)
                if len(components) > 100:
                    seed = 4600 + sum((i + 1) * ord(c) for i, c in enumerate(asset_id))
                    seed += int(card_fraction * 1000)
                    rng_cards = random.Random(seed)
                    discard = [face for group in components if rng_cards.random() >= card_fraction
                               for face in group]
                    if discard:
                        bmesh.ops.delete(bm, geom=discard, context='FACES')
                        loose = [vertex for vertex in bm.verts if not vertex.link_faces]
                        if loose:
                            bmesh.ops.delete(bm, geom=loose, context='VERTS')
                        bm.to_mesh(part.data)
                        part.data.update()
                    W.log('tree %s leaf-card islands %d -> %d' %
                          (asset_id, len(components), sum(len(g) for g in components) - len(discard)))
                bm.free()
            parts.append(part)
        bpy.data.objects.remove(source_ob, do_unlink=True)
        if not parts:
            return None
        for part in parts:
            part.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        bpy.ops.object.join()
        ob = parts[0]
        ob.name = target_name + '_PROTOTYPE'
        if ob.data.shape_keys is None:
            ob.shape_key_add(name='Basis')
            wind = ob.shape_key_add(name='Wind_Sway')
            zs = [v.co.z for v in ob.data.vertices]
            top = max(zs) if zs else 5.0
            leaf_slot = next((i for i, mat in enumerate(ob.data.materials)
                              if mat and 'leav' in mat.name.lower()), None)
            leaf_vertices = set()
            if leaf_slot is not None:
                for poly in ob.data.polygons:
                    if poly.material_index == leaf_slot:
                        leaf_vertices.update(poly.vertices)
            for i, v in enumerate(ob.data.vertices):
                t = max(0.0, min(1.0, (v.co.z - top * 0.42) / (top * 0.58)))
                if i in leaf_vertices:
                    flutter = 0.035 * math.sin(v.co.x * 2.7 + v.co.y * 1.9)
                    wind.data[i].co.x += (0.12 + flutter) * t * t
                    wind.data[i].co.y += flutter * 0.45 * t
                else:
                    wind.data[i].co.x += 0.035 * t * t
            for frame, value in ((1, 0.0), (16, 1.0), (31, 0.0), (46, -1.0), (61, 0.0)):
                wind.value = value
                wind.keyframe_insert(data_path='value', frame=frame)
            action = ob.data.shape_keys.animation_data.action
            for fc in action.fcurves:
                fc.modifiers.new('CYCLES')
        key = 'rain' if '01' in asset_id else 'mango'
        suffix = '_hero' if 'Hero' in target_name else ('_mid' if 'Mid' in target_name else '')
        variants[key + suffix] = (ob, None)
        # The template is not a scene element; its mesh datablock remains alive
        # through the positioned instances created below.
        ob.hide_render = True
        ob.hide_viewport = True
        W.log('loaded CC0 foliage asset %s (%d faces)' % (asset_id, len(ob.data.polygons)))
        return ob

    imported_tree('island_tree_01', 'island_tree_01_LOD1', 'TREE_Rain_Asset')
    imported_tree('island_tree_02', 'island_tree_02_LOD1', 'TREE_Mango_Asset')
    imported_tree('island_tree_01', 'island_tree_01_LOD1', 'TREE_Rain_Asset_Mid', 0.005)
    imported_tree('island_tree_02', 'island_tree_02_LOD1', 'TREE_Mango_Asset_Mid', 0.005)
    imported_tree('island_tree_01', 'island_tree_01_LOD1', 'TREE_Rain_Asset_Hero', 1.0)
    imported_tree('island_tree_02', 'island_tree_02_LOD1', 'TREE_Mango_Asset_Hero', 0.25)
    return variants


def build_forest(colls, plan, car_xy):
    coll = colls['FOREST_ENVIRONMENT']
    rng = random.Random(20261031)
    variants = tree_meshes(colls, rng)

    # keep-outs: the house, the road, the drive, the pond, the ruins, the car
    control = [(0.0, 12.4), (-1.6, 15.4), (-5.0, 18.2), (-10.0, 21.0),
               (-16.0, 24.4), (-24.0, 27.2), (-34.0, 29.6), (-44.0, 31.2),
               (-53.0, 32.0), (-58.5, 32.0)]
    drive = catmull(control, 10)
    M = T.MANSION

    def dist_to_drive(x, z):
        best = 999
        for px, pz in drive:
            d = math.hypot(x - px, z - pz)
            if d < best:
                best = d
        return best

    def allowed(x, z, under=False):
        if M['x0'] - 15 < x < M['x1'] + 15 and M['z0'] - 15 < z < M['z1'] + 15:
            return False
        # the verge is narrower for grass than for trunks, so the shoulders are
        # overgrown rather than raked bare
        if abs(x - T.road_center(z)) < (7.6 if under else 13.5):
            return False
        if dist_to_drive(x, z) < (3.4 if under else 5.0):
            return False
        if math.hypot(x - T.POND['x'], z - T.POND['z']) < T.POND['r'] * (1.08 if under else 1.3):
            return False
        if math.hypot(x - 10, z + 19) < 7:
            return False
        if math.hypot(x - car_xy[0], z - car_xy[1]) < 5.5:
            return False
        # a deliberate view corridor south of the porch: the house must be seen
        if -22 < x < 18 and 12 < z < 60:
            return False
        return True

    # density: thick at the estate edge, thinning to the open field beyond
    def weight(x, z):
        r = math.hypot(x - 2, z + 2)
        base = 1.0 if r < 90 else 0.45
        if -40 < x < 30 and -25 < z < 30:
            base *= 0.75
        return base

    specs = [('rain', 0.27), ('mango', 0.34), ('palm', 0.15), ('bamboo', 0.17), ('dead', 0.07)]
    made = {'rain': 0, 'mango': 0, 'palm': 0, 'bamboo': 0, 'dead': 0}
    detailed_counts = {'rain': 0, 'mango': 0}
    mid_counts = {'rain': 0, 'mango': 0}
    hero_counts = {'rain': 0, 'mango': 0}
    attempts = 0
    target = 780
    while sum(made.values()) < target and attempts < 26000:
        attempts += 1
        x = rng.uniform(-175, 170)
        z = rng.uniform(-150, 195)
        if not allowed(x, z):
            continue
        if rng.random() > weight(x, z):
            continue
        roll = rng.random()
        acc = 0
        kind = 'mango'
        for k, w in specs:
            acc += w
            if roll <= acc:
                kind = k
                break
        variant_key = kind
        # Use the textured, leaf-card tree meshes close to the estate and the
        # approach road. Replace only the distant forest with lightweight forms
        # so the complete world remains responsive in Blender.
        radius = math.hypot(x - 2.0, z + 2.0)
        drive_distance = dist_to_drive(x, z)
        if kind in ('rain', 'mango'):
            if radius <= 55.0 or drive_distance <= 18.0:
                detailed_counts[kind] += 1
                if radius < 38.0 and hero_counts[kind] < 4:
                    variant_key = kind + '_hero'
                    hero_counts[kind] += 1
            elif radius <= 125.0 or drive_distance <= 38.0:
                variant_key = kind + '_mid'
                mid_counts[kind] += 1
            else:
                variant_key = kind + '_distant'
        tr, lf = variants[variant_key]
        gy = T.height(x, z)
        rot = rng.uniform(0, 2 * math.pi)
        scale = rng.uniform(0.78, 1.35)
        if kind in ('rain', 'mango') and lf is None:
            inst = bpy.data.objects.new('TREE_%s_%03d_foliage' % (variant_key, made[kind]), tr.data)
            inst.location = (x, z, gy)
            inst.rotation_euler = (0, 0, rot)
            scale *= 1.35 if kind == 'rain' else 1.15
            inst.scale = (scale, scale, scale * rng.uniform(0.9, 1.12))
            coll.objects.link(inst)
            made[kind] += 1
            continue
        for ob, tag in ((tr, 'trunk'), (lf, 'leaf')):
            if ob is None:
                continue
            inst = bpy.data.objects.new('TREE_%s_%03d_%s' % (kind, made[kind], tag), ob.data)
            inst.location = (x, z, gy)
            inst.rotation_euler = (0, 0, rot)
            inst.scale = (scale, scale, scale * rng.uniform(0.9, 1.12))
            coll.objects.link(inst)
        made[kind] += 1

    # Once every instance references the shared mesh data, discard all visible
    # and hidden unplaced source objects. The mesh datablocks live on through
    # their instances, and the Outliner stays focused on placed world objects.
    templates = {}
    for trunk, leaves in variants.values():
        for ob in (trunk, leaves):
            if ob is not None and bpy.data.objects.get(ob.name) is not None:
                templates[ob.name] = ob
    for ob in templates.values():
        bpy.data.objects.remove(ob, do_unlink=True)

    W.log('forest: ' + ', '.join('%s %d' % (k, v) for k, v in made.items()))
    W.log('full foliage: ' + ', '.join('%s %d' % (k, v) for k, v in detailed_counts.items()))
    W.log('mid foliage: ' + ', '.join('%s %d' % (k, v) for k, v in mid_counts.items()))
    W.log('hero canopies: ' + ', '.join('%s %d' % (k, v) for k, v in hero_counts.items()))

    # undergrowth: ferns, shrubs and grass, three shared meshes
    under = {}
    fern = W.Bucket()
    for k in range(9):
        _frond(fern, (0, 0, 0.02), 2 * math.pi * k / 9, 0.75, 0.25, 0.11)
    under['fern'] = W.make_mesh('UNDER_Fern', fern, W.MAT['foliage_light'], coll)

    shrub = W.Bucket()
    _icosphere(shrub, 0, 0, 0.55, 0.72, 1, 1.2, 1.2, 0.85)
    _icosphere(shrub, 0.4, 0.3, 0.5, 0.5, 1, 1.0, 1.0, 0.8)
    under['shrub'] = W.make_mesh('UNDER_Shrub', shrub, W.MAT['foliage'], coll)

    grass = W.Bucket()
    for k in range(6):
        a = 2 * math.pi * k / 6
        grass.beam((0, 0, 0), (math.cos(a) * 0.28, math.sin(a) * 0.28, 0.55), 0.05, 0.05)
    under['grass'] = W.make_mesh('UNDER_Grass', grass, W.MAT['foliage_light'], coll)

    # Understory templates are instanced below; hide their unplaced source
    # objects to prevent visible vegetation hovering at the origin.
    for ob in under.values():
        ob.hide_render = True
        ob.hide_viewport = True

    rng2 = random.Random(5150)
    counts = {'fern': 0, 'shrub': 0, 'grass': 0}
    for _ in range(5200):
        x = rng2.uniform(-150, 150)
        z = rng2.uniform(-130, 175)
        if not allowed(x, z, under=True):
            continue
        kind = 'grass' if rng2.random() < 0.55 else ('fern' if rng2.random() < 0.6 else 'shrub')
        if counts[kind] > 900:
            continue
        ob = bpy.data.objects.new('UNDER_%s_%03d' % (kind, counts[kind]), under[kind].data)
        ob.location = (x, z, T.height(x, z))
        ob.rotation_euler = (0, 0, rng2.uniform(0, 6.28))
        s = rng2.uniform(0.6, 1.5)
        ob.scale = (s, s, s * rng2.uniform(0.8, 1.3))
        coll.objects.link(ob)
        counts[kind] += 1
    W.log('undergrowth: ' + ', '.join('%s %d' % (k, v) for k, v in counts.items()))

    # fallen limbs and rocks, at believable sizes and always on the ground
    debris = W.Bucket()
    rocks = W.Bucket()
    rng3 = random.Random(99)
    for _ in range(46):
        x, z = rng3.uniform(-120, 120), rng3.uniform(-100, 150)
        if not allowed(x, z):
            continue
        gy = T.height(x, z)
        ln = rng3.uniform(1.2, 3.4)
        a = rng3.uniform(0, 6.28)
        debris.beam((x, z, gy + 0.08), (x + math.cos(a) * ln, z + math.sin(a) * ln, gy + 0.08),
                    0.16, 0.16)
    for _ in range(38):
        x, z = rng3.uniform(-110, 110), rng3.uniform(-90, 120)
        if not allowed(x, z):
            continue
        gy = T.height(x, z)
        r = rng3.uniform(0.18, 0.55)
        _icosphere(rocks, x, z, gy + r * 0.3, r, 0, 1.25, 1.0, 0.5)
    W.make_mesh('DEBRIS_FallenLimbs', debris, W.MAT['bark'], coll)
    W.make_mesh('DEBRIS_Rocks', rocks, W.MAT['stone_dark'], coll)


# --- the car ----------------------------------------------------------------
def _wheel(bucket, cx, cz, cy, r, width, seg=14):
    base = len(bucket.verts)
    for side in (-width / 2, width / 2):
        for k in range(seg):
            a = 2 * math.pi * k / seg
            bucket.verts.append((cx + side, cz + r * math.cos(a), cy + r * math.sin(a)))
    for k in range(seg):
        a, b = base + k, base + (k + 1) % seg
        bucket.faces.append((a, b, b + seg, a + seg))
    bucket.faces.append(tuple(range(base, base + seg)))
    bucket.faces.append(tuple(range(base + seg, base + 2 * seg))[::-1])


def build_car(coll, x, z, rot):
    """A 1990s Filipino family SUV, ported from the game's own buildCar().

    The GLB in public/assets/models is the exploded damage variant: its panels
    sit metres off the body, which is why the game stopped using it. This is the
    car the player actually drives, so the master world gets the same one.
    """
    body = W.Bucket()
    dark = W.Bucket()
    glass = W.Bucket()
    rubber = W.Bucket()
    chrome = W.Bucket()
    lamps = W.Bucket()
    interior = W.Bucket()
    gy = T.height(x, z)

    c, s = math.cos(rot), math.sin(rot)

    def put(bucket, w, h, d, ox, oy, oz):
        """Local box, car local +z forward, +y up, then yaw and place."""
        wx = x + ox * c + oz * s
        wz = z - ox * s + oz * c
        bucket.box(wx - w / 2, wx + w / 2, wz - d / 2, wz + d / 2, gy + oy, gy + oy + h)

    def put_taper(bucket, x0, x1, z0, z1, y0, y1, tx0, tx1, tz0, tz1):
        """A body panel that leans: cabin sides, the windscreen rake, the bonnet.

        Real cars are not extrusions. A vertical cabin wall on a 1990s SUV makes
        it read as a van, so the roof is narrower and shorter than the waist and
        the front face falls forward as a windscreen.
        """
        low = [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]
        high = [(tx0, tz0), (tx1, tz0), (tx1, tz1), (tx0, tz1)]
        base = len(bucket.verts)
        for lx, lz in low:
            bucket.verts.append((x + lx * c + lz * s, z - lx * s + lz * c, gy + y0))
        for lx, lz in high:
            bucket.verts.append((x + lx * c + lz * s, z - lx * s + lz * c, gy + y1))
        bucket.faces.append((base + 0, base + 3, base + 2, base + 1))
        bucket.faces.append((base + 4, base + 5, base + 6, base + 7))
        for k in range(4):
            a, b = base + k, base + (k + 1) % 4
            bucket.faces.append((a, b, b + 4, a + 4))

    # body bands
    put(body, 1.84, 0.38, 4.42, 0, 0.62, 0.05)
    put(body, 1.90, 0.34, 4.30, 0, 0.95, 0.06)
    put(body, 1.78, 0.20, 1.15, 0, 1.06, 1.86)
    put(body, 1.72, 0.20, 0.90, 0, 1.06, -1.90)
    put(dark, 1.60, 0.28, 1.00, 0, 0.48, 2.16)
    put(dark, 1.60, 0.30, 0.70, 0, 0.48, -2.18)
    put(dark, 1.30, 0.20, 0.10, 0, 0.74, 2.36)
    put(chrome, 1.20, 0.16, 0.06, 0, 0.92, 2.34)
    # cabin: waist at 1.30, roof at 1.74, narrower and shorter at the top, and
    # the front face raked back so the windscreen is a screen and not a wall
    put_taper(body, -0.80, 0.80, -1.78, 0.86, 1.28, 1.745,
              -0.73, 0.73, -1.60, 0.38)
    put(body, 1.46, 0.05, 2.02, 0, 1.745, -0.58)
    for zz in (0.60, -1.52):
        for xx in (-0.74, 0.74):
            put(body, 0.06, 0.46, 0.09, xx, 1.30, zz)
    put(dark, 1.5, 0.05, 1.9, 0, 1.795, -0.62)
    # glazing: a dark band all round the cabin, broken by the pillars
    put_taper(glass, -0.815, 0.815, -1.66, 0.46, 1.38, 1.66,
              -0.745, 0.745, -1.56, 0.30)
    put(glass, 1.40, 0.50, 0.03, 0, 1.40, 0.74)
    put(glass, 1.34, 0.44, 0.03, 0, 1.42, -1.66)
    # arch lips and a sill step, so the wheels sit in the body
    for wx in (-0.93, 0.93):
        for wz in (1.42, -1.42):
            put(dark, 0.05, 0.16, 0.96, wx * 1.01, 0.66, wz)
            put(dark, 0.10, 0.10, 1.02, wx * 1.0, 0.30, wz)
    # wheels
    for wx in (-0.93, 0.93):
        for wz in (1.42, -1.42):
            gx = x + wx * c + wz * s
            gz = z - wx * s + wz * c
            _wheel(rubber, gx, gz, gy + 0.37, 0.37, 0.24)
            _wheel(chrome, gx, gz, gy + 0.37, 0.20, 0.25, 10)
    # lamps and plate
    put(lamps, 0.34, 0.16, 0.03, 0.62, 0.90, 2.38)
    put(lamps, 0.34, 0.16, 0.03, -0.62, 0.90, 2.38)
    put(dark, 0.30, 0.26, 0.03, 0.66, 1.00, -2.24)
    put(dark, 0.30, 0.26, 0.03, -0.66, 1.00, -2.24)
    # interior: dash, wheel, seats — visible through the windscreen
    put(interior, 1.50, 0.12, 0.40, 0, 1.04, 0.68)
    put(interior, 0.52, 0.24, 0.20, 0.42, 1.15, 0.60)
    for sx in (0.45, -0.45):
        put(interior, 0.54, 0.14, 0.52, sx, 1.05, -0.28)
        put(interior, 0.54, 0.60, 0.13, sx, 1.16, -0.56)
    put(interior, 1.42, 0.50, 0.50, 0, 1.05, -1.15)
    # bonnet, closed
    put(body, 1.72, 0.05, 1.05, 0, 1.16, 1.82)

    for name, bucket, mat in (
        ('CAR_Body', body, W.MAT['paint_car']),
        ('CAR_Trim', dark, W.MAT['tyre']),
        ('CAR_Glazing', glass, W.MAT['car_glass']),
        ('CAR_Tyres', rubber, W.MAT['tyre']),
        ('CAR_Chrome', chrome, W.MAT['chrome']),
        ('CAR_Lamps', lamps, W.MAT['head_light']),
        ('CAR_Interior', interior, W.MAT['cloth_dark']),
    ):
        W.make_mesh(name, bucket, mat, coll)
    W.log('car at %.1f,%.1f facing %.0f deg' % (x, z, math.degrees(rot)))
