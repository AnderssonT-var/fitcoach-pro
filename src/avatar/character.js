/* Personaje 3D de VYTRAFIT (Three.js), versión de cuerpo fusionado y estilo caricatura.
   - El cuerpo es UNA malla continua (formas suaves fundidas) con esqueleto real:
     los brazos se doblan sin uniones al flexionar.
   - Cada grupo muscular (0–1) agranda su forma: pecho, espalda (forma la V), hombros,
     bíceps, tríceps, antebrazos, abdomen, cuádriceps, femorales, glúteos y pantorrillas.
   - La ropa son zonas de color sobre la piel: se recolorea al instante sin rehacer la malla. */
import * as THREE from "three";
import { cone, ell, sceneDist, surfaceNets } from "./sdf.js";

const ZERO = { chest: 0, back: 0, shoulders: 0, biceps: 0, triceps: 0, forearms: 0, abs: 0, quads: 0, hams: 0, glutes: 0, calves: 0 };
const mix = (a, b, t) => a + (b - a) * t;
const HEAD_SCALE = 1.22;
const A_POSE = 0.32; // ángulo de los brazos en la malla base (radianes desde la vertical)
const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/* Huesos: nombre → [padre, posición en la pose base] */
function skeletonLayout(f, m) {
  const shW = (f ? 0.168 : 0.19) + m.back * (f ? 0.022 : 0.045) + m.shoulders * 0.012;
  const out = { hips: [null, [0, 0.93, 0]], spine: ["hips", [0, 1.06, 0]], chest: ["spine", [0, 1.26, 0]], neck: ["chest", [0, 1.46, 0]], head: ["neck", [0, 1.56, 0.005]] };
  const ua = 0.27, fa = 0.245;
  const dirOf = (s) => [s * Math.sin(A_POSE), -Math.cos(A_POSE), 0];
  for (const [sd, s] of [["L", -1], ["R", 1]]) {
    const S = [s * shW, 1.405, 0];
    const dir = dirOf(s);
    const E = [S[0] + dir[0] * ua, S[1] + dir[1] * ua, 0];
    const W = [E[0] + dir[0] * fa, E[1] + dir[1] * fa, 0.01];
    out[`upper${sd}`] = ["chest", S]; out[`fore${sd}`] = [`upper${sd}`, E]; out[`hand${sd}`] = [`fore${sd}`, W];
    const H = [s * (f ? 0.092 : 0.088), 0.9, 0], K = [s * (f ? 0.098 : 0.1), 0.49, 0.005], A = [s * 0.104, 0.095, -0.005];
    out[`thigh${sd}`] = ["hips", H]; out[`shin${sd}`] = [`thigh${sd}`, K]; out[`foot${sd}`] = [`shin${sd}`, A];
  }
  return { bones: out, shW, dirOf };
}

/* ---------- Formas del cuerpo (sin cabeza) ---------- */
function bodyPrims(style, m, L) {
  const f = style.body === "f";
  const g = f ? 0.62 : 1; // en el cuerpo femenino el músculo crece con formas más suaves
  const B = L.bones;
  const P = [];
  const add = (p, bone, label) => { p.bone = bone; p.label = label; P.push(p); return p; };
  const waistR = f ? 0.112 : 0.125;
  add(ell(0, 0.935, -0.005, f ? 0.158 : 0.14, 0.11, f ? 0.112 : 0.105, { k: 0 }), "hips", "shorts");
  add(ell(0, 1.07, 0.0, waistR, 0.14, f ? 0.088 : 0.095, { k: 0.06 }), "spine", "torso");
  const ribW = (f ? 0.14 : 0.158) + m.back * 0.018 * g + m.chest * 0.008;
  add(ell(0, 1.27, -0.005, ribW, 0.16, (f ? 0.098 : 0.108) + m.chest * 0.008 * g, { k: 0.06 }), "chest", "torso");
  for (const s of [-1, 1]) add(ell(s * (0.095 + m.back * 0.03 * g), 1.25, -0.035, 0.065 + m.back * 0.045 * g, 0.13, 0.062 + m.back * 0.012, { k: 0.05 }), "chest", "torso"); // dorsales
  if (f) for (const s of [-1, 1]) add(ell(s * 0.064, 1.285, 0.072, 0.066, 0.062, 0.056, { k: 0.035 }), "chest", "torso");
  else for (const s of [-1, 1]) add(ell(s * 0.068, 1.315, 0.066 + m.chest * 0.012, 0.082 + m.chest * 0.016, 0.058 + m.chest * 0.012, 0.03 + m.chest * 0.034, { k: 0.03 }), "chest", "torso");
  if ((style.outfit === "none" || style.outfit === "top") && m.abs > 0.1) {
    const d = 0.008 + m.abs * 0.014;
    for (let r = 0; r < 3; r++) for (const s of [-1, 1]) add(ell(s * 0.031, 1.17 - r * 0.056, (f ? 0.083 : 0.09) - 0.004, 0.026, 0.023, d, { k: 0.012 }), "spine", "torso");
  }
  add(ell(0, 1.42, -0.025, 0.1 + m.back * 0.045 * g, 0.045 + m.back * 0.022 * g, 0.06, { k: 0.05 }), "chest", "skinTop"); // trapecios
  add(cone([0, 1.41, -0.005], [0, 1.6, 0.0], 0.056 + m.back * 0.016 * g, 0.05, { k: 0.04 }), "neck", "skin");
  for (const s of [-1, 1]) add(ell(s * 0.068, 0.925, -0.07, 0.085 + m.glutes * 0.018 * g + (f ? 0.012 : 0), 0.088 + m.glutes * 0.014, 0.065 + m.glutes * 0.035 + (f ? 0.014 : 0), { k: 0.04 }), "hips", "shorts");
  for (const [sd, s] of [["L", -1], ["R", 1]]) {
    const S = B[`upper${sd}`][1], E = B[`fore${sd}`][1], W = B[`hand${sd}`][1];
    const dir = L.dirOf(s);
    const up = `upper${sd}`, fo = `fore${sd}`, ha = `hand${sd}`;
    add(ell(S[0] + s * 0.012, S[1] - 0.012, S[2], 0.068 + m.shoulders * 0.034 * g, 0.066 + m.shoulders * 0.026 * g, 0.064 + m.shoulders * 0.03 * g, { k: 0.05 }), up, "sleeve"); // deltoide
    add(cone(S, E, 0.048 + (m.biceps + m.triceps) * 0.006 * g, 0.038, { k: 0.03 }), up, "arm");
    const mid = lerp3(S, E, 0.5);
    add(ell(mid[0] + dir[0] * 0.01, mid[1], mid[2] + 0.018, 0.036 + m.biceps * 0.012 * g, 0.072, 0.03 + m.biceps * 0.03 * g, { k: 0.03 }), up, "arm"); // bíceps
    add(ell(mid[0], mid[1] + 0.01, mid[2] - 0.02, 0.038 + m.triceps * 0.01 * g, 0.085, 0.03 + m.triceps * 0.026 * g, { k: 0.03 }), up, "arm"); // tríceps
    add(ell(E[0], E[1], E[2], 0.04, 0.04, 0.04, { k: 0.03 }), fo, "arm"); // codo
    add(cone(E, W, 0.042 + m.forearms * 0.012 * g, 0.03, { k: 0.03 }), fo, "arm");
    const fm = lerp3(E, W, 0.28);
    add(ell(fm[0], fm[1], fm[2] + 0.004, 0.042 + m.forearms * 0.012 * g, 0.07, 0.038 + m.forearms * 0.01, { k: 0.03 }), fo, "arm");
    const Hc = [W[0] + dir[0] * 0.055, W[1] + dir[1] * 0.055, W[2] + 0.004];
    add(ell(Hc[0], Hc[1], Hc[2], 0.034, 0.05, 0.03, { k: 0.02 }), ha, "arm"); // mano
    add(cone([Hc[0], Hc[1] + 0.02, Hc[2] + 0.02], [Hc[0] - s * 0.002, Hc[1] - 0.012, Hc[2] + 0.034], 0.013, 0.011, { k: 0.012 }), ha, "arm"); // pulgar
  }
  for (const [sd, s] of [["L", -1], ["R", 1]]) {
    const H = B[`thigh${sd}`][1], K = B[`shin${sd}`][1], A = B[`foot${sd}`][1];
    const th = `thigh${sd}`, sh = `shin${sd}`, fo = `foot${sd}`;
    add(cone(H, K, (f ? 0.088 : 0.082) + m.quads * 0.02 * g, 0.05, { k: 0.05 }), th, "leg");
    const q = lerp3(H, K, 0.45);
    add(ell(q[0] + s * 0.008, q[1], q[2] + 0.028, 0.066 + m.quads * 0.022 * g, 0.15, 0.05 + m.quads * 0.032 * g, { k: 0.04 }), th, "leg"); // cuádriceps
    add(ell(K[0] - s * 0.024, K[1] + 0.08, K[2] + 0.035, 0.036 + m.quads * 0.014 * g, 0.05, 0.03 + m.quads * 0.014 * g, { k: 0.03 }), th, "leg"); // vasto interno
    add(ell(q[0], q[1] + 0.01, q[2] - 0.03, 0.062, 0.14, 0.045 + m.hams * 0.03 * g, { k: 0.04 }), th, "leg"); // femorales
    add(ell(K[0], K[1], K[2] + 0.005, 0.048, 0.05, 0.048, { k: 0.03 }), sh, "leg"); // rodilla
    add(cone(K, A, 0.05, 0.034, { k: 0.03 }), sh, "leg");
    const c = lerp3(K, A, 0.28);
    add(ell(c[0], c[1], c[2] - 0.03, 0.048 + m.calves * 0.012 * g, 0.09, 0.042 + m.calves * 0.028 * g, { k: 0.03 }), sh, "leg"); // gemelo
    add(ell(A[0], 0.05, 0.045, 0.052, 0.05, 0.115, { k: 0.03 }), fo, "shoe"); // zapatilla
  }
  add(ell(0, -0.5, 0, 1, 0.5, 1, { sub: true }), "hips", "shoe"); // suela plana
  return P;
}

/* ---------- Cabeza y pelo (coordenadas locales de la cabeza) ---------- */
function headPrims(f) {
  const P = [];
  const add = (p) => { P.push(p); return p; };
  add(ell(0, 0.02, 0, 0.128, 0.142, 0.132, { k: 0 }));                       // cráneo
  add(ell(0, -0.055, 0.03, f ? 0.088 : 0.098, 0.078, 0.09, { k: 0.06 }));     // mandíbula
  for (const s of [-1, 1]) add(ell(s * 0.062, -0.03, 0.085, 0.04, 0.032, 0.03, { k: 0.04 })); // mejillas
  add(ell(0, -0.012, 0.135, 0.022, 0.02, 0.02, { k: 0.02 }));                 // nariz
  for (const s of [-1, 1]) add(ell(s * 0.128, -0.005, -0.005, 0.016, 0.03, 0.022, { k: 0.015 })); // orejas
  add(cone([0, -0.15, -0.02], [0, -0.06, 0], 0.05, 0.055, { k: 0.04 }));      // cuello
  return P;
}
const hairline = (x, y, z) => 0.55 * z - y + 0.035; // el pelo empieza más arriba en la frente que atrás
function hairPrims(style) {
  const P = [];
  const add = (p) => { P.push(p); return p; };
  const cut = (fn = hairline) => add({ cut: true, custom: fn });
  const cap = (s) => add(ell(0, 0.03, -0.006, 0.128 * s, 0.142 * s, 0.132 * s, { k: 0 }));
  switch (style) {
    case "rapado": cap(1.03); cut(); break;
    case "corto": cap(1.09); add(ell(0, 0.13, 0.05, 0.085, 0.045, 0.07, { k: 0.04 })); add(ell(0.03, 0.12, 0.09, 0.06, 0.035, 0.04, { k: 0.04 })); cut(); break;
    case "rizado": cap(1.1); for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2; const y = 0.08 + (i % 3) * 0.035; const r = 0.12 - (i % 3) * 0.02; add(ell(Math.cos(a) * r, y, Math.sin(a) * r - 0.01, 0.04, 0.04, 0.04, { k: 0.03 })); } cut(); break;
    case "largo": cap(1.1); add(ell(0, -0.08, -0.07, 0.13, 0.17, 0.08, { k: 0.06 })); cut((x, y, z) => hairline(x, y, z) - Math.max(0, -z - 0.02) * 4); break;
    case "coleta": cap(1.07); cut(); add(ell(0, 0.06, -0.135, 0.04, 0.04, 0.04, { k: 0.02 })); add(cone([0, 0.04, -0.15], [0, -0.16, -0.2], 0.04, 0.022, { k: 0.02 })); break;
    case "mono": cap(1.07); cut(); add(ell(0, 0.16, -0.06, 0.065, 0.06, 0.065, { k: 0.03 })); break;
    default: return null; // calvo
  }
  return P;
}
/** Distancia de un conjunto que admite recortes con función propia (línea del pelo). */
function dist(P, x, y, z) {
  let d = 1e9;
  for (const p of P) {
    const di = p.custom ? p.custom(x, y, z) : sceneDist([p], x, y, z);
    if (p.sub) d = Math.max(d, -di);
    else if (p.cut) d = Math.max(d, di);
    else if (p.k > 0) { const h = Math.max(p.k - Math.abs(d - di), 0) / p.k; d = Math.min(d, di) - h * h * p.k * 0.25; }
    else d = Math.min(d, di);
  }
  return d;
}

function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, "rgba(0,0,0,.42)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const meshGeo = (m, colors = false) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(m.pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(m.nrm, 3));
  g.setIndex(new THREE.BufferAttribute(m.idx, 1));
  if (colors) g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(m.pos.length), 3));
  return g;
};

export function createCharacter(container, { accent = "#5856d6" } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 50);
  camera.position.set(0, 1.08, 4.55);
  camera.lookAt(0, 1.01, 0);
  scene.add(new THREE.HemisphereLight(0xfff4ea, 0x40404c, 1.25));
  const key = new THREE.DirectionalLight(0xfff1e0, 2.1); key.position.set(-2.2, 3.4, 3.2); scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(accent), 1.8); rim.position.set(2.4, 2.2, -2.6); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffffff, 0.7); rim2.position.set(-2.6, 1.6, -2.2); scene.add(rim2);
  const fill = new THREE.DirectionalLight(0xffffff, 0.4); fill.position.set(2, 0.6, 2.4); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.002;
  scene.add(ground);
  const fig = new THREE.Group();
  scene.add(fig);

  // Piel tipo vinilo: suave y con un poco de brillo
  const bodyMat = new THREE.MeshPhysicalMaterial({ roughness: 0.48, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.55, sheen: 0.4, sheenRoughness: 0.6 });
  const headMat = new THREE.MeshPhysicalMaterial({ roughness: 0.48, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.55, sheen: 0.4, sheenRoughness: 0.6 });
  const hairMat = new THREE.MeshPhysicalMaterial({ roughness: 0.55, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const M = {
    white: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 0.6 }),
    iris: new THREE.MeshPhysicalMaterial({ color: 0x5b3a1e, roughness: 0.3, clearcoat: 0.8 }),
    pupil: new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.2 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x7a2b2b, roughness: 0.5 }),
    blush: new THREE.MeshStandardMaterial({ color: 0xe8908a, roughness: 0.7, transparent: true, opacity: 0.35 }),
  };

  let style = null, mus = { ...ZERO };
  let body = null, bones = {};
  const disposables = [];

  // La ropa se dibuja píxel a píxel en el shader según la posición en la pose base:
  // bordes nítidos (escote, sisa, dobladillo) sin depender del tamaño de los triángulos.
  const U = {
    uSkin: { value: new THREE.Color() }, uTop: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
    uShoes: { value: new THREE.Color() }, uOutfit: { value: 0 }, uFem: { value: 0 },
  };
  bodyMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aFlags; attribute float aAlong; varying vec3 vRest; varying vec4 vFlags; varying float vAlong;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = position; vFlags = aFlags; vAlong = aAlong;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
uniform vec3 uSkin, uTop, uBottom, uShoes; uniform float uOutfit, uFem;
varying vec3 vRest; varying vec4 vFlags; varying float vAlong;
float cov(float d) { float w = max(fwidth(d), 1e-4) * 0.75; return smoothstep(-w, w, d); }
float sat1(float v) { return clamp(v, 0.0, 1.0); }`)
      .replace("#include <color_fragment>", `{
  float yy = vRest.y, ax = abs(vRest.x);
  float arm = step(0.5, vFlags.x), neck = step(0.5, vFlags.y), sTop = step(0.5, vFlags.z), shoe = step(0.5, vFlags.w);
  float waist = 1.0, hem = uFem > 0.5 ? 0.7 : 0.665;
  float body = (1.0 - arm) * (1.0 - neck);
  float cb = body * (1.0 - sTop) * min(cov(waist - yy), cov(yy - hem));
  float ct = 0.0;
  if (uOutfit > 0.5 && uOutfit < 1.5) { // camiseta
    ct = body * min(cov(1.43 - 0.03 * sat1(1.0 - pow(ax / 0.07, 2.0)) - yy), cov(yy - (waist - 0.03)));
    ct = max(ct, arm * cov(0.42 - vAlong));
    ct = max(ct, sTop * cov(1.43 - yy));
  } else if (uOutfit > 1.5 && uOutfit < 2.5) { // esqueleto
    float nk = 1.385 - 0.085 * sat1(1.0 - pow(ax / 0.115, 2.0));
    float ah = 0.128 - uFem * 0.005 - sat1((yy - 1.2) / 0.2) * 0.02;
    ct = body * (1.0 - sTop) * min(min(cov(nk - yy), cov(ah - ax)), cov(yy - (waist - 0.03)));
  } else if (uOutfit > 2.5) { // top deportivo
    ct = body * (1.0 - sTop) * min(min(cov(1.37 - 0.02 * sat1(1.0 - pow(ax / 0.06, 2.0)) - yy), cov(yy - 1.205)), cov(0.15 - ax));
  }
  vec3 c = mix(uSkin, uTop, ct);
  c = mix(c, uBottom, cb * (1.0 - step(0.5, ct)));
  c = mix(c, mix(uShoes, vec3(0.91), cov(0.018 - yy)), shoe);
  diffuseColor.rgb *= c;
}`);
  };
  const OUTFIT_ID = { none: 0, tee: 1, tank: 2, top: 3 };
  function paint() {
    if (!style) return;
    U.uSkin.value.set(style.skin); U.uTop.value.set(style.top); U.uBottom.value.set(style.bottom); U.uShoes.value.set(style.shoes);
    U.uOutfit.value = OUTFIT_ID[style.outfit] ?? 0;
    U.uFem.value = style.body === "f" ? 1 : 0;
    headMat.color.set(style.skin);
    hairMat.color.set(style.hairColor);
  }

  function build() {
    for (const d of disposables.splice(0)) d.dispose();
    fig.clear();
    const f = style.body === "f";
    const L = skeletonLayout(f, mus);

    // Esqueleto
    bones = {};
    const boneList = [];
    for (const [name, [parent, p]] of Object.entries(L.bones)) {
      const b = new THREE.Bone();
      b.name = name;
      const pp = parent ? L.bones[parent][1] : [0, 0, 0];
      b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
      bones[name] = b;
      boneList.push(b);
      if (parent) bones[parent].add(b);
    }
    const boneIndex = Object.fromEntries(boneList.map((b, i) => [b.name, i]));

    // Cuerpo: una sola malla
    const P = bodyPrims(style, mus, L);
    const mesh = surfaceNets((x, y, z) => sceneDist(P, x, y, z), [-0.6, -0.01, -0.26], [0.6, 1.62, 0.26], 0.0125);
    const n = mesh.pos.length / 3;
    const geo = meshGeo(mesh);
    // Pesos del esqueleto según las formas más cercanas: transiciones suaves en las articulaciones
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const flags = new Float32Array(n * 4), along = new Float32Array(n);
    const ds = new Float32Array(P.length);
    for (let v = 0; v < n; v++) {
      const x = mesh.pos[v * 3], y = mesh.pos[v * 3 + 1], z = mesh.pos[v * 3 + 2];
      let dmin = 1e9, li = 0;
      for (let i = 0; i < P.length; i++) {
        if (P[i].sub) { ds[i] = 1e9; continue; }
        ds[i] = sceneDist([P[i]], x, y, z);
        if (ds[i] < dmin) { dmin = ds[i]; li = i; }
      }
      const lb = P[li].label;
      flags[v * 4] = lb === "arm" || lb === "sleeve" ? 1 : 0; flags[v * 4 + 1] = lb === "skin" ? 1 : 0; flags[v * 4 + 2] = lb === "skinTop" ? 1 : 0; flags[v * 4 + 3] = lb === "shoe" ? 1 : 0;
      const acc = {};
      for (let i = 0; i < P.length; i++) { const w = Math.exp(-(ds[i] - dmin) / 0.014); if (w > 0.02) acc[P[i].bone] = (acc[P[i].bone] || 0) + w; }
      const top = Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const tot = top.reduce((t, e) => t + e[1], 0);
      top.forEach(([b, w], k) => { si[v * 4 + k] = boneIndex[b]; sw[v * 4 + k] = w / tot; });
      const sd = x < 0 ? "L" : "R";
      const S = L.bones[`upper${sd}`][1], E = L.bones[`fore${sd}`][1];
      const ex = E[0] - S[0], ey = E[1] - S[1];
      along[v] = ((x - S[0]) * ex + (y - S[1]) * ey) / (ex * ex + ey * ey);
    }
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
    geo.setAttribute("aFlags", new THREE.BufferAttribute(flags, 4));
    geo.setAttribute("aAlong", new THREE.BufferAttribute(along, 1));
    disposables.push(geo);
    body = new THREE.SkinnedMesh(geo, bodyMat);
    body.add(bones.hips);
    body.bind(new THREE.Skeleton(boneList));
    body.frustumCulled = false;
    fig.add(body);

    // Cabeza (malla fina, pegada al hueso de la cabeza)
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.125, 0.004);
    headPivot.scale.setScalar(HEAD_SCALE); // cabeza grande, estilo caricatura
    bones.head.add(headPivot);
    const hp = headPrims(f);
    const hg = meshGeo(surfaceNets((x, y, z) => dist(hp, x, y, z), [-0.17, -0.16, -0.17], [0.17, 0.19, 0.18], 0.008));
    disposables.push(hg);
    headPivot.add(new THREE.Mesh(hg, headMat));

    // Cara: ojos grandes, cejas, rubor y sonrisa
    const sph = new THREE.SphereGeometry(1, 32, 20);
    disposables.push(sph);
    const part = (mat, p, s, parent) => { const m = new THREE.Mesh(sph, mat); m.position.set(...p); m.scale.set(...s); parent.add(m); return m; };
    for (const s of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(s * 0.05, 0.012, 0.112);
      eye.rotation.y = s * 0.22;
      headPivot.add(eye);
      part(M.white, [0, 0, 0], [0.034, 0.04, 0.026], eye);
      part(M.iris, [0, -0.002, 0.021], [0.022, 0.024, 0.008], eye);
      part(M.pupil, [0, -0.002, 0.027], [0.012, 0.013, 0.004], eye);
      part(M.glint, [0.004 - s * 0.006, 0.01, 0.03], [0.0055, 0.0055, 0.002], eye);
      const browGeo = new THREE.CapsuleGeometry(0.008, 0.04, 4, 10);
      disposables.push(browGeo);
      const brow = new THREE.Mesh(browGeo, hairMat);
      brow.position.set(s * 0.052, 0.07, 0.122);
      brow.rotation.set(0, s * 0.25, Math.PI / 2 + s * 0.14);
      headPivot.add(brow);
      part(M.blush, [s * 0.075, -0.035, 0.11], [0.022, 0.014, 0.006], headPivot);
    }
    const smileGeo = new THREE.TorusGeometry(0.026, f ? 0.0065 : 0.0055, 8, 24, Math.PI * 0.9);
    disposables.push(smileGeo);
    const smile = new THREE.Mesh(smileGeo, M.mouth);
    smile.position.set(0, -0.06, 0.122);
    smile.rotation.set(-0.15, 0, Math.PI + Math.PI * 0.05);
    headPivot.add(smile);

    // Pelo
    const hpz = hairPrims(style.hair);
    if (hpz) {
      const hrg = meshGeo(surfaceNets((x, y, z) => dist(hpz, x, y, z), [-0.2, -0.3, -0.26], [0.2, 0.25, 0.2], 0.008));
      disposables.push(hrg);
      headPivot.add(new THREE.Mesh(hrg, hairMat));
    }
    paint();
  }

  /* ---------- girar con el dedo ---------- */
  let rotY = -0.4, vel = 0, dragging = false, lastX = 0, idleAt = 0;
  const el = renderer.domElement;
  const down = (e) => { dragging = true; lastX = e.clientX; el.setPointerCapture?.(e.pointerId); el.style.cursor = "grabbing"; };
  const move = (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; rotY += dx * 0.012; vel = dx * 0.012; idleAt = performance.now(); };
  const up = () => { dragging = false; el.style.cursor = "grab"; };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);

  /* ---------- animación: respiración, mirada y doble bíceps ---------- */
  let pose = "relax", poseT = 0, flexUntil = 0, raf = 0, visible = true, last = performance.now();
  const ease = (t) => t * t * (3 - 2 * t);
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || !body) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!dragging) {
      if (Math.abs(vel) > 0.0005) { rotY += vel; vel *= 0.92; }
      else if (now - idleAt > 2500) rotY += dt * 0.25;
    }
    fig.rotation.y = rotY;
    const br = Math.sin(now / 950) * 0.5 + 0.5;
    bones.chest.scale.set(1 + br * 0.012, 1, 1 + br * 0.015);
    bones.head.rotation.x = Math.sin(now / 2300) * 0.03;
    bones.head.rotation.y = Math.sin(now / 3100) * 0.08;
    const want = pose === "flex" || now < flexUntil;
    poseT = Math.max(0, Math.min(1, poseT + (want ? dt : -dt) * 2.4));
    const k = ease(poseT);
    for (const [sd, s] of [["L", -1], ["R", 1]]) {
      const sway = Math.sin(now / 1150 + (s > 0 ? 0 : 1.4)) * 0.025;
      bones[`upper${sd}`].rotation.set(mix(0.02, -0.12, k), 0, s * mix(-0.17 + sway, Math.PI / 2 - A_POSE + 0.05, k));
      bones[`fore${sd}`].rotation.set(0, mix(0, s * -0.2, k), s * mix(0.1, Math.PI / 2 + 0.35, k));
      bones[`hand${sd}`].rotation.set(0, 0, s * mix(0, 0.3, k));
      bones[`thigh${sd}`].rotation.set(0, 0, s * mix(0, 0.06, k));
      bones[`shin${sd}`].rotation.set(0, 0, s * mix(0, -0.03, k));
    }
    bones.spine.rotation.x = mix(0, -0.04, k);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.01 });
  io.observe(container);
  const onVis = () => { visible = !document.hidden; };
  document.addEventListener("visibilitychange", onVis);
  function resize() {
    const w = container.clientWidth || 300, h = container.clientHeight || 360;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let pending = 0;
  const shapeKey = (s, m) => JSON.stringify([s.body, s.hair, s.outfit === "none" || s.outfit === "top", m]);
  return {
    set(nextStyle, muscles) {
      const nm = { ...ZERO, ...(muscles || {}) };
      for (const k in nm) nm[k] = Math.round(nm[k] * 40) / 40; // sin rehacer la malla por cambios mínimos
      const rebuild = !style || shapeKey(style, mus) !== shapeKey(nextStyle, nm);
      const first = !body;
      style = { ...nextStyle };
      mus = nm;
      if (!rebuild) return paint();
      if (first) return build();
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => build());
    },
    flex(ms = 2200) { flexUntil = performance.now() + ms; },
    setPose(p) { pose = p; },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      for (const d of disposables) d.dispose();
      [bodyMat, headMat, hairMat, ...Object.values(M)].forEach((m) => m.dispose());
      renderer.dispose();
      el.remove();
    },
  };
}
