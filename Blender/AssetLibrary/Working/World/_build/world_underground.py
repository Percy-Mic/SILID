"""The game's basement tunnel, cave, cistern court and forest exit.

Coordinates follow src/world/underground.js exactly (metres, game Y up).
The route begins at the existing basement east doorway x=16 and climbs back
to the forest at x=67. It is one continuous mesh collection in the master file.
"""
import math
import bpy

import world_common as W


def _mesh(name, bucket, mat, coll):
    return W.make_mesh(name, bucket, mat, coll)


def _cave_mesh(coll, mat):
    rings, around = 64, 32
    verts, faces = [], []
    for ix in range(rings + 1):
        t = ix / rings
        x = 33.0 + 15.2 * t
        center_z = 6.0 + 0.22 * math.sin(t * math.pi * 4.2)
        center_y = -2.05 + 0.12 * math.sin(t * math.pi * 3.1)
        for j in range(around):
            a = 2 * math.pi * j / around
            noise = 1.0 + 0.045 * math.sin(ix * 1.73 + j * 2.4) + 0.022 * math.sin(ix * 0.41 - j * 3.2)
            side = 2.58 * math.cos(a) * noise
            rise = 1.43 * math.sin(a) * noise
            verts.append((x, center_z + side, center_y + rise))
    for ix in range(rings):
        for j in range(around):
            a = ix * around + j
            b = ix * around + (j + 1) % around
            # inward-facing winding, so the cave lining shades toward its walkable void
            faces.append((a, a + around, b + around, b))
    me = bpy.data.meshes.new('UNDERGROUND_CaveLining')
    me.from_pydata(verts, [], faces)
    me.materials.append(mat)
    me.update()
    W.world_uv(me)
    for polygon in me.polygons:
        polygon.use_smooth = True
    ob = bpy.data.objects.new('UNDERGROUND_CaveLining', me)
    coll.objects.link(ob)
    ob['story_location'] = 'Limestone cave; x 33..48.2, floor y -3.40 m'
    return ob


def _lamp(coll, name, x, z, y, color, energy, radius):
    light = bpy.data.lights.new(name, 'POINT')
    light.energy = energy
    light.color = color
    light.shadow_soft_size = 0.16
    light.use_custom_distance = True
    light.cutoff_distance = radius
    ob = bpy.data.objects.new(name, light)
    ob.location = (x, z, y)
    coll.objects.link(ob)
    return ob


def build(coll, gameplay):
    brick = W.material('underground_brick', 0x55453a, rough=0.94, noise=(2.6, 0.18), bump=0.16)
    concrete = W.MAT['concrete']
    stone = W.MAT['stone']
    dark_stone = W.MAT['stone_dark']
    iron = W.MAT['iron']
    rust = W.MAT['roof_rust']
    floor = W.MAT['concrete_floor']

    # A: straight brick service tunnel, flush with the existing B1 landing.
    walls = W.Bucket()
    concrete_work = W.Bucket()
    props = W.Bucket()
    walls.box(16.0, 33.2, 4.4, 4.76, -3.40, -0.95)
    walls.box(16.0, 33.2, 7.24, 7.6, -3.40, -0.95)
    walls.box(16.0, 33.2, 4.2, 7.8, -1.08, -0.82)
    concrete_work.box(16.0, 33.2, 4.4, 7.6, -3.64, -3.39)
    # Masonry piers and lintel beams repeat at a plausible 2.9 m bay.
    for x in [17.4 + 2.9 * i for i in range(6)]:
        for z in (4.45, 7.55):
            concrete_work.box(x - 0.17, x + 0.17, z - 0.25, z + 0.25, -3.4, -0.9)
        concrete_work.box(x - 0.14, x + 0.14, 4.25, 7.75, -1.12, -0.82)
    # Drain channel, sump, pipe run and caged service fittings.
    props.box(16.6, 32.6, 5.88, 6.12, -3.385, -3.345)
    props.box(23.55, 24.45, 5.55, 6.45, -3.37, -3.30)
    props.box(16.6, 32.8, 4.58, 4.72, -1.22, -1.12)
    for x in (20.5, 28.5):
        props.box(x - 0.48, x + 0.48, 5.92, 6.08, -1.12, -1.02)
        props.box(x - 0.32, x + 0.32, 5.95, 6.05, -1.18, -1.12)
        _lamp(coll, 'UNDERGROUND_TunnelLamp_%0.1f' % x, x, 6.0, -1.1,
              (0.86, 0.72, 0.48), 90, 9)
    _mesh('UNDERGROUND_BrickTunnel', walls, brick, coll)
    _mesh('UNDERGROUND_TunnelFloorAndPiers', concrete_work, concrete, coll)
    _mesh('UNDERGROUND_TunnelServiceDetails', props, iron, coll)

    # B: rough limestone solution cave plus a damp, walkable floor and water pool.
    _cave_mesh(coll, W.MAT['underground_rock'])
    cave_floor = W.Bucket()
    cave_floor.box(32.7, 48.4, 2.9, 9.1, -3.56, -3.39)
    _mesh('UNDERGROUND_CaveFloor', cave_floor, floor, coll)
    pool = W.Bucket()
    pool.box(44.0, 46.4, 4.25, 5.95, -3.385, -3.365)
    _mesh('UNDERGROUND_CavePool', pool, W.MAT['water'], coll)
    _lamp(coll, 'UNDERGROUND_CaveLamp', 38.0, 6.0, -1.5, (0.58, 0.68, 0.82), 110, 13)

    # C: masonry transition collar at the cave mouth.
    collar = W.Bucket()
    collar.box(48.0, 49.0, 4.4, 4.76, -3.4, -0.95)
    collar.box(48.0, 49.0, 7.24, 7.6, -3.4, -0.95)
    collar.box(48.0, 49.0, 4.2, 7.8, -1.10, -0.80)
    collar.box(47.9, 48.2, 3.8, 4.4, -3.4, -0.4)
    collar.box(47.9, 48.2, 7.6, 8.2, -3.4, -0.4)
    _mesh('UNDERGROUND_TransitionMasonry', collar, brick, coll)
    _lamp(coll, 'UNDERGROUND_TransitionLamp', 48.5, 6.0, -1.25, (0.86, 0.73, 0.52), 80, 8)

    # D: thirteen rising brick steps under a matching vaulted service passage.
    rise_steps = W.Bucket()
    rise_shell = W.Bucket()
    n, tread = 13, 0.57
    dy = 1.96 / n
    y0 = -3.4 + dy
    y1 = y0 + (n - 1) * dy
    for i in range(n):
        top = y0 + i * dy
        x0 = 49.0 + i * tread
        rise_steps.box(x0, x0 + tread + 0.005, 4.58, 7.42, top - 0.42, top)
        rise_shell.box(x0, x0 + tread, 4.2, 4.55, top - 0.45, top + 2.28)
        rise_shell.box(x0, x0 + tread, 7.45, 7.8, top - 0.45, top + 2.28)
        rise_shell.box(x0, x0 + tread, 4.2, 7.8, top + 2.10, top + 2.40)
    # Bricked-up side opening, a service mark and a numbered plate.
    rise_shell.box(51.82, 51.98, 6.8, 8.0, -2.0, -1.05)
    rise_shell.box(51.78, 52.02, 6.65, 8.15, -1.05, -0.90)
    rise_shell.box(49.75, 50.65, 4.57, 4.63, -2.10, -2.04)
    rise_shell.box(52.74, 53.08, 4.57, 4.63, -1.37, -1.13)
    _mesh('UNDERGROUND_VaultAndBlockedPassage', rise_shell, brick, coll)
    _mesh('UNDERGROUND_VaultStairs', rise_steps, concrete, coll)
    _lamp(coll, 'UNDERGROUND_VaultLamp', 52.6, 6.0, -1.45, (0.82, 0.69, 0.49), 85, 8)

    # E: open-to-sky cistern court, with the real door opening to the west tunnel.
    court = W.Bucket()
    court.box(56.0, 62.2, 2.6, 9.4, -1.60, -1.44)
    # west wall segments flank the door; east segments flank the rising exit.
    court.box(56.0, 56.4, 2.6, 5.25, -1.56, 1.12)
    court.box(56.0, 56.4, 6.75, 9.4, -1.56, 1.12)
    court.box(56.0, 56.4, 5.25, 6.75, 0.62, 1.12)
    court.box(61.8, 62.2, 2.6, 7.2, -1.56, 1.12)
    court.box(61.8, 62.2, 8.6, 9.4, -1.56, 1.12)
    court.box(56.0, 62.2, 2.6, 3.0, -1.56, 1.12)
    court.box(56.0, 62.2, 9.0, 9.4, -1.56, 1.12)
    # Slightly proud coping around the cut.
    court.box(55.92, 56.48, 2.55, 9.45, 1.12, 1.23)
    court.box(61.72, 62.28, 2.55, 9.45, 1.12, 1.23)
    court.box(56.0, 62.2, 2.55, 3.1, 1.12, 1.23)
    court.box(56.0, 62.2, 8.9, 9.45, 1.12, 1.23)
    _mesh('UNDERGROUND_CisternCourt', court, dark_stone, coll)

    service_door = W.Bucket()
    service_door.box(56.16, 56.25, 5.29, 6.71, -1.44, 0.58)
    for y in (-1.02, -0.38, 0.28):
        service_door.box(56.11, 56.18, 5.34, 6.66, y, y + 0.09)
    service_door.box(56.10, 56.19, 6.42, 6.52, -0.52, -0.28)
    door = _mesh('UNDERGROUND_CisternServiceDoor', service_door, W.MAT['wood_narra'], gameplay)
    door['gameplay_id'] = 'cistern_door'
    door['integration_note'] = 'Static Blender model of the in-game hinged service door.'

    court_props = W.Bucket()
    court_props.box(56.85, 57.70, 3.12, 3.70, -1.40, -0.86)
    court_props.box(57.60, 58.16, 3.16, 3.72, -1.40, -0.94)
    court_props.box(57.0, 57.9, 8.24, 8.52, -1.42, -1.36)
    court_props.box(58.1, 60.2, 8.24, 8.52, -1.42, -1.36)
    court_props.box(57.5, 57.8, 8.28, 8.46, -1.38, -1.32)
    _mesh('UNDERGROUND_CourtDrainCratesAndPipe', court_props, rust, coll)
    _lamp(coll, 'UNDERGROUND_CourtLamp', 56.72, 6.9, 0.35, (0.88, 0.69, 0.42), 80, 5.5)

    # F: 15 stone steps and retaining cheeks rise from the court into the estate.
    exit_steps = W.Bucket()
    cheeks = W.Bucket()
    stair_x0, stair_x1, count = 61.8, 67.0, 15
    run = (stair_x1 - stair_x0) / count
    rise = (0.85 - (-1.44)) / count
    for i in range(count):
        top = -1.44 + (i + 1) * rise
        x0 = stair_x0 + i * run
        exit_steps.box(x0, x0 + run + 0.005, 7.2, 8.6, top - 0.44, top)
    for k in range(10):
        x0 = stair_x0 + k * (stair_x1 - stair_x0) / 10
        x1 = stair_x0 + (k + 1) * (stair_x1 - stair_x0) / 10
        idx = min(count - 1, max(0, int(((x0 + x1) * 0.5 - stair_x0) / run)))
        top = max(-1.44 + (idx + 1) * rise + 0.55, 1.14)
        for z0, z1 in ((6.85, 7.2), (8.6, 8.95)):
            cheeks.box(x0, x1, z0, z1, -1.66, top)
    landing = W.Bucket()
    landing.box(66.9, 68.9, 6.95, 8.85, 0.68, 0.85)
    _mesh('UNDERGROUND_ExitStairCheeks', cheeks, stone, coll)
    _mesh('UNDERGROUND_ExitStairAndLanding', exit_steps, floor, coll)
    _mesh('UNDERGROUND_ForestLanding', landing, floor, coll)

    # Route markers help reviewers compare the Blender location with the game.
    W.empty('UNDERGROUND_Route_Start_BasementDoor', coll, 16.1, 6.0, -3.4,
            props={'connects_to': 'B-08 Tunnel Junction'})
    W.empty('UNDERGROUND_Route_End_Forest', coll, 68.2, 7.9, 0.85,
            props={'connects_to': 'Estate Forest'})
    print('[world] underground route: B1 x16 -> tunnel -> cave -> cistern -> forest x68', flush=True)
