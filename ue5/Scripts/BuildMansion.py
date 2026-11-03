"""Run the whole SILID mansion build inside one Unreal Editor session.

Launch with:
  UnrealEditor.exe SILID.uproject -ExecutePythonScript=".../BuildMansion.py"

Phases, in order (each is independently rerunnable):
  1. ReplaceRoomWithGroundFloorPlan.py — GF shell: 20 rooms, storey-height
     walls with doors/windows, the dog-leg stair, lights, player start.
  2. PopulateGroundFloor.py — imports the prepared CC0 furniture GLBs and
     dresses all 20 rooms with interactables and working doors.
  3. BuildUpperFloorsAndBasement.py — B1/F2/F3/F4: floors, walls, windows,
     doors, continuing stairs, rails, roof slabs, furnishing.

Each phase execs in a fresh namespace (its own module-level globals), the
way Tools > Execute Python Script would run it alone.
"""

import os
import unreal


SCRIPTS = [
    r"C:\Users\Admin\Downloads\SILID-main\ue5\Scripts\ReplaceRoomWithGroundFloorPlan.py",
    r"C:\Users\Admin\Downloads\SILID-main\ue5\Scripts\PopulateGroundFloor.py",
    r"C:\Users\Admin\Downloads\SILID-main\ue5\Scripts\BuildUpperFloorsAndBasement.py",
]

for path in SCRIPTS:
    unreal.log("[SILID build] === running " + os.path.basename(path))
    with open(path, "r", encoding="utf-8") as stream:
        code = compile(stream.read(), path, "exec")
    exec(code, {"__name__": "__main__", "__file__": path})
    unreal.log("[SILID build] === finished " + os.path.basename(path))

unreal.log("[SILID build] ALL PHASES COMPLETE")
print("SILID build complete: ground floor plan, furnishings, and all upper storeys plus basement.")
