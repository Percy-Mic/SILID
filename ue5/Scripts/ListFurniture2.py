import unreal
for base in ["/Game/SILID/Furniture", "/Game/SILID", "/Game"]:
    try:
        assets = unreal.EditorAssetLibrary.list_assets(base, recursive=True)
        for a in assets:
            print(a)
    except Exception as e:
        print("ERR", base, e)
