"""Sanitize Saved/SourceControl/UncontrolledChangelists.json.

The engine's uncontrolled-changelist scanner crashes at startup when the
persistency file references files whose AssetRegistry module is not yet
loaded (reproduced 4x, 2026-11-02). An empty changelists list skips the scan.
"""

import json
import os

PATH = r"C:\Users\Admin\Downloads\SILID-main\ue5\Saved\SourceControl\UncontrolledChangelists.json"

if os.path.isfile(PATH):
    with open(PATH, "r", encoding="utf-8") as fh:
        raw = fh.read()
    try:
        data = json.loads(raw)
    except ValueError:
        data = None
    if isinstance(data, dict) and data.get("Changelists"):
        data["Changelists"] = []
        with open(PATH, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
        print("sanitized UncontrolledChangelists.json")
    else:
        os.remove(PATH)
        print("removed empty UncontrolledChangelists.json")
else:
    print("no UncontrolledChangelists.json present")
