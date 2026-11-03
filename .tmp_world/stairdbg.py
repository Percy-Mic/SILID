import bpy
from mathutils import Vector
dg=bpy.context.evaluated_depsgraph_get()
for (x,z,y) in [(-2.87,7.34,10.57),(-3.9,7.3,6.2),(-4.4,8.9,1.0),(-2.87,5.0,9.4)]:
    hit,loc,n,i,ob,m = bpy.context.scene.ray_cast(dg, Vector((x,z,y+0.08)), Vector((0,0,1)), distance=4.0)
    print("UP", x,z,y, "->", round(loc.z-y,2) if hit else None, ob.name if ob else None)
