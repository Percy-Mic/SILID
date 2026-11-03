import bpy, sys, os, importlib, math
from mathutils import Vector
bpy.ops.preferences.addon_enable(module="bl_ext.user_default.mpfb")
prefs=bpy.context.preferences.addons["bl_ext.user_default.mpfb"].preferences
prefs.mh_user_data=r"C:\Users\Admin\Downloads\SILID-main\.cache_cast\mhdata"
def dyn(pkg,key):
    for a in sys.modules:
        if a.endswith(pkg):
            return getattr(importlib.import_module(a),key)
    raise RuntimeError(pkg)
HumanService=dyn("mpfb.services.humanservice","HumanService")
AssetService=dyn("mpfb.services.assetservice","AssetService")
TargetService=dyn("mpfb.services.targetservice","TargetService")
HOP=dyn("mpfb.entities.objectproperties","HumanObjectProperties")
print("DEFAULT", TargetService.get_default_macro_info_dict())
print("EYE MHATS", [p.name for p in AssetService.list_mhmat_assets("eyes")])
print("HAIR", [p.name for p in AssetService.list_mhclo_assets("hair")])
B=bpy.context.scene
# clean
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
macro=TargetService.get_default_macro_info_dict()
print("MACRO", macro)
h=HumanService.create_human(macro_detail_dict=macro)
zs=[(h.matrix_world@v.co).z for v in h.data.vertices]
print("H", max(zs)-min(zs), "mins", min(zs), "dims", tuple(round(x,3) for x in h.dimensions), "verts", len(h.data.vertices))
skin=AssetService.find_asset_absolute_path("old_asian_male.mhmat", asset_subdir="skins")
HumanService.set_character_skin(skin,h,skin_type="GAMEENGINE")
print("mats",[m.name for m in h.data.materials if m])
print("imgs",[(i.name,i.size[:]) for i in bpy.data.images])
for sub,f,atype in (("eyes","low-poly.mhclo","Eyes"),("eyebrows","eyebrow001.mhclo","Eyebrows"),("eyelashes","eyelashes01.mhclo","Eyelashes"),("teeth","teeth_base.mhclo","Teeth"),("tongue","tongue01.mhclo","Tongue"),("hair","short02.mhclo","Hair")):
    p=AssetService.find_asset_absolute_path(f,asset_subdir=sub)
    print("asset",sub,f,p)
    if p: HumanService.add_mhclo_asset(p,h,asset_type=atype)
print("children",[(o.name,o.type,len(o.data.vertices) if o.type=='MESH' else '') for o in bpy.data.objects if o!=h])
rig=HumanService.add_builtin_rig(h,"game_engine")
print("rig",rig.name,len(rig.data.bones))
# render
sc=bpy.context.scene
sc.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [i.identifier for i in sc.render.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x=640; sc.render.resolution_y=800; sc.render.film_transparent=False
w=sc.world or bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True
w.node_tree.nodes["Background"].inputs[0].default_value=(0.04,0.045,0.05,1); w.node_tree.nodes["Background"].inputs[1].default_value=0.5
for n,loc,en,sz in (("key",(1.8,-2.2,2.4),500,2.0),("fill",(-2.2,-1.5,1.6),160,2.5),("rim",(-0.8,2.4,2.6),400,1.5)):
    l=bpy.data.lights.new(n,"AREA"); l.energy=en; l.size=sz; o=bpy.data.objects.new(n,l); sc.collection.objects.link(o); o.location=loc
    o.rotation_euler=(Vector((0,0,1.3))-Vector(loc)).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.objects.get("CAM") or bpy.data.objects.new("CAM",bpy.data.cameras.new("CAM")); sc.collection.objects.link(cam)
sc.camera=cam; cam.data.lens=85; cam.location=(0.62,-2.4,1.58); cam.rotation_euler=(Vector((0,0,1.30))-cam.location).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=r"C:\Users\Admin\Downloads\SILID-main\.cache_cast\probe_old.png"
bpy.ops.render.render(write_still=True)
print("RENDERED")
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\Admin\Downloads\SILID-main\.cache_cast\probe_old.blend")
print("SAVED")
