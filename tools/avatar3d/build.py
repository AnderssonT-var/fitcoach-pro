"""
Genera los recursos del personaje 3D realista (public/avatar3d/) a partir de MakeHuman.

Necesita:
  MH_DATA   carpeta data de MPFB2 (base.obj, targets, rigs)  https://github.com/makehumancommunity/mpfb2
  MH_ASSETS carpeta con los recursos descargados de files2.makehumancommunity.org (pelo, ropa, piel)
  MESHOPT   carpeta con node_modules/meshoptimizer (para simplificar mallas pesadas)

Salida por cuerpo (m / f): <g>.json (índice) + <g>.bin (datos) y texturas .webp.
El cuerpo se guarda como «base + deformaciones»: la app suma los músculos que ganó cada asesorado
y vuelve a ajustar la ropa y el pelo a ese cuerpo (como hace MakeHuman).
Licencias: MakeHuman CC0; ropa «elvs_*» CC-BY (crédito en la app).
"""
import gzip, json, os, sys, subprocess, numpy as np
from PIL import Image, ImageOps, ImageEnhance

D = os.environ['MH_DATA']; A = os.environ['MH_ASSETS']; MESHOPT = os.environ.get('MESHOPT')
OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/avatar3d'
os.makedirs(OUT, exist_ok=True)

def readobj(path):
    V=[];VT=[];F={};cur='default'
    for line in open(path, encoding='utf-8', errors='ignore'):
        if line.startswith('v '): V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '): VT.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('g '): cur=line.split()[1] if len(line.split())>1 else 'default'
        elif line.startswith('f '):
            F.setdefault(cur,[]).append([tuple(int(t) if t else 0 for t in (p.split('/')+['',''])[:2]) for p in line.split()[1:]])
    return np.array(V), (np.array(VT) if VT else None), F

BV, BVT, BF = readobj(f'{D}/3dobjs/base.obj')
NB = len(BV)
cache = {}
def T(path):
    if path not in cache:
        idx=[];off=[]
        with gzip.open(f'{D}/targets/{path}.target.gz','rt') as f:
            for l in f:
                if l.strip() and not l.startswith('#'):
                    p=l.split(); idx.append(int(p[0])); off.append([float(x) for x in p[1:4]])
        cache[path]=(np.array(idx,dtype=np.int64), np.array(off).reshape(-1,3))
    return cache[path]
def add(out, path, w):
    if abs(w) > 1e-6: i,o = T(path); np.add.at(out, i, o*w)
def tri(v): return {'min':max(0,1-2*v),'average':1-abs(2*v-1),'max':max(0,2*v-1)}
RACE = {'caucasian':.34,'african':.33,'asian':.33}
def macro(g, muscle, weight, prop=1.0):
    out = BV.copy(); G={'female':1-g,'male':g}; M=tri(muscle); W=tri(weight)
    for gn,gw in G.items():
        for mn,mw in M.items():
            for wn,ww in W.items():
                add(out, f'macrodetails/universal-{gn}-young-{mn}muscle-{wn}weight', gw*mw*ww)
                add(out, f'macrodetails/proportions/{gn}-young-{mn}muscle-{wn}weight-idealproportions', gw*mw*ww*prop)
        for rn,rw in RACE.items(): add(out, f'macrodetails/{rn}-{gn}-young', gw*rw)
    return out
def regional(paths):
    out = np.zeros_like(BV)
    for p, w in paths: add(out, p, w)
    return out
LR = ['l','r']
REGIONS = {  # deformaciones por grupo muscular (a peso 1)
  'chest':     [('torso/torso-muscle-pectoral-incr', 1.0)],
  'back':      [('torso/torso-muscle-dorsi-incr', 1.0), ('torso/torso-vshape-incr', 0.8)],
  'shoulders': [(f'arms/{s}-upperarm-shoulder-muscle-incr', 1.0) for s in LR],
  'arms':      [(f'arms/{s}-upperarm-muscle-incr', 1.0) for s in LR],
  'forearms':  [(f'arms/{s}-lowerarm-muscle-incr', 1.0) for s in LR],
  'abs':       [('stomach/stomach-tone-incr', 1.0)],
  'legs':      [(f'legs/{s}-upperleg-muscle-incr', 1.0) for s in LR],
  'calves':    [(f'legs/{s}-lowerleg-muscle-incr', 1.0) for s in LR],
  'face_round':  [('head/head-round', 0.8)],
  'face_oval':   [('head/head-oval', 0.8)],
  'face_square': [('head/head-square', 0.8)],
}
rig = json.load(open(f'{D}/rigs/standard/rig.game_engine.json')); W = json.load(open(f'{D}/rigs/standard/weights.game_engine.json'))['weights']
order=[]; seen=set()
def visit(n):
    if n in seen: return
    if rig[n]['parent']: visit(rig[n]['parent'])
    seen.add(n); order.append(n)
for n in rig: visit(n)
bidx = {n:i for i,n in enumerate(order)}
def gverts(name): return sorted({v-1 for f in BF.get(name,[]) for v,_ in f})
JOINTS = {n: gverts(rig[n]['head']['cube_name']) for n in order}
def heads(P): return np.array([P[JOINTS[n]].mean(0) for n in order])
VW=[[] for _ in range(NB)]
for bname,lst in W.items():
    if bname in bidx:
        for v,w in lst: VW[v].append((bidx[bname],w))
def top4(lst):
    lst=sorted(lst,key=lambda x:-x[1])[:4]; s=sum(w for _,w in lst) or 1
    return [(b,w/s) for b,w in lst]+[(0,0.0)]*(4-len(lst))
VW4=[top4(l) if l else [(bidx['pelvis'],1.0)]+[(0,0.0)]*3 for l in VW]

class Blob:
    def __init__(s): s.parts=[]; s.size=0; s.index={}
    def put(s, name, arr):
        arr=np.ascontiguousarray(arr); pad=(-s.size)%4
        if pad: s.parts.append(b'\0'*pad); s.size+=pad
        s.index[name]={'o':s.size,'n':int(arr.size),'t':str(arr.dtype)}; s.parts.append(arr.tobytes()); s.size+=arr.nbytes
    def write(s, path): open(path,'wb').write(b''.join(s.parts))

def render_mesh(faces, VT, base_of, w_of):
    """Separa vértices por costura de UV. Devuelve vert→base, uv, índices, pesos."""
    key={}; vb=[]; uv=[]; idx=[]; tri_face=[]
    for fi,f in enumerate(faces):
        ids=[]
        for v,t in f:
            k=(v,t)
            if k not in key: key[k]=len(vb); vb.append(v-1); uv.append(VT[t-1] if VT is not None and t else (0,0))
            ids.append(key[k])
        for j in range(1,len(ids)-1): idx += [ids[0],ids[j],ids[j+1]]; tri_face.append(fi)
    si=np.zeros((len(vb),4),np.uint8); sw=np.zeros((len(vb),4),np.uint8)
    for i,v in enumerate(vb):
        ww=w_of(v); si[i]=[b for b,_ in ww]; q=np.array([w for _,w in ww]); qq=np.round(q*255).astype(int); qq[0]+=255-qq.sum(); sw[i]=np.clip(qq,0,255)
    return np.array(vb), np.array(uv,np.float32), np.array(idx), si, sw, np.array(tri_face)

def read_mhclo(path):
    refs=[]; scale={}; objf=None; dele=[]; mode=None
    for line in open(path, encoding='utf-8', errors='ignore'):
        w=line.split()
        if not w or w[0].startswith('#'): continue
        if w[0] in ('x_scale','y_scale','z_scale'): scale[w[0][0]]=(int(w[1]),int(w[2]),float(w[3])); continue
        if w[0]=='obj_file': objf=w[1]; continue
        if w[0]=='verts': mode='v'; continue
        if w[0]=='delete_verts': mode='d'; continue
        if mode=='v' and len(w) in (1,9) and w[0].isdigit():
            if len(w)==1: refs.append(((int(w[0]),)*3,(1,0,0),(0,0,0)))
            else: refs.append(((int(w[0]),int(w[1]),int(w[2])),tuple(map(float,w[3:6])),tuple(map(float,w[6:9]))))
        elif mode=='d':
            toks=' '.join(w).replace('-',' - ').split(); k=0
            while k<len(toks):
                if k+2<len(toks) and toks[k+1]=='-': dele += list(range(int(toks[k]),int(toks[k+2])+1)); k+=3
                elif toks[k].isdigit(): dele.append(int(toks[k])); k+=1
                else: k+=1
    return os.path.join(os.path.dirname(path), objf), refs, scale, sorted(set(dele))

def simplify(pos, idx, target_ratio, err=0.02, lock=True):
    if not MESHOPT: return idx
    # Une vértices repetidos (misma posición) para que la malla se pueda simplificar
    keys = np.round(pos / 1e-3).astype(np.int64); _, first, inv = np.unique(keys, axis=0, return_index=True, return_inverse=True)
    inv = inv.ravel(); widx = inv[idx]; wpos = pos[first]
    out = _simplify(wpos, widx, target_ratio, err, lock)
    return first[out]
def _simplify(pos, idx, target_ratio, err, lock):
    tmp = f'/tmp/mo_{os.getpid()}.json'; json.dump({'p':pos.astype(float).round(5).ravel().tolist(),'i':idx.ravel().tolist(),'r':target_ratio,'e':err,'l':lock}, open(tmp,'w'))
    js = ("const m=require('meshoptimizer');const d=JSON.parse(require('fs').readFileSync(process.argv[1]));"
          "m.MeshoptSimplifier.ready.then(()=>{const r=m.MeshoptSimplifier.simplify(new Uint32Array(d.i),new Float32Array(d.p),3,Math.floor(d.i.length*d.r/3)*3,d.e,d.l?['LockBorder']:[]);"
          "process.stdout.write(JSON.stringify(Array.from(r[0])))})")
    out = subprocess.run(['node','-e',js,tmp], capture_output=True, text=True, cwd=MESHOPT, check=True).stdout
    return np.array(json.loads(out))

def tex(src, dst, size=1024, gray=False, q=80, bright=1.0):
    im = Image.open(src); im.load()
    alpha = im.getchannel('A') if im.mode in ('RGBA','LA') else None
    rgb = im.convert('RGB')
    if gray:  # en gris claro para poder teñirlo del color que elija el usuario
        g = ImageOps.grayscale(rgb); g = ImageEnhance.Brightness(g).enhance(bright); rgb = Image.merge('RGB',(g,g,g))
    if alpha is not None: rgb.putalpha(alpha)
    rgb = rgb.resize((size,size), Image.LANCZOS) if max(im.size) > size else rgb
    rgb.save(f'{OUT}/{dst}', 'WEBP', quality=q, method=6)
    return dst

GENDERS = {
  'm': {'g':1.0, 'skin':'skins/young_caucasian_male/young_lightskinned_male_diffuse.png',
        'proxies': {
          'eyebrows': 'eyebrows/eyebrow001/eyebrow001.mhclo', 'eyelashes': 'eyelashes/eyelashes01/eyelashes01.mhclo', 'eyes': 'eyes/high-poly/high-poly.mhclo',
          'hair_corto': 'hair/short02/short02.mhclo', 'hair_rapado': 'hair/short04/short04.mhclo', 'hair_rizado': 'hair/afro01/afro01.mhclo', 'hair_largo': 'hair/long01/long01.mhclo',
          'shoes': 'clothes/shoes05/shoes05.mhclo', 'shorts': 'clothes/elvs_male_trouser_short_2/elvs_male_trouser_short_2.mhclo', 'tank': 'clothes/elvs_male_athletic_tank1/elvs_male_athletic_tank1.mhclo'}},
  'f': {'g':0.0, 'skin':'skins/young_caucasian_female/young_lightskinned_female_diffuse.png',
        'proxies': {
          'eyebrows': 'eyebrows/eyebrow001/eyebrow001.mhclo', 'eyelashes': 'eyelashes/eyelashes01/eyelashes01.mhclo', 'eyes': 'eyes/high-poly/high-poly.mhclo',
          'hair_coleta': 'hair/ponytail01/ponytail01.mhclo', 'hair_largo': 'hair/long01/long01.mhclo', 'hair_mono': 'hair/bob02/bob02.mhclo', 'hair_corto': 'hair/short02/short02.mhclo', 'hair_rizado': 'hair/afro01/afro01.mhclo',
          'shoes': 'clothes/shoes05/shoes05.mhclo', 'sport': 'clothes/female_sportsuit01/female_sportsuit01.mhclo'}},
}
TEX = {  # textura de cada prenda y si se tiñe (gris)
  'eyebrows': ('eyebrows/eyebrow001/eyebrow001.png', 256, True, 1.6), 'eyelashes': ('eyelashes/eyelashes01/eyelashes01.png', 256, False, 1),
  'eyes': ('eyes/materials/brown_eye.png', 512, False, 1), 'shoes': ('clothes/shoes05/shoes05_diffuse.png', 512, False, 1),
  'shorts': ('clothes/elvs_male_trouser_short_2/shorttex1.png', 512, True, 1.25), 'tank': ('clothes/elvs_male_athletic_tank1/wb_tex3.png', 512, True, 1.0),
  'sport': ('clothes/female_sportsuit01/female_sportsuit01_diffuse.png', 1024, True, 1.6),
  'hair_corto': ('hair/short02/short02_diffuse.png', 1024, True, 2.2), 'hair_rapado': ('hair/short04/short04_diffuse.png', 1024, True, 2.2),
  'hair_rizado': ('hair/afro01/afro_diffuse.png', 1024, True, 2.2), 'hair_largo': ('hair/long01/long01_diffuse.png', 1024, True, 2.2),
  'hair_coleta': ('hair/ponytail01/ponytail01_diffuse.png', 1024, True, 2.2), 'hair_mono': ('hair/bob02/bob02_diffuse.png', 1024, True, 2.2),
}
SIMPLIFY = {'tank': (0.1, 0.12, False), 'shorts': (0.45, 0.03, True)}

done_tex = set()
for gk, G in GENDERS.items():
    blob = Blob(); man = {'bones':[{'name':n,'parent':(order.index(rig[n]['parent']) if rig[n]['parent'] else -1)} for n in order], 'deltas':[], 'proxies':{}}
    P0 = macro(G['g'], 0.5, 0.45)
    blob.put('base', P0.astype(np.float32)); blob.put('heads', heads(P0).astype(np.float32))
    deltas = {'muscle': macro(G['g'], 1.0, 0.42) - P0, 'weight': macro(G['g'], 0.5, 0.75) - P0}
    for name, paths in REGIONS.items(): deltas[name] = regional(paths)
    for name, d in deltas.items():
        nz = np.where(np.abs(d).max(1) > 1e-5)[0]
        blob.put(f'd_{name}_i', nz.astype(np.uint16)); blob.put(f'd_{name}_v', d[nz].astype(np.float32))
        blob.put(f'd_{name}_h', (heads(P0 + d) - heads(P0)).astype(np.float32))
        man['deltas'].append(name)
    # cuerpo
    vb, uv, idx, si, sw, triface = render_mesh(BF['body'], BVT, None, lambda v: VW4[v])
    blob.put('body_vb', vb.astype(np.uint16)); blob.put('body_uv', uv); blob.put('body_i', idx.astype(np.uint16)); blob.put('body_si', si); blob.put('body_sw', sw)
    # caras del cuerpo que tapa cada prenda (para que la piel no atraviese)
    face_verts = [[v-1 for v,_ in f] for f in BF['body']]
    man['skin'] = tex(f"{A}/{G['skin']}", f'skin_{gk}.webp', 1024, False, 82)
    sk = np.asarray(Image.open(f"{A}/{G['skin']}").convert('RGB').resize((64,64))).reshape(-1,3)/255.0
    man['skinAvg'] = sk[(sk.sum(1) > 0.6)].mean(0).round(4).tolist()
    for pname, rel in G['proxies'].items():
        objp, refs, scale, dele = read_mhclo(f'{A}/{rel}')
        V, VT, F = readobj(objp)
        faces = [f for fs in F.values() for f in fs]
        pvb, puv, pidx, psi, psw, _ = render_mesh(faces, VT, None, lambda v, refs=refs: top4(sum(([ (b, w*wt) for b,w in VW4[r]] for r,wt in zip(refs[v][0], refs[v][1])), [])))
        R = np.array([refs[v][0] for v in pvb]); Wt = np.array([refs[v][1] for v in pvb]); Off = np.array([refs[v][2] for v in pvb])
        if pname in SIMPLIFY:
            fitted = (Wt[:,:,None]*P0[R]).sum(1) + Off
            pidx = simplify(fitted, pidx, *SIMPLIFY[pname])
            used = np.unique(pidx); remap = -np.ones(len(pvb), int); remap[used] = np.arange(len(used))
            pidx = remap[pidx]; R, Wt, Off, puv, psi, psw = R[used], Wt[used], Off[used], puv[used], psi[used], psw[used]
        if pname == 'sport':  # top y leggings por separado (cada uno con su color)
            cy = (Wt[:,:,None]*P0[R]).sum(1)[:,1]
            tri = pidx.reshape(-1,3); ytri = cy[tri].mean(1); split = P0[:,1].min() + (P0[:,1].max()-P0[:,1].min())*0.6
            groups = {'sport_top': tri[ytri > split].ravel(), 'sport_bottom': tri[ytri <= split].ravel()}
        else: groups = {pname: pidx}
        dset = set(dele)
        hide = [i for i, fv in enumerate(face_verts) if any(v in dset for v in fv)] if dele and pname in ('shoes','shorts','tank','sport') else []
        hide_tris = np.where(np.isin(triface, hide))[0] if hide else np.array([],int)
        for gname, gidx in groups.items():
            pre = f'p_{gname}_'
            blob.put(pre+'r', R.astype(np.uint16)); blob.put(pre+'w', Wt.astype(np.float32)); blob.put(pre+'o', Off.astype(np.float32))
            blob.put(pre+'uv', puv); blob.put(pre+'i', np.asarray(gidx).astype(np.uint16 if len(R) < 65535 else np.uint32)); blob.put(pre+'si', psi); blob.put(pre+'sw', psw)
            if len(hide_tris) and gname != 'sport_top': blob.put(pre+'hide', hide_tris.astype(np.uint16))
            tsrc, tsize, tgray, tb = TEX[pname]
            man['proxies'][gname] = {'scale': {a: list(scale[a]) for a in scale}, 'tex': f'{pname}{"_g" if tgray else ""}.webp', 'tint': tgray, 'hide': bool(len(hide_tris)) and gname != 'sport_top'}
            if pname not in done_tex:
                tex(f'{A}/{tsrc}', f'{pname}{"_g" if tgray else ""}.webp', tsize, tgray, 80, tb); done_tex.add(pname)
        print(gk, pname, len(R), 'vértices', len(pidx)//3, 'triángulos')
    man['blob'] = blob.index
    blob.write(f'{OUT}/{gk}.bin'); json.dump(man, open(f'{OUT}/{gk}.json','w'))
    print(gk, 'listo', blob.size//1024, 'KB')
