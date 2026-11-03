"""Import the prepared SILID first-floor drawing room into the open UE level.

Run from the Unreal Python console with:
    py exec(open(r'C:/Users/Admin/Downloads/SILID-main/ue5/Scripts/ImportFirstFloorRoom.py').read())

The source GLB is already cleaned, doorway-cut, texture-capped, and lit for a
real-time renderer by scripts/prep_rooms_blender.py. This script imports that
single room, places it at the origin, adds a spawn point and two restrained
warm practicals, then saves the current level.
"""

import os
import unreal


ROOT = r"C:\Users\Admin\Downloads\SILID-main"
SOURCE = os.path.join(ROOT, "public", "assets", "rooms", "the_great_drawing_room.glb")
DESTINATION = "/Game/SILID/Interiors"
ROOM_LABELS = {
    "SILID - GF Great Drawing Room",
    "SILID - First Floor Entry Spawn",
    "SILID - Drawing Room Sconce A",
    "SILID - Drawing Room Sconce B",
}
RESULT = os.path.join(ROOT, "ue5", "Saved", "first_floor_room_import.txt")


def report(message):
    unreal.log("[SILID room import] " + str(message))
    with open(RESULT, "a", encoding="utf-8") as stream:
        stream.write(str(message) + "\n")


os.makedirs(os.path.dirname(RESULT), exist_ok=True)
with open(RESULT, "w", encoding="utf-8") as stream:
    stream.write("SILID first-floor room import\n")

if not os.path.isfile(SOURCE):
    raise RuntimeError("Prepared room GLB is missing: " + SOURCE)

mesh_path = DESTINATION + "/SM_GreatDrawingRoom.SM_GreatDrawingRoom"
existing_mesh = unreal.load_asset(mesh_path)
meshes = [existing_mesh] if isinstance(existing_mesh, unreal.StaticMesh) else []

if meshes:
    report("Reusing imported mesh: " + mesh_path)
else:
    task = unreal.AssetImportTask()
    task.filename = SOURCE
    task.destination_path = DESTINATION
    task.destination_name = "SM_GreatDrawingRoom"
    task.automated = True
    task.save = True
    task.replace_existing = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    paths = list(task.imported_object_paths or [])
    report("Imported paths: " + repr(paths))
    for object_path in paths:
        asset = unreal.load_object(None, object_path)
        if isinstance(asset, unreal.StaticMesh):
            meshes.append(asset)

if not meshes:
    raise RuntimeError("GLB import completed without a StaticMesh; see Unreal Output Log.")

subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
for actor in subsystem.get_all_level_actors():
    if actor.get_actor_label() in ROOM_LABELS:
        subsystem.destroy_actor(actor)

room = subsystem.spawn_actor_from_object(
    meshes[0], unreal.Vector(0.0, 0.0, 0.0), unreal.Rotator(0.0, 0.0, 0.0)
)
if not room:
    raise RuntimeError("Unreal could not place the imported drawing-room mesh.")
room.set_actor_label("SILID - GF Great Drawing Room")
report("Placed room mesh: " + meshes[0].get_path_name())

# The prepared room's door is at its origin; begin just inside it, facing down
# the long axis. The PlayerStart lets the existing SILID first-person pawn run.
spawn = subsystem.spawn_actor_from_class(
    unreal.PlayerStart,
    unreal.Vector(0.0, 120.0, 110.0),
    unreal.Rotator(0.0, 90.0, 0.0),
)
if spawn:
    spawn.set_actor_label("SILID - First Floor Entry Spawn")


def practical(label, location, intensity, radius):
    actor = subsystem.spawn_actor_from_class(
        unreal.PointLight, unreal.Vector(*location), unreal.Rotator(0.0, 0.0, 0.0)
    )
    if actor:
        actor.set_actor_label(label)
        light = actor.get_component_by_class(unreal.PointLightComponent)
        if light:
            light.set_editor_property("intensity", intensity)
            light.set_editor_property("attenuation_radius", radius)
            light.set_editor_property(
                "light_color", unreal.Color(r=255, g=177, b=116, a=255)
            )
            light.set_editor_property("cast_shadows", True)
    return actor


practical("SILID - Drawing Room Sconce A", (0.0, 260.0, 285.0), 950.0, 850.0)
practical("SILID - Drawing Room Sconce B", (0.0, 610.0, 285.0), 650.0, 750.0)

world = unreal.EditorLevelLibrary.get_editor_world()
if world:
    world.mark_package_dirty()
saved = unreal.EditorLoadingAndSavingUtils.save_current_level()
if not saved and world:
    saved = unreal.EditorLoadingAndSavingUtils.save_map(world, "/Game/LM_SILID_Base")
report("Current level saved via EditorLoadingAndSavingUtils: " + repr(saved))
report("First-floor room import finished.")
