import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
def up(x, z):
    hit, loc, n, i, ob, m = bpy.context.scene.ray_cast(dg, Vector((x, z, 1.6)), Vector((0, 0, 1)), distance=3.0)
    return ob.name if hit else '--'
print('     ', ' '.join('z%.2f' % z for z in [4.0, 4.6, 5.2, 5.8, 6.4, 7.0, 7.6, 8.2, 8.8, 9.4]))
for x in [-5.4, -4.8, -4.2, -3.6, -3.0, -2.4, -1.8]:
    print('x%5.1f' % x, ' '.join('%-6s' % up(x, z)[:6] for z in [4.0, 4.6, 5.2, 5.8, 6.4, 7.0, 7.6, 8.2, 8.8, 9.4]))
