"""Measure a room asset: yaw, outer rectangle, wall thickness, and door gaps.

Photogrammetry shells are not axis-aligned and their bounding boxes are inflated
by stray triangles, so neither rotation nor size can be read off the bbox. This
finds the yaw that minimises the bounding rectangle of the wall band (rotating
calipers on the point cloud), then reports each wall's line and the gaps in it
that a doorway would leave.
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

def points(path):
    js,bin=load(path); nodes=js['nodes']; world={}
    def walk(i,p):
        m=p@trs(nodes[i]); world[i]=m
        for c in nodes[i].get('children',[]): walk(c,m)
    for r in js['scenes'][js.get('scene',0)]['nodes']: walk(r,np.eye(4))
    P=[]
    for i,n in enumerate(nodes):
        if 'mesh' not in n: continue
        m=world[i]
        for pr in js['meshes'][n['mesh']]['primitives']:
            a=js['accessors'][pr['attributes']['POSITION']]
            bv=js['bufferViews'][a['bufferView']]; off=bv.get('byteOffset',0)+a.get('byteOffset',0)
            arr=np.frombuffer(bin,dtype='<f4',count=a['count']*3,offset=off).reshape(-1,3).astype(float)
            P.append((m@np.c_[arr,np.ones(len(arr))].T).T[:,:3])
    return np.vstack(P)

def rot(P,a):
    c,s=np.cos(a),np.sin(a)
    return np.stack([P[:,0]*c-P[:,2]*s, P[:,1], P[:,0]*s+P[:,2]*c],1)

def main(path):
    P=points(path)
    print('='*70); print(path, 'pts', len(P))
    print(' raw bbox', np.round(P.min(0),2), np.round(P.max(0),2))
    band=P[(P[:,1]>P[:,1].min()+0.4)&(P[:,1]<P[:,1].min()+2.2)]
    best=None
    for deg in np.arange(0,90,0.25):
        Q=rot(band,np.radians(deg))
        lo=np.percentile(Q[:,0],1); hi=np.percentile(Q[:,0],99)
        lz=np.percentile(Q[:,2],1); hz=np.percentile(Q[:,2],99)
        area=(hi-lo)*(hz-lz)
        if best is None or area<best[0]: best=(area,deg,lo,hi,lz,hz)
    area,deg,lo,hi,lz,hz=best
    print(' yaw %.2f deg  rect x [%.2f %.2f] z [%.2f %.2f]  %.2f x %.2f'%(deg,lo,hi,lz,hz,hi-lo,hz-lz))
    # refine: shrink to where the density is; walls are the dense bands
    Q=rot(band,np.radians(deg))
    for axis,tag in [(0,'x'),(2,'z')]:
        hist,edges=np.histogram(Q[:,axis],bins=200)
        peak=edges[hist.argmax()]
        print('   dense wall band at %s=%.2f'%(tag,peak))
    floor=np.percentile(P[:,1],0.5); ceil=np.percentile(P[:,1],99.5)
    print(' floor y %.2f  ceiling y %.2f  interior %.2f'%(floor,ceil,ceil-floor))
    # gaps in each of the four walls, measured in the aligned frame
    for axis,sign,tag in [(0,-1,'x lo'),(0,1,'x hi'),(2,-1,'z lo'),(2,1,'z hi')]:
        edge=(lo if sign<0 else hi)
        sel=Q[np.abs(Q[:,axis]-edge)<0.30]
        other=2 if axis==0 else 0
        if len(sel)<50: print('  ',tag,'few pts',len(sel)); continue
        vals=sel[:,other]
        step=0.1
        edges2=np.arange(vals.min(),vals.max()+step,step)
        h,_=np.histogram(vals,bins=edges2)
        # a doorway is a stretch of empty wall bins at least 0.7 m wide
        gaps=[];run=None
        for k,c in enumerate(h):
            if c<=1:
                if run is None: run=[edges2[k],edges2[k+1]]
                else: run[1]=edges2[k+1]
            else:
                if run and run[1]-run[0]>=0.7: gaps.append((round(run[0],2),round(run[1],2)))
                run=None
        if run and run[1]-run[0]>=0.7: gaps.append((round(run[0],2),round(run[1],2)))
        print('  ',tag,'line %.2f'%edge,'pts',len(sel),'gaps',gaps)

for p in sys.argv[1:]:
    main(os.path.join('Blender/AssetLibrary',p))
