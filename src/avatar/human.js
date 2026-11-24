/* Personaje 3D realista (cuerpo MakeHuman) con esqueleto, músculos que crecen y ejercicios animados.
   Los datos vienen de /avatar3d/<m|f>.json + .bin (los genera tools/avatar3d/build.py):
   - el cuerpo se guarda como «base + deformaciones» y aquí se suman según el progreso de cada músculo;
   - la ropa y el pelo se vuelven a ajustar a ese cuerpo (cada vértice sigue a 3 vértices del cuerpo);
   - los movimientos se calculan orientando cada hueso hacia una dirección (técnica real de cada ejercicio).
   API: createCharacter(contenedor) → { set(estilo, músculos), flex(ms), play(ejercicio), dispose() } */
import * as THREE from "three";

const BASE = "/avatar3d/", VER = "?v=1"; // subir VER al regenerar los recursos
const packs = {};
const TYPES = { float32: Float32Array, uint16: Uint16Array, uint8: Uint8Array, uint32: Uint32Array };

function loadPack(g) {
  if (!packs[g]) packs[g] = (async () => {
    const [man, buf] = await Promise.all([
      fetch(`${BASE}${g}.json${VER}`).then((r) => { if (!r.ok) throw new Error("avatar"); return r.json(); }),
      fetch(`${BASE}${g}.bin${VER}`).then((r) => { if (!r.ok) throw new Error("avatar"); return r.arrayBuffer(); }),
    ]);
    const a = {};
    for (const [k, v] of Object.entries(man.blob)) a[k] = new TYPES[v.t](buf, v.o, v.n);
    return { man, a };
  })();
  packs[g].catch(() => { delete packs[g]; });
  return packs[g];
}

const texLoader = new THREE.TextureLoader();
const texCache = {};
function tex(name) {
  if (!texCache[name]) texCache[name] = new Promise((ok) => texLoader.load(BASE + name + VER, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ok(t); }, undefined, () => ok(null)));
  return texCache[name];
}

export const EXERCISES = [
  ["curl", "Curl"], ["squat", "Sentadilla"], ["bench", "Press banca"], ["legpress", "Prensa"],
];
const HAIR = { corto: "hair_corto", rapado: "hair_rapado", rizado: "hair_rizado", largo: "hair_largo", coleta: "hair_coleta", mono: "hair_mono", calvo: null };
const FACE = { redondo: "face_round", ovalado: "face_oval", cuadrado: "face_square" };

const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
/** Una repetición: baja (excéntrica) lento, pausa, sube más rápido. 0 = arriba, 1 = abajo. */
function rep(t, down = 0.45, hold = 0.1, up = 0.3) {
  if (t < down) return ease(t / down);
  if (t < down + hold) return 1;
  if (t < down + hold + up) return 1 - ease((t - down - hold) / up);
  return 0;
}
const BONE_CHILD = { upperarm_l: "lowerarm_l", upperarm_r: "lowerarm_r", lowerarm_l: "hand_l", lowerarm_r: "hand_r", thigh_l: "calf_l", thigh_r: "calf_r",
  calf_l: "foot_l", calf_r: "foot_r", spine_01: "spine_02", spine_02: "spine_03", spine_03: "neck_01", neck_01: "head" };

export function createCharacter(container, { accent = "#5856d6" } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const el = renderer.domElement;
  el.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab";
  container.appendChild(el);
  const loading = document.createElement("div");
  loading.className = "vf-av-loading";
  loading.textContent = "Cargando personaje…";
  container.appendChild(loading);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.5, 300);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d94a6, 1.15));
  const key = new THREE.DirectionalLight(0xfff1e2, 2.5); key.position.set(10, 22, 16); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(new THREE.Color(accent).lerp(new THREE.Color(0xffffff), 0.55), 1.6); rim.position.set(-14, 9, -16); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-10, 2, 14); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.ShadowMaterial({ opacity: 0.22 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const fig = new THREE.Group(); scene.add(fig);     // el personaje (gira con el dedo)
  const world = new THREE.Group(); scene.add(world); // máquinas y pesas
  let pack = null, style = null, mus = {}, built = null, disposed = false, y0 = -8.2;
  let bone = {}, B = [], bindDir = {}, skel = null, pelvisP = new THREE.Vector3();
  let current = "idle", exStart = 0, flexUntil = 0, flexK = 0, props = null;
  const disposables = [];
  const tq = new THREE.Quaternion();

  /* ---------- Construcción del cuerpo ---------- */
  function weights() {
    const m = mus, g = (k) => Math.max(0, Math.min(1, m[k] || 0));
    const avg = Object.values(m).length ? Object.values(m).reduce((t, v) => t + v, 0) / Object.values(m).length : 0;
    const f = style.body === "f" ? 0.75 : 1;
    const w = {
      muscle: 0.9 * avg, chest: g("chest") * f, back: g("back") * f, shoulders: g("shoulders") * f, arms: ((g("biceps") + g("triceps")) / 2) * f,
      forearms: g("forearms") * f, abs: g("abs"), legs: ((g("quads") + g("hams") + g("glutes")) / 3) * f, calves: g("calves") * f,
    };
    if (FACE[style.face]) w[FACE[style.face]] = 1;
    return w;
  }
  function bodyPositions() {
    const { a } = pack, P = new Float32Array(a.base), H = new Float32Array(a.heads);
    for (const [name, w] of Object.entries(weights())) {
      if (!w || !a[`d_${name}_i`]) continue;
      const idx = a[`d_${name}_i`], d = a[`d_${name}_v`], dh = a[`d_${name}_h`];
      for (let i = 0; i < idx.length; i++) { const o = idx[i] * 3; P[o] += d[i * 3] * w; P[o + 1] += d[i * 3 + 1] * w; P[o + 2] += d[i * 3 + 2] * w; }
      for (let i = 0; i < H.length; i++) H[i] += dh[i] * w;
    }
    return { P, H };
  }
  function fitProxy(name, P) {
    const { a, man } = pack, pre = `p_${name}_`, R = a[pre + "r"], W = a[pre + "w"], O = a[pre + "o"], n = R.length / 3;
    const sc = [0, 1, 2].map((ax) => { const s = man.proxies[name].scale["xyz"[ax]]; return s ? Math.abs(P[s[0] * 3 + ax] - P[s[1] * 3 + ax]) / s[2] : 1; });
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) for (let ax = 0; ax < 3; ax++) {
      out[i * 3 + ax] = W[i * 3] * P[R[i * 3] * 3 + ax] + W[i * 3 + 1] * P[R[i * 3 + 1] * 3 + ax] + W[i * 3 + 2] * P[R[i * 3 + 2] * 3 + ax] + O[i * 3 + ax] * sc[ax];
    }
    return out;
  }
  function geometry(pos, uv, idx, si, sw) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4, true));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    disposables.push(g);
    return g;
  }
  const cssColor = (c, fb) => new THREE.Color(/^#[0-9a-f]{6}$/i.test(c || "") ? c : fb);
  function proxiesFor(s) {
    const list = ["eyes", "eyebrows", "eyelashes", "shoes"];
    if (HAIR[s.hair]) list.push(HAIR[s.hair]);
    if (s.body === "m") { list.push("shorts"); if (s.outfit === "tank") list.push("tank"); }
    else { list.push("sport_bottom"); if (s.outfit === "top") list.push("sport_top"); }
    return list.filter((n) => pack.man.proxies[n]);
  }

  async function build() {
    const g = style.body === "f" ? "f" : "m";
    pack = await loadPack(g);
    if (disposed) return;
    const { a, man } = pack;
    const { P, H } = bodyPositions();
    const want = proxiesFor(style);
    // Huesos (posición de cada articulación en este cuerpo)
    for (const o of [...fig.children]) fig.remove(o);
    for (const d of disposables.splice(0)) d.dispose();
    B = man.bones.map((b) => { const o = new THREE.Bone(); o.name = b.name; return o; });
    man.bones.forEach((b, i) => {
      const h = new THREE.Vector3(H[i * 3], H[i * 3 + 1], H[i * 3 + 2]);
      if (b.parent >= 0) { B[b.parent].add(B[i]); B[i].position.set(h.x - H[b.parent * 3], h.y - H[b.parent * 3 + 1], h.z - H[b.parent * 3 + 2]); }
      else B[i].position.copy(h);
    });
    bone = Object.fromEntries(B.map((b) => [b.name, b]));
    bindDir = {};
    for (const [n, c] of Object.entries(BONE_CHILD)) bindDir[n] = bone[c].position.clone().normalize();
    pelvisP = bone.pelvis.position.clone();
    fig.add(B[0]);
    fig.updateMatrixWorld(true);
    // Piel del cuerpo (se ocultan las partes que tapa la ropa/zapatillas)
    const vb = a.body_vb, nv = vb.length, bpos = new Float32Array(nv * 3);
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < nv; i++) { for (let k = 0; k < 3; k++) bpos[i * 3 + k] = P[vb[i] * 3 + k]; minY = Math.min(minY, bpos[i * 3 + 1]); maxY = Math.max(maxY, bpos[i * 3 + 1]); }
    const hidden = new Set();
    for (const n of want) if (man.proxies[n].hide && a[`p_${n}_hide`]) for (const t of a[`p_${n}_hide`]) hidden.add(t);
    const bi = a.body_i, keep = [];
    for (let t = 0; t < bi.length / 3; t++) if (!hidden.has(t)) keep.push(bi[t * 3], bi[t * 3 + 1], bi[t * 3 + 2]);
    const skinTex = await tex(man.skin);
    if (disposed) return;
    const skinMat = new THREE.MeshPhysicalMaterial({ map: skinTex, roughness: 0.5, sheen: 0.25, sheenColor: new THREE.Color("#ffb4a0"), sheenRoughness: 0.45, clearcoat: 0.1, clearcoatRoughness: 0.6 });
    const U = { uTop: { value: new THREE.Color() }, uY0: { value: minY }, uH: { value: maxY - minY }, uMode: { value: 0 }, uFem: { value: g === "f" ? 1 : 0 } };
    skinMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvP = position;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vP; uniform vec3 uTop; uniform float uY0, uH, uMode, uFem;\nfloat cv(float d){float w=max(fwidth(d),1e-4)*.8;return smoothstep(-w,w,d);}")
        .replace("#include <color_fragment>", `#include <color_fragment>
        if (uMode > 0.5) { float t = (vP.y - uY0) / uH; float ax = abs(vP.x); float c;
          if (uMode < 1.5) c = min(min(cv(t - 0.555), cv(0.80 - 0.05 * (1.0 - smoothstep(0.0, 1.0, ax)) - t)), cv(1.5 - ax - max(0.0, t - 0.68) * 2.2)); // esqueleto
          else c = min(cv(t - 0.555), cv(0.815 - 0.03 * (1.0 - smoothstep(0.0, 0.7, ax)) - t)) * cv(2.6 - ax + (t - 0.7) * 3.0);                    // camiseta (manga corta)
          diffuseColor.rgb = mix(diffuseColor.rgb, uTop, c); }`);
    };
    const bodyMesh = new THREE.SkinnedMesh(geometry(bpos, a.body_uv, new Uint32Array(keep), a.body_si, a.body_sw), skinMat);
    disposables.push(skinMat);
    const parts = { body: bodyMesh };
    for (const n of want) {
      const m = man.proxies[n], pos = fitProxy(n, P), t = await tex(m.tex);
      if (disposed) return;
      const isHair = n.startsWith("hair") || n === "eyebrows", alpha = isHair || n === "eyelashes" || n === "eyes";
      const mat = new THREE.MeshPhysicalMaterial({ map: t, roughness: n === "eyes" ? 0.1 : isHair ? 0.6 : 0.8, clearcoat: n === "eyes" ? 1 : 0,
        sheen: isHair ? 0.6 : n.startsWith("sport") || n === "shorts" || n === "tank" ? 0.45 : 0, sheenColor: new THREE.Color(isHair ? "#8a6a50" : "#888888"),
        side: n === "eyes" ? THREE.FrontSide : THREE.DoubleSide, transparent: alpha && n !== "eyes", alphaTest: alpha ? (n === "eyes" ? 0.5 : 0.3) : 0, depthWrite: !(n === "eyelashes" || n === "eyebrows") });
      if (n === "eyes") {
        const iris = { value: cssColor(style.eyes, "#5a3a22") };
        mat.onBeforeCompile = (sh) => { sh.uniforms.uIris = iris;
          sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uIris;").replace("#include <map_fragment>", `#include <map_fragment>
          { vec3 c = diffuseColor.rgb; float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); float lum = dot(c, vec3(0.3, 0.59, 0.11));
            float irisMask = smoothstep(0.08, 0.2, sat) * (1.0 - smoothstep(0.55, 0.75, lum));
            diffuseColor.rgb = mix(c, uIris * (0.35 + lum * 2.2), irisMask); }`); };
      }
      const geo = geometry(pos, a[`p_${n}_uv`], a[`p_${n}_i`], a[`p_${n}_si`], a[`p_${n}_sw`]);
      if (n === "tank" || n === "sport_top") { // un poco hacia afuera para que el short no la atraviese
        const pa = geo.attributes.position, na = geo.attributes.normal;
        for (let i = 0; i < pa.count; i++) pa.setXYZ(i, pa.getX(i) + na.getX(i) * 0.09, pa.getY(i) + na.getY(i) * 0.09, pa.getZ(i) + na.getZ(i) * 0.09);
        pa.needsUpdate = true;
      }
      const mesh = new THREE.SkinnedMesh(geo, mat);
      if (n === "eyelashes" || n === "eyebrows") mesh.renderOrder = 2;
      if (n === "tank" || n === "sport_top") { mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -4; } // la camiseta va por encima del short
      parts[n] = mesh; disposables.push(mat);
    }
    // Se enlaza la malla al esqueleto en la pose base y con el personaje sin girar ni mover;
    // si no, la piel queda desplazada respecto a los huesos y el cuerpo se deforma al animar.
    const saveR = fig.rotation.clone(), saveP = fig.position.clone();
    fig.rotation.set(0, 0, 0); fig.position.set(0, 0, 0);
    for (const b of B) b.quaternion.identity();
    bone.pelvis.position.copy(pelvisP);
    for (const [n, m] of Object.entries(parts)) { m.frustumCulled = false; m.castShadow = !(n === "eyelashes" || n === "eyebrows"); m.receiveShadow = true; fig.add(m); }
    fig.updateMatrixWorld(true);
    skel = new THREE.Skeleton(B);
    for (const m of Object.values(parts)) m.bind(skel, m.matrixWorld);
    fig.rotation.copy(saveR); fig.position.copy(saveP); fig.updateMatrixWorld(true);
    built = { parts, U, skinMat, minY };
    y0 = minY; ground.position.y = y0;
    paint();
    loading.remove();
    pose(performance.now());
  }

  function paint() {
    if (!built) return;
    const { parts, U, skinMat } = built, avg = pack.man.skinAvg;
    const sk = cssColor(style.skin, "#d8a27c");
    // El color de piel se aplica sobre la textura real (tiñendo según el tono medio de la textura)
    const lin = (v) => Math.pow(v, 2.2);
    skinMat.color.setRGB(...[sk.r, sk.g, sk.b].map((v, i) => Math.min(1.35, v / lin(avg[i]))));
    const hair = cssColor(style.hairColor, "#3b2516"), top = cssColor(style.top, "#5856d6"), bottom = cssColor(style.bottom, "#1c1c1e"), shoes = cssColor(style.shoes, "#f2f2f7");
    for (const [n, m] of Object.entries(parts)) {
      if (n.startsWith("hair")) m.material.color.copy(hair);
      else if (n === "eyebrows") m.material.color.copy(hair).multiplyScalar(0.85);
      else if (n === "tank" || n === "sport_top") m.material.color.copy(top);
      else if (n === "shorts" || n === "sport_bottom") m.material.color.copy(bottom);
      else if (n === "shoes") m.material.color.copy(shoes).lerp(new THREE.Color(0xffffff), 0.35);
    }
    // Camisetas sin malla propia: se pintan sobre la piel
    const painted = (style.body === "m" && style.outfit === "tee") || (style.body === "f" && (style.outfit === "tank" || style.outfit === "tee"));
    U.uMode.value = painted ? (style.outfit === "tank" ? 1 : 2) : 0;
    U.uTop.value.copy(top);
  }

  /* ---------- Movimiento ---------- */
  const wpos = (n) => new THREE.Vector3().setFromMatrixPosition(bone[n].matrixWorld);
  function aim(n, dir) {
    const b = bone[n]; b.parent.updateMatrixWorld(true); b.parent.getWorldQuaternion(tq);
    const local = dir.clone().applyQuaternion(fig.quaternion).applyQuaternion(tq.clone().invert());
    b.quaternion.setFromUnitVectors(bindDir[n], local); b.updateMatrixWorld(true);
  }
  function worldRot(n, q) { const b = bone[n]; b.parent.updateMatrixWorld(true); b.parent.getWorldQuaternion(tq); b.quaternion.copy(tq.clone().invert().multiply(fig.quaternion).multiply(q)); b.updateMatrixWorld(true); }
  function twist(n, ang) { const b = bone[n]; b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(bindDir[n], ang)); b.updateMatrixWorld(true); }
  function fingers(side, c) {
    const sg = side === "l" ? 1 : -1, ax = new THREE.Vector3(0, 0, 1);
    for (const f of ["index", "middle", "ring", "pinky"]) for (const k of ["01", "02", "03"]) bone[`${f}_${k}_${side}`].quaternion.setFromAxisAngle(ax, -sg * c * (k === "01" ? 1.0 : 1.3));
    bone[`thumb_02_${side}`].quaternion.setFromEuler(new THREE.Euler(0, -sg * 0.6 * c, 0));
  }
  function reset() { for (const b of B) b.quaternion.identity(); bone.pelvis.position.copy(pelvisP); }
  const arm = (s, up, low) => { aim(`upperarm_${s}`, up); aim(`lowerarm_${s}`, low); };
  const mixV = (a, b, k) => a.clone().lerp(b, k).normalize();
  function standLegs() { for (const s of ["l", "r"]) { const sg = s === "l" ? 1 : -1; aim(`thigh_${s}`, V(sg * 0.08, -1, 0.02)); aim(`calf_${s}`, V(sg * 0.03, -1, -0.02)); worldRot(`foot_${s}`, new THREE.Quaternion()); } }
  function legIK(s, hip, foot, hint) {
    const l1 = bone[`calf_${s}`].position.length(), l2 = bone[`foot_${s}`].position.length();
    const d = foot.clone().sub(hip), D = Math.min(d.length(), l1 + l2 - 1e-3), u = d.clone().normalize();
    const ang = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D))));
    const side = hint.clone().sub(u.clone().multiplyScalar(hint.dot(u))).normalize();
    const th = u.clone().multiplyScalar(Math.cos(ang)).add(side.multiplyScalar(Math.sin(ang)));
    aim(`thigh_${s}`, th); aim(`calf_${s}`, foot.clone().sub(hip.clone().add(th.clone().multiplyScalar(l1))).normalize());
  }

  /* ---------- Accesorios ---------- */
  const metal = new THREE.MeshStandardMaterial({ color: "#c9ccd2", metalness: 1, roughness: 0.3 });
  const rubber = new THREE.MeshStandardMaterial({ color: "#1d1f24", roughness: 0.55 });
  const steel = new THREE.MeshStandardMaterial({ color: "#2c2f36", metalness: 0.6, roughness: 0.4 });
  const pad = new THREE.MeshStandardMaterial({ color: "#7a1f24", roughness: 0.8 });
  disposables.push(metal, rubber, steel, pad);
  const shadowAll = (g) => { g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };
  function dumbbell() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.6, 16), metal));
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.42, 6), rubber); p.position.y = s * 1.0; g.add(p); const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 6), rubber); p2.position.y = s * 1.32; g.add(p2); }
    return shadowAll(g);
  }
  function barbell() {
    const g = new THREE.Group(); const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 13, 16), metal); bar.rotation.z = Math.PI / 2; g.add(bar);
    for (const sx of [-1, 1]) for (const [x, rr, w] of [[4.6, 2.2, 0.45], [5.1, 2.2, 0.45], [5.55, 1.5, 0.35]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, w, 32), rubber); p.rotation.z = Math.PI / 2; p.position.x = sx * x; g.add(p); }
    return shadowAll(g);
  }
  const box = (w, h, d, mat, pos, q) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.copy(pos); if (q) o.quaternion.copy(q); o.castShadow = o.receiveShadow = true; world.add(o); return o; };
  function attach(side, obj) {
    const h = bone[`hand_${side}`], mid = wpos(`middle_01_${side}`).add(wpos(`hand_${side}`)).multiplyScalar(0.5);
    const holder = new THREE.Group(); holder.position.copy(h.worldToLocal(mid.clone())); h.add(holder); holder.add(obj); return holder;
  }
  function clearProps() {
    for (const o of [...world.children]) { world.remove(o); o.traverse((x) => x.geometry?.dispose()); }
    if (props?.db) for (const h of props.db) h.parent?.remove(h);
    props = null;
    fig.rotation.set(0, fig.rotation.y, 0); fig.position.set(0, 0, 0); fig.updateMatrixWorld(true);
  }

  /* ---------- Ejercicios (técnica correcta) ---------- */
  const EX = {
    // Curl: codos fijos pegados al torso, solo sube el antebrazo, palmas hacia arriba
    curl(t) {
      if (!props.db) props.db = ["l", "r"].map((s) => attach(s, dumbbell()));
      const kk = t < 0.35 ? ease(t / 0.35) : t < 0.45 ? 1 : 1 - ease(Math.min(1, (t - 0.45) / 0.45));
      standLegs(); for (const n of ["spine_01", "spine_02", "spine_03"]) aim(n, V(0, 1, 0.03)); aim("neck_01", V(0, 1, 0.3));
      for (const s of ["l", "r"]) { const sg = s === "l" ? 1 : -1, ang = 0.12 + 2.35 * kk;
        arm(s, V(sg * 0.12, -1, 0.03 + 0.06 * kk), V(sg * 0.04, -Math.cos(ang), Math.sin(ang))); twist(`lowerarm_${s}`, sg * 1.4); fingers(s, 1); }
      ["l", "r"].forEach((s, i) => { const h = props.db[i]; h.parent.updateMatrixWorld(true); h.parent.getWorldQuaternion(tq);
        const fore = wpos(`hand_${s}`).sub(wpos(`lowerarm_${s}`)).normalize(), X = new THREE.Vector3(1, 0, 0).applyQuaternion(fig.quaternion);
        const axis = X.clone().sub(fore.clone().multiplyScalar(fore.dot(X))).normalize();
        h.quaternion.copy(tq.clone().invert().multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis))); });
    },
    // Sentadilla: cadera atrás y abajo, rodillas hacia la punta del pie, torso ~40°, talones apoyados, brazos al frente
    squat(t) {
      const k = rep(t, 0.45, 0.08, 0.32), th = 1.42 * k, shin = 0.58 * k;
      const l1 = bone.calf_l.position.length(), l2 = bone.foot_l.position.length();
      for (const s of ["l", "r"]) { const sg = s === "l" ? 1 : -1;
        aim(`thigh_${s}`, V(sg * (0.06 + 0.22 * k), -Math.cos(th), Math.sin(th))); aim(`calf_${s}`, V(sg * (0.03 + 0.06 * k), -Math.cos(shin), -Math.sin(shin))); worldRot(`foot_${s}`, new THREE.Quaternion()); }
      bone.pelvis.position.set(pelvisP.x, pelvisP.y - (l1 * (1 - Math.cos(th)) + l2 * (1 - Math.cos(shin))), pelvisP.z - (l1 * Math.sin(th) - l2 * Math.sin(shin)));
      const lean = 0.75 * k; for (const n of ["spine_01", "spine_02", "spine_03"]) aim(n, V(0, Math.cos(lean), Math.sin(lean)));
      aim("neck_01", V(0, Math.cos(lean * 0.55), Math.sin(lean * 0.55) + 0.3));
      const f = 0.15 + (Math.PI / 2 - 0.15) * k;
      for (const s of ["l", "r"]) { const sg = s === "l" ? 1 : -1; arm(s, V(sg * 0.12, -Math.cos(f), Math.sin(f)), V(sg * 0.1, -Math.cos(f), Math.sin(f) + 0.05)); fingers(s, 0.12); }
    },
    // Press de banca: acostado, pies en el piso; la barra baja a la parte baja del pecho (codos ~45°) y sube con los brazos extendidos
    bench(t) {
      if (!props.bar) {
        const top = y0 + 5.2;
        const pd = box(2.8, 0.7, 12, pad, new THREE.Vector3(0, top - 0.35, 0)); void pd;
        box(0.8, 0.5, 11, steel, new THREE.Vector3(0, top - 1.0, 0));
        for (const z of [-4.8, 4.8]) { box(0.6, top - 1.2 - y0, 0.6, steel, new THREE.Vector3(0, (top - 1.2 + y0) / 2, z)); box(3.6, 0.35, 0.8, steel, new THREE.Vector3(0, y0 + 0.17, z)); }
        for (const x of [-2.6, 2.6]) box(0.45, 9.5, 0.45, steel, new THREE.Vector3(x, y0 + 4.75, -4.6));
        props.bar = barbell(); world.add(props.bar);
        fig.rotation.set(-Math.PI / 2, 0, 0); fig.updateMatrixWorld(true);
        const pw = wpos("pelvis"), sp = wpos("spine_03");
        fig.position.set(0, top + 1.25 - pw.y, 3.4 - (pw.z + sp.z) / 2); fig.updateMatrixWorld(true);
      }
      const k = rep(t, 0.45, 0.1, 0.32);
      for (const n of ["spine_01", "spine_02", "spine_03"]) aim(n, V(0, 1, 0.02)); aim("neck_01", V(0, 1, 0.12));
      for (const s of ["l", "r"]) { const sg = s === "l" ? 1 : -1;
        aim(`thigh_${s}`, V(sg * 0.38, -1, -0.12)); aim(`calf_${s}`, V(sg * 0.05, -0.15, -1)); worldRot(`foot_${s}`, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
        arm(s, V(sg * (0.2 + 0.62 * k), 0.04 - 0.42 * k, 1 - 1.5 * k), V(sg * (0.1 - 0.06 * k), -0.04, 1)); twist(`lowerarm_${s}`, -sg * 0.2); fingers(s, 1); }
      const hl = wpos("middle_01_l").add(wpos("hand_l")).multiplyScalar(0.5), hr = wpos("middle_01_r").add(wpos("hand_r")).multiplyScalar(0.5);
      props.bar.position.copy(hl.add(hr).multiplyScalar(0.5));
    },
    // Prensa 45°: espalda apoyada; la plataforma sube y baja por los rieles; rodillas en línea con los pies
    legpress(t) {
      const posePL = (k) => {
        for (const n of ["spine_01", "spine_02", "spine_03"]) aim(n, V(0, 1, 0)); aim("neck_01", V(0, 1, 0.3));
        const reach = 7.7 - 3.1 * k;
        for (const s of ["l", "r"]) { const sg = s === "l" ? 1 : -1, hip = props.hip[s];
          legIK(s, hip, hip.clone().add(new THREE.Vector3(sg * 0.55, 1.3, reach)), V(sg * 0.22, 1, 0));
          worldRot(`foot_${s}`, new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 4 - 0.15, 0, 0)));
          arm(s, V(sg * 0.5, -1, 0.1), V(sg * 0.15, -0.55, 1)); fingers(s, 1); }
        return wpos("ball_l").add(wpos("ball_r")).multiplyScalar(0.5).add(wpos("foot_l").add(wpos("foot_r")).multiplyScalar(0.5)).multiplyScalar(0.5);
      };
      if (!props.plat) {
        fig.rotation.set(-Math.PI / 4, 0, 0); fig.updateMatrixWorld(true);
        const pw = wpos("pelvis"); fig.position.set(0, y0 + 4.2 - pw.y, -2 - pw.z); fig.updateMatrixWorld(true);
        const toChar = (w) => w.clone().sub(fig.position).applyQuaternion(fig.quaternion.clone().invert());
        props.hip = { l: toChar(wpos("thigh_l")), r: toChar(wpos("thigh_r")) };
        const A = new THREE.Vector3(0, Math.SQRT1_2, Math.SQRT1_2), Uu = new THREE.Vector3(0, -Math.SQRT1_2, Math.SQRT1_2);
        const P1 = posePL(1).clone(), P0 = posePL(0).clone(), Q = fig.quaternion.clone();
        const alongA = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), A);
        const r0 = P1.clone().addScaledVector(A, -2.5).addScaledVector(Uu, 1.3), r1 = P0.clone().addScaledVector(A, 6).addScaledVector(Uu, 1.3);
        const rc = r0.clone().add(r1).multiplyScalar(0.5), L = r1.distanceTo(r0);
        for (const x of [-2.2, 2.2]) {
          box(0.5, 0.5, L, steel, new THREE.Vector3(x, rc.y, rc.z), alongA);
          box(0.55, r1.y - y0, 0.55, steel, new THREE.Vector3(x, (r1.y + y0) / 2, r1.z));
          box(0.55, Math.max(0.3, r0.y - y0), 0.55, steel, new THREE.Vector3(x, (r0.y + y0) / 2, r0.z));
          box(0.6, 0.4, r1.z - r0.z + 1, steel, new THREE.Vector3(x, y0 + 0.2, (r0.z + r1.z) / 2));
        }
        box(4.9, 0.45, 0.45, steel, new THREE.Vector3(0, r1.y, r1.z)); box(4.9, 0.4, 0.6, steel, new THREE.Vector3(0, y0 + 0.2, r1.z));
        const back = new THREE.Vector3(0, -Math.SQRT1_2, -Math.SQRT1_2), toFeet = new THREE.Vector3(0, -1, 0).applyQuaternion(Q);
        const bp = wpos("spine_02").addScaledVector(back, 1.25); box(3.6, 8.5, 0.7, pad, bp, Q);
        const sp = wpos("pelvis").addScaledVector(toFeet, 1.5).addScaledVector(back, 0.2).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(Q), 1.2); box(3.6, 0.7, 3.6, pad, sp, Q);
        const under = bp.clone().addScaledVector(back, 0.7);
        box(0.7, under.y - y0, 0.7, steel, new THREE.Vector3(0, (under.y + y0) / 2, under.z)); box(0.7, sp.y - y0, 0.7, steel, new THREE.Vector3(0, (sp.y + y0) / 2, sp.z + 0.6));
        box(0.6, 0.4, r0.z - under.z + 2, steel, new THREE.Vector3(0, y0 + 0.2, (under.z + r0.z) / 2)); box(5, 0.4, 0.6, steel, new THREE.Vector3(0, y0 + 0.2, r0.z));
        for (const s of ["l", "r"]) { const h = wpos(`hand_${s}`).add(wpos(`middle_01_${s}`)).multiplyScalar(0.5);
          const gp = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.4, 12), rubber); gp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1).applyQuaternion(Q)); gp.position.copy(h); gp.castShadow = true; world.add(gp);
          box(0.3, h.y - y0 - 0.2, 0.3, steel, new THREE.Vector3(h.x, (h.y + y0) / 2, h.z)); }
        const plat = new THREE.Group(); plat.quaternion.copy(alongA); world.add(plat); props.plat = plat;
        const add2 = (o, x, y, z, rz) => { o.position.set(x, y, z); if (rz) o.rotation.z = rz; o.castShadow = o.receiveShadow = true; plat.add(o); };
        add2(new THREE.Mesh(new THREE.BoxGeometry(6.2, 5.6, 0.35), steel), 0, 0, 0.2);
        add2(new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.5, 3.0), steel), 0, -1.3, 1.6);
        for (const x of [-2.2, 2.2]) add2(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 2.6), steel), x, -1.3, 1.6);
        for (const x of [-3.4, 3.4]) { add2(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 12), metal), x, -0.4, 2.2, Math.PI / 2);
          add2(new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.45, 32), rubber), x * 1.1, -0.4, 2.2, Math.PI / 2); add2(new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.45, 32), rubber), x * 1.24, -0.4, 2.2, Math.PI / 2); }
      }
      const P = posePL(rep(t, 0.45, 0.08, 0.32));
      props.plat.position.copy(P).add(new THREE.Vector3(0, 0.18, 0.18));
    },
  };
  // Encuadre de cámara por ejercicio [posición relativa, punto a mirar relativo a la cadera]
  const FRAMING = {
    idle: { cam: [5, 2.4, 44], look: [0, 0.6, 0], abs: true },
    curl: { cam: [6, 2.5, 46], look: [0, 0.8, 0], abs: true },
    squat: { cam: [5, 2.5, 50], look: [-1, 0.3, 0], abs: true },
    bench: { cam: [32, 14, 32], look: [0, 1.0, 0] },
    legpress: { cam: [48, 8, 24], look: [0, 3, 6] },
  };
  const camTarget = { pos: new THREE.Vector3(), look: new THREE.Vector3() }, camLook = new THREE.Vector3();
  let camInit = false;
  function frameFor(name) {
    const f = FRAMING[name] || FRAMING.idle;
    const base = f.abs ? new THREE.Vector3(0, 0, 0) : wpos("spine_01");
    camTarget.look.copy(base).add(new THREE.Vector3(...f.look));
    camTarget.pos.copy(camTarget.look).add(new THREE.Vector3(...f.cam));
    if (!camInit) { camInit = true; camera.position.copy(camTarget.pos); camLook.copy(camTarget.look); }
  }

  const REP_MS = 2600, REPS = 3;
  function pose(now) {
    if (!built) return;
    reset();
    if (current !== "idle") {
      const el2 = now - exStart, t = (el2 % REP_MS) / REP_MS;
      if (el2 > REP_MS * REPS) { current = "idle"; clearProps(); frameFor("idle"); }
      else { EX[current](t); return; }
    }
    // De pie, respirando; «flexionar» = doble bíceps
    const want = now < flexUntil;
    flexK = Math.max(0, Math.min(1, flexK + (want ? 0.06 : -0.05)));
    const k = ease(flexK), br = Math.sin(now / 900) * 0.012;
    standLegs();
    for (const n of ["spine_01", "spine_02", "spine_03"]) aim(n, V(0, 1, 0.02 + br - 0.03 * k));
    aim("neck_01", V(0, 1, 0.28 - 0.1 * k));
    for (const s of ["l", "r"]) { const sg = s === "l" ? 1 : -1, sway = Math.sin(now / 1200 + (sg > 0 ? 0 : 1.3)) * 0.02;
      arm(s, mixV(V(sg * (0.2 + sway), -1, 0.04), V(sg, 0.12, -0.05), k), mixV(V(sg * 0.12, -1, 0.2), V(sg * 0.15, 1, 0.25), k));
      if (k > 0) twist(`lowerarm_${s}`, sg * 1.2 * k);
      fingers(s, 0.3 + 0.8 * k); }
  }

  /* ---------- Bucle y controles ---------- */
  let raf = 0, visible = true, last = performance.now();
  let drag = null, yawV = 0;
  el.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: fig.rotation.y }; el.style.cursor = "grabbing"; });
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  function onMove(e) { if (!drag || current === "bench" || current === "legpress") return; const dx = e.clientX - drag.x; yawV = dx * 0.012 - (fig.rotation.y - drag.y); fig.rotation.y = drag.y + dx * 0.012; }
  function onUp() { drag = null; el.style.cursor = "grab"; }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || !built) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!drag && current !== "bench" && current !== "legpress") { yawV *= 0.92; fig.rotation.y += yawV * 0.15; if (current === "idle") fig.rotation.y += (-0.35 - fig.rotation.y) * dt * 0.4; }
    pose(now);
    fig.updateMatrixWorld(true);
    camera.position.lerp(camTarget.pos, Math.min(1, dt * 3)); camLook.lerp(camTarget.look, Math.min(1, dt * 3)); camera.lookAt(camLook);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.01 });
  io.observe(container);
  const onVis = () => { visible = !document.hidden; };
  document.addEventListener("visibilitychange", onVis);
  function resize() { const w = container.clientWidth || 300, h = container.clientHeight || 360; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  frameFor("idle");

  let building = null, queued = false;
  const shapeKey = (s, m) => JSON.stringify([s.body, s.hair, s.outfit, s.face, Object.entries(m).map(([k, v]) => [k, Math.round(v * 20) / 20])]);
  async function rebuild() {
    if (building) { queued = true; return; }
    building = build().catch((e) => { loading.textContent = "No se pudo cargar el personaje."; console.warn(e); }).finally(() => { building = null; if (queued) { queued = false; rebuild(); } });
  }
  return {
    set(nextStyle, muscles) {
      const prev = style && shapeKey(style, mus);
      style = { ...nextStyle }; mus = { ...(muscles || {}) };
      if (!built || prev !== shapeKey(style, mus)) { if (current !== "idle") { current = "idle"; clearProps(); } rebuild(); }
      else paint();
    },
    flex(ms = 2200) { if (current !== "idle") return; flexUntil = performance.now() + ms; },
    play(name) {
      if (!built || !EX[name]) return;
      clearProps(); props = {}; current = name; exStart = performance.now();
      fig.rotation.y = name === "squat" ? -1.25 : name === "curl" ? -0.45 : 0;
      reset(); EX[name](0); fig.updateMatrixWorld(true); frameFor(name);
    },
    stop() { if (current !== "idle") { current = "idle"; clearProps(); frameFor("idle"); } },
    get exercise() { return current; },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
      clearProps(); for (const d of disposables) d.dispose(); renderer.dispose(); el.remove(); loading.remove();
    },
  };
}
