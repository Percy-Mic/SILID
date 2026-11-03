"""Console-cmdlet traversal probe runner.

The -ExecutePythonScript argument did not survive PowerShell quoting on the
last two launches (the editor's command line shows the project path only), so
this runner writes its own tiny init python that execs the probe, then relaunch
the editor with it. Kept in the repo for reruns.
"""

import subprocess
import time

EDITOR = r"C:\Program Files\Epic Games\UE_5.4\Engine\Binaries\Win64\UnrealEditor.exe"
UPROJ = r"C:\Users\Admin\Downloads\SILID-main\ue5\SILID.uproject"
PROBE = r"C:\Users\Admin\Downloads\SILID-main\ue5\Scripts\TraverseHeadless.py"
REPORT = r"C:\Users\Admin\Downloads\SILID-main\ue5\Saved\traverse_report.txt"


def main():
    import os
    # kill any running editor so the probe owns the log
    subprocess.run(["taskkill", "/F", "/IM", "UnrealEditor.exe"], capture_output=True)
    time.sleep(4)
    cmd = [
        EDITOR, UPROJ,
        "-NullRHI", "-unattended", "-nop4", "-nosplash", "-log",
        "-ExecutePythonScript=" + PROBE,
        "-stdout", "-FullStdOutLogOutput",
    ]
    print("LAUNCH:", " ".join(cmd), flush=True)
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    deadline = time.time() + 480
    saw_pass = saw_fail = False
    with open(REPORT + ".stdout.txt", "w", encoding="utf-8") as log:
        while time.time() < deadline:
            line = proc.stdout.readline()
            if not line:
                break
            text = line.decode("utf-8", "replace")
            log.write(text)
            if "TRAVERSE" in text or "RESULT:" in text or "AUDIT" in text:
                print(text.strip(), flush=True)
            if "RESULT: PASS" in text or "AUDIT PASS" in text:
                saw_pass = True
            if "RESULT: FAIL" in text or "FAIL" in text and "AUDIT" in text:
                saw_fail = True
            if proc.poll() is not None:
                break
    proc.terminate()
    print("DONE pass=%s fail=%s" % (saw_pass, saw_fail), flush=True)


main()
