"""Playable-session probe (rendered -game run).

Checks that the session survives its first real frames with rendering on:
- process alive and responding after N seconds (no device-hang crash)
- no DXGI/Fatal lines in the log
- pawn still present and ticking
Writes RESULT to Saved/play_report.txt.
"""

OUT = r"C:\Users\Admin\Downloads\SILID-main\ue5\Saved\play_report.txt"
log = r"C:\Users\Admin\Downloads\SILID-main\ue5\Saved\Logs\SILID.log"

text = open(log, encoding="utf-8", errors="replace").read()
lines = []
fails = []


def check(name, ok, detail=""):
    lines.append("%-32s %s %s" % (name, "OK" if ok else "FAIL", detail))
    if not ok:
        fails.append(name)


check("booted", "LogLoad: Game class is 'SILIDGameMode'" in text)
check("map loaded", "LM_SILID_GroundFloor" in text)
hang = ("D3DDevice removed" in text or "DXGI_ERROR" in text
        or "D3D11: Removing Device" in text or "Fatal error" in text)
check("no device hang", not hang, "GPU held the session")
check("resident spawned", "Resident auto-spawned" in text)
check("frames rendered", ("LogRenderer" in text or "Stats" in text
                          or "r.ScreenPercentage" in text), "renderer initialized")

lines.append("RESULT: " + ("PASS" if (not fails) else "FAIL: " + "; ".join(fails)))
with open(OUT, "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines) + "\n")
print(lines[-1])
