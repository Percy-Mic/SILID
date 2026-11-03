"""Room asset measurement from the floor slab, not the bounding box.

A photogrammetry shell's bbox includes stray triangles and the ceiling; the
floor is the one surface that is flat, complete, and exactly as big as the room.
So: take the wall faces' normals to find the room's yaw, rotate, then read the
floor's centre and extents. Output is the transform the Blender preparer needs.
"""
import json, struct, os, sys
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

def collect(path):
    js,bin=load(path); nodes=js['nodes']; world={}
    def walk(i,p):
        m=p@trs(nodes[i]); world[i]=m
        for c in nodes[i].get('children',[]): walk(c,m)
    for r in js['scenes'][js.get('scene',0)]['nodes']: walk(r,np.eye(4))
    P=[];N=[]
    for i,n in enumerate(nodes):
        if 'mesh' not in n: continue
        m=world[i]; nm=np.linalg.inv(m).T
        for pr in js['meshes'][n['mesh']]['primitives']:
            A=pr['attributes']
            def arr(slot):
                a=js['accessors'][A[slot]]; bv=js['bufferViews'][a['bufferView']]
                off=bv.get('byteOffset',0)+a.get('byteOffset',0)
                return np.frombuffer(bin,dtype='<f4',count=a['count']*3,offset=off).reshape(-1,3).astype(float)
            p_=arr('POSITION'); n_=arr('NORMAL') if 'NORMAL' in A else np.zeros_like(p_)
            P.append((m@np.c_[p_,np.ones(len(p_))].T).T[:,:3])
            hv=np.c_[n_,np.zeros(len(n_))]@nm.T
            N.append(hv[:,:3])
    return np.vstack(P), np.vstack(N)

def rot(P,a):
    c,s=np.cos(a),np.sin(a)
    return np.stack([P[:,0]*c-P[:,2]*s, P[:,1], P[:,0]*s+P[:,2]*c],1)

for f in sys.argv[1:]:
    P,N=collect(os.path.join('Blender/AssetLibrary',f))
    print('='*70); print(f, 'pts', len(P))
    vert=np.abs(N[:,1])<0.4
    ang=(np.degrees(np.arctan2(N[vert,2],N[vert,0]))+360)%90
    h,e=np.histogram(ang,bins=180,range=(0,90))
    peak=e[h.argmax()]+0.25
    print(' wall-normal yaw peak %.2f deg (weight %d of %d)'%(peak,h.max(),vert.sum()))
    Q=rot(P,np.radians(-peak))
    floor=Q[:,1].min()
    print(' floor y %.2f'%floor)
    sl=Q[(Q[:,1]>floor+0.02)&(Q[:,1]<floor+0.18)]
    print(' floor slab pts',len(sl))
    cx,cz=np.median(sl[:,0]),np.median(sl[:,2])
    print(' floor centre (aligned) x %.2f z %.2f'%(cx,cz))
    x0,x1=np.percentile(sl[:,0],[0.6,99.4]); z0,z1=np.percentile(sl[:,2],[0.6,99.4])
    print(' floor extent x [%.2f %.2f] (%.2f)  z [%.2f %.2f] (%.2f)'%(x0,x1,x1-x0,z0,z1,z1-z0))
    # ceiling height above the floor, from a column through the centre
    col=Q[(np.abs(Q[:,0]-cx)<0.6)&(np.abs(Q[:,2]-cz)<0.6)]
    ys=np.round(col[:,1],1); u,c=np.unique(ys,return_counts=True)
    top=[(float(a),int(b)) for a,b in zip(u,c) if a>floor+1.0 and b>3]
    print(' ceiling candidates', top[-4:] if top else 'none')
