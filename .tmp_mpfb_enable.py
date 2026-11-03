import bpy, sys
try:
    bpy.ops.preferences.addon_enable(module="bl_ext.user_default.mpfb")
    print("ENABLED")
except Exception as e:
    print("ENABLE FAILED", repr(e))
mods=[a.module for a in bpy.context.preferences.addons if 'mpfb' in a.module]
print("ADDONS", mods)
if mods:
    prefs=bpy.context.preferences.addons[mods[0]].preferences
    prefs.mpfb_user_data=r"C:\Users\Admin\Downloads\SILID-main\.cache_cast\mhdata"
    prefs.mh_user_data=r"C:\Users\Admin\Downloads\SILID-main\.cache_cast\mhdata"
    print("prefs ok", prefs.mpfb_user_data)
    import importlib, sys
    m=importlib.import_module("bl_ext.user_default.mpfb.services.assetservice")
    print("roots", m.AssetService.get_available_data_roots())
    print("skin", m.AssetService.find_asset_absolute_path("old_asian_male.mhmat", asset_subdir="skins"))
