/* render3d.js — battlefield renderer: textured terrain (PF.Gfx), rigged figures (PF.Models),
   post-processing, particles, overlays, tactical camera with action-cam. */
(function (G) {
'use strict';
const PF = G.PF;

PF.Render = function (host) {
  const THREE = G.THREE, Gfx = PF.Gfx, Models = PF.Models;
  const R = { units: {}, layers: {}, speed: 1, onFrame: null };
  const HL = 0.7; R.HL = HL;
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  const mobile = Math.min(G.innerWidth || 1000, G.innerHeight || 800) < 700;
  renderer.setPixelRatio(Math.min(G.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  host.appendChild(renderer.domElement); renderer.domElement.className = 'r3d';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  const world = new THREE.Group(); scene.add(world);
  const overlay = new THREE.Group(); scene.add(overlay);
  const figs = new THREE.Group(); scene.add(figs);
  const fxg = new THREE.Group(); scene.add(fxg);
  R.scene = scene; R.camera = camera; R.renderer = renderer; R.world = world;
  let gfxLevel = 'high';
  try { const s = localStorage.getItem('tat.gfx'); if (s) gfxLevel = s.replace(/"/g, ''); else if (mobile) gfxLevel = 'medium'; } catch (e) { if (mobile) gfxLevel = 'medium'; }
  R.fx = new Gfx.Particles(scene, renderer, { lights: 6 });
  R.post = new Gfx.Post(renderer, scene, camera, { quality: gfxLevel });
  R.applyGfx = q => {
    gfxLevel = q || 'high';
    try { R.post.setQuality(gfxLevel); } catch (e) { console.warn(e); }
    renderer.shadowMap.enabled = gfxLevel !== 'off';
    if (R.env && R.env.sun) R.env.sun.castShadow = gfxLevel !== 'off';
  };
  R.applyGfx(gfxLevel);

  /* ---------- camera ---------- */
  const cam = { tx: 10, tz: 10, yaw: 0.6, pitch: 0.95, dist: 26, gyaw: 0.6, gtx: 10, gtz: 10, gdist: 26, gpitch: 0.95, ty: 0, gty: 0 };
  R.cam = cam;
  const tgtV = new THREE.Vector3();
  let insetTop = 0, insetBottom = 0;
  R.setViewportInsets = (top, bottom) => {
    if (top === insetTop && bottom === insetBottom) return;
    insetTop = top; insetBottom = bottom;
    const w = host.clientWidth || 800, h = host.clientHeight || 600;
    camera.setViewOffset(w, h, 0, (bottom - top) / 2, w, h);
  };
  const applyCam = () => {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    camera.position.set(cam.tx + Math.sin(cam.yaw) * cp * cam.dist, cam.ty + sp * cam.dist, cam.tz + Math.cos(cam.yaw) * cp * cam.dist);
    tgtV.set(cam.tx, cam.ty, cam.tz); camera.lookAt(tgtV);
  };
  R.resize = () => {
    const w = host.clientWidth || 800, h = host.clientHeight || 600;
    renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h; camera.fov = w / h < 0.8 ? 55 : 38; camera.updateProjectionMatrix();
    camera.setViewOffset(w, h, 0, (insetBottom - insetTop) / 2, w, h);
    R.post.setSize(w, h, renderer.getPixelRatio());
  };
  R.focus = (x, y, instant) => { cam.gtx = x; cam.gtz = y; cam.gty = R.tileTop ? R.tileTop(x, y) * 0.6 : 0; if (instant) { cam.tx = x; cam.tz = y; cam.ty = cam.gty; } };
  R.rotate = d => { cam.gyaw += d; };
  R.zoom = f => { cam.gdist = Math.max(6, Math.min(52, cam.gdist * f)); };
  R.tilt = d => { cam.gpitch = Math.max(0.42, Math.min(1.35, cam.gpitch + d)); };
  R.pan = (dx, dz) => {
    const s = cam.dist / 26; const c = Math.cos(cam.yaw), sn = Math.sin(cam.yaw);
    cam.gtx += (dx * c + dz * sn) * s; cam.gtz += (-dx * sn + dz * c) * s;
    cam.gtx = Math.max(-2, Math.min((R.W || 20) + 2, cam.gtx)); cam.gtz = Math.max(-2, Math.min((R.H || 20) + 2, cam.gtz));
  };
  // action camera: swing behind the attacker toward the target, then restore
  R.camFollow = () => { const s = PF.App && PF.App.settings; return !s || s.follow !== false; };
  R.actionCam = (aid, bid) => {
    if (G.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    const a = R.units[aid], b = R.units[bid]; if (!a || !b || !R.camFollow()) return null;
    const saved = { gtx: cam.gtx, gtz: cam.gtz, gdist: cam.gdist, gyaw: cam.gyaw, gpitch: cam.gpitch, gty: cam.gty };
    const pa = a.g.position, pb = b.g.position;
    const d = Math.hypot(pb.x - pa.x, pb.z - pa.z);
    cam.gtx = pa.x * 0.45 + pb.x * 0.55; cam.gtz = pa.z * 0.45 + pb.z * 0.55; cam.gty = (pa.y + pb.y) / 2 + 0.4;
    // over-the-shoulder: look from behind attacker
    const yaw = Math.atan2(pa.x - pb.x, pa.z - pb.z) + 0.38;
    let dy = yaw - cam.gyaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    cam.gyaw += dy; cam.gpitch = 0.55; cam.gdist = Math.max(7, Math.min(16, d * 1.25 + 5));
    return () => Object.assign(cam, saved);
  };

  /* ---------- map ---------- */
  let gridLines = null;
  R.setGrid = on => { if (gridLines) gridLines.visible = !!on; R.gridOn = !!on; };
  R.gridOn = true;
  R.loadMap = B => {
    if (R.built) { try { R.built.dispose(); } catch (e) { /* */ } R.built = null; }
    if (R.env) { try { R.env.dispose(); } catch (e) { /* */ } R.env = null; }
    try { R.fx.clear(); } catch (e) { /* */ }
    Object.keys(R.units).forEach(R.removeUnit);
    [world, overlay, fxg].forEach(g => { while (g.children.length) g.remove(g.children[0]); });
    R.units = {}; R.layers = {}; R.B = B; R.W = B.W; R.H = B.H; R.terrainFx = {};
    const preset = Gfx.Battle.presetFor(B.map);
    let maxH = 0; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) maxH = Math.max(maxH, B.tile(x, y).h);
    R.env = Gfx.Environment.apply(scene, renderer, preset, { W: B.W, H: B.H, maxY: maxH * HL + 3 });
    if (R.env.sun) R.env.sun.castShadow = gfxLevel !== 'off';
    R.built = Gfx.Battle.build(B, { HL, fx: R.fx });
    world.add(R.built.group);
    try { R.post.setGrading(R.env.grading || {}); } catch (e) { /* */ }
    // subtle grid
    const pts = [];
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
      const t = B.tile(x, y); if (t.los || t.block || t.terr === 'L') continue;
      const yy = R.tileTop(x, y) + 0.015;
      pts.push(x, yy, y, x + 1, yy, y, x + 1, yy, y, x + 1, yy, y + 1, x + 1, yy, y + 1, x, yy, y + 1, x, yy, y + 1, x, yy, y);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    gridLines = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.07, depthWrite: false }));
    gridLines.renderOrder = 1; overlay.add(gridLines); gridLines.visible = R.gridOn;
    cam.tx = cam.gtx = B.W / 2; cam.tz = cam.gtz = B.H / 2 + 2;
    R.resize();
  };
  R.tileTop = (x, y, withObj) => {
    const t = R.B && R.B.tile(Math.floor(x), Math.floor(y)); if (!t) return 0;
    let top = t.h * HL; if (t.terr === 'w') top -= 0.12; if (t.terr === 'W') top -= 0.3;
    if (withObj && t.obj && ({ f: 0.55, S: 0.62, t: 0.6 })[t.obj]) top += ({ f: 0.55, S: 0.62, t: 0.6 })[t.obj];
    return top;
  };

  /* ---------- figures ---------- */
  const TEAMC = { pc: '#3fc9e8', foe: '#ef4e43' };
  const baseGeo = {}; const baseMat = {};
  const getBase = (sq, team) => {
    const k = sq;
    if (!baseGeo[k]) {
      const r = 0.43 * sq;
      baseGeo[k] = { disc: new THREE.CylinderGeometry(r, r * 1.05, 0.06, 40), ring: new THREE.TorusGeometry(r * 1.02, 0.028, 6, 48) };
    }
    if (!baseMat[team]) baseMat[team] = {
      disc: new THREE.MeshStandardMaterial({ color: '#141a1d', roughness: 0.45, metalness: 0.4 }),
      ring: new THREE.MeshStandardMaterial({ color: TEAMC[team] || '#aaa', emissive: TEAMC[team] || '#aaa', emissiveIntensity: 0.55, roughness: 0.4 })
    };
    return { geo: baseGeo[k], mat: baseMat[team] };
  };
  R.addUnit = u => {
    const g = new THREE.Group(); figs.add(g);
    const sq = u.sq || 1; const b = getBase(sq, u.team);
    const disc = new THREE.Mesh(b.geo.disc, b.mat.disc); disc.position.y = 0.03; disc.receiveShadow = true; g.add(disc);
    const ring = new THREE.Mesh(b.geo.ring, b.mat.ring.clone()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.065; g.add(ring);
    let fig = null;
    try { fig = Models.create(Models.descForUnit(u)); } catch (e) { console.warn('model failed', u.name, e); }
    const holder = new THREE.Group(); holder.position.y = 0.06; g.add(holder);
    if (fig) holder.add(fig.group);
    g.userData.uid = u.id; g.userData.h = fig ? fig.height + 0.06 : 1.3; g.userData.ring = ring;
    const rec = { id: u.id, g, fig, holder, x: u.x, y: u.y, sq, team: u.team, state: {}, facing: u.team === 'pc' ? Math.PI : 0, dead: false };
    R.units[u.id] = rec; R.place(rec, u.x, u.y); holder.rotation.y = rec.facing;
    if (fig && u.shield && u.shield.raised) fig.setShield(true);
    return rec;
  };
  R.unitWorld = (rec, x = rec.x, y = rec.y) => {
    let h = 0; for (let i = 0; i < rec.sq; i++) for (let j = 0; j < rec.sq; j++) h = Math.max(h, R.tileTop(x + i, y + j, true));
    return { x: x + rec.sq / 2, y: h, z: y + rec.sq / 2 };
  };
  R.place = (rec, x, y) => { if (!rec) return; rec.x = x; rec.y = y; const p = R.unitWorld(rec); rec.g.position.set(p.x, p.y, p.z); };
  R.removeUnit = id => { const r = R.units[id]; if (r) { if (r.fig) try { r.fig.dispose(); } catch (e) { /* */ } figs.remove(r.g); if (r.aura) r.aura.stop(); delete R.units[id]; } };
  R.setActive = id => {
    Object.values(R.units).forEach(r => { r.g.userData.ring.material.emissiveIntensity = r.id === id ? 1.1 : (r.dead ? 0.05 : 0.5); r.active = r.id === id; });
    R.activeId = id;
  };
  R.setTargeted = ids => { const s = new Set(ids || []); Object.values(R.units).forEach(r => { r.targeted = s.has(r.id); }); };
  R.setPose = (id, st) => {
    const r = R.units[id]; if (!r) return;
    r.state = Object.assign({}, r.state, st);
    if (!r.fig) return;
    if (r.state.dead) r.fig.setPose('dead');
    else if (r.state.down) r.fig.setPose('down');
    else if (r.state.prone) r.fig.setPose('prone');
    else if (r.fig.pose && r.fig.pose !== 'stand') { r.fig.play('stand'); r.fig.setPose('stand'); }
    if (st.shield !== undefined) r.fig.setShield(!!st.shield);
    if (st.shield) R.fx.shieldFlash(R.anchor(id, 'chest'), '#7fd0ff');
  };
  R.face = (rec, tx, ty) => { rec.facing = Math.atan2((tx + 0.5) - (rec.x + rec.sq / 2), (ty + 0.5) - (rec.y + rec.sq / 2)); };
  R.faceUnit = (rec, other) => { rec.facing = Math.atan2(other.g.position.x - rec.g.position.x, other.g.position.z - rec.g.position.z); };
  R.anchor = (id, name) => {
    const r = R.units[id]; const v = new THREE.Vector3();
    if (!r) return v;
    if (r.fig && r.fig.anchor) { try { r.g.updateMatrixWorld(true); const a = r.fig.anchor(name); if (a) return v.copy(a); } catch (e) { /* */ } }
    v.copy(r.g.position); v.y += (name === 'head' ? 1 : 0.65) * (r.g.userData.h || 1.2); return v;
  };

  /* ---------- overlays ---------- */
  const tileGeo = new THREE.PlaneGeometry(0.96, 0.96);
  const borderMats = {};
  const borderFor = (cells, color, lift) => {
    const set = new Set(cells.map(c => c[0] + ',' + c[1]));
    const pos = [];
    const add = (x1, z1, x2, z2, y) => { pos.push(x1, y, z1, x2, y, z2); };
    cells.forEach(([x, y]) => {
      const yy = R.tileTop(x, y) + 0.05 + (lift || 0);
      if (!set.has(x + ',' + (y - 1))) add(x, y, x + 1, y, yy);
      if (!set.has(x + ',' + (y + 1))) add(x, y + 1, x + 1, y + 1, yy);
      if (!set.has((x - 1) + ',' + y)) add(x, y, x, y + 1, yy);
      if (!set.has((x + 1) + ',' + y)) add(x + 1, y, x + 1, y + 1, yy);
    });
    // thick border: build thin quads (vertical ribbons) for visibility
    const quads = [];
    for (let i = 0; i < pos.length; i += 6) {
      const [x1, y1, z1, x2, y2, z2] = pos.slice(i, i + 6);
      quads.push(x1, y1, z1, x2, y2, z2, x2, y2 + 0.09, z2, x1, y1, z1, x2, y2 + 0.09, z2, x1, y1 + 0.09, z1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(quads, 3));
    const k = color; if (!borderMats[k]) borderMats[k] = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    const m = new THREE.Mesh(g, borderMats[k]); m.renderOrder = 4; return m;
  };
  R.layer = (name, cells, color, opacity = 0.35, o = {}) => {
    let L = R.layers[name];
    if (!L) L = R.layers[name] = { meshes: [], mat: new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), border: null };
    L.mat.color.set(color);
    const isMove = /^move|^zone/.test(name);
    L.mat.opacity = isMove ? opacity * 0.45 : opacity;
    cells = cells || [];
    while (L.meshes.length < cells.length) { const m = new THREE.Mesh(tileGeo, L.mat); m.rotation.x = -Math.PI / 2; m.renderOrder = 3; overlay.add(m); L.meshes.push(m); }
    L.meshes.forEach((m, i) => { if (i < cells.length) { const [x, y] = cells[i]; m.visible = true; m.position.set(x + 0.5, R.tileTop(x, y) + 0.035 + (o.lift || 0), y + 0.5); } else m.visible = false; });
    if (L.border) { overlay.remove(L.border); L.border.geometry.dispose(); L.border = null; }
    if (isMove && cells.length) {
      // the border should wrap the cumulative region for move layers (move2 includes move1 etc.)
      let region = cells;
      if (name === 'move2' && R.layers.move1 && R.layers.move1.cells) region = cells.concat(R.layers.move1.cells);
      if (name === 'move3') region = cells.concat((R.layers.move1 && R.layers.move1.cells) || [], (R.layers.move2 && R.layers.move2.cells) || []);
      L.border = borderFor(region, color, 0); overlay.add(L.border);
    }
    L.cells = cells;
  };
  R.clearLayer = name => { const L = R.layers[name]; if (L) { L.meshes.forEach(m => { m.visible = false; }); if (L.border) L.border.visible = false; L.cells = []; } };
  R.clearLayers = names => (names || Object.keys(R.layers)).forEach(R.clearLayer);
  let pathMesh = null, pathEnd = null; const pathMat = {};
  R.showPath = (cells, color = '#f0c45a') => {
    if (pathMesh) { overlay.remove(pathMesh); pathMesh.geometry.dispose(); pathMesh = null; }
    if (pathEnd) { overlay.remove(pathEnd); pathEnd = null; }
    if (!cells || cells.length < 2) return;
    const pts = cells.map(([x, y]) => new THREE.Vector3(x + 0.5, R.tileTop(x, y) + 0.14, y + 0.5));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.3);
    if (!pathMat[color]) pathMat[color] = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
    pathMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, cells.length * 8), 0.05, 6, false), pathMat[color]);
    pathMesh.renderOrder = 5; overlay.add(pathMesh);
    pathEnd = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.38, 32), pathMat[color]); ring.rotation.x = -Math.PI / 2; pathEnd.add(ring);
    const e = pts[pts.length - 1]; pathEnd.position.set(e.x, e.y - 0.08, e.z); pathEnd.renderOrder = 5; overlay.add(pathEnd);
  };
  R.terrainFx = {};
  R.addTerrainFx = (id, cells, kind) => {
    const m = new THREE.MeshStandardMaterial({ color: kind === 'grease' ? '#26231a' : '#556', roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.75, depthWrite: false });
    const grp = new THREE.Group(); cells.forEach(([x, y]) => { const p = new THREE.Mesh(tileGeo, m); p.rotation.x = -Math.PI / 2; p.position.set(x + 0.5, R.tileTop(x, y) + 0.025, y + 0.5); grp.add(p); });
    overlay.add(grp); R.terrainFx[id] = grp;
  };
  R.removeTerrainFx = id => { const g = R.terrainFx[id]; if (g) { overlay.remove(g); delete R.terrainFx[id]; } };

  /* ---------- picking ---------- */
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  R.pick = (cx, cy) => {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((cx - rect.left) / rect.width) * 2 - 1; ndc.y = -((cy - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(figs.children, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.uid) o = o.parent; if (o && R.units[o.userData.uid] && !R.units[o.userData.uid].state.dead) { const r = R.units[o.userData.uid]; return { unit: r.id, x: r.x, y: r.y, fx: h.point.x, fy: h.point.z }; } }
    if (R.built && R.built.pickables) {
      const g = ray.intersectObjects(R.built.pickables, true);
      if (g.length) { const p = g[0].point; const x = Math.floor(p.x), y = Math.floor(p.z); if (x >= 0 && y >= 0 && x < R.W && y < R.H) return { x, y, fx: p.x, fy: p.z }; }
    }
    // fallback: per-height planes (top-most hit wins)
    const out = new THREE.Vector3();
    for (let lv = 5; lv >= 0; lv--) {
      const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -lv * HL);
      if (ray.ray.intersectPlane(pl, out)) { const x = Math.floor(out.x), y = Math.floor(out.z); if (x >= 0 && y >= 0 && x < R.W && y < R.H && R.B && R.B.tile(x, y).h === lv) return { x, y, fx: out.x, fy: out.z }; }
    }
    if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), out)) { const x = Math.floor(out.x), y = Math.floor(out.z); if (x >= 0 && y >= 0 && x < R.W && y < R.H) return { x, y, fx: out.x, fy: out.z }; }
    return null;
  };
  const v3 = new THREE.Vector3();
  R.project = (x, y, z) => { v3.set(x, y, z).project(camera); const rect = renderer.domElement.getBoundingClientRect(); return { x: (v3.x + 1) / 2 * rect.width, y: (1 - v3.y) / 2 * rect.height, behind: v3.z > 1 }; };
  R.unitScreen = id => { const r = R.units[id]; if (!r) return null; const p = r.g.position; const h = r.state.dead || r.state.down || r.state.prone ? 0.6 : (r.g.userData.h || 1.2); return R.project(p.x, p.y + h + 0.3, p.z); };

  /* ---------- animation helpers ---------- */
  const tweens = [];
  const tween = (dur, fn) => new Promise(res => { tweens.push({ t: 0, dur: Math.max(0.001, dur), fn, res }); });
  R.wait = s => tween(s / R.speed, () => {});
  const instant = () => R.speed >= 5;
  const timeout = (p, s) => Promise.race([p, new Promise(r => setTimeout(r, s * 1000))]);
  const COL = { weapon: '#e8e2d0', fire: '#ff7a2a', cold: '#9fdcff', electricity: '#cfe3ff', acid: '#9be34a', sonic: '#e0c8ff', force: '#b49cff', void: '#8a5ad8', vitality: '#ffe7a0', heal: '#a8ffb8', mental: '#ff8ad8', spirit: '#fff2c0', arcane: '#8fd0ff', spell: '#8fd0ff', ally: '#6fd0ff', foe: '#ff6a5a', poison: '#7fd04a', bleed: '#c03030', physical: '#e8e2d0', piercing: '#e8e2d0', slashing: '#e8e2d0', bludgeoning: '#e8e2d0' };
  R.fxColor = c => COL[c] || (Gfx.kindColor && Gfx.kindColor[c]) || COL.arcane;
  const projKind = (c, w) => {
    if (c === 'weapon' || !c) { if (/crossbow/.test(w || '')) return 'bolt'; if (/javelin|spear|dart|thrown/.test(w || '')) return 'javelin'; if (/sling/.test(w || '')) return 'sling'; if (/rock|stone/.test(w || '')) return 'rock'; return 'arrow'; }
    return { fire: 'fire', cold: 'frost', acid: 'acid', force: 'force', poison: 'acid' }[c] || 'magic';
  };

  R.animMove = async (id, path, kind) => {
    const r = R.units[id]; if (!r || !path || path.length < 2) return;
    if (kind === 'teleport') {
      R.fx.burst('magic', R.anchor(id, 'chest'), { color: '#b49cff' });
      await tween(0.2 / R.speed, t => r.g.scale.setScalar(Math.max(0.01, 1 - t)));
      R.place(r, path[path.length - 1][0], path[path.length - 1][1]);
      R.fx.burst('magic', R.anchor(id, 'chest'), { color: '#b49cff' });
      await tween(0.2 / R.speed, t => r.g.scale.setScalar(Math.max(0.01, t))); r.g.scale.setScalar(1); return;
    }
    const sp = kind === 'push' ? 9 : kind === 'step' ? 2.6 : 4.2;
    const per = (kind === 'push' ? 0.08 : 1 / sp) / R.speed;
    if (r.fig && kind !== 'push') r.fig.setMoving(true, sp * R.speed);
    for (let i = 1; i < path.length; i++) {
      const a = R.unitWorld(r, path[i - 1][0], path[i - 1][1]), b = R.unitWorld(r, path[i][0], path[i][1]);
      if (kind !== 'push') R.face(r, path[i][0] + (r.sq - 1) / 2, path[i][1] + (r.sq - 1) / 2);
      const diag = path[i][0] !== path[i - 1][0] && path[i][1] !== path[i - 1][1];
      const jump = Math.abs(b.y - a.y) > 0.3;
      await tween(per * (diag ? 1.4 : 1) * (jump ? 1.3 : 1), t => { r.g.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + (jump ? Math.sin(t * Math.PI) * 0.35 : 0), a.z + (b.z - a.z) * t); });
      r.x = path[i][0]; r.y = path[i][1];
      if (i % 2 === 0 && !instant() && gfxLevel !== 'off') R.fx.burst('dust', r.g.position.clone(), { scale: 0.4 * r.sq });
    }
    if (r.fig) r.fig.setMoving(false);
    R.place(r, r.x, r.y);
    if (kind === 'push') R.fx.burst('dust', r.g.position.clone(), { scale: 0.8 * r.sq });
  };
  R.hitReact = (r, deg, heavy) => {
    if (!r || !r.fig) return;
    if (deg >= 2) { r.fig.play('hit', { heavy: !!heavy, speed: R.speed }); if (r.fig.setTint) { r.fig.setTint('#ff4a3a'); setTimeout(() => r.fig && r.fig.setTint(null), 140); } }
    else r.fig.play('dodge', { speed: R.speed });
  };
  // a full attack: wind-up, projectile/contact, impact effects
  R.animAttack = async (aid, bid, ranged, deg, c, w) => {
    const a = R.units[aid], b = R.units[bid]; if (!a || !b) return;
    R.faceUnit(a, b);
    let restore = null;
    if (!instant() && R.speed <= 2 && (deg === 3 || Math.random() < 0.35)) restore = R.actionCam(aid, bid);
    const spell = c && c !== 'weapon';
    if (!a.fig) { await R.wait(0.2); }
    else if (!ranged) {
      const h = a.fig.play('melee', { speed: R.speed });
      await timeout(h.impact, 1.5 / R.speed);
      const p = R.anchor(bid, 'chest');
      if (deg >= 2) R.fx.burst(deg === 3 ? 'crit' : (spell ? 'magic' : 'spark'), p, { color: R.fxColor(c) });
      else R.fx.burst('dust', p, { scale: 0.5 });
      R.hitReact(b, deg, deg === 3);
      await timeout(h.done, 1.2 / R.speed);
    } else {
      const h = a.fig.play(spell ? 'cast' : 'ranged', { speed: R.speed, color: R.fxColor(c) });
      await timeout(h.impact, 1.5 / R.speed);
      const from = R.anchor(aid, spell ? 'handR' : 'weapon'), to = R.anchor(bid, 'chest');
      if (deg < 2) to.add(new THREE.Vector3((Math.random() - 0.5) * 1.4, 0.3, (Math.random() - 0.5) * 1.4));
      if (c === 'electricity') await R.fx.bolt(from, to, { color: R.fxColor(c) });
      else await timeout(R.fx.projectile(projKind(c, w), from, to, { color: R.fxColor(c), speed: 18 * Math.min(R.speed, 3) }), 2);
      if (deg >= 2) R.fx.burst(deg === 3 ? 'crit' : spell ? 'magic' : 'impact', R.anchor(bid, 'chest'), { color: R.fxColor(c) });
      R.hitReact(b, deg, deg === 3);
    }
    if (restore) { await R.wait(0.35); if (R.units[aid] === a && R.units[bid] === b) restore(); }
  };
  R.animBolt = async (aid, bid, c, n) => {
    const a = R.units[aid], b = R.units[bid]; if (!a || !b) return;
    if (aid !== bid) R.faceUnit(a, b);
    const from = R.anchor(aid, 'handR'), to = R.anchor(bid, 'chest');
    if (c === 'heal' || c === 'vitality') { R.fx.burst('heal', to, {}); await R.wait(0.25); return; }
    if (c === 'electricity') { await R.fx.bolt(from, to, { color: R.fxColor(c) }); R.fx.burst('magic', to, { color: R.fxColor(c) }); return; }
    if (c === 'void') { await timeout(R.fx.projectile('magic', from, to, { color: R.fxColor(c) }), 2); R.fx.burst('shadow', to, {}); return; }
    if (c === 'force' && n > 1) { await timeout(R.fx.projectile('force', from, to, { count: n }), 3); R.fx.burst('magic', to, { color: R.fxColor(c) }); R.hitReact(b, 2); return; }
    if (c === 'mental' || c === 'spirit' || c === 'sonic') { await R.fx.beam(from, to, { color: R.fxColor(c), duration: 0.35 / R.speed }); R.fx.burst('magic', to, { color: R.fxColor(c) }); R.hitReact(b, 2); return; }
    await timeout(R.fx.projectile(projKind(c), from, to, { color: R.fxColor(c) }), 2);
    R.fx.burst(c === 'cold' ? 'frost' : c === 'acid' ? 'acid' : 'magic', to, { color: R.fxColor(c) });
    R.hitReact(b, 2);
  };
  // area: e = {cells, c, shape, origin, u}
  R.animArea = async (cells, c, shape, origin, uid) => {
    const col = R.fxColor(c); const kind = { fire: 'fire', cold: 'cold', acid: 'acid', electricity: 'electricity', poison: 'poison', sonic: 'sonic' }[c] || 'fire';
    // flash the tiles
    const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const grp = new THREE.Group(); cells.forEach(([x, y]) => { const p = new THREE.Mesh(tileGeo, m); p.rotation.x = -Math.PI / 2; p.position.set(x + 0.5, R.tileTop(x, y) + 0.06, y + 0.5); grp.add(p); });
    fxg.add(grp);
    const flash = tween(0.7 / R.speed, t => { m.opacity = Math.sin(t * Math.PI) * 0.45; });
    const src = uid && R.units[uid];
    let p = null;
    try {
      if ((shape === 'cone' || shape === 'line') && src && cells.length) {
        let cx = 0, cz = 0; cells.forEach(([x, y]) => { cx += x + 0.5; cz += y + 0.5; }); cx /= cells.length; cz /= cells.length;
        const o = R.anchor(uid, 'mouth'); const far = cells.reduce((best, [x, y]) => { const d = Math.hypot(x + 0.5 - o.x, y + 0.5 - o.z); return d > best.d ? { d, x, y } : best; }, { d: 0, x: 0, y: 0 });
        const dir = new THREE.Vector3(cx - o.x, 0, cz - o.z).normalize();
        R.faceUnit(src, { g: { position: new THREE.Vector3(cx, 0, cz) } });
        if (src.fig) { const h = src.fig.play(shape === 'cone' && /dragon|drake|hound|wyvern/i.test((src.fig.desc && src.fig.desc.plan) || '') ? 'breath' : 'cast', { speed: R.speed, color: col }); await timeout(h.impact, 1.2 / R.speed); }
        p = shape === 'cone' ? R.fx.cone(o, dir, far.d + 0.6, Math.PI / 4, kind) : R.fx.line(o, new THREE.Vector3(far.x + 0.5, o.y, far.y + 0.5), 0.6, kind);
      } else if (shape === 'emanation' && src) { p = R.fx.ring(src.g.position.clone().setY(src.g.position.y + 0.2), (cells.length ? Math.sqrt(cells.length / Math.PI) : 6), col); }
      else {
        let cx = origin ? origin.x : 0, cz = origin ? origin.y : 0;
        if (!origin && cells.length) { cells.forEach(([x, y]) => { cx += x + 0.5; cz += y + 0.5; }); cx /= cells.length; cz /= cells.length; }
        const rad = Math.max(0.8, Math.sqrt(cells.length / Math.PI));
        const gy = R.tileTop(Math.floor(cx), Math.floor(cz));
        if (src && src.fig) { R.faceUnit(src, { g: { position: new THREE.Vector3(cx, 0, cz) } }); const h = src.fig.play('cast', { speed: R.speed, color: col }); await timeout(h.impact, 1.2 / R.speed); await timeout(R.fx.projectile(projKind(c), R.anchor(uid, 'handR'), new THREE.Vector3(cx, gy + 1.2, cz), { color: col }), 2); }
        p = R.fx.explosion(new THREE.Vector3(cx, gy + 0.6, cz), rad, c === 'fire' ? 'fire' : kind, { groundY: gy });
      }
    } catch (e) { console.warn(e); }
    if (p) await timeout(p, 1.5);
    await flash; fxg.remove(grp); m.dispose();
  };
  R.animPulse = async (id, rft, c) => { const r = R.units[id]; if (!r) return; const p = r.g.position.clone(); p.y += 0.15; await timeout(R.fx.ring(p, rft / 5 + r.sq / 2, R.fxColor(c)), 1.2); };
  R.animCast = async (id, c) => {
    const r = R.units[id]; if (!r) return;
    R.fx.burst('magic', R.anchor(id, 'handR'), { color: R.fxColor(c), scale: 0.6 });
    if (r.fig) { const h = r.fig.play('cast', { speed: R.speed, color: R.fxColor(c) }); await timeout(h.impact, 1 / R.speed); } else await R.wait(0.15);
  };
  R.animDeath = async id => {
    const r = R.units[id]; if (!r) return; r.state.dead = true; r.dead = true;
    R.fx.burst('death', R.anchor(id, 'chest'), {});
    if (r.fig) { const h = r.fig.play('die', { speed: R.speed }); await timeout(h.done, 1.6 / R.speed); r.fig.setPose('dead'); }
    r.g.userData.ring.material.emissiveIntensity = 0.05; r.g.userData.ring.material.color.set('#333');
  };
  R.animHeal = id => R.fx.burst('heal', R.anchor(id, 'chest'), {});
  R.animFloatFx = (id, kind) => R.fx.burst(kind, R.anchor(id, 'chest'), {});

  /* ---------- loop ---------- */
  let last = performance.now(); let running = true; let tAcc = 0; const camT = new THREE.Vector3();
  const loop = now => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; tAcc += dt;
    const k = 1 - Math.pow(0.002, dt);
    cam.tx += (cam.gtx - cam.tx) * k; cam.tz += (cam.gtz - cam.tz) * k; cam.ty += (cam.gty - cam.ty) * k; cam.dist += (cam.gdist - cam.dist) * k; cam.pitch += (cam.gpitch - cam.pitch) * k;
    cam.yaw += (cam.gyaw - cam.yaw) * k;
    applyCam();
    for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; tw.t += dt; const f = Math.min(1, tw.t / tw.dur); tw.fn(f); if (f >= 1) { tweens.splice(i, 1); tw.res(); } }
    Object.values(R.units).forEach(r => {
      const h = r.holder; let dy = r.facing - h.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; h.rotation.y += dy * Math.min(1, dt * 9);
      if (r.fig) r.fig.update(dt * Math.min(R.speed, 3));
      const ring = r.g.userData.ring; if (r.active && !r.dead) ring.material.emissiveIntensity = 0.9 + Math.sin(tAcc * 5) * 0.35; else if (r.targeted && !r.dead) ring.material.emissiveIntensity = 0.8 + Math.sin(tAcc * 8) * 0.4;
    });
    try { Gfx.update(dt); R.fx.update(dt * Math.min(R.speed, 3)); if (R.env && R.env.update) { camT.set(cam.tx, 0, cam.tz); R.env.update(dt, camera, camT); } } catch (e) { /* */ }
    if (R.onFrame) R.onFrame(dt);
    try { R.post.render(dt); } catch (e) { console.warn('post failed, falling back', e); R.post.setQuality('off'); renderer.render(scene, camera); }
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
