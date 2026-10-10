/* ui_battle.js — battle controller: turn flow, ability tray, targeting (chips, shot preview), HUD panels, input */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D, U = PF.U, App = PF.App;
const $ = App.$, $$ = App.$$, esc = U.esc, ico = App.icon, Icons = PF.Icons;
const BC = App.Battle = { B: null, busy: false, mode: null, plates: {}, disp: {}, keys: {}, stats: null, tab: 'combat', tabs: {}, tgtSel: null, tgtHover: null, rings: {} };
const GLYPH = App.costGlyph;
BC.GLYPH = GLYPH;
const pct = x => Math.round(x * 100);
const SAVEN = { fort: 'Fortitude', ref: 'Reflex', will: 'Will', per: 'Perception' };
const reduced = () => G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTargetMode = m => m && (m.type === 'unit' || m.type === 'spell' || m.type === 'move+unit' || m.type === 'step+unit');

/* ================= START / TEARDOWN ================= */
App.startBattle = cfg => {
  BC.teardown();
  const B = PF.Battle(cfg); B.deploy();
  BC.B = B; App.B = B; BC.cfg = U.clone(cfg); BC.phase = 'deploy'; BC.cur = null; BC.sel = null; BC.mode = null; BC.busy = false; BC.tgtSel = null; BC.tgtHover = null; BC.tabs = {}; BC.endArm = 0;
  BC.stats = { dmg: { pc: 0, foe: 0 }, crits: { pc: 0, foe: 0 }, kills: { pc: 0, foe: 0 } };
  BC.ustats = {}; BC.lastAtk = {}; BC.playCur = null; BC.foeBanner = false;
  B.units.forEach(u => { BC.ustats[u.id] = { dmg: 0, taken: 0, kills: 0, crits: 0, heal: 0 }; });
  const R = App.R; R.loadMap(B); App.dioramaMap = null; App.applyGrid(); R.speed = +App.settings.speed || 1;
  B.units.forEach(u => { R.addUnit(u); BC.disp[u.id] = B.snap(u); });
  BC.makePlates();
  App.show('battle');
  $('#logBody').innerHTML = ''; $('#result').hidden = true; $('#inspect').hidden = true; $('#spellbook').hidden = true; $('#helpPanel').hidden = true; $('#banner').hidden = true; $('#shotPanel').hidden = true; $('#tip').hidden = true;
  const logOpen = App.settings.logOpen != null ? App.settings.logOpen : G.innerWidth >= 1280;
  $('#logPanel').classList.toggle('closed', !logOpen);
  $('#deployBar').hidden = false; $('#roundLbl').textContent = 'Deployment'; $('#roundSub').textContent = cfg.title || D.maps[cfg.map].name;
  if (String(+$('#animSpeed').value) !== String(App.settings.speed)) $('#animSpeed').value = String(App.settings.speed);
  BC.showZones();
  const cen = team => { const us = B.units.filter(u => u.team === team); return { x: us.reduce((a, u) => a + u.x + u.sq / 2, 0) / Math.max(1, us.length), y: us.reduce((a, u) => a + u.y + u.sq / 2, 0) / Math.max(1, us.length) }; };
  const a = cen('pc'), b = cen('foe');
  R.cam.gyaw = R.cam.yaw = Math.atan2(a.x - b.x, a.y - b.y); R.cam.gdist = innerWidth < 760 ? (innerHeight > innerWidth ? 15 : 13) : 17; R.cam.gpitch = 0.88;
  R.focus(a.x * 0.65 + b.x * 0.35, a.y * 0.65 + b.y * 0.35, true);
  BC.addLog({ text: (cfg.title ? cfg.title + ' — ' : '') + D.maps[cfg.map].name + '. Party level ' + cfg.partyLevel + '. ' + BC.threatText(), cls: 'head' });
  const first = B.units.find(u => u.team === 'pc'); BC.sel = first || null; if (first) R.setActive(first.id);
  BC.renderInit(); BC.renderUnitCard(first); BC.renderActions();
};
BC.threatText = () => { const B = BC.B; const pcs = B.units.filter(u => u.team === 'pc').length; const xp = D.encounterXP(BC.cfg.foes.filter(f => D.creatures[f.id]), BC.cfg.partyLevel); const th = PF.threatFor(xp, pcs); return th.label + ' threat (' + xp + ' XP for ' + pcs + ' heroes).'; };
BC.teardown = () => {
  Object.values(BC.rings).forEach(r => { r.visible = false; r.userData.id = null; });
  if (!BC.B) return;
  Object.values(BC.plates).forEach(p => p.el.remove()); BC.plates = {}; BC.disp = {};
  $$('#plates .float').forEach(e => e.remove());
  App.R.clearLayers(); App.R.showPath(null); App.R.setTargeted([]); App.R.setActive(null);
  Object.keys(App.R.terrainFx).forEach(App.R.removeTerrainFx);
  $('#shotPanel').hidden = true; $('#tip').hidden = true; $('#targetBar').innerHTML = ''; $('#abilityInfo').innerHTML = '';
  BC.B = null; App.B = null; BC.busy = false; BC.gen = (BC.gen || 0) + 1;
};
BC.showZones = () => { const B = BC.B, R = App.R; R.layer('zonePC', B.zone.pc, '#4bd8e8', 0.26); R.layer('zoneFoe', B.zone.foe, '#ff5d55', 0.2); };

/* ================= UI-SIDE 3D HIGHLIGHT RINGS ================= */
BC.ring = (key, id, color) => {
  const T = G.THREE; const R = App.R; if (!T || !R || !R.scene) return;
  let ring = BC.rings[key];
  if (!ring) {
    const g = new T.Group();
    const m = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, side: T.DoubleSide });
    const disc = new T.Mesh(new T.RingGeometry(0.6, 0.67, 48), m); disc.rotation.x = -Math.PI / 2; g.add(disc);
    for (let i = 0; i < 4; i++) { const c = new T.Mesh(new T.PlaneGeometry(0.18, 0.06), m); c.rotation.x = -Math.PI / 2; const a = i * Math.PI / 2 + Math.PI / 4; c.position.set(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8); c.rotation.z = -a; g.add(c); }
    g.renderOrder = 6; g.traverse(o => { o.renderOrder = 6; }); g.visible = false; R.scene.add(g); ring = BC.rings[key] = g; ring.userData.mat = m;
  }
  ring.userData.mat.color.set(color);
  ring.userData.id = id && R.units[id] ? id : null; ring.visible = !!ring.userData.id;
};

/* ================= PLATES & FLOATS ================= */
BC.makePlates = () => {
  const host = $('#plates');
  BC.B.units.forEach(u => {
    const el = document.createElement('div'); el.className = 'plate ' + u.team;
    el.innerHTML = '<div class="pl-cs"></div><div class="pl-top"><span class="pl-lv"></span><b></b></div><div class="pl-hp"><i></i><em></em><u></u></div>';
    host.appendChild(el); BC.plates[u.id] = { el, u, sig: '' };
    BC.updatePlate(u.id);
  });
};
const segFor = max => max <= 30 ? 100 / max : max <= 80 ? 500 / max : max <= 200 ? 1000 / max : 2500 / max;
BC.updatePlate = id => {
  const p = BC.plates[id]; if (!p) return; const s = BC.disp[id] || {}; const u = p.u;
  const short = u.name.length > 18 ? u.name.slice(0, 17) + '…' : u.name;
  p.el.querySelector('b').textContent = short;
  p.el.querySelector('.pl-lv').textContent = u.level;
  const pc = Math.max(0, s.hp / Math.max(1, s.maxHP)); const tp = Math.min(1 - pc, (s.temp || 0) / Math.max(1, s.maxHP));
  p.el.querySelector('i').style.width = (pc * 100) + '%';
  const em = p.el.querySelector('em'); em.style.left = (pc * 100) + '%'; em.style.width = (tp * 100) + '%';
  p.el.querySelector('.pl-hp').style.setProperty('--seg', segFor(s.maxHP || 1) + '%');
  const conds = (s.conds || []).filter(c => c.k !== 'prey').sort((a, b) => (b.bad ? 1 : 0) - (a.bad ? 1 : 0)).slice(0, 5);
  const sig = conds.map(c => c.n).join('|') + (s.dying ? 'd' + s.dying : '') + (s.shield ? 's' : '');
  if (sig !== p.sig) {
    p.sig = sig;
    p.el.querySelector('.pl-cs').innerHTML = (s.dying ? '<span class="pl-dy" style="width:auto;border:0">Dying ' + s.dying + '</span>' : '') + (s.shield ? '<span class="g" title="Shield raised">' + ico('shield') + '</span>' : '') + conds.map(c => '<span class="' + (c.bad ? '' : 'g') + '" title="' + esc(c.n) + '">' + ico(Icons.forCond(c)) + '</span>').join('');
  }
  p.el.classList.toggle('dead', !!s.dead);
};
BC.markPlates = () => {
  const curId = BC.B && BC.B.cur ? BC.B.cur.id : null; const tg = BC.tgtShown ? BC.tgtShown() : null;
  Object.entries(BC.plates).forEach(([id, p]) => { p.el.classList.toggle('cur', id === curId && BC.phase === 'battle'); p.el.classList.toggle('tgt', !!tg && tg.id === id); });
};
BC.frame = () => {
  if (!BC.B) return;
  const R = App.R;
  const hb = $('#hudBottom').offsetHeight; if (hb !== BC._hb) { BC._hb = hb; $('#battle').style.setProperty('--hudb', hb + 'px'); }
  // position nameplates, then nudge overlapping ones upward (declutter), keeping the nearest-to-camera plate in place
  const vis = [];
  Object.keys(BC.plates).forEach(id => { const p = BC.plates[id]; const sc = R.unitScreen(id); if (!sc || sc.behind) { p.el.style.display = 'none'; return; } p.el.style.display = ''; vis.push({ p, x: sc.x, y: sc.y, w: p.w || (p.w = p.el.offsetWidth || 90), h: p.h || (p.h = p.el.offsetHeight || 28) }); });
  vis.sort((a, b) => b.y - a.y);
  for (let i = 0; i < vis.length; i++) {
    const a = vis[i];
    for (let k = 0; k < 6; k++) {
      let moved = false;
      for (let j = 0; j < i; j++) { const b = vis[j]; if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 4 && Math.abs(a.y - b.y) < a.h) { a.y = b.y - a.h - 1; moved = true; } }
      if (!moved) break;
    }
    a.p.el.style.left = a.x + 'px'; a.p.el.style.top = a.y + 'px';
  }
  if (!BC._plateMeasure || BC._plateMeasure++ > 120) { BC._plateMeasure = 1; Object.values(BC.plates).forEach(p => { p.w = 0; p.h = 0; }); }
  const t = performance.now() / 1000;
  Object.values(BC.rings).forEach(r => { if (!r.visible) return; const ru = R.units[r.userData.id]; if (!ru || ru.dead) { r.visible = false; return; } const pz = ru.g.position; r.position.set(pz.x, pz.y + 0.07, pz.z); const s = (ru.sq || 1) * (1 + (reduced() ? 0 : 0.05 * Math.sin(t * 5))); r.scale.set(s, s, s); r.rotation.y = reduced() ? 0 : t * 0.6; });
  const k = BC.keys; const sp = 0.35;
  if (k.w || k.arrowup) R.pan(0, -sp); if (k.s || k.arrowdown) R.pan(0, sp); if (k.a || k.arrowleft) R.pan(-sp, 0); if (k.d || k.arrowright) R.pan(sp, 0);
};
BC._fl = {};
BC.float = (id, text, c) => {
  const sc = App.R.unitScreen(id); if (!sc) return;
  const now = performance.now(); const rec = BC._fl[id] = (BC._fl[id] && now - BC._fl[id].t < 700) ? { t: now, n: BC._fl[id].n + 1 } : { t: now, n: 0 };
  const el = document.createElement('div'); el.className = 'float ' + (c || 'info'); el.textContent = text;
  el.style.left = (sc.x + (Math.random() - 0.5) * 18) + 'px'; el.style.top = (sc.y - 10 - (rec.n % 4) * 20) + 'px';
  $('#plates').appendChild(el); setTimeout(() => el.remove(), 1500);
};

/* ================= EVENT PLAYBACK ================= */
BC.play = async () => {
  const B = BC.B; if (!B) return; const gen = BC.gen;
  let evs = B.drain();
  while (evs.length) {
    for (const e of evs) { if (gen !== BC.gen) return; await BC.playOne(e); }
    evs = B.drain();
  }
  BC.renderInit();
};
const credit = (uid, k, n) => { const s = BC.ustats && BC.ustats[uid]; if (s) s[k] += n; };
BC.playOne = async e => {
  const R = App.R; const B = BC.B;
  R.speed = +$('#animSpeed').value || 1;
  switch (e.t) {
    case 'log': BC.addLog(e); break;
    case 'move': if (e.path && e.path.length > 1) await R.animMove(e.u, e.path, e.kind); break;
    case 'attack': {
      const a = B.get(e.a); BC.lastAtk[e.b] = e.a;
      if (a && BC.stats && e.deg === 3) { BC.stats.crits[a.team]++; credit(e.a, 'crits', 1); }
      await R.animAttack(e.a, e.b, e.ranged, e.deg, e.c, e.w);
      if (e.deg <= 1) BC.float(e.b, e.deg === 0 ? 'Critical miss' : 'Miss', 'miss');
      else if (e.deg === 3) BC.float(e.b, 'Critical hit', 'critlbl');
      break;
    }
    case 'bolt': { BC.lastAtk[e.b] = e.a; await R.animBolt(e.a, e.b, e.c, e.n || 1); break; }
    case 'area': await R.animArea(e.cells, e.c, e.shape, e.origin, e.u); break;
    case 'pulse': await R.animPulse(e.u, e.r, e.c); break;
    case 'cast': BC.lastCaster = e.u; await R.animCast(e.u, e.c); break;
    case 'float': {
      BC.float(e.u, e.text, e.c);
      const t = B.get(e.u);
      if (t && /^−\d+/.test(e.text)) {
        const n = +e.text.slice(1); if (BC.stats) BC.stats.dmg[t.team === 'pc' ? 'foe' : 'pc'] += n;
        credit(e.u, 'taken', n);
        const src = B.get(BC.lastAtk[e.u] || BC.lastCaster || BC.playCur); const by = src && src.team !== t.team ? src : B.get(BC.playCur);
        if (by && by.team !== t.team) credit(by.id, 'dmg', n);
      } else if (t && /^\+\d+/.test(e.text)) { R.animHeal && R.animHeal(e.u); const h = B.get(BC.playCur); if (h && h.team === t.team) credit(h.id, 'heal', +e.text.slice(1)); }
      await R.wait(0.06); break;
    }
    case 'state': { BC.disp[e.u] = e.s; BC.updatePlate(e.u); const r = R.units[e.u]; if (r && !r.state.dead) R.setPose(e.u, { prone: e.s.prone, down: e.s.down && !e.s.dead, shield: e.s.shield }); if (BC.shown && BC.shown.id === e.u) BC.renderUnitCard(BC.shown, true); BC.dirtyInit(); break; }
    case 'prone': R.setPose(e.u, { prone: e.v }); await R.wait(0.08); break;
    case 'down': R.setPose(e.u, { down: true }); await R.wait(0.15); break;
    case 'up': R.setPose(e.u, { down: false }); break;
    case 'dead': { const t = B.get(e.u); if (t && BC.stats) { BC.stats.kills[t.team === 'pc' ? 'foe' : 'pc']++; const k = B.get(BC.lastAtk[e.u] || BC.playCur); if (k && k.team !== t.team) credit(k.id, 'kills', 1); } await R.animDeath(e.u); break; }
    case 'shield': R.setPose(e.u, { shield: e.v }); break;
    case 'turn': {
      const u = B.get(e.u); R.setActive(e.u); BC.playCur = e.u; if (u) { BC.cur = u; BC.renderActions(); } BC.lastAtk = {}; BC.lastCaster = null; BC.renderInit(e.u);
      if (u) {
        if (App.settings.follow) R.focus(u.x + u.sq / 2, u.y + u.sq / 2);
        BC.renderUnitCard(u);
        BC.addLog({ text: u.name + (u.team === 'pc' ? '' : ' (' + (u.cid && D.creatures[u.cid] ? 'creature ' + u.level : 'foe') + ')') + ' — turn', cls: 'turn ' + u.team });
        if (u.team === 'foe') { if (!BC.foeBanner && App.settings.banners) { BC.foeBanner = true; await BC.banner({ kind: 'foe', k: 'Enemy activity', t: u.name, s: B.units.filter(x => x.team === 'foe' && B.alive(x)).length + ' hostile' }, 0.75); } }
        else BC.foeBanner = false;
      }
      BC.markPlates();
      await R.wait(0.18); break;
    }
    case 'round': $('#roundLbl').textContent = 'Round ' + e.n; $('#roundSub').textContent = BC.cfg.title || D.maps[BC.cfg.map].name; BC.foeBanner = false; if (App.settings.banners || e.n === 1) await BC.banner({ kind: 'round', k: 'Round', t: String(e.n), s: e.n === 1 ? 'Initiative rolled' : '' }, 0.6); break;
    case 'terrain': if (e.remove) R.removeTerrainFx(e.id); else R.addTerrainFx(e.id, e.cells, e.kind); break;
    case 'over': break;
  }
};
BC.dirtyInit = () => { if (BC._di) return; BC._di = requestAnimationFrame(() => { BC._di = 0; BC.renderInit(); }); };
// banner: {kind:'round'|'pc'|'foe'|'flash', k, t, s}; awaits dur seconds (scaled by animation speed)
BC.banner = async (o, dur = 0.6) => {
  const b = $('#banner'); clearTimeout(BC._ft);
  b.className = 'banner ' + (o.kind || ''); b.innerHTML = (o.k ? '<div class="bk">' + esc(o.k) + '</div>' : '') + '<div class="bt">' + esc(o.t || '') + '</div>' + (o.s ? '<div class="bs">' + esc(o.s) + '</div>' : '');
  b.hidden = false;
  await App.R.wait(dur);
  b.classList.add('out'); await App.R.wait(0.12); if (b.classList.contains('out')) b.hidden = true;
};

/* ================= LOG ================= */
BC.addLog = e => {
  const el = document.createElement('div'); el.className = 'll ' + (e.cls || '') + (e.det ? ' has' : '');
  el.textContent = e.text;
  if (e.det) { el.title = 'Show roll breakdown'; el.onclick = () => { const d = el.querySelector('.det'); el.classList.toggle('open', !d); if (d) d.remove(); else { const s = document.createElement('span'); s.className = 'det'; s.textContent = e.det; el.appendChild(s); } }; }
  const body = $('#logBody'); const stick = body.scrollTop + body.clientHeight >= body.scrollHeight - 30;
  body.appendChild(el);
  while (body.children.length > 800) body.removeChild(body.firstChild);
  if (stick) body.scrollTop = body.scrollHeight;
};
BC.toggleLog = force => { const l = $('#logPanel'); const open = force != null ? force : l.classList.contains('closed'); l.classList.toggle('closed', !open); $('#btnLog').classList.toggle('on', open); App.settings.logOpen = open; App.saveSettings(); if (open) { const b = $('#logBody'); b.scrollTop = b.scrollHeight; } };

/* ================= TURN FLOW ================= */
BC.begin = async () => {
  if (BC.phase !== 'deploy' || BC.busy) return;
  BC.phase = 'battle'; $('#deployBar').hidden = true; App.R.clearLayers(['zonePC', 'zoneFoe']);
  BC.busy = true; BC.B.begin(); await BC.play(); BC.busy = false;
  BC.advance();
};
BC.advance = async () => {
  const B = BC.B; if (!B) return; const gen = BC.gen;
  for (let guard = 0; guard < 400; guard++) {
    if (gen !== BC.gen) return;
    if (B.over) return BC.finish();
    const u = B.next(); BC.busy = true; await BC.play(); if (gen !== BC.gen) return;
    if (!u) return BC.finish();
    BC.cur = u;
    const auto = u.ai || (u.team === 'pc' && $('#autoParty').checked) || B.cv(u, 'fleeing');
    if (!auto) { BC.busy = false; BC.startPlayerTurn(u); return; }
    BC.mode = null; BC.renderActions(); App.R.clearLayers(['move1', 'move2', 'move3', 'valid', 'area', 'hoverArea']); App.R.showPath(null); BC.hideShot();
    await App.R.wait(0.12);
    try { B.aiTurn(u); } catch (err) { console.error(err); BC.addLog({ text: 'AI error: ' + err.message, cls: 'bad' }); }
    await BC.play(); if (gen !== BC.gen) return;
    if (!B.over && B.cur === u) B.endTurn(u);
    await BC.play(); if (gen !== BC.gen) return;
  }
};
BC.startPlayerTurn = u => {
  BC.mode = { type: 'move' }; BC.tgtSel = null; BC.tgtHover = null; BC.endArm = 0; $('#spellbook').hidden = true;
  BC.tab = BC.tabs[u.id] || 'combat';
  BC.renderUnitCard(u); BC.shown = u;
  if (App.settings.banners) BC.banner({ kind: 'pc', k: 'Your turn', t: u.name, s: (u.clsName || '') + ' · ' + B_acts(u) + ' actions' }, 0.55);
  BC.refresh();
};
const B_acts = u => BC.B ? BC.B.actsTotal(u) : 3;
BC.refresh = () => {
  const B = BC.B, u = BC.cur; if (!B || !u) return;
  BC.P = B.paths(u, B.speedOf(u) * Math.max(0, B.actsTotal(u)));
  BC.renderUnitCard(u); BC.renderActions(); BC.drawMode();
};
BC.isPlayerTurn = () => BC.B && BC.cur && BC.B.cur === BC.cur && !BC.busy && BC.phase === 'battle' && !BC.B.over && !BC.cur.ai && !$('#autoParty').checked;
BC.after = async () => {
  const B = BC.B, u = BC.cur; const gen = BC.gen;
  await BC.play(); if (gen !== BC.gen) return;
  if (B.over) { BC.busy = false; return BC.finish(); }
  if (B.cur !== u || !B.canAct(u) || B.actsTotal(u) <= 0) {
    if (B.cur === u) { await App.R.wait(0.25); B.endTurn(u); await BC.play(); }
    BC.busy = false; return BC.advance();
  }
  BC.busy = false; BC.mode = { type: 'move' }; BC.tgtSel = null; BC.refresh();
};
BC.act = async (id, p) => {
  if (!BC.isPlayerTurn()) return;
  BC.busy = true; $('#spellbook').hidden = true; $('#tip').hidden = true; BC.hideShot(); BC.ring('sel', null, '#f5b942');
  App.R.clearLayers(['move1', 'move2', 'move3', 'valid', 'area', 'hoverArea']); App.R.showPath(null); App.R.setTargeted([]);
  $('#targetBar').innerHTML = ''; BC.renderActions(true);
  const r = BC.B.doAction(BC.cur, id, p);
  if (!r.ok) { BC.busy = false; BC.addLog({ text: r.err, cls: 'warn' }); BC.flash(r.err); BC.mode = { type: 'move' }; BC.refresh(); return; }
  await BC.after();
};
BC.endTurn = async force => {
  if (!BC.isPlayerTurn()) return;
  const left = BC.B.actsTotal(BC.cur);
  if (!force && App.settings.confirmEnd && left > 0 && !(BC.endArm && performance.now() - BC.endArm < 2600)) {
    BC.endArm = performance.now(); BC.flash(left + ' action' + (left > 1 ? 's' : '') + ' left — End turn again to confirm'); BC.renderEnd(); return;
  }
  BC.endArm = 0;
  BC.busy = true; App.R.clearLayers(); App.R.showPath(null); $('#spellbook').hidden = true; $('#tip').hidden = true; BC.hideShot(); BC.ring('sel', null, '#f5b942');
  $('#targetBar').innerHTML = ''; BC.renderActions(true);
  BC.B.endTurn(BC.cur); await BC.play(); BC.busy = false; BC.advance();
};
BC.flash = msg => { const b = $('#banner'); clearTimeout(BC._ft); b.className = 'banner flash'; b.innerHTML = '<div class="bt">' + esc(msg) + '</div>'; b.hidden = false; BC._ft = setTimeout(() => { b.hidden = true; }, 1600); };
BC.finish = () => {
  const B = BC.B; if (!B) return; BC.busy = false;
  App.R.clearLayers(); App.R.showPath(null); App.R.setActive(null); BC.hideShot(); BC.ring('sel', null, '#f5b942'); BC.ring('hl', null, '#4bd8e8');
  $('#targetBar').innerHTML = ''; $('#spellbook').hidden = true; BC.renderActions();
  const win = B.over === 'win'; const st = BC.stats;
  const pcs = B.units.filter(u => u.team === 'pc');
  const us = id => BC.ustats[id] || { dmg: 0, taken: 0, kills: 0, crits: 0, heal: 0 };
  const score = p => { const s = us(p.id); return s.dmg + s.kills * 12 + s.crits * 4 + s.heal * 0.8; };
  const mvp = pcs.slice().sort((a, b) => score(b) - score(a))[0];
  const res = $('#result');
  res.className = 'result ' + (win ? 'win' : 'lose');
  const fate = p => p.dead ? '<span class="fate dead">Dead</span>' : p.hp <= 0 ? '<span class="fate down">Down</span>' : '<span class="fate ok">' + p.hp + '/' + B.maxHP(p) + '</span>';
  res.innerHTML = '<div class="res-head"><small>' + esc(BC.cfg.title || D.maps[BC.cfg.map].name) + ' · ' + B.round + ' round' + (B.round === 1 ? '' : 's') + '</small><h2>' + (win ? 'Victory' : 'Defeat') + '</h2><div class="dim">' + esc(BC.threatText()) + '</div></div>' +
    '<div class="res-stats"><div><b>' + st.dmg.pc + '</b><small>Damage dealt</small></div><div><b>' + st.dmg.foe + '</b><small>Damage taken</small></div><div><b>' + st.crits.pc + '</b><small>Critical hits</small></div><div><b>' + st.kills.pc + '/' + B.units.filter(u => u.team === 'foe').length + '</b><small>Foes defeated</small></div></div>' +
    (mvp ? '<div class="mvp">' + App.emblem(mvp, { size: 'lg', lv: mvp.level }) + '<div><small>' + ico('crown') + ' Most valuable</small><b>' + esc(mvp.name) + '</b><span>' + us(mvp.id).dmg + ' damage · ' + us(mvp.id).kills + ' defeated · ' + us(mvp.id).crits + ' crits' + (us(mvp.id).heal ? ' · ' + us(mvp.id).heal + ' healed' : '') + '</span></div>' + fate(mvp) + '</div>' : '') +
    '<div class="res-roster">' + pcs.map(p => '<div class="rr">' + App.emblem(p, { size: 'sm' }) + '<span>' + esc(p.name) + '</span><span class="st">' + us(p.id).dmg + ' <small>dmg</small></span><span class="st k">' + us(p.id).kills + ' <small>KO</small></span>' + fate(p) + '</div>').join('') + '</div>' +
    '<div class="res-actions"><button class="btn primary" id="rAgain">' + ico('swords2', 16) + ' Fight again</button><button class="btn" id="rEdit">Edit skirmish</button><button class="btn ghost" id="rHome">' + ico('home', 16) + ' Home</button></div>';
  res.hidden = false;
  $('#rAgain').onclick = () => App.startBattle(BC.cfg);
  $('#rEdit').onclick = () => { BC.teardown(); App.show('setup'); };
  $('#rHome').onclick = () => { BC.teardown(); App.show('home'); };
};

/* ================= INITIATIVE / UNIT CARD ================= */
BC.renderInit = curId => {
  const B = BC.B; if (!B) return;
  const ids = B.order.length ? B.order : B.units.map(u => u.id);
  curId = curId || (B.cur && B.cur.id);
  const ci = ids.indexOf(curId);
  $('#initBar').innerHTML = ids.map((id, i) => {
    const u = B.get(id); if (!u) return '';
    const s = BC.disp[id] || B.snap(u); const pc = Math.max(0, s.hp / Math.max(1, s.maxHP));
    const dots = (s.conds || []).filter(c => c.k !== 'prey').slice(0, 3).map(c => '<i class="' + (c.bad ? '' : 'g') + '"></i>').join('');
    return '<div class="icard ' + u.team + (id === curId && BC.phase === 'battle' ? ' cur' : '') + (s.dead || s.down ? ' down' : '') + (BC.phase === 'battle' && ci >= 0 && i < ci ? ' done' : '') + '" role="listitem" data-uid="' + id + '" title="' + esc(u.name + ' · initiative ' + (u.initRoll != null ? u.initRoll : '–') + ' · HP ' + s.hp + '/' + s.maxHP + (s.conds.length ? ' · ' + s.conds.map(c => c.n).join(', ') : '')) + '">' + (u.initRoll != null ? '<span class="in">' + u.initRoll + '</span>' : '') + '<span class="cd">' + dots + '</span>' + App.emblem(u, { foe: u.team !== 'pc' }) + '<span class="nm">' + esc(u.name) + '</span><span class="hp"><i style="width:' + (pc * 100) + '%"></i></span></div>';
  }).join('');
  const cur = $('#initBar .icard.cur'); if (cur && cur.scrollIntoView) { const bar = $('#initBar'); const r = cur.offsetLeft - bar.clientWidth / 2 + cur.clientWidth / 2; bar.scrollLeft = Math.max(0, r); }
  BC.markPlates();
};
BC.renderUnitCard = (u, quiet) => {
  const B = BC.B; const el = $('#unitCard'); if (!B || !u) { el.innerHTML = ''; return; }
  BC.shown = u;
  const s = B.snap(u);
  const pc = Math.max(0, s.hp / s.maxHP) * 100, tp = Math.min(100 - pc, (s.temp / s.maxHP) * 100);
  const sv = k => App.sgn(B.stat(u, k));
  const isCur = B.cur === u && BC.phase === 'battle';
  const pips = isCur ? Array.from({ length: 3 }, (_, i) => '<span class="pip' + (i < u.turn.acts ? ' on' : '') + '" title="Action"></span>').join('') + (u.turn.quick ? '<span class="pip quick on" title="Quickened: ' + esc(u.turn.quick.join('/')) + '"></span>' : '') : '';
  const react = '<span class="pip react' + (u.react > 0 ? ' on' : '') + '" title="Reaction ' + (u.react > 0 ? 'available' : 'used') + '">' + ico('react') + '</span>';
  const map = isCur && u.turn.attacks ? '<span class="econ-tag map" title="Multiple attack penalty for your next attack">MAP ' + App.sgn(B.mapPen(u, u.strikes[0])).replace('+', '') + '</span>' : '';
  const sh = u.shield ? '<span class="econ-tag shield' + (u.shield.raised ? ' up' : '') + '" title="' + esc((u.shield.name || 'Shield') + (u.shield.raised ? ' (raised)' : '') + ' · hardness ' + (u.shield.hard || 0) + (u.shield.broken ? ' · broken' : '')) + '">' + ico('shield') + (u.shield.broken ? 'broken' : (u.shield.cur != null ? u.shield.cur + '/' + (u.shield.hp || u.shield.cur) : '')) + '</span>' : '';
  const sub = u.team === 'pc' ? '<span class="tag">Level ' + u.level + ' ' + esc(u.clsName || '') + '</span>' + (u.sheet ? ' · ' + esc(u.sheet.ancName) : '') : '<span class="tag">Creature ' + u.level + '</span> · ' + esc((u.traits || []).slice(0, 2).join(' '));
  el.className = 'unitcard' + (u.team !== 'pc' ? ' foe' : '');
  el.innerHTML = '<div class="uc-head">' + App.emblem(u, { foe: u.team !== 'pc', size: 'lg', lv: u.level }) + '<div class="uc-name"><b>' + esc(u.name) + '</b><span>' + sub + '</span></div></div>' +
    '<div class="hpline"><div class="hpt"><span>HP <b>' + s.hp + '</b>/' + s.maxHP + (s.temp ? ' <span class="tmp">+' + s.temp + ' temp</span>' : '') + '</span>' + (s.dying ? '<span class="dy">Dying ' + s.dying + '</span>' : s.dead ? '<span class="dy">Dead</span>' : '') + '</div><div class="hpbar' + (pc <= 25 ? ' low' : pc <= 55 ? ' mid' : '') + '"><i style="width:' + pc + '%"></i><em style="left:' + pc + '%;width:' + tp + '%"></em><div class="seg" style="--seg:' + segFor(s.maxHP) + '%"></div></div></div>' +
    '<div class="uc-stats"><div class="ac"><small>AC</small><b>' + B.stat(u, 'ac') + '</b></div><div><small>Fort</small><b>' + sv('fort') + '</b></div><div><small>Ref</small><b>' + sv('ref') + '</b></div><div><small>Will</small><b>' + sv('will') + '</b></div><div><small>Per</small><b>' + sv('per') + '</b></div><div><small>Spd</small><b>' + B.speedOf(u) + '</b></div></div>' +
    '<div class="uc-econ"><span class="pips">' + pips + react + '</span>' + map + (u.hero ? '<span class="econ-tag hero" title="Hero Points">' + ico('hero') + u.hero + '</span>' : '') + (u.focus ? '<span class="econ-tag focus" title="Focus Points">' + ico('focus') + u.focus.cur + '/' + u.focus.max + '</span>' : '') + sh + '</div>' +
    (s.conds.length ? '<div class="chips">' + s.conds.map(c => '<span class="chip ' + (c.bad ? 'bad' : 'good') + '" title="' + esc(c.n + (PF.COND[c.k] ? ' — ' + PF.COND[c.k].d : '')) + '">' + ico(Icons.forCond(c)) + '<span class="ct">' + esc(c.n) + '</span></span>').join('') + '</div>' : '');
};
App.unitBlock = (u, B) => {
  const foe = u.team !== 'pc';
  let h = '<div class="sb"><div class="sb-head">' + App.emblem(u, { foe, size: 'lg' }) + '<div class="nm"><h3>' + esc(u.name) + '</h3><div class="sub">' + esc(u.team === 'pc' ? (u.sheet ? u.sheet.ancName + ' ' + u.sheet.clsName + (u.sheet.subName ? ' (' + u.sheet.subName + ')' : '') : '') : ((D.creatures[u.cid] || {}).desc || '')) + '</div></div><span class="kind">' + (u.team === 'pc' ? 'Level ' : 'Creature ') + u.level + '</span></div>';
  h += App.traitHTML([u.size].concat(u.traits));
  h += App.statsGrid([['HP', u.hp + '/' + B.maxHP(u), 'hp'], ['AC', B.stat(u, 'ac'), 'ac'], ['Fort', App.sgn(B.stat(u, 'fort'))], ['Ref', App.sgn(B.stat(u, 'ref'))], ['Will', App.sgn(B.stat(u, 'will'))], ['Perc', App.sgn(B.stat(u, 'per'))], ['Speed', B.speedOf(u)]]);
  if (u.immune && u.immune.length) h += '<div class="line"><b>Immunities</b> ' + esc(u.immune.join(', ')) + '</div>';
  if (Object.keys(u.resist || {}).length) h += '<div class="line"><b>Resistances</b> ' + Object.entries(u.resist).map(([k, v]) => esc(k) + ' ' + v).join(', ') + '</div>';
  if (Object.keys(u.weak || {}).length) h += '<div class="line"><b>Weaknesses</b> ' + Object.entries(u.weak).map(([k, v]) => esc(k) + ' ' + v).join(', ') + '</div>';
  if (u.regen) h += '<div class="line"><b>Regeneration</b> ' + u.regen.v + ' (deactivated by ' + esc(u.regen.off.join(', ')) + ')' + (u.regen.disabled ? ' — <span style="color:var(--amber)">currently off</span>' : '') + '</div>';
  h += '<hr>';
  u.strikes.forEach(s => { h += '<div class="line"><b>' + (s.kind === 'melee' ? 'Melee' : 'Ranged') + '</b><span class="act">◆</span>' + esc(s.name) + ' <span class="num">' + App.sgn(s.atk.base + s.atk.item) + '</span>' + (s.traits.length ? ' <span class="dim">(' + esc(s.traits.join(', ')) + ')</span>' : '') + ', <b>Damage</b> ' + esc(s.dmg.map(d => U.dstr(d) + ' ' + d.type).join(' plus ')) + (s.qty != null && s.thrown ? ' <span class="dim">· ' + s.qty + ' left</span>' : '') + '</div>'; });
  if (foe && u.cid && D.creatures[u.cid]) { const ab = App.creatureAbilities(D.creatures[u.cid]); if (ab.length) h += App.abilHTML(ab); }
  if (u.spells) { const cs = B.castables(u).filter(c => c.src !== 'cantrip'); h += '<div class="line"><b>Spells</b> DC ' + B.spellDC(u) + ' · ' + esc(cs.map(c => c.name + (c.left ? ' ×' + c.left : '')).join(', ') || 'none left') + '</div>'; }
  const conds = B.condList(u);
  if (conds.length) h += '<hr>' + conds.map(c => '<div class="line" style="display:flex;gap:6px;align-items:flex-start"><span style="color:' + (c.bad ? 'var(--red)' : 'var(--green)') + '">' + ico(Icons.forCond(c), 16) + '</span><span><b>' + esc(c.n) + '</b> <span class="dim">' + esc((PF.COND[c.k] || {}).d || '') + '</span></span></div>').join('');
  return h + '</div>';
};
BC.inspect = u => {
  const el = $('#inspect'); if (!u) { el.hidden = true; return; }
  el.innerHTML = '<button class="x ins-close" id="insClose" aria-label="Close">×</button>' + App.unitBlock(u, BC.B);
  el.hidden = false; $('#insClose').onclick = () => { el.hidden = true; };
};

/* ================= ABILITY TRAY ================= */
const MOVE_IDS = ['stride', 'step', 'stand', 'escape', 'mobility'];
const TACTIC_IDS = ['raiseShield', 'takeCover', 'reload', 'potion', 'retch'];
const keyOf = a => a.id === 'cast' ? 'cast:' + a.castKey : a.id + (a.strike ? ':' + a.strike : '') + (a.stance ? ':' + a.stance : '') + (a.abil ? ':' + a.abil : '');
BC.catalog = u => {
  const acts = BC.B.actionsFor(u);
  const g = { strike: [], move: [], class: [], tactic: [], skill: [], spell: [] };
  acts.forEach(a => {
    if (a.id === 'cast') g.spell.push(a);
    else if (a.group === 'strike') g.strike.push(a);
    else if (MOVE_IDS.includes(a.id)) g.move.push(a);
    else if (TACTIC_IDS.includes(a.id) || a.group === 'item') g.tactic.push(a);
    else if (a.group === 'skill') g.skill.push(a);
    else g.class.push(a);
  });
  return { acts, g };
};
const SHORT = { potion: 'Potion', raiseShield: 'Raise Shield', takeCover: 'Take Cover', medicine: 'Battle Medicine', mobility: 'Mobility' };
const btnCls = a => a.id === 'cast' ? 'spell' : a.group === 'strike' ? 'strike' : a.group === 'skill' ? 'skill' : a.group === 'item' || a.id === 'potion' ? 'itm' : a.group === 'monster' ? 'monster' : a.group === 'class' ? 'class' : '';
BC.renderActions = waiting => {
  const B = BC.B; const bar = $('#actionBar'); const tabs = $('#trayTabs');
  const u = BC.cur;
  BC.hot = [];
  if (!B || BC.phase !== 'battle' || !u || !BC.isPlayerTurn()) {
    tabs.innerHTML = '';
    bar.innerHTML = (BC.phase === 'deploy' || !B || B.over) ? '' : (u ? '<div class="waiting">' + App.emblem(u, { foe: u.team !== 'pc' }) + '<span>' + esc(u.name) + (waiting ? ' acts…' : ' is acting…') + '</span></div>' : '');
    $('#abilityInfo').innerHTML = ''; $('#endWrap').innerHTML = '';
    if (!B || !BC.isPlayerTurn()) $('#targetBar').innerHTML = '';
    return;
  }
  const { acts, g } = BC.catalog(u);
  BC.acts = acts; BC.keyMap = {};
  acts.forEach(a => { BC.keyMap[keyOf(a)] = a; });
  BC.spells = g.spell;
  const anySpell = g.spell.some(s => !s.why);
  BC.keyMap.spells = { id: 'spells', name: 'Spells', costN: 0, why: g.spell.length ? (anySpell ? '' : 'No castable spells') : 'No spells', desc: 'Open your spellbook' };
  if (BC.tab === 'skills' && !g.skill.length) BC.tab = 'combat';
  const sbOpen = !$('#spellbook').hidden;
  tabs.innerHTML = '<button class="ttab' + (BC.tab === 'combat' && !sbOpen ? ' on' : '') + '" data-tab="combat" role="tab">' + ico('swords2') + 'Combat <span class="n">' + (g.strike.length + g.move.length + g.class.length + g.tactic.length) + '</span></button>' +
    (g.skill.length ? '<button class="ttab' + (BC.tab === 'skills' && !sbOpen ? ' on' : '') + '" data-tab="skills" role="tab">' + ico('d20') + 'Skills <span class="n">' + g.skill.length + '</span></button>' : '') +
    (g.spell.length ? '<button class="ttab spells' + (sbOpen ? ' on' : '') + '" data-akey="spells" role="tab" title="Spellbook (B)">' + ico('spellbook') + 'Spells <span class="n">' + g.spell.filter(s => !s.why).length + '</span></button>' : '');
  const groups = BC.tab === 'skills' ? [['Skills', g.skill]] : [['Strikes', g.strike], ['Move', g.move], ['Class', g.class], ['Tactics', g.tactic]];
  const btn = a => {
    const key = keyOf(a); const idx = BC.hot.length; BC.hot.push(key);
    const sel = BC.mode && BC.mode.key === key;
    let cnt = '';
    if (a.sref) { const s = a.sref; cnt = App.sgn(s.atk.base + s.atk.item + B.mapPen(u, s)); if (s.qty != null && s.thrown) cnt += ' ×' + s.qty; if (s.reload && !s.loaded) cnt = 'empty'; }
    if (a.id === 'potion' && u.potions) cnt = '×' + u.potions.n;
    const cost = GLYPH(a.costN);
    return '<button class="abtn ' + btnCls(a) + (a.why ? ' off' : '') + (sel ? ' sel' : '') + '" data-akey="' + esc(key) + '" aria-label="' + esc(a.name + (a.why ? ' (' + a.why + ')' : '')) + '" title="' + esc(a.name + (a.why ? ' — ' + a.why : '')) + '"><span class="cost' + (a.costN === 0 ? ' free' : '') + '">' + cost + '</span><span class="hk">' + (idx < 10 ? (idx + 1) % 10 : '') + '</span><span class="ai">' + ico(Icons.forAction(a)) + '</span><span class="nm">' + esc(SHORT[a.id] || a.name) + '</span>' + (cnt ? '<span class="cnt">' + esc(cnt) + '</span>' : '') + '</button>';
  };
  bar.innerHTML = groups.filter(([, l]) => l.length).map(([n, l]) => '<div class="agroup"><span class="gl">' + n + '</span>' + l.map(btn).join('') + '</div>').join('');
  BC.renderEnd(); BC.showInfo();
};
BC.renderEnd = () => {
  const el = $('#endWrap'); if (!BC.isPlayerTurn()) { el.innerHTML = ''; return; }
  const left = BC.B.actsTotal(BC.cur); const armed = BC.endArm && performance.now() - BC.endArm < 2600;
  el.innerHTML = '<button class="endbtn' + (armed ? ' warn' : '') + '" data-akey="end" title="End your turn (Space)">' + ico('end') + '<b>' + (armed ? 'Confirm' : 'End turn') + '</b><small>' + (left ? left + ' action' + (left > 1 ? 's' : '') + ' left' : 'Space') + '</small></button>';
  if (armed) { clearTimeout(BC._ea); BC._ea = setTimeout(() => { BC.endArm = 0; BC.renderEnd(); }, 2700); }
};
BC.showInfo = key => {
  const el = $('#abilityInfo'); if (!BC.isPlayerTurn()) { el.innerHTML = ''; return; }
  let a = key ? BC.keyMap[key] : null;
  if (!a && BC.mode && BC.mode.act) a = BC.mode.act;
  if (!a) { el.innerHTML = '<span class="d">Click a highlighted square to Stride: <span style="color:#6cc4f0">blue</span> ◆ · <span style="color:var(--amber)">gold</span> ◆◆ · <span style="color:#ff9a5c">orange</span> ◆◆◆. Choose an ability below or press 1–0.</span>'; return; }
  const tr = (a.traits || (a.cast && a.cast.spell && a.cast.spell.traits) || []).filter(t => t !== 'concentrate' && t !== 'manipulate');
  el.innerHTML = '<span class="dia-txt">' + GLYPH(a.costN) + '</span><b>' + esc(a.name) + '</b>' + (a.why ? '<span class="why">' + esc(a.why) + '</span>' : '') + (tr.length ? '<span class="trs">' + esc(tr.slice(0, 4).join(' · ')) + '</span>' : '') + '<span class="d">' + esc(a.desc || '') + '</span>';
};
BC.setTab = t => { BC.tab = t; if (BC.cur) BC.tabs[BC.cur.id] = t; $('#spellbook').hidden = true; BC.renderActions(); };

/* ================= SPELLBOOK ================= */
const spellMeta = (a, u) => {
  const sp = a.cast.spell; const B = BC.B; const bits = [];
  const shape = B.spellShape(sp, Array.isArray(a.costN) ? a.costN[a.costN.length > 1 ? 1 : 0] : a.costN);
  if (shape) bits.push(shape.r + '-ft ' + shape.t); else if (sp.tgt === 'self') bits.push('self'); else if (sp.tgt === 'heal') bits.push('touch / 30 ft'); else if (sp.range) bits.push(sp.range + ' ft');
  const n = B.spellTargetsN(sp, a.cast.rank); if (n > 1) bits.push(n + ' targets');
  if (sp.atk) bits.push('spell attack'); else if (sp.save) bits.push((sp.basic ? 'basic ' : '') + SAVEN[sp.save]);
  if (a.cast.src === 'slot' || a.cast.src === 'font' || a.cast.src === 'innate') bits.push(a.left + ' left');
  if (a.cast.src === 'focus') bits.push('1 FP');
  return bits.join(' · ');
};
BC.renderSpellbook = () => {
  const el = $('#spellbook'); const u = BC.cur; const sp = BC.spells || []; const S = u.spells || {};
  const groups = {}; const order = [];
  const add = (k, label, pips, a) => { if (!groups[k]) { groups[k] = { label, pips, list: [] }; order.push(k); } if (a) groups[k].list.push(a); };
  const pipHTML = (cur, max, fp) => '<span class="slots' + (fp ? ' fp' : '') + '" title="' + cur + ' of ' + max + ' remaining">' + Array.from({ length: max }, (_, i) => '<i class="' + (i < cur ? 'on' : '') + '"></i>').join('') + '</span>';
  // pips from the unit's spell data
  const rankPips = r => {
    if (S.slots && S.slots[r]) return pipHTML(S.slots[r].max - S.slots[r].used, S.slots[r].max);
    if (S.prepared) { const es = S.prepared.filter(e => e.rank === r); if (es.length) return pipHTML(es.filter(e => !e.used).length, es.length); }
    return '';
  };
  sp.forEach(a => {
    const c = a.cast;
    if (c.src === 'cantrip') add('a', 'Cantrips · rank ' + c.rank, '', a);
    else if (c.src === 'comp') add('b', 'Compositions', '', a);
    else if (c.src === 'focus') add('c', 'Focus spells', u.focus ? pipHTML(u.focus.cur, u.focus.max, true) : '', a);
    else if (c.src === 'font') add('d', 'Divine font', S.font ? pipHTML(S.font.max - S.font.used, S.font.max) : '', a);
    else if (c.src === 'innate') add('e' + c.rank, 'Innate · rank ' + c.rank, '', a);
    else add('r' + String(c.rank).padStart(2, '0'), PF.ordinal(c.rank) + ' rank', rankPips(c.rank), a);
  });
  // expended prepared spells, shown struck through
  (S.prepared || []).forEach(e => { if (e.used) add('r' + String(e.rank).padStart(2, '0'), PF.ordinal(e.rank) + ' rank', rankPips(e.rank), { spent: true, name: (D.spells[e.id] || {}).name || e.id, spell: D.spells[e.id], rank: e.rank }); });
  if (u.focus && !groups.c && u.focus.spells.length) add('c', 'Focus spells', pipHTML(u.focus.cur, u.focus.max, true));
  order.sort();
  const card = a => {
    if (a.spent) return '<div class="scard spent" title="Expended">' + '<span class="si">' + ico(Icons.forSpell(a.spell)) + '</span><div><b>' + esc(a.name) + '</b><small>expended</small></div><span></span></div>';
    const key = 'cast:' + a.castKey; BC.keyMap[key] = a; const col = Icons.spellColor(a.cast.spell);
    const sel = BC.mode && BC.mode.key === key;
    return '<button class="scard' + (a.why ? ' off' : '') + (sel ? ' sel' : '') + '" data-akey="' + esc(key) + '" title="' + esc((a.why ? a.why + ' — ' : '') + (a.desc || '')) + '"' + (col ? ' style="--ac:' + col + '"' : '') + '><span class="si">' + ico(Icons.forSpell(a.cast.spell)) + '</span><div><b>' + esc(a.name) + '</b><small>' + esc(a.why || spellMeta(a, u)) + '</small></div><span class="cost">' + GLYPH(a.costN) + '</span></button>';
  };
  el.innerHTML = '<div class="sbk-head"><b>' + ico('spellbook') + ' Spellbook</b><span class="num">DC ' + BC.B.spellDC(u) + ' · attack ' + App.sgn(BC.B.stat(u, 'spellatk')) + '</span>' + (S.trad ? '<span class="pill">' + esc(S.trad) + '</span>' : '') + '<span class="grow"></span><button class="x" id="sbClose" aria-label="Close spellbook">×</button></div>' +
    '<div class="sbk-body">' + order.map(k => { const gr = groups[k]; return '<div class="sbrank"><div class="rk"><span>' + esc(gr.label) + '</span>' + gr.pips + '</div>' + gr.list.map(card).join('') + '</div>'; }).join('') + '<div id="costPick"></div></div>';
  el.hidden = false;
  $('#sbClose').onclick = () => { el.hidden = true; BC.renderActions(); };
};
BC.toggleSpellbook = () => { if (!BC.isPlayerTurn()) return; const sb = $('#spellbook'); if (sb.hidden) { if (!BC.spells || !BC.spells.length) return; BC.renderSpellbook(); } else sb.hidden = true; BC.renderActions(); };

/* ================= CHOOSING ACTIONS ================= */
BC.choose = key => {
  if (!BC.isPlayerTurn()) return;
  if (key === 'end') return BC.endTurn();
  if (key === 'spells') return BC.toggleSpellbook();
  const a = BC.keyMap[key]; if (!a) return;
  if (a.why) { BC.flash(a.why); return; }
  if (BC.mode && BC.mode.key === key) { BC.cancel(); return; }
  if (a.id === 'cast') return BC.chooseSpell(a, key);
  const tgt = a.tgt;
  const p = {}; if (a.strike) p.strike = a.strike; if (a.stance) p.stance = a.stance; if (a.abil) p.abil = a.abil;
  if (tgt === 'none') return BC.act(a.id, p);
  BC.mode = { type: tgt, act: a, key, p };
  if (tgt === 'move') BC.mode.maxFt = a.half ? Math.floor(BC.B.speedOf(BC.cur) / 10) * 5 : BC.B.speedOf(BC.cur);
  if (tgt === 'move+unit') BC.mode.maxFt = BC.B.speedOf(BC.cur) * (a.moveMult || 1);
  if (tgt === 'area') BC.mode.shape = a.shape || { t: 'cone', r: 30 };
  BC.tgtSel = null; BC.tgtHover = null;
  BC.renderActions(); BC.drawMode();
};
BC.chooseSpell = (a, key) => {
  const sp = a.cast.spell; const costs = a.costs.filter(n => BC.B.canSpend(BC.cur, n, 'cast'));
  const go = n => {
    $('#spellbook').hidden = true;
    const shape = BC.B.spellShape(sp, n, BC.cur.turn.meta);
    const p = { castKey: a.castKey, actions: n };
    if (sp.tgt === 'self' && !shape) return BC.act('cast', p);
    if (shape && shape.t === 'emanation') return BC.act('cast', p);
    let type = 'spell';
    if (shape) type = 'area';
    else if (sp.tgt === 'tile') type = 'tile';
    else if (sp.tgt === 'move2') type = 'move2';
    BC.mode = { type, act: a, key, p, spell: sp, cast: a.cast, actions: n, shape, picked: [], need: BC.B.spellTargetsN(sp, a.cast.rank) };
    if (type === 'move2') BC.mode.maxFt = BC.B.speedOf(BC.cur) * 2;
    BC.tgtSel = null; BC.tgtHover = null;
    BC.renderActions(); BC.drawMode();
  };
  if (costs.length === 1) return go(costs[0]);
  if (!costs.length) { BC.flash('Not enough actions'); return; }
  const lab = n => sp.tgt === 'heal' ? ['', 'Touch', '30 ft, +8/rank', '30-ft burst'][n] : sp.id === 'forceBarrage' ? n + ' shard' + (n > 1 ? 's' : '') + ' per volley' : n + ' actions';
  if ($('#spellbook').hidden) BC.renderSpellbook();
  $('#costPick').innerHTML = '<div class="costpick"><b>' + esc(sp.name) + '</b>' + costs.map(n => '<button class="btn small" data-cost="' + n + '"><span class="dia-txt">' + GLYPH(n) + '</span> ' + esc(lab(n)) + '</button>').join('') + '</div>';
  $$('[data-cost]').forEach(b => b.onclick = () => go(+b.dataset.cost));
};
BC.cancel = () => { BC.mode = { type: 'move' }; BC.tgtSel = null; BC.tgtHover = null; $('#tip').hidden = true; BC.hideShot(); App.R.setTargeted([]); BC.ring('sel', null, '#f5b942'); BC.renderActions(); BC.drawMode(); };

/* ================= MODE DRAWING ================= */
BC.drawMode = () => {
  const R = App.R, B = BC.B, u = BC.cur, m = BC.mode;
  R.clearLayers(['move1', 'move2', 'move3', 'valid', 'area', 'hoverArea']); R.showPath(null); R.setTargeted([]);
  BC._ev = null;
  if (!m || !u || !BC.isPlayerTurn()) { BC.renderTargets(); return; }
  if (m.type === 'move' && !m.act) {
    if (!B.immobile(u)) {
      const sp = B.speedOf(u); const c1 = [], c2 = [], c3 = [];
      BC.P.best.forEach((c, k) => { const [x, y] = k.split(',').map(Number); if ((x === u.x && y === u.y) || !B.canEnd(u, x, y)) return; const n = Math.ceil(c / sp); (n <= 1 ? c1 : n === 2 ? c2 : c3).push([x, y]); });
      R.layer('move1', c1, '#4fb8ee', 0.3); R.layer('move2', c2, '#f5b942', 0.22); R.layer('move3', c3, '#ff8a4a', 0.18);
    }
  } else if (m.type === 'move' || m.type === 'move2' || m.type === 'move+unit') {
    const P = B.paths(u, m.maxFt); m.P = P; const cells = [];
    P.best.forEach((c, k) => { const [x, y] = k.split(',').map(Number); if (B.canEnd(u, x, y)) cells.push([x, y]); });
    R.layer('move1', cells, m.type === 'move+unit' ? '#f5b942' : '#4fb8ee', 0.24);
  } else if (m.type === 'step' || m.type === 'step+unit') {
    const range = u.fx.some(f => f.key === 'stance' && f.stance === 'tiger') && m.type === 'step' ? 10 : 5;
    const P = B.paths(u, range, { noDifficult: true }); m.P = P; const cells = [];
    P.best.forEach((c, k) => { const [x, y] = k.split(',').map(Number); if ((x !== u.x || y !== u.y) && B.canEnd(u, x, y)) cells.push([x, y]); });
    R.layer('move1', cells, '#4fb8ee', 0.3);
  } else if (m.type === 'unit' || m.type === 'spell') {
    const ids = B.units.filter(t => B.alive(t) && !BC.targetWhy(t)).map(t => t.id); R.setTargeted(ids.concat(m.picked || []));
    const cells = []; B.units.forEach(t => { if (ids.includes(t.id)) B.cellsOf(t).forEach(c => cells.push(c)); }); R.layer('valid', cells, '#ff5d55', 0.2);
  } else if (m.type === 'tile') {
    const cells = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) if (B.distPt(u, x, y) <= (m.spell.range || 0) && B.canEnd(u, x, y)) cells.push([x, y]); R.layer('move1', cells, '#ab8eff', 0.22);
  }
  if (m.type === 'move+unit' || m.type === 'step+unit') R.setTargeted(B.foesOf(u).filter(f => f.hp > 0).map(t => t.id));
  if (isTargetMode(m)) BC.autoTarget();
  BC.renderTargets(); BC.renderShot();
};
// why a unit is not a valid target in the current mode ('' if valid)
BC.targetWhy = t => {
  const B = BC.B, u = BC.cur, m = BC.mode; if (!m) return 'No action';
  if (m.type === 'spell') {
    if (m.picked.includes(t.id)) return 'Already chosen';
    return B.validSpellTarget(u, m.cast, t, m.actions, u.turn.meta);
  }
  const a = m.act; if (!a) return 'No action';
  if (m.type === 'move+unit' || m.type === 'step+unit') return t.team === u.team ? 'Target a foe' : '';
  if (a.id === 'strike') { const s = u.strikes.find(x => x.id === a.strike); if (t.team === u.team) return 'Target a foe'; const R = B.prepStrike(u, s, t); return R.ok ? '' : R.why; }
  if (B.A[a.id] && B.A[a.id].valid) return B.A[a.id].valid(u, t) || '';
  if (a.id === 'medicine') return B.A.medicine.valid(u, t) || '';
  return t.team === u.team ? 'Target a foe' : '';
};

/* ================= TARGET EVALUATION ================= */
const RANGED_ACTS = ['huntedShot', 'doubleShot', 'tripleShot', 'huntersAim'];
const CHECK_ACTS = { trip: ['athletics', 'ref'], shove: ['athletics', 'fort'], grapple: ['athletics', 'fort'], knockback: ['athletics', 'fort'], demoralize: ['intimidation', 'will'], feint: ['deception', 'per'], bonMot: ['diplomacy', 'will'] };
const NON_STRIKE = ['huntPrey', 'medicine'];
BC.strikeFor = (a, t, u) => {
  const B = BC.B;
  if (a.id === 'strike') return { s: u.strikes.find(x => x.id === a.strike), o: {} };
  if ((a.group === 'class' || a.group === 'monster') && !CHECK_ACTS[a.id] && !NON_STRIKE.includes(a.id)) {
    const s = B.bestStrike(u, t, x => !RANGED_ACTS.includes(a.id) ? (x.kind === 'melee' || a.id === 'skirmishStrike') && (a.id !== 'flyingKick' || x.traits.includes('unarmed')) : x.kind === 'ranged');
    if (!s) return null;
    const o = a.id === 'huntersAim' ? { atkMods: [{ t: 'circ', v: 2, s: "hunter's aim" }], ignoreConceal: true } : a.id === 'viciousSwing' ? { extraDice: u.level >= 10 ? 2 : 1 } : a.id === 'lunge' ? { extraReach: 5 } : a.id === 'doubleShot' ? { atkMods: [{ t: 'unt', v: -2, s: 'double shot' }] } : a.id === 'tripleShot' ? { atkMods: [{ t: 'unt', v: -4, s: 'triple shot' }] } : {};
    return { s, o };
  }
  return null;
};
const withPos = (u, dest, fn) => { if (!dest) return fn(); const ox = u.x, oy = u.y; u.x = dest[0]; u.y = dest[1]; try { return fn(); } finally { u.x = ox; u.y = oy; } };
const spellCtx = sp => ({ mental: (sp.traits || []).includes('mental'), fear: (sp.traits || []).includes('fear') });
// evaluate target t for the current mode: {why, pct, lbl, kind, ...details}
BC.evalTarget = t => {
  const B = BC.B, u = BC.cur, m = BC.mode; if (!m || !t) return { why: 'No action' };
  BC._ev = BC._ev || {}; if (BC._ev[t.id]) return BC._ev[t.id];
  let r = { why: BC.targetWhy(t) };
  const a = m.act;
  if (!r.why) {
    if (m.type === 'move+unit' || m.type === 'step+unit') {
      const plan = BC.planApproach(t);
      if (!plan) r.why = 'Can’t reach a striking position';
      else {
        const s = B.bestStrike(u, t, x => m.type === 'step+unit' || x.kind === 'melee' || (a.id === 'flyingKick' && x.traits.includes('unarmed')));
        r.plan = plan;
        if (s) { const pv = withPos(u, plan.dest, () => B.strikePreview(u, s, t)); if (pv.ok) Object.assign(r, { kind: 'strike', s, pv, pct: pv.hitPct, lbl: 'hit', rs: plan.path ? BC.rsAlong(u, plan.path) : [] }); }
      }
    } else if (m.type === 'spell') {
      const sp = m.spell;
      if (sp.atk) {
        const fake = { name: sp.name, kind: sp.melee ? 'melee' : 'ranged', traits: ['attack'], atk: { base: 0, item: 0 }, atkAttr: 'spell', range: sp.range, reach: 5, dmg: [{ n: 0, d: 0, m: 0, type: 'untyped' }] };
        const R = B.prepStrike(u, fake, t, { spellAtk: true });
        if (R.ok) { const p = PF.pdeg(R.atkTotal, R.acTotal, R.fortune); const fc = R.flat ? (21 - R.flat) / 20 : 1; const pp = p.map((x, i) => i >= 2 ? x * fc : x); pp[1] += (1 - fc) * (p[2] + p[3]); Object.assign(r, { kind: 'spellatk', R, p: pp, pct: pct(pp[2] + pp[3]), lbl: 'hit' }); }
      } else if (sp.save && t.team !== u.team) {
        const dc = B.spellDC(u); const mod = B.stat(t, sp.save, spellCtx(sp)); let p = PF.pdeg(mod, dc);
        const incap = (sp.incap || (sp.traits || []).includes('incapacitation')) && t.level > m.cast.rank * 2;
        if (incap) p = [0, p[0], p[1], p[2] + p[3]];
        Object.assign(r, { kind: 'save', dc, mod, p, incap, pct: pct(p[0] + p[1]), lbl: 'fail' });
      } else Object.assign(r, { kind: 'other' });
    } else if (CHECK_ACTS[a.id]) {
      const [sk, def] = CHECK_ACTS[a.id];
      const map = (a.traits || []).includes('attack') ? B.mapPen(u, null, t) : 0;
      const mod = B.stat(u, 'skill:' + sk) + map; const dc = B.dcOf(t, def); const p = PF.pdeg(mod, dc);
      Object.assign(r, { kind: 'check', sk, def, mod, map, dc, p, pct: pct(p[2] + p[3]), lbl: 'succ' });
    } else {
      const sf = BC.strikeFor(a, t, u);
      if (sf && sf.s) { const pv = B.strikePreview(u, sf.s, t, sf.o); if (pv.ok) Object.assign(r, { kind: 'strike', s: sf.s, o: sf.o, pv, pct: pv.hitPct, lbl: 'hit' }); else r.why = pv.why; }
      else Object.assign(r, { kind: 'other' });
    }
  }
  BC._ev[t.id] = r; return r;
};
BC.candidates = () => {
  const B = BC.B, u = BC.cur, m = BC.mode;
  if (!B || !u) return [];
  const alive = B.units.filter(t => B.alive(t) && t.hp > 0 || (B.alive(t) && m && m.type === 'spell'));
  if (isTargetMode(m)) {
    const list = alive.filter(t => t !== u || !BC.targetWhy(t)).filter(t => !BC.targetWhy(t) || t.team !== u.team || (m.type === 'spell' && m.picked.includes(t.id)));
    const val = t => BC.targetWhy(t) && !(m.picked || []).includes(t.id) ? 1 : 0;
    return list.sort((a, b) => val(a) - val(b) || B.dist(u, a) - B.dist(u, b));
  }
  return B.foesOf(u).filter(t => t.hp > 0 || B.alive(t)).sort((a, b) => B.dist(u, a) - B.dist(u, b));
};
BC.autoTarget = () => {
  const m = BC.mode; const cands = BC.candidates().filter(t => !BC.evalTarget(t).why);
  if (BC.tgtSel && cands.some(t => t.id === BC.tgtSel)) return;
  let best = null, bv = -1; cands.forEach(t => { const e = BC.evalTarget(t); const v = (e.pct != null ? e.pct : 50) - (m && m.picked && m.picked.includes(t.id) ? 200 : 0); if (v > bv) { bv = v; best = t; } });
  if (!best) best = BC.candidates()[0] || null; // nothing valid: show why for the nearest
  BC.tgtSel = best ? best.id : null;
};
BC.tgtShown = () => { const B = BC.B; if (!B) return null; const id = BC.tgtHover || BC.tgtSel; return id ? B.get(id) : null; };
BC.renderTargets = () => {
  const host = $('#targetBar'); const B = BC.B, u = BC.cur, m = BC.mode;
  if (!B || !BC.isPlayerTurn() || !u) { host.innerHTML = ''; return; }
  const tm = isTargetMode(m); const area = m && m.type === 'area';
  const list = BC.candidates().slice(0, 12);
  host.innerHTML = list.map(t => {
    const s = BC.disp[t.id] || B.snap(t); const hp = Math.max(0, s.hp / Math.max(1, s.maxHP));
    let pctTxt = '', cls = '', why = '';
    if (tm) { const e = BC.evalTarget(t); why = e.why; if (e.pct != null) { pctTxt = e.pct + '<small>%' + e.lbl + '</small>'; cls = e.lbl === 'fail' || e.lbl === 'succ' || e.lbl === 'hit' ? (e.pct >= 65 ? ' hi' : e.pct >= 40 ? ' mid' : ' lo') : ''; } else if (!why) pctTxt = ico('check', 16); }
    else if (area && m.spell && m.spell.save || area && !m.spell) { const sp = m.spell; const dc = sp ? B.spellDC(u) : B.classDC(u); const kind = sp ? sp.save : 'ref'; if (kind) { const p = PF.pdeg(B.stat(t, kind), dc); const f = pct(p[0] + p[1]); pctTxt = f + '<small>%fail</small>'; cls = f >= 65 ? ' hi' : f >= 40 ? ' mid' : ' lo'; } }
    else pctTxt = '<span class="num" style="font-size:13px">' + s.hp + '<small>hp</small></span>';
    const picked = m && m.picked && m.picked.includes(t.id);
    return '<button class="tchip ' + t.team + (why && !picked ? ' off' : '') + (BC.tgtSel === t.id && tm ? ' sel' : '') + (picked ? ' picked' : '') + cls + '" role="listitem" data-tgt="' + t.id + '" title="' + esc(t.name + (why ? ' — ' + why : '')) + '">' + App.emblem(t, { foe: t.team !== 'pc' }) + '<span class="pct">' + pctTxt + '</span><span class="tn">' + esc(t.name) + '</span><span class="thp"><i style="width:' + (hp * 100) + '%"></i></span></button>';
  }).join('');
  BC.markPlates();
  const t = BC.tgtShown(); BC.ring('sel', tm && t ? t.id : null, '#f5b942');
  if (tm && t) { const e = BC.evalTarget(t); App.R.showPath(e.plan && e.plan.path && e.plan.path.length > 1 ? e.plan.path : null, '#f5b942'); }
};
BC.cycleTarget = dir => {
  const m = BC.mode; if (!isTargetMode(m)) return;
  const list = BC.candidates().filter(t => !BC.evalTarget(t).why); if (!list.length) return;
  let i = list.findIndex(t => t.id === BC.tgtSel); i = (i + dir + list.length) % list.length;
  BC.selectTarget(list[i].id, true);
};
BC.selectTarget = (id, focus) => {
  BC.tgtSel = id; BC.tgtHover = null;
  const t = BC.B.get(id); const u = BC.cur;
  if (focus && t && u) App.R.focus((u.x + u.sq / 2 + t.x + t.sq / 2) / 2, (u.y + u.sq / 2 + t.y + t.sq / 2) / 2);
  BC.renderTargets(); BC.renderShot();
};
BC.confirmTarget = t => {
  const B = BC.B, u = BC.cur, m = BC.mode; if (!m || !t) return;
  const e = BC.evalTarget(t);
  if (m.type === 'unit') { if (e.why) { BC.flash(e.why); return; } BC.act(m.act.id, Object.assign({}, m.p, { target: t.id })); return; }
  if (m.type === 'spell') {
    if (e.why) { BC.flash(e.why); return; }
    m.picked.push(t.id); BC._ev = null;
    if (m.picked.length >= m.need || !B.units.some(x => B.alive(x) && !BC.targetWhy(x))) BC.act('cast', Object.assign({}, m.p, { targets: m.picked }));
    else { BC.tgtSel = null; BC.drawMode(); }
    return;
  }
  if (m.type === 'move+unit' || m.type === 'step+unit') {
    if (t.team === u.team) return; if (!e.plan) { BC.flash(e.why || 'Can’t reach a striking position'); return; }
    BC.act(m.act.id, Object.assign({}, m.p, { dest: e.plan.dest, target: t.id }));
  }
};
BC.castPicked = () => { const m = BC.mode; if (m && m.type === 'spell' && m.picked.length) BC.act('cast', Object.assign({}, m.p, { targets: m.picked })); };

/* ================= SHOT PREVIEW PANEL ================= */
BC.hideShot = () => { $('#shotPanel').hidden = true; };
const modRows = (list, base) => {
  const all = list.filter(x => x && x.v); const used = new Set(PF.sumMods(all).used);
  return all.map(x => { const v = x.v; const nm = x.s === 'base' ? (base || 'base') : x.s || (x.t === 'item' ? 'item' : x.t); return '<div class="mrow' + (used.has(x) ? '' : ' off') + '" title="' + esc((x.t === 'circ' ? 'circumstance' : x.t === 'unt' ? 'untyped' : x.t) + (used.has(x) ? '' : ' — does not stack')) + '"><span>' + esc(nm) + '</span><span class="v ' + (x.s === 'base' ? 'z' : v > 0 ? 'p' : 'n') + '">' + (x.s === 'base' ? v : App.sgn(v)) + '</span></div>'; }).join('');
};
const distr = p => '<div class="distr" title="Critical failure ' + pct(p[0]) + '% · failure ' + pct(p[1]) + '% · success ' + pct(p[2]) + '% · critical success ' + pct(p[3]) + '%">' + p.map((x, i) => '<i class="d' + i + '" style="width:' + (x * 100) + '%"></i>').join('') + '</div><div class="dlegend"><span>CF ' + pct(p[0]) + '</span><span>F ' + pct(p[1]) + '</span><span>S ' + pct(p[2]) + '</span><span>CS ' + pct(p[3]) + '</span></div>';
const need = (mod, dc) => { const n = dc - mod; return n <= 1 ? 'any roll (nat 1 fails)' : n > 20 ? 'only a natural 20' : n + '+ on the d20'; };
const dmgTxt = parts => parts.map(d => U.dstr(d) + ' ' + (d.type || '')).join(' + ');
BC.renderShot = () => {
  const el = $('#shotPanel'); const B = BC.B, u = BC.cur, m = BC.mode;
  if (!B || !u || !m || !BC.isPlayerTurn()) { el.hidden = true; return; }
  if (m.type === 'area') { if (m.areaP) BC.renderAreaShot(); else el.hidden = true; return; }
  if (!isTargetMode(m)) { el.hidden = true; return; }
  const t = BC.tgtShown(); if (!t) { el.hidden = true; return; }
  const e = BC.evalTarget(t); const a = m.act;
  const icon = Icons.forAction(a); const cost = GLYPH(m.actions || a.costN);
  const tname = '<span class="' + t.team + '">' + esc(t.name) + '</span>';
  let h = '<div class="sh-head"><span class="sh-ico">' + ico(e.kind === 'strike' && a.id !== 'strike' ? icon : e.s ? Icons.forStrike(e.s) : icon) + '</span><div class="sh-t"><b>' + esc(a.name) + '</b><small>→ ' + tname + ' · ' + (t.team === 'pc' ? 'Level ' : 'Creature ') + t.level + '</small></div><span class="sh-cost">' + cost + '</span></div>';
  const notes = [];
  if (e.why) {
    h += '<div class="sect"><div class="warn">' + ico('warn') + esc(e.why) + '</div></div>';
  } else if (e.kind === 'strike' || e.kind === 'spellatk') {
    const pv = e.kind === 'strike' ? e.pv : e.R; const p = e.kind === 'strike' ? pv.p : e.p;
    h += '<div class="big"><div><small>Hit</small><b>' + pct(p[2] + p[3]) + '<sup>%</sup></b></div><div class="crit"><small>Critical</small><b>' + pct(p[3]) + '<sup>%</sup></b></div></div>' + distr(p);
    h += '<div class="vs"><b>' + App.sgn(pv.atkTotal) + '</b> vs AC <b>' + pv.acTotal + '</b> · needs ' + need(pv.atkTotal, pv.acTotal) + (pv.fortune ? ' · roll twice, keep higher' : '') + '</div>';
    h += '<div class="sect mods2"><div><h5>Attack <span>' + App.sgn(pv.atkTotal) + '</span></h5>' + modRows(pv.atk, e.kind === 'spellatk' ? 'spell attack' : 'base') + '</div><div><h5>Defense <span>AC ' + pv.acTotal + '</span></h5>' + modRows(pv.ac, 'base AC') + '</div></div>';
    if (e.kind === 'strike') {
      const spec = pv.spec;
      h += '<div class="sect"><h5>Damage <span>' + Math.round(pv.avgHit) + ' / ' + Math.round(pv.avgCrit) + ' avg</span></h5><div class="dmg">' + esc(dmgTxt(spec.parts)) + (spec.prec.length ? ' <span class="avg">+ ' + esc(spec.prec.map(x => U.dstr(x) + ' ' + x.s).join(', ')) + '</span>' : '') + '</div><div class="dmg avg">hit ≈ ' + Math.round(pv.avgHit) + ' · critical ≈ ' + Math.round(pv.avgCrit) + (spec.deadly ? ' · deadly d' + spec.deadly : '') + (spec.fatal ? ' · fatal d' + spec.fatal : '') + '</div></div>';
      const res = B.resistOf(t, spec.type), wk = B.weakOf(t, spec.type);
      if (B.immuneTo(t, spec.type)) notes.push(['warn', 'Immune to ' + spec.type]);
      if (res) notes.push(['warn', 'Resists ' + spec.type + ' ' + res]);
      if (wk) notes.push(['ok', 'Weak to ' + spec.type + ' ' + wk]);
      const s = e.s;
      if (s && s.kind === 'ranged') { const rs = B.units.filter(r => r.team !== u.team && B.alive(r) && r.flags.reactiveStrike && B.canReact(r, 'reactiveStrike') && B.inReach(r, u, B.reachOf(r))); if (rs.length) notes.push(['warn', 'Provokes Reactive Strike from ' + rs.map(r => r.name).join(', ')]); }
      if (s && !(e.o && e.o.noMAP)) { const nx = withPos(u, null, () => { const n0 = u.turn.attacks; u.turn.attacks = n0 + 1; const v = B.mapPen(u, s, t); u.turn.attacks = n0; return v; }); if (nx) notes.push(['dim', 'Next attack this turn: ' + App.sgn(nx) + ' multiple attack penalty']); }
    } else if (m.spell && m.spell.dmg) {
      h += '<div class="sect"><h5>Damage</h5><div class="dmg">' + esc(dmgTxt(m.spell.dmg(m.cast.rank, { adjacent: B.inReach(u, t, 5) }))) + '</div></div>';
    }
    if (pv.og) notes.push(['ok', 'Target is off-guard: ' + pv.og]);
    if (pv.cover) notes.push(['warn', 'Target has ' + B.COVERN[pv.cover] + ' (+' + B.coverMod(pv.cover) + ' AC)']);
    if (pv.flat) notes.push(['warn', 'DC ' + pv.flat + ' flat check (' + pv.flatWhy + ') — ' + pct((21 - pv.flat) / 20) + '% to get through']);
    if (e.rs && e.rs.length) notes.push(['warn', 'Moving there provokes Reactive Strike from ' + e.rs.join(', ')]);
    if (e.plan && e.plan.path && e.plan.path.length > 1) notes.push(['dim', 'Moves ' + (e.plan.path.length - 1) * 5 + ' ft to strike']);
  } else if (e.kind === 'check') {
    const p = e.p;
    h += '<div class="big"><div><small>Success</small><b>' + pct(p[2] + p[3]) + '<sup>%</sup></b></div><div class="crit"><small>Critical</small><b>' + pct(p[3]) + '<sup>%</sup></b></div></div>' + distr(p);
    h += '<div class="vs">' + U.cap(e.sk) + ' <b>' + App.sgn(e.mod) + '</b> vs ' + SAVEN[e.def] + ' DC <b>' + e.dc + '</b> · needs ' + need(e.mod, e.dc) + '</div>';
    const sparts = B.statParts(u, 'skill:' + e.sk).concat(e.map ? [{ t: 'unt', v: e.map, s: 'multiple attack' }] : []);
    const dparts = B.statParts(t, e.def);
    h += '<div class="sect mods2"><div><h5>' + esc(U.cap(e.sk)) + ' <span>' + App.sgn(e.mod) + '</span></h5>' + modRows(sparts, 'base') + '</div><div><h5>' + SAVEN[e.def] + ' DC <span>' + e.dc + '</span></h5><div class="mrow"><span>10 + modifier</span><span class="v z">10</span></div>' + modRows(dparts, 'base') + '</div></div>';
    if (pct(p[0])) notes.push([a.id === 'trip' || a.id === 'grapple' || a.id === 'shove' ? 'warn' : 'dim', 'Critical failure ' + pct(p[0]) + '%' + (a.id === 'trip' ? ' — you fall prone' : '')]);
  } else if (e.kind === 'save') {
    const p = e.p; const sp = m.spell;
    h += '<div class="big"><div class="fail"><small>Fails</small><b>' + pct(p[0] + p[1]) + '<sup>%</sup></b></div><div class="crit"><small>Crit fail</small><b>' + pct(p[0]) + '<sup>%</sup></b></div></div>' + distr(p);
    h += '<div class="vs">' + SAVEN[sp.save] + ' <b>' + App.sgn(e.mod) + '</b> vs your DC <b>' + e.dc + '</b>' + (sp.basic ? ' · basic save' : '') + '</div>';
    h += '<div class="sect"><h5>Target ' + SAVEN[sp.save] + ' <span>' + App.sgn(e.mod) + '</span></h5>' + modRows(B.statParts(t, sp.save, spellCtx(sp)), 'base') + '</div>';
    if (sp.dmg) h += '<div class="sect"><h5>Damage</h5><div class="dmg">' + esc(dmgTxt(sp.dmg(m.cast.rank, {}))) + (sp.basic ? ' <span class="avg">½ on success, ×2 on critical failure</span>' : '') + '</div></div>';
    if (e.incap) notes.push(['warn', 'Incapacitation: a creature above level ' + m.cast.rank * 2 + ' treats its save one degree better (already applied).']);
  } else {
    h += '<div class="sect"><div class="dmg" style="font-family:var(--f-ui)">' + esc(a.desc || '') + '</div></div>';
  }
  if (m.type === 'spell' && m.need > 1) notes.push(['dim', 'Targets chosen ' + m.picked.length + ' of ' + m.need + (m.picked.length ? ': ' + m.picked.map(id => B.get(id).name).join(', ') : '')]);
  if (notes.length) h += '<div class="sect notes">' + notes.map(([k, txt]) => k === 'warn' ? '<div class="warn">' + ico('warn') + esc(txt) + '</div>' : k === 'ok' ? '<div class="ok">' + ico('check') + esc(txt) + '</div>' : '<div class="dim">' + esc(txt) + '</div>').join('') + '</div>';
  const multi = m.type === 'spell' && m.need > 1;
  h += '<div class="sh-foot">' + (e.why ? '<button class="btn ghost" data-shot="cancel">Cancel</button>' : '<button class="btn primary" data-shot="go">' + (multi ? 'Add target ' + (m.picked.length + 1) + '/' + m.need : 'Confirm <span class="dia-txt" style="color:inherit">' + cost + '</span>') + '</button>' + (multi && m.picked.length ? '<button class="btn" data-shot="cast">Cast now</button>' : '<span class="hint">Enter · Tab</span>')) + '</div>';
  el.className = 'shot' + (e.why ? ' bad' : ''); el.innerHTML = h; el.hidden = false; el.dataset.tid = t.id;
};
BC.renderAreaShot = () => {
  const el = $('#shotPanel'); const B = BC.B, u = BC.cur, m = BC.mode; const shape = m.shape; const p = m.areaP;
  const cells = B.areaCells(u, shape, p); const origin = B.areaOrigin(u, shape, p);
  const hit = B.unitsInCells(cells, origin).filter(x => !(x === u && shape.t !== 'burst'));
  const foes = hit.filter(x => x.team !== u.team), allies = hit.filter(x => x.team === u.team);
  const sp = m.spell; const dc = sp ? B.spellDC(u) : B.classDC(u); const kind = sp ? sp.save : 'ref';
  let h = '<div class="sh-head"><span class="sh-ico">' + ico(sp ? Icons.forSpell(sp) : Icons.forAction(m.act)) + '</span><div class="sh-t"><b>' + esc(m.act.name) + '</b><small>' + shape.r + '-foot ' + shape.t + (kind ? ' · DC ' + dc + ' ' + SAVEN[kind] : '') + '</small></div><span class="sh-cost">' + GLYPH(m.actions || m.act.costN) + '</span></div>';
  if (m.areaBad) h += '<div class="sect"><div class="warn">' + ico('warn') + esc(m.areaBad) + '</div></div>';
  const exp = foes.length && kind ? foes.reduce((s, f) => { const q = PF.pdeg(B.stat(f, kind, sp ? spellCtx(sp) : {}), dc); return s + q[0] + q[1]; }, 0) : 0;
  h += '<div class="big"><div><small>Foes caught</small><b>' + foes.length + '</b></div><div class="crit"><small>' + (kind ? 'Expected fails' : 'Allies caught') + '</small><b>' + (kind ? exp.toFixed(1) : allies.length) + '</b></div></div>';
  if (foes.length || allies.length) h += '<div class="sect"><h5>In the area</h5><div class="areahits">' + foes.map(f => { const q = kind ? PF.pdeg(B.stat(f, kind, sp ? spellCtx(sp) : {}), dc) : null; return '<div class="ah"><i></i><span>' + esc(f.name) + '</span><b>' + (q ? pct(q[0] + q[1]) + '% fail' : '') + '</b></div>'; }).join('') + allies.map(f => '<div class="ah ally"><i></i><span>' + esc(f.name) + '</span><b style="color:var(--amber)">ally!</b></div>').join('') + '</div></div>';
  else h += '<div class="sect"><div class="dim">No creatures in the area.</div></div>';
  if (sp && sp.dmg) h += '<div class="sect"><h5>Damage</h5><div class="dmg">' + esc(dmgTxt(sp.dmg(m.cast.rank, {}))) + (sp.basic ? ' <span class="avg">basic ' + SAVEN[sp.save] + '</span>' : '') + '</div></div>';
  if (allies.length) h += '<div class="sect notes"><div class="warn">' + ico('warn') + 'Also hits ' + esc(allies.map(x => x.name).join(', ')) + '</div></div>';
  h += '<div class="sh-foot"><button class="btn primary" data-shot="area"' + (m.areaBad ? ' disabled' : '') + '>Confirm <span class="dia-txt" style="color:inherit">' + GLYPH(m.actions || m.act.costN) + '</span></button><span class="hint">Click · Enter</span></div>';
  el.className = 'shot' + (m.areaBad ? ' bad' : ''); el.innerHTML = h; el.hidden = false;
};

/* ================= HOVER / AREA PREVIEW ================= */
BC.rsAlong = (u, path) => {
  const B = BC.B; const names = []; const used = new Set(); const ox = u.x, oy = u.y;
  for (let i = 0; i < path.length - 1; i++) { u.x = path[i][0]; u.y = path[i][1]; B.units.forEach(r => { if (used.has(r.id) || r.team === u.team || !B.alive(r) || !(r.flags.reactiveStrike || (r.flags.disruptPrey && r.prey === u.id)) || !B.canReact(r, 'reactiveStrike')) return; if (B.inReach(r, u, B.reachOf(r))) { used.add(r.id); names.push(r.name); } }); }
  u.x = ox; u.y = oy; return names;
};
BC.tip = (html, cx, cy) => { const t = $('#tip'); if (!html) { t.hidden = true; return; } t.innerHTML = html; t.hidden = false; const W = G.innerWidth, H = G.innerHeight; const r = t.getBoundingClientRect(); let x = cx + 18, y = cy + 18; if (x + r.width > W - 8) x = cx - r.width - 18; if (y + r.height > H - 8) y = cy - r.height - 18; t.style.left = Math.max(4, x) + 'px'; t.style.top = Math.max(4, y) + 'px'; };
const unitMini = t => { const B = BC.B; const s = BC.disp[t.id] || B.snap(t); return '<div class="tt">' + esc(t.name) + ' <span class="dim" style="font-weight:400">' + (t.team === 'pc' ? 'Level ' : 'Creature ') + t.level + '</span></div><div class="num">HP ' + s.hp + '/' + s.maxHP + ' · AC ' + B.stat(t, 'ac') + '</div>' + (s.conds.length ? '<div class="mods">' + esc(s.conds.map(c => c.n).join(', ')) + '</div>' : ''); };
// cover the current unit would have at (x,y) against each living foe
BC.coverAt = (x, y) => {
  const B = BC.B, u = BC.cur; const out = [];
  withPos(u, [x, y], () => { B.foesOf(u).filter(f => f.hp > 0).forEach(f => { let c = 0; try { c = B.coverVs(u, f); } catch (e) { c = 0; } out.push({ f, c }); }); });
  return out.sort((a, b) => a.c - b.c);
};
BC.areaAim = (p) => {
  const B = BC.B, u = BC.cur, m = BC.mode, R = App.R; const shape = m.shape;
  const cells = B.areaCells(u, shape, p); const origin = B.areaOrigin(u, shape, p);
  let bad = '';
  if (shape.t === 'burst') { const rng = shape.range || (m.spell && m.spell.area && m.spell.area.range) || 30; if (B.distPt(u, Math.min(p.gx, B.W - 1), Math.min(p.gy, B.H - 1)) > rng + 5) bad = 'Out of range (' + rng + ' ft)'; else if (B.trace(u, origin).blocked) bad = 'No line of effect'; }
  R.layer('hoverArea', cells, bad ? '#777777' : '#ff7a2a', 0.5, { lift: 0.01 });
  m.areaP = p; m.areaBad = bad; BC.renderAreaShot();
  const hit = B.unitsInCells(cells, origin); R.setTargeted(hit.filter(x => x !== u || shape.t === 'burst').map(x => x.id));
};
BC.areaAt = t => { const m = BC.mode; const cx = t.x + t.sq / 2, cy = t.y + t.sq / 2; BC.areaAim(m.shape.t === 'burst' ? { gx: Math.round(cx), gy: Math.round(cy) } : { px: cx, py: cy }); };
BC.hover = (pk, cx, cy) => {
  const B = BC.B, R = App.R; if (!B) return;
  BC.lastHover = pk;
  if (BC.phase === 'deploy') { if (pk && pk.unit) BC.tip(unitMini(B.get(pk.unit)) + '<div class="hint">' + (B.get(pk.unit).team === 'pc' ? 'Click to select' : 'Click to inspect') + '</div>', cx, cy); else BC.tip(null); return; }
  if (!BC.isPlayerTurn()) { if (pk && pk.unit) BC.tip(unitMini(B.get(pk.unit)), cx, cy); else BC.tip(null); return; }
  const u = BC.cur, m = BC.mode || { type: 'move' };
  const t = pk && pk.unit ? B.get(pk.unit) : null;
  if (isTargetMode(m)) {
    const prev = BC.tgtHover;
    BC.tgtHover = t ? t.id : null;
    if (prev !== BC.tgtHover) { BC.renderShot(); BC.renderTargets(); }
    if (!t) { BC.tip(null); if (m.type === 'move+unit' || m.type === 'step+unit') { const e = BC.tgtSel ? BC.evalTarget(B.get(BC.tgtSel)) : null; R.showPath(e && e.plan && e.plan.path && e.plan.path.length > 1 ? e.plan.path : null, '#f5b942'); } return; }
    const e = BC.evalTarget(t);
    BC.tip(e.why ? '<div class="tt">' + esc(t.name) + '</div><div class="warn">' + ico('warn') + esc(e.why) + '</div>' : '<div class="tt">' + (e.pct != null ? '<span class="num" style="color:var(--amber)">' + e.pct + '% ' + (e.lbl === 'fail' ? 'fail' : e.lbl === 'succ' ? 'success' : 'hit') + '</span> · ' : '') + esc(t.name) + '</div><div class="hint">Click to ' + (m.type === 'spell' && m.need > 1 ? 'add target' : 'confirm') + '</div>', cx, cy);
    return;
  }
  R.showPath(null); R.clearLayer('hoverArea');
  if (!pk) { BC.tip(null); return; }
  if (m.type === 'area') {
    const shape = m.shape; const p = shape.t === 'burst' ? { gx: Math.round(pk.fx), gy: Math.round(pk.fy) } : { px: pk.fx, py: pk.fy };
    BC.areaAim(p); BC.tip(null); return;
  }
  if (t && m.type === 'move' && !m.act) { BC.tip(unitMini(t) + '<div class="hint">Click to inspect</div>', cx, cy); return; }
  const P = (m.type === 'move' && !m.act) ? BC.P : m.P;
  if (!P) { BC.tip(null); return; }
  const path = B.pathFrom(P, pk.x, pk.y);
  if (!path || path.length < 2 || !B.canEnd(u, pk.x, pk.y)) { BC.tip(null); return; }
  if (m.type === 'tile') { R.showPath([[u.x, u.y], [pk.x, pk.y]], '#ab8eff'); BC.tip('<div class="tt">' + esc(m.spell.name) + '</div><div class="hint">Teleport here</div>', cx, cy); return; }
  let segs = 1, label = m.act ? m.act.name : 'Stride';
  if (m.type === 'move' && !m.act) { segs = B.splitStrides(u, path, B.speedOf(u)).length; label = 'Stride' + (segs > 1 ? ' ×' + segs : ''); }
  const ft = P.best.get(pk.x + ',' + pk.y);
  const col = segs <= 1 ? '#6cc4f0' : segs === 2 ? '#f5b942' : '#ff9a5c';
  R.showPath(path, col);
  const rs = (m.act && (m.act.id === 'mobility' || m.type === 'step')) ? [] : BC.rsAlong(u, path);
  const tl = B.tile(pk.x, pk.y);
  const cov = BC.coverAt(pk.x, pk.y);
  const covH = cov.length ? '<div class="covers">' + cov.slice(0, 6).map(({ f, c }) => '<span class="cv c' + c + '" title="' + esc((c ? B.COVERN[c] : 'no cover') + ' vs ' + f.name) + '">' + ico(c ? 'cover' + c : 'warn') + esc(f.name.length > 12 ? f.name.slice(0, 11) + '…' : f.name) + '</span>').join('') + '</div>' : '';
  BC.tip('<div class="tt"><span class="dia-txt">' + GLYPH(m.act ? (m.act.costN || 1) : segs) + '</span> ' + esc(label) + ' <span class="num dim" style="font-weight:400">' + ft + ' ft</span></div><div class="dim">' + esc((tl.obj ? PF.OBJ[tl.obj].name + ' · ' : '') + PF.TERR[tl.terr].name) + (tl.diff ? ' (difficult)' : '') + (tl.h ? ' · elevation ' + tl.h * 5 + ' ft' : '') + '</div>' + (rs.length ? '<div class="warn">' + ico('warn') + 'Provokes Reactive Strike from ' + esc(rs.join(', ')) + '</div>' : '') + (tl.hazard ? '<div class="warn">' + ico('fire') + 'Lava! Burns on entry and at end of turn.</div>' : '') + covH, cx, cy);
};
// for charge / skirmish: best destination to strike target t
BC.planApproach = t => {
  const B = BC.B, u = BC.cur, m = BC.mode;
  const canFrom = () => u.strikes.some(s => (m.type === 'step+unit' ? true : s.kind === 'melee') && (m.act.id !== 'flyingKick' || s.traits.includes('unarmed')) && B.prepStrike(u, s, t).ok);
  if (canFrom()) return { dest: [u.x, u.y], path: null };
  let best = null;
  m.P.best.forEach((c, k) => { const [x, y] = k.split(',').map(Number); if (!B.canEnd(u, x, y)) return; const ox = u.x, oy = u.y; u.x = x; u.y = y; const ok = canFrom(); const fl = ok && B.offGuardWhy(t, u) ? -3 : 0; u.x = ox; u.y = oy; if (ok && (!best || c + fl * 5 < best.c)) best = { c: c + fl * 5, dest: [x, y] }; });
  if (!best) return null;
  return { dest: best.dest, path: B.pathFrom(m.P, best.dest[0], best.dest[1]) };
};

/* ================= CLICK ================= */
BC.click = (pk, touch) => {
  const B = BC.B; if (!B) return;
  if (BC.phase === 'deploy') {
    if (pk && pk.unit) { const t = B.get(pk.unit); if (t.team === 'pc') { BC.sel = t; App.R.setActive(t.id); BC.renderUnitCard(t); } else BC.inspect(t); return; }
    if (pk && BC.sel) { if (B.redeploy(BC.sel, pk.x, pk.y)) { B.units.forEach(u => App.R.place(App.R.units[u.id], u.x, u.y)); } }
    return;
  }
  if (!BC.isPlayerTurn()) { if (pk && pk.unit) BC.inspect(B.get(pk.unit)); return; }
  const u = BC.cur, m = BC.mode || { type: 'move' };
  if (!pk) return;
  const t = pk.unit ? B.get(pk.unit) : null;
  // touch: first tap previews, second tap on the same spot confirms
  if (touch) { const k = (t ? 'u' + t.id : pk.x + ',' + pk.y) + '|' + (m.key || m.type); if (BC._tp !== k && !(m.type === 'move' && !m.act && t)) { BC._tp = k; if (isTargetMode(m) && t) { if (!BC.evalTarget(t).why) BC.selectTarget(t.id); else BC.flash(BC.evalTarget(t).why); return; } BC.hover(pk, 0, 0); if (m.type !== 'unit' && m.type !== 'spell') return; } BC._tp = null; }
  if (m.type === 'move' && !m.act) {
    if (t) { BC.inspect(t); return; }
    if (B.canEnd(u, pk.x, pk.y)) BC.act('move', { dest: [pk.x, pk.y] });
    return;
  }
  if (isTargetMode(m)) { if (!t) return; BC.confirmTarget(t); return; }
  if (m.type === 'area') { const shape = m.shape; BC.areaAim(shape.t === 'burst' ? { gx: Math.round(pk.fx), gy: Math.round(pk.fy) } : { px: pk.fx, py: pk.fy }); BC.confirmArea(); return; }
  if (m.type === 'move' || m.type === 'move2' || m.type === 'step' || m.type === 'tile') {
    if (!B.canEnd(u, pk.x, pk.y)) return;
    if (m.type === 'tile') return BC.act('cast', Object.assign({}, m.p, { x: pk.x, y: pk.y }));
    if (m.type === 'move2') return BC.act('cast', Object.assign({}, m.p, { dest: [pk.x, pk.y] }));
    const path = B.pathFrom(m.P, pk.x, pk.y); if (!path) return;
    return BC.act(m.act.id, Object.assign({}, m.p, { dest: [pk.x, pk.y] }));
  }
};
BC.confirmArea = () => { const m = BC.mode; if (!m || m.type !== 'area' || !m.areaP) return; if (m.areaBad) { BC.flash(m.areaBad); return; } BC.act(m.act.id === 'cast' ? 'cast' : m.act.id, Object.assign({}, m.p, m.areaP)); };
BC.confirm = () => {
  const m = BC.mode; if (!BC.isPlayerTurn() || !m) return;
  if (m.type === 'area') return BC.confirmArea();
  if (m.type === 'spell' && m.picked.length && (!BC.tgtSel || m.picked.includes(BC.tgtSel) || BC.evalTarget(BC.B.get(BC.tgtSel)).why)) return BC.castPicked();
  if (isTargetMode(m) && BC.tgtSel) BC.confirmTarget(BC.B.get(BC.tgtSel));
};

/* ================= INPUT BINDING ================= */
BC.bind = () => {
  const cv = App.R.renderer.domElement;
  let down = null; let raf = 0; let lastMove = null;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, b: e.button, moved: false, lx: e.clientX, ly: e.clientY }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (down) {
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY;
      if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 6) down.moved = true;
      if (down.moved) { if (down.b === 2 || down.b === 1 || e.shiftKey) { App.R.rotate(-dx * 0.006); App.R.tilt(dy * 0.004); } else App.R.pan(-dx * 0.035, -dy * 0.035); }
      return;
    }
    if (e.pointerType === 'touch') return;
    lastMove = e; if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (App.screen === 'battle' && BC.B && lastMove) BC.hover(App.R.pick(lastMove.clientX, lastMove.clientY), lastMove.clientX, lastMove.clientY); });
  });
  cv.addEventListener('pointerup', e => {
    const d = down; down = null; if (!d) return;
    if (!d.moved && d.b === 0 && App.screen === 'battle') { const pk = App.R.pick(e.clientX, e.clientY); BC.click(pk, e.pointerType === 'touch'); if (BC.B && e.pointerType !== 'touch') BC.hover(pk, e.clientX, e.clientY); }
    if (!d.moved && d.b === 2 && App.screen === 'battle') BC.cancel();
  });
  cv.addEventListener('pointerleave', () => { $('#tip').hidden = true; if (BC.tgtHover) { BC.tgtHover = null; BC.renderShot(); BC.renderTargets(); } });
  cv.addEventListener('wheel', e => { e.preventDefault(); App.R.zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  let pinch = null;
  cv.addEventListener('touchstart', e => { if (e.touches.length === 2) { const [a, b] = e.touches; pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); down = null; } }, { passive: true });
  cv.addEventListener('touchmove', e => { if (e.touches.length === 2 && pinch) { const [a, b] = e.touches; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); App.R.zoom(pinch / d); pinch = d; } }, { passive: true });
  cv.addEventListener('touchend', () => { pinch = null; }, { passive: true });
  document.addEventListener('keydown', e => {
    if (App.screen !== 'battle' || !$('#modal').hidden || e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) && !e.ctrlKey && !e.metaKey) { BC.keys[k] = true; e.preventDefault(); return; }
    if (k === 'q') App.R.rotate(Math.PI / 4); if (k === 'e') App.R.rotate(-Math.PI / 4);
    if (k === 'escape') { if (!$('#spellbook').hidden) { $('#spellbook').hidden = true; BC.renderActions(); } else if (BC.mode && BC.mode.type !== 'move' || BC.mode && BC.mode.act) BC.cancel(); else if (!$('#inspect').hidden) $('#inspect').hidden = true; else if (!$('#helpPanel').hidden) $('#helpPanel').hidden = true; }
    if (k === ' ') { e.preventDefault(); if (BC.phase === 'deploy') BC.begin(); else BC.endTurn(); }
    if (k === 'enter') { if (BC.phase === 'deploy') { BC.begin(); return; } e.preventDefault(); BC.confirm(); }
    if (k === 'tab') { if (isTargetMode(BC.mode) && BC.isPlayerTurn()) { e.preventDefault(); BC.cycleTarget(e.shiftKey ? -1 : 1); } }
    if (k === 'l') BC.toggleLog();
    if (k === 'b') BC.toggleSpellbook();
    if (k === '?' || (k === '/' && e.shiftKey)) $('#helpPanel').hidden = !$('#helpPanel').hidden;
    if (/^[0-9]$/.test(k) && BC.hot) { const i = (+k + 9) % 10; if (BC.hot[i]) BC.choose(BC.hot[i]); }
  });
  document.addEventListener('keyup', e => { BC.keys[e.key.toLowerCase()] = false; });
  G.addEventListener('blur', () => { BC.keys = {}; });
  const tray = $('#hudBottom');
  tray.addEventListener('click', e => {
    const tb = e.target.closest('[data-tab]'); if (tb) { BC.setTab(tb.dataset.tab); return; }
    const b = e.target.closest('[data-akey]'); if (b) { BC.choose(b.dataset.akey); return; }
    const c = e.target.closest('[data-tgt]');
    if (c && BC.B) {
      const t = BC.B.get(c.dataset.tgt); if (!t) return; const m = BC.mode;
      if (isTargetMode(m) && BC.isPlayerTurn()) { if (BC.tgtSel === t.id) BC.confirmTarget(t); else if (BC.evalTarget(t).why) BC.flash(BC.evalTarget(t).why); else BC.selectTarget(t.id, true); }
      else if (m && m.type === 'area' && BC.isPlayerTurn()) { if (m.areaP && BC._areaChip === t.id) BC.confirmArea(); else { BC._areaChip = t.id; BC.areaAt(t); } }
      else { App.R.focus(t.x + t.sq / 2, t.y + t.sq / 2); BC.inspect(t); }
    }
  });
  tray.addEventListener('mouseover', e => {
    const b = e.target.closest('[data-akey]'); if (b && $('#actionBar').contains(b)) BC.showInfo(b.dataset.akey);
    const c = e.target.closest('[data-tgt]'); BC.ring('hl', c ? c.dataset.tgt : null, '#4bd8e8');
  });
  tray.addEventListener('mouseleave', () => { BC.showInfo(); BC.ring('hl', null, '#4bd8e8'); });
  $('#actionBar').addEventListener('mouseleave', () => BC.showInfo());
  $('#spellbook').addEventListener('click', e => { const b = e.target.closest('[data-akey]'); if (b) BC.choose(b.dataset.akey); });
  $('#spellbook').addEventListener('mouseover', e => { const b = e.target.closest('[data-akey]'); if (b) BC.showInfo(b.dataset.akey); });
  $('#shotPanel').addEventListener('click', e => { const b = e.target.closest('[data-shot]'); if (!b) return; const k = b.dataset.shot; if (k === 'go') { const t = BC.B && BC.B.get($('#shotPanel').dataset.tid); if (t) { BC.tgtSel = t.id; BC.confirmTarget(t); } } if (k === 'cast') BC.castPicked(); if (k === 'area') BC.confirmArea(); if (k === 'cancel') BC.cancel(); });
  const ib = $('#initBar');
  ib.addEventListener('click', e => { const c = e.target.closest('[data-uid]'); if (!c || !BC.B) return; const u = BC.B.get(c.dataset.uid); if (!u) return; App.R.focus(u.x + u.sq / 2, u.y + u.sq / 2); BC.inspect(u); });
  ib.addEventListener('mouseover', e => { const c = e.target.closest('[data-uid]'); BC.ring('hl', c ? c.dataset.uid : null, '#4bd8e8'); $$('.icard', ib).forEach(x => x.classList.toggle('hl', x === c)); });
  ib.addEventListener('mouseleave', () => { BC.ring('hl', null, '#4bd8e8'); $$('.icard', ib).forEach(x => x.classList.remove('hl')); });
  $('#btnBegin').onclick = () => BC.begin();
  $('#btnLeave').onclick = () => { BC.teardown(); App.show('setup'); };
  $('#btnLog').onclick = () => BC.toggleLog();
  $('#logClose').onclick = () => BC.toggleLog(false);
  $('#btnSettings').onclick = App.openSettings;
  $('#btnHelp').onclick = () => { $('#helpPanel').hidden = !$('#helpPanel').hidden; };
  $('#btnHelpClose').onclick = () => { $('#helpPanel').hidden = true; };
  $('#autoParty').onchange = () => { if ($('#autoParty').checked && BC.isPlayerTurnRaw()) { BC.mode = null; App.R.clearLayers(); BC.hideShot(); $('#spellbook').hidden = true; BC.advanceFromPlayer(); } };
  $('#animSpeed').onchange = () => { App.settings.speed = +$('#animSpeed').value; App.saveSettings(); };
  G.addEventListener('tat:settings', () => { if (BC.B && BC.isPlayerTurn()) BC.renderEnd(); });
};
BC.isPlayerTurnRaw = () => BC.B && BC.cur && BC.B.cur === BC.cur && !BC.busy && BC.phase === 'battle' && !BC.B.over;
BC.advanceFromPlayer = async () => { const B = BC.B, u = BC.cur; BC.busy = true; BC.renderActions(); $('#targetBar').innerHTML = ''; B.aiTurn(u); await BC.play(); if (!B.over && B.cur === u) B.endTurn(u); await BC.play(); BC.busy = false; BC.advance(); };
})(typeof window !== 'undefined' ? window : globalThis);
