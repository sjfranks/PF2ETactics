/* gfx.js — rendering-quality layer for Three-Action Tactics (three.js r128 core only).
 *
 *  PF.Gfx.Textures.get(name, renderer)        procedural tileable texture sets {map, normalMap, roughnessMap?, emissiveMap?}
 *  PF.Gfx.Materials.terrain/water/lava/...    MeshStandardMaterial helpers (anti-tiling, world UVs, cloud shadows)
 *  PF.Gfx.Post                                SSAO + bloom + ACES + grading + vignette + FXAA pipeline
 *  PF.Gfx.Particles                           pooled particles, emitters, projectiles, beams, explosions
 *  PF.Gfx.Environment.apply(scene,renderer,p) sky, fog, PMREM env, sun/hemi/fill lights, grading presets
 *  PF.Gfx.Foliage / PF.Gfx.Props              instanced grass, trees, map props, connected walls
 *  PF.Gfx.Terrain / PF.Gfx.Battle             splat-blended ground builder (+ adapter for engine B.tiles)
 *  PF.Gfx.update(dt)                          advances shared time uniforms (water, lava, wind sway, clouds)
 *
 * Coordinates: 1 tile = 1 world unit, tile (x,y) centre = (x+0.5, top, y+0.5). Y is up.
 * See the API notes above each section. No external assets — everything is generated at runtime.
 */
(function (G) {
'use strict';
const PF = G.PF = G.PF || {};
const THREE = G.THREE;
const Gfx = PF.Gfx = PF.Gfx || {};
Gfx.version = '1.0';

/* ======================================================================================
 * 0. Shared utilities
 * ==================================================================================== */
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const mod = (a, n) => ((a % n) + n) % n;
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash2(x, y, s) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function hash3(x, y, z) { return hash2(x * 7 + z * 131, y * 13 - z * 17, z + 99); }
const hexRGB = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; }; // authored in sRGB, stored raw
Gfx.util = { clamp, lerp, smooth, fract, mulberry, hash2 };

/* ---------- periodic gradient noise (tileable) ---------- */
function Noise(seed) {
  const rnd = mulberry(seed * 9973 + 17);
  const p = new Uint8Array(512); for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  const GX = [1, -1, 1, -1, 1.41, -1.41, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1.41, -1.41];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  // perlin with integer period px,py (<=256)
  this.p = (x, y, px, py) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const X0 = mod(xi, px), X1 = mod(xi + 1, px), Y0 = mod(yi, py), Y1 = mod(yi + 1, py);
    const g = (X, Y, dx, dy) => { const h = p[p[X] + Y] & 7; return GX[h] * dx + GY[h] * dy; };
    const u = fade(xf), v = fade(yf);
    const a = g(X0, Y0, xf, yf), b = g(X1, Y0, xf - 1, yf), c = g(X0, Y1, xf, yf - 1), d = g(X1, Y1, xf - 1, yf - 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v); // ~[-1,1]
  };
  // fbm over unit square, base frequency f (integer), returns ~[-1,1]
  this.fbm = (u, v, f, oct, gain = 0.5) => { let s = 0, a = 1, n = 0; for (let o = 0; o < oct; o++) { s += a * this.p(u * f, v * f, f, f); n += a; a *= gain; f *= 2; } return s / n * 1.4; };
  this.ridged = (u, v, f, oct, gain = 0.5) => { let s = 0, a = 1, n = 0; for (let o = 0; o < oct; o++) { const r = 1 - Math.abs(this.p(u * f, v * f, f, f)); s += a * r * r; n += a; a *= gain; f *= 2; } return s / n; };
  // anisotropic fbm: separate integer freqs on u and v
  this.fbm2 = (u, v, fu, fv, oct, gain = 0.5) => { let s = 0, a = 1, n = 0; for (let o = 0; o < oct; o++) { s += a * this.p(u * fu, v * fv, fu, fv); n += a; a *= gain; fu *= 2; fv *= 2; } return s / n * 1.4; };
}
/* periodic worley: n cells per side; returns {f1,f2,id,dx,dy} (distances in cell units) */
function Worley(n, seed, jitter = 0.9, metric = 0) {
  const pts = new Float32Array(n * n * 2);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { pts[(j * n + i) * 2] = 0.5 + (hash2(i, j, seed) - 0.5) * jitter; pts[(j * n + i) * 2 + 1] = 0.5 + (hash2(i, j, seed + 7) - 0.5) * jitter; }
  const out = { f1: 0, f2: 0, id: 0, dx: 0, dy: 0, cx: 0, cy: 0 };
  return (u, v) => {
    const x = u * n, y = v * n, xi = Math.floor(x), yi = Math.floor(y);
    let f1 = 1e9, f2 = 1e9, id = 0, bdx = 0, bdy = 0, bcx = 0, bcy = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const cx = xi + ox, cy = yi + oy, wx = mod(cx, n), wy = mod(cy, n), k = (wy * n + wx) * 2;
      const dx = cx + pts[k] - x, dy = cy + pts[k + 1] - y;
      const d = metric === 1 ? Math.max(Math.abs(dx), Math.abs(dy)) : metric === 2 ? Math.abs(dx) + Math.abs(dy) : Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; id = wy * n + wx; bdx = dx; bdy = dy; bcx = wx; bcy = wy; } else if (d < f2) f2 = d;
    }
    out.f1 = f1; out.f2 = f2; out.id = id; out.dx = bdx; out.dy = bdy; out.cx = bcx; out.cy = bcy; return out;
  };
}
/* 3D value noise (non-periodic) for mesh displacement */
const vnoise3 = (x, y, z) => {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let xf = x - xi, yf = y - yi, zf = z - zi;
  xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); zf = zf * zf * (3 - 2 * zf);
  const h = (a, b, c) => hash3(xi + a, yi + b, zi + c);
  return lerp(lerp(lerp(h(0, 0, 0), h(1, 0, 0), xf), lerp(h(0, 1, 0), h(1, 1, 0), xf), yf), lerp(lerp(h(0, 0, 1), h(1, 0, 1), xf), lerp(h(0, 1, 1), h(1, 1, 1), xf), yf), zf) * 2 - 1;
};
const fbm3 = (x, y, z, oct = 3) => { let s = 0, a = 1, n = 0; for (let o = 0; o < oct; o++) { s += vnoise3(x, y, z) * a; n += a; a *= 0.5; x *= 2.03; y *= 2.03; z *= 2.03; } return s / n; };
Gfx.util.fbm3 = fbm3;

/* brick / block layout helper (tileable). rows per texture, per-row joint lists */
function Blocks(rows, seed, minW, maxW, offsetRows = true) {
  const R = []; const rnd = mulberry(seed);
  for (let r = 0; r < rows; r++) {
    const j = []; let x = offsetRows ? rnd() : 0; const start = x;
    while (true) { j.push(x); const w = lerp(minW, maxW, rnd()); if (x + w >= start + 1 - minW * 0.6) break; x += w; }
    R.push(j.map(v => fract(v)).sort((a, b) => a - b));
  }
  const o = { row: 0, k: 0, id: 0, ex: 0, ey: 0, lx: 0, ly: 0, w: 0 };
  return (u, v) => {
    const fy = v * rows; const r = mod(Math.floor(fy), rows); const ly = fy - Math.floor(fy); const J = R[r];
    let k = J.length - 1; for (let i = 0; i < J.length; i++) if (J[i] > u) { k = i - 1; break; }
    let a, b; if (k < 0) { a = J[J.length - 1] - 1; b = J[0]; k = J.length - 1; } else { a = J[k]; b = k + 1 < J.length ? J[k + 1] : J[0] + 1; }
    const uu = u < a ? u + 1 : u;
    o.row = r; o.k = k; o.id = r * 64 + k; o.lx = (uu - a) / (b - a); o.ly = ly; o.w = (b - a) * rows;
    o.ex = Math.min(uu - a, b - uu) * rows; o.ey = Math.min(ly, 1 - ly); return o; // ex/ey in row units
  };
}

/* ======================================================================================
 * 1. Procedural textures
 *    PF.Gfx.Textures.get(name, renderer) -> {map, normalMap, roughnessMap?, emissiveMap?, size}
 *    Color maps: CanvasTexture sRGB; normal maps: DataTexture (rgb normal, alpha = height 0..1).
 *    All flipY=false (row 0 = v 0), RepeatWrapping, mipmapped, anisotropic.
 * ==================================================================================== */
function TexBuf(N) { this.N = N; this.h = new Float32Array(N * N); this.c = new Float32Array(N * N * 3); this.r = new Float32Array(N * N).fill(0.85); this.e = null; }
TexBuf.prototype.set = function (i, rgb, m = 1) { this.c[i * 3] = rgb[0] * m; this.c[i * 3 + 1] = rgb[1] * m; this.c[i * 3 + 2] = rgb[2] * m; };
TexBuf.prototype.mixc = function (i, rgb, t) { const c = this.c; c[i * 3] += (rgb[0] - c[i * 3]) * t; c[i * 3 + 1] += (rgb[1] - c[i * 3 + 1]) * t; c[i * 3 + 2] += (rgb[2] - c[i * 3 + 2]) * t; };
TexBuf.prototype.mul = function (i, m) { this.c[i * 3] *= m; this.c[i * 3 + 1] *= m; this.c[i * 3 + 2] *= m; };
// stamp a soft disc with wrapping; fn(i, w) receives pixel index and coverage weight
TexBuf.prototype.disc = function (cx, cy, rad, fn) {
  const N = this.N, r = Math.ceil(rad + 1);
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const px = Math.floor(cx) + x, py = Math.floor(cy) + y; const dx = px + 0.5 - cx, dy = py + 0.5 - cy;
    const d = Math.sqrt(dx * dx + dy * dy); const w = clamp(rad + 0.5 - d, 0, 1); if (w <= 0) continue;
    fn(mod(py, N) * N + mod(px, N), w, d / Math.max(rad, 0.001));
  }
};
const lum = (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114;

const TEX = {}; // recipes: (seed) => TexBuf ; meta {normal: strength, size}
const recipe = (name, size, normal, fn, extra) => { TEX[name] = Object.assign({ size, normal, fn }, extra || {}); };

/* --- grass: patchy greens, thousands of blades, soil specks --- */
recipe('grass', 512, 2.2, (B, n, rnd) => {
  const N = B.N; const dark = hexRGB('#2f4a1d'), mid = hexRGB('#557433'), lite = hexRGB('#7d9442'), dry = hexRGB('#8c8848'), soil = hexRGB('#4a3b26');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x;
    const a = n.fbm(u, v, 3, 4) * 0.5 + 0.5, b = n.fbm(u + 0.3, v + 0.7, 6, 3) * 0.5 + 0.5, gr = n.fbm(u, v, 64, 2);
    let c = [lerp(dark[0], mid[0], a), lerp(dark[1], mid[1], a), lerp(dark[2], mid[2], a)];
    const dt = smooth(0.6, 0.85, b) * 0.6; c = [lerp(c[0], dry[0], dt), lerp(c[1], dry[1], dt), lerp(c[2], dry[2], dt)];
    const s = smooth(0.35, 0.15, a + gr * 0.15) * 0.8; c = [lerp(c[0], soil[0], s), lerp(c[1], soil[1], s), lerp(c[2], soil[2], s)];
    B.set(i, c, 0.92 + gr * 0.1); B.h[i] = a * 0.25 + gr * 0.05; B.r[i] = 0.9;
  }
  // blades: tapered strokes
  for (let k = 0; k < 14000; k++) {
    const x0 = rnd() * N, y0 = rnd() * N; const ang = rnd() * Math.PI * 2; const len = 5 + rnd() * 12; const w = 0.7 + rnd() * 0.9;
    const t = rnd(); const bc = t < 0.15 ? dry : t < 0.55 ? lite : t < 0.85 ? mid : dark; const shade = 0.75 + rnd() * 0.5;
    const steps = Math.ceil(len * 1.5); const cx = Math.cos(ang), cy = Math.sin(ang); const bend = (rnd() - 0.5) * 0.08;
    for (let s = 0; s <= steps; s++) {
      const f = s / steps; const px = x0 + cx * f * len - cy * bend * f * f * len, py = y0 + cy * f * len + cx * bend * f * f * len;
      const ww = w * (1 - f * 0.8); const lift = 0.35 + f * 0.65;
      B.disc(px, py, ww, (i, cov) => { B.mixc(i, [bc[0] * shade * lift + 0.05 * f, bc[1] * shade * lift + 0.06 * f, bc[2] * shade * lift], cov * 0.85); B.h[i] = Math.max(B.h[i], 0.3 + lift * 0.6 * cov); });
    }
  }
});

/* --- dirt / path / mud / sand / ash / cave --- */
function soilBase(B, n, o) {
  const N = B.N; const W1 = Worley(o.pebbleCells || 22, o.seed || 3, 0.95), W2 = Worley((o.pebbleCells || 22) * 2, (o.seed || 3) + 5, 0.95);
  const c0 = hexRGB(o.c0), c1 = hexRGB(o.c1), c2 = hexRGB(o.c2), pc = hexRGB(o.pebble);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x;
    const a = n.fbm(u, v, 4, 5) * 0.5 + 0.5, b = n.fbm(u + 0.5, v, 12, 3) * 0.5 + 0.5, g = n.p(u * 128, v * 128, 128, 128) * 0.5 + n.p(u * 256, v * 256, 256, 256) * 0.5;
    let c = [lerp(c0[0], c1[0], a), lerp(c0[1], c1[1], a), lerp(c0[2], c1[2], a)];
    const dk = smooth(0.55, 0.8, b) * (o.damp || 0.5); c = [lerp(c[0], c2[0], dk), lerp(c[1], c2[1], dk), lerp(c[2], c2[2], dk)];
    let h = a * 0.35 + g * 0.06 + b * 0.1; let rough = 0.92 - dk * 0.25;
    const sh = 1 + g * 0.12;
    // pebbles (2 scales)
    const p1 = W1(u, v), p2 = W2(u, v);
    const r1 = (o.pebbleSize || 0.22) * (0.6 + hash2(p1.id, 1, 9) * 0.8), r2 = (o.pebbleSize || 0.22) * 0.8 * (0.5 + hash2(p2.id, 2, 9));
    const keep1 = hash2(p1.id, 3, 1) < (o.pebbleDensity || 0.5), keep2 = hash2(p2.id, 4, 2) < (o.pebbleDensity || 0.5) * 0.8;
    let pe = 0, pid = 0;
    if (keep1 && p1.f1 < r1) { pe = Math.sqrt(1 - (p1.f1 / r1) ** 2); pid = p1.id; }
    else if (keep2 && p2.f1 < r2) { pe = Math.sqrt(1 - (p2.f1 / r2) ** 2) * 0.7; pid = p2.id + 999; }
    if (pe > 0) {
      const pv = 0.75 + hash2(pid, 5, 5) * 0.5; const pcc = [pc[0] * pv, pc[1] * pv, pc[2] * pv];
      const cov = smooth(0, 0.35, pe); c = [lerp(c[0], pcc[0], cov), lerp(c[1], pcc[1], cov), lerp(c[2], pcc[2], cov)];
      h += pe * 0.35; rough -= cov * 0.15;
    } else {
      // contact darkening around pebbles
      const near = keep1 ? smooth(r1 * 1.6, r1, p1.f1) : 0; c = [c[0] * (1 - near * 0.25), c[1] * (1 - near * 0.25), c[2] * (1 - near * 0.25)];
    }
    B.set(i, c, sh); B.h[i] = h; B.r[i] = rough;
  }
}
recipe('dirt', 512, 2.4, (B, n) => soilBase(B, n, { c0: '#5c4630', c1: '#86694a', c2: '#4b3a28', pebble: '#8b8478', pebbleCells: 18, pebbleDensity: 0.35, pebbleSize: 0.2, seed: 11 }));
recipe('path', 512, 2.8, (B, n) => {
  soilBase(B, n, { c0: '#8a7556', c1: '#a68f6b', c2: '#6f5d44', pebble: '#a19c90', pebbleCells: 26, pebbleDensity: 0.65, pebbleSize: 0.26, seed: 21, damp: 0.35 });
  // faint compacted ruts / footprints streak along v
  const N = B.N; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; const s = n.fbm2(x / N, y / N, 2, 16, 3) * 0.5 + 0.5; B.mul(i, 0.93 + s * 0.12); }
});
recipe('mud', 512, 1.6, (B, n) => {
  soilBase(B, n, { c0: '#43321f', c1: '#56402a', c2: '#35281a', pebble: '#6d655a', pebbleCells: 14, pebbleDensity: 0.18, pebbleSize: 0.18, seed: 31, damp: 0.5 });
  const N = B.N; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x; const p = n.fbm(u + 0.2, v + 0.1, 5, 4) * 0.5 + 0.5; const wet = smooth(0.52, 0.62, p);
    B.mul(i, 1 - wet * 0.22); B.c[i * 3 + 2] *= 1 + wet * 0.12; B.r[i] = lerp(B.r[i] * 0.8, 0.12, wet); B.h[i] = lerp(B.h[i], 0.08, wet);
  }
});
recipe('sand', 512, 1.8, (B, n) => {
  const N = B.N; const a0 = hexRGB('#b39a6e'), a1 = hexRGB('#d2bd8f');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x; const w = n.fbm(u, v, 3, 3);
    const rip = Math.sin((v * 22 + w * 2.2 + n.fbm(u, v, 8, 2) * 0.4) * Math.PI * 2) * 0.5 + 0.5; const g = n.p(u * 256, v * 256, 256, 256);
    const a = n.fbm(u, v, 4, 4) * 0.5 + 0.5; const c = [lerp(a0[0], a1[0], a), lerp(a0[1], a1[1], a), lerp(a0[2], a1[2], a)];
    B.set(i, c, 0.92 + rip * 0.08 + g * 0.08); B.h[i] = rip * 0.25 + a * 0.2 + g * 0.03; B.r[i] = 0.95;
  }
});
recipe('ash', 512, 2.4, (B, n) => {
  const N = B.N; const W = Worley(7, 41, 0.9); const c0 = hexRGB('#26211f'), c1 = hexRGB('#3e3733'), ashc = hexRGB('#5e5650'), hot = hexRGB('#5a2618');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x; const a = n.fbm(u, v, 4, 5) * 0.5 + 0.5; const d = n.fbm(u + 0.4, v, 6, 4) * 0.5 + 0.5; const g = n.p(u * 200, v * 200, 200, 200);
    let c = [lerp(c0[0], c1[0], a), lerp(c0[1], c1[1], a), lerp(c0[2], c1[2], a)];
    const drift = smooth(0.4, 0.9, d); c = [lerp(c[0], ashc[0], drift * 0.45), lerp(c[1], ashc[1], drift * 0.45), lerp(c[2], ashc[2], drift * 0.45)];
    const w = W(u, v); const crack = smooth(0.06, 0.0, w.f2 - w.f1) * (1 - drift);
    c = [lerp(c[0], hot[0], crack * 0.8), lerp(c[1], hot[1], crack * 0.8), lerp(c[2], hot[2], crack * 0.8)];
    const cinder = g > 0.55 ? 0.6 : 1;
    B.set(i, c, (0.9 + g * 0.15) * cinder); B.h[i] = a * 0.4 + drift * 0.2 - crack * 0.3 + g * 0.04; B.r[i] = 0.95 - crack * 0.2;
  }
});
recipe('cave', 512, 3.2, (B, n) => {
  const N = B.N; const W = Worley(9, 51, 0.95); const c0 = hexRGB('#36312d'), c1 = hexRGB('#615851'), moss = hexRGB('#3c4230');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x;
    const wx = n.fbm(u, v, 3, 3) * 0.08, wy = n.fbm(u + 0.5, v + 0.5, 3, 3) * 0.08;
    const r = n.ridged(fract(u + wx), fract(v + wy), 4, 5); const a = n.fbm(u, v, 6, 4) * 0.5 + 0.5; const g = n.p(u * 128, v * 128, 128, 128);
    const w = W(fract(u + wx), fract(v + wy)); const crack = smooth(0.05, 0.0, w.f2 - w.f1);
    let c = [lerp(c0[0], c1[0], r * 0.8 + a * 0.2), lerp(c0[1], c1[1], r * 0.8 + a * 0.2), lerp(c0[2], c1[2], r * 0.8 + a * 0.2)];
    const dm = smooth(0.62, 0.8, n.fbm(u + 0.2, v + 0.9, 4, 3) * 0.5 + 0.5); c = [lerp(c[0], moss[0], dm * 0.4), lerp(c[1], moss[1], dm * 0.4), lerp(c[2], moss[2], dm * 0.4)];
    B.set(i, c, (1 - crack * 0.55) * (0.94 + g * 0.1)); B.h[i] = r * 0.6 + a * 0.15 - crack * 0.35; B.r[i] = 0.85 - dm * 0.3;
  }
});

/* --- block-based: flagstone, stoneWall, ruinWall, cobble, rubble --- */
function blockSurface(B, n, o) {
  const N = B.N; const L = Blocks(o.rows, o.seed, o.minW, o.maxW);
  const base = o.colors.map(hexRGB); const mort = hexRGB(o.mortar); const mossC = hexRGB(o.moss || '#4d5a2c');
  const W = Worley(12, o.seed + 3, 0.9);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x;
    const wa = o.warp || 0.006; const wu = fract(u + n.fbm(u, v, 8, 3) * wa), wv = fract(v + n.fbm(u + 0.5, v + 0.5, 8, 3) * wa);
    const b = L(wu, wv); const id = b.id;
    const erode = (o.erode || 0) * (n.fbm(u, v, 16, 3) * 0.5 + 0.5);
    const e = Math.min(b.ex * (o.aspect || 1), b.ey) - erode * 0.08; // distance to block edge in row units
    const gap = o.gap || 0.04, bev = o.bevel || 0.12;
    const tint = base[Math.floor(hash2(id, 3, o.seed) * base.length)]; const tv = 0.85 + hash2(id, 5, o.seed) * 0.3;
    const surf = n.fbm(u, v, 24, 4) * 0.5 + 0.5, g = n.p(u * 160, v * 160, 160, 160);
    const tiltx = (hash2(id, 7, 1) - 0.5) * 0.25, tilty = (hash2(id, 8, 1) - 0.5) * 0.25;
    let h, c;
    if (e < gap) { h = 0.05 + surf * 0.05; c = [mort[0] * (0.8 + surf * 0.3), mort[1] * (0.8 + surf * 0.3), mort[2] * (0.8 + surf * 0.3)]; B.r[i] = 0.95; }
    else {
      const eb = smooth(gap, gap + bev, e);
      h = 0.45 + 0.4 * Math.sqrt(eb) + (surf - 0.5) * 0.18 + tiltx * (b.lx - 0.5) + tilty * (b.ly - 0.5);
      c = [tint[0] * tv, tint[1] * tv, tint[2] * tv];
      const sh = 0.86 + surf * 0.22 + g * 0.05; c = [c[0] * sh, c[1] * sh, c[2] * sh];
      // edge wear: lighter chipped edges, darker grime near bottom of block
      const edge = 1 - eb; c = [c[0] * (1 + edge * 0.12), c[1] * (1 + edge * 0.12), c[2] * (1 + edge * 0.12)];
      if (o.grime) { const gm = smooth(0.4, 1, b.ly) * o.grime; c = [c[0] * (1 - gm * 0.3), c[1] * (1 - gm * 0.3), c[2] * (1 - gm * 0.25)]; }
      // cracks inside blocks
      const w = W(u, v); const cr = smooth(0.025, 0, w.f2 - w.f1) * (hash2(w.id, id, 4) < (o.cracks || 0.25) ? 1 : 0);
      h -= cr * 0.25; c = [c[0] * (1 - cr * 0.45), c[1] * (1 - cr * 0.45), c[2] * (1 - cr * 0.45)];
      B.r[i] = (o.rough || 0.8) + (surf - 0.5) * 0.15;
    }
    if (o.mossAmt) {
      const mn = n.fbm(u + 0.33, v + 0.11, 5, 4) * 0.5 + 0.5; const top = e < gap * 2.5 ? 1 : smooth(0.35, 0, b.ly) * 0.6;
      const m = clamp(smooth(1 - o.mossAmt, 1.05 - o.mossAmt * 0.5, mn) * (0.5 + top), 0, 1) * (0.7 + g * 0.5);
      if (m > 0) { c = [lerp(c[0], mossC[0] * (0.8 + surf * 0.4), m), lerp(c[1], mossC[1] * (0.8 + surf * 0.4), m), lerp(c[2], mossC[2] * (0.8 + surf * 0.4), m)]; h += m * 0.06; B.r[i] = lerp(B.r[i], 0.95, m); }
    }
    if (o.streaks) { const st = n.fbm2(u, v, 24, 2, 3) * 0.5 + 0.5; const s = smooth(0.55, 0.8, st) * o.streaks; c = [c[0] * (1 - s * 0.35), c[1] * (1 - s * 0.33), c[2] * (1 - s * 0.3)]; }
    B.set(i, c); B.h[i] = h;
  }
}
recipe('flagstone', 512, 3.0, (B, n) => blockSurface(B, n, { rows: 4, seed: 61, minW: 0.18, maxW: 0.42, colors: ['#8e877b', '#7d776d', '#9a9082', '#857b6c', '#736f68'], mortar: '#3a342c', gap: 0.035, bevel: 0.1, warp: 0.004, cracks: 0.3, grime: 0.3, rough: 0.78 }));
recipe('stoneWall', 512, 3.4, (B, n) => blockSurface(B, n, { rows: 6, seed: 71, minW: 0.16, maxW: 0.36, colors: ['#8d867a', '#7a7368', '#958b7c', '#837a6e', '#6f6a62'], mortar: '#463f36', gap: 0.05, bevel: 0.16, warp: 0.004, cracks: 0.2, grime: 0.5, rough: 0.85, streaks: 0.4 }));
recipe('ruinWall', 512, 3.8, (B, n) => blockSurface(B, n, { rows: 6, seed: 81, minW: 0.14, maxW: 0.34, colors: ['#857f72', '#706b62', '#8f8676', '#7c7468', '#66625a'], mortar: '#3b3730', gap: 0.06, bevel: 0.22, warp: 0.012, erode: 1.2, cracks: 0.45, grime: 0.6, rough: 0.9, mossAmt: 0.45, moss: '#4f5f29', streaks: 0.7 }));
recipe('cobble', 512, 3.6, (B, n) => {
  const N = B.N; const W = Worley(10, 91, 0.75); const cols = ['#7b776f', '#6a675f', '#86807a', '#706a5f', '#5f5d5a'].map(hexRGB); const dirt = hexRGB('#3f362b');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x; const wu = fract(u + n.fbm(u, v, 6, 2) * 0.01), wv = fract(v + n.fbm(u + 0.5, v, 6, 2) * 0.01);
    const w = W(wu, wv); const d = w.f2 - w.f1; const g = n.p(u * 128, v * 128, 128, 128); const s = n.fbm(u, v, 32, 3) * 0.5 + 0.5;
    const tint = cols[Math.floor(hash2(w.id, 1, 9) * cols.length)]; const tv = 0.85 + hash2(w.id, 2, 9) * 0.3;
    const dome = smooth(0.04, 0.45, d); let c, h;
    if (d < 0.07) { c = [dirt[0] * (0.8 + s * 0.4), dirt[1] * (0.8 + s * 0.4), dirt[2] * (0.8 + s * 0.4)]; h = 0.05; B.r[i] = 0.95; }
    else { const sh = (0.85 + dome * 0.2) * tv * (0.9 + s * 0.2 + g * 0.05); c = [tint[0] * sh, tint[1] * sh, tint[2] * sh]; h = 0.2 + Math.sqrt(dome) * 0.7 + s * 0.06; B.r[i] = 0.7 - dome * 0.12; }
    B.set(i, c); B.h[i] = h;
  }
});
recipe('rubble', 512, 4.0, (B, n) => {
  const N = B.N; const W1 = Worley(6, 101, 0.9, 1), W2 = Worley(13, 107, 0.9, 1); const cols = ['#7e786e', '#6b665d', '#8c8478', '#5e5a53'].map(hexRGB); const dust = hexRGB('#6d604f');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x; const s = n.fbm(u, v, 24, 3) * 0.5 + 0.5; const g = n.p(u * 160, v * 160, 160, 160);
    let c = [dust[0] * (0.8 + s * 0.4), dust[1] * (0.8 + s * 0.4), dust[2] * (0.8 + s * 0.4)]; let h = 0.08 + s * 0.08; let r = 0.95;
    const layers = [[W1(u, v), 0.42, 1.0], [W2(u, v), 0.4, 0.65]];
    for (const [w, rad, hs] of layers) {
      const rr = rad * (0.6 + hash2(w.id, 4, hs * 10) * 0.6); if (hash2(w.id, 6, hs * 10) > 0.75) continue;
      // angular chunk with a sloped top
      const sx = (hash2(w.id, 8, 1) - 0.5) * 1.2, sy = (hash2(w.id, 9, 1) - 0.5) * 1.2;
      if (w.f1 < rr) { const e = (rr - w.f1) / rr; const hh = (0.3 + e * 0.5 + sx * w.dx + sy * w.dy) * hs + s * 0.05; if (hh > h) { h = hh; const t = cols[Math.floor(hash2(w.id, 10, hs * 10) * cols.length)]; const sh = 0.8 + e * 0.35 + g * 0.05; c = [t[0] * sh, t[1] * sh, t[2] * sh]; r = 0.85; } }
    }
    B.set(i, c); B.h[i] = h; B.r[i] = r;
  }
});
recipe('rock', 512, 3.6, (B, n) => {
  const N = B.N; const c0 = hexRGB('#4f4a45'), c1 = hexRGB('#8a8279'), lich = hexRGB('#8f8f6a'), W = Worley(6, 111, 0.9);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x; const wx = n.fbm(u, v, 3, 4) * 0.12, wy = n.fbm(u + 0.4, v + 0.2, 3, 4) * 0.12;
    const uu = fract(u + wx), vv = fract(v + wy); const r = n.ridged(uu, vv, 3, 6); const strata = Math.sin((vv * 9 + n.fbm(uu, vv, 4, 3) * 0.6) * Math.PI * 2) * 0.5 + 0.5;
    const w = W(uu, vv); const crack = smooth(0.04, 0, w.f2 - w.f1); const g = n.p(u * 128, v * 128, 128, 128);
    const t = r * 0.7 + strata * 0.3; let c = [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
    const l = smooth(0.68, 0.82, n.fbm(u + 0.7, v + 0.3, 8, 4) * 0.5 + 0.5) * 0.6; c = [lerp(c[0], lich[0], l), lerp(c[1], lich[1], l), lerp(c[2], lich[2], l)];
    B.set(i, c, (1 - crack * 0.6) * (0.92 + g * 0.12)); B.h[i] = r * 0.6 + strata * 0.2 - crack * 0.4 + g * 0.03; B.r[i] = 0.82 + g * 0.08;
  }
});

/* --- wood: planks, crate, bark --- */
function woodGrain(n, u, v, id) { // returns 0..1 grain value, boards run along u
  const o = hash2(id, 1, 1) * 10; const ring = n.fbm2(fract(u + o * 0.1), v, 2, 32, 3) * 0.5; const lines = Math.sin((v * 90 + ring * 6 + o) * Math.PI) * 0.5 + 0.5;
  return clamp(lines * 0.55 + (n.fbm2(fract(u + o * 0.13), v, 4, 64, 2) * 0.5 + 0.5) * 0.45, 0, 1);
}
recipe('planks', 512, 3.0, (B, n) => {
  const N = B.N; const L = Blocks(5, 121, 0.35, 0.9, true); const cols = ['#7a5634', '#6b4a2c', '#86603a', '#5e4128', '#74522f'].map(hexRGB); const gapc = hexRGB('#1d140c');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x; const b = L(u, v); const e = Math.min(b.ex * 1.6, b.ey); const gr = woodGrain(n, u, v, b.id); const g = n.p(u * 200, v * 200, 200, 200);
    const t = cols[Math.floor(hash2(b.id, 2, 3) * cols.length)]; const wear = n.fbm(u, v, 8, 3) * 0.5 + 0.5;
    let c, h; if (e < 0.045) { c = gapc; h = 0; B.r[i] = 1; }
    else {
      const sh = 0.78 + gr * 0.3 + wear * 0.1 + g * 0.04; c = [t[0] * sh, t[1] * sh, t[2] * sh]; h = 0.55 + smooth(0.05, 0.14, e) * 0.35 + gr * 0.08 - wear * 0.05; B.r[i] = 0.72 + gr * 0.12;
      // nails near butt joints
      const nx = b.lx * b.w, ny = b.ly; for (const nxp of [0.18, b.w - 0.18]) for (const nyp of [0.3, 0.7]) { const d = Math.hypot((nx - nxp) * 1.0, ny - nyp); if (d < 0.07) { c = [0.23, 0.22, 0.21]; h += 0.06; B.r[i] = 0.4; } }
    }
    B.set(i, c); B.h[i] = h;
  }
});
recipe('crate', 512, 3.2, (B, n) => {
  const N = B.N; const cols = ['#9a7246', '#8a6438', '#a57c4c', '#8f6a40'].map(hexRGB); const dark = hexRGB('#2b1d10');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x; const g = n.p(u * 200, v * 200, 200, 200);
    const fr = 0.13; const inFrame = u < fr || u > 1 - fr || v < fr || v > 1 - fr;
    let id, gu = u, gv = v, e, h, raised = 0;
    // diagonal brace from (fr,fr) to (1-fr,1-fr)
    const dd = Math.abs((u - v)) / Math.SQRT2; const inBrace = !inFrame && dd < 0.07;
    if (v < fr || v > 1 - fr) { id = v < 0.5 ? 1 : 2; const lv = v < 0.5 ? v : 1 - v; e = Math.min(lv, fr - lv); raised = 0.25; }
    else if (inFrame) { id = u < 0.5 ? 3 : 4; gu = v; gv = u; const lu = u < 0.5 ? u : 1 - u; e = Math.min(lu, fr - lu, v - fr, 1 - fr - v); raised = 0.25; }
    else if (inBrace) { id = 5; gu = (u + v) * 0.5; gv = (u - v) * 0.7; e = 0.07 - dd; raised = 0.15; }
    else { const k = Math.floor((u - fr) / ((1 - 2 * fr) / 4)); id = 10 + k; gu = v; gv = u; const lx = ((u - fr) / ((1 - 2 * fr) / 4)) % 1; e = Math.min(lx, 1 - lx) * 0.18; }
    const gr = woodGrain(n, fract(gu), fract(gv), id); const t = cols[id % cols.length]; const wear = n.fbm(u, v, 6, 3) * 0.5 + 0.5;
    let c; if (e < 0.008) { c = dark; h = 0.1 + raised; B.r[i] = 1; }
    else { const sh = 0.74 + gr * 0.32 + g * 0.04 + raised * 0.25; c = [t[0] * sh, t[1] * sh, t[2] * sh]; h = 0.3 + raised + smooth(0.008, 0.03, e) * 0.25 + gr * 0.06; B.r[i] = 0.75 + wear * 0.1; }
    // corner nails
    for (const [a, bb] of [[0.065, 0.065], [0.935, 0.065], [0.065, 0.935], [0.935, 0.935], [0.5, 0.065], [0.5, 0.935], [0.065, 0.5], [0.935, 0.5]]) if (Math.hypot(u - a, v - bb) < 0.016) { c = [0.25, 0.24, 0.23]; h += 0.08; B.r[i] = 0.35; }
    B.set(i, c); B.h[i] = h;
  }
});
recipe('bark', 512, 4.0, (B, n) => {
  const N = B.N; const c0 = hexRGB('#2e2218'), c1 = hexRGB('#6b5440'), moss = hexRGB('#4b5a2a');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x; const w = n.fbm(u, v, 4, 3) * 0.05;
    const ridge = 1 - Math.abs(n.fbm2(fract(u + w), v, 12, 2, 4)); const fine = n.fbm2(u, v, 48, 8, 2) * 0.5 + 0.5; const g = n.p(u * 128, v * 128, 128, 128);
    const t = clamp(ridge * ridge * 0.8 + fine * 0.3, 0, 1); let c = [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
    const m = smooth(0.6, 0.8, n.fbm(u + 0.3, v, 4, 3) * 0.5 + 0.5) * (1 - t) * 0.8; c = [lerp(c[0], moss[0], m), lerp(c[1], moss[1], m), lerp(c[2], moss[2], m)];
    B.set(i, c, 0.95 + g * 0.08); B.h[i] = t * 0.8 + g * 0.03; B.r[i] = 0.92;
  }
});
recipe('leaves', 512, 2.6, (B, n, rnd) => {
  const N = B.N; const base = hexRGB('#1d2e14'); const greens = ['#3d5f24', '#4b6e2a', '#5a7d30', '#33521f', '#6a8a36', '#7b8f3a'].map(hexRGB);
  for (let i = 0; i < N * N; i++) { B.set(i, base); B.h[i] = 0; B.r[i] = 0.8; }
  for (let k = 0; k < 9000; k++) {
    const layer = k / 9000; const cx = rnd() * N, cy = rnd() * N, ang = rnd() * Math.PI, len = 5 + rnd() * 6, wid = len * 0.45; const t = greens[Math.floor(rnd() * greens.length)];
    const sh = 0.45 + layer * 0.75 + (rnd() - 0.5) * 0.15; const ca = Math.cos(ang), sa = Math.sin(ang); const R = Math.ceil(len);
    for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
      const lx = (xx * ca + yy * sa) / len, ly = (-xx * sa + yy * ca) / wid; const d = lx * lx + ly * ly; if (d > 1) continue;
      const i = mod(Math.floor(cy) + yy, N) * N + mod(Math.floor(cx) + xx, N); const vein = Math.abs(ly) < 0.12 ? 1.12 : 1;
      B.set(i, t, sh * vein * (1 - d * 0.25)); B.h[i] = layer + (1 - d) * 0.15; B.r[i] = 0.55 + (1 - layer) * 0.3;
    }
  }
});

/* --- clay roof tiles --- */
recipe('roof', 512, 3.6, (B, n) => {
  const N = B.N; const rows = 6, cols = 7; const cl = ['#9a4a30', '#a85638', '#8a3f29', '#b0603e', '#7f3a26'].map(hexRGB); const moss = hexRGB('#5e6a35'); const gap = hexRGB('#2a120b');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x; const fy = v * rows; const r = Math.floor(fy); const ly = fy - r;
    const off = (r % 2) * 0.5; const fx = u * cols + off; const ci = Math.floor(fx); const lx = fx - ci; const id = r * 31 + mod(ci, cols);
    // tile is a half-cylinder across lx, rounded bottom edge (ly near 1), overlapped at top by previous row
    const cyl = Math.sin(lx * Math.PI); const bottom = ly + 0.12 * (1 - cyl);
    const s = n.fbm(u, v, 16, 3) * 0.5 + 0.5; const g = n.p(u * 160, v * 160, 160, 160); const t = cl[Math.floor(hash2(id, 1, 2) * cl.length)]; const tv = 0.85 + hash2(id, 3, 2) * 0.3;
    let c, h;
    if (bottom > 1.0) { c = gap; h = 0; B.r[i] = 1; }
    else {
      h = 0.25 + cyl * 0.45 + ly * 0.3; const sh = tv * (0.6 + cyl * 0.45) * (0.65 + ly * 0.45) * (0.92 + s * 0.15 + g * 0.05); c = [t[0] * sh, t[1] * sh, t[2] * sh];
      const m = smooth(0.62, 0.78, n.fbm(u + 0.1, v + 0.6, 6, 4) * 0.5 + 0.5) * (1 - cyl * 0.4); c = [lerp(c[0], moss[0], m * 0.7), lerp(c[1], moss[1], m * 0.7), lerp(c[2], moss[2], m * 0.7)];
      B.r[i] = 0.7 + m * 0.2;
    }
    B.set(i, c); B.h[i] = h;
  }
});

/* --- metal, cloth, awning --- */
recipe('metal', 256, 1.4, (B, n) => {
  const N = B.N; const c0 = hexRGB('#4c4f54'), c1 = hexRGB('#6f737a'), rust = hexRGB('#6e3b1e');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x; const br = n.fbm2(u, v, 2, 64, 3) * 0.5 + 0.5; const a = n.fbm(u, v, 4, 4) * 0.5 + 0.5;
    const rs = smooth(0.58, 0.75, n.fbm(u + 0.3, v + 0.5, 5, 5) * 0.5 + 0.5); let c = [lerp(c0[0], c1[0], br * 0.5 + a * 0.5), lerp(c0[1], c1[1], br * 0.5 + a * 0.5), lerp(c0[2], c1[2], br * 0.5 + a * 0.5)];
    c = [lerp(c[0], rust[0], rs), lerp(c[1], rust[1], rs), lerp(c[2], rust[2], rs)];
    B.set(i, c); B.h[i] = br * 0.2 + rs * 0.3 * (n.p(u * 64, v * 64, 64, 64) * 0.5 + 0.5); B.r[i] = lerp(0.35 + br * 0.15, 0.9, rs);
  }
});
recipe('cloth', 256, 1.5, (B, n) => {
  const N = B.N;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x; const f = 64; const wu = Math.sin(u * f * Math.PI * 2), wv = Math.sin(v * f * Math.PI * 2);
    const over = (Math.floor(u * f * 2) + Math.floor(v * f * 2)) % 2; const th = over ? Math.abs(wv) : Math.abs(wu); const fold = n.fbm(u, v, 3, 3) * 0.5 + 0.5; const s = n.fbm(u, v, 32, 2) * 0.5 + 0.5;
    const l = (0.72 + th * 0.18 + s * 0.1) * (0.85 + fold * 0.2); B.set(i, [0.86 * l, 0.83 * l, 0.77 * l]); B.h[i] = th * 0.3 + fold * 0.5; B.r[i] = 0.95;
  }
});
recipe('awning', 256, 1.2, (B, n) => {
  const N = B.N; const a = hexRGB('#a33a2c'), b = hexRGB('#d9c9a3');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x; const stripe = Math.floor(u * 8) % 2; const t = stripe ? a : b; const wv = Math.abs(Math.sin(v * 128 * Math.PI)) * 0.08 + Math.abs(Math.sin(u * 128 * Math.PI)) * 0.08; const fold = n.fbm(u, v, 3, 3) * 0.5 + 0.5; const dirt = n.fbm(u, v, 6, 3) * 0.5 + 0.5;
    const l = (0.84 + wv) * (0.82 + fold * 0.22) * (1 - smooth(0.6, 0.9, dirt) * 0.2); B.set(i, t, l); B.h[i] = wv + fold * 0.3; B.r[i] = 0.95;
  }
});
recipe('marble', 512, 1.2, (B, n) => {
  const N = B.N; const c0 = hexRGB('#b9b3a6'), c1 = hexRGB('#d6d0c3'), vein = hexRGB('#857e74');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x; const a = n.fbm(u, v, 3, 5) * 0.5 + 0.5; const vv = 1 - Math.abs(n.fbm(u + 0.2, v, 2, 6)); const vn = smooth(0.92, 0.99, vv) * 0.6; const dirt = smooth(0.55, 0.85, n.fbm(u, v + 0.4, 6, 4) * 0.5 + 0.5);
    let c = [lerp(c0[0], c1[0], a), lerp(c0[1], c1[1], a), lerp(c0[2], c1[2], a)]; c = [lerp(c[0], vein[0], vn), lerp(c[1], vein[1], vn), lerp(c[2], vein[2], vn)];
    B.set(i, c, 1 - dirt * 0.25); B.h[i] = a * 0.3 - dirt * 0.1; B.r[i] = 0.55 + dirt * 0.3;
  }
});

/* --- water (normal map only) & lava (emissive cracked crust) --- */
recipe('water', 256, 2.0, (B, n) => {
  const N = B.N;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x;
    const w1 = 1 - Math.abs(n.fbm(u, v, 4, 3)); const w2 = n.fbm(u + 0.3, v + 0.1, 8, 3) * 0.5 + 0.5;
    B.set(i, [0.2, 0.35, 0.4]); B.h[i] = w1 * w1 * 0.6 + w2 * 0.4; B.r[i] = 0.05;
  }
}, { noColor: true });
recipe('lava', 512, 3.0, (B, n) => {
  const N = B.N; const W = Worley(6, 131, 0.9); const W2 = Worley(14, 137, 0.9); const crust = hexRGB('#1e1512'), crust2 = hexRGB('#3a2620'), hotc = hexRGB('#ff6a14'), core = hexRGB('#ffd36a');
  B.e = new Float32Array(N * N * 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x; const wu = fract(u + n.fbm(u, v, 5, 3) * 0.03), wv = fract(v + n.fbm(u + 0.4, v, 5, 3) * 0.03);
    const w = W(wu, wv), w2 = W2(wu, wv); const e1 = w.f2 - w.f1, e2 = w2.f2 - w2.f1; const s = n.fbm(u, v, 16, 4) * 0.5 + 0.5;
    const crack = Math.max(smooth(0.16, 0.0, e1), smooth(0.06, 0.0, e2) * 0.55); const heat = Math.max(smooth(0.35, 0, e1) * 0.5, crack);
    const plate = 0.5 + s * 0.3 + (hash2(w.id, 1, 1) - 0.5) * 0.2; let c = [lerp(crust[0], crust2[0], plate), lerp(crust[1], crust2[1], plate), lerp(crust[2], crust2[2], plate)];
    c = [lerp(c[0], hotc[0], crack * 0.9), lerp(c[1], hotc[1] * 0.6, crack * 0.9), lerp(c[2], hotc[2] * 0.4, crack * 0.9)];
    B.set(i, c); B.h[i] = (1 - heat) * (0.5 + s * 0.3); B.r[i] = 0.85 - crack * 0.5;
    const em = crack * crack; const ec = [lerp(hotc[0], core[0], em), lerp(hotc[1], core[1], em), lerp(hotc[2], core[2], em)]; const glow = heat * 0.35 + em * 0.65;
    B.e[i * 3] = ec[0] * glow; B.e[i * 3 + 1] = ec[1] * glow; B.e[i * 3 + 2] = ec[2] * glow;
  }
});
/* low-frequency macro variation (internal, used by anti-tiling) */
recipe('macro', 256, 0, (B, n) => {
  const N = B.N; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = x / N, v = y / N, i = y * N + x; const a = n.fbm(u, v, 3, 5) * 0.5 + 0.5, b = n.fbm(u + 0.5, v + 0.2, 7, 3) * 0.5 + 0.5, c = n.fbm(u + 0.1, v + 0.8, 2, 3) * 0.5 + 0.5; B.set(i, [a, b, c]); B.h[i] = a; }
}, { linear: true });

/* --- texture finalisation --- */
let _maxAniso = 8;
function finishTex(tex, srgb) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.flipY = false; tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = _maxAniso;
  tex.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding; tex.needsUpdate = true; return tex;
}
function canvasFrom(N, arr, srgbLin) {
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const ctx = cv.getContext('2d'); const img = ctx.createImageData(N, N); const d = img.data;
  for (let i = 0; i < N * N; i++) { d[i * 4] = clamp(arr[i * 3] * 255, 0, 255); d[i * 4 + 1] = clamp(arr[i * 3 + 1] * 255, 0, 255); d[i * 4 + 2] = clamp(arr[i * 3 + 2] * 255, 0, 255); d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0); return cv;
}
function buildNormal(B, strength) {
  const N = B.N, h = B.h, out = new Uint8Array(N * N * 4); let mn = 1e9, mx = -1e9; for (let i = 0; i < N * N; i++) { if (h[i] < mn) mn = h[i]; if (h[i] > mx) mx = h[i]; }
  const rng = Math.max(1e-5, mx - mn); const s = strength * N / 256;
  const H = (x, y) => h[mod(y, N) * N + mod(x, N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
    let nx = -dx * s / 8, ny = -dy * s / 8, nz = 1; const l = Math.sqrt(nx * nx + ny * ny + nz * nz); nx /= l; ny /= l; nz /= l;
    const i = (y * N + x) * 4; out[i] = (nx * 0.5 + 0.5) * 255; out[i + 1] = (ny * 0.5 + 0.5) * 255; out[i + 2] = (nz * 0.5 + 0.5) * 255; out[i + 3] = ((h[y * N + x] - mn) / rng) * 255;
  }
  return out;
}
const Textures = Gfx.Textures = {
  cache: {},
  names: () => Object.keys(TEX).filter(k => k !== 'macro'),
  /** get(name, renderer?) -> {map, normalMap, roughnessMap, emissiveMap, size, avg:[r,g,b]} (cached) */
  get(name, renderer) {
    if (renderer && renderer.capabilities) _maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
    if (this.cache[name]) return this.cache[name];
    const R = TEX[name]; if (!R) { console.warn('Gfx.Textures: unknown', name); return this.get('dirt'); }
    const t0 = performance.now(); const N = R.size; const B = new TexBuf(N); const seed = Object.keys(TEX).indexOf(name) * 131 + 7;
    R.fn(B, new Noise(seed), mulberry(seed + 1));
    const set = { size: N, name };
    if (!R.noColor) {
      if (R.linear) { const d = new Uint8Array(N * N * 4); for (let i = 0; i < N * N; i++) { d[i * 4] = B.c[i * 3] * 255; d[i * 4 + 1] = B.c[i * 3 + 1] * 255; d[i * 4 + 2] = B.c[i * 3 + 2] * 255; d[i * 4 + 3] = 255; } set.map = finishTex(new THREE.DataTexture(d, N, N, THREE.RGBAFormat), false); }
      else set.map = finishTex(new THREE.CanvasTexture(canvasFrom(N, B.c)), true);
      let ar = 0, ag = 0, ab = 0; for (let i = 0; i < N * N; i += 7) { ar += B.c[i * 3]; ag += B.c[i * 3 + 1]; ab += B.c[i * 3 + 2]; } const k = Math.ceil(N * N / 7); set.avg = [ar / k, ag / k, ab / k];
    }
    if (R.normal > 0) set.normalMap = finishTex(new THREE.DataTexture(buildNormal(B, R.normal), N, N, THREE.RGBAFormat), false);
    if (!R.linear) { const d = new Uint8Array(N * N * 4); for (let i = 0; i < N * N; i++) { const r = clamp(B.r[i], 0.02, 1) * 255; d[i * 4] = r; d[i * 4 + 1] = r; d[i * 4 + 2] = r; d[i * 4 + 3] = 255; } set.roughnessMap = finishTex(new THREE.DataTexture(d, N, N, THREE.RGBAFormat), false); }
    if (B.e) set.emissiveMap = finishTex(new THREE.CanvasTexture(canvasFrom(N, B.e)), true);
    set.ms = performance.now() - t0; this.cache[name] = set; return set;
  },
  /** draws a texture's color map into a 2D canvas (debug / UI swatches) */
  canvas(name) { const s = this.get(name); return s.map && s.map.image; }
};

/* ======================================================================================
 * 2. Shader patching + materials
 *    All Gfx materials are MeshStandardMaterial patched via onBeforeCompile; they share
 *    Gfx.uniforms (time, wind, cloud shadows) which Gfx.update(dt) advances.
 * ==================================================================================== */
const U = Gfx.uniforms = {
  gfxTime: { value: 0 }, gfxWind: { value: new THREE.Vector2(0.85, 0.35) }, gfxCloud: { value: 0 }, gfxCloudScale: { value: 0.045 },
  gfxMacro: { value: null }
};
const macroTex = () => U.gfxMacro.value || (U.gfxMacro.value = Textures.get('macro').map);

const GLSL_COMMON_V = `
varying vec3 vGfxWP; varying vec3 vGfxWN;
uniform float gfxTime; uniform vec2 gfxWind;
#ifdef GFX_SWAY
uniform vec3 gfxSway; // amp, freq, height normaliser
#endif
#ifdef GFX_UVSCALE
uniform float gfxUVScale;
#endif
`;
const GLSL_SWAY = `
#ifdef GFX_SWAY
{
  vec4 gO = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  #ifdef USE_INSTANCING
  gO = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  #endif
  float gH = max(0.0, transformed.y) * gfxSway.z; gH *= gH;
  float ph = gfxTime * gfxSway.y + dot(gO.xz, vec2(0.71, 0.53)) + transformed.x * 0.6;
  float gust = sin(gfxTime * 0.55 + gO.x * 0.09 + gO.z * 0.06) * 0.5 + 0.5;
  vec2 sw = gfxWind * (sin(ph) * 0.55 + sin(ph * 2.31 + 1.7) * 0.2 + gust * 0.7) * gfxSway.x * gH;
  transformed.xz += sw; transformed.y -= dot(sw, sw) * 0.5;
}
#endif
`;
const GLSL_WORLD_V = `
{
  vec4 gW = vec4(transformed, 1.0);
  vec3 gN = objectNormal;
  #ifdef USE_INSTANCING
  gW = instanceMatrix * gW; gN = mat3(instanceMatrix) * gN;
  #endif
  gW = modelMatrix * gW; vGfxWP = gW.xyz; vGfxWN = normalize(mat3(modelMatrix) * gN);
  #ifdef GFX_WORLDUV
  vec3 an = abs(vGfxWN);
  vec2 wuv = (an.y > max(an.x, an.z)) ? vGfxWP.xz : ((an.x > an.z) ? vec2(-vGfxWP.z * sign(vGfxWN.x), vGfxWP.y) : vec2(vGfxWP.x * sign(vGfxWN.z), vGfxWP.y));
  vUv = wuv * gfxUVScale;
  #endif
}
`;
const GLSL_COMMON_F = `
varying vec3 vGfxWP; varying vec3 vGfxWN;
uniform float gfxTime; uniform vec2 gfxWind; uniform sampler2D gfxMacro; uniform float gfxCloud; uniform float gfxCloudScale;
#ifdef GFX_UVSCALE
uniform float gfxUVScale;
#endif
#ifdef GFX_ANTITILE
uniform float gfxAntiTile;
#endif
float gfxCloudAt(vec3 wp) {
  vec2 cp = wp.xz * gfxCloudScale + gfxWind * gfxTime * 0.012;
  float c = texture2D(gfxMacro, cp).b * 0.65 + texture2D(gfxMacro, cp * 2.7 + 0.31).r * 0.35;
  return 1.0 - gfxCloud * smoothstep(0.42, 0.68, c);
}
`;
const MAP_ANTITILE = `
#ifdef USE_MAP
  vec2 gfxUvR = vec2(-vUv.y, vUv.x) + vec2(0.37, 0.71);
  float gfxB = smoothstep(0.44, 0.56, texture2D(gfxMacro, vUv * 0.083).r) * gfxAntiTile;
  vec4 texelColor = mix(texture2D(map, vUv), texture2D(map, gfxUvR), gfxB);
  texelColor = mapTexelToLinear(texelColor);
  texelColor.rgb *= mix(1.0 - 0.24 * gfxAntiTile, 1.0 + 0.12 * gfxAntiTile, texture2D(gfxMacro, vUv * 0.027 + 0.5).g);
  diffuseColor *= texelColor;
#endif
`;
const MAP_TRIPLANAR = `
  vec3 gfxBW = pow(abs(normalize(vGfxWN)), vec3(4.0)); gfxBW /= (gfxBW.x + gfxBW.y + gfxBW.z);
  vec3 gfxP = vGfxWP * gfxUVScale;
#ifdef USE_MAP
  vec4 texelColor = texture2D(map, gfxP.zy) * gfxBW.x + texture2D(map, gfxP.xz) * gfxBW.y + texture2D(map, gfxP.xy) * gfxBW.z;
  texelColor = mapTexelToLinear(texelColor);
  texelColor.rgb *= mix(0.8, 1.1, texture2D(gfxMacro, (gfxP.xz + gfxP.y * 0.3) * 0.05).g);
  diffuseColor *= texelColor;
#endif
`;
const NORMAL_TRIPLANAR = `
#ifdef USE_NORMALMAP
{
  vec3 tx = texture2D(normalMap, gfxP.zy).xyz * 2.0 - 1.0, ty = texture2D(normalMap, gfxP.xz).xyz * 2.0 - 1.0, tz = texture2D(normalMap, gfxP.xy).xyz * 2.0 - 1.0;
  tx.xy *= normalScale; ty.xy *= normalScale; tz.xy *= normalScale;
  vec3 wN = normalize(normalize(vGfxWN) + vec3(0.0, tx.y, tx.x) * gfxBW.x + vec3(ty.x, 0.0, ty.y) * gfxBW.y + vec3(tz.x, tz.y, 0.0) * gfxBW.z);
  normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
}
#endif
`;
const LIGHTS_CLOUD = () => THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );', 'getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight ); directLight.color *= gfxCloudF;');

/** patch(material, o) — o: {antiTile:0..1, world:uvScale (plane-projected world UVs), triplanar:uvScale,
 *  cloud:true, sway:{amp,freq,height}, extraFrag:fn(shader)} ; returns material */
function patch(mat, o) {
  o = Object.assign({ cloud: true }, o || {});
  const key = JSON.stringify(Object.assign({}, o, { extra: !!o.extra, uniforms: undefined }));
  mat.userData.gfx = o;
  mat.onBeforeCompile = (sh, renderer) => {
    Object.assign(sh.uniforms, { gfxTime: U.gfxTime, gfxWind: U.gfxWind, gfxCloud: U.gfxCloud, gfxCloudScale: U.gfxCloudScale, gfxMacro: { get value() { return macroTex(); } } });
    let defs = '';
    if (o.sway) { defs += '#define GFX_SWAY\n'; sh.uniforms.gfxSway = { value: new THREE.Vector3(o.sway.amp || 0.05, o.sway.freq || 1.6, 1 / (o.sway.height || 1)) }; }
    if (o.world || o.triplanar) { defs += '#define GFX_UVSCALE\n'; sh.uniforms.gfxUVScale = { value: o.world || o.triplanar }; }
    if (o.world) defs += '#define GFX_WORLDUV\n';
    if (o.antiTile) { defs += '#define GFX_ANTITILE\n'; sh.uniforms.gfxAntiTile = { value: o.antiTile }; }
    sh.vertexShader = defs + GLSL_COMMON_V + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + GLSL_SWAY)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + GLSL_WORLD_V);
    let f = defs + GLSL_COMMON_F + sh.fragmentShader;
    f = f.replace('#include <lights_fragment_begin>', 'float gfxCloudF = ' + (o.cloud ? 'gfxCloudAt(vGfxWP)' : '1.0') + ';\n' + LIGHTS_CLOUD());
    if (o.triplanar) f = f.replace('#include <map_fragment>', MAP_TRIPLANAR).replace('#include <normal_fragment_maps>', NORMAL_TRIPLANAR);
    else if (o.antiTile) {
      f = f.replace('#include <map_fragment>', MAP_ANTITILE).replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;',
        'vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;\n#ifdef USE_MAP\n{ vec3 n2 = texture2D(normalMap, gfxUvR).xyz * 2.0 - 1.0; mapN = mix(mapN, vec3(n2.y, -n2.x, n2.z), gfxB); }\n#endif'));
    }
    sh.fragmentShader = f;
    if (o.extra) o.extra(sh);
    mat.userData.shader = sh;
  };
  mat.customProgramCacheKey = () => 'gfx' + key + (o.extraKey || '');
  mat.needsUpdate = true;
  return mat;
}
Gfx.patchMaterial = patch;

const Materials = Gfx.Materials = {
  cache: {},
  /** terrain(name, o) -> MeshStandardMaterial with the procedural texture set.
   *  o: {world: uvScale (default 0.5 → texture repeats every 2 units, plane-projected world UVs; 0 = use mesh UVs),
   *      triplanar: uvScale (rocks/boulders), antiTile: 0..1 (default 1 for world mapping), color, normalScale, roughness, metalness, emissive, sway} */
  terrain(name, o) {
    o = o || {}; const key = name + JSON.stringify(o); if (this.cache[key]) return this.cache[key];
    const T = Textures.get(name); const world = o.world === undefined && !o.triplanar ? 0.5 : (o.world || 0);
    const m = new THREE.MeshStandardMaterial({ map: T.map, normalMap: T.normalMap, roughnessMap: T.roughnessMap, roughness: o.roughness != null ? o.roughness : 1, metalness: o.metalness || 0, color: o.color || 0xffffff,
      normalScale: new THREE.Vector2(o.normalScale || 1, o.normalScale || 1), side: o.side || THREE.FrontSide, vertexColors: !!o.vertexColors });
    if (T.emissiveMap) { m.emissiveMap = T.emissiveMap; m.emissive = new THREE.Color(o.emissive || 0xffffff); m.emissiveIntensity = o.emissiveIntensity || 1; }
    patch(m, { world, triplanar: o.triplanar || 0, antiTile: o.antiTile != null ? o.antiTile : (world ? 1 : 0), sway: o.sway, cloud: o.cloud !== false });
    m.name = 'gfx:' + name; this.cache[key] = m; return m;
  },
  /** plain colored PBR material that still receives cloud shadows */
  std(color, o) {
    o = o || {}; const key = 'std' + color + JSON.stringify(o); if (this.cache[key]) return this.cache[key];
    const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0 }, o)); patch(m, {}); this.cache[key] = m; return m;
  },
  /** animated water: scrolling dual normal maps in world space, fresnel alpha, specular, foam where geometry
   *  attribute `gfxShore` (float, 1 = bank) is present. o: {deep, shallow, opacity, scale} */
  water(o) {
    o = o || {}; const key = 'water' + JSON.stringify(o); if (this.cache[key]) return this.cache[key];
    const T = Textures.get('water');
    const m = new THREE.MeshStandardMaterial({ color: o.deep || '#0b232b', roughness: 0.06, metalness: 0.0, transparent: true, opacity: o.opacity || 0.86, normalMap: T.normalMap, depthWrite: true, envMapIntensity: 1.0 });
    m.userData.update = t => { U.gfxTime.value = t; };
    patch(m, {
      cloud: true, extraKey: 'water', extra: sh => {
        sh.uniforms.gfxShallow = { value: new THREE.Color(o.shallow || '#2c5f5c') }; sh.uniforms.gfxWScale = { value: o.scale || 0.32 };
        sh.vertexShader = 'attribute float gfxShore; varying float vGfxShore;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGfxShore = gfxShore;\n');
        sh.fragmentShader = 'uniform vec3 gfxShallow; uniform float gfxWScale; varying float vGfxShore;\n' + sh.fragmentShader
          .replace('#include <normal_fragment_maps>', `
            vec2 wuv = vGfxWP.xz * gfxWScale;
            vec3 wa = texture2D(normalMap, wuv + gfxTime * vec2(0.031, 0.019)).xyz * 2.0 - 1.0;
            vec3 wb = texture2D(normalMap, wuv * 1.73 + vec2(0.4, 0.2) + gfxTime * vec2(-0.023, 0.034)).xyz * 2.0 - 1.0;
            vec3 wc = texture2D(normalMap, wuv * 0.37 + gfxTime * vec2(0.008, -0.011)).xyz * 2.0 - 1.0;
            vec3 tn = normalize(vec3((wa.xy + wb.xy * 0.8 + wc.xy * 0.9) * 0.55, 1.0));
            vec3 gWN = normalize(vec3(tn.x, tn.z, tn.y));
            normal = normalize((viewMatrix * vec4(gWN, 0.0)).xyz);`)
          .replace('#include <map_fragment>', `
            float gShoreN = texture2D(gfxMacro, vGfxWP.xz * 0.21 + gfxTime * 0.01).r;
            float gFoam = smoothstep(0.7, 0.98, vGfxShore + (gShoreN - 0.5) * 0.6) * (0.65 + 0.35 * sin(gfxTime * 1.7 + vGfxWP.x * 3.0 + vGfxWP.z * 2.0));
            diffuseColor.rgb = mix(diffuseColor.rgb, gfxShallow, clamp(vGfxShore * 0.6, 0.0, 1.0)); diffuseColor.a *= 1.0 - vGfxShore * 0.25;`)
          .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `
            vec3 gV = normalize(vViewPosition);
            float gFr = pow(1.0 - clamp(dot(normal, gV), 0.0, 1.0), 4.0);
            outgoingLight = mix(outgoingLight, outgoingLight + gfxShallow * 0.25, gFr);
            outgoingLight = mix(outgoingLight, vec3(0.75, 0.8, 0.78) * (0.4 + 0.6 * gfxCloudF), gFoam * 0.5);
            gl_FragColor = vec4(outgoingLight, clamp(mix(diffuseColor.a, 1.0, gFr * 0.8) + gFoam * 0.35, 0.0, 1.0));`);
      }
    });
    this.cache[key] = m; return m;
  },
  /** animated lava: flowing crust (world-space UVs), emissive cracks pulsing — HDR so bloom glows. o:{intensity, scale} */
  lava(o) {
    o = o || {}; const key = 'lava' + JSON.stringify(o); if (this.cache[key]) return this.cache[key];
    const T = Textures.get('lava');
    const m = new THREE.MeshStandardMaterial({ map: T.map, normalMap: T.normalMap, roughnessMap: T.roughnessMap, emissiveMap: T.emissiveMap, emissive: 0xffffff, emissiveIntensity: o.intensity || 3.2, roughness: 1, metalness: 0 });
    patch(m, {
      world: o.scale || 0.42, cloud: false, extraKey: 'lava', extra: sh => {
        const flow = `vec2 gDist = (texture2D(gfxMacro, vUv * 0.21 + gfxTime * vec2(0.006, 0.004)).rg - 0.5) * 0.16; vec2 gUvL = vUv + gfxTime * vec2(0.012, 0.007) + gDist;`;
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <map_fragment>', flow + `vec4 texelColor = mapTexelToLinear(texture2D(map, gUvL)); diffuseColor *= texelColor;`)
          .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('texture2D( normalMap, vUv )', 'texture2D( normalMap, gUvL )'))
          .replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace('texture2D( roughnessMap, vUv )', 'texture2D( roughnessMap, gUvL )'))
          .replace('#include <emissivemap_fragment>', `
            vec3 gE = emissiveMapTexelToLinear(texture2D(emissiveMap, gUvL)).rgb;
            vec3 gE2 = emissiveMapTexelToLinear(texture2D(emissiveMap, vUv * 0.53 + vec2(0.3, 0.6) - gfxTime * vec2(0.009, 0.013))).rgb;
            float gP = texture2D(gfxMacro, vUv * 0.15 + gfxTime * vec2(0.02, -0.013)).r;
            float gPulse = 0.55 + 0.75 * smoothstep(0.3, 0.75, gP) + 0.12 * sin(gfxTime * 2.1 + gP * 9.0);
            totalEmissiveRadiance *= (gE * gPulse + gE2 * 0.35 * gP);`);
      }
    });
    this.cache[key] = m; return m;
  },
  /** glowing unlit material for magic/fire meshes (HDR color × intensity) */
  glow(color, intensity, o) {
    const m = new THREE.MeshBasicMaterial(Object.assign({ color: new THREE.Color(color).multiplyScalar(intensity || 2), toneMapped: true, fog: false }, o || {})); return m;
  }
};

/* ======================================================================================
 * 3. Geometry helpers
 * ==================================================================================== */
const Geo = Gfx.Geo = {};
/** bevelled box: w,h,d with edge radius r (2 facets per edge). Origin at centre. */
Geo.bevelBox = (w, h, d, r) => {
  r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const g = new THREE.BoxGeometry(w, h, d, 3, 3, 3); const p = g.attributes.position; const hw = w / 2, hh = h / 2, hd = d / 2;
  const remap = (a, half) => Math.abs(Math.abs(a) - half) < 1e-5 ? a : Math.sign(a) * (half - r);
  const v = new THREE.Vector3(), inner = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(remap(p.getX(i), hw), remap(p.getY(i), hh), remap(p.getZ(i), hd));
    inner.set(clamp(v.x, -hw + r, hw - r), clamp(v.y, -hh + r, hh - r), clamp(v.z, -hd + r, hd - r));
    const n = v.clone().sub(inner); if (n.lengthSq() > 1e-10) v.copy(inner).add(n.normalize().multiplyScalar(r));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
};
/** displace vertices by 3D noise (world-consistent). amp, freq, offset Vector3 */
Geo.displace = (g, amp, freq, off, along) => {
  const p = g.attributes.position; const o = off || new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + o.x, y = p.getY(i) + o.y, z = p.getZ(i) + o.z;
    if (along === 'normal') { /* handled below */ }
    p.setXYZ(i, p.getX(i) + fbm3(x * freq, y * freq, z * freq + 3.1) * amp, p.getY(i) + fbm3(x * freq + 7.7, y * freq, z * freq) * amp, p.getZ(i) + fbm3(x * freq, y * freq + 5.3, z * freq) * amp);
  }
  g.computeVertexNormals(); return g;
};
/** merge [{geo, matrix?, color?}] → one non-indexed BufferGeometry (position, normal, uv, color if any has color) */
Geo.merge = list => {
  let total = 0; const hasColor = list.some(e => e.color || (e.geo.attributes.color));
  const parts = list.map(e => { const g = e.geo.index ? e.geo.toNonIndexed() : e.geo; total += g.attributes.position.count; return { g, e }; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2), col = hasColor ? new Float32Array(total * 3) : null;
  let o = 0; const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const { g, e } of parts) {
    const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, C = g.attributes.color; const M = e.matrix; if (M) nm.getNormalMatrix(M);
    for (let i = 0; i < P.count; i++, o++) {
      v.set(P.getX(i), P.getY(i), P.getZ(i)); if (M) v.applyMatrix4(M); pos[o * 3] = v.x; pos[o * 3 + 1] = v.y; pos[o * 3 + 2] = v.z;
      if (N) { v.set(N.getX(i), N.getY(i), N.getZ(i)); if (M) v.applyMatrix3(nm).normalize(); nor[o * 3] = v.x; nor[o * 3 + 1] = v.y; nor[o * 3 + 2] = v.z; }
      if (UV) { uv[o * 2] = UV.getX(i); uv[o * 2 + 1] = UV.getY(i); }
      if (col) { const c = e.color ? e.color : C ? null : [1, 1, 1]; if (c) { col[o * 3] = c[0] != null ? c[0] : c.r; col[o * 3 + 1] = c[1] != null ? c[1] : c.g; col[o * 3 + 2] = c[2] != null ? c[2] : c.b; } else { col[o * 3] = C.getX(i); col[o * 3 + 1] = C.getY(i); col[o * 3 + 2] = C.getZ(i); } }
    }
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere(); return out;
};
/** worldUV(geometry, scale=1, matrix?) — replace UVs with planar projections picked per-vertex by the dominant normal axis.
 *  Use for merged static geometry whose material does NOT use the `world` shader option. */
Gfx.worldUV = (g, scale = 1, matrix) => {
  const P = g.attributes.position, N = g.attributes.normal; if (!N) g.computeVertexNormals();
  const uv = new Float32Array(P.count * 2); const v = new THREE.Vector3(), n = new THREE.Vector3(); const nm = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null;
  for (let i = 0; i < P.count; i++) {
    v.set(P.getX(i), P.getY(i), P.getZ(i)); n.set(g.attributes.normal.getX(i), g.attributes.normal.getY(i), g.attributes.normal.getZ(i));
    if (matrix) { v.applyMatrix4(matrix); n.applyMatrix3(nm); }
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    let a, b; if (ay >= ax && ay >= az) { a = v.x; b = v.z; } else if (ax >= az) { a = -v.z * Math.sign(n.x); b = v.y; } else { a = v.x * Math.sign(n.z); b = v.y; }
    uv[i * 2] = a * scale; uv[i * 2 + 1] = b * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
};

/* ======================================================================================
 * 4. Environment presets
 *    const env = PF.Gfx.Environment.apply(scene, renderer, 'grassDay', {W, H})
 *    -> {sun, hemi, fill, sky, grading, preset, fitShadow(W,H,maxY), update(dt, camera, target), dispose()}
 * ==================================================================================== */
const GRADE_DEFAULT = { exposure: 1.0, contrast: 1.08, saturation: 1.05, tintShadows: [0.95, 0.98, 1.06], tintHighlights: [1.05, 1.0, 0.94], vignette: 0.32, bloomStrength: 0.55, bloomThreshold: 1.0, aoStrength: 1.0, aoRadius: 0.55 };
const PRESETS = {
  grassDay: { sky: ['#4f86c6', '#a9c2d6', '#2a3136'], bg: 'sky', fog: ['#8fa3b0', 0.55], sunDir: [-0.55, 1.0, -0.42], sun: ['#fff0d8', 2.3], hemi: ['#c2d8ff', '#59503d', 0.42], fill: ['#9db6ff', 0.28], env: 0.85, cloud: 0.32, sunGlow: 1.0,
    grading: { exposure: 1.0, contrast: 1.1, saturation: 1.0, tintShadows: [0.93, 0.98, 1.08], tintHighlights: [1.06, 1.01, 0.93], vignette: 0.3, bloomStrength: 0.45 } },
  forest: { sky: ['#5f8fae', '#a9bfae', '#24291f'], bg: 'sky', fog: ['#7f9483', 0.6], sunDir: [-0.4, 1.0, -0.6], sun: ['#fff1cf', 2.1], hemi: ['#bfe0c0', '#3d3a26', 0.45], fill: ['#8fb3a0', 0.3], env: 0.8, cloud: 0.5, cloudScale: 0.09, sunGlow: 0.8,
    grading: { exposure: 1.0, contrast: 1.12, saturation: 1.02, tintShadows: [0.92, 1.0, 1.02], tintHighlights: [1.06, 1.03, 0.9], vignette: 0.38, bloomStrength: 0.45 } },
  caveTorch: { sky: ['#0b0f14', '#151a1f', '#0a0806'], bg: '#07090b', fog: ['#090b0d', 0.9], sunDir: [-0.3, 1.0, 0.25], sun: ['#7d97c8', 0.55], hemi: ['#3c4a60', '#1c140c', 0.32], fill: ['#c27a40', 0.18], env: 0.25, cloud: 0, sunGlow: 0,
    grading: { exposure: 1.15, contrast: 1.12, saturation: 1.0, tintShadows: [0.9, 0.96, 1.12], tintHighlights: [1.1, 1.0, 0.86], vignette: 0.5, bloomStrength: 0.7, bloomThreshold: 0.9 } },
  volcanic: { sky: ['#2a1210', '#6a3020', '#120806'], bg: 'sky', fog: ['#3a1c14', 0.7], sunDir: [0.5, 0.8, -0.6], sun: ['#ffb27a', 1.5], hemi: ['#a06850', '#4a1a08', 0.4], fill: ['#ff6a2a', 0.3], env: 0.5, cloud: 0.25, cloudScale: 0.06, sunGlow: 0.6,
    grading: { exposure: 1.05, contrast: 1.14, saturation: 1.1, tintShadows: [0.92, 0.94, 1.08], tintHighlights: [1.1, 0.98, 0.86], vignette: 0.42, bloomStrength: 0.75, bloomThreshold: 0.95 } },
  cryptGloom: { sky: ['#10131a', '#1c2129', '#0b0a09'], bg: '#08090c', fog: ['#0c0e12', 0.85], sunDir: [-0.35, 1.0, -0.3], sun: ['#a4b6e0', 0.75], hemi: ['#56647e', '#201a14', 0.38], fill: ['#7f8fb0', 0.2], env: 0.3, cloud: 0, sunGlow: 0,
    grading: { exposure: 1.12, contrast: 1.1, saturation: 0.9, tintShadows: [0.9, 0.97, 1.12], tintHighlights: [1.06, 1.0, 0.92], vignette: 0.5, bloomStrength: 0.65, bloomThreshold: 0.9 } },
  duskTown: { sky: ['#3a3f6a', '#d08a62', '#221d22'], bg: 'sky', fog: ['#7d6670', 0.6], sunDir: [-0.9, 0.42, -0.25], sun: ['#ffb070', 2.0], hemi: ['#9a9ad0', '#4a3428', 0.45], fill: ['#6f7fd0', 0.35], env: 0.8, cloud: 0.25, sunGlow: 1.2,
    grading: { exposure: 1.02, contrast: 1.1, saturation: 1.08, tintShadows: [0.9, 0.94, 1.12], tintHighlights: [1.1, 0.99, 0.88], vignette: 0.4, bloomStrength: 0.6 } },
  mountain: { sky: ['#3f78c0', '#b8cadb', '#2c3238'], bg: 'sky', fog: ['#9eb0c0', 0.5], sunDir: [-0.4, 1.1, -0.55], sun: ['#fff8ec', 2.5], hemi: ['#cfe2ff', '#5e5a50', 0.45], fill: ['#a8c0ff', 0.3], env: 0.9, cloud: 0.4, cloudScale: 0.035, sunGlow: 1.0,
    grading: { exposure: 1.0, contrast: 1.08, saturation: 1.0, tintShadows: [0.92, 0.97, 1.1], tintHighlights: [1.04, 1.02, 0.97], vignette: 0.28, bloomStrength: 0.4 } }
};
const SKY_V = `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const SKY_F = `uniform vec3 top; uniform vec3 hor; uniform vec3 gnd; uniform vec3 sunDir; uniform vec3 sunCol; uniform float glow; uniform float scale; varying vec3 vDir;
  void main(){ vec3 d = normalize(vDir); float y = d.y;
    vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y, 0.0, 1.0), 0.55)) : mix(hor, gnd, pow(clamp(-y * 3.0, 0.0, 1.0), 0.6));
    float s = max(dot(d, normalize(sunDir)), 0.0); c += sunCol * (pow(s, 600.0) * 6.0 * glow + pow(s, 12.0) * 0.35 * glow);
    gl_FragColor = vec4(c * scale, 1.0);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`;
function skyMaterial(P, scale) {
  const lin = h => new THREE.Color(h).convertSRGBToLinear();
  return new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
    uniforms: { top: { value: lin(P.sky[0]) }, hor: { value: lin(P.sky[1]) }, gnd: { value: lin(P.sky[2]) }, sunDir: { value: new THREE.Vector3().fromArray(P.sunDir).normalize() }, sunCol: { value: lin(P.sun[0]) }, glow: { value: P.sunGlow || 0 }, scale: { value: scale || 1 } } });
}
const Environment = Gfx.Environment = {
  presets: PRESETS, gradeDefault: GRADE_DEFAULT,
  _pmrem: {},
  /** apply(scene, renderer, preset, opts) — opts: {W, H (map size, for shadow fit), envMap:true, sky:true} */
  apply(scene, renderer, name, opts) {
    opts = opts || {}; const P = PRESETS[name] || PRESETS.grassDay;
    const prev = scene.userData.gfxEnv; if (prev) prev.dispose();
    const lin = h => new THREE.Color(h);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputEncoding = THREE.sRGBEncoding;
    if (!renderer.userData) renderer.userData = {};
    if (!renderer.userData.gfxPost) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = (P.grading.exposure || 1); }
    const rig = { preset: name, P, objects: [] };
    const add = o => { scene.add(o); rig.objects.push(o); return o; };
    // lights
    const sun = rig.sun = add(new THREE.DirectionalLight(lin(P.sun[0]), P.sun[1])); sun.name = 'gfxSun';
    sun.castShadow = true; sun.shadow.mapSize.set(opts.shadowSize || 2048, opts.shadowSize || 2048); sun.shadow.bias = -0.00035; sun.shadow.normalBias = 0.028; sun.shadow.radius = 2;
    add(sun.target);
    rig.hemi = add(new THREE.HemisphereLight(lin(P.hemi[0]), lin(P.hemi[1]), P.hemi[2]));
    const fill = rig.fill = add(new THREE.DirectionalLight(lin(P.fill[0]), P.fill[1])); add(fill.target);
    // background / sky
    if (P.bg === 'sky' && opts.sky !== false) {
      const sky = rig.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMaterial(P, 1)); sky.scale.setScalar(150); sky.frustumCulled = false; sky.renderOrder = -1000; sky.name = 'gfxSky';
      sky.onBeforeRender = (r, s, cam) => { sky.position.copy(cam.position); sky.updateMatrixWorld(); };
      add(sky); scene.background = new THREE.Color(P.sky[1]);
    } else scene.background = new THREE.Color(P.bg && P.bg !== 'sky' ? P.bg : P.fog[0]);
    scene.fog = new THREE.Fog(new THREE.Color(P.fog[0]), 30, 90); rig.fogK = P.fog[1];
    // PMREM environment from a procedural sky scene
    if (opts.envMap !== false) {
      let env = this._pmrem[name];
      if (!env) {
        const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene();
        const m = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMaterial(P, P.env)); m.material.depthTest = false; es.add(m);
        // a couple of soft bright cards give some structure to reflections
        const card = (c, x, y, z, s) => { const q = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(P.env * 1.5), side: THREE.DoubleSide })); q.position.set(x, y, z); q.lookAt(0, 0, 0); es.add(q); };
        card(P.sky[1], 6, 3, -5, 5); card(P.fill[0], -6, 2, 5, 4);
        env = this._pmrem[name] = pm.fromScene(es, 0.02, 0.1, 50).texture; pm.dispose(); m.geometry.dispose();
      }
      scene.environment = env;
    }
    U.gfxCloud.value = P.cloud || 0; U.gfxCloudScale.value = P.cloudScale || 0.045;
    rig.grading = Object.assign({}, GRADE_DEFAULT, P.grading);
    const sd = new THREE.Vector3().fromArray(P.sunDir).normalize();
    /** fit the sun shadow frustum to a W×H map (maxY = tallest geometry) */
    rig.fitShadow = (W, H, maxY = 4, cx, cz) => {
      cx = cx != null ? cx : W / 2; cz = cz != null ? cz : H / 2; const span = Math.hypot(W, H) / 2 + 1.5;
      sun.target.position.set(cx, 0, cz); sun.position.set(cx + sd.x * 40, sd.y * 40, cz + sd.z * 40);
      fill.target.position.set(cx, 0, cz); fill.position.set(cx - sd.x * 30, 25, cz - sd.z * 30);
      const c = sun.shadow.camera; c.left = -span; c.right = span; c.top = span; c.bottom = -span; c.near = 40 - span - maxY * 2; c.far = 40 + span + 4; c.near = Math.max(0.5, c.near); c.updateProjectionMatrix();
      sun.shadow.needsUpdate = true; rig.center = new THREE.Vector3(cx, 0, cz);
    };
    rig.fitShadow(opts.W || 20, opts.H || 20, opts.maxY || 4);
    /** keep fog relative to camera distance so zooming does not wash the map out */
    rig.update = (dt, camera, target) => {
      if (!camera) return; const t = target || rig.center || new THREE.Vector3(); const d = camera.position.distanceTo(t);
      scene.fog.near = d * (1.0 + (1 - rig.fogK) * 0.5) + 2; scene.fog.far = scene.fog.near + 24 + d * (2.4 - rig.fogK * 1.4);
    };
    rig.dispose = () => { rig.objects.forEach(o => { scene.remove(o); if (o.geometry) o.geometry.dispose(); }); if (scene.userData.gfxEnv === rig) scene.userData.gfxEnv = null; };
    scene.userData.gfxEnv = rig;
    return rig;
  }
};

/* ======================================================================================
 * 5. Post-processing
 *    const post = new PF.Gfx.Post(renderer, scene, camera, {quality:'high'|'medium'|'low'|'off'})
 *    post.setSize(cssW, cssH, pixelRatio); post.render(dt); post.setGrading({...}); post.setQuality(q)
 *    Pipeline: scene → HDR RT (+depth tex) → SSAO (½ res, normal-from-depth, 16 spp, bilateral blur)
 *              → bloom (bright pass ½ → dual-filter mip chain) → composite (AO, bloom, exposure, ACES,
 *              grading, vignette, dither) → FXAA → screen.
 * ==================================================================================== */
const FS_V = 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const AO_F = `
uniform sampler2D tDepth; uniform mat4 proj; uniform mat4 projInv; uniform vec2 texel; uniform float radius; uniform float bias; uniform float power; uniform float cnear; uniform float cfar;
uniform vec3 kernel[KSIZE]; varying vec2 vUv;
vec3 vpos(vec2 uv, float d){ vec4 v = projInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
float vz(float d){ return (cnear * cfar) / ((cfar - cnear) * d - cfar); }
void main(){
  float d = texture2D(tDepth, vUv).x;
  if (d >= 0.99999) { gl_FragColor = vec4(1.0, 1e4, 0.0, 1.0); return; }
  vec3 P = vpos(vUv, d);
  vec3 Pr = vpos(vUv + vec2(texel.x, 0.0), texture2D(tDepth, vUv + vec2(texel.x, 0.0)).x), Pl = vpos(vUv - vec2(texel.x, 0.0), texture2D(tDepth, vUv - vec2(texel.x, 0.0)).x);
  vec3 Pu = vpos(vUv + vec2(0.0, texel.y), texture2D(tDepth, vUv + vec2(0.0, texel.y)).x), Pd = vpos(vUv - vec2(0.0, texel.y), texture2D(tDepth, vUv - vec2(0.0, texel.y)).x);
  vec3 dx = abs(Pr.z - P.z) < abs(P.z - Pl.z) ? Pr - P : P - Pl;
  vec3 dy = abs(Pu.z - P.z) < abs(P.z - Pd.z) ? Pu - P : P - Pd;
  vec3 N = normalize(cross(dx, dy));
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float a = ign * 6.2831853; vec3 rv = vec3(cos(a), sin(a), 0.0);
  vec3 T = normalize(rv - N * dot(rv, N)); vec3 B = cross(N, T); mat3 TBN = mat3(T, B, N);
  float occ = 0.0; float rad = radius * (0.85 + 0.3 * ign);
  for (int i = 0; i < KSIZE; i++) {
    vec3 s = P + TBN * kernel[i] * rad;
    vec4 o = proj * vec4(s, 1.0); vec2 suv = o.xy / o.w * 0.5 + 0.5;
    float sz = vz(texture2D(tDepth, suv).x);
    float range = smoothstep(0.0, 1.0, rad / abs(P.z - sz));
    occ += (sz >= s.z + bias ? 1.0 : 0.0) * range;
  }
  float ao = pow(clamp(1.0 - occ / float(KSIZE), 0.0, 1.0), power);
  gl_FragColor = vec4(ao, -P.z, 0.0, 1.0);
}`;
const BLUR_F = `uniform sampler2D tAO; uniform vec2 dir; varying vec2 vUv;
void main(){ vec4 c0 = texture2D(tAO, vUv); float z0 = c0.y; float s = c0.x * 0.2270270270; float w = 0.2270270270;
  float o[4]; o[0] = 1.0; o[1] = 2.0; o[2] = 3.0; o[3] = 4.0; float g[4]; g[0] = 0.1945945946; g[1] = 0.1216216216; g[2] = 0.0540540541; g[3] = 0.0162162162;
  for (int i = 0; i < 4; i++) { for (int k = -1; k <= 1; k += 2) { vec4 c = texture2D(tAO, vUv + dir * o[i] * float(k)); float dw = g[i] * exp(-abs(c.y - z0) * 6.0 / max(z0 * 0.05, 0.05)); s += c.x * dw; w += dw; } }
  gl_FragColor = vec4(s / w, z0, 0.0, 1.0); }`;
const BRIGHT_F = `uniform sampler2D tColor; uniform vec2 texel; uniform float threshold; varying vec2 vUv;
vec3 pick(vec2 uv){ vec3 c = min(texture2D(tColor, uv).rgb, vec3(60.0)); float l = max(c.r, max(c.g, c.b)); float knee = threshold * 0.5; float rq = clamp(l - threshold + knee, 0.0, 2.0 * knee); rq = rq * rq / (4.0 * knee + 1e-4); return c * max(rq, l - threshold) / max(l, 1e-4); }
void main(){ vec3 a = pick(vUv + texel * vec2(-0.5, -0.5)), b = pick(vUv + texel * vec2(0.5, -0.5)), c = pick(vUv + texel * vec2(-0.5, 0.5)), d = pick(vUv + texel * vec2(0.5, 0.5));
  // Karis average (anti-firefly)
  float wa = 1.0 / (1.0 + max(a.r, max(a.g, a.b))), wb = 1.0 / (1.0 + max(b.r, max(b.g, b.b))), wc = 1.0 / (1.0 + max(c.r, max(c.g, c.b))), wd = 1.0 / (1.0 + max(d.r, max(d.g, d.b)));
  gl_FragColor = vec4((a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd), 1.0); }`;
const DOWN_F = `uniform sampler2D tSrc; uniform vec2 hp; varying vec2 vUv;
void main(){ vec3 s = texture2D(tSrc, vUv).rgb * 4.0 + texture2D(tSrc, vUv - hp).rgb + texture2D(tSrc, vUv + hp).rgb + texture2D(tSrc, vUv + vec2(hp.x, -hp.y)).rgb + texture2D(tSrc, vUv - vec2(hp.x, -hp.y)).rgb; gl_FragColor = vec4(s / 8.0, 1.0); }`;
const UP_F = `uniform sampler2D tSrc; uniform vec2 hp; uniform float weight; varying vec2 vUv;
void main(){ vec3 s = texture2D(tSrc, vUv + vec2(-hp.x * 2.0, 0.0)).rgb + texture2D(tSrc, vUv + vec2(-hp.x, hp.y)).rgb * 2.0 + texture2D(tSrc, vUv + vec2(0.0, hp.y * 2.0)).rgb + texture2D(tSrc, vUv + vec2(hp.x, hp.y)).rgb * 2.0
  + texture2D(tSrc, vUv + vec2(hp.x * 2.0, 0.0)).rgb + texture2D(tSrc, vUv + vec2(hp.x, -hp.y)).rgb * 2.0 + texture2D(tSrc, vUv + vec2(0.0, -hp.y * 2.0)).rgb + texture2D(tSrc, vUv + vec2(-hp.x, -hp.y)).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 * weight, 1.0); }`;
const COMP_F = `uniform sampler2D tColor; uniform sampler2D tAO; uniform sampler2D tBloom; uniform sampler2D tDepth; uniform vec2 aoTexel; uniform float cnear; uniform float cfar;
uniform float useAO; uniform float useBloom; uniform float exposure; uniform float contrast; uniform float saturation; uniform vec3 tintS; uniform vec3 tintH; uniform float vignette; uniform float bloomStrength; uniform float aoStrength; uniform float encode;
varying vec2 vUv;
vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c){ const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602)); c = I * c; c = RRTAndODTFit(c); c = O * c; return clamp(c, 0.0, 1.0); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float vz(float d){ return -(cnear * cfar) / ((cfar - cnear) * d - cfar); }
void main(){
  vec3 c = texture2D(tColor, vUv).rgb;
  if (useAO > 0.5) {
    float z = vz(texture2D(tDepth, vUv).x); float s = 0.0, w = 0.0;
    for (int i = 0; i < 4; i++) { vec2 o = vec2(i == 1 || i == 3 ? 0.5 : -0.5, i >= 2 ? 0.5 : -0.5) * aoTexel; vec4 a = texture2D(tAO, vUv + o); float k = 1.0 / (1e-3 + abs(a.y - z)); s += a.x * k; w += k; }
    float ao = s / w; c *= mix(1.0, ao, aoStrength);
  }
  if (useBloom > 0.5) c += texture2D(tBloom, vUv).rgb * bloomStrength;
  c = aces(c * exposure / 0.6);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, saturation), 0.0);
  c *= mix(tintS, tintH, smoothstep(0.02, 0.5, l));
  c = toSRGB(clamp(c, 0.0, 1.0));
  c = clamp(mix(c, c * c * (3.0 - 2.0 * c), contrast - 1.0), 0.0, 1.0);
  vec2 dv = vUv - 0.5; c *= mix(1.0, smoothstep(0.85, 0.15, length(dv * vec2(1.15, 1.0))), vignette);
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  c += (ign - 0.5) / 255.0;
  gl_FragColor = vec4(c, dot(c, vec3(0.299, 0.587, 0.114)));
}`;
const FXAA_F = `uniform sampler2D tColor; uniform vec2 res; varying vec2 vUv;
#define FXAA_REDUCE_MIN (1.0/128.0)
#define FXAA_REDUCE_MUL (1.0/8.0)
#define FXAA_SPAN_MAX 8.0
void main(){ vec2 ip = 1.0 / res; vec2 fc = vUv * res;
  vec3 rgbNW = texture2D(tColor, (fc + vec2(-1.0, -1.0)) * ip).xyz, rgbNE = texture2D(tColor, (fc + vec2(1.0, -1.0)) * ip).xyz, rgbSW = texture2D(tColor, (fc + vec2(-1.0, 1.0)) * ip).xyz, rgbSE = texture2D(tColor, (fc + vec2(1.0, 1.0)) * ip).xyz;
  vec4 texM = texture2D(tColor, vUv); vec3 rgbM = texM.xyz; vec3 luma = vec3(0.299, 0.587, 0.114);
  float lNW = dot(rgbNW, luma), lNE = dot(rgbNE, luma), lSW = dot(rgbSW, luma), lSE = dot(rgbSE, luma), lM = dot(rgbM, luma);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
  float dirReduce = max((lNW + lNE + lSW + lSE) * (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);
  float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = min(vec2(FXAA_SPAN_MAX), max(vec2(-FXAA_SPAN_MAX), dir * rcpDirMin)) * ip;
  vec3 rgbA = 0.5 * (texture2D(tColor, vUv + dir * (1.0 / 3.0 - 0.5)).xyz + texture2D(tColor, vUv + dir * (2.0 / 3.0 - 0.5)).xyz);
  vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tColor, vUv + dir * -0.5).xyz + texture2D(tColor, vUv + dir * 0.5).xyz);
  float lB = dot(rgbB, luma);
  gl_FragColor = vec4((lB < lMin || lB > lMax) ? rgbA : rgbB, 1.0); }`;
const COPY_F = 'uniform sampler2D tSrc; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tSrc, vUv); }';

class Post {
  constructor(renderer, scene, camera, opts) {
    opts = opts || {}; this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.grading = Object.assign({}, GRADE_DEFAULT, opts.grading || {}); this.stats = { ms: 0 };
    const gl = renderer.getContext(); const caps = renderer.capabilities; this.webgl2 = caps.isWebGL2;
    this.hdr = this.webgl2 ? !!(renderer.extensions.get('EXT_color_buffer_float') || renderer.extensions.get('EXT_color_buffer_half_float')) : !!(renderer.extensions.get('OES_texture_half_float') && renderer.extensions.get('EXT_color_buffer_half_float'));
    this.depthTex = this.webgl2 || !!renderer.extensions.get('WEBGL_depth_texture');
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.fsScene = new THREE.Scene();
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(tri, null); this.quad.frustumCulled = false; this.fsScene.add(this.quad);
    const M = (f, u, defs) => new THREE.ShaderMaterial({ vertexShader: FS_V, fragmentShader: f, uniforms: u, defines: defs || {}, depthTest: false, depthWrite: false });
    const kern = n => { const r = mulberry(7); const a = []; for (let i = 0; i < n; i++) { const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 0.85 + 0.15).normalize(); let s = i / n; s = lerp(0.12, 1, s * s); v.multiplyScalar(s * (0.6 + r() * 0.4)); a.push(v); } return a; };
    this.mAO = { 16: M(AO_F, this._aoU(kern(16)), { KSIZE: 16 }), 8: M(AO_F, this._aoU(kern(8)), { KSIZE: 8 }) };
    this.mBlur = M(BLUR_F, { tAO: { value: null }, dir: { value: new THREE.Vector2() } });
    this.mBright = M(BRIGHT_F, { tColor: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1 } });
    this.mDown = M(DOWN_F, { tSrc: { value: null }, hp: { value: new THREE.Vector2() } });
    this.mUp = M(UP_F, { tSrc: { value: null }, hp: { value: new THREE.Vector2() }, weight: { value: 1 } }); this.mUp.blending = THREE.AdditiveBlending; this.mUp.transparent = true;
    this.mComp = M(COMP_F, { tColor: { value: null }, tAO: { value: null }, tBloom: { value: null }, tDepth: { value: null }, aoTexel: { value: new THREE.Vector2() }, cnear: { value: 0.1 }, cfar: { value: 100 },
      useAO: { value: 0 }, useBloom: { value: 0 }, exposure: { value: 1 }, contrast: { value: 1 }, saturation: { value: 1 }, tintS: { value: new THREE.Vector3(1, 1, 1) }, tintH: { value: new THREE.Vector3(1, 1, 1) }, vignette: { value: 0 }, bloomStrength: { value: 0 }, aoStrength: { value: 1 }, encode: { value: 1 } });
    this.mFXAA = M(FXAA_F, { tColor: { value: null }, res: { value: new THREE.Vector2() } });
    this.mCopy = M(COPY_F, { tSrc: { value: null } });
    renderer.userData = renderer.userData || {}; renderer.userData.gfxPost = this;
    this.setQuality(opts.quality || 'high');
    const s = renderer.getSize(new THREE.Vector2()); this.setSize(s.x, s.y, renderer.getPixelRatio());
  }
  _aoU(k) { return { tDepth: { value: null }, proj: { value: new THREE.Matrix4() }, projInv: { value: new THREE.Matrix4() }, texel: { value: new THREE.Vector2() }, radius: { value: 0.55 }, bias: { value: 0.025 }, power: { value: 1.6 }, cnear: { value: 0.1 }, cfar: { value: 100 }, kernel: { value: k } }; }
  setQuality(q) {
    this.quality = q; const Q = { high: { ao: 16, bloom: 5, aoBlur: 2 }, medium: { ao: 8, bloom: 4, aoBlur: 1 }, low: { ao: 0, bloom: 0 }, off: {} }[q] || {};
    this.Q = Q; if (!this.depthTex || !this.hdr) Q.ao = 0; if (!this.hdr) Q.bloom = Math.min(Q.bloom || 0, 3);
    this.renderer.toneMapping = q === 'off' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    if (this.w) this._alloc();
  }
  setGrading(g) { Object.assign(this.grading, g || {}); }
  setSize(w, h, pr) {
    if (pr == null) pr = this.renderer.getPixelRatio();
    this.cssW = w; this.cssH = h; this.pr = pr; this.w = Math.max(1, Math.floor(w * pr)); this.h = Math.max(1, Math.floor(h * pr)); this._alloc();
  }
  _alloc() {
    (this.rts || []).forEach(rt => rt.dispose()); this.rts = [];
    if (this.quality === 'off') return;
    const W = this.w, H = this.h; const type = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const mk = (w, h, t, o) => { const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), Object.assign({ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: t, depthBuffer: false, stencilBuffer: false }, o || {})); rt.texture.generateMipmaps = false; this.rts.push(rt); return rt; };
    this.rtScene = mk(W, H, type, { depthBuffer: true });
    if (this.depthTex) { const dt = new THREE.DepthTexture(W, H); dt.type = this.webgl2 ? THREE.UnsignedIntType : THREE.UnsignedShortType; dt.format = THREE.DepthFormat; dt.minFilter = dt.magFilter = THREE.NearestFilter; this.rtScene.depthTexture = dt; }
    this.rtLDR = mk(W, H, THREE.UnsignedByteType);
    const hw = Math.ceil(W / 2), hh = Math.ceil(H / 2);
    if (this.Q.ao) { this.rtAO = mk(hw, hh, THREE.HalfFloatType); this.rtAO2 = mk(hw, hh, THREE.HalfFloatType); }
    this.mips = [];
    for (let i = 0; i < (this.Q.bloom || 0); i++) this.mips.push(mk(Math.ceil(hw / (1 << i)), Math.ceil(hh / (1 << i)), type));
  }
  _pass(mat, target, clear = true) { this.quad.material = mat; const r = this.renderer; r.setRenderTarget(target); const ac = r.autoClear; r.autoClear = clear; r.render(this.fsScene, this.fsCam); r.autoClear = ac; }
  render(dt) {
    const t0 = performance.now(); const r = this.renderer, cam = this.camera, g = this.grading;
    if (this.quality === 'off') { r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = g.exposure; r.setRenderTarget(null); r.render(this.scene, cam); this.stats.calls = r.info.render.calls; this.stats.tris = r.info.render.triangles; this.stats.ms = performance.now() - t0; return; }
    if (r.toneMapping !== THREE.NoToneMapping) r.toneMapping = THREE.NoToneMapping;
    const oldShadowAuto = r.shadowMap.autoUpdate;
    r.setRenderTarget(this.rtScene); r.render(this.scene, cam); this.stats.calls = r.info.render.calls; this.stats.tris = r.info.render.triangles;
    const Q = this.Q; const C = this.mComp.uniforms;
    // --- SSAO ---
    if (Q.ao && g.aoStrength > 0.001) {
      const m = this.mAO[Q.ao]; const u = m.uniforms;
      u.tDepth.value = this.rtScene.depthTexture; u.proj.value.copy(cam.projectionMatrix); u.projInv.value.copy(cam.projectionMatrixInverse); u.texel.value.set(1 / this.w, 1 / this.h);
      u.cnear.value = cam.near; u.cfar.value = cam.far; u.radius.value = g.aoRadius || 0.55; u.power.value = 1.3 + (g.aoStrength || 1) * 0.5;
      this._pass(m, this.rtAO);
      const bu = this.mBlur.uniforms; const ax = 1 / this.rtAO.width, ay = 1 / this.rtAO.height;
      for (let i = 0; i < (Q.aoBlur || 1); i++) {
        bu.tAO.value = this.rtAO.texture; bu.dir.value.set(ax * (i + 1) * 0.75, 0); this._pass(this.mBlur, this.rtAO2);
        bu.tAO.value = this.rtAO2.texture; bu.dir.value.set(0, ay * (i + 1) * 0.75); this._pass(this.mBlur, this.rtAO);
      }
      C.useAO.value = 1; C.tAO.value = this.rtAO.texture; C.tDepth.value = this.rtScene.depthTexture; C.aoTexel.value.set(ax, ay); C.cnear.value = cam.near; C.cfar.value = cam.far; C.aoStrength.value = Math.min(1, g.aoStrength);
    } else C.useAO.value = 0;
    // --- Bloom ---
    if (Q.bloom && g.bloomStrength > 0.001) {
      const b = this.mBright.uniforms; b.tColor.value = this.rtScene.texture; b.texel.value.set(1 / this.w, 1 / this.h); b.threshold.value = g.bloomThreshold; this._pass(this.mBright, this.mips[0]);
      const d = this.mDown.uniforms;
      for (let i = 1; i < this.mips.length; i++) { const s = this.mips[i - 1]; d.tSrc.value = s.texture; d.hp.value.set(0.5 / s.width, 0.5 / s.height).multiplyScalar(2); this._pass(this.mDown, this.mips[i]); }
      const up = this.mUp.uniforms;
      for (let i = this.mips.length - 2; i >= 0; i--) { const s = this.mips[i + 1]; up.tSrc.value = s.texture; up.hp.value.set(0.5 / s.width, 0.5 / s.height); up.weight.value = 1.0; this._pass(this.mUp, this.mips[i], false); }
      C.useBloom.value = 1; C.tBloom.value = this.mips[0].texture; C.bloomStrength.value = g.bloomStrength / Math.max(1, this.mips.length * 0.6);
    } else C.useBloom.value = 0;
    // --- composite + FXAA ---
    C.tColor.value = this.rtScene.texture; C.exposure.value = g.exposure; C.contrast.value = g.contrast; C.saturation.value = g.saturation; C.vignette.value = g.vignette;
    C.tintS.value.fromArray(g.tintShadows); C.tintH.value.fromArray(g.tintHighlights);
    this._pass(this.mComp, this.rtLDR);
    this.mFXAA.uniforms.tColor.value = this.rtLDR.texture; this.mFXAA.uniforms.res.value.set(this.w, this.h);
    this._pass(this.mFXAA, null);
    r.shadowMap.autoUpdate = oldShadowAuto;
    this.stats.ms = performance.now() - t0;
  }
  dispose() { (this.rts || []).forEach(rt => rt.dispose()); this.rts = []; if (this.renderer.userData) this.renderer.userData.gfxPost = null; }
}
Gfx.Post = Post;

/* ======================================================================================
 * 6. Particles & spell FX
 *    const fx = new PF.Gfx.Particles(scene, renderer, {lights: 6}); fx.update(dt) every frame.
 *    Pools: additive points (fire/magic), alpha points (smoke/dust), additive streaks (sparks),
 *    camera-facing ribbons (trails/beams/lightning), ground rings, pooled point lights (fixed
 *    count so materials never recompile).
 * ==================================================================================== */
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const toV = v => v && v.isVector3 ? v.clone() : Array.isArray(v) ? V3(v[0], v[1], v[2]) : v ? V3(v.x || 0, v.y || 0, v.z || 0) : V3(0, 0, 0);
const C = (c, k = 1) => { const o = c && c.isColor ? c.clone() : new THREE.Color(c == null ? 0xffffff : c); return [o.r * k, o.g * k, o.b * k]; };
const rr = (a, b) => a + Math.random() * (b - a);
const rsign = () => Math.random() < 0.5 ? -1 : 1;
function randDir(out, up = 0) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u); out.set(s * Math.cos(a), Math.abs(u) * up + u * (1 - up), s * Math.sin(a)); return out; }

/* sprite atlas: 8 frames of 128px: 0 soft dot, 1 smoke puff, 2 star flare, 3 hot core, 4 snow shard, 5 wisp, 6 droplet, 7 ring */
let _atlas = null;
function spriteAtlas() {
  if (_atlas) return _atlas;
  const S = 128, F = 8, W = S * F; const d = new Uint8Array(W * S * 4); const n = new Noise(5);
  for (let f = 0; f < F; f++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + 0.5) / S * 2 - 1, v = (y + 0.5) / S * 2 - 1, r = Math.sqrt(u * u + v * v), a = Math.atan2(v, u); let A = 0, L = 1;
    if (f === 0) A = Math.exp(-r * r * 4.5) * smooth(1, 0.8, r);
    else if (f === 1) { const nn = n.fbm(x / S, y / S, 4, 4) * 0.5 + 0.5, n2 = n.fbm(x / S + 0.3, y / S, 8, 3) * 0.5 + 0.5; A = smooth(1.0, 0.25, r + (nn - 0.5) * 0.7) * (0.55 + nn * 0.6); L = 0.62 + 0.38 * clamp(0.5 - v * 0.5 + (n2 - 0.5) * 0.6, 0, 1); }
    else if (f === 2) { const core = Math.exp(-r * r * 18); const spikes = Math.pow(Math.abs(Math.cos(a * 2)), 60) * Math.exp(-r * 2.5) + Math.pow(Math.abs(Math.cos(a * 2 + Math.PI / 4)), 80) * Math.exp(-r * 4) * 0.5; A = clamp(core + spikes * 0.9 + Math.exp(-r * r * 3) * 0.25, 0, 1) * smooth(1, 0.9, r); }
    else if (f === 3) A = clamp(Math.exp(-r * r * 22) + Math.exp(-r * r * 3.5) * 0.35, 0, 1) * smooth(1, 0.85, r);
    else if (f === 4) { const sp = Math.pow(Math.abs(Math.cos(a * 3)), 24) * smooth(0.95, 0.2, r); A = clamp(sp + Math.exp(-r * r * 14), 0, 1) * smooth(1, 0.9, r); }
    else if (f === 5) { const sw = n.fbm(x / S, y / S, 3, 4); A = smooth(1, 0.0, r + sw * 0.6) * Math.exp(-Math.abs(u * 1.5 + sw)) * 1.3; A = clamp(A, 0, 1); }
    else if (f === 6) { const vv = v + 0.25; const rr2 = Math.sqrt(u * u * 2.2 + (vv < 0 ? vv * vv * 0.6 : vv * vv * 2.2)); A = smooth(0.75, 0.6, rr2); L = 0.75 + 0.25 * smooth(0.6, 0.1, Math.hypot(u + 0.15, vv + 0.15)); }
    else if (f === 7) A = Math.exp(-Math.pow((r - 0.72) * 9, 2)) * smooth(1, 0.92, r);
    const i = (y * W + f * S + x) * 4; d[i] = d[i + 1] = d[i + 2] = clamp(L, 0, 1) * 255; d[i + 3] = clamp(A, 0, 1) * 255;
  }
  const t = new THREE.DataTexture(d, W, S, THREE.RGBAFormat); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; t.flipY = false;
  return (_atlas = t);
}
const PT_V = `attribute vec3 color; attribute vec4 extra; uniform float pscale; varying vec3 vC; varying float vA; varying vec2 vFR;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = extra.y * pscale / max(0.05, -mv.z); vC = color; vA = extra.x; vFR = extra.zw; }`;
const PT_F = `uniform sampler2D atlas; uniform float soft; varying vec3 vC; varying float vA; varying vec2 vFR;
void main(){ vec2 p = gl_PointCoord - 0.5; float c = cos(vFR.y), s = sin(vFR.y); p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) * 0.999 + 0.5;
  vec4 t = texture2D(atlas, vec2((clamp(p.x, 0.005, 0.995) + vFR.x) / 8.0, p.y)); if (t.a * vA < 0.003) discard;
  gl_FragColor = vec4(vC * mix(1.0, t.r, soft), t.a * vA); }`;
const STRIDE = 26; // px py pz vx vy vz age life s0 s1 r0 g0 b0 r1 g1 b1 a drag grav frame rot rotV fi fo turb seed
class PointPool {
  constructor(max, additive, parent) {
    this.max = max; this.n = 0; this.d = new Float32Array(max * STRIDE);
    const g = this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.ex = new Float32Array(max * 4);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('extra', new THREE.BufferAttribute(this.ex, 4).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({ vertexShader: PT_V, fragmentShader: PT_F, uniforms: { atlas: { value: spriteAtlas() }, pscale: { value: 400 }, soft: { value: additive ? 0 : 1 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 12 : 11;
    this.pts.onBeforeRender = (r, s, cam) => { const h = r.getDrawingBufferSize(_v2).y; this.mat.uniforms.pscale.value = h * cam.projectionMatrix.elements[5] * 0.5; };
    parent.add(this.pts);
  }
  spawn(o) {
    if (this.n >= this.max) return -1; const i = this.n++, d = this.d, k = i * STRIDE; const p = o.p, v = o.v || _zero, c0 = o.c0, c1 = o.c1 || o.c0;
    d[k] = p.x; d[k + 1] = p.y; d[k + 2] = p.z; d[k + 3] = v.x; d[k + 4] = v.y; d[k + 5] = v.z; d[k + 6] = -(o.delay || 0); d[k + 7] = o.life || 1;
    d[k + 8] = o.s0 != null ? o.s0 : 0.3; d[k + 9] = o.s1 != null ? o.s1 : d[k + 8]; d[k + 10] = c0[0]; d[k + 11] = c0[1]; d[k + 12] = c0[2]; d[k + 13] = c1[0]; d[k + 14] = c1[1]; d[k + 15] = c1[2];
    d[k + 16] = o.a != null ? o.a : 1; d[k + 17] = o.drag || 0; d[k + 18] = o.g || 0; d[k + 19] = o.frame || 0; d[k + 20] = o.rot != null ? o.rot : Math.random() * 6.28; d[k + 21] = o.rotV || 0;
    d[k + 22] = o.fi != null ? o.fi : 0.08; d[k + 23] = o.fo != null ? o.fo : 0.5; d[k + 24] = o.turb || 0; d[k + 25] = Math.random() * 100; return i;
  }
  update(dt, time) {
    const d = this.d; let n = this.n;
    for (let i = 0; i < n; i++) {
      const k = i * STRIDE; d[k + 6] += dt; const age = d[k + 6];
      if (age >= d[k + 7]) { n--; if (i !== n) d.copyWithin(k, n * STRIDE, n * STRIDE + STRIDE); i--; continue; }
      const p3 = i * 3, e4 = i * 4;
      if (age < 0) { this.ex[e4] = 0; this.ex[e4 + 1] = 0; this.pos[p3] = d[k]; this.pos[p3 + 1] = d[k + 1]; this.pos[p3 + 2] = d[k + 2]; continue; }
      const t = age / d[k + 7]; const dr = Math.exp(-d[k + 17] * dt);
      d[k + 3] *= dr; d[k + 4] = d[k + 4] * dr + d[k + 18] * dt; d[k + 5] *= dr;
      const tb = d[k + 24]; if (tb) { const sd = d[k + 25]; d[k + 3] += Math.sin(time * 2.3 + d[k + 1] * 3.1 + sd) * tb * dt; d[k + 5] += Math.cos(time * 1.9 + d[k] * 2.7 + sd * 1.3) * tb * dt; d[k + 4] += Math.sin(time * 1.3 + sd * 2.1) * tb * 0.4 * dt; }
      d[k] += d[k + 3] * dt; d[k + 1] += d[k + 4] * dt; d[k + 2] += d[k + 5] * dt; d[k + 20] += d[k + 21] * dt;
      this.pos[p3] = d[k]; this.pos[p3 + 1] = d[k + 1]; this.pos[p3 + 2] = d[k + 2];
      const tc = t; this.col[p3] = lerp(d[k + 10], d[k + 13], tc); this.col[p3 + 1] = lerp(d[k + 11], d[k + 14], tc); this.col[p3 + 2] = lerp(d[k + 12], d[k + 15], tc);
      const fi = d[k + 22], fo = d[k + 23]; const a = d[k + 16] * (fi > 0 ? Math.min(1, t / fi) : 1) * (t > fo ? 1 - (t - fo) / (1 - fo) : 1);
      this.ex[e4] = a; this.ex[e4 + 1] = lerp(d[k + 8], d[k + 9], Math.sqrt(t)); this.ex[e4 + 2] = d[k + 19]; this.ex[e4 + 3] = d[k + 20];
    }
    this.n = n; const g = this.geo; g.setDrawRange(0, n);
    if (n) { for (const a of ['position', 'color', 'extra']) { const at = g.attributes[a]; at.updateRange.offset = 0; at.updateRange.count = n * at.itemSize; at.needsUpdate = true; } }
  }
}
const _v2 = new THREE.Vector2(), _zero = new THREE.Vector3(), _tmp = new THREE.Vector3(), _tmp2 = new THREE.Vector3();

/* streaks: velocity-aligned additive quads (sparks, embers, wind) */
const ST_V = `attribute vec3 tail; attribute vec2 corner; attribute vec4 cola; attribute float width; uniform float aspect; varying vec4 vC; varying vec2 vCorner;
void main(){ mat4 m = projectionMatrix * modelViewMatrix; vec4 h = m * vec4(position, 1.0); vec4 t = m * vec4(tail, 1.0);
  vec2 hs = h.xy / h.w, ts = t.xy / t.w; vec2 d = (hs - ts) * vec2(aspect, 1.0); float L = length(d); d = L > 1e-5 ? d / L : vec2(1.0, 0.0);
  vec2 n = vec2(-d.y, d.x); n.x /= aspect; vec4 p = mix(h, t, corner.x); p.xy += n * corner.y * width * projectionMatrix[1][1] * 0.5 + vec2(d.x / aspect, d.y) * (corner.x * 2.0 - 1.0) * -width * projectionMatrix[1][1] * 0.25;
  gl_Position = p; vC = cola; vCorner = corner; }`;
const ST_F = `varying vec4 vC; varying vec2 vCorner; void main(){ float a = (1.0 - vCorner.y * vCorner.y) * (1.0 - vCorner.x * 0.85); gl_FragColor = vec4(vC.rgb, vC.a * a); }`;
const SSTRIDE = 18; // px py pz vx vy vz age life len w r g b a drag grav r1-fade? (a1)
class StreakPool {
  constructor(max, parent) {
    this.max = max; this.n = 0; this.d = new Float32Array(max * SSTRIDE); const g = this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 12); this.tail = new Float32Array(max * 12); this.cola = new Float32Array(max * 16); this.w = new Float32Array(max * 4); const corner = new Float32Array(max * 8); const idx = [];
    for (let i = 0; i < max; i++) { corner.set([0, -1, 0, 1, 1, -1, 1, 1], i * 8); const b = i * 4; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    g.setIndex(idx); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('tail', new THREE.BufferAttribute(this.tail, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('cola', new THREE.BufferAttribute(this.cola, 4).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('width', new THREE.BufferAttribute(this.w, 1).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({ vertexShader: ST_V, fragmentShader: ST_F, uniforms: { aspect: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 13;
    this.mesh.onBeforeRender = r => { const s = r.getDrawingBufferSize(_v2); this.mat.uniforms.aspect.value = s.x / Math.max(1, s.y); };
    parent.add(this.mesh);
  }
  spawn(o) {
    if (this.n >= this.max) return; const k = (this.n++) * SSTRIDE, d = this.d, c = o.c;
    d[k] = o.p.x; d[k + 1] = o.p.y; d[k + 2] = o.p.z; d[k + 3] = o.v.x; d[k + 4] = o.v.y; d[k + 5] = o.v.z; d[k + 6] = -(o.delay || 0); d[k + 7] = o.life || 0.4; d[k + 8] = o.len || 0.05; d[k + 9] = o.w || 0.02;
    d[k + 10] = c[0]; d[k + 11] = c[1]; d[k + 12] = c[2]; d[k + 13] = o.a != null ? o.a : 1; d[k + 14] = o.drag || 0; d[k + 15] = o.g != null ? o.g : -9; d[k + 16] = o.cool != null ? o.cool : 1; d[k + 17] = 0;
  }
  update(dt) {
    const d = this.d; let n = this.n;
    for (let i = 0; i < n; i++) {
      const k = i * SSTRIDE; d[k + 6] += dt; const age = d[k + 6];
      if (age >= d[k + 7]) { n--; if (i !== n) d.copyWithin(k, n * SSTRIDE, n * SSTRIDE + SSTRIDE); i--; continue; }
      const live = age >= 0; const t = Math.max(0, age) / d[k + 7];
      if (live) { const dr = Math.exp(-d[k + 14] * dt); d[k + 3] *= dr; d[k + 4] = d[k + 4] * dr + d[k + 15] * dt; d[k + 5] *= dr; d[k] += d[k + 3] * dt; d[k + 1] += d[k + 4] * dt; d[k + 2] += d[k + 5] * dt; }
      const L = d[k + 8]; const tx = d[k] - d[k + 3] * L, ty = d[k + 1] - d[k + 4] * L, tz = d[k + 2] - d[k + 5] * L;
      const a = live ? d[k + 13] * (1 - t * t) : 0; const cool = 1 - t * d[k + 16] * 0.6;
      for (let j = 0; j < 4; j++) {
        const q = (i * 4 + j); this.pos[q * 3] = d[k]; this.pos[q * 3 + 1] = d[k + 1]; this.pos[q * 3 + 2] = d[k + 2]; this.tail[q * 3] = tx; this.tail[q * 3 + 1] = ty; this.tail[q * 3 + 2] = tz;
        this.cola[q * 4] = d[k + 10] * cool; this.cola[q * 4 + 1] = d[k + 11] * cool * cool; this.cola[q * 4 + 2] = d[k + 12] * cool * cool; this.cola[q * 4 + 3] = a; this.w[q] = d[k + 9];
      }
    }
    this.n = n; this.geo.setDrawRange(0, n * 6);
    if (n) for (const a of ['position', 'tail', 'cola', 'width']) { const at = this.geo.attributes[a]; at.updateRange.offset = 0; at.updateRange.count = n * 4 * at.itemSize; at.needsUpdate = true; }
  }
}

/* ribbons: camera-facing strips (trails, beams, lightning) */
const RB_V = `attribute vec3 prev; attribute vec3 next; attribute float side; attribute float width; attribute vec4 cola; attribute float u; uniform float aspect; varying vec4 vC; varying vec2 vUV;
void main(){ mat4 m = projectionMatrix * modelViewMatrix; vec4 c = m * vec4(position, 1.0), p = m * vec4(prev, 1.0), n = m * vec4(next, 1.0);
  vec2 d = (n.xy / n.w - p.xy / p.w) * vec2(aspect, 1.0); float L = length(d); d = L > 1e-6 ? d / L : vec2(1.0, 0.0); vec2 nr = vec2(-d.y, d.x); nr.x /= aspect;
  c.xy += nr * side * width * projectionMatrix[1][1] * 0.5; gl_Position = c; vC = cola; vUV = vec2(u, side * 0.5 + 0.5); }`;
const RB_F = `uniform float time; uniform float flow; uniform float soft; varying vec4 vC; varying vec2 vUV;
void main(){ float e = 1.0 - abs(vUV.y * 2.0 - 1.0); float a = pow(e, soft);
  if (flow > 0.0) { float f = sin(vUV.x * 23.0 - time * flow) * 0.5 + 0.5; f *= sin(vUV.x * 9.7 - time * flow * 0.63 + 1.3) * 0.5 + 0.5; a *= 0.55 + 0.9 * f; }
  gl_FragColor = vec4(vC.rgb, vC.a * a); }`;
class Ribbon {
  constructor(max, parent, o) {
    o = o || {}; this.max = max; const g = this.geo = new THREE.BufferGeometry(); const N = max * 2;
    this.a = { position: new Float32Array(N * 3), prev: new Float32Array(N * 3), next: new Float32Array(N * 3), side: new Float32Array(N), width: new Float32Array(N), cola: new Float32Array(N * 4), u: new Float32Array(N) };
    for (let i = 0; i < max; i++) { this.a.side[i * 2] = -1; this.a.side[i * 2 + 1] = 1; }
    const idx = []; for (let i = 0; i < max - 1; i++) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } g.setIndex(idx);
    for (const [k, s] of [['position', 3], ['prev', 3], ['next', 3], ['side', 1], ['width', 1], ['cola', 4], ['u', 1]]) g.setAttribute(k, new THREE.BufferAttribute(this.a[k], s).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ vertexShader: RB_V, fragmentShader: RB_F, uniforms: { aspect: { value: 1 }, time: U.gfxTime, flow: { value: o.flow || 0 }, soft: { value: o.soft || 1.5 } }, transparent: true, depthWrite: false, blending: o.normal ? THREE.NormalBlending : THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 14;
    this.mesh.onBeforeRender = r => { const s = r.getDrawingBufferSize(_v2); this.mat.uniforms.aspect.value = s.x / Math.max(1, s.y); };
    parent.add(this.mesh); this.parent = parent;
  }
  /** pts: Vector3[], w(t,i) width, c: [r,g,b] or fn(t,i)->[r,g,b], al(t,i) alpha */
  set(pts, w, c, al) {
    const n = Math.min(pts.length, this.max); const A = this.a;
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0; const p = pts[i], pv = pts[Math.max(0, i - 1)], nx = pts[Math.min(n - 1, i + 1)]; const ww = typeof w === 'function' ? w(t, i) : w; const cc = typeof c === 'function' ? c(t, i) : c; const aa = typeof al === 'function' ? al(t, i) : (al == null ? 1 : al);
      for (let s = 0; s < 2; s++) { const j = i * 2 + s; A.position[j * 3] = p.x; A.position[j * 3 + 1] = p.y; A.position[j * 3 + 2] = p.z; A.prev[j * 3] = pv.x; A.prev[j * 3 + 1] = pv.y; A.prev[j * 3 + 2] = pv.z; A.next[j * 3] = nx.x; A.next[j * 3 + 1] = nx.y; A.next[j * 3 + 2] = nx.z; A.width[j] = ww; A.cola[j * 4] = cc[0]; A.cola[j * 4 + 1] = cc[1]; A.cola[j * 4 + 2] = cc[2]; A.cola[j * 4 + 3] = aa; A.u[j] = t; }
    }
    this.geo.setDrawRange(0, Math.max(0, n - 1) * 6); for (const k in this.geo.attributes) this.geo.attributes[k].needsUpdate = true; this.mesh.visible = n > 1;
  }
  dispose() { this.parent.remove(this.mesh); this.geo.dispose(); this.mat.dispose(); }
}

/* flat ground ring / arc / disc shader */
const RING_F = `uniform vec3 color; uniform float radius; uniform float width; uniform float alpha; uniform float fill; uniform float arcDir; uniform float arcHalf; varying vec2 vUv;
void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p); float band = exp(-pow((r - radius) / max(width, 1e-3), 2.0));
  float inside = r < radius ? fill * pow(r / max(radius, 1e-3), 3.0) : 0.0; float a = (band + inside) * alpha * smoothstep(1.0, 0.95, r);
  if (arcHalf < 3.1) { float ang = atan(p.y, p.x); float da = abs(mod(ang - arcDir + 3.14159265, 6.2831853) - 3.14159265); a *= smoothstep(arcHalf, arcHalf - 0.2, da); }
  gl_FragColor = vec4(color, a); }`;
const FRES_V = 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
const FRES_F = 'uniform vec3 color; uniform float alpha; uniform float power; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), power); gl_FragColor = vec4(color, (f * 0.9 + 0.08) * alpha); }';

/* projectile flight profiles */
const PROJ = {
  arrow: { speed: 19, arc: 0.07, impact: 'impact', trail: [0.9, 0.9, 0.85], tw: 0.025 }, bolt: { speed: 23, arc: 0.035, impact: 'impact', trail: [0.9, 0.9, 0.85], tw: 0.03 },
  javelin: { speed: 13, arc: 0.13, impact: 'impact', trail: [0.9, 0.88, 0.8], tw: 0.035 }, rock: { speed: 10, arc: 0.24, impact: 'impact', spin: 9 }, sling: { speed: 17, arc: 0.08, impact: 'impact', tw: 0.02, trail: [0.8, 0.8, 0.78] },
  magic: { speed: 9, arc: 0.05, impact: 'magic', glow: true, light: 1.6, tw: 0.14 }, fire: { speed: 11, arc: 0.05, impact: 'fire', glow: true, light: 2.2, color: '#ff7a2a', tw: 0.16 },
  frost: { speed: 12, arc: 0.025, impact: 'frost', glow: true, light: 1.4, color: '#9fdcff', tw: 0.1 }, acid: { speed: 8.5, arc: 0.2, impact: 'acid', glow: true, light: 1.0, color: '#9be34a', tw: 0.1 },
  force: { speed: 10.5, arc: 0, impact: 'magic', glow: true, light: 1.2, color: '#9a7cff', tw: 0.13, curve: true }
};
const KIND_COLOR = { fire: '#ff7a2a', cold: '#9fdcff', frost: '#9fdcff', electricity: '#cfe0ff', lightning: '#cfe0ff', acid: '#9be34a', poison: '#a4d84a', sonic: '#e0c8ff', force: '#b49cff', void: '#7a4ab8', negative: '#7a4ab8', shadow: '#6a3aa8',
  vitality: '#ffe7a0', positive: '#ffe7a0', holy: '#ffe7a0', heal: '#a8ffb8', mental: '#ff8ad8', spirit: '#fff2c0', arcane: '#8fd0ff', magic: '#8fd0ff', gust: '#e8eef0', air: '#e8eef0' };

class Particles {
  constructor(scene, renderer, opts) {
    opts = opts || {}; this.scene = scene; this.renderer = renderer; this.time = 0; this.speed = 1;
    this.group = new THREE.Group(); this.group.name = 'gfxFX'; scene.add(this.group);
    this.alpha = new PointPool(opts.alphaMax || 1600, false, this.group); this.add = new PointPool(opts.addMax || 3200, true, this.group); this.streaks = new StreakPool(opts.streakMax || 900, this.group);
    this.tasks = []; this.emitters = []; this.ribbons = []; this.ringFree = [];
    { const ob = this.add.pts.onBeforeRender; this.add.pts.onBeforeRender = (r, s, cam, g, m, gr) => { this._camPos = cam.position; ob(r, s, cam, g, m, gr); }; }
    this.lights = []; for (let i = 0; i < (opts.lights != null ? opts.lights : 6); i++) { const l = new THREE.PointLight(0xffffff, 0, 6, 2); l.userData.free = true; this.group.add(l); this.lights.push(l); }
  }
  /* ---------- infrastructure ---------- */
  update(dt) {
    dt *= this.speed; this.time += dt;
    for (let i = this.emitters.length - 1; i >= 0; i--) { const e = this.emitters[i]; if (!e.alive) { this.emitters.splice(i, 1); continue; } e.acc += dt * e.rate; while (e.acc >= 1) { e.acc -= 1; e.spawn(e); } if (e.tick) e.tick(dt, e); }
    for (let i = this.tasks.length - 1; i >= 0; i--) { const t = this.tasks[i]; t.t += dt; const f = t.dur > 0 ? Math.min(1, t.t / t.dur) : 1; if (t.t >= 0) t.fn(f, dt, t); if (f >= 1 && t.t >= 0) { this.tasks.splice(i, 1); if (t.done) t.done(); if (t.res) t.res(); } }
    this.alpha.update(dt, this.time); this.add.update(dt, this.time); this.streaks.update(dt);
  }
  /** run fn(t01, dt) for dur seconds (after delay); returns Promise */
  task(dur, fn, delay, done) { return new Promise(res => this.tasks.push({ t: -(delay || 0), dur, fn: fn || (() => {}), res, done })); }
  wait(s) { return this.task(s); }
  light(color, intensity, distance, pos) {
    const l = this.lights.find(x => x.userData.free); if (!l) return null; l.userData.free = false; l.color.set(color); l.intensity = intensity; l.distance = distance || 6; if (pos) l.position.copy(pos); return l;
  }
  freeLight(l) { if (l) { l.intensity = 0; l.userData.free = true; } }
  /** lightFlash(pos, color, intensity=3, duration=0.35) -> Promise */
  lightFlash(pos, color, intensity = 3, duration = 0.35, distance) {
    const l = this.light(color || 0xffffff, intensity, distance || 7, toV(pos)); if (!l) return Promise.resolve();
    return this.task(duration, t => { l.intensity = intensity * Math.pow(1 - t, 1.6); }, 0, () => this.freeLight(l));
  }
  ribbon(max, o) { const r = new Ribbon(max, this.group, o); this.ribbons.push(r); return r; }
  _dropRibbon(r) { r.dispose(); const i = this.ribbons.indexOf(r); if (i >= 0) this.ribbons.splice(i, 1); }
  ringMesh(o) {
    const m = this.ringFree.pop() || new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: FS_V.replace('gl_Position = vec4(position.xy, 0.0, 1.0);', 'gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);'), fragmentShader: RING_F,
      uniforms: { color: { value: new THREE.Color() }, radius: { value: 0.5 }, width: { value: 0.05 }, alpha: { value: 1 }, fill: { value: 0 }, arcDir: { value: 0 }, arcHalf: { value: 4 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.rotation.set(-Math.PI / 2, 0, 0); m.renderOrder = 10; m.visible = true; const u = m.material.uniforms; u.arcHalf.value = 4; u.fill.value = 0; u.arcDir.value = 0;
    m.material.blending = o && o.normal ? THREE.NormalBlending : THREE.AdditiveBlending; this.group.add(m); return m;
  }
  _freeRing(m) { this.group.remove(m); this.ringFree.push(m); }
  clear() { this.alpha.n = 0; this.add.n = 0; this.streaks.n = 0; this.emitters.forEach(e => e.alive = false); this.tasks.length = 0; this.ribbons.slice().forEach(r => this._dropRibbon(r)); this.lights.forEach(l => this.freeLight(l)); }
  dispose() { this.clear(); this.scene.remove(this.group); }

  /* ---------- primitive spawners ---------- */
  _flash(p, color, size, life = 0.14, a = 1) { this.add.spawn({ p, c0: color, s0: size, s1: size * 1.3, life, a, frame: 3, fi: 0.0, fo: 0.1 }); }
  _sparks(p, n, color, o) {
    o = o || {}; const dir = o.dir ? o.dir.clone().normalize() : null;
    for (let i = 0; i < n; i++) { randDir(_tmp, o.up || 0.3); if (dir) _tmp.lerp(dir, o.focus || 0.5).normalize(); const sp = rr(o.min || 2.5, o.max || 6); this.streaks.spawn({ p, v: _tmp.clone().multiplyScalar(sp), life: rr(0.18, o.life || 0.5), len: o.len || 0.035, w: o.w || 0.022, c: color, g: o.g != null ? o.g : -9, drag: o.drag || 1.5, delay: o.delay || 0 }); }
  }
  _puffs(p, n, color, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = rr(0, o.r || 0.15); const sp = rr(o.min || 0.4, o.max || 1.2);
      const v = V3(Math.cos(a) * sp, rr(o.upMin || 0.1, o.up || 0.6), Math.sin(a) * sp);
      this.alpha.spawn({ p: V3(p.x + Math.cos(a) * r, p.y + rr(0, o.h || 0.1), p.z + Math.sin(a) * r), v, c0: color, c1: o.c1 || color, s0: rr(0.7, 1.1) * (o.s0 || 0.25), s1: rr(0.8, 1.2) * (o.s1 || 0.8), life: rr(0.7, 1.2) * (o.life || 0.9), a: o.a || 0.5, drag: o.drag || 3, g: o.g || 0.3, frame: 1, rotV: rr(-1, 1), fi: 0.05, fo: 0.3, delay: o.delay ? rr(0, o.delay) : 0, turb: o.turb || 0 });
    }
  }
  _motes(p, n, color, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      randDir(_tmp, o.up || 0); const sp = rr(o.min || 0.5, o.max || 2.5); const cc = Array.isArray(color[0]) ? color[Math.floor(Math.random() * color.length)] : color;
      const off = o.r ? randDir(V3(), 0).multiplyScalar(Math.random() * o.r) : _zero;
      this.add.spawn({ p: V3(p.x + off.x, p.y + off.y * (o.flat ? 0 : 1), p.z + off.z), v: _tmp.clone().multiplyScalar(sp).add(o.vel || _zero), c0: cc, c1: o.c1 || [cc[0] * 0.3, cc[1] * 0.3, cc[2] * 0.3], s0: rr(0.6, 1.2) * (o.s || 0.12), s1: o.s1 != null ? o.s1 : 0, life: rr(0.6, 1.1) * (o.life || 0.7), a: o.a || 1, drag: o.drag != null ? o.drag : 2.5, g: o.g || 0, frame: o.frame != null ? (Array.isArray(o.frame) ? o.frame[Math.floor(Math.random() * o.frame.length)] : o.frame) : 0, turb: o.turb || 0, rotV: o.rotV || 0, delay: o.delay ? rr(0, o.delay) : 0, fi: o.fi != null ? o.fi : 0.05, fo: o.fo != null ? o.fo : 0.4 });
    }
  }
  _flames(p, n, s, o) {
    o = o || {}; const hot = o.hot || [2.0, 1.05, 0.32], cool = o.cool || [0.6, 0.1, 0.02];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, r = Math.random() * (o.r || 0.1) * s; const v = o.v ? o.v.clone().add(randDir(_tmp2, 0).multiplyScalar(o.spread || 0.25)) : V3(rr(-0.15, 0.15) * s, rr(0.7, 1.3) * s * (o.rise || 1), rr(-0.15, 0.15) * s);
      this.add.spawn({ p: V3(p.x + Math.cos(a) * r, p.y + (o.dy || 0), p.z + Math.sin(a) * r), v, c0: hot, c1: cool, s0: rr(0.75, 1.2) * 0.42 * s * (o.size || 1), s1: 0.1 * s * (o.size || 1), life: rr(0.45, 0.8) * (o.life || 1), a: o.a || 0.85, drag: o.drag || 1.2, g: o.g != null ? o.g : 0.8 * s, frame: Math.random() < 0.6 ? 1 : 0, rotV: rr(-2, 2), turb: o.turb != null ? o.turb : 1.5 * s, fi: 0.12, fo: 0.35, delay: o.delay ? rr(0, o.delay) : 0 });
    }
  }

  /* ---------- bursts ---------- */
  /** burst(kind, pos, opts) -> Promise (resolves when the main flash is done, ~0.2s). kinds: spark impact magic heal dust smoke embers frost acid shadow holy crit death */
  burst(kind, pos, opts) {
    opts = opts || {}; const p = toV(pos); const col = opts.color != null ? C(opts.color) : null; const s = opts.scale || 1;
    switch (kind) {
      case 'spark': this._flash(p, [3, 2.6, 1.8], 0.55 * s, 0.1); this._sparks(p, Math.round(16 * s), [3.2, 2.2, 1.0], { dir: opts.dir, up: 0.4 }); this._puffs(p, 3, [0.55, 0.52, 0.48], { a: 0.25, s0: 0.12, s1: 0.4, life: 0.5 }); this.lightFlash(p, '#ffd9a0', 1.5 * s, 0.15, 4); break;
      case 'impact': case 'blood': this._flash(p, [2.2, 2.0, 1.7], 0.6 * s, 0.1, 0.8); this._puffs(V3(p.x, p.y - 0.2, p.z), Math.round(9 * s), [0.62, 0.56, 0.47], { a: 0.42, s0: 0.2 * s, s1: 0.7 * s, life: 0.8, min: 0.6, max: 1.6 }); this._sparks(p, Math.round(7 * s), [1.4, 1.2, 0.9], { dir: opts.dir, min: 1.5, max: 3.5, w: 0.03, len: 0.025 }); break;
      case 'crit': this._flash(p, [4, 3.2, 2], 1.4 * s, 0.16); this._sparks(p, Math.round(40 * s), [3.5, 2.4, 1.1], { dir: opts.dir, min: 3, max: 8, up: 0.5, w: 0.028 }); this._motes(p, 18, [[3, 2.4, 1.2], [3, 1.6, 0.6]], { frame: 2, s: 0.22, min: 1, max: 3.5 }); { const m = this.ringMesh(); m.position.copy(p); m.rotation.x = 0; m.lookAt(this._camPos ? this._camPos.clone() : V3(p.x, p.y + 10, p.z + 10)); const u = m.material.uniforms; u.color.value.setRGB(2.5, 2, 1.2); this.task(0.3, t => { m.scale.setScalar(0.2 + t * 1.2 * s); u.radius.value = 0.7; u.width.value = 0.08 * (1 - t) + 0.02; u.alpha.value = 1 - t; }).then(() => this._freeRing(m)); }
        this._puffs(V3(p.x, p.y - 0.3, p.z), 8, [0.6, 0.56, 0.5], { a: 0.35, s0: 0.25, s1: 0.9 }); this.lightFlash(p, '#ffe0b0', 4 * s, 0.3, 6); break;
      case 'magic': { const c = col || C(KIND_COLOR.magic); const hot = [c[0] * 3, c[1] * 3, c[2] * 3]; this._flash(p, hot, 0.9 * s, 0.14); this._motes(p, Math.round(28 * s), [hot, [c[0] * 2 + 0.5, c[1] * 2 + 0.5, c[2] * 2 + 0.5]], { frame: [0, 2, 3], s: 0.14 * s, min: 1, max: 3.2 * s, drag: 3.5 });
        this._sparks(p, Math.round(8 * s), hot, { min: 2, max: 4, g: -2, w: 0.02 }); this.lightFlash(p, new THREE.Color(c[0], c[1], c[2]), 2.5 * s, 0.35, 5); break; }
      case 'heal': { const g1 = [1.8, 1.6, 0.6], g2 = [0.7, 1.9, 0.9]; for (let i = 0; i < 46 * s; i++) { const a = Math.random() * 6.283, r = rr(0.1, 0.45) * s; this.add.spawn({ p: V3(p.x + Math.cos(a) * r, p.y + rr(0, 0.4), p.z + Math.sin(a) * r), v: V3(-Math.sin(a) * 0.4, rr(0.6, 1.4), Math.cos(a) * 0.4), c0: Math.random() < 0.5 ? g1 : g2, c1: [0.2, 0.5, 0.2], s0: rr(0.08, 0.18), s1: 0.02, life: rr(0.9, 1.6), frame: Math.random() < 0.4 ? 2 : 0, drag: 0.8, delay: rr(0, 0.4), fi: 0.15, fo: 0.5, turb: 0.6 }); }
        this.ring(V3(p.x, p.y - 0.45, p.z), 0.7 * s, new THREE.Color(1.2, 1.6, 0.7), { dur: 0.8, width: 0.12 }); this.lightFlash(p, '#c8ffb0', 2, 0.8, 5); break; }
      case 'dust': this._puffs(p, Math.round(8 * s), col || [0.58, 0.52, 0.43], { a: 0.35, s0: 0.15 * s, s1: 0.5 * s, life: 0.7, min: 0.5, max: 1.2, up: 0.25, g: 0.1 }); break;
      case 'smoke': this._puffs(p, Math.round(12 * s), col || [0.32, 0.31, 0.3], { a: 0.5, s0: 0.35 * s, s1: 1.3 * s, life: 2.2, min: 0.1, max: 0.5, up: 0.8, g: 0.25, drag: 1, delay: 0.4, turb: 0.4 }); break;
      case 'embers': this._motes(p, Math.round(26 * s), [[3, 1.4, 0.4], [2.6, 0.9, 0.2]], { frame: 3, s: 0.07, min: 0.3, max: 1.4, up: 0.8, g: 1.2, life: 1.6, turb: 3, drag: 1.2 }); break;
      case 'frost': { const c = col || [1.6, 2.2, 3]; this._flash(p, c, 0.8 * s, 0.12); this._motes(p, Math.round(30 * s), [c, [2.4, 2.6, 3]], { frame: [4, 2], s: 0.16, min: 1, max: 3, drag: 3, g: -1.5, rotV: 2 }); this._puffs(p, 8, [0.75, 0.85, 0.95], { a: 0.3, s0: 0.3, s1: 1.0, life: 1.2, g: -0.05 }); this.lightFlash(p, '#9fdcff', 2.2, 0.3, 5); break; }
      case 'acid': { const c = col || [0.7, 1.8, 0.3]; this._flash(p, c, 0.6 * s, 0.1); for (let i = 0; i < 26 * s; i++) { randDir(_tmp, 0.6); this.alpha.spawn({ p: p.clone(), v: _tmp.clone().multiplyScalar(rr(1, 2.8)), c0: [0.55, 0.95, 0.2], c1: [0.3, 0.5, 0.1], s0: rr(0.06, 0.12), s1: 0.04, life: rr(0.5, 0.9), a: 0.9, g: -7, drag: 0.6, frame: 6 }); }
        this._puffs(p, 7, [0.55, 0.7, 0.25], { a: 0.3, s0: 0.2, s1: 0.8, life: 1.3, delay: 0.3 }); this.lightFlash(p, '#9be34a', 1.5, 0.3, 4); break; }
      case 'shadow': case 'void': { for (let i = 0; i < 22 * s; i++) { randDir(_tmp, 0.3); this.alpha.spawn({ p: p.clone(), v: _tmp.clone().multiplyScalar(rr(0.5, 1.8)), c0: [0.08, 0.03, 0.12], c1: [0.02, 0.0, 0.04], s0: rr(0.3, 0.5), s1: rr(0.7, 1.1), life: rr(0.7, 1.2), a: 0.75, drag: 2.5, g: 0.4, frame: Math.random() < 0.5 ? 5 : 1, rotV: rr(-3, 3), turb: 1.5 }); }
        this._motes(p, 14, [[0.9, 0.4, 1.6], [0.5, 0.2, 1.2]], { frame: 3, s: 0.08, min: 0.6, max: 2 }); this.lightFlash(p, '#7a3ac8', 1.2, 0.4, 4); break; }
      case 'holy': { const c = col || [3, 2.6, 1.4]; this._flash(p, c, 1.3 * s, 0.2); this._motes(p, Math.round(30 * s), [c, [3, 3, 2.4]], { frame: 2, s: 0.22, min: 0.6, max: 2.6, drag: 2.5, rotV: 1 }); const b = this.ribbon(2, { soft: 1.2 }); const top = V3(p.x, p.y + 6, p.z), bot = V3(p.x, p.y - 0.6, p.z);
        this.task(0.6, t => b.set([bot, top], 0.7 * s * (1 - t * 0.7), [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8], Math.sin(t * Math.PI) * 0.9)).then(() => this._dropRibbon(b)); this.lightFlash(p, '#fff2c0', 3.5, 0.6, 7); break; }
      case 'death': { for (let i = 0; i < 14; i++) { const a = Math.random() * 6.283; this.add.spawn({ p: V3(p.x + Math.cos(a) * 0.2, p.y + rr(0, 0.5), p.z + Math.sin(a) * 0.2), v: V3(Math.cos(a) * 0.2, rr(0.5, 1.0), Math.sin(a) * 0.2), c0: [0.9, 1.4, 1.6], c1: [0.2, 0.3, 0.5], s0: rr(0.25, 0.4), s1: 0.5, life: rr(1.2, 2.0), a: 0.55, frame: 5, rotV: rr(-1.5, 1.5), turb: 1.2, drag: 0.5, delay: rr(0, 0.5), fi: 0.2, fo: 0.4 }); }
        this._puffs(V3(p.x, p.y - 0.5, p.z), 10, [0.5, 0.47, 0.42], { a: 0.4, s0: 0.3, s1: 1.0, min: 0.6, max: 1.4, up: 0.2, life: 1.0 }); break; }
      default: return this.burst('magic', p, Object.assign({ color: KIND_COLOR[kind] || opts.color }, opts));
    }
    return this.wait(0.2);
  }

  /* ---------- emitters ---------- */
  /** emitter(kind, pos, opts) -> {stop(), setPosition(v), setRate(k), position}. kinds: fire lavaSmoke embers mist sparkle aura
   *  opts: scale, rate multiplier, light (fire: default true), color, radius, size:[w,d] (area kinds), prewarm (default true) */
  emitter(kind, pos, opts) {
    opts = opts || {}; const fx = this; const s = opts.scale || 1;
    const e = { kind, position: toV(pos), rate: 10, acc: 0, alive: true, opts, light: null, area: opts.size ? [opts.size[0], opts.size[1]] : [(opts.radius || 0.5) * 2, (opts.radius || 0.5) * 2] };
    const inArea = () => V3(e.position.x + (Math.random() - 0.5) * e.area[0], e.position.y, e.position.z + (Math.random() - 0.5) * e.area[1]);
    const col = opts.color != null ? C(opts.color) : null;
    switch (kind) {
      case 'fire': {
        e.rate = 34 * s * (opts.rate || 1); const tint = col ? [col[0] * 2.6, col[1] * 2.6, col[2] * 2.6] : null;
        e.spawn = () => { fx._flames(e.position, 1, s, tint ? { hot: tint, cool: [tint[0] * 0.3, tint[1] * 0.1, tint[2] * 0.1] } : null); if (Math.random() < 0.09) fx.streaks.spawn({ p: e.position.clone(), v: V3(rr(-0.3, 0.3), rr(1, 2.2) * s, rr(-0.3, 0.3)), life: rr(0.6, 1.2), len: 0.03, w: 0.018 * s, c: [3, 1.3, 0.35], g: 0.4, drag: 0.8 }); if (Math.random() < 0.12) fx.alpha.spawn({ p: V3(e.position.x, e.position.y + 0.45 * s, e.position.z), v: V3(rr(-0.1, 0.1), rr(0.4, 0.7) * s, rr(-0.1, 0.1)), c0: [0.18, 0.16, 0.15], s0: 0.2 * s, s1: 0.75 * s, life: rr(1.4, 2.2), a: 0.28, frame: 1, rotV: rr(-1, 1), turb: 0.6, fi: 0.2 }); };
        if (opts.light !== false) { e.light = this.light(col ? new THREE.Color(col[0], col[1] * 0.8, col[2] * 0.6) : '#ff9a4a', 0, 4.5 + s * 2.5, V3(e.position.x, e.position.y + 0.4 * s, e.position.z)); }
        e.tick = (dt) => { if (e.light) { const t = fx.time; e.light.intensity = (opts.lightIntensity || 1.6) * s * (0.82 + 0.12 * Math.sin(t * 13.1 + e.position.x) + 0.08 * Math.sin(t * 23.7) + 0.06 * Math.sin(t * 7.3)); e.light.position.set(e.position.x, e.position.y + 0.45 * s, e.position.z); } };
        break; }
      case 'lavaSmoke': e.rate = 5 * (opts.rate || 1) * Math.max(1, e.area[0] * e.area[1] * 0.25); e.spawn = () => { const p = inArea(); fx.alpha.spawn({ p, v: V3(rr(-0.1, 0.1), rr(0.35, 0.7), rr(-0.1, 0.1)), c0: [0.5, 0.24, 0.12], c1: [0.14, 0.12, 0.12], s0: rr(0.5, 0.8), s1: rr(1.6, 2.4), life: rr(3, 5), a: 0.32, frame: 1, rotV: rr(-0.4, 0.4), turb: 0.35, fi: 0.15, fo: 0.4 }); }; break;
      case 'embers': e.rate = 7 * (opts.rate || 1) * Math.max(1, e.area[0] * e.area[1] * 0.25); e.spawn = () => { const p = inArea(); fx.add.spawn({ p, v: V3(rr(-0.2, 0.2), rr(0.4, 1.2), rr(-0.2, 0.2)), c0: [3.2, 1.3, 0.3], c1: [1.2, 0.2, 0.0], s0: rr(0.04, 0.09), s1: 0.02, life: rr(1.5, 3), frame: 3, turb: 2.2, drag: 0.4, g: 0.15, fi: 0.1, fo: 0.6 }); }; break;
      case 'mist': { e.rate = 1.1 * (opts.rate || 1) * Math.max(1, e.area[0] * e.area[1] * 0.5); const mc = col || [0.82, 0.86, 0.9];
        e.spawn = (ee, age) => { const p = inArea(); p.y += rr(0.1, 0.6); const life = rr(6, 9); const i = fx.alpha.spawn({ p, v: V3(rr(-0.08, 0.08), rr(-0.01, 0.02), rr(-0.08, 0.08)), c0: mc, c1: mc, s0: rr(1.6, 2.3), s1: rr(2.4, 3.2), life, a: opts.alpha || 0.16, frame: 1, rotV: rr(-0.15, 0.15), fi: 0.25, fo: 0.6, turb: 0.05 }); if (age && i >= 0) fx.alpha.d[i * STRIDE + 6] = age * life; };
        break; }
      case 'sparkle': { const c = col || [2.4, 2.2, 1.4]; e.rate = 9 * (opts.rate || 1); e.spawn = () => { const r = opts.radius || 0.5; randDir(_tmp, 0); fx.add.spawn({ p: V3(e.position.x + _tmp.x * r, e.position.y + rr(0, opts.height || 1.2), e.position.z + _tmp.z * r), v: V3(0, rr(0.05, 0.3), 0), c0: c, c1: [c[0] * 0.4, c[1] * 0.4, c[2] * 0.4], s0: rr(0.1, 0.22), s1: 0, life: rr(0.5, 1.0), frame: 2, rot: 0, fi: 0.3, fo: 0.5 }); }; break; }
      case 'aura': { const c = col ? [col[0] * 2.2, col[1] * 2.2, col[2] * 2.2] : [1.2, 1.8, 2.6]; const r = opts.radius || 0.55; e.rate = 22 * (opts.rate || 1);
        e.spawn = () => { const a = Math.random() * 6.283; fx.add.spawn({ p: V3(e.position.x + Math.cos(a) * r, e.position.y + rr(0, 0.15), e.position.z + Math.sin(a) * r), v: V3(-Math.sin(a) * 0.25, rr(0.35, 0.8), Math.cos(a) * 0.25), c0: c, c1: [c[0] * 0.2, c[1] * 0.2, c[2] * 0.2], s0: rr(0.07, 0.13), s1: 0.02, life: rr(0.8, 1.4), frame: Math.random() < 0.3 ? 2 : 0, fi: 0.2, fo: 0.5 }); };
        const m = this.ringMesh(); m.scale.setScalar(r * 1.25); const u = m.material.uniforms; u.color.value.setRGB(c[0] * 0.5, c[1] * 0.5, c[2] * 0.5); u.radius.value = 0.8; u.width.value = 0.07; u.fill.value = 0.35;
        e.ring = m; e.tick = () => { m.position.set(e.position.x, e.position.y + 0.03, e.position.z); u.alpha.value = e.stopping ? Math.max(0, u.alpha.value - 0.05) : 0.7 + 0.3 * Math.sin(fx.time * 3); };
        break; }
      default: e.rate = 10; e.spawn = () => fx._motes(e.position, 1, col || [2, 2, 2], { s: 0.1 });
    }
    // prewarm: simulate history so continuous effects are already 'running'
    if (opts.prewarm !== false) { const n = Math.min(400, Math.round(e.rate * (kind === 'mist' ? 7 : kind === 'lavaSmoke' ? 3 : 0.8))); for (let i = 0; i < n; i++) { if (kind === 'mist') e.spawn(e, Math.random()); else { const before = [this.add.n, this.alpha.n]; e.spawn(e); const age = Math.random() * 0.9; for (const [pool, b] of [[this.add, before[0]], [this.alpha, before[1]]]) for (let j = b; j < pool.n; j++) { const k = j * STRIDE; const adv = age * pool.d[k + 7]; pool.d[k + 6] = adv; pool.d[k] += pool.d[k + 3] * adv; pool.d[k + 1] += pool.d[k + 4] * adv * 0.7; pool.d[k + 2] += pool.d[k + 5] * adv; } } } }
    this.emitters.push(e);
    return {
      position: e.position, kind,
      stop: () => { e.alive = false; e.stopping = true; if (e.light) { const l = e.light; e.light = null; this.task(0.4, t => { l.intensity *= 0.85; }, 0, () => this.freeLight(l)); } if (e.ring) { const m = e.ring; this.task(0.4, t => { m.material.uniforms.alpha.value *= 0.85; }, 0, () => this._freeRing(m)); } },
      setPosition: v => { e.position.copy(toV(v)); }, setRate: k => { e.rate *= k; }
    };
  }

  /* ---------- projectiles ---------- */
  _projMesh(kind, color) {
    const g = new THREE.Group(); const metal = Materials.std('#b8bcc4', { metalness: 0.8, roughness: 0.35 }); const wood = Materials.std('#7a5634', { roughness: 0.7 }); const glowC = new THREE.Color(color);
    const shaft = (len, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 5), wood); m.rotation.x = Math.PI / 2; return m; };
    if (kind === 'arrow' || kind === 'bolt' || kind === 'javelin') {
      const L = kind === 'arrow' ? 0.62 : kind === 'bolt' ? 0.4 : 1.15, R = kind === 'javelin' ? 0.018 : kind === 'bolt' ? 0.016 : 0.011; g.add(shaft(L, R));
      const head = new THREE.Mesh(new THREE.ConeGeometry(R * 3, L * 0.14, 4), metal); head.rotation.x = Math.PI / 2; head.position.z = L / 2 + L * 0.06; g.add(head);
      if (kind !== 'javelin') { const fm = Materials.std(kind === 'bolt' ? '#3a3330' : '#e8e2d4', { side: THREE.DoubleSide }); for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.035, L * 0.18), fm); f.rotation.set(Math.PI / 2, 0, i * Math.PI * 2 / 3); f.position.z = -L / 2 + L * 0.1; const h = new THREE.Group(); h.add(f); h.rotation.z = i * Math.PI * 2 / 3; f.position.x = 0.018; f.rotation.set(Math.PI / 2, 0, 0); g.add(h); } }
    } else if (kind === 'rock') { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), Materials.terrain('rock', { triplanar: 2 })); g.add(m); }
    else if (kind === 'sling') { g.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), Materials.std('#8a8378'))); }
    else if (kind === 'frost') { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: glowC.clone().multiplyScalar(2.5) })); m.scale.set(0.8, 0.8, 3.2); g.add(m); }
    else if (kind === 'force') { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: glowC.clone().multiplyScalar(1.8) })); m.scale.set(1, 1, 3.5); g.add(m); }
    else { g.add(new THREE.Mesh(new THREE.SphereGeometry(kind === 'acid' ? 0.075 : 0.065, 12, 8), new THREE.MeshBasicMaterial({ color: glowC.clone().multiplyScalar(kind === 'acid' ? 1.6 : 3.2) }))); }
    g.traverse(o => { if (o.isMesh) o.castShadow = kind === 'rock' || kind === 'javelin'; });
    return g;
  }
  /** projectile(kind, from, to, opts) -> Promise resolved on arrival. kinds: arrow bolt javelin rock sling magic fire frost acid force
   *  opts: color, count (force), impact (false = no burst), speed, arc, delay */
  projectile(kind, from, to, opts) {
    opts = opts || {}; const P = PROJ[kind] || PROJ.magic; const a = toV(from), b = toV(to);
    const count = kind === 'force' ? (opts.count || 3) : (opts.count || 1);
    if (count > 1) { const all = []; for (let i = 0; i < count; i++) all.push(this.projectile(kind, a, b.clone().add(V3(rr(-0.12, 0.12), rr(-0.1, 0.15), rr(-0.12, 0.12))), Object.assign({}, opts, { count: 1, delay: (opts.delay || 0) + i * 0.13, seedSide: i - (count - 1) / 2 }))); return all[0].then(() => Promise.all(all)).then(() => {}); }
    const color = opts.color || P.color || KIND_COLOR[kind] || '#8fd0ff'; const cc = C(color);
    const dist = a.distanceTo(b); const dur = Math.max(0.12, dist / (opts.speed || P.speed)); const arc = (opts.arc != null ? opts.arc : P.arc) * dist;
    // path: quadratic arc, or lateral curve for force darts
    let side = V3(0, 0, 0); if (P.curve) { const d = b.clone().sub(a); side = V3(-d.z, 0, d.x).normalize().multiplyScalar(dist * 0.22 * ((opts.seedSide != null ? opts.seedSide : rsign()) + rr(-0.4, 0.4))); side.y = dist * rr(0.08, 0.2); }
    const at = (t, out) => { out.lerpVectors(a, b, t); out.y += arc * 4 * t * (1 - t); if (P.curve) out.addScaledVector(side, Math.sin(t * Math.PI) * (1 - t * 0.3)); if (kind === 'magic') { out.y += Math.sin(t * 18) * 0.03; } return out; };
    const mesh = this._projMesh(kind, color); this.group.add(mesh); mesh.visible = false;
    const trail = P.tw ? this.ribbon(20, { soft: P.glow ? 1.2 : 2 }) : null; const hist = [];
    const L = P.light ? this.light(color, 0, 4) : null;
    const cur = V3(), nxt = V3(); let last = 0;
    return this.task(dur, (t, dt) => {
      mesh.visible = true; at(t, cur); at(Math.min(1, t + 0.02), nxt); mesh.position.copy(cur); if (nxt.distanceToSquared(cur) > 1e-8) mesh.lookAt(nxt);
      if (P.spin) mesh.rotateX(this.time * P.spin);
      hist.push(cur.clone()); if (hist.length > 14) hist.shift();
      if (trail) { const tc = P.glow ? [cc[0] * 1.5, cc[1] * 1.5, cc[2] * 1.5] : P.trail; trail.set(hist, (u) => P.tw * (0.15 + u * 0.85), tc, u => u * u * (P.glow ? 0.9 : 0.35)); }
      if (L) { L.position.copy(cur); L.intensity = P.light * Math.min(1, t * 6); }
      if (P.glow) {
        const n = Math.max(1, Math.round((t - last) * dur * 60)); last = t;
        if (kind === 'fire') this._flames(cur, 2, 0.55, { v: V3(0, 0.3, 0), r: 0.05, life: 0.7, size: 0.9 });
        else if (kind === 'acid') { if (Math.random() < 0.4) this.alpha.spawn({ p: cur.clone(), v: V3(0, -0.5, 0), c0: [0.5, 0.9, 0.2], s0: 0.05, s1: 0.03, life: 0.5, g: -6, frame: 6, a: 0.9 }); this.add.spawn({ p: cur.clone(), c0: [cc[0], cc[1], cc[2]], s0: 0.2, s1: 0.05, life: 0.25, frame: 0, a: 0.6 }); }
        else { for (let i = 0; i < n; i++) this.add.spawn({ p: cur.clone().add(randDir(_tmp, 0).multiplyScalar(0.03)), v: randDir(_tmp2, 0).multiplyScalar(0.25), c0: [cc[0] * 2, cc[1] * 2, cc[2] * 2], c1: [cc[0] * 0.3, cc[1] * 0.3, cc[2] * 0.3], s0: kind === 'force' ? 0.12 : 0.2, s1: 0.0, life: 0.35, frame: kind === 'frost' ? 4 : 0, a: 0.8 }); }
        this.add.spawn({ p: cur.clone(), c0: [cc[0] * 2.5, cc[1] * 2.5, cc[2] * 2.5], s0: kind === 'force' ? 0.3 : 0.5, s1: 0.4, life: 0.03, frame: 3, a: 0.9, fi: 0, fo: 0 });
      }
    }, opts.delay || 0, () => {
      this.group.remove(mesh); if (L) this.freeLight(L);
      if (trail) { const h = hist.slice(); this.task(0.18, t => trail.set(h, u => P.tw * (0.15 + u * 0.85) * (1 - t), P.glow ? [cc[0] * 2, cc[1] * 2, cc[2] * 2] : P.trail, u => u * u * (1 - t) * (P.glow ? 0.9 : 0.35))).then(() => this._dropRibbon(trail)); }
      if (opts.impact !== false) { const dir = b.clone().sub(a).normalize().negate(); if (P.impact === 'fire') this.explosion(b, 0.45, 'fire', { small: true }); else this.burst(P.impact, b, { color: P.glow ? color : undefined, dir, scale: kind === 'force' ? 0.6 : kind === 'arrow' || kind === 'bolt' ? 0.7 : 1 }); }
    });
  }

  /* ---------- lightning / beams ---------- */
  _jag(a, b, segs, amp) {
    const pts = [a.clone()]; const d = b.clone().sub(a); const L = d.length(); const n1 = V3(-d.z, 0, d.x).normalize(); if (n1.lengthSq() < 0.1) n1.set(1, 0, 0); const n2 = d.clone().cross(n1).normalize();
    let o1 = 0, o2 = 0;
    for (let i = 1; i < segs; i++) { const t = i / segs; o1 = o1 * 0.4 + rr(-1, 1) * amp * L * 0.12; o2 = o2 * 0.4 + rr(-1, 1) * amp * L * 0.12; const env = Math.sin(t * Math.PI); pts.push(a.clone().addScaledVector(d, t).addScaledVector(n1, o1 * env).addScaledVector(n2, o2 * env)); }
    pts.push(b.clone()); return pts;
  }
  /** bolt(from, to, opts) -> Promise: flickering jagged lightning. opts: color, width(0.07), duration(0.45), branches(2), strikes */
  bolt(from, to, opts) {
    opts = opts || {}; const a = toV(from), b = toV(to); const c = C(opts.color || '#bcd4ff'); const w = opts.width || 0.07; const dur = opts.duration || 0.45;
    const L = a.distanceTo(b); const segs = Math.max(6, Math.min(40, Math.round(L * 5)));
    const glow = this.ribbon(segs + 1, { soft: 1.6 }), core = this.ribbon(segs + 1, { soft: 0.7 }); const br = []; for (let i = 0; i < (opts.branches != null ? opts.branches : 2); i++) br.push([this.ribbon(10, { soft: 1.2 }), null]);
    const light = this.light(new THREE.Color(c[0], c[1], c[2]), 0, 9, a.clone().lerp(b, 0.5).add(V3(0, 0.4, 0)));
    let next = 0; let pts = null;
    this._flash(b, [c[0] * 3, c[1] * 3, c[2] * 3], 0.9, 0.2); this._sparks(b, 14, [2.4, 2.6, 3.2], { up: 0.5, min: 2, max: 5 });
    return this.task(dur, (t) => {
      if (this.time >= next) {
        next = this.time + (opts.flicker || 0.045); pts = this._jag(a, b, segs, 1);
        br.forEach(x => { const i = 2 + Math.floor(Math.random() * (pts.length - 4)); const s = pts[i]; const dir = b.clone().sub(a).normalize().add(randDir(_tmp, 0).multiplyScalar(0.9)).normalize(); x[1] = this._jag(s, s.clone().addScaledVector(dir, L * rr(0.12, 0.3)), 8, 1.4); });
        if (Math.random() < 0.3) this._sparks(b, 4, [2.4, 2.6, 3.2], { min: 1, max: 4 });
      }
      const fl = (0.65 + Math.random() * 0.35) * (t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25);
      glow.set(pts, w * 7, [c[0] * 0.9, c[1] * 1.0, c[2] * 1.5], 0.6 * fl); core.set(pts, w * 1.4, [1.6 + c[0], 1.7 + c[1], 2.0 + c[2]], fl);
      br.forEach(x => x[0].set(x[1], tt => w * 0.6 * (1 - tt), [c[0] * 2, c[1] * 2, c[2] * 2.4], fl * 0.8));
      if (light) light.intensity = 4 * fl;
    }, opts.delay || 0, () => { this._dropRibbon(glow); this._dropRibbon(core); br.forEach(x => this._dropRibbon(x[0])); this.freeLight(light); });
  }
  /** beam(from, to, opts) -> Promise: sustained ray (grows, flows, fades). opts: color, width(0.14), duration(0.7) */
  beam(from, to, opts) {
    opts = opts || {}; const a = toV(from), b = toV(to); const c = C(opts.color || '#8fd0ff'); const w = opts.width || 0.14; const dur = opts.duration || 0.7;
    const outer = this.ribbon(24, { soft: 1.4, flow: 18 }), inner = this.ribbon(24, { soft: 0.8, flow: 30 }); const light = this.light(new THREE.Color(c[0], c[1], c[2]), 0, 6, b.clone());
    const pts = []; for (let i = 0; i < 24; i++) pts.push(V3());
    return this.task(dur, (t) => {
      const grow = Math.min(1, t / 0.15), fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1; const end = a.clone().lerp(b, grow);
      for (let i = 0; i < 24; i++) { const u = i / 23; pts[i].lerpVectors(a, end, u); pts[i].y += Math.sin(u * 20 + this.time * 30) * 0.008 * (1 - u); }
      const pulse = 0.85 + 0.15 * Math.sin(this.time * 40);
      outer.set(pts, u => w * 3 * (0.6 + 0.4 * Math.sin(u * 30 - this.time * 25)) * pulse * fade, [c[0] * 1.5, c[1] * 1.5, c[2] * 1.5], 0.55 * fade);
      inner.set(pts, w * fade, [c[0] * 2 + 1.5, c[1] * 2 + 1.5, c[2] * 2 + 1.5], fade);
      if (grow >= 1) { if (Math.random() < 0.6) this._motes(b, 2, [c[0] * 2.5, c[1] * 2.5, c[2] * 2.5], { s: 0.12, min: 0.8, max: 2.2, frame: 3 }); this.add.spawn({ p: b.clone(), c0: [c[0] * 2.5, c[1] * 2.5, c[2] * 2.5], s0: 0.7 * fade, s1: 0.7 * fade, life: 0.03, frame: 3, fi: 0, fo: 0 }); }
      this.add.spawn({ p: a.clone(), c0: [c[0] * 2, c[1] * 2, c[2] * 2], s0: 0.4 * fade, s1: 0.4, life: 0.03, frame: 3, fi: 0, fo: 0 });
      if (light) { light.position.copy(end); light.intensity = 2.5 * fade * pulse; }
    }, opts.delay || 0, () => { this._dropRibbon(outer); this._dropRibbon(inner); this.freeLight(light); });
  }

  /* ---------- area spells ---------- */
  /** cone(origin, dir, length, halfAngle(rad), kind) -> Promise. kinds: fire cold acid electricity poison sonic (others tinted magic) */
  cone(origin, dir, length, halfAngle, kind, opts) {
    opts = opts || {}; const o = toV(origin); const d = toV(dir).normalize(); const ha = halfAngle || 0.5; const len = length || 3; const dur = opts.duration || 0.55;
    const flat = V3(d.x, 0, d.z).normalize(); const yaw = Math.atan2(flat.z, flat.x); const lc = C(KIND_COLOR[kind] || '#8fd0ff');
    const coneDir = () => { const a = yaw + rr(-ha, ha) * Math.sqrt(Math.random()); const el = rr(-ha, ha) * 0.4; return V3(Math.cos(a) * Math.cos(el), Math.sin(el) + d.y, Math.sin(a) * Math.cos(el)).normalize(); };
    const light = this.light(new THREE.Color(lc[0], lc[1], lc[2]), 0, len * 1.6, o.clone().addScaledVector(d, len * 0.5));
    const tick = (t, dt) => {
      const n = Math.ceil(dt * (kind === 'fire' ? 170 : 260));
      for (let i = 0; i < n; i++) {
        const v = coneDir(); const sp = rr(0.75, 1.0) * len / 0.55; const life = 0.55;
        if (kind === 'fire') { this.add.spawn({ p: o.clone().addScaledVector(v, rr(0, 0.25) * len), v: v.multiplyScalar(sp * 0.8), c0: [1.5, 0.62, 0.15], c1: [0.45, 0.06, 0.0], s0: 0.2, s1: rr(0.6, 1.0) * len * 0.26, life, a: 0.5, drag: 0.3, g: 1.0, frame: 1, rotV: rr(-3, 3), fi: 0.05, fo: 0.6 }); if (Math.random() < 0.08) this.alpha.spawn({ p: o.clone().addScaledVector(v, 0.3), v: v.clone().multiplyScalar(sp * 0.6).add(V3(0, 0.6, 0)), c0: [0.2, 0.18, 0.17], s0: 0.3, s1: 1.4, life: 1.4, a: 0.3, frame: 1, drag: 1.2, g: 0.3, delay: 0.25 }); if (Math.random() < 0.1) this.streaks.spawn({ p: o.clone(), v: v.clone().multiplyScalar(sp * 1.1), life: 0.6, len: 0.03, w: 0.02, c: [3, 1.4, 0.4], g: -2 }); }
        else if (kind === 'cold') { this.add.spawn({ p: o.clone(), v: v.clone().multiplyScalar(sp), c0: [1.8, 2.3, 3], c1: [0.4, 0.6, 1], s0: 0.1, s1: rr(0.15, 0.3), life, a: 0.9, drag: 0.8, frame: Math.random() < 0.5 ? 4 : 2, rotV: rr(-4, 4) }); if (Math.random() < 0.25) this.alpha.spawn({ p: o.clone(), v: v.multiplyScalar(sp * 0.8), c0: [0.8, 0.88, 0.95], s0: 0.2, s1: len * 0.3, life: 0.9, a: 0.25, frame: 1, drag: 1.5 }); }
        else if (kind === 'acid') { this.alpha.spawn({ p: o.clone(), v: v.clone().multiplyScalar(sp * 0.9).add(V3(0, 1.2, 0)), c0: [0.55, 0.95, 0.2], c1: [0.3, 0.55, 0.1], s0: rr(0.06, 0.12), s1: 0.05, life: 0.6, a: 0.9, g: -6, frame: 6 }); if (Math.random() < 0.3) this.add.spawn({ p: o.clone(), v: v.multiplyScalar(sp * 0.8), c0: [0.6, 1.6, 0.3], s0: 0.2, s1: 0.6, life: 0.5, a: 0.35, frame: 1, drag: 1 }); }
        else if (kind === 'poison') { if (Math.random() < 0.5) this.alpha.spawn({ p: o.clone(), v: v.multiplyScalar(sp * 0.55), c0: [0.55, 0.72, 0.22], c1: [0.4, 0.5, 0.25], s0: 0.3, s1: rr(0.8, 1.3) * len * 0.3, life: 1.1, a: 0.38, drag: 1.4, frame: 1, rotV: rr(-1, 1), turb: 0.8, fo: 0.5 }); }
        else if (kind === 'electricity') { if (Math.random() < 0.5) this.streaks.spawn({ p: o.clone(), v: v.multiplyScalar(sp * 1.2), life: 0.35, len: 0.05, w: 0.025, c: [2.4, 2.6, 3.2], g: 0, cool: 0.3 }); }
        else if (kind === 'sonic') { /* rings below */ }
        else { this.add.spawn({ p: o.clone(), v: v.multiplyScalar(sp), c0: [lc[0] * 2.5, lc[1] * 2.5, lc[2] * 2.5], c1: [lc[0] * 0.3, lc[1] * 0.3, lc[2] * 0.3], s0: 0.12, s1: 0.4, life, frame: Math.random() < 0.5 ? 0 : 2, drag: 0.8 }); }
      }
      if (light) light.intensity = 3 * Math.sin(t * Math.PI);
    };
    const jobs = [this.task(dur, tick, 0, () => this.freeLight(light))];
    if (kind === 'electricity') for (let i = 0; i < 6; i++) { const v = coneDir(); jobs.push(this.bolt(o, o.clone().addScaledVector(v, len * rr(0.6, 1)), { width: 0.04, duration: 0.25, branches: 1, delay: i * 0.07, color: '#cfe0ff' })); }
    if (kind === 'sonic') for (let i = 0; i < 4; i++) { const m = this.ringMesh(); const u = m.material.uniforms; u.color.value.setRGB(1.6, 1.3, 2.2); u.arcHalf.value = ha; u.arcDir.value = -yaw; m.position.set(o.x, o.y - 0.2, o.z); u.fill.value = 0.1;
      jobs.push(this.task(0.55, t => { m.scale.setScalar(Math.max(0.05, t * len)); u.radius.value = 0.85; u.width.value = 0.06; u.alpha.value = (1 - t) * 0.9; }, i * 0.1, () => this._freeRing(m))); }
    return Promise.all(jobs).then(() => {});
  }
  /** line(from, to, width, kind) -> Promise. kinds: electricity/lightning, fire, cold, acid, gust/air, force, poison, void, ... */
  line(from, to, width, kind, opts) {
    opts = opts || {}; const a = toV(from), b = toV(to); width = width || 0.5; const L = a.distanceTo(b); const d = b.clone().sub(a).normalize(); const lc = C(KIND_COLOR[kind] || '#8fd0ff');
    if (kind === 'electricity' || kind === 'lightning') { const jobs = [this.bolt(a, b, { width: 0.09 * Math.max(1, width), duration: 0.55, branches: 4 })]; for (let i = 0; i < 12; i++) { const p = a.clone().lerp(b, Math.random()); jobs.push(this.wait(rr(0, 0.3)).then(() => this._sparks(p, 3, [2.4, 2.6, 3.2], { min: 1, max: 3 }))); } return Promise.all(jobs).then(() => {}); }
    const dur = 0.5;
    return this.task(dur, (t, dt) => {
      const n = Math.ceil(dt * 200 * Math.max(1, L / 4));
      for (let i = 0; i < n; i++) {
        const u = Math.min(1, Math.random() * (t * 1.6)); const p = a.clone().lerp(b, u).add(V3(rr(-0.5, 0.5) * width, rr(-0.2, 0.3), rr(-0.5, 0.5) * width));
        if (kind === 'fire') this._flames(p, 1, 0.8, { life: 0.9 });
        else if (kind === 'gust' || kind === 'air') { this.streaks.spawn({ p, v: d.clone().multiplyScalar(rr(6, 10)), life: rr(0.25, 0.45), len: 0.06, w: 0.02, c: [0.5, 0.55, 0.55], g: 0, cool: 0 }); if (Math.random() < 0.15) this._puffs(V3(p.x, p.y - 0.3, p.z), 1, [0.6, 0.55, 0.48], { a: 0.25, min: 1, max: 2.5, s0: 0.2, s1: 0.7 }); }
        else if (kind === 'cold') this.add.spawn({ p, v: V3(rr(-0.3, 0.3), rr(0, 0.6), rr(-0.3, 0.3)), c0: [1.8, 2.3, 3], s0: 0.15, s1: 0.05, life: 0.8, frame: 4, rotV: 3 });
        else if (kind === 'poison') this.alpha.spawn({ p, v: V3(rr(-0.2, 0.2), rr(0.1, 0.4), rr(-0.2, 0.2)), c0: [0.55, 0.72, 0.22], s0: 0.3, s1: 0.9, life: 1.2, a: 0.32, frame: 1 });
        else this.add.spawn({ p, v: V3(rr(-0.3, 0.3), rr(0.2, 0.8), rr(-0.3, 0.3)), c0: [lc[0] * 2.5, lc[1] * 2.5, lc[2] * 2.5], c1: [lc[0] * 0.3, lc[1] * 0.3, lc[2] * 0.3], s0: 0.16, s1: 0.02, life: 0.7, frame: Math.random() < 0.5 ? 2 : 0 });
      }
    });
  }
  /** explosion(pos, radius, kind) -> Promise (resolves when the blast has fully expanded, ~0.45s). kinds: fire cold electricity acid poison sonic force void holy mental magic */
  explosion(pos, radius, kind, opts) {
    opts = opts || {}; const p = toV(pos); const R = radius || 2; kind = kind || 'fire'; const small = opts.small; const lc = C(KIND_COLOR[kind] || '#8fd0ff'); const hot = kind === 'fire' ? [3.2, 2.2, 1.1] : [lc[0] * 3, lc[1] * 3, lc[2] * 3];
    const k = small ? 0.35 : 1; const ground = V3(p.x, (opts.groundY != null ? opts.groundY : p.y - (small ? 0 : 0.5)), p.z);
    // core flash + light
    this._flash(p, kind === 'fire' ? [2.2, 1.5, 0.7] : hot, R * (kind === 'fire' ? 1.1 : 1.4), 0.15, 0.7); this.lightFlash(p, new THREE.Color(Math.min(1, lc[0] * 1.2), Math.min(1, lc[1] * 1.1), lc[2]), small ? 3 : 9, small ? 0.35 : 0.9, R * 4 + 3);
    if (kind === 'fire') {
      for (let i = 0; i < 110 * k; i++) { randDir(_tmp, 0.35); const sp = rr(0.45, 1) * R * 3.0; this.add.spawn({ p: p.clone().addScaledVector(_tmp, rr(0.05, 0.3) * R), v: _tmp.clone().multiplyScalar(sp), c0: [1.5, 0.62, 0.16], c1: [0.32, 0.04, 0.0], s0: R * rr(0.3, 0.5), s1: R * rr(0.6, 0.9), life: rr(0.5, 0.9), a: 0.5, drag: 4.5, g: 1.5, frame: 1, rotV: rr(-2, 2), fi: 0.04, fo: 0.25 }); }
      for (let i = 0; i < 26 * k; i++) { randDir(_tmp, 0.2); this.add.spawn({ p: p.clone(), v: _tmp.clone().multiplyScalar(rr(0.5, 1) * R * 2.2), c0: [2.2, 1.5, 0.6], c1: [0.8, 0.2, 0.02], s0: R * 0.35, s1: R * 0.2, life: rr(0.2, 0.35), a: 0.6, drag: 5, frame: 1, rotV: rr(-2, 2), fi: 0, fo: 0.2 }); }
      this._puffs(p, Math.round(40 * k), [0.13, 0.11, 0.1], { r: R * 0.5, a: 0.6, s0: R * 0.35, s1: R * 1.05, life: 2.6, min: 0.6 * R, max: 1.6 * R, up: 1.4, g: 0.35, drag: 1.8, delay: 0.12, turb: 0.5, c1: [0.3, 0.29, 0.28] });
      this._sparks(p, Math.round(50 * k), [3.2, 1.6, 0.4], { up: 0.6, min: R * 2, max: R * 5, life: 1.0, w: 0.025, g: -6, drag: 0.6 });
      if (!small) this.scorch(ground, R * 0.9);
    } else if (kind === 'cold') { this._motes(p, 120 * k, [[1.8, 2.3, 3], [2.6, 2.8, 3]], { frame: [4, 2], s: 0.22, min: R, max: R * 3.5, drag: 3, rotV: 3, g: -1, life: 0.9 }); this._puffs(p, 30 * k, [0.8, 0.88, 0.95], { r: R * 0.4, a: 0.35, s0: R * 0.3, s1: R * 0.9, life: 1.6, min: R * 0.6, max: R * 1.6, g: -0.05 }); }
    else if (kind === 'electricity') { for (let i = 0; i < 7 * k + 1; i++) this.bolt(p, p.clone().add(randDir(V3(), 0.3).multiplyScalar(R * rr(0.7, 1.1))), { width: 0.05, duration: 0.3, branches: 1, delay: i * 0.04 }); this._sparks(p, 50 * k, [2.4, 2.6, 3.2], { up: 0.5, min: R, max: R * 4 }); }
    else if (kind === 'acid' || kind === 'poison') { const c0 = kind === 'acid' ? [0.55, 0.95, 0.2] : [0.55, 0.72, 0.22]; this._puffs(p, 45 * k, c0, { r: R * 0.4, a: kind === 'acid' ? 0.45 : 0.5, s0: R * 0.35, s1: R * 1.1, life: 1.8, min: R * 0.8, max: R * 2, g: 0.1, turb: 0.8, c1: [0.35, 0.45, 0.2] }); if (kind === 'acid') for (let i = 0; i < 60 * k; i++) { randDir(_tmp, 0.7); this.alpha.spawn({ p: p.clone(), v: _tmp.clone().multiplyScalar(rr(1.5, 4) * R * 0.6), c0: [0.6, 1.0, 0.25], s0: 0.1, s1: 0.05, life: rr(0.5, 0.9), g: -7, frame: 6, a: 0.95 }); } }
    else if (kind === 'void' || kind === 'negative' || kind === 'shadow') { for (let i = 0; i < 60 * k; i++) { randDir(_tmp, 0.2); this.alpha.spawn({ p: p.clone().addScaledVector(_tmp, R * 0.2), v: _tmp.clone().multiplyScalar(rr(1, 3) * R * 0.7), c0: [0.07, 0.02, 0.1], c1: [0.02, 0, 0.03], s0: R * 0.3, s1: R * 0.7, life: rr(0.8, 1.3), a: 0.7, drag: 3, frame: Math.random() < 0.5 ? 5 : 1, rotV: rr(-2, 2), turb: 1.5 }); } this._motes(p, 40 * k, [[0.9, 0.4, 1.8], [0.6, 0.2, 1.3]], { frame: 3, s: 0.1, min: R, max: R * 3 }); }
    else { this._motes(p, 110 * k, [hot, [hot[0] * 0.8 + 0.6, hot[1] * 0.8 + 0.6, hot[2] * 0.8 + 0.6]], { frame: [0, 2, 3], s: 0.2, min: R, max: R * 3.6, drag: 3.2, life: 0.9, rotV: 1 }); if (kind === 'holy' || kind === 'vitality' || kind === 'positive') this.burst('holy', p); }
    // shockwave ring on the ground + vertical flash disc
    const jobs = [];
    if (!small || kind === 'sonic') {
      const m = this.ringMesh(); const u = m.material.uniforms; u.color.value.setRGB(hot[0] * 0.6, hot[1] * 0.6, hot[2] * 0.6); m.position.set(ground.x, ground.y + 0.05, ground.z); u.fill.value = 0.25;
      jobs.push(this.task(kind === 'sonic' ? 0.6 : 0.5, t => { const e = 1 - Math.pow(1 - t, 3); m.scale.setScalar(Math.max(0.05, R * 1.15 * e)); u.radius.value = 0.85; u.width.value = 0.07 + 0.08 * (1 - t); u.alpha.value = (1 - t) * 1.1; }, 0, () => this._freeRing(m)));
      if (kind === 'sonic') for (let i = 1; i < 3; i++) { const m2 = this.ringMesh(); const u2 = m2.material.uniforms; u2.color.value.setRGB(1.5, 1.2, 2.2); m2.position.copy(m.position).y += 0.3 * i; jobs.push(this.task(0.6, t => { m2.scale.setScalar(Math.max(0.05, R * t)); u2.radius.value = 0.85; u2.width.value = 0.05; u2.alpha.value = 1 - t; }, i * 0.1, () => this._freeRing(m2))); }
    }
    return this.wait(small ? 0.15 : 0.45);
  }
  /** ring(pos, radius, color, opts) -> Promise: emanation pulse expanding to radius. opts: dur, width, motes(true) */
  ring(pos, radius, color, opts) {
    opts = opts || {}; const p = toV(pos); const c = C(color || '#8fd0ff'); const m = this.ringMesh(); const u = m.material.uniforms; const k = c[0] + c[1] + c[2] > 3.5 ? 1 : 2.2;
    u.color.value.setRGB(c[0] * k, c[1] * k, c[2] * k); m.position.set(p.x, p.y + 0.06, p.z); u.fill.value = 0.18;
    const dur = opts.dur || 0.75; const R = radius || 2;
    if (opts.motes !== false) for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283; this.add.spawn({ p: V3(p.x, p.y + 0.1, p.z), v: V3(Math.cos(a) * R / dur * 0.95, rr(0.2, 0.8), Math.sin(a) * R / dur * 0.95), c0: [c[0] * k, c[1] * k, c[2] * k], c1: [c[0] * 0.3, c[1] * 0.3, c[2] * 0.3], s0: 0.13, s1: 0.02, life: dur * rr(0.9, 1.2), drag: 0.3, frame: Math.random() < 0.5 ? 2 : 0, fi: 0.05 }); }
    return this.task(dur, t => { const e = 1 - Math.pow(1 - t, 2); m.scale.setScalar(Math.max(0.05, R * 1.12 * e)); u.radius.value = 0.88; u.width.value = opts.width || 0.06; u.alpha.value = Math.min(1, (1 - t) * 1.6); }, opts.delay || 0, () => this._freeRing(m));
  }
  /** shieldFlash(pos, color) -> Promise: fresnel dome pulse + sparkles (Shield cantrip / block) */
  shieldFlash(pos, color, opts) {
    opts = opts || {}; const p = toV(pos); const c = C(color || '#7fb0ff'); const r = opts.radius || 0.75;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.ShaderMaterial({ vertexShader: FRES_V, fragmentShader: FRES_F, uniforms: { color: { value: new THREE.Color(c[0] * 2.5, c[1] * 2.5, c[2] * 2.5) }, alpha: { value: 1 }, power: { value: 2.2 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.copy(p); this.group.add(m); this._motes(p, 16, [c[0] * 3, c[1] * 3, c[2] * 3], { frame: 2, s: 0.14, r: r, min: 0.1, max: 0.5, flat: false });
    this.lightFlash(p, new THREE.Color(c[0], c[1], c[2]), 1.5, 0.3, 4);
    return this.task(0.45, t => { m.scale.setScalar(r * (0.85 + 0.2 * Math.sqrt(t))); m.material.uniforms.alpha.value = (1 - t) * (t < 0.1 ? t * 10 : 1); m.rotation.y += 0.05; }, 0, () => { this.group.remove(m); m.geometry.dispose(); m.material.dispose(); });
  }
  /** scorch(pos, radius, life=8) — dark ground decal that fades */
  scorch(pos, radius, life) {
    if (!this._scorchTex) { const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N; const ctx = cv.getContext('2d'); const id = ctx.createImageData(N, N); const nz = new Noise(77);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = x / N * 2 - 1, v = y / N * 2 - 1, r = Math.sqrt(u * u + v * v); const nn = nz.fbm(x / N, y / N, 4, 4); const a = smooth(1, 0.3, r + nn * 0.35) * 0.85; const i = (y * N + x) * 4; id.data[i] = 20; id.data[i + 1] = 16; id.data[i + 2] = 14; id.data[i + 3] = a * 255; }
      ctx.putImageData(id, 0, 0); this._scorchTex = new THREE.CanvasTexture(cv); }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this._scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, opacity: 0.85 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6; m.position.copy(toV(pos)).y += 0.02; m.scale.setScalar(radius); m.renderOrder = 1; this.group.add(m);
    return this.task(life || 8, t => { m.material.opacity = 0.85 * (t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2); }, 0, () => { this.group.remove(m); m.geometry.dispose(); m.material.dispose(); });
  }
}
Gfx.Particles = Particles;
Gfx.kindColor = KIND_COLOR;

/* ======================================================================================
 * 7. Foliage — instanced grass tufts and procedural trees (wind sway via Gfx.uniforms.gfxTime)
 * ==================================================================================== */
const Foliage = Gfx.Foliage = { _geo: {} };
function tuftGeometry(blades, seed) {
  const rnd = mulberry(seed); const pos = [], col = [], nor = [], idx = []; let base = 0;
  for (let b = 0; b < blades; b++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 0.07, h = 0.16 + rnd() * 0.2, w = 0.022 + rnd() * 0.018, lean = 0.06 + rnd() * 0.14, face = rnd() * Math.PI;
    const ox = Math.cos(a) * r, oz = Math.sin(a) * r, dx = Math.cos(a), dz = Math.sin(a), fx = Math.cos(face), fz = Math.sin(face); const segs = 3; const shade = 0.8 + rnd() * 0.35;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs; const ww = w * (1 - t * 0.92); const y = h * t; const bend = lean * t * t;
      for (const side of [-1, 1]) { pos.push(ox + dx * bend + fx * ww * side * 0.5, y, oz + dz * bend + fz * ww * side * 0.5); const c = (0.32 + 0.68 * Math.pow(t, 0.8)) * shade; col.push(c * 0.92, c, c * 0.8); nor.push(dx * 0.25, 1, dz * 0.25); }
    }
    for (let s = 0; s < segs; s++) { const i = base + s * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    base += (segs + 1) * 2;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  g.attributes.normal.array.forEach((v, i, arr) => {}); g.computeBoundingSphere(); return g;
}
/** grass(scene|group, cells [[x,y,topY],...], opts) -> InstancedMesh. opts: density (tufts/tile, 7), color, blades (7), sway (0.06), scale */
Foliage.grass = (parent, cells, opts) => {
  opts = opts || {}; const dens = opts.density || 7; const n = cells.length * dens; if (!n) return null;
  const geo = Foliage._geo['tuft' + (opts.blades || 7)] || (Foliage._geo['tuft' + (opts.blades || 7)] = tuftGeometry(opts.blades || 7, 3));
  const mat = new THREE.MeshStandardMaterial({ color: opts.color || '#87a24e', vertexColors: true, side: THREE.DoubleSide, roughness: 0.85, metalness: 0 });
  patch(mat, { sway: { amp: opts.sway || 0.07, freq: 1.7, height: 0.3 } });
  const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = false; im.receiveShadow = true; im.name = 'gfxGrass';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0); let i = 0;
  const tints = ['#8fae55', '#7d9a45', '#9aa858', '#6f8f3e', '#a5a05a'].map(h => new THREE.Color(h));
  for (const cell of cells) {
    const [x, y, top] = cell; const k = cell[3] != null ? cell[3] : 1;
    for (let j = 0; j < dens; j++) {
      const h1 = hash2(x * 31 + j, y * 17 - j, 5), h2 = hash2(x * 13 - j, y * 29 + j, 9), h3 = hash2(x + j * 7, y, 13);
      if (h3 > k) { m4.makeScale(0, 0, 0); im.setMatrixAt(i++, m4); continue; }
      p.set(x + 0.08 + h1 * 0.84, top, y + 0.08 + h2 * 0.84); q.setFromAxisAngle(up, h3 * 6.283); const sc = (0.7 + hash2(x, y + j, 3) * 0.7) * (opts.scale || 1); s.set(sc, sc * (0.8 + h2 * 0.6), sc);
      m4.compose(p, q, s); im.setMatrixAt(i, m4); c.copy(tints[Math.floor(h1 * tints.length)]).multiplyScalar(0.85 + h2 * 0.3); im.setColorAt(i, c); i++;
    }
  }
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere && im.computeBoundingSphere();
  im.frustumCulled = false; if (parent) parent.add(im); return im;
};
/* clump of foliage: displaced icosphere with puffy normals and baked AO vertex colors */
function clumpGeo(r, seed, detail = 2, squash = 0.85) {
  const g = new THREE.IcosahedronGeometry(r, detail); const p = g.attributes.position; const n = new Float32Array(p.count * 3), col = new Float32Array(p.count * 3); const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i)); const d = v.clone().normalize(); const k = 1 + fbm3(d.x * 2.2 + seed, d.y * 2.2, d.z * 2.2 - seed, 3) * 0.42 + fbm3(d.x * 6 + seed, d.y * 6, d.z * 6, 2) * 0.12;
    v.copy(d).multiplyScalar(r * k); v.y *= squash; if (v.y < -r * 0.35) v.y = -r * 0.35 + (v.y + r * 0.35) * 0.3; p.setXYZ(i, v.x, v.y, v.z);
    const nn = d.clone().add(new THREE.Vector3(0, 0.35, 0)).normalize(); n[i * 3] = nn.x; n[i * 3 + 1] = nn.y; n[i * 3 + 2] = nn.z;
    const ao = clamp(0.45 + (d.y * 0.5 + 0.5) * 0.65, 0, 1.1) * (0.9 + (k - 1) * 0.6); col[i * 3] = ao; col[i * 3 + 1] = ao; col[i * 3 + 2] = ao * 0.95;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
function branchGeo(a, b, r0, r1, seg = 6) { const d = b.clone().sub(a); const L = d.length(); const g = new THREE.CylinderGeometry(r1, r0, L, seg, 2, true); g.translate(0, L / 2, 0); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)); g.translate(a.x, a.y, a.z);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.5, uv.getY(i) * L * 1.2); return g; }
function treeGeometry(kind, seed) {
  const rnd = mulberry(seed * 977 + 13); const bark = [], leaves = []; const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const leafTint = c => { const cc = new THREE.Color(c); return [cc.r, cc.g, cc.b]; };
  if (kind === 'pine') {
    const H = 2.3 + rnd() * 0.8; bark.push({ geo: branchGeo(V(0, -0.05, 0), V(rnd() * 0.04, H * 0.85, rnd() * 0.04), 0.1, 0.03, 7) });
    const layers = 5; for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1); const r = lerp(0.72, 0.2, t) * (0.9 + rnd() * 0.2); const h = lerp(0.75, 0.55, t); const y = lerp(0.55, H - 0.55, t);
      const g = new THREE.ConeGeometry(r, h, 11, 3, false); const p = g.attributes.position; const col = new Float32Array(p.count * 3); const nor = new Float32Array(p.count * 3);
      for (let j = 0; j < p.count; j++) {
        let x = p.getX(j), yy = p.getY(j), z = p.getZ(j); const ang = Math.atan2(z, x); const rr2 = Math.hypot(x, z); const rim = rr2 / r;
        const jag = 1 + (Math.sin(ang * 11 + seed + i) * 0.5 + 0.5) * 0.18 * rim + fbm3(x * 4 + i, yy * 4, z * 4 + seed) * 0.12; x *= jag; z *= jag; yy -= rim * rim * 0.12 + fbm3(x * 3, i, z * 3) * 0.05 * rim;
        p.setXYZ(j, x, yy, z); const ao = clamp(0.5 + (yy / h + 0.5) * 0.35 + rim * 0.25, 0.3, 1.1) * (0.85 + t * 0.25); col[j * 3] = ao; col[j * 3 + 1] = ao; col[j * 3 + 2] = ao;
        const nn = V(x, Math.max(0.35, (yy / h + 0.5)) * r * 0.9, z).normalize(); nor[j * 3] = nn.x; nor[j * 3 + 1] = nn.y; nor[j * 3 + 2] = nn.z;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.translate(0, y, 0); leaves.push({ geo: g });
    }
    return { bark, leaves, H, leaf: '#3f5f34', barkC: '#6b5644' };
  }
  if (kind === 'dead') {
    const H = 1.8 + rnd() * 0.6; const top = V((rnd() - 0.5) * 0.2, H, (rnd() - 0.5) * 0.2); bark.push({ geo: branchGeo(V(0, -0.05, 0), top, 0.12, 0.035, 7) });
    const grow = (a, dir, len, r, depth) => { const b = a.clone().addScaledVector(dir, len); bark.push({ geo: branchGeo(a, b, r, r * 0.55, 5) }); if (depth <= 0) return; const n = 2 + (rnd() < 0.4 ? 1 : 0); for (let i = 0; i < n; i++) { const d2 = dir.clone().add(V(rnd() - 0.5, rnd() * 0.6, rnd() - 0.5).multiplyScalar(1.4)).normalize(); grow(b, d2, len * (0.55 + rnd() * 0.2), r * 0.55, depth - 1); } };
    for (let i = 0; i < 3; i++) { const y = H * (0.45 + i * 0.17); const a = rnd() * 6.28; grow(V(top.x * y / H, y, top.z * y / H), V(Math.cos(a), 0.55 + rnd() * 0.4, Math.sin(a)).normalize(), 0.5 + rnd() * 0.25, 0.05, 2); }
    return { bark, leaves, H, leaf: '#000', barkC: '#7a6e62' };
  }
  if (kind === 'bush') {
    const n = 3 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) { const a = rnd() * 6.28, d = rnd() * 0.22; const r = 0.2 + rnd() * 0.14; const g = clumpGeo(r, seed + i * 3, 2, 0.8); g.translate(Math.cos(a) * d, r * 0.55, Math.sin(a) * d); leaves.push({ geo: g }); }
    bark.push({ geo: branchGeo(V(0, 0, 0), V(0.05, 0.25, 0), 0.03, 0.015, 4) });
    return { bark, leaves, H: 0.6, leaf: '#4f6f2f', barkC: '#5a4630' };
  }
  // oak (default)
  const H = 1.25 + rnd() * 0.35; const lean = V((rnd() - 0.5) * 0.25, H, (rnd() - 0.5) * 0.25); bark.push({ geo: branchGeo(V(0, -0.05, 0), lean, 0.15, 0.09, 8) });
  const crownC = lean.clone().add(V(0, 0.55, 0)); const clumps = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < clumps; i++) {
    const a = (i / clumps) * 6.28 + rnd() * 0.6; const d = i === 0 ? 0 : 0.28 + rnd() * 0.25; const y = crownC.y + (i === 0 ? 0.25 : (rnd() - 0.3) * 0.45);
    const c = V(crownC.x + Math.cos(a) * d, y, crownC.z + Math.sin(a) * d); const r = i === 0 ? 0.55 : 0.32 + rnd() * 0.18;
    if (i > 0) bark.push({ geo: branchGeo(lean.clone().multiplyScalar(0.8), c.clone().lerp(lean, 0.3), 0.06, 0.025, 5) });
    const g = clumpGeo(r, seed + i * 5.3, 2, 0.82); g.translate(c.x, c.y, c.z); leaves.push({ geo: g });
  }
  return { bark, leaves, H: H + 1.2, leaf: '#4a6b2c', barkC: '#6e5a45' };
}
/** tree(kind, opts) -> THREE.Group. kinds 'pine' 'oak' 'dead' 'bush'. opts: seed, scale, leafColor, sway (true) */
Foliage.tree = (kind, opts) => {
  opts = opts || {}; kind = kind || 'oak'; const seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 1000); const variant = seed % 4; const key = kind + variant;
  let T = Foliage._geo[key];
  if (!T) { const t = treeGeometry(kind, variant + 1); T = Foliage._geo[key] = { bark: Geo.merge(t.bark), leaves: t.leaves.length ? Geo.merge(t.leaves) : null, H: t.H, leaf: t.leaf, barkC: t.barkC }; }
  const g = new THREE.Group(); g.name = 'gfxTree:' + kind;
  const barkM = Materials.terrain('bark', { world: 0, antiTile: 0, color: T.barkC === '#7a6e62' ? '#b8ab9c' : '#ffffff', sway: opts.sway === false ? undefined : { amp: 0.012, freq: 1.1, height: T.H } });
  const bm = new THREE.Mesh(T.bark, barkM); bm.castShadow = true; bm.receiveShadow = true; g.add(bm);
  if (T.leaves) {
    const lc = opts.leafColor || T.leaf; const lm = Materials.terrain('leaves', { triplanar: 1.4, vertexColors: true, color: lc, roughness: 0.9, normalScale: 0.8, sway: opts.sway === false ? undefined : { amp: kind === 'bush' ? 0.03 : 0.05, freq: 1.3, height: T.H } });
    const lmesh = new THREE.Mesh(T.leaves, lm); lmesh.castShadow = true; lmesh.receiveShadow = true; g.add(lmesh);
  }
  const s = (opts.scale || 1) * (0.88 + hash2(seed, 7, 1) * 0.24); g.scale.set(s, s * (0.9 + hash2(seed, 3, 1) * 0.2), s); g.rotation.y = hash2(seed, 1, 1) * 6.283;
  return g;
};

/* ======================================================================================
 * 8. Props — PF.Gfx.Props.make(type, opts) -> Group sized to a 1×1 tile, origin = tile centre at ground.
 *    Walls/low walls connect: Props.wall({n,e,s,w}, {x, y, style:'stone'|'ruin'|'rock', height})
 *    (n = -z, s = +z, e = +x, w = -x; pass tile x,y so block joints line up across tiles).
 * ==================================================================================== */
const Props = Gfx.Props = { _cache: {} };
const mesh = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; };
const PM = {
  stone: () => Materials.terrain('marble', { triplanar: 0.55, vertexColors: true, color: '#c9c1b3', normalScale: 0.9 }),
  block: () => Materials.terrain('rock', { world: 0.45, vertexColors: true, color: '#d8d0c4', normalScale: 0.7, antiTile: 0.5 }),
  rock: () => Materials.terrain('rock', { triplanar: 0.45, vertexColors: true }),
  wood: () => Materials.terrain('planks', { world: 0, antiTile: 0 }),
  crate: () => Materials.terrain('crate', { world: 0, antiTile: 0 }),
  metal: () => Materials.terrain('metal', { world: 0, antiTile: 0, metalness: 0.75, roughness: 1 }),
  iron: () => Materials.terrain('metal', { triplanar: 2, metalness: 0.6, roughness: 1, color: '#7a7a7a' }),
  gold: () => Materials.std('#d4a64a', { metalness: 0.9, roughness: 0.32 }),
  wax: () => Materials.std('#e9e0c8', { roughness: 0.6 }),
  cloth: (c) => Materials.terrain('cloth', { world: 0, antiTile: 0, color: c || '#8a2a24', side: THREE.DoubleSide }),
  awning: () => Materials.terrain('awning', { world: 0, antiTile: 0, side: THREE.DoubleSide })
};
/* per-block vertex tint */
const tintGeo = (g, rgb, mossTop) => { const n = g.attributes.position.count; const c = new Float32Array(n * 3); const N = g.attributes.normal; for (let i = 0; i < n; i++) { let r = rgb[0], gg = rgb[1], b = rgb[2]; if (mossTop && N.getY(i) > 0.55) { const m = mossTop; r = lerp(r, 0.42, m); gg = lerp(gg, 0.52, m); b = lerp(b, 0.25, m); } c[i * 3] = r; c[i * 3 + 1] = gg; c[i * 3 + 2] = b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };

/* masonry: one wall run along an axis. world coords in, block geometries out (world space) */
function masonryRun(out, o, axis, s0, s1, endA, endB, tile0, cross) {
  const K = o.courses, H = o.height, ch = H / K, t = o.thick, Lb = o.blockLen, seed = o.seed, ruin = o.style === 'ruin', field = o.style === 'field';
  for (let k = 0; k < K; k++) {
    const isCap = o.cap && k === K - 1, isBase = o.plinth && k === 0;
    const y0 = k * ch, y1 = isCap ? H : (k + 1) * ch; const L = isCap ? Lb * 1.25 : Lb * (field ? 0.75 : 1);
    const off = (k % 2) * L * 0.5 + hash2(k, 3, seed) * 0.3;
    const J = []; const m0 = Math.floor((s0 - 1.5 - off) / L), m1 = Math.ceil((s1 + 1.5 - off) / L);
    for (let m = m0; m <= m1; m++) J.push(m * L + off + (hash2(m, k * 7 + 1, seed + (axis === 'x' ? 0 : 50)) - 0.5) * L * 0.55);
    let iv = [];
    for (let i = 0; i < J.length - 1; i++) {
      const a = J[i], b = J[i + 1]; if (b <= s0 + 1e-4 || a >= s1 - 1e-4) continue;
      const own = (a >= tile0 && a < tile0 + 1) || (a < tile0 && endA && b > s0);
      if (!own) continue; let lo = Math.max(a, endA ? s0 : a), hi = endB ? Math.min(b, s1) : b; if (!endA && a < s0) lo = a;
      iv.push([lo, hi, i]);
    }
    if (endA && iv.length > 1 && iv[0][0] <= s0 + 1e-4 && iv[0][1] - iv[0][0] < 0.14) { iv[1][0] = iv[0][0]; iv.shift(); }
    if (endB && iv.length > 1 && iv[iv.length - 1][1] >= s1 - 1e-4 && iv[iv.length - 1][1] - iv[iv.length - 1][0] < 0.14) { iv[iv.length - 2][1] = iv[iv.length - 1][1]; iv.pop(); }
    for (const [lo, hi, id] of iv) {
      const mid = (lo + hi) / 2; const wx = axis === 'x' ? mid : cross, wz = axis === 'x' ? cross : mid;
      let top = y1;
      if (ruin) { const kmax = K - Math.floor(clamp((fbm3(wx * 0.9, 3.3, wz * 0.9, 2) * 0.5 + 0.5) * 1.9 - 0.25, 0, 1) * (K - 1.4)); if (k >= kmax) continue; }
      const h = hash2(id, k * 13 + 5, seed + 11); const len = hi - lo; if (len < 0.03) continue;
      const th = t * (cross === undefined ? 1 : 1) + (isCap ? 0.09 : isBase ? 0.05 : (h - 0.5) * (field ? 0.08 : 0.025)) - (o.inset || 0);
      const hh = (top - y0) * (field ? 0.92 + h * 0.08 : 1);
      const g = Geo.bevelBox(len, hh, th, Math.min(o.bevel, len * 0.3, hh * 0.3));
      const tv = 0.78 + h * 0.32; const warm = (hash2(id, k, seed + 3) - 0.5) * 0.08; tintGeo(g, [tv * (1 + warm), tv, tv * (1 - warm)], ruin ? 0.45 * hash2(id, 9, seed) + 0.15 : field ? 0.2 : 0);
      const M = new THREE.Matrix4(); const rot = (ruin || field) ? (h - 0.5) * (k >= K - 2 ? 0.12 : 0.03) : 0;
      if (axis === 'x') M.makeRotationY(rot).setPosition(mid, y0 + hh / 2, cross); else M.makeRotationY(Math.PI / 2 + rot).setPosition(cross, y0 + hh / 2, mid);
      out.push({ geo: g, matrix: M });
    }
  }
}
/** wall(neighbors {n,e,s,w}, opts {x,y (tile), style:'stone'|'ruin'|'rock'|'field', height, thick}) -> Group */
Props.wall = (nb, o) => {
  nb = nb || {}; o = Object.assign({ style: 'stone', x: 0, y: 0, height: 2.4 }, o || {});
  const g = new THREE.Group(); g.name = 'gfxWall'; const tx = o.x, ty = o.y, cx = tx + 0.5, cz = ty + 0.5;
  if (o.style === 'rock') { g.add(rockMass(nb, o)); return g; }
  const field = o.style === 'field';
  const P = Object.assign({ courses: field ? 2 : 6, thick: field ? 0.42 : o.style === 'ruin' ? 0.7 : 0.62, blockLen: field ? 0.42 : 0.6, bevel: field ? 0.06 : 0.045, seed: o.seed || 7, cap: o.style === 'stone', plinth: o.style === 'stone' }, o);
  P.height = o.height; if (o.courses) P.courses = o.courses;
  const t = P.thick; const parts = []; const anyX = nb.e || nb.w, anyZ = nb.n || nb.s;
  if (anyX || !anyZ) masonryRun(parts, P, 'x', nb.w ? tx : cx - t / 2, nb.e ? tx + 1 : cx + t / 2, !nb.w, !nb.e, tx, cz);
  if (anyZ) { const Pz = Object.assign({}, P, { inset: anyX ? 0.012 : 0, seed: P.seed + 1 }); masonryRun(parts, Pz, 'z', nb.n ? ty : cz - t / 2 + (anyX ? 0.006 : 0), nb.s ? ty + 1 : cz + t / 2 - (anyX ? 0.006 : 0), !nb.n, !nb.s, ty, cx); }
  if (!parts.length) return g;
  const geo = Geo.merge(parts); geo.translate(-cx, 0, -cz);
  const mat = o.style === 'ruin' ? Materials.terrain('rock', { world: 0.45, vertexColors: true, color: '#cfc8bb', normalScale: 0.9, antiTile: 0.6 }) : PM.block();
  g.add(mesh(geo, mat));
  if (o.style === 'ruin' && hash2(tx, ty, 77) < 0.5) { const r = Props.make('rubble', { seed: tx * 13 + ty, small: true }); r.position.set((hash2(tx, ty, 3) - 0.5) * 0.4, 0, (hash2(tx, ty, 4) - 0.5) * 0.4); g.add(r); }
  return g;
};
/* cave rock mass: displaced block, faces toward neighbouring rock omitted; displacement is a pure function
   of world position so adjacent tiles meet seamlessly */
function rockMass(nb, o) {
  const tx = o.x, ty = o.y, H = o.height || 2.6; const parts = []; const seg = 6;
  const disp = (v) => { const s = 0.85; const dx = fbm3(v.x * s, v.y * s, v.z * s + 11, 3), dy = fbm3(v.x * s + 5, v.y * s, v.z * s, 3), dz = fbm3(v.x * s, v.y * s + 9, v.z * s, 3);
    const k = clamp(v.y / H, 0, 1) * 0.25 + 0.1; v.x += dx * k * 1.2; v.z += dz * k * 1.2; v.y += (v.y > 0.01 ? dy * 0.45 + fbm3(v.x * 2.3, 1, v.z * 2.3, 2) * 0.25 : 0); return v; };
  const face = (o2, ux, uy, want) => { const g = new THREE.PlaneGeometry(1, 1, seg, seg); const p = g.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { const a = p.getX(i) + 0.5, b = p.getY(i) + 0.5; v.copy(o2).addScaledVector(ux, a).addScaledVector(uy, b); disp(v); p.setXYZ(i, v.x, v.y, v.z); }
    const idx = g.index.array; const n0 = new THREE.Vector3().crossVectors(ux, uy);
    if (n0.dot(want) < 0) for (let i = 0; i < idx.length; i += 3) { const tmp = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = tmp; }
    g.computeVertexNormals(); parts.push({ geo: g }); };
  const X0 = tx, X1 = tx + 1, Z0 = ty, Z1 = ty + 1;
  face(V3(X0, H, Z0), V3(1, 0, 0), V3(0, 0, 1), V3(0, 1, 0));
  if (!nb.n) face(V3(X0, 0, Z0), V3(1, 0, 0), V3(0, H, 0), V3(0, 0, -1));
  if (!nb.s) face(V3(X0, 0, Z1), V3(1, 0, 0), V3(0, H, 0), V3(0, 0, 1));
  if (!nb.w) face(V3(X0, 0, Z0), V3(0, 0, 1), V3(0, H, 0), V3(-1, 0, 0));
  if (!nb.e) face(V3(X1, 0, Z0), V3(0, 0, 1), V3(0, H, 0), V3(1, 0, 0));
  const geo = Geo.merge(parts); geo.translate(-(tx + 0.5), 0, -(ty + 0.5));
  const n = geo.attributes.position.count; const col = new Float32Array(n * 3); const P = geo.attributes.position; for (let i = 0; i < n; i++) { const y = P.getY(i); const a = clamp(0.55 + y / H * 0.55, 0.5, 1.05); col[i * 3] = a; col[i * 3 + 1] = a * 0.97; col[i * 3 + 2] = a * 0.93; } geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return mesh(geo, Materials.terrain('rock', { triplanar: 0.42, vertexColors: true, color: o.color || '#b8ada0' }));
}

/** make(type, opts) -> Group. types: wall lowWall pillar crate barrel boulder statue sarcophagus altar table brazier rubble bridge stairs stall tree bush
 *  common opts: seed, neighbors {n,e,s,w}, x,y (tile coords, for walls), broken (pillar), dir ('n'|'e'|'s'|'w' for stairs/bridge), rise (stairs)
 *  Fire hooks: altar/brazier groups expose userData.fireSpots (local Vector3s) and userData.attachFx(fx) -> emitter handles. */
Props.make = (type, o) => {
  o = o || {}; const seed = o.seed != null ? o.seed : Math.floor(Math.random() * 9999); const rnd = mulberry(seed * 7 + 3); const g = new THREE.Group(); g.name = 'gfxProp:' + type;
  const add = (geo, mat, x = 0, y = 0, z = 0, cast = true) => { const m = mesh(geo, mat, cast); m.position.set(x, y, z); g.add(m); return m; };
  switch (type) {
    case 'wall': return Props.wall(o.neighbors, o);
    case 'lowWall': return Props.wall(o.neighbors || (o.dir === 'ns' ? { n: 1, s: 1 } : { e: 1, w: 1 }), Object.assign({ style: 'field', height: 0.62 }, o));
    case 'pillar': {
      const base = Geo.bevelBox(0.82, 0.2, 0.82, 0.04); tintGeo(base, [0.92, 0.92, 0.9]); add(base, PM.stone(), 0, 0.1, 0);
      const plinth2 = new THREE.CylinderGeometry(0.4, 0.42, 0.12, 32); tintGeo(plinth2, [0.95, 0.95, 0.93]); add(plinth2, PM.stone(), 0, 0.26, 0);
      const H = o.broken ? 0.8 + rnd() * 1.1 : 2.55; const shaft = new THREE.CylinderGeometry(0.3, 0.34, H, 40, 12, false); const p = shaft.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x); const r = Math.hypot(x, z); if (r < 1e-3) continue; const t = (y + H / 2) / 2.55; const ent = 1 + 0.035 * Math.sin(Math.PI * clamp(t, 0, 1)); const fl = 1 - 0.07 * Math.pow(0.5 + 0.5 * Math.cos(a * 16), 3); let rr2 = r * ent * fl; let yy = y; if (o.broken && y > H / 2 - 1e-3) { yy += (fbm3(Math.cos(a) * 2 + seed, Math.sin(a) * 2, 0, 2)) * 0.22 - 0.08; } if (o.broken && y > H / 2 - 0.3) rr2 *= 1 - 0.08 * hash2(Math.round(a * 10), 1, seed); p.setXYZ(i, Math.cos(a) * rr2, yy, Math.sin(a) * rr2); }
      shaft.computeVertexNormals(); tintGeo(shaft, [0.95, 0.94, 0.9], 0); add(shaft, PM.stone(), 0, 0.32 + H / 2, 0);
      if (!o.broken) { const ech = new THREE.LatheGeometry([[0.3, 0], [0.36, 0.05], [0.42, 0.13], [0.44, 0.18]].map(a => new THREE.Vector2(a[0], a[1])), 32); tintGeo(ech, [0.95, 0.95, 0.92]); add(ech, PM.stone(), 0, 0.32 + H, 0); const ab = Geo.bevelBox(0.9, 0.16, 0.9, 0.035); tintGeo(ab, [0.92, 0.92, 0.9], 0.12); add(ab, PM.stone(), 0, 0.32 + H + 0.26, 0); }
      else { const drum = new THREE.CylinderGeometry(0.3, 0.3, 0.45, 24); tintGeo(drum, [0.9, 0.9, 0.87], 0.1); const m = add(drum, PM.stone(), 0.42, 0.28, 0.25); m.rotation.set(Math.PI / 2, rnd() * 3, 0.15); m.position.y = 0.22; g.add(Props.make('rubble', { seed: seed + 1, small: true })); }
      return g;
    }
    case 'crate': {
      const s = 0.78 + rnd() * 0.06; const b = Geo.bevelBox(s, s, s, 0.025); add(b, PM.crate(), 0, s / 2, 0).rotation.y = (rnd() - 0.5) * 0.35;
      if (o.stack || rnd() < 0.25) { const s2 = 0.5; const b2 = Geo.bevelBox(s2, s2, s2, 0.02); const m = add(b2, PM.crate(), (rnd() - 0.5) * 0.15, s + s2 / 2, (rnd() - 0.5) * 0.15); m.rotation.y = rnd() * 1.5; }
      return g;
    }
    case 'barrel': {
      const H = 0.86, pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.25 + 0.055 * Math.sin(Math.PI * t), t * H)); }
      const lathe = new THREE.LatheGeometry(pts, 24); const uv = lathe.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, v * 0.3, u * 3.6); }
      add(lathe, PM.wood(), 0, 0, 0); const lid = new THREE.CircleGeometry(0.255, 24); lid.rotateX(-Math.PI / 2); add(lid, PM.wood(), 0, H - 0.02, 0);
      for (const t of [0.12, 0.38, 0.62, 0.88]) { const r = 0.25 + 0.055 * Math.sin(Math.PI * t) + 0.006; const hoop = new THREE.TorusGeometry(r, 0.014, 4, 28); hoop.rotateX(Math.PI / 2); hoop.scale(1, 2.2, 1); add(hoop, PM.metal(), 0, t * H, 0); }
      g.rotation.y = rnd() * 6; return g;
    }
    case 'boulder': {
      const geo = new THREE.IcosahedronGeometry(0.46, 3); const p = geo.attributes.position; const v = new THREE.Vector3(); const col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i)); const d = v.clone().normalize(); const k = 1 + fbm3(d.x * 1.6 + seed, d.y * 1.6, d.z * 1.6, 3) * 0.38 + fbm3(d.x * 5, d.y * 5 + seed, d.z * 5, 2) * 0.08; v.copy(d).multiplyScalar(0.46 * k); v.y = v.y * 0.78; if (v.y < -0.1) v.y = -0.1 + (v.y + 0.1) * 0.25; p.setXYZ(i, v.x, v.y + 0.12, v.z); const a = clamp(0.55 + (d.y + 0.3) * 0.5, 0.45, 1.05); const moss = o.moss !== false && d.y > 0.55 ? (d.y - 0.55) * 1.4 : 0; col[i * 3] = lerp(a, 0.45, moss); col[i * 3 + 1] = lerp(a, 0.55, moss); col[i * 3 + 2] = lerp(a * 0.95, 0.28, moss); }
      geo.computeVertexNormals(); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); const m = add(geo, PM.rock()); m.rotation.y = rnd() * 6; m.scale.set(1 + rnd() * 0.15, 0.85 + rnd() * 0.3, 1);
      if (rnd() < 0.7) { const s2 = new THREE.IcosahedronGeometry(0.16, 1); Geo.displace(s2, 0.04, 3, V3(seed, 0, 0)); tintGeo(s2, [0.8, 0.78, 0.75]); add(s2, PM.rock(), 0.38 * rsign(), 0.08, 0.3 * rsign()); }
      return g;
    }
    case 'statue': {
      const pl = Geo.bevelBox(0.74, 0.42, 0.74, 0.04); tintGeo(pl, [0.88, 0.87, 0.84], 0.2); add(pl, PM.stone(), 0, 0.21, 0); const st = Geo.bevelBox(0.84, 0.1, 0.84, 0.03); tintGeo(st, [0.85, 0.85, 0.82]); add(st, PM.stone(), 0, 0.05, 0);
      const robeP = [[0.27, 0], [0.26, 0.15], [0.22, 0.5], [0.18, 0.85], [0.2, 1.0], [0.16, 1.08], [0.07, 1.12], [0, 1.13]].map(a => new THREE.Vector2(a[0], a[1]));
      const robe = new THREE.LatheGeometry(robeP, 28); const p = robe.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x); const f = 1 + 0.06 * Math.sin(a * 9 + Math.sin(y * 3)) * clamp(1 - y, 0, 1) - (z < 0 ? 0 : 0); p.setXYZ(i, x * f, y, z * f * 0.82); } robe.computeVertexNormals(); tintGeo(robe, [0.93, 0.92, 0.88], 0.1);
      add(robe, PM.stone(), 0, 0.42, 0);
      const head = new THREE.SphereGeometry(0.11, 18, 14); tintGeo(head, [0.95, 0.94, 0.9]); add(head, PM.stone(), 0, 0.42 + 1.24, 0.01);
      const hood = new THREE.SphereGeometry(0.135, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62); hood.scale(1, 1.15, 1.05); tintGeo(hood, [0.9, 0.89, 0.85], 0.25); const hm = add(hood, PM.stone(), 0, 0.42 + 1.25, -0.012); hm.rotation.x = -0.25;
      for (const sd of [-1, 1]) { const arm = new THREE.CylinderGeometry(0.055, 0.065, 0.5, 10); tintGeo(arm, [0.92, 0.91, 0.87]); const am = add(arm, PM.stone(), sd * 0.17, 0.42 + 0.88, 0.08); am.rotation.set(-0.9, 0, sd * 0.35); }
      const book = Geo.bevelBox(0.2, 0.05, 0.15, 0.01); tintGeo(book, [0.9, 0.88, 0.84]); const bm = add(book, PM.stone(), 0, 0.42 + 0.72, 0.24); bm.rotation.x = 0.6;
      g.rotation.y = o.facing != null ? o.facing : 0; return g;
    }
    case 'sarcophagus': {
      const base = Geo.bevelBox(0.62, 0.52, 0.96, 0.03); tintGeo(base, [0.86, 0.85, 0.82]); add(base, PM.stone(), 0, 0.26, 0);
      for (const sd of [-1, 1]) { const pan = Geo.bevelBox(0.02, 0.3, 0.7, 0.008); tintGeo(pan, [0.8, 0.79, 0.76]); add(pan, PM.stone(), sd * 0.315, 0.27, 0); const pe = Geo.bevelBox(0.5, 0.3, 0.02, 0.008); tintGeo(pe, [0.8, 0.79, 0.76]); add(pe, PM.stone(), 0, 0.27, sd * 0.485); }
      const lid = Geo.bevelBox(0.7, 0.1, 1.04, 0.035); tintGeo(lid, [0.9, 0.89, 0.85], 0.25); add(lid, PM.stone(), 0, 0.57, 0);
      const ridge = Geo.bevelBox(0.36, 0.1, 0.78, 0.05); tintGeo(ridge, [0.92, 0.91, 0.87], 0.2); add(ridge, PM.stone(), 0, 0.66, 0.02);
      const hd = new THREE.SphereGeometry(0.1, 14, 10); hd.scale(1, 0.6, 1); tintGeo(hd, [0.93, 0.92, 0.88]); add(hd, PM.stone(), 0, 0.71, -0.3);
      const sw = Geo.bevelBox(0.05, 0.03, 0.5, 0.01); tintGeo(sw, [0.95, 0.94, 0.9]); add(sw, PM.stone(), 0, 0.73, 0.1); const gd = Geo.bevelBox(0.18, 0.03, 0.04, 0.01); tintGeo(gd, [0.95, 0.94, 0.9]); add(gd, PM.stone(), 0, 0.73, -0.1);
      g.rotation.y = o.facing || 0; return g;
    }
    case 'altar': {
      const blk = Geo.bevelBox(0.92, 0.72, 0.62, 0.035); tintGeo(blk, [0.95, 0.93, 0.88]); add(blk, PM.stone(), 0, 0.36, 0);
      const top = Geo.bevelBox(1.0, 0.09, 0.72, 0.03); tintGeo(top, [0.97, 0.95, 0.9]); add(top, PM.stone(), 0, 0.765, 0);
      const runner = new THREE.PlaneGeometry(0.3, 1.0, 1, 8); const rp = runner.attributes.position; for (let i = 0; i < rp.count; i++) { const v = rp.getY(i) + 0.5; let y, z; if (v < 0.72) { y = 0.815; z = -0.36 + v / 0.72 * 0.72 * 0.85; } else { y = 0.815 - (v - 0.72) * 1.4; z = 0.37; } rp.setXYZ(i, rp.getX(i), y, z); } runner.computeVertexNormals(); add(runner, PM.cloth('#7a1f1c'), 0, 0.003, 0);
      const bowl = new THREE.LatheGeometry([[0.0, 0], [0.06, 0], [0.04, 0.05], [0.05, 0.12], [0.11, 0.17], [0.1, 0.18]].map(a => new THREE.Vector2(a[0], a[1])), 16); add(bowl, PM.gold(), 0, 0.81, -0.05);
      const spots = []; [[-0.38, -0.22, 0.2], [-0.3, 0.18, 0.13], [0.36, -0.2, 0.24], [0.32, 0.16, 0.11]].forEach(([x, z, h]) => { const c = new THREE.CylinderGeometry(0.028, 0.032, h, 8); add(c, PM.wax(), x, 0.81 + h / 2, z); spots.push(V3(x, 0.81 + h + 0.03, z)); });
      g.userData.fireSpots = spots; g.userData.fireScale = 0.14;
      g.userData.attachFx = fx => spots.map((s, i) => fx.emitter('fire', g.localToWorld(s.clone()), { scale: 0.14, light: i === 0, lightIntensity: 4, rate: 0.6 }));
      g.rotation.y = o.facing || 0; return g;
    }
    case 'table': {
      const top = Geo.bevelBox(0.92, 0.07, 0.66, 0.02); add(top, PM.wood(), 0, 0.6, 0);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(Geo.bevelBox(0.07, 0.57, 0.07, 0.012), PM.wood(), a * 0.38, 0.285, b * 0.25);
      add(Geo.bevelBox(0.78, 0.05, 0.04, 0.01), PM.wood(), 0, 0.18, 0.25); add(Geo.bevelBox(0.78, 0.05, 0.04, 0.01), PM.wood(), 0, 0.18, -0.25);
      if (rnd() < 0.7) { const mug = new THREE.CylinderGeometry(0.045, 0.04, 0.1, 12); add(mug, PM.metal(), 0.2, 0.685, 0.1); }
      if (rnd() < 0.6) { const pl = new THREE.CylinderGeometry(0.1, 0.08, 0.02, 16); add(pl, Materials.std('#cdbf9f'), -0.15, 0.645, -0.08); }
      g.rotation.y = (rnd() - 0.5) * 0.2 + (o.facing || 0); return g;
    }
    case 'brazier': {
      const bowl = new THREE.LatheGeometry([[0.0, 0.0], [0.12, 0.0], [0.3, 0.12], [0.34, 0.22], [0.31, 0.23], [0.27, 0.14], [0.0, 0.1]].map(a => new THREE.Vector2(a[0], a[1])), 20); add(bowl, PM.iron(), 0, 0.55, 0);
      for (let i = 0; i < 3; i++) { const a = i / 3 * 6.283; const leg = new THREE.CylinderGeometry(0.02, 0.025, 0.66, 6); const m = add(leg, PM.iron(), Math.cos(a) * 0.17, 0.3, Math.sin(a) * 0.17); m.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); }
      const coalM = new THREE.MeshStandardMaterial({ color: '#2a1a12', emissive: '#ff5a10', emissiveIntensity: 1.8, roughness: 0.9 }); for (let i = 0; i < 9; i++) { const c = new THREE.DodecahedronGeometry(0.06 + rnd() * 0.03, 0); const a = rnd() * 6.28, r = rnd() * 0.18; add(c, coalM, Math.cos(a) * r, 0.7 + rnd() * 0.05, Math.sin(a) * r, false); }
      g.userData.fireSpots = [V3(0, 0.74, 0)]; g.userData.fireScale = 0.6; g.userData.attachFx = fx => [fx.emitter('fire', g.localToWorld(V3(0, 0.74, 0)), { scale: 0.6 })];
      return g;
    }
    case 'rubble': {
      const n = o.small ? 5 : 11; const parts = [];
      for (let i = 0; i < n; i++) { const s = (o.small ? 0.08 : 0.1) + rnd() * (o.small ? 0.12 : 0.2); const b = Geo.bevelBox(s * (0.8 + rnd() * 0.8), s * (0.5 + rnd() * 0.5), s * (0.8 + rnd() * 0.6), s * 0.18); Geo.displace(b, s * 0.12, 4, V3(seed + i, 0, 0)); const tv = 0.7 + rnd() * 0.3; tintGeo(b, [tv, tv * 0.98, tv * 0.95]);
        const a = rnd() * 6.28, r = Math.sqrt(rnd()) * (o.small ? 0.3 : 0.42); const M = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rnd() * 0.6, rnd() * 6, rnd() * 0.6)).setPosition(Math.cos(a) * r, s * 0.3 + (1 - r / 0.45) * (o.small ? 0.02 : 0.1), Math.sin(a) * r); parts.push({ geo: b, matrix: M }); }
      add(Geo.merge(parts), PM.rock()); return g;
    }
    case 'bridge': {
      const ns = o.dir === 'ns'; const parts = []; const nP = 6;
      for (let i = 0; i < nP; i++) { const w = 0.15; const b = Geo.bevelBox(1.04, 0.055, w, 0.012); const M = new THREE.Matrix4().makeRotationY((rnd() - 0.5) * 0.04).setPosition(0, -0.03 + (rnd() - 0.5) * 0.015, -0.5 + (i + 0.5) / nP); if (!ns) M.premultiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)); parts.push({ geo: b, matrix: M }); }
      const pg = Geo.merge(parts); Gfx.worldUV(pg, 0.45); add(pg, PM.wood(), 0, 0, 0);
      for (const sd of [-1, 1]) { const beam = Geo.bevelBox(ns ? 0.1 : 1.02, 0.14, ns ? 1.02 : 0.1, 0.02); add(beam, PM.wood(), ns ? 0 : 0, -0.12, 0).position.set(ns ? sd * 0.42 : 0, -0.12, ns ? 0 : sd * 0.42); }
      if (o.rails !== false) for (const sd of [-1, 1]) { const post = Geo.bevelBox(0.08, 0.6, 0.08, 0.015); const m = add(post, PM.wood(), ns ? sd * 0.5 : 0, 0.22, ns ? 0 : sd * 0.5); const rope = new THREE.CylinderGeometry(0.015, 0.015, 1.0, 5); rope.rotateZ(Math.PI / 2); if (ns) rope.rotateY(Math.PI / 2); add(rope, Materials.std('#8a7a5a'), ns ? sd * 0.5 : 0, 0.45, ns ? 0 : sd * 0.5, false); }
      return g;
    }
    case 'stairs': {
      const n = o.steps || 4, rise = o.rise != null ? o.rise : 0.7; const dir = o.dir || 'n'; const parts = [];
      for (let i = 0; i < n; i++) { const h = rise * (i + 1) / n; const d = 1 / n; const b = Geo.bevelBox(1.0, h, d + 0.005, 0.02); const tv = 0.85 + rnd() * 0.15; tintGeo(b, [tv, tv, tv * 0.97]); parts.push({ geo: b, matrix: new THREE.Matrix4().makeTranslation(0, h / 2, 0.5 - d * (i + 0.5)) }); }
      const geo = Geo.merge(parts); add(geo, Materials.terrain('flagstone', { world: 0.5, vertexColors: true }));
      g.children[0].rotation.y = { n: 0, w: Math.PI / 2, s: Math.PI, e: -Math.PI / 2 }[dir] || 0; return g;
    }
    case 'stall': {
      for (const [a, b, h] of [[-1, -1, 1.65], [1, -1, 1.65], [-1, 1, 1.35], [1, 1, 1.35]]) add(Geo.bevelBox(0.07, h, 0.07, 0.012), PM.wood(), a * 0.42, h / 2, b * 0.36);
      add(Geo.bevelBox(0.95, 0.07, 0.5, 0.015), PM.wood(), 0, 0.78, 0.1); add(Geo.bevelBox(0.9, 0.7, 0.04, 0.01), PM.wood(), 0, 0.42, 0.33);
      const aw = new THREE.PlaneGeometry(1.1, 0.95, 8, 6); const p = aw.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const t = y / 0.95 + 0.5; p.setXYZ(i, x, lerp(1.35, 1.7, t) - Math.sin(Math.PI * (x / 1.1 + 0.5)) * 0.05 - Math.sin(t * Math.PI) * 0.03, lerp(0.48, -0.44, t)); } aw.computeVertexNormals(); add(aw, PM.awning(), 0, 0, 0);
      const fruitC = ['#b8352a', '#d88a2a', '#7da23a', '#c9a23a']; for (let i = 0; i < 14; i++) { const s = new THREE.SphereGeometry(0.045, 8, 6); add(s, Materials.std(fruitC[i % 4], { roughness: 0.5 }), -0.35 + (i % 7) * 0.11, 0.86, 0.02 + Math.floor(i / 7) * 0.12, false); }
      const c = Props.make('crate', { seed: seed + 3 }); c.scale.setScalar(0.5); c.position.set(0.25, 0, -0.25); g.add(c); const br = Props.make('barrel', { seed: seed + 5 }); br.scale.setScalar(0.6); br.position.set(-0.28, 0, -0.25); g.add(br);
      g.rotation.y = o.facing || 0; return g;
    }
    case 'stalagmite': {
      const H = 1.3 + rnd() * 1.1; const c = new THREE.ConeGeometry(0.36, H, 12, 8); const p = c.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + fbm3(x * 4 + seed, y * 3, z * 4, 3) * 0.35; p.setXYZ(i, x * k + Math.sin(y * 2 + seed) * 0.04, y, z * k); } c.computeVertexNormals(); c.translate(0, H / 2 - 0.05, 0); tintGeo(c, [0.85, 0.82, 0.78]);
      add(c, PM.rock()); const c2 = new THREE.ConeGeometry(0.18, H * 0.45, 9, 3); Geo.displace(c2, 0.03, 4, V3(seed, 1, 0)); c2.translate(0.25, H * 0.2, 0.15); tintGeo(c2, [0.8, 0.78, 0.74]); add(c2, PM.rock()); return g;
    }
    case 'torch': { // wall sconce; opts.facing = yaw the torch points to (away from wall)
      const br = Geo.bevelBox(0.06, 0.2, 0.05, 0.01); add(br, PM.iron(), 0, 1.45, -0.02); const st = new THREE.CylinderGeometry(0.03, 0.022, 0.32, 6); const m = add(st, PM.wood(), 0, 1.6, 0.08); m.rotation.x = 0.35;
      const cup = new THREE.CylinderGeometry(0.06, 0.035, 0.08, 8); add(cup, PM.iron(), 0, 1.75, 0.14);
      g.userData.fireSpots = [V3(0, 1.82, 0.15)]; g.userData.fireScale = 0.32; g.userData.attachFx = (fx, light) => [fx.emitter('fire', g.localToWorld(V3(0, 1.82, 0.15)), { scale: 0.32, light: light !== false, lightIntensity: 2.2 })];
      g.rotation.y = o.facing || 0; return g;
    }
    case 'tree': return Foliage.tree(o.kind || 'oak', o);
    case 'bush': return Foliage.tree('bush', o);
    default: { const b = Geo.bevelBox(0.7, 0.7, 0.7, 0.05); add(b, PM.block(), 0, 0.35, 0); return g; }
  }
};

/* ======================================================================================
 * 9. Terrain — splat-blended ground (up to 4 blended layers with height-based transitions),
 *    cliff/side faces, water and lava surfaces.
 *    const t = PF.Gfx.Terrain.build({W, H, cell:(x,y)=>({top, layer, side}), bottom:-1.2, separate:['roof']})
 *    -> {group, tops:[meshes for picking], sides, splat}
 * ==================================================================================== */
const SPLAT_F_MAP = `
  vec2 sUV = vGfxWP.xz * gfxSplatXf.xy;
  vec4 sw = texture2D(gfxSplat, sUV);
  vec2 u0 = vGfxWP.xz * gfxLScale.x, u1 = vGfxWP.xz * gfxLScale.y, u2 = vGfxWP.xz * gfxLScale.z, u3 = vGfxWP.xz * gfxLScale.w;
  vec4 n0 = texture2D(gfxN0, u0), n1 = texture2D(gfxN1, u1), n2 = texture2D(gfxN2, u2), n3 = texture2D(gfxN3, u3);
  vec4 hgt = vec4(n0.a, n1.a, n2.a, n3.a);
  vec4 has = step(0.004, sw);
  vec4 wv = (sw + hgt * 0.6) * has;
  float mx = max(max(wv.x, wv.y), max(wv.z, wv.w)) - 0.16;
  vec4 bw = max(wv - mx, 0.0) * has; bw /= max(dot(bw, vec4(1.0)), 1e-4);
  vec4 col = vec4(0.0);
  if (bw.x > 0.001) col += texture2D(gfxL0, u0) * bw.x;
  if (bw.y > 0.001) col += texture2D(gfxL1, u1) * bw.y;
  if (bw.z > 0.001) col += texture2D(gfxL2, u2) * bw.z;
  if (bw.w > 0.001) col += texture2D(gfxL3, u3) * bw.w;
  col = sRGBToLinear(col);
  col.rgb *= mix(0.8, 1.12, texture2D(gfxMacro, vGfxWP.xz * 0.029 + 0.5).g) * mix(0.92, 1.05, texture2D(gfxMacro, vGfxWP.xz * 0.11).r);
  diffuseColor *= col;
  float gfxSR = dot(bw, gfxLRough) * (1.08 - 0.2 * dot(bw, hgt));
`;
const SPLAT_F_NORMAL = `
  { vec3 tn = (n0.xyz * 2.0 - 1.0) * bw.x + (n1.xyz * 2.0 - 1.0) * bw.y + (n2.xyz * 2.0 - 1.0) * bw.z + (n3.xyz * 2.0 - 1.0) * bw.w; tn.xy *= gfxNScale;
    vec3 wN = normalize(vec3(tn.x, max(tn.z, 0.05), tn.y)); normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz); }
`;
let _dummyTex = null;
const dummyTex = () => _dummyTex || (_dummyTex = (() => { const t = new THREE.DataTexture(new Uint8Array([128, 128, 255, 0]), 1, 1, THREE.RGBAFormat); t.needsUpdate = true; return t; })());
Materials.splat = (layers, splatTex, W, H, o) => {
  o = o || {}; const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }); const L = layers.map(n => Textures.get(n));
  const RO = { grass: 0.92, dirt: 0.95, path: 0.9, flagstone: 0.8, cobble: 0.75, cave: 0.85, ash: 0.95, sand: 0.95, mud: 0.55, rubble: 0.92, roof: 0.75, planks: 0.8 };
  const SC = Object.assign({ flagstone: 0.5, cobble: 0.5, planks: 0.5, roof: 0.5, rubble: 0.6 }, o.scales || {});
  patch(m, { cloud: true, extraKey: 'splat' + layers.join(), extra: sh => {
    for (let i = 0; i < 4; i++) { sh.uniforms['gfxL' + i] = { value: L[i] ? L[i].map : dummyTex() }; sh.uniforms['gfxN' + i] = { value: L[i] ? L[i].normalMap : dummyTex() }; }
    sh.uniforms.gfxSplat = { value: splatTex }; sh.uniforms.gfxSplatXf = { value: new THREE.Vector2(1 / W, 1 / H) };
    sh.uniforms.gfxLScale = { value: new THREE.Vector4(...[0, 1, 2, 3].map(i => SC[layers[i]] || 0.5)) }; sh.uniforms.gfxLRough = { value: new THREE.Vector4(...[0, 1, 2, 3].map(i => RO[layers[i]] || 0.9)) }; sh.uniforms.gfxNScale = { value: o.normalScale || 1 };
    sh.fragmentShader = 'uniform sampler2D gfxL0, gfxL1, gfxL2, gfxL3, gfxN0, gfxN1, gfxN2, gfxN3, gfxSplat; uniform vec2 gfxSplatXf; uniform vec4 gfxLScale; uniform vec4 gfxLRough; uniform float gfxNScale;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', SPLAT_F_MAP).replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * gfxSR;').replace('#include <normal_fragment_maps>', SPLAT_F_NORMAL);
  } });
  m.name = 'gfx:splat'; return m;
};
const Terrain = Gfx.Terrain = {
  build(o) {
    const W = o.W, H = o.H, bottom = o.bottom != null ? o.bottom : -1.2; const cells = []; const sep = new Set(o.separate || ['roof', 'planks']);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) cells.push(o.cell(x, y));
    const C = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? null : cells[y * W + x];
    const counts = {}; cells.forEach(c => { if (c && c.layer && !sep.has(c.layer)) counts[c.layer] = (counts[c.layer] || 0) + 1; });
    const splatLayers = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 4);
    const group = new THREE.Group(); group.name = 'gfxTerrain'; const tops = [];
    // --- splat weight texture (R px per tile) ---
    const R = 8, SW = W * R, SH = H * R; const data = new Uint8Array(SW * SH * 4); const nz = new Noise(o.seed || 3); const br = o.blend != null ? o.blend : 0.42;
    for (let py = 0; py < SH; py++) for (let px = 0; px < SW; px++) {
      const wx = (px + 0.5) / R, wz = (py + 0.5) / R; const tx = Math.floor(wx), ty = Math.floor(wz); const me = C(tx, ty); const w = [0, 0, 0, 0];
      const jit = nz.p(wx * 1.7, wz * 1.7, 256, 256) * 0.22 + nz.p(wx * 5.1, wz * 5.1, 256, 256) * 0.1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const c = C(tx + dx, ty + dy); if (!c || !c.layer) continue; const li = splatLayers.indexOf(c.layer); if (li < 0) continue;
        if (me && Math.abs((c.top || 0) - (me.top || 0)) > 0.05) continue;
        const ddx = Math.max(tx + dx - wx, 0, wx - (tx + dx + 1)), ddz = Math.max(ty + dy - wz, 0, wz - (ty + dy + 1)); const d = Math.hypot(ddx, ddz);
        const k = (dx === 0 && dy === 0) ? 1 : smooth(br, 0, d + jit * (c.blendBias || 1) + 0.05) * (c.spread || 1); w[li] = Math.max(w[li], k);
      }
      const sum = w[0] + w[1] + w[2] + w[3] || 1; const i = (py * SW + px) * 4; for (let k = 0; k < 4; k++) data[i + k] = w[k] / sum * 255;
    }
    const splat = new THREE.DataTexture(data, SW, SH, THREE.RGBAFormat); splat.magFilter = splat.minFilter = THREE.LinearFilter; splat.needsUpdate = true; splat.flipY = false;
    // --- tops ---
    const topBuf = {}; const quad = (arr, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) => arr.push(ax, ay, az, bx, by, bz, cx, cy, cz, ax, ay, az, cx, cy, cz, dx, dy, dz);
    cells.forEach((c, i) => { if (!c || !c.layer || c.noTop) return; const x = i % W, y = Math.floor(i / W); const key = splatLayers.includes(c.layer) ? '#splat' : c.layer; const arr = topBuf[key] || (topBuf[key] = []); quad(arr, x, c.top, y, x, c.top, y + 1, x + 1, c.top, y + 1, x + 1, c.top, y); });
    const mkGeo = (arr, nrm) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); const n = new Float32Array(arr.length); for (let i = 0; i < arr.length; i += 3) { n[i] = nrm ? nrm[i] : 0; n[i + 1] = nrm ? nrm[i + 1] : 1; n[i + 2] = nrm ? nrm[i + 2] : 0; } g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); const uv = new Float32Array(arr.length / 3 * 2); for (let i = 0, j = 0; i < arr.length; i += 3, j += 2) { uv[j] = arr[i] * 0.5; uv[j + 1] = arr[i + 2] * 0.5; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeBoundingSphere(); return g; };
    for (const key in topBuf) {
      const mat = key === '#splat' ? Materials.splat(splatLayers, splat, W, H, o) : Materials.terrain(key, { world: key === 'roof' ? 0.5 : 0.5 });
      const m = new THREE.Mesh(mkGeo(topBuf[key]), mat); m.receiveShadow = true; m.castShadow = false; m.name = 'gfxTop:' + key; group.add(m); tops.push(m);
    }
    // --- side / cliff faces ---
    const sideBuf = {};
    cells.forEach((c, i) => {
      if (!c) return; const x = i % W, y = Math.floor(i / W); const top = c.top;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const n = C(x + dx, y + dy); const nt = n ? n.top : bottom; if (nt >= top - 0.005) continue; const lo = Math.max(nt, bottom);
        const side = c.side || 'rock'; const b = sideBuf[side] || (sideBuf[side] = { p: [], n: [] });
        let ax, az, bx, bz; if (dy === -1) { ax = x + 1; az = y; bx = x; bz = y; } else if (dy === 1) { ax = x; az = y + 1; bx = x + 1; bz = y + 1; } else if (dx === 1) { ax = x + 1; az = y + 1; bx = x + 1; bz = y; } else { ax = x; az = y; bx = x; bz = y + 1; }
        { const ux = bx - ax, uz = bz - az; // flip winding when (A_lo,A_top,B_top) would face inward
          if (uz * dx - ux * dy < 0) quad(b.p, ax, lo, az, bx, lo, bz, bx, top, bz, ax, top, az); else quad(b.p, ax, lo, az, ax, top, az, bx, top, bz, bx, lo, bz); }
        for (let k = 0; k < 6; k++) b.n.push(dx, 0, dy);
      }
    });
    const sides = [];
    for (const key in sideBuf) { const m = new THREE.Mesh(mkGeo(sideBuf[key].p, sideBuf[key].n), Materials.terrain(key, { world: 0.5, color: o.sideTint && o.sideTint[key] })); m.receiveShadow = true; m.castShadow = true; m.name = 'gfxSide:' + key; group.add(m); sides.push(m); }
    return { group, tops, sides, splat, splatLayers };
  },
  /** water(cells [[x,y,surfaceY],...], opts) -> Mesh with shore foam (opts passed to Materials.water) */
  water(cells, opts) {
    const set = new Set(cells.map(c => c[0] + ',' + c[1])); const isW = (x, y) => set.has(x + ',' + y); const pos = [], shore = [];
    const sh = (vx, vz) => { const xs = Math.abs(vx - Math.round(vx)) < 1e-4 ? [Math.round(vx) - 1, Math.round(vx)] : [Math.floor(vx)]; const zs = Math.abs(vz - Math.round(vz)) < 1e-4 ? [Math.round(vz) - 1, Math.round(vz)] : [Math.floor(vz)]; for (const a of xs) for (const b of zs) if (!isW(a, b)) return 1; return 0; };
    for (const [x, y, s] of cells) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const x0 = x + i / 2, x1 = x + (i + 1) / 2, z0 = y + j / 2, z1 = y + (j + 1) / 2; const v = [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]];
      for (const [vx, vz] of v) { pos.push(vx, s, vz); shore.push(sh(vx, vz)); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('gfxShore', new THREE.Float32BufferAttribute(shore, 1));
    const n = new Float32Array(pos.length); for (let i = 1; i < n.length; i += 3) n[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, Materials.water(opts)); m.receiveShadow = true; m.name = 'gfxWater'; m.renderOrder = 1; return m;
  },
  /** lava(cells [[x,y,surfaceY],...], opts) -> Mesh (emissive animated) */
  lava(cells, opts) {
    const pos = []; for (const [x, y, s] of cells) pos.push(x, s, y, x, s, y + 1, x + 1, s, y + 1, x, s, y, x + 1, s, y + 1, x + 1, s, y);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const n = new Float32Array(pos.length); for (let i = 1; i < n.length; i += 3) n[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    const uv = new Float32Array(pos.length / 3 * 2); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, Materials.lava(opts)); m.receiveShadow = false; m.name = 'gfxLava'; return m;
  }
};

/* ======================================================================================
 * 10. Battle adapter — builds a whole map from the engine's battle object B (B.W, B.H, B.tile(x,y),
 *     B.map.base/id). Reads PF.TERR / PF.OBJ codes; touches nothing else.
 *     const built = PF.Gfx.Battle.build(B, {HL: 0.7, fx}); world.add(built.group);
 *     -> {group, pickables, emitters, preset, waterTiles, lavaTiles, dispose()}
 * ==================================================================================== */
const Battle = Gfx.Battle = {
  presetFor(map) {
    const id = map && map.id, base = map && map.base;
    return { forest: 'forest', river: 'grassDay', chapel: 'grassDay', tower: 'mountain', market: 'duskTown', crypt: 'cryptGloom', warrens: 'caveTorch', lava: 'volcanic', yard: 'grassDay' }[id] ||
      { grass: 'grassDay', dirt: 'grassDay', stone: 'duskTown', cave: 'caveTorch', ash: 'volcanic' }[base] || 'grassDay';
  },
  build(B, o) {
    o = o || {}; const HL = o.HL || 0.7; const W = B.W, H = B.H; const map = B.map || {}; const base = map.base || 'grass';
    const T = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? null : B.tile(x, y);
    const baseLayer = { grass: 'grass', dirt: 'dirt', stone: map.id === 'crypt' ? 'flagstone' : 'cobble', cave: 'cave', ash: 'ash' }[base] || 'grass';
    const builtSide = { stone: 'stoneWall', cave: 'rock', ash: 'rock' }[base] || 'rock';
    const surf = t => t.h * HL;
    const groundTop = t => { let top = surf(t); if (t.terr === 'w') top -= 0.18; if (t.terr === 'W') top -= 0.42; if (t.terr === 'L') top -= 0.12; return top; };
    const lowNb = (t) => { let lo = Infinity, lt = null; for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const n = T(t.x + dx, t.y + dy); if (n && n.terr !== '=' && groundTop(n) < lo) { lo = groundTop(n); lt = n; } } return { lo, lt }; };
    const group = new THREE.Group(); group.name = 'gfxBattle'; const props = new THREE.Group(); group.add(props);
    const pre = o.preset || Battle.presetFor(map); const mistC = o.mistColor || ({ caveTorch: [0.26, 0.29, 0.34], cryptGloom: [0.3, 0.34, 0.42], volcanic: [0.4, 0.3, 0.27] }[pre] || [0.72, 0.77, 0.82]);
    const waterCells = [], lavaCells = [], grass = [], emitters = [], fireHooks = []; const stairs = []; const info = {};
    const cell = (x, y) => {
      const t = T(x, y); let top = groundTop(t); let layer = baseLayer; let side = builtSide;
      switch (t.terr) {
        case ',': layer = 'path'; break; case ':': layer = 'flagstone'; side = 'stoneWall'; break; case '~': layer = 'mud'; break; case 'r': layer = 'rubble'; break;
        case 'w': layer = 'mud'; break; case 'W': layer = 'mud'; break; case '_': layer = 'cave'; side = 'rock'; break; case 'R': layer = 'roof'; side = 'stoneWall'; break;
        case 'F': layer = base === 'stone' ? 'flagstone' : baseLayer; break; case 'L': layer = null; break;
        case '=': { const { lo, lt } = lowNb(t); if (lo < top - 0.05) { top = lo; layer = lt.terr === 'w' || lt.terr === 'W' ? (lt.terr === 'w' ? 'sand' : 'mud') : lt.terr === '_' ? 'cave' : baseLayer; if (lt.water) info.bridgeWater = true; } else layer = 'planks'; break; }
        case '+': { const nb = [[0, -1, 'n'], [1, 0, 'e'], [0, 1, 's'], [-1, 0, 'w']].map(([dx, dy, d]) => { const n = T(x + dx, y + dy); return n ? { d, top: groundTop(n), n } : null; }).filter(Boolean);
          const hi = nb.filter(n => n.top > top + 0.05 && n.n.terr !== '+').sort((a, b) => b.top - a.top)[0]; const lo = nb.filter(n => n.top < top - 0.05 && n.n.terr !== '+').sort((a, b) => a.top - b.top)[0];
          layer = base === 'grass' || base === 'dirt' ? 'flagstone' : baseLayer; side = 'stoneWall';
          if (hi) stairs.push({ x, y, base: top, rise: hi.top - top, dir: hi.d }); else if (lo) { stairs.push({ x, y, base: lo.top, rise: top - lo.top, dir: { n: 's', s: 'n', e: 'w', w: 'e' }[lo.d] }); top = lo.top; }
          break; }
      }
      if (t.obj === '#' && base !== 'cave') side = base === 'stone' ? 'stoneWall' : 'rock';
      return { top, layer, side };
    };
    const tr = Terrain.build({ W, H, cell, bottom: -1.2, separate: ['roof', 'planks'], sideTint: { rock: base === 'cave' ? '#b0a69a' : undefined } });
    group.add(tr.group);
    // water / lava surfaces
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = T(x, y);
      if (t.water) waterCells.push([x, y, surf(t) - 0.06]);
      else if (t.terr === '=') { const { lt } = lowNb(t); if (lt && lt.water) waterCells.push([x, y, surf(lt) - 0.06]); }
      if (t.terr === 'L') lavaCells.push([x, y, surf(t) - 0.1]);
    }
    if (waterCells.length) group.add(Terrain.water(waterCells, o.water));
    if (lavaCells.length) group.add(Terrain.lava(lavaCells));
    // objects & deco
    const isObj = (x, y, ch) => { const t = T(x, y); return t && t.obj === ch; };
    const wallStyle = o.wallStyle || (base === 'cave' ? 'rock' : base === 'stone' ? 'stone' : 'ruin');
    const treeKinds = base === 'ash' ? ['dead'] : map.id === 'tower' ? ['pine', 'pine', 'oak'] : map.id === 'forest' ? ['oak', 'pine', 'oak', 'pine', 'dead'] : ['oak', 'oak', 'pine'];
    const place = (g, x, y, top) => { g.position.x += x + 0.5; g.position.z += y + 0.5; g.position.y += top; props.add(g); return g; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = T(x, y); const top = groundTop(t); const r = hash2(x, y, 31); const sd = x * 97 + y * 13;
      switch (t.obj) {
        case '#': { const nb = { n: isObj(x, y - 1, '#'), s: isObj(x, y + 1, '#'), e: isObj(x + 1, y, '#'), w: isObj(x - 1, y, '#') }; const g = Props.wall(nb, { x, y, style: wallStyle, height: wallStyle === 'rock' ? 2.4 + hash2(x, y, 5) * 0.6 : 2.4 }); g.position.set(x + 0.5, top, y + 0.5); props.add(g); break; }
        case 'P': place(base === 'cave' ? Props.make('stalagmite', { seed: sd }) : Props.make('pillar', { seed: sd, broken: wallStyle === 'ruin' && r < 0.35 }), x, y, top); break;
        case 'T': place(Foliage.tree(treeKinds[Math.floor(r * treeKinds.length)], { seed: sd }), x, y, top); break;
        case 's': place(Props.make('statue', { seed: sd, facing: hash2(x, y, 8) * 0.6 - 0.3 }), x, y, top); break;
        case 'c': place(Props.make('crate', { seed: sd }), x, y, top); break;
        case 'b': place(Props.make('barrel', { seed: sd }), x, y, top); break;
        case 'f': { let nb = { n: isObj(x, y - 1, 'f'), s: isObj(x, y + 1, 'f'), e: isObj(x + 1, y, 'f'), w: isObj(x - 1, y, 'f') }; if (!nb.n && !nb.s && !nb.e && !nb.w) nb = ((x + y) % 2) ? { e: 1, w: 1 } : { n: 1, s: 1 }; place(Props.wall(nb, { x, y, style: 'field', height: 0.62 }), 0, 0, top).position.set(x + 0.5, top, y + 0.5); break; }
        case 'o': place(Props.make('boulder', { seed: sd, moss: base !== 'ash' && base !== 'cave' }), x, y, top); break;
        case 'S': place(Props.make('sarcophagus', { seed: sd, facing: 0 }), x, y, top); break;
        case 'A': { const g = place(Props.make('altar', { seed: sd }), x, y, top); fireHooks.push(g); break; }
        case 't': place(Props.make('table', { seed: sd }), x, y, top); break;
      }
      if (!t.obj) {
        if (t.terr === ';') { place(Foliage.tree('bush', { seed: sd }), x + (r - 0.5) * 0.3, y + (hash2(x, y, 4) - 0.5) * 0.3, top); if (base !== 'cave') grass.push([x, y, top, 1]); }
        if (t.terr === 'r') place(Props.make('rubble', { seed: sd, small: r < 0.5 }), x, y, top);
        if (t.terr === '.' && (base === 'grass') && r < 0.75) grass.push([x, y, top, map.id === 'forest' ? 1 : 0.55]);
        if (t.terr === 'F' && o.fx) emitters.push(o.fx.emitter('mist', V3(x + 0.5, top, y + 0.5), { size: [1.1, 1.1], rate: 0.6, alpha: 0.12, color: mistC }));
      }
    }
    stairs.forEach(s => place(Props.make('stairs', { dir: s.dir, rise: s.rise, seed: s.x * 7 + s.y }), s.x, s.y, s.base));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = T(x, y); if (t.terr === '=') { const ns = (T(x, y - 1) && (T(x, y - 1).terr === '=' || !T(x, y - 1).water)) && (T(x, y + 1) && (T(x, y + 1).terr === '=' || !T(x, y + 1).water)); const g = Props.make('bridge', { dir: ns ? 'ns' : 'ew', seed: x * 5 + y, rails: !(T(x - 1, y) && T(x - 1, y).terr === '=' && T(x + 1, y) && T(x + 1, y).terr === '=') || ns }); place(g, x, y, surf(t)); } }
    if (grass.length) group.add(Foliage.grass(null, grass, { density: map.id === 'forest' ? 9 : 7 }));
    // torches on walls in dark maps
    if (o.fx && (base === 'cave' || map.id === 'crypt') && o.torches !== false) {
      let n = 0; const maxT = Math.max(0, (o.fx.lights.length || 6) - 2);
      for (let y = 1; y < H - 1 && n < maxT; y++) for (let x = 1; x < W - 1 && n < maxT; x++) {
        const t = T(x, y); if (t.obj || t.terr === '_' || t.terr === 'L' || hash2(x, y, 41) > 0.12) continue;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const w = T(x + dx, y + dy); if (w && w.obj === '#') { const g = Props.make('torch', { facing: Math.atan2(-dx, -dy) }); g.position.set(x + 0.5 + dx * 0.45 - 0, groundTop(t) - 0.15, y + 0.5 + dy * 0.45); props.add(g); g.updateMatrixWorld(true); fireHooks.push(g); n++; break; } }
      }
    }
    if (o.fx) { group.updateMatrixWorld(true); fireHooks.forEach(g => { g.updateMatrixWorld(true); emitters.push(...g.userData.attachFx(o.fx)); }); if (lavaCells.length) { const step = Math.max(1, Math.floor(lavaCells.length / 8)); for (let i = 0; i < lavaCells.length; i += step) { const [x, y, s] = lavaCells[i]; emitters.push(o.fx.emitter('lavaSmoke', V3(x + 0.5, s, y + 0.5), { size: [1.5, 1.5], rate: 0.5 })); emitters.push(o.fx.emitter('embers', V3(x + 0.5, s, y + 0.5), { size: [2, 2], rate: 0.4 })); } } }
    props.traverse(m => { if (m.isMesh && m.castShadow === undefined) m.castShadow = true; });
    return { group, pickables: tr.tops, terrain: tr, emitters, preset: Battle.presetFor(map), waterTiles: waterCells, lavaTiles: lavaCells,
      dispose() { emitters.forEach(e => e.stop()); group.parent && group.parent.remove(group); group.traverse(m => { if (m.geometry && !Object.values(Foliage._geo).includes(m.geometry)) m.geometry.dispose(); }); } };
  }
};

/* ======================================================================================
 * Shared per-frame update
 * ==================================================================================== */
Gfx.update = dt => { Gfx.uniforms.gfxTime.value += dt; };
})(typeof window !== 'undefined' ? window : globalThis);
