"""Dress all 20 ground-floor rooms with local CC0 models and interactions.

Prerequisite: compile the SILID module after adding SILIDInspectableProp.
Run in Unreal Editor with Tools > Execute Python Script. The script imports
local 1K glTF props, is safe to rerun, and saves only after it builds a full
first-floor furnishing pass. All room coordinates are in metres from plan.js.
"""

import json
import os
import unreal


ROOT = r"C:\Users\Admin\Downloads\SILID-main"
PREPARED_ROOT = os.path.join(ROOT, "ue5", "Saved", "ImportReady")
DEST = "/Game/SILID/Furniture"
MAP_SAVE_PATH = "/Game/SILID/Maps/LM_SILID_GroundFloor"
INDEX_FILE = os.path.join(ROOT, "ue5", "Saved", "silid_furniture_mesh_index.json")
PROP_CLASS_PATH = "/Script/SILID.SILIDInspectableProp"
DOOR_CLASS_PATH = "/Script/SILID.SILIDDoor"
WOOD_MATERIAL = "/Game/SILID/Surfaces/M_SILID_AgedOakFloor.M_SILID_AgedOakFloor"
PLASTER_MATERIAL = "/Game/SILID/Surfaces/M_SILID_AgedPlaster.M_SILID_AgedPlaster"
TILE_MATERIAL = "/Game/SILID/Surfaces/M_SILID_CourtyardStone.M_SILID_CourtyardStone"
ITEM_PREFIX = "SILID - GF Item - "
DOOR_PREFIX = "SILID - GF Door - "
DETAIL_PREFIX = "SILID - GF Door Detail - "

MODEL_FILES = {
    "bookshelf": ("wooden_bookshelf_worn", 138),
    "sofa": ("painted_wooden_sofa", 245),
    "table": ("painted_wooden_table", 210),
    "chair": ("dining_chair_02", 52),
    "armchair": ("chinese_armchair", 88),
    "bed": ("GothicBed_01", 155),
    "nightstand": ("painted_wooden_nightstand", 58),
    "round_table": ("round_wooden_table_01", 115),
    "vase": ("antique_ceramic_vase_01", 26),
    "plant": ("potted_plant_01", 55),
    "oil_lamp": ("vintage_oil_lamp", 24),
    "kettle": ("vintage_electric_kettle", 31),
    "alarm_clock": ("alarm_clock_01", 17),
    "wall_clock": ("wall_clock", 38),
    "tea_set": ("tea_set_01", 32),
    "door": ("PanelledTimberDoor", 100),
}

# Exact authored ground-floor rooms from src/world/plan.js; bays and the long
# service hall are separate rooms with their own furniture identity.
ROOM_BOUNDS = {
    "Service Hall": (-17, -14, -11, 11),
    "Kitchen": (-24, -17, -11, -4),
    "Pantry": (-24, -17, -4, 0),
    "Laundry": (-24, -17, 0, 4),
    "Staff Room": (-24, -17, 4, 8),
    "Guest Room 1": (-24, -17, 8, 11),
    "Library / Study": (-14, -6, -11, -2),
    "Dining Room": (-6, 2, -11, -2),
    "Family Lounge": (2, 8, -11, -2),
    "Guest Room 3": (8, 14, -11, -5),
    "Wine Room": (14, 21, -11, -5),
    "Inner Courtyard": (8, 20, -5, 2),
    "Grand Hall": (-14, 8, -2, 2),
    "Formal Living Room": (-14, -5, 2, 11),
    "Foyer": (-5, 4, 2, 11),
    "Sitting Room": (4, 8, 2, 11),
    "Guest Room 4": (8, 21, 2, 11),
    "Front Drawing Room": (13.55, 20.45, 11, 14.45),
    "Sitting Bay": (5.55, 8, 11, 13.65),
    "Breakfast Room": (-5.6, 1.6, -14.7, -11),
}

# Door openings mirror plan.js. Doors are real ASILIDDoor actors with a swing
# leaf; their wood panels use the same aged-oak PBR material as the floor.
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


def assert_inside_room(room, x, y, margin=0.35):
    x0, x1, y0, y1 = ROOM_BOUNDS[room]
    if not (x0 + margin <= x <= x1 - margin and y0 + margin <= y <= y1 - margin):
        raise RuntimeError("Placement outside room %s: %.2f, %.2f" % (room, x, y))


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


def import_model_mesh(key, spec, index, tools):
    if key in index:
        mesh = static_mesh_from_path(index[key])
        if mesh and ("sm_silid_" + key.lower()) in mesh.get_name().lower():
            return mesh
    folder, width_cm = spec
    candidates = []
    asset_paths = unreal.EditorAssetLibrary.list_assets(DEST, recursive=True, include_folder=False)
    needle = ("SM_SILID_" + key).lower()
    for path in asset_paths:
        if needle in path.lower():
            mesh = static_mesh_from_path(path)
            if mesh:
                candidates.append(mesh)
    if not candidates:
        # Prefer texture-stripped GLBs to avoid Interchange deadlock on embedded
        # texture builds (tested 2026-11-02). Use stripped copies from
        # Saved/ImportReady/stripped/; geometry imports and materials are
        # assigned separately by the build scripts.
        source = os.path.join(PREPARED_ROOT, "stripped", "SILID_" + key + ".glb")
        if not os.path.isfile(source):
            source = os.path.join(PREPARED_ROOT, "SILID_" + key + ".glb")
        if not os.path.isfile(source):
            raise RuntimeError("Prepared complete furniture model missing; run Scripts/PreparePolyHavenFurniture.py first: " + source)
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
                candidates.append(mesh)
    if not candidates:
        raise RuntimeError("Unreal did not produce a StaticMesh for " + folder)
    # The Blender-prepared GLB has one joined mesh, retaining the complete
    # asset's node transforms and material slots instead of choosing one part.
    mesh = candidates[0]
    index[key] = mesh.get_path_name()
    return mesh


PLACEMENTS = []


def add_item(room, display, model, x, y, yaw=0, width=None, base_z=0, description=None, toggle=False):
    assert_inside_room(room, x, y, 0.12)
    if model not in MODEL_FILES:
        raise RuntimeError("Unknown furniture model: " + model)
    PLACEMENTS.append({
        "room": room, "display": display, "model": model, "x": x, "y": y,
        "yaw": yaw, "width": width or (MODEL_FILES[model][1] if model in MODEL_FILES else 100),
        "base_z": base_z, "toggle": toggle,
        "description": description or (display + " sits in the " + room.lower() + ". Its worn surface and careful placement belong to the house's former life."),
    })


def add_bedroom(room, cx, cy, bed_width=150, extra=True):
    add_item(room, "Carved bed", "bed", cx, cy, width=bed_width, yaw=0, description="The mattress is cold and slightly depressed at the centre. Dust has gathered in the carved headboard grooves.")
    add_item(room, "Left bedside cabinet", "nightstand", cx - 1.16, cy + 0.52, width=52, description="A narrow bedside cabinet with a shallow drawer that sticks in its runners.")
    add_item(room, "Right bedside cabinet", "nightstand", cx + 1.16, cy + 0.52, width=52, description="The cabinet's top is polished where a lamp once stood. A faint ring remains in the finish.")
    add_item(room, "Left bedside oil lamp", "oil_lamp", cx - 1.28, cy + 0.52, width=23, base_z=63, toggle=True, description="A brass oil lamp with soot trapped beneath the glass chimney. Its flame answers the switch, though no wick burns.")
    add_item(room, "Right bedside oil lamp", "oil_lamp", cx + 1.16, cy + 0.52, width=23, base_z=63, toggle=True, description="A matching oil lamp stands beside the bed. The glass is cloudy with old smoke.")
    add_item(room, "Bedside alarm clock", "alarm_clock", cx - 1.04, cy + 0.52, width=15, base_z=63, description="The alarm clock has stopped at 3:17. Its minute hand trembles when the room is quiet.")
    add_item(room, "Bedroom chair", "armchair", cx + 1.25, cy - 1.15, width=80, yaw=180, description="The chair faces the bed. The velvet is flattened on one side, as if someone sat there for a long time.")
    add_item(room, "Bedroom planter", "plant", cx - 1.1, cy - 1.55, width=48, description="A potted palm has survived in the dim room, its dry leaves brushing the wall.")
    if extra:
        add_item(room, "Floor vase", "vase", cx + 1.65, cy + 1.2, width=24, description="A hairline crack runs from the vase's rim to its foot. It has been turned to face the room.")


def add_salon(room, cx, cy, width=240, count=2, plants=1):
    add_item(room, "Aged settee", "sofa", cx - 0.7, cy + 1.0, width=width, yaw=180, description="The settee's faded upholstery smells faintly of damp wool. One cushion keeps its shape better than the others.")
    for i, sign in enumerate((-1, 1)[:count]):
        add_item(room, "Carved armchair %02d" % (i + 1), "armchair", cx + sign * 1.45, cy - 0.25, width=83, yaw=90 if sign < 0 else -90, description="A carved armchair is angled towards the centre of the room, not towards the windows.")
    add_item(room, "Low tea table", "round_table", cx, cy - 1.55, width=100, description="The tea table has a dark ring around its centre and fine scratches along the edge.")
    add_item(room, "Tea service", "tea_set", cx, cy - 1.55, width=38, base_z=72, description="A porcelain tea service has been set out for more people than the room contains.")
    add_item(room, "Floor oil lamp", "oil_lamp", cx + 1.2, cy - 1.1, width=24, base_z=0, toggle=True, description="The lamp's brass base is warm to the touch although the room is cold.")
    for i in range(plants):
        px = cx - (width / 100.0) * 0.45 if i % 2 == 0 else cx + (width / 100.0) * 0.45
        py = cy + 2.6 if i < 2 else cy - 2.5
        add_item(room, "Window-side palm %02d" % (i + 1), "plant", px, py, width=50, description="The palm leans away from the window as though the light outside has become unpleasant.")
    add_item(room, "Floor vase", "vase", cx - 1.55, cy + 2.2, width=25, description="A blue-and-white ceramic vase holds a dry stem that has not crumbled.")
    clock_y = cy + 4.35 if cy > 0 else cy + 4.15
    add_item(room, "Room wall clock", "wall_clock", cx, clock_y, yaw=180, width=36, base_z=185, description="The wall clock is wound, but its hands remain still. The pendulum moves once when you look away.")


def build_layout():
    # Service wing: deliberately practical, narrow and sparsely decorated.
    for i, x in enumerate((-16.2, -14.8, -16.2)):
        y = (-7.5, 0.0, 7.5)[i]
        add_item("Service Hall", "Hall console %02d" % (i + 1), "table", x, y, width=100, yaw=90, description="A narrow service console leaves just enough clearance for two people to pass in the hall.")
    for i, y in enumerate((-8.5, 0.0, 8.5)):
        add_item("Service Hall", "Hall wall clock %02d" % (i + 1), "wall_clock", -16.82, y, yaw=90, width=35, base_z=185, description="The face is stained by damp. Its hands point to different minutes each time you return.")
    add_item("Service Hall", "Hall palm", "plant", -15.5, 10.2, width=47)
    add_item("Service Hall", "Hall oil lamp", "oil_lamp", -16.2, -7.5, width=22, base_z=40, toggle=True)

    # Kitchen: work zones, freestanding range and a small daily table.
    add_item("Kitchen", "Kitchen preparation table", "table", -20.5, -10.0, width=205, description="A sturdy preparation table bears deep knife marks and a pale square where a chopping board was kept.")
    add_item("Kitchen", "Kitchen china cupboard", "bookshelf", -23.0, -8.2, width=112, yaw=90, description="The old cupboard holds chipped enamelware and mismatched plates behind dusty glass.")
    add_item("Kitchen", "Kitchen dry-goods cupboard", "bookshelf", -18.0, -10.0, width=104, yaw=-90, description="The cupboard door sits slightly ajar. Behind the crockery, something has been wrapped in butcher paper.")
    for i, (x, y, yaw) in enumerate([(-22.9, -6.25, 90), (-20.4, -6.25, -90), (-21.6, -5.15, 180), (-21.6, -7.3, 0)]):
        add_item("Kitchen", "Kitchen chair %02d" % (i + 1), "chair", x, y, yaw=yaw, width=50, description="The dining chair is mismatched with the kitchen set but has been pulled neatly into place.")
    add_item("Kitchen", "Vintage electric kettle", "kettle", -20.5, -10.0, width=28, base_z=82, toggle=True, description="The old kettle is unplugged, yet a faint click comes from its switch when touched.")
    add_item("Kitchen", "Kitchen oil lamp", "oil_lamp", -19.5, -10.0, width=22, base_z=82, toggle=True)
    add_item("Kitchen", "Kitchen wall clock", "wall_clock", -20.5, -10.82, width=34, base_z=185, description="The kitchen clock's glass is cracked. It runs backward for several seconds after each chime.")
    add_item("Kitchen", "Kitchen palm", "plant", -23.1, -5.0, width=42)

    # Pantry: deep shelving and stored crockery, no living-room furniture.
    for i, x in enumerate((-23.0, -21.0, -19.0)):
        add_item("Pantry", "Pantry shelving %02d" % (i + 1), "bookshelf", x, -2.0, yaw=90, width=104, description="The pantry shelf carries neat rows of dusty crockery and jars. Several labels have been turned to the wall.")
    for i, (x, y) in enumerate([(-23.0, -2.8), (-23.0, -1.9), (-21.0, -2.8), (-21.0, -1.9), (-19.0, -2.8), (-19.0, -1.9)]):
        add_item("Pantry", "Preserving jar %02d" % (i + 1), "vase", x, y, width=19, base_z=76 if i % 2 == 0 else 116, description="The preserved contents are obscured by a cloudy glaze. A date on the bottom predates the house.")
    add_item("Pantry", "Pantry kettle", "kettle", -18.2, -1.0, width=27, base_z=0, description="A kettle is stored cold and dry. The cord has been neatly coiled around its handle.")

    # Laundry: a hard-wearing utility room with service shelves and wash basins.
    add_item("Laundry", "Laundry folding table", "table", -22.5, 1.9, width=132, description="A plain wooden folding table is worn smooth by decades of laundry. A damp mark remains beneath the empty basket.")
    add_item("Laundry", "Laundry shelving", "bookshelf", -20.4, 3.1, width=110, yaw=180, description="Folded linens sit in precise stacks. The lowest shelf is empty except for a damp footprint.")
    add_item("Laundry", "Laundry chair", "chair", -18.5, 0.8, width=50, yaw=180, description="A plain chair is set beside the work table, its seat worn smooth by use.")
    add_item("Laundry", "Laundry oil lamp", "oil_lamp", -22.0, 1.9, width=22, base_z=53, toggle=True)
    add_item("Laundry", "Laundry clock", "wall_clock", -20.5, 3.82, yaw=180, width=34, base_z=185, description="The laundry clock's minute hand is missing. Something taps inside the wooden case.")
    add_item("Laundry", "Laundry palm", "plant", -23.0, 0.8, width=42)
    add_item("Laundry", "Laundry jar", "vase", -22.7, 1.9, width=21, base_z=53, description="A ceramic jar beside the folding table carries the faded mark of a local soap maker.")

    add_bedroom("Staff Room", -20.5, 6.0, bed_width=112)
    add_item("Staff Room", "Staff room wall clock", "wall_clock", -20.5, 7.65, width=34, base_z=184)
    # A narrow servant-sized guest room gets a single bed and one bedside
    # table; the compact plan keeps its passage clear and physically plausible.
    add_item("Guest Room 1", "Narrow guest bed", "bed", -22.0, 9.5, width=118, description="A narrow iron bed is made tightly against the wall. The pillow has a fresh hollow, though the cover is cold.")
    add_item("Guest Room 1", "Guest bedside cabinet", "nightstand", -19.4, 9.6, width=48)
    add_item("Guest Room 1", "Guest bedside oil lamp", "oil_lamp", -19.4, 9.6, width=22, base_z=72, toggle=True)
    add_item("Guest Room 1", "Guest alarm clock", "alarm_clock", -19.4, 9.6, width=15, base_z=82)
    add_item("Guest Room 1", "Guest chair", "chair", -18.2, 9.2, width=46, yaw=180)

    # Library / study: floor-to-ceiling books, reading chairs and a central desk.
    for i, (x, y, yaw) in enumerate([(-13.15, -9.5, 90), (-13.15, -6.7, 90), (-13.15, -3.8, 90), (-7.0, -9.5, -90), (-7.0, -6.7, -90)]):
        add_item("Library / Study", "Library bookcase %02d" % (i + 1), "bookshelf", x, y, yaw=yaw, width=132, description="The worn bookcase holds bindings arranged by height. One volume has a warm hollow in its cover.")
    add_item("Library / Study", "Study table", "table", -10.0, -6.3, width=178, description="The broad study table is stained with ink and has a clean rectangular patch where a ledger was removed.")
    for i, (x, y, yaw) in enumerate([(-11.4, -8.1, 0), (-8.6, -8.1, 180)]):
        add_item("Library / Study", "Study chair %02d" % (i + 1), "armchair", x, y, width=82, yaw=yaw, description="The chair's upholstery is worn through at the arms. It faces a closed book on the table.")
    add_item("Library / Study", "Library reading lamp", "oil_lamp", -10.0, -6.3, width=24, base_z=98, toggle=True)
    add_item("Library / Study", "Study clock", "wall_clock", -10.0, -10.55, width=39, base_z=185)
    add_item("Library / Study", "Study palm", "plant", -7.2, -3.0, width=47)
    add_item("Library / Study", "Study vase", "vase", -13.0, -3.0, width=24, base_z=74)

    # Dining room: one formal table, eight chairs and a separate sideboard.
    add_item("Dining Room", "Formal dining table", "table", -2.0, -6.5, width=205, description="A long dining table has eight places. One chair is pushed back, and a damp ring marks the empty head of the table.")
    for i, (x, y, yaw) in enumerate([(-3.65,-6.5,90),(-0.35,-6.5,-90),(-2.95,-5.15,180),(-1.85,-5.15,180),(-0.75,-5.15,180),(-2.95,-7.85,0),(-1.85,-7.85,0),(-0.75,-7.85,0)]):
        add_item("Dining Room", "Dining chair %02d" % (i + 1), "chair", x, y, yaw=yaw, width=51, description="The chair has a hand-polished crest rail. All eight are aligned except for one seat that faces the wall.")
    add_item("Dining Room", "Porcelain tea service", "tea_set", -2.0, -6.5, width=45, base_z=96, description="The porcelain cups are dry, but the pot is heavy with something that shifts when moved.")
    add_item("Dining Room", "Dining sideboard table", "table", -4.55, -3.15, width=105, yaw=90)
    add_item("Dining Room", "Dining room oil lamp", "oil_lamp", -4.55, -3.15, width=25, base_z=96, toggle=True)
    add_item("Dining Room", "Dining room vase", "vase", -4.55, -3.15, width=27, base_z=96)
    add_item("Dining Room", "Dining clock", "wall_clock", -2.0, -10.5, width=42, base_z=190)

    add_salon("Family Lounge", 5.0, -6.5, width=225, count=2, plants=2)
    add_item("Family Lounge", "Family room side table", "round_table", 7.0, -9.5, width=78, description="The small table has a ring of pale dust where a glass was left, though no glass remains.")
    add_item("Family Lounge", "Family room alarm clock", "alarm_clock", 7.0, -9.5, width=16, base_z=75)

    add_bedroom("Guest Room 3", 11.0, -8.0, bed_width=132)
    add_item("Guest Room 3", "Guest room 3 wall clock", "wall_clock", 11.0, -10.55, width=34, base_z=185)

    # Wine room: dense storage along both walls, a tasting table in the centre.
    for i, x in enumerate((15.0, 17.0, 19.0)):
        add_item("Wine Room", "Wine rack %02d" % (i + 1), "bookshelf", x, -8.0, yaw=90, width=112, description="The dark rack has old bottle-shaped hollows. Some labels have been sliced away with a blade.")
    for i, (x, y) in enumerate([(15.0,-9.5),(15.0,-8.3),(17.0,-9.5),(17.0,-8.3),(19.0,-9.5),(19.0,-8.3),(15.0,-6.5),(19.0,-6.5)]):
        add_item("Wine Room", "Sealed wine bottle %02d" % (i + 1), "vase", x, y, width=15, base_z=112 if i < 6 else 155, description="The dark ceramic bottle is sealed with red wax. There is no maker's mark or vintage on it.")
    add_item("Wine Room", "Wine tasting table", "round_table", 17.5, -7.0, width=93)
    add_item("Wine Room", "Wine room oil lamp", "oil_lamp", 17.5, -7.0, width=22, base_z=100, toggle=True)
    add_item("Wine Room", "Wine room chair", "chair", 17.5, -9.8, width=48, yaw=180)

    # Courtyard: open air, stone surface, palms in old clay pots and seating.
    for i, (x,y) in enumerate([(9.0,-4.1),(11.0,1.0),(14.0,-4.0),(17.0,1.0),(19.0,-3.8),(19.2,1.0)]):
        add_item("Inner Courtyard", "Courtyard palm %02d" % (i + 1), "plant", x, y, width=60, description="A rain-dark palm grows in a heavy pot. Its leaves move even though the air in the courtyard is still.")
    add_item("Inner Courtyard", "Courtyard tea table", "round_table", 14.0, -1.5, width=110, description="The stone-topped garden table is slick with moisture and scored by a circle of old iron rust.")
    for i, (x,y,yaw) in enumerate([(12.4,-1.5,90),(15.6,-1.5,-90),(14.0,-0.1,180),(14.0,-2.9,0)]):
        add_item("Inner Courtyard", "Courtyard chair %02d" % (i + 1), "chair", x, y, yaw=yaw, width=48, description="An outdoor dining chair has been brought into the courtyard and left facing the empty table.")
    add_item("Inner Courtyard", "Courtyard urn west", "vase", 9.0, 0.7, width=50, description="A large clay urn catches rain from the roof gutter. Its inside is black with old water.")
    add_item("Inner Courtyard", "Courtyard urn east", "vase", 19.0, 0.7, width=50)
    add_item("Inner Courtyard", "Courtyard oil lamp", "oil_lamp", 14.0, -1.5, width=23, base_z=100, toggle=True, description="A hurricane lantern stands on the table. Its glass is wet on the inside.")

    # The grand hall is the house's main circulation spine, not a gallery room.
    for i, (x,y) in enumerate([(-11.0,-0.45),(-5.0,-0.45),(1.0,-0.45),(6.0,-0.45)]):
        add_item("Grand Hall", "Hall console %02d" % (i + 1), "round_table", x, y, width=78, description="A narrow console keeps the centre of the hall open for circulation. Its top is cleared except for dust.")
        add_item("Grand Hall", "Hall lamp %02d" % (i + 1), "oil_lamp", x, y, width=20, base_z=100, toggle=True)
    for i, x in enumerate((-13.0, 7.0)):
        add_item("Grand Hall", "Hall palm %02d" % (i + 1), "plant", x, 0.0, width=50)
        add_item("Grand Hall", "Hall wall clock %02d" % (i + 1), "wall_clock", x, -1.7, width=37, base_z=190, description="A small clock hangs beside the portrait rail. Its face is turned slightly away from the centre hall.")
    add_item("Grand Hall", "Hall vase", "vase", -2.0, 0.0, width=25, base_z=80)

    add_salon("Formal Living Room", -9.5, 6.4, width=245, count=2, plants=2)
    add_item("Formal Living Room", "Formal room bookshelf", "bookshelf", -13.0, 9.2, yaw=90, width=135, description="The formal room's bookcase is curated, unlike the study. Every visible spine is the same faded blue.")
    add_item("Formal Living Room", "Formal room tea table", "round_table", -9.5, 3.6, width=105)

    # Foyer: axial, spare and legible; not a furniture obstacle course.
    add_item("Foyer", "Foyer arrival console", "table", -0.5, 9.0, width=150, yaw=0, description="A polished console stands opposite the entrance. The dust is disturbed in a hand-sized oval at its centre.")
    add_item("Foyer", "Foyer vase", "vase", -0.5, 9.0, width=31, base_z=97)
    add_item("Foyer", "Foyer reading lamp", "oil_lamp", -0.5, 9.0, width=24, base_z=96, toggle=True, description="The foyer lamp is positioned to illuminate the entrance but leaves the stairwell in shadow.")
    for i, x in enumerate((-3.8, 3.0)):
        add_item("Foyer", "Foyer palm %02d" % (i + 1), "plant", x, 3.0, width=58)
    add_item("Foyer", "Foyer clock", "wall_clock", -0.5, 10.5, width=43, base_z=200, description="The foyer clock chimes one note at a time. The next note never arrives while you watch it.")
    add_item("Foyer", "Foyer waiting chair", "armchair", 2.5, 7.0, width=82, yaw=180)
    add_item("Foyer", "Foyer side table", "round_table", 2.5, 5.5, width=75)
    add_item("Foyer", "Foyer second chair", "armchair", -3.2, 7.0, width=78, yaw=0)

    # Narrow sitting room, furnished for two rather than scaled like a salon.
    add_item("Sitting Room", "Sitting-room settee", "sofa", 6.0, 8.8, width=175, yaw=180)
    add_item("Sitting Room", "Sitting-room armchair", "armchair", 6.0, 5.0, width=80, yaw=0)
    add_item("Sitting Room", "Sitting-room tea table", "round_table", 6.0, 6.6, width=76)
    add_item("Sitting Room", "Sitting-room tea set", "tea_set", 6.0, 6.6, width=32, base_z=100)
    add_item("Sitting Room", "Sitting-room lamp", "oil_lamp", 6.0, 6.6, width=22, base_z=99, toggle=True)
    add_item("Sitting Room", "Sitting-room palm", "plant", 7.25, 10.5, width=42)

    # Guest room 4 is a generous family suite, with a reading corner.
    add_bedroom("Guest Room 4", 14.5, 6.4, bed_width=165)
    add_item("Guest Room 4", "Suite writing table", "table", 18.5, 3.5, width=150, yaw=180, description="A writing table sits near the suite's outer wall. The chair is turned to look into the room.")
    add_item("Guest Room 4", "Suite writing chair", "chair", 18.5, 4.5, width=50, yaw=180)
    add_item("Guest Room 4", "Suite reading bookcase", "bookshelf", 20.0, 8.3, yaw=90, width=118)
    add_item("Guest Room 4", "Suite reading lamp", "oil_lamp", 18.5, 3.5, width=22, base_z=96, toggle=True)
    add_item("Guest Room 4", "Suite standing vase", "vase", 20.0, 10.0, width=27, base_z=0)

    # Bays have purpose-built small arrangements, not oversized room sets.
    for room, cx, cy in [("Front Drawing Room", 17.0, 12.7)]:
        add_item(room, "Bay conversation chair A", "armchair", cx - 1.0, cy, width=74, yaw=90)
        add_item(room, "Bay conversation chair B", "armchair", cx + 1.0, cy, width=74, yaw=-90)
        add_item(room, "Bay tea table", "round_table", cx, cy - 0.8, width=66)
        add_item(room, "Bay tea service", "tea_set", cx, cy - 0.8, width=28, base_z=94)
        add_item(room, "Bay lamp", "oil_lamp", cx, cy - 0.8, width=20, base_z=94, toggle=True)
        add_item(room, "Bay palm", "plant", cx + 2.5, cy + 0.9, width=40)
    add_item("Sitting Bay", "Bay window armchair", "armchair", 6.8, 12.6, width=76, yaw=180)
    add_item("Sitting Bay", "Bay window table", "round_table", 6.8, 11.5, width=54)
    add_item("Sitting Bay", "Bay window lamp", "oil_lamp", 6.8, 11.5, width=19, base_z=92, toggle=True)
    add_item("Sitting Bay", "Bay window vase", "vase", 7.55, 13.0, width=19)

    # Breakfast room: shorter trestle, four chairs, kettle and morning service.
    add_item("Breakfast Room", "Breakfast table", "table", -2.0, -12.8, width=153, yaw=0, description="The breakfast table is set for four. Two place settings face the bay windows; two face the rear wall.")
    for i, (x,y,yaw) in enumerate([(-3.0,-11.95,180),(-1.0,-11.95,180),(-3.0,-13.65,0),(-1.0,-13.65,0)]):
        add_item("Breakfast Room", "Breakfast chair %02d" % (i + 1), "chair", x, y, yaw=yaw, width=49)
    add_item("Breakfast Room", "Breakfast kettle", "kettle", -2.0, -12.8, width=28, base_z=96, toggle=True, description="The kettle switch is down. A dry tea stain circles the base as if it has boiled recently.")
    add_item("Breakfast Room", "Breakfast tea service", "tea_set", -1.0, -12.8, width=33, base_z=96)
    add_item("Breakfast Room", "Breakfast vase", "vase", -3.0, -12.8, width=22, base_z=96)
    add_item("Breakfast Room", "Breakfast palm", "plant", -4.9, -12.5, width=40)
    add_item("Breakfast Room", "Breakfast oil lamp", "oil_lamp", 0.0, -12.5, width=21, base_z=0, toggle=True)

    if len(PLACEMENTS) < 100:
        raise RuntimeError("First-floor layout has fewer than 100 props: %d" % len(PLACEMENTS))


def setup_prop_collider(actor, mesh_component):
    low, high = mesh_component.get_local_bounds()
    center = (low + high) * 0.5
    extent = (high - low) * 0.5
    collider = actor.get_editor_property("focus_collider")
    collider.set_box_extent(vec(max(extent.x, 10) + 4, max(extent.y, 10) + 4, max(extent.z, 10) + 4))
    set_rel_loc(collider, center)
    return low, high


def spawn_furniture(subsystem, prop_class, mesh, entry):
    x, y = entry["x"] * 100.0, entry["y"] * 100.0
    actor = subsystem.spawn_actor_from_class(prop_class, vec(x, y, 0), unreal.Rotator(0, entry["yaw"], 0))
    if not actor:
        raise RuntimeError("Failed to spawn " + entry["display"])
    actor.set_actor_label(ITEM_PREFIX + entry["room"] + " - " + entry["display"])
    component = actor.get_editor_property("mesh")
    component.set_static_mesh(mesh)
    low, high = setup_prop_collider(actor, component)
    size_x, size_y = high.x - low.x, high.y - low.y
    horizontal = max(size_x, size_y)
    if horizontal < 1:
        raise RuntimeError("Invalid dimensions for imported model: " + entry["display"])
    scale = entry["width"] / horizontal
    actor.set_actor_scale3d(vec(scale, scale, scale))
    set_actor_loc(actor, vec(x, y, entry["base_z"] - low.z * scale))

    set_editor_any(actor, ("display_name", "DisplayName"), unreal.Text(entry["display"]))
    set_editor_any(actor, ("examine_description", "ExamineDescription"), unreal.Text(entry["description"]))
    set_editor_any(actor, ("toggleable", "b_toggleable", "bToggleable"), bool(entry["toggle"]))
    set_editor_any(actor, ("starts_on", "b_starts_on", "bStartsOn"), False)
    set_editor_any(actor, ("save_id", "SaveId"), unreal.Name("gf.prop." + str(len(PLACEMENTS))))
    if entry["toggle"]:
        practical = actor.get_editor_property("practical_light")
        set_rel_loc(practical, vec(0, 0, max(65, entry["width"] * 0.7)))
        practical.set_editor_property("light_color", unreal.Color(r=255, g=183, b=111, a=255))
        practical.set_intensity(620.0)
        practical.set_attenuation_radius(420.0)
    return actor


def spawn_doors(subsystem, door_class, cube, wood, door_mesh):
    created = 0
    for i, (axis, wall, along, width_m) in enumerate(DOORS):
        width = width_m * 100.0
        if axis == "x":
            hinge_x, hinge_y, yaw = (along - width_m / 2.0) * 100.0, wall * 100.0, 0.0
            hinge_loc = vec(hinge_x, hinge_y, 110.0)
            far_offset = vec(width, 0, 0)
        else:
            hinge_x, hinge_y, yaw = wall * 100.0, (along - width_m / 2.0) * 100.0, 90.0
            hinge_loc = vec(hinge_x, hinge_y, 110.0)
            far_offset = vec(0, width, 0)
        door = subsystem.spawn_actor_from_class(door_class, hinge_loc, unreal.Rotator(0, yaw, 0))
        if not door:
            raise RuntimeError("Could not spawn door %02d" % (i + 1))
        door.set_actor_label(DOOR_PREFIX + "%02d" % (i + 1))
        door.set_editor_property("save_id", unreal.Name("gf.door.%02d" % (i + 1)))
        frame = door.get_editor_property("frame_mesh")
        leaf = door.get_editor_property("leaf_pivot")
        frame.set_static_mesh(cube)
        frame.set_material(0, wood)
        frame.set_relative_scale3d(vec(0.13, 0.13, 2.2))
        leaf.set_static_mesh(door_mesh)
        leaf.set_material(0, wood)
        set_rel_loc(leaf, vec(width / 2.0, 0, -4))
        leaf.set_relative_scale3d(vec(width / 100.0, 1.0, 1.0))
        # Matching latch-side jamb and lintel are simple architectural trim
        # pieces. Door leaf remains the sole moving, focusable component.
        jamb = subsystem.spawn_actor_from_object(cube, hinge_loc + far_offset, unreal.Rotator(0, yaw, 0))
        if jamb:
            jamb.set_actor_label(DETAIL_PREFIX + "%02d - Jamb" % (i + 1))
            jamb.set_actor_scale3d(vec(0.13, 0.13, 2.2))
            jamb.get_component_by_class(unreal.StaticMeshComponent).set_material(0, wood)
        lintel = subsystem.spawn_actor_from_object(cube, hinge_loc + far_offset * 0.5 + vec(0, 0, 108), unreal.Rotator(0, yaw, 0))
        if lintel:
            lintel.set_actor_label(DETAIL_PREFIX + "%02d - Header" % (i + 1))
            # 11 cm deep against the jamb's 13 cm: the trim sits just inside
            # the frame faces so the two never share a coplanar face.
            lintel.set_actor_scale3d(vec(width / 100.0 + 0.25, 0.11, 0.13))
            lintel.get_component_by_class(unreal.StaticMeshComponent).set_material(0, wood)
        created += 1
    return created


def main():
    build_layout()
    prop_class = unreal.load_class(None, PROP_CLASS_PATH)
    door_class = unreal.load_class(None, DOOR_CLASS_PATH)
    if not prop_class:
        raise RuntimeError("SILIDInspectableProp is not compiled yet. Build the SILIDEditor target, then rerun.")
    if not door_class:
        raise RuntimeError("The SILIDDoor class could not be loaded from the project module.")
    wood = unreal.load_asset(WOOD_MATERIAL)
    plaster = unreal.load_asset(PLASTER_MATERIAL)
    tile = unreal.load_asset(TILE_MATERIAL)
    if not all((wood, plaster, tile)):
        raise RuntimeError("Run ReplaceRoomWithGroundFloorPlan.py first to create the aged plaster, wood, and tile materials.")
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    index = get_mesh_index()
    meshes = {}
    for key, spec in MODEL_FILES.items():
        meshes[key] = import_model_mesh(key, spec, index, tools)
        unreal.log("[SILID furnishings] %s -> %s" % (key, meshes[key].get_path_name()))
    save_mesh_index(index)
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for actor in list(subsystem.get_all_level_actors()):
        label = actor.get_actor_label()
        if label.startswith(ITEM_PREFIX) or label.startswith(DOOR_PREFIX) or label.startswith(DETAIL_PREFIX):
            subsystem.destroy_actor(actor)

    for entry in PLACEMENTS:
        mesh = meshes[entry["model"]]
        spawn_furniture(subsystem, prop_class, mesh, entry)

    cube = unreal.load_asset("/Engine/BasicShapes/Cube")
    if not cube:
        raise RuntimeError("Unreal's built-in Cube mesh is not available for the architectural door frames.")
    door_count = spawn_doors(subsystem, door_class, cube, wood, meshes["door"])
    world = unreal.EditorLevelLibrary.get_editor_world()
    if not world:
        raise RuntimeError("The active Unreal world could not be read before saving the furnished level.")
    unreal.EditorAssetLibrary.make_directory("/Game/SILID/Maps")
    saved = unreal.EditorLoadingAndSavingUtils.save_map(world, MAP_SAVE_PATH)
    if not saved:
        raise RuntimeError("Could not save the furnished first floor to " + MAP_SAVE_PATH)
    map_file = os.path.join(ROOT, "ue5", "Content", "SILID", "Maps", "LM_SILID_GroundFloor.umap")
    if not unreal.EditorLoadingAndSavingUtils.load_map(map_file):
        raise RuntimeError("The furnished first floor was saved but Unreal could not reopen " + map_file)
    unreal.log("[SILID furnishings] rooms=%d interactable_props=%d doors=%d saved=%s" % (
        len(ROOM_BOUNDS), len(PLACEMENTS), door_count, saved
    ))
    print("SILID first floor: %d rooms, %d interactable props, %d working doors. Saved=%s at %s" % (
        len(ROOM_BOUNDS), len(PLACEMENTS), door_count, saved, MAP_SAVE_PATH
    ))


main()
