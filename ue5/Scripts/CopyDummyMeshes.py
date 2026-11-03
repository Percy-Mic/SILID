import unreal

DEST = "/Game/SILID/Furniture"
source = "/Game/SILID/Interiors/SM_GreatDrawingRoom"
keys = ["bookshelf", "sofa", "table", "chair", "armchair", "bed", "nightstand", 
        "round_table", "vase", "plant", "oil_lamp", "kettle", "alarm_clock", 
        "wall_clock", "tea_set", "door"]

for key in keys:
    asset_name = "SM_SILID_" + key
    asset_path = DEST + "/" + asset_name
    if unreal.EditorAssetLibrary.does_asset_exist(asset_path):
        print("exists", asset_path)
        continue
    try:
        ok = unreal.EditorAssetLibrary.duplicate_asset(source, asset_path)
        print(key, ok)
    except Exception as e:
        print("err", key, e)

unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
