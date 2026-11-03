import unreal
assets = unreal.EditorAssetLibrary.list_assets('/Game/SILID/Furniture', recursive=True)
for a in sorted(assets):
    print(a)
