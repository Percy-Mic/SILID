import json, struct, os
import numpy as np
def load(p):
    with open(p,'rb') as fh:
        fh.read(12); clen,_=struct.unpack('<II',fh.read(8)); js=json.loads(fh.read(clen).decode())
        blen,_=struct.unpack('<II',fh.read(8)); bin=fh.read(blen)
    return js,bin
def trs(n):
    if 'matrix' in n: return np.array(n['matrix'],dtype=float).reshape(4,4).T
    T=np.eye(4);R=np.eye(4);S=np.eye(4)
    if 'translation' in n:T[:3,3]=n['translation']
    if 'rotation' in n:
        x,y,z,w=n['rotation']
        R[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
    if 'scale' in n:S[0,0],S[1,1],S[2,2]=n['scale']
    return T@R@S
for f in ['interogation_room.glb','the_great_drawing_room.glb','the_billiards_room.glb']:
    js,bin=load(os.path.join('Blender/AssetLibrary',f))
    nodes=js['nodes'];world={}
    def walk(i,p):
        m=p@trs(nodes[i]);world[i]=m
        for c in nodes[i].get('children',[]): walk(c,m)
    for r in js['scenes'][js.get('scene',0)]['nodes']:walk(r,np.eye(4))
    P=[]
    for i,n in enumerate(nodes):
        if 'mesh' not in n:continue
        m=world[i]
        for pr in js['meshes'][n['mesh']]['primitives']:
            a=js['accessors'][pr['attributes']['POSITION']]
            bv=js['bufferViews'][a['bufferView']];off=bv.get('byteOffset',0)+a.get('byteOffset',0)
            arr=np.frombuffer(bin,dtype='<f4',count=a['count']*3,offset=off).reshape(-1,3).astype(float)
            P.append((m@np.c_[arr,np.ones(len(arr))].T).T[:,:3])
    P=np.vstack(P)
    lo,hi=P.min(0),P.max(0)
    print('='*70); print(f); print(' bbox', np.round(lo,2), np.round(hi,2), 'size', np.round(hi-lo,2))
    # interior band in height (avoid floor/ceiling)
    floor=lo[1]
    band=P[(P[:,1]>floor+0.35)&(P[:,1]<floor+2.1)]
    for axis,name in [(0,'x=lo'),(0,'x=hi'),(2,'z=lo'),(2,'z=hi')]:
        side = lo[axis] if name.endswith('lo') else hi[axis]
        sel=band[np.abs(band[:,axis]-side)<0.45]
        other = 2 if axis==0 else 0
        if len(sel)==0: print('  ',name,'no pts'); continue
        vals=sel[:,other]
        hist,edges=np.histogram(vals,bins=np.arange(vals.min(),vals.max()+0.1,0.1))
        # gaps: consecutive empty bins
        gaps=[];run=None
        for k,h in enumerate(hist):
            if h<=2:
                if run is None: run=[edges[k],edges[k+1]]
                else: run[1]=edges[k+1]
            else:
                if run and run[1]-run[0]>0.55: gaps.append((round(run[0],2),round(run[1],2)))
                run=None
        if run and run[1]-run[0]>0.55: gaps.append((round(run[0],2),round(run[1],2)))
        print('  ',name,'pts',len(sel),'gaps>0.55:',gaps)
