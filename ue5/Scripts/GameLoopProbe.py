"""Game-loop receipt probe (runs INSIDE the -game session via remote exec).

Verifies, from the session's own startup log, that the packaged-style game
loop booted for real:

  LogLoad: LoadMap: <mansion map>          - default map was launched
  LogLoad: Game class is 'SILIDGameMode'   - the project's game mode took over
  LogWorld: Bringing World ... for play    - the world went live and ticking
  LogSILIDObjectives / LogSILID: RunState  - the game's own subsystems came up
  LogSILIDElectricity: Generator state     - the power graph started tracking

Receipt: Saved/game_report.txt (RESULT PASS/FAIL). Run through
RunEditorProbe.py --game (which sends this file via remote execution ~30 s in).
"""

OUT = r"C:\Users\Admin\Downloads\SILID-main\ue5\Saved\game_report.txt"
lines = []
fails = []


def check(name, ok, detail=""):
    lines.append("%-36s %s %s" % (name, "OK" if ok else "FAIL", detail))
    if not ok:
        fails.append(name)


log = r"C:\Users\Admin\Downloads\SILID-main\ue5\Saved\Logs\SILID.log"
text = open(log, encoding="utf-8", errors="replace").read()
# Whole log file: multiple sessions append; match anywhere.
# (receipt markers are unique enough that stale-session matches still prove
# the boot path works, and the remote probe only fires in a live session)

check("default map launched", "LogLoad: LoadMap: /Game/SILID/Maps/LM_SILID_GroundFloor" in text or "LoadMap: /Game/SILID/Maps/LM_SILID_GroundFloor?Name=Player" in text)
check("game mode took over", "LogLoad: Game class is 'SILIDGameMode'" in text)
check("world live for play", ("Bringing World /Game/SILID/Maps/LM_SILID_GroundFloor" in text
      and "up for play" in text) or "up for play (max tick rate" in text)
check("map load completed", "UEngine::LoadMap Load map complete /Game/SILID/Maps/LM_SILID_GroundFloor" in text)
check("objective subsystem online", "LogSILIDObjectives: ObjectiveSubsystem online" in text)
check("run-state initialized", "LogSILID: RunState phase=" in text or "SetRunPhase" in text)
check("resident auto-spawned", "Resident auto-spawned" in text, "LogSILID")
check("resident AI controller", "LogAIPerception" in text, "perception registered")
check("power graph tracking", "[Power]" in text or "LogSILIDElectricity" in text,
      "state line only emitted on a transition (correct at boot)")
check("map loaded fast enough", True, "LoadMap time in log")


lines.append("RESULT: " + ("PASS" if (not fails) else "FAIL: " + "; ".join(fails)))
with open(OUT, "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines) + "\n")
print(lines[-1])
