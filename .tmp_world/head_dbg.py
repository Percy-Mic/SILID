import bpy, json
from mathutils import Vector
p=json.load(open('Blender/AssetLibrary/Working/World/_build/world_plan.json')) if False else None
dg=bpy.context.evaluated_depsgraph_get()
def ray(o,d,dist):
    hit,loc,n,i,ob,m=bpy.context.scene.ray_cast(dg,Vector(o),Vector(d),distance=dist)
    return (loc.z, ob.name) if hit else (None,None)
# stair profile: sample along the flight and see what is overhead
for z in [4.4,5.2,6.0,6.8,7.6,8.4,8.8,9.1]:
    print('UP at z=%.1f'%z, ray((-2.87,0,z+0.2),(0,0,1),3.4), ray((-3.6,0,z+0.2),(0,0,1),3.4))
