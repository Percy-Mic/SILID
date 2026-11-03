"""Replace the single imported drawing-room actor with the mansion GF plan.

Run in the open SILID Unreal Editor through Tools > Execute Python Script.
The plan coordinates come from src/world/plan.js (metres; plan z maps to UE Y).
This creates a clean, measurable architectural shell/blockout, not final
materials or furniture. It intentionally leaves source GLBs untouched.
"""

import unreal
import os
import math


ROOMS = [
    # label, x0, x1, y0, y1
    ("Service Hall", -17, -14, -11, 11),
    ("Kitchen", -24, -17, -11, -4),
    ("Pantry", -24, -17, -4, 0),
    ("Laundry", -24, -17, 0, 4),
    ("Staff Room", -24, -17, 4, 8),
    ("Guest Room 1", -24, -17, 8, 11),
    ("Library Study", -14, -6, -11, -2),
    ("Dining Room", -6, 2, -11, -2),
    ("Family Lounge", 2, 8, -11, -2),
    ("Guest Room 3", 8, 14, -11, -5),
    ("Wine Room", 14, 21, -11, -5),
    ("Inner Courtyard", 8, 20, -5, 2),
    ("Grand Hall", -14, 8, -2, 2),
    ("Formal Living Room", -14, -5, 2, 11),
    ("Foyer", -5, 4, 2, 11),
    ("Sitting Room", 4, 8, 2, 11),
    ("Guest Room 4", 8, 21, 2, 11),
    ("Front Drawing Room", 13.55, 20.45, 11, 14.45),
    ("Sitting Bay", 5.55, 8, 11, 13.65),
    ("Breakfast Room", -5.6, 1.6, -14.7, -11),
]

# Ground-floor door openings from src/world/plan.js. axis=x means a wall at
# constant plan-y; axis=y means a wall at constant plan-x.
DOORS = [
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

CM = 100.0
# One storey is 4.2 m on the ground floor (plan.js GF h: 4.2) and the stair
# rises exactly half a storey per flight, so wall height and stair rise both
# read from the plan: at 3.6 m the walls stopped 60 cm short of the first
# floor slab and the stair never reached it.
WALL_H = 420.0
WALL_T = 24.0
FLOOR_T = 16.0
# Door and window geometry from plan.js (WINDOWS = sill .85 / head 3.2 /
# width 1.08 / spacing 4.2). The wall resumes above every doorway, and
# exterior runs get real openings so daylight reaches the rooms.
DOOR_HEAD = 224.0
WINDOW_SILL = 85.0
WINDOW_HEAD = 320.0
WINDOW_W = 108.0
WINDOW_SPACING = 420.0
EPS = 1e-4
ROOT = r"C:\Users\Admin\Downloads\SILID-main"
MAP_SAVE_PATH = "/Game/SILID/Maps/LM_SILID_GroundFloor"
TEXTURE_SOURCE = os.path.join(ROOT, "public", "assets", "textures")
TEXTURE_DESTINATION = "/Game/SILID/Surfaces"
ROOT_LABELS = {
    "SILID - GF Great Drawing Room",
    "SILID - First Floor Entry Spawn",
    "SILID - Drawing Room Sconce A",
    "SILID - Drawing Room Sconce B",
}


def vec(x, y, z):
    return unreal.Vector(float(x), float(y), float(z))


def set_game_map_defaults():
    config_path = os.path.join(ROOT, "ue5", "Config", "DefaultEngine.ini")
    with open(config_path, "r", encoding="utf-8") as stream:
        lines = stream.read().splitlines()
    section = "[/Script/EngineSettings.GameMapsSettings]"
    values = {
        "EditorStartupMap": MAP_SAVE_PATH,
        "GameDefaultMap": MAP_SAVE_PATH,
    }
    if section not in lines:
        lines.extend((section,))
    section_index = lines.index(section)
    end_index = next((i for i in range(section_index + 1, len(lines)) if lines[i].startswith("[")), len(lines))
    for key, value in values.items():
        prefix = key + "="
        found = next((i for i in range(section_index + 1, end_index) if lines[i].startswith(prefix)), None)
        if found is None:
            lines.insert(end_index, prefix + value)
            end_index += 1
        else:
            lines[found] = prefix + value
    with open(config_path, "w", encoding="utf-8") as stream:
        stream.write("\n".join(lines) + "\n")


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
        if not editor.connect_material_property(sample, output, prop):
            raise RuntimeError("Could not connect " + filename + " to " + name)
    editor.recompile_material(material)
    unreal.EditorAssetLibrary.save_loaded_asset(material)
    return material


def create_surfaces():
    plaster = [
        ("damaged_plaster_diff", import_texture("SILID_DamagedPlaster_D", "damaged_plaster/damaged_plaster_diff_1k.jpg"), "RGB", unreal.MaterialProperty.MP_BASE_COLOR, -250),
        ("damaged_plaster_nor", import_texture("SILID_DamagedPlaster_N", "damaged_plaster/damaged_plaster_nor_gl_1k.jpg", normal=True), "RGB", unreal.MaterialProperty.MP_NORMAL, 0),
        ("damaged_plaster_rough", import_texture("SILID_DamagedPlaster_R", "damaged_plaster/damaged_plaster_rough_1k.jpg", linear=True), "R", unreal.MaterialProperty.MP_ROUGHNESS, 250),
    ]
    wood = [
        ("wood_floor_diff", import_texture("SILID_OldWood_D", "old_wooden_floor_01/old_wooden_floor_01_diff_1k.jpg"), "RGB", unreal.MaterialProperty.MP_BASE_COLOR, -250),
        ("wood_floor_nor", import_texture("SILID_OldWood_N", "old_wooden_floor_01/old_wooden_floor_01_nor_gl_1k.jpg", normal=True), "RGB", unreal.MaterialProperty.MP_NORMAL, 0),
        ("wood_floor_rough", import_texture("SILID_OldWood_R", "old_wooden_floor_01/old_wooden_floor_01_rough_1k.jpg", linear=True), "R", unreal.MaterialProperty.MP_ROUGHNESS, 250),
    ]
    tile = [
        ("grey_tiles_diff", import_texture("SILID_CourtyardTile_D", "grey_tiles/grey_tiles_diff_1k.jpg"), "RGB", unreal.MaterialProperty.MP_BASE_COLOR, -250),
        ("grey_tiles_nor", import_texture("SILID_CourtyardTile_N", "grey_tiles/grey_tiles_nor_gl_1k.jpg", normal=True), "RGB", unreal.MaterialProperty.MP_NORMAL, 0),
        ("grey_tiles_rough", import_texture("SILID_CourtyardTile_R", "grey_tiles/grey_tiles_rough_1k.jpg", linear=True), "R", unreal.MaterialProperty.MP_ROUGHNESS, 250),
    ]
    plaster_mat = textured_material("M_SILID_AgedPlaster", plaster, 4.0, 1.0)
    wood_mat = textured_material("M_SILID_AgedOakFloor", wood, 6.0, 6.0)
    tile_mat = textured_material("M_SILID_CourtyardStone", tile, 8.0, 8.0)
    return plaster_mat, wood_mat, tile_mat


def room_sides_at(orientation, coord, along):
    """Which sides of a wall line still have building on them at `along`.

    A run is exterior when rooms touch it from one side only (or from
    neither side — the edge of the plan). Both sides means a partition.
    """
    eps = 0.03
    if orientation == "x":
        probes = ((along, coord + eps), (along, coord - eps))
    else:
        probes = ((coord + eps, along), (coord - eps, along))
    sides = set()
    for px, py in probes:
        inside = any(r[1] <= px <= r[2] and r[3] <= py <= r[4] for r in ROOMS)
        sides.add(inside)
    return sides


def is_exterior_run(orientation, coord, along):
    sides = room_sides_at(orientation, coord, along)
    return True not in sides or False not in sides


def window_spans(orientation, coord, lo, hi, doors):
    """Window openings to cut from an exterior run, clear of every door."""
    length = (hi - lo) * CM
    if length < WINDOW_W + 60:
        return []
    candidates = []
    pos = lo + 1.0
    while pos + WINDOW_W / 200.0 < hi - 0.4:
        candidates.append(pos)
        pos += WINDOW_SPACING / CM
    mid = (lo + hi) / 2.0
    if not candidates and (hi - lo) * CM >= 160:
        candidates.append(mid)
    spans = []
    for center in candidates:
        a, b = center - WINDOW_W / 200.0, center + WINDOW_W / 200.0
        if a < lo + 0.3 or b > hi - 0.3:
            continue
        if any(not (b + 0.15 < d0 or a - 0.15 > d1) for d0, d1 in doors):
            continue  # the opening belongs to a doorway, not a window
        if not is_exterior_run(orientation, coord, center):
            continue
        spans.append((a, b))
    return spans


def subtract_spans(lo, hi, spans):
    """Remove (a, b) intervals from [lo, hi], returning the remainders."""
    pieces = []
    cursor = lo
    for a, b in sorted(spans):
        if a > cursor:
            pieces.append((cursor, a))
        cursor = max(cursor, b)
    if hi > cursor:
        pieces.append((cursor, hi))
    return pieces


def door_spans_on(orientation, coord, lo, hi):
    spans = []
    for axis, wall_coord, along, width in DOORS:
        if axis != orientation or abs(wall_coord - coord) > EPS:
            continue
        a, b = along - width / 2.0, along + width / 2.0
        if b > lo and a < hi:
            spans.append((max(lo, a), min(hi, b)))
    return spans


def subtract_doors(orientation, coord, lo, hi):
    cuts = []
    for axis, wall_coord, along, width in DOORS:
        if axis != orientation or abs(wall_coord - coord) > EPS:
            continue
        a, b = along - width / 2.0, along + width / 2.0
        if b > lo and a < hi:
            cuts.append((max(lo, a), min(hi, b)))
    cuts.sort()
    merged = []
    for a, b in cuts:
        if merged and a <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], b))
        else:
            merged.append((a, b))
    segments, cursor = [], lo
    for a, b in merged:
        if a - cursor > 0.05:
            segments.append((cursor, a))
        cursor = max(cursor, b)
    if hi - cursor > 0.05:
        segments.append((cursor, hi))
    return segments


def unique_edges():
    # Split rectangles on every shared coordinate so adjoining walls are not
    # accidentally emitted twice and door locations can cut the exact segment.
    xs = sorted(set(round(v, 4) for r in ROOMS for v in (r[1], r[2])))
    ys = sorted(set(round(v, 4) for r in ROOMS for v in (r[3], r[4])))
    occupied = set()
    for _, x0, x1, y0, y1 in ROOMS:
        occupied.add((x0, x1, y0, y1))
    edges = set()
    for _, x0, x1, y0, y1 in ROOMS:
        for x in (x0, x1):
            edges.add(("y", round(x, 4), round(y0, 4), round(y1, 4)))
        for y in (y0, y1):
            edges.add(("x", round(y, 4), round(x0, 4), round(x1, 4)))
    # Merge collinear touching edges before door subtraction.
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


def main():
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    cube = unreal.load_asset("/Engine/BasicShapes/Cube")
    if not cube:
        raise RuntimeError("Unreal's built-in Cube mesh could not be loaded.")
    plaster_mat, wood_mat, tile_mat = create_surfaces()

    # This deliberately removes the old single-room assembly from the level;
    # the original GLB and imported asset stay on disk as recoverable sources.
    for actor in list(subsystem.get_all_level_actors()):
        label = actor.get_actor_label()
        if label in ROOT_LABELS or label.startswith("SILID - GF Plan -"):
            subsystem.destroy_actor(actor)

    room_count = 0
    for name, x0, x1, y0, y1 in ROOMS:
        # Exclude the central stairwell from the foyer slab by laying the foyer
        # floor as four rectangles around the stair opening.
        pieces = [(x0, x1, y0, y1)]
        if name == "Foyer":
            hx0, hx1, hy0, hy1 = -5.0, -2.1, 4.25, 9.2
            pieces = [
                (x0, hx0, y0, y1), (hx1, x1, y0, y1),
                (hx0, hx1, y0, hy0), (hx0, hx1, hy1, y1),
            ]
        if name == "Service Hall":
            # plan.js STAIR.basementHole: the straight flight down to the
            # cellar drops through this opening in the service hall floor.
            hx0, hx1, hy0, hy1 = -16.9, -14.5, -10.9, -6.05
            pieces = [
                (x0, hx0, y0, y1), (hx1, x1, y0, y1),
                (hx0, hx1, y0, hy0),
            ]
        for i, (px0, px1, py0, py1) in enumerate(pieces):
            if px1 - px0 < 0.1 or py1 - py0 < 0.1:
                continue
            spawn_box(
                subsystem, cube, "SILID - GF Plan - " + name + " Floor " + str(i + 1),
                ((px0 + px1) * 50, (py0 + py1) * 50, -FLOOR_T / 2),
                ((px1 - px0) * CM, (py1 - py0) * CM, FLOOR_T),
                tile_mat if name in ("Kitchen", "Pantry", "Laundry", "Inner Courtyard") else wood_mat,
            )
        room_count += 1

    wall_count = 0
    header_count = 0
    window_count = 0
    for axis, coord, lo, hi in unique_edges():
        doors_here = door_spans_on(axis, coord, lo, hi)
        for a, b in subtract_doors(axis, coord, lo, hi):
            length = (b - a) * CM
            if length < 5:
                continue
            windows = window_spans(axis, coord, a, b, doors_here)
            if windows:
                window_count += len(windows)
                # A windowed wall is three courses: a continuous sill course,
                # a continuous head course, and the piers between openings.
                for z0, z1, band, tag in (
                    (0.0, WINDOW_SILL, None, "Sill"),
                    (WINDOW_HEAD, WALL_H, None, "Head"),
                    (WINDOW_SILL, WINDOW_HEAD, windows, "Pier"),
                ):
                    runs = subtract_spans(a, b, band) if band else [(a, b)]
                    for ra, rb in runs:
                        run_len = (rb - ra) * CM
                        if run_len < 5:
                            continue
                        if axis == "x":
                            center = ((ra + rb) * 50, coord * CM, (z0 + z1) / 2)
                            size = (run_len, WALL_T, z1 - z0)
                        else:
                            center = (coord * CM, (ra + rb) * 50, (z0 + z1) / 2)
                            size = (WALL_T, run_len, z1 - z0)
                        spawn_box(
                            subsystem, cube,
                            "SILID - GF Plan - Wall %03d - %s" % (wall_count + 1, tag),
                            center, size, plaster_mat,
                        )
                wall_count += 1
                continue
            if axis == "x":
                center = ((a + b) * 50, coord * CM, WALL_H / 2)
                size = (length, WALL_T, WALL_H)
            else:
                center = (coord * CM, (a + b) * 50, WALL_H / 2)
                size = (WALL_T, length, WALL_H)
            spawn_box(subsystem, cube, "SILID - GF Plan - Wall " + str(wall_count + 1), center, size, plaster_mat)
            wall_count += 1

    # Above every doorway the wall resumes at the door head: without this
    # band each opening is a full-height slot and the room reads as a stage
    # flat with a gap over the frame.
    for axis, coord, along, width in DOORS:
        span = width * CM
        band_h = WALL_H - DOOR_HEAD
        if axis == "x":
            center = (along * CM, coord * CM, (DOOR_HEAD + WALL_H) / 2)
            size = (span, WALL_T, band_h)
        else:
            center = (coord * CM, along * CM, (DOOR_HEAD + WALL_H) / 2)
            size = (WALL_T, span, band_h)
        spawn_box(subsystem, cube, "SILID - GF Plan - Header %02d" % (header_count + 1), center, size, plaster_mat)
        header_count += 1

    # The stair follows the plan's dog-leg exactly (plan.js STAIR): lane A
    # runs south from the north edge of the well, the half-landing bridges
    # the south end, and lane B runs north back over lane A. Entering and
    # leaving the stair both happen at the north edge of the opening, on
    # solid floor — the previous arrangement started inside the well with no
    # floor beside its first tread, so the stair could not be climbed, and
    # its rise read from a 3.6 m storey that the plan never had.
    rise_cm = WALL_H / 2.0
    flight_run_cm = 310.0                 # plan.js STAIR.run
    step_count = 10
    tread_depth_cm = flight_run_cm / step_count
    tread_w_cm = 82.0
    stair_flights = [(-4.41, 9.20, -1, 0.0), (-2.87, 6.10, 1, rise_cm)]
    for flight_index, (flight_x, start_y, direction, base_z) in enumerate(stair_flights):
        pitch = math.degrees(math.atan2(rise_cm, flight_run_cm))
        yaw = 90.0 if direction > 0 else -90.0
        sloped_length_cm = math.sqrt(rise_cm * rise_cm + flight_run_cm * flight_run_cm)
        mid_y_cm = (start_y + direction * flight_run_cm / 200.0) * CM
        mid_z_cm = base_z + rise_cm / 2.0
        beam_rotation = unreal.Rotator(pitch, yaw, 0.0)

        for i in range(step_count):
            top_z = base_z + (i + 1) * (rise_cm / step_count)
            step_y = (start_y + direction * (i + 0.5) * tread_depth_cm / CM) * CM
            spawn_box(
                subsystem, cube, "SILID - GF Plan - Stair %d - Tread %02d" % (flight_index + 1, i + 1),
                (flight_x * CM, step_y, top_z - 2.5),
                (tread_w_cm, tread_depth_cm, 5.0), wood_mat,
            )

        for side in (-1, 1):
            side_x = flight_x * CM + side * 44.0
            spawn_box(
                subsystem, cube, "SILID - GF Plan - Stair %d - Stringer %d" % (flight_index + 1, side),
                (side_x, mid_y_cm, mid_z_cm - 7.0),
                (sloped_length_cm, 11.0, 23.0), wood_mat, beam_rotation,
            )
            spawn_box(
                subsystem, cube, "SILID - GF Plan - Stair %d - Handrail %d" % (flight_index + 1, side),
                (side_x, mid_y_cm, mid_z_cm + 88.0),
                (sloped_length_cm + 10.0, 9.0, 10.0), wood_mat, beam_rotation,
            )
            for i in range(0, step_count, 2):
                top_z = base_z + (i + 1) * (rise_cm / step_count)
                post_y = (start_y + direction * (i + 0.5) * tread_depth_cm / CM) * CM
                spawn_box(
                    subsystem, cube, "SILID - GF Plan - Stair %d - Baluster %d - %02d" % (flight_index + 1, side, i + 1),
                    (side_x, post_y, top_z + 43.0),
                    (5.0, 5.0, 80.0), wood_mat,
                )

    # The half-turn landing bridges both lanes at the south end of the well,
    # and its south edge looks straight down the open stair shaft — so it
    # carries the same balustrade the flights do.
    spawn_box(
        subsystem, cube, "SILID - GF Plan - Stair Half-turn Landing",
        (-3.64 * CM, 5.175 * CM, rise_cm - 9.0), (266.0, 185.0, 18.0), wood_mat,
    )
    for i in range(5):
        post_x = (-4.97 + 0.15 + i * (2.66 - 0.30) / 4.0) * CM
        spawn_box(
            subsystem, cube, "SILID - GF Plan - Stair Well Rail Post %d" % (i + 1),
            (post_x, 4.35 * CM, rise_cm + 36.0), (5.0, 5.0, 78.0), wood_mat,
        )
    spawn_box(
        subsystem, cube, "SILID - GF Plan - Stair Well South Rail",
        (-3.64 * CM, 4.35 * CM, rise_cm + 78.0), (266.0, 9.0, 10.0), wood_mat,
    )

    player_start = subsystem.spawn_actor_from_class(
        unreal.PlayerStart, vec(0, 1000, 100), unreal.Rotator(0, -90, 0)
    )
    if player_start:
        player_start.set_actor_label("SILID - GF Plan - Entry Spawn")

    # Cool, soft fill keeps the textured plan readable while the final room
    # fixtures and their practical light sources are designed room by room.
    moon = subsystem.spawn_actor_from_class(
        unreal.DirectionalLight, vec(0, 0, 900), unreal.Rotator(-42, -28, 0)
    )
    if moon:
        moon.set_actor_label("SILID - GF Plan - Cool Ambient Directional")
        light = moon.get_component_by_class(unreal.DirectionalLightComponent)
        if light:
            light.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
            light.set_editor_property("intensity", 2.0)
            light.set_editor_property("light_color", unreal.Color(r=158, g=179, b=214, a=255))

    fill = subsystem.spawn_actor_from_class(
        unreal.SkyLight, vec(0, 0, 700), unreal.Rotator(0, 0, 0)
    )
    if fill:
        fill.set_actor_label("SILID - GF Plan - Soft Sky Fill")
        sky = fill.get_component_by_class(unreal.SkyLightComponent)
        if sky:
            sky.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
            sky.set_editor_property("intensity", 0.35)
            try:
                sky.recapture_sky()
            except Exception:
                pass

    world = unreal.EditorLevelLibrary.get_editor_world()
    if not world:
        raise RuntimeError("The active Unreal world could not be read before saving the new level.")
    unreal.EditorAssetLibrary.make_directory("/Game/SILID/Maps")
    saved = unreal.EditorLoadingAndSavingUtils.save_map(world, MAP_SAVE_PATH)
    if not saved:
        raise RuntimeError("Could not save the new first-floor level to " + MAP_SAVE_PATH)
    map_file = os.path.join(ROOT, "ue5", "Content", "SILID", "Maps", "LM_SILID_GroundFloor.umap")
    loaded = unreal.EditorLoadingAndSavingUtils.load_map(map_file)
    if not loaded:
        raise RuntimeError("The first-floor level was saved but Unreal could not reopen " + map_file)
    set_game_map_defaults()
    unreal.log("[SILID plan] rooms=%d walls=%d saved=%s path=%s" % (room_count, wall_count, saved, MAP_SAVE_PATH))
    print("SILID first-floor plan placed: %d rooms, %d wall runs. Saved=%s at %s" % (room_count, wall_count, saved, MAP_SAVE_PATH))


main()

