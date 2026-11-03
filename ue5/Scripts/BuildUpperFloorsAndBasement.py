"""Build the four remaining storeys of the SILID mansion in Unreal.

Run after ReplaceRoomWithGroundFloorPlan.py and PopulateGroundFloor.py (the
BuildMansion.py wrapper runs all three in order). Every coordinate comes from
src/world/plan.js: metres in plan space, plan z becomes UE Y, and each level
is lifted to its authored floor height (B1 -3.4, GF 0, F2 4.2, F3 8.0,
F4 11.6 m).

What this creates, per level, all rerunnable by label prefix:
  - one floor box per room, cut around the open stair shaft and the
    courtyard void exactly as the plan's `holes` declare them
  - walls on every merged room edge, with door openings, the wall band
    above each door head, and real window openings on exterior runs
  - ASILIDDoor actors with frames, jambs and lintels for every plan door
  - the dog-leg stair continuing each storey (lane A south, landing, lane B
    north) plus the balustrades that keep the open shaft from being a ledge
  - the straight basement flight through the service hall opening
  - kind-appropriate furnished rooms as SILIDInspectableProp actors
"""

import json
import math
import os
import unreal


ROOT = r"C:\Users\Admin\Downloads\SILID-main"
PREPARED_ROOT = os.path.join(ROOT, "ue5", "Saved", "ImportReady")
DEST = "/Game/SILID/Furniture"
INDEX_FILE = os.path.join(ROOT, "ue5", "Saved", "silid_furniture_mesh_index.json")
MAP_SAVE_PATH = "/Game/SILID/Maps/LM_SILID_GroundFloor"
PROP_CLASS_PATH = "/Script/SILID.SILIDInspectableProp"
DOOR_CLASS_PATH = "/Script/SILID.SILIDDoor"
TEXTURE_SOURCE = os.path.join(ROOT, "public", "assets", "textures")
TEXTURE_DESTINATION = "/Game/SILID/Surfaces"

CM = 100.0
WALL_T = 24.0
FLOOR_T = 16.0
DOOR_HEAD = 224.0
WINDOW_SILL = 85.0
WINDOW_HEAD = 320.0
WINDOW_W = 108.0
WINDOW_SPACING = 420.0
EPS = 1e-4

# plan.js STAIR.hole — the open stair shaft carried up through every storey,
# and the courtyard void that stays open to the sky above the ground floor.
STAIR_HOLE = (-5.0, -2.1, 4.25, 9.2)
COURTYARD_VOID = (8.0, 20.0, -5.0, 2.0)
# plan.js STAIR.basementHole — where the straight cellar flight drops.
BASEMENT_HOLE = (-16.9, -14.5, -10.9, -6.05)

# Material keys resolve through SURFACE below; floors and walls of a level
# are chosen from the plan's `floor` / `wall` fields.
LEVELS = [
    {
        "id": "B1", "base": -340.0, "height": 324.0,
        # Walls run from the cellar floor up to the underside of the ground
        # floor slab (-16), so the storey closes against the structure above.
        "floor": "conc_floor", "wall": "conc_wall", "windows": False,
        "ceiling": False, "holes": [],
        "rooms": [
            ("Basement Landing", "corridor", -19, -14, -11, -5.4),
            ("Storage Cellar", "storage", -19, -8, -5.4, 2),
            ("Wine Cellar", "storage", -8, -1, -5.4, 2),
            ("Generator Room", "generator", 0, 6, -8, 2),
            ("Interrogation Room", "workshop", 6, 14, -8, 2),
            ("Service Passage", "corridor", -19, 14, 2, 4),
            ("Old Cellar", "storage", -1, 6, 4, 8),
            ("Tunnel Junction", "tunnel", 6, 16, 4, 8),
        ],
        "doors": [
            ("x", -5.4, -18, 1.1), ("x", 2, -16, 1.0), ("x", 2, -4, 1.0),
            ("x", 2, 3, 1.0), ("x", 2, 10.5, 1.0), ("x", 4, 3, 1.0),
            ("x", 4, 10.5, 1.0), ("y", -8, -2, 1.0), ("y", 16, 6, 1.8),
        ],
    },
    {
        "id": "F2", "base": 420.0, "height": 380.0,
        "floor": "wood", "wall": "wallpaper", "windows": True,
        "ceiling": False, "holes": [COURTYARD_VOID, STAIR_HOLE],
        "rooms": [
            ("Upper Landing", "corridor", -22, 8, -2, 2),
            ("South Walkway", "corridor", -22, 20, 2, 4),
            ("Master Bedroom", "bedroom", -6, 2, -11, -2),
            ("Her Dressing Room", "dressing", 2, 5, -11, -6),
            ("Master Bath", "bath", 5, 8, -11, -6),
            ("Bedroom 3", "bedroom", -14, -7, -11, -2),
            ("Prayer Room", "chapel", -22, -15, -11, -2),
            ("Linen Room", "storage", 3, 8, -6, -2),
            ("Family Sitting Room", "living", -22, -13, 4, 10),
            ("Bedroom 2", "bedroom", -12, -6, 4, 10),
            ("Bedroom 5", "bedroom", 5, 10, 4, 10),
            ("Study / Library", "study", 11, 17, 4, 10),
            ("Grand Stair Hall", "foyer", -6, 5, 4, 11),
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
        "id": "F3", "base": 800.0, "height": 360.0,
        "floor": "wood", "wall": "wallpaper", "windows": True,
        "ceiling": False, "holes": [COURTYARD_VOID, STAIR_HOLE],
        "rooms": [
            ("Upper Gallery Walkway", "corridor", -22, 8, -2, 2),
            ("South Walkway", "corridor", -22, 20, 2, 4),
            ("Ancestral Portrait Gallery", "gallery", -6, 2, -11, -2),
            ("Billiards Room", "music", -14, -7, -11, -2),
            ("Guest Bedroom 2", "bedroom", -22, -15, -11, -2),
            ("Master Suite", "bedroom", -22, -14, 4, 10),
            ("Family Room", "living", -12, -6, 4, 10),
            ("Sewing / Craft Room", "workshop", 2, 8, -11, -5),
            ("Private Bedroom 3", "bedroom", 8, 14, -11, -5),
            ("Locked Historical Study", "study", 10, 16, 4, 10),
            ("Grand Stair Hall", "foyer", -5, 4, 4, 11),
        ],
        "doors": [
            ("x", 2, -18, 1.6), ("x", 2, 6, 1.6), ("x", -2, -10.5, 1.3),
            ("x", 4, -18, 1.0), ("x", 4, -9, 1.0), ("x", 4, 13, 1.0),
            ("x", 4, 3, 1.4), ("y", 2, -8, 1.0), ("y", 8, -8, 1.0),
        ],
    },
    {
        "id": "F4", "base": 1160.0, "height": 300.0,
        "floor": "conc_floor", "wall": "stone", "windows": False,
        # The roof level's outer wall is the deck parapet: openings at sill
        # height would read as windows in a parapet, so this storey keeps its
        # walls whole and takes its light from the open deck and doorways.
        "ceiling": True, "holes": [COURTYARD_VOID, STAIR_HOLE],
        "rooms": [
            ("Observation Gallery", "gallery", -6, 5, 2, 11),
            ("Archive / Library", "study", -22, -14, -11, 0),
            ("Observatory", "observatory", -10, -4, -11, -5),
            ("Bell / Clock Room", "bell", 8, 14, 4, 10),
            ("Roof Lantern", "storage", -1, 5, -11, -6),
            ("Maintenance Room", "workshop", -22, -14, 2, 10),
            ("Caretaker's Room", "bedroom", -13, -7, 4, 10),
            ("Roof Deck", "terrace", -24, 22, -11, 11),
        ],
        "doors": [
            ("x", 0, -18, 1.0), ("x", -11, -12.2, 1.0), ("x", -5, -7, 1.0),
            ("x", 4, 11, 1.2), ("y", 8, 7, 1.0), ("y", 5, 8, 1.2),
            ("x", 2, -18, 1.0), ("x", 4, -10, 1.0), ("y", -6, 6, 1.0),
            ("x", -6, 2, 1.0),
        ],
    },
]

# Local Poly Haven CC0 1K sets, joined by Scripts/PreparePolyHavenFurniture
# into Saved/ImportReady and imported once by PopulateGroundFloor.
MODEL_WIDTH = {
    "bookshelf": 138, "sofa": 245, "table": 210, "chair": 52,
    "armchair": 88, "bed": 155, "nightstand": 58, "round_table": 115,
    "vase": 26, "plant": 55, "oil_lamp": 24, "kettle": 31,
    "alarm_clock": 17, "wall_clock": 38, "tea_set": 32, "door": 100,
}

DISPLAY_NAME = {
    "bookshelf": "Bookcase", "sofa": "Settee", "table": "Table",
    "chair": "Chair", "armchair": "Armchair", "bed": "Carved bed",
    "nightstand": "Bedside cabinet", "round_table": "Low table",
    "vase": "Ceramic vase", "plant": "Potted palm", "oil_lamp": "Oil lamp",
    "kettle": "Kettle", "alarm_clock": "Alarm clock", "wall_clock": "Wall clock",
    "tea_set": "Tea service",
}

ROOM_NOTE = {
    "bedroom": "The bed is made and the drawers are shut. Nothing in this room has been moved in a very long time.",
    "dressing": "The dressing room still faces the mirror. The jewelry box on the cabinet is empty, and its lid will not stay shut.",
    "bath": "The bath is dry. A pale ring marks where the basin always overflowed.",
    "living": "The chairs are angled towards a conversation that ended mid-sentence.",
    "study": "Ledgers and loose leaves are stacked by a chair that has been pushed away from the desk.",
    "corridor": "The corridor keeps the traffic pattern of the house: everything on the walls, nothing on the floor.",
    "storage": "The shelving is packed with what the family never threw away and never used again.",
    "generator": "The generator room smells of old fuel. Tools are laid out as if the repair was interrupted.",
    "workshop": "Bench, tools, and a half-finished repair. The vice is still wound tight.",
    "tunnel": "The tunnel mouth is damp. Fresh scuffs disturb the dust near the far wall.",
    "foyer": "The hall is kept clear for passing through — everything ornamental is pushed to the edges.",
    "gallery": "The gallery is hung for looking, not for living. The chairs face the walls.",
    "chapel": "Two chairs and a lamp face the wall where the icon once hung. The outline remains.",
    "music": "The table stands ready for a game that never finished. One cue rests off the rail.",
    "observatory": "Instruments are shuttered and the charts are rolled. Something up here was meant to watch the sky.",
    "bell": "The clockworks are stopped between two strikes. The bell rope has been cut short.",
}


def vec(x, y, z):
    return unreal.Vector(float(x), float(y), float(z))


def set_editor_any(obj, names, value):
    last = None
    for name in names:
        try:
            obj.set_editor_property(name, value)
            return name
        except Exception as exc:
            last = exc
    raise RuntimeError("Could not set %s (%s)" % (", ".join(names), last))


def set_rel_loc(component, location):
    try:
        component.set_relative_location(location, False, True)
        return
    except Exception:
        pass
    try:
        component.set_relative_location(location, False)
        return
    except Exception:
        component.set_editor_property("relative_location", location)


def set_actor_loc(actor, location):
    try:
        actor.set_actor_location(location, False, True)
        return
    except Exception:
        pass
    actor.set_actor_location(location, False)


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


# --- materials -------------------------------------------------------------
# The three surfaces the ground-floor pass already made are reused as-is;
# the four sets below are the upper storeys' own: wallpapered private floors,
# the stone roof level, and the cellar's render and concrete.
NEW_SURFACES = [
    ("M_SILID_DecrepitWallpaper", [
        ("decrepit_wallpaper/decrepit_wallpaper_diff_1k.jpg", False, False, unreal.MaterialProperty.MP_BASE_COLOR, "RGB", -250),
        ("decrepit_wallpaper/decrepit_wallpaper_nor_gl_1k.jpg", True, False, unreal.MaterialProperty.MP_NORMAL, "RGB", 0),
        ("decrepit_wallpaper/decrepit_wallpaper_rough_1k.jpg", False, True, unreal.MaterialProperty.MP_ROUGHNESS, "R", 250),
    ], 5.0, 2.0),
    ("M_SILID_StoneWall", [
        ("estate/plaster_stone_wall_02_diff_1k.jpg", False, False, unreal.MaterialProperty.MP_BASE_COLOR, "RGB", -250),
        ("estate/plaster_stone_wall_02_nor_gl_1k.jpg", True, False, unreal.MaterialProperty.MP_NORMAL, "RGB", 0),
        ("estate/plaster_stone_wall_02_rough_1k.jpg", False, True, unreal.MaterialProperty.MP_ROUGHNESS, "R", 250),
    ], 3.0, 3.0),
    ("M_SILID_BasementRender", [
        ("concrete_wall_003/concrete_wall_003_diff_1k.jpg", False, False, unreal.MaterialProperty.MP_BASE_COLOR, "RGB", -250),
        ("concrete_wall_003/concrete_wall_003_nor_gl_1k.jpg", True, False, unreal.MaterialProperty.MP_NORMAL, "RGB", 0),
        ("concrete_wall_003/concrete_wall_003_rough_1k.jpg", False, True, unreal.MaterialProperty.MP_ROUGHNESS, "R", 250),
    ], 4.0, 2.0),
    ("M_SILID_ConcreteFloor", [
        ("concrete_floor_worn_001/concrete_floor_worn_001_diff_1k.jpg", False, False, unreal.MaterialProperty.MP_BASE_COLOR, "RGB", -250),
        ("concrete_floor_worn_001/concrete_floor_worn_001_nor_gl_1k.jpg", True, False, unreal.MaterialProperty.MP_NORMAL, "RGB", 0),
        ("concrete_floor_worn_001/concrete_floor_worn_001_rough_1k.jpg", False, True, unreal.MaterialProperty.MP_ROUGHNESS, "R", 250),
    ], 4.0, 4.0),
]


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
    for filename, normal, linear, prop, channel, y in maps:
        texture = import_texture(
            name + ("_N" if normal else "_R" if linear else "_D"),
            filename, normal=normal, linear=linear,
        )
        sample = editor.create_material_expression(
            material, unreal.MaterialExpressionTextureSample, -400, y
        )
        sample.set_editor_property("texture", texture)
        editor.connect_material_expressions(coords, "", sample, "Coordinates")
        if not editor.connect_material_property(sample, channel, prop):
            raise RuntimeError("Could not connect " + filename + " to " + name)
    editor.recompile_material(material)
    unreal.EditorAssetLibrary.save_loaded_asset(material)
    return material


def ensure_materials():
    surfaces = {
        "wood": unreal.load_asset(TEXTURE_DESTINATION + "/M_SILID_AgedOakFloor.M_SILID_AgedOakFloor"),
        "plaster": unreal.load_asset(TEXTURE_DESTINATION + "/M_SILID_AgedPlaster.M_SILID_AgedPlaster"),
        "tile": unreal.load_asset(TEXTURE_DESTINATION + "/M_SILID_CourtyardStone.M_SILID_CourtyardStone"),
        "wallpaper": unreal.load_asset(TEXTURE_DESTINATION + "/M_SILID_DecrepitWallpaper.M_SILID_DecrepitWallpaper"),
        "stone": unreal.load_asset(TEXTURE_DESTINATION + "/M_SILID_StoneWall.M_SILID_StoneWall"),
        "conc_wall": unreal.load_asset(TEXTURE_DESTINATION + "/M_SILID_BasementRender.M_SILID_BasementRender"),
        "conc_floor": unreal.load_asset(TEXTURE_DESTINATION + "/M_SILID_ConcreteFloor.M_SILID_ConcreteFloor"),
    }
    for name, maps, u, v in NEW_SURFACES:
        if not surfaces.get(name.replace("M_SILID_", "").lower()) and not unreal.load_asset(TEXTURE_DESTINATION + "/" + name + "." + name):
            textured_material(name, maps, u, v)
    # Re-resolve after creation.
    surfaces["wallpaper"] = unreal.load_asset(TEXTURE_DESTINATION + "/M_SILID_DecrepitWallpaper.M_SILID_DecrepitWallpaper")
    surfaces["stone"] = unreal.load_asset(TEXTURE_DESTINATION + "/M_SILID_StoneWall.M_SILID_StoneWall")
    surfaces["conc_wall"] = unreal.load_asset(TEXTURE_DESTINATION + "/M_SILID_BasementRender.M_SILID_BasementRender")
    surfaces["conc_floor"] = unreal.load_asset(TEXTURE_DESTINATION + "/M_SILID_ConcreteFloor.M_SILID_ConcreteFloor")
    missing = [k for k, v in surfaces.items() if not v]
    if missing:
        raise RuntimeError("Missing materials: " + ", ".join(missing))
    return surfaces


# --- plan geometry ---------------------------------------------------------
def room_sides_at(rooms, orientation, coord, along):
    eps = 0.03
    if orientation == "x":
        probes = ((along, coord + eps), (along, coord - eps))
    else:
        probes = ((coord + eps, along), (coord - eps, along))
    sides = set()
    for px, py in probes:
        inside = any(r[2] <= px <= r[3] and r[4] <= py <= r[5] for r in rooms)
        sides.add(inside)
    return sides


def is_exterior_run(rooms, orientation, coord, along):
    sides = room_sides_at(rooms, orientation, coord, along)
    return True not in sides or False not in sides


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
        if a > cursor:
            pieces.append((cursor, a))
        cursor = max(cursor, b)
    if hi > cursor:
        pieces.append((cursor, hi))
    return pieces


def window_spans(level, orientation, coord, lo, hi, doors):
    if not level["windows"]:
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
    for center in candidates:
        a, b = center - WINDOW_W / 200.0, center + WINDOW_W / 200.0
        if a < lo + 0.3 or b > hi - 0.3:
            continue
        if any(not (b + 0.15 < d0 or a - 0.15 > d1) for d0, d1 in doors):
            continue
        if not is_exterior_run(level["rooms"], orientation, coord, center):
            continue
        spans.append((a, b))
    return spans


def unique_edges(rooms):
    edges = set()
    for r in rooms:
        _, _, x0, x1, y0, y1 = r
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


def rect_pieces(x0, x1, y0, y1, holes):
    """Split a room rectangle around the shaft/courtyard voids it covers."""
    pieces = []
    hs = sorted(
        [h for h in holes if h[0] < x1 and h[1] > x0 and h[2] < y1 and h[3] > y0],
        key=lambda h: h[0],
    )
    cursor = x0
    for hx0, hx1, hy0, hy1 in hs:
        hx0, hx1 = max(hx0, x0), min(hx1, x1)
        if hx0 > cursor:
            pieces.append((cursor, hx0, y0, y1))
        hy0, hy1 = max(hy0, y0), min(hy1, y1)
        if hy0 > y0:
            pieces.append((hx0, hx1, y0, hy0))
        if hy1 < y1:
            pieces.append((hx0, hx1, hy1, y1))
        cursor = max(cursor, hx1)
    if cursor < x1:
        pieces.append((cursor, x1, y0, y1))
    return [p for p in pieces if p[1] - p[0] > 0.05 and p[3] - p[2] > 0.05]


# --- storey builders -------------------------------------------------------
def build_floors(subsystem, cube, level, materials):
    mat = materials[level["floor"]]
    count = 0
    for name, kind, x0, x1, y0, y1 in level["rooms"]:
        for i, (px0, px1, py0, py1) in enumerate(rect_pieces(x0, x1, y0, y1, level["holes"])):
            spawn_box(
                subsystem, cube,
                "SILID - %s - Floor - %s%s" % (level["id"], name, "" if i == 0 else " %d" % (i + 1)),
                ((px0 + px1) * 50, (py0 + py1) * 50, level["base"] - FLOOR_T / 2),
                ((px1 - px0) * CM, (py1 - py0) * CM, FLOOR_T),
                mat,
            )
            count += 1
    return count


def build_walls(subsystem, cube, level, materials):
    mat = materials[level["wall"]]
    base, height = level["base"], level["height"]
    walls = headers = windows = 0
    for axis, coord, lo, hi in unique_edges(level["rooms"]):
        doors_here = door_spans_on(level["doors"], axis, coord, lo, hi)
        for a, b in subtract_spans(lo, hi, doors_here):
            if (b - a) * CM < 5:
                continue
            spans = window_spans(level, axis, coord, a, b, doors_here)
            if spans:
                windows += len(spans)
                bands = (
                    (0.0, WINDOW_SILL, None),
                    (min(WINDOW_HEAD, height - 10), height, None),
                    (WINDOW_SILL, min(WINDOW_HEAD, height - 10), spans),
                )
                for z0, z1, band in bands:
                    runs = subtract_spans(a, b, band) if band else [(a, b)]
                    for ra, rb in runs:
                        run_len = (rb - ra) * CM
                        if run_len < 5 or z1 <= z0:
                            continue
                        if axis == "x":
                            center = ((ra + rb) * 50, coord * CM, base + (z0 + z1) / 2)
                            size = (run_len, WALL_T, z1 - z0)
                        else:
                            center = (coord * CM, (ra + rb) * 50, base + (z0 + z1) / 2)
                            size = (WALL_T, run_len, z1 - z0)
                        spawn_box(
                            subsystem, cube,
                            "SILID - %s - Wall %03d" % (level["id"], walls + 1),
                            center, size, mat,
                        )
                walls += 1
                continue
            if axis == "x":
                center = ((a + b) * 50, coord * CM, base + height / 2)
                size = ((b - a) * CM, WALL_T, height)
            else:
                center = (coord * CM, (a + b) * 50, base + height / 2)
                size = (WALL_T, (b - a) * CM, height)
            spawn_box(subsystem, cube, "SILID - %s - Wall %03d" % (level["id"], walls + 1), center, size, mat)
            walls += 1

    # The band above every doorway, sized to the storey, closes the opening
    # from the lintel to the ceiling line.
    for axis, coord, along, width in level["doors"]:
        span = width * CM
        band_h = height - DOOR_HEAD
        if band_h < 20:
            continue
        if axis == "x":
            center = (along * CM, coord * CM, base + (DOOR_HEAD + height) / 2)
            size = (span, WALL_T, band_h)
        else:
            center = (coord * CM, along * CM, base + (DOOR_HEAD + height) / 2)
            size = (WALL_T, span, band_h)
        spawn_box(subsystem, cube, "SILID - %s - Door Head" % level["id"], center, size, mat)
        headers += 1
    return walls, headers, windows


def build_ceiling(subsystem, cube, level, materials):
    """F4 only: a roof over every top-floor room, open over the deck."""
    if not level["ceiling"]:
        return 0
    count = 0
    for name, kind, x0, x1, y0, y1 in level["rooms"]:
        if kind == "terrace":
            continue  # the deck itself is open to the sky
        top = level["base"] + level["height"]
        for i, (px0, px1, py0, py1) in enumerate(rect_pieces(x0, x1, y0, y1, level["holes"])):
            spawn_box(
                subsystem, cube,
                "SILID - %s - Roof - %s" % (level["id"], name),
                ((px0 + px1) * 50, (py0 + py1) * 50, top + FLOOR_T / 2),
                ((px1 - px0) * CM, (py1 - py0) * CM, FLOOR_T),
                materials["plaster"],
            )
            count += 1
    return count


def get_mesh_index():
    try:
        with open(INDEX_FILE, "r", encoding="utf-8") as stream:
            result = json.load(stream)
        return result if isinstance(result, dict) else {}
    except (OSError, ValueError):
        return {}


def save_mesh_index(index):
    os.makedirs(os.path.dirname(INDEX_FILE), exist_ok=True)
    with open(INDEX_FILE, "w", encoding="utf-8") as stream:
        json.dump(index, stream, indent=2)


def static_mesh_from_path(path):
    asset = unreal.load_asset(path)
    return asset if isinstance(asset, unreal.StaticMesh) else None


def import_model_mesh(key, index, tools):
    if key in index:
        mesh = static_mesh_from_path(index[key])
        if mesh and ("sm_silid_" + key.lower()) in mesh.get_name().lower():
            return mesh
    needle = ("SM_SILID_" + key).lower()
    for path in unreal.EditorAssetLibrary.list_assets(DEST, recursive=True, include_folder=False):
        if needle in path.lower():
            mesh = static_mesh_from_path(path)
            if mesh:
                index[key] = mesh.get_path_name()
                return mesh
    source = os.path.join(PREPARED_ROOT, "SILID_" + key + ".glb")
    if not os.path.isfile(source):
        raise RuntimeError("Prepared furniture model missing: " + source)
    task = unreal.AssetImportTask()
    task.filename = source
    task.destination_path = DEST
    task.destination_name = "SM_SILID_" + key
    task.automated = True
    task.replace_existing = False
    task.save = True
    tools.import_asset_tasks([task])
    for object_path in list(task.imported_object_paths or []):
        mesh = static_mesh_from_path(object_path)
        if mesh:
            index[key] = mesh.get_path_name()
            return mesh
    raise RuntimeError("Unreal did not produce a StaticMesh for " + key)


# --- doors -----------------------------------------------------------------
def spawn_doors(subsystem, door_class, cube, wood, door_mesh, level):
    created = 0
    base = level["base"]
    lid = level["id"].lower()
    for i, (axis, wall, along, width_m) in enumerate(level["doors"]):
        width = width_m * 100.0
        if axis == "x":
            hinge_x, hinge_y, yaw = (along - width_m / 2.0) * 100.0, wall * 100.0, 0.0
            hinge_loc = vec(hinge_x, hinge_y, base + 110.0)
            far_offset = vec(width, 0, 0)
        else:
            hinge_x, hinge_y, yaw = wall * 100.0, (along - width_m / 2.0) * 100.0, 90.0
            hinge_loc = vec(hinge_x, hinge_y, base + 110.0)
            far_offset = vec(0, width, 0)
        door = subsystem.spawn_actor_from_class(door_class, hinge_loc, unreal.Rotator(0, yaw, 0))
        if not door:
            raise RuntimeError("Could not spawn %s door %02d" % (level["id"], i + 1))
        door.set_actor_label("SILID - %s - Door %02d" % (level["id"], i + 1))
        door.set_editor_property("save_id", unreal.Name("%s.door.%02d" % (lid, i + 1)))
        frame = door.get_editor_property("frame_mesh")
        leaf = door.get_editor_property("leaf_pivot")
        frame.set_static_mesh(cube)
        frame.set_material(0, wood)
        frame.set_relative_scale3d(vec(0.13, 0.13, 2.2))
        leaf.set_static_mesh(door_mesh)
        leaf.set_material(0, wood)
        set_rel_loc(leaf, vec(width / 2.0, 0, -4))
        leaf.set_relative_scale3d(vec(width / 100.0, 1.0, 1.0))
        jamb = subsystem.spawn_actor_from_object(cube, hinge_loc + far_offset, unreal.Rotator(0, yaw, 0))
        if jamb:
            jamb.set_actor_label("SILID - %s - Door Jamb %02d" % (level["id"], i + 1))
            jamb.set_actor_scale3d(vec(0.13, 0.13, 2.2))
            jamb.get_component_by_class(unreal.StaticMeshComponent).set_material(0, wood)
        lintel = subsystem.spawn_actor_from_object(cube, hinge_loc + far_offset * 0.5 + vec(0, 0, 108), unreal.Rotator(0, yaw, 0))
        if lintel:
            lintel.set_actor_label("SILID - %s - Door Lintel %02d" % (level["id"], i + 1))
            lintel.set_actor_scale3d(vec(width / 100.0 + 0.25, 0.11, 0.13))
            lintel.get_component_by_class(unreal.StaticMeshComponent).set_material(0, wood)
        created += 1
    return created


# --- the continuing dog-leg stair -----------------------------------------
def build_dogleg(subsystem, cube, wood, level_id, base, rise_cm, prefix):
    """One storey of the plan's stair: lane A south, landing, lane B north.

    Identical footprint on every floor (plan.js STAIR), so the flights stack
    into one tower and each storey's stair enters and leaves at the north
    edge of the shaft, on solid floor.
    """
    run_cm = 310.0
    steps = 10
    tread_d = run_cm / steps
    tread_w = 82.0
    flights = [(-4.41, 9.20, -1, base), (-2.87, 6.10, 1, base + rise_cm / 2.0)]
    for fi, (flight_x, start_y, direction, z0) in enumerate(flights):
        pitch = math.degrees(math.atan2(rise_cm, run_cm))
        yaw = 90.0 if direction > 0 else -90.0
        sloped = math.sqrt(rise_cm * rise_cm + run_cm * run_cm)
        mid_y = (start_y + direction * run_cm / 200.0) * CM
        mid_z = z0 + rise_cm / 2.0
        beam_rotation = unreal.Rotator(pitch, yaw, 0.0)
        for i in range(steps):
            top_z = z0 + (i + 1) * (rise_cm / steps)
            step_y = (start_y + direction * (i + 0.5) * tread_d / CM) * CM
            spawn_box(
                subsystem, cube,
                "%s - Flight %d - Tread %02d" % (prefix, fi + 1, i + 1),
                (flight_x * CM, step_y, top_z - 2.5),
                (tread_w, tread_d, 5.0), wood,
            )
        for side in (-1, 1):
            side_x = flight_x * CM + side * 44.0
            spawn_box(
                subsystem, cube,
                "%s - Flight %d - Stringer %d" % (prefix, fi + 1, side),
                (side_x, mid_y, mid_z - 7.0),
                (sloped, 11.0, 23.0), wood, beam_rotation,
            )
            spawn_box(
                subsystem, cube,
                "%s - Flight %d - Handrail %d" % (prefix, fi + 1, side),
                (side_x, mid_y, mid_z + 88.0),
                (sloped + 10.0, 9.0, 10.0), wood, beam_rotation,
            )
            for i in range(0, steps, 2):
                top_z = z0 + (i + 1) * (rise_cm / steps)
                post_y = (start_y + direction * (i + 0.5) * tread_d / CM) * CM
                spawn_box(
                    subsystem, cube,
                    "%s - Flight %d - Baluster %d - %02d" % (prefix, fi + 1, side, i + 1),
                    (side_x, post_y, top_z + 43.0),
                    (5.0, 5.0, 80.0), wood,
                )
    spawn_box(
        subsystem, cube, prefix + " - Landing",
        (-3.64 * CM, 5.175 * CM, base + rise_cm / 2.0 - 9.0),
        (266.0, 185.0, 18.0), wood,
    )


def build_shaft_rails(subsystem, cube, wood, level_id, base, prefix):
    """Balustrade on three edges of the shaft; the north edge stays open
    because that is where each flight arrives at floor level."""
    top = base + 80.0
    for x, tag in ((-5.1, "West"), (-2.0, "East")):
        for i, y in enumerate((4.4, 5.6, 6.8, 8.0, 9.0)):
            spawn_box(
                subsystem, cube,
                "%s - Rail %s Post %d" % (prefix, tag, i + 1),
                (x * CM, y * CM, base + 36.0), (5.0, 5.0, 78.0), wood,
            )
        spawn_box(
            subsystem, cube, "%s - Rail %s" % (prefix, tag),
            (x * CM, 6.7 * CM, top + 4.0), (9.0, 475.0, 10.0), wood,
        )
    for i, x in enumerate((-4.82, -4.23, -3.64, -3.05, -2.46)):
        spawn_box(
            subsystem, cube,
            "%s - Rail South Post %d" % (prefix, i + 1),
            (x * CM, 4.35 * CM, base + 36.0), (5.0, 5.0, 78.0), wood,
        )
    spawn_box(
        subsystem, cube, prefix + " - Rail South",
        (-3.64 * CM, 4.35 * CM, top + 4.0), (266.0, 9.0, 10.0), wood,
    )


# --- the straight cellar flight -------------------------------------------
def build_basement_stair(subsystem, cube, wood):
    """GF floor to cellar through plan.js STAIR.basementHole: twenty 17 cm
    risers down a 4.85 m run, landing flush on the basement landing."""
    steps = 20
    run = (BASEMENT_HOLE[3] - BASEMENT_HOLE[2]) * CM / steps   # 24.25 cm
    drop = 340.0 / steps                                       # 17 cm
    cx = (BASEMENT_HOLE[0] + BASEMENT_HOLE[1]) / 2 * CM
    for i in range(steps):
        top_z = -(i + 1) * drop
        y = (BASEMENT_HOLE[3] - (i + 0.5) * run / CM) * CM
        spawn_box(
            subsystem, cube,
            "SILID - Basement Stair - Tread %02d" % (i + 1),
            (cx, y, top_z - 2.5), (236.0, run, 5.0), wood,
        )
    pitch = math.degrees(math.atan2(340.0, 485.0))
    sloped = math.sqrt(340.0 * 340.0 + 485.0 * 485.0)
    mid_y = (BASEMENT_HOLE[2] + BASEMENT_HOLE[3]) / 2 * CM
    for side in (-1, 1):
        spawn_box(
            subsystem, cube,
            "SILID - Basement Stair - Stringer %d" % side,
            (cx + side * 115.0, mid_y, -184.0),
            (sloped, 11.0, 23.0), wood, unreal.Rotator(pitch, 90.0, 0.0),
        )
    # The ground floor looks straight down the shaft past the opening, so
    # three of its four edges take a rail; the south edge is the entry.
    for x, tag in ((-16.8, "West"), (-14.6, "East")):
        for i, y in enumerate((-10.7, -9.5, -8.3, -7.1)):
            spawn_box(
                subsystem, cube,
                "SILID - Basement Well - Rail %s Post %d" % (tag, i + 1),
                (x * CM, y * CM, 36.0), (5.0, 5.0, 78.0), wood,
            )
        spawn_box(
            subsystem, cube, "SILID - Basement Well - Rail %s" % tag,
            (x * CM, -8.4 * CM, 84.0), (9.0, 470.0, 10.0), wood,
        )
    for i, x in enumerate((-16.75, -15.9, -15.05)):
        spawn_box(
            subsystem, cube,
            "SILID - Basement Well - Rail South Post %d" % (i + 1),
            (x * CM, -10.8 * CM, 36.0), (5.0, 5.0, 78.0), wood,
        )
    spawn_box(
        subsystem, cube, "SILID - Basement Well - Rail South",
        (-15.7 * CM, -10.8 * CM, 84.0), (235.0, 9.0, 10.0), wood,
    )


# --- furnishing ------------------------------------------------------------
def fill_room(out, level_id, room_name, kind, x0, x1, y0, y1, avoid):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    hw, hh = (x1 - x0) / 2, (y1 - y0) / 2
    note = ROOM_NOTE.get(kind, "The room keeps the arrangement it was given and nothing has been straightened since.")

    def put(model, dx, dy, yaw=0, width=None, base_z=0, toggle=False):
        w = width if width is not None else MODEL_WIDTH[model]
        if min(x1 - x0, y1 - y0) < w / 100.0 + 0.3:
            return  # the room cannot hold this piece on its short side
        x = min(max(cx + dx, x0 + 0.15 + w / 200.0), x1 - 0.15 - w / 200.0)
        y = min(max(cy + dy, y0 + 0.15 + w / 200.0), y1 - 0.15 - w / 200.0)
        for hx0, hx1, hy0, hy1 in avoid:
            if hx0 - 0.25 <= x <= hx1 + 0.25 and hy0 - 0.25 <= y <= hy1 + 0.25:
                if hy1 + 0.6 < y1 - 0.2:
                    y = hy1 + 0.6
                elif hy0 - 0.6 > y0 + 0.2:
                    y = hy0 - 0.6
                else:
                    return  # no safe side of the shaft in this room
        out.append({
            "level": level_id, "room": room_name, "model": model,
            "display": DISPLAY_NAME.get(model, model.title()),
            "x": x, "y": y, "yaw": yaw, "width": w,
            "base_z": base_z, "toggle": toggle,
            "description": DISPLAY_NAME.get(model, model.title()) + " — " + note,
        })

    if kind == "terrace":
        return  # the open deck is dressed by the rooms standing on it
    if kind == "bedroom":
        put("bed", 0, -hh + 1.05)
        put("nightstand", -1.15, -hh + 1.35)
        put("nightstand", 1.15, -hh + 1.35)
        put("oil_lamp", -1.3, -hh + 1.35, base_z=72, toggle=True)
        put("alarm_clock", -1.0, -hh + 1.35, base_z=82)
        put("armchair", hw - 0.9, -0.2, yaw=-90)
        put("plant", -hw + 0.6, hh - 0.8)
        put("vase", hw - 0.5, hh - 0.7)
        put("wall_clock", 0, hh - 0.25, yaw=180, base_z=185)
    elif kind == "dressing":
        put("nightstand", 0, -hh + 0.6)
        put("oil_lamp", -0.5, -hh + 0.6, base_z=72, toggle=True)
        put("plant", -hw + 0.6, hh - 0.7)
        put("vase", hw - 0.5, -hh + 0.6)
    elif kind == "bath":
        put("vase", 0, -hh + 0.5)
        put("plant", hw - 0.6, hh - 0.7)
        put("nightstand", -hw + 0.7, 0)
    elif kind == "living":
        put("sofa", 0, -hh + 1.1)
        put("armchair", -hw + 0.9, 0.4, yaw=90)
        put("armchair", hw - 0.9, 0.4, yaw=-90)
        put("round_table", 0, 0.3)
        put("tea_set", -0.25, 0.3, base_z=72)
        put("oil_lamp", 0.3, 0.3, base_z=72, toggle=True)
        put("plant", -hw + 0.6, hh - 0.7)
        put("vase", hw - 0.5, -hh + 0.7)
        put("wall_clock", 0, hh - 0.25, yaw=180, base_z=185)
    elif kind in ("study", "library"):
        put("bookshelf", -hw + 0.7, -0.7, yaw=90)
        put("bookshelf", -hw + 0.7, 0.7, yaw=90)
        put("bookshelf", hw - 0.7, 0.0, yaw=-90)
        put("table", 0, 0, width=178)
        put("armchair", -1.15, -0.9, yaw=45)
        put("armchair", 1.15, -0.9, yaw=-45)
        put("oil_lamp", 0.2, 0, base_z=98, toggle=True)
        put("vase", -0.6, 0, base_z=98)
        put("plant", hw - 0.7, hh - 0.7)
        put("wall_clock", 0, hh - 0.25, yaw=180, base_z=185)
    elif kind == "corridor":
        put("round_table", 0, 0, width=78)
        put("oil_lamp", 0, 0, base_z=100, toggle=True)
        put("plant", -(hw - 0.6), 0)
        put("vase", hw - 0.6, 0)
    elif kind == "foyer":
        put("round_table", 0, hh - 1.5, width=100)
        put("oil_lamp", 0, hh - 1.5, base_z=100, toggle=True)
        put("armchair", -(hw - 0.9), hh - 2.4, yaw=90)
        put("armchair", hw - 0.9, hh - 2.4, yaw=-90)
        put("plant", -hw + 0.7, -hh + 0.8)
        put("vase", hw - 0.6, -hh + 0.8)
        put("wall_clock", 0, hh - 0.3, yaw=180, base_z=200)
    elif kind == "gallery":
        put("vase", -hw + 0.6, 0)
        put("vase", hw - 0.6, 0)
        put("plant", 0, -hh + 0.7)
        put("armchair", 0, 0.6, yaw=180)
        put("round_table", 0, -0.6, width=70)
        put("oil_lamp", 0, -0.6, base_z=70, toggle=True)
    elif kind == "chapel":
        put("armchair", 0, -0.8, yaw=180)
        put("armchair", -1.0, 0.7, yaw=90)
        put("oil_lamp", 0, -0.8, base_z=90, toggle=True)
        put("vase", -hw + 0.6, hh - 0.7)
        put("plant", hw - 0.7, -hh + 0.7)
    elif kind == "music":
        put("table", 0, 0, width=210)
        put("chair", -1.7, 0, yaw=90)
        put("chair", 1.7, 0, yaw=-90)
        put("oil_lamp", -hw + 0.8, 0, base_z=90, toggle=True)
        put("wall_clock", 0, hh - 0.25, yaw=180, base_z=185)
    elif kind == "observatory":
        put("table", 0, 0, width=140)
        put("chair", 1.1, 0, yaw=-90)
        put("oil_lamp", -0.5, 0, base_z=74, toggle=True)
        put("vase", 0.5, 0, base_z=74)
        put("plant", -hw + 0.7, hh - 0.7)
    elif kind == "bell":
        put("table", 0, -0.4, width=140)
        put("nightstand", -hw + 0.7, hh - 0.7)
        put("oil_lamp", -0.3, -0.4, base_z=82, toggle=True)
        put("vase", hw - 0.6, -hh + 0.7)
    elif kind in ("generator", "workshop"):
        put("table", 0, -0.4, width=150)
        put("chair", 1.2, -0.4, yaw=-90)
        put("nightstand", -hw + 0.7, hh - 0.7)
        put("kettle", 0.3, -0.4, base_z=82, toggle=True)
        put("oil_lamp", -0.3, -0.4, base_z=82, toggle=True)
        put("vase", -hw + 0.6, -hh + 0.6)
    elif kind == "storage":
        put("bookshelf", -hw + 0.7, 0, yaw=90)
        put("bookshelf", hw - 0.7, 0, yaw=-90)
        put("vase", 0, -hh + 0.7)
        put("kettle", 0, hh - 0.7, base_z=0)
        put("oil_lamp", 0, 0, base_z=96, toggle=True)
    elif kind == "tunnel":
        put("oil_lamp", 0, 0, base_z=120, toggle=True)
        put("vase", -1.5, 0)
    else:
        put("oil_lamp", 0, 0, base_z=90, toggle=True)
        put("plant", -hw + 0.6, hh - 0.7)
        put("vase", hw - 0.5, -hh + 0.6)


PROP_COUNTER = [0]


def spawn_prop(subsystem, prop_class, mesh, entry, level_base):
    x, y = entry["x"] * 100.0, entry["y"] * 100.0
    PROP_COUNTER[0] += 1
    actor = subsystem.spawn_actor_from_class(
        prop_class, vec(x, y, level_base), unreal.Rotator(0, entry["yaw"], 0)
    )
    if not actor:
        raise RuntimeError("Failed to spawn " + entry["display"])
    actor.set_actor_label(
        "SILID - %s - Prop - %s - %s" % (entry["level"], entry["room"], entry["display"])
    )
    component = actor.get_editor_property("mesh")
    component.set_static_mesh(mesh)
    low, high = component.get_local_bounds()
    center = (low + high) * 0.5
    extent = (high - low) * 0.5
    collider = actor.get_editor_property("focus_collider")
    collider.set_box_extent(vec(max(extent.x, 10) + 4, max(extent.y, 10) + 4, max(extent.z, 10) + 4))
    set_rel_loc(collider, center)
    size_x, size_y = high.x - low.x, high.y - low.y
    horizontal = max(size_x, size_y)
    if horizontal < 1:
        raise RuntimeError("Invalid dimensions for imported model: " + entry["display"])
    scale = entry["width"] / horizontal
    actor.set_actor_scale3d(vec(scale, scale, scale))
    set_actor_loc(actor, vec(x, y, level_base + entry["base_z"] - low.z * scale))
    set_editor_any(actor, ("display_name", "DisplayName"), unreal.Text(entry["display"]))
    set_editor_any(actor, ("examine_description", "ExamineDescription"), unreal.Text(entry["description"]))
    set_editor_any(actor, ("toggleable", "b_toggleable", "bToggleable"), bool(entry["toggle"]))
    set_editor_any(actor, ("starts_on", "b_starts_on", "bStartsOn"), False)
    set_editor_any(actor, ("save_id", "SaveId"), unreal.Name(
        "%s.prop.%04d" % (entry["level"].lower(), PROP_COUNTER[0])
    ))
    if entry["toggle"]:
        practical = actor.get_editor_property("practical_light")
        set_rel_loc(practical, vec(0, 0, max(65, entry["width"] * 0.7)))
        practical.set_editor_property("light_color", unreal.Color(r=255, g=183, b=111, a=255))
        practical.set_intensity(620.0)
        practical.set_attenuation_radius(420.0)
    return actor


CLEAN_PREFIXES = (
    "SILID - B1 ", "SILID - F2 ", "SILID - F3 ", "SILID - F4 ",
    "SILID - Basement Stair", "SILID - Basement Well",
    "SILID - NavMesh Bounds",
)


def main():
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    cube = unreal.load_asset("/Engine/BasicShapes/Cube")
    if not cube:
        raise RuntimeError("Unreal's built-in Cube mesh could not be loaded.")
    prop_class = unreal.load_class(None, PROP_CLASS_PATH)
    door_class = unreal.load_class(None, DOOR_CLASS_PATH)
    if not prop_class or not door_class:
        raise RuntimeError("SILID C++ classes missing — build SILIDEditor first.")
    surfaces = ensure_materials()
    wood = surfaces["wood"]

    # Rerunnable: remove only this script's own prior actors.
    for actor in list(subsystem.get_all_level_actors()):
        label = actor.get_actor_label()
        if label.startswith(CLEAN_PREFIXES):
            subsystem.destroy_actor(actor)

    door_mesh = None
    index = get_mesh_index()
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    meshes = {}
    placements = []
    door_total = 0
    wall_total = floor_total = window_total = roof_total = 0

    for level in LEVELS:
        floor_total += build_floors(subsystem, cube, level, surfaces)
        walls, headers, windows = build_walls(subsystem, cube, level, surfaces)
        wall_total += walls
        window_total += windows
        roof_total += build_ceiling(subsystem, cube, level, surfaces)

        # Furniture first so the stair shaft can push pieces off the void.
        before = len(placements)
        for name, kind, x0, x1, y0, y1 in level["rooms"]:
            fill_room(placements, level["id"], name, kind, x0, x1, y0, y1, level["holes"])
        # The continuing dog-leg rises to the NEXT storey: F2 climbs to F3,
        # F3 climbs to F4, and the roof level gets no upward flight — only
        # the shaft rails around the hole the F3 stair arrives through.
        if level["id"] in ("F2", "F3"):
            prefix = "SILID - %s - Stair" % level["id"]
            build_dogleg(subsystem, cube, wood, level["id"], level["base"], level["height"], prefix)
        if level["id"] != "B1":
            build_shaft_rails(subsystem, cube, wood, level["id"], level["base"], "SILID - %s" % level["id"])

        # Door actors (frames/jambs/lintels) need the shared door mesh.
        if door_mesh is None:
            door_mesh = import_model_mesh("door", index, tools)
            if not door_mesh:
                raise RuntimeError("The panelled door mesh could not be imported.")
        door_total += spawn_doors(subsystem, door_class, cube, wood, door_mesh, level)

        # Props for this level, imported from the same prepared GLB set the
        # ground floor uses (already in the index after PopulateGroundFloor).
        for key in sorted({e["model"] for e in placements[before:]}):
            if key not in meshes:
                meshes[key] = import_model_mesh(key, index, tools)
        for entry in placements[before:]:
            spawn_prop(subsystem, prop_class, meshes[entry["model"]], entry, level["base"])

    save_mesh_index(index)
    build_basement_stair(subsystem, cube, wood)

    # One nav volume for the whole house so the Resident can path across all
    # five storeys once the AI is placed in the level.
    nav = subsystem.spawn_actor_from_class(
        unreal.NavMeshBoundsVolume, vec(-100, 0, 550), unreal.Rotator(0, 0, 0)
    )
    if nav:
        nav.set_actor_label("SILID - NavMesh Bounds")
        nav.set_actor_scale3d(vec(52, 34, 20))

    world = unreal.EditorLevelLibrary.get_editor_world()
    if not world:
        raise RuntimeError("The active Unreal world could not be read before saving.")
    saved = unreal.EditorLoadingAndSavingUtils.save_map(world, MAP_SAVE_PATH)
    if not saved:
        raise RuntimeError("Could not save the level to " + MAP_SAVE_PATH)
    map_file = os.path.join(ROOT, "ue5", "Content", "SILID", "Maps", "LM_SILID_GroundFloor.umap")
    if not unreal.EditorLoadingAndSavingUtils.load_map(map_file):
        raise RuntimeError("The level was saved but Unreal could not reopen " + map_file)
    unreal.log("[SILID storeys] floors=%d walls=%d windows=%d roofs=%d doors=%d props=%d saved=%s" % (
        floor_total, wall_total, window_total, roof_total, door_total, len(placements), saved
    ))
    print("SILID storeys built: %d floor boxes, %d walls, %d window openings, %d roof slabs, %d doors, %d props. Saved=%s" % (
        floor_total, wall_total, window_total, roof_total, door_total, len(placements), MAP_SAVE_PATH
    ))


main()
