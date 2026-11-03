import bpy
from mathutils import Vector
bpy.ops.import_scene.gltf(filepath="public/assets/models/furniture.glb")
for o in sorted((o for o in bpy.data.objects if o.type=='MESH'), key=lambda o:o.name):
    bb=[o.matrix_world@Vector(c) for c in o.bound_box]
    mn=Vector((min(v.x for v in bb),min(v.y for v in bb),min(v.z for v in bb)))
    mx=Vector((max(v.x for v in bb),max(v.y for v in bb),max(v.z for v in bb)))
    print("%-18s size %5.2f %5.2f %5.2f  min %6.2f %6.2f %6.2f  origin %5.2f %5.2f %5.2f" % (
        o.name, mx.x-mn.x, mx.y-mn.y, mx.z-mn.z, mn.x, mn.y, mn.z, o.location.x, o.location.y, o.location.z))
