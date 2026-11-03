import unreal, os
ROOT = r"C:\Users\Admin\Downloads\SILID-main"
PREPARED_ROOT = os.path.join(ROOT, "ue5", "Saved", "ImportReady")
DEST = "/Game/SILID/Furniture"
tools = unreal.AssetToolsHelpers.get_asset_tools()

source = os.path.join(PREPARED_ROOT, "SILID_bookshelf.glb")
task = unreal.AssetImportTask()
task.filename = source
task.destination_path = DEST
task.destination_name = "SM_DEBUG_BOOKSHELF9"
task.automated = True
task.replace_existing = True
task.save = True
# Try to configure options
try:
    import unreal
    # Try to get interchange settings
    pass
except:
    pass
tools.import_asset_tasks([task])
print("imported_object_paths:", list(task.imported_object_paths or []))
assets = unreal.EditorAssetLibrary.list_assets(DEST, recursive=True)
for a in assets:
    if "BOOKSHELF" in a.upper():
        print("FOUND:", a)
        mesh = unreal.load_asset(a)
        if mesh:
            print("MESH_OK")
        break
