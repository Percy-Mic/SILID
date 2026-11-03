"""Room-by-room millwork, ceilings, window glass and practical lighting.

Run after the plan, furniture and upper-storey scripts. Safe to rerun: it
removes only SILID - Detail - actors. Coordinates match plan.js (metres).
"""

import os
import unreal


ROOT = r"C:\Users\Admin\Downloads\SILID-main"
MAP_SAVE_PATH = "/Game/SILID/Maps/LM_SILID_GroundFloor"
TEXTURE_SOURCE = os.path.join(ROOT, "public", "assets", "textures")
TEXTURE_DESTINATION = "/Game/SILID/Surfaces"
PREFIX = "SILID - Detail - "
CM = 100.0
EPS = 1e-4
DOOR_HEAD = 224.0
WINDOW_SILL = 85.0
WINDOW_HEAD = 320.0
WINDOW_W = 108.0
WINDOW_SPACING = 420.0

GF_ROOMS = [
    ("Service Hall", -17, -14, -11, 11, 0.0, 420.0, False),
    ("Kitchen", -24, -17, -11, -4, 0.0, 420.0, False),
    ("Pantry", -24, -17, -4, 0, 0.0, 420.0, False),
    ("Laundry", -24, -17, 0, 4, 0.0, 420.0, False),
    ("Staff Room", -24, -17, 4, 8, 0.0, 420.0, False),
    ("Guest Room 1", -24, -17, 8, 11, 0.0, 420.0, False),
    ("Library Study", -14, -6, -11, -2, 0.0, 420.0, False),
    ("Dining Room", -6, 2, -11, -2, 0.0, 420.0, False),
    ("Family Lounge", 2, 8, -11, -2, 0.0, 420.0, False),
    ("Guest Room 3", 8, 14, -11, -5, 0.0, 420.0, False),
    ("Wine Room", 14, 21, -11, -5, 0.0, 420.0, False),
    ("Inner Courtyard", 8, 20, -5, 2, 0.0, 420.0, True),
    ("Grand Hall", -14, 8, -2, 2, 0.0, 420.0, False),
    ("Formal Living Room", -14, -5, 2, 11, 0.0, 420.0, False),
    ("Foyer", -5, 4, 2, 11, 0.0, 420.0, False),
    ("Sitting Room", 4, 8, 2, 11, 0.0, 420.0, False),
    ("Guest Room 4", 8, 21, 2, 11, 0.0, 420.0, False),
    ("Front Drawing Room", 13.55, 20.45, 11, 14.45, 0.0, 420.0, False),
    ("Sitting Bay", 5.55, 8, 11, 13.65, 0.0, 420.0, False),
    ("Breakfast Room", -5.6, 1.6, -14.7, -11, 0.0, 420.0, False),
]

GF_DOORS = [
    ("x", 11, 0, 2.2), ("x", 2, 0, 2.8), ("x", 2, -10, 1.2),
    ("x", 2, 6.5, 1.0), ("y", 8, 0, 2.6), ("y", -14, 0, 2.2),
    ("x", -2, -10, 1.2), ("x", -2, -2.5, 1.6), ("x", -2, 5, 1.2),
    ("y", -17, -4.8, 1.0), ("y", -17, -2, 1.0),
    ("y", -17, 2, 1.0), ("y", -17, 6, 1.0), ("y", -17, 9.5, 1.0),
    ("y", -14, -3.5, 1.0), ("y", -14, 6, 1.0),
    ("y", -24, 6, 1.2), ("y", 8, -3.5, 1.0),
    ("y", 14, -9, 1.0), ("y", 8, 8, 1.0),
    ("x", -5, 11.5, 1.1), ("x", -5, 17, 1.0),
    ("x", 2, 15, 1.1), ("x", 11, 15.6, 2.5),
    ("x", 11, 6.78, 1.9), ("x", -11, -0.4, 2.2),
]

STAIR_HOLE = (-5.0, -2.1, 4.25, 9.2)
BASEMENT_HOLE = (-16.9, -14.5, -10.9, -6.05)
COURTYARD_VOID = (8.0, 20.0, -5.0, 2.0)

UPPER = [
    {
        "id": "B1", "base": -340.0, "height": 324.0, "windows": False,
        "open_air": set(),
        "holes": [],
        "rooms": [
            ("Basement Landing", -19, -14, -11, -5.4),
            ("Storage Cellar", -19, -8, -5.4, 2),
            ("Wine Cellar", -8, -1, -5.4, 2),
            ("Generator Room", 0, 6, -8, 2),
            ("Interrogation Room", 6, 14, -8, 2),
            ("Service Passage", -19, 14, 2, 4),
            ("Old Cellar", -1, 6, 4, 8),
            ("Tunnel Junction", 6, 16, 4, 8),
        ],
        "doors": [
            ("x", -5.4, -18, 1.1), ("x", 2, -16, 1.0), ("x", 2, -4, 1.0),
            ("x", 2, 3, 1.0), ("x", 2, 10.5, 1.0), ("x", 4, 3, 1.0),
            ("x", 4, 10.5, 1.0), ("y", -8, -2, 1.0), ("y", 16, 6, 1.8),
        ],
    },
    {
        "id": "F2", "base": 420.0, "height": 380.0, "windows": True,
        "open_air": set(),
        "holes": [COURTYARD_VOID, STAIR_HOLE],
        "rooms": [
            ("Upper Landing", -22, 8, -2, 2),
            ("South Walkway", -22, 20, 2, 4),
            ("Master Bedroom", -6, 2, -11, -2),
            ("Her Dressing Room", 2, 5, -11, -6),
            ("Master Bath", 5, 8, -11, -6),
            ("Bedroom 3", -14, -7, -11, -2),
            ("Prayer Room", -22, -15, -11, -2),
            ("Linen Room", 3, 8, -6, -2),
            ("Family Sitting Room", -22, -13, 4, 10),
            ("Bedroom 2", -12, -6, 4, 10),
            ("Bedroom 5", 5, 10, 4, 10),
            ("Study Library", 11, 17, 4, 10),
            ("Grand Stair Hall", -6, 5, 4, 11),
        ],
        "doors": [
            ("x", -2, -2, 1.4), ("x", -2, -10.5, 1.0), ("x", -2, -18, 1.0),
            ("y", 2, -8, 1.0), ("y", 5, -8, 1.0), ("x", -6, 5, 1.0),
            ("x", 2, -18, 1.0), ("x", 4, -9, 1.0), ("x", 4, 7, 1.0),
            ("x", 4, 14, 1.0), ("y", 10, 6, 1.0), ("y", 5, 6, 1.3),
            ("x", -2, 5.5, 1.0), ("x", 4, -17, 1.0), ("x", 11, -3.2, 1.1),
        ],
    },
    {
        "id": "F3", "base": 800.0, "height": 360.0, "windows": True,
        "open_air": set(),
        "holes": [COURTYARD_VOID, STAIR_HOLE],
        "rooms": [
            ("Upper Gallery Walkway", -22, 8, -2, 2),
            ("South Walkway", -22, 20, 2, 4),
            ("Ancestral Portrait Gallery", -6, 2, -11, -2),
            ("Billiards Room", -14, -7, -11, -2),
            ("Guest Bedroom 2", -22, -15, -11, -2),
            ("Master Suite", -22, -14, 4, 10),
            ("Family Room", -12, -6, 4, 10),
            ("Sewing Craft Room", 2, 8, -11, -5),
            ("Private Bedroom 3", 8, 14, -11, -5),
            ("Locked Historical Study", 10, 16, 4, 10),
            ("Grand Stair Hall", -5, 4, 4, 11),
        ],
        "doors": [
            ("x", 2, -18, 1.6), ("x", 2, 6, 1.6), ("x", -2, -10.5, 1.3),
            ("x", 4, -18, 1.0), ("x", 4, -9, 1.0), ("x", 4, 13, 1.0),
            ("x", 4, 3, 1.4), ("y", 2, -8, 1.0), ("y", 8, -8, 1.0),
        ],
    },
    {
        "id": "F4", "base": 1160.0, "height": 300.0, "windows": False,
        "open_air": {"Roof Deck"},
        "holes": [COURTYARD_VOID, STAIR_HOLE],
        "rooms": [
            ("Observation Gallery", -6, 5, 2, 11),
            ("Archive Library", -22, -14, -11, 0),
            ("Observatory", -10, -4, -11, -5),
            ("Bell Clock Room", 8, 14, 4, 10),
            ("Roof Lantern", -1, 5, -11, -6),
            ("Maintenance Room", -22, -14, 2, 10),
            ("Caretaker Room", -13, -7, 4, 10),
            ("Roof Deck", -24, 22, -11, 11),
        ],
        "doors": [
            ("x", 0, -18, 1.0), ("x", -11, -12.2, 1.0), ("x", -5, -7, 1.0),
            ("x", 4, 11, 1.2), ("y", 8, 7, 1.0), ("y", 5, 8, 1.2),
            ("x", 2, -18, 1.0), ("x", 4, -10, 1.0), ("y", -6, 6, 1.0),
            ("x", -6, 2, 1.0),
        ],
    },
]


def vec(x, y, z):
    return unreal.Vector(float(x), float(y), float(z))


def spawn_box(subsystem, cube, label, center, size, material=None, rotation=None):
    actor = subsystem.spawn_actor_from_object(cube, vec(*center), rotation or unreal.Rotator(0, 0, 0))
    if actor:
        actor.set_actor_label(label)
        actor.set_actor_scale3d(vec(size[0] / 100.0, size[1] / 100.0, size[2] / 100.0))
        if material:
            component = actor.get_component_by_class(unreal.StaticMeshComponent)
            if component:
                component.set_material(0, material)
    return actor


def import_texture(name, filename, normal=False, linear=False):
    asset_path = TEXTURE_DESTINATION + "/" + name + "." + name
    texture = unreal.load_asset(asset_path)
    if not texture:
        source = os.path.join(TEXTURE_SOURCE, filename)
        if not os.path.isfile(source):
            raise RuntimeError("Texture source missing: " + source)
        task = unreal.AssetImportTask()
        task.filename = source
        task.destination_path = TEXTURE_DESTINATION
        task.destination_name = name
        task.automated = True
        task.save = True
        unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
        texture = unreal.load_asset(asset_path)
    if not texture:
        raise RuntimeError("Could not import texture: " + asset_path)
    if normal:
        texture.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
        texture.set_editor_property("srgb", False)
    elif linear:
        texture.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_MASKS)
        texture.set_editor_property("srgb", False)
    unreal.EditorAssetLibrary.save_loaded_asset(texture)
    return texture


def textured_material(name, maps, u_tiling, v_tiling):
    path = TEXTURE_DESTINATION + "/" + name + "." + name
    material = unreal.load_asset(path)
    if material:
        return material
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    material = tools.create_asset(name, TEXTURE_DESTINATION, unreal.Material, unreal.MaterialFactoryNew())
    if not material:
        raise RuntimeError("Could not create material " + name)
    editor = unreal.MaterialEditingLibrary
    coords = editor.create_material_expression(
        material, unreal.MaterialExpressionTextureCoordinate, -700, 0
    )
    coords.set_editor_property("u_tiling", float(u_tiling))
    coords.set_editor_property("v_tiling", float(v_tiling))
    for filename, texture, output, prop, y in maps:
        sample = editor.create_material_expression(
            material, unreal.MaterialExpressionTextureSample, -400, y
        )
        sample.set_editor_property("texture", texture)
        editor.connect_material_expressions(coords, "", sample, "Coordinates")
        editor.connect_material_property(sample, output, prop)
    editor.recompile_material(material)
    unreal.EditorAssetLibrary.save_loaded_asset(material)
    return material


def glass_material():
    path = TEXTURE_DESTINATION + "/M_SILID_WindowGlass.M_SILID_WindowGlass"
    material = unreal.load_asset(path)
    if material:
        return material
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    material = tools.create_asset("M_SILID_WindowGlass", TEXTURE_DESTINATION, unreal.Material, unreal.MaterialFactoryNew())
    editor = unreal.MaterialEditingLibrary
    material.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
    material.set_editor_property("two_sided", True)
    const_color = editor.create_material_expression(material, unreal.MaterialExpressionConstant3Vector, -300, 0)
    const_color.set_editor_property("constant", unreal.LinearColor(0.55, 0.64, 0.68, 1.0))
    editor.connect_material_property(const_color, "", unreal.MaterialProperty.MP_BASE_COLOR)
    opacity = editor.create_material_expression(material, unreal.MaterialExpressionConstant, -300, 180)
    opacity.set_editor_property("r", 0.22)
    editor.connect_material_property(opacity, "", unreal.MaterialProperty.MP_OPACITY)
    spec = editor.create_material_expression(material, unreal.MaterialExpressionConstant, -300, 280)
    spec.set_editor_property("r", 0.65)
    editor.connect_material_property(spec, "", unreal.MaterialProperty.MP_SPECULAR)
    rough = editor.create_material_expression(material, unreal.MaterialExpressionConstant, -300, 360)
    rough.set_editor_property("r", 0.04)
    editor.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
    editor.recompile_material(material)
    unreal.EditorAssetLibrary.save_loaded_asset(material)
    return material


def rect_pieces(x0, x1, y0, y1, holes):
    pieces = [(x0, x1, y0, y1)]
    for hx0, hx1, hy0, hy1 in holes:
        next_pieces = []
        for px0, px1, py0, py1 in pieces:
            if hx1 <= px0 or hx0 >= px1 or hy1 <= py0 or hy0 >= py1:
                next_pieces.append((px0, px1, py0, py1))
                continue
            ix0, ix1 = max(px0, hx0), min(px1, hx1)
            iy0, iy1 = max(py0, hy0), min(py1, hy1)
            if px0 < ix0:
                next_pieces.append((px0, ix0, py0, py1))
            if ix1 < px1:
                next_pieces.append((ix1, px1, py0, py1))
            if py0 < iy0:
                next_pieces.append((ix0, ix1, py0, iy0))
            if iy1 < py1:
                next_pieces.append((ix0, ix1, iy1, py1))
        pieces = [(a, b, c, d) for a, b, c, d in next_pieces if b - a > 0.08 and d - c > 0.08]
    return pieces


def door_spans_on(doors, orientation, coord, lo, hi):
    spans = []
    for axis, wall_coord, along, width in doors:
        if axis != orientation or abs(wall_coord - coord) > EPS:
            continue
        a, b = along - width / 2.0, along + width / 2.0
        if b > lo and a < hi:
            spans.append((max(lo, a), min(hi, b)))
    return spans


def subtract_spans(lo, hi, spans):
    pieces = []
    cursor = lo
    for a, b in sorted(spans):
        if a > cursor + 0.02:
            pieces.append((cursor, a))
        cursor = max(cursor, b)
    if hi > cursor + 0.02:
        pieces.append((cursor, hi))
    return pieces


def unique_edges(rooms):
    edges = set()
    for name, x0, x1, y0, y1 in rooms:
        for x in (x0, x1):
            edges.add(("y", round(x, 4), round(y0, 4), round(y1, 4)))
        for y in (y0, y1):
            edges.add(("x", round(y, 4), round(x0, 4), round(x1, 4)))
    grouped = {}
    for axis, coord, lo, hi in edges:
        grouped.setdefault((axis, coord), []).append((lo, hi))
    merged = []
    for (axis, coord), spans in grouped.items():
        spans.sort()
        cur_lo, cur_hi = spans[0]
        for lo, hi in spans[1:]:
            if lo <= cur_hi + EPS:
                cur_hi = max(cur_hi, hi)
            else:
                merged.append((axis, coord, cur_lo, cur_hi))
                cur_lo, cur_hi = lo, hi
        merged.append((axis, coord, cur_lo, cur_hi))
    return merged


def is_exterior_run(rooms, orientation, coord, along):
    eps = 0.03
    if orientation == "x":
        probes = ((along, coord + eps), (along, coord - eps))
    else:
        probes = ((coord + eps, along), (coord - eps, along))
    sides = set()
    for px, py in probes:
        inside = any(r[1] <= px <= r[2] and r[3] <= py <= r[4] for r in rooms)
        sides.add(inside)
    return True not in sides or False not in sides


def window_spans(rooms, doors, orientation, coord, lo, hi, allow_windows):
    if not allow_windows:
        return []
    length = (hi - lo) * CM
    if length < WINDOW_W + 60:
        return []
    candidates = []
    pos = lo + 1.0
    while pos + WINDOW_W / 200.0 < hi - 0.4:
        candidates.append(pos)
        pos += WINDOW_SPACING / CM
    if not candidates and length >= 160:
        candidates.append((lo + hi) / 2.0)
    spans = []
    door_here = door_spans_on(doors, orientation, coord, lo, hi)
    for center in candidates:
        a, b = center - WINDOW_W / 200.0, center + WINDOW_W / 200.0
        if a < lo + 0.3 or b > hi - 0.3:
            continue
        if any(not (b + 0.15 < d0 or a - 0.15 > d1) for d0, d1 in door_here):
            continue
        if not is_exterior_run(rooms, orientation, coord, center):
            continue
        spans.append((a, b))
    return spans


def spawn_light(subsystem, label, x, y, z, intensity, radius):
    actor = subsystem.spawn_actor_from_class(unreal.PointLight, vec(x, y, z), unreal.Rotator(0, 0, 0))
    if not actor:
        return None
    actor.set_actor_label(label)
    light = actor.get_component_by_class(unreal.PointLightComponent)
    if light:
        light.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
        light.set_editor_property("intensity", float(intensity))
        light.set_editor_property("attenuation_radius", float(radius))
        light.set_editor_property("light_color", unreal.Color(r=255, g=176, b=118, a=255))
        try:
            light.set_editor_property("use_inverse_squared_falloff", True)
        except Exception:
            pass
        try:
            light.set_editor_property("cast_shadows", True)
        except Exception:
            pass
    return actor


def dress_room(subsystem, cube, wood, plaster, name, x0, x1, y0, y1, base, height, open_air, holes, doors, counter):
    if open_air:
        return counter
    inset = 6.0
    wainscot_h = 96.0
    rail_h = 8.0
    skirting_h = 12.0
    crown_h = 10.0
    mill_t = 4.0
    walls = (
        ("x", y0, x0, x1, 1),
        ("x", y1, x0, x1, -1),
        ("y", x0, y0, y1, 1),
        ("y", x1, y0, y1, -1),
    )
    for axis, coord, lo, hi, inward in walls:
        cuts = door_spans_on(doors, axis, coord, lo, hi)
        for a, b in subtract_spans(lo, hi, cuts):
            run = (b - a) * CM
            if run < 8:
                continue
            if axis == "x":
                y = coord * CM + inward * (inset + mill_t / 2)
                center_xy = ((a + b) * 50, y)
                size_xy = (run, mill_t)
            else:
                x = coord * CM + inward * (inset + mill_t / 2)
                center_xy = (x, (a + b) * 50)
                size_xy = (mill_t, run)
            spawn_box(
                subsystem, cube, PREFIX + name + " - Wainscot %03d" % counter[0],
                (center_xy[0], center_xy[1], base + wainscot_h / 2),
                (size_xy[0], size_xy[1], wainscot_h), wood,
            )
            spawn_box(
                subsystem, cube, PREFIX + name + " - ChairRail %03d" % counter[0],
                (center_xy[0], center_xy[1], base + wainscot_h + rail_h / 2),
                (size_xy[0] + 1.5, size_xy[1] + 1.5, rail_h), wood,
            )
            spawn_box(
                subsystem, cube, PREFIX + name + " - Skirting %03d" % counter[0],
                (center_xy[0], center_xy[1], base + skirting_h / 2),
                (size_xy[0] + 2.0, size_xy[1] + 2.0, skirting_h), wood,
            )
            spawn_box(
                subsystem, cube, PREFIX + name + " - Crown %03d" % counter[0],
                (center_xy[0], center_xy[1], base + height - crown_h / 2),
                (size_xy[0] + 2.5, size_xy[1] + 2.5, crown_h), wood,
            )
            counter[0] += 1

    for i, (px0, px1, py0, py1) in enumerate(rect_pieces(x0, x1, y0, y1, holes)):
        spawn_box(
            subsystem, cube, PREFIX + name + " - Ceiling %d" % (i + 1),
            ((px0 + px1) * 50, (py0 + py1) * 50, base + height + 4.0),
            ((px1 - px0) * CM, (py1 - py0) * CM, 8.0), plaster,
        )

    area = max(4.0, (x1 - x0) * (y1 - y0))
    intensity = 18.0 + min(area, 80.0) * 0.35
    radius = 280.0 + min(area, 80.0) * 6.0
    spawn_light(
        subsystem, PREFIX + name + " - Pendant",
        (x0 + x1) * 50, (y0 + y1) * 50, base + height - 55.0,
        intensity, radius,
    )
    if area > 28:
        spawn_light(
            subsystem, PREFIX + name + " - Pendant B",
            (x0 * 0.35 + x1 * 0.65) * 100, (y0 * 0.4 + y1 * 0.6) * 100, base + height - 70.0,
            intensity * 0.55, radius * 0.8,
        )
    return counter


def dress_windows(subsystem, cube, wood, glass, rooms, doors, allow_windows, base, counter):
    if not allow_windows:
        return
    compact = [(name, x0, x1, y0, y1) for name, x0, x1, y0, y1 in rooms]
    for axis, coord, lo, hi in unique_edges(compact):
        for a, b in window_spans(compact, doors, axis, coord, lo, hi, allow_windows):
            mid = (a + b) / 2.0
            glass_h = WINDOW_HEAD - WINDOW_SILL - 8.0
            frame_t = 6.0
            if axis == "x":
                center = (mid * CM, coord * CM, base + (WINDOW_SILL + WINDOW_HEAD) / 2)
                glass_size = ((b - a) * CM - 8.0, 2.0, glass_h)
                jamb_size_a = (frame_t, 8.0, WINDOW_HEAD - WINDOW_SILL)
                lintel_size = ((b - a) * CM, 8.0, 8.0)
                sill_size = ((b - a) * CM + 10.0, 12.0, 6.0)
                spawn_box(subsystem, cube, PREFIX + "Window Glass %03d" % counter[0], center, glass_size, glass)
                spawn_box(
                    subsystem, cube, PREFIX + "Window Sill %03d" % counter[0],
                    (mid * CM, coord * CM, base + WINDOW_SILL - 3.0), sill_size, wood,
                )
                spawn_box(
                    subsystem, cube, PREFIX + "Window Head %03d" % counter[0],
                    (mid * CM, coord * CM, base + WINDOW_HEAD + 4.0), lintel_size, wood,
                )
                spawn_box(
                    subsystem, cube, PREFIX + "Window Jamb L %03d" % counter[0],
                    (a * CM, coord * CM, base + (WINDOW_SILL + WINDOW_HEAD) / 2), jamb_size_a, wood,
                )
                spawn_box(
                    subsystem, cube, PREFIX + "Window Jamb R %03d" % counter[0],
                    (b * CM, coord * CM, base + (WINDOW_SILL + WINDOW_HEAD) / 2), jamb_size_a, wood,
                )
            else:
                center = (coord * CM, mid * CM, base + (WINDOW_SILL + WINDOW_HEAD) / 2)
                glass_size = (2.0, (b - a) * CM - 8.0, glass_h)
                jamb_size_a = (8.0, frame_t, WINDOW_HEAD - WINDOW_SILL)
                lintel_size = (8.0, (b - a) * CM, 8.0)
                sill_size = (12.0, (b - a) * CM + 10.0, 6.0)
                spawn_box(subsystem, cube, PREFIX + "Window Glass %03d" % counter[0], center, glass_size, glass)
                spawn_box(
                    subsystem, cube, PREFIX + "Window Sill %03d" % counter[0],
                    (coord * CM, mid * CM, base + WINDOW_SILL - 3.0), sill_size, wood,
                )
                spawn_box(
                    subsystem, cube, PREFIX + "Window Head %03d" % counter[0],
                    (coord * CM, mid * CM, base + WINDOW_HEAD + 4.0), lintel_size, wood,
                )
                spawn_box(
                    subsystem, cube, PREFIX + "Window Jamb L %03d" % counter[0],
                    (coord * CM, a * CM, base + (WINDOW_SILL + WINDOW_HEAD) / 2), jamb_size_a, wood,
                )
                spawn_box(
                    subsystem, cube, PREFIX + "Window Jamb R %03d" % counter[0],
                    (coord * CM, b * CM, base + (WINDOW_SILL + WINDOW_HEAD) / 2), jamb_size_a, wood,
                )
            counter[0] += 1


def create_surfaces():
    veneer = [
        ("teak_veneer_diff", import_texture("SILID_Teak_D", "teak_veneer/teak_veneer_diff_1k.jpg"), "RGB", unreal.MaterialProperty.MP_BASE_COLOR, -250),
        ("teak_veneer_nor", import_texture("SILID_Teak_N", "teak_veneer/teak_veneer_nor_gl_1k.jpg", normal=True), "RGB", unreal.MaterialProperty.MP_NORMAL, 0),
        ("teak_veneer_rough", import_texture("SILID_Teak_R", "teak_veneer/teak_veneer_rough_1k.jpg", linear=True), "R", unreal.MaterialProperty.MP_ROUGHNESS, 250),
    ]
    wood = textured_material("M_SILID_TeakMillwork", veneer, 2.0, 1.0)
    plaster = unreal.load_asset(TEXTURE_DESTINATION + "/M_SILID_AgedPlaster.M_SILID_AgedPlaster")
    if not plaster:
        raise RuntimeError("Run ReplaceRoomWithGroundFloorPlan.py first so the plaster material exists.")
    return wood, plaster, glass_material()


def main():
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    cube = unreal.load_asset("/Engine/BasicShapes/Cube")
    if not cube:
        raise RuntimeError("Unreal's built-in Cube mesh could not be loaded.")
    wood, plaster, glass = create_surfaces()
    for actor in list(subsystem.get_all_level_actors()):
        if actor.get_actor_label().startswith(PREFIX):
            subsystem.destroy_actor(actor)

    mill_counter = [1]
    window_counter = [1]
    gf_compact = [(n, a, b, c, d) for n, a, b, c, d, _base, _h, _open in GF_ROOMS]
    for name, x0, x1, y0, y1, base, height, open_air in GF_ROOMS:
        holes = []
        if name == "Foyer":
            holes.append(STAIR_HOLE)
        if name == "Service Hall":
            holes.append(BASEMENT_HOLE)
        dress_room(
            subsystem, cube, wood, plaster, "GF " + name,
            x0, x1, y0, y1, base, height, open_air, holes, GF_DOORS, mill_counter,
        )
        unreal.log("[SILID detail] finished GF " + name)
        print("[SILID detail] finished GF " + name)
    dress_windows(subsystem, cube, wood, glass, gf_compact, GF_DOORS, True, 0.0, window_counter)

    for level in UPPER:
        rooms = [(n, a, b, c, d) for n, a, b, c, d in level["rooms"]]
        for name, x0, x1, y0, y1 in rooms:
            dress_room(
                subsystem, cube, wood, plaster, "%s %s" % (level["id"], name),
                x0, x1, y0, y1, level["base"], level["height"],
                name in level["open_air"], level["holes"], level["doors"], mill_counter,
            )
            unreal.log("[SILID detail] finished %s %s" % (level["id"], name))
            print("[SILID detail] finished %s %s" % (level["id"], name))
        dress_windows(
            subsystem, cube, wood, glass, rooms, level["doors"],
            level["windows"], level["base"], window_counter,
        )

    world = unreal.EditorLevelLibrary.get_editor_world()
    saved = unreal.EditorLoadingAndSavingUtils.save_map(world, MAP_SAVE_PATH)
    print("SILID architectural detail pass saved=%s millwork=%d windows=%d" % (
        saved, mill_counter[0] - 1, window_counter[0] - 1
    ))


main()
