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
f=sys.argv[1]; cell=float(sys.argv[2]) if len(sys.argv)>2 else 0.25
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
P=np.vstack(P); lo,hi=P.min(0),P.max(0)
floor=lo[1]; band=P[(P[:,1]>floor+1.0)&(P[:,1]<floor+1.9)]
nx=int((hi[0]-lo[0])/cell)+1; nz=int((hi[2]-lo[2])/cell)+1
g=np.zeros((nz,nx),int)
for p in band:
    g[min(nz-1,int((p[2]-lo[2])/cell)), min(nx-1,int((p[0]-lo[0])/cell))]+=1
print(f, 'size',np.round(hi-lo,2),'cell',cell,'floor y',round(floor,2),'ceil y',round(hi[1],2))
print('     x ->', round(lo[0],1), 'to', round(hi[0],1), '   z v', round(lo[2],1),'to',round(hi[2],1))
for iz in range(nz):
    row=''
    for ix in range(nx):
        c=g[iz,ix]
        row+= ' ' if c==0 else ('.' if c<4 else ('o' if c<30 else ('O' if c<200 else '#')))
    print('%6.1f %s'%(lo[2]+(iz+0.5)*cell,row))
