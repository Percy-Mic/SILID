import bpy, os
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\Admin\Downloads\SILID-main\Blender\AssetLibrary\Working\Characters\SILID_Cast_v2.blend")
sc=bpy.context.scene
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=48; sc.cycles.use_denoising=True
sc.render.resolution_x=760; sc.render.resolution_y=950
for tag in ("Marco","Caretaker"):
    body=bpy.data.objects["CHR_"+tag]; rig=bpy.data.objects["CHR_"+tag+"_rig"]
    print(tag, "body loc", tuple(body.location), "parent", body.parent.name if body.parent else None, "world", tuple(round(v,3) for v in body.matrix_world.translation))
    rig.location=(0,0,0); body.location=(0,0,0)
    for o in bpy.data.objects:
        if o.parent==body: o.location=(0,0,0)
    bpy.context.view_layer.update()
    print(tag, "after world", tuple(round(v,3) for v in body.matrix_world.translation), "dims", tuple(round(v,3) for v in body.dimensions))
    cam=bpy.data.objects.get("CAM_Portrait")
    if not cam:
        cam=bpy.data.objects.new("CAM_Portrait", bpy.data.cameras.new("CAM_Portrait")); sc.collection.objects.link(cam)
    cam.data.lens=85; cam.location=(0.30,-1.42,1.60); cam.rotation_euler=(Vector((0,0,1.49))-Vector(cam.location)).to_track_quat('-Z','Y').to_euler()
    sc.camera=cam
    # hide other
    other=bpy.data.objects["CHR_"+("Caretaker" if tag=="Marco" else "Marco")]
    other.hide_render=True
    for o in bpy.data.objects:
        if o.parent==other: o.hide_render=True
    sc.render.filepath=r"C:\Users\Admin\Downloads\SILID-main\Blender\AssetLibrary\Working\Characters\shots\base_%s.png"%tag
    bpy.ops.render.render(write_still=True)
    other.hide_render=False
    for o in bpy.data.objects:
        if o.parent==other: o.hide_render=False
print("DONE")
