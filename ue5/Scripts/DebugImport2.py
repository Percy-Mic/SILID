import unreal, os
ROOT = r"C:\Users\Admin\Downloads\SILID-main"
PREPARED_ROOT = os.path.join(ROOT, "ue5", "Saved", "ImportReady")
DEST = "/Game/SILID/Furniture"
tools = unreal.AssetToolsHelpers.get_asset_tools()

source = os.path.join(PREPARED_ROOT, "stripped", "SILID_bookshelf.glb")
task = unreal.AssetImportTask()
task.filename = source
task.destination_path = DEST
task.destination_name = "SM_DEBUG_BOOKSHELF2"
task.automated = True
task.replace_existing = True
task.save = True
task.options = unreal.FbxImportUI()
tools.import_asset_tasks([task])
print("imported_object_paths:", list(task.imported_object_paths or []))
# Also list what's in destination
assets = unreal.EditorAssetLibrary.list_assets(DEST, recursive=False)
print("ASSETS:", assets)
