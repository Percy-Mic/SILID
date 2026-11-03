import bpy
from mathutils import Vector
dg=bpy.context.evaluated_depsgraph_get()
pts=[("GF-04",-20.5,6.0,0.0),("GF-05",-20.5,9.5,0.0),("FF2-03",-2.0,-6.5,4.2),("FF2-01",-7.0,0.0,4.2),("FF2-09",-17.5,7.0,4.2),("GF-14",-0.5,6.5,0.0)]
for name,x,z,y in pts:
    hit,loc,n,i,ob,m=bpy.context.scene.ray_cast(dg, Vector((x,z,y+0.6)), Vector((0,0,-1)), distance=1.4)
    print("DOWN",name, "hit", round(loc.z,2) if hit else None, ob.name if ob else None)
    # is there any GF_Floor polygon near this point? sample bbox of object
for ob in bpy.data.objects:
    if ob.name in ('GF_Floor','F2_Floor','GF_Ceiling','F2_Ceiling'):
        print("OBJ", ob.name, [round(v,2) for v in ob.location], len(ob.data.polygons))
