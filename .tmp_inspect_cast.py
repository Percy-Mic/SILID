import bpy
src = r"C:\Users\Admin\Downloads\SILID-main\Blender\AssetLibrary\Working\Characters\SILID_Cast_CharMorph_v1.blend"
bpy.ops.wm.open_mainfile(filepath=src)
print("OBJECTS")
for o in bpy.data.objects:
    if o.type in ('MESH','ARMATURE') and not o.name.startswith('WGT'):
        extra=''
        if o.type=='MESH':
            extra=' v=%d t=%d keys=%d dims=%s mats=%s' % (len(o.data.vertices), sum(len(p.vertices)-2 for p in o.data.polygons), len(o.data.shape_keys.key_blocks) if o.data.shape_keys else 0, tuple(round(x,3) for x in o.dimensions), [m.name for m in o.data.materials if m])
        else:
            extra=' bones=%d deform=%d scale=%s' % (len(o.data.bones), len([b for b in o.data.bones if b.use_deform]), tuple(round(x,3) for x in o.scale))
        print(' ', o.type, o.name, 'parent=', o.parent.name if o.parent else None, extra)
print("IMAGES", [(i.name, i.size[:], i.filepath) for i in bpy.data.images])
print("MATERIALS", [m.name for m in bpy.data.materials])
print("SCENE", bpy.context.scene.render.engine, bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y)
