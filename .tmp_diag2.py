import bpy
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\Admin\Downloads\SILID-main\Blender\AssetLibrary\Working\Characters\SILID_Cast_Sculpt_v2.blend")
for mn in ("SKIN_Marco","CLOTH_Tee","CLOTH_Jeans","EYE_Marco","MBlab_m_hair","Human.body"):
    m=bpy.data.materials.get(mn)
    if not m: print("NO MAT",mn); continue
    print("MAT",mn,"use_nodes",m.use_nodes,"blend",getattr(m,'blend_method',''))
    if m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type in ('BSDF_PRINCIPLED','TEX_IMAGE','MIX_RGB','MIX','VERTEX_COLOR','SEPARATE_COLOR','NORMAL_MAP'):
                vals={}
                for i in n.inputs:
                    if i.name in ('Base Color','Color1','Color2','Fac','Roughness','Strength','Color','Alpha'):
                        try: vals[i.name]=tuple(round(x,3) for x in i.default_value) if hasattr(i.default_value,'__len__') else round(i.default_value,3)
                        except: pass
                print("  ",n.type,n.name,vals, getattr(n,'image',None).name if getattr(n,'image',None) else '')
        for l in m.node_tree.links:
            if l.to_node.type in ('BSDF_PRINCIPLED','MIX_RGB','MIX','NORMAL_MAP'):
                print("   L",l.from_node.name,l.from_socket.name,"->",l.to_node.name,l.to_socket.name)
for on in ("CHR_Marco","CHR_Marco_Tee","CHR_Marco.low-poly","CHR_Marco.short01"):
    o=bpy.data.objects.get(on)
    if not o: print("NO OBJ",on); continue
    print("OBJ",on,"verts",len(o.data.vertices),"uv",[u.name for u in o.data.uv_layers],"mats",[m.name for m in o.data.materials if m],"loc",tuple(round(x,3) for x in o.location))
    if o.data.uv_layers:
        us=[d.uv[:] for d in o.data.uv_layers.active.data[:20]]
        print("  uv sample",[(round(u[0],2),round(u[1],2)) for u in us[:6]])
