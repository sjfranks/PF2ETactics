/* render3d.js — Three.js battlefield: terrain, figures, overlays, camera, animations */
(function (G) {
'use strict';
const PF = G.PF;

PF.Render = function (host) {
  const THREE = G.THREE;
  const R = { units: {}, layers: {}, anims: [], speed: 1, onFrame: null, hoverCell: null };
  const HL = 0.7; // world height per elevation level
  R.HL = HL;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(G.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  host.appendChild(renderer.domElement);
  renderer.domElement.className = 'r3d';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d1214');
  scene.fog = new THREE.Fog('#0d1214', 30, 70);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const hemi = new THREE.HemisphereLight('#cfe3ff', '#3a2f22', 0.75); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe9c4', 0.95); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target);
  const world = new THREE.Group(); scene.add(world);
  const overlay = new THREE.Group(); scene.add(overlay);
  const figs = new THREE.Group(); scene.add(figs);
  const fxg = new THREE.Group(); scene.add(fxg);
  R.scene = scene; R.camera = camera; R.renderer = renderer;

  /* ---------- camera ---------- */
  const cam = { tx: 10, tz: 10, yaw: 0.6, pitch: 0.95, dist: 26, gyaw: 0.6, gtx: 10, gtz: 10, gdist: 26, gpitch: 0.95 };
  R.cam = cam;
  const applyCam = () => {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    camera.position.set(cam.tx + Math.sin(cam.yaw) * cp * cam.dist, sp * cam.dist + (R.baseY || 0), cam.tz + Math.cos(cam.yaw) * cp * cam.dist);
    camera.lookAt(cam.tx, R.baseY || 0, cam.tz);
  };
  R.resize = () => {
    const w = host.clientWidth || 800, h = host.clientHeight || 600;
    renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h; camera.fov = w / h < 0.8 ? 55 : 38; camera.updateProjectionMatrix();
  };
  R.focus = (x, y, instant) => { cam.gtx = x; cam.gtz = y; if (instant) { cam.tx = x; cam.tz = y; } };
  R.rotate = d => { cam.gyaw += d; };
  R.zoom = f => { cam.gdist = Math.max(7, Math.min(48, cam.gdist * f)); };
  R.tilt = d => { cam.gpitch = Math.max(0.45, Math.min(1.35, cam.gpitch + d)); };
  R.pan = (dx, dz) => {
    const s = cam.dist / 26; const c = Math.cos(cam.yaw), sn = Math.sin(cam.yaw);
    cam.gtx += (dx * c + dz * sn) * s; cam.gtz += (-dx * sn + dz * c) * s;
    cam.gtx = Math.max(-2, Math.min((R.W || 20) + 2, cam.gtx)); cam.gtz = Math.max(-2, Math.min((R.H || 20) + 2, cam.gtz));
  };

  /* ---------- materials ---------- */
  const mats = {};
  const M = (key, o) => mats[key] || (mats[key] = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9, metalness: 0.02 }, o)));
  const col = c => new THREE.Color(c);
  const BASE = { grass: '#5b7340', dirt: '#7b6747', stone: '#6f6c66', cave: '#4b4641', ash: '#3f3a37' };
  const TCOL = { ',': '#8a7354', ':': '#87847b', '=': '#7a5a37', '+': '#8f8b82', 'R': '#7c4434', 'r': '#6e6a63', ';': null, '~': '#4d3d2a', 'w': '#355f74', 'W': '#22445a', 'L': '#2a1a14', 'F': null, '_': '#2b2825' };
  const rand = (x, y, k = 0) => { const s = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };

  /* ---------- terrain ---------- */
  R.loadMap = B => {
    [world, overlay, figs, fxg].forEach(g => { while (g.children.length) g.remove(g.children[0]); });
    R.units = {}; R.layers = {}; R.B = B; R.W = B.W; R.H = B.H;
    const base = BASE[B.map.base] || BASE.grass;
    const box = new THREE.BoxGeometry(1, 1, 1);
    const n = B.W * B.H;
    const ground = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.95 }), n);
    ground.receiveShadow = true; ground.castShadow = true;
    const m4 = new THREE.Matrix4(); let i = 0;
    let maxH = 0;
    const lavaTiles = [], waterTiles = [];
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
      const t = B.tile(x, y); maxH = Math.max(maxH, t.h);
      let top = t.h * HL;
      if (t.terr === 'w') top -= 0.18; if (t.terr === 'W') top -= 0.42; if (t.terr === 'L') top -= 0.12;
      const bottom = -1.2; const hh = top - bottom;
      m4.makeScale(1, hh, 1); m4.setPosition(x + 0.5, bottom + hh / 2, y + 0.5); ground.setMatrixAt(i, m4);
      let c = TCOL[t.terr] || base; if (t.obj === '#') c = '#5c5852';
      const cc = col(c); const v = 0.92 + rand(x, y) * 0.16; cc.multiplyScalar(v);
      if (t.terr === 'R' && (x + y) % 2) cc.multiplyScalar(0.92);
      ground.setColorAt(i, cc); i++;
      if (t.terr === 'L') lavaTiles.push(t); if (t.water) waterTiles.push(t);
      R.addObject(t, top);
      R.addTerrainDeco(t, top);
    }
    ground.instanceColor.needsUpdate = true; world.add(ground); R.ground = ground;
    // water surfaces
    if (waterTiles.length) {
      const wm = new THREE.MeshStandardMaterial({ color: '#3f86a8', transparent: true, opacity: 0.62, roughness: 0.2, metalness: 0.1 });
      waterTiles.forEach(t => { const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wm); p.rotation.x = -Math.PI / 2; p.position.set(t.x + 0.5, t.h * HL - 0.06, t.y + 0.5); world.add(p); });
      R.waterMat = wm;
    }
    if (lavaTiles.length) {
      const lm = new THREE.MeshStandardMaterial({ color: '#ff5a1a', emissive: '#ff3a00', emissiveIntensity: 1.2, roughness: 0.6 });
      lavaTiles.forEach(t => { const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lm); p.rotation.x = -Math.PI / 2; p.position.set(t.x + 0.5, t.h * HL - 0.08, t.y + 0.5); world.add(p); });
      R.lavaMat = lm;
      const glow = new THREE.PointLight('#ff6a2a', 0.8, 9); const c = lavaTiles[Math.floor(lavaTiles.length / 2)]; glow.position.set(c.x + 0.5, 1.5, c.y + 0.5); world.add(glow);
    }
    // grid lines
    const pts = [];
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
      const t = B.tile(x, y); if (t.los || t.block) continue;
      const yy = t.h * HL + 0.012 - (t.terr === 'w' ? 0.1 : t.terr === 'W' ? 0.36 : 0);
      pts.push(x, yy, y, x + 1, yy, y, x + 1, yy, y, x + 1, yy, y + 1, x + 1, yy, y + 1, x, yy, y + 1, x, yy, y + 1, x, yy, y);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22 }));
    world.add(grid);
    // deploy zones
    R.baseY = 0;
    const span = Math.max(B.W, B.H);
    sun.position.set(B.W / 2 - span * 0.5, 22, B.H / 2 - span * 0.35); sun.target.position.set(B.W / 2, 0, B.H / 2);
    const sc = sun.shadow.camera; sc.left = -span * 0.8; sc.right = span * 0.8; sc.top = span * 0.8; sc.bottom = -span * 0.8; sc.near = 1; sc.far = 70; sc.updateProjectionMatrix();
    if (B.map.base === 'cave') { scene.background = col('#0b0d0e'); hemi.intensity = 0.55; sun.intensity = 0.6; }
    else if (B.map.base === 'ash') { scene.background = col('#140c0a'); scene.fog.color = col('#140c0a'); hemi.intensity = 0.6; sun.intensity = 0.7; sun.color = col('#ffb48a'); }
    else { scene.background = col('#0d1214'); scene.fog.color = col('#0d1214'); hemi.intensity = 0.75; sun.intensity = 0.95; sun.color = col('#ffe9c4'); }
    cam.tx = cam.gtx = B.W / 2; cam.tz = cam.gtz = B.H / 2 + 2;
    R.resize();
  };
  const addMesh = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = o.cast !== false; m.receiveShadow = true; if (o.ry) m.rotation.y = o.ry; if (o.s) m.scale.set(o.s[0], o.s[1], o.s[2]); world.add(m); return m; };
  R.addObject = (t, top) => {
    const x = t.x + 0.5, z = t.y + 0.5, r = rand(t.x, t.y, 3);
    switch (t.obj) {
      case '#': { const h = 2.4 + rand(t.x, t.y, 1) * 0.3; addMesh(new THREE.BoxGeometry(1, h, 1), M('wall', { color: '#8a8378' }), x, top + h / 2, z); addMesh(new THREE.BoxGeometry(1.02, 0.12, 1.02), M('wallcap', { color: '#6d675e' }), x, top + h + 0.06, z); break; }
      case 'P': addMesh(new THREE.CylinderGeometry(0.3, 0.36, 3, 10), M('pillar', { color: '#a59c8c' }), x, top + 1.5, z); addMesh(new THREE.BoxGeometry(0.8, 0.2, 0.8), M('pillar'), x, top + 0.1, z); addMesh(new THREE.BoxGeometry(0.8, 0.2, 0.8), M('pillar'), x, top + 2.95, z); break;
      case 'T': { const s = 0.85 + r * 0.4; addMesh(new THREE.CylinderGeometry(0.12, 0.18, 1.1 * s, 7), M('trunk', { color: '#5a4029' }), x, top + 0.55 * s, z);
        const fol = M('leaf' + (r > 0.5 ? 'a' : 'b'), { color: r > 0.5 ? '#3b5e2b' : '#466a2f', flatShading: true });
        addMesh(new THREE.ConeGeometry(0.62 * s, 1.3 * s, 7), fol, x, top + 1.45 * s, z, { ry: r * 6 }); addMesh(new THREE.ConeGeometry(0.46 * s, 1.0 * s, 7), fol, x, top + 2.05 * s, z, { ry: r * 3 }); break; }
      case 's': addMesh(new THREE.BoxGeometry(0.7, 0.4, 0.7), M('stone2', { color: '#9b968c' }), x, top + 0.2, z); addMesh(new THREE.CylinderGeometry(0.18, 0.24, 1.2, 8), M('stone2'), x, top + 1.0, z); addMesh(new THREE.SphereGeometry(0.18, 10, 8), M('stone2'), x, top + 1.75, z); break;
      case 'c': addMesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), M('crate', { color: '#8b6a3e' }), x, top + 0.4, z, { ry: (r - 0.5) * 0.4 }); break;
      case 'b': addMesh(new THREE.CylinderGeometry(0.3, 0.3, 0.85, 12), M('barrel', { color: '#6e4f30' }), x, top + 0.425, z); addMesh(new THREE.TorusGeometry(0.3, 0.025, 4, 16), M('iron', { color: '#3a3a3a', metalness: 0.6, roughness: 0.4 }), x, top + 0.25, z).rotation.x = Math.PI / 2; break;
      case 'f': addMesh(new THREE.BoxGeometry(1, 0.6, 0.5), M('lowwall', { color: '#8d877b' }), x, top + 0.3, z, { ry: ((t.x + t.y) % 2) ? 0 : Math.PI / 2 }); break;
      case 'o': addMesh(new THREE.DodecahedronGeometry(0.45, 0), M('boulder', { color: '#7a756c', flatShading: true }), x, top + 0.35, z, { ry: r * 6, s: [1, 0.8, 1] }); break;
      case 'S': addMesh(new THREE.BoxGeometry(0.62, 0.6, 0.95), M('sarc', { color: '#a19a8a' }), x, top + 0.3, z); addMesh(new THREE.BoxGeometry(0.7, 0.1, 1.0), M('sarctop', { color: '#7f7a6e' }), x, top + 0.65, z); break;
      case 'A': addMesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), M('altar', { color: '#c9c0a8' }), x, top + 0.4, z); addMesh(new THREE.BoxGeometry(0.96, 0.08, 0.96), M('gold', { color: '#c79a3a', metalness: 0.7, roughness: 0.35 }), x, top + 0.82, z); break;
      case 't': addMesh(new THREE.BoxGeometry(0.9, 0.08, 0.9), M('wood', { color: '#7a5634' }), x, top + 0.55, z); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => addMesh(new THREE.BoxGeometry(0.07, 0.55, 0.07), M('wood'), x + a * 0.36, top + 0.27, z + b * 0.36)); break;
    }
  };
  R.addTerrainDeco = (t, top) => {
    const x = t.x + 0.5, z = t.y + 0.5;
    if (t.terr === ';') { const m = M('brush', { color: '#4f7a33', flatShading: true }); for (let k = 0; k < 3; k++) { const r1 = rand(t.x, t.y, k), r2 = rand(t.y, t.x, k + 5); addMesh(new THREE.IcosahedronGeometry(0.22 + r1 * 0.1, 0), m, x + (r1 - 0.5) * 0.6, top + 0.18, z + (r2 - 0.5) * 0.6, { s: [1, 0.8, 1] }); } }
    if (t.terr === 'r') { const m = M('rubble', { color: '#7f7a70', flatShading: true }); for (let k = 0; k < 4; k++) { const r1 = rand(t.x, t.y, k + 9), r2 = rand(t.y, t.x, k + 2); addMesh(new THREE.BoxGeometry(0.18 + r1 * 0.15, 0.12 + r2 * 0.12, 0.2), m, x + (r1 - 0.5) * 0.7, top + 0.07, z + (r2 - 0.5) * 0.7, { ry: r1 * 4 }); } }
    if (t.terr === '+') { const m = M('step', { color: '#9c978d' }); for (let k = 0; k < 3; k++) addMesh(new THREE.BoxGeometry(1, 0.08, 0.3), m, x, top + 0.04 + k * 0.0, z - 0.33 + k * 0.33, { cast: false }); }
    if (t.terr === 'F') { const m = new THREE.MeshBasicMaterial({ color: '#cfd8dc', transparent: true, opacity: 0.16, depthWrite: false }); for (let k = 0; k < 2; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), m); p.position.set(x + (rand(t.x, t.y, k) - 0.5) * 0.4, top + 0.5 + k * 0.4, z); p.scale.set(1, 0.6, 1); world.add(p); (R.mist = R.mist || []).push(p); } }
    if (t.terr === '=') { const m = M('plank', { color: '#8a6640' }); for (let k = 0; k < 4; k++) addMesh(new THREE.BoxGeometry(0.22, 0.05, 0.98), m, t.x + 0.14 + k * 0.24, top + 0.025, z, { cast: false }); }
  };
  const OBJTOP = { f: 0.6, S: 0.7, t: 0.6 };
  R.tileTop = (x, y, withObj) => { const t = R.B && R.B.tile(Math.floor(x), Math.floor(y)); if (!t) return 0; let top = t.h * HL; if (t.terr === 'w') top -= 0.12; if (t.terr === 'W') top -= 0.3; if (withObj && t.obj && OBJTOP[t.obj]) top += OBJTOP[t.obj]; return top; };

  /* ---------- figures ---------- */
  const TEAMC = { pc: '#4fa8e0', foe: '#e0524a' };
  const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75 }, o || {}));
  const humanoid = (g, body, trim, o = {}) => {
    const s = o.s || 1;
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * s, 0.2 * s, 0.38 * s, 8), std(o.legs || '#3b332b')); legs.position.y = 0.27 * s; g.add(legs);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.25 * s, 0.48 * s, 10), std(body)); torso.position.y = 0.68 * s; g.add(torso);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.255 * s, 0.255 * s, 0.07 * s, 10), std(trim, { metalness: 0.4, roughness: 0.5 })); belt.position.y = 0.47 * s; g.add(belt);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.24 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(trim, { metalness: 0.3 })); sh.position.y = 0.88 * s; sh.scale.y = 0.5; g.add(sh);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 12, 10), std(o.skin || '#d8b08c')); head.position.y = 1.08 * s; g.add(head);
    g.userData.head = head; g.userData.h = 1.25 * s;
    return { torso, head };
  };
  const addAcc = (g, acc, trim, s = 1) => {
    if (acc === 'helm') { const h = new THREE.Mesh(new THREE.SphereGeometry(0.165 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.8), std(trim, { metalness: 0.6, roughness: 0.35 })); h.position.y = 1.1 * s; g.add(h); const crest = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.1 * s, 0.24 * s), std('#a3302a')); crest.position.y = 1.27 * s; g.add(crest); }
    if (acc === 'hood') { const h = new THREE.Mesh(new THREE.ConeGeometry(0.2 * s, 0.34 * s, 10), std(trim)); h.position.y = 1.2 * s; g.add(h); }
    if (acc === 'hat') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.28 * s, 0.03 * s, 14), std(trim)); b.position.y = 1.18 * s; g.add(b); const c = new THREE.Mesh(new THREE.ConeGeometry(0.15 * s, 0.38 * s, 10), std(trim)); c.position.y = 1.38 * s; c.rotation.z = 0.15; g.add(c); }
  };
  const addWeapon = (g, kind, s = 1) => {
    const metal = std('#c9ccd1', { metalness: 0.75, roughness: 0.3 }); const wood = std('#6b4a2b');
    const arm = new THREE.Group(); arm.position.set(0.3 * s, 0.62 * s, 0.05 * s); g.add(arm); g.userData.arm = arm;
    if (kind === 'bow') { const b = new THREE.Mesh(new THREE.TorusGeometry(0.32 * s, 0.02 * s, 4, 16, Math.PI), wood); b.rotation.z = Math.PI / 2; b.rotation.y = Math.PI / 2; arm.add(b); }
    else if (kind === 'staff' || kind === 'polearm' || kind === 'spear') { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.025 * s, 1.5 * s, 6), wood); st.position.y = 0.2 * s; arm.add(st); if (kind !== 'staff') { const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06 * s, 0.25 * s, 6), metal); tip.position.y = 1.0 * s; arm.add(tip); } else { const orb = new THREE.Mesh(new THREE.SphereGeometry(0.07 * s, 8, 6), std('#8fd0ff', { emissive: '#3a8ad0', emissiveIntensity: 0.8 })); orb.position.y = 0.98 * s; arm.add(orb); } }
    else if (kind === 'axe' || kind === 'hammer' || kind === 'club') { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.025 * s, 0.75 * s, 6), wood); h.position.y = 0.2 * s; arm.add(h); const hd = new THREE.Mesh(new THREE.BoxGeometry(kind === 'axe' ? 0.04 * s : 0.12 * s, 0.16 * s, kind === 'axe' ? 0.24 * s : 0.12 * s), metal); hd.position.set(0, 0.52 * s, kind === 'axe' ? 0.08 * s : 0); arm.add(hd); }
    else if (kind === 'none') { }
    else { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.62 * s, 0.09 * s), metal); bl.position.y = 0.38 * s; arm.add(bl); const gd = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.04 * s, 0.24 * s), std('#9a7a3a', { metalness: 0.6 })); gd.position.y = 0.06 * s; arm.add(gd); }
  };
  const quad = (g, body, o = {}) => {
    const s = o.s || 1;
    const b = new THREE.Mesh(THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.22 * s, 0.5 * s, 4, 8) : new THREE.CylinderGeometry(0.24 * s, 0.24 * s, 0.75 * s, 10), std(body)); b.rotation.x = Math.PI / 2; b.position.y = 0.5 * s; g.add(b);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, c]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.06 * s, 0.38 * s, 6), std(o.leg || body)); l.position.set(a * 0.14 * s, 0.19 * s, c * 0.26 * s); g.add(l); });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.22 * s, 0.32 * s), std(o.head || body)); head.position.set(0, 0.68 * s, 0.48 * s); g.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.12 * s, 0.16 * s), std(o.head || body)); snout.position.set(0, 0.62 * s, 0.66 * s); g.add(snout);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.4 * s, 6), std(body)); tail.rotation.x = -Math.PI / 2.6; tail.position.set(0, 0.6 * s, -0.5 * s); g.add(tail);
    g.userData.head = head; g.userData.h = 0.9 * s;
    return { head };
  };
  const wings = (g, c, s = 1) => {
    const wm = std(c, { side: THREE.DoubleSide, roughness: 0.9 });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.9, 0.35, -0.2, 0.75, -0.1, -0.45, 0, 0, 0, 0.75, -0.1, -0.45, 0.2, -0.05, -0.35], 3)); geo.computeVertexNormals();
    const L = new THREE.Mesh(geo, wm), Rr = new THREE.Mesh(geo, wm); Rr.scale.x = -1;
    const wl = new THREE.Group(), wr = new THREE.Group(); wl.add(L); wr.add(Rr); wl.position.set(0.12 * s, 0.8 * s, -0.05 * s); wr.position.set(-0.12 * s, 0.8 * s, -0.05 * s); wl.scale.setScalar(s); wr.scale.setScalar(s);
    g.add(wl); g.add(wr); g.userData.wings = [wl, wr];
  };
  R.buildFigure = u => {
    const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
    const team = TEAMC[u.team] || '#aaa';
    const sq = u.sq || 1; const sizeS = u.size === 'small' ? 0.78 : u.size === 'tiny' ? 0.6 : 1;
    // base
    const baseR = 0.44 * sq;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(baseR, baseR * 1.04, 0.07, 28), std('#1b2226', { roughness: 0.6 })); base.position.y = 0.035; base.receiveShadow = true; g.add(base);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(baseR, 0.035, 6, 32), new THREE.MeshStandardMaterial({ color: team, emissive: team, emissiveIntensity: 0.55 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.075; g.add(rim);
    g.userData.rim = rim;
    const look = u.look || {};
    const shape = u.shape || 'humanoid';
    const S = sq > 1 ? sq * 0.85 : sizeS;
    const color = u.color || look.body || '#7f93a8';
    if (u.kind === 'pc') {
      humanoid(inner, look.body || '#6c7a8c', look.trim || '#c8a24a', { s: sizeS, skin: { elf: '#e5c6a6', dwarf: '#cf9f7c', gnome: '#e9bfa3', goblin: '#7f9a4c', halfling: '#ddb18c', orc: '#7b8f5e' }[u.anc] || '#d6ad88' });
      addAcc(inner, look.acc, look.trim || '#c8a24a', sizeS);
      const main = u.strikes[0]; const grp = main ? (main.group || '') : '';
      addWeapon(inner, main && main.kind === 'ranged' ? 'bow' : grp === 'club' && main.wid === 'staff' ? 'staff' : grp === 'polearm' || grp === 'spear' ? 'polearm' : grp === 'axe' ? 'axe' : grp === 'hammer' || grp === 'club' || grp === 'flail' ? 'hammer' : grp === 'brawling' ? 'none' : 'sword', sizeS);
      if (u.shield) { const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * sizeS, 0.22 * sizeS, 0.04, 16), std(look.trim || '#a08040', { metalness: 0.5, roughness: 0.4 })); sh.rotation.z = Math.PI / 2; sh.position.set(-0.27 * sizeS, 0.62 * sizeS, 0.08); inner.add(sh); g.userData.shield = sh; }
    } else if (shape === 'beast' || shape === 'rat') { quad(inner, color, { s: shape === 'rat' ? 0.6 : S }); }
    else if (shape === 'owlbear') { quad(inner, color, { s: S * 1.05, head: '#c9a874' }); }
    else if (shape === 'dragon') { quad(inner, color, { s: S * 1.1, head: color }); wings(inner, '#7a1f12', S * 0.95); const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * S, 0.16 * S, 0.5 * S, 8), std(color)); neck.position.set(0, 0.68 * S, 0.38 * S); neck.rotation.x = 0.8; inner.add(neck); }
    else if (shape === 'winged') { humanoid(inner, color, '#4a4a4e', { s: S, skin: color, legs: color }); wings(inner, '#55555a', S); }
    else if (shape === 'skeleton') { humanoid(inner, '#d9d2bd', '#8c8370', { s: S * 0.95, skin: '#ece6d2', legs: '#cfc6ab' }); addWeapon(inner, 'sword', S); }
    else if (shape === 'zombie') { humanoid(inner, color, '#4a5240', { s: S, skin: '#9aa883', legs: '#4d4a3b' }); inner.rotation.x = 0.18; }
    else if (shape === 'caster') { const robe = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.95, 12), std(color)); robe.position.y = 0.5; inner.add(robe); const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), std('#c9a07c')); head.position.y = 1.06; inner.add(head); addAcc(inner, 'hood', color); addWeapon(inner, 'staff'); inner.userData.h = 1.25; }
    else { const s2 = shape === 'small' ? 0.78 : S; humanoid(inner, color, '#5a4a3a', { s: s2, skin: shape === 'small' ? '#7f9a4c' : shape === 'giant' ? '#a88a6c' : '#c9a07c' }); addWeapon(inner, shape === 'giant' ? 'club' : 'sword', s2); }
    inner.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.userData.inner = inner; g.userData.h = (inner.userData.h || 1.2) * (u.kind === 'pc' ? 1 : 1);
    // selection ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(baseR + 0.06, baseR + 0.13, 36), new THREE.MeshBasicMaterial({ color: '#f0c45a', transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring); g.userData.ring = ring;
    const tring = new THREE.Mesh(new THREE.RingGeometry(baseR + 0.05, baseR + 0.16, 36), new THREE.MeshBasicMaterial({ color: '#ff5a4a', transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false })); tring.rotation.x = -Math.PI / 2; tring.position.y = 0.05; g.add(tring); g.userData.tring = tring;
    g.userData.uid = u.id;
    return g;
  };
  R.addUnit = u => {
    const g = R.buildFigure(u); figs.add(g);
    const rec = { id: u.id, g, x: u.x, y: u.y, sq: u.sq, team: u.team, fly: !!(u.speed && u.speed.fly), state: {}, facing: u.team === 'pc' ? Math.PI : 0, dead: false };
    R.units[u.id] = rec; R.place(rec, u.x, u.y); g.rotation.y = rec.facing;
    return rec;
  };
  R.unitWorld = (rec, x = rec.x, y = rec.y) => {
    let h = 0; for (let i = 0; i < rec.sq; i++) for (let j = 0; j < rec.sq; j++) h = Math.max(h, R.tileTop(x + i, y + j, true));
    return { x: x + rec.sq / 2, y: h + (rec.fly ? 0.9 : 0), z: y + rec.sq / 2 };
  };
  R.place = (rec, x, y) => { rec.x = x; rec.y = y; const p = R.unitWorld(rec); rec.g.position.set(p.x, p.y, p.z); };
  R.removeUnit = id => { const r = R.units[id]; if (r) { figs.remove(r.g); delete R.units[id]; } };
  R.setActive = id => { Object.values(R.units).forEach(r => { r.g.userData.ring.material.opacity = r.id === id ? 0.95 : 0; }); R.activeId = id; };
  R.setTargeted = ids => { const s = new Set(ids || []); Object.values(R.units).forEach(r => { r.g.userData.tring.material.opacity = s.has(r.id) ? 0.9 : 0; }); };
  R.setPose = (id, st) => {
    const r = R.units[id]; if (!r) return; const inner = r.g.userData.inner;
    r.state = Object.assign({}, r.state, st);
    const down = r.state.dead || r.state.down || r.state.prone;
    r.poseTarget = down ? -Math.PI / 2 * 0.92 : (r.g.userData.inner && r.g.userData.inner.userData.zombie ? 0.18 : 0);
    if (r.state.dead) { r.g.userData.rim.material.emissiveIntensity = 0.05; r.g.userData.rim.material.color.set('#444'); }
    if (r.g.userData.shield) r.g.userData.shield.material.emissive = new THREE.Color(r.state.shield ? '#5a8ad0' : '#000');
  };
  R.face = (rec, tx, ty) => { const a = Math.atan2((tx + 0.5) - (rec.x + rec.sq / 2), (ty + 0.5) - (rec.y + rec.sq / 2)); rec.facing = a; };

  /* ---------- overlays ---------- */
  const tileGeo = new THREE.PlaneGeometry(0.94, 0.94);
  R.layer = (name, cells, color, opacity = 0.35, o = {}) => {
    let L = R.layers[name];
    if (!L) { L = R.layers[name] = { meshes: [], mat: new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }) }; }
    L.mat.color.set(color); L.mat.opacity = opacity;
    cells = cells || [];
    while (L.meshes.length < cells.length) { const m = new THREE.Mesh(tileGeo, L.mat); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; overlay.add(m); L.meshes.push(m); }
    L.meshes.forEach((m, i) => {
      if (i < cells.length) { const [x, y] = cells[i]; m.visible = true; m.position.set(x + 0.5, R.tileTop(x, y) + 0.03 + (o.lift || 0), y + 0.5); }
      else m.visible = false;
    });
  };
  R.clearLayer = name => { const L = R.layers[name]; if (L) L.meshes.forEach(m => { m.visible = false; }); };
  R.clearLayers = (names) => (names || Object.keys(R.layers)).forEach(R.clearLayer);
  let pathMesh = null, pathEnd = null;
  R.showPath = (cells, color = '#f0c45a') => {
    if (pathMesh) { overlay.remove(pathMesh); pathMesh.geometry.dispose(); pathMesh = null; }
    if (pathEnd) { overlay.remove(pathEnd); pathEnd = null; }
    if (!cells || cells.length < 2) return;
    const pts = cells.map(([x, y]) => new THREE.Vector3(x + 0.5, R.tileTop(x, y) + 0.12, y + 0.5));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.2);
    pathMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, cells.length * 6), 0.045, 6, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    pathMesh.renderOrder = 3; overlay.add(pathMesh);
    pathEnd = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
    pathEnd.rotation.x = -Math.PI / 2; const e = pts[pts.length - 1]; pathEnd.position.set(e.x, e.y - 0.07, e.z); overlay.add(pathEnd);
  };
  // generic terrain fx (grease)
  R.terrainFx = {};
  R.addTerrainFx = (id, cells, kind) => {
    const m = new THREE.MeshBasicMaterial({ color: kind === 'grease' ? '#2d2a1c' : '#556', transparent: true, opacity: 0.55, depthWrite: false });
    const grp = new THREE.Group(); cells.forEach(([x, y]) => { const p = new THREE.Mesh(tileGeo, m); p.rotation.x = -Math.PI / 2; p.position.set(x + 0.5, R.tileTop(x, y) + 0.02, y + 0.5); grp.add(p); });
    overlay.add(grp); R.terrainFx[id] = grp;
  };
  R.removeTerrainFx = id => { const g = R.terrainFx[id]; if (g) { overlay.remove(g); delete R.terrainFx[id]; } };

  /* ---------- picking ---------- */
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  R.pick = (cx, cy) => {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((cx - rect.left) / rect.width) * 2 - 1; ndc.y = -((cy - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    // units first
    const hits = ray.intersectObjects(figs.children, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.uid) o = o.parent; if (o && R.units[o.userData.uid] && !R.units[o.userData.uid].state.dead) { const r = R.units[o.userData.uid]; return { unit: r.id, x: r.x, y: r.y, fx: h.point.x, fy: h.point.z }; } }
    const g = ray.intersectObjects(world.children, false);
    if (g.length) { const p = g[0].point.clone(); if (g[0].face) p.addScaledVector(g[0].face.normal, -0.02); const x = Math.floor(p.x), y = Math.floor(p.z); if (x >= 0 && y >= 0 && x < R.W && y < R.H) return { x, y, fx: p.x, fy: p.z }; }
    // fallback plane
    const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const out = new THREE.Vector3();
    if (ray.ray.intersectPlane(pl, out)) { const x = Math.floor(out.x), y = Math.floor(out.z); if (x >= 0 && y >= 0 && x < R.W && y < R.H) return { x, y, fx: out.x, fy: out.z }; }
    return null;
  };
  const v3 = new THREE.Vector3();
  R.project = (x, y, z) => { v3.set(x, y, z).project(camera); const rect = renderer.domElement.getBoundingClientRect(); return { x: (v3.x + 1) / 2 * rect.width, y: (1 - v3.y) / 2 * rect.height, behind: v3.z > 1 }; };
  R.unitScreen = id => { const r = R.units[id]; if (!r) return null; const p = r.g.position; return R.project(p.x, p.y + (r.g.userData.h || 1.2) * (r.sq > 1 ? r.sq * 0.85 : 1) + 0.35, p.z); };

  /* ---------- animations ---------- */
  const tweens = [];
  const tween = (dur, fn, done) => new Promise(res => { tweens.push({ t: 0, dur: Math.max(0.001, dur), fn, res, done }); });
  R.wait = s => tween(s / R.speed, () => {});
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  R.animMove = async (id, path, kind) => {
    const r = R.units[id]; if (!r || !path || path.length < 2) return;
    if (kind === 'teleport') { const g = r.g; await tween(0.18 / R.speed, t => g.scale.setScalar(1 - t)); R.place(r, path[path.length - 1][0], path[path.length - 1][1]); await tween(0.18 / R.speed, t => g.scale.setScalar(t)); g.scale.setScalar(1); return; }
    const per = (kind === 'push' ? 0.09 : kind === 'step' ? 0.16 : 0.13) / R.speed;
    for (let i = 1; i < path.length; i++) {
      const a = R.unitWorld(r, path[i - 1][0], path[i - 1][1]), b = R.unitWorld(r, path[i][0], path[i][1]);
      if (kind !== 'push') { R.face(r, path[i][0] + (r.sq - 1) / 2, path[i][1] + (r.sq - 1) / 2); }
      await tween(per, t => { r.g.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * (kind === 'push' ? 0.05 : 0.12), a.z + (b.z - a.z) * t); });
      r.x = path[i][0]; r.y = path[i][1];
    }
    R.place(r, r.x, r.y);
  };
  const projGeo = new THREE.SphereGeometry(0.07, 8, 6);
  const FXC = { weapon: '#e8e2d0', fire: '#ff7a2a', cold: '#9fdcff', electricity: '#d8e8ff', acid: '#9be34a', sonic: '#e0c8ff', force: '#b49cff', void: '#7a4ab8', vitality: '#ffe7a0', heal: '#a8ffb8', mental: '#ff8ad8', spirit: '#fff2c0', arcane: '#8fd0ff', spell: '#8fd0ff', ally: '#6fd0ff', foe: '#ff6a5a' };
  R.fxColor = c => FXC[c] || FXC.arcane;
  R.animAttack = async (aid, bid, ranged, deg, c) => {
    const a = R.units[aid], b = R.units[bid]; if (!a || !b) return;
    R.face(a, b.x + (b.sq - 1) / 2, b.y + (b.sq - 1) / 2);
    const pa = a.g.position.clone(), pb = b.g.position.clone();
    if (!ranged) {
      const dir = pb.clone().sub(pa).setY(0).normalize().multiplyScalar(0.32);
      await tween(0.12 / R.speed, t => a.g.position.copy(pa).addScaledVector(dir, Math.sin(t * Math.PI / 2)));
      if (deg >= 2) R.flinch(b);
      await tween(0.14 / R.speed, t => a.g.position.copy(pa).addScaledVector(dir, 1 - t));
      a.g.position.copy(pa);
    } else {
      await R.animBolt(pa.clone().setY(pa.y + 0.7), pb.clone().setY(pb.y + 0.6), c === 'weapon' ? '#e8e2d0' : R.fxColor(c), deg >= 2);
      if (deg >= 2) R.flinch(b);
    }
  };
  R.animBolt = async (from, to, color, hit) => {
    const m = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color })); fxg.add(m);
    const light = new THREE.PointLight(color, 0.8, 3); m.add(light);
    const d = from.distanceTo(to); const dur = Math.min(0.5, 0.08 + d * 0.035) / R.speed;
    const end = hit ? to : to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.3, (Math.random() - 0.5) * 1.2));
    await tween(dur, t => { m.position.lerpVectors(from, end, t); m.position.y += Math.sin(t * Math.PI) * d * 0.06; });
    fxg.remove(m);
    if (hit) R.burstAt(end, color, 0.4);
  };
  R.flinch = r => { const g = r.g.userData.inner; const base = g.rotation.z; tween(0.22 / R.speed, t => { g.rotation.z = base + Math.sin(t * Math.PI * 3) * 0.12 * (1 - t); }).then(() => { g.rotation.z = base; }); };
  R.burstAt = (p, color, size = 0.6) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false })); m.position.copy(p); fxg.add(m);
    tween(0.35 / R.speed, t => { m.scale.setScalar(size * (0.3 + t)); m.material.opacity = 0.7 * (1 - t); }).then(() => fxg.remove(m));
  };
  R.animArea = async (cells, c) => {
    const color = R.fxColor(c);
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
    const grp = new THREE.Group(); cells.forEach(([x, y]) => { const p = new THREE.Mesh(tileGeo, m); p.rotation.x = -Math.PI / 2; p.position.set(x + 0.5, R.tileTop(x, y) + 0.06, y + 0.5); grp.add(p); });
    fxg.add(grp);
    const light = new THREE.PointLight(color, 0, 10); if (cells.length) { const c0 = cells[Math.floor(cells.length / 2)]; light.position.set(c0[0] + 0.5, 1.5, c0[1] + 0.5); } fxg.add(light);
    await tween(0.5 / R.speed, t => { m.opacity = Math.sin(t * Math.PI) * 0.75; light.intensity = Math.sin(t * Math.PI) * 2.2; });
    fxg.remove(grp); fxg.remove(light);
  };
  R.animPulse = async (id, rft, c) => {
    const r = R.units[id]; if (!r) return; const color = R.fxColor(c);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(r.g.position).setY(r.g.position.y + 0.1); fxg.add(ring);
    const maxS = rft / 5 + r.sq / 2;
    await tween(0.55 / R.speed, t => { ring.scale.setScalar(0.3 + t * maxS); ring.material.opacity = 0.8 * (1 - t); });
    fxg.remove(ring);
  };
  R.animCast = async (id, c) => { const r = R.units[id]; if (!r) return; const p = r.g.position.clone(); p.y += (r.g.userData.h || 1.2) + 0.1; R.burstAt(p, R.fxColor(c), 0.35); await R.wait(0.18); };
  R.animDeath = async id => {
    const r = R.units[id]; if (!r) return; r.state.dead = true; R.setPose(id, { dead: true });
    const inner = r.g.userData.inner;
    await tween(0.4 / R.speed, t => { inner.rotation.x = -Math.PI / 2 * 0.92 * ease(t); inner.position.y = -0.05 * t; });
    inner.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.45; o.material.color.multiplyScalar(0.6); } });
  };

  /* ---------- loop ---------- */
  let last = performance.now(); let running = true; let tAcc = 0;
  const loop = now => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; tAcc += dt;
    // camera smoothing
    const k = 1 - Math.pow(0.0015, dt);
    cam.tx += (cam.gtx - cam.tx) * k; cam.tz += (cam.gtz - cam.tz) * k; cam.dist += (cam.gdist - cam.dist) * k; cam.pitch += (cam.gpitch - cam.pitch) * k;
    let dy = cam.gyaw - cam.yaw; cam.yaw += dy * k;
    applyCam();
    // tweens
    for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; tw.t += dt; const f = Math.min(1, tw.t / tw.dur); tw.fn(f); if (f >= 1) { tweens.splice(i, 1); tw.res(); } }
    // figure idle + facing + pose
    Object.values(R.units).forEach(r => {
      const g = r.g; let dyaw = r.facing - g.rotation.y; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2; g.rotation.y += dyaw * Math.min(1, dt * 10);
      const inner = g.userData.inner;
      if (!r.state.dead) {
        const tgt = r.poseTarget || 0; inner.rotation.x += (tgt - inner.rotation.x) * Math.min(1, dt * 8);
        inner.position.y = (r.state.prone || r.state.down) ? -0.02 : (r.fly ? Math.sin(tAcc * 2 + r.x) * 0.06 : 0);
        if (g.userData.wings) { const a = Math.sin(tAcc * (r.fly ? 7 : 2)) * (r.fly ? 0.5 : 0.12); g.userData.wings[0].rotation.z = a; g.userData.wings[1].rotation.z = -a; }
      }
      const ring = g.userData.ring; if (ring.material.opacity > 0) ring.rotation.z += dt * 0.8;
    });
    if (R.lavaMat) R.lavaMat.emissiveIntensity = 1.0 + Math.sin(tAcc * 2.1) * 0.25;
    if (R.mist) R.mist.forEach((m, i) => { m.position.x += Math.sin(tAcc * 0.4 + i) * 0.001; });
    if (R.onFrame) R.onFrame(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  R.stop = () => { running = false; };
  R.start = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } };
  G.addEventListener('resize', R.resize);
  R.resize();
  return R;
};
})(typeof window !== 'undefined' ? window : globalThis);
