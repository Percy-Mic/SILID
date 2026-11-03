# Continue the SILID room build after the ground-floor plan is already in.
import sys
import time

sys.path.insert(0, r"C:\Program Files\Epic Games\UE_5.4\Engine\Plugins\Experimental\PythonScriptPlugin\Content\Python")
import remote_execution

remote_execution.DEFAULT_RECEIVE_BUFFER_SIZE = 4 * 1024 * 1024

PHASES = [
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
log("Probe ok")

for path in PHASES:
    name = path.rsplit("\\", 1)[-1]
    log("PHASE START: %s" % name)
    command = "exec(compile(open(%r, encoding='utf-8').read(), %r, 'exec'))" % (path, path)
    started = time.time()
    try:
        result = rex.run_command(command, unattended=True, raise_on_failure=False)
    except Exception as exc:
        log("PHASE %s: receipt error after %.1fs: %s" % (name, time.time() - started, exc))
        sys.exit(3)
    elapsed = time.time() - started
    ok = result.get("success")
    log("PHASE %s: %s in %.1fs" % (name, "OK" if ok else "FAILED", elapsed))
    log(str(result.get("result"))[:4000])
    if not ok:
        sys.exit(2)

log("ALL REMAINING PHASES DONE")
