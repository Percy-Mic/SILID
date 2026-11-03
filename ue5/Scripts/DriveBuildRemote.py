# Drive the SILID build inside a fully-started Unreal Editor through Python
# remote execution. Startup-time -ExecutePythonScript deadlocked on the first
# GLB texture build (three reproductions, 2026-11-02) because the main loop
# cannot pump the texture compiler while the startup hook holds the game
# thread; a command arriving on a running editor ticks normally and pumps.
#
# Run with the engine's own interpreter:
#   .../Engine/Binaries/ThirdParty/Python3/Win64/python.exe DriveBuildRemote.py

import sys
import time

sys.path.insert(0, r"C:\Program Files\Epic Games\UE_5.4\Engine\Plugins\Experimental\PythonScriptPlugin\Content\Python")
import remote_execution

# The shipped client does a single recv(8192) per response — large results
# truncate mid-JSON. Commands here are tiny (see below), and the buffer is
# raised anyway as a guard against console output pushing a reply past 8 KB.
remote_execution.DEFAULT_RECEIVE_BUFFER_SIZE = 4 * 1024 * 1024

PHASES = [
    r"C:\Users\Admin\Downloads\SILID-main\ue5\Scripts\ReplaceRoomWithGroundFloorPlan.py",
    r"C:\Users\Admin\Downloads\SILID-main\ue5\Scripts\PopulateGroundFloor.py",
    r"C:\Users\Admin\Downloads\SILID-main\ue5\Scripts\BuildUpperFloorsAndBasement.py",
    r"C:\Users\Admin\Downloads\SILID-main\ue5\Scripts\DressArchitecturalDetail.py",
]


def log(msg):
    print(msg, flush=True)


rex = remote_execution.RemoteExecution()
rex.start()
nodes = None
for _ in range(90):
    nodes = rex.remote_nodes
    if nodes:
        break
    time.sleep(1)
if not nodes:
    log("ERROR: no remote editor node discovered within 90 s")
    sys.exit(1)

node_id = list(nodes.keys())[0] if isinstance(nodes, dict) else nodes[0]
log("Editor node: %s" % node_id)
rex.open_command_connection(node_id)

probe = rex.run_command("print('remote-alive')", unattended=True, raise_on_failure=False)
if not probe.get("success"):
    log("ERROR: probe failed: %s" % probe.get("result"))
    sys.exit(1)
log("Probe ok: %s" % str(probe.get("result"))[:200])

for path in PHASES:
    name = path.rsplit("\\", 1)[-1]
    log("PHASE START: %s" % name)
    # Send a tiny launcher, not the script source: the remote result echoes
    # the command verbatim, and a full script echo overflows the client's
    # single-recv response reader.
    command = "exec(compile(open(%r, encoding='utf-8').read(), %r, 'exec'))" % (path, path)
    started = time.time()
    try:
        result = rex.run_command(command, unattended=True, raise_on_failure=False)
    except Exception as exc:  # receipt failure; verify against the editor log
        log("PHASE %s: receipt error after %.1fs: %s" % (name, time.time() - started, exc))
        time.sleep(5)
        continue
    elapsed = time.time() - started
    ok = result.get("success")
    log("PHASE %s: %s in %.1fs" % (name, "OK" if ok else "FAILED", elapsed))
    log(str(result.get("result"))[:3000])
    if not ok:
        sys.exit(2)

log("ALL REMOTE PHASES DONE")
