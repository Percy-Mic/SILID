import unreal

DEST = "/Game/SILID/Furniture"
keys = ["bookshelf", "sofa", "table", "chair", "armchair", "bed", "nightstand", 
        "round_table", "vase", "plant", "oil_lamp", "kettle", "alarm_clock", 
        "wall_clock", "tea_set", "door"]

# Try to create simple static meshes
for key in keys:
    asset_name = "SM_SILID_" + key
    asset_path = DEST + "/" + asset_name
    # Check if exists
    if unreal.EditorAssetLibrary.does_asset_exist(asset_path):
        print("exists", asset_path)
        continue
    # Create a simple box mesh using ProceduralMeshComponent? Or use existing methods
    # Easier way: create a cube static mesh via editor utilities
    try:
        # Try to create from a basic shape
        factory = unreal.StaticMeshFactory()
        mesh = factory.factory_create_new(asset_path)
        if mesh:
            unreal.EditorAssetLibrary.save_asset(asset_path)
            print("created", asset_path)
        else:
            print("failed", asset_path)
    except Exception as e:
        print("err", key, e)

# Also save
unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
