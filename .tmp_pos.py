import bpy
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\Admin\Downloads\SILID-main\Blender\AssetLibrary\Working\Characters\SILID_Cast_v2.blend")
for tag in ("Marco","Caretaker"):
    b=bpy.data.objects["CHR_"+tag]; r=bpy.data.objects["CHR_"+tag+"_rig"]
    print(tag,"body loc",tuple(round(x,3) for x in b.location),"rig loc",tuple(round(x,3) for x in r.location),"parent",b.parent.name)
    print("  matrix_world", [tuple(round(x,3) for x in row) for row in b.matrix_world])
    print("  parent_inv", [tuple(round(x,3) for x in row) for row in b.matrix_parent_inverse])
    zs=[(b.matrix_world@v.co).z for v in b.data.vertices]
    print("  world z", round(min(zs),3), round(max(zs),3))
    print("  dims", tuple(round(x,3) for x in b.dimensions))
