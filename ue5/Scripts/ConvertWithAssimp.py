import pyassimp
import os
import sys

SOURCE_DIR = r"C:\Users\Admin\Downloads\SILID-main\ue5\Saved\ImportReady"
DEST_DIR = os.path.join(SOURCE_DIR, "assimp_out")
os.makedirs(DEST_DIR, exist_ok=True)

for name in sorted(os.listdir(SOURCE_DIR)):
    if not name.lower().endswith('.glb'):
        continue
    src = os.path.join(SOURCE_DIR, name)
    dst = os.path.join(DEST_DIR, name.replace('.glb', '.obj'))  # try obj
    try:
        scene = pyassimp.load(src)
        # Try to export as obj
        pyassimp.export(scene, dst, 'obj')
        print(f'OK {name} -> {dst}')
        pyassimp.release(scene)
    except Exception as e:
        print(f'ERR {name}: {e}')
