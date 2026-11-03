# Two isolation tests, run in a fully-started editor through remote execution.
# Interchange GLB import deadlocks at its first embedded texture build on this
# machine; these tests answer (1) whether a standalone texture import works,
# and (2) whether a texture-stripped GLB imports cleanly. Each test is a
# separate remote command so a hang in one still reports the other.

import sys
import time

sys.path.insert(0, r"C:\Program Files\Epic Games\UE_5.4\Engine\Plugins\Experimental\PythonScriptPlugin\Content\Python")
import remote_execution

remote_execution.DEFAULT_RECEIVE_BUFFER_SIZE = 4 * 1024 * 1024

TESTS = [
    (
        "jpg-texture-import",
        "import unreal\n"
        "task = unreal.AssetImportTask()\n"
        "task.filename = r'C:\\Users\\Admin\\Downloads\\SILID-main\\public\\assets\\textures\\teak_veneer\\teak_veneer_diff_1k.jpg'\n"
        "task.destination_path = '/Game/SILID/Tests'\n"
        "task.destination_name = 'T_ImportTest'\n"
        "task.automated = True\n"
        "task.save = True\n"
        "unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])\n"
        "print('JPG-IMPORT-OK', bool(unreal.load_asset('/Game/SILID/Tests/T_ImportTest.T_ImportTest')))\n",
    ),
    (
        "stripped-glb-import",
        "import unreal\n"
        "task = unreal.AssetImportTask()\n"
        "task.filename = r'C:\\Users\\Admin\\Downloads\\SILID-main\\ue5\\Saved\\ImportReady\\stripped\\SILID_bookshelf.glb'\n"
        "task.destination_path = '/Game/SILID/Furniture'\n"
        "task.destination_name = 'SM_TestBookshelf'\n"
        "task.automated = True\n"
        "task.save = True\n"
        "unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])\n"
        "print('GLB-IMPORT-OK', list(task.imported_object_paths))\n",
    ),
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
    log("ERROR: no editor node")
    sys.exit(1)
node_id = list(nodes.keys())[0] if isinstance(nodes, dict) else nodes[0]
rex.open_command_connection(node_id)
log("connected: %s" % node_id)

for name, code in TESTS:
    log("TEST START: %s" % name)
    started = time.time()
    try:
        result = rex.run_command(code, unattended=True, raise_on_failure=False)
    except Exception as exc:
        log("TEST %s: HUNG/RECEIPT-ERROR after %.1fs: %s" % (name, time.time() - started, exc))
        continue
    log("TEST %s: %s in %.1fs :: %s" % (
        name, "OK" if result.get("success") else "FAILED",
        time.time() - started, str(result.get("result"))[:500]))

log("ALL TESTS DONE")
