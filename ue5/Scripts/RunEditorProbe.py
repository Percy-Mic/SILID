"""Stream an Unreal editor launch's stdout to a file (reusable driver).

Usage:
  python RunEditorProbe.py <probe.py> [--game]
  --game runs the packaged-style game loop (-game) instead of editor startup.

Waits for RESULT/PASS/FAIL lines, kills the editor at the end, exits nonzero
on FAIL. stdout copy lands next to the probe's own report.
"""

import subprocess
import sys
import time

EDITOR = r"C:\Program Files\Epic Games\UE_5.4\Engine\Binaries\Win64\UnrealEditor.exe"
UPROJ = r"C:\Users\Admin\Downloads\SILID-main\ue5\SILID.uproject"


def main():
    args = sys.argv[1:]
    use_game = "--game" in args
    args = [a for a in args if a != "--game"]
    probe = args[0]

    subprocess.run(["taskkill", "/F", "/IM", "UnrealEditor.exe"], capture_output=True)
    time.sleep(4)

    # Startup -ExecutePythonScript did not fire in -game mode (the script
    # plugin defers until first tick, which NullRHI game mode reaches only
    # after full load). Send the probe through remote execution instead.
    import threading

    def _drive():
        time.sleep(30)  # the log shows LoadMap completes ~17 s in -game mode
        sys.path.insert(0, r"C:\Program Files\Epic Games\UE_5.4\Engine\Plugins\Experimental\PythonScriptPlugin\Content\Python")
        try:
            import remote_execution
            remote_execution.DEFAULT_RECEIVE_BUFFER_SIZE = 4 * 1024 * 1024
            rex = remote_execution.RemoteExecution()
            rex.multicast_bind_address = "127.0.0.1"
            rex.start()
            for _ in range(90):
                if rex.remote_nodes:
                    break
                time.sleep(1)
            if not rex.remote_nodes:
                print("REMOTE FAILED: no node", flush=True)
                return
            node_id = list(rex.remote_nodes.keys())[0] if isinstance(rex.remote_nodes, dict) else rex.remote_nodes[0]
            rex.open_command_connection(node_id)
            command = "exec(compile(open(%r, encoding='utf-8').read(), %r, 'exec'))" % (probe, probe)
            result = rex.run_command(command, unattended=True, raise_on_failure=False)
            print("REMOTE: %s" % str(result.get("result"))[:800], flush=True)
        except Exception as exc:
            print("REMOTE FAILED: %s" % exc, flush=True)

    threading.Thread(target=_drive, daemon=True).start()

    # --rendered: try a real D3D session (the playable test). Default keeps
    # NullRHI for the headless audits.
    rendered = "--rendered" in args
    args = [a for a in args if a != "--rendered"]

    if use_game:
        cmd = [EDITOR, UPROJ, "-game", "-unattended", "-nop4", "-nosplash",
               "-stdout", "-FullStdOutLogOutput", "-log",
               "-ExecutePythonScript=" + probe]
        if not rendered:
            cmd.insert(cmd.index("-unattended"), "-NullRHI")
    else:
        cmd = [EDITOR, UPROJ, "-NullRHI", "-unattended", "-nop4", "-nosplash",
               "-stdout", "-FullStdOutLogOutput", "-log",
               "-ExecutePythonScript=" + probe]
    print("LAUNCH:", " ".join(cmd), flush=True)

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    deadline = time.time() + (300 if not use_game else 240)
    tail_path = probe.rsplit(".", 1)[0] + ".stdout.txt"
    saw_result = saw_fail = False
    with open(tail_path, "w", encoding="utf-8") as log:
        while time.time() < deadline:
            line = proc.stdout.readline()
            if not line:
                break
            text = line.decode("utf-8", "replace")
            log.write(text)
            interesting = ("RESULT" in text or "AUDIT" in text or "TRAVERSE" in text
                           or "[game]" in text or "REMOTE" in text or "Fatal" in text)
            if interesting:
                print(text.strip(), flush=True)
            if "RESULT:" in text:
                saw_result = True
                saw_fail = "FAIL" in text
                break
            if proc.poll() is not None:
                break
    try:
        proc.terminate()
    except Exception:
        pass
    print("DONE result=%s fail=%s" % (saw_result, saw_fail), flush=True)
    raise SystemExit(0 if (saw_result and not saw_fail) else 2)


main()
