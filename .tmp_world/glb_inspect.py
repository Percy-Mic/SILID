import bpy, json
from mathutils import Vector
for path, tag in [("public/assets/models/car.glb","CAR"),("public/assets/models/furniture.glb","FURN"),("public/assets/rooms/the_great_drawing_room.glb","ROOM")]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.gltf(filepath=path)
    except Exception as e:
        print("GLB", tag, "FAIL", e); continue
    objs=[o for o in bpy.data.objects if o.type=='MESH']
    mn=Vector((1e9,)*3); mx=Vector((-1e9,)*3)
    for o in objs:
        for c in o.bound_box:
            w=o.matrix_world@Vector(c)
            for i in range(3):
                mn[i]=min(mn[i],w[i]); mx[i]=max(mx[i],w[i])
    print("GLB", tag, "meshes", len(objs), "tris", sum(len(o.data.polygons) for o in objs),
          "size", [round(mx[i]-mn[i],2) for i in range(3)],
          "min", [round(v,2) for v in mn])
    print("   names:", ", ".join(sorted(o.name for o in objs)[:24]))
