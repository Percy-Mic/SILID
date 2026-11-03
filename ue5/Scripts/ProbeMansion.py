"""Inventory the current SILID map from a running Unreal Editor."""
import collections
import json
import os
import unreal

ROOT = r"C:\Users\Admin\Downloads\SILID-main"
OUT = os.path.join(ROOT, "ue5", "Saved", "silid_mansion_probe.json")

world = unreal.EditorLevelLibrary.get_editor_world()
world_name = world.get_name() if world else None
subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
actors = list(subsystem.get_all_level_actors()) if subsystem else []

counts = collections.Counter()
prefixes = collections.Counter()
rooms = collections.Counter()
samples = []
for actor in actors:
    try:
        label = actor.get_actor_label()
    except Exception:
        continue
    counts["actors"] += 1
    class_name = actor.get_class().get_name()
    counts[class_name] += 1
    if " - " in label:
        prefixes[label.split(" - ")[0][:40]] += 1
    if "SILID - GF Item - " in label:
        rooms[label.replace("SILID - GF Item - ", "").split(" - ")[0]] += 1
    if len(samples) < 30:
        loc = actor.get_actor_location()
        samples.append({"label": label, "class": class_name, "x": loc.x, "y": loc.y, "z": loc.z})

prop = unreal.load_class(None, "/Script/SILID.SILIDInspectableProp")
door = unreal.load_class(None, "/Script/SILID.SILIDDoor")
result = {
    "world": world_name,
    "actor_count": counts["actors"],
    "has_inspectable": bool(prop),
    "has_door": bool(door),
    "class_counts": dict(counts),
    "prefixes": dict(prefixes),
    "gf_rooms": dict(rooms),
    "samples": samples,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as stream:
    json.dump(result, stream, indent=2)
print("PROBE_OK world=%s actors=%d inspectable=%s door=%s rooms=%d" % (
    world_name, counts["actors"], bool(prop), bool(door), len(rooms)
))
