import bpy
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\Admin\Downloads\SILID-main\Blender\AssetLibrary\Working\Characters\SILID_Cast_Sculpt_v2.blend")
m=bpy.data.materials.get("CLOTH_Tee")
print("MAT",m.name,"nodes",[(n.type,n.name) for n in m.node_tree.nodes])
b=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
print("base",tuple(round(x,4) for x in b.inputs["Base Color"].default_value),"rough",b.inputs["Roughness"].default_value)
print("links to base",[(l.from_node.type,l.from_socket.name) for l in m.node_tree.links if l.to_socket==b.inputs["Base Color"]])
print("links to normal",[(l.from_node.type,l.from_socket.name) for l in m.node_tree.links if l.to_socket==b.inputs["Normal"]])
for on in ("CHR_Marco_Tee","CHR_Marco_Collar"):
    o=bpy.data.objects.get(on)
    print(on,"mats",[mm.name if mm else None for mm in o.data.materials],"slots",len(o.material_slots),"polys",len(o.data.polygons))
    print("  z range",round(min((o.matrix_world@v.co).z for v in o.data.vertices),3),round(max((o.matrix_world@v.co).z for v in o.data.vertices),3))
# sample material color by rendering a sphere
sc=bpy.context.scene
for ob in list(bpy.data.objects):
    if ob.type not in ('LIGHT','CAMERA'): ob.hide_render=True
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(0,0,0))
s=bpy.context.object; s.data.materials.append(m); s.hide_render=False
cam=bpy.data.objects.get("CAM_close") or bpy.data.objects.new("C",bpy.data.cameras.new("C")); sc.collection.objects.link(cam)
cam.location=(0,-2.2,0); cam.rotation_euler=(1.5708,0,0); sc.camera=cam
sc.render.resolution_x=300; sc.render.resolution_y=300; sc.cycles.samples=16
sc.render.filepath=r"C:\Users\Admin\Downloads\SILID-main\.cache_cast\clothcheck.png"
bpy.ops.render.render(write_still=True)
print("DONE")
