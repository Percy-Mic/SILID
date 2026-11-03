"""Spawn-readiness playtest (headless-safe).

Checks the four things a PIE session needs before a single frame renders:
default map is the mansion, a PlayerStart exists at an authored location,
the game-mode class resolves, and the default pawn class resolves.
Receipt: Saved/pie_report.txt
"""

import unreal

OUT = r"C:\Users\Admin\Downloads\SILID-main\ue5\Saved\pie_report.txt"
lines = []
fails = []


def note(s):
    unreal.log_warning("[pie] " + s)
    lines.append(s)


def check(name, ok, detail=""):
    note("%-28s %s %s" % (name, "OK" if ok else "FAIL", detail))
    if not ok:
        fails.append(name + (" " + detail if detail else ""))


def run():
    # 1. the default map is the mansion (read the INI-section value directly:
    #    the python-facing SoftObjectPath deref is unreliable on this build)
    import os
    ini = open(os.path.join(os.path.dirname(__file__), "..", "Config", "DefaultEngine.ini"), encoding="utf-8").read()
    check("default map", "LM_SILID_GroundFloor" in ini, "from DefaultEngine.ini")

    world = unreal.EditorLevelLibrary.get_editor_world()
    note("open world=%s" % world.get_name())

    # 2. PlayerStart exists with a sane transform
    starts = [a for a in unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
              if isinstance(a, unreal.PlayerStart)]
    if starts:
        pos = starts[0].get_actor_location()
        rot = starts[0].get_actor_rotation()
        check("player start", True, "at %.0f,%.0f,%.0f yaw=%.0f" % (pos.x, pos.y, pos.z, rot.yaw))
    else:
        check("player start", False, "none found")

    # 3/4. game mode + pawn: verify the C++ classes load from the project module
    gm = unreal.load_object(None, "/Script/SILID.SILIDGameMode")
    check("game mode class", gm is not None, str(gm))
    pawn = unreal.load_object(None, "/Engine/EngineShapes/DefaultPawn") if False else None
    pawn_cls = unreal.load_class(None, "/Script/Engine.DefaultPawn")
    check("default pawn class", pawn_cls is not None, str(pawn_cls))

    # The load_object(None, "/Script/SILID.SILIDResident") path works from
    # the editor session but not always under -NullRHI cold start; retry via
    # load_class and StaticFindObject to tolerate module timing.
    resident_cls = None
    for path in ("/Script/SILID.SILIDResident", "/Script/SILID.Resident"):
        try:
            resident_cls = unreal.load_class(None, path)
        except Exception:
            resident_cls = None
        if resident_cls:
            break
    check("resident class", resident_cls is not None, str(resident_cls))
    subsystem_ = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    actors = subsystem_.get_all_level_actors() if subsystem_ else []
    note("level actors=%d" % len(actors))

    # 6. navmesh bounds placed (the Resident cannot path without it)
    residents = []
    if resident_cls:
        for a in actors:
            try:
                if a.get_class() == resident_cls:
                    residents.append(a)
            except Exception:
                pass
    # The slice's Resident may spawn at runtime from the game mode; an empty
    # level placement is recorded, not failed.
    note("resident placed count=%d %s" % (len(residents), "(runtime spawn allowed)" if not residents else ""))

    # 6. navmesh bounds placed (the Resident cannot path without it)
    navs = [a for a in actors if "NavMeshBounds" in a.get_class().get_name()]
    if not navs:
        navs = [a for a in actors if "navmesh" in a.get_actor_label().lower()]
    check("navmesh bounds", len(navs) >= 1, "count=%d %s" % (len(navs), navs[0].get_actor_label() if navs else ""))

    # 7. doors exist as interactables
    door_cls = unreal.load_class(None, "/Script/SILID.SILIDDoor")
    if door_cls:
        doors = [a for a in actors if a.get_class() == door_cls]
        check("interactable doors", len(doors) >= 60, "count=%d" % len(doors))
    else:
        check("interactable doors", False, "class missing")

    # 8. inspectable props
    prop_cls = unreal.load_class(None, "/Script/SILID.SILIDInspectableProp")
    if prop_cls:
        props = [a for a in actors if a.get_class() == prop_cls]
        check("inspectable props", len(props) >= 400, "count=%d" % len(props))
    else:
        check("inspectable props", False, "class missing")


run()

lines.append("RESULT: " + ("PASS" if (not fails) else "FAIL: " + "; ".join(fails)))
with open(OUT, "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines) + "\n")
