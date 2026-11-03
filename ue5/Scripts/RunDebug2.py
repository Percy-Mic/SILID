import sys, time
sys.path.insert(0, r"C:\Program Files\Epic Games\UE_5.4\Engine\Plugins\Experimental\PythonScriptPlugin\Content\Python")
import remote_execution
rex = remote_execution.RemoteExecution()
rex.start()
for _ in range(60):
    nodes = rex.remote_nodes
    if nodes: break
    time.sleep(1)
nodes = rex.remote_nodes
if isinstance(nodes, dict):
    nid = list(nodes.keys())[0]
elif isinstance(nodes, list) and nodes:
    nid = nodes[0].get('node_id') if isinstance(nodes[0], dict) else nodes[0]
else:
    print(nodes); sys.exit(1)
rex.open_command_connection(nid)
cmd = "exec(open(r'C:/Users/Admin/Downloads/SILID-main/ue5/Scripts/DebugImport2.py').read())"
res = rex.run_command(cmd, unattended=True, raise_on_failure=False)
print(res)
