/* Superficies fusionadas: el cuerpo se describe con formas suaves (elipsoides y conos
   redondeados) que se funden entre sí, y aquí se convierten en una malla continua
   (método "surface nets"). Así el personaje no tiene uniones ni costuras. */

export const ELL = 0, CONE = 1;

/** Unión suave: funde dos distancias con un radio de mezcla k. */
export function smin(a, b, k) {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Distancia de un punto a una forma. */
export function primDist(p, x, y, z) {
  if (p.t === ELL) {
    const dx = x - p.cx, dy = y - p.cy, dz = z - p.cz;
    const k0 = Math.hypot(dx / p.rx, dy / p.ry, dz / p.rz);
    const k1 = Math.hypot(dx / (p.rx * p.rx), dy / (p.ry * p.ry), dz / (p.rz * p.rz));
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(p.rx, p.ry, p.rz);
  }
  // Cono redondeado entre a y b (radio r1 → r2)
  const bax = p.bx - p.ax, bay = p.by - p.ay, baz = p.bz - p.az;
  const pax = x - p.ax, pay = y - p.ay, paz = z - p.az;
  let t = (pax * bax + pay * bay + paz * baz) / p.len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const r = p.r1 + (p.r2 - p.r1) * t;
  return Math.hypot(pax - bax * t, pay - bay * t, paz - baz * t) - r;
}

export function ell(cx, cy, cz, rx, ry, rz, extra = {}) {
  return { t: ELL, cx, cy, cz, rx, ry, rz, k: 0.03, ...extra, bx0: cx, by0: cy, bz0: cz, br: Math.max(rx, ry, rz) };
}
export function cone(a, b, r1, r2, extra = {}) {
  const [ax, ay, az] = a, [bx, by, bz] = b;
  const len2 = (bx - ax) ** 2 + (by - ay) ** 2 + (bz - az) ** 2 || 1e-9;
  return { t: CONE, ax, ay, az, bx, by, bz, r1, r2, len2, k: 0.03, ...extra, bx0: (ax + bx) / 2, by0: (ay + by) / 2, bz0: (az + bz) / 2, br: Math.sqrt(len2) / 2 + Math.max(r1, r2) };
}

/** Distancia del conjunto (unión suave en orden) + índice de la forma más cercana. */
export function sceneDist(prims, x, y, z, out) {
  let d = 1e9, best = 1e9, bi = 0;
  for (let i = 0; i < prims.length; i++) {
    const p = prims[i];
    // Descarte rápido: si la esfera que envuelve la forma ya está más lejos que lo encontrado, no aporta nada
    if (!p.sub && !p.cut && d < 1e8) {
      const lb = Math.hypot(x - p.bx0, y - p.by0, z - p.bz0) - p.br;
      if (lb > d + p.k && (!out || lb > best)) continue;
    }
    const di = primDist(p, x, y, z);
    if (out && di < best) { best = di; bi = i; }
    if (p.sub) d = Math.max(d, -di);        // resta (huecos)
    else if (p.cut) d = Math.max(d, di);     // recorte
    else d = smin(d, di, p.k);
  }
  if (out) out.i = bi;
  return d;
}

/**
 * Malla de la superficie d = 0 dentro de la caja [min, max] con celdas de tamaño h.
 * Devuelve posiciones, normales (del gradiente: muy suaves) e índices.
 */
export function surfaceNets(fn, min, max, h) {
  const nx = Math.ceil((max[0] - min[0]) / h) + 1, ny = Math.ceil((max[1] - min[1]) / h) + 1, nz = Math.ceil((max[2] - min[2]) / h) + 1;
  const V = new Float32Array(nx * ny * nz);
  // Primero una rejilla gruesa: lejos de la superficie no hace falta calcular cada punto fino
  // (solo importa el signo), así el cálculo es varias veces más rápido.
  const S = 4, cx = Math.ceil((nx - 1) / S) + 1, cy = Math.ceil((ny - 1) / S) + 1, cz = Math.ceil((nz - 1) / S) + 1;
  const G = new Float32Array(cx * cy * cz);
  let o = 0;
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) G[o++] = fn(min[0] + i * S * h, min[1] + j * S * h, min[2] + k * S * h);
  const far = S * h * 1.6;
  o = 0;
  for (let k = 0; k < nz; k++) {
    const gk = Math.round(k / S);
    for (let j = 0; j < ny; j++) {
      const gj = Math.round(j / S);
      for (let i = 0; i < nx; i++) {
        const g = G[Math.round(i / S) + cx * (gj + cy * gk)];
        V[o++] = g > far || g < -far ? g : fn(min[0] + i * h, min[1] + j * h, min[2] + k * h);
      }
    }
  }
  const at = (i, j, k) => V[i + nx * (j + ny * k)];
  const cid = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cell = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos = [];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { v[c] = at(i + C[c][0], j + C[c][1], k + C[c][2]); if (v[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t;
      n++;
    }
    cid[cell(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / n) * h, min[1] + (j + sy / n) * h, min[2] + (k + sz / n) * h);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = at(i, j, k) < 0, b = at(i + 1, j, k) < 0;
    if (a !== b) quad(cid[cell(i, j - 1, k - 1)], cid[cell(i, j, k - 1)], cid[cell(i, j, k)], cid[cell(i, j - 1, k)], b);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = at(i, j, k) < 0, b = at(i, j + 1, k) < 0;
    if (a !== b) quad(cid[cell(i - 1, j, k - 1)], cid[cell(i - 1, j, k)], cid[cell(i, j, k)], cid[cell(i, j, k - 1)], b);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = at(i, j, k) < 0, b = at(i, j, k + 1) < 0;
    if (a !== b) quad(cid[cell(i - 1, j - 1, k)], cid[cell(i, j - 1, k)], cid[cell(i, j, k)], cid[cell(i - 1, j, k)], b);
  }
  // Normales con el gradiente de la distancia
  const nrm = new Float32Array(pos.length);
  const e = h * 0.35;
  for (let q = 0; q < pos.length; q += 3) {
    const x = pos[q], y = pos[q + 1], z = pos[q + 2];
    let gx = fn(x + e, y, z) - fn(x - e, y, z), gy = fn(x, y + e, z) - fn(x, y - e, z), gz = fn(x, y, z + e) - fn(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    nrm[q] = gx / l; nrm[q + 1] = gy / l; nrm[q + 2] = gz / l;
  }
  return { pos: new Float32Array(pos), nrm, idx: pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx) };
}
