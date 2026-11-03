import bpy
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\Admin\Downloads\SILID-main\Blender\AssetLibrary\Working\Characters\SILID_Cast_v2.blend")
for tag in ("Marco","Caretaker"):
    h=bpy.data.objects.get("CHR_%s.short0%s"%(tag, "1" if tag=="Marco" else "2"))
    print("==",tag,"hair",h.name if h else None)
    if not h: continue
    for m in h.data.materials:
        print(" mat",m.name,"blend",m.blend_method)
        if m.use_nodes:
            for n in m.node_tree.nodes:
                print("   ",n.type,n.name,getattr(n,'image',None).name if getattr(n,'image',None) else '')
            for l in m.node_tree.links:
                print("   L",l.from_node.name,l.from_socket.name,"->",l.to_node.name,l.to_socket.name)
