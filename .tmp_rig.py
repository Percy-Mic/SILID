import bpy
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\Admin\Downloads\SILID-main\Blender\AssetLibrary\Working\Characters\SILID_Cast_v2.blend")
for tag in ("Marco","Caretaker"):
    b=bpy.data.objects["CHR_"+tag]; r=bpy.data.objects["CHR_"+tag+"_rig"]
    print("==",tag,"rig scale",tuple(round(x,4) for x in r.scale),"rig dims",tuple(round(x,4) for x in r.dimensions),"loc",tuple(round(x,3) for x in r.location))
    print("mods",[(m.name,m.type,getattr(m,'object',None).name if getattr(m,'object',None) else '') for m in b.modifiers])
    dg=bpy.context.evaluated_depsgraph_get(); ev=b.evaluated_get(dg); me=ev.to_mesh()
    zs=[(b.matrix_world@v.co).z for v in me.vertices]; print("eval z",round(min(zs),4),round(max(zs),4))
    ev.to_mesh_clear()
    zs=[(b.matrix_world@v.co).z for v in b.data.vertices]; print("raw z",round(min(zs),4),round(max(zs),4))
    print("parent inv",tuple(round(x,4) for x in b.matrix_parent_inverse.to_scale()))
