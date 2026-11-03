"""Console-based traversal probe (dump to a file, no stdout dependency).

Runs at startup with -NullRHI: loads the mansion, traces down at every plan
probe point, writes one line per probe to ue5/Saved/traverse_report.txt and
writes PASS/FAIL to the same file. Console output from python at startup is
unreliable, so the file is the receipt.
"""

import unreal

MAP = "/Game/SILID/Maps/LM_SILID_GroundFloor"
REPORT = r"C:\Users\Admin\Downloads\SILID-main\ue5\Saved\traverse_report.txt"

lines = []
fails = []

# Narrow per-storey probes: start 300 cm above each storey's authored floor
# (plan.js levels: GF 0, F2 420, F3 800, F4 1160, B1 -324) and trace down
# only to 300 cm below it. Any solid inside the band must be the slab.
# (label, x_m, y_m, floor_z_cm, band_cm)
PROBES = [
    ("GF Grand Hall centre",        0.0,   0.0,    0, 300),
    ("GF Library",                -10.0,  -6.0,    0, 300),
    ("GF Kitchen",                -20.5,  -7.5,    0, 300),
    ("GF Front Drawing Room bay",  17.0,  12.7,    0, 300),
    ("GF Breakfast Room bay",      -2.0, -12.8,    0, 300),
    ("F2 Master Bedroom",          -2.0,  -6.5,  420, 300),
    ("F2 Upper Landing",          -10.0,   0.0,  420, 300),
    ("F3 Billiards Room",         -10.5,  -6.5,  800, 300),
    ("F3 Master Suite",           -18.0,   7.0,  800, 300),
    ("F4 Observation Gallery",     -0.5,   6.5, 1160, 300),
    ("F4 Roof Deck",               10.0,  -5.0, 1160, 300),
    ("B1 Generator Room",           3.0,  -3.0, -324, 300),
    ("B1 Wine Cellar",             -4.5,  -2.0, -324, 300),
]


def run():
    loaded = unreal.EditorLoadingAndSavingUtils.load_map(MAP)
    lines.append("map loaded: %s" % bool(loaded))
    if not loaded:
        fails.append("map load")
        return
    world = unreal.EditorLevelLibrary.get_editor_world()
    for label, x_m, y_m, floor_z, band in PROBES:
        x, y = x_m * 100.0, y_m * 100.0
        hit = unreal.SystemLibrary.line_trace_single(
            world,
            unreal.Vector(x, y, floor_z + band),
            unreal.Vector(x, y, floor_z - band),
            unreal.TraceTypeQuery.TRACE_TYPE_QUERY1,
            False, [], unreal.DrawDebugTrace.FOR_ONE_FRAME, True,
            unreal.LinearColor(1, 0, 0, 1), unreal.LinearColor(0, 1, 0, 1), 5.0,
        )

        def field(name):
            try:
                return hit.get_editor_property(name)
            except Exception:
                return None

        blocked = field("bBlockingHit")
        if blocked is None:
            blocked = field("blocking_hit")
        if blocked is None:
            blocked = field("b_blocking_hit")
        loc = field("impact_point")
        if loc is None:
            loc = field("location")
        # The wrapper returns a raw HitResult struct. Use to_tuple() to get
        # the packed fields (HitResult order in UE5: bBlockingHit,... ) and
        # decode the floor height from the location field.
        tup = hit.to_tuple()
        blocked = tup[0] if tup else None
        ok_hit = bool(hit) and blocked is True and len(tup) > 5
        lines.append("debug %-28s blocked=%r tuple_z_fields=%r" % (
            label, blocked,
            [getattr(t, "z", None) for t in tup if hasattr(t, "z")]))
        if not ok_hit:
            lines.append("%-28s NOTHING SOLID BELOW (blocked=%s loc=%s)" % (label, blocked, bool(loc)))
            fails.append(label + ": no blocking hit")
            continue
        # to_tuple(): (bBlockingHit, bStartPenetrating, Time, Distance,
        #   Location, ImpactPoint, Normal, ImpactNormal, PhysMat, Actor,
        #   Component, HitBoneName x2, FaceIndex?? x2, TraceStart, TraceEnd)
        # ImpactPoint is tuple[5].
        loc = tup[5]
        z = loc.z
        ok = abs(z - floor_z) <= band
        lines.append("%-28s first solid z=%8.1f storey floor=%6d band=%d %s" % (
            label, z, floor_z, band, "OK" if ok else "WRONG-STOREY"))
        if not ok:
            fails.append("%s floor %.0f, expected near %d (+/- %d)" % (label, z, floor_z, band))


run()
lines.append("probes=%d failures=%d" % (len(PROBES), len(fails)))
lines.append("RESULT: " + ("PASS" if (not fails) else "FAIL: " + "; ".join(fails)))
with open(REPORT, "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines) + "\n")

