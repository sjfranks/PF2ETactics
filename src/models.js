/* models.js — procedural, rigged, animated miniatures for Three-Action Tactics (three.js r128 only).
 *
 * PUBLIC API  (window.PF.Models)
 *   create(desc)            -> Figure
 *   descForUnit(u)          -> desc     (heroes: u.kind==='pc'; monsters: everything else)
 *   descForCreature(name, traits, size, strikeNames, speeds) -> desc
 *   plans                   -> array of supported body-plan ids
 *   sizeScale(size)         -> numeric model scale for a size id (extra helper)
 *   normSize(size)          -> 'tiny'|'small'|'medium'|'large'|'huge'|'gargantuan' (accepts 'sm','med','lg','grg')
 *
 * Figure
 *   fig.group               THREE.Group; origin = centre of footprint at ground level, faces +Z, y up, 1 unit = 5 ft.
 *                           (The integrator may position/rotate/scale fig.group freely; the size scale lives on a child.)
 *   fig.height              world height of the top of the head (at the figure's size scale, standing / hovering)
 *   fig.update(dt)          advance idle / locomotion / flight cycles and the active clip
 *   fig.setMoving(on, speed)
 *   fig.play(name, opts)    -> { impact: Promise, done: Promise }
 *        'melee'  opts.style 'slash'|'overhead'|'thrust'|'bite'|'claw'|'slam'|'tail'|'unarmed'|'kick'|'sting'|'gore'
 *        'ranged' opts.style 'bow'|'crossbow'|'throw'|'spit'|'spike'|'ray'
 *        'cast'   opts.color (hex) glow colour      'breath' opts.color
 *        'hit'    opts.heavy                        'dodge'  'block'  'die'  'cheer'  'idleFlourish'  'stand'
 *        all clips accept opts.speed (playback multiplier, default 1)
 *   fig.setPose(p)          'stand' | 'prone' | 'down' | 'dead'   (smooth transition)
 *   fig.setShield(raised)   raise/lower shield (if any)
 *   fig.setFlying(on)       hover + flap for flyers (default = desc.fly)
 *   fig.dispose()
 *   NOTE: flyers hover by themselves (root lifted while flying); the integrator should NOT add its own lift.
 *   extras: fig.desc, fig.J (joint map), fig.pose, fig.flying, fig.meshCount, fig.anchor(name) -> world Vector3 for
 *           'head' | 'chest' | 'weapon' (tip) | 'handR' | 'handL' | 'mouth' (projectile / effect origins),
 *           fig.setTint(hex|null) optional emissive flash on all figure materials (cheap: one uniform per figure)
 *
 * DESC SCHEMA (all fields optional except plan)
 *   {
 *     plan:   one of PF.Models.plans:
 *             humanoid centaur ghost elemental tree | quadruped dragon drake linnorm biped bird bat hydra |
 *             spider scorpion crab insect centipede | serpent worm fish octopus | ooze aberration plant wisp hand object swarm
 *     name:   string (label only)
 *     size:   'tiny'|'small'|'medium'|'large'|'huge'|'gargantuan'
 *     scale:  extra multiplier on top of the size scale (default 1)
 *     seed:   integer for deterministic variation
 *     variant: plan-specific sub type, e.g. humanoid head 'human'|'elf'|'dwarf'|'gnome'|'halfling'|'goblin'|'orc'|
 *              'hobgoblin'|'kobold'|'lizard'|'frog'|'cat'|'rat'|'bird'|'snake'|'hyena'|'bugbear'|'skull'|'bull'|'fish'|'shark'...
 *              quadruped 'canine'|'feline'|'bear'|'boar'|'horse'|'rhino'|'elephant'|'rat'|'lizard'|'croc'|'owlbear'|'ape'...
 *     palette: { body, trim, skin, hair, eye, metal, accent, belly, glow, wing, horn }  (hex strings)
 *     build:  { height, bulk, head, arms, legs, hunch }  humanoid proportion multipliers
 *     outfit: 'plate'|'mail'|'leather'|'robe'|'monk'|'barbarian'|'bard'|'vest'|'rags'|'wraps'|'bones'|'none'|'fur'|'tabard'
 *     cls:    hero class id (drives gear)
 *     acc:    headgear 'helm'|'hood'|'hat'|'none'|'crown'|'wizard'|'feather'|'horned'|'antlers'|'redcap'|'headdress'
 *     weapon: weapon id (see WEAPONS table), offhand: weapon id or null, shield: null|'round'|'heater'|'tower'|'buckler'
 *     lower:  humanoid lower body 'legs'|'goat'|'snake'|'fish'|'horse'|'float'|'column'|'tentacles'|'roots'
 *     fly, swim, burrow: booleans (fly => hover/flap available); flyDefault:false => starts landed; floatFly => always floats, no flight toggle
 *     melee, ranged: default clip styles
 *     element: elemental plan 'fire'|'water'|'air'|'earth'|'metal'|'wood'
 *     stance: humanoid idle stance override 'zombie'|'claws'|'regal'|'hover'|'knuckle'
 *     beast: per-creature overrides of the BEASTV proportions table {len,hh,sh,g,leg,foot,neck,head,tail,...}
 *     arth: overrides of the ARTHV table (arthropods); beastVariant/beastPal: horse body for centaurs
 *     capType (leshy 'leaf'|'mushroom'|'gourd'), staffKind ('arcane'|'druid'|'bo'|'plain')
 *     f: feature flags { tail:'devil'|'reptile'|'kobold'|'cat'|'rat'|'fur'|'flame'|'stinger', wings:'bat'|'feather'|'insect'|'bone'|'flame',
 *          horns:'ram'|'curved'|'straight'|'bull'|'many'|'antler'|'single', dhorns (dragon horns 'swept'|'ram'|'many'|'forward'|'crown'),
 *          tusks, beard:'short'|'long', hairStyle, hair:false, ears, halo, glowEyes, snakeHair, cape:true|'tatter', collar, crown, quiver,
 *          lute, book, symbol, tabard, runes, wisps, pouches, leafCloak, flameHair, chestEye, chestMaw, ragged, claws, talons,
 *          mane, ruff, saber, spikes, ridge, shell, plates, armor, heads:n, headTypes:[...], neck:{n,len,ang,r}, stinger, quills,
 *          frill, frillD, noseHorn, barbels, unicorn, woolly, cover:'fur'|'scales'|'skin'|'hide'|'feather'|'stone'|'bone'|'metal'|'ghost'|'emis'|'glass'|'tar',
 *          flame (fire aura), tailFlame, hoverH, segments, thick, fins, crest, hood, teeth, flukes, snout, bigFin, stripes,
 *          tentacles:n, longArms, eyes:n, maw, float, debris, strings, stag, horn, hairy, metal, legsSmall, count (swarm) }
 *   }
 */
(function (G) {
'use strict';
const PF = G.PF = G.PF || {};
const THREE = G.THREE;
if (!THREE) { if (G.console) console.warn('models.js: THREE not loaded'); return; }

/* ============================================================ utilities */
const PI = Math.PI, TAU = PI * 2, HP = PI / 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const EASE = {
  lin: t => t,
  io: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  in: t => t * t * t,
  in2: t => t * t,
  out: t => 1 - Math.pow(1 - t, 3),
  out2: t => 1 - (1 - t) * (1 - t),
  snap: t => 1 - Math.pow(1 - t, 5),
  back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  sm: t => t * t * (3 - 2 * t)
};
function hashStr(s) { s = String(s || ''); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function shade(hex, f) { _c1.set(hex); if (f > 1) _c1.lerp(_c2.set('#ffffff'), Math.min(1, f - 1)); else _c1.multiplyScalar(f); return '#' + _c1.getHexString(); }
function mix(a, b, t) { _c1.set(a); _c1.lerp(_c2.set(b), t); return '#' + _c1.getHexString(); }
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

/* ============================================================ caches */
const GEO = {};
const geo = (key, fn) => GEO[key] || (GEO[key] = fn());
const q3 = v => Math.round(v * 1000) / 1000;
const U = {
  sphere: (w = 14, h = 10) => geo('s' + w + '_' + h, () => new THREE.SphereGeometry(1, w, h)),
  hemi: (w = 14, h = 6) => geo('hm' + w + h, () => new THREE.SphereGeometry(1, w, h, 0, TAU, 0, HP)),
  cyl: (seg = 12, rt = 1, rb = 1, open = false) => geo('c' + seg + '_' + q3(rt) + '_' + q3(rb) + open, () => new THREE.CylinderGeometry(rt, rb, 1, seg, 1, open)),
  cone: (seg = 10) => geo('cn' + seg, () => new THREE.ConeGeometry(1, 1, seg)),
  box: () => geo('box', () => new THREE.BoxGeometry(1, 1, 1)),
  ico: (d = 0) => geo('ico' + d, () => new THREE.IcosahedronGeometry(1, d)),
  dodec: () => geo('dod', () => new THREE.DodecahedronGeometry(1, 0)),
  oct: () => geo('oct', () => new THREE.OctahedronGeometry(1, 0)),
  torus: (tube = 0.2, rs = 6, ts = 16, arc = TAU) => geo('t' + q3(tube) + rs + ts + q3(arc), () => new THREE.TorusGeometry(1, tube, rs, ts, arc)),
  // rounded box (beveled) of real dimensions
  rbox: (w, h, d, r = 0.2) => geo('rb' + q3(w) + q3(h) + q3(d) + q3(r), () => {
    const rr = Math.min(w, h) * r; const s = new THREE.Shape();
    const x0 = -w / 2 + rr, y0 = -h / 2 + rr, x1 = w / 2 - rr, y1 = h / 2 - rr;
    s.moveTo(x0, -h / 2); s.lineTo(x1, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, y0); s.lineTo(w / 2, y1); s.quadraticCurveTo(w / 2, h / 2, x1, h / 2);
    s.lineTo(x0, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, y1); s.lineTo(-w / 2, y0); s.quadraticCurveTo(-w / 2, -h / 2, x0, -h / 2);
    const bv = Math.min(d * 0.3, rr * 0.8, 0.03);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * bv), bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.8, bevelSegments: 2, curveSegments: 3 });
    g.translate(0, 0, -(d - 2 * bv) / 2); return g;
  }),
  // tapered capsule hanging from y=0 down to y=-len, radii r1 (top) r2 (bottom), optional bulge (mid radius factor)
  limb: (r1, r2, len, bulge = 0, seg = 10) => geo('l' + q3(r1) + q3(r2) + q3(len) + q3(bulge) + seg, () => {
    const pts = []; const cap = 4;
    for (let i = 0; i <= cap; i++) { const a = -HP + (i / cap) * HP; pts.push(new THREE.Vector2(Math.cos(a) * r2 + 1e-4, -len + Math.sin(a) * r2 * 0.8)); }
    const mid = 5;
    for (let i = 1; i < mid; i++) { const t = i / mid; const b = Math.sin(t * PI) * bulge * (r1 + r2) * 0.5; pts.push(new THREE.Vector2(lerp(r2, r1, t) + b, -len + len * t)); }
    for (let i = 0; i <= cap; i++) { const a = (i / cap) * HP; pts.push(new THREE.Vector2(Math.cos(a) * r1 + 1e-4, Math.sin(a) * r1 * 0.8)); }
    return new THREE.LatheGeometry(pts, seg);
  }),
  // lathe from [[r,y],...] profile
  lathe: (key, prof, seg = 14, phiStart = 0, phiLen = TAU) => geo('la' + key + seg + q3(phiStart) + q3(phiLen), () => new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(Math.max(1e-4, p[0]), p[1])), seg, phiStart, phiLen)),
  // flat extruded shape from point list [[x,y],...] with thickness d
  shape: (key, pts, d = 0.02, bevel = 0.006) => geo('sh' + key + q3(d) + q3(bevel), () => {
    const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0005, d - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: 4 });
    g.translate(0, 0, -Math.max(0.0005, d - 2 * bevel) / 2); return g;
  }),
  // smooth shape (quadratic curves through pts)
  tube: (key, pts, r, seg = 16, rs = 6) => geo('tb' + key + q3(r) + seg + rs, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2]))), seg, r, rs, false))
};

/* ---------- canvas textures (bump / detail) */
const TEX = {};
function canvasTex(key, size, draw, repeat) {
  if (TEX[key]) return TEX[key];
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return (TEX[key] = t);
}
function noiseTex(key, size, fn, rep) {
  return canvasTex(key, size, (g, n) => {
    const im = g.createImageData(n, n); const r = rng(hashStr(key));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = clamp(fn(x, y, r, n), 0, 255); const i = (y * n + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
  }, rep);
}
const TX = {
  cloth: () => noiseTex('cloth', 64, (x, y, r) => 200 + ((x % 2) ^ (y % 2)) * 25 + r() * 30, [6, 6]),
  leather: () => noiseTex('leather', 64, (x, y, r) => 190 + r() * 60, [3, 3]),
  stone: () => canvasTex('stone', 128, (g, n) => { const r = rng(7); g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, n, n); for (let i = 0; i < 260; i++) { const v = Math.floor(120 + r() * 120); g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.arc(r() * n, r() * n, 2 + r() * 9, 0, TAU); g.fill(); } }, [2, 2]),
  fur: () => canvasTex('fur', 128, (g, n) => { const r = rng(9); g.fillStyle = '#909090'; g.fillRect(0, 0, n, n); for (let i = 0; i < 1400; i++) { const v = Math.floor(70 + r() * 170); g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1.2; const x = r() * n, y = r() * n; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + 6 + r() * 6); g.stroke(); } }, [3, 3]),
  scales: () => canvasTex('scales', 128, (g, n) => { g.fillStyle = '#808080'; g.fillRect(0, 0, n, n); const s = 16; for (let y = -1; y < n / s * 2 + 1; y++) for (let x = -1; x < n / s + 1; x++) { const cx = x * s + (y % 2 ? s / 2 : 0), cy = y * s / 2; const gr = g.createRadialGradient(cx, cy - 3, 1, cx, cy, s * 0.62); gr.addColorStop(0, '#e8e8e8'); gr.addColorStop(0.8, '#9a9a9a'); gr.addColorStop(1, '#404040'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, s * 0.6, 0, PI); g.fill(); } }, [4, 4]),
  mail: () => canvasTex('mail', 64, (g, n) => { g.fillStyle = '#505050'; g.fillRect(0, 0, n, n); g.strokeStyle = '#e0e0e0'; g.lineWidth = 1.5; const s = 8; for (let y = 0; y < n / s * 2 + 1; y++) for (let x = 0; x < n / s + 1; x++) { g.beginPath(); g.arc(x * s + (y % 2 ? s / 2 : 0), y * s / 2, s * 0.42, 0, TAU); g.stroke(); } }, [6, 6]),
  wrap: () => canvasTex('wrap', 64, (g, n) => { const r = rng(3); g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, n, n); for (let i = 0; i < 18; i++) { const y = r() * n; const v = Math.floor(120 + r() * 100); g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(0, y); g.lineTo(n, y + (r() - 0.5) * 18); g.stroke(); } }, [3, 5]),
  bark: () => canvasTex('bark', 128, (g, n) => { const r = rng(5); g.fillStyle = '#a0a0a0'; g.fillRect(0, 0, n, n); for (let i = 0; i < 90; i++) { const v = Math.floor(60 + r() * 120); g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1 + r() * 3; const x = r() * n; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 20, n / 3, x + (r() - 0.5) * 20, n * 2 / 3, x + (r() - 0.5) * 10, n); g.stroke(); } }, [2, 2]),
  feather: () => canvasTex('feather', 64, (g, n) => { g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, n, n); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const cx = x * 8 + (y % 2 ? 4 : 0), cy = y * 8; g.fillStyle = '#d8d8d8'; g.beginPath(); g.ellipse(cx, cy, 3.5, 6, 0, 0, PI); g.fill(); g.strokeStyle = '#606060'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + 6); g.stroke(); } }, [4, 4])
};

const MATS = {};
// palette hex values are authored in sRGB; the game renders with outputEncoding = sRGBEncoding, so convert to linear
const LINEAR = true;
/* mat(color, opts) — cached MeshStandardMaterial.
   opts: r roughness, m metalness, e emissive, ei emissiveIntensity, op opacity, ds doubleSide, flat, bump (TX key), bs bumpScale, add (additive), basic */
function mat(color, o) {
  o = o || {};
  const key = [color, o.r, o.m, o.e, o.ei, o.op, o.ds, o.flat, o.bump, o.bs, o.add, o.basic, o.dw].join('|');
  if (MATS[key]) return MATS[key];
  let m;
  if (o.basic) {
    m = new THREE.MeshBasicMaterial({ color, transparent: o.op != null && o.op < 1 || !!o.add, opacity: o.op != null ? o.op : 1, depthWrite: o.dw != null ? o.dw : !(o.op < 1 || o.add), side: o.ds ? THREE.DoubleSide : THREE.FrontSide, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending });
  } else {
    m = new THREE.MeshStandardMaterial({ color, roughness: o.r != null ? o.r : 0.8, metalness: o.m != null ? o.m : 0, flatShading: !!o.flat, side: o.ds ? THREE.DoubleSide : THREE.FrontSide });
    if (o.e) { m.emissive = new THREE.Color(o.e); m.emissiveIntensity = o.ei != null ? o.ei : 1; }
    if (o.op != null && o.op < 1) { m.transparent = true; m.opacity = o.op; m.depthWrite = o.dw != null ? o.dw : false; }
    if (o.bump && TX[o.bump]) { const t = TX[o.bump](); if (t) { m.bumpMap = t; m.bumpScale = o.bs != null ? o.bs : 0.004; } }
  }
  if (LINEAR) { m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); }
  m.userData.shared = true;
  return (MATS[key] = m);
}
const MT = {
  skin: c => mat(c, { r: 0.62 }),
  cloth: c => mat(c, { r: 0.92, bump: 'cloth', bs: 0.0025 }),
  clothDS: c => mat(c, { r: 0.92, ds: true, bump: 'cloth', bs: 0.0025 }),
  leather: c => mat(c, { r: 0.68, m: 0.05, bump: 'leather', bs: 0.003 }),
  metal: c => mat(c || '#b8bec6', { r: 0.32, m: 0.85 }),
  dmetal: c => mat(c || '#5a5f66', { r: 0.42, m: 0.8 }),
  mail: c => mat(c || '#8d939b', { r: 0.45, m: 0.75, bump: 'mail', bs: 0.006 }),
  gold: c => mat(c || '#d2a640', { r: 0.3, m: 0.9 }),
  wood: c => mat(c || '#6b4a2b', { r: 0.75, bump: 'bark', bs: 0.003 }),
  bone: c => mat(c || '#ddd3b8', { r: 0.6 }),
  fur: c => mat(c, { r: 0.98, bump: 'fur', bs: 0.012 }),
  stone: c => mat(c, { r: 0.95, flat: true, bump: 'stone', bs: 0.02 }),
  scales: c => mat(c, { r: 0.55, m: 0.08, bump: 'scales', bs: 0.01 }),
  wrap: c => mat(c || '#cfc4a5', { r: 0.95, bump: 'wrap', bs: 0.01 }),
  bark: c => mat(c || '#5a4330', { r: 0.95, bump: 'bark', bs: 0.02 }),
  feather: c => mat(c, { r: 0.9, bump: 'feather', bs: 0.01 }),
  featherDS: c => mat(c, { r: 0.9, ds: true, bump: 'feather', bs: 0.008 }),
  membrane: c => mat(c, { r: 0.75, ds: true }),
  eye: c => mat(c || '#111111', { r: 0.2, m: 0.1 }),
  glowEye: c => mat(c || '#ffdd55', { r: 0.4, e: c || '#ffdd55', ei: 2.2 }),
  emis: (c, ei) => mat(c, { r: 0.5, e: c, ei: ei != null ? ei : 1.4 }),
  ghost: (c, op) => mat(c, { r: 0.6, e: c, ei: 0.6, op: op != null ? op : 0.55, ds: false }),
  glass: (c, op) => mat(c, { r: 0.12, m: 0.1, op: op != null ? op : 0.55 }),
  teeth: () => mat('#f2ead8', { r: 0.4 }),
  horn: c => mat(c || '#d8ccb0', { r: 0.5 }),
  dark: () => mat('#141414', { r: 0.9 })
};

/* ============================================================ mesh helpers */
function add(parent, g, m, p, r, s) {
  const o = new THREE.Mesh(g, m);
  if (p) o.position.set(p[0], p[1], p[2]);
  if (r) o.rotation.set(r[0], r[1], r[2], r[3] || 'XYZ');
  if (s != null) { if (typeof s === 'number') o.scale.setScalar(s); else o.scale.set(s[0], s[1], s[2]); }
  o.castShadow = true; o.receiveShadow = true;
  parent.add(o); return o;
}
// ellipsoid
const ell = (parent, m, p, s, r) => add(parent, U.sphere(16, 12), m, p, r, s);
const grp = (parent, p, r) => { const g = new THREE.Group(); if (p) g.position.set(p[0], p[1], p[2]); if (r) g.rotation.set(r[0], r[1], r[2], r[3] || 'XYZ'); parent.add(g); return g; };
// cylinder between two points (local space of parent)
const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _vc = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
function rod(parent, m, a, b, r1, r2, seg) {
  _va.set(a[0], a[1], a[2]); _vb.set(b[0], b[1], b[2]); const len = _va.distanceTo(_vb);
  const o = add(parent, U.cyl(seg || 8, r2 != null ? r2 / r1 : 1, 1), m);
  o.scale.set(r1, len, r1); o.position.copy(_va).add(_vb).multiplyScalar(0.5);
  _vc.copy(_vb).sub(_va).normalize(); o.quaternion.setFromUnitVectors(_up, _vc);
  return o;
}
// cone pointing from a to b (base radius r at a)
function spike(parent, m, a, b, r, seg) {
  _va.set(a[0], a[1], a[2]); _vb.set(b[0], b[1], b[2]); const len = _va.distanceTo(_vb);
  const o = add(parent, U.cone(seg || 8), m); o.scale.set(r, len, r);
  o.position.copy(_va).add(_vb).multiplyScalar(0.5); _vc.copy(_vb).sub(_va).normalize(); o.quaternion.setFromUnitVectors(_up, _vc);
  return o;
}
// curved horn: tube along a bezier-ish curve with taper (implemented as chain of cones)
function horn(parent, m, pts, r0, seg) {
  const n = pts.length - 1; const out = [];
  for (let i = 0; i < n; i++) { const ra = r0 * (1 - i / n * 0.92), rb = r0 * (1 - (i + 1) / n * 0.92); out.push(rod(parent, m, pts[i], pts[i + 1], ra, i === n - 1 ? 0.001 : rb, seg || 7)); }
  return out;
}
const keep = o => { o.userData.keep = true; return o; };

/* ============================================================ figure runtime */
const PLANS = {};          // id -> { build(fig), family }
const FAM = {};            // family id -> { base(fig,dt), clips: {name: (fig, opts) => clipDef}, lie: {prone,down,dead}(fig) }
const SIZE_S = { tiny: 0.5, small: 0.72, medium: 1, large: 1.62, huge: 2.35, gargantuan: 3.1 };
const SIZE_N = { tiny: 'tiny', sm: 'small', small: 'small', med: 'medium', medium: 'medium', lg: 'large', large: 'large', huge: 'huge', grg: 'gargantuan', gargantuan: 'gargantuan', garg: 'gargantuan' };
const normSize = s => SIZE_N[String(s || 'medium').toLowerCase()] || 'medium';

const _m4 = new THREE.Matrix4(), _m4b = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3();

function Figure(desc) {
  this.desc = desc;
  this.rand = rng((desc.seed >>> 0) || hashStr(desc.name || desc.plan));
  this.group = new THREE.Group();
  this.group.name = 'fig:' + (desc.name || desc.plan);
  this.scaler = new THREE.Group(); this.group.add(this.scaler);
  this.S = SIZE_S[normSize(desc.size)] * (desc.scale || 1);
  this.scaler.scale.setScalar(this.S);
  this.J = {}; this.bones = [];
  this.root = this.bone('root', this.scaler, 0, 0, 0);
  this.t = Math.random() * 100; this.ph = Math.random() * TAU;
  this.moving = false; this.moveW = 0; this.speed = 0; this.phase = 0;
  this.flying = false; this.flyW = 0; this.canFly = !!desc.fly && !desc.floatFly; this.hover = 0;
  this.shieldUp = false; this.shieldW = 0;
  this.pose = 'stand'; this.lie = []; // [{name, w, target}]
  this.active = null; this.queue = [];
  this.updaters = []; this.ik = []; this.glow = []; this.perMats = [];
  this.stance = {}; this.stanceShield = null;
  this.height = 1.4;
  this.tint = null;
}
const FP = Figure.prototype;
FP.bone = function (name, parent, x, y, z) {
  const j = new THREE.Group(); j.name = name; j.userData.bone = true; j.position.set(x || 0, y || 0, z || 0);
  (parent || this.root).add(j); this.J[name] = j; this.bones.push(j); return j;
};
FP.finalize = function () {
  this.bones.forEach(b => { b.userData.r0 = b.rotation.clone(); b.userData.p0 = b.position.clone(); b.userData.o = new Float32Array(6); });
  if (this.canFly && this.desc.flyDefault !== false) this.setFlying(true, true);
};
FP.perMat = function (m) { const c = m.clone(); c.userData.shared = false; this.perMats.push(c); return c; };

/* ---------- pose layer ops (offsets relative to rest) */
FP.zeroOffsets = function () { const B = this.bones; for (let i = 0; i < B.length; i++) B[i].userData.o.fill(0); };
FP.addPose = function (pose, w) {
  if (!pose || w === 0) return;
  for (const k in pose) { const j = this.J[k]; if (!j) continue; const v = pose[k], o = j.userData.o; for (let i = 0; i < v.length; i++) o[i] += v[i] * w; }
};
FP.overPose = function (pose, w) {
  if (!pose || w === 0) return;
  for (const k in pose) { const j = this.J[k]; if (!j) continue; const v = pose[k], o = j.userData.o; for (let i = 0; i < 6; i++) o[i] += ((v[i] || 0) - o[i]) * w; }
};
FP.rot = function (name, x, y, z, w) { const j = this.J[name]; if (!j) return; const o = j.userData.o, k = w == null ? 1 : w; o[0] += x * k; o[1] += y * k; o[2] += z * k; };
FP.mov = function (name, x, y, z, w) { const j = this.J[name]; if (!j) return; const o = j.userData.o, k = w == null ? 1 : w; o[3] += x * k; o[4] += y * k; o[5] += z * k; };
FP.applyOffsets = function () {
  const B = this.bones;
  for (let i = 0; i < B.length; i++) {
    const b = B[i], u = b.userData, o = u.o, r = u.r0, p = u.p0;
    b.rotation.set(r.x + o[0], r.y + o[1], r.z + o[2]); b.position.set(p.x + o[3], p.y + o[4], p.z + o[5]);
  }
};

/* ---------- clip evaluation: keys = [[t, pose|'S'|'L', ease], ...] */
const _tmpPose = {};
function evalKeys(fig, clip, t) {
  const K = clip.keys; let i = 0;
  while (i < K.length - 2 && t > K[i + 1][0]) i++;
  const a = K[i], b = K[i + 1] || K[i];
  const span = b[0] - a[0]; let u = span > 0 ? clamp((t - a[0]) / span, 0, 1) : 1;
  u = (EASE[b[2] || 'io'] || EASE.io)(u);
  const pa = resolveKey(fig, clip, a[1]), pb = resolveKey(fig, clip, b[1]);
  for (const k in _tmpPose) delete _tmpPose[k];
  const joints = clip.joints;
  for (let n = 0; n < joints.length; n++) {
    const k = joints[n]; const va = pa[k], vb = pb[k];
    const out = _tmpPose[k] = [0, 0, 0, 0, 0, 0];
    for (let c = 0; c < 6; c++) out[c] = lerp(va ? (va[c] || 0) : 0, vb ? (vb[c] || 0) : 0, u);
  }
  return _tmpPose;
}
function resolveKey(fig, clip, p) {
  if (p === 'S') return fig.curStance;
  if (p === 'L') return clip.startPose || {};
  return p;
}
function prepClip(fig, c) {
  const js = {};
  c.keys.forEach(k => { const p = resolveKey(fig, c, k[1]); for (const j in p) js[j] = 1; });
  if (c.keys.some(k => k[1] === 'S')) for (const j in fig.curStance) js[j] = 1;
  c.joints = Object.keys(js);
  c.dur = c.keys[c.keys.length - 1][0];
  return c;
}

FP.update = function (dt) {
  dt = Math.min(dt || 0, 0.1);
  this.t += dt;
  // smoothed state weights
  const kk = 1 - Math.exp(-dt * 9);
  this.moveW += ((this.moving ? 1 : 0) - this.moveW) * (1 - Math.exp(-dt * 8));
  this.flyW += ((this.flying ? 1 : 0) - this.flyW) * (1 - Math.exp(-dt * 3));
  this.shieldW += ((this.shieldUp ? 1 : 0) - this.shieldW) * kk;
  for (let i = this.lie.length - 1; i >= 0; i--) {
    const L = this.lie[i]; const rate = dt / (L.dur || 0.45);
    L.w = L.target > L.w ? Math.min(L.target, L.w + rate) : Math.max(L.target, L.w - rate);
    if (L.w <= 0 && L.target === 0) this.lie.splice(i, 1);
  }
  const fam = FAM[this.fam];
  this.zeroOffsets();
  // stance (base pose)
  this.curStance = this.stanceShield && this.shieldW > 0.001 ? blendPose(this._stBuf || (this._stBuf = {}), this.stance, this.stanceShield, this.shieldW) : this.stance;
  this.overPose(this.curStance, 1);
  let lieW = 0; for (let i = 0; i < this.lie.length; i++) lieW = Math.max(lieW, EASE.sm(this.lie[i].w));
  this.lieW = lieW;
  let dw = 0; for (let i = 0; i < this.lie.length; i++) if (this.lie[i].name === 'dead') dw = Math.max(dw, EASE.sm(this.lie[i].w));
  this.deadW = dw;
  if (fam.base) fam.base(this, dt, 1 - lieW);
  for (let i = 0; i < this.lie.length; i++) { const L = this.lie[i]; if (L.pose) this.overPose(L.pose, EASE.sm(L.w)); }
  // active clip
  const A = this.active;
  if (A) {
    A.t += dt * (A.speed || 1);
    if (!A.impacted && A.t >= A.impactT) { A.impacted = true; A.resImpact(); if (A.onImpact) A.onImpact(this); }
    const env = A.mode === 'add' ? 1 : Math.min(1, A.fadeIn > 0 ? A.t / A.fadeIn : 1) * (A.fadeOut > 0 ? Math.min(1, (A.dur - A.t) / A.fadeOut) : 1);
    const p = evalKeys(this, A, Math.min(A.t, A.dur));
    if (A.mode === 'add') this.addPose(p, 1); else this.overPose(p, clamp(env, 0, 1));
    if (A.fn) A.fn(this, A.t, A);
    if (A.t >= A.dur) this.finishClip();
  }
  this.applyOffsets();
  if (this.ik.length || this.aimFn) this.solveIK();
  for (let i = 0; i < this.updaters.length; i++) this.updaters[i](this, dt);
};
function blendPose(out, a, b, w) {
  for (const k in out) delete out[k];
  const ks = {}; for (const k in a) ks[k] = 1; for (const k in b) ks[k] = 1;
  for (const k in ks) { const va = a[k], vb = b[k]; const o = out[k] = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < 6; i++) o[i] = lerp(va ? (va[i] || 0) : 0, vb ? (vb[i] || 0) : 0, w); }
  return out;
}

FP.finishClip = function () {
  const A = this.active; if (!A) return;
  this.active = null;
  if (!A.impacted) { A.impacted = true; A.resImpact(); }
  if (A.onEnd) A.onEnd(this, A);
  A.resDone();
};
FP.play = function (name, opts) {
  opts = opts || {};
  const fam = FAM[this.fam];
  let builder = fam.clips[name];
  if (!builder && name === 'idleFlourish') builder = fam.clips.cheer;
  if (!builder && name === 'breath') builder = fam.clips.cast;
  let clip = builder ? builder(this, opts) : null;
  if (!clip) clip = { keys: [[0, {}], [0.3, {}]], impact: 0.15 };
  if (this.active) this.finishClip();
  clip.t = 0; clip.speed = opts.speed || 1;
  clip.mode = clip.mode || 'over';
  clip.fadeIn = clip.fadeIn != null ? clip.fadeIn : 0.08; clip.fadeOut = clip.fadeOut != null ? clip.fadeOut : 0.12;
  prepClip(this, clip);
  clip.impactT = clip.impact != null ? clip.impact : clip.dur * 0.5;
  let resI, resD;
  const impact = new Promise(r => { resI = r; }), done = new Promise(r => { resD = r; });
  clip.resImpact = resI; clip.resDone = resD; clip.name = name;
  if (clip.onStart) clip.onStart(this, clip);
  this.active = clip;
  return { impact, done };
};

/* ---------- pose state */
FP.setPose = function (p, instant) {
  p = p || 'stand';
  if (p === this.pose && !instant) return;
  const fam = FAM[this.fam];
  this.pose = p;
  this.lie.forEach(L => { L.target = 0; if (instant) L.w = 0; });
  if (p !== 'stand') {
    const pose = fam.lie && fam.lie(this, p);
    this.lie.push({ name: p, pose, w: instant ? 1 : 0, target: 1, dur: p === 'dead' ? 0.6 : 0.45 });
  }
  if (instant) this.lie = this.lie.filter(L => L.target > 0);
  if (p !== 'stand' && this.flying) { this._wasFlying = true; this.flying = false; }
  if (p === 'stand' && this._wasFlying) { this._wasFlying = false; this.flying = true; }
  if (this.onPose) this.onPose(p);
};
FP.setMoving = function (on, speed) { this.moving = !!on; if (speed != null) this.speed = speed; else if (on && !this.speed) this.speed = 4; };
FP.setShield = function (on) { this.shieldUp = !!on && !!this.stanceShield; };
FP.setFlying = function (on, instant) {
  this.flying = !!on && this.canFly && this.pose === 'stand';
  if (instant) this.flyW = this.flying ? 1 : 0;
};
FP.dispose = function () {
  if (this.group.parent) this.group.parent.remove(this.group);
  this.perMats.forEach(m => m.dispose());
  this.group.traverse(o => { if (o.isMesh && o.userData.ownGeo) o.geometry.dispose(); });
  this.updaters = []; this.active = null;
};
FP.anchor = function (name) {
  this.group.updateMatrixWorld(true);
  const o = this.anchors && this.anchors[name] || this.J[name] || this.J.head || this.root;
  return o.getWorldPosition(new THREE.Vector3());
};
FP.setTint = function (hex) {
  // per-figure flash: swap to cloned materials lazily
  if (!this._tintMats) {
    this._tintMats = new Map();
    this.group.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { let c = this._tintMats.get(o.material); if (!c) { c = o.material.clone(); c.userData.base = o.material.emissive.clone(); c.userData.bi = o.material.emissiveIntensity; this._tintMats.set(o.material, c); this.perMats.push(c); } o.material = c; } });
  }
  this._tintMats.forEach(c => { if (hex) { c.emissive.set(hex).convertSRGBToLinear(); c.emissiveIntensity = 0.6; } else { c.emissive.copy(c.userData.base); c.emissiveIntensity = c.userData.bi; } });
};

/* ---------- IK (two-bone, swing based) */
function aimBoneAt(bone, childWorldPos, targetWorld, w) {
  // rotate bone (in world) so the direction to childWorldPos becomes the direction to targetWorld
  bone.getWorldPosition(_v1);
  _v2.copy(childWorldPos).sub(_v1).normalize();
  _v3.copy(targetWorld).sub(_v1).normalize();
  if (_v2.lengthSq() < 1e-8 || _v3.lengthSq() < 1e-8) return;
  _q1.setFromUnitVectors(_v2, _v3);
  bone.getWorldQuaternion(_q2);
  _q2.premultiply(_q1);
  bone.parent.getWorldQuaternion(_q3).invert();
  _q2.premultiply(_q3);
  if (w >= 1) bone.quaternion.copy(_q2); else bone.quaternion.slerp(_q2, w);
  bone.updateMatrixWorld(true);
}
FP.twoBone = function (upper, fore, hand, target, pole, w) {
  const S = upper.getWorldPosition(_v4).clone(), E = fore.getWorldPosition(_v5).clone(), H = hand.getWorldPosition(_v6).clone();
  const L1 = S.distanceTo(E), L2 = E.distanceTo(H);
  const d = S.distanceTo(target); const dd = clamp(d, Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.999);
  const dir = target.clone().sub(S).normalize();
  const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd); const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pv = pole.clone().sub(S); pv.sub(dir.clone().multiplyScalar(pv.dot(dir))); if (pv.lengthSq() < 1e-8) pv.set(0, -1, 0); pv.normalize();
  const Ep = S.clone().addScaledVector(dir, a).addScaledVector(pv, h);
  aimBoneAt(upper, E, Ep, w);
  const E2 = fore.getWorldPosition(new THREE.Vector3()), H2 = hand.getWorldPosition(new THREE.Vector3());
  const T2 = S.clone().addScaledVector(dir, dd);
  aimBoneAt(fore, H2, w >= 1 ? T2 : E2.clone().add(T2.clone().sub(E2).normalize().multiplyScalar(L2)).lerp(H2, 1 - w), 1);
};
FP.solveIK = function () {
  this.group.updateMatrixWorld(true);
  if (this.aimFn) this.aimFn(this);
  for (let i = 0; i < this.ik.length; i++) {
    const k = this.ik[i]; const w = typeof k.w === 'function' ? k.w(this) : k.w; if (w <= 0.001) continue;
    const tgt = k.target(this), pole = k.pole(this);
    this.twoBone(k.upper, k.fore, k.hand, tgt, pole, w);
    if (k.after) k.after(this, w);
  }
};
// root-space point -> world
FP.toWorld = function (x, y, z, out) { return (out || new THREE.Vector3()).set(x, y, z).applyMatrix4(this.scaler.matrixWorld); };
// set a bone's world orientation so that `attach` local frame matches a root-space basis
FP.orientBone = function (bone, qRoot, attachQ, w) {
  this.scaler.getWorldQuaternion(_q1); _q1.multiply(qRoot);           // desired world quat of attached frame
  if (attachQ) { _q2.copy(attachQ).invert(); _q1.multiply(_q2); }      // -> bone world quat
  bone.parent.getWorldQuaternion(_q3).invert(); _q1.premultiply(_q3);
  if (w >= 1) bone.quaternion.copy(_q1); else bone.quaternion.slerp(_q1, w);
  bone.updateMatrixWorld(true);
};

/* ---------- baking: merge static meshes per bone & material */
const BAKE = {};
function mergeGeos(items) {
  let nv = 0, ni = 0;
  items.forEach(it => { const g = it.g; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0; const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  items.forEach(it => {
    const g = it.g, m = it.m, P = g.attributes.position, N = g.attributes.normal, T = g.attributes.uv;
    nm.getNormalMatrix(m); const flip = m.determinant() < 0;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z; }
      if (T) { uv[(vo + i) * 2] = T.getX(i); uv[(vo + i) * 2 + 1] = T.getY(i); }
    }
    if (g.index) { const I = g.index.array; for (let i = 0; i < I.length; i += 3) { idx[io++] = I[i] + vo; if (flip) { idx[io++] = I[i + 2] + vo; idx[io++] = I[i + 1] + vo; } else { idx[io++] = I[i + 1] + vo; idx[io++] = I[i + 2] + vo; } } }
    else { for (let i = 0; i < P.count; i += 3) { idx[io++] = vo + i; if (flip) { idx[io++] = vo + i + 2; idx[io++] = vo + i + 1; } else { idx[io++] = vo + i + 1; idx[io++] = vo + i + 2; } } }
    vo += P.count;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
  return g;
}
FP.bake = function (key) {
  this.group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4();
  let meshes = 0;
  this.bones.forEach(b => {
    inv.copy(b.matrixWorld).invert();
    const groups = new Map();
    const visit = o => {
      for (let i = 0; i < o.children.length; i++) {
        const c = o.children[i];
        if (c.userData.bone) continue;
        if (c.isMesh && !c.isInstancedMesh && !c.userData.keep && c.material && c.material.userData.shared && c.visible) {
          const k = c.material.uuid + (c.castShadow ? 's' : 'n');
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push({ mesh: c, g: c.geometry, m: new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld) });
        }
        visit(c);
      }
    };
    visit(b);
    groups.forEach((list, k) => {
      const mkey = key + '|' + b.name + '|' + k;
      let g = key && BAKE[mkey];
      if (!g) { g = mergeGeos(list); if (key) BAKE[mkey] = g; }
      const m = new THREE.Mesh(g, list[0].mesh.material); m.castShadow = list[0].mesh.castShadow; m.receiveShadow = true;
      if (!key) m.userData.ownGeo = true;
      list.forEach(it => it.mesh.parent.remove(it.mesh));
      b.add(m); meshes++;
    });
  });
  let rest = 0; this.group.traverse(o => { if (o.isMesh) rest++; });
  this.meshCount = rest;
};

/* ---------- shared idle helpers */
function breathe(fig, w) {
  const t = fig.t + fig.ph, b = Math.sin(t * 1.7);
  fig.rot('chest', 0.025 * b * w, 0, 0); fig.rot('spine', -0.012 * b * w, 0, 0);
  fig.rot('neck', -0.015 * b * w, 0, 0);
  fig.rot('armL', 0.01 * b * w, 0, 0.015 * b * w); fig.rot('armR', 0.01 * b * w, 0, -0.015 * b * w);
}
/* ============================================================ HUMANOID body plan */
const HUMV = {
  human: { h: 1, w: 1, hs: 1, ears: 'human' },
  elf: { h: 1.07, w: 0.86, hs: 0.97, legs: 1.05, ears: 'elf' },
  dwarf: { h: 0.82, w: 1.32, hs: 1.12, legs: 0.72, arms: 0.9, ears: 'human' },
  gnome: { h: 0.98, w: 0.96, hs: 1.36, legs: 0.84, ears: 'gnome' },
  halfling: { h: 1.0, w: 0.96, hs: 1.16, legs: 0.92, ears: 'half' },
  goblin: { h: 0.94, w: 0.92, hs: 1.6, legs: 0.8, arms: 1.08, ears: 'goblin' },
  orc: { h: 1.06, w: 1.24, hs: 1.0, arms: 1.06, ears: 'orc' },
  hobgoblin: { h: 1.04, w: 1.08, ears: 'orc' },
  kobold: { h: 0.92, w: 0.9, hs: 1.25, legs: 0.86, ears: 'none' },
  lizard: { h: 1.06, w: 1.08, ears: 'none' },
  frog: { h: 0.95, w: 1.2, hs: 1.15, legs: 0.85, ears: 'none' },
  cat: { h: 1.02, w: 0.92, ears: 'none' },
  rat: { h: 0.95, w: 0.9, hs: 1.15, ears: 'none' },
  bird: { h: 1.0, w: 0.92, ears: 'none' },
  snake: { h: 1.04, w: 0.95, ears: 'none' },
  hyena: { h: 1.06, w: 1.1, ears: 'none' },
  bugbear: { h: 1.08, w: 1.25, hs: 1.05, arms: 1.12, ears: 'none' },
  skull: { h: 1, w: 0.62, hs: 0.95, ears: 'none' },
  bull: { h: 1.08, w: 1.4, hs: 1.1, arms: 1.06, ears: 'none' },
  fish: { h: 1.0, w: 1.0, ears: 'none' },
  shark: { h: 1.05, w: 1.12, ears: 'none' },
  ogre: { h: 1.0, w: 1.45, hs: 0.9, arms: 1.12, ears: 'human' },
  troll: { h: 1.02, w: 1.15, hs: 0.95, arms: 1.35, legs: 0.95, ears: 'orc' },
  giant: { h: 1.0, w: 1.25, hs: 0.92, arms: 1.05, ears: 'human' },
  cyclops: { h: 1.0, w: 1.35, hs: 1.0, arms: 1.08, ears: 'human' },
  oni: { h: 1.0, w: 1.3, hs: 0.95, ears: 'orc' },
  hag: { h: 0.95, w: 0.95, hs: 1.08, arms: 1.12, ears: 'human' },
  fiend: { h: 1.04, w: 1.12, ears: 'elf' },
  angel: { h: 1.08, w: 0.95, ears: 'human' },
  golem: { h: 1.0, w: 1.4, hs: 0.85, arms: 1.12, ears: 'none' },
  zombie: { h: 1, w: 1, ears: 'human' },
  ghoul: { h: 0.98, w: 0.82, arms: 1.12, ears: 'elf' },
  tree: { h: 1.05, w: 1.3, hs: 1.0, arms: 1.2, ears: 'none' },
  leshy: { h: 0.9, w: 1.0, hs: 1.5, legs: 0.7, ears: 'none' },
  insect: { h: 1.0, w: 0.95, ears: 'none' },
  doll: { h: 0.9, w: 1, hs: 1.5, legs: 0.75, ears: 'none' },
  ape: { h: 0.95, w: 1.35, hs: 1.0, arms: 1.3, legs: 0.8, ears: 'none' },
  boar: { h: 1.0, w: 1.2, ears: 'none' },
  pumpkin: { h: 1.0, w: 0.85, hs: 1.2, ears: 'none' }
};
const SKINS = {
  human: ['#e3b690', '#c98f66', '#8d5a3b', '#f1caa7', '#a8714d', '#d9a77e'],
  elf: ['#f0d4b8', '#e4bd9c', '#c9a07e', '#d8c0a8'],
  dwarf: ['#d9a07a', '#c4875f', '#a36e4f', '#e0ad88'],
  gnome: ['#f2c3a5', '#e8b090', '#d79c7c'],
  halfling: ['#e3b48c', '#c99467', '#a5734f'],
  goblin: ['#6f8f3a', '#7f9a40', '#8a8a3a', '#6a8a52'],
  orc: ['#6f8a50', '#7d8f5a', '#5f7a4a', '#8a9a6a', '#7a8466']
};
const HAIRS = ['#2a1d14', '#4a3020', '#6e4424', '#a8713a', '#d6b06a', '#161412', '#8a3a1a', '#bdb6aa', '#5a2a18'];
const GNOME_HAIRS = ['#d23c8a', '#3aa0d0', '#e07a20', '#7ad040', '#c040e0', '#f0d040'];

function hpart(fig, bone, g, m, p, r, s) { return add(fig.J[bone], g, m, p, r, s); }

function buildHumanoid(fig) {
  const d = fig.desc, f = d.f || (d.f = {}), pal = d.palette || (d.palette = {});
  const V = HUMV[d.variant] || HUMV.human, B = d.build || {};
  const h = (V.h || 1) * (B.height || 1), w = (V.w || 1) * (B.bulk || 1), hs = (V.hs || 1) * (B.head || 1);
  const legs = (V.legs || 1) * (B.legs || 1), arms = (V.arms || 1) * (B.arms || 1);
  const lower = d.lower || 'legs';
  fig.P = { h, w, hs, legs, arms, lower };
  const thigh = 0.34 * h * legs, shin = 0.33 * h * legs, ank = 0.06 * h;
  let hipY = ank + shin + thigh;
  const LOWER_HIP = { snake: 0.58, fish: 0.52, float: 0.62, column: 0.62, tentacles: 0.42, horse: 1.0, roots: 0.5 };
  if (LOWER_HIP[lower] != null) hipY = LOWER_HIP[lower] * h;
  if (lower === 'goat') hipY = (thigh + shin) * 0.86 + ank * 1.4;
  const J = (n, p, x, y, z) => fig.bone(n, p ? fig.J[p] : fig.root, x, y, z);
  J('hips', null, 0, hipY + 0.03 * h, 0);
  J('spine', 'hips', 0, 0.09 * h, 0); J('chest', 'spine', 0, 0.15 * h, 0); J('neck', 'chest', 0, 0.17 * h, 0); J('head', 'neck', 0, 0.06 * h, 0);
  const shX = 0.175 * w, up = 0.27 * h * arms, fo = 0.25 * h * arms;
  fig.P.up = up; fig.P.fo = fo; fig.P.shX = shX;
  J('armL', 'chest', shX, 0.145 * h, 0); J('foreL', 'armL', 0, -up, 0); J('handL', 'foreL', 0, -fo, 0);
  J('armR', 'chest', -shX, 0.145 * h, 0); J('foreR', 'armR', 0, -up, 0); J('handR', 'foreR', 0, -fo, 0);
  fig.J.armL.rotation.z = 0.1; fig.J.armR.rotation.z = -0.1; fig.J.foreL.rotation.x = -0.12; fig.J.foreR.rotation.x = -0.12;
  if (lower === 'legs' || lower === 'goat') {
    J('thighL', 'hips', 0.088 * w, -0.03 * h, 0); J('shinL', 'thighL', 0, -thigh, 0); J('footL', 'shinL', 0, -shin, 0);
    J('thighR', 'hips', -0.088 * w, -0.03 * h, 0); J('shinR', 'thighR', 0, -thigh, 0); J('footR', 'shinR', 0, -shin, 0);
    fig.J.thighL.rotation.z = 0.03; fig.J.thighR.rotation.z = -0.03;
    if (lower === 'goat') ['L', 'R'].forEach(s => { fig.J['thigh' + s].rotation.x = -0.45; fig.J['shin' + s].rotation.x = 1.05; fig.J['foot' + s].rotation.x = -0.6; });
  }
  fig.P.thigh = thigh; fig.P.shin = shin; fig.P.hipY = hipY;
  // ---------- materials
  const M = outfitMats(fig, d, pal);
  fig.M = M;
  // ---------- torso
  const tor = U.lathe('torso', [[0.11, -0.03], [0.135, 0.02], [0.152, 0.075], [0.158, 0.115], [0.15, 0.155], [0.118, 0.19], [0.06, 0.212], [0.035, 0.22]], 14);
  const abd = U.lathe('abd', [[0.112, -0.035], [0.118, 0.03], [0.116, 0.1], [0.12, 0.165]], 14);
  if (d.outfit !== 'bones') {
    hpart(fig, 'chest', tor, M.torso, [0, 0, 0], null, [w, h, w * 0.7 * (B.chest || 1)]);
    hpart(fig, 'spine', abd, M.abdomen, [0, 0, 0], null, [w * (B.belly || 1), h, w * 0.68 * (B.belly || 1)]);
    ell(fig.J.hips, M.pelvis, [0, -0.005 * h, 0], [0.13 * w, 0.085 * h, 0.095 * w]);
    if (B.belly > 1.1) ell(fig.J.spine, M.abdomen, [0, 0.06 * h, 0.04 * w], [0.13 * w * B.belly, 0.11 * h, 0.1 * w * B.belly]);
    hpart(fig, 'neck', U.cyl(10, 0.9, 1), M.neck || M.skin, [0, 0.03 * h, 0.005], null, [0.045 * w * (B.neck || 1), 0.1 * h, 0.045 * w * (B.neck || 1)]);
    ['L', 'R'].forEach(s => ell(fig.J['arm' + s], M.upper, [0, -0.01, 0], [0.058 * w, 0.06 * h, 0.06 * w]));
  } else buildSkeletonTorso(fig, h, w);
  // ---------- arms
  const thick = d.outfit === 'bones' ? 0.42 : (B.limb || 1);
  ['L', 'R'].forEach(s => {
    hpart(fig, 'arm' + s, U.limb(0.046 * w * thick, 0.038 * w * thick, up, 0.15), M.upper);
    hpart(fig, 'fore' + s, U.limb(0.039 * w * thick, 0.03 * w * thick, fo * 0.95, 0.2), M.fore);
    const hs2 = (B.hands || 1) * Math.max(0.9, w * 0.9);
    const hm = M.hand;
    ell(fig.J['hand' + s], hm, [0, -0.045 * hs2, 0.004], [0.033 * hs2, 0.052 * hs2, 0.042 * hs2]);
    ell(fig.J['hand' + s], hm, [(s === 'L' ? -1 : 1) * 0.022 * hs2, -0.035 * hs2, 0.025 * hs2], [0.014 * hs2, 0.028 * hs2, 0.014 * hs2], [0.5, 0, 0]);
    if (f.claws) for (let i = 0; i < 3; i++) spike(fig.J['hand' + s], MT.horn(pal.claw || '#e8e0cc'), [(i - 1) * 0.014 * hs2, -0.085 * hs2, 0.02], [(i - 1) * 0.016 * hs2, -0.13 * hs2, 0.045], 0.007);
  });
  // ---------- legs
  if (lower === 'legs' || lower === 'goat') {
    ['L', 'R'].forEach(s => {
      const goat = lower === 'goat';
      hpart(fig, 'thigh' + s, U.limb(0.068 * w * thick, 0.05 * w * thick, thigh, 0.15), M.thigh);
      hpart(fig, 'shin' + s, U.limb(0.05 * w * thick, 0.037 * w * thick, shin * (goat ? 0.95 : 1), 0.2), M.shin);
      ell(fig.J['shin' + s], M.knee || M.thigh, [0, 0.0, 0.012], [0.052 * w * thick, 0.05, 0.05 * w * thick]);
      if (goat) {
        hpart(fig, 'foot' + s, U.limb(0.035 * w, 0.03 * w, 0.1 * h, 0), M.shin);
        hpart(fig, 'foot' + s, U.cyl(8, 0.8, 1), MT.dark(), [0, -0.105 * h, 0.01], [0.6, 0, 0], [0.035 * w, 0.05, 0.04 * w]);
      } else if (M.footBare) {
        const fl = (d.variant === 'halfling' ? 1.3 : 1);
        ell(fig.J['foot' + s], M.foot, [0, -0.028, 0.05 * fl], [0.042 * w * fl, 0.03, 0.095 * fl]);
        if (f.talons || d.variant === 'bird' || d.variant === 'lizard' || d.variant === 'kobold') for (let i = 0; i < 3; i++) spike(fig.J['foot' + s], MT.horn('#2a2622'), [(i - 1) * 0.025, -0.04, 0.12], [(i - 1) * 0.035, -0.05, 0.18], 0.01);
      } else {
        hpart(fig, 'foot' + s, U.rbox(0.085 * w, 0.07, 0.19, 0.35), M.foot, [0, -0.026, 0.042]);
        if (M.bootTop) hpart(fig, 'shin' + s, U.cyl(10, 1.0, 0.9), M.bootTop, [0, -shin * 0.42, 0.0], null, [0.056 * w, 0.06, 0.056 * w]);
      }
    });
  } else buildLower(fig, lower);
  buildHead(fig);
  dressOutfit(fig);
  addFeatures(fig);
  equip(fig);
  humanoidStances(fig);
  fig.headTop = fig.headTop || (0.215 * hs);
}

function outfitMats(fig, d, pal) {
  const skin = MT.skin(pal.skin || '#d6ad88');
  const body = pal.body || '#6c7a8c', trim = pal.trim || '#c8a24a';
  const metalC = pal.metal || mix('#b9bfc7', body, 0.22);
  const pants = pal.pants || shade(mix(body, '#3a3028', 0.6), 0.85);
  const leatherC = pal.leather || '#5a3e28';
  const M = { skin, neck: skin, hand: skin, footBare: false, foot: MT.leather(shade(leatherC, 0.8)) };
  const o = d.outfit || 'vest';
  const clothB = MT.cloth(body), trimM = MT.cloth(trim), metal = MT.metal(metalC), mail = MT.mail(mix('#8d939b', body, 0.1));
  M.body = clothB; M.trim = trimM; M.trimMetal = MT.gold(mix(trim, '#d2a640', 0.3)); M.metal = metal; M.leather = MT.leather(leatherC); M.pants = MT.cloth(pants);
  const all = m => ({ skin: m, neck: m, torso: m, abdomen: m, pelvis: m, upper: m, fore: m, hand: m, thigh: m, shin: m, foot: m, footBare: true });
  switch (o) {
    case 'plate': Object.assign(M, { torso: metal, abdomen: metal, pelvis: mail, upper: metal, fore: metal, hand: MT.dmetal(shade(metalC, 0.7)), thigh: metal, shin: metal, foot: metal, knee: metal }); break;
    case 'mail': Object.assign(M, { torso: mail, abdomen: mail, pelvis: clothB, upper: mail, fore: MT.leather(leatherC), hand: MT.leather(shade(leatherC, 0.8)), thigh: M.pants, shin: MT.leather(shade(leatherC, 0.85)), foot: MT.leather(shade(leatherC, 0.75)) }); break;
    case 'leather': { const lc = MT.leather(mix(leatherC, body, 0.35)); Object.assign(M, { torso: lc, abdomen: lc, pelvis: M.pants, upper: clothB, fore: MT.leather(shade(leatherC, 0.9)), hand: MT.leather(shade(leatherC, 0.7)), thigh: M.pants, shin: MT.leather(shade(leatherC, 0.75)), foot: MT.leather(shade(leatherC, 0.65)) }); break; }
    case 'robe': Object.assign(M, { torso: clothB, abdomen: clothB, pelvis: clothB, upper: clothB, fore: clothB, hand: skin, thigh: M.pants, shin: M.pants, foot: MT.leather(shade(leatherC, 0.7)) }); break;
    case 'monk': Object.assign(M, { torso: clothB, abdomen: clothB, pelvis: MT.cloth(shade(body, 0.8)), upper: clothB, fore: skin, hand: MT.wrap('#e6dcc8'), thigh: MT.cloth(shade(body, 0.8)), shin: MT.wrap('#e6dcc8'), foot: skin, footBare: true }); break;
    case 'barbarian': Object.assign(M, { torso: skin, abdomen: skin, pelvis: MT.leather(leatherC), upper: skin, fore: skin, hand: skin, thigh: MT.leather(shade(leatherC, 0.9)), shin: MT.fur(pal.fur || '#6b5640'), foot: MT.fur(pal.fur || '#6b5640') }); break;
    case 'bard': Object.assign(M, { torso: clothB, abdomen: clothB, pelvis: M.pants, upper: trimM, fore: clothB, hand: MT.leather('#e8dcc8'), thigh: M.pants, shin: MT.leather(shade(leatherC, 0.6)), foot: MT.leather(shade(leatherC, 0.55)) }); break;
    case 'rags': { const rag = MT.cloth(mix(body, '#5a5040', 0.5)); Object.assign(M, { torso: rag, abdomen: rag, pelvis: rag, upper: skin, fore: skin, hand: skin, thigh: rag, shin: skin, foot: skin, footBare: true }); break; }
    case 'none': Object.assign(M, { torso: skin, abdomen: skin, pelvis: MT.leather(pal.loin || leatherC), upper: skin, fore: skin, hand: skin, thigh: skin, shin: skin, foot: skin, footBare: true }); break;
    case 'fur': { const fm = MT.fur(pal.skin || '#6b5640'); Object.assign(M, all(fm), { pelvis: MT.leather(pal.loin || leatherC) }); break; }
    case 'scales': { const sm = MT.scales(pal.skin || '#5f7a3a'); const bel = MT.skin(pal.belly || shade(pal.skin || '#5f7a3a', 1.35)); Object.assign(M, all(sm), { abdomen: bel, belly: bel, pelvis: MT.leather(pal.loin || leatherC) }); break; }
    case 'wraps': Object.assign(M, all(MT.wrap(pal.skin || '#c9bc98'))); break;
    case 'bones': Object.assign(M, all(MT.bone(pal.skin || '#ddd3b8'))); break;
    case 'stone': case 'metalbody': case 'clay': case 'wood': case 'flesh': {
      const c = pal.skin || '#8a8580';
      const sm = o === 'stone' ? MT.stone(c) : o === 'metalbody' ? mat(c, { r: 0.45, m: 0.75 }) : o === 'wood' ? MT.bark(c) : o === 'clay' ? mat(c, { r: 0.9, bump: 'stone', bs: 0.006 }) : MT.skin(c);
      Object.assign(M, all(sm)); break;
    }
    case 'ghost': Object.assign(M, all(fig.ghostMat)); break;
    default: // vest / tunic
      Object.assign(M, { torso: clothB, abdomen: clothB, pelvis: M.pants, upper: MT.cloth(shade(body, 0.85)), fore: skin, hand: skin, thigh: M.pants, shin: MT.leather(shade(leatherC, 0.8)), foot: MT.leather(shade(leatherC, 0.7)) });
  }
  const sk = pal.skinMat;
  if (sk) {
    const sm = sk === 'scales' ? MT.scales(pal.skin) : sk === 'fur' ? MT.fur(pal.skin) : sk === 'stone' ? MT.stone(pal.skin) : sk === 'emis' ? MT.emis(pal.skin, 0.9) : sk === 'glass' ? MT.glass(pal.skin, 0.6) : sk === 'bark' ? MT.bark(pal.skin) : sk === 'feather' ? MT.feather(pal.skin) : skin;
    ['torso', 'abdomen', 'upper', 'fore', 'hand', 'thigh', 'shin', 'foot', 'neck', 'pelvis'].forEach(k => { if (M[k] === skin) M[k] = sm; });
    M.skin = sm;
  }
  return M;
}

/* ---------- skeleton torso (ribcage, spine) */
function buildSkeletonTorso(fig, h, w) {
  const bm = fig.M.skin;
  rod(fig.J.spine, bm, [0, -0.04 * h, -0.03], [0, 0.17 * h, -0.04], 0.022, 0.02);
  rod(fig.J.chest, bm, [0, 0, -0.045], [0, 0.2 * h, -0.03], 0.02, 0.018);
  for (let i = 0; i < 5; i++) {
    const y = 0.03 * h + i * 0.034 * h, rr = (0.105 - Math.abs(i - 2.2) * 0.008) * 1.1;
    add(fig.J.chest, U.torus(0.1, 5, 14, PI * 1.55), bm, [0, y, -0.01], [HP, 0, -HP + PI * 0.225], [rr, rr * 0.72, rr]);
  }
  add(fig.J.chest, U.box(), bm, [0, 0.1 * h, 0.07], [0.15, 0, 0], [0.025, 0.12 * h, 0.012]);
  rod(fig.J.chest, bm, [0, 0.19 * h, 0.03], [0.16 * w, 0.17 * h, 0], 0.012, 0.012);
  rod(fig.J.chest, bm, [0, 0.19 * h, 0.03], [-0.16 * w, 0.17 * h, 0], 0.012, 0.012);
  add(fig.J.hips, U.torus(0.3, 6, 12), bm, [0, 0, 0], [HP, 0, 0], [0.085, 0.06, 0.08]);
  rod(fig.J.neck, bm, [0, -0.01, -0.01], [0, 0.07 * h, 0], 0.02, 0.018);
}

/* ---------- lower bodies for non-biped humanoids */
function buildLower(fig, lower) {
  const d = fig.desc, pal = d.palette, M = fig.M, P = fig.P, h = P.h, w = P.w;
  if (lower === 'snake' || lower === 'fish') {
    const n = lower === 'snake' ? 7 : 5;
    const mt = MT.scales(pal.tail || pal.skin || (lower === 'snake' ? '#5a7a3a' : '#3a8a8a'));
    const bel = MT.skin(pal.belly || shade(pal.tail || pal.skin || '#5a7a3a', 1.4));
    let parent = fig.J.hips; const r0 = 0.12 * w;
    const segL = (lower === 'snake' ? 0.2 : 0.17) * h;
    for (let i = 0; i < n; i++) {
      const b = fig.bone('tail' + i, parent, 0, i === 0 ? -0.02 : 0, i === 0 ? 0 : -segL);
      const rr = r0 * (1 - i / (n + (lower === 'snake' ? 1.5 : 2)));
      if (i > 2) b.rotation.y = lower === 'snake' ? 0.62 : 0;
      add(b, U.limb(rr, rr * 0.86, segL * 1.08, 0.05), mt, [0, 0, 0], [HP, 0, 0]);
      if (lower === 'snake') add(b, U.limb(rr * 0.9, rr * 0.78, segL, 0), bel, [0, -rr * 0.22, 0.0], [HP, 0, 0], [0.92, 1, 0.9]);
      parent = b;
    }
    if (lower === 'fish') {
      const fin = U.shape('tailfin', [[0, 0], [0.16, -0.18], [0.06, -0.08], [0, -0.1], [-0.06, -0.08], [-0.16, -0.18]], 0.012, 0.004);
      add(parent, fin, MT.membrane(pal.fin || shade(pal.tail || '#3a8a8a', 1.3)), [0, 0, -segL * 0.8], [HP, 0, 0], [1.4 * w, 1.6, 1]);
      fig.J.tail0.rotation.x = -1.5; fig.J.tail1.rotation.x = 0.25; fig.J.tail2.rotation.x = 1.05; fig.J.tail3.rotation.x = 0.45; fig.J.tail4.rotation.x = 0.4;
    } else {
      fig.J.tail0.rotation.x = -1.45; fig.J.tail1.rotation.x = 0.15; fig.J.tail2.rotation.x = 1.2;
    }
    fig.tailN = n; fig.lowerTail = lower;
  } else if (lower === 'float' || lower === 'column') {
    const mt = M.lowerMat || fig.ghostMat || M.pelvis;
    const b = fig.bone('tail0', fig.J.hips, 0, -0.05, 0);
    const b2 = fig.bone('tail1', b, 0, -0.25 * h, 0);
    add(b, U.lathe('wisp1', [[0.15, 0.08], [0.17, -0.02], [0.15, -0.15], [0.11, -0.26]], 12), mt, [0, 0, 0], null, [w, h, w]);
    add(b2, U.lathe('wisp2', [[0.11, 0.01], [0.08, -0.12], [0.04, -0.24], [0.005, -0.32]], 12), mt, [0, 0, 0], null, [w, h, w]);
    fig.floaty = true; fig.lowerTail = lower;
  } else if (lower === 'tentacles') {
    const mt = M.lowerMat || MT.skin(pal.tail || pal.skin || '#6a5a7a');
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * TAU; let p = fig.bone('tent' + k + '_0', fig.J.hips, Math.sin(a) * 0.08 * w, -0.05, Math.cos(a) * 0.08 * w);
      p.rotation.set(Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9);
      for (let i = 0; i < 3; i++) {
        const rr = 0.045 * w * (1 - i * 0.28);
        add(p, U.limb(rr, rr * 0.72, 0.15 * h, 0), mt);
        if (i < 2) { const n2 = fig.bone('tent' + k + '_' + (i + 1), p, 0, -0.15 * h, 0); n2.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35); p = n2; }
      }
    }
    fig.lowerTail = lower;
  } else if (lower === 'roots') {
    const mt = M.shin;
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * TAU + 0.3; const b = fig.bone('rootl' + k, fig.J.hips, Math.sin(a) * 0.08 * w, -0.05, Math.cos(a) * 0.08 * w);
      b.rotation.set(Math.cos(a) * 0.75, 0, -Math.sin(a) * 0.75);
      add(b, U.limb(0.07 * w, 0.025 * w, 0.55 * h, 0.1), mt);
    }
    fig.lowerTail = lower;
  } else if (lower === 'horse') {
    buildCentaurBody(fig);
  }
}

/* ---------- heads */
const V_ears = v => (HUMV[v] && HUMV[v].ears) || 'human';
function buildHead(fig) {
  const d = fig.desc, f = d.f, pal = d.palette, M = fig.M, P = fig.P, hs = P.hs;
  const hb = fig.J.head; const v = d.variant || 'human';
  const skin = M.skin; const eyeM = f.glowEyes ? MT.glowEye(pal.eye || '#ffcc33') : MT.eye(pal.eye || '#1a1410');
  fig.anchors = fig.anchors || {};
  const mouth = new THREE.Object3D(); mouth.position.set(0, 0.05 * hs, 0.11 * hs); hb.add(mouth); fig.anchors.mouth = mouth;
  const eyes = (y, z, x, s) => { const e = s || 0.016; ell(hb, eyeM, [x * hs, y * hs, z * hs], [e * hs, e * 0.8 * hs, e * 0.6 * hs]); ell(hb, eyeM, [-x * hs, y * hs, z * hs], [e * hs, e * 0.8 * hs, e * 0.6 * hs]); };
  const S = (x, y, z, sx, sy, sz, m, r) => ell(hb, m || skin, [x * hs, y * hs, z * hs], [sx * hs, sy * hs, sz * hs], r);
  const jaw = (len, wd, m) => { const j = fig.bone('jaw', hb, 0, 0.045 * hs, 0.02 * hs); ell(j, m || skin, [0, -0.012 * hs, len * 0.5 * hs], [wd * hs, 0.022 * hs, len * 0.55 * hs]); return j; };
  const humanFace = () => {
    S(0, 0.088, 0.004, 0.092, 0.108, 0.1);
    S(0, 0.04, 0.026, 0.07, 0.058, 0.075);
    S(0, 0.075, 0.098, 0.014, 0.024, 0.016);
    add(hb, U.box(), M.brow || mat(shade(pal.skin || '#d6ad88', 0.8), { r: 0.7 }), [0, 0.112 * hs, 0.085 * hs], [0.12, 0, 0], [0.085 * hs, 0.014 * hs, 0.02 * hs]);
    eyes(0.096, 0.086, 0.034, 0.015);
  };
  const ears = type => {
    if (type === 'human' || type === 'half') { S(0.093, 0.085, -0.004, 0.014, 0.03, 0.022); S(-0.093, 0.085, -0.004, 0.014, 0.03, 0.022); if (type === 'half') { spike(hb, skin, [0.09 * hs, 0.1 * hs, -0.01], [0.115 * hs, 0.135 * hs, -0.02 * hs], 0.012 * hs); spike(hb, skin, [-0.09 * hs, 0.1 * hs, -0.01], [-0.115 * hs, 0.135 * hs, -0.02 * hs], 0.012 * hs); } }
    else if (type === 'elf') { [1, -1].forEach(s => { const e = spike(hb, skin, [s * 0.085 * hs, 0.085 * hs, -0.005], [s * 0.17 * hs, 0.155 * hs, -0.06 * hs], 0.022 * hs); e.scale.z *= 0.45; }); }
    else if (type === 'gnome') { [1, -1].forEach(s => { const e = spike(hb, skin, [s * 0.085 * hs, 0.08 * hs, -0.005], [s * 0.15 * hs, 0.13 * hs, -0.05 * hs], 0.028 * hs); e.scale.z *= 0.45; }); }
    else if (type === 'goblin') { [1, -1].forEach(s => { const e = spike(hb, skin, [s * 0.075 * hs, 0.09 * hs, -0.005], [s * 0.26 * hs, 0.125 * hs, -0.04 * hs], 0.05 * hs); e.scale.z *= 0.35; }); }
    else if (type === 'orc') { [1, -1].forEach(s => { const e = spike(hb, skin, [s * 0.088 * hs, 0.085 * hs, -0.005], [s * 0.135 * hs, 0.13 * hs, -0.03 * hs], 0.024 * hs); e.scale.z *= 0.45; }); }
  };
  switch (v) {
    case 'kobold': case 'lizard': case 'snake': {
      const isK = v === 'kobold', isS = v === 'snake';
      S(0, 0.09, -0.01, isS ? 0.075 : 0.08, 0.08, 0.09);
      S(0, 0.075, 0.08, isS ? 0.055 : 0.05, 0.045, isS ? 0.09 : 0.1);
      jaw(isS ? 0.15 : 0.17, 0.045, M.belly || skin).position.z = 0.0;
      eyes(0.11, 0.06, 0.05, 0.016);
      if (isK) { [1, -1].forEach(s => horn(hb, MT.horn('#e8dcc0'), [[s * 0.04 * hs, 0.14 * hs, -0.03 * hs], [s * 0.06 * hs, 0.17 * hs, -0.09 * hs], [s * 0.07 * hs, 0.17 * hs, -0.14 * hs]], 0.015 * hs)); }
      if (v === 'lizard') for (let i = 0; i < 4; i++) spike(hb, MT.skin(pal.crest || '#c0502a'), [0, 0.16 * hs - i * 0.01, 0.02 * hs - i * 0.045 * hs], [0, 0.22 * hs - i * 0.015, -0.01 * hs - i * 0.045 * hs], 0.016 * hs);
      if (isS && f.hood) add(hb, U.sphere(12, 8), skin, [0, 0.04 * hs, -0.03 * hs], null, [0.17 * hs, 0.15 * hs, 0.03 * hs]);
      fig.anchors.mouth.position.set(0, 0.06 * hs, 0.2 * hs);
      fig.headTop = 0.19 * hs; break;
    }
    case 'frog': {
      S(0, 0.07, 0.02, 0.12, 0.07, 0.11);
      jaw(0.13, 0.11, MT.skin(pal.belly || '#c8c890')).position.set(0, 0.04 * hs, -0.02 * hs);
      [1, -1].forEach(s => { S(s * 0.065, 0.13, 0.05, 0.035, 0.035, 0.035); ell(hb, MT.eye('#d0a020'), [s * 0.07 * hs, 0.14 * hs, 0.075 * hs], [0.02 * hs, 0.02 * hs, 0.012 * hs]); });
      fig.headTop = 0.17 * hs; break;
    }
    case 'cat': case 'hyena': case 'rat': case 'boar': {
      S(0, 0.09, 0, 0.085, 0.09, 0.09);
      const snL = v === 'rat' ? 0.1 : v === 'hyena' ? 0.1 : v === 'boar' ? 0.11 : 0.05;
      S(0, 0.06, 0.07 + snL * 0.4, v === 'boar' ? 0.05 : 0.042, 0.036, snL * 0.7 + 0.02);
      S(0, 0.068, 0.09 + snL * 0.9, 0.018, 0.014, 0.012, MT.dark());
      if (v === 'boar') [1, -1].forEach(s => spike(hb, MT.horn('#efe6cf'), [s * 0.04 * hs, 0.035 * hs, 0.12 * hs], [s * 0.07 * hs, 0.11 * hs, 0.15 * hs], 0.012 * hs));
      eyes(0.11, 0.075, 0.04, 0.014);
      if (v === 'cat') [1, -1].forEach(s => { const e = spike(hb, skin, [s * 0.05 * hs, 0.15 * hs, 0], [s * 0.07 * hs, 0.23 * hs, -0.015 * hs], 0.035 * hs); e.scale.z *= 0.4; });
      else if (v === 'rat') [1, -1].forEach(s => S(s * 0.07, 0.17, -0.01, 0.04, 0.045, 0.01));
      else if (v === 'hyena') [1, -1].forEach(s => S(s * 0.06, 0.18, -0.02, 0.03, 0.05, 0.012));
      else [1, -1].forEach(s => { const e = spike(hb, skin, [s * 0.06 * hs, 0.15 * hs, 0], [s * 0.1 * hs, 0.2 * hs, -0.02 * hs], 0.03 * hs); e.scale.z *= 0.4; });
      if (v === 'hyena') for (let i = 0; i < 4; i++) spike(hb, MT.fur(pal.mane || '#3a2e22'), [0, 0.15 * hs - i * 0.02, -0.03 * hs - i * 0.04 * hs], [0, 0.2 * hs - i * 0.03, -0.07 * hs - i * 0.04 * hs], 0.02 * hs);
      jaw(snL + 0.06, 0.035);
      fig.anchors.mouth.position.set(0, 0.05 * hs, 0.14 * hs + snL);
      fig.headTop = 0.2 * hs; break;
    }
    case 'bird': {
      S(0, 0.09, 0, 0.085, 0.095, 0.09, MT.feather(pal.head || pal.skin || '#303030'));
      spike(hb, MT.horn(pal.beak || '#2a2622'), [0, 0.08 * hs, 0.06 * hs], [0, 0.04 * hs, 0.2 * hs], 0.035 * hs);
      eyes(0.11, 0.06, 0.055, 0.015);
      for (let i = 0; i < 3; i++) spike(hb, MT.feather(pal.head || pal.skin || '#303030'), [0, 0.16 * hs, -0.04 * hs], [0, 0.17 * hs + i * 0.02 * hs, -0.13 * hs - i * 0.02 * hs], 0.02 * hs);
      fig.anchors.mouth.position.set(0, 0.06 * hs, 0.2 * hs); fig.headTop = 0.19 * hs; break;
    }
    case 'fish': case 'shark': {
      S(0, 0.08, 0.02, 0.085, 0.1, 0.12);
      spike(hb, skin, [0, 0.12 * hs, 0.02 * hs], [0, 0.07 * hs, 0.17 * hs], 0.06 * hs).scale.x *= 0.85;
      eyes(0.11, 0.06, 0.075, 0.018);
      if (v === 'shark') add(hb, U.shape('dfin', [[0, 0], [0.04, 0.12], [0.11, 0]], 0.02, 0.006), skin, [0, 0.16 * hs, -0.06 * hs], [0, HP, 0], hs);
      jaw(0.14, 0.06, MT.skin(pal.belly || '#d8d8c8'));
      fig.headTop = 0.2 * hs; break;
    }
    case 'bull': {
      S(0, 0.09, 0, 0.095, 0.095, 0.1);
      S(0, 0.06, 0.1, 0.065, 0.055, 0.075);
      S(0, 0.055, 0.165, 0.05, 0.035, 0.02, MT.skin(shade(pal.skin || '#5a3a2a', 0.6)));
      eyes(0.11, 0.075, 0.055, 0.014);
      [1, -1].forEach(s => { S(s * 0.1, 0.12, -0.01, 0.035, 0.015, 0.025); horn(hb, MT.horn('#e8dcc0'), [[s * 0.07 * hs, 0.15 * hs, 0], [s * 0.17 * hs, 0.17 * hs, 0.02 * hs], [s * 0.22 * hs, 0.26 * hs, 0.05 * hs], [s * 0.2 * hs, 0.33 * hs, 0.08 * hs]], 0.03 * hs); });
      jaw(0.14, 0.05);
      fig.anchors.mouth.position.set(0, 0.05 * hs, 0.2 * hs); fig.headTop = 0.3 * hs; break;
    }
    case 'skull': {
      const bm = MT.bone(pal.bone || '#ddd3b8');
      S(0, 0.1, 0, 0.088, 0.098, 0.1, bm);
      S(0, 0.05, 0.05, 0.06, 0.04, 0.05, bm);
      const dk = MT.dark(); [1, -1].forEach(s => S(s * 0.034, 0.095, 0.075, 0.024, 0.024, 0.02, dk));
      S(0, 0.06, 0.098, 0.012, 0.016, 0.01, dk);
      if (f.glowEyes) eyes(0.095, 0.092, 0.034, 0.011);
      const j = fig.bone('jaw', hb, 0, 0.04 * hs, 0.01 * hs); ell(j, bm, [0, -0.01 * hs, 0.045 * hs], [0.055 * hs, 0.02 * hs, 0.05 * hs]);
      for (let i = 0; i < 6; i++) add(hb, U.box(), MT.teeth(), [(i - 2.5) * 0.012 * hs, 0.032 * hs, 0.093 * hs - Math.abs(i - 2.5) * 0.006 * hs], null, [0.008 * hs, 0.014 * hs, 0.006 * hs]);
      fig.headTop = 0.2 * hs; break;
    }
    case 'insect': {
      S(0, 0.08, 0.02, 0.07, 0.09, 0.08);
      [1, -1].forEach(s => { ell(hb, MT.glass(pal.eye || '#a01818', 0.95), [s * 0.055 * hs, 0.1 * hs, 0.05 * hs], [0.04 * hs, 0.05 * hs, 0.04 * hs]); spike(hb, MT.horn('#2a2620'), [s * 0.025 * hs, 0.03 * hs, 0.08 * hs], [s * 0.005 * hs, 0.0, 0.13 * hs], 0.012 * hs); horn(hb, MT.dark(), [[s * 0.02 * hs, 0.16 * hs, 0.04 * hs], [s * 0.06 * hs, 0.25 * hs, 0.08 * hs], [s * 0.12 * hs, 0.3 * hs, 0.06 * hs]], 0.006 * hs); });
      fig.headTop = 0.24 * hs; break;
    }
    case 'pumpkin': {
      const pm = mat(pal.head || '#d4762a', { r: 0.7 });
      for (let i = 0; i < 6; i++) ell(hb, pm, [Math.sin(i / 6 * TAU) * 0.04 * hs, 0.1 * hs, Math.cos(i / 6 * TAU) * 0.04 * hs], [0.07 * hs, 0.09 * hs, 0.07 * hs]);
      rod(hb, MT.wood('#4a5a2a'), [0, 0.18 * hs, 0], [0.01, 0.23 * hs, 0.01], 0.012 * hs, 0.01 * hs);
      const em = MT.emis('#ffb020', 2.0); [1, -1].forEach(s => add(hb, U.cone(3), em, [s * 0.035 * hs, 0.12 * hs, 0.105 * hs], [HP, 0, 0], [0.018 * hs, 0.01 * hs, 0.018 * hs]));
      add(hb, U.box(), em, [0, 0.065 * hs, 0.108 * hs], null, [0.06 * hs, 0.012 * hs, 0.01 * hs]);
      fig.headTop = 0.23 * hs; break;
    }
    case 'tree': {
      const lm = mat(pal.leaf || '#4a7a2a', { r: 0.9, flat: true });
      S(0, 0.06, 0.0, 0.09, 0.1, 0.08, M.skin);
      [1, -1].forEach(s => ell(hb, MT.glowEye(pal.eye || '#c8ff60'), [s * 0.035 * hs, 0.08 * hs, 0.07 * hs], [0.012 * hs, 0.01 * hs, 0.006 * hs]));
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; add(hb, U.ico(0), lm, [Math.sin(a) * 0.12 * hs, 0.2 * hs + (i % 2) * 0.06 * hs, Math.cos(a) * 0.1 * hs], [i, i * 2, 0], 0.11 * hs); }
      add(hb, U.ico(0), lm, [0, 0.3 * hs, 0], null, 0.14 * hs);
      fig.headTop = 0.42 * hs; break;
    }
    case 'leshy': {
      const lm = mat(pal.leaf || '#5a8a2a', { r: 0.85, ds: true });
      S(0, 0.09, 0, 0.1, 0.1, 0.1, M.skin);
      eyes(0.1, 0.085, 0.035, 0.016);
      const cap = d.capType || 'leaf';
      if (cap === 'mushroom') { add(hb, U.lathe('mcap', [[0.001, 0.08], [0.08, 0.075], [0.16, 0.03], [0.17, 0.0], [0.12, 0.005], [0.001, 0.01]], 14), mat(pal.leaf || '#b84a3a', { r: 0.7 }), [0, 0.15 * hs, 0], null, hs); for (let i = 0; i < 5; i++) ell(hb, mat('#f0e6d0'), [Math.sin(i * 1.3) * 0.08 * hs, 0.22 * hs, Math.cos(i * 1.3) * 0.08 * hs], 0.018 * hs); }
      else if (cap === 'gourd') { ell(hb, mat(pal.leaf || '#d08a2a', { r: 0.6 }), [0, 0.11 * hs, 0], [0.12 * hs, 0.11 * hs, 0.12 * hs]); rod(hb, MT.wood(), [0, 0.2 * hs, 0], [0.02, 0.27 * hs, 0], 0.015 * hs, 0.01 * hs); eyes(0.12, 0.11, 0.04, 0.018); }
      else for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; add(hb, U.sphere(8, 6), lm, [Math.sin(a) * 0.08 * hs, 0.17 * hs, Math.cos(a) * 0.08 * hs], [Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9], [0.05 * hs, 0.13 * hs, 0.012 * hs]); }
      fig.headTop = 0.27 * hs; break;
    }
    case 'doll': {
      S(0, 0.09, 0, 0.095, 0.1, 0.095, mat(pal.skin || '#f0dcc8', { r: 0.4 }));
      [1, -1].forEach(s => add(hb, U.cyl(10), MT.dark(), [s * 0.035 * hs, 0.1 * hs, 0.088 * hs], [HP, 0, 0], [0.016 * hs, 0.008, 0.016 * hs]));
      add(hb, U.box(), mat('#a02020'), [0, 0.055 * hs, 0.09 * hs], null, [0.03 * hs, 0.006 * hs, 0.005]);
      fig.headTop = 0.2 * hs; break;
    }
    case 'golem': {
      add(hb, U.rbox(0.15, 0.14, 0.15, 0.2), M.skin, [0, 0.07 * hs, 0.01], null, hs);
      [1, -1].forEach(s => ell(hb, MT.glowEye(pal.eye || '#ffb030'), [s * 0.035 * hs, 0.085 * hs, 0.083 * hs], [0.016 * hs, 0.01 * hs, 0.006 * hs]));
      fig.headTop = 0.15 * hs; break;
    }
    case 'ape': {
      S(0, 0.085, -0.01, 0.09, 0.09, 0.09);
      S(0, 0.055, 0.07, 0.07, 0.05, 0.05, MT.skin(pal.face || '#3a3430'));
      add(hb, U.box(), M.skin, [0, 0.11 * hs, 0.075 * hs], null, [0.11 * hs, 0.025 * hs, 0.03 * hs]);
      eyes(0.095, 0.085, 0.03, 0.012);
      fig.headTop = 0.18 * hs; break;
    }
    case 'none': { fig.headTop = 0.02; break; }
    default: {
      humanFace();
      ears(f.ears || V_ears(v));
      if (v === 'goblin') {
        S(0, 0.05, 0.055, 0.075, 0.03, 0.05);
        for (let i = 0; i < 5; i++) add(hb, U.cone(4), MT.teeth(), [(i - 2) * 0.02 * hs, 0.032 * hs, 0.095 * hs], [PI, 0, 0], [0.007 * hs, 0.016 * hs, 0.007 * hs]);
        S(0, 0.08, 0.11, 0.022, 0.022, 0.03);
      }
      if (v === 'orc' || v === 'oni' || f.tusks) [1, -1].forEach(s => spike(hb, MT.teeth(), [s * 0.03 * hs, 0.03 * hs, 0.08 * hs], [s * 0.04 * hs, 0.075 * hs, 0.095 * hs], 0.011 * hs));
      if (['orc', 'ogre', 'troll', 'hobgoblin', 'oni', 'giant'].includes(v)) add(hb, U.box(), M.skin, [0, 0.117 * hs, 0.083 * hs], [0.2, 0, 0], [0.1 * hs, 0.022 * hs, 0.03 * hs]);
      if (v === 'troll' || v === 'hag') spike(hb, M.skin, [0, 0.085 * hs, 0.09 * hs], [0, 0.04 * hs, 0.17 * hs], 0.02 * hs);
      if (v === 'cyclops') { const dk = MT.skin(shade(pal.skin || '#a08070', 0.8)); S(0, 0.098, 0.086, 0.04, 0.032, 0.02, dk); ell(hb, MT.eye('#f0f0e8'), [0, 0.098 * hs, 0.092 * hs], [0.028 * hs, 0.024 * hs, 0.016 * hs]); ell(hb, MT.eye('#3a2a10'), [0, 0.098 * hs, 0.105 * hs], [0.012 * hs, 0.012 * hs, 0.006 * hs]); }
    }
  }
  if (f.horns) addHorns(fig, hb, f.horns, hs);
  if (f.hair !== false && ['human', 'elf', 'dwarf', 'gnome', 'halfling', 'goblin', 'orc', 'hobgoblin', 'giant', 'ogre', 'troll', 'cyclops', 'oni', 'hag', 'fiend', 'angel', 'zombie', 'ghoul'].includes(v)) addHair(fig);
  if (f.snakeHair) { const sm = MT.scales(pal.hair || '#4a7a3a'); for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 1.6 - PI * 0.8; const x = Math.sin(a) * 0.08 * hs, z = -Math.cos(a) * 0.06 * hs; horn(hb, sm, [[x, 0.16 * hs, z], [x * 1.6, 0.21 * hs, z * 1.3 - 0.02], [x * 2.0, 0.19 * hs, z * 1.7 - 0.06 * hs], [x * 2.2, 0.24 * hs, z * 2 - 0.07 * hs]], 0.014 * hs); } }
  if (f.halo) { const hm = MT.emis(pal.halo || '#ffe58a', 1.6); const o = add(hb, U.torus(0.08, 6, 24), hm, [0, 0.28 * hs, -0.03 * hs], [HP - 0.25, 0, 0], 0.1 * hs); o.castShadow = false; fig.headTop = Math.max(fig.headTop || 0, 0.3 * hs); }
}

function addHorns(fig, hb, type, hs) {
  const pal = fig.desc.palette; const hm = MT.horn(pal.horn || '#2e2620');
  [1, -1].forEach(s => {
    if (type === 'ram') horn(hb, hm, [[s * 0.07 * hs, 0.16 * hs, 0], [s * 0.12 * hs, 0.2 * hs, -0.06 * hs], [s * 0.15 * hs, 0.14 * hs, -0.1 * hs], [s * 0.15 * hs, 0.07 * hs, -0.06 * hs], [s * 0.13 * hs, 0.06 * hs, 0.01 * hs]], 0.03 * hs);
    else if (type === 'curved') horn(hb, hm, [[s * 0.05 * hs, 0.17 * hs, 0.02 * hs], [s * 0.08 * hs, 0.24 * hs, -0.04 * hs], [s * 0.09 * hs, 0.28 * hs, -0.12 * hs], [s * 0.08 * hs, 0.27 * hs, -0.19 * hs]], 0.026 * hs);
    else if (type === 'straight') horn(hb, hm, [[s * 0.045 * hs, 0.17 * hs, 0.03 * hs], [s * 0.06 * hs, 0.24 * hs, 0.0], [s * 0.07 * hs, 0.3 * hs, -0.04 * hs]], 0.02 * hs);
    else if (type === 'bull') horn(hb, hm, [[s * 0.07 * hs, 0.15 * hs, 0], [s * 0.16 * hs, 0.17 * hs, 0.02 * hs], [s * 0.21 * hs, 0.24 * hs, 0.05 * hs], [s * 0.2 * hs, 0.3 * hs, 0.07 * hs]], 0.028 * hs);
    else if (type === 'many') { for (let i = 0; i < 2; i++) spike(hb, hm, [s * (0.03 + i * 0.04) * hs, 0.17 * hs, (0.03 - i * 0.04) * hs], [s * (0.04 + i * 0.05) * hs, 0.24 * hs, (0.02 - i * 0.05) * hs], 0.014 * hs); }
    else if (type === 'antler') { const am = MT.horn('#8a6a4a'); horn(hb, am, [[s * 0.05 * hs, 0.16 * hs, 0], [s * 0.1 * hs, 0.24 * hs, -0.02 * hs], [s * 0.16 * hs, 0.33 * hs, -0.03 * hs]], 0.014 * hs); rod(hb, am, [s * 0.1 * hs, 0.24 * hs, -0.02 * hs], [s * 0.08 * hs, 0.32 * hs, 0.02 * hs], 0.008 * hs, 0.004 * hs); rod(hb, am, [s * 0.14 * hs, 0.3 * hs, -0.03 * hs], [s * 0.2 * hs, 0.34 * hs, 0.0], 0.007 * hs, 0.003 * hs); }
  });
  if (type === 'single') spike(hb, MT.horn(pal.horn || '#e8e0d0'), [0, 0.17 * hs, 0.06 * hs], [0, 0.32 * hs, 0.1 * hs], 0.025 * hs);
  fig.headTop = Math.max(fig.headTop || 0, type === 'antler' ? 0.34 * hs : 0.28 * hs);
}

function addHair(fig) {
  const d = fig.desc, f = d.f, pal = d.palette, hb = fig.J.head, hs = fig.P.hs, r = fig.rand, v = d.variant;
  const hm = mat(pal.hair || '#3a2a1a', { r: 0.85, bump: 'fur', bs: 0.004 });
  let style = f.hairStyle || pick(r, ['short', 'short', 'long', 'pony', 'bun', 'crop']);
  const covered = d.acc === 'helm' || d.acc === 'hood' || d.acc === 'hat' || d.acc === 'wizard' || d.acc === 'feather';
  if (covered) style = (style === 'long' || style === 'pony') ? 'long' : 'none';
  if ((v === 'goblin' || v === 'zombie' || v === 'ghoul') && !f.hairStyle) style = pick(r, ['none', 'tuft', 'wild']);
  if (v === 'hag') style = 'wild';
  const capGeo = geo('haircap', () => new THREE.SphereGeometry(1, 16, 10, 0, TAU, 0, PI * 0.55));
  const capP = () => add(hb, capGeo, hm, [0, 0.092 * hs, -0.004 * hs], [-0.35, 0, 0], [0.1 * hs, 0.112 * hs, 0.108 * hs]);
  if ((style === 'short' || style === 'crop') && !covered) capP();
  if (style === 'long') { if (!covered) capP(); ell(hb, hm, [0, 0.03 * hs, -0.06 * hs], [0.085 * hs, 0.12 * hs, 0.05 * hs]); }
  if (style === 'pony') { capP(); horn(hb, hm, [[0, 0.13 * hs, -0.09 * hs], [0, 0.06 * hs, -0.13 * hs], [0, -0.04 * hs, -0.14 * hs]], 0.03 * hs); }
  if (style === 'bun') { capP(); ell(hb, hm, [0, 0.19 * hs, -0.06 * hs], [0.045 * hs, 0.04 * hs, 0.045 * hs]); }
  if (style === 'mohawk') for (let i = 0; i < 5; i++) spike(hb, hm, [0, 0.17 * hs, 0.05 * hs - i * 0.035 * hs], [0, 0.24 * hs, 0.04 * hs - i * 0.04 * hs], 0.022 * hs);
  if (style === 'tuft') for (let i = 0; i < 3; i++) spike(hb, hm, [(i - 1) * 0.02 * hs, 0.17 * hs, 0.0], [(i - 1) * 0.05 * hs, 0.24 * hs, -0.04 * hs], 0.015 * hs);
  if (style === 'wild') { capP(); for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 1.4 - PI * 0.7; horn(hb, hm, [[Math.sin(a) * 0.08 * hs, 0.12 * hs, -Math.cos(a) * 0.06 * hs], [Math.sin(a) * 0.13 * hs, 0.05 * hs, -Math.cos(a) * 0.1 * hs], [Math.sin(a) * 0.14 * hs, -0.06 * hs, -Math.cos(a) * 0.12 * hs]], 0.02 * hs); } }
  if (f.beard) {
    const long = f.beard === 'long' || v === 'dwarf';
    ell(hb, hm, [0, 0.03 * hs, 0.06 * hs], [0.075 * hs, 0.055 * hs, 0.05 * hs]);
    if (long) { add(hb, U.cone(10), hm, [0, -0.06 * hs, 0.075 * hs], [PI + 0.25, 0, 0], [0.07 * hs, 0.16 * hs, 0.045 * hs]); [1, -1].forEach(s => horn(hb, hm, [[s * 0.04 * hs, 0.0, 0.07 * hs], [s * 0.045 * hs, -0.08 * hs, 0.07 * hs], [s * 0.04 * hs, -0.15 * hs, 0.06 * hs]], 0.016 * hs)); }
    ell(hb, hm, [0.022 * hs, 0.055 * hs, 0.1 * hs], [0.026 * hs, 0.011 * hs, 0.012 * hs], [0, 0, -0.3]);
    ell(hb, hm, [-0.022 * hs, 0.055 * hs, 0.1 * hs], [0.026 * hs, 0.011 * hs, 0.012 * hs], [0, 0, 0.3]);
  }
}
/* ---------- outfit layers */
function dressOutfit(fig) {
  const d = fig.desc, f = d.f, pal = d.palette, M = fig.M, P = fig.P, h = P.h, w = P.w, o = d.outfit || 'vest';
  const J = fig.J;
  const belt = (m, y, buckle) => {
    add(J.spine, U.torus(0.16, 6, 20), m || M.leather, [0, (y || 0.0) * h, 0.0], [HP, 0, 0], [0.122 * w, 0.122 * w * 0.72, 0.12]);
    if (buckle !== false) add(J.spine, U.rbox(0.045, 0.04, 0.015, 0.2), buckle || M.trimMetal, [0, (y || 0) * h, 0.088 * w]);
  };
  const skirt = (key, len, r0, r1, m, z) => add(J.hips, U.lathe(key, [[r0, 0.02], [r0 * 1.02, -0.02], [lerp(r0, r1, 0.6), -len * 0.6], [r1, -len], [r1 * 0.96, -len - 0.01]], 16), m, [0, 0.02 * h, 0], null, [w, h, w * (z || 0.82)]);
  const pauldron = (big, m, rim) => ['L', 'R'].forEach(s => {
    const sg = s === 'L' ? 1 : -1;
    add(J['arm' + s], U.hemi(14, 6), m, [sg * 0.012 * w, 0.012, 0], [0, 0, -sg * 0.45], [0.088 * w * big, 0.07 * big, 0.085 * w * big]);
    if (big > 1) add(J['arm' + s], U.hemi(14, 6), m, [sg * 0.03 * w, -0.035, 0], [0, 0, -sg * 0.75], [0.075 * w * big, 0.05 * big, 0.075 * w * big]);
    if (rim) add(J['arm' + s], U.torus(0.08, 5, 18), rim, [sg * 0.012 * w, 0.012, 0], [HP, 0, -sg * 0.45], [0.088 * w * big, 0.085 * w * big, 0.088]);
  });
  const bracer = (s, m, len) => add(J['fore' + s], U.cyl(10, 1.15, 0.95), m, [0, -P.fo * 0.62, 0], null, [0.04 * w, (len || 0.13) * h, 0.04 * w]);
  switch (o) {
    case 'plate': {
      pauldron(1.25, M.metal, M.trimMetal);
      add(J.chest, U.box(), M.metal, [0, 0.09 * h, 0.105 * w], [-0.12, 0, 0], [0.025, 0.15 * h, 0.02]);       // plackart ridge
      add(J.neck, U.cyl(14, 0.85, 1), M.metal, [0, -0.005, 0], null, [0.075 * w, 0.06, 0.07 * w]);              // gorget
      skirt('faulds', 0.11, 0.135, 0.16, M.metal);
      skirt('mailskirt', 0.24, 0.13, 0.185, MT.mail(), 0.85);
      belt(M.leather, 0.0);
      ['L', 'R'].forEach(s => { ell(J['fore' + s], M.metal, [0, 0.005, -0.01], [0.05 * w, 0.05, 0.05 * w]); add(J['fore' + s], U.cyl(10, 1.2, 1), M.trimMetal, [0, -P.fo * 0.85, 0], null, [0.04 * w, 0.03, 0.04 * w]); ell(J['shin' + s], M.metal, [0, 0.0, 0.03], [0.058 * w, 0.058, 0.05 * w]); });
      break;
    }
    case 'mail': {
      pauldron(1.0, M.metal, M.trimMetal);
      add(J.chest, U.lathe('bplate', [[0.11, -0.02], [0.14, 0.03], [0.158, 0.08], [0.163, 0.12], [0.15, 0.165], [0.12, 0.19]], 14, -HP * 0.95, PI * 0.95), M.metal, [0, 0.005, 0.004], null, [w * 1.02, h, w * 0.72]);
      skirt('tunic', 0.28, 0.135, 0.19, M.body, 0.84);
      belt(M.leather, 0.01);
      ['L', 'R'].forEach(s => bracer(s, M.leather));
      M.bootTop = M.leather;
      break;
    }
    case 'leather': {
      skirt('tunic2', 0.2, 0.13, 0.175, M.body, 0.84);
      belt(M.leather, 0.0);
      add(J.chest, U.rbox(0.035, 0.36, 0.012, 0.3), M.leather, [0.0, 0.1 * h, 0.103 * w], [0.12, 0, 0.62]);
      add(J.chest, U.rbox(0.035, 0.36, 0.012, 0.3), M.leather, [0.0, 0.1 * h, -0.103 * w], [-0.12, 0, -0.62]);
      ['L', 'R'].forEach(s => bracer(s, M.leather));
      add(J.armL, U.hemi(12, 5), M.leather, [0.01, 0.012, 0], [0, 0, -0.45], [0.075 * w, 0.055, 0.072 * w]);
      for (let i = 0; i < 2; i++) add(J.spine, U.rbox(0.05, 0.055, 0.03, 0.3), M.leather, [(i ? -1 : 1) * 0.09 * w, -0.02, 0.07 * w], [0, (i ? -1 : 1) * 0.6, 0]);
      add(J.spine, U.rbox(0.04, 0.05, 0.03, 0.3), MT.leather('#3a2a1c'), [-0.11 * w, -0.03, -0.04 * w], [0, -1.2, 0]);
      M.bootTop = MT.leather(shade(pal.leather || '#5a3e28', 0.7));
      break;
    }
    case 'robe': {
      const robeLen = (P.hipY + 0.02 * h) - 0.03;
      skirt('robe', robeLen, 0.14, 0.27, M.body, 0.82);
      add(J.hips, U.lathe('robehem', [[0.27, 0.0], [0.275, -0.02], [0.27, -0.035]], 16), M.trim, [0, 0.02 * h - robeLen + 0.015, 0], null, [w, h, w * 0.82]);
      belt(M.trim, 0.02, false);
      add(J.spine, U.box(), M.trim, [0.03 * w, -0.1 * h, 0.105 * w], [0.05, 0, 0.05], [0.035, 0.18 * h, 0.01]);
      add(J.neck, U.torus(0.25, 6, 16), M.trim, [0, -0.01, 0.0], [HP + 0.15, 0, 0], [0.072 * w, 0.06 * w, 0.075]);
      ['L', 'R'].forEach(s => add(J['fore' + s], U.lathe('sleeve', [[0.04, 0.0], [0.05, -0.08], [0.075, -0.2], [0.07, -0.21]], 12), M.body, [0, -0.02, 0], null, [w, h, w]));
      fig.robe = true;
      if (d.cls === 'cleric') { [1, -1].forEach(s => add(J.chest, U.box(), M.trim, [s * 0.05 * w, 0.06 * h, 0.104 * w], [-0.1, 0, 0], [0.035, 0.24 * h, 0.012])); }
      break;
    }
    case 'monk': {
      add(J.chest, U.lathe('gi', [[0.11, -0.02], [0.14, 0.03], [0.158, 0.08], [0.163, 0.12], [0.15, 0.165], [0.12, 0.19]], 14, -HP * 0.25, PI * 0.5), M.trim, [0, 0.003, 0.004], null, [w * 1.03, h, w * 0.73]);
      add(J.spine, U.torus(0.3, 6, 18), M.trim, [0, 0.01, 0], [HP, 0, 0], [0.122 * w, 0.122 * w * 0.72, 0.12]);
      [0.04, -0.03].forEach((x, i) => add(J.spine, U.rbox(0.04, 0.2, 0.01, 0.3), M.trim, [x * w + 0.08 * w, -0.1, 0.08 * w], [0.1, 0, 0.15 - i * 0.3]));
      skirt('gipants', 0.08, 0.135, 0.15, MT.cloth(shade(pal.body || '#6c7a8c', 0.8)));
      ['L', 'R'].forEach(s => { bracer(s, MT.wrap('#e6dcc8'), 0.16); });
      break;
    }
    case 'barbarian': {
      // fur mantle
      add(J.chest, U.lathe('mantle', [[0.06, 0.24], [0.12, 0.23], [0.19, 0.2], [0.22, 0.15], [0.2, 0.11]], 14), MT.fur(pal.fur || '#6b5640'), [0, 0, -0.01], null, [w, h, w * 0.85]);
      add(J.chest, U.rbox(0.04, 0.4, 0.014, 0.3), M.leather, [0, 0.07 * h, 0.1 * w], [0.1, 0, 0.6]);
      belt(M.leather, 0.0, MT.metal('#9a9a9a'));
      skirt('kilt', 0.2, 0.135, 0.19, MT.leather(mix(pal.body || '#6b4a30', '#5a3e28', 0.4)), 0.85);
      ['L', 'R'].forEach(s => { bracer(s, M.leather); add(J['shin' + s], U.cyl(10, 1.15, 1), MT.fur(pal.fur || '#6b5640'), [0, -0.05, 0], null, [0.06 * w, 0.1, 0.06 * w]); });
      // muscle definition
      [1, -1].forEach(s => ell(J.chest, M.skin, [s * 0.065 * w, 0.12 * h, 0.075 * w], [0.07 * w, 0.06 * h, 0.04 * w]));
      break;
    }
    case 'bard': {
      for (let i = -1; i <= 1; i++) add(J.chest, U.box(), M.trim, [i * 0.06 * w, 0.08 * h, 0.106 * w - Math.abs(i) * 0.015], [-0.1, i * 0.3, 0], [0.018, 0.2 * h, 0.01]);
      skirt('doublet', 0.12, 0.135, 0.165, M.body, 0.84);
      belt(M.leather, 0.0);
      add(J.neck, U.torus(0.35, 6, 14), MT.cloth('#f0ead8'), [0, -0.005, 0], [HP, 0, 0], [0.065 * w, 0.06 * w, 0.06]);
      ['L', 'R'].forEach(s => add(J['arm' + s], U.limb(0.06 * w, 0.045 * w, P.up * 0.6, 0.6), MT.cloth(pal.trim || '#c8a24a'), [0, -0.01, 0]));
      M.bootTop = MT.leather(shade(pal.leather || '#5a3e28', 0.6));
      break;
    }
    case 'rags': case 'vest': {
      skirt(o === 'rags' ? 'rag' : 'tunic3', o === 'rags' ? 0.22 : 0.2, 0.13, 0.18, o === 'rags' ? M.torso : M.body, 0.84);
      belt(o === 'rags' ? MT.leather('#6a5a40') : M.leather, 0.0, o === 'rags' ? false : undefined);
      if (o === 'vest') M.bootTop = MT.leather(shade(pal.leather || '#5a3e28', 0.7));
      break;
    }
    case 'none': case 'scales': case 'fur': {
      if (!f.noLoin) skirt('loin', 0.13, 0.13, 0.15, M.pelvis, 0.85);
      if (f.belt !== false) belt(M.leather, -0.02, false);
      break;
    }
    case 'wraps': {
      for (let i = 0; i < 3; i++) add(J.chest, U.torus(0.06, 4, 16), M.skin, [0, 0.03 + i * 0.06 * h, 0], [HP + 0.1 * (i - 1), 0.2 * i, 0], [0.15 * w, 0.11 * w, 0.15]);
      break;
    }
  }
  // boots tops
  if (M.bootTop && fig.J.shinL) ['L', 'R'].forEach(s => add(J['shin' + s], U.cyl(12, 1.12, 1), M.bootTop, [0, -P.shin * 0.45, 0.0], null, [0.056 * w, 0.075, 0.056 * w]));
}

/* ---------- tails, wings, cape, misc features */
function addTail(fig, parent, o) {
  const n = o.n || 5, len = o.len || 0.6, r0 = o.r || 0.05, m = o.m;
  let p = parent; const segL = len / n;
  const bones = [];
  for (let i = 0; i < n; i++) {
    const b = fig.bone((o.name || 'tl') + i, p, 0, i === 0 ? (o.y || 0) : 0, i === 0 ? (o.z || -0.08) : -segL);
    b.rotation.x = -(i === 0 ? (o.rx0 != null ? o.rx0 : 0.6) : (o.rx != null ? o.rx : -0.12));
    const rr = r0 * (1 - i / (n + 0.6)), rr2 = r0 * (1 - (i + 1) / (n + 0.6));
    add(b, U.limb(rr, Math.max(0.004, rr2), segL * 1.06, 0.05), m, null, [HP, 0, 0]);
    bones.push(b); p = b;
  }
  if (o.tip === 'spade') add(p, U.shape('spade', [[0, 0], [0.04, -0.04], [0, -0.1], [-0.04, -0.04]], 0.012, 0.004), o.tipM || m, [0, 0, -segL], [HP, 0, 0], 0.8 + r0 * 4);
  if (o.tip === 'stinger') spike(p, o.tipM || MT.horn('#2a2622'), [0, 0, -segL], [0, 0.04, -segL - 0.08], r0 * 0.6);
  if (o.tip === 'flame') add(p, U.cone(8), MT.emis('#ff7a20', 2), [0, 0, -segL - 0.03], [HP, 0, 0], [0.03, 0.09, 0.03]);
  return bones;
}
function wingShape(type, span, chord) {
  // returns { inner: pts, outer: pts } in XY plane: x = span (outward), y = chord (down = negative)
  const a = span * 0.45, b = span * 0.55;
  if (type === 'feather' || type === 'bone') {
    const inner = [[0, 0.03], [a, 0.04], [a, -chord * 0.95], [a * 0.75, -chord * 0.85], [a * 0.5, -chord * 0.95], [a * 0.25, -chord * 0.8], [0, -chord * 0.6]];
    const outer = [[0, 0.04], [b * 0.6, 0.0], [b, -chord * 0.25], [b * 0.92, -chord * 0.5], [b * 0.75, -chord * 0.62], [b * 0.6, -chord * 0.85], [b * 0.4, -chord * 0.82], [b * 0.2, -chord * 1.0], [0, -chord * 0.95]];
    return { inner, outer };
  }
  if (type === 'insect') return { inner: [[0, 0], [a * 0.7, chord * 0.25], [a * 1.6, chord * 0.2], [a * 1.9, 0], [a * 1.5, -chord * 0.25], [a * 0.6, -chord * 0.2]], outer: [[0, 0], [a * 0.6, -chord * 0.05], [a * 1.3, -chord * 0.35], [a * 1.1, -chord * 0.6], [a * 0.5, -chord * 0.5]] };
  // bat / dragon membrane with scalloped edge
  const inner = [[0, 0.02], [a, 0.05], [a, -chord * 0.2], [a * 0.8, -chord * 0.75], [a * 0.5, -chord * 0.62], [a * 0.2, -chord * 0.78], [0, -chord * 0.55]];
  const outer = [[0, 0.05], [b * 0.55, 0.12 * chord], [b, -chord * 0.05], [b * 0.78, -chord * 0.3], [b * 0.62, -chord * 0.62], [b * 0.4, -chord * 0.48], [b * 0.22, -chord * 0.85], [0, -chord * 0.2]];
  return { inner, outer };
}
function addWings(fig, parent, o) {
  // o: {type, span, chord, x, y, z, m, bone, fold:{...}}
  const type = o.type || 'bat'; const sh = wingShape(type, o.span, o.chord);
  const m = o.m; const boneM = o.boneM || m;
  const wb = {};
  ['L', 'R'].forEach(s => {
    const sg = s === 'L' ? 1 : -1;
    const w1 = fig.bone('wing' + s, parent, sg * (o.x || 0.05), o.y || 0, o.z || -0.08);
    const w2 = fig.bone('wing' + s + '2', w1, sg * o.span * 0.45, 0, 0);
    const key = type + q3(o.span) + q3(o.chord);
    const gi = U.shape(key + 'i', sh.inner, type === 'insect' ? 0.004 : 0.008, type === 'insect' ? 0 : 0.002);
    const go = U.shape(key + 'o', sh.outer, type === 'insect' ? 0.004 : 0.008, type === 'insect' ? 0 : 0.002);
    const mi = add(w1, gi, m, [0, 0, 0], [0, 0, 0], [sg, 1, 1]);
    const mo = add(w2, go, m, [0, 0, 0], [0, 0, 0], [sg, 1, 1]);
    if (type === 'insect') { mi.castShadow = mo.castShadow = false; }
    if (type === 'bat' || type === 'bone') {
      rod(w1, boneM, [0, 0.02, 0], [sg * o.span * 0.45, 0.04, 0], 0.018 * o.span, 0.012 * o.span);
      [[0.55, 0.1], [1.0, -0.05], [0.78, -0.3], [0.4, -0.48]].forEach(([fx, fy]) => rod(w2, boneM, [0, 0.03, 0], [sg * o.span * 0.55 * fx, fy * o.chord + (fy > 0 ? 0 : 0), 0], 0.01 * o.span, 0.004 * o.span));
      spike(w2, MT.horn('#2a2420'), [sg * o.span * 0.3, 0.07 * o.chord, 0], [sg * o.span * 0.33, 0.2 * o.chord, 0], 0.012 * o.span);
    }
    if (type === 'feather') rod(w1, m, [0, 0.02, 0], [sg * o.span * 0.45, 0.03, 0], 0.03 * o.span, 0.02 * o.span);
    wb[s] = [w1, w2];
  });
  fig.wings = { type, o, L: wb.L, R: wb.R };
  if (type === 'bone') fig.wings.noMembrane = true;
}

function addFeatures(fig) {
  const d = fig.desc, f = d.f, pal = d.palette, M = fig.M, P = fig.P, J = fig.J, h = P.h, w = P.w;
  if (f.tail) {
    const tt = f.tail; const tm = tt === 'devil' ? MT.skin(pal.skin) : tt === 'rat' ? MT.skin(pal.tailC || '#c89a8a') : tt === 'cat' || tt === 'fur' ? MT.fur(pal.tailC || pal.skin) : M.skin;
    const o = { devil: { n: 6, len: 0.62, r: 0.022, tip: 'spade', rx0: 1.0, rx: -0.18 }, rat: { n: 6, len: 0.6, r: 0.02, rx0: 1.2, rx: -0.15 }, cat: { n: 6, len: 0.62, r: 0.03, rx0: 1.0, rx: -0.2 }, fur: { n: 4, len: 0.35, r: 0.05, rx0: 0.9 },
      reptile: { n: 6, len: 0.75, r: 0.075, rx0: 0.75, rx: -0.13 }, kobold: { n: 5, len: 0.55, r: 0.05, rx0: 0.8, rx: -0.14 }, flame: { n: 5, len: 0.6, r: 0.03, tip: 'flame', rx0: 1.0 }, stinger: { n: 7, len: 0.8, r: 0.04, tip: 'stinger', rx0: 0.6, rx: -0.35 } }[tt] || { n: 5, len: 0.6, r: 0.04 };
    o.m = tm; o.y = -0.02; o.z = -0.08 * w;
    fig.tail = addTail(fig, J.hips, o);
  }
  if (f.wings) {
    const t = f.wings;
    const wm = t === 'feather' ? MT.featherDS(pal.wing || '#f2efe6') : t === 'insect' ? mat(pal.wing || '#cfefff', { r: 0.1, m: 0.2, op: 0.42, ds: true, e: pal.wing || '#cfefff', ei: 0.4 }) : t === 'bone' ? MT.bone() : MT.membrane(pal.wing || shade(pal.skin || '#6a2a2a', 0.8));
    const span = t === 'insect' ? 0.42 : (f.wingSpan || 0.85) * Math.max(1, w * 0.9), chord = t === 'insect' ? 0.16 : 0.5;
    addWings(fig, J.chest, { type: t, span, chord, x: 0.05, y: 0.15 * h, z: -0.085 * w, m: wm, boneM: t === 'bat' ? MT.skin(shade(pal.skin || '#6a2a2a', 0.7)) : MT.bone() });
  }
  if (f.cape) {
    const cb = fig.bone('cape', J.chest, 0, 0.19 * h, -0.02);
    const cl = f.capeLen || (P.hipY + 0.2 * h) * 0.88;
    const cm = MT.clothDS(pal.cape || pal.body || '#5a2a2a');
    const top = 0.15 * w, bot = 0.29 * w;
    const g = geo('cape' + q3(cl) + q3(top) + q3(bot) + (f.cape === 'tatter' ? 't' : ''), () => {
      const gg = new THREE.CylinderGeometry(top, bot, cl, 14, 5, true, PI - 1.25, 2.5);
      if (f.cape === 'tatter') { const p = gg.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < -cl * 0.45) p.setY(i, p.getY(i) + ((i * 7) % 5) * 0.03); gg.computeVertexNormals(); }
      return gg;
    });
    add(cb, g, cm, [0, -cl / 2, 0.06 * w], [0.0, 0, 0], [1, 1, 0.75]);
    if (f.collar) add(cb, U.cyl(14, 1.25, 1, true), cm, [0, 0.07, 0.02], null, [0.13 * w, 0.14, 0.11 * w]);
    fig.cape = cb;
  }
  if (f.leafCloak && fig.cape) {
    const lm = mat(pal.leaf || '#4f7a2a', { r: 0.85, ds: true });
    const lm2 = mat(shade(pal.leaf || '#4f7a2a', 0.75), { r: 0.85, ds: true });
    const cl = (P.hipY + 0.2 * h) * 0.88;
    for (let i = 0; i < 16; i++) { const t = i / 16, a = PI - 1.0 + (i * 0.61) % 2.0, yy = -0.05 - t * cl * 0.95, rr = lerp(0.16, 0.3, t) * w + 0.01; add(fig.cape, U.sphere(8, 6), i % 2 ? lm : lm2, [Math.sin(a) * rr, yy, Math.cos(a) * rr * 0.75 + 0.06 * w], [0.3, a, 0.4 * (i % 3 - 1)], [0.055, 0.075, 0.012]); }
  }
  if (f.hoodCape) { /* handled via acc hood */ }
  if (f.mane) for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 1.6 - PI * 0.8; spike(J.head, MT.fur(pal.mane || '#6a4a2a'), [Math.sin(a) * 0.08 * P.hs, 0.1 * P.hs, -Math.cos(a) * 0.07 * P.hs], [Math.sin(a) * 0.17 * P.hs, 0.04 * P.hs, -Math.cos(a) * 0.15 * P.hs], 0.05 * P.hs); }
  if (f.spikes) for (let i = 0; i < 4; i++) spike(J.chest, MT.horn(pal.horn || '#2a2420'), [0, 0.04 + i * 0.045 * h, -0.1 * w], [0, 0.06 + i * 0.045 * h, -0.17 * w], 0.02);
  if (f.ragged) { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; add(J.hips, U.box(), M.torso, [Math.sin(a) * 0.15 * w, -0.2, Math.cos(a) * 0.12 * w], [0.15 * Math.cos(a), a, -0.15 * Math.sin(a)], [0.06, 0.18 + (i % 3) * 0.05, 0.008]); } }
  if (f.crown) addCrown(fig);
  addFeatures2(fig);
}
function addCrown(fig) {
  const pal = fig.desc.palette, J = fig.J, P = fig.P;
  if (fig._crowned) return; fig._crowned = true;
  { const gm = MT.gold(pal.crown || '#d8b040'); add(J.head, U.cyl(14, 1, 1, true), gm, [0, 0.165 * P.hs, -0.005], [-0.2, 0, 0], [0.095 * P.hs, 0.035, 0.1 * P.hs]); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; spike(J.head, gm, [Math.sin(a) * 0.095 * P.hs, 0.18 * P.hs + Math.cos(a) * 0.02, Math.cos(a) * 0.1 * P.hs], [Math.sin(a) * 0.1 * P.hs, 0.25 * P.hs + Math.cos(a) * 0.02, Math.cos(a) * 0.105 * P.hs], 0.014); } fig.headTop = Math.max(fig.headTop || 0, 0.26 * P.hs); }
}
function addFeatures2(fig) {
  const d = fig.desc, f = d.f, pal = d.palette, J = fig.J, P = fig.P, h = P.h, w = P.w;
  if (f.flameHair) { const fm = MT.emis('#ff8a2a', 2.2); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; add(J.head, U.cone(6), fm, [Math.sin(a) * 0.05 * P.hs, 0.2 * P.hs, Math.cos(a) * 0.05 * P.hs - 0.02], [-0.3 + Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.2], [0.035 * P.hs, 0.14 * P.hs, 0.035 * P.hs]).castShadow = false; } }
  if (f.chestEye) { ell(J.chest, MT.eye('#f0e8d0'), [0, 0.1 * h, 0.1 * w], [0.05, 0.045, 0.03]); ell(J.chest, MT.glowEye('#d02020'), [0, 0.1 * h, 0.122 * w], [0.022, 0.022, 0.012]); }
  if (f.chestMaw) { ell(J.spine, MT.dark(), [0, 0.08 * h, 0.09 * w], [0.07, 0.045, 0.03]); for (let i = 0; i < 6; i++) spike(J.spine, MT.teeth(), [(i - 2.5) * 0.022, 0.12 * h, 0.1 * w], [(i - 2.5) * 0.02, 0.09 * h, 0.105 * w], 0.008); }
  if (f.extraArms) { /* reserved */ }
}

/* ============================================================ WEAPONS */
const WEAPONS = {
  fist: { t: 'fist' }, gauntlet: { t: 'fist' }, claw: { t: 'fist' },
  longsword: { t: 'sword', L: 0.74 }, bastard: { t: 'sword', L: 0.86 }, greatsword: { t: 'sword', L: 1.02, h: 2 }, shortsword: { t: 'sword', L: 0.5 }, dagger: { t: 'dagger', L: 0.26 }, rapier: { t: 'rapier', L: 0.8 },
  scimitar: { t: 'curved', L: 0.68 }, falchion: { t: 'curved', L: 0.9, h: 2 }, dogslicer: { t: 'curved', L: 0.38 }, kukri: { t: 'kukri', L: 0.36 }, katana: { t: 'curved', L: 0.82 }, sickle: { t: 'sickle', L: 0.32 }, scythe: { t: 'scythe', L: 1.55, h: 2 },
  battleaxe: { t: 'axe', L: 0.7 }, hatchet: { t: 'axe', L: 0.42 }, necksplitter: { t: 'axe', L: 0.68 }, greataxe: { t: 'greataxe', L: 1.15, h: 2 },
  warhammer: { t: 'hammer', L: 0.64 }, lighthammer: { t: 'hammer', L: 0.44 }, maul: { t: 'maul', L: 1.15, h: 2 },
  mace: { t: 'mace', L: 0.58 }, lightmace: { t: 'mace', L: 0.46 }, morningstar: { t: 'morningstar', L: 0.62 }, club: { t: 'club', L: 0.6 }, greatclub: { t: 'club', L: 1.05, h: 2 }, tetsubo: { t: 'club', L: 1.15, h: 2, studs: 1 },
  flail: { t: 'flail', L: 0.5 }, warflail: { t: 'flail', L: 0.85, h: 2 }, pick: { t: 'pick', L: 0.64 }, lightpick: { t: 'pick', L: 0.48 },
  staff: { t: 'staff', L: 1.55 }, bostaff: { t: 'staff', L: 1.6 },
  spear: { t: 'spear', L: 1.45 }, longspear: { t: 'spear', L: 1.9, h: 2 }, trident: { t: 'trident', L: 1.45 }, lance: { t: 'spear', L: 2.0, h: 2 }, javelin: { t: 'javelin', L: 1.1 },
  glaive: { t: 'glaive', L: 1.65, h: 2 }, halberd: { t: 'halberd', L: 1.7, h: 2 }, guisarme: { t: 'hook', L: 1.7, h: 2 }, horsechopper: { t: 'hook', L: 1.55, h: 2 }, ranseur: { t: 'trident', L: 1.7, h: 2 }, ogrehook: { t: 'hook', L: 1.6, h: 2 },
  whip: { t: 'whip', L: 0.4 }, chain: { t: 'whip', L: 0.5 },
  longbow: { t: 'bow', L: 1.35 }, shortbow: { t: 'bow', L: 0.98 }, clongbow: { t: 'bow', L: 1.3, comp: 1 }, cshortbow: { t: 'bow', L: 0.98, comp: 1 },
  crossbow: { t: 'xbow', L: 0.62 }, hcrossbow: { t: 'xbow', L: 0.8 }, handxbow: { t: 'hxbow', L: 0.32 },
  sling: { t: 'sling' }, dart: { t: 'dagger', L: 0.18 }, bomb: { t: 'flask' }, fork: { t: 'trident', L: 0.7 }, pan: { t: 'pan', L: 0.45 }, broom: { t: 'staff', L: 1.3 }
};
const HOLD = { // holdType, default melee style, attach angle
  fist: ['fist', 'unarmed'], sword: ['one', 'slash'], dagger: ['one', 'thrust'], rapier: ['one', 'thrust'], curved: ['one', 'slash'], kukri: ['one', 'slash'], sickle: ['one', 'slash'],
  scythe: ['pole', 'slash'], axe: ['one', 'overhead'], greataxe: ['two', 'overhead'], hammer: ['one', 'overhead'], maul: ['two', 'overhead'], mace: ['one', 'overhead'], morningstar: ['one', 'overhead'],
  club: ['one', 'overhead'], flail: ['one', 'overhead'], pick: ['one', 'overhead'], staff: ['staff', 'slash'], spear: ['pole', 'thrust'], trident: ['pole', 'thrust'], javelin: ['pole', 'thrust'],
  glaive: ['pole', 'overhead'], halberd: ['pole', 'overhead'], hook: ['pole', 'overhead'], whip: ['one', 'slash'], bow: ['bow', 'unarmed'], xbow: ['xbow', 'unarmed'], hxbow: ['one', 'unarmed'], sling: ['one', 'unarmed'], flask: ['one', 'unarmed'], pan: ['one', 'overhead']
};
function blade(key, L, wd, curve, m) {
  const pts = [], back = []; const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n; const cx = curve * t * t * L; const ww = wd * (t < 0.85 ? (1 + (curve > 0 ? 0.35 * t : -0.1 * t)) : (1 - (t - 0.85) / 0.15) * 1.0) * 0.5;
    pts.push([cx + ww, t * L]); back.unshift([cx - ww * (curve > 0 ? 0.6 : 1), t * L]);
  }
  pts[n] = [curve * L + (curve > 0 ? wd * 0.3 : 0), L];
  return U.shape('bl' + key, pts.concat(back.slice(1)), 0.014, 0.005);
}
function buildWeapon(fig, id) {
  const W = WEAPONS[id] || WEAPONS.longsword; const pal = fig.desc.palette || {};
  const g = new THREE.Group(); g.name = 'weapon:' + id;
  const steel = MT.metal(pal.blade || '#c9ced6'), wood = MT.wood(pal.wood || '#6b4a2b'), grip = MT.leather('#3a2618'), brass = MT.gold(pal.hilt || '#b8913a'), dark = MT.dmetal('#4a4e55');
  const info = { id, t: W.t, hands: W.h || 1, L: W.L || 0.5, group: g };
  const hold = HOLD[W.t] || ['one', 'slash']; info.hold = W.h === 2 && hold[0] === 'one' ? 'two' : hold[0]; info.style = hold[1];
  if (W.h === 2 && (W.t === 'sword' || W.t === 'curved')) info.hold = 'two';
  const tip = new THREE.Object3D(); g.add(tip); info.tip = tip;
  const shaft = (y0, y1, r, m) => rod(g, m || wood, [0, y0, 0], [0, y1, 0], r, r * 0.92, 8);
  const L = W.L || 0.5;
  const bladeY = (sh) => { const b = add(g, sh, steel, [0, 0.07, 0], [0, HP, 0]); return b; };
  switch (W.t) {
    case 'sword': case 'curved': case 'dagger': case 'kukri': {
      const bl = W.t === 'dagger' ? L : L;
      const wd = W.t === 'dagger' ? 0.045 : W.t === 'curved' ? (W.h === 2 ? 0.085 : 0.06) : W.h === 2 ? 0.07 : 0.06;
      const curve = W.t === 'curved' ? (id === 'dogslicer' ? 0.22 : 0.14) : W.t === 'kukri' ? -0.18 : 0;
      bladeY(blade(id, bl, wd, curve));
      const gl = W.h === 2 ? 0.24 : W.t === 'dagger' ? 0.09 : 0.13;
      shaft(-gl + 0.03, 0.04, 0.017, grip);
      add(g, U.rbox(W.t === 'dagger' ? 0.1 : (W.h === 2 ? 0.26 : 0.2), 0.03, 0.035, 0.4), brass, [0, 0.055, 0], [0, HP, 0]);
      ell(g, brass, [0, -gl + 0.02, 0], [0.026, 0.03, 0.026]);
      tip.position.set(0, 0.07 + bl, 0);
      if (W.h === 2) { info.grip2 = new THREE.Object3D(); info.grip2.position.set(0, -0.12, 0); g.add(info.grip2); }
      break;
    }
    case 'rapier': {
      bladeY(blade('rapier', L, 0.024, 0));
      shaft(-0.1, 0.04, 0.015, grip);
      add(g, U.torus(0.12, 5, 14, PI * 1.2), brass, [0, 0.0, 0.0], [0, HP, PI * 0.9], [0.06, 0.08, 0.06]);
      add(g, U.rbox(0.18, 0.02, 0.02, 0.4), brass, [0, 0.06, 0], [0, HP, 0]);
      add(g, U.hemi(12, 5), brass, [0, 0.06, 0], [PI, 0, 0], [0.05, 0.03, 0.05]);
      ell(g, brass, [0, -0.11, 0], 0.022);
      tip.position.set(0, 0.07 + L, 0); break;
    }
    case 'sickle': {
      shaft(-0.08, 0.1, 0.017, wood);
      add(g, U.torus(0.08, 5, 14, PI * 1.1), steel, [0, 0.2, 0.08], [0, HP, -0.4], [0.11, 0.11, 0.11]);
      tip.position.set(0, 0.25, 0.15); break;
    }
    case 'scythe': {
      shaft(-0.55, L - 0.55, 0.02, wood);
      add(g, U.torus(0.06, 5, 16, PI * 0.75), steel, [0, L - 0.58, 0.32], [0, HP, -PI * 0.15], [0.36, 0.36, 0.36]);
      tip.position.set(0, L - 0.55, 0.6); info.grip2 = new THREE.Object3D(); info.grip2.position.set(0, -0.4, 0); g.add(info.grip2); break;
    }
    case 'axe': case 'greataxe': {
      const big = W.t === 'greataxe'; const hl = L;
      shaft(big ? -0.42 : -0.12, hl - (big ? 0.42 : 0.12), big ? 0.022 : 0.018, wood);
      const top = hl - (big ? 0.42 : 0.12) - 0.08;
      const bs = big ? 1.5 : (id === 'hatchet' ? 0.75 : 1.0);
      const sh = U.shape('axeblade', [[0, -0.05], [0.06, -0.07], [0.13, -0.13], [0.17, -0.04], [0.175, 0.03], [0.15, 0.12], [0.07, 0.07], [0, 0.05]], 0.016, 0.005);
      add(g, sh, steel, [0, top, 0], [0, -HP, 0], [bs, bs, 1]);
      if (big) add(g, sh, steel, [0, top, 0], [0, HP, 0], [bs, bs, 1]);
      else spike(g, steel, [0, top, -0.02], [0, top - 0.01, -0.09], 0.02);
      add(g, U.cyl(8), dark, [0, top, 0], null, [0.03, 0.1 * bs, 0.03]);
      tip.position.set(0, top, 0.17 * bs);
      if (big) { info.grip2 = new THREE.Object3D(); info.grip2.position.set(0, -0.3, 0); g.add(info.grip2); }
      break;
    }
    case 'hammer': case 'maul': case 'pan': {
      const big = W.t === 'maul';
      shaft(big ? -0.42 : -0.12, L - (big ? 0.42 : 0.12), big ? 0.022 : 0.018, wood);
      const top = L - (big ? 0.42 : 0.12) - (big ? 0.08 : 0.05);
      if (W.t === 'pan') { add(g, U.cyl(16), dark, [0, top, 0.0], [HP, 0, 0], [0.09, 0.02, 0.09]); tip.position.set(0, top, 0.1); break; }
      add(g, U.rbox(big ? 0.15 : 0.08, big ? 0.15 : 0.08, big ? 0.3 : 0.16, 0.18), steel, [0, top, big ? 0 : 0.03]);
      if (!big) spike(g, steel, [0, top, -0.04], [0, top + 0.01, -0.13], 0.025);
      else { add(g, U.cyl(12), brass, [0, top, 0.12], [HP, 0, 0], [0.085, 0.02, 0.085]); add(g, U.cyl(12), brass, [0, top, -0.12], [HP, 0, 0], [0.085, 0.02, 0.085]); }
      tip.position.set(0, top, big ? 0.15 : 0.11);
      if (big) { info.grip2 = new THREE.Object3D(); info.grip2.position.set(0, -0.3, 0); g.add(info.grip2); }
      break;
    }
    case 'mace': case 'morningstar': {
      shaft(-0.1, L - 0.06, 0.018, W.t === 'mace' ? dark : wood);
      const top = L - 0.07;
      ell(g, steel, [0, top, 0], [0.052, 0.065, 0.052]);
      if (W.t === 'mace') for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; add(g, U.box(), steel, [Math.sin(a) * 0.045, top, Math.cos(a) * 0.045], [0, a, 0], [0.01, 0.1, 0.05]); }
      else for (let i = 0; i < 10; i++) { const a = i * 2.4, yy = Math.cos(i * 1.7) * 0.7; spike(g, steel, [Math.sin(a) * 0.04 * Math.sqrt(1 - yy * yy), top + yy * 0.05, Math.cos(a) * 0.04 * Math.sqrt(1 - yy * yy)], [Math.sin(a) * 0.09 * Math.sqrt(1 - yy * yy), top + yy * 0.1, Math.cos(a) * 0.09 * Math.sqrt(1 - yy * yy)], 0.012, 5); }
      tip.position.set(0, top, 0.06); break;
    }
    case 'club': {
      const big = W.h === 2;
      add(g, U.lathe('club' + (big ? 2 : 1), big ? [[0.025, -0.38], [0.03, -0.1], [0.05, 0.3], [0.075, 0.55], [0.07, 0.64], [0.001, 0.66]] : [[0.02, -0.1], [0.025, 0.1], [0.045, 0.38], [0.05, 0.46], [0.001, 0.49]], 9), W.studs ? dark : wood);
      if (W.studs) for (let i = 0; i < 12; i++) { const a = i * 2.1; spike(g, steel, [Math.sin(a) * 0.06, 0.25 + i * 0.03, Math.cos(a) * 0.06], [Math.sin(a) * 0.09, 0.25 + i * 0.03, Math.cos(a) * 0.09], 0.012, 4); }
      tip.position.set(0, big ? 0.6 : 0.45, 0.04);
      if (big) { info.grip2 = new THREE.Object3D(); info.grip2.position.set(0, -0.25, 0); g.add(info.grip2); }
      break;
    }
    case 'flail': {
      const big = W.h === 2;
      shaft(big ? -0.3 : -0.1, big ? 0.35 : 0.2, 0.02, wood);
      const top = big ? 0.35 : 0.2;
      for (let i = 0; i < 4; i++) add(g, U.torus(0.25, 4, 8), dark, [0, top + 0.02 + i * 0.03, 0.015 * i], [0, (i % 2) * HP, 0], 0.016);
      ell(g, steel, [0, top + 0.16, 0.08], big ? 0.07 : 0.055);
      for (let i = 0; i < 8; i++) { const a = i * 2.4, yy = Math.cos(i * 1.7) * 0.7; const c = [0, top + 0.16, 0.08]; spike(g, steel, [c[0] + Math.sin(a) * 0.04, c[1] + yy * 0.04, c[2] + Math.cos(a) * 0.04], [c[0] + Math.sin(a) * 0.09, c[1] + yy * 0.09, c[2] + Math.cos(a) * 0.09], 0.012, 4); }
      tip.position.set(0, top + 0.16, 0.08);
      if (big) { info.grip2 = new THREE.Object3D(); info.grip2.position.set(0, -0.2, 0); g.add(info.grip2); }
      break;
    }
    case 'pick': {
      shaft(-0.12, L - 0.12, 0.018, wood);
      const top = L - 0.16;
      spike(g, steel, [0, top, 0.0], [0, top - 0.04, 0.2], 0.025, 6);
      spike(g, steel, [0, top, 0.0], [0, top - 0.02, -0.08], 0.02, 6);
      add(g, U.cyl(8), dark, [0, top, 0], null, [0.028, 0.07, 0.028]);
      tip.position.set(0, top - 0.04, 0.2); break;
    }
    case 'staff': {
      const kind = fig.desc.staffKind || (fig.desc.cls === 'druid' ? 'druid' : fig.desc.cls === 'wizard' || fig.desc.cls === 'sorcerer' || fig.desc.cls === 'cleric' ? 'arcane' : fig.desc.cls === 'monk' ? 'bo' : 'plain');
      const bot = -0.5, top = L - 0.5;
      add(g, U.lathe('staffshaft' + q3(L), [[0.016, bot - 0.01], [0.02, bot], [0.022, 0.0], [0.021, top - 0.2], [0.024, top]], 8), kind === 'bo' ? MT.wood('#8a6a40') : wood);
      if (kind === 'arcane') {
        const gm = fig.perMat(MT.emis(pal.glow || '#7fd0ff', 1.2)); fig.staffGlow = gm;
        const cr = add(g, U.oct(), gm, [0, top + 0.09, 0], null, [0.045, 0.08, 0.045]); keep(cr); cr.castShadow = false;
        for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; horn(g, MT.gold('#b89040'), [[Math.sin(a) * 0.02, top, Math.cos(a) * 0.02], [Math.sin(a) * 0.06, top + 0.08, Math.cos(a) * 0.06], [Math.sin(a) * 0.03, top + 0.17, Math.cos(a) * 0.03]], 0.01); }
        tip.position.set(0, top + 0.09, 0);
      } else if (kind === 'druid') {
        horn(g, wood, [[0, top, 0], [0.04, top + 0.08, 0.01], [0.09, top + 0.1, 0.0], [0.1, top + 0.04, 0.0], [0.06, top + 0.03, 0]], 0.022);
        const lm = mat('#5a8a2a', { r: 0.8, ds: true });
        for (let i = 0; i < 4; i++) add(g, U.sphere(8, 6), lm, [0.02 + i * 0.02, top + 0.02 - i * 0.02, (i % 2 ? 1 : -1) * 0.03], [0.4, i, 0.8], [0.025, 0.05, 0.008]);
        tip.position.set(0.06, top + 0.08, 0);
      } else { add(g, U.cyl(8), dark, [0, top - 0.02, 0], null, [0.026, 0.06, 0.026]); add(g, U.cyl(8), dark, [0, bot + 0.02, 0], null, [0.026, 0.06, 0.026]); tip.position.set(0, top, 0); }
      info.grip2 = new THREE.Object3D(); info.grip2.position.set(0, -0.32, 0); g.add(info.grip2);
      break;
    }
    case 'spear': case 'javelin': case 'trident': {
      const bot = W.t === 'javelin' ? -0.45 : -0.55, top = L + bot;
      shaft(bot, top, W.t === 'javelin' ? 0.013 : 0.017, wood);
      if (W.t === 'trident') {
        add(g, U.box(), steel, [0, top, 0], null, [0.012, 0.02, 0.16]);
        [-0.07, 0, 0.07].forEach(z => spike(g, steel, [0, top, z], [0, top + (z === 0 ? 0.2 : 0.15), z], 0.014, 5));
        tip.position.set(0, top + 0.2, 0);
      } else {
        add(g, U.shape('leaf', [[0, 0], [0.035, 0.05], [0.028, 0.14], [0, 0.22], [-0.028, 0.14], [-0.035, 0.05]], 0.016, 0.006), steel, [0, top - 0.01, 0], [0, HP, 0], W.t === 'javelin' ? 0.7 : 1);
        add(g, U.cyl(8), dark, [0, top - 0.01, 0], null, [0.022, 0.05, 0.022]);
        tip.position.set(0, top + 0.2, 0);
      }
      if (W.h === 2 || W.t === 'trident' || W.t === 'spear') { info.grip2 = new THREE.Object3D(); info.grip2.position.set(0, -0.36, 0); g.add(info.grip2); }
      if (W.t === 'spear' || W.t === 'trident') info.hold = 'pole';
      if (W.t === 'javelin') info.hold = 'one';
      break;
    }
    case 'glaive': case 'halberd': case 'hook': {
      const bot = -0.6, top = L + bot;
      shaft(bot, top, 0.019, wood);
      if (W.t === 'glaive') add(g, U.shape('glaive', [[0, 0], [0.05, 0.02], [0.075, 0.18], [0.04, 0.34], [0.0, 0.38], [0.0, 0.0]], 0.016, 0.005), steel, [0, top - 0.12, 0], [0, -HP, 0], 1);
      if (W.t === 'halberd') { add(g, U.shape('halb', [[0, -0.04], [0.06, -0.06], [0.14, -0.1], [0.16, 0.04], [0.12, 0.1], [0, 0.05]], 0.016, 0.005), steel, [0, top - 0.06, 0], [0, -HP, 0]); spike(g, steel, [0, top, 0], [0, top + 0.24, 0], 0.02, 5); spike(g, steel, [0, top - 0.04, 0], [0, top - 0.02, -0.11], 0.016, 5); }
      if (W.t === 'hook') { horn(g, steel, [[0, top - 0.1, 0], [0, top + 0.06, 0.03], [0, top + 0.14, 0.12], [0, top + 0.08, 0.18]], 0.025); spike(g, steel, [0, top, 0], [0, top + 0.18, 0], 0.018, 5); }
      add(g, U.cyl(8), dark, [0, top - 0.12, 0], null, [0.024, 0.06, 0.024]);
      tip.position.set(0, top + 0.18, 0.06);
      info.grip2 = new THREE.Object3D(); info.grip2.position.set(0, -0.38, 0); g.add(info.grip2);
      break;
    }
    case 'whip': {
      shaft(-0.08, 0.14, 0.016, grip);
      const pts = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * TAU * 1.6; pts.push([Math.cos(a) * 0.07 - 0.07, 0.12 - i * 0.012, Math.sin(a) * 0.07]); }
      add(g, U.tube('whipcoil', pts, 0.008, 40, 5), MT.leather('#4a3020'), [0, 0, 0]);
      tip.position.set(0, 0.14, 0); break;
    }
    case 'bow': {
      const hL = L / 2, cmp = !!W.comp;
      const pts = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12 * 2 - 1; const y = t * hL; let z = -0.13 * t * t * (L / 1.3); if (cmp && Math.abs(t) > 0.8) z += (Math.abs(t) - 0.8) * 0.5 * (L / 1.3); pts.push([0, y, z]); }
      add(g, U.tube('bow' + id, pts, cmp ? 0.017 : 0.015, 24, 6), cmp ? MT.wood('#3a2418') : wood);
      add(g, U.cyl(8), grip, [0, 0, 0.004], null, [0.02, 0.1, 0.022]);
      const tTop = new THREE.Object3D(); tTop.position.set(pts[12][0], pts[12][1], pts[12][2]); g.add(tTop);
      const tBot = new THREE.Object3D(); tBot.position.set(pts[0][0], pts[0][1], pts[0][2]); g.add(tBot);
      const sm = mat('#e8e2d0', { r: 0.6 });
      const s1 = keep(add(g, U.cyl(4), sm)), s2 = keep(add(g, U.cyl(4), sm)); s1.castShadow = s2.castShadow = false;
      const arrow = keep(new THREE.Group()); g.add(arrow); arrow.visible = false;
      rod(arrow, MT.wood('#a08060'), [0, 0, 0], [0, 0, 0.75], 0.006, 0.006, 5).userData.keep = true;
      spike(arrow, steel, [0, 0, 0.74], [0, 0, 0.8], 0.012, 4).userData.keep = true;
      add(arrow, U.box(), mat(pal.trim || '#c03030'), [0, 0, 0.05], null, [0.002, 0.03, 0.07]).userData.keep = true;
      info.bow = { tTop, tBot, s1, s2, arrow, restZ: pts[0][2] };
      tip.position.set(0, 0, 0.1); info.hold = 'bow';
      break;
    }
    case 'xbow': case 'hxbow': {
      const s = W.t === 'hxbow' ? 0.5 : (id === 'hcrossbow' ? 1.2 : 1);
      add(g, U.rbox(0.045, 0.5 * s, 0.05, 0.3), wood, [0, 0.12 * s, -0.01]);
      add(g, U.rbox(0.05, 0.16 * s, 0.07, 0.3), wood, [0, -0.12 * s, -0.035], [0.35, 0, 0]);
      const prodPts = []; for (let i = 0; i <= 8; i++) { const t = i / 8 * 2 - 1; prodPts.push([t * 0.24 * s, 0.34 * s - Math.abs(t) * t * 0 - t * t * 0.06 * s, 0.01]); }
      add(g, U.tube('prod' + q3(s), prodPts, 0.014 * Math.max(0.7, s), 16, 5), dark);
      rod(g, mat('#e8e2d0'), [-0.24 * s, 0.28 * s, 0.01], [0, 0.14 * s, 0.015], 0.003, 0.003, 4); rod(g, mat('#e8e2d0'), [0.24 * s, 0.28 * s, 0.01], [0, 0.14 * s, 0.015], 0.003, 0.003, 4);
      rod(g, MT.wood('#a08060'), [0, 0.14 * s, 0.03], [0, 0.4 * s, 0.03], 0.006, 0.006, 5);
      tip.position.set(0, 0.42 * s, 0.03);
      if (W.t === 'xbow') { info.grip2 = new THREE.Object3D(); info.grip2.position.set(0, 0.26 * s, -0.04); g.add(info.grip2); info.hold = 'xbow'; }
      else info.hold = 'hxbow';
      break;
    }
    case 'sling': {
      rod(g, MT.leather('#5a4030'), [0, 0, 0], [0, -0.22, 0.04], 0.006, 0.006, 4);
      ell(g, MT.leather('#6a4a30'), [0, -0.24, 0.05], [0.03, 0.02, 0.03]);
      tip.position.set(0, -0.24, 0.05); info.hold = 'one'; break;
    }
    case 'flask': {
      const fm = fig.perMat(MT.emis(pal.glow || '#ff7a2a', 1.0));
      ell(g, MT.glass('#e0f0ff', 0.6), [0, 0.06, 0], 0.045); keep(ell(g, fm, [0, 0.055, 0], 0.035));
      rod(g, MT.wood('#8a6a40'), [0, 0.1, 0], [0, 0.13, 0], 0.012, 0.012, 6);
      tip.position.set(0, 0.06, 0); break;
    }
    default: break;
  }
  return info;
}

/* ---------- shields: built facing +Z, up +Y, centered */
function buildShield(fig, type) {
  const pal = fig.desc.palette; const g = new THREE.Group();
  const face = MT.cloth(pal.shieldFace || pal.body || '#6c7a8c'), rim = MT.metal(pal.shieldRim || '#9aa0a8'), tr = MT.gold(mix(pal.trim || '#c8a24a', '#d2a640', 0.3));
  const emblem = () => add(g, U.shape('emblem', [[0, 0.07], [0.02, 0.02], [0.07, 0.0], [0.02, -0.02], [0, -0.08], [-0.02, -0.02], [-0.07, 0.0], [-0.02, 0.02]], 0.01, 0.003), tr, [0, 0.01, 0.03]);
  if (type === 'round' || type === 'buckler') {
    const R = type === 'buckler' ? 0.14 : 0.25;
    add(g, U.lathe('rshield', [[0.001, 0.035], [0.4, 0.03], [0.8, 0.018], [1.0, 0.0], [0.98, -0.01], [0.001, -0.01]], 20), type === 'buckler' ? rim : MT.wood(mix('#7a5a38', pal.body || '#6c7a8c', 0.35)), [0, 0, 0], [HP, 0, 0], [R, R, R]);
    add(g, U.torus(0.04, 5, 24), rim, [0, 0, 0.002], null, [R, R, R * 1.2]);
    if (type !== 'buckler') { add(g, U.lathe('rpaint', [[0.001, 0.036], [0.45, 0.031], [0.62, 0.025]], 20), MT.cloth(pal.trim || '#c8a24a'), [0, 0, 0.001], [HP, 0, 0], [R, R, R]); }
    add(g, U.hemi(10, 5), rim, [0, 0, 0.03], [HP, 0, 0], [R * 0.25, R * 0.25, R * 0.2]);
    g.userData.size = R;
  } else if (type === 'tower') {
    add(g, U.rbox(0.44, 0.78, 0.04, 0.08), face, [0, 0, 0]);
    add(g, U.rbox(0.47, 0.81, 0.03, 0.08), rim, [0, 0, -0.008]);
    add(g, U.box(), tr, [0, 0, 0.022], null, [0.05, 0.6, 0.012]); add(g, U.box(), tr, [0, 0.12, 0.022], null, [0.3, 0.05, 0.012]);
    g.userData.size = 0.4;
  } else { // heater
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([0.17 * Math.cos(t * HP * 0.95) , 0.2 - 0.45 * Math.pow(t, 1.4)]); }
    const sh = [[-0.17, 0.2], [0.17, 0.2]].concat(pts.slice(1).map(p => [p[0], p[1]])).concat([[0, -0.25]]).concat(pts.slice(1).reverse().map(p => [-p[0], p[1]]));
    add(g, U.shape('heater', sh, 0.035, 0.01), face, [0, 0, 0]);
    add(g, U.shape('heater', sh, 0.035, 0.01), rim, [0, 0, -0.012], null, [1.07, 1.05, 0.6]);
    emblem().scale.setScalar(1.2);
    g.userData.size = 0.24;
  }
  return g;
}

/* ---------- headgear */
function addHeadgear(fig) {
  const d = fig.desc, pal = d.palette, M = fig.M, J = fig.J, hs = fig.P.hs, hb = J.head, acc = d.acc || 'none', cls = d.cls;
  const trimM = M.trim, metal = M.metal || MT.metal();
  const hatC = pal.hat || pal.trim || '#5a3a2a';
  if (acc === 'helm') {
    const dome = geo('helmdome', () => new THREE.SphereGeometry(1, 16, 10, 0, TAU, 0, PI * 0.56));
    const heavy = cls === 'fighter' || cls === 'champion' || d.outfit === 'plate';
    add(hb, dome, metal, [0, 0.092 * hs, -0.002], [-0.12, 0, 0], [0.108 * hs, 0.118 * hs, 0.114 * hs]);
    add(hb, U.torus(0.1, 5, 20), metal, [0, 0.105 * hs, 0.0], [HP - 0.12, 0, 0], [0.108 * hs, 0.112 * hs, 0.11]);
    if (heavy) {
      add(hb, U.box(), metal, [0, 0.085 * hs, 0.11 * hs], [0.05, 0, 0], [0.018 * hs, 0.07 * hs, 0.012 * hs]);
      [1, -1].forEach(s => add(hb, U.rbox(0.03, 0.08, 0.07, 0.3), metal, [s * 0.088 * hs, 0.055 * hs, 0.035 * hs], [0, s * 0.35, 0], hs));
      add(hb, U.cyl(10, 1, 1.1), metal, [0, 0.04 * hs, -0.06 * hs], [0.3, 0, 0], [0.09 * hs, 0.06 * hs, 0.06 * hs]);
      if (cls === 'champion') add(hb, U.shape('crest', [[0, 0], [0.04, 0.06], [0.0, 0.1], [-0.09, 0.07], [-0.16, 0.0]], 0.012, 0.004), trimM, [0, 0.2 * hs, 0.05 * hs], [0, -HP, 0], hs);
      else horn(hb, MT.cloth(pal.plume || '#b0302a'), [[0, 0.205 * hs, 0.02], [0, 0.24 * hs, -0.06 * hs], [0, 0.2 * hs, -0.16 * hs], [0, 0.11 * hs, -0.2 * hs]], 0.03 * hs);
      fig.headTop = 0.26 * hs;
    } else if (cls === 'barbarian') {
      [1, -1].forEach(s => horn(hb, MT.horn('#e6dcc4'), [[s * 0.09 * hs, 0.14 * hs, 0], [s * 0.17 * hs, 0.17 * hs, 0.02 * hs], [s * 0.21 * hs, 0.25 * hs, 0.03 * hs], [s * 0.2 * hs, 0.31 * hs, 0.01 * hs]], 0.03 * hs));
      fig.headTop = 0.3 * hs;
    } else fig.headTop = 0.22 * hs;
  } else if (acc === 'hood') {
    const hood = geo('hood', () => new THREE.SphereGeometry(1, 16, 12, HP + 0.85, TAU - 1.7, 0, PI * 0.72));
    const hm = MT.clothDS(pal.hood || pal.cape || pal.body || '#4a4a3a');
    add(hb, hood, hm, [0, 0.09 * hs, -0.012 * hs], [-0.25, 0, 0], [0.122 * hs, 0.13 * hs, 0.125 * hs]);
    spike(hb, hm, [0, 0.16 * hs, -0.07 * hs], [0, 0.11 * hs, -0.2 * hs], 0.05 * hs);
    add(J.chest, U.lathe('cowl', [[0.07, 0.25], [0.13, 0.22], [0.19, 0.17], [0.2, 0.13]], 14), hm, [0, 0, -0.005], null, [fig.P.w, fig.P.h, fig.P.w * 0.8]);
    fig.headTop = 0.23 * hs;
  } else if (acc === 'wizard' || (acc === 'hat' && (cls === 'wizard' || cls === 'sorcerer'))) {
    const hm = MT.cloth(pal.hat || pal.body || '#3c5a8a');
    add(hb, U.cyl(20), hm, [0, 0.165 * hs, -0.005], [-0.12, 0, 0], [0.2 * hs, 0.012, 0.2 * hs]);
    horn(hb, hm, [[0, 0.165 * hs, -0.01], [0, 0.29 * hs, -0.03 * hs], [0, 0.39 * hs, -0.08 * hs], [0, 0.44 * hs, -0.17 * hs]], 0.105 * hs, 10);
    add(hb, U.cyl(16, 0.9, 1), MT.cloth(pal.trim || '#cfa64a'), [0, 0.19 * hs, -0.012 * hs], [-0.12, 0, 0], [0.1 * hs, 0.03, 0.1 * hs]);
    fig.headTop = 0.45 * hs;
  } else if (acc === 'feather' || (acc === 'hat' && cls === 'bard')) {
    const hm = MT.cloth(pal.hat || shade(pal.body || '#6a2a4a', 0.7));
    add(hb, U.cyl(20), hm, [0, 0.165 * hs, 0], [-0.15, 0, 0.12], [0.18 * hs, 0.012, 0.15 * hs]);
    add(hb, U.lathe('cav', [[0.095, 0], [0.1, 0.04], [0.085, 0.08], [0.001, 0.09]], 14), hm, [0, 0.165 * hs, 0], [-0.15, 0, 0.12], hs);
    add(hb, U.sphere(10, 6), MT.cloth(pal.plume || pal.trim || '#e8e0c0'), [0.07 * hs, 0.25 * hs, -0.07 * hs], [0.9, 0.2, -0.5], [0.025 * hs, 0.15 * hs, 0.012 * hs]);
    fig.headTop = 0.32 * hs;
  } else if (acc === 'hat') {
    const hm = MT.leather(pal.hat || '#5a3e28');
    add(hb, U.cyl(20), hm, [0, 0.165 * hs, 0], [-0.1, 0, 0], [0.19 * hs, 0.012, 0.19 * hs]);
    add(hb, U.lathe('crown', [[0.098, 0], [0.095, 0.05], [0.07, 0.085], [0.001, 0.09]], 14), hm, [0, 0.165 * hs, 0], [-0.1, 0, 0], hs);
    add(hb, U.cyl(14, 1, 1, true), MT.cloth(pal.trim || '#8a3020'), [0, 0.185 * hs, 0], [-0.1, 0, 0], [0.1 * hs, 0.02, 0.1 * hs]);
    fig.headTop = 0.27 * hs;
  } else if (acc === 'crown') { addCrown(fig); }
  else if (acc === 'antlers') { addHorns(fig, hb, 'antler', hs); const lm = mat('#4f7a2a', { r: 0.85, ds: true }); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; add(hb, U.sphere(8, 6), lm, [Math.sin(a) * 0.1 * hs, 0.16 * hs, Math.cos(a) * 0.1 * hs], [0.3, a, 0], [0.03 * hs, 0.05 * hs, 0.01 * hs]); } }
  else if (acc === 'redcap') { const hm = MT.cloth('#a01818'); horn(hb, hm, [[0, 0.13 * hs, 0], [0, 0.24 * hs, -0.03 * hs], [0, 0.3 * hs, -0.1 * hs], [0, 0.29 * hs, -0.18 * hs]], 0.1 * hs); fig.headTop = 0.32 * hs; }
  else if (acc === 'headdress') { const gm = MT.gold(); const cm = MT.cloth(pal.trim || '#2a4a8a'); add(hb, geo('nemes', () => new THREE.SphereGeometry(1, 14, 10, HP + 0.9, TAU - 1.8, 0, PI * 0.7)), cm, [0, 0.09 * hs, -0.01], [-0.2, 0, 0], [0.12 * hs, 0.13 * hs, 0.12 * hs]); add(hb, U.cyl(14, 1, 1, true), gm, [0, 0.15 * hs, 0], [-0.15, 0, 0], [0.105 * hs, 0.03, 0.105 * hs]); spike(hb, gm, [0, 0.16 * hs, 0.1 * hs], [0, 0.22 * hs, 0.11 * hs], 0.015); fig.headTop = 0.25 * hs; }
  else if (acc === 'skullcap') { add(hb, geo('helmdome', () => new THREE.SphereGeometry(1, 16, 10, 0, TAU, 0, PI * 0.56)), MT.dmetal(), [0, 0.095 * hs, 0], [-0.12, 0, 0], [0.104 * hs, 0.112 * hs, 0.11 * hs]); }
  else if (acc === 'goggles') { [1, -1].forEach(s => add(hb, U.cyl(10), MT.gold('#8a6a3a'), [s * 0.035 * hs, 0.1 * hs, 0.09 * hs], [HP, 0, 0], [0.025 * hs, 0.02, 0.025 * hs])); add(hb, U.torus(0.06, 4, 18), MT.leather('#3a2a1a'), [0, 0.1 * hs, 0], [HP - 0.1, 0, 0], [0.1 * hs, 0.11 * hs, 0.1]); }
}

/* ---------- equipment & class gear */
function equip(fig) {
  const d = fig.desc, f = d.f, pal = d.palette, M = fig.M, J = fig.J, P = fig.P, h = P.h, w = P.w;
  addHeadgear(fig);
  if (f.crown && !fig._crowned) { fig._crowned = true; }
  fig.anchors = fig.anchors || {};
  const ch = new THREE.Object3D(); ch.position.set(0, 0.1 * h, 0.12 * w); J.chest.add(ch); fig.anchors.chest = ch;
  fig.anchors.head = J.head; fig.anchors.handR = J.handR; fig.anchors.handL = J.handL;
  // main weapon
  const wid = d.weapon && WEAPONS[d.weapon] ? d.weapon : null;
  fig.hold = 'none';
  if (wid && WEAPONS[wid].t !== 'fist') {
    const W = buildWeapon(fig, wid); fig.weapon = W; fig.hold = W.hold;
    const hand = W.hold === 'bow' ? J.handL : J.handR;
    hand.add(W.group); W.group.position.set(0, -0.05, 0.012);
    const A = { one: 2.0, two: 1.65, pole: 1.35, staff: 1.32, bow: 0.25, xbow: 1.55, hxbow: 1.62 };
    W.group.rotation.set(A[W.hold] != null ? A[W.hold] : 1.7, 0, 0);
    if (W.hold === 'bow') { W.group.rotation.set(0.6, 0.15, 0.0); }
    if (W.hold === 'staff' || W.hold === 'pole') W.group.position.set(0, -0.05, 0.01);
    fig.anchors.weapon = W.tip;
  } else { fig.hold = d.cls === 'monk' || (wid && WEAPONS[wid].t === 'fist') ? 'fist' : 'none'; }
  if (fig.hold === 'fist' && d.cls === 'monk') fig.monk = true;
  // offhand weapon (dual wield)
  if (d.offhand && WEAPONS[d.offhand] && !d.shield && (fig.hold === 'one') && WEAPONS[d.offhand].t !== 'fist') {
    const W2 = buildWeapon(fig, d.offhand); J.handL.add(W2.group); W2.group.position.set(0, -0.05, 0.012); W2.group.rotation.set(1.75, 0, 0); fig.offWeapon = W2;
  }
  // shield
  if (d.shield && fig.hold !== 'two' && fig.hold !== 'pole' && fig.hold !== 'bow' && fig.hold !== 'xbow') {
    const S = buildShield(fig, d.shield); const sg = new THREE.Group(); J.foreL.add(sg);
    sg.position.set(0.065 * w, -P.fo * 0.5, 0.0);
    const mb = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)); sg.quaternion.setFromRotationMatrix(mb);
    sg.add(S); fig.shield = sg; fig.shieldType = d.shield;
  }
  // quiver
  if (f.quiver || fig.hold === 'bow') {
    const q = grp(J.chest, [-0.06 * w, 0.06 * h, -0.13 * w], [0.15, 0, 0.45]);
    add(q, U.cyl(10, 1, 0.9), MT.leather(pal.quiver || '#6a4428'), [0, 0, 0], null, [0.045, 0.36, 0.045]);
    add(q, U.cyl(10), MT.leather('#3a2618'), [0, 0.15, 0], null, [0.048, 0.03, 0.048]);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; rod(q, MT.wood('#a08060'), [Math.sin(a) * 0.02, 0.15, Math.cos(a) * 0.02], [Math.sin(a) * 0.022, 0.25, Math.cos(a) * 0.022], 0.004, 0.004, 4); add(q, U.box(), mat(pal.fletch || '#e8e0d0'), [Math.sin(a) * 0.022, 0.24, Math.cos(a) * 0.022], [0, a, 0], [0.003, 0.05, 0.022]); }
  }
  if (f.lute) {
    const l = grp(J.chest, [0.0, 0.06 * h, -0.14 * w], [0.05, PI, -0.6]);
    const lw = MT.wood('#9a6a38');
    ell(l, lw, [0, -0.06, 0], [0.11, 0.14, 0.05]);
    ell(l, MT.dark(), [0, -0.03, 0.045], [0.025, 0.025, 0.006]);
    add(l, U.rbox(0.035, 0.3, 0.02, 0.3), MT.wood('#4a2a18'), [0, 0.18, 0.01]);
    add(l, U.rbox(0.05, 0.08, 0.02, 0.3), MT.wood('#4a2a18'), [0, 0.35, -0.01], [-0.4, 0, 0]);
  }
  if (f.book) { const b = grp(J.spine, [0.12 * w, -0.02, 0.02], [0, -0.3, 0]); add(b, U.rbox(0.035, 0.12, 0.1, 0.2), MT.leather(pal.book || '#5a1a1a'), [0, 0, 0]); add(b, U.box(), mat('#efe6d0'), [0.0, 0, 0.004], null, [0.03, 0.105, 0.09]); add(b, U.box(), MT.gold(), [0.019, 0, 0], null, [0.004, 0.03, 0.03]); }
  if (f.symbol) { const s = grp(J.chest, [0, 0.13 * h, 0.115 * w], [-0.15, 0, 0]); add(s, U.cyl(16), MT.gold(pal.symbol || '#e0b850'), [0, 0, 0], [HP, 0, 0], [0.04, 0.012, 0.04]); add(s, U.shape('sun', [[0, 0.03], [0.008, 0.008], [0.03, 0], [0.008, -0.008], [0, -0.03], [-0.008, -0.008], [-0.03, 0], [-0.008, 0.008]], 0.006, 0.002), MT.emis('#fff0b0', 0.8), [0, 0, 0.008]); }
  if (f.tabard) {
    const tm = MT.cloth(pal.tabard || pal.body || '#3a4a8a');
    add(J.hips, U.rbox(0.19 * w, 0.42 * h, 0.012, 0.15), tm, [0, -0.17 * h, 0.115 * w], [-0.06, 0, 0]);
    add(J.hips, U.rbox(0.19 * w, 0.4 * h, 0.012, 0.15), tm, [0, -0.16 * h, -0.11 * w], [0.06, 0, 0]);
    add(J.chest, U.rbox(0.22 * w, 0.24 * h, 0.012, 0.15), tm, [0, 0.07 * h, 0.112 * w], [-0.1, 0, 0]);
    add(J.chest, U.shape('emblem', [[0, 0.07], [0.02, 0.02], [0.07, 0.0], [0.02, -0.02], [0, -0.08], [-0.02, -0.02], [-0.07, 0.0], [-0.02, 0.02]], 0.01, 0.003), MT.gold(mix(pal.trim || '#c8a24a', '#d2a640', 0.3)), [0, 0.08 * h, 0.122 * w], [-0.1, 0, 0], 0.9);
  }
  if (f.pouches) for (let i = 0; i < 2; i++) add(J.spine, U.rbox(0.05, 0.05, 0.03, 0.3), MT.leather('#4a3020'), [(i ? -1 : 1) * 0.1 * w, -0.01, 0.06 * w], [0, (i ? -1 : 1) * 0.7, 0]);
  if (f.runes) { const rm = fig.perMat(MT.emis(pal.glow || '#c060ff', 1.5)); fig.runeMat = rm; ['L', 'R'].forEach(s => { for (let i = 0; i < 3; i++) keep(add(J['fore' + s], U.box(), rm, [(s === 'L' ? 1 : -1) * 0.036 * w, -0.05 - i * 0.05, 0.0], [0, 0, 0.3 * (i - 1)], [0.004, 0.03, 0.012])).castShadow = false; }); }
  if (f.wisps) {
    const wm = fig.perMat(MT.emis(pal.glow || '#c060ff', 2.2)); wm.transparent = true; wm.opacity = 0.9; fig.wispMat = wm;
    const ws = []; for (let i = 0; i < 3; i++) { const o = keep(add(J.spine, U.sphere(8, 6), wm, [0, 0, 0], null, 0.022)); o.castShadow = false; ws.push(o); }
    fig.updaters.push((fg) => { const t = fg.t * 1.6; ws.forEach((o, i) => { const a = t + i * TAU / 3; o.position.set(Math.sin(a) * 0.26 * w, 0.15 * h + Math.sin(t * 1.7 + i) * 0.12, Math.cos(a) * 0.22 * w); }); });
  }
  // hand glow (cast)
  const gmat = fig.perMat(mat('#8fd0ff', { basic: true, add: true, op: 0.9 }));
  fig.glowMat = gmat;
  ['L', 'R'].forEach(s => { const o = keep(add(J['hand' + s], U.sphere(10, 8), gmat, [0, -0.05, 0.02], null, 0.001)); o.castShadow = false; o.visible = false; fig.glow.push(o); });
  if (fig.weapon && fig.weapon.t === 'staff') { const o = keep(add(fig.weapon.tip, U.sphere(10, 8), gmat, [0, 0, 0], null, 0.001)); o.castShadow = false; o.visible = false; fig.glow.push(o); }
}
/* ============================================================ HUMANOID stances, IK, base motion */
const _wv = new THREE.Vector3(), _wv2 = new THREE.Vector3(), _wq = new THREE.Quaternion(), _we = new THREE.Euler();
function humanoidStances(fig) {
  const d = fig.desc, P = fig.P, J = fig.J, hold = fig.hold, lg = P.legs * P.h;
  const S = {};
  const legsOn = !!J.thighL && P.lower === 'legs';
  if (legsOn) Object.assign(S, { hips: [0, 0.1, 0, 0, -0.02 * lg, 0], thighL: [-0.22, 0.05, 0.07], shinL: [0.26, 0, 0], footL: [-0.04, -0.05, 0], thighR: [0.16, -0.12, -0.08], shinR: [0.2, 0, 0], footR: [-0.14, 0.1, 0], spine: [0.04, -0.06, 0], chest: [0.0, -0.05, 0], neck: [0, 0.08, 0], head: [0.02, 0.03, 0] });
  switch (hold) {
    case 'one': Object.assign(S, { armR: [-0.3, 0, -0.22], foreR: [-0.95, 0, 0], handR: [0.05, 0, 0] }); if (!fig.shield && !fig.offWeapon) Object.assign(S, { armL: [0.06, 0, 0.17], foreL: [-0.4, 0, 0] }); break;
    case 'two': Object.assign(S, { armR: [-0.42, 0.45, -0.02], foreR: [-1.3, 0, 0], handR: [0.15, 0, 0.35], armL: [-0.4, -0.3, 0.1], foreL: [-1.2, 0, 0], chest: [0.02, -0.22, 0], neck: [0, 0.2, 0] }); break;
    case 'pole': Object.assign(S, { armR: [-0.28, 0.15, -0.17], foreR: [-1.32, 0, 0], handR: [0, 0, 0.1], armL: [-0.3, -0.3, 0.15], foreL: [-1.0, 0, 0] }); break;
    case 'staff': Object.assign(S, { armR: [-0.2, 0, -0.24], foreR: [-1.12, 0, 0], handR: [0.0, 0, 0.08], armL: [0.04, 0, 0.16], foreL: [-0.35, 0, 0] }); break;
    case 'bow': Object.assign(S, { armL: [-0.32, 0, 0.18], foreL: [-0.55, 0, 0], handL: [0, 0, 0], armR: [0.03, 0, -0.15], foreR: [-0.4, 0, 0] }); break;
    case 'xbow': Object.assign(S, { armR: [-0.18, 0, -0.18], foreR: [-1.15, 0, 0], armL: [-0.4, -0.4, 0.2], foreL: [-1.3, 0, 0] }); break;
    case 'hxbow': Object.assign(S, { armR: [-0.4, 0, -0.18], foreR: [-1.0, 0, 0], armL: [0.06, 0, 0.17], foreL: [-0.4, 0, 0] }); break;
    case 'fist':
      if (fig.monk) Object.assign(S, { armR: [-0.55, 0.1, -0.28], foreR: [-2.1, 0, 0], armL: [-0.85, -0.1, 0.25], foreL: [-1.95, 0, 0], chest: [0.05, 0.22, 0], neck: [0, -0.2, 0], thighL: [-0.35, 0.15, 0.12], shinL: [0.35, 0, 0], thighR: [0.22, -0.2, -0.12], shinR: [0.35, 0, 0], hips: [0, 0.3, 0, 0, -0.05 * lg, 0] });
      else Object.assign(S, { armR: [-0.35, 0, -0.28], foreR: [-1.4, 0, 0], armL: [-0.35, 0, 0.28], foreL: [-1.4, 0, 0] });
      break;
    default: Object.assign(S, { armR: [-0.04, 0, -0.12], foreR: [-0.4, 0, 0], armL: [-0.04, 0, 0.12], foreL: [-0.4, 0, 0] });
  }
  if (fig.offWeapon) Object.assign(S, { armL: [-0.3, 0, 0.22], foreL: [-0.95, 0, 0] });
  if (fig.shield) Object.assign(S, { armL: [-0.28, -0.4, 0.3], foreL: [-1.3, 0, 0] });
  const st = d.stance;
  if (st === 'zombie') Object.assign(S, { armR: [-1.35, 0, 0.05], foreR: [-0.2, 0, 0], armL: [-1.25, 0, -0.05], foreL: [-0.3, 0, 0], neck: [0.25, 0, 0.15], head: [0.1, 0, 0.2] });
  if (st === 'claws' || st === 'beast') Object.assign(S, { armR: [-0.55, 0, -0.38], foreR: [-1.15, 0, 0], handR: [0.4, 0, 0], armL: [-0.55, 0, 0.38], foreL: [-1.15, 0, 0], handL: [0.4, 0, 0] });
  if (st === 'regal') Object.assign(S, { armL: [0.1, 0, 0.25], foreL: [-0.9, 0, 0] });
  if (st === 'hover') Object.assign(S, { armR: [-0.5, 0, -0.35], foreR: [-0.5, 0, 0], armL: [-0.5, 0, 0.35], foreL: [-0.5, 0, 0] });
  if (st === 'knuckle') Object.assign(S, { armR: [-0.6, 0, -0.25], foreR: [-0.1, 0, 0], armL: [-0.6, 0, 0.25], foreL: [-0.1, 0, 0] });
  const hunch = (d.build && d.build.hunch) || 0;
  if (hunch) { S.spine = add3(S.spine, [hunch * 0.6, 0, 0]); S.chest = add3(S.chest, [hunch * 0.5, 0, 0]); S.neck = add3(S.neck, [-hunch * 0.5, 0, 0]); S.head = add3(S.head, [-hunch * 0.45, 0, 0]); }
  fig.stance = S;
  if (fig.shield) {
    const SU = Object.assign({}, S, { armL: [-1.02, -1.3, 0.2], foreL: [-1.5, 0, 0], chest: add3(S.chest, [0.06, 0.18, 0]), spine: add3(S.spine, [0.06, 0.05, 0]), neck: add3(S.neck, [0.05, -0.12, 0]) });
    fig.stanceShield = SU;
  }
  // IK: support hand on two-handed weapons
  const W = fig.weapon;
  if (W && W.grip2 && (fig.hold === 'two' || fig.hold === 'pole' || fig.hold === 'xbow')) {
    fig.ik.push({ upper: J.armL, fore: J.foreL, hand: J.handL, w: f => f.ikW == null ? 1 : f.ikW,
      target: f => W.grip2.getWorldPosition(_wv), pole: f => f.toWorld(0.55, P.hipY * 0.8, -0.35, _wv2) });
  }
  if (fig.hold === 'bow') fig.aimFn = aimBow;
  if (fig.hold === 'xbow' || fig.hold === 'hxbow') fig.aimFn = aimXbow;
  P.shY = J.hips.position.y + (0.09 + 0.15 + 0.145) * P.h;
}
function add3(a, b) { a = a || [0, 0, 0]; return [(a[0] || 0) + b[0], (a[1] || 0) + b[1], (a[2] || 0) + b[2], a[3] || 0, a[4] || 0, a[5] || 0]; }

function aimBow(fig) {
  const W = fig.weapon, B = W.bow, J = fig.J, P = fig.P, aw = fig.aimW || 0;
  if (aw > 0.001) {
    const tgtL = fig.toWorld(0.05, P.shY + 0.02, 0.5 * P.h, new THREE.Vector3());
    fig.twoBone(J.armL, J.foreL, J.handL, tgtL, fig.toWorld(0.7, P.shY - 0.4, 0.1, new THREE.Vector3()), aw);
    _we.set(0, 0, -0.18); _wq.setFromEuler(_we);
    fig.orientBone(J.handL, _wq, W.group.quaternion, aw);
    W.group.updateMatrixWorld(true);
    const rest = W.group.localToWorld(new THREE.Vector3(0, 0, B.restZ));
    const anchor = fig.toWorld(-0.02, P.shY + 0.08 * P.h, 0.06, new THREE.Vector3());
    const tgtR = rest.lerp(anchor, fig.draw || 0);
    fig.twoBone(J.armR, J.foreR, J.handR, tgtR, fig.toWorld(-0.7, P.shY + 0.1, -0.5, new THREE.Vector3()), aw);
  }
  // string
  W.group.updateMatrixWorld(true);
  const top = B.tTop.position, bot = B.tBot.position;
  let nock = _v1.set(0, 0, B.restZ);
  if ((fig.draw || 0) > 0.01 && aw > 0.01) { J.handR.updateMatrixWorld(true); nock = W.group.worldToLocal(J.handR.localToWorld(_v1.set(0, -0.05, 0.0))); }
  setRod(B.s1, top, nock, 0.0035); setRod(B.s2, nock, bot, 0.0035);
  B.arrow.visible = !!fig.nock;
  if (fig.nock) { B.arrow.position.copy(nock); _v2.set(0, 0, 0).sub(nock); _v2.y *= 0.2; _v2.normalize(); if (_v2.lengthSq() > 0.5) B.arrow.quaternion.setFromUnitVectors(_v3.set(0, 0, 1), _v2); }
}
function setRod(o, a, b, r) { o.position.copy(a).add(b).multiplyScalar(0.5); const l = a.distanceTo(b); o.scale.set(r, Math.max(l, 1e-4), r); _v5.copy(b).sub(a).normalize(); o.quaternion.setFromUnitVectors(_up, _v5); }
function aimXbow(fig) {
  const W = fig.weapon, J = fig.J, P = fig.P, aw = fig.aimW || 0;
  if (aw <= 0.001) return;
  const hx = fig.hold === 'hxbow';
  const tgt = fig.toWorld(hx ? -0.08 : -0.07, P.shY + (hx ? 0.0 : -0.03), hx ? 0.48 * P.h : 0.26 * P.h, new THREE.Vector3());
  fig.twoBone(J.armR, J.foreR, J.handR, tgt, fig.toWorld(-0.7, P.shY - 0.45, -0.1, new THREE.Vector3()), aw);
  _we.set(HP - (fig.recoil || 0), 0, 0); _wq.setFromEuler(_we);
  fig.orientBone(J.handR, _wq, W.group.quaternion, aw);
}

function humBase(fig, dt, w) {
  const d = fig.desc, P = fig.P, J = fig.J, t = fig.t + fig.ph;
  // left-hand IK weight (two-handed grip): released while dead or during clips that free the hand
  let ikw = 1 - (fig.deadW || 0);
  if (fig.active && fig.active.freeL) { const A = fig.active; const e = clamp(Math.min(A.t / 0.12, (A.dur - A.t) / 0.15), 0, 1); ikw *= 1 - e; }
  fig.ikW = ikw;
  breathe(fig, w);
  const s = Math.sin(t * 0.55);
  fig.rot('hips', 0, 0, 0.018 * s * w); fig.mov('hips', 0.006 * s * w, 0, 0); fig.rot('chest', 0, 0, -0.014 * s * w);
  fig.rot('neck', 0.03 * Math.sin(t * 0.29) * w, 0.22 * Math.sin(t * 0.31) * Math.sin(t * 0.13) * w, 0);
  if (fig.zombie) { fig.rot('neck', 0, 0, 0.1 * Math.sin(t * 0.7) * w); fig.rot('armR', 0.08 * Math.sin(t * 1.1) * w, 0, 0); fig.rot('armL', 0.08 * Math.sin(t * 1.3 + 1) * w, 0, 0); }
  // locomotion
  const mw = fig.moveW * w;
  const spd = fig.speed || 4;
  const stride = (fig.lowerTail ? 1.4 : 1.15 * Math.max(0.6, P.legs * P.h)) * (spd > 3.5 ? 1.35 : 1);
  fig.phase += dt * spd / (stride * fig.S) * TAU * (fig.moveW > 0.01 ? 1 : 0);
  if (mw > 0.001) { if (fig.centaur) quadGait(fig, mw, spd); else humWalk(fig, mw, spd); }
  // flight / hover
  const hov = (fig.hoverH || 0.3 * P.h) * fig.flyW;
  if (fig.floaty) { fig.mov('root', 0, (0.14 + Math.sin(t * 1.6) * 0.035) * w, 0); fig.rot('tail0', 0.06 * Math.sin(t * 1.3), 0, 0.05 * Math.sin(t * 0.9)); fig.rot('tail1', 0.1 * Math.sin(t * 1.3 - 0.6), 0, 0.08 * Math.sin(t * 0.9 - 0.5)); }
  if (fig.flyW > 0.001) {
    fig.mov('root', 0, (hov + Math.sin(t * 2.2) * 0.045 * fig.flyW) * w, 0);
    const fw = fig.flyW * w;
    ['L', 'R'].forEach(sd => { fig.rot('thigh' + sd, 0.25 * fw, 0, 0); fig.rot('shin' + sd, 0.55 * fw, 0, 0); fig.rot('foot' + sd, 0.5 * fw, 0, 0); });
    fig.rot('spine', 0.08 * fw, 0, 0);
  }
  if (fig.wings) wingMotion(fig, t, w);
  if (fig.tail) fig.tail.forEach((b, i) => { fig.rot(b.name, 0.03 * Math.sin(t * 1.1 - i * 0.5), (0.1 + 0.15 * mw) * Math.sin(t * (1.2 + mw * 4) - i * 0.6), 0); });
  if (fig.lowerTail === 'snake' || fig.lowerTail === 'fish') {
    const n = fig.tailN; const amp = 0.08 + 0.3 * mw, sp = 1.2 + 6 * mw;
    for (let i = 1; i < n; i++) { if (fig.lowerTail === 'snake') fig.rot('tail' + i, 0, amp * Math.sin(t * sp - i * 0.9), 0); else fig.rot('tail' + i, amp * 0.8 * Math.sin(t * sp * 0.8 - i * 0.8), 0, 0); }
    fig.rot('hips', 0, 0.06 * Math.sin(t * sp * 0.5), 0.04 * Math.sin(t * sp));
  }
  if (fig.lowerTail === 'tentacles') for (let k = 0; k < 6; k++) for (let i = 0; i < 3; i++) fig.rot('tent' + k + '_' + i, 0.12 * Math.sin(t * 2 + k + i * 0.7), 0, 0.12 * Math.cos(t * 1.7 + k + i * 0.7));
  if (fig.cape) { const c = fig.cape.name; fig.rot(c, (0.05 + 0.04 * Math.sin(t * 1.3) + mw * (0.25 + 0.15 * Math.sin(fig.phase * 2)) + fig.flyW * 0.5) * w, 0.03 * Math.sin(t * 0.9) * w, 0); }
}
function humWalk(fig, w, spd) {
  const P = fig.P, p = fig.phase, s = Math.sin(p), c = Math.cos(p);
  const run = clamp((spd - 3) / 2.5, 0, 1) * (fig.robe ? 0.5 : 1);
  if (fig.lowerTail) {
    fig.rot('spine', 0.06 * w, 0.05 * s * w, 0.04 * s * w);
    if (fig.floaty) fig.rot('spine', 0.18 * w, 0, 0);
    fig.rot('armL', 0.15 * s * w, 0, 0); fig.rot('armR', -0.15 * s * w, 0, 0);
    return;
  }
  const A = (fig.robe ? 0.36 : 0.48) + 0.3 * run, K = 0.75 + 0.6 * run;
  const tL = -A * s, tR = A * s;
  const kL = 0.12 + K * Math.max(0, c), kR = 0.12 + K * Math.max(0, -c);
  fig.rot('thighL', tL * w, 0, 0); fig.rot('thighR', tR * w, 0, 0);
  fig.rot('shinL', kL * w, 0, 0); fig.rot('shinR', kR * w, 0, 0);
  fig.rot('footL', (-0.35 * tL - 0.3 * Math.max(0, c)) * w, 0, 0); fig.rot('footR', (-0.35 * tR - 0.3 * Math.max(0, -c)) * w, 0, 0);
  const lg = P.legs * P.h;
  fig.mov('hips', 0, (-(0.025 + 0.03 * run) * Math.abs(s) + 0.012) * lg * w, 0);
  fig.rot('hips', 0, 0.12 * s * w, 0); fig.rot('chest', 0, -0.16 * s * w, 0);
  fig.rot('spine', (0.06 + 0.22 * run) * w, 0, 0); fig.rot('neck', -(0.03 + 0.12 * run) * w, 0, 0);
  const B = 0.45 + 0.35 * run;
  const busyR = fig.hold !== 'none' && fig.hold !== 'fist', busyL = fig.shield || fig.hold === 'two' || fig.hold === 'pole' || fig.hold === 'xbow' || fig.offWeapon || fig.hold === 'bow';
  fig.rot('armL', B * s * w * (busyL ? 0.25 : 1), 0, 0); fig.rot('armR', -B * s * w * (busyR ? 0.3 : 1), 0, 0);
  fig.rot('foreL', -(0.15 + 0.7 * run) * w * (busyL ? 0.2 : 1), 0, 0); fig.rot('foreR', -(0.15 + 0.7 * run) * w * (busyR ? 0.2 : 1), 0, 0);
}
function wingMotion(fig, t, w) {
  const W = fig.wings, fw = fig.flyW, ins = W.type === 'insect';
  const fr = ins ? 38 : (fig.flapRate || 6.5);
  const fl = Math.sin(t * fr);
  const L = { r1: [0.25, 1.25, 0.5], r2: [0, 2.2, -0.1] };      // folded
  const O = { r1: [0.05, 0.12, 0.25 + 0.6 * fl], r2: [0, 0.12, 0.15 + 0.35 * Math.sin(t * fr - 0.9)] };
  if (ins) { L.r1 = [0.2, 1.1, 0.25]; L.r2 = [0, 0.3, 0]; O.r1 = [0.0, 0.25 + 0.25 * fl, 0.15]; O.r2 = [0, 0.1, 0]; }
  const idle = (1 - fw) * 0.04 * Math.sin(t * 1.2);
  ['L', 'R'].forEach(sd => {
    const sg = sd === 'L' ? 1 : -1;
    const a = W[sd][0].name, b = W[sd][1].name;
    const r1 = [lerp(L.r1[0], O.r1[0], fw), lerp(L.r1[1], O.r1[1], fw), lerp(L.r1[2], O.r1[2], fw) + idle];
    const r2 = [lerp(L.r2[0], O.r2[0], fw), lerp(L.r2[1], O.r2[1], fw), lerp(L.r2[2], O.r2[2], fw)];
    fig.rot(a, r1[0] * w, sg * r1[1] * w, sg * r1[2] * w);
    fig.rot(b, r2[0] * w, sg * r2[1] * w, sg * r2[2] * w);
  });
}

/* ---------- lying poses */
function humLie(fig, p) {
  const P = fig.P, H = P.hipY + 0.62 * P.h, lg = P.legs * P.h;
  const full = o => { ['spine', 'chest', 'neck', 'head', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'hips', 'root', 'tail0', 'tail1', 'jaw'].forEach(k => { if (!o[k]) o[k] = [0, 0, 0]; }); return o; };
  if (fig.centaur) { const o = bstLie(fig, p); Object.assign(o, { spine: [0.3, 0, 0.2], neck: [0.3, 0, 0.3], armL: [-0.5, 0, 0.6], armR: [-0.5, 0, -0.6] }); return o; }
  if (fig.lowerTail) {
    const y = -P.hipY * 0.8;
    if (p === 'prone') return full({ hips: [1.2, 0, 0, 0, y + 0.1, 0.15], neck: [-0.7, 0, 0], head: [-0.3, 0, 0], armL: [-2.3, 0, 0.4], foreL: [-1.0, 0, 0], armR: [-2.3, 0, -0.4], foreR: [-1.0, 0, 0], root: [0, 0, 0, 0, fig.floaty ? -0.12 : 0, 0] });
    if (p === 'down') return full({ hips: [1.3, 0, 0.4, 0, y + 0.08, 0.1], neck: [0.3, 0, 0.4], head: [0.2, 0.3, 0], armL: [-1.4, 0, 0.6], foreL: [-0.4, 0, 0], armR: [-0.6, 0, -0.6], foreR: [-0.3, 0, 0], root: [0, 0, 0, 0, fig.floaty ? -0.12 : 0, 0] });
    return full({ hips: [1.45, 0, 0.6, 0, y + 0.05, 0.1], spine: [0.2, 0, 0.2], neck: [0.5, 0, 0.5], head: [0.3, 0.4, 0], armL: [-1.8, 0, 0.9], foreL: [-0.2, 0, 0], armR: [-0.8, 0, -0.9], foreR: [-0.2, 0, 0], jaw: [0.35, 0, 0], root: [0, 0, 0, 0, fig.floaty ? -0.14 : 0, 0] });
  }
  if (p === 'prone') return full({ root: [HP, 0, 0, 0, 0.13, -H * 0.46], neck: [-0.75, 0, 0], head: [-0.35, 0, 0], armL: [-2.5, -0.3, 0.45], foreL: [-1.2, 0, 0], armR: [-2.5, 0.3, -0.45], foreR: [-1.2, 0, 0], handR: [-1.3, 0, 0], thighL: [-0.06, 0, 0.06], shinL: [0.02, 0, 0], footL: [1.0, 0, 0], thighR: [-0.06, 0, -0.06], shinR: [0.02, 0, 0], footR: [1.0, 0, 0] });
  if (p === 'down') return full({ root: [-HP, 0, 0, 0, 0.12, H * 0.46], neck: [0.05, 0.5, 0], head: [0, 0.3, 0.1], armL: [-0.1, 0, 0.75], foreL: [-0.5, 0, 0], armR: [0.0, 0, -0.95], foreR: [-0.3, 0, 0], handR: [-1.6, 0, 0], thighL: [-0.35, 0, 0.05], shinL: [0.7, 0, 0], footL: [-0.3, 0, 0], thighR: [0, 0, -0.12], shinR: [0.1, 0, 0], footR: [-0.5, 0, 0] });
  // dead: crumpled on the right side
  return full({ root: [0.12, 0, HP, H * 0.45, 0.16, 0], spine: [0.35, 0, 0], chest: [0.2, 0, 0], neck: [0.45, 0, 0.35], head: [0.25, 0, 0.25], jaw: [0.3, 0, 0], armR: [-1.45, 0, 0.25], foreR: [-0.35, 0, 0], handR: [0.4, 0, 0], armL: [-0.7, 0, 0.55], foreL: [-0.9, 0, 0], thighL: [-1.0, 0, 0], shinL: [1.45, 0, 0], footL: [0.3, 0, 0], thighR: [-0.55, 0, 0], shinR: [0.85, 0, 0], footR: [0.3, 0, 0] });
}

/* ---------- clip helpers */
function lungePose(fig, k) {
  const lg = fig.P.legs * fig.P.h; k = k == null ? 1 : k;
  if (fig.lowerTail) return { hips: [0.25 * k, 0, 0, 0, 0, 0.12 * k] };
  return { root: [0, 0, 0, 0, 0, 0.14 * k], hips: [0, 0.1, 0, 0, -0.07 * lg * k, 0], thighL: [-0.85 * k, 0.05, 0.06], shinL: [0.85 * k, 0, 0], footL: [0.0, 0, 0], thighR: [0.35 * k, -0.1, -0.06], shinR: [0.4 * k, 0, 0], footR: [-0.35 * k, 0, 0] };
}
function P_(...objs) { return Object.assign({}, ...objs); }
function hasJ(fig, n) { return !!fig.J[n]; }

function glowFn(start, peak, flash, end) {
  return (fig, t, A) => {
    let k = 0;
    if (t < peak) k = EASE.io(clamp((t - start) / (peak - start), 0, 1));
    else if (t < flash) k = 1 + 0.6 * EASE.out(clamp((t - peak) / (flash - peak), 0, 1));
    else k = 1.6 * (1 - EASE.out(clamp((t - flash) / (end - flash), 0, 1)));
    setGlow(fig, k, A.color, A.hands || 'both');
  };
}
function setGlow(fig, k, color, which) {
  if (fig.glowMat) { if (color != null) fig.glowMat.color.set(color).convertSRGBToLinear(); fig.glowMat.opacity = clamp(k, 0, 1) * 0.85; }
  fig.glow.forEach((o, i) => { const use = which === 'both' || (which === 'L' && i === 0) || (which === 'R' && i === 1) || i === 2; const sc = use ? Math.max(0.001, k * (i === 2 ? 0.07 : 0.055)) : 0.001; o.scale.setScalar(sc); o.visible = use && k > 0.02; });
  if (fig.staffGlow) { fig.staffGlow.emissiveIntensity = 1.2 + k * 2.5; if (color != null && k > 0.05) fig.staffGlow.emissive.set(color).convertSRGBToLinear(); }
  if (fig.runeMat) fig.runeMat.emissiveIntensity = 1.5 + k * 2;
  if (fig.wispMat) fig.wispMat.emissiveIntensity = 2.2 + k * 2;
}

/* ---------- humanoid clips */
const HUM_CLIPS = {
  melee(fig, o) {
    let style = o.style || fig.desc.melee || (fig.weapon ? fig.weapon.style : (fig.monk ? 'unarmed' : (fig.desc.f && fig.desc.f.claws ? 'claw' : 'unarmed')));
    if (style === 'unarmed' && fig.monk && (o.variant === 'kick' || (o.variant == null && Math.random() < 0.4))) style = 'kick';
    const fn = HUM_MELEE[style] || HUM_MELEE.slash;
    return fn(fig, o);
  },
  ranged(fig, o) {
    let style = o.style || fig.desc.ranged || (fig.hold === 'bow' ? 'bow' : fig.hold === 'xbow' || fig.hold === 'hxbow' ? 'crossbow' : 'throw');
    if (style === 'bow' && fig.hold !== 'bow') style = 'throw';
    if (style === 'crossbow' && !(fig.hold === 'xbow' || fig.hold === 'hxbow')) style = 'throw';
    return (HUM_RANGED[style] || HUM_RANGED.throw)(fig, o);
  },
  cast(fig, o) {
    const staff = fig.weapon && fig.weapon.t === 'staff';
    const color = o.color || fig.desc.palette.glow || '#8fd0ff';
    const twoH = fig.hold === 'two' || fig.hold === 'pole' || fig.hold === 'xbow';
    const lg = fig.P.legs * fig.P.h;
    let keys;
    if (staff) keys = [[0, 'S'], [0.3, { armR: [-1.5, 0.1, -0.25], foreR: [-0.9, 0, 0], armL: [-0.9, -0.2, 0.3], foreL: [-1.4, 0, 0], spine: [-0.06, 0, 0], head: [-0.1, 0, 0] }, 'out'],
      [0.55, { armR: [-2.55, 0, -0.18], foreR: [-0.25, 0, 0], handR: [0, 0, 0.1], armL: [-1.2, -0.3, 0.35], foreL: [-1.2, 0, 0], spine: [-0.15, 0, 0], chest: [-0.12, 0, 0], head: [-0.25, 0, 0], hips: [0, 0, 0, 0, 0.02, 0] }, 'io'],
      [0.7, P_(lungePose(fig, 0.5), { armR: [-1.65, 0.05, -0.1], foreR: [-0.15, 0, 0], handR: [0.5, 0, 0], armL: [-1.45, 0.1, 0.1], foreL: [-0.1, 0, 0], spine: [0.15, 0, 0], chest: [0.12, 0, 0], head: [0.05, 0, 0] }), 'snap'],
      [0.88, P_(lungePose(fig, 0.5), { armR: [-1.6, 0.05, -0.1], foreR: [-0.2, 0, 0], handR: [0.5, 0, 0], armL: [-1.4, 0.1, 0.1], foreL: [-0.15, 0, 0], spine: [0.12, 0, 0], chest: [0.1, 0, 0] }), 'io'],
      [1.2, 'S', 'io']];
    else if (twoH || fig.shield || fig.hold === 'bow') {
      // free hand (left) gesture; weapon arm stays in stance
      const L = fig.shield || fig.hold === 'bow' ? 'R' : 'L', sg = L === 'L' ? 1 : -1;
      const k = {}; k['arm' + L] = [-1.25, -0.2 * sg, 0.35 * sg]; k['fore' + L] = [-1.4, 0, 0];
      const k2 = {}; k2['arm' + L] = [-1.55, 0.05 * sg, 0.05 * sg]; k2['fore' + L] = [-0.08, 0, 0]; k2['hand' + L] = [-0.6, 0, 0];
      keys = [[0, 'S'], [0.4, P_(k, { spine: [-0.08, 0, 0], head: [-0.12, 0, 0] }), 'out'], [0.7, P_(lungePose(fig, 0.4), k2, { spine: [0.12, 0, 0], chest: [0.1, 0.1 * sg, 0] }), 'snap'], [0.88, P_(lungePose(fig, 0.4), k2), 'io'], [1.15, 'S', 'io']];
      if (twoH) o.freeL = true;
      o.hands = L;
    } else keys = [[0, 'S'], [0.3, { armR: [-1.0, 0.35, -0.4], foreR: [-1.55, 0, 0], armL: [-1.0, -0.35, 0.4], foreL: [-1.55, 0, 0], spine: [-0.08, 0, 0], chest: [-0.06, 0, 0], head: [-0.1, 0, 0] }, 'out'],
      [0.55, { armR: [-1.4, 0.25, -0.3], foreR: [-1.25, 0, 0], armL: [-1.4, -0.25, 0.3], foreL: [-1.25, 0, 0], spine: [-0.16, 0, 0], chest: [-0.1, 0, 0], head: [-0.18, 0, 0], hips: [0, 0, 0, 0, 0.02, 0] }, 'io'],
      [0.7, P_(lungePose(fig, 0.45), { armR: [-1.55, -0.05, 0.06], foreR: [-0.05, 0, 0], handR: [-0.6, 0, 0], armL: [-1.55, 0.05, -0.06], foreL: [-0.05, 0, 0], handL: [-0.6, 0, 0], spine: [0.14, 0, 0], chest: [0.1, 0, 0], head: [0.05, 0, 0] }), 'snap'],
      [0.88, P_(lungePose(fig, 0.45), { armR: [-1.5, -0.05, 0.06], foreR: [-0.12, 0, 0], handR: [-0.5, 0, 0], armL: [-1.5, 0.05, -0.06], foreL: [-0.12, 0, 0], handL: [-0.5, 0, 0], spine: [0.1, 0, 0], chest: [0.08, 0, 0] }), 'io'],
      [1.2, 'S', 'io']];
    return { keys, impact: 0.7, color, hands: o.hands || 'both', freeL: o.freeL, fn: glowFn(0.05, 0.55, 0.72, 1.1), onEnd: f => setGlow(f, 0, null, 'both') };
  },
  breath(fig, o) {
    const color = o.color || '#ff8a3a';
    return { keys: [[0, 'S'], [0.4, { spine: [-0.25, 0, 0], chest: [-0.2, 0, 0], neck: [-0.2, 0, 0], head: [-0.3, 0, 0], jaw: [0.1, 0, 0] }, 'out'], [0.6, { spine: [0.3, 0, 0], chest: [0.15, 0, 0], neck: [0.1, 0, 0], head: [-0.1, 0, 0], jaw: [0.7, 0, 0] }, 'snap'], [1.2, { spine: [0.28, 0, 0], chest: [0.12, 0, 0], head: [-0.05, 0, 0], jaw: [0.6, 0, 0] }, 'lin'], [1.5, 'S', 'io']], impact: 0.6, color };
  },
  hit(fig, o) {
    const k = o.heavy ? 1.7 : 1, lg = fig.P.legs * fig.P.h, side = Math.random() < 0.5 ? 1 : -1;
    const p = { spine: [-0.22 * k, 0.1 * side, 0.05 * side], chest: [-0.12 * k, 0.08 * side, 0], neck: [-0.15 * k, 0, 0], head: [-0.28 * k, 0.15 * side, 0.1 * side], armL: [0.25 * k, 0, 0.25 * k], armR: [0.25 * k, 0, -0.25 * k], foreL: [-0.2, 0, 0], foreR: [-0.2, 0, 0], root: [0, 0, 0, 0, 0, -0.07 * k] };
    if (o.heavy) Object.assign(p, { root: [0, 0, 0, 0, 0, -0.24], hips: [0, 0, 0, 0, -0.06 * lg, 0], thighL: [-0.3, 0, 0], shinL: [0.5, 0, 0], thighR: [-0.1, 0, 0], shinR: [0.4, 0, 0] });
    return { mode: 'add', keys: [[0, {}], [0.07, p, 'out'], [o.heavy ? 0.65 : 0.4, {}, 'io']], impact: 0.04 };
  },
  dodge(fig, o) {
    const sd = o.side || (Math.random() < 0.5 ? 1 : -1), lg = fig.P.legs * fig.P.h;
    const p = { root: [0, 0, 0.12 * sd, 0.3 * sd, -0.04, -0.06], spine: [0.1, 0, -0.32 * sd], chest: [0, 0.1 * sd, -0.12 * sd], head: [0, 0, 0.22 * sd], armL: [0, 0, 0.3], armR: [0, 0, -0.3] };
    if (hasJ(fig, 'thighL')) Object.assign(p, { hips: [0, 0, 0, 0, -0.06 * lg, 0], thighL: [-0.4, 0, 0.25 * sd], shinL: [0.6, 0, 0], thighR: [-0.4, 0, 0.25 * sd], shinR: [0.6, 0, 0] });
    return { mode: 'add', keys: [[0, {}], [0.13, p, 'out'], [0.3, p, 'lin'], [0.55, {}, 'io']], impact: 0.12 };
  },
  block(fig, o) {
    let pose;
    if (fig.shield) pose = P_(fig.stanceShield, { root: [0, 0, 0, 0, 0, -0.05], spine: [0.12, 0.08, 0], chest: [0.06, 0.2, 0] });
    else if (fig.weapon && fig.hold !== 'bow') pose = { armR: [-1.65, 0.6, -0.2], foreR: [-1.2, 0, 0], handR: [0.2, 0, 1.0], spine: [0.05, 0.15, 0], chest: [0, 0.15, 0], root: [0, 0, 0, 0, 0, -0.06] };
    else pose = { armR: [-1.4, 0.6, -0.1], foreR: [-1.9, 0, 0], armL: [-1.4, -0.6, 0.1], foreL: [-1.9, 0, 0], spine: [0.15, 0, 0], head: [0.2, 0, 0], root: [0, 0, 0, 0, 0, -0.06] };
    return { keys: [[0, 'S'], [0.14, pose, 'snap'], [0.45, pose, 'lin'], [0.7, 'S', 'io']], impact: 0.14 };
  },
  die(fig, o) {
    const dead = humLie(fig, 'dead'), lg = fig.P.legs * fig.P.h;
    const knee = fig.lowerTail ? { hips: [0.6, 0, 0.2, 0, -0.1, 0], spine: [0.3, 0, 0], neck: [0.4, 0, 0], armL: [-0.4, 0, 0.5], armR: [-0.4, 0, -0.5] }
      : { root: [0.1, 0, 0.2, 0.1, 0, 0], hips: [0.1, 0, 0.15, 0, -0.3 * lg, 0], spine: [0.45, 0, 0.1], chest: [0.2, 0, 0], neck: [0.5, 0, 0.2], head: [0.3, 0, 0], thighL: [-1.2, 0, 0.1], shinL: [1.9, 0, 0], footL: [0.5, 0, 0], thighR: [-0.5, 0, -0.1], shinR: [1.6, 0, 0], footR: [0.6, 0, 0], armL: [-0.3, 0, 0.5], foreL: [-0.4, 0, 0], armR: [-0.3, 0, -0.5], foreR: [-0.4, 0, 0] };
    return { keys: [[0, 'S'], [0.14, { spine: [-0.35, 0.2, 0], chest: [-0.2, 0, 0], neck: [-0.3, 0, 0], head: [-0.4, 0.2, 0], armL: [0.3, 0, 0.7], armR: [0.3, 0, -0.7], foreL: [-0.3, 0, 0], foreR: [-0.3, 0, 0], root: [0, 0, 0, 0, 0, -0.1], jaw: [0.4, 0, 0] }, 'out'],
      [0.55, knee, 'io'], [1.0, dead, 'in2'], [1.12, P_(dead, { root: [dead.root[0], 0, dead.root[2], dead.root[3], dead.root[4] + 0.04, 0] }), 'out'], [1.3, dead, 'io']],
      impact: 0.1, fadeOut: 0, freeL: true, onEnd: f => f.setPose('dead', true) };
  },
  cheer(fig, o) {
    const up = { armR: [-2.9, 0, -0.25], foreR: [-0.25, 0, 0], handR: [0.3, 0, 0], chest: [-0.12, 0, 0], neck: [-0.2, 0, 0], head: [-0.2, 0, 0] };
    const pump = { armR: [-2.4, 0, -0.35], foreR: [-1.0, 0, 0], handR: [0.3, 0, 0], chest: [-0.05, 0, 0], neck: [-0.1, 0, 0] };
    return { keys: [[0, 'S'], [0.25, up, 'out'], [0.45, pump, 'io'], [0.65, up, 'out'], [0.85, pump, 'io'], [1.05, up, 'out'], [1.4, 'S', 'io']], impact: 0.25, freeL: true };
  },
  stand(fig, o) {
    const top = fig.lie.filter(L => L.target > 0).pop();
    const start = top && top.pose ? top.pose : humLie(fig, 'prone');
    const lg = fig.P.legs * fig.P.h;
    const kneel = fig.lowerTail ? { hips: [0.4, 0, 0, 0, -0.1, 0] } : { root: [0.15, 0, 0, 0, 0, 0], hips: [0, 0, 0, 0, -0.3 * lg, 0], spine: [0.35, 0, 0], thighL: [-1.4, 0, 0.05], shinL: [1.45, 0, 0], footL: [0, 0, 0], thighR: [0.15, 0, -0.05], shinR: [1.8, 0, 0], footR: [0.7, 0, 0], armR: [-0.6, 0, -0.2], armL: [-0.4, 0, 0.4], foreL: [-0.6, 0, 0] };
    return { keys: [[0, 'L'], [0.45, kneel, 'io'], [0.95, 'S', 'io']], impact: 0.5, fadeIn: 0, startPose: start, onStart: f => f.setPose('stand', true) };
  }
};
HUM_CLIPS.idleFlourish = (fig, o) => {
  if (fig.weapon && fig.hold === 'one') return { keys: [[0, 'S'], [0.4, { armR: [-1.2, 0.3, -0.3], foreR: [-1.3, 0, 0], handR: [0.2, 0, 1.4] }, 'io'], [0.8, { armR: [-1.0, -0.2, -0.3], foreR: [-1.1, 0, 0], handR: [0.2, 0, -1.2] }, 'io'], [1.3, 'S', 'io']], impact: 0.4 };
  return { keys: [[0, 'S'], [0.5, { neck: [0, 0.6, 0], chest: [0, 0.2, 0], spine: [-0.05, 0, 0] }, 'io'], [1.0, { neck: [0, -0.6, 0], chest: [0, -0.2, 0] }, 'io'], [1.5, 'S', 'io']], impact: 0.5 };
};

const HUM_MELEE = {
  slash(fig, o) {
    const two = fig.hold === 'two' || fig.hold === 'pole';
    const wind = { root: [0, 0, 0, 0, 0, -0.03], spine: [0.0, -0.3, 0], chest: [-0.05, -0.5, 0.05], neck: [0, 0.35, 0], armR: two ? [-1.6, 0.6, -0.9] : [-0.55, 0.45, -1.4], foreR: [-1.55, 0, 0], handR: [0.4, 0, 0.3], thighR: [0.2, -0.1, -0.08], shinR: [0.3, 0, 0], footR: [-0.1, 0, 0] };
    const hit = P_(lungePose(fig), { spine: [0.16, 0.25, 0], chest: [0.08, 0.5, -0.05], neck: [0, -0.4, 0], armR: [-1.45, -0.2, 0.15], foreR: [-0.15, 0, 0], handR: [0.55, 0, -0.2] });
    const thru = P_(lungePose(fig), { spine: [0.2, 0.35, 0], chest: [0.1, 0.75, 0], neck: [0, -0.6, 0], armR: [-1.0, -0.5, 0.65], foreR: [-0.3, 0, 0], handR: [0.4, 0, -0.4] });
    return { keys: [[0, 'S'], [0.22, wind, 'out'], [0.37, hit, 'in'], [0.5, thru, 'out'], [0.82, 'S', 'io']], impact: 0.36 };
  },
  overhead(fig, o) {
    const wind = { spine: [-0.22, -0.12, 0], chest: [-0.15, -0.1, 0], neck: [0.2, 0.1, 0], armR: [-2.75, 0.1, -0.22], foreR: [-1.55, 0, 0], handR: [-0.3, 0, 0], hips: [0, 0, 0, 0, 0.02, 0], thighR: [0.15, 0, 0], footR: [-0.1, 0, 0] };
    const hit = P_(lungePose(fig), { spine: [0.42, 0.05, 0], chest: [0.22, 0.05, 0], neck: [-0.3, 0, 0], head: [-0.15, 0, 0], armR: [-1.15, 0.0, -0.05], foreR: [-0.12, 0, 0], handR: [0.55, 0, 0] });
    const follow = P_(lungePose(fig), { spine: [0.48, 0.05, 0], chest: [0.25, 0.05, 0], neck: [-0.35, 0, 0], head: [-0.15, 0, 0], armR: [-0.85, 0.0, -0.05], foreR: [-0.12, 0, 0], handR: [0.6, 0, 0] });
    return { keys: [[0, 'S'], [0.28, wind, 'out'], [0.45, hit, 'in'], [0.58, follow, 'out'], [0.92, 'S', 'io']], impact: 0.45 };
  },
  thrust(fig, o) {
    const pole = fig.hold === 'pole';
    const wind = { root: [0, 0, 0, 0, 0, -0.05], spine: [0, -0.3, 0], chest: [0, -0.3, 0], neck: [0, 0.3, 0], armR: pole ? [-0.2, 0.2, -0.3] : [-0.35, 0, -0.35], foreR: [-1.95, 0, 0], handR: [pole ? 0.5 : 1.0, 0, 0], thighR: [0.15, 0, 0], shinR: [0.3, 0, 0] };
    const hit = P_(lungePose(fig, 1.3), { spine: [0.18, 0.3, 0], chest: [0.05, 0.28, 0], neck: [0, -0.45, 0], armR: [-1.5, -0.12, 0.0], foreR: [-0.05, 0, 0], handR: [pole ? 1.25 : 1.3, 0, 0] });
    return { keys: [[0, 'S'], [0.18, wind, 'out'], [0.3, hit, 'snap'], [0.42, hit, 'lin'], [0.68, 'S', 'io']], impact: 0.3 };
  },
  unarmed(fig, o) {
    const wind = { chest: [0, -0.45, 0], spine: [0, -0.15, 0], armR: [-0.5, 0, -0.3], foreR: [-2.2, 0, 0], root: [0, 0, 0, 0, 0, -0.03] };
    const hit = P_(lungePose(fig, 0.9), { chest: [0.1, 0.45, 0], spine: [0.05, 0.2, 0], neck: [0, -0.4, 0], armR: [-1.55, -0.15, 0.1], foreR: [-0.08, 0, 0], handR: [0, 0, 0], armL: [-0.7, 0, 0.25], foreL: [-2.1, 0, 0] });
    return { keys: [[0, 'S'], [0.14, wind, 'out'], [0.25, hit, 'snap'], [0.36, hit, 'lin'], [0.6, 'S', 'io']], impact: 0.25 };
  },
  kick(fig, o) {
    const lg = fig.P.legs * fig.P.h;
    const ch = { chest: [0, -0.3, 0], thighR: [-0.7, 0, 0], shinR: [1.7, 0, 0], hips: [0, -0.2, 0, 0, 0.02 * lg, 0] };
    const hit = { root: [0, 0, 0, 0, 0, 0.12], spine: [-0.28, 0, 0], chest: [-0.1, 0.1, 0], neck: [0.25, 0, 0], thighR: [-1.5, 0, -0.1], shinR: [0.05, 0, 0], footR: [0.5, 0, 0], armR: [-0.4, 0, -0.6], foreR: [-1.5, 0, 0], armL: [-0.6, 0, 0.6], foreL: [-1.6, 0, 0], thighL: [0.05, 0, 0], shinL: [0.15, 0, 0] };
    return { keys: [[0, 'S'], [0.17, ch, 'out'], [0.32, hit, 'snap'], [0.45, hit, 'lin'], [0.72, 'S', 'io']], impact: 0.32 };
  },
  claw(fig, o) {
    const wind = { armR: [-2.1, 0, -0.65], foreR: [-1.1, 0, 0], armL: [-2.1, 0, 0.65], foreL: [-1.1, 0, 0], spine: [-0.18, 0, 0], chest: [-0.1, 0, 0], head: [-0.25, 0, 0], jaw: [0.4, 0, 0] };
    const hit = P_(lungePose(fig), { armR: [-0.85, 0, 0.4], foreR: [-0.3, 0, 0], armL: [-0.85, 0, -0.4], foreL: [-0.3, 0, 0], spine: [0.38, 0, 0], chest: [0.16, 0, 0], head: [-0.1, 0, 0], jaw: [0.1, 0, 0] });
    return { keys: [[0, 'S'], [0.2, wind, 'out'], [0.33, hit, 'in'], [0.46, hit, 'lin'], [0.75, 'S', 'io']], impact: 0.33 };
  },
  slam(fig, o) {
    const wind = { armR: [-2.9, -0.2, -0.1], foreR: [-0.9, 0, 0], armL: [-2.9, 0.2, 0.1], foreL: [-0.9, 0, 0], spine: [-0.25, 0, 0], chest: [-0.12, 0, 0], head: [-0.2, 0, 0] };
    const hit = P_(lungePose(fig), { armR: [-1.0, 0, 0.1], foreR: [-0.2, 0, 0], armL: [-1.0, 0, -0.1], foreL: [-0.2, 0, 0], spine: [0.55, 0, 0], chest: [0.25, 0, 0], head: [-0.2, 0, 0] });
    return { keys: [[0, 'S'], [0.3, wind, 'out'], [0.46, hit, 'in'], [0.6, hit, 'lin'], [0.95, 'S', 'io']], impact: 0.46 };
  },
  bite(fig, o) {
    const wind = { spine: [-0.15, 0, 0], neck: [-0.3, 0, 0], head: [-0.4, 0, 0], jaw: [0.6, 0, 0], root: [0, 0, 0, 0, 0, -0.05] };
    const hit = P_(lungePose(fig), { spine: [0.45, 0, 0], chest: [0.18, 0, 0], neck: [0.35, 0, 0], head: [-0.25, 0, 0], jaw: [0.0, 0, 0], armR: [-0.9, 0, -0.25], armL: [-0.9, 0, 0.25] });
    return { keys: [[0, 'S'], [0.16, wind, 'out'], [0.28, hit, 'snap'], [0.4, P_(hit, { jaw: [0.15, 0, 0] }), 'lin'], [0.65, 'S', 'io']], impact: 0.28 };
  },
  tail(fig, o) {
    const wind = { hips: [0, 0.6, 0], spine: [0, 0.3, 0], chest: [0, 0.2, 0], neck: [0, -0.5, 0] };
    const hit = { hips: [0, -1.2, 0], spine: [0.1, -0.4, 0], chest: [0, -0.3, 0], neck: [0, 0.9, 0], tl0: [0, -0.4, 0], tl1: [0, -0.4, 0] };
    return { keys: [[0, 'S'], [0.2, wind, 'out'], [0.38, hit, 'in'], [0.5, hit, 'lin'], [0.85, 'S', 'io']], impact: 0.38 };
  }
};
HUM_MELEE.sting = HUM_MELEE.tail; HUM_MELEE.gore = HUM_MELEE.bite; HUM_MELEE.headbutt = HUM_MELEE.bite;

const HUM_RANGED = {
  bow(fig, o) {
    const body = { chest: [0, -0.65, 0], spine: [0, -0.25, 0], neck: [0, 0.65, 0], head: [0, 0.22, 0], thighL: [-0.25, 0.25, 0.12], thighR: [0.15, 0.2, -0.1] };
    return { keys: [[0, 'S'], [0.25, P_(body), 'out'], [0.95, P_(body), 'lin'], [1.2, 'S', 'io']], impact: 0.82,
      fn: (f, t) => { f.aimW = t < 0.95 ? EASE.out(clamp(t / 0.25, 0, 1)) : 1 - EASE.io(clamp((t - 0.95) / 0.25, 0, 1)); f.draw = t < 0.82 ? EASE.io(clamp((t - 0.3) / 0.42, 0, 1)) : Math.max(0, 1 - (t - 0.82) * 12); f.nock = t > 0.22 && t < 0.82; },
      onEnd: f => { f.aimW = 0; f.draw = 0; f.nock = false; } };
  },
  crossbow(fig, o) {
    return { keys: [[0, 'S'], [0.25, { chest: [0, -0.15, 0], neck: [0.05, 0.15, 0], head: [0.1, 0, 0] }, 'out'], [0.55, { chest: [-0.08, -0.15, 0], neck: [0.05, 0.15, 0], head: [0.1, 0, 0], root: [0, 0, 0, 0, 0, -0.04] }, 'snap'], [0.75, { chest: [0, -0.15, 0], neck: [0.05, 0.15, 0] }, 'io'], [1.0, 'S', 'io']], impact: 0.52,
      fn: (f, t) => { f.aimW = t < 0.78 ? EASE.out(clamp(t / 0.25, 0, 1)) : 1 - EASE.io(clamp((t - 0.78) / 0.22, 0, 1)); f.recoil = t > 0.52 && t < 0.75 ? 0.25 * Math.sin((t - 0.52) / 0.23 * PI) : 0; },
      onEnd: f => { f.aimW = 0; f.recoil = 0; } };
  },
  throw(fig, o) {
    const wind = { chest: [-0.05, -0.65, 0], spine: [-0.15, -0.2, 0], neck: [0, 0.6, 0], armR: [-2.5, 0.2, -0.5], foreR: [-1.6, 0, 0], handR: [0.5, 0, 0], armL: [-1.2, 0, 0.3], foreL: [-0.3, 0, 0], thighR: [0.25, 0, 0], shinR: [0.25, 0, 0] };
    const rel = P_(lungePose(fig, 0.9), { chest: [0.15, 0.5, 0], spine: [0.25, 0.2, 0], neck: [0, -0.5, 0], armR: [-1.6, -0.1, -0.1], foreR: [-0.15, 0, 0], handR: [0.8, 0, 0], armL: [-0.3, 0, 0.4], foreL: [-0.6, 0, 0] });
    const fol = P_(lungePose(fig, 0.9), { chest: [0.2, 0.6, 0], spine: [0.3, 0.25, 0], armR: [-0.7, -0.3, 0.4], foreR: [-0.3, 0, 0] });
    return { keys: [[0, 'S'], [0.32, wind, 'out'], [0.45, rel, 'in'], [0.58, fol, 'out'], [0.92, 'S', 'io']], impact: 0.45, freeL: true };
  },
  spit(fig, o) { return HUM_MELEE.bite(fig, o); },
  ray(fig, o) {
    const p = { armR: [-1.55, -0.05, 0.05], foreR: [-0.05, 0, 0], handR: [-0.6, 0, 0], chest: [0, 0.2, 0], neck: [0, -0.2, 0] };
    return { keys: [[0, 'S'], [0.25, { armR: [-1.2, 0.3, -0.4], foreR: [-1.4, 0, 0] }, 'out'], [0.42, p, 'snap'], [0.7, p, 'lin'], [0.95, 'S', 'io']], impact: 0.42, color: o.color || '#ffd0ff', hands: 'R', fn: glowFn(0.1, 0.4, 0.45, 0.85), onEnd: f => setGlow(f, 0, null, 'both') };
  }
};
HUM_RANGED.spike = HUM_RANGED.throw;

FAM.hum = { base: humBase, lie: humLie, clips: HUM_CLIPS };
PLANS.humanoid = { fam: 'hum', build: buildHumanoid };
/* ============================================================ BEAST family (quadrupeds, dragons, drakes, bipeds, birds, bats, hydra) */
// lengths in model units for a Medium creature; legs: leg type; neck {n,len,ang,r}; tail {n,len,r,rx}
const BEASTV = {
  canine: { len: 0.5, hh: 0.42, sh: 0.45, g: 0.13, wid: 0.9, legR: 0.034, leg: 'digi', foot: 'paw', neck: { n: 2, len: 0.18, ang: 0.75, r: 0.075 }, head: 'canine', hs: 1, tail: { n: 4, len: 0.34, r: 0.035, rx: -0.5, bushy: 1 }, cover: 'fur' },
  feline: { len: 0.56, hh: 0.4, sh: 0.42, g: 0.13, wid: 0.88, legR: 0.038, leg: 'digi', foot: 'paw', neck: { n: 2, len: 0.14, ang: 0.45, r: 0.08 }, head: 'feline', hs: 1, tail: { n: 6, len: 0.52, r: 0.03, rx: -0.7, curl: 0.25 }, cover: 'fur' },
  bear: { len: 0.58, hh: 0.48, sh: 0.52, g: 0.21, wid: 0.95, legR: 0.065, leg: 'planti', foot: 'paw', neck: { n: 1, len: 0.14, ang: 0.15, r: 0.12 }, head: 'bear', hs: 1.25, tail: { n: 1, len: 0.06, r: 0.04, rx: -0.5 }, cover: 'fur' },
  owlbear: { len: 0.58, hh: 0.48, sh: 0.55, g: 0.22, wid: 0.95, legR: 0.07, leg: 'planti', foot: 'paw', neck: { n: 1, len: 0.12, ang: 0.3, r: 0.13 }, head: 'owl', hs: 1.35, tail: { n: 2, len: 0.12, r: 0.05, rx: -0.4, feather: 1 }, cover: 'fur' },
  boar: { len: 0.46, hh: 0.3, sh: 0.38, g: 0.16, wid: 0.85, legR: 0.032, leg: 'digi', foot: 'hoof', neck: { n: 1, len: 0.1, ang: -0.05, r: 0.12 }, head: 'boar', hs: 1.1, tail: { n: 2, len: 0.1, r: 0.012, rx: 0.4 }, cover: 'fur', ridge: 1 },
  horse: { len: 0.66, hh: 0.64, sh: 0.66, g: 0.2, wid: 0.82, legR: 0.04, leg: 'digi', foot: 'hoof', neck: { n: 3, len: 0.36, ang: 0.75, r: 0.085 }, head: 'horse', hs: 1, tail: { n: 4, len: 0.5, r: 0.045, rx: -1.0, hair: 1 }, cover: 'skin', mane: 1 },
  rhino: { len: 0.62, hh: 0.45, sh: 0.5, g: 0.25, wid: 0.95, legR: 0.07, leg: 'planti', foot: 'hoof', neck: { n: 1, len: 0.1, ang: 0.0, r: 0.15 }, head: 'rhino', hs: 1.3, tail: { n: 2, len: 0.14, r: 0.02, rx: -1.0 }, cover: 'hide' },
  elephant: { len: 0.6, hh: 0.62, sh: 0.68, g: 0.29, wid: 0.95, legR: 0.095, leg: 'column', foot: 'pad', neck: { n: 1, len: 0.06, ang: 0.1, r: 0.18 }, head: 'elephant', hs: 1.6, tail: { n: 2, len: 0.25, r: 0.02, rx: -1.2 }, cover: 'hide' },
  rat: { len: 0.32, hh: 0.15, sh: 0.15, g: 0.1, wid: 0.95, legR: 0.022, leg: 'digi', foot: 'paw', neck: { n: 1, len: 0.06, ang: 0.2, r: 0.07 }, head: 'rat', hs: 0.85, tail: { n: 6, len: 0.5, r: 0.018, rx: 0.05, bare: 1 }, cover: 'fur' },
  lizard: { len: 0.5, hh: 0.17, sh: 0.17, g: 0.11, wid: 1.15, legR: 0.035, leg: 'sprawl', foot: 'claw', neck: { n: 1, len: 0.12, ang: 0.2, r: 0.08 }, head: 'lizard', hs: 1, tail: { n: 6, len: 0.65, r: 0.08, rx: 0.06 }, cover: 'scales' },
  croc: { len: 0.7, hh: 0.17, sh: 0.17, g: 0.13, wid: 1.25, legR: 0.04, leg: 'sprawl', foot: 'claw', neck: { n: 1, len: 0.1, ang: 0.05, r: 0.1 }, head: 'croc', hs: 1.2, tail: { n: 7, len: 0.85, r: 0.1, rx: 0.03, scutes: 1 }, cover: 'scales', scutes: 1 },
  turtle: { len: 0.6, hh: 0.3, sh: 0.3, g: 0.2, wid: 1.2, legR: 0.07, leg: 'sprawl', foot: 'flipper', neck: { n: 2, len: 0.25, ang: 0.5, r: 0.07 }, head: 'dragon', hs: 0.9, tail: { n: 4, len: 0.4, r: 0.06, rx: 0.05 }, cover: 'scales', shell: 1 },
  tri: { len: 0.8, hh: 0.5, sh: 0.45, g: 0.27, wid: 1.0, legR: 0.08, leg: 'column', foot: 'pad', neck: { n: 1, len: 0.12, ang: 0.0, r: 0.16 }, head: 'tri', hs: 1.5, tail: { n: 5, len: 0.6, r: 0.13, rx: 0.15 }, cover: 'scales' },
  steg: { len: 0.82, hh: 0.58, sh: 0.4, g: 0.24, wid: 0.9, legR: 0.075, leg: 'column', foot: 'pad', neck: { n: 2, len: 0.25, ang: -0.2, r: 0.09 }, head: 'lizard', hs: 0.8, tail: { n: 6, len: 0.8, r: 0.12, rx: 0.12, spikes: 1 }, cover: 'scales', plates: 1 },
  ank: { len: 0.82, hh: 0.36, sh: 0.34, g: 0.27, wid: 1.25, legR: 0.075, leg: 'column', foot: 'pad', neck: { n: 1, len: 0.12, ang: 0.0, r: 0.13 }, head: 'ank', hs: 1.0, tail: { n: 5, len: 0.7, r: 0.1, rx: 0.08, club: 1 }, cover: 'scales', armor: 1 },
  sauropod: { len: 0.72, hh: 0.62, sh: 0.66, g: 0.28, wid: 0.95, legR: 0.09, leg: 'column', foot: 'pad', neck: { n: 6, len: 1.3, ang: 0.95, r: 0.12, taper: 0.45 }, head: 'small', hs: 0.9, tail: { n: 8, len: 1.4, r: 0.15, rx: 0.12 }, cover: 'scales' },
  hadro: { len: 0.72, hh: 0.68, sh: 0.45, g: 0.24, wid: 0.9, legR: 0.07, leg: 'digi', foot: 'pad', neck: { n: 2, len: 0.3, ang: 0.6, r: 0.1 }, head: 'duck', hs: 1.2, tail: { n: 6, len: 0.8, r: 0.12, rx: 0.15 }, cover: 'scales' },
  goat: { len: 0.45, hh: 0.4, sh: 0.42, g: 0.12, wid: 0.85, legR: 0.026, leg: 'digi', foot: 'hoof', neck: { n: 2, len: 0.16, ang: 0.8, r: 0.06 }, head: 'goat', hs: 0.9, tail: { n: 1, len: 0.06, r: 0.02, rx: 0.6 }, cover: 'fur' },
  dragon: { len: 0.62, hh: 0.44, sh: 0.48, g: 0.18, wid: 0.95, legR: 0.055, leg: 'digi', foot: 'claw', neck: { n: 5, len: 0.6, ang: 0.95, r: 0.09, taper: 0.65 }, head: 'dragon', hs: 1.2, tail: { n: 8, len: 1.1, r: 0.11, rx: 0.08 }, cover: 'scales', spikes: 1 },
  drake: { len: 0.5, hh: 0.5, sh: 0.62, g: 0.16, wid: 0.9, legR: 0.06, leg: 'digi', foot: 'claw', noFront: 1, neck: { n: 3, len: 0.36, ang: 0.6, r: 0.08, taper: 0.7 }, head: 'dragon', hs: 1.05, tail: { n: 7, len: 0.9, r: 0.09, rx: 0.12 }, cover: 'scales', spikes: 1 },
  linnorm: { len: 0.9, hh: 0.24, sh: 0.3, g: 0.2, wid: 1.0, legR: 0.05, leg: 'sprawl', foot: 'claw', noHind: 1, neck: { n: 5, len: 0.7, ang: 0.85, r: 0.12, taper: 0.7 }, head: 'dragon', hs: 1.25, tail: { n: 9, len: 1.6, r: 0.16, rx: 0.0, wave: 1 }, cover: 'scales', spikes: 1 },
  trex: { len: 0.55, hh: 0.62, sh: 0.7, g: 0.24, wid: 0.9, legR: 0.08, leg: 'digi', foot: 'claw', noFront: 1, arms: 1, neck: { n: 2, len: 0.25, ang: 0.35, r: 0.14 }, head: 'trex', hs: 1.6, tail: { n: 7, len: 1.0, r: 0.16, rx: 0.12 }, cover: 'scales' },
  raptor: { len: 0.42, hh: 0.45, sh: 0.5, g: 0.12, wid: 0.85, legR: 0.04, leg: 'digi', foot: 'claw', noFront: 1, arms: 1, neck: { n: 2, len: 0.22, ang: 0.8, r: 0.06 }, head: 'raptor', hs: 0.95, tail: { n: 6, len: 0.7, r: 0.07, rx: 0.15 }, cover: 'scales', feathers: 1 },
  pachy: { len: 0.5, hh: 0.55, sh: 0.6, g: 0.18, wid: 0.9, legR: 0.06, leg: 'digi', foot: 'claw', noFront: 1, arms: 1, neck: { n: 2, len: 0.22, ang: 0.6, r: 0.09 }, head: 'dome', hs: 1.2, tail: { n: 6, len: 0.75, r: 0.11, rx: 0.12 }, cover: 'scales' },
  bird: { len: 0.32, hh: 0.36, sh: 0.48, g: 0.14, wid: 0.95, legR: 0.025, leg: 'bird', foot: 'talon', noFront: 1, neck: { n: 2, len: 0.14, ang: 1.0, r: 0.07 }, head: 'bird', hs: 0.9, tail: { n: 1, len: 0.25, r: 0.02, rx: 0.35, fan: 1 }, cover: 'feather' },
  griffon: { len: 0.56, hh: 0.4, sh: 0.5, g: 0.15, wid: 0.9, legR: 0.04, leg: 'digi', foot: 'paw', frontFoot: 'talon', neck: { n: 2, len: 0.2, ang: 0.85, r: 0.09 }, head: 'eagle', hs: 1.1, tail: { n: 6, len: 0.5, r: 0.03, rx: -0.6, tuft: 1 }, cover: 'fur', frontCover: 'feather' },
  bat: { len: 0.22, hh: 0.16, sh: 0.2, g: 0.09, wid: 0.95, legR: 0.018, leg: 'digi', foot: 'claw', noFront: 1, neck: { n: 1, len: 0.05, ang: 0.6, r: 0.06 }, head: 'bat', hs: 0.9, tail: { n: 1, len: 0.04, r: 0.02, rx: 0 }, cover: 'fur' },
  pterosaur: { len: 0.3, hh: 0.3, sh: 0.42, g: 0.1, wid: 0.9, legR: 0.025, leg: 'bird', foot: 'claw', noFront: 1, neck: { n: 2, len: 0.3, ang: 1.0, r: 0.05 }, head: 'ptero', hs: 1.2, tail: { n: 1, len: 0.06, r: 0.02, rx: 0 }, cover: 'skin' },
  hippocampus: { len: 0.55, hh: 0.5, sh: 0.62, g: 0.16, wid: 0.85, legR: 0.033, leg: 'digi', foot: 'fin', noHind: 1, neck: { n: 3, len: 0.36, ang: 0.95, r: 0.075 }, head: 'horse', hs: 1, tail: { n: 6, len: 0.9, r: 0.14, rx: -0.15, fish: 1 }, cover: 'scales', mane: 1 }
};

function beastV(fig) { const d = fig.desc; const v = BEASTV[d.beastVariant || d.variant] || BEASTV[d.plan] || BEASTV.canine; return Object.assign({}, v, d.beast || {}); }
function coverMat(type, c) { return type === 'fur' ? MT.fur(c) : type === 'scales' ? MT.scales(c) : type === 'feather' ? MT.feather(c) : type === 'hide' ? mat(c, { r: 0.85, bump: 'stone', bs: 0.01 }) : type === 'stone' ? MT.stone(c) : type === 'bone' ? MT.bone(c) : type === 'emis' ? MT.emis(c, 1.4) : type === 'ghost' ? MT.ghost(c, 0.55) : type === 'metal' ? mat(c, { r: 0.4, m: 0.8 }) : MT.skin(c); }

function buildBeast(fig) {
  const d = fig.desc, f = d.f || (d.f = {}), pal = d.palette || (d.palette = {}), V = beastV(fig);
  const cov = f.cover || V.cover;
  const bodyC = pal.body = pal.body || '#7a6a5a';
  const BM = coverMat(cov, bodyC), belly = coverMat(cov === 'feather' ? 'feather' : cov === 'fur' ? 'fur' : 'skin', pal.belly || shade(bodyC, 1.25));
  const legM = V.frontCover ? coverMat(V.frontCover, pal.head || shade(bodyC, 1.3)) : BM;
  fig.M = { body: BM, belly, leg: BM, horn: MT.horn(pal.horn || '#2e2620'), claw: MT.horn(pal.claw || '#24201c') };
  fig.V = V;
  const J = (n, p, x, y, z) => fig.bone(n, p, x, y, z);
  const body = J('body', fig.root, 0, V.hh, -V.len * 0.45);
  const chest = J('chest', body, 0, V.sh - V.hh, V.len);
  const g = V.g, W = V.wid;
  fig.P = { g, len: V.len, hh: V.hh, sh: V.sh };
  // torso
  if (!f.noTorso) {
    ell(body, BM, [0, 0.0, -0.02], [g * 0.92 * W, g * 0.95, g * 1.15]);
    ell(chest, BM, [0, 0.0, 0.0], [g * W * 1.02, g * 1.08, g * 1.15]);
    const mid = ell(body, BM, [0, (V.sh - V.hh) * 0.5, V.len * 0.5], [g * 0.95 * W, g * 0.98, V.len * 0.55]);
    mid.rotation.x = -Math.atan2(V.sh - V.hh, V.len);
    if (cov !== 'feather') ell(body, belly, [0, -g * 0.35 + (V.sh - V.hh) * 0.5, V.len * 0.5], [g * 0.75 * W, g * 0.65, V.len * 0.5]).rotation.x = mid.rotation.x;
  }
  if (V.shell || f.shell) {
    add(body, U.lathe('shell', [[0.001, 1.0], [0.45, 0.95], [0.8, 0.7], [1.0, 0.25], [1.02, 0.0], [0.9, -0.05], [0.001, -0.05]], 16), MT.scales(pal.shell || '#4a5a3a'), [0, g * 0.15, V.len * 0.5], null, [g * 1.6 * W, g * 1.15, V.len * 0.95]);
    for (let i = 0; i < 6; i++) spike(body, fig.M.horn, [0, g * 1.25, V.len * 0.1 + i * V.len * 0.16], [0, g * 1.5, V.len * 0.05 + i * V.len * 0.16], 0.04);
  }
  if (V.plates || f.plates) for (let i = 0; i < 7; i++) { const t = i / 6; add(body, U.shape('plate', [[0, 0], [0.09, 0.06], [0.0, 0.2], [-0.09, 0.06]], 0.02, 0.005), mat(pal.accent || '#a04a2a', { r: 0.7 }), [0, g * 0.9 + Math.sin(t * PI) * 0.05, -0.05 + t * V.len * 1.05], [0, HP, 0], 0.9 + Math.sin(t * PI) * 0.6); }
  if (V.armor || f.armor) for (let i = 0; i < 14; i++) { const a = (i % 7) / 6 * PI - HP, z = (i < 7 ? 0.15 : 0.55) * V.len; spike(body, fig.M.horn, [Math.sin(a) * g * 1.0, Math.cos(a) * g * 0.9, z], [Math.sin(a) * g * 1.2, Math.cos(a) * g * 1.12, z], 0.03); }
  if (V.ridge || f.ridge) for (let i = 0; i < 6; i++) spike(body, MT.fur(pal.mane || shade(bodyC, 0.6)), [0, g * 0.85, i * V.len * 0.2], [0, g * 1.2, i * V.len * 0.2 - 0.03], 0.025);
  if ((V.spikes || f.spikes) && !f.noSpikes) for (let i = 0; i < 6; i++) spike(body, fig.M.horn, [0, g * 0.85 + (V.sh - V.hh) * i / 5 * 0.9, -0.05 + i * V.len * 0.21], [0, g * 1.15 + (V.sh - V.hh) * i / 5 * 0.9, -0.1 + i * V.len * 0.21], 0.03);
  if (V.feathers || f.feathers) for (let i = 0; i < 5; i++) spike(body, MT.feather(pal.accent || shade(bodyC, 1.2)), [0, g * 0.8, i * V.len * 0.25], [0, g * 1.2, i * V.len * 0.25 - 0.08], 0.04);
  // legs
  fig.legs = [];
  const hipX = g * 0.6 * W, shX = g * 0.7 * W;
  if (!V.noHind) ['L', 'R'].forEach(s => beastLeg(fig, body, s, false, (s === 'L' ? 1 : -1) * hipX, V));
  if (!V.noFront) ['L', 'R'].forEach(s => beastLeg(fig, chest, s, true, (s === 'L' ? 1 : -1) * shX, V));
  if (V.arms) ['L', 'R'].forEach(s => { const sg = s === 'L' ? 1 : -1; const a = J('arm' + s, chest, sg * g * 0.6, -g * 0.3, g * 0.6); a.rotation.set(-0.8, 0, sg * 0.3); add(a, U.limb(0.03, 0.022, 0.13, 0.1), BM); const b = J('fore' + s, a, 0, -0.13, 0); b.rotation.x = -1.2; add(b, U.limb(0.022, 0.015, 0.11, 0), BM); for (let i = 0; i < 2; i++) spike(b, fig.M.claw, [(i - 0.5) * 0.015, -0.11, 0], [(i - 0.5) * 0.015, -0.15, 0.02], 0.006); });
  // ground fit: shift body so paws touch y=0
  fig.group.updateMatrixWorld(true);
  const sole = l => l.sole.getWorldPosition(new THREE.Vector3()).y / fig.S;
  const hind = fig.legs.filter(l => !l.front), front = fig.legs.filter(l => l.front);
  const hy = hind.length ? sole(hind[0]) : null, fy = front.length ? sole(front[0]) : null;
  if (hy != null) body.position.y -= hy;
  if (fy != null) { if (hy != null) chest.position.y -= (fy - hy); else body.position.y -= fy; }
  if (hy != null && fy == null && V.noFront) { /* biped: tilt so the body balances over the hips */ }
  if (V.noHind && fy != null) { /* linnorm: belly drags */ body.position.y = Math.max(body.position.y, g * 0.6); }
  // neck + heads
  const nHeads = f.heads || 1;
  fig.heads = [];
  for (let k = 0; k < (f._noHead ? 0 : nHeads); k++) {
    const spread = nHeads > 1 ? (k - (nHeads - 1) / 2) / Math.max(1, (nHeads - 1) / 2) : 0;
    const nk = Object.assign({}, V.neck, f.neck || {});
    if (nHeads > 1 && !f.neck) { nk.n = Math.max(nk.n, 4); nk.len = Math.max(nk.len, V.len * 0.9); nk.ang = 0.9; nk.taper = 0.6; }
    const pre = nHeads > 1 ? 'n' + k + '_' : 'neck';
    let p = chest; const segL = nk.len / nk.n;
    const names = [];
    for (let i = 0; i < nk.n; i++) {
      const b = J(pre + i, p, i === 0 ? spread * g * 0.6 : 0, i === 0 ? g * 0.35 : 0, i === 0 ? g * 0.75 : segL);
      if (i === 0) { b.rotation.x = -nk.ang; b.rotation.y = spread * 0.55; } else b.rotation.x = nk.n > 2 ? (i < nk.n / 2 ? -0.05 : 0.18) : 0.1;
      const r1 = nk.r * (1 - (1 - (nk.taper || 0.85)) * i / nk.n), r2 = nk.r * (1 - (1 - (nk.taper || 0.85)) * (i + 1) / nk.n);
      add(b, U.limb(r1, r2, segL * 1.05, 0.05), BM, null, [-HP, 0, 0]);
      if (V.mane || f.mane === 'horse') add(b, U.box(), MT.fur(pal.mane || shade(bodyC, 0.45)), [0, r1 * 0.95, segL * 0.5], [0.0, 0, 0], [0.02, 0.06, segL * 1.1]);
      names.push(b.name); p = b;
    }
    const head = J(nHeads > 1 ? 'head' + k : 'head', p, 0, 0, segL);
    head.rotation.x = nk.ang * 0.85 + (V.headDown || 0);
    buildBeastHead(fig, head, f.headTypes ? f.headTypes[k] : (V.head), V, k);
    fig.heads.push({ neck: names, head: head.name, jaw: head.userData.jaw });
  }
  // tail
  const T = Object.assign({}, V.tail, f.tail || {});
  if (!f.noTail && T.n) {
    let p = body; const segL = T.len / T.n; fig.tail = [];
    const tm = T.bare ? MT.skin(pal.tailC || '#c89a8a') : T.hair ? MT.fur(pal.mane || shade(bodyC, 0.45)) : BM;
    for (let i = 0; i < T.n; i++) {
      const b = J('tail' + i, p, 0, i === 0 ? g * 0.3 : 0, i === 0 ? -g * 0.9 : -segL);
      b.rotation.x = i === 0 ? T.rx : (T.curl || 0) + (T.rx < -0.3 ? 0.12 : -0.02);
      const r1 = T.r * (1 - i / (T.n + 0.5)), r2 = T.r * (1 - (i + 1) / (T.n + 0.5));
      add(b, U.limb(Math.max(r1, 0.006), Math.max(r2, 0.004), segL * 1.08, 0.05), tm, null, [HP, 0, 0]);
      if (T.spikes && i === T.n - 1) [1, -1].forEach(s => { spike(b, fig.M.horn, [0, 0.02, -segL * 0.5], [s * 0.18, 0.12, -segL * 0.6], 0.025); spike(b, fig.M.horn, [0, 0.02, -segL * 0.8], [s * 0.16, 0.08, -segL * 1.0], 0.022); });
      if (T.club && i === T.n - 1) ell(b, MT.stone(pal.horn || '#6a5a4a'), [0, 0, -segL], [r1 * 2.6, r1 * 1.5, r1 * 2.0]);
      if (T.scutes) spike(b, BM, [0, r1 * 0.9, -segL * 0.5], [0, r1 * 1.4, -segL * 0.6], r1 * 0.3);
      if ((V.spikes || f.spikes) && !f.noSpikes && i < T.n - 1) spike(b, fig.M.horn, [0, r1 * 0.9, -segL * 0.4], [0, r1 * 1.6, -segL * 0.6], r1 * 0.35);
      fig.tail.push(b); p = b;
    }
    const last = fig.tail[fig.tail.length - 1];
    if (T.bushy) ell(last, MT.fur(pal.body), [0, 0, -segL * 0.4], [T.r * 1.6, T.r * 1.6, segL * 1.2]);
    if (T.hair) add(last, U.cone(8), MT.fur(pal.mane || shade(bodyC, 0.45)), [0, -0.05, -segL * 0.8], [HP + 0.6, 0, 0], [0.06, 0.4, 0.04]);
    if (T.tuft) ell(last, MT.fur(pal.mane || shade(bodyC, 0.5)), [0, 0, -segL], [0.04, 0.04, 0.07]);
    if (T.fan) add(last, U.shape('tailfan', [[0, 0], [0.12, -0.25], [0.04, -0.28], [0, -0.3], [-0.04, -0.28], [-0.12, -0.25]], 0.01, 0.003), MT.featherDS(pal.wing || shade(bodyC, 0.8)), [0, 0, 0], [HP, 0, 0]);
    if (T.fish) add(last, U.shape('tailfin', [[0, 0], [0.16, -0.18], [0.06, -0.08], [0, -0.1], [-0.06, -0.08], [-0.16, -0.18]], 0.012, 0.004), MT.membrane(pal.fin || shade(bodyC, 1.3)), [0, 0, -segL * 0.8], [HP, 0, 0], [1.4, 1.6, 1]);
    if (f.stinger) { spike(last, MT.horn(pal.stinger || '#2a1a1a'), [0, 0, -segL], [0, 0.08, -segL - 0.14], T.r * 1.4); }
    if (f.quills) for (let i = 0; i < 6; i++) spike(last, MT.horn('#d8d0c0'), [0, 0, -segL * 0.6], [Math.sin(i) * 0.1, 0.08 + Math.cos(i * 2) * 0.05, -segL - 0.12], 0.01);
    if (f.tailFlame) keep(add(last, U.cone(8), MT.emis('#ff7a2a', 2.2), [0, 0, -segL - 0.05], [-HP, 0, 0], [0.05, 0.15, 0.05]));
  }
  // wings
  if (f.wings) {
    const t = f.wings; const span = f.wingSpan || (d.plan === 'dragon' ? V.len * 2.2 : d.variant === 'bat' ? 0.75 : d.variant === 'bird' ? 0.65 : d.variant === 'pterosaur' ? 1.2 : V.len * 1.7);
    const wm = t === 'feather' ? MT.featherDS(pal.wing || shade(bodyC, 0.95)) : t === 'insect' ? mat(pal.wing || '#cfefff', { r: 0.1, op: 0.42, ds: true }) : t === 'bone' ? MT.bone() : t === 'flame' ? mat('#ff8a2a', { e: '#ff6a1a', ei: 1.6, ds: true, op: 0.85 }) : MT.membrane(pal.wing || shade(bodyC, 0.75));
    addWings(fig, chest, { type: t === 'flame' ? 'feather' : t, span, chord: span * 0.55, x: g * 0.3, y: g * 0.75, z: -g * 0.1, m: wm, boneM: BM });
  }
  if (f.mane && f.mane !== 'horse') { const mm = MT.fur(pal.mane || '#6a4a24'); const hb = fig.J.head; if (hb) { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; add(hb, U.cone(6), mm, [Math.sin(a) * 0.09, Math.cos(a) * 0.09 + 0.02, -0.05], [-HP + Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9], [0.06, 0.2, 0.04]); } ell(fig.J.neck0 || chest, mm, [0, 0.02, 0.05], [g * 1.05, g * 1.1, g * 0.9]); } }
  if (f.ruff) ell(chest, MT.feather(pal.head || shade(bodyC, 1.4)), [0, g * 0.3, g * 0.6], [g * 1.05, g * 0.95, g * 0.7]);
  if (f.flame) addFlameAura(fig, [body, chest], g);
  if (fig._centaur) { fig.hoverH = 0.5; return; }
  // anchors
  fig.anchors = fig.anchors || {};
  fig.anchors.chest = chest; fig.anchors.head = fig.J.head || fig.J.head0;
  const glowM = fig.perMat(mat('#8fd0ff', { basic: true, add: true, op: 0.9 })); fig.glowMat = glowM;
  const mouth = fig.anchors.mouth || fig.J.head || chest;
  const go = keep(add(mouth, U.sphere(10, 8), glowM, [0, 0, 0], null, 0.001)); go.castShadow = false; go.visible = false; fig.glow.push(go);
  fig.stance = {};
  if (d.plan === 'drake' || V.noFront) fig.stance.body = [-(V.bodyTilt != null ? V.bodyTilt : 0.0), 0, 0];
  fig.hoverH = f.hoverH || (V.hh + g) * 0.55;
}
function addFlameAura(fig, bones, g) {
  const fm = fig.perMat(mat('#ff8a2a', { e: '#ff5a10', ei: 2.0, op: 0.8 })); const fl = [];
  bones.forEach((b, bi) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + bi; const o = keep(add(b, U.cone(6), fm, [Math.sin(a) * g * 0.6, g * 0.8, Math.cos(a) * g * 0.5], [Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3], [g * 0.35, g * 1.0, g * 0.35])); o.castShadow = false; fl.push(o); } });
  fig.updaters.push(fg => fl.forEach((o, i) => { const s = 0.75 + 0.35 * Math.sin(fg.t * 9 + i * 1.7); o.scale.y = g * s * 1.1; }));
}
function beastLeg(fig, parent, s, front, x, V) {
  const pre = (front ? 'f' : 'h') + (s === 'L' ? 'l' : 'r');
  const sg = s === 'L' ? 1 : -1, H = front ? V.sh : V.hh, r = V.legR * (front ? 1 : 1.1);
  const type = V.leg;
  let L = [0.45, 0.42, 0.22], A = front ? [0.15, -0.25, 0.1] : [-0.5, 1.0, -0.5], rz = [0, 0, 0];
  if (type === 'planti') { L = [0.5, 0.45, 0.08]; A = front ? [0.08, -0.12, 0.04] : [-0.2, 0.35, -0.15]; }
  if (type === 'column') { L = [0.5, 0.48, 0.05]; A = front ? [0.05, -0.05, 0] : [-0.08, 0.12, -0.04]; }
  if (type === 'bird') { L = [0.45, 0.55, 0.35]; A = [-0.9, 1.6, -0.7]; }
  if (type === 'sprawl') { L = [0.7, 0.85, 0.15]; A = [front ? -0.3 : 0.3, 0, 0]; rz = [sg * 1.15, -sg * 1.35, sg * 0.2]; }
  if (front && V.frontFoot === 'talon') { L = [0.45, 0.45, 0.2]; }
  const legH = H * (type === 'sprawl' ? 0.62 : 1);
  const u = fig.bone(pre + 'U', parent, x, front ? -V.g * 0.25 : -V.g * 0.2, front ? V.g * 0.2 : 0);
  u.rotation.set(A[0], 0, rz[0]);
  const lo = fig.bone(pre + 'L', u, 0, -L[0] * legH, 0); lo.rotation.set(A[1], 0, rz[1]);
  const ft = fig.bone(pre + 'F', lo, 0, -L[1] * legH, 0); ft.rotation.set(A[2], 0, rz[2]);
  const M = front && V.frontCover ? coverMat(V.frontCover, fig.desc.palette.head || shade(fig.desc.palette.body || '#7a6a5a', 1.3)) : fig.M.body;
  add(u, U.limb(r * 1.7, r * 1.15, L[0] * legH, 0.25), M, [0, 0, 0]);
  if (!front || V.leg !== 'bird') ell(u, M, [0, -0.02, 0], [r * 2.0, r * 2.6, r * 2.3]);
  add(lo, U.limb(r * 1.1, r * 0.85, L[1] * legH, 0.1), M);
  add(ft, U.limb(r * 0.85, r * 0.75, L[2] * legH, 0), M);
  const sole = new THREE.Object3D(); ft.add(sole);
  const foot = front && V.frontFoot ? V.frontFoot : V.foot;
  const fy = -L[2] * legH;
  if (foot === 'hoof') { add(ft, U.cyl(10, 0.85, 1), MT.dark(), [0, fy - r * 0.4, 0.004], [-A[0] - A[1] - A[2], 0, 0], [r * 1.15, r * 1.6, r * 1.25]); sole.position.set(0, fy - r * 1.2, 0); }
  else if (foot === 'pad') { add(ft, U.cyl(12, 1, 1.1), M, [0, fy - r * 0.3, 0], [-A[0] - A[1] - A[2], 0, 0], [r * 1.3, r * 1.0, r * 1.3]); for (let i = 0; i < 3; i++) ell(ft, MT.horn('#d8d0c0'), [(i - 1) * r * 0.8, fy - r * 0.6, r * 1.1], [r * 0.35, r * 0.3, r * 0.25]); sole.position.set(0, fy - r * 0.8, 0); }
  else if (foot === 'talon') { const tm = MT.horn(fig.desc.palette.talon || '#d8b040'); const ft2 = grp(ft, [0, fy, 0], [-A[0] - A[1] - A[2], 0, 0]); for (let i = 0; i < 3; i++) { const a = (i - 1) * 0.5; rod(ft2, tm, [0, 0, 0], [Math.sin(a) * 0.09, -0.01, Math.cos(a) * 0.09], r * 0.6, r * 0.4); spike(ft2, fig.M.claw, [Math.sin(a) * 0.09, -0.01, Math.cos(a) * 0.09], [Math.sin(a) * 0.12, -0.04, Math.cos(a) * 0.12], r * 0.35); } rod(ft2, tm, [0, 0, 0], [0, -0.01, -0.06], r * 0.5, r * 0.4); sole.position.set(0, fy - r * 0.6, 0); }
  else if (foot === 'flipper') { add(ft, U.sphere(10, 6), M, [0, fy, r], [-A[0] - A[1] - A[2], 0, 0], [r * 2.2, r * 0.6, r * 3.0]); sole.position.set(0, fy - r * 0.5, 0); }
  else if (foot === 'fin') { add(ft, U.shape('flfin', [[0, 0], [0.06, -0.08], [0, -0.12], [-0.06, -0.08]], 0.01, 0.003), MT.membrane(fig.desc.palette.fin || '#4a9aa0'), [0, fy, 0], [0, HP, 0]); sole.position.set(0, fy - 0.08, 0); }
  else { // paw / claw
    const pw = grp(ft, [0, fy, 0], [-(A[0] + A[1] + A[2]), 0, -(rz[0] + rz[1] + rz[2])]);
    ell(pw, M, [0, -r * 0.35, r * 0.6], [r * 1.25, r * 0.75, r * 1.7]);
    for (let i = 0; i < 3; i++) spike(pw, fig.M.claw, [(i - 1) * r * 0.7, -r * 0.4, r * 1.8], [(i - 1) * r * 0.8, -r * 0.8, r * 2.6 + (foot === 'claw' ? r : 0)], r * 0.28, 5);
    sole.position.set(0, fy - r * 1.05, 0);
  }
  fig.legs.push({ U: u.name, L: lo.name, F: ft.name, front, s, sg, sole, type });
}

/* ---------- beast heads (+Z forward) */
function buildBeastHead(fig, hb, type, V, k) {
  const d = fig.desc, f = d.f, pal = d.palette, M = fig.M, hs = (V.hs || 1) * (f.headScale || 1);
  const skin = type === 'owl' || type === 'eagle' || type === 'bird' ? MT.feather(pal.head || pal.body) : (type === 'horse' && V.cover === 'skin') ? MT.skin(pal.body) : M.body;
  const eyeM = f.glowEyes ? MT.glowEye(pal.eye || '#ffcc33') : MT.eye(pal.eye || '#141010');
  const S = (x, y, z, sx, sy, sz, m, r) => ell(hb, m || skin, [x * hs, y * hs, z * hs], [sx * hs, sy * hs, sz * hs], r);
  const eyes = (x, y, z, s) => { [1, -1].forEach(g => ell(hb, eyeM, [g * x * hs, y * hs, z * hs], [s * hs, s * hs, s * 0.7 * hs])); };
  const jawB = (y, z, len, w, m, teeth) => { const j = fig.bone((k ? 'jaw' + k : 'jaw'), hb, 0, y * hs, z * hs); ell(j, m || skin, [0, -0.012 * hs, len * 0.5 * hs], [w * hs, 0.022 * hs, len * 0.55 * hs]); if (teeth) for (let i = 0; i < teeth; i++) { const t = i / (teeth - 1); [1, -1].forEach(g => spike(j, MT.teeth(), [g * w * 0.7 * hs * (1 - t * 0.4), 0.005 * hs, len * (0.2 + t * 0.7) * hs], [g * w * 0.7 * hs * (1 - t * 0.4), 0.03 * hs, len * (0.2 + t * 0.7) * hs], 0.006 * hs)); } hb.userData.jaw = j.name; return j; };
  const mouth = new THREE.Object3D(); hb.add(mouth); if (!fig.anchors) fig.anchors = {}; if (!k) fig.anchors.mouth = mouth;
  const ears = (x, y, z, h, w, back) => [1, -1].forEach(g => { const e = spike(hb, skin, [g * x * hs, y * hs, z * hs], [g * (x + 0.02) * hs, (y + h) * hs, (z - (back || 0.02)) * hs], w * hs); e.scale.z *= 0.4; });
  switch (type) {
    case 'canine': S(0, 0.02, 0, 0.07, 0.065, 0.075); S(0, -0.005, 0.085, 0.038, 0.035, 0.07); S(0, 0.005, 0.15, 0.018, 0.015, 0.012, MT.dark()); eyes(0.035, 0.035, 0.05, 0.011); ears(0.035, 0.06, -0.015, 0.07, 0.025); jawB(-0.025, 0.02, 0.13, 0.03, null, 3); mouth.position.set(0, -0.01 * hs, 0.16 * hs); break;
    case 'feline': S(0, 0.02, 0, 0.075, 0.068, 0.07); S(0, -0.01, 0.06, 0.045, 0.035, 0.045); S(0, 0.0, 0.1, 0.016, 0.012, 0.01, MT.dark()); eyes(0.035, 0.035, 0.055, 0.012); ears(0.04, 0.055, -0.01, 0.045, 0.025); jawB(-0.03, 0.015, 0.09, 0.033); if (f.saber) [1, -1].forEach(g => spike(hb, MT.teeth(), [g * 0.02 * hs, -0.02 * hs, 0.08 * hs], [g * 0.022 * hs, -0.11 * hs, 0.09 * hs], 0.009 * hs)); mouth.position.set(0, -0.02 * hs, 0.11 * hs); break;
    case 'bear': S(0, 0.02, 0, 0.08, 0.075, 0.08); S(0, -0.01, 0.075, 0.045, 0.04, 0.06); S(0, 0.005, 0.13, 0.02, 0.016, 0.012, MT.dark()); eyes(0.035, 0.04, 0.06, 0.01); [1, -1].forEach(g => S(g * 0.06, 0.075, -0.01, 0.025, 0.025, 0.012)); jawB(-0.035, 0.02, 0.1, 0.035, null, 2); mouth.position.set(0, -0.02 * hs, 0.13 * hs); break;
    case 'owl': S(0, 0.02, 0, 0.085, 0.085, 0.08); S(0, 0.02, 0.04, 0.075, 0.07, 0.04, MT.feather(pal.face || '#e8d8b0')); [1, -1].forEach(g => { ell(hb, MT.eye('#f0c020'), [g * 0.032 * hs, 0.035 * hs, 0.075 * hs], [0.022 * hs, 0.022 * hs, 0.01 * hs]); ell(hb, MT.eye('#101010'), [g * 0.032 * hs, 0.035 * hs, 0.084 * hs], [0.01 * hs, 0.01 * hs, 0.005 * hs]); spike(hb, skin, [g * 0.05 * hs, 0.08 * hs, 0], [g * 0.075 * hs, 0.14 * hs, -0.02 * hs], 0.02 * hs); });
      horn(hb, MT.horn('#3a3020'), [[0, 0.02 * hs, 0.07 * hs], [0, 0.0, 0.11 * hs], [0, -0.04 * hs, 0.115 * hs]], 0.022 * hs); jawB(-0.03, 0.06, 0.05, 0.02, MT.horn('#3a3020')); mouth.position.set(0, -0.01 * hs, 0.12 * hs); break;
    case 'eagle': case 'bird': {
      S(0, 0.02, 0, 0.06, 0.06, 0.065);
      if (f.crest) for (let i = 0; i < 3; i++) spike(hb, MT.feather(pal.crest || pal.head || '#c03020'), [0, 0.06 * hs, -0.01 * hs], [0, 0.11 * hs + i * 0.01, -0.05 * hs - i * 0.03 * hs], 0.012 * hs);
      eyes(0.035, 0.035, 0.03, 0.01);
      horn(hb, MT.horn(pal.beak || '#d8a830'), [[0, 0.025 * hs, 0.04 * hs], [0, 0.01 * hs, 0.1 * hs], [0, -0.025 * hs, 0.12 * hs]], 0.025 * hs);
      jawB(-0.01, 0.04, 0.06, 0.016, MT.horn(pal.beak || '#d8a830')); mouth.position.set(0, 0.0, 0.11 * hs); break;
    }
    case 'boar': S(0, 0.02, 0, 0.075, 0.07, 0.08); S(0, -0.01, 0.09, 0.04, 0.04, 0.08); add(hb, U.cyl(12), MT.skin(pal.snout || '#c89080'), [0, -0.01 * hs, 0.165 * hs], [HP, 0, 0], [0.035 * hs, 0.012 * hs, 0.032 * hs]); eyes(0.04, 0.04, 0.04, 0.009); ears(0.04, 0.06, -0.02, 0.05, 0.025, 0.04);
      [1, -1].forEach(g => horn(hb, MT.horn('#efe6cf'), [[g * 0.035 * hs, -0.03 * hs, 0.11 * hs], [g * 0.06 * hs, 0.0, 0.13 * hs], [g * 0.06 * hs, 0.05 * hs, 0.12 * hs]], 0.012 * hs)); jawB(-0.04, 0.03, 0.1, 0.03); mouth.position.set(0, -0.03 * hs, 0.16 * hs); break;
    case 'horse': S(0, 0.02, -0.01, 0.055, 0.065, 0.07); S(0, -0.01, 0.09, 0.042, 0.05, 0.1); S(0, -0.03, 0.18, 0.04, 0.042, 0.04); eyes(0.045, 0.035, 0.02, 0.011); ears(0.025, 0.07, -0.03, 0.06, 0.015);
      if (f.horn === 'single' || f.unicorn) spike(hb, MT.horn(pal.horn || '#f0e0b0'), [0, 0.07 * hs, 0.02 * hs], [0, 0.17 * hs, 0.12 * hs], 0.016 * hs);
      if (f.mane !== false) for (let i = 0; i < 3; i++) spike(hb, MT.fur(pal.mane || '#2a2018'), [0, 0.06 * hs, -0.02 * hs - i * 0.02], [0, 0.11 * hs, 0.02 * hs - i * 0.02], 0.02 * hs);
      jawB(-0.05, 0.08, 0.11, 0.03); mouth.position.set(0, -0.04 * hs, 0.2 * hs); break;
    case 'goat': S(0, 0.02, 0, 0.05, 0.05, 0.06); S(0, -0.005, 0.07, 0.03, 0.035, 0.06); eyes(0.035, 0.03, 0.02, 0.009); [1, -1].forEach(g => horn(hb, MT.horn(pal.horn || '#8a7a60'), [[g * 0.025 * hs, 0.05 * hs, 0], [g * 0.045 * hs, 0.11 * hs, -0.05 * hs], [g * 0.06 * hs, 0.09 * hs, -0.12 * hs], [g * 0.065 * hs, 0.03 * hs, -0.12 * hs]], 0.016 * hs)); S(0, -0.06, 0.06, 0.012, 0.035, 0.012, MT.fur(pal.beard || '#d8d0c0')); jawB(-0.03, 0.03, 0.08, 0.022); mouth.position.set(0, -0.02 * hs, 0.12 * hs); break;
    case 'rhino': S(0, 0.02, 0, 0.08, 0.07, 0.09); S(0, -0.01, 0.11, 0.06, 0.055, 0.09); eyes(0.06, 0.03, 0.04, 0.008); ears(0.045, 0.07, -0.03, 0.05, 0.022); spike(hb, M.horn.color ? MT.horn(pal.horn || '#b8a888') : M.horn, [0, 0.04 * hs, 0.16 * hs], [0, 0.17 * hs, 0.2 * hs], 0.035 * hs); spike(hb, MT.horn(pal.horn || '#b8a888'), [0, 0.06 * hs, 0.09 * hs], [0, 0.12 * hs, 0.1 * hs], 0.022 * hs); jawB(-0.04, 0.04, 0.12, 0.04); mouth.position.set(0, -0.04 * hs, 0.2 * hs); break;
    case 'elephant': {
      S(0, 0.04, 0, 0.09, 0.1, 0.09); eyes(0.07, 0.04, 0.05, 0.008);
      [1, -1].forEach(g => add(hb, U.sphere(12, 8), skin, [g * 0.1 * hs, 0.02 * hs, -0.03 * hs], [0, g * 0.5, 0], [0.012 * hs, 0.1 * hs, 0.08 * hs]));
      let p = hb; for (let i = 0; i < 4; i++) { const b = fig.bone('trunk' + i, p, 0, i === 0 ? -0.02 * hs : -0.07 * hs, i === 0 ? 0.08 * hs : 0); b.rotation.x = i === 0 ? 0.25 : 0.12; add(b, U.limb((0.035 - i * 0.006) * hs, (0.029 - i * 0.006) * hs, 0.075 * hs, 0), skin); p = b; }
      if (f.tusks !== false) [1, -1].forEach(g => horn(hb, MT.horn('#f2ead8'), [[g * 0.04 * hs, -0.04 * hs, 0.07 * hs], [g * 0.05 * hs, -0.12 * hs, 0.14 * hs], [g * 0.04 * hs, -0.12 * hs, 0.24 * hs], [g * 0.03 * hs, -0.06 * hs, 0.3 * hs]], 0.018 * hs));
      if (f.woolly) S(0, 0.08, -0.02, 0.1, 0.06, 0.08, MT.fur(pal.body));
      mouth.position.set(0, -0.1 * hs, 0.12 * hs); break;
    }
    case 'rat': S(0, 0.015, 0, 0.05, 0.045, 0.055); S(0, 0.0, 0.065, 0.025, 0.022, 0.055); S(0, 0.005, 0.115, 0.01, 0.008, 0.008, MT.skin('#e09090')); eyes(0.025, 0.025, 0.035, 0.008); [1, -1].forEach(g => S(g * 0.035, 0.05, -0.01, 0.022, 0.025, 0.006, MT.skin(pal.tailC || '#c89a8a'))); jawB(-0.015, 0.03, 0.07, 0.016); mouth.position.set(0, -0.01 * hs, 0.11 * hs); break;
    case 'lizard': case 'small': S(0, 0.0, 0, 0.055, 0.045, 0.07); S(0, -0.01, 0.08, 0.04, 0.03, 0.07); eyes(0.04, 0.025, 0.03, 0.01); jawB(-0.025, 0.02, 0.13, 0.032, f.frill ? null : null, 3); if (f.frill) [1, -1].forEach(g => add(hb, U.sphere(12, 8), MT.membrane(pal.accent || '#d04020'), [g * 0.07 * hs, 0.0, -0.03 * hs], [0, g * 0.9, 0], [0.012 * hs, 0.09 * hs, 0.08 * hs])); if (f.crown) for (let i = 0; i < 5; i++) spike(hb, M.horn, [(i - 2) * 0.02 * hs, 0.04 * hs, -0.02 * hs], [(i - 2) * 0.03 * hs, 0.09 * hs, -0.05 * hs], 0.008 * hs); mouth.position.set(0, -0.02 * hs, 0.15 * hs); break;
    case 'croc': S(0, 0.0, 0, 0.065, 0.045, 0.08); add(hb, U.rbox(0.09, 0.035, 0.24, 0.3), skin, [0, -0.005 * hs, 0.17 * hs], null, hs); eyes(0.035, 0.04, 0.02, 0.01); { const j = jawB(-0.03, 0.02, 0.27, 0.045, null, 6); } for (let i = 0; i < 6; i++) [1, -1].forEach(g => spike(hb, MT.teeth(), [g * 0.042 * hs, -0.02 * hs, (0.08 + i * 0.035) * hs], [g * 0.044 * hs, -0.045 * hs, (0.08 + i * 0.035) * hs], 0.006 * hs)); mouth.position.set(0, -0.02 * hs, 0.3 * hs); break;
    case 'dragon': {
      const dm = skin;
      S(0, 0.02, 0, 0.065, 0.06, 0.08, dm);
      add(hb, U.rbox(0.085, 0.05, 0.17, 0.35), dm, [0, 0.005 * hs, 0.11 * hs], [0.08, 0, 0], hs);
      [1, -1].forEach(g => { add(hb, U.box(), dm, [g * 0.035 * hs, 0.05 * hs, 0.05 * hs], [0.25, g * 0.25, 0], [0.035 * hs, 0.015 * hs, 0.08 * hs]); ell(hb, eyeM, [g * 0.04 * hs, 0.038 * hs, 0.06 * hs], [0.012 * hs, 0.008 * hs, 0.012 * hs]); ell(hb, MT.dark(), [g * 0.02 * hs, 0.02 * hs, 0.195 * hs], [0.008 * hs, 0.006 * hs, 0.006 * hs]); });
      jawB(-0.03, 0.02, 0.18, 0.038, M.belly, 4);
      for (let i = 0; i < 5; i++) [1, -1].forEach(g => spike(hb, MT.teeth(), [g * 0.035 * hs, -0.015 * hs, (0.08 + i * 0.025) * hs], [g * 0.036 * hs, -0.04 * hs, (0.08 + i * 0.025) * hs], 0.005 * hs));
      const ht = f.dhorns || 'swept'; const hm = M.horn;
      [1, -1].forEach(g => {
        if (ht === 'swept') horn(hb, hm, [[g * 0.04 * hs, 0.05 * hs, -0.02 * hs], [g * 0.06 * hs, 0.08 * hs, -0.1 * hs], [g * 0.07 * hs, 0.1 * hs, -0.2 * hs], [g * 0.06 * hs, 0.14 * hs, -0.28 * hs]], 0.022 * hs);
        if (ht === 'ram') horn(hb, hm, [[g * 0.045 * hs, 0.05 * hs, -0.02 * hs], [g * 0.09 * hs, 0.08 * hs, -0.08 * hs], [g * 0.12 * hs, 0.02 * hs, -0.1 * hs], [g * 0.11 * hs, -0.04 * hs, -0.04 * hs], [g * 0.09 * hs, -0.03 * hs, 0.02 * hs]], 0.024 * hs);
        if (ht === 'many') for (let i = 0; i < 3; i++) spike(hb, hm, [g * (0.03 + i * 0.015) * hs, 0.05 * hs, (-0.01 - i * 0.03) * hs], [g * (0.06 + i * 0.03) * hs, 0.1 * hs + i * 0.01, (-0.07 - i * 0.05) * hs], 0.014 * hs);
        if (ht === 'forward') horn(hb, hm, [[g * 0.04 * hs, 0.05 * hs, 0.0], [g * 0.07 * hs, 0.11 * hs, -0.05 * hs], [g * 0.08 * hs, 0.16 * hs, 0.01 * hs], [g * 0.07 * hs, 0.18 * hs, 0.08 * hs]], 0.022 * hs);
        if (ht === 'crown') { for (let i = 0; i < 4; i++) spike(hb, hm, [g * 0.04 * hs, 0.05 * hs - i * 0.01, (-0.02 - i * 0.03) * hs], [g * 0.1 * hs, 0.09 * hs - i * 0.01, (-0.06 - i * 0.05) * hs], 0.012 * hs); }
        if (f.frillD) add(hb, U.sphere(12, 8), MT.membrane(pal.accent || shade(pal.body || '#666', 0.7)), [g * 0.06 * hs, 0.02 * hs, -0.04 * hs], [0, g * 0.9, 0], [0.01 * hs, 0.07 * hs, 0.08 * hs]);
      });
      if (f.noseHorn) spike(hb, hm, [0, 0.03 * hs, 0.17 * hs], [0, 0.08 * hs, 0.19 * hs], 0.014 * hs);
      if (f.barbels) [1, -1].forEach(g => horn(hb, MT.skin(pal.accent || '#d8b040'), [[g * 0.03 * hs, -0.01 * hs, 0.17 * hs], [g * 0.07 * hs, -0.05 * hs, 0.18 * hs], [g * 0.1 * hs, -0.1 * hs, 0.14 * hs]], 0.006 * hs));
      mouth.position.set(0, -0.02 * hs, 0.21 * hs); break;
    }
    case 'trex': S(0, 0.03, 0, 0.07, 0.07, 0.09); add(hb, U.rbox(0.1, 0.08, 0.2, 0.3), skin, [0, 0.01 * hs, 0.12 * hs], null, hs); eyes(0.05, 0.05, 0.05, 0.01); jawB(-0.035, 0.0, 0.22, 0.048, null, 5); for (let i = 0; i < 6; i++) [1, -1].forEach(g => spike(hb, MT.teeth(), [g * 0.045 * hs, -0.03 * hs, (0.05 + i * 0.03) * hs], [g * 0.046 * hs, -0.06 * hs, (0.05 + i * 0.03) * hs], 0.007 * hs)); mouth.position.set(0, -0.03 * hs, 0.22 * hs); break;
    case 'raptor': S(0, 0.02, 0, 0.045, 0.045, 0.06); add(hb, U.rbox(0.055, 0.04, 0.13, 0.3), skin, [0, 0.0, 0.08 * hs], null, hs); eyes(0.03, 0.03, 0.03, 0.008); jawB(-0.022, 0.0, 0.14, 0.025, null, 4); if (f.feathers !== false) for (let i = 0; i < 3; i++) spike(hb, MT.feather(pal.accent || '#c04020'), [0, 0.04 * hs, -0.02 * hs - i * 0.015], [0, 0.08 * hs, -0.07 * hs - i * 0.02], 0.012 * hs); mouth.position.set(0, -0.02 * hs, 0.15 * hs); break;
    case 'dome': S(0, 0.06, 0, 0.065, 0.07, 0.07, MT.bone(pal.horn || '#d8c8a8')); S(0, 0.0, 0.06, 0.045, 0.045, 0.07); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; spike(hb, MT.horn('#5a4a3a'), [Math.sin(a) * 0.06 * hs, 0.02 * hs, Math.cos(a) * 0.05 * hs - 0.02], [Math.sin(a) * 0.09 * hs, 0.03 * hs, Math.cos(a) * 0.08 * hs - 0.03], 0.008 * hs); } eyes(0.045, 0.03, 0.04, 0.008); jawB(-0.03, 0.02, 0.1, 0.03); mouth.position.set(0, -0.02 * hs, 0.12 * hs); break;
    case 'tri': {
      S(0, 0.02, 0, 0.075, 0.065, 0.09); S(0, -0.02, 0.1, 0.045, 0.05, 0.08); horn(hb, MT.horn('#3a3020'), [[0, 0.0, 0.15 * hs], [0, -0.03 * hs, 0.2 * hs], [0, -0.07 * hs, 0.2 * hs]], 0.03 * hs);
      add(hb, U.lathe('frill', [[0.001, 0.0], [0.08, 0.005], [0.15, 0.0], [0.155, -0.01], [0.001, -0.012]], 14, 0, TAU), MT.scales(pal.accent || shade(pal.body || '#6a6a4a', 0.8)), [0, 0.06 * hs, -0.05 * hs], [-1.1, 0, 0], hs);
      for (let i = 0; i < 8; i++) { const a = -HP + i / 7 * PI; spike(hb, M.horn, [Math.sin(a) * 0.15 * hs, 0.06 * hs + Math.cos(a) * 0.07 * hs, -0.08 * hs + Math.cos(a) * 0.12 * hs], [Math.sin(a) * 0.19 * hs, 0.06 * hs + Math.cos(a) * 0.1 * hs, -0.1 * hs + Math.cos(a) * 0.16 * hs], 0.012 * hs); }
      [1, -1].forEach(g => spike(hb, MT.horn('#e8dcc0'), [g * 0.04 * hs, 0.06 * hs, 0.03 * hs], [g * 0.06 * hs, 0.14 * hs, 0.2 * hs], 0.02 * hs)); spike(hb, MT.horn('#e8dcc0'), [0, 0.02 * hs, 0.14 * hs], [0, 0.08 * hs, 0.19 * hs], 0.015 * hs);
      eyes(0.055, 0.03, 0.04, 0.008); jawB(-0.05, 0.03, 0.1, 0.035); mouth.position.set(0, -0.05 * hs, 0.18 * hs); break;
    }
    case 'ank': S(0, 0.0, 0, 0.07, 0.05, 0.08); S(0, -0.01, 0.07, 0.05, 0.04, 0.05); [1, -1].forEach(g => spike(hb, M.horn, [g * 0.06 * hs, 0.02 * hs, -0.04 * hs], [g * 0.11 * hs, 0.03 * hs, -0.08 * hs], 0.018 * hs)); eyes(0.05, 0.02, 0.03, 0.008); jawB(-0.03, 0.02, 0.08, 0.03); mouth.position.set(0, -0.02 * hs, 0.12 * hs); break;
    case 'duck': S(0, 0.02, 0, 0.055, 0.06, 0.075); add(hb, U.rbox(0.07, 0.035, 0.14, 0.4), skin, [0, -0.01 * hs, 0.11 * hs], null, hs); horn(hb, MT.scales(pal.accent || '#a04a2a'), [[0, 0.05 * hs, 0.02 * hs], [0, 0.11 * hs, -0.05 * hs], [0, 0.12 * hs, -0.16 * hs]], 0.03 * hs); eyes(0.045, 0.035, 0.03, 0.009); jawB(-0.03, 0.04, 0.12, 0.03); mouth.position.set(0, -0.02 * hs, 0.18 * hs); break;
    case 'ptero': S(0, 0.0, 0, 0.04, 0.04, 0.06); spike(hb, MT.horn(pal.beak || '#d8c080'), [0, 0.0, 0.04 * hs], [0, -0.01 * hs, 0.3 * hs], 0.03 * hs).scale.x *= 0.6; spike(hb, skin, [0, 0.02 * hs, -0.02 * hs], [0, 0.06 * hs, -0.22 * hs], 0.03 * hs).scale.x *= 0.3; eyes(0.03, 0.02, 0.02, 0.008); jawB(-0.02, 0.04, 0.2, 0.015, MT.horn(pal.beak || '#d8c080')); mouth.position.set(0, -0.01 * hs, 0.28 * hs); break;
    case 'bat': S(0, 0.02, 0, 0.05, 0.048, 0.05); S(0, 0.0, 0.045, 0.028, 0.025, 0.03); S(0, 0.005, 0.07, 0.014, 0.012, 0.008, MT.skin('#3a2a2a')); eyes(0.025, 0.03, 0.04, 0.008); ears(0.03, 0.05, -0.0, 0.08, 0.03, 0.0); jawB(-0.02, 0.02, 0.05, 0.02, null, 2); mouth.position.set(0, -0.01 * hs, 0.07 * hs); break;
    case 'lion': S(0, 0.02, 0, 0.075, 0.07, 0.075); S(0, -0.01, 0.065, 0.045, 0.04, 0.05); S(0, 0.0, 0.11, 0.017, 0.013, 0.01, MT.dark()); eyes(0.035, 0.035, 0.055, 0.011); jawB(-0.03, 0.02, 0.09, 0.034, null, 2); mouth.position.set(0, -0.02 * hs, 0.12 * hs); break;
    case 'human': { // sphinx / manticore face
      S(0, 0.03, 0, 0.065, 0.075, 0.07, MT.skin(pal.face || '#c89a70')); eyes(0.026, 0.04, 0.06, 0.009); S(0, 0.025, 0.07, 0.01, 0.018, 0.012, MT.skin(pal.face || '#c89a70'));
      if (f.headdress) { add(hb, geo('nemes', () => new THREE.SphereGeometry(1, 14, 10, HP + 0.9, TAU - 1.8, 0, PI * 0.7)), MT.cloth(pal.trim || '#2a4a8a'), [0, 0.03 * hs, -0.005], [-0.2, 0, 0], [0.08 * hs, 0.09 * hs, 0.08 * hs]); add(hb, U.cyl(14, 1, 1, true), MT.gold(), [0, 0.07 * hs, 0], [-0.15, 0, 0], [0.072 * hs, 0.02, 0.072 * hs]); }
      else for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; add(hb, U.cone(6), MT.fur(pal.mane || '#6a4a24'), [Math.sin(a) * 0.07 * hs, Math.cos(a) * 0.07 * hs + 0.03, -0.03], [-HP + Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9], [0.04 * hs, 0.14 * hs, 0.03 * hs]); }
      mouth.position.set(0, 0.0, 0.08 * hs); break;
    }
    default: S(0, 0.02, 0, 0.07, 0.065, 0.08); eyes(0.035, 0.035, 0.05, 0.01); jawB(-0.03, 0.02, 0.1, 0.03); mouth.position.set(0, 0, 0.12 * hs);
  }
  if (f.horns && (type !== 'dragon')) { const hm = MT.horn(pal.horn || '#2e2620'); const ht = f.horns; [1, -1].forEach(g => { if (ht === 'antler') { const am = MT.horn('#8a6a4a'); horn(hb, am, [[g * 0.03 * hs, 0.06 * hs, -0.01], [g * 0.08 * hs, 0.14 * hs, -0.04 * hs], [g * 0.15 * hs, 0.22 * hs, -0.06 * hs]], 0.012 * hs); rod(hb, am, [g * 0.08 * hs, 0.14 * hs, -0.04 * hs], [g * 0.06 * hs, 0.22 * hs, 0.0], 0.007 * hs, 0.003 * hs); rod(hb, am, [g * 0.12 * hs, 0.19 * hs, -0.05 * hs], [g * 0.2 * hs, 0.2 * hs, -0.01 * hs], 0.006 * hs, 0.003 * hs); } else if (ht === 'ram') horn(hb, hm, [[g * 0.03 * hs, 0.06 * hs, 0], [g * 0.07 * hs, 0.1 * hs, -0.05 * hs], [g * 0.1 * hs, 0.05 * hs, -0.08 * hs], [g * 0.1 * hs, 0.0, -0.04 * hs]], 0.02 * hs); else if (ht !== 'single') horn(hb, hm, [[g * 0.035 * hs, 0.05 * hs, 0.0], [g * 0.08 * hs, 0.08 * hs, 0.02 * hs], [g * 0.1 * hs, 0.13 * hs, 0.05 * hs]], 0.018 * hs); }); }
  if (f.headSpikes) for (let i = 0; i < 4; i++) spike(hb, M.horn, [0, 0.05 * hs, -0.02 * hs - i * 0.03 * hs], [0, 0.09 * hs, -0.05 * hs - i * 0.03 * hs], 0.01 * hs);
  if (!k) mouth.name = 'mouthAnchor';
}
/* ---------- beast motion */
function quadGait(fig, w, spd) {
  const V = fig.V, p = fig.phase, legs = fig.legs; if (!legs) return;
  const run = clamp((spd - 3.5) / 3, 0, 1);
  const biped = !legs.some(l => l.front) || !legs.some(l => !l.front);
  legs.forEach(l => {
    const off = biped ? (l.s === 'L' ? 0 : PI) : ((l.front ? l.s === 'L' : l.s === 'R') ? 0 : PI);
    const ph = p + off, s = Math.sin(ph), c = Math.cos(ph);
    if (l.type === 'sprawl') {
      fig.rot(l.U, 0, l.sg * 0.45 * s * w * (l.front ? 1 : -1), l.sg * 0.25 * Math.max(0, c) * w);
      fig.rot(l.L, 0, 0, -l.sg * 0.3 * Math.max(0, c) * w);
    } else {
      const A = (l.front ? 0.42 : 0.38) + 0.25 * run, K = 0.55 + 0.5 * run;
      fig.rot(l.U, -A * s * w, 0, 0);
      fig.rot(l.L, (l.front ? 1 : 0.8) * K * Math.max(0, c) * w, 0, 0);
      fig.rot(l.F, -0.4 * K * Math.max(0, c) * w + (l.front ? 0.2 * A * s : 0) * w, 0, 0);
    }
  });
  const bob = (biped ? 0.03 : 0.018) * (1 + run);
  fig.mov('body', 0, -bob * Math.abs(Math.cos(p)) * w, 0);
  fig.rot('body', 0.03 * Math.sin(p * 2) * w * (biped ? 0 : 1), biped ? 0.06 * Math.sin(p) * w : 0, biped ? 0.05 * Math.sin(p) * w : 0);
  if (V.leg === 'sprawl') { fig.rot('body', 0, 0.12 * Math.sin(p) * w, 0); fig.rot('chest', 0, -0.2 * Math.sin(p) * w, 0); }
  (fig.heads || []).forEach(h => { if (h.neck[0]) fig.rot(h.neck[0], 0.05 * Math.sin(p * 2) * w, 0, 0); });
}
function bstBase(fig, dt, w) {
  const t = fig.t + fig.ph, V = fig.V;
  const mw = fig.moveW * w, spd = fig.speed || 4;
  fig.rot('chest', 0.02 * Math.sin(t * 1.5) * w, 0, 0);
  (fig.heads || []).forEach((h, k) => { const n = h.neck.length; h.neck.forEach((nm, i) => fig.rot(nm, 0.035 * Math.sin(t * 0.8 + k * 1.3 + i * 0.4) * w, (0.25 / n) * Math.sin(t * 0.33 + k * 2.1) * w + (fig.heads.length > 1 ? 0.08 * Math.sin(t * 1.1 + k * 1.9) * w : 0), 0)); if (h.jaw) fig.rot(h.jaw, (0.04 + 0.04 * Math.sin(t * 0.9 + k)) * w, 0, 0); });
  if (fig.tail) { const amp = V.tail && V.tail.wave ? 0.25 : 0.1; fig.tail.forEach((b, i) => fig.rot(b.name, 0.025 * Math.sin(t * 1.1 - i * 0.5) * w, (amp + 0.2 * mw) * Math.sin(t * (1.2 + 4 * mw) - i * 0.55) * w, 0)); }
  const stride = Math.max(0.5, (V.hh + V.len) * 1.3) * (spd > 4.5 ? 1.4 : 1);
  if (fig.moveW > 0.01) fig.phase += dt * spd / (stride * fig.S) * TAU;
  if (mw > 0.001 && fig.flyW < 0.5) quadGait(fig, mw * (1 - fig.flyW), spd);
  if (fig.flyW > 0.001) {
    const fw = fig.flyW * w; const hov = (fig.hoverH || 0.6) * fw;
    fig.mov('root', 0, hov + Math.sin(t * 2.0) * 0.05 * fw, 0);
    (fig.legs || []).forEach(l => { fig.rot(l.U, (l.front ? -0.6 : 0.7) * fw, 0, 0); fig.rot(l.L, (l.front ? 1.2 : 0.4) * fw, 0, 0); });
    fig.rot('body', (-0.05 + 0.04 * Math.sin(t * (fig.flapRate || 6.5))) * fw, 0, 0);
    if (fig.tail) fig.tail.forEach((b, i) => fig.rot(b.name, -0.04 * fw, 0, 0));
  }
  if (fig.wings) wingMotion(fig, t, w);
  if (fig.wiggle) fig.wiggle(fig, t, w);
}
function neckP(fig, rx, ry, out, headRx, jaw) {
  out = out || {};
  (fig.heads || []).forEach(h => { const n = h.neck.length || 1; h.neck.forEach(nm => { out[nm] = [rx / n, (ry || 0) / n, 0]; }); out[h.head] = [headRx || 0, 0, 0]; if (h.jaw && jaw != null) out[h.jaw] = [jaw, 0, 0]; });
  return out;
}
function legP(fig, front, u, l, f, out) { out = out || {}; (fig.legs || []).forEach(L => { if (L.front === front) { out[L.U] = [u, 0, 0]; out[L.L] = [l, 0, 0]; out[L.F] = [f || 0, 0, 0]; } }); return out; }
function tailP(fig, rx, ry, out) { out = out || {}; (fig.tail || []).forEach((b, i) => { out[b.name] = [rx * (i === 0 ? 1 : 0.6), ry * (0.6 + i * 0.15), 0]; }); return out; }
function bstLie(fig, p) {
  const V = fig.V, g = V.g;
  const full = o => { fig.bones.forEach(b => { if (!o[b.name] && b.name !== 'cape' && !/^wing/.test(b.name) && b.name !== 'hips' && b.name !== 'spine' && b.name !== 'chest' || (b.name === 'chest' && !o.chest)) o[b.name] = o[b.name] || [0, 0, 0]; }); return o; };
  const sprawl = V.leg === 'sprawl';
  if (p === 'prone') {
    const o = { root: [0, 0, 0, 0, -(Math.min(V.hh, V.sh) - g * 0.9) * (sprawl ? 0.6 : 1), 0] };
    if (!sprawl) { legP(fig, true, -1.25, 0.35, 0.6, o); legP(fig, false, -0.6, 1.6, -0.6, o); }
    neckP(fig, 0.3, 0, o, -0.2);
    return full(o);
  }
  const side = { root: [0, 0, HP, (V.hh * 0.85), g * (V.shell ? 1.3 : 0.95), 0] };
  if (!sprawl) { legP(fig, true, -0.3, 0.3, 0.2, side); legP(fig, false, -0.35, 0.5, -0.1, side); }
  neckP(fig, p === 'dead' ? 0.6 : 0.3, 0, side, 0.25, p === 'dead' ? 0.45 : 0.1);
  tailP(fig, 0.0, 0.15, side);
  if (p === 'dead') side.root[0] = 0.1;
  return full(side);
}
const BST_CLIPS = {
  melee(fig, o) {
    const f = fig.desc.f; let st = o.style || fig.desc.melee || 'bite';
    const hasFront = (fig.legs || []).some(l => l.front && l.type !== 'sprawl');
    if (st === 'claw' && !hasFront) st = fig.J.armL ? 'claw' : 'bite';
    if ((st === 'tail' || st === 'sting') && !fig.tail) st = 'bite';
    if (st === 'slam') st = hasFront ? 'stomp' : 'bite';
    if (st === 'unarmed' || st === 'slash' || st === 'thrust' || st === 'overhead') st = 'bite';
    return (BST_MELEE[st] || BST_MELEE.bite)(fig, o);
  },
  ranged(fig, o) {
    const st = o.style || fig.desc.ranged || 'spit';
    if ((st === 'spike' || st === 'sting') && fig.tail) return BST_MELEE.sting(fig, Object.assign({}, o, { ranged: true }));
    const K = BST_MELEE.bite(fig, o); K.keys = K.keys.map(k => { if (typeof k[1] === 'object' && k[1].root) { const c = Object.assign({}, k[1]); c.root = [0, 0, 0, 0, 0, 0]; return [k[0], c, k[2]]; } return k; }); return K;
  },
  breath(fig, o) {
    const color = o.color || fig.desc.palette.breath || '#ff8a3a';
    const up = neckP(fig, -0.55, 0, { chest: [-0.2, 0, 0], body: [-0.12, 0, 0], root: [0, 0, 0, 0, 0.02, -0.08] }, -0.3, 0.2);
    const out = neckP(fig, 0.35, 0, { chest: [0.12, 0, 0], body: [0.05, 0, 0], root: [0, 0, 0, 0, 0, 0.08] }, -0.25, 0.85);
    const sweep = neckP(fig, 0.3, 0.3, { chest: [0.1, 0.1, 0], root: [0, 0, 0, 0, 0, 0.08] }, -0.25, 0.85);
    return { keys: [[0, 'S'], [0.45, up, 'out'], [0.62, out, 'snap'], [1.0, sweep, 'io'], [1.25, out, 'io'], [1.6, 'S', 'io']], impact: 0.62, color, hands: 'both',
      fn: (f, t) => setGlow(f, t < 0.45 ? EASE.io(t / 0.45) * 0.7 : t < 1.3 ? 1.3 : Math.max(0, 1.3 - (t - 1.3) * 5), color, 'both'), onEnd: f => setGlow(f, 0, null, 'both') };
  },
  cast(fig, o) {
    const color = o.color || fig.desc.palette.glow || '#c8a0ff';
    const up = neckP(fig, -0.5, 0, { chest: [-0.25, 0, 0], body: [-0.15, 0, 0] }, -0.3, 0.3);
    legP(fig, true, -0.5, 0.6, 0, up);
    const out = neckP(fig, 0.2, 0, { chest: [0.05, 0, 0], root: [0, 0, 0, 0, 0, 0.06] }, -0.1, 0.5);
    return { keys: [[0, 'S'], [0.5, up, 'io'], [0.7, out, 'snap'], [0.9, out, 'lin'], [1.2, 'S', 'io']], impact: 0.7, color, fn: glowFn(0.05, 0.55, 0.72, 1.1), onEnd: f => setGlow(f, 0, null, 'both') };
  },
  hit(fig, o) {
    const k = o.heavy ? 1.8 : 1;
    const p = neckP(fig, -0.3 * k, 0.15, { root: [0, 0, 0, 0, 0, -0.08 * k], body: [0.05 * k, 0, 0.06], chest: [-0.12 * k, 0.1, 0] }, -0.2 * k, 0.3);
    return { mode: 'add', keys: [[0, {}], [0.08, p, 'out'], [o.heavy ? 0.65 : 0.42, {}, 'io']], impact: 0.05 };
  },
  dodge(fig, o) {
    const sd = o.side || (Math.random() < 0.5 ? 1 : -1);
    const p = neckP(fig, 0, -0.3 * sd, { root: [0, 0.25 * sd, 0, 0.3 * sd, 0.05, -0.05], body: [0, 0, -0.12 * sd] });
    return { mode: 'add', keys: [[0, {}], [0.15, p, 'out'], [0.3, p, 'lin'], [0.55, {}, 'io']], impact: 0.12 };
  },
  block(fig, o) {
    const p = neckP(fig, -0.35, 0, { root: [0, 0, 0, 0, -0.04, -0.06], chest: [0.1, 0, 0] }, 0.2);
    return { keys: [[0, 'S'], [0.15, p, 'snap'], [0.45, p, 'lin'], [0.7, 'S', 'io']], impact: 0.15 };
  },
  die(fig, o) {
    const dead = bstLie(fig, 'dead');
    const rear = neckP(fig, -0.5, 0.2, { root: [0, 0, 0, 0, 0.03, -0.1], body: [-0.15, 0, 0.1], chest: [-0.15, 0, 0] }, -0.4, 0.6);
    const sag = neckP(fig, 0.4, 0, { root: [0, 0, 0.35, 0.1, -0.08, 0], body: [0.1, 0, 0.1] }, 0.2, 0.4);
    legP(fig, true, -0.2, 0.9, 0, sag); legP(fig, false, -0.4, 1.0, -0.4, sag);
    return { keys: [[0, 'S'], [0.18, rear, 'out'], [0.6, sag, 'io'], [1.05, dead, 'in2'], [1.18, P_(dead, { root: [dead.root[0], 0, dead.root[2], dead.root[3], dead.root[4] + 0.05, 0] }), 'out'], [1.35, dead, 'io']], impact: 0.12, fadeOut: 0, onEnd: f => f.setPose('dead', true) };
  },
  cheer(fig, o) {
    const roar = neckP(fig, -0.6, 0, { chest: [-0.2, 0, 0], body: [-0.1, 0, 0] }, -0.3, 0.9);
    const roar2 = neckP(fig, -0.5, 0.25, { chest: [-0.2, 0, 0], body: [-0.1, 0, 0] }, -0.3, 0.8);
    if (fig.wings) { roar.wingL = [0, -1.0, 0.8]; roar.wingR = [0, 1.0, -0.8]; roar2.wingL = roar.wingL; roar2.wingR = roar.wingR; }
    return { keys: [[0, 'S'], [0.35, roar, 'out'], [0.8, roar2, 'io'], [1.1, roar, 'io'], [1.5, 'S', 'io']], impact: 0.35 };
  },
  stand(fig, o) {
    const top = fig.lie.filter(L => L.target > 0).pop();
    const start = top && top.pose ? top.pose : bstLie(fig, 'prone');
    return { keys: [[0, 'L'], [0.7, 'S', 'io']], impact: 0.4, fadeIn: 0, startPose: start, onStart: f => f.setPose('stand', true) };
  }
};
BST_CLIPS.idleFlourish = BST_CLIPS.cheer;
const BST_MELEE = {
  bite(fig, o) {
    const L = fig.V.len;
    const wind = neckP(fig, -0.35, 0, { root: [0, 0, 0, 0, 0, -0.06], chest: [-0.12, 0, 0], body: [-0.04, 0, 0] }, -0.25, 0.7);
    const hit = neckP(fig, 0.4, 0, { root: [0, 0, 0, 0, 0, 0.22 * L + 0.08], chest: [0.1, 0, 0], body: [0.05, 0, 0] }, -0.15, 0.0);
    legP(fig, true, -0.35, 0.2, 0, hit); legP(fig, false, 0.3, 0.1, 0, hit);
    const hold = Object.assign({}, hit); (fig.heads || []).forEach(h => { if (h.jaw) hold[h.jaw] = [0.12, 0, 0]; });
    return { keys: [[0, 'S'], [0.2, wind, 'out'], [0.32, hit, 'snap'], [0.45, hold, 'lin'], [0.75, 'S', 'io']], impact: 0.32 };
  },
  claw(fig, o) {
    const up = neckP(fig, -0.25, 0, { body: [-0.45, 0, 0], chest: [-0.15, 0, 0], root: [0, 0, 0, 0, 0.05, -0.04] }, 0.2, 0.6);
    legP(fig, true, -1.7, -0.6, -0.4, up); legP(fig, false, 0.25, -0.1, 0.2, up);
    if (fig.J.armL) { up.armL = [-1.8, 0, 0.5]; up.armR = [-1.8, 0, -0.5]; }
    const hit = neckP(fig, 0.3, 0, { body: [0.08, 0, 0], chest: [0.1, 0, 0], root: [0, 0, 0, 0, 0, 0.2] }, -0.1, 0.4);
    legP(fig, true, -0.5, 0.3, 0.3, hit);
    if (fig.J.armL) { hit.armL = [-0.6, 0, -0.2]; hit.armR = [-0.6, 0, 0.2]; }
    return { keys: [[0, 'S'], [0.28, up, 'out'], [0.42, hit, 'in'], [0.55, hit, 'lin'], [0.9, 'S', 'io']], impact: 0.42 };
  },
  gore(fig, o) {
    const low = neckP(fig, 0.45, 0, { root: [0, 0, 0, 0, -0.02, -0.08], chest: [0.12, 0, 0] }, 0.25);
    const hit = neckP(fig, 0.3, 0, { root: [0, 0, 0, 0, 0, 0.3], chest: [0.08, 0, 0] }, -0.3);
    legP(fig, true, -0.5, 0.2, 0, hit); legP(fig, false, 0.4, 0.2, 0, hit);
    return { keys: [[0, 'S'], [0.25, low, 'out'], [0.38, hit, 'snap'], [0.5, hit, 'lin'], [0.85, 'S', 'io']], impact: 0.38 };
  },
  stomp(fig, o) {
    const up = neckP(fig, -0.4, 0, { body: [-0.65, 0, 0], chest: [-0.1, 0, 0], root: [0, 0, 0, 0, 0.04, -0.06] }, 0.3, 0.3);
    legP(fig, true, -1.3, 1.6, 0.2, up); legP(fig, false, 0.4, -0.1, 0.3, up);
    const hit = neckP(fig, 0.2, 0, { body: [0.05, 0, 0], root: [0, 0, 0, 0, 0, 0.18] }, -0.1);
    legP(fig, true, -0.45, 0.2, 0, hit);
    return { keys: [[0, 'S'], [0.3, up, 'out'], [0.45, hit, 'in'], [0.58, hit, 'lin'], [0.9, 'S', 'io']], impact: 0.45 };
  },
  tail(fig, o) {
    const wind = neckP(fig, 0, 0.5, { body: [0, 0.5, 0], chest: [0, 0.3, 0] }); tailP(fig, 0.1, -0.35, wind);
    const hit = neckP(fig, 0, -0.6, { body: [0, -0.9, 0], chest: [0, -0.4, 0] }); tailP(fig, 0.15, 0.55, hit);
    return { keys: [[0, 'S'], [0.25, wind, 'out'], [0.42, hit, 'in'], [0.55, hit, 'lin'], [0.9, 'S', 'io']], impact: 0.42 };
  },
  sting(fig, o) {
    const n = (fig.tail || []).length; const arc = {}, hit = {};
    (fig.tail || []).forEach((b, i) => { arc[b.name] = [i === 0 ? 1.0 : 2.4 / n, 0, 0]; hit[b.name] = [i === 0 ? 1.2 : 3.2 / n, 0, 0]; });
    Object.assign(arc, neckP(fig, -0.15, 0, { root: [0, 0, 0, 0, 0, -0.05] }, 0)); Object.assign(hit, neckP(fig, 0.2, 0, { root: [0, 0, 0, 0, 0, o.ranged ? 0 : 0.2], body: [0.08, 0, 0] }, 0));
    return { keys: [[0, 'S'], [0.3, arc, 'out'], [0.45, hit, 'snap'], [0.6, hit, 'lin'], [0.95, 'S', 'io']], impact: 0.45 };
  }
};
BST_MELEE.horn = BST_MELEE.gore; BST_MELEE.hoof = BST_MELEE.stomp; BST_MELEE.trample = BST_MELEE.stomp; BST_MELEE.talon = BST_MELEE.claw;
FAM.bst = { base: bstBase, lie: bstLie, clips: BST_CLIPS };

/* ---------- centaur (humanoid torso on a horse body) */
function buildCentaurBody(fig) {
  const HM = fig.M, HP_ = fig.P, d = fig.desc;
  const saveV = d.variant; d.beastVariant = d.beastVariant || 'horse';
  fig._centaur = true;
  const f = d.f; const saveNoNeck = f.noNeck; f.noNeck = true;
  const pal = d.palette, saveBody = pal.body, saveWing = f.wings; pal.body = d.beastPal || pal.coat || '#7a5a3a'; f.wings = null;
  buildBeastCore(fig, { noHead: true });
  pal.body = saveBody; f.wings = saveWing;
  f.noNeck = saveNoNeck;
  fig.BM = fig.M; fig.M = HM; fig.P = HP_;
  const chest = fig.J.chest, hips = fig.J.hips;
  chest.add(hips); hips.position.set(0, fig.V.g * 0.55, fig.V.g * 0.55);
  fig.centaur = true; fig.lowerTail = 'horse';
}
function buildBeastCore(fig, o) { const d = fig.desc; const f = d.f; const sv = d.f.heads; if (o && o.noHead) { f._noHead = true; } buildBeast(fig); f._noHead = false; }

PLANS.quadruped = { fam: 'bst', build: buildBeast };
PLANS.dragon = { fam: 'bst', build: fig => { fig.desc.variant = fig.desc.variant || 'dragon'; if (!fig.desc.f.wings && !fig.desc.f.noWings) fig.desc.f.wings = 'bat'; buildBeast(fig); } };
PLANS.drake = { fam: 'bst', build: fig => { fig.desc.variant = fig.desc.variant || 'drake'; if (!fig.desc.f.wings && !fig.desc.f.noWings) fig.desc.f.wings = 'bat'; buildBeast(fig); } };
PLANS.linnorm = { fam: 'bst', build: fig => { fig.desc.variant = 'linnorm'; buildBeast(fig); } };
PLANS.biped = { fam: 'bst', build: fig => { fig.desc.variant = fig.desc.variant || 'raptor'; buildBeast(fig); } };
PLANS.bird = { fam: 'bst', build: fig => { fig.desc.variant = fig.desc.variant || 'bird'; if (!fig.desc.f.wings) fig.desc.f.wings = 'feather'; buildBeast(fig); } };
PLANS.bat = { fam: 'bst', build: fig => { fig.desc.variant = 'bat'; fig.desc.f.wings = 'bat'; fig.desc.fly = true; buildBeast(fig); fig.flapRate = 9; } };
PLANS.hydra = { fam: 'bst', build: fig => { fig.desc.variant = fig.desc.variant || 'lizard'; fig.desc.f.heads = fig.desc.f.heads || 5; fig.desc.beast = Object.assign({ head: 'dragon', len: 0.6, hh: 0.3, sh: 0.32, g: 0.2, leg: 'planti' }, fig.desc.beast || {}); buildBeast(fig); } };
PLANS.centaur = { fam: 'hum', build: fig => { fig.desc.lower = 'horse'; buildHumanoid(fig); } };
/* ============================================================ ARTHROPODS (spider, scorpion, crab, insect, centipede) */
const ARTHV = {
  spider: { pairs: 4, bodyR: 0.12, abdR: 0.19, legL: 0.42, legR: 0.018, H: 0.2, head: 'spider' },
  scorpion: { pairs: 4, bodyR: 0.13, abdR: 0.13, legL: 0.3, legR: 0.02, H: 0.13, head: 'scorpion', pincers: 1, stinger: 1 },
  crab: { pairs: 4, bodyR: 0.17, abdR: 0, legL: 0.3, legR: 0.025, H: 0.15, head: 'crab', pincers: 1, flat: 1 },
  ant: { pairs: 3, bodyR: 0.07, abdR: 0.13, legL: 0.32, legR: 0.016, H: 0.17, head: 'ant' },
  beetle: { pairs: 3, bodyR: 0.11, abdR: 0.18, legL: 0.28, legR: 0.02, H: 0.15, head: 'beetle', elytra: 1 },
  wasp: { pairs: 3, bodyR: 0.07, abdR: 0.11, legL: 0.28, legR: 0.012, H: 0.2, head: 'ant', stinger: 1, wings: 1, striped: 1 },
  mantis: { pairs: 2, bodyR: 0.06, abdR: 0.1, legL: 0.36, legR: 0.012, H: 0.22, head: 'mantis', raptor: 1 },
  centipede: { pairs: 0, segs: 9, bodyR: 0.06, legL: 0.13, legR: 0.012, H: 0.07, head: 'ant' },
  tick: { pairs: 4, bodyR: 0.07, abdR: 0.2, legL: 0.3, legR: 0.018, H: 0.16, head: 'spider' }
};
function buildArth(fig) {
  const d = fig.desc, f = d.f || (d.f = {}), pal = d.palette || (d.palette = {});
  const V = Object.assign({}, ARTHV[d.variant] || ARTHV.spider, d.arth || {}); fig.V = V;
  const bodyC = pal.body = pal.body || '#3a2e26';
  const BM = f.metal ? mat(bodyC, { r: 0.4, m: 0.7 }) : mat(bodyC, { r: 0.45, m: 0.1, bump: 'leather', bs: 0.004 });
  const AM = mat(pal.accent || shade(bodyC, 1.3), { r: 0.5 });
  fig.M = { body: BM, accent: AM, claw: MT.horn(pal.claw || shade(bodyC, 0.7)) };
  const body = fig.bone('body', fig.root, 0, V.H, 0);
  fig.legs = []; fig.P = { H: V.H };
  if (d.variant === 'centipede') return buildCentipede(fig, V, BM, AM);
  // body
  ell(body, BM, [0, 0, 0], [V.bodyR * (V.flat ? 1.5 : 1), V.bodyR * (V.flat ? 0.45 : 0.75), V.bodyR * (V.flat ? 1.05 : 1.1)]);
  if (V.flat) { for (let i = 0; i < 4; i++) spike(body, BM, [(i - 1.5) * 0.06, V.bodyR * 0.2, V.bodyR * 0.95], [(i - 1.5) * 0.07, V.bodyR * 0.25, V.bodyR * 1.15], 0.015); }
  if (V.abdR) {
    const ab = fig.bone('abd', body, 0, V.bodyR * 0.2, -V.bodyR * 0.9);
    const big = d.variant === 'spider' || d.variant === 'tick';
    ab.rotation.x = big ? -0.25 : d.variant === 'wasp' ? 0.35 : 0;
    const len = d.variant === 'scorpion' ? 0.75 : big ? 1.25 : 1.4;
    ell(ab, BM, [0, 0, -V.abdR * len * 0.85], [V.abdR, V.abdR * (big ? 0.85 : 0.7), V.abdR * len]);
    if (V.striped || f.striped) for (let i = 0; i < 3; i++) add(ab, U.torus(0.18, 6, 18), mat(pal.stripe || '#e0b020', { r: 0.5 }), [0, 0, -V.abdR * (0.45 + i * 0.5)], null, [V.abdR * (0.98 - i * 0.12), V.abdR * (0.72 - i * 0.08), V.abdR * 0.5]);
    if (big && f.markings !== false) ell(ab, AM, [0, V.abdR * 0.72, -V.abdR * 1.0], [V.abdR * 0.35, V.abdR * 0.15, V.abdR * 0.5]);
    if (V.elytra) { [1, -1].forEach(s => add(ab, U.sphere(14, 8, 0, PI), mat(pal.shell || shade(bodyC, 1.1), { r: 0.25, m: 0.4 }), [s * V.abdR * 0.45, V.abdR * 0.12, -V.abdR * 1.1], [0, 0, 0], [V.abdR * 0.6, V.abdR * 0.75, V.abdR * 1.25])); }
    if (V.stinger && d.variant !== 'scorpion') spike(ab, fig.M.claw, [0, -V.abdR * 0.2, -V.abdR * len * 1.6], [0, -V.abdR * 0.4, -V.abdR * len * 2.1], V.abdR * 0.25);
    fig.abd = ab;
  }
  // head
  const head = fig.bone('head', body, 0, 0, V.bodyR * (V.flat ? 0.9 : 0.95)); fig.anchors = { chest: body, head, mouth: head };
  const hm = BM, eyeM = f.glowEyes ? MT.glowEye(pal.eye || '#ff3020') : mat(pal.eye || '#100808', { r: 0.1, m: 0.3 });
  if (V.head === 'spider') {
    ell(head, hm, [0, 0.01, 0.03], [V.bodyR * 0.55, V.bodyR * 0.45, V.bodyR * 0.5]);
    for (let i = 0; i < 4; i++) ell(head, eyeM, [(i - 1.5) * V.bodyR * 0.18, V.bodyR * 0.3, V.bodyR * 0.45], V.bodyR * (i === 1 || i === 2 ? 0.1 : 0.07));
    [1, -1].forEach(s => { const fb = fig.bone('fang' + (s > 0 ? 'L' : 'R'), head, s * V.bodyR * 0.15, -V.bodyR * 0.1, V.bodyR * 0.45); add(fb, U.limb(V.bodyR * 0.12, V.bodyR * 0.08, V.bodyR * 0.3), BM, null, [0.4, 0, 0]); spike(fb, fig.M.claw, [0, -V.bodyR * 0.28, V.bodyR * 0.1], [0, -V.bodyR * 0.45, -V.bodyR * 0.05], V.bodyR * 0.06); });
  } else if (V.head === 'ant' || V.head === 'beetle' || V.head === 'mantis' || V.head === 'scorpion') {
    const hr = V.head === 'mantis' ? V.bodyR * 1.2 : V.head === 'scorpion' ? V.bodyR * 0.5 : V.bodyR * 1.0;
    if (V.head === 'mantis') { head.position.set(0, V.bodyR * 3.2, V.bodyR * 1.6); add(head, U.cone(3), hm, [0, 0, 0], [PI, 0, 0], [hr, hr * 0.9, hr * 0.5]); }
    else ell(head, hm, [0, 0.0, hr * 0.6], [hr * 0.9, hr * 0.75, hr * 0.85]);
    [1, -1].forEach(s => ell(head, eyeM, [s * hr * 0.6, hr * 0.25, hr * 0.85], hr * 0.28));
    if (V.head !== 'scorpion') [1, -1].forEach(s => horn(head, MT.dark(), [[s * hr * 0.3, hr * 0.5, hr * 1.0], [s * hr * 0.9, hr * 1.6, hr * 1.6], [s * hr * 1.5, hr * 2.0, hr * 1.4]], hr * 0.08));
    [1, -1].forEach(s => { const mb = fig.bone('mand' + (s > 0 ? 'L' : 'R'), head, s * hr * 0.35, -hr * 0.25, hr * 1.2); const big = f.stag; horn(mb, fig.M.claw, [[0, 0, 0], [s * hr * (big ? 0.6 : 0.3), 0, hr * (big ? 1.4 : 0.6)], [-s * hr * (big ? 0.1 : 0.15), 0, hr * (big ? 2.4 : 1.0)]], hr * (big ? 0.18 : 0.12)); });
    if (f.horn) spike(head, fig.M.claw, [0, hr * 0.5, hr * 1.0], [0, hr * 1.6, hr * 1.9], hr * 0.2);
  }
  // legs
  const n = V.pairs;
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0.5; const yaw = lerp(0.85, -0.9, t);
    ['L', 'R'].forEach(s => arthLeg(fig, body, i, s, yaw, V, BM));
  }
  // pincers
  if (V.pincers) ['L', 'R'].forEach(s => {
    const sg = s === 'L' ? 1 : -1;
    const a = fig.bone('claw' + s, body, sg * V.bodyR * 0.8, 0, V.bodyR * 0.7); a.rotation.set(0, sg * 0.6, sg * 0.25);
    add(a, U.limb(V.legR * 1.8, V.legR * 1.4, 0.16, 0.1), BM, null, [-HP, 0, 0]);
    const b = fig.bone('claw' + s + '2', a, 0, 0, 0.16); b.rotation.set(0, -sg * 1.3, 0);
    add(b, U.limb(V.legR * 1.6, V.legR * 1.8, 0.13, 0.1), BM, null, [-HP, 0, 0]);
    const c = fig.bone('claw' + s + '3', b, 0, 0, 0.13); c.rotation.set(0, sg * 0.4, 0);
    const cs = d.variant === 'crab' ? 1.4 : 1.0;
    ell(c, BM, [0, 0, 0.05 * cs], [0.045 * cs, 0.03 * cs, 0.07 * cs]);
    horn(c, fig.M.claw, [[sg * 0.02, 0, 0.09 * cs], [sg * 0.025, 0, 0.15 * cs], [0, 0, 0.19 * cs]], 0.02 * cs);
    const fing = fig.bone('pinch' + s, c, -sg * 0.025, 0, 0.08 * cs); horn(fing, fig.M.claw, [[0, 0, 0], [-sg * 0.01, 0, 0.06 * cs], [sg * 0.012, 0, 0.1 * cs]], 0.016 * cs);
  });
  if (V.raptor) ['L', 'R'].forEach(s => {
    const sg = s === 'L' ? 1 : -1; const tb = fig.bone('rapt' + s, body, sg * V.bodyR * 0.6, V.bodyR * 2.2, V.bodyR * 1.3); tb.rotation.set(-0.3, 0, sg * 0.15);
    add(tb, U.limb(V.legR * 2.0, V.legR * 1.5, 0.22), BM, null, [-1.2, 0, 0]);
    const t2 = fig.bone('rapt' + s + '2', tb, 0, 0.22 * Math.cos(1.2) * -1 + 0.08, 0.2); t2.rotation.set(2.4, 0, 0);
    add(t2, U.limb(V.legR * 1.5, V.legR, 0.2), BM); for (let i = 0; i < 4; i++) spike(t2, fig.M.claw, [0, -0.04 - i * 0.04, 0.01], [0, -0.04 - i * 0.04, 0.04], 0.006);
  });
  if (V.raptor) { const th = fig.bone('thorax', body, 0, V.bodyR * 0.5, V.bodyR * 0.6); add(th, U.limb(V.bodyR * 0.7, V.bodyR * 0.6, V.bodyR * 3.0), BM, [0, 0, 0], [PI - 0.5, 0, 0]); }
  if (V.wings || f.wings) { const wm = mat(pal.wing || '#d8f0ff', { r: 0.1, op: 0.38, ds: true, e: '#a0c0ff', ei: 0.2 }); addWings(fig, body, { type: 'insect', span: V.bodyR * 4.5, chord: V.bodyR * 1.6, x: 0.02, y: V.bodyR * 0.7, z: -V.bodyR * 0.2, m: wm }); fig.flapRate = 40; }
  if (V.stinger && d.variant === 'scorpion') {
    let p = fig.abd || body; fig.tail = [];
    for (let i = 0; i < 6; i++) { const b = fig.bone('tail' + i, p, 0, i === 0 ? 0.02 : 0, i === 0 ? -V.abdR * 1.4 : -0.075); b.rotation.x = i === 0 ? 0.9 : 0.42; ell(b, BM, [0, 0, -0.04], [0.045 - i * 0.004, 0.04 - i * 0.004, 0.05]); fig.tail.push(b); p = b; }
    ell(p, AM, [0, 0, -0.1], [0.04, 0.04, 0.05]); spike(p, fig.M.claw, [0, -0.01, -0.13], [0, -0.07, -0.18], 0.015);
  }
  fig.stance = {};
  fig.hoverH = 0.5;
  // ground fit: lowest leg tip touches y=0
  if (fig.legTips && fig.legTips.length) { fig.group.updateMatrixWorld(true); let mn = 1e9; fig.legTips.forEach(t => { mn = Math.min(mn, t.getWorldPosition(_v1).y / fig.S); }); body.position.y -= mn - 0.01; fig.V.H = body.position.y; }
  const gm = fig.perMat(mat('#8fd0ff', { basic: true, add: true, op: 0.9 })); fig.glowMat = gm; const go = keep(add(head, U.sphere(8, 6), gm, [0, 0, V.bodyR * 0.7], null, 0.001)); go.visible = false; fig.glow.push(go);
}
function arthLeg(fig, body, i, s, yaw, V, BM) {
  const sg = s === 'L' ? 1 : -1;
  const c = fig.bone('leg' + i + s, body, sg * V.bodyR * 0.6, 0, V.bodyR * 0.25 * (1 - i)); c.rotation.set(0, sg > 0 ? yaw : PI - yaw, 0);
  const lift = V.lift != null ? V.lift : 0.6, L1 = V.legL * 0.45, L2 = V.legL * 0.65;
  const fem = fig.bone('leg' + i + s + 'a', c, 0, 0, 0); fem.rotation.set(0, 0, lift);
  add(fem, U.limb(V.legR * 1.3, V.legR, L1, 0.1), BM, null, [0, 0, HP]);
  const tib = fig.bone('leg' + i + s + 'b', fem, L1, 0, 0); tib.rotation.set(0, 0, -lift - (V.knee != null ? V.knee : 1.1));
  const tip = new THREE.Object3D(); tip.position.set(L2, 0, 0); tib.add(tip); (fig.legTips = fig.legTips || []).push(tip);
  add(tib, U.limb(V.legR, V.legR * 0.5, L2, 0), BM, null, [0, 0, HP]);
  if (fig.desc.f.hairy) for (let k = 0; k < 3; k++) spike(tib, BM, [L2 * (0.2 + k * 0.25), V.legR, 0], [L2 * (0.2 + k * 0.25) + 0.01, V.legR * 3, 0], V.legR * 0.4);
  fig.legs.push({ c: c.name, a: fem.name, b: tib.name, i, sg, s });
}
function buildCentipede(fig, V, BM, AM) {
  const n = V.segs; let p = fig.J.body; fig.segs = [];
  for (let i = 0; i < n; i++) {
    const b = fig.bone('seg' + i, p, 0, 0, i === 0 ? 0.35 : -0.09);
    ell(b, i % 2 ? BM : AM, [0, 0, -0.045], [V.bodyR * (i === 0 ? 1.1 : 1), V.bodyR * 0.65, 0.06]);
    ['L', 'R'].forEach(s => { const sg = s === 'L' ? 1 : -1; const l = fig.bone('cl' + i + s, b, sg * V.bodyR * 0.8, 0, -0.045); l.rotation.set(0, 0, sg * -0.9); add(l, U.limb(V.legR, V.legR * 0.6, V.legL), BM); fig.legs.push({ c: l.name, i, sg, s, cent: 1 }); });
    fig.segs.push(b); p = b;
  }
  const head = fig.bone('head', fig.segs[0], 0, 0, 0.02); ell(head, BM, [0, 0, 0.04], [V.bodyR * 1.1, V.bodyR * 0.7, 0.06]);
  [1, -1].forEach(s => { horn(head, fig.M.claw, [[s * 0.03, -0.01, 0.07], [s * 0.06, -0.01, 0.12], [s * 0.01, -0.01, 0.16]], 0.012); horn(head, MT.dark(), [[s * 0.02, 0.02, 0.07], [s * 0.08, 0.08, 0.15], [s * 0.14, 0.1, 0.16]], 0.005); });
  fig.anchors = { head, mouth: head, chest: fig.segs[1] };
  fig.stance = {}; fig.tail = null;
  const gm = fig.perMat(mat('#8fd0ff', { basic: true, add: true, op: 0.9 })); fig.glowMat = gm; const go = keep(add(head, U.sphere(8, 6), gm, [0, 0, 0.1], null, 0.001)); go.visible = false; fig.glow.push(go);
}
function arthBase(fig, dt, w) {
  const t = fig.t + fig.ph, V = fig.V, mw = fig.moveW * w, spd = fig.speed || 4;
  if (fig.moveW > 0.01) fig.phase += dt * spd / (0.35 * fig.S) * TAU;
  const p = fig.phase;
  fig.mov('body', 0, 0.006 * Math.sin(t * 1.4) * w, 0);
  if (fig.abd) fig.rot('abd', 0.03 * Math.sin(t * 1.2) * w, 0.02 * Math.sin(t * 0.7) * w, 0);
  (fig.legs || []).forEach(l => {
    if (l.cent) { const ph = p * 1.5 - l.i * 0.9 + (l.s === 'L' ? 0 : PI); fig.rot(l.c, 0, 0.5 * Math.sin(ph) * (mw + 0.08) * l.sg, 0.25 * Math.max(0, Math.cos(ph)) * mw * -l.sg); return; }
    const grpA = (l.i + (l.s === 'L' ? 0 : 1)) % 2 === 0; const ph = p + (grpA ? 0 : PI);
    fig.rot(l.c, 0, 0.32 * Math.sin(ph) * mw, 0);
    fig.rot(l.a, 0, 0, 0.35 * Math.max(0, Math.cos(ph)) * mw + 0.02 * Math.sin(t * 2 + l.i) * w);
  });
  if (fig.segs) fig.segs.forEach((b, i) => { if (i) fig.rot(b.name, 0, (0.08 + 0.25 * mw) * Math.sin(t * (1 + 5 * mw) - i * 0.7), 0); });
  if (fig.tail) fig.tail.forEach((b, i) => fig.rot(b.name, 0.04 * Math.sin(t * 1.5 - i * 0.4) * w, 0.03 * Math.sin(t - i), 0));
  ['L', 'R'].forEach(s => { fig.rot('claw' + s, 0, 0.05 * Math.sin(t * 1.1 + (s === 'L' ? 0 : 1)) * w, 0); fig.rot('pinch' + s, 0, (s === 'L' ? -1 : 1) * 0.15 * Math.max(0, Math.sin(t * 1.7 + (s === 'L' ? 0 : 2))) * w, 0); fig.rot('mand' + s, 0, (s === 'L' ? 1 : -1) * 0.12 * Math.max(0, Math.sin(t * 2.1)) * w, 0); });
  if (fig.flyW > 0.001) fig.mov('root', 0, (0.45 + 0.04 * Math.sin(t * 3)) * fig.flyW * w, 0);
  if (fig.wings) wingMotion(fig, t, w);
}
function arthLie(fig, p) {
  const o = { body: [0, 0, 0, 0, -fig.V.H * 0.6, 0] };
  (fig.legs || []).forEach(l => { if (l.cent) { o[l.c] = [0, 0, p === 'dead' ? l.sg * 1.2 : 0]; return; } o[l.a] = [0, 0, p === 'dead' ? 0.9 : -0.55]; o[l.b] = [0, 0, p === 'dead' ? -1.4 : 0.7]; });
  if (p === 'dead' && !fig.segs) { o.root = [0, 0, PI, 0, fig.V.H * 1.0, 0]; o.body = [0, 0, 0, 0, -fig.V.H * 0.6, 0]; }
  return o;
}
const ARTH_CLIPS = {
  melee(fig, o) {
    let st = o.style || fig.desc.melee || 'bite';
    if (st === 'claw' && !fig.J.clawL && !fig.J.raptL) st = 'bite';
    if (st === 'sting' && !fig.tail && !(fig.V.stinger)) st = 'bite';
    const L = 0.12;
    if (st === 'claw') {
      const wind = { body: [-0.15, 0, 0, 0, 0.02, -0.03], clawL: [0, -0.5, 0.4], clawR: [0, 0.5, -0.4], clawL2: [0, 0.4, 0], clawR2: [0, -0.4, 0], pinchL: [0, -0.5, 0], pinchR: [0, 0.5, 0], raptL: [-0.9, 0, 0], raptR: [-0.9, 0, 0], raptL2: [-0.8, 0, 0], raptR2: [-0.8, 0, 0] };
      const hit = { body: [0.08, 0, 0, 0, 0, L], clawL: [0, 0.35, 0], clawR: [0, -0.35, 0], clawL2: [0, 0.6, 0], clawR2: [0, -0.6, 0], pinchL: [0, 0.2, 0], pinchR: [0, -0.2, 0], raptL: [0.6, 0, 0], raptR: [0.6, 0, 0], raptL2: [0.6, 0, 0], raptR2: [0.6, 0, 0] };
      return { keys: [[0, 'S'], [0.22, wind, 'out'], [0.35, hit, 'snap'], [0.48, hit, 'lin'], [0.8, 'S', 'io']], impact: 0.35 };
    }
    if (st === 'sting') {
      const arc = { body: [-0.1, 0, 0] }, hit = { body: [0.12, 0, 0, 0, 0, L] };
      (fig.tail || []).forEach((b, i) => { arc[b.name] = [0.25, 0, 0]; hit[b.name] = [0.45, 0, 0]; });
      if (!fig.tail && fig.abd) { arc.abd = [-0.5, 0, 0]; hit.abd = [1.2, 0, 0]; }
      return { keys: [[0, 'S'], [0.3, arc, 'out'], [0.44, hit, 'snap'], [0.56, hit, 'lin'], [0.9, 'S', 'io']], impact: 0.44 };
    }
    const wind = { body: [-0.2, 0, 0, 0, 0.03, -0.04], fangL: [-0.5, 0, 0], fangR: [-0.5, 0, 0], mandL: [0, 0.5, 0], mandR: [0, -0.5, 0] };
    const hit = { body: [0.15, 0, 0, 0, -0.01, L + 0.05], fangL: [0.5, 0, 0], fangR: [0.5, 0, 0], mandL: [0, -0.2, 0], mandR: [0, 0.2, 0] };
    if (fig.segs) { wind.seg0 = [-0.4, 0, 0]; hit.seg0 = [0.2, 0, 0]; }
    (fig.legs || []).forEach(l => { if (!l.cent && l.i === 0) { wind[l.a] = [0, 0, 0.7]; hit[l.a] = [0, 0, 0.2]; } });
    return { keys: [[0, 'S'], [0.2, wind, 'out'], [0.32, hit, 'snap'], [0.44, hit, 'lin'], [0.75, 'S', 'io']], impact: 0.32 };
  },
  ranged(fig, o) { const K = ARTH_CLIPS.melee(fig, { style: o.style === 'sting' || o.style === 'spike' ? 'sting' : 'bite' }); K.keys.forEach(k => { if (typeof k[1] === 'object' && k[1].body) { k[1] = Object.assign({}, k[1]); k[1].body = [k[1].body[0], 0, 0, 0, 0, 0]; } }); return K; },
  hit(fig, o) { const k = o.heavy ? 1.8 : 1; return { mode: 'add', keys: [[0, {}], [0.07, { body: [-0.2 * k, 0.1, 0.1 * k, 0, 0.02, -0.06 * k] }, 'out'], [0.4, {}, 'io']], impact: 0.05 }; },
  dodge(fig, o) { const sd = Math.random() < 0.5 ? 1 : -1; return { mode: 'add', keys: [[0, {}], [0.14, { root: [0, 0.3 * sd, 0, 0.3 * sd, 0.03, 0] }, 'out'], [0.3, { root: [0, 0.3 * sd, 0, 0.3 * sd, 0, 0] }, 'lin'], [0.55, {}, 'io']], impact: 0.12 }; },
  block(fig, o) { const p = { body: [-0.3, 0, 0, 0, 0.02, -0.06], clawL: [0, 0.6, 0.3], clawR: [0, -0.6, -0.3] }; return { keys: [[0, 'S'], [0.15, p, 'snap'], [0.45, p, 'lin'], [0.7, 'S', 'io']], impact: 0.15 }; },
  cast(fig, o) { const color = o.color || '#a0ff80'; const p = { body: [-0.35, 0, 0, 0, 0.04, 0] }; return { keys: [[0, 'S'], [0.5, p, 'io'], [0.7, { body: [0.1, 0, 0, 0, 0, 0.05] }, 'snap'], [1.1, 'S', 'io']], impact: 0.7, color, fn: glowFn(0.05, 0.55, 0.72, 1.05), onEnd: f => setGlow(f, 0, null, 'both') }; },
  die(fig, o) { const dead = arthLie(fig, 'dead'); const mid = Object.assign({}, dead, { root: [0, 0, dead.root ? 1.5 : 0, 0, fig.V.H * 1.4, 0] }); return { keys: [[0, 'S'], [0.15, { body: [-0.4, 0, 0.2, 0, 0.05, -0.05] }, 'out'], [0.55, mid, 'io'], [0.9, dead, 'in2'], [1.1, dead, 'io']], impact: 0.1, fadeOut: 0, onEnd: f => f.setPose('dead', true) }; },
  cheer(fig, o) { const p = { body: [-0.4, 0, 0, 0, 0.04, 0] }; (fig.legs || []).forEach(l => { if (!l.cent && l.i === 0) p[l.a] = [0, 0, 1.0]; }); p.clawL = [0, 0, 0.8]; p.clawR = [0, 0, -0.8]; return { keys: [[0, 'S'], [0.35, p, 'out'], [0.8, p, 'lin'], [1.1, 'S', 'io']], impact: 0.35 }; },
  stand(fig, o) { const top = fig.lie.filter(L => L.target > 0).pop(); return { keys: [[0, 'L'], [0.6, 'S', 'io']], impact: 0.3, fadeIn: 0, startPose: top && top.pose || arthLie(fig, 'prone'), onStart: f => f.setPose('stand', true) }; }
};
ARTH_CLIPS.breath = ARTH_CLIPS.cast; ARTH_CLIPS.idleFlourish = ARTH_CLIPS.cheer;
FAM.arth = { base: arthBase, lie: arthLie, clips: ARTH_CLIPS };
['spider', 'scorpion', 'crab', 'insect', 'centipede'].forEach(p => { PLANS[p] = { fam: 'arth', build: fig => { const d = fig.desc; if (p !== 'insect') d.variant = p === 'centipede' ? 'centipede' : (d.variant && ARTHV[d.variant] ? d.variant : p); else d.variant = d.variant || 'ant'; buildArth(fig); } }; });

/* ============================================================ SERPENTS, WORMS, FISH, OCTOPUS */
function buildSerpent(fig) {
  const d = fig.desc, f = d.f || (d.f = {}), pal = d.palette || (d.palette = {}), plan = d.plan;
  const bodyC = pal.body = pal.body || '#4a6a30';
  const BM = f.cover === 'emis' ? MT.emis(bodyC, 1.3) : f.cover === 'skin' ? MT.skin(bodyC) : f.cover === 'stone' ? MT.stone(bodyC) : f.cover === 'glass' ? MT.glass(bodyC, 0.6) : MT.scales(bodyC);
  const bel = f.cover === 'emis' ? MT.emis(pal.belly || shade(bodyC, 1.3), 1.6) : f.cover === 'glass' ? BM : MT.skin(pal.belly || shade(bodyC, 1.45));
  fig.M = { body: BM, belly: bel, horn: MT.horn(pal.horn || '#2e2620'), claw: MT.horn('#2a2420') };
  fig.anchors = {};
  const worm = plan === 'worm', fish = plan === 'fish';
  const n = worm ? 7 : fish ? 4 : (f.segments || 10);
  const R = f.thick || (worm ? 0.2 : fish ? 0.13 : 0.07), segL = f.segL || (worm ? 0.22 : fish ? 0.16 : 0.13);
  fig.V = { R, segL, n, H: fish ? 0.45 : R };
  let p = fig.bone('base', fig.root, 0, worm ? 0 : fish ? 0.42 : R * 0.9, worm ? -0.1 : fish ? 0.25 : 0.45);
  if (worm) { const mound = add(p, U.lathe('mound', [[0.001, 0.08], [0.25, 0.06], [0.42, 0.0]], 14), MT.stone(pal.ground || '#6a5a48'), [0, 0, 0], null, [1.4, 1, 1.4]); mound.receiveShadow = true; }
  fig.segs = [];
  for (let i = 0; i < n; i++) {
    const b = fig.bone('seg' + i, p, 0, 0, i === 0 ? 0 : (worm ? 0 : -segL));
    if (worm) { b.position.set(0, i === 0 ? 0 : segL, 0); b.rotation.x = i === 0 ? 0 : (i < 3 ? 0.08 : 0.14); }
    else if (!fish) b.rotation.y = i === 0 ? 0 : (i % 2 ? 0.62 : -0.66) * (i > 1 ? 1 : 0.5);
    const t = i / (n - 1), rr = R * (fish ? (1 - Math.pow(Math.abs(t - 0.3) * 1.3, 2) * 0.75) : worm ? (1 - t * 0.15) : (1 - Math.pow(t, 1.5) * 0.8));
    if (worm) { add(b, U.limb(rr, rr * 0.96, segL * 1.1, 0.04), BM, [0, segL, 0], [PI, 0, 0]); add(b, U.torus(0.12, 6, 16), BM, [0, segL * 0.05, 0], [HP, 0, 0], rr * 1.02); }
    else { add(b, U.limb(rr, rr * 0.92, segL * 1.12, 0.05), BM, null, [HP, 0, 0], [1, 1, fish ? 0.9 : 1]); if (!fish) add(b, U.limb(rr * 0.85, rr * 0.8, segL * 1.1, 0), bel, [0, -rr * 0.3, 0], [HP, 0, 0], [1, 1, 0.8]); }
    if (f.spikes && !fish) spike(b, fig.M.horn, [0, rr * 0.85, -segL * 0.5], [0, rr * 1.5, -segL * 0.7], rr * 0.25);
    if (f.fins && !fish && i % 3 === 1) [1, -1].forEach(s => add(b, U.shape('sfin', [[0, 0], [0.1, 0.05], [0.12, -0.08], [0.0, -0.06]], 0.008, 0.002), MT.membrane(pal.fin || '#3a8a8a'), [s * rr, 0, -segL * 0.5], [0, s > 0 ? 0 : PI, 0]));
    fig.segs.push(b); p = b;
  }
  if (fish) {
    const last = fig.segs[n - 1];
    add(last, U.shape('tailfin2', [[0, 0], [0.05, -0.08], [0.12, -0.22], [0.0, -0.13], [-0.12, -0.22], [-0.05, -0.08]], 0.01, 0.003), MT.membrane(pal.fin || shade(bodyC, 0.85)), [0, 0, -segL], [HP, 0, f.flukes ? HP : 0], [1.5 * R / 0.13, 1.6 * R / 0.13, 1]);
    add(fig.segs[1], U.shape('dorsal', [[0, 0], [0.05, 0.16], [0.16, 0]], 0.012, 0.004), MT.membrane(pal.fin || shade(bodyC, 0.85)), [0, R * 0.85, 0.02], [0, HP, 0], (f.bigFin ? 1.6 : 0.9) * R / 0.13);
    [1, -1].forEach(s => add(fig.segs[0], U.shape('pect', [[0, 0], [0.12, -0.04], [0.14, -0.1], [0.02, -0.05]], 0.008, 0.002), MT.membrane(pal.fin || shade(bodyC, 0.85)), [s * R * 0.8, -R * 0.4, -0.02], [0, s > 0 ? -0.3 : PI + 0.3, -0.4 * s], R / 0.13));
    if (f.stripes) fig.segs.forEach((b, i) => { if (i < n - 1) ell(b, MT.skin(pal.belly || '#f0f0f0'), [0, -R * 0.35, -segL * 0.4], [R * 0.75, R * 0.5, segL * 0.6]); });
  }
  // head
  const hb = fig.bone('head', fish ? fig.segs[0] : worm ? fig.segs[n - 1] : fig.segs[0], 0, worm ? segL * 1.1 : 0, fish ? 0.02 : worm ? 0 : segL * 0.3);
  fig.anchors.head = hb; fig.anchors.chest = fig.segs[Math.min(2, n - 1)];
  if (worm) {
    hb.rotation.x = -HP * 0.85;
    add(hb, U.lathe('wormmaw', [[R * 1.05, 0], [R * 1.2, 0.06], [R * 1.1, 0.1], [R * 0.7, 0.08], [R * 0.4, 0.02]], 16), BM, [0, 0, 0], [HP, 0, 0]);
    add(hb, U.cyl(16), MT.dark(), [0, 0, 0.03], [HP, 0, 0], [R * 0.75, 0.02, R * 0.75]);
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; spike(hb, MT.teeth(), [Math.sin(a) * R * 0.95, Math.cos(a) * R * 0.95, 0.08], [Math.sin(a) * R * 0.55, Math.cos(a) * R * 0.55, 0.06], R * 0.09); }
    if (f.cover === 'emis' || f.magma) for (let i = 0; i < n; i++) add(fig.segs[i], U.torus(0.08, 5, 16), MT.emis('#ff6a1a', 2), [0, segL * 0.5, 0], [HP, 0, 0], R * 1.0);
    const m = new THREE.Object3D(); m.position.set(0, 0, 0.1); hb.add(m); fig.anchors.mouth = m;
  } else if (fish) {
    const sk = BM; const hs = R / 0.13;
    ell(hb, sk, [0, 0, 0.08 * hs], [R * 0.9, R * 0.85, R * 1.2]);
    if (f.snout) ell(hb, sk, [0, -R * 0.15, 0.2 * hs], [R * 0.35, R * 0.3, R * 0.8]);
    [1, -1].forEach(s => ell(hb, MT.eye(pal.eye || '#101010'), [s * R * 0.7, R * 0.2, 0.12 * hs], R * 0.12));
    const j = fig.bone('jaw', hb, 0, -R * 0.35, 0.05 * hs); ell(j, MT.skin(pal.belly || shade(bodyC, 1.4)), [0, 0, 0.07 * hs], [R * 0.7, R * 0.2, R * 1.0]);
    if (f.teeth) for (let i = 0; i < 5; i++) [1, -1].forEach(s => spike(j, MT.teeth(), [s * R * 0.5 * (1 - i * 0.12), 0.0, (0.04 + i * 0.03) * hs], [s * R * 0.5 * (1 - i * 0.12), R * 0.2, (0.04 + i * 0.03) * hs], 0.008 * hs));
    hb.userData.jaw = 'jaw'; const m = new THREE.Object3D(); m.position.set(0, -R * 0.2, 0.22 * hs); hb.add(m); fig.anchors.mouth = m;
  } else {
    // snake / sea serpent: neck rising, head forward
    hb.position.set(0, 0, segL * 0.2);
    const nk1 = fig.bone('neck0', fig.segs[0], 0, 0, segL * 0.2); nk1.rotation.x = -0.75; add(nk1, U.limb(R * 0.95, R * 0.85, segL * 1.4, 0.05), BM, null, [-HP, 0, 0]);
    const nk2 = fig.bone('neck1', nk1, 0, 0, segL * 1.4); nk2.rotation.x = -0.25; add(nk2, U.limb(R * 0.85, R * 0.8, segL * 1.3, 0.05), BM, null, [-HP, 0, 0]);
    nk2.add(hb); hb.position.set(0, 0, segL * 1.3); hb.rotation.x = 0.95;
    const hs = R / 0.07;
    ell(hb, BM, [0, 0.0, 0.04 * hs], [R * 1.25, R * 0.75, R * 1.5]);
    if (f.hood) [1, -1].forEach(s => add(nk2, U.sphere(10, 8), BM, [s * R * 1.1, 0, segL * 0.6], [0, s * 0.3, 0], [R * 1.1, R * 0.25, R * 1.8]));
    if (f.horns) [1, -1].forEach(s => horn(hb, fig.M.horn, [[s * R * 0.6, R * 0.5, 0], [s * R * 1.2, R * 1.2, -R * 0.8], [s * R * 1.3, R * 1.8, -R * 1.8]], R * 0.25));
    if (f.crest) for (let i = 0; i < 4; i++) spike(hb, MT.membrane(pal.fin || '#c04020'), [0, R * 0.6, -i * R * 0.5], [0, R * 1.6, -i * R * 0.5 - R * 0.5], R * 0.25);
    [1, -1].forEach(s => ell(hb, f.glowEyes ? MT.glowEye(pal.eye || '#f0c020') : MT.eye(pal.eye || '#d0a020'), [s * R * 0.7, R * 0.35, 0.06 * hs], R * 0.2));
    const j = fig.bone('jaw', hb, 0, -R * 0.3, 0.0); ell(j, bel, [0, -R * 0.1, 0.05 * hs], [R * 1.0, R * 0.25, R * 1.25]);
    [1, -1].forEach(s => spike(hb, MT.teeth(), [s * R * 0.35, -R * 0.3, 0.09 * hs], [s * R * 0.35, -R * 0.75, 0.09 * hs], R * 0.08));
    hb.userData.jaw = 'jaw'; const m = new THREE.Object3D(); m.position.set(0, -R * 0.2, 0.12 * hs); hb.add(m); fig.anchors.mouth = m;
    if (f.legsSmall) { [0, 4].forEach(i => ['L', 'R'].forEach(s => { const sg = s === 'L' ? 1 : -1; const l = fig.bone('sl' + i + s, fig.segs[i], sg * R * 0.8, -R * 0.2, -segL * 0.5); l.rotation.set(0.3, 0, sg * 0.9); add(l, U.limb(R * 0.4, R * 0.3, R * 2.5), BM); })); }
  }
  fig.stance = {}; fig.hoverH = 0.4;
  if (f.wings && !worm && !fish) { addWings(fig, fig.segs[1], { type: f.wings, span: R * 9, chord: R * 5, x: R * 0.5, y: R * 0.6, z: 0, m: f.wings === 'feather' ? MT.featherDS(pal.wing || '#3ac0a0') : mat(pal.wing || '#c0e0ff', { r: 0.1, op: 0.42, ds: true }) }); fig.hoverH = 0.6; if (f.wings === 'insect') fig.flapRate = 30; }
  const gm = fig.perMat(mat('#8fd0ff', { basic: true, add: true, op: 0.9 })); fig.glowMat = gm; const go = keep(add(fig.anchors.mouth, U.sphere(8, 6), gm, [0, 0, 0], null, 0.001)); go.visible = false; fig.glow.push(go);
  fig.serp = plan;
}
function serBase(fig, dt, w) {
  const t = fig.t + fig.ph, mw = fig.moveW * w, spd = fig.speed || 4, n = fig.segs.length;
  if (fig.moveW > 0.01) fig.phase += dt * spd / (0.8 * fig.S) * TAU;
  if (fig.serp === 'worm') {
    fig.segs.forEach((b, i) => { if (i) fig.rot(b.name, 0.06 * Math.sin(t * 1.1 - i * 0.5) * w, 0, 0.08 * Math.sin(t * 0.8 - i * 0.6) * w); });
    fig.rot('head', 0.1 * Math.sin(t * 1.3) * w, 0, 0); fig.rot('jaw', 0, 0, 0);
    return;
  }
  const fish = fig.serp === 'fish';
  if (fig.flyW > 0.001) fig.mov('root', 0, ((fig.hoverH || 0.5) + 0.05 * Math.sin(t * 2)) * fig.flyW * w, 0);
  if (fig.wings) wingMotion(fig, t, w);
  const amp = fish ? 0.12 + 0.2 * mw : 0.06 + 0.32 * mw, sp = fish ? 3 + 5 * mw : 1.0 + 7 * mw, k = fish ? 1.0 : 0.85;
  fig.segs.forEach((b, i) => { if (i) fig.rot(b.name, 0, amp * Math.sin(t * sp + fig.phase * 0.0 - i * k) * (fish ? i / n + 0.3 : 1), 0); });
  if (fish) { fig.mov('base', 0, 0.04 * Math.sin(t * 1.3) * w, 0); fig.rot('base', 0.04 * Math.sin(t * 1.1) * w, 0, 0.04 * Math.sin(t * 0.9) * w); fig.rot('jaw', 0.08 * Math.max(0, Math.sin(t * 1.7)) * w, 0, 0); }
  else { fig.rot('neck0', 0.05 * Math.sin(t * 0.9) * w, 0.15 * Math.sin(t * 0.5) * w, 0); fig.rot('neck1', 0.04 * Math.sin(t * 1.3) * w, -0.1 * Math.sin(t * 0.5) * w, 0); fig.rot('head', 0, 0, 0); }
}
function serLie(fig, p) {
  if (fig.serp === 'worm') { const o = {}; fig.segs.forEach((b, i) => { o[b.name] = [i === 0 ? 1.2 : 0.25, 0, 0]; }); o.head = [0.5, 0, 0]; if (p === 'dead') o.jaw = [0.5, 0, 0]; return o; }
  if (fig.serp === 'fish') return { base: [0, 0, p === 'prone' ? 0 : HP, 0, -0.42 + fig.V.R * (p === 'prone' ? 1 : 0.6), 0], jaw: [p === 'dead' ? 0.4 : 0, 0, 0] };
  return { neck0: [0.7, 0, 0], neck1: [0.25, 0, 0], head: [-0.7, 0.5, 0], jaw: [p === 'dead' ? 0.5 : 0, 0, 0], base: [0, 0, p === 'dead' ? PI * 0.9 : 0, 0, p === 'dead' ? fig.V.R * 0.8 : 0, 0] };
}
const SER_CLIPS = {
  melee(fig, o) {
    const st = o.style || fig.desc.melee || 'bite';
    if (fig.serp === 'worm') {
      const wind = { seg2: [-0.25, 0, 0], seg3: [-0.25, 0, 0], seg4: [-0.2, 0, 0], head: [-0.3, 0, 0] };
      const hit = { seg1: [0.25, 0, 0], seg2: [0.35, 0, 0], seg3: [0.35, 0, 0], seg4: [0.3, 0, 0], seg5: [0.2, 0, 0], head: [0.3, 0, 0] };
      return { keys: [[0, 'S'], [0.3, wind, 'out'], [0.48, hit, 'snap'], [0.62, hit, 'lin'], [1.0, 'S', 'io']], impact: 0.48 };
    }
    if (fig.serp === 'fish' || st !== 'tail') {
      const wind = fig.serp === 'fish' ? { base: [-0.15, 0, 0, 0, 0.03, -0.1], jaw: [0.6, 0, 0] } : { neck0: [-0.45, 0, 0], neck1: [-0.2, 0, 0], head: [0.2, 0, 0], jaw: [0.9, 0, 0], seg0: [0, 0, 0, 0, 0, -0.04] };
      const hit = fig.serp === 'fish' ? { base: [0.1, 0, 0, 0, 0, 0.3], jaw: [0, 0, 0] } : { neck0: [0.55, 0, 0], neck1: [0.15, 0, 0], head: [-0.6, 0, 0], jaw: [0.05, 0, 0], seg0: [0, 0, 0, 0, 0, 0.12] };
      return { keys: [[0, 'S'], [0.22, wind, 'out'], [0.32, hit, 'snap'], [0.45, hit, 'lin'], [0.75, 'S', 'io']], impact: 0.32 };
    }
    const w1 = {}, h1 = {}; fig.segs.forEach((b, i) => { if (i) { w1[b.name] = [0, -0.25, 0]; h1[b.name] = [0, 0.4, 0]; } });
    return { keys: [[0, 'S'], [0.25, w1, 'out'], [0.42, h1, 'in'], [0.55, h1, 'lin'], [0.9, 'S', 'io']], impact: 0.42 };
  },
  ranged(fig, o) { return SER_CLIPS.melee(fig, { style: 'bite' }); },
  breath(fig, o) { const color = o.color || '#9fdcff'; const K = SER_CLIPS.melee(fig, { style: 'bite' }); K.keys[2][1] = Object.assign({}, K.keys[2][1], { jaw: [0.9, 0, 0] }); K.keys[3][1] = K.keys[2][1]; K.color = color; K.fn = (f, t) => setGlow(f, t < 0.3 ? t / 0.3 : Math.max(0, 1.4 - (t - 0.3) * 3), color, 'both'); K.onEnd = f => setGlow(f, 0, null, 'both'); return K; },
  hit(fig, o) { const k = o.heavy ? 1.8 : 1; return { mode: 'add', keys: [[0, {}], [0.08, { neck0: [-0.25 * k, 0.15, 0], head: [-0.2 * k, 0, 0.2], seg0: [0, 0.15 * k, 0, 0, 0, -0.05 * k], base: [-0.08 * k, 0, 0.1 * k], seg2: [-0.15 * k, 0, 0] }, 'out'], [0.45, {}, 'io']], impact: 0.05 }; },
  dodge(fig, o) { const sd = Math.random() < 0.5 ? 1 : -1; return { mode: 'add', keys: [[0, {}], [0.15, { root: [0, 0.25 * sd, 0, 0.3 * sd, 0, 0], seg2: [0, 0, 0.3 * sd] }, 'out'], [0.3, { root: [0, 0.25 * sd, 0, 0.3 * sd, 0, 0] }, 'lin'], [0.55, {}, 'io']], impact: 0.12 }; },
  block(fig, o) { const p = { neck0: [-0.5, 0, 0], head: [0.3, 0, 0], base: [-0.1, 0, 0, 0, 0, -0.08], seg3: [-0.3, 0, 0] }; return { keys: [[0, 'S'], [0.15, p, 'snap'], [0.45, p, 'lin'], [0.7, 'S', 'io']], impact: 0.15 }; },
  cast(fig, o) { const color = o.color || '#c8a0ff'; const up = { neck0: [-0.4, 0, 0], head: [-0.2, 0, 0], jaw: [0.4, 0, 0], seg3: [-0.3, 0, 0], base: [-0.1, 0, 0] }; return { keys: [[0, 'S'], [0.5, up, 'io'], [0.7, { neck0: [0.2, 0, 0], jaw: [0.5, 0, 0], seg2: [0.2, 0, 0] }, 'snap'], [1.1, 'S', 'io']], impact: 0.7, color, fn: glowFn(0.05, 0.55, 0.72, 1.05), onEnd: f => setGlow(f, 0, null, 'both') }; },
  die(fig, o) { const dead = serLie(fig, 'dead'); return { keys: [[0, 'S'], [0.15, { neck0: [-0.5, 0, 0], jaw: [0.6, 0, 0], seg3: [-0.4, 0, 0] }, 'out'], [0.9, dead, 'in2'], [1.1, dead, 'io']], impact: 0.1, fadeOut: 0, onEnd: f => f.setPose('dead', true) }; },
  cheer(fig, o) { const p = { neck0: [-0.6, 0, 0], neck1: [-0.3, 0, 0], head: [0.4, 0, 0], jaw: [0.9, 0, 0], seg3: [-0.5, 0, 0], seg4: [-0.3, 0, 0] }; return { keys: [[0, 'S'], [0.35, p, 'out'], [0.8, p, 'lin'], [1.1, 'S', 'io']], impact: 0.35 }; },
  stand(fig, o) { const top = fig.lie.filter(L => L.target > 0).pop(); return { keys: [[0, 'L'], [0.6, 'S', 'io']], impact: 0.3, fadeIn: 0, startPose: top && top.pose || serLie(fig, 'prone'), onStart: f => f.setPose('stand', true) }; }
};
SER_CLIPS.idleFlourish = SER_CLIPS.cheer;
FAM.ser = { base: serBase, lie: serLie, clips: SER_CLIPS };
PLANS.serpent = { fam: 'ser', build: buildSerpent };
PLANS.worm = { fam: 'ser', build: buildSerpent };
PLANS.fish = { fam: 'ser', build: buildSerpent };

function buildOctopus(fig) {
  const d = fig.desc, f = d.f || (d.f = {}), pal = d.palette || (d.palette = {});
  const bodyC = pal.body = pal.body || '#a0503a';
  const BM = f.cover === 'glass' ? MT.glass(bodyC, 0.6) : mat(bodyC, { r: 0.5, m: 0.05, bump: 'leather', bs: 0.006 }), SM = MT.skin(pal.belly || shade(bodyC, 1.4));
  fig.M = { body: BM };
  const body = fig.bone('body', fig.root, 0, 0.32, 0);
  const mantle = fig.bone('mantle', body, 0, 0.05, -0.02); mantle.rotation.x = -0.45;
  ell(mantle, BM, [0, 0.16, -0.02], [0.18, 0.24, 0.17]);
  ell(body, BM, [0, 0, 0.02], [0.17, 0.12, 0.16]);
  [1, -1].forEach(s => { ell(body, MT.eye('#f0e0a0'), [s * 0.12, 0.06, 0.1], 0.04); ell(body, MT.eye('#101010'), [s * 0.13, 0.06, 0.13], [0.012, 0.03, 0.012]); });
  if (f.beak !== false) spike(body, MT.horn('#2a2420'), [0, -0.08, 0.1], [0, -0.13, 0.15], 0.03);
  fig.arms = [];
  const N = f.tentacles || 8;
  for (let k = 0; k < N; k++) {
    const a = k / N * TAU + PI / N; const long = f.longArms && (k === 0 || k === N - 1);
    let p = fig.bone('arm' + k + '_0', body, Math.sin(a) * 0.12, -0.06, Math.cos(a) * 0.12); p.rotation.set(0, a, 0); p.rotation.order = 'YXZ';
    const sl = long ? 0.16 : 0.12, names = [p.name];
    p.rotation.x = 1.1;
    for (let i = 0; i < 4; i++) {
      const r1 = 0.05 * (1 - i * 0.2), r2 = 0.05 * (1 - (i + 1) * 0.2);
      add(p, U.limb(r1, Math.max(0.008, r2), sl, 0), BM, null, [HP, 0, 0]);
      if (i < 3) { const nb = fig.bone('arm' + k + '_' + (i + 1), p, 0, 0, -sl); nb.rotation.x = i === 0 ? 0.6 : -0.35; p = nb; names.push(nb.name); }
    }
    // our arms point along -Z of their bone; flip so they spread outward
    fig.J['arm' + k + '_0'].rotation.y = a + PI;
    fig.arms.push(names);
  }
  fig.anchors = { head: mantle, chest: body, mouth: body };
  fig.stance = {}; fig.V = { g: 0.15 };
  const gm = fig.perMat(mat('#8fd0ff', { basic: true, add: true, op: 0.9 })); fig.glowMat = gm; const go = keep(add(body, U.sphere(8, 6), gm, [0, 0, 0.15], null, 0.001)); go.visible = false; fig.glow.push(go);
}
function octBase(fig, dt, w) {
  const t = fig.t + fig.ph, mw = fig.moveW * w;
  if (fig.moveW > 0.01) fig.phase += dt * (fig.speed || 4) / (0.6 * fig.S) * TAU;
  fig.mov('body', 0, (0.02 * Math.sin(t * 1.2) + 0.03 * mw * Math.sin(fig.phase)) * w, 0);
  fig.rot('mantle', 0.05 * Math.sin(t * 0.9) * w, 0, 0.04 * Math.sin(t * 0.7) * w);
  (fig.arms || []).forEach((arm, k) => arm.forEach((nm, i) => fig.rot(nm, (0.12 + 0.2 * mw) * Math.sin(t * (1.3 + 3 * mw) + k * 0.8 - i * 0.7) * w, 0.08 * Math.sin(t * 0.9 + k) * w, 0)));
}
function octLie(fig, p) { const o = { body: [0, 0, 0, 0, -0.18, 0], mantle: [p === 'dead' ? 1.2 : 0.6, 0, 0] }; (fig.arms || []).forEach(a => a.forEach((nm, i) => { o[nm] = [i === 0 ? -0.6 : -0.1, 0, 0]; })); return o; }
function genericClips(opts) {
  // simple whole-body clips for blob-like plans: lunge, pulse
  const B = opts.bone || 'body';
  const C = {
    melee(fig, o) { const arm = fig.arms && fig.arms[0]; const wind = { [B]: [-0.2, 0, 0, 0, 0.05, -0.08] }, hit = { [B]: [0.2, 0, 0, 0, -0.02, 0.22] }; if (arm) arm.forEach((nm, i) => { wind[nm] = [i === 0 ? -1.0 : 0.3, 0, 0]; hit[nm] = [i === 0 ? 0.6 : -0.3, 0, 0]; }); if (fig.arms && fig.arms[fig.arms.length - 1]) fig.arms[fig.arms.length - 1].forEach((nm, i) => { wind[nm] = [i === 0 ? -0.9 : 0.3, 0, 0]; hit[nm] = [i === 0 ? 0.6 : -0.3, 0, 0]; }); return { keys: [[0, 'S'], [0.25, wind, 'out'], [0.38, hit, 'snap'], [0.5, hit, 'lin'], [0.85, 'S', 'io']], impact: 0.38 }; },
    ranged(fig, o) { return C.cast(fig, Object.assign({ color: '#c0ff80' }, o)); },
    cast(fig, o) { const color = o.color || fig.desc.palette.glow || '#c8a0ff'; return { keys: [[0, 'S'], [0.5, { [B]: [-0.15, 0, 0, 0, 0.08, 0] }, 'io'], [0.7, { [B]: [0.1, 0, 0, 0, 0, 0.08] }, 'snap'], [1.1, 'S', 'io']], impact: 0.7, color, fn: glowFn(0.05, 0.55, 0.72, 1.05), onEnd: f => setGlow(f, 0, null, 'both') }; },
    hit(fig, o) { const k = o.heavy ? 1.8 : 1; return { mode: 'add', keys: [[0, {}], [0.08, { [B]: [-0.15 * k, 0.1, 0.1 * k, 0, 0.03, -0.07 * k] }, 'out'], [0.45, {}, 'io']], impact: 0.05 }; },
    dodge(fig, o) { const sd = Math.random() < 0.5 ? 1 : -1; return { mode: 'add', keys: [[0, {}], [0.15, { root: [0, 0, 0.1 * sd, 0.3 * sd, 0, 0] }, 'out'], [0.3, { root: [0, 0, 0.1 * sd, 0.3 * sd, 0, 0] }, 'lin'], [0.55, {}, 'io']], impact: 0.12 }; },
    block(fig, o) { const p = { [B]: [-0.2, 0, 0, 0, -0.03, -0.06] }; return { keys: [[0, 'S'], [0.15, p, 'snap'], [0.45, p, 'lin'], [0.7, 'S', 'io']], impact: 0.15 }; },
    die(fig, o) { const dead = FAM[fig.fam].lie(fig, 'dead'); return { keys: [[0, 'S'], [0.15, { [B]: [-0.2, 0, 0.2, 0, 0.06, 0] }, 'out'], [0.9, dead, 'in2'], [1.1, dead, 'io']], impact: 0.1, fadeOut: 0, onEnd: f => f.setPose('dead', true) }; },
    cheer(fig, o) { const p = { [B]: [-0.2, 0, 0, 0, 0.1, 0] }; (fig.arms || []).forEach(a => { p[a[0]] = [-0.6, 0, 0]; }); return { keys: [[0, 'S'], [0.35, p, 'out'], [0.8, p, 'lin'], [1.1, 'S', 'io']], impact: 0.35 }; },
    stand(fig, o) { const top = fig.lie.filter(L => L.target > 0).pop(); return { keys: [[0, 'L'], [0.6, 'S', 'io']], impact: 0.3, fadeIn: 0, startPose: top && top.pose || {}, onStart: f => f.setPose('stand', true) }; }
  };
  return C;
}
FAM.oct = { base: octBase, lie: octLie, clips: Object.assign(genericClips({ bone: 'body' })) };
FAM.oct.clips.breath = FAM.oct.clips.cast; FAM.oct.clips.idleFlourish = FAM.oct.clips.cheer;
PLANS.octopus = { fam: 'oct', build: buildOctopus };

/* ============================================================ BLOBS: ooze, aberration, plant, swarm, wisp, hand, object */
function blobGlow(fig, parent, pos) { const gm = fig.perMat(mat('#8fd0ff', { basic: true, add: true, op: 0.9 })); fig.glowMat = gm; const go = keep(add(parent, U.sphere(8, 6), gm, pos || [0, 0, 0], null, 0.001)); go.visible = false; go.castShadow = false; fig.glow.push(go); }
function buildBlob(fig) {
  const d = fig.desc, f = d.f || (d.f = {}), pal = d.palette || (d.palette = {}), plan = d.plan;
  const bodyC = pal.body = pal.body || '#6a8a3a';
  fig.anchors = {}; fig.stance = {}; fig.arms = [];
  const body = fig.bone('body', fig.root, 0, 0, 0);
  const jig = fig.bone('jig', body, 0, 0, 0);
  fig.anchors.chest = jig; fig.anchors.head = jig; fig.anchors.mouth = jig;
  if (plan === 'ooze') {
    const om = f.cover === 'tar' ? mat(bodyC, { r: 0.08, m: 0.3 }) : mat(bodyC, { r: 0.15, m: 0.05, op: f.opacity || 0.72, e: bodyC, ei: 0.12 });
    ell(jig, om, [0, 0.2, 0], [0.42, 0.24, 0.4]); ell(jig, om, [0.12, 0.33, -0.05], [0.22, 0.18, 0.22]); ell(jig, om, [-0.15, 0.14, 0.12], [0.24, 0.13, 0.22]);
    if (f.debris !== false) { ell(jig, MT.bone(), [0.05, 0.2, 0.05], [0.06, 0.05, 0.07]); rod(jig, MT.bone(), [-0.15, 0.12, -0.05], [0.1, 0.18, 0.1], 0.015, 0.012); add(jig, U.cyl(10), MT.gold(), [-0.05, 0.28, -0.1], [0.5, 0, 0.3], [0.03, 0.006, 0.03]); }
    if (f.strings) for (let i = 0; i < 6; i++) { const a = i * 1.1; rod(jig, om, [Math.sin(a) * 0.2, 0.25, Math.cos(a) * 0.2], [Math.sin(a) * 0.45, 0.02, Math.cos(a) * 0.45], 0.02, 0.008); }
    const pod = blobArm(fig, jig, 'arm0', [0.0, 0.3, 0.25], om, 0.08, 4, 0.1); pod.rotation.x = 0.6;
    fig.jiggle = 1;
  } else if (plan === 'aberration') {
    const sm = mat(bodyC, { r: 0.45, bump: 'leather', bs: 0.006 });
    ell(jig, sm, [0, 0.3, 0], [0.32, 0.28, 0.3]);
    const ne = f.eyes || 3; for (let i = 0; i < ne; i++) { const a = (i - (ne - 1) / 2) * 0.45; const y = 0.42 + (i % 2) * 0.06; ell(jig, MT.eye('#f0e8c0'), [Math.sin(a) * 0.28, y, Math.cos(a) * 0.24], 0.055); ell(jig, MT.glowEye(pal.eye || '#c03020'), [Math.sin(a) * 0.32, y, Math.cos(a) * 0.29], 0.025); }
    if (f.maw !== false) { ell(jig, MT.dark(), [0, 0.2, 0.27], [0.12, 0.06, 0.04]); for (let i = 0; i < 6; i++) spike(jig, MT.teeth(), [(i - 2.5) * 0.04, 0.25, 0.29], [(i - 2.5) * 0.035, 0.2, 0.3], 0.01); }
    const nt = f.tentacles || 6; for (let k = 0; k < nt; k++) { const a = k / nt * TAU; const b = blobArm(fig, jig, 'arm' + k, [Math.sin(a) * 0.25, 0.15, Math.cos(a) * 0.25], sm, 0.05, 4, 0.12); b.rotation.set(0, a, 0, 'YXZ'); b.rotation.x = 1.2; }
    if (f.float) fig.floaty = true;
  } else if (plan === 'plant') {
    const v = d.variant || 'flytrap'; const lm = mat(pal.leaf || '#4a7a2a', { r: 0.8, ds: true }), stem = mat(pal.stem || '#5a7a30', { r: 0.8 });
    if (v === 'flytrap') {
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; add(jig, U.sphere(10, 6), lm, [Math.sin(a) * 0.25, 0.05, Math.cos(a) * 0.25], [0, a, 0], [0.12, 0.03, 0.28]); }
      const n = f.heads || 3; fig.heads = [];
      for (let k = 0; k < n; k++) {
        const a = (k - (n - 1) / 2) * 0.7; const b = blobArm(fig, jig, 'arm' + k, [Math.sin(a) * 0.08, 0.05, Math.cos(a) * 0.05], stem, 0.04, 3, 0.18, true);
        b.rotation.set(-0.15, a, 0, 'YXZ');
        const hd = fig.J['arm' + k + '_2'];
        const th = fig.bone('trap' + k, hd, 0, 0.18, 0); th.rotation.x = 0.5;
        const top = fig.bone('trapT' + k, th, 0, 0, 0); const bot = fig.bone('trapB' + k, th, 0, 0, 0);
        top.rotation.x = -0.45; bot.rotation.x = 0.45;
        [top, bot].forEach((jb, i) => { add(jb, U.sphere(12, 8, 0), mat(pal.trap || '#7a9a30', { r: 0.6, ds: true }), [0, 0, 0.12], null, [0.13, 0.035, 0.14]); add(jb, U.sphere(10, 6), mat(pal.inner || '#c03030', { r: 0.6 }), [0, i ? 0.012 : -0.012, 0.12], null, [0.11, 0.02, 0.12]); for (let t = 0; t < 7; t++) { const aa = -HP + t / 6 * PI; spike(jb, MT.horn('#e8e0b0'), [Math.sin(aa) * 0.12, 0, 0.12 + Math.cos(aa) * 0.13], [Math.sin(aa) * 0.15, i ? -0.04 : 0.04, 0.12 + Math.cos(aa) * 0.17], 0.008); } });
        fig.heads.push({ neck: [], head: th.name, jaw: null, top: top.name, bot: bot.name });
      }
    } else { // heap / mound of vines
      const vm = mat(pal.body || '#3a5a28', { r: 0.9, flat: true });
      for (let i = 0; i < 9; i++) { const a = i * 2.3; add(jig, U.ico(0), vm, [Math.sin(a) * 0.18 * (i % 3), 0.18 + (i % 4) * 0.08, Math.cos(a) * 0.15 * (i % 3)], [i, i * 2, 0], 0.18 + (i % 3) * 0.03); }
      for (let i = 0; i < 8; i++) { const a = i * 0.8; rod(jig, stem, [Math.sin(a) * 0.1, 0.4, Math.cos(a) * 0.1], [Math.sin(a) * 0.35, 0.05, Math.cos(a) * 0.32], 0.02, 0.012); }
      [1, -1].forEach((s, k) => { const b = blobArm(fig, jig, 'arm' + k, [s * 0.25, 0.4, 0.05], vm, 0.07, 4, 0.13); b.rotation.set(0.3, 0, s * 1.6); });
      if (f.eyes !== false) [1, -1].forEach(s => ell(jig, MT.glowEye(pal.eye || '#e0ff60'), [s * 0.08, 0.5, 0.22], 0.025));
    }
  } else if (plan === 'wisp') {
    const gm = fig.perMat(mat(pal.glow || '#a0e0ff', { e: pal.glow || '#a0e0ff', ei: 1.1, op: 0.9 }));
    const hm = fig.perMat(mat(pal.glow || '#a0e0ff', { basic: true, add: true, op: 0.35 }));
    const core = keep(ell(jig, gm, [0, 0.55, 0], 0.11)); core.castShadow = false;
    const halo = keep(ell(jig, hm, [0, 0.55, 0], 0.22)); halo.castShadow = false;
    fig.updaters.push(fg => { const s = 1 + 0.15 * Math.sin(fg.t * 7) + 0.08 * Math.sin(fg.t * 13); halo.scale.setScalar(0.22 * s); gm.emissiveIntensity = 1.0 + 0.4 * Math.sin(fg.t * 5); });
    fig.floaty = true;
  } else if (plan === 'hand') {
    const hm = MT.skin(pal.body || '#8a9a78');
    ell(jig, hm, [0, 0.06, 0], [0.09, 0.035, 0.1]);
    rod(jig, hm, [0, 0.05, -0.08], [0, 0.04, -0.16], 0.035, 0.03);
    for (let k = 0; k < 5; k++) { const a = k === 4 ? -1.1 : (k - 1.5) * 0.3; const b = blobArm(fig, jig, 'arm' + k, [Math.sin(a) * 0.08, 0.06, 0.06 + Math.cos(a) * 0.02], hm, 0.016, 3, 0.05); b.rotation.set(-1.4, a, 0, 'YXZ'); fig.J['arm' + k + '_1'].rotation.x = 0.9; fig.J['arm' + k + '_2'].rotation.x = 0.6; }
    for (let k = 0; k < 5; k++) spike(fig.J['arm' + k + '_2'], MT.horn('#c8c0a0'), [0, 0.045, 0], [0, 0.07, 0.01], 0.008);
  } else if (plan === 'object') {
    const wm = MT.wood('#8a6a40');
    rod(jig, wm, [0, 0.2, 0], [0, 1.05, 0], 0.02, 0.018);
    add(jig, U.lathe('bristle', [[0.02, 0.32], [0.09, 0.2], [0.15, 0.0], [0.001, -0.01]], 10), mat('#c8a050', { r: 1, bump: 'fur', bs: 0.01 }), [0, 0, 0]);
    add(jig, U.torus(0.2, 5, 10), MT.leather('#5a3a20'), [0, 0.27, 0], [HP, 0, 0], 0.04);
    fig.hopper = 1;
  }
  blobGlow(fig, jig, [0, 0.4, 0.2]);
  fig.V = { g: 0.2 };
}
function blobArm(fig, parent, name, pos, m, r, n, segL, up) {
  let p = fig.bone(name + '_0', parent, pos[0], pos[1], pos[2]); const first = p; const names = [];
  for (let i = 0; i < n; i++) {
    const r1 = r * (1 - i / (n + 0.5)), r2 = r * (1 - (i + 1) / (n + 0.5));
    add(p, U.limb(r1, Math.max(r2, 0.005), segL, 0.05), m, null, up ? [PI, 0, 0] : [HP, 0, 0]);
    names.push(p.name);
    if (i < n - 1) { const nb = fig.bone(name + '_' + (i + 1), p, 0, up ? segL : 0, up ? 0 : -segL); p = nb; }
  }
  // limbs extend along -Z (or +Y when up); flip yaw so default points outward/forward
  if (!up) first.rotation.y = PI;
  fig.arms.push(names);
  return first;
}
function blobBase(fig, dt, w) {
  const t = fig.t + fig.ph, mw = fig.moveW * w;
  if (fig.moveW > 0.01) fig.phase += dt * (fig.speed || 4) / (0.5 * fig.S) * TAU;
  if (fig.jiggle) { const j = fig.J.jig; const s = 1 + 0.05 * Math.sin(t * 2.3) + 0.08 * mw * Math.sin(fig.phase * 2); j.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s)); }
  if (fig.floaty) fig.mov('body', 0, (0.25 + 0.05 * Math.sin(t * 1.7)) * w, 0);
  if (fig.hopper) { const h = Math.abs(Math.sin(fig.phase)) * mw * 0.15 + 0.02 * Math.abs(Math.sin(t * 2)); fig.mov('body', 0, h, 0); fig.rot('body', 0.1 * Math.sin(t * 1.3) * w, 0, 0.12 * Math.sin(t * 0.9) * w); }
  (fig.arms || []).forEach((a, k) => a.forEach((nm, i) => fig.rot(nm, (0.1 + 0.15 * mw) * Math.sin(t * 1.5 + k * 1.3 - i * 0.6) * w, 0, 0.08 * Math.sin(t * 1.1 + k) * w)));
  (fig.heads || []).forEach((h, k) => { if (h.top) { const o = 0.15 * Math.max(0, Math.sin(t * 1.2 + k * 2)); fig.rot(h.top, -o * w, 0, 0); fig.rot(h.bot, o * w, 0, 0); } });
  fig.rot('jig', 0, 0.05 * Math.sin(t * 0.6) * w, 0);
}
function blobLie(fig, p) {
  const o = { jig: [0, 0, 0, 0, 0, 0], body: [0, 0, 0, 0, fig.floaty ? -0.25 : -0.05, 0] };
  if (fig.desc.plan === 'object') o.body = [0, 0, HP, 0.5, 0.05, 0];
  if (fig.desc.plan === 'hand' && p === 'dead') o.body = [0, 0, PI, 0, 0.1, 0];
  (fig.arms || []).forEach(a => a.forEach((nm, i) => { o[nm] = [i === 0 ? (fig.desc.plan === 'plant' ? 1.2 : 0.4) : 0.2, 0, 0]; }));
  return o;
}
FAM.blob = { base: blobBase, lie: blobLie, clips: genericClips({ bone: 'jig' }) };
FAM.blob.clips.breath = FAM.blob.clips.cast; FAM.blob.clips.idleFlourish = FAM.blob.clips.cheer;
const _bm = FAM.blob.clips.melee;
FAM.blob.clips.melee = function (fig, o) {
  const K = _bm(fig, o);
  (fig.heads || []).forEach(h => { if (h.top) { K.keys[1][1] = Object.assign({}, K.keys[1][1], { [h.top]: [-0.6, 0, 0], [h.bot]: [0.6, 0, 0] }); K.keys[2][1] = Object.assign({}, K.keys[2][1], { [h.top]: [0.4, 0, 0], [h.bot]: [-0.4, 0, 0] }); K.keys[3][1] = K.keys[2][1]; } });
  return K;
};
['ooze', 'aberration', 'plant', 'wisp', 'hand', 'object'].forEach(p => { PLANS[p] = { fam: 'blob', build: buildBlob }; });

/* ---------- swarms: one InstancedMesh of many tiny critters */
function critterGeo(type) {
  return geo('critter_' + type, () => {
    const parts = []; const P = (g, m) => { g = g.index ? g : g; parts.push({ g, m }); };
    const M4 = (x, y, z, sx, sy, sz, rx, ry, rz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx, sy, sz));
    const sph = new THREE.SphereGeometry(1, 8, 6), cyl = new THREE.CylinderGeometry(1, 1, 1, 5), cone = new THREE.ConeGeometry(1, 1, 5);
    if (type === 'rat') { P(sph, M4(0, 0.04, 0, 0.04, 0.035, 0.07)); P(sph, M4(0, 0.045, 0.07, 0.025, 0.022, 0.035)); P(cyl, M4(0, 0.03, -0.11, 0.006, 0.08, 0.006, HP)); }
    else if (type === 'spider') { P(sph, M4(0, 0.03, 0, 0.03, 0.025, 0.03)); P(sph, M4(0, 0.035, -0.045, 0.04, 0.035, 0.045)); for (let i = 0; i < 4; i++) [1, -1].forEach(s => P(cyl, M4(s * 0.04, 0.03, 0.02 - i * 0.015, 0.004, 0.08, 0.004, 0, 0, s * 1.2))); }
    else if (type === 'bat') { P(sph, M4(0, 0, 0, 0.025, 0.025, 0.035)); [1, -1].forEach(s => P(cone, M4(s * 0.06, 0, -0.005, 0.03, 0.09, 0.004, HP, 0, s * HP))); }
    else if (type === 'wasp' || type === 'fairy') { P(sph, M4(0, 0, 0, 0.015, 0.015, 0.02)); P(sph, M4(0, 0, -0.035, 0.02, 0.02, 0.03)); [1, -1].forEach(s => P(sph, M4(s * 0.03, 0.01, 0, 0.03, 0.003, 0.015))); }
    else if (type === 'ant') { P(sph, M4(0, 0.02, 0.025, 0.012, 0.012, 0.014)); P(sph, M4(0, 0.02, 0, 0.01, 0.01, 0.014)); P(sph, M4(0, 0.022, -0.03, 0.016, 0.015, 0.022)); for (let i = 0; i < 3; i++) [1, -1].forEach(s => P(cyl, M4(s * 0.02, 0.015, 0.01 - i * 0.012, 0.003, 0.04, 0.003, 0, 0, s * 1.2))); }
    else if (type === 'centipede') { for (let i = 0; i < 5; i++) P(sph, M4(0, 0.015, -i * 0.02, 0.012, 0.01, 0.014)); P(cyl, M4(0, 0.012, -0.04, 0.045, 0.003, 0.003, 0, 0, HP)); }
    else if (type === 'scorpion') { P(sph, M4(0, 0.02, 0, 0.03, 0.015, 0.04)); for (let i = 0; i < 3; i++) P(sph, M4(0, 0.03 + i * 0.015, -0.045 - i * 0.01, 0.01, 0.01, 0.012)); [1, -1].forEach(s => P(sph, M4(s * 0.03, 0.02, 0.05, 0.012, 0.008, 0.02))); }
    else P(sph, M4(0, 0.03, 0, 0.03, 0.03, 0.04));
    const items = parts.map(p => ({ g: p.g, m: p.m }));
    return mergeGeos(items);
  });
}
function buildSwarm(fig) {
  const d = fig.desc, f = d.f || (d.f = {}), pal = d.palette || (d.palette = {});
  const type = d.variant || 'rat';
  const flying = ['bat', 'wasp', 'fairy'].includes(type);
  const N = f.count || (flying ? 34 : 40);
  const m = type === 'fairy' ? mat(pal.body || '#ffe8a0', { e: '#ffd060', ei: 1.5 }) : mat(pal.body || { rat: '#5a4a40', spider: '#2a2420', bat: '#3a3030', wasp: '#c8a020', ant: '#5a2a1a', centipede: '#7a3a1a', scorpion: '#6a4a2a' }[type] || '#3a3a3a', { r: 0.7 });
  const body = fig.bone('body', fig.root, 0, 0, 0);
  const im = new THREE.InstancedMesh(critterGeo(type), m, N); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; keep(im);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  body.add(im); fig.swarm = { im, N, flying, type, seeds: [] };
  const r = fig.rand; for (let i = 0; i < N; i++) fig.swarm.seeds.push({ a: r() * TAU, rad: 0.15 + r() * 0.75, sp: (0.4 + r() * 0.8) * (r() < 0.5 ? -1 : 1), h: flying ? 0.3 + r() * 0.9 : 0, ph: r() * TAU, s: 0.8 + r() * 0.5 });
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  fig.updaters.push(fg => {
    const S = fg.swarm, t = fg.t, act = fg.active ? 1 : 0, dead = fg.deadW || 0, mw = fg.moveW;
    for (let i = 0; i < S.N; i++) {
      const p = S.seeds[i]; const a = p.a + t * p.sp * (1 + mw * 1.5 + act); const rad = p.rad * (1 - 0.3 * act * Math.sin(t * 8 + i)) * (1 + dead * 0.3);
      const x = Math.cos(a) * rad * 0.62, z = Math.sin(a) * rad * 0.62 + act * 0.15;
      const y = S.flying ? (p.h * (1 - dead) + Math.sin(t * 3 + p.ph) * 0.08) : 0;
      e.set(0, -a + (p.sp > 0 ? -HP : HP), S.flying ? Math.sin(t * 25 + p.ph) * 0.3 : 0);
      q.setFromEuler(e); v.set(x, y, z); sc.setScalar(p.s * (dead > 0.5 && S.flying ? 0.8 : 1));
      mm.compose(v, q, sc); S.im.setMatrixAt(i, mm);
    }
    S.im.instanceMatrix.needsUpdate = true;
  });
  fig.anchors = { chest: body, head: body, mouth: body }; fig.stance = {}; fig.V = { g: 0.3 };
  blobGlow(fig, body, [0, 0.4, 0]);
}
FAM.swarm = { base: (fig, dt, w) => { }, lie: (fig, p) => ({}), clips: genericClips({ bone: 'body' }) };
FAM.swarm.clips.breath = FAM.swarm.clips.cast; FAM.swarm.clips.idleFlourish = FAM.swarm.clips.cheer;
PLANS.swarm = { fam: 'swarm', build: buildSwarm };

/* ---------- ghosts / incorporeal undead: floating translucent robed humanoid */
PLANS.ghost = { fam: 'hum', build: fig => {
  const d = fig.desc, pal = d.palette || (d.palette = {}), f = d.f || (d.f = {});
  const c = pal.ghost || '#a8d8e0';
  const gm = fig.perMat(MT.ghost(c, f.opacity || 0.5)); fig.ghostMat = gm;
  d.outfit = 'ghost'; d.lower = 'float'; d.variant = d.variant || 'human'; f.glowEyes = f.glowEyes !== false; pal.eye = pal.eye || '#e8ffff'; f.hair = false; d.floatFly = true;
  if (!d.stance) d.stance = 'hover';
  buildHumanoid(fig);
  const J = fig.J, P = fig.P;
  add(J.hips, U.lathe('grobe', [[0.14, 0.03], [0.17, -0.1], [0.22, -0.3], [0.2, -0.45], [0.12, -0.55]], 14), gm, [0, 0, 0], null, [P.w, P.h, P.w * 0.85]);
  if (f.hooded !== false) { add(J.head, geo('hood', () => new THREE.SphereGeometry(1, 16, 12, HP + 0.85, TAU - 1.7, 0, PI * 0.72)), gm, [0, 0.09 * P.hs, -0.012 * P.hs], [-0.25, 0, 0], [0.125 * P.hs, 0.135 * P.hs, 0.13 * P.hs]); }
  if (f.hairLong) { const hm = gm; ell(J.head, hm, [0, 0.0, -0.07], [0.1, 0.2, 0.06]); }
  fig.updaters.push(fg => { gm.opacity = (f.opacity || 0.5) * (0.85 + 0.15 * Math.sin(fg.t * 3.1)) * (1 - 0.6 * (fg.deadW || 0)); });
  fig.floaty = true;
} };

/* ---------- elementals: fire / air / water bodies above a swirling column; earth = rock golem */
PLANS.elemental = { fam: 'hum', build: fig => {
  const d = fig.desc, pal = d.palette || (d.palette = {}), f = d.f || (d.f = {}); const v = d.element || 'fire';
  if (v === 'earth' || v === 'metal' || v === 'wood') {
    d.variant = d.variant || 'golem'; d.outfit = v === 'wood' ? 'wood' : v === 'metal' ? 'metalbody' : 'stone'; pal.skin = pal.skin || (v === 'metal' ? '#8a8a90' : v === 'wood' ? '#5a4330' : '#7a6a58'); d.build = Object.assign({ bulk: 1.15, hands: 1.6, limb: 1.4 }, d.build || {});
    if (!d.stance) d.stance = 'claws';
    buildHumanoid(fig);
    const rm = MT.stone(shade(pal.skin, 0.85)); const cm = mat(pal.crystal || '#7ad0e0', { r: 0.1, m: 0.2, e: pal.crystal || '#3a90a0', ei: 0.6, flat: true });
    [['chest', 0.12, 0.14, -0.05], ['armL', 0.03, 0.0, 0], ['armR', -0.03, 0.0, 0], ['spine', 0.08, 0.05, 0.06], ['head', 0.05, 0.15, -0.03], ['chest', -0.1, 0.18, 0.02]].forEach(([b, x, y, z], i) => add(fig.J[b], U.dodec(), rm, [x, y, z], [i, i * 2, 0], 0.07 + (i % 3) * 0.02));
    if (v === 'earth') for (let i = 0; i < 4; i++) add(fig.J.chest, U.oct(), cm, [(i - 1.5) * 0.06, 0.2, -0.1], [0.3 * i, 0, 0.3], [0.025, 0.08, 0.025]);
    return;
  }
  const c = pal.body || (v === 'fire' ? '#ff7a2a' : v === 'water' ? '#3a8ad0' : '#c8e0f0');
  pal.skin = c; pal.skinMat = v === 'fire' ? 'emis' : 'glass';
  d.outfit = 'none'; d.lower = 'column'; d.variant = d.variant || 'golem'; f.noLoin = true; f.belt = false; f.hair = false;
  if (!d.stance) d.stance = 'claws';
  const lm = v === 'fire' ? mat(c, { e: c, ei: 1.6, op: 0.85 }) : mat(c, { r: 0.1, m: 0.1, op: v === 'air' ? 0.35 : 0.55, e: c, ei: 0.25 });
  fig.ghostMat = lm;
  buildHumanoid(fig);
  fig.M.lowerMat = lm;
  const J = fig.J; const fx = [];
  if (v === 'fire') { const fm = fig.perMat(mat('#ffb040', { e: '#ff8020', ei: 2.4, op: 0.8 })); [['head', 0, 0.16, 0, 0.06, 0.2], ['chest', 0.1, 0.2, -0.04, 0.05, 0.16], ['chest', -0.1, 0.2, -0.04, 0.05, 0.16], ['armL', 0, 0, 0, 0.04, 0.12], ['armR', 0, 0, 0, 0.04, 0.12], ['tail0', 0, -0.1, 0, 0.12, 0.25], ['spine', 0, 0.05, -0.08, 0.06, 0.2]].forEach(([b, x, y, z, r, h], i) => { const o = keep(add(J[b], U.cone(7), fm, [x, y, z], [-0.3, 0, 0], [r, h, r])); o.castShadow = false; fx.push(o); }); fig.updaters.push(fg => fx.forEach((o, i) => { o.scale.y = (0.12 + 0.1 * (i % 2)) * (0.8 + 0.35 * Math.sin(fg.t * 10 + i * 2.1)); })); }
  else { const rm = fig.perMat(mat(c, { op: v === 'air' ? 0.3 : 0.45, e: c, ei: 0.3, ds: true })); const rings = []; for (let i = 0; i < 4; i++) { const o = keep(add(J.tail0, U.torus(0.06, 5, 20), rm, [0, -0.05 - i * 0.12, 0], [HP, 0, 0], 0.22 - i * 0.04)); o.castShadow = false; rings.push(o); } fig.updaters.push(fg => rings.forEach((o, i) => { o.rotation.z = fg.t * (2 + i) * (v === 'air' ? 2 : 0.7); o.position.x = Math.sin(fg.t * 2 + i) * 0.03; })); }
  fig.floaty = true;
} };

/* ---------- trees & treants */
PLANS.tree = { fam: 'hum', build: fig => {
  const d = fig.desc, pal = d.palette || (d.palette = {}), f = d.f || (d.f = {});
  d.variant = 'tree'; d.outfit = 'wood'; pal.skin = pal.skin || '#5a4330'; d.lower = f.walker ? 'legs' : 'roots';
  d.build = Object.assign({ bulk: 1.3, limb: 1.6, hands: 1.4, arms: 1.25 }, d.build || {});
  if (!d.stance) d.stance = 'claws';
  buildHumanoid(fig);
  const lm = mat(pal.leaf || '#4a7a2a', { r: 0.9, flat: true }); const bm = MT.bark(pal.skin);
  ['L', 'R'].forEach(s => { const sg = s === 'L' ? 1 : -1; rod(fig.J['fore' + s], bm, [0, -0.1, 0], [sg * 0.12, -0.05, 0.05], 0.02, 0.01); add(fig.J['fore' + s], U.ico(0), lm, [sg * 0.13, -0.05, 0.05], null, 0.07); add(fig.J['hand' + s], U.ico(0), lm, [0, -0.06, 0], null, 0.06); });
  for (let i = 0; i < 5; i++) add(fig.J.chest, U.ico(0), lm, [Math.sin(i * 1.3) * 0.15, 0.3 + (i % 2) * 0.05, -0.08 + Math.cos(i * 1.3) * 0.08], [i, i, 0], 0.12);
} };
/* ============================================================ creature descriptors */
const DRAGON_COLORS = {
  adamantine: { body: '#8a9098', belly: '#b8bcc4', wing: '#5a6068', horn: '#d8dce0', dh: 'many', cover: 'metal' },
  conspirator: { body: '#3e3a52', belly: '#7a8a6a', wing: '#2a2838', horn: '#c8c0a0', dh: 'swept', eye: '#a0ff60', glowEyes: 1, breath: '#a0ff60' },
  diabolic: { body: '#7a1a12', belly: '#2a1010', wing: '#3a0a08', horn: '#1a1010', dh: 'ram', eye: '#ffb020', glowEyes: 1, breath: '#ff5a1a' },
  empyreal: { body: '#e6d8b0', belly: '#f8f0d8', wing: '#fff8e8', horn: '#d8b040', dh: 'crown', eye: '#60c0ff', wings: 'feather', breath: '#fff0a0' },
  fortune: { body: '#c89a30', belly: '#e8d090', wing: '#8a3a6a', horn: '#f0e0a0', dh: 'crown', cover: 'metal', breath: '#ffd060' },
  horned: { body: '#4a6a34', belly: '#a8a868', wing: '#3a4a28', horn: '#d8ccb0', dh: 'forward', noseHorn: 1, breath: '#9be34a' },
  mirage: { body: '#c0a8c8', belly: '#e8dcc8', wing: '#9a80b0', horn: '#f0e8f0', dh: 'swept', frillD: 1, breath: '#ffd0ff' },
  omen: { body: '#4a2a6a', belly: '#8a6aa0', wing: '#2a1a40', horn: '#e0d0f0', dh: 'swept', eye: '#e0a0ff', glowEyes: 1, frillD: 1, breath: '#c080ff' },
  red: { body: '#9a2414', belly: '#d89a50', wing: '#6a1a10', horn: '#2a1a14', dh: 'swept', eye: '#ffb020', breath: '#ff6a1a' }
};
function descForCreature(name, traits, size, strikes, speeds) {
  name = String(name || 'Creature'); const n = name.toLowerCase();
  const T = new Set((traits || []).map(t => String(t).toLowerCase()));
  strikes = (strikes || []).map(s => String(s || ''));
  const S = strikes.map(s => s.toLowerCase());
  const has = (...k) => k.some(x => T.has(x));
  const nm = (...k) => k.some(x => new RegExp('(^|[^a-z])' + x.replace(/[-'()]/g, m => '\\' + m)).test(n));
  const beastOK = !T.has('humanoid');
  const st = (...k) => S.some(s => k.some(x => s.includes(x)));
  let sp = speeds; if (typeof sp === 'number') sp = { land: sp }; sp = sp || {};
  const d = { plan: 'humanoid', name, size: normSize(size), seed: hashStr(name), palette: {}, f: {}, build: {}, fly: !!sp.fly, swim: !!sp.swim, burrow: !!sp.burrow };
  if (sp.fly && sp.fly <= (sp.land || 0)) d.flyDefault = false;
  const pal = d.palette, f = d.f;
  const r = rng(d.seed);
  // weapon from strikes
  const wpn = strikes.map(weaponFromName).find(x => x && x !== 'broom') || null;
  const rangedW = strikes.map(weaponFromName).find(x => x && WEAPONS[x] && ['bow', 'xbow', 'hxbow', 'sling', 'javelin', 'flask'].includes(WEAPONS[x].t));
  const naturalStyle = () => st('jaws', 'fang', 'bite', 'beak', 'mandible', 'maw', 'snout') ? 'bite' : st('claw', 'talon') ? 'claw' : st('horn', 'tusk', 'skull', 'headbutt', 'antler') ? 'gore' : st('stinger', 'sting') ? 'sting' : st('tail') ? 'tail' : st('hoof', 'foot') ? 'stomp' : st('fist', 'slam', 'body', 'wave', 'gust') ? 'slam' : 'bite';
  d.melee = null;
  if (st('spit', 'web', 'spout', 'glob', 'squirt', 'spew', 'offal', 'leachate', 'slime ball')) d.ranged = 'spit';
  else if (st('quill', 'spike', 'splinter', 'seed', 'spore', 'rock', 'icicle', 'ice dart', 'scrap', 'bone javelin', 'corpse')) d.ranged = st('rock', 'scrap', 'corpse', 'bone javelin', 'seed', 'spore') ? 'throw' : 'spike';
  else if (st('ray', 'shock', 'starlight', 'flame jet', 'fire mote', 'mental blast', 'lightning', 'thunderbolt', 'flame', 'spark', 'orb', 'hymn', 'fire ray', 'tongue of flame', 'hand of fate', 'touch')) d.ranged = 'ray';
  const H = (variant, o) => { d.plan = 'humanoid'; d.variant = variant; Object.assign(d, o || {}); if (wpn) d.weapon = wpn; if (rangedW && !wpn) d.weapon = rangedW; return d; };
  const fiendPal = () => { pal.skin = pick(r, ['#8a2a20', '#6a1a1a', '#5a2a3a', '#7a3020']); pal.horn = '#1a1414'; pal.eye = '#ffb020'; f.glowEyes = 1; };
  const done = () => {
    if (d.plan === 'humanoid' || d.plan === 'ghost' || d.plan === 'elemental' || d.plan === 'tree' || d.plan === 'centaur') {
      if (!d.weapon && wpn) d.weapon = wpn;
      if (st('claw') && !d.weapon) f.claws = 1;
      if (!d.melee && !d.weapon) d.melee = st('claw', 'talon') ? 'claw' : st('jaws', 'fang', 'bite', 'beak') ? 'bite' : st('tail') && f.tail ? 'tail' : st('horn', 'headbutt') ? 'bite' : 'unarmed';
      if (d.outfit == null) d.outfit = 'vest';
    } else if (!d.melee) d.melee = naturalStyle();
    if (st('tail') && d.plan === 'humanoid' && !f.tail && !d.lower) f.tail = 'reptile';
    if (st('stinger') && (d.plan === 'quadruped' || d.plan === 'drake' || d.plan === 'dragon')) f.stinger = 1;
    if (d.fly && !f.wings && ['quadruped', 'drake', 'dragon', 'humanoid'].includes(d.plan) && !d.noWings && !has('incorporeal', 'spirit') && !d.floatFly) f.wings = d.plan === 'humanoid' ? (has('celestial', 'angel', 'archon', 'azata') ? 'feather' : has('fey') ? 'insect' : 'bat') : 'bat';
    return d;
  };
  /* ---------- dragons */
  if (has('dragon') || (nm('dragon', 'drake', 'wyvern', 'linnorm') && !has('humanoid'))) {
    const key = Object.keys(DRAGON_COLORS).find(k => n.includes(k));
    if (nm('turtle')) { d.plan = 'quadruped'; d.variant = 'turtle'; Object.assign(pal, { body: '#3a6a5a', belly: '#a8b888', shell: '#3a4a30', horn: '#d8ccb0' }); f.spikes = 1; d.melee = 'bite'; return done(); }
    if (nm('linnorm')) { d.plan = 'linnorm'; const c = nm('crag') ? ['#6a3a2a', '#c8904a', '#ff6a1a'] : nm('ice') ? ['#a8c8dc', '#e8f0f8', '#c0f0ff'] : nm('tarn') ? ['#3a5a42', '#8a9a60', '#9be34a'] : ['#7a5a3a', '#c8a878', '#ff8a3a']; Object.assign(pal, { body: c[0], belly: c[1], breath: c[2], horn: '#e8dcc0' }); f.dhorns = 'swept'; f.spikes = 1; d.noWings = true; d.flyDefault = false; return done(); }
    if (nm('wyvern') || nm('drake')) {
      d.plan = 'drake';
      const c = nm('desert') ? ['#c8a060', '#e8d0a0', '#ffd080'] : nm('flame') ? ['#b8401a', '#e8a050', '#ff6a1a'] : nm('frost') ? ['#a0c8e0', '#e8f4ff', '#c0f0ff'] : nm('jungle') ? ['#3a7a3a', '#a8c070', '#9be34a'] : nm('river') ? ['#3a7a8a', '#a8d0c8', '#9fdcff'] : ['#6a6040', '#b8a878', '#9be34a'];
      Object.assign(pal, { body: c[0], belly: c[1], breath: c[2], wing: shade(c[0], 0.7) }); f.dhorns = nm('frost') ? 'many' : 'swept';
      if (nm('wyvern', 'jungle')) f.stinger = 1; if (nm('river')) f.frillD = 1;
      return done();
    }
    if (nm('dragonet')) { d.plan = 'dragon'; Object.assign(pal, { body: '#5ab0a0', belly: '#d8f0d0', wing: '#c0f0ff', horn: '#f0e0b0' }); f.wings = 'insect'; f.dhorns = 'swept'; return done(); }
    d.plan = 'dragon';
    const c = DRAGON_COLORS[key || (has('fire') ? 'red' : 'red')] || DRAGON_COLORS.red;
    Object.assign(pal, { body: c.body, belly: c.belly, wing: c.wing, horn: c.horn, eye: c.eye || '#f0c020', breath: c.breath }); f.dhorns = c.dh; if (c.glowEyes) f.glowEyes = 1; if (c.noseHorn) f.noseHorn = 1; if (c.frillD) f.frillD = 1; if (c.cover) f.cover = c.cover; if (c.wings) f.wings = c.wings;
    if (key === 'fortune') f.barbels = 1;
    return done();
  }
  if (nm('hydra')) { d.plan = 'hydra'; Object.assign(pal, { body: '#4a6a42', belly: '#b8b878', horn: '#d8ccb0' }); f.heads = 5; f.dhorns = 'swept'; return done(); }
  if (nm('mukradi')) { d.plan = 'hydra'; Object.assign(pal, { body: '#7a5a3a', belly: '#c8a878', horn: '#2a2020' }); f.heads = 3; f.spikes = 1; return done(); }
  if (nm('quetz coatl', 'couatl')) { d.plan = 'serpent'; Object.assign(pal, { body: '#2a9a8a', belly: '#f0d060', fin: '#e04030' }); f.wings = 'feather'; pal.wing = '#3ac0a0'; f.crest = 1; f.thick = 0.09; return done(); }
  /* ---------- swarms */
  if (has('swarm')) {
    d.plan = 'swarm'; d.variant = nm('rat') ? 'rat' : nm('spider') ? 'spider' : nm('bat') ? 'bat' : nm('wasp', 'vescavor') ? 'wasp' : nm('ant') ? 'ant' : nm('centipede') ? 'centipede' : nm('scorpion') ? 'scorpion' : nm('fairy') ? 'fairy' : 'rat';
    if (nm('vescavor')) pal.body = '#6a2a1a';
    d.melee = 'bite'; return done();
  }
  /* ---------- incorporeal / spirits */
  if (nm('grim reaper', 'lesser death')) { d.plan = 'ghost'; d.variant = 'skull'; Object.assign(pal, { ghost: '#1a1a20', eye: '#ff4020' }); f.opacity = 0.95; f.glowEyes = 1; d.weapon = 'scythe'; d.floatFly = true; return done(); }
  if (has('incorporeal') || (!has('humanoid') && nm('ghost', 'banshee', 'wraith', 'shadow spawn', 'dybbuk', 'poltergeist') || (nm('shadow') && has('undead')))) {
    d.plan = 'ghost'; d.floatFly = true;
    if (nm('phantom beast')) { d.plan = 'quadruped'; d.variant = 'canine'; f.cover = 'ghost'; pal.body = '#90c8e0'; f.horns = 'straight'; f.glowEyes = 1; d.fly = false; return done(); }
    if (nm('shadow')) { pal.ghost = '#141420'; f.opacity = 0.7; pal.eye = '#e0e0ff'; }
    else if (nm('wraith')) { pal.ghost = '#20202a'; f.opacity = 0.75; pal.eye = '#ff3020'; }
    else if (nm('banshee')) { pal.ghost = '#c8e8f0'; f.hairLong = 1; f.hooded = false; }
    else if (nm('dybbuk')) { pal.ghost = '#a0b8c8'; }
    else if (nm('phantom knight')) { pal.ghost = '#80b0e0'; d.acc = 'helm'; d.cls = 'fighter'; f.hooded = false; }
    else if (nm('ghost mage')) { pal.ghost = '#a0a0ff'; f.hooded = true; }
    else pal.ghost = '#a8d8e0';
    if (wpn) d.weapon = wpn;
    d.melee = d.weapon ? null : 'claw';
    return done();
  }
  /* ---------- elementals */
  const elem = has('fire') ? 'fire' : has('water') ? 'water' : has('air') ? 'air' : has('earth') ? 'earth' : has('metal') ? 'metal' : has('wood') ? 'wood' : null;
  if (has('elemental') || has('genie')) {
    if (nm('scamp')) { d.plan = 'elemental'; d.element = elem || 'fire'; d.build = { head: 1.3 }; f.wings = 'bat'; pal.wing = { fire: '#c04010', water: '#2a6aa0', air: '#a0c0d0', earth: '#6a5a48' }[d.element]; f.horns = 'straight'; d.melee = st('jaws') ? 'bite' : 'claw'; d.fly = !!sp.fly; return done(); }
    if (has('genie') || nm('ifrit', 'jaathoom', 'jabali', 'faydhaan', 'jann')) {
      H('human', { outfit: 'vest' });
      if (nm('ifrit')) { pal.skin = '#b8381a'; f.flameHair = 1; f.horns = 'straight'; pal.body = '#3a1a10'; pal.trim = '#e8a020'; pal.eye = '#ffd060'; f.glowEyes = 1; d.build.bulk = 1.15; }
      else if (nm('jaathoom')) { pal.skin = '#7aa8d0'; d.lower = 'column'; pal.body = '#e0e8f0'; pal.trim = '#3a6ac0'; f.hair = false; d.outfit = 'none'; f.noLoin = 1; }
      else if (nm('jabali')) { pal.skin = '#7a6a58'; pal.skinMat = 'stone'; pal.body = '#4a3a2a'; pal.trim = '#c8a040'; d.build.bulk = 1.25; f.beard = 'long'; pal.hair = '#3a3028'; }
      else if (nm('faydhaan')) { pal.skin = '#3a8ab0'; pal.body = '#e0f0f0'; pal.trim = '#2a5a8a'; d.lower = 'column'; f.hair = false; }
      else { pal.skin = '#c8905a'; pal.body = '#d8c8a0'; pal.trim = '#8a3a2a'; }
      d.fly = false; return done();
    }
    if (nm('shark')) { d.plan = 'fish'; Object.assign(pal, { body: '#3a8ad0', belly: '#a0d0f0', fin: '#3a8ad0' }); f.cover = 'glass'; f.teeth = 1; f.bigFin = 1; f.thick = 0.15; return done(); }
    if (nm('rat')) { d.plan = 'quadruped'; d.variant = 'rat'; Object.assign(pal, { body: '#4a2a1a', tailC: '#ff6a1a', eye: '#ffb020' }); f.glowEyes = 1; f.flame = 1; return done(); }
    if (nm('hound')) { d.plan = 'quadruped'; d.variant = 'canine'; f.cover = 'stone'; pal.body = '#6a5a3a'; f.glowEyes = 1; pal.eye = '#a0ff60'; return done(); }
    if (nm('hawk')) { d.plan = 'bird'; f.cover = 'ghost'; pal.body = '#c8e8f8'; pal.wing = '#e0f4ff'; d.fly = true; return done(); }
    if (nm('quatoid')) { d.plan = 'octopus'; f.cover = 'glass'; pal.body = '#4aa0d0'; return done(); }
    if (nm('firewyrm')) { d.plan = 'serpent'; f.cover = 'emis'; pal.body = '#e85a1a'; pal.belly = '#ffd040'; f.thick = 0.1; f.segments = 12; f.spikes = 1; return done(); }
    d.plan = 'elemental'; d.element = elem || 'earth';
    if (d.element === 'water' && nm('tsunami', 'waterfall')) d.build = { bulk: 1.2 };
    if (nm('phade')) d.element = 'air';
    if (d.element === 'earth' || d.element === 'metal') d.melee = 'slam';
    d.fly = false;
    return done();
  }
  /* ---------- undead */
  if (has('undead')) {
    if (nm('crawling hand')) { d.plan = 'hand'; pal.body = '#8a9a78'; d.melee = 'claw'; return done(); }
    if (nm('skeletal horse')) { d.plan = 'quadruped'; d.variant = 'horse'; f.cover = 'bone'; pal.body = '#ddd3b8'; pal.mane = '#2a2a2a'; f.glowEyes = 1; pal.eye = '#60ffd0'; return done(); }
    if (nm('warsworn')) { d.plan = 'aberration'; pal.body = '#7a6a5a'; f.eyes = 6; f.tentacles = 8; return done(); }
    if (nm('paleohemoth')) { d.plan = 'biped'; d.variant = 'trex'; f.cover = 'bone'; pal.body = '#d8ccb0'; f.glowEyes = 1; return done(); }
    if (has('skeleton') || nm('skeletal', 'skulltaker')) {
      H('skull', { outfit: 'bones' }); pal.skin = '#ddd3b8'; f.glowEyes = nm('champion', 'giant', 'hulk', 'skulltaker') ? 1 : 0; pal.eye = '#60ffd0';
      if (nm('champion')) { d.acc = 'helm'; d.cls = 'fighter'; d.shield = 'round'; d.weapon = 'longsword'; pal.metal = '#6a6a60'; }
      if (nm('guard')) { d.shield = 'round'; pal.body = '#6a5a40'; d.weapon = d.weapon || 'scimitar'; }
      if (nm('giant')) { f.horns = 'curved'; d.build.bulk = 1.4; }
      if (nm('hulk')) { d.build.bulk = 1.8; d.build.hunch = 0.3; f.claws = 1; }
      if (nm('skulltaker')) { f.wings = 'bone'; d.build.bulk = 1.5; }
      return done();
    }
    if (has('zombie') || nm('zombie')) {
      H('zombie', { outfit: 'rags', stance: 'zombie' }); pal.skin = nm('plague') ? '#8aa070' : '#9aa88a'; pal.body = '#5a5040'; f.hairStyle = 'wild'; pal.hair = '#3a3a30';
      if (nm('brute')) { d.build.bulk = 1.4; } if (nm('hulk')) { d.build.bulk = 1.7; d.build.hunch = 0.35; d.stance = 'claws'; }
      d.melee = 'unarmed'; return done();
    }
    if (has('ghoul') || nm('ghoul')) { H('ghoul', { outfit: nm('soldier') ? 'mail' : 'rags', stance: 'claws' }); pal.skin = '#8a9a8f'; pal.body = '#4a4a40'; f.claws = 1; d.build.hunch = 0.3; pal.eye = '#ffe080'; f.glowEyes = 1; f.tongue = 1; if (!nm('soldier')) d.weapon = null; return done(); }
    if (has('mummy') || nm('mummy')) { H('human', { outfit: 'wraps', stance: 'zombie' }); pal.skin = '#c8b890'; f.glowEyes = 1; pal.eye = '#60e0ff'; f.hair = false; if (nm('pharaoh')) { d.acc = 'headdress'; pal.trim = '#2a4a9a'; d.stance = 'regal'; } return done(); }
    if (has('vampire') || nm('vampire')) { H('human', { outfit: 'vest' }); Object.assign(pal, { skin: '#e8e0e0', body: '#1a1a24', trim: '#8a1020', cape: '#2a0a10', hair: '#141010', eye: '#ff2020' }); f.cape = 1; f.collar = 1; f.glowEyes = 1; f.hairStyle = 'short'; if (!d.weapon) f.claws = 1; return done(); }
    if (nm('lich')) { H('skull', { outfit: 'robe', acc: 'crown' }); Object.assign(pal, { skin: '#c8c0a8', bone: '#c8c0a8', body: '#2a1a3a', trim: '#8a6a20', eye: '#60ffd0', glow: '#60ffd0' }); f.glowEyes = 1; f.cape = 'tatter'; pal.cape = '#1a1020'; d.weapon = d.weapon || 'staff'; d.staffKind = 'arcane'; d.ranged = 'ray'; return done(); }
    if (nm('graveknight')) { H('skull', { outfit: 'plate', acc: 'helm', cls: 'champion' }); Object.assign(pal, { metal: '#3a3a40', body: '#2a1a1a', trim: '#6a1a1a', eye: '#60c0ff', cape: '#3a1010' }); f.glowEyes = 1; f.cape = 'tatter'; return done(); }
    if (nm('dullahan')) { H('none', { outfit: 'plate', cls: 'champion' }); Object.assign(pal, { metal: '#2a2a30', body: '#1a1a1a', trim: '#5a1a1a', cape: '#2a1010' }); f.cape = 'tatter'; f.headless = 1; return done(); }
    if (nm('wight')) { H('ghoul', { outfit: 'mail' }); Object.assign(pal, { skin: '#6a7a7a', body: '#2a2a2a', metal: '#5a5a58', eye: '#60c0ff' }); f.glowEyes = 1; f.claws = 1; return done(); }
    if (nm('herexen')) { H('zombie', { outfit: 'robe' }); Object.assign(pal, { skin: '#9aa0a0', body: '#3a2a3a', trim: '#6a1a2a', eye: '#ff4040' }); f.glowEyes = 1; d.acc = 'hood'; return done(); }
    if (nm('revenant')) { H('zombie', { outfit: 'rags', stance: 'claws' }); pal.skin = '#8a8a7a'; f.claws = 1; f.glowEyes = 1; pal.eye = '#ff3020'; return done(); }
    H('zombie', { outfit: 'rags' }); pal.skin = '#9aa88a'; return done();
  }
  if (nm('voidworm')) { d.plan = 'serpent'; pal.body = '#4a3a6a'; pal.belly = '#a080c0'; f.wings = 'insect'; f.legsSmall = 1; d.fly = true; f.thick = 0.05; return done(); }
  if (nm('paleohemoth')) { d.plan = 'biped'; d.variant = 'trex'; f.cover = 'bone'; pal.body = '#d8ccb0'; f.glowEyes = 1; return done(); }
  /* ---------- constructs */
  if (has('construct') || nm('golem', 'statue', 'animated')) {
    if (nm('broom')) { d.plan = 'object'; d.melee = 'slam'; return done(); }
    if (nm('animated armor')) { H('none', { outfit: 'plate', acc: 'helm', cls: 'fighter' }); pal.metal = '#8a8e96'; pal.body = '#6a6a70'; f.glowEyes = 1; d.weapon = wpn || 'glaive'; f.helmEyes = 1; return done(); }
    if (nm('doll')) { H('doll', { outfit: 'vest' }); Object.assign(pal, { skin: '#f0dcc8', body: pick(r, ['#c04060', '#4060c0', '#40a060', '#c0a040']), trim: '#f0f0f0', hair: pick(r, ['#c86020', '#2a1a10', '#e0c060']) }); f.hairStyle = 'long'; d.melee = 'unarmed'; return done(); }
    if (nm('homunculus')) { H('goblin', { outfit: 'none' }); pal.skin = '#8a7a6a'; f.wings = 'bat'; pal.wing = '#5a4a3a'; f.tail = 'devil'; d.melee = 'bite'; return done(); }
    if (nm('scarecrow')) { H('pumpkin', { outfit: 'rags' }); pal.body = '#6a5a3a'; f.ragged = 1; d.acc = 'hat'; pal.hat = '#4a3a2a'; d.build.bulk = 0.85; f.claws = 1; return done(); }
    if (nm('aolaz')) { d.plan = 'quadruped'; d.variant = 'elephant'; f.cover = 'metal'; pal.body = '#a08a5a'; f.glowEyes = 1; d.melee = 'gore'; return done(); }
    if (nm('needler')) { d.plan = 'spider'; f.metal = 1; pal.body = '#6a6a5a'; pal.accent = '#a0e040'; f.glowEyes = 1; pal.eye = '#a0ff40'; return done(); }
    const golem = H('golem', { outfit: 'stone' });
    if (nm('iron', 'warden')) { d.outfit = 'metalbody'; pal.skin = '#5a5a60'; pal.eye = '#ff8020'; }
    else if (nm('clay', 'effigy')) { d.outfit = 'clay'; pal.skin = '#a0784a'; pal.eye = '#ffd060'; }
    else if (nm('charnel', 'flesh')) { d.variant = 'zombie'; d.outfit = 'rags'; pal.skin = '#a89080'; d.build.hunch = 0.2; f.hairStyle = 'none'; }
    else { pal.skin = '#8a8a84'; pal.eye = '#80d0ff'; }
    d.build = Object.assign({ bulk: 1.15, hands: 1.5, limb: 1.3 }, d.build);
    d.melee = 'slam'; f.glowEyes = 1;
    return done();
  }
  /* ---------- oozes, plants, fungi, aberrations */
  if (has('ooze') && !has('demon')) { d.plan = 'ooze'; pal.body = nm('tar') ? '#141414' : nm('string') ? '#d8d0a0' : nm('tomb') ? '#d8e8e0' : nm('globster') ? '#c8b8a0' : '#6a7a3a'; if (nm('tar')) f.cover = 'tar'; if (nm('string')) f.strings = 1; return done(); }
  if (nm('omox')) { d.plan = 'ooze'; pal.body = '#4a5a2a'; f.debris = true; return done(); }
  if (nm('flytrap')) { d.plan = 'plant'; d.variant = 'flytrap'; f.heads = nm('giant') ? 4 : 2; return done(); }
  if (nm('heap', 'dezullon', 'terotricus')) { d.plan = 'plant'; d.variant = 'heap'; pal.body = nm('terotricus') ? '#7a5a6a' : nm('doldrums') ? '#5a6a3a' : '#3a5a28'; return done(); }
  if (nm('awakened tree', 'arboreal regent')) { d.plan = 'tree'; pal.skin = '#5a4330'; pal.leaf = '#4a7a2a'; d.melee = 'slam'; return done(); }
  if (nm('arboreal warden')) { d.plan = 'tree'; f.walker = 1; pal.skin = '#6a5038'; d.weapon = 'longsword'; d.shield = 'round'; return done(); }
  if (nm('sprigjack', 'twigjack')) { d.plan = 'tree'; f.walker = 1; pal.skin = '#6a5a3a'; d.build = { bulk: 0.8, limb: 0.9 }; f.claws = 1; return done(); }
  if (has('leshy')) { H('leshy', { outfit: 'none' }); pal.skin = nm('fungus') ? '#d8c8b0' : nm('gourd') ? '#a07a3a' : '#5a7a3a'; d.capType = nm('fungus') ? 'mushroom' : nm('gourd') ? 'gourd' : 'leaf'; f.noLoin = 1; f.belt = false; return done(); }
  if (nm('will-o', 'wisp')) { d.plan = 'wisp'; pal.glow = '#a0e8ff'; d.ranged = 'ray'; return done(); }
  if (nm('zoaem')) { d.plan = 'wisp'; pal.glow = '#ffe080'; d.ranged = 'ray'; return done(); }
  if (nm('arbiter')) { d.plan = 'wisp'; pal.glow = '#c0d0ff'; return done(); }
  if (nm('cacodaemon')) { d.plan = 'aberration'; pal.body = '#5a3a3a'; f.eyes = 1; f.tentacles = 0; f.float = 1; return done(); }
  if (nm('rhu-chalik', 'jah-tohl', 'xoarian', 'bogwid', 'irnakurse', 'quelaunt', 'gosreg', 'vidileth', 'augnagar', 'thulgant', 'grothlut', 'ofalth', 'cythnigot')) {
    if (nm('ofalth') || nm('grothlut')) { d.plan = 'ooze'; pal.body = nm('grothlut') ? '#c8b8a8' : '#6a5a3a'; return done(); }
    if (nm('vidileth')) { d.plan = 'octopus'; pal.body = '#4a3a6a'; f.tentacles = 6; return done(); }
    if (nm('cythnigot')) { d.plan = 'spider'; pal.body = '#6a5a3a'; f.glowEyes = 1; d.size = 'tiny'; return done(); }
    if (nm('thulgant', 'augnagar')) { d.plan = 'scorpion'; pal.body = nm('thulgant') ? '#4a4a2a' : '#5a3a3a'; f.glowEyes = 1; return done(); }
    d.plan = 'aberration'; pal.body = pick(r, ['#6a5a7a', '#5a7a6a', '#7a6a5a', '#4a5a6a']); f.eyes = nm('xoarian') ? 1 : 3; if (sp.fly) f.float = 1; if (nm('quelaunt', 'gosreg')) f.tentacles = 4;
    return done();
  }
  if (nm('gogiteth')) { d.plan = 'spider'; pal.body = '#3a3a4a'; f.glowEyes = 1; pal.eye = '#ff4040'; f.hairy = 1; return done(); }
  if (nm('grikkitog')) { d.plan = 'worm'; f.cover = 'stone'; pal.body = '#6a6058'; return done(); }
  /* ---------- arthropods */
  if (nm('spider', 'tarantula', 'morrigna') && !nm('swarm')) { if (nm('morrigna')) { H('human', { outfit: 'robe', lower: 'legs' }); pal.body = '#2a2a2a'; pal.skin = '#d0c8c0'; f.glowEyes = 1; d.acc = 'hood'; return done(); } d.plan = 'spider'; pal.body = nm('tarantula') ? '#5a3a24' : nm('goliath') ? '#2a2420' : '#4a3a2a'; pal.accent = '#c03020'; if (nm('tarantula', 'goliath')) f.hairy = 1; d.ranged = 'spit'; return done(); }
  if (nm('scorpion') && !nm('manticore')) { d.plan = 'scorpion'; pal.body = '#6a4a2a'; return done(); }
  if (beastOK && nm('reefclaw', 'crab')) { d.plan = 'crab'; pal.body = '#b0503a'; pal.claw = '#3a2a20'; return done(); }
  if (nm('centipede', 'con rit')) { d.plan = 'centipede'; pal.body = nm('con rit') ? '#6a3a3a' : '#7a3a1a'; pal.accent = '#3a2a1a'; return done(); }
  if (nm('mantis')) { d.plan = 'insect'; d.variant = 'mantis'; pal.body = '#6a8a3a'; d.melee = 'claw'; return done(); }
  if (nm('wasp', 'vescavor')) { d.plan = 'insect'; d.variant = 'wasp'; pal.body = nm('vescavor') ? '#3a1a1a' : '#2a2018'; pal.stripe = nm('vescavor') ? '#a02020' : '#e0b020'; d.melee = 'sting'; d.fly = true; return done(); }
  if (nm('beetle')) { d.plan = 'insect'; d.variant = 'beetle'; pal.body = nm('flash') ? '#3a3a2a' : '#2a1a14'; pal.shell = nm('flash') ? '#c0a020' : '#3a2418'; if (nm('stag')) f.stag = 1; if (nm('flash')) f.glowEyes = 1; return done(); }
  if (nm('ant', 'ankhrav')) { d.plan = 'insect'; d.variant = 'ant'; pal.body = nm('ankhrav') ? '#6a5a3a' : '#6a2a1a'; if (nm('ankhrav')) f.stag = 1; return done(); }
  if (nm('zecui')) { H('insect', { outfit: 'none' }); pal.skin = '#5a6a3a'; pal.skinMat = 'scales'; f.claws = 1; return done(); }
  /* ---------- aquatic */
  if (nm('kraken', 'octopus')) { d.plan = 'octopus'; pal.body = nm('kraken') ? '#6a2a3a' : '#a0503a'; if (nm('kraken')) f.longArms = 1; return done(); }
  if (nm('shark', 'megalodon')) { d.plan = 'fish'; Object.assign(pal, { body: '#6a7a88', belly: '#e8e8e8', fin: '#5a6a78' }); f.teeth = 1; f.bigFin = 1; f.thick = 0.15; f.snout = 1; return done(); }
  if (nm('dolphin', 'orca')) { d.plan = 'fish'; Object.assign(pal, nm('orca') ? { body: '#141418', belly: '#f0f0f0', fin: '#141418' } : { body: '#7a8a9a', belly: '#d0d8e0', fin: '#6a7a8a' }); f.flukes = 1; f.snout = 1; f.thick = 0.15; if (nm('orca')) f.stripes = 1; return done(); }
  if (nm('eel')) { d.plan = 'serpent'; Object.assign(pal, nm('electric') ? { body: '#3a4a5a', belly: '#e0e060' } : { body: '#5a6a3a', belly: '#c8c890' }); f.fins = 1; f.thick = 0.07; d.swim = true; return done(); }
  if (nm('hippocampus')) { d.plan = 'quadruped'; d.variant = 'hippocampus'; Object.assign(pal, { body: '#3a8a8a', belly: '#c8e8d8', mane: '#2a5a7a', fin: '#5ac0c0' }); f.mane = 'horse'; d.melee = 'tail'; return done(); }
  if (nm('sea serpent')) { d.plan = 'serpent'; Object.assign(pal, { body: '#2a5a6a', belly: '#c8d8b0', fin: '#c04030' }); f.crest = 1; f.fins = 1; f.thick = 0.09; f.segments = 12; return done(); }
  /* ---------- snakes & worms */
  if (nm('viper', 'python', 'anaconda', 'snake', 'raktavarna', 'vicharamuni')) {
    d.plan = 'serpent';
    Object.assign(pal, nm('viper') ? { body: '#6a6a3a', belly: '#d8d0a0' } : nm('python') ? { body: '#7a6a3a', belly: '#e0d0a0' } : nm('anaconda') ? { body: '#3a4a2a', belly: '#c8c890' } : nm('raktavarna') ? { body: '#3a6a5a', belly: '#e0c060', eye: '#ff4040' } : { body: '#c8a040', belly: '#f0e0b0' });
    if (nm('anaconda', 'python')) f.thick = 0.09; if (nm('vicharamuni', 'viper', 'raktavarna')) f.hood = nm('vicharamuni') ? 1 : 0; if (nm('raktavarna')) f.glowEyes = 1;
    return done();
  }
  if (nm('worm')) { d.plan = 'worm'; if (nm('magma')) { f.cover = 'stone'; f.magma = 1; pal.body = '#3a2a24'; } else if (nm('benthic')) pal.body = '#4a5a6a'; else pal.body = '#6a4a7a'; if (nm('voidworm')) { d.plan = 'serpent'; pal.body = '#4a3a6a'; f.wings = 'insect'; f.legsSmall = 1; d.fly = true; } return done(); }
  if (nm('keketar', 'azuretzi')) { H('lizard', { outfit: 'scales', lower: 'snake' }); pal.skin = nm('keketar') ? '#4a3a6a' : '#3a6a8a'; pal.tail = pal.skin; f.claws = 1; f.wings = 'insect'; f.horns = 'straight'; d.floatFly = true; return done(); }
  /* ---------- birds & bats & flyers */
  if (beastOK && nm('roc', 'eagle', 'hawk', 'phoenix', 'cockatrice', 'cauthooj', 'alce', 'nosoi')) {
    d.plan = 'bird';
    if (nm('phoenix')) { d.variant = 'bird'; f.cover = 'emis'; Object.assign(pal, { body: '#ff8a20', wing: '#ffb040', beak: '#ffe080', head: '#ffc040' }); f.wings = 'flame'; f.tailFlame = 1; f.crest = 1; }
    else if (nm('cockatrice')) { Object.assign(pal, { body: '#a0a060', wing: '#8a7a3a', head: '#c04020', beak: '#e0c040' }); f.crest = 1; }
    else if (nm('cauthooj')) { Object.assign(pal, { body: '#4a4a5a', wing: '#3a3a4a', head: '#5a5a7a' }); d.fly = false; f.wings = 'feather'; }
    else if (nm('alce')) { Object.assign(pal, { body: '#7a6a4a', wing: '#5a4a30', head: '#d8d0c0' }); }
    else if (nm('nosoi')) { Object.assign(pal, { body: '#3a3a3a', wing: '#2a2a2a', head: '#e8e0d0', beak: '#e8e0d0' }); f.glowEyes = 1; }
    else Object.assign(pal, { body: '#5a3a24', wing: '#4a3020', head: nm('roc') ? '#d8c8a0' : '#f0f0f0', beak: '#e0b030' });
    d.melee = 'bite'; return done();
  }
  if (nm('pteranodon', 'quetzalcoatlus')) { d.plan = 'bird'; d.variant = 'pterosaur'; f.wings = 'bat'; Object.assign(pal, { body: '#8a6a4a', wing: '#a06a40', beak: '#d8c080' }); d.fly = true; return done(); }
  if (beastOK && nm('bat')) { d.plan = 'bat'; pal.body = '#3a3030'; pal.wing = '#2a2020'; d.fly = true; return done(); }
  if (nm('griffon', 'hippogriff')) { d.plan = 'quadruped'; d.variant = 'griffon'; f.wings = 'feather'; Object.assign(pal, nm('hippogriff') ? { body: '#8a6a4a', head: '#d8c8a8', wing: '#7a5a3a' } : { body: '#b0803a', head: '#f0ece0', wing: '#8a5a2a', mane: '#6a4a2a' }); if (nm('hippogriff')) { d.beast = { foot: 'hoof', leg: 'digi' }; } d.melee = 'bite'; return done(); }
  if (nm('sphinx')) { d.plan = 'quadruped'; d.variant = 'feline'; d.beast = { head: 'human', hs: 1.3, len: 0.6, g: 0.16 }; f.headdress = 1; f.wings = 'feather'; Object.assign(pal, { body: '#c89a50', face: '#b07a50', wing: '#e8d0a0', trim: '#2a4a9a' }); d.fly = false; f.flyOK = 1; d.melee = 'claw'; return done(); }
  if (nm('manticore')) { d.plan = 'quadruped'; d.variant = 'feline'; d.beast = { head: 'human', hs: 1.25, g: 0.16 }; f.wings = 'bat'; Object.assign(pal, { body: '#a0603a', face: '#a87050', wing: '#6a3a2a', mane: '#5a2a1a' }); if (nm('scorpion')) f.stinger = 1; else f.quills = 1; d.tailSpikes = 1; d.ranged = 'spike'; d.melee = 'claw'; return done(); }
  if (nm('chimera')) { d.plan = 'quadruped'; d.variant = 'feline'; f.heads = 3; f.headTypes = ['goat', 'lion', 'dragon']; f.neck = { n: 2, len: 0.22, ang: 0.6, r: 0.07 }; f.wings = 'bat'; f.mane = 0; Object.assign(pal, { body: '#a07a3a', wing: '#6a2a1a', horn: '#3a2a20', mane: '#6a4a24' }); d.melee = 'bite'; return done(); }
  if (nm('gargoyle')) { H('fiend', { outfit: 'none' }); Object.assign(pal, { skin: '#6c6c70', skinMat: 'stone', horn: '#4a4a4c', wing: '#5a5a5e', eye: '#ffb040' }); f.wings = 'bat'; f.horns = 'curved'; f.claws = 1; f.glowEyes = 1; d.build.hunch = 0.35; d.stance = 'claws'; f.tail = 'devil'; f.hair = false; f.noLoin = 1; f.belt = false; return done(); }
  if (nm('harpy')) { H('human', { outfit: 'rags' }); Object.assign(pal, { skin: '#c8a080', body: '#5a3a2a', wing: '#5a3a24', hair: '#2a1a10' }); f.wings = 'feather'; f.talons = 1; f.hairStyle = 'wild'; d.lower = 'goat'; d.melee = 'claw'; return done(); }
  if (nm('vilderavn', 'vanth', 'tengu')) { H('bird', { outfit: nm('tengu') ? 'leather' : 'robe' }); Object.assign(pal, { skin: '#1a1a20', head: '#1a1a24', body: nm('vanth') ? '#2a2a3a' : '#3a3030', wing: '#141418', beak: '#3a3a40' }); if (!nm('tengu')) f.wings = 'feather'; return done(); }
  /* ---------- dinosaurs & reptiles */
  if (nm('tyrannosaurus')) { d.plan = 'biped'; d.variant = 'trex'; Object.assign(pal, { body: '#5a6a3a', belly: '#b8b080' }); return done(); }
  if (nm('raptor', 'velociraptor', 'deinonychus', 'compsognathus')) { d.plan = 'biped'; d.variant = 'raptor'; Object.assign(pal, { body: '#7a6a3a', belly: '#d8c8a0', accent: '#a03020' }); d.melee = 'claw'; return done(); }
  if (nm('pachycephalosaurus')) { d.plan = 'biped'; d.variant = 'pachy'; Object.assign(pal, { body: '#6a7a4a', belly: '#c8c098' }); d.melee = 'gore'; return done(); }
  if (nm('triceratops')) { d.plan = 'quadruped'; d.variant = 'tri'; Object.assign(pal, { body: '#6a6a4a', belly: '#b8b090', accent: '#a05a2a' }); d.melee = 'gore'; return done(); }
  if (nm('stegosaurus')) { d.plan = 'quadruped'; d.variant = 'steg'; Object.assign(pal, { body: '#5a7a4a', belly: '#c8c098', accent: '#b05a2a' }); d.melee = 'tail'; return done(); }
  if (nm('ankylosaurus')) { d.plan = 'quadruped'; d.variant = 'ank'; Object.assign(pal, { body: '#7a6a4a', belly: '#c8b890', horn: '#5a4a3a' }); d.melee = 'tail'; return done(); }
  if (nm('brontosaurus')) { d.plan = 'quadruped'; d.variant = 'sauropod'; Object.assign(pal, { body: '#6a7a6a', belly: '#c8c8b0' }); d.melee = 'tail'; return done(); }
  if (nm('hadrosaur')) { d.plan = 'quadruped'; d.variant = 'hadro'; Object.assign(pal, { body: '#6a8a5a', belly: '#d8d0a0', accent: '#c0602a' }); d.melee = 'tail'; return done(); }
  if (nm('crocodile', 'deinosuchus', 'krooth', 'smaranava')) { d.plan = 'quadruped'; d.variant = 'croc'; pal.body = nm('krooth') ? '#3a4a3a' : '#4a5a32'; pal.belly = '#c8c090'; if (nm('krooth')) f.spikes = 1; return done(); }
  if (nm('basilisk')) { d.plan = 'quadruped'; d.variant = 'lizard'; Object.assign(pal, { body: '#4a6a3a', belly: '#c8b870', eye: '#a0ff40' }); f.glowEyes = 1; f.crown = 1; f.spikes = 1; return done(); }
  if (beastOK && nm('gecko', 'monitor', 'lizard', 'slurk', 'chupacabra', 'quai dau to')) {
    if (nm('quai dau to')) { d.plan = 'quadruped'; d.variant = 'turtle'; Object.assign(pal, { body: '#4a5a4a', shell: '#5a4a30' }); return done(); }
    d.plan = 'quadruped'; d.variant = nm('chupacabra') ? 'canine' : 'lizard';
    Object.assign(pal, nm('gecko') ? { body: '#7a9a5a', belly: '#d8e0b0' } : nm('frilled') ? { body: '#8a6a3a', belly: '#d8c8a0', accent: '#d04020' } : nm('slurk') ? { body: '#6a7a4a', belly: '#c8c890' } : nm('chupacabra') ? { body: '#5a6a4a', belly: '#9aa080' } : { body: '#5a5a3a', belly: '#c0b890' });
    if (nm('frilled')) f.frill = 1; if (nm('chupacabra')) { f.cover = 'scales'; f.spikes = 1; f.ridge = 1; } if (nm('slurk')) f.tusks = 1;
    if (nm('winged')) f.wings = 'bat';
    return done();
  }
  /* ---------- mammals */
  if (nm('owlbear')) { d.plan = 'quadruped'; d.variant = 'owlbear'; Object.assign(pal, { body: '#7a5a3a', head: '#c9a874', face: '#e8d8b0' }); f.ruff = 1; d.melee = 'claw'; return done(); }
  if (beastOK && nm('wolf', 'warg', 'dog', 'hound', 'hellhound', 'hyena', 'hyaenodon', 'barghest', 'elananx', 'pipefox', 'poracha', 'jackal')) {
    d.plan = 'quadruped'; d.variant = nm('elananx', 'poracha') ? 'feline' : 'canine';
    const C = nm('witchwarg') ? '#d8dce8' : nm('warg') ? '#4a4038' : nm('dire') ? '#5a5a60' : nm('wolf') ? '#7a7a80' : nm('hell', 'hellhound') ? '#5a1a10' : nm('goblin dog') ? '#9a8a5a' : nm('hyena', 'hyaenodon') ? '#9a8060' : nm('barghest') ? '#3a3a5a' : nm('elananx') ? '#c06020' : nm('pipefox') ? '#d08040' : nm('poracha') ? '#c0a080' : '#8a6a4a';
    pal.body = C; pal.belly = shade(C, 1.25);
    if (nm('hell', 'hellhound', 'elananx')) { f.flame = 1; f.glowEyes = 1; pal.eye = '#ffb020'; pal.breath = '#ff6a1a'; }
    if (nm('warg', 'barghest')) { f.glowEyes = 1; pal.eye = nm('witchwarg') ? '#a0e0ff' : '#ffd040'; }
    if (nm('hyena')) { f.ridge = 1; pal.mane = '#3a2e22'; }
    if (nm('barghest')) f.horns = 'straight';
    if (nm('pipefox')) d.beast = { len: 0.5, hh: 0.25, sh: 0.25, tail: { n: 6, len: 0.6, r: 0.04, rx: 0.1, bushy: 1 } };
    return done();
  }
  if (beastOK && nm('lion', 'tiger', 'leopard', 'smilodon', 'cat', 'bandersnatch')) {
    d.plan = 'quadruped'; d.variant = 'feline';
    const C = nm('lion') ? '#c8a060' : nm('tiger') ? '#d07a2a' : nm('leopard') ? '#c8a050' : nm('smilodon') ? '#a08050' : nm('bandersnatch') ? '#5a3a5a' : '#8a7a6a';
    pal.body = C; pal.belly = shade(C, 1.35);
    if (nm('lion') && !nm('lioness')) { f.mane = 1; pal.mane = '#7a4a1a'; d.beast = { head: 'lion' }; }
    if (nm('smilodon')) f.saber = 1;
    if (nm('bandersnatch')) { f.quills = 1; f.spikes = 1; f.glowEyes = 1; d.beast = { len: 0.7, g: 0.18 }; }
    d.melee = 'claw'; return done();
  }
  if (nm('bear') && !nm('bugbear') && !has('humanoid')) { d.plan = 'quadruped'; d.variant = 'bear'; pal.body = nm('cave') ? '#4a3a2a' : '#6a4a30'; return done(); }
  if (nm('shuln')) { d.plan = 'quadruped'; d.variant = 'bear'; Object.assign(pal, { body: '#7a6a5a', claw: '#a0a8b0' }); f.ridge = 1; d.melee = 'claw'; return done(); }
  if (beastOK && nm('boar', 'daeodon')) { d.plan = 'quadruped'; d.variant = 'boar'; pal.body = nm('daeodon') ? '#4a3a2a' : '#5a4636'; d.melee = 'gore'; return done(); }
  if (beastOK && nm('rhinoceros')) { d.plan = 'quadruped'; d.variant = 'rhino'; pal.body = nm('woolly') ? '#6a4a30' : '#8a8478'; if (nm('woolly')) f.cover = 'fur'; d.melee = 'gore'; return done(); }
  if (beastOK && nm('elephant', 'mammoth')) { d.plan = 'quadruped'; d.variant = 'elephant'; pal.body = nm('mammoth') ? '#6a4a30' : '#8a8680'; if (nm('mammoth')) { f.cover = 'fur'; f.woolly = 1; } d.melee = 'gore'; return done(); }
  if (beastOK && nm('horse', 'pony', 'unicorn', 'pegasus', 'nightmare')) {
    d.plan = 'quadruped'; d.variant = 'horse';
    const C = nm('unicorn', 'pegasus') ? '#f0ece4' : nm('nightmare') ? '#141418' : nm('war') ? '#4a3020' : pick(r, ['#7a4a2a', '#5a3a24', '#8a6a4a', '#3a2a20']);
    pal.body = C; pal.mane = nm('unicorn', 'pegasus') ? '#f8f0e0' : nm('nightmare') ? '#ff5a1a' : '#2a1a10';
    if (nm('pony')) d.beast = { hh: 0.48, sh: 0.5, len: 0.55 };
    if (nm('unicorn')) { f.unicorn = 1; pal.horn = '#f0d890'; }
    if (nm('pegasus')) { f.wings = 'feather'; pal.wing = '#f8f4ec'; }
    if (nm('nightmare')) { f.flame = 1; f.glowEyes = 1; pal.eye = '#ff6a1a'; d.noWings = true; d.floatFly = true; }
    d.melee = 'stomp'; return done();
  }
  if (nm('gorilla', 'gigantopithecus', 'megaprimatus', 'yeti', 'ape')) { H('ape', { outfit: 'fur', stance: 'knuckle' }); pal.skin = nm('yeti') ? '#e8e8f0' : '#3a3434'; pal.face = nm('yeti') ? '#8aa0b0' : '#2a2424'; d.build = { hunch: 0.45 }; f.noLoin = 1; f.belt = false; d.melee = 'slam'; if (nm('yeti')) f.claws = 1; return done(); }
  if (nm('rat') && !has('humanoid')) { d.plan = 'quadruped'; d.variant = 'rat'; pal.body = '#6a5a4a'; return done(); }
  /* ---------- humanoids & monstrous humanoids */
  if (nm('centaur', 'nuckelavee')) { d.plan = 'centaur'; d.variant = 'human'; if (nm('nuckelavee')) { Object.assign(pal, { skin: '#a03a2a', body: '#a03a2a' }); d.beastPal = '#8a2a20'; f.hair = false; d.outfit = 'none'; } else { Object.assign(pal, { skin: '#c89070', body: '#5a7a3a', hair: '#3a2010' }); d.outfit = 'leather'; f.quiver = rangedW === 'shortbow'; } d.weapon = wpn || rangedW; return done(); }
  if (nm('minotaur')) { H('bull', { outfit: 'barbarian' }); Object.assign(pal, { skin: '#5a3a2a', skinMat: 'fur', fur: '#3a2418' }); d.lower = 'goat'; return done(); }
  if (nm('lamia')) { H('human', { outfit: 'vest', lower: 'snake' }); Object.assign(pal, { skin: '#d8b090', tail: '#a07a3a', belly: '#e8d0a0', body: '#8a2a3a', trim: '#d8b040', hair: '#1a1010' }); f.hairStyle = 'long'; return done(); }
  if (nm('medusa')) { H('human', { outfit: 'robe' }); Object.assign(pal, { skin: '#8aa070', body: '#2a4a3a', trim: '#c8a040', hair: '#4a7a3a', eye: '#f0e040' }); f.snakeHair = 1; f.hair = false; f.glowEyes = 1; return done(); }
  if (has('merfolk') || nm('merfolk')) { H('human', { outfit: 'none', lower: 'fish' }); Object.assign(pal, { skin: '#c8a888', tail: '#2a8a8a', fin: '#4ac0b0', hair: '#2a3a5a' }); f.noLoin = 1; f.belt = false; f.hairStyle = 'long'; return done(); }
  if (nm('grindylow')) { H('fish', { outfit: 'none', lower: 'tentacles' }); pal.skin = '#5a7a6a'; pal.tail = '#4a6a5a'; return done(); }
  if (nm('naiad')) { H('elf', { outfit: 'robe' }); Object.assign(pal, { skin: '#6aa8c8', skinMat: 'glass', body: '#3a7aa0', trim: '#c0f0ff', hair: '#2a6a9a' }); f.hairStyle = 'long'; if (nm('queen')) d.acc = 'crown'; return done(); }
  if (nm('dryad')) { H('elf', { outfit: 'none' }); Object.assign(pal, { skin: '#8a7a5a', skinMat: 'bark', hair: '#4f7a2a', loin: '#4f7a2a' }); f.hairStyle = 'long'; f.leafCloak = 1; f.cape = 1; pal.cape = '#4f7a2a'; if (nm('queen')) d.acc = 'antlers'; return done(); }
  if (nm('satyr')) { H('human', { outfit: 'none', lower: 'goat' }); Object.assign(pal, { skin: '#c89070', hair: '#4a2a1a', horn: '#6a5a40' }); f.horns = 'ram'; f.beard = 'short'; d.weapon = wpn; return done(); }
  if (nm('redcap')) { H('goblin', { outfit: 'rags', acc: 'redcap' }); Object.assign(pal, { skin: '#c8a888', body: '#4a3a2a' }); f.beard = 'long'; pal.hair = '#d8d0c0'; d.weapon = 'halberd'; return done(); }
  if (nm('sprite', 'pixie', 'draxie', 'lyrakien', 'tooth fairy')) { H('elf', { outfit: 'vest' }); Object.assign(pal, { skin: nm('draxie') ? '#e8b0d0' : '#f0d8c8', body: pick(r, ['#5aa06a', '#6a8ad0', '#c070c0', '#e0a040']), hair: pick(r, ['#f0d040', '#e070b0', '#70d0f0']), wing: '#d8f0ff' }); f.wings = 'insect'; d.fly = true; if (nm('lyrakien')) { pal.body = '#e0d0ff'; f.halo = 0; } if (nm('tooth')) { d.variant = 'goblin'; pal.skin = '#a0a8b0'; d.weapon = 'sickle'; } return done(); }
  if (nm('jinkin', 'mitflit', 'pugwampi', 'gimmerling', 'pukwudgie')) { H('goblin', { outfit: 'rags' }); pal.skin = nm('mitflit') ? '#8a9aa0' : nm('pugwampi') ? '#a08a6a' : nm('gimmerling') ? '#8a7a6a' : nm('pukwudgie') ? '#7a6a5a' : '#6a8a6a'; if (nm('pukwudgie')) f.spikes = 1; if (nm('gimmerling')) f.claws = 1; return done(); }
  if (nm('norn')) { H('elf', { outfit: 'robe', acc: 'hood' }); Object.assign(pal, { skin: '#d8c8c0', body: '#e8e8f0', trim: '#c8a040', hood: '#e0e0e8' }); d.build.height = 1.1; d.weapon = 'sickle'; return done(); }
  if (nm('gancanagh', 'balisse', 'tabellia', 'choral', 'cassisian', 'aesra', 'qarna', 'rekhep', 'giylea', 'kanya', 'aeolaeka', 'shining child') || has('angel', 'archon', 'azata')) {
    H('angel', { outfit: has('archon') || nm('rekhep', 'qarna') ? 'plate' : 'robe' });
    Object.assign(pal, { skin: pick(r, ['#f0d8c0', '#c89a70', '#8a5a3a']), body: has('archon') ? '#d8d0b8' : '#f4f0e8', trim: '#d8b040', hair: pick(r, ['#f0e0a0', '#e8e8e8', '#2a1a10']), wing: '#fbf8f0', metal: '#e0d8c0', glow: '#fff0a0' });
    if (has('azata')) { pal.body = pick(r, ['#c060a0', '#60a0c0', '#e0a040']); f.wings = 'insect'; pal.wing = '#ffe0f8'; }
    else f.wings = 'feather';
    if (!nm('kanya')) f.halo = 1; else { f.tail = 'cat'; d.variant = 'cat'; pal.skin = '#d8a040'; }
    if (nm('cassisian')) { d.variant = 'angel'; d.acc = 'helm'; } if (nm('giylea')) d.build.bulk = 1.3;
    if (nm('shining child')) { pal.skin = '#fff0c0'; pal.skinMat = 'emis'; f.wings = null; f.halo = 1; d.outfit = 'none'; f.noLoin = 1; f.belt = false; }
    if (nm('aeolaeka')) { pal.skin = '#8a7a6a'; pal.skinMat = 'stone'; }
    d.fly = !!sp.fly; return done();
  }
  if (has('monitor') || nm('axiomite', 'akhana', 'pleroma', 'vanth', 'yamaraj')) {
    if (nm('yamaraj')) { d.plan = 'dragon'; Object.assign(pal, { body: '#3a2a3a', belly: '#8a6a5a', wing: '#1a1a20', horn: '#d8c8a0', eye: '#ff4040' }); f.glowEyes = 1; f.dhorns = 'ram'; return done(); }
    H('human', { outfit: 'robe' }); Object.assign(pal, { skin: nm('axiomite') ? '#e0c060' : '#c8c0d8', skinMat: 'emis', body: '#f0e8d0', trim: '#4a6ac0', glow: '#ffffff' }); f.hair = false; f.glowEyes = 1; d.floatFly = true; d.noWings = true;
    if (nm('akhana')) f.tail = 'reptile';
    return done();
  }
  if (has('fiend') || has('demon') || has('devil') || has('daemon') || has('qlippoth') || has('rakshasa')) {
    if (nm('imp')) { H('fiend', { outfit: 'none' }); fiendPal(); f.wings = 'bat'; f.tail = 'stinger'; f.horns = 'straight'; d.build.head = 1.3; f.noLoin = 1; f.belt = false; d.melee = 'tail'; return done(); }
    if (nm('raja-krodha')) { H('cat', { outfit: 'vest' }); Object.assign(pal, { skin: '#d08030', skinMat: 'fur', body: '#6a1a2a', trim: '#d8b040' }); d.weapon = 'scimitar'; return done(); }
    if (nm('treerazer')) { d.plan = 'tree'; f.walker = 1; Object.assign(pal, { skin: '#2a1a1a', leaf: '#3a1a2a', eye: '#ff3020' }); d.build = { bulk: 1.4 }; f.horns = 'curved'; d.weapon = 'greataxe'; return done(); }
    if (nm('venedaemon', 'sarglagon', 'gylou')) { H('fiend', { outfit: 'robe' }); fiendPal(); pal.body = '#2a1a2a'; f.chestMaw = nm('venedaemon'); d.lower = nm('sarglagon') ? 'tentacles' : 'legs'; f.horns = 'curved'; return done(); }
    H('fiend', { outfit: has('devil') ? 'vest' : 'none' }); fiendPal(); pal.body = pick(r, ['#2a1a1a', '#1a1a24', '#3a1010']); pal.trim = '#a08040';
    if (has('daemon')) { d.variant = 'skull'; pal.bone = '#b8a890'; pal.skin = '#5a4a40'; pal.body = '#2a2020'; }
    f.horns = has('devil') ? 'curved' : pick(r, ['ram', 'curved', 'bull']);
    if (has('devil') || nm('vordine', 'phistophilus')) f.tail = 'devil';
    if (nm('succubus')) { pal.skin = '#c06070'; f.hairStyle = 'long'; pal.hair = '#1a0a10'; d.outfit = 'vest'; pal.body = '#3a0a1a'; f.horns = 'curved'; }
    if (nm('brimorak', 'vordine')) { d.lower = 'goat'; }
    if (nm('brimorak')) { f.flameHair = 1; d.weapon = 'longsword'; }
    if (nm('shemhazian', 'vrolikai', 'nessari', 'astradaemon', 'leukodaemon')) d.build.bulk = 1.25;
    if (nm('ort')) { d.build.hunch = 0.4; f.claws = 1; }
    if (nm('pusk')) { d.variant = 'goblin'; pal.skin = '#7a4a5a'; }
    if (nm('vrolikai', 'thulgant', 'shemhazian')) f.tail = 'stinger';
    if (nm('shemhazian')) { f.claws = 1; d.build.bulk = 1.4; }
    if (nm('gongorinan')) { d.variant = 'insect'; f.claws = 1; }
    if (nm('balor')) { f.wings = 'bat'; f.flameHair = 1; d.build.bulk = 1.35; f.horns = 'bull'; d.weapon = d.weapon || 'longsword'; pal.skin = '#5a1a10'; }
    if (sp.fly && !nm('astradaemon')) f.wings = 'bat';
    if (nm('astradaemon')) { f.wings = 'bat'; pal.wing = '#30304a'; }
    pal.wing = pal.wing || '#3a1010';
    return done();
  }
  if (has('kobold') || nm('kobold')) { H('kobold', { outfit: 'leather' }); Object.assign(pal, { skin: pick(r, ['#a2552f', '#b0633a', '#c24a2a', '#7a5a8a']), skinMat: 'scales', body: '#5a4a3a', trim: '#c8a040' }); f.tail = 'kobold'; if (nm('mage')) { d.outfit = 'robe'; pal.body = '#7a2a2a'; } return done(); }
  if (has('goblin') || nm('goblin')) { H('goblin', { outfit: 'leather' }); Object.assign(pal, { skin: pick(r, SKINS.goblin), body: '#6a4a2a', trim: '#a03020', eye: '#c02020' }); if (nm('pyro')) d.weapon = 'bomb'; if (nm('chanter')) d.acc = 'hood'; return done(); }
  if (has('hobgoblin')) { H('hobgoblin', { outfit: 'mail', acc: nm('general') ? 'helm' : 'none' }); Object.assign(pal, { skin: '#c8603a', body: '#8a2a1a', trim: '#2a2a2a', hair: '#141414', metal: '#5a5a5a' }); d.cls = 'fighter'; if (nm('soldier')) d.shield = 'heater'; return done(); }
  if (has('orc')) { H('orc', { outfit: nm('veteran', 'commander') ? 'mail' : 'barbarian' }); Object.assign(pal, { skin: pick(r, SKINS.orc), body: '#5a4a3a', trim: '#8a2a1a' }); f.hairStyle = pick(r, ['mohawk', 'short', 'pony']); return done(); }
  if (has('bugbear')) { H('bugbear', { outfit: 'leather' }); Object.assign(pal, { skin: '#8a6a3a', skinMat: 'fur', body: '#4a3a2a' }); f.ears = 'gnome'; return done(); }
  if (has('kholo') || has('gnoll')) { H('hyena', { outfit: 'leather' }); Object.assign(pal, { skin: '#9a8060', skinMat: 'fur', body: '#5a4030', trim: '#a03020', mane: '#3a2e22' }); return done(); }
  if (has('catfolk')) { H('cat', { outfit: 'leather' }); Object.assign(pal, { skin: '#c89a5a', skinMat: 'fur', body: '#6a3a5a' }); f.tail = 'cat'; return done(); }
  if (has('ratfolk') || nm('wererat')) { H('rat', { outfit: 'leather' }); Object.assign(pal, { skin: '#8a7a6a', skinMat: 'fur', body: '#4a4a3a', tailC: '#c89a8a' }); f.tail = 'rat'; return done(); }
  if (has('tengu')) { H('bird', { outfit: 'leather' }); Object.assign(pal, { skin: '#1a1a20', head: '#1a1a24' }); return done(); }
  if (has('lizardfolk') || has('xulgath')) { H('lizard', { outfit: 'scales' }); Object.assign(pal, { skin: has('xulgath') ? '#6a5a4a' : pick(r, ['#4a6a3a', '#5a7a4a', '#3a5a4a']), crest: '#c0502a' }); f.tail = 'reptile'; if (has('xulgath')) f.spikes = 1; if (nm('stargazer')) { d.outfit = 'scales'; d.acc = 'none'; } return done(); }
  if (has('boggard')) { H('frog', { outfit: 'scales' }); Object.assign(pal, { skin: '#5a7a3a', belly: '#c8c890' }); d.build.hunch = 0.2; return done(); }
  if (has('serpentfolk')) { H('snake', { outfit: nm('prophet') ? 'robe' : 'leather' }); Object.assign(pal, { skin: pick(r, ['#4a6a3a', '#6a7a3a', '#3a5a5a']), skinMat: 'scales', body: '#3a2a4a', trim: '#c8a040' }); f.hood = 1; if (st('tail') || has('mutant')) f.tail = 'reptile'; return done(); }
  if (has('locathah') || has('sedacthy')) { H(has('sedacthy') ? 'shark' : 'fish', { outfit: has('sedacthy') ? 'scales' : 'leather' }); Object.assign(pal, { skin: has('sedacthy') ? '#6a7a8a' : '#5a8a7a', skinMat: 'scales', belly: '#d0d8d0' }); return done(); }
  if (has('azarketi')) { H('human', { outfit: 'leather' }); Object.assign(pal, { skin: '#7aa0a8', body: '#2a5a6a', hair: '#1a3a4a' }); return done(); }
  if (has('caligni')) { H('human', { outfit: 'leather', acc: 'hood' }); Object.assign(pal, { skin: '#3a3a40', body: '#1a1a20', hood: '#141418', eye: '#e0e0ff' }); f.glowEyes = 1; return done(); }
  if (has('dero')) { H('gnome', { outfit: 'leather', acc: 'goggles' }); Object.assign(pal, { skin: '#9ab0c0', body: '#3a2a3a', hair: '#e8e8e8' }); f.hairStyle = 'wild'; return done(); }
  if (has('duergar') || nm('hryngar')) { H('dwarf', { outfit: 'mail', acc: 'helm' }); Object.assign(pal, { skin: '#8a8a8e', body: '#3a3a40', hair: '#4a4a4a', metal: '#5a5a60' }); f.beard = 'long'; return done(); }
  if (has('dwarf')) { H('dwarf', { outfit: nm('stonecaster') ? 'robe' : 'mail', acc: nm('warrior') ? 'helm' : 'none' }); Object.assign(pal, { skin: pick(r, SKINS.dwarf), body: '#6a4a2a', hair: pick(r, HAIRS) }); f.beard = 'long'; return done(); }
  if (has('gnome')) { H('gnome', { outfit: 'leather' }); Object.assign(pal, { skin: nm('umbral') ? '#6a6a7a' : pick(r, SKINS.gnome), body: '#4a5a6a', hair: nm('umbral') ? '#e8e8e8' : pick(r, GNOME_HAIRS) }); if (nm('bard')) { d.cls = 'bard'; d.outfit = 'bard'; f.lute = 1; d.acc = 'feather'; } return done(); }
  if (has('halfling')) { H('halfling', { outfit: 'vest' }); Object.assign(pal, { skin: pick(r, SKINS.halfling), body: '#6a7a3a', hair: pick(r, HAIRS) }); return done(); }
  if (has('elf')) { H('elf', { outfit: 'leather', acc: 'hood' }); Object.assign(pal, { skin: pick(r, SKINS.elf), body: '#3a5a3a', hair: pick(r, HAIRS) }); f.quiver = !!rangedW; return done(); }
  if (has('werecreature')) { const v = n.includes('wolf') ? 'hyena' : n.includes('rat') ? 'rat' : n.includes('tiger') ? 'cat' : 'bugbear'; H(v, { outfit: 'rags' }); Object.assign(pal, { skin: n.includes('tiger') ? '#d07a2a' : n.includes('bear') ? '#5a3a24' : '#6a6060', skinMat: 'fur', body: '#4a3a2a' }); f.claws = 1; if (n.includes('bear')) d.build.bulk = 1.4; if (n.includes('tiger')) f.tail = 'cat'; return done(); }
  if (has('hag') || nm('hag')) { H('hag', { outfit: 'rags' }); Object.assign(pal, { skin: nm('sea') ? '#6a8a7a' : nm('iron') ? '#6a6a6a' : nm('sweet') ? '#c8a0a0' : '#8a9a6a', body: '#3a2a2a', hair: nm('sweet') ? '#f0f0f0' : '#2a2a20' }); f.claws = 1; d.build.hunch = 0.35; f.ragged = 1; return done(); }
  if (has('giant') || nm('giant', 'ogre', 'troll', 'cyclops', 'oni')) {
    if (nm('oni')) { H('oni', { outfit: 'barbarian' }); pal.skin = nm('caldera') ? '#b03a2a' : nm('island') ? '#3a6aa0' : nm('snow') ? '#d0e0f0' : '#7a5a3a'; f.horns = 'many'; f.tusks = 1; pal.hair = '#141010'; pal.fur = '#3a2a2a'; f.hairStyle = 'wild'; d.weapon = wpn || 'tetsubo'; return done(); }
    if (nm('troll')) { H('troll', { outfit: 'rags', stance: 'claws' }); pal.skin = '#5a7a4a'; pal.hair = '#2a3a1a'; f.claws = 1; d.build.hunch = 0.4; f.hairStyle = 'wild'; return done(); }
    if (nm('ogre')) { H('ogre', { outfit: 'barbarian' }); Object.assign(pal, { skin: '#a88a6c', fur: '#5a4a3a', hair: '#2a2018' }); d.build.belly = nm('glutton') ? 1.5 : 1.25; d.build.hunch = 0.15; f.hairStyle = 'wild'; d.weapon = wpn || 'greatclub'; return done(); }
    if (nm('cyclops')) { H('cyclops', { outfit: 'barbarian' }); Object.assign(pal, { skin: '#c09a7a', fur: '#6a5a4a', hair: '#3a2a1a' }); f.hairStyle = 'short'; if (nm('great')) f.horns = 'single'; d.weapon = wpn || 'greataxe'; return done(); }
    H('giant', { outfit: 'barbarian' });
    if (nm('fire')) Object.assign(pal, { skin: '#3a2a28', hair: '#d0401a', body: '#5a2a1a', metal: '#3a3a3a' }), d.outfit = 'mail', f.beard = 'long';
    else if (nm('frost')) Object.assign(pal, { skin: '#b8d0e0', hair: '#f0f0f0', fur: '#e8e8e0' }), f.beard = 'long';
    else if (nm('stone')) Object.assign(pal, { skin: '#8a8a84', skinMat: 'stone', hair: '#3a3a38' }), f.hair = false;
    else if (nm('cloud')) Object.assign(pal, { skin: '#e0d8e8', hair: '#d0d8f0', body: '#c8d0e8', trim: '#4a6ab0' }), d.outfit = 'robe';
    else if (nm('marsh')) Object.assign(pal, { skin: '#6a7a4a', hair: '#2a3a20' }), d.build.hunch = 0.25;
    else if (nm('shadow')) Object.assign(pal, { skin: '#3a3a44', hair: '#141418', body: '#1a1a20' }), d.outfit = 'leather';
    else if (nm('rune')) Object.assign(pal, { skin: '#5a4a5a', hair: '#1a1a1a', body: '#3a1a2a', metal: '#4a4a50' }), d.outfit = 'plate', f.runes = 1, pal.glow = '#ff6040';
    else if (nm('storm')) Object.assign(pal, { skin: '#8aa0b0', hair: '#e0e8f0', body: '#2a4a7a', trim: '#e0c040' }), d.outfit = 'mail', f.beard = 'long';
    else if (nm('hill')) Object.assign(pal, { skin: '#b08a6a', hair: '#4a3020', fur: '#6a5040' });
    else Object.assign(pal, { skin: '#c09a7a', hair: '#4a3020' });
    d.weapon = wpn || 'greatclub';
    return done();
  }
  if (nm('dromaar')) { H('orc', { outfit: 'leather' }); pal.skin = '#a89070'; return done(); }
  if (nm('sinspawn') || nm('spawn')) { H('fiend', { outfit: 'rags' }); pal.skin = nm('envy') ? '#5a8a5a' : nm('gluttony') ? '#c08a7a' : nm('greed') ? '#c0a040' : nm('lust') ? '#c06090' : nm('pride') ? '#8a6ab0' : nm('sloth') ? '#8a8a7a' : '#b04030'; f.chestMaw = 1; f.claws = 1; f.hair = false; return done(); }
  if (nm('nilith', 'ugothol')) { H('human', { outfit: 'robe' }); pal.skin = nm('nilith') ? '#7a8a9a' : '#c8c8c0'; f.hair = false; f.claws = 1; f.chestEye = nm('nilith'); return done(); }
  /* ---------- generic humans & fallbacks */
  if (has('humanoid') || has('human')) {
    H('human', {});
    Object.assign(pal, { skin: pick(r, SKINS.human), hair: pick(r, HAIRS), body: pick(r, ['#5a4a3a', '#3a4a5a', '#6a3a3a', '#4a5a3a']), trim: '#c8a040' });
    if (nm('wizard', 'adept', 'elementalist', 'mage', 'caster', 'cultist')) { d.outfit = 'robe'; d.acc = nm('wizard') ? 'wizard' : 'hood'; d.cls = 'wizard'; f.book = 1; d.weapon = wpn || 'staff'; }
    else if (nm('warpriest', 'priest', 'cleric')) { d.outfit = 'mail'; d.cls = 'cleric'; f.symbol = 1; }
    else if (nm('hunter', 'ranger', 'scout')) { d.outfit = 'leather'; d.acc = 'hood'; f.quiver = 1; }
    else if (nm('captain', 'knight', 'guard', 'soldier', 'warrior')) { d.outfit = 'mail'; d.acc = 'helm'; d.cls = 'fighter'; }
    else if (nm('bandit', 'thug', 'exile')) { d.outfit = 'leather'; d.acc = r() < 0.5 ? 'hood' : 'none'; }
    if (has('dhampir')) { pal.skin = '#e0d8d8'; pal.eye = '#a01010'; }
    if (has('duskwalker')) { pal.skin = '#a0a0a8'; pal.hair = '#e0e0e0'; }
    if (has('changeling')) { pal.eye = '#80c0a0'; f.hairStyle = 'long'; pal.hair = '#1a1a1a'; }
    if (has('nephilim') || nm('pitborn', 'lawbringer')) { f.horns = nm('pitborn') ? 'straight' : null; f.halo = nm('lawbringer') ? 1 : 0; }
    if (has('aiuvarin')) { f.ears = 'half'; }
    return done();
  }
  /* ---------- trait fallbacks */
  d.generic = true;
  if (has('animal', 'beast')) { d.plan = 'quadruped'; d.variant = st('hoof') ? 'horse' : st('claw') ? 'feline' : 'canine'; pal.body = '#7a6a5a'; if (sp.fly) f.wings = 'feather'; if (sp.swim && !sp.land) d.plan = 'fish'; return done(); }
  if (has('plant', 'fungus', 'wood')) { d.plan = 'plant'; d.variant = 'heap'; return done(); }
  if (has('aberration')) { d.plan = 'aberration'; return done(); }
  if (has('fey')) { H('elf', { outfit: 'vest' }); return done(); }
  if (has('aquatic')) { d.plan = 'fish'; return done(); }
  if (has('spirit', 'astral', 'ethereal')) { d.plan = 'ghost'; d.floatFly = true; return done(); }
  H('human', {}); return done();
}
/*__MODELS_PART10__*/





/* ============================================================ hero descriptors */
const CLASS_KIT = {
  fighter: { outfit: 'mail', acc: 'helm', f: { pouches: 1 } },
  champion: { outfit: 'plate', acc: 'helm', f: { tabard: 1, cape: 1, symbol: 0 } },
  barbarian: { outfit: 'barbarian', acc: 'none', f: {} },
  rogue: { outfit: 'leather', acc: 'hood', f: { pouches: 1 } },
  ranger: { outfit: 'leather', acc: 'hood', f: { cape: 1, quiver: 1 } },
  monk: { outfit: 'monk', acc: 'none', f: {} },
  bard: { outfit: 'bard', acc: 'feather', f: { lute: 1, cape: 'short' } },
  cleric: { outfit: 'robe', acc: 'none', f: { symbol: 1 } },
  wizard: { outfit: 'robe', acc: 'wizard', f: { book: 1 } },
  sorcerer: { outfit: 'robe', acc: 'none', f: { runes: 1, wisps: 1 } },
  druid: { outfit: 'leather', acc: 'antlers', f: { cape: 1, leafCloak: 1 } }
};
const WID_ALIAS = { bastardsword: 'bastard', 'bastard sword': 'bastard', heavycrossbow: 'hcrossbow', handcrossbow: 'handxbow', compositelongbow: 'clongbow', compositeshortbow: 'cshortbow', battleaxe: 'battleaxe' };
function heroDesc(u) {
  const look = u.look || {}, cls = u.cls || 'fighter', anc = u.anc || 'human';
  const seed = hashStr((u.name || '') + '|' + cls + '|' + anc + '|' + (u.id || ''));
  const r = rng(seed);
  const kit = CLASS_KIT[cls] || CLASS_KIT.fighter;
  const variant = HUMV[anc] ? anc : 'human';
  const skin = pick(r, SKINS[anc] || SKINS.human);
  let hair = pick(r, HAIRS); if (anc === 'gnome') hair = pick(r, GNOME_HAIRS); if (anc === 'elf' && r() < 0.4) hair = pick(r, ['#e8dcb0', '#c8c8d0', '#2a1d14', '#a0522d']);
  const f = Object.assign({}, kit.f);
  if (anc === 'dwarf') f.beard = 'long';
  else if ((anc === 'human' || anc === 'orc' || anc === 'halfling') && r() < 0.3) f.beard = r() < 0.4 ? 'long' : 'short';
  if (anc === 'orc' && r() < 0.5) f.hairStyle = 'mohawk';
  if (anc === 'elf') f.hairStyle = pick(r, ['long', 'pony', 'long']);
  let outfit = kit.outfit;
  const cat = u.armorCat || (u.sheet && u.sheet.armor && u.sheet.armor.cat);
  if (cls === 'fighter' && cat === 'heavy') outfit = 'plate';
  if (cls === 'cleric' && (cat === 'medium' || cat === 'heavy' || u.sub === 'warpriest')) outfit = 'mail';
  let acc = look.acc != null ? look.acc : kit.acc;
  if (acc === 'hat') acc = (cls === 'wizard' || cls === 'sorcerer') ? 'wizard' : cls === 'bard' ? 'feather' : 'hat';
  if (acc === 'none' && look.acc == null && cls === 'druid') acc = 'antlers';
  // weapon
  const strikes = u.strikes || [];
  let main = strikes[0];
  if (main && (main.wid === 'fist' || main.group === 'brawling') && strikes.length > 1 && cls !== 'monk') main = strikes.find(s => s.wid !== 'fist') || main;
  let wid = main ? (WID_ALIAS[main.wid] || main.wid) : null;
  if (wid && !WEAPONS[wid]) wid = weaponFromName(main.name || wid) || weaponFromGroup(main.group);
  if (cls === 'monk' && (!wid || wid === 'fist')) wid = 'fist';
  let shield = null;
  if (u.shield) { const nm = String(u.shield.name || u.shield.id || '').toLowerCase(); shield = u.shield.tower || nm.includes('tower') ? 'tower' : nm.includes('buckler') ? 'buckler' : nm.includes('wood') ? 'round' : (cls === 'cleric' || cls === 'champion' || cls === 'fighter') ? 'heater' : 'round'; }
  let offhand = null;
  const melees = strikes.filter(s => s.kind === 'melee' && s.wid && s.wid !== 'fist');
  if (!shield && melees.length > 1 && (cls === 'rogue' || cls === 'ranger') && WEAPONS[melees[1].wid] && (WEAPONS[melees[1].wid].h || 1) === 1 && (WEAPONS[wid] && (WEAPONS[wid].h || 1) === 1) && WEAPONS[wid].t !== 'bow') offhand = melees[1].wid;
  const body = look.body || pick(r, ['#6c7a8c', '#7a3a3a', '#3a5a3a', '#4a4a6a', '#8a6a3a']);
  const trim = look.trim || '#c8a24a';
  const pal = { body, trim, skin, hair, eye: anc === 'goblin' ? '#c02020' : '#1a1410', glow: cls === 'sorcerer' ? pick(r, ['#c060ff', '#ff7040', '#60c0ff', '#60ff90']) : cls === 'druid' ? '#90ff70' : cls === 'cleric' ? '#ffe9a0' : '#8fd0ff' };
  if (cls === 'ranger' || cls === 'druid') pal.cape = mix(body, '#3a4a2a', 0.45);
  if (cls === 'champion') { pal.cape = body; pal.tabard = body; }
  if (cls === 'rogue') pal.hood = shade(body, 0.8);
  if (cls === 'barbarian') pal.fur = pick(r, ['#6b5640', '#8a7a68', '#4a3a2a', '#a09080']);
  return {
    plan: 'humanoid', name: u.name || cls, size: normSize(u.size || (anc === 'gnome' || anc === 'goblin' || anc === 'halfling' ? 'small' : 'medium')), seed, variant,
    cls, outfit, acc, weapon: wid, offhand, shield, palette: pal, f, build: {}, hero: true
  };
}
function weaponFromGroup(g) { return { sword: 'longsword', axe: 'battleaxe', hammer: 'warhammer', club: 'mace', flail: 'flail', polearm: 'glaive', spear: 'spear', knife: 'dagger', bow: 'shortbow', sling: 'sling', dart: 'javelin', brawling: 'fist', pick: 'pick' }[g] || 'longsword'; }
function weaponFromName(n) {
  n = String(n || '').toLowerCase();
  const T = [[/bastard/, 'bastard'], [/greatsword|great sword|zweih/, 'greatsword'], [/katana/, 'katana'], [/wakizashi|shortsword|short sword|gladius/, 'shortsword'], [/scimitar|taravari|flaming sword/, 'scimitar'], [/falchion/, 'falchion'], [/rapier/, 'rapier'],
    [/longsword|long sword|sword/, 'longsword'], [/dogslicer/, 'dogslicer'], [/kukri/, 'kukri'], [/dagger|knife|clan dagger/, 'dagger'], [/greataxe|great axe/, 'greataxe'], [/necksplitter/, 'necksplitter'], [/hatchet/, 'hatchet'], [/axe/, 'battleaxe'],
    [/maul/, 'maul'], [/light hammer/, 'lighthammer'], [/warhammer|hammer/, 'warhammer'], [/tetsubo/, 'tetsubo'], [/greatclub/, 'greatclub'], [/morningstar/, 'morningstar'], [/light mace/, 'lightmace'], [/mace/, 'mace'], [/club|baton|bone|hunk/, 'club'],
    [/war flail/, 'warflail'], [/spiked chain|chain/, 'chain'], [/flail/, 'flail'], [/light pick/, 'lightpick'], [/pick/, 'pick'], [/bo staff|staff/, 'staff'], [/scythe/, 'scythe'], [/sickle|shears/, 'sickle'],
    [/glaive/, 'glaive'], [/halberd/, 'halberd'], [/guisarme/, 'guisarme'], [/ranseur/, 'ranseur'], [/horsechopper/, 'horsechopper'], [/ogre hook|gaff/, 'ogrehook'], [/longspear/, 'longspear'], [/lance/, 'lance'], [/trident/, 'trident'], [/javelin/, 'javelin'], [/spear/, 'spear'],
    [/whip/, 'whip'], [/composite longbow/, 'clongbow'], [/composite shortbow/, 'cshortbow'], [/longbow/, 'longbow'], [/shortbow|bow/, 'shortbow'], [/heavy crossbow/, 'hcrossbow'], [/hand crossbow/, 'handxbow'], [/crossbow/, 'crossbow'],
    [/sling/, 'sling'], [/dart|blowgun/, 'dart'], [/bomb|grenade|flask/, 'bomb'], [/frying pan/, 'pan'], [/fork/, 'fork'], [/bristles|broom/, 'broom']];
  for (const [re, id] of T) if (re.test(n)) return id;
  return null;
}

/* ============================================================ public API */
function create(desc) {
  desc = Object.assign({}, desc || {});
  if (!PLANS[desc.plan]) desc.plan = 'humanoid';
  desc.f = Object.assign({}, desc.f || {}); desc.palette = Object.assign({}, desc.palette || {}); desc.build = Object.assign({}, desc.build || {});
  desc.size = normSize(desc.size);
  const key = JSON.stringify(desc);
  const fig = new Figure(desc);
  const plan = PLANS[desc.plan];
  fig.fam = plan.fam;
  plan.build(fig);
  fig.finalize();
  fig.bake(key);
  fig.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(fig.scaler);
  fig.height = Math.max(0.2, box.max.y);
  fig.footprint = { x: box.max.x - box.min.x, z: box.max.z - box.min.z };
  fig.update(0);
  if (fig.canFly && fig.flying) fig.height += (fig.hoverH || 0.5) * fig.S;
  return fig;
}
function descForUnit(u) {
  if (!u) return { plan: 'humanoid' };
  if (u.kind === 'pc' || u.hero) return heroDesc(u);
  const strikes = (u.strikes || []).map(s => s.name || s.wid || '');
  const d = descForCreature(u.name, u.traits || [], u.size, strikes, u.speed || {});
  if (d.generic && u.color) d.palette.body = d.palette.skin = u.color;
  if (u.shield && d.plan === 'humanoid' && !d.shield) d.shield = 'heater';
  return d;
}
PF.Models = {
  create, descForUnit, descForCreature,
  plans: Object.keys(PLANS),
  sizeScale: s => SIZE_S[normSize(s)], normSize,
  weapons: Object.keys(WEAPONS),
  _internals: { PLANS, FAM, WEAPONS, MATS, GEO }
};




})(typeof window !== 'undefined' ? window : globalThis);
