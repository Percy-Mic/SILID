import bpy, json, sys
from mathutils import Vector
out = {"file": bpy.data.filepath, "scenes": [], "collections": [], "counts": {}, "bbox": {}}
for sc in bpy.data.scenes:
    out["scenes"].append({"name": sc.name, "objects": len(sc.objects)})
objs = list(bpy.data.objects)
out["total_objects"] = len(objs)
types = {}
for o in objs:
    types[o.type] = types.get(o.type, 0) + 1
out["types"] = types
def walk(c, depth=0):
    out["collections"].append({"name": c.name, "depth": depth, "objects": len(c.objects)})
    if depth < 2:
        for ch in c.children:
            walk(ch, depth+1)
for c in bpy.data.collections:
    if c.users and not any(c.name in x.get("name","") for x in []):
        pass
for c in bpy.context.scene.collection.children:
    walk(c)
# world bbox of mesh objects
mn = Vector((1e9,1e9,1e9)); mx = Vector((-1e9,-1e9,-1e9))
for o in objs:
    if o.type == 'MESH':
        for corner in o.bound_box:
            w = o.matrix_world @ Vector(corner)
            for i in range(3):
                mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
out["bbox"] = {"min": [round(v,2) for v in mn], "max": [round(v,2) for v in mx]}
out["materials"] = len(bpy.data.materials)
out["images"] = [i.name for i in bpy.data.images][:20]
print("INSPECT_JSON_START")
print(json.dumps(out, indent=1))
print("INSPECT_JSON_END")
