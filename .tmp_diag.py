import bpy, os
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\Admin\Downloads\SILID-main\.cache_cast\probe_old.blend")
sc=bpy.context.scene
h=bpy.data.objects.get("Human")
print("OBJ", h.name, "scale", tuple(h.scale), "dims", tuple(h.dimensions))
for m in h.data.materials:
    print("MAT", m.name, "use_nodes", m.use_nodes, "blend", m.blend_method)
    if m.use_nodes:
        for n in m.node_tree.nodes:
            print("   NODE", n.type, n.name, [(i.name, getattr(i,'default_value',None) if not hasattr(getattr(i,'default_value',None),'__len__') else tuple(i.default_value)[:4]) for i in n.inputs if i.name in ('Base Color','Roughness','Metallic','Alpha','Subsurface Weight')])
        for l in m.node_tree.links:
            print("   LINK", l.from_node.name, l.from_socket.name, "->", l.to_node.name, l.to_socket.name)
img=bpy.data.images.get('old_lightskinned_male_diffuse2.png')
if img:
    print("IMG", img.size[:], img.colorspace_settings.name, "pixels", len(img.pixels))
    px=list(img.pixels[:4000])
    print("avg first 1000", [round(sum(px[i::4])/1000,3) for i in range(4)])
# save preview of skin texture
try:
    img.scale(900,900); img.filepath_raw=r"C:\Users\Admin\Downloads\SILID-main\.cache_cast\preview\skin_old.png"; img.file_format='PNG'; img.save()
    print("SKIN PREVIEW SAVED")
except Exception as e: print("skin prev err", e)
# workbench render
sc.render.engine='BLENDER_WORKBENCH'
sc.display.shading.light='STUDIO'; sc.display.shading.color_type='TEXTURE'
sc.render.resolution_x=640; sc.render.resolution_y=800
sc.render.filepath=r"C:\Users\Admin\Downloads\SILID-main\.cache_cast\probe_workbench.png"
bpy.ops.render.render(write_still=True)
print("WB RENDERED")
