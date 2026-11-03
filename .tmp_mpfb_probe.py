import bpy, sys, os, importlib
root = r"C:\Users\Admin\Downloads\SILID-main\.cache_cast\mhdata"
try:
    bpy.ops.preferences.addon_enable(module="mpfb")
    print("ENABLED")
except Exception as e:
    print("ENABLE FAILED", e)
print("ADDONS", [a.module for a in bpy.context.preferences.addons if 'mpfb' in a.module])
prefs = bpy.context.preferences.addons["mpfb"].preferences
prefs.mpfb_user_data = root
print("prefs", prefs.mpfb_user_data)
def dyn(pkg,key):
    for amod in sys.modules:
        if amod.endswith(pkg):
            m=importlib.import_module(amod)
            return getattr(m,key)
    raise RuntimeError(pkg)
HumanService = dyn("mpfb.services.humanservice","HumanService")
AssetService = dyn("mpfb.services.assetservice","AssetService")
HumanObjectProperties = dyn("mpfb.entities.objectproperties","HumanObjectProperties")
TargetService = dyn("mpfb.services.targetservice","TargetService")
print("roots", AssetService.get_available_data_roots())
for f in ("middleage_asian_male.mhmat","old_asian_male.mhmat"):
    print(f, AssetService.find_asset_absolute_path(f, asset_subdir="skins"))
print("hair", AssetService.find_asset_absolute_path("short02.mhclo", asset_subdir="hair"))
print("eyes", AssetService.list_mhclo_assets("eyes")[:5])
h = HumanService.create_human()
print("created", h.name, h.type, len(h.data.vertices))
# measure bbox
import mathutils
zs=[(h.matrix_world @ v.co).z for v in h.data.vertices]
print("height", max(zs)-min(zs), "minz", min(zs), "dims", tuple(h.dimensions))
print("props", h.name)
for k in ("age","gender","asian","caucasian","african","height","weight","muscle","proportions"):
    try: print(k, HumanObjectProperties.get_value(k, entity_reference=h))
    except Exception as e: print(k, "ERR", e)
mhmat = AssetService.find_asset_absolute_path("old_asian_male.mhmat", asset_subdir="skins")
HumanService.set_character_skin(mhmat, h, skin_type="MAKESKIN")
print("skinned", [m.name for m in h.data.materials if m])
print("images", [(i.name, i.size[:]) for i in bpy.data.images][:10])
rig = HumanService.add_builtin_rig(h, "game_engine")
print("rig", rig.name, len(rig.data.bones), "deform", len([b for b in rig.data.bones if b.use_deform]))
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\Admin\Downloads\SILID-main\.cache_cast\probe_old.blend")
print("SAVED")
