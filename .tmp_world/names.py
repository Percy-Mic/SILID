import bpy, collections
for c in bpy.context.scene.collection.children:
    print("COLL", c.name, len(c.objects))
    names = sorted(o.name for o in c.objects)
    print("  ", ", ".join(names[:60]))
print("SCENE", bpy.context.scene.name)
for o in bpy.data.objects:
    if o.type in ('CAMERA','LIGHT','EMPTY'):
        print("SPECIAL", o.type, o.name, tuple(round(v,1) for v in o.location))
