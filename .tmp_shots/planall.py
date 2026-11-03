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
f=sys.argv[1]; cell=float(sys.argv[2]); y0=float(sys.argv[3]); y1=float(sys.argv[4])
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
S=P[(P[:,1]>y0)&(P[:,1]<y1)]
# use robust extents (2nd/98th percentile) so outliers don't inflate the frame
lo=np.percentile(S[:,0],1); hi=np.percentile(S[:,0],99)
loz=np.percentile(S[:,2],1); hiz=np.percentile(S[:,2],99)
nx=int((hi-lo)/cell)+1; nz=int((hiz-loz)/cell)+1
g=np.zeros((nz,nx),int)
for p in S:
    ix=int((p[0]-lo)/cell); iz=int((p[2]-loz)/cell)
    if 0<=ix<nx and 0<=iz<nz: g[iz,ix]+=1
print(f,'y',y0,y1,'x',round(lo,1),round(hi,1),'z',round(loz,1),round(hiz,1),'cell',cell)
for iz in range(nz):
    r=''.join(' ' if g[iz,ix]==0 else ('.' if g[iz,ix]<3 else ('o' if g[iz,ix]<20 else ('O' if g[iz,ix]<100 else '#'))) for ix in range(nx))
    print('%6.1f %s'%(loz+(iz+0.5)*cell,r))
