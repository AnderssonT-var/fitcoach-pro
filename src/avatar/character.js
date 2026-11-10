/* Personaje 3D de VYTRAFIT (Three.js, sin archivos externos: todo se arma con formas suaves).
   Cada grupo muscular (0–1) cambia el tamaño de su parte del cuerpo; respira, gira con el dedo
   y puede "flexionar" (doble bíceps) al tocar el botón o al subir de nivel. */
import * as THREE from "three";

const mix = (a, b, t) => a + (b - a) * t;
const ZERO = { chest: 0, back: 0, shoulders: 0, biceps: 0, triceps: 0, forearms: 0, abs: 0, quads: 0, hams: 0, glutes: 0, calves: 0 };

function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, "rgba(0,0,0,.45)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createCharacter(container, { accent = "#5856d6" } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 1.0, 4.9);
  camera.lookAt(0, 0.93, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a48, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(-2.2, 3.2, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(accent), 1.4);
  rim.position.set(2.5, 2, -2.5);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(2, 0.5, 2);
  scene.add(fill);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.001;
  scene.add(ground);

  const fig = new THREE.Group();
  scene.add(fig);

  // Materiales
  const M = {
    skin: new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 }),
    skinDark: new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 }),
    top: new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }),
    bottom: new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }),
    shoes: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05 }),
    hair: new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.25 }),
    sole: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
    lips: new THREE.MeshStandardMaterial({ color: 0xc8606e, roughness: 0.5 }),
  };

  const sphere = new THREE.SphereGeometry(1, 40, 28);
  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 10, 24);
  const add = (parent, geo, mat, pos = [0, 0, 0], scl = [1, 1, 1]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.scale.set(...scl);
    parent.add(m);
    return m;
  };

  let style = null, mus = { ...ZERO };
  const parts = {};
  const limbs = { L: {}, R: {} };
  let pose = "relax", poseT = 0, flexUntil = 0;
  let disposables = [];

  /* ---------- armado (se rehace al cambiar el estilo o los músculos) ---------- */
  function build() {
    for (const c of [...fig.children]) fig.remove(c);
    for (const g of disposables) g.dispose();
    disposables = [];
    const f = style.body === "f";
    const m = mus;
    const geo = (g) => { disposables.push(g); return g; };

    const waistR = f ? 0.118 : 0.13;
    const chestR = (f ? 0.142 : 0.16) + m.chest * (f ? 0.012 : 0.03) + m.back * 0.012;
    const shoulderR = (f ? 0.15 : 0.172) + m.back * (f ? 0.03 : 0.055) + m.shoulders * 0.015;
    const hipR = f ? 0.158 : 0.14;
    const outfit = style.outfit;
    const torsoMat = outfit === "none" || outfit === "top" ? M.skin : M.top;

    // Pelvis y torso (perfil girado → forma de V según espalda y pecho)
    add(fig, sphere, M.bottom, [0, 0.95, 0], [hipR, 0.12, 0.105 + (f ? 0.01 : 0)]);
    const prof = [
      [0.001, 0.0], [waistR * 0.98, 0.02], [waistR, 0.1], [mix(waistR, chestR, 0.55), 0.24], [chestR, 0.33], [shoulderR * 0.93, 0.42], [shoulderR * 0.78, 0.47], [0.065, 0.5], [0.001, 0.5],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const torsoGeo = geo(new THREE.LatheGeometry(prof, 40));
    const torso = add(fig, torsoGeo, torsoMat, [0, 0.96, 0], [1, 1, f ? 0.66 : 0.64]);
    parts.torso = torso;

    if (outfit === "top") {
      // Top deportivo
      const band = [[chestR * 0.9 + 0.01, 0.2], [chestR + 0.012, 0.3], [shoulderR * 0.9, 0.4], [shoulderR * 0.8, 0.44]].map(([r, y]) => new THREE.Vector2(r, y));
      add(fig, geo(new THREE.LatheGeometry(band, 40)), M.top, [0, 0.96, 0], [1.02, 1, 0.68]);
    }

    // Pecho
    const front = (chestR * (f ? 0.66 : 0.64));
    if (f) {
      for (const s of [-1, 1]) add(fig, sphere, outfit === "top" || outfit === "tank" || outfit === "tee" ? M.top : M.skin, [s * 0.058, 1.26, front - 0.012], [0.062, 0.06, 0.05]);
    } else {
      // Pectorales: casi planos al inicio, más marcados con el nivel
      const pk = 0.012 + m.chest * 0.04;
      for (const s of [-1, 1]) add(fig, sphere, torsoMat, [s * 0.064, 1.3, front - 0.03 + m.chest * 0.006], [0.085 + m.chest * 0.014, 0.055 + m.chest * 0.01, pk]);
    }

    // Abdomen visible (sin camiseta / top deportivo): se marca más con el nivel
    if ((outfit === "none" || outfit === "top") && m.abs > 0.12) {
      const d = 0.006 + m.abs * 0.012;
      const zAbs = waistR * 0.64 - 0.004;
      for (let row = 0; row < 3; row++) for (const s of [-1, 1]) {
        add(fig, sphere, M.skinDark, [s * 0.03, 1.15 - row * 0.065, zAbs], [0.026, 0.026, d]);
      }
    }

    // Trapecios y cuello
    for (const s of [-1, 1]) add(fig, sphere, outfit === "tee" ? M.top : M.skin, [s * 0.075, 1.43, -0.01], [0.06 + m.back * 0.03, 0.035 + m.back * 0.02, 0.05]);
    add(fig, geo(new THREE.CylinderGeometry(0.048 + m.back * 0.012, 0.055 + m.back * 0.016, 0.12, 24)), M.skin, [0, 1.5, 0]);

    // Cabeza
    const head = new THREE.Group();
    head.position.set(0, 1.635, 0.005);
    fig.add(head);
    parts.head = head;
    add(head, sphere, M.skin, [0, 0, 0], [0.1, 0.122, 0.11]);
    add(head, sphere, M.skin, [0, -0.055, 0.035], f ? [0.066, 0.055, 0.068] : [0.075, 0.06, 0.075]); // mandíbula
    for (const s of [-1, 1]) {
      add(head, sphere, M.skin, [s * 0.1, -0.005, -0.005], [0.018, 0.028, 0.014]); // orejas
      add(head, sphere, M.eye, [s * 0.036, 0.012, 0.097], [0.012, 0.015, 0.008]);   // ojos
      const brow = add(head, geo(new THREE.CapsuleGeometry(0.006, 0.026, 4, 8)), M.hair, [s * 0.037, 0.045, 0.1]);
      brow.rotation.z = Math.PI / 2 + s * 0.12;
    }
    add(head, sphere, M.skinDark, [0, -0.012, 0.11], [0.014, 0.02, 0.014]); // nariz
    const smile = add(head, geo(new THREE.TorusGeometry(0.022, f ? 0.0045 : 0.0035, 6, 16, Math.PI)), f ? M.lips : M.skinDark, [0, -0.05, 0.098]);
    smile.rotation.z = Math.PI;

    // Pelo
    const cap = (s = 1.06, theta = 1.35) => {
      const g = geo(new THREE.SphereGeometry(1, 36, 20, 0, Math.PI * 2, 0, theta));
      const h = add(head, g, M.hair, [0, 0.012, -0.006], [0.102 * s, 0.124 * s, 0.112 * s]);
      h.rotation.x = -0.28;
      return h;
    };
    switch (style.hair) {
      case "rapado": cap(1.012, 1.3); break;
      case "corto": cap(1.07, 1.32); add(head, sphere, M.hair, [0, 0.085, 0.045], [0.07, 0.035, 0.05]); break;
      case "rizado": cap(1.06, 1.35); for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2, r = 0.085 + (i % 3) * 0.01; add(head, sphere, M.hair, [Math.cos(a) * r * 0.95, 0.075 + (i % 2) * 0.03, Math.sin(a) * r - 0.01], [0.032, 0.032, 0.032]); } break;
      case "largo": cap(1.08, 1.5); add(head, geo(capsule(0.08, 0.18)), M.hair, [0, -0.12, -0.06], [1.15, 1, 0.55]); break;
      case "coleta": { cap(1.06, 1.42); const p = add(head, geo(capsule(0.035, 0.2)), M.hair, [0, -0.06, -0.15]); p.rotation.x = 0.55; add(head, sphere, M.hair, [0, 0.03, -0.11], [0.035, 0.035, 0.035]); break; }
      case "mono": cap(1.06, 1.42); add(head, sphere, M.hair, [0, 0.12, -0.07], [0.06, 0.055, 0.06]); break;
      default: break; // calvo
    }

    // Brazos (hombro → codo → mano)
    const sleeve = outfit === "tee";
    for (const side of ["L", "R"]) {
      const s = side === "R" ? 1 : -1;
      const L = limbs[side];
      const sh = new THREE.Group();
      sh.position.set(s * (shoulderR * 0.94 + 0.03), 1.415, 0);
      fig.add(sh);
      L.shoulder = sh;
      add(sh, sphere, sleeve ? M.top : M.skin, [0, 0, 0], Array(3).fill(0.058 + m.shoulders * 0.04 + (f ? -0.008 : 0))); // deltoide
      const upR = (f ? 0.039 : 0.044) + m.biceps * 0.012 + m.triceps * 0.012;
      add(sh, geo(capsule(upR, 0.2)), M.skin, [0, -0.15, 0]);
      if (sleeve) add(sh, geo(new THREE.CylinderGeometry(upR + 0.012, upR + 0.016, 0.13, 20)), M.top, [0, -0.07, 0]);
      L.bi = add(sh, sphere, M.skin, [0, -0.15, upR * 0.45], [upR * 0.85, 0.075 + m.biceps * 0.02, upR * (0.55 + m.biceps * 0.55)]);
      add(sh, sphere, M.skin, [0, -0.13, -upR * 0.4], [upR * 0.9, 0.085, upR * (0.5 + m.triceps * 0.5)]);
      const el = new THREE.Group();
      el.position.set(0, -0.29, 0);
      sh.add(el);
      L.elbow = el;
      add(el, sphere, M.skin, [0, 0, 0], Array(3).fill(upR * 0.82)); // codo
      const foR = (f ? 0.032 : 0.036) + m.forearms * 0.014;
      add(el, geo(capsule(foR, 0.18)), M.skin, [0, -0.12, 0], [1, 1, 0.92]);
      add(el, sphere, M.skin, [0, -0.06, 0.004], [foR * 1.15, 0.07, foR * 1.05]);
      add(el, sphere, M.skin, [0, -0.27, 0], [0.04, 0.05, 0.03]); // mano
    }

    // Piernas (cadera → rodilla → pie)
    for (const side of ["L", "R"]) {
      const s = side === "R" ? 1 : -1;
      const L = limbs[side];
      const hp = new THREE.Group();
      hp.position.set(s * (f ? 0.088 : 0.082), 0.9, 0);
      fig.add(hp);
      L.hip = hp;
      const thR = (f ? 0.072 : 0.068) + m.quads * 0.022 + m.hams * 0.01;
      add(hp, geo(capsule(thR, 0.28)), M.skin, [0, -0.2, 0]);
      add(hp, sphere, M.skin, [s * 0.008, -0.2, thR * 0.4], [thR * 0.92, 0.15, thR * (0.6 + m.quads * 0.45)]);   // cuádriceps
      add(hp, sphere, M.skin, [0, -0.2, -thR * 0.4], [thR * 0.9, 0.14, thR * (0.55 + m.hams * 0.4)]);           // femorales
      add(hp, geo(new THREE.CylinderGeometry(thR + 0.018, thR + 0.012, 0.2, 22)), M.bottom, [0, -0.07, 0]);    // short
      const kn = new THREE.Group();
      kn.position.set(0, -0.4, 0);
      hp.add(kn);
      L.knee = kn;
      const caR = 0.044 + m.calves * 0.006;
      add(kn, sphere, M.skin, [0, 0, 0.004], [thR * 0.78, 0.06, thR * 0.8]); // rodilla
      add(kn, geo(capsule(caR, 0.32)), M.skin, [0, -0.2, 0]);
      add(kn, sphere, M.skin, [0, -0.12, -caR * 0.45], [caR * 1.05, 0.085, caR * (0.75 + m.calves * 0.6)]);    // gemelo
      add(kn, geo(new THREE.CapsuleGeometry(0.048, 0.1, 6, 16)), M.shoes, [0, -0.46, 0.04], [1, 0.7, 1]).rotation.x = Math.PI / 2;
      add(kn, geo(new THREE.BoxGeometry(0.1, 0.018, 0.2)), M.sole, [0, -0.5, 0.04]);
    }
    // Glúteos
    for (const s of [-1, 1]) add(fig, sphere, M.bottom, [s * 0.065, 0.93, -0.06], [0.08 + m.glutes * 0.02 + (f ? 0.01 : 0), 0.08 + m.glutes * 0.015, 0.06 + m.glutes * 0.035 + (f ? 0.01 : 0)]);
  }

  function applyColors() {
    M.skin.color.set(style.skin);
    M.skinDark.color.set(style.skin).multiplyScalar(0.82);
    M.top.color.set(style.top);
    M.bottom.color.set(style.bottom);
    M.shoes.color.set(style.shoes);
    M.hair.color.set(style.hairColor);
  }

  /* ---------- interacción: girar con el dedo ---------- */
  let rotY = -0.35, vel = 0, dragging = false, lastX = 0, idleAt = 0;
  const el = renderer.domElement;
  const down = (e) => { dragging = true; lastX = e.clientX; el.setPointerCapture?.(e.pointerId); el.style.cursor = "grabbing"; };
  const move = (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; rotY += dx * 0.012; vel = dx * 0.012; idleAt = performance.now(); };
  const up = () => { dragging = false; el.style.cursor = "grab"; };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);

  /* ---------- animación ---------- */
  const ease = (t) => t * t * (3 - 2 * t);
  let raf = 0, visible = true, last = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || !style) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!dragging) {
      if (Math.abs(vel) > 0.0005) { rotY += vel; vel *= 0.92; }
      else if (now - idleAt > 2500) rotY += dt * 0.25;
    }
    fig.rotation.y = rotY;
    // Respiración
    const br = Math.sin(now / 900) * 0.5 + 0.5;
    if (parts.torso) parts.torso.scale.x = 1 + br * 0.012;
    if (parts.head) parts.head.position.y = 1.635 + br * 0.004;
    // Pose: relajado ⇄ doble bíceps
    const wantFlex = pose === "flex" || now < flexUntil;
    poseT = Math.max(0, Math.min(1, poseT + (wantFlex ? dt : -dt) * 2.6));
    const k = ease(poseT);
    for (const side of ["L", "R"]) {
      const s = side === "R" ? 1 : -1;
      const L = limbs[side];
      if (!L.shoulder) continue;
      const sway = Math.sin(now / 1100 + (s > 0 ? 0 : 1.3)) * 0.025;
      const th = mix(0.13 + sway, 1.42, k);
      L.shoulder.rotation.z = s * th;
      L.shoulder.rotation.x = mix(0.04, -0.15, k);
      L.elbow.rotation.z = s * mix(0.12, Math.PI - 1.42 + 0.15, k);
      if (L.bi) L.bi.scale.y = (0.075 + mus.biceps * 0.02) * (1 + k * 0.25);
      if (L.hip) L.hip.rotation.z = s * mix(0.03, 0.09, k);
    }
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


  return {
    /** style: aspecto; muscles: { chest: 0–1, … } */
    set(nextStyle, muscles) {
      const rebuild = !style || JSON.stringify({ ...style, top: 0, bottom: 0, shoes: 0, skin: 0, hairColor: 0, name: 0 }) !== JSON.stringify({ ...nextStyle, top: 0, bottom: 0, shoes: 0, skin: 0, hairColor: 0, name: 0 })
        || JSON.stringify(muscles || ZERO) !== JSON.stringify(mus);
      style = { ...nextStyle };
      mus = { ...ZERO, ...(muscles || {}) };
      applyColors();
      if (rebuild) build();
    },
    flex(ms = 2200) { flexUntil = performance.now() + ms; },
    setPose(p) { pose = p; },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      for (const g of disposables) g.dispose();
      Object.values(M).forEach((m) => m.dispose());
      renderer.dispose();
      el.remove();
    },
  };
}
