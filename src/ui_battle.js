/* ui_battle.js — battle controller: turn flow, input, targeting previews, HUD */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D, U = PF.U, App = PF.App;
const $ = App.$, $$ = App.$$, esc = U.esc;
const BC = App.Battle = { B: null, busy: false, mode: null, plates: {}, disp: {}, keys: {}, stats: null };
const GLYPH = n => n === 0 ? '◇' : n === 'r' ? '⟲' : Array.isArray(n) ? n.map(x => '◆'.repeat(x)).join('/') : '◆'.repeat(n || 1);
BC.GLYPH = GLYPH;

/* ================= START / TEARDOWN ================= */
App.startBattle = cfg => {
  BC.teardown();
  const B = PF.Battle(cfg); B.deploy();
  BC.B = B; App.B = B; BC.cfg = U.clone(cfg); BC.phase = 'deploy'; BC.cur = null; BC.sel = null; BC.mode = null; BC.busy = false;
  BC.stats = { dmg: { pc: 0, foe: 0 }, crits: { pc: 0, foe: 0 }, kills: { pc: 0, foe: 0 } };
  const R = App.R; R.loadMap(B); App.dioramaMap = null;
  B.units.forEach(u => { R.addUnit(u); BC.disp[u.id] = B.snap(u); });
  BC.makePlates();
  App.show('battle');
  $('#logBody').innerHTML = ''; $('#result').hidden = true; $('#inspect').hidden = true; $('#spellbook').hidden = true; $('#helpPanel').hidden = true; $('#banner').hidden = true;
  $('#deployBar').hidden = false; $('#roundLbl').textContent = 'Deployment';
  BC.showZones();
  // camera behind the party, looking at the foes
  const cen = team => { const us = B.units.filter(u => u.team === team); return { x: us.reduce((a, u) => a + u.x + u.sq / 2, 0) / Math.max(1, us.length), y: us.reduce((a, u) => a + u.y + u.sq / 2, 0) / Math.max(1, us.length) }; };
  const a = cen('pc'), b = cen('foe');
  R.cam.gyaw = R.cam.yaw = Math.atan2(a.x - b.x, a.y - b.y); R.cam.gdist = 22; R.cam.gpitch = 0.95;
  R.focus(a.x * 0.65 + b.x * 0.35, a.y * 0.65 + b.y * 0.35, true);
  BC.addLog({ text: (cfg.title ? cfg.title + ' — ' : '') + D.maps[cfg.map].name + '. Party level ' + cfg.partyLevel + '. ' + BC.threatText(), cls: 'head' });
  BC.renderInit(); BC.renderUnitCard(B.units.find(u => u.team === 'pc')); BC.renderActions();
};
BC.threatText = () => { const B = BC.B; const pcs = B.units.filter(u => u.team === 'pc').length; const xp = D.encounterXP(BC.cfg.foes.filter(f => D.creatures[f.id]), BC.cfg.partyLevel); const th = PF.threatFor(xp, pcs); return th.label + ' threat (' + xp + ' XP for ' + pcs + ' heroes).'; };
BC.teardown = () => {
  if (!BC.B) return;
  Object.values(BC.plates).forEach(p => p.el.remove()); BC.plates = {}; BC.disp = {};
  App.R.clearLayers(); App.R.showPath(null); App.R.setTargeted([]); App.R.setActive(null);
  Object.keys(App.R.terrainFx).forEach(App.R.removeTerrainFx);
  BC.B = null; App.B = null; BC.busy = false; BC.gen = (BC.gen || 0) + 1;
};
BC.showZones = () => { const B = BC.B, R = App.R; R.layer('zonePC', B.zone.pc, '#4fa8e0', 0.28); R.layer('zoneFoe', B.zone.foe, '#e0524a', 0.22); };

/* ================= PLATES & FLOATS ================= */
BC.makePlates = () => {
  const host = $('#plates');
  BC.B.units.forEach(u => {
    const el = document.createElement('div'); el.className = 'plate ' + u.team;
    el.innerHTML = '<b></b><div class="hb"><i></i><em></em></div><div class="cs"></div>';
    host.appendChild(el); BC.plates[u.id] = { el, u };
    BC.updatePlate(u.id);
  });
};
BC.updatePlate = id => {
  const p = BC.plates[id]; if (!p) return; const s = BC.disp[id] || {}; const u = p.u;
  const short = u.name.length > 16 ? u.name.slice(0, 15) + '…' : u.name;
  p.el.querySelector('b').textContent = short + (s.dying ? ' · dying ' + s.dying : '');
  const pct = Math.max(0, s.hp / Math.max(1, s.maxHP)); const tp = Math.min(1 - pct, (s.temp || 0) / Math.max(1, s.maxHP));
  p.el.querySelector('i').style.width = (pct * 100) + '%';
  const em = p.el.querySelector('em'); em.style.left = (pct * 100) + '%'; em.style.width = (tp * 100) + '%';
  const keys = (s.conds || []).filter(c => c.bad && c.k !== 'fx' && c.k !== 'persist').map(c => c.n).slice(0, 3);
  p.el.querySelector('.cs').textContent = (s.shield ? '⛨ ' : '') + keys.join(' · ');
  p.el.classList.toggle('dead', !!s.dead);
};
BC.frame = () => {
  if (!BC.B) return;
  Object.keys(BC.plates).forEach(id => { const p = BC.plates[id]; const sc = App.R.unitScreen(id); if (!sc || sc.behind) { p.el.style.display = 'none'; return; } p.el.style.display = ''; p.el.style.left = sc.x + 'px'; p.el.style.top = sc.y + 'px'; });
  // keyboard pan
  const k = BC.keys; const sp = 0.35;
  if (k.w || k.arrowup) App.R.pan(0, -sp); if (k.s || k.arrowdown) App.R.pan(0, sp); if (k.a || k.arrowleft) App.R.pan(-sp, 0); if (k.d || k.arrowright) App.R.pan(sp, 0);
};
BC.float = (id, text, c) => {
  const sc = App.R.unitScreen(id); if (!sc) return;
  const el = document.createElement('div'); el.className = 'float ' + (c || 'info'); el.textContent = text;
  el.style.left = (sc.x + (Math.random() - 0.5) * 24) + 'px'; el.style.top = (sc.y - 6) + 'px';
  $('#plates').appendChild(el); setTimeout(() => el.remove(), 1400);
};

/* ================= EVENT PLAYBACK ================= */
BC.play = async () => {
  const B = BC.B; if (!B) return; const gen = BC.gen;
  let evs = B.drain();
  while (evs.length) {
    for (const e of evs) {
      if (gen !== BC.gen) return;
      await BC.playOne(e);
    }
    evs = B.drain();
  }
  BC.renderInit();
};
BC.playOne = async e => {
  const R = App.R; const B = BC.B;
  R.speed = +$('#animSpeed').value || 1;
  switch (e.t) {
    case 'log': BC.addLog(e); break;
    case 'move': if (e.path && e.path.length > 1) await R.animMove(e.u, e.path, e.kind); break;
    case 'attack': {
      const a = B.get(e.a); if (a && BC.stats && e.deg === 3) BC.stats.crits[a.team]++;
      await R.animAttack(e.a, e.b, e.ranged, e.deg, e.c);
      if (e.deg <= 1) BC.float(e.b, e.deg === 0 ? 'Critical miss' : 'Miss', 'miss');
      else if (e.deg === 3) BC.float(e.b, 'Critical!', 'crit');
      break;
    }
    case 'bolt': { const a = R.units[e.a], b = R.units[e.b]; if (a && b) { const pa = a.g.position.clone(); pa.y += 0.9; const pb = b.g.position.clone(); pb.y += 0.6; for (let i = 0; i < Math.min(3, e.n || 1); i++) await R.animBolt(pa, pb, R.fxColor(e.c), true); } break; }
    case 'area': await R.animArea(e.cells, e.c); break;
    case 'pulse': await R.animPulse(e.u, e.r, e.c); break;
    case 'cast': await R.animCast(e.u, e.c); break;
    case 'float': {
      BC.float(e.u, e.text, e.c);
      if (BC.stats && /^−\d+/.test(e.text)) { const t = B.get(e.u); if (t) BC.stats.dmg[t.team === 'pc' ? 'foe' : 'pc'] += +e.text.slice(1); }
      await R.wait(0.06); break;
    }
    case 'state': { BC.disp[e.u] = e.s; BC.updatePlate(e.u); const r = R.units[e.u]; if (r && !r.state.dead) R.setPose(e.u, { prone: e.s.prone, down: e.s.down && !e.s.dead, shield: e.s.shield }); if (BC.shown && BC.shown.id === e.u) BC.renderUnitCard(BC.shown, true); break; }
    case 'prone': R.setPose(e.u, { prone: e.v }); await R.wait(0.08); break;
    case 'down': R.setPose(e.u, { down: true }); await R.wait(0.15); break;
    case 'up': R.setPose(e.u, { down: false }); break;
    case 'dead': { const t = B.get(e.u); if (t && BC.stats) BC.stats.kills[t.team === 'pc' ? 'foe' : 'pc']++; await R.animDeath(e.u); break; }
    case 'shield': R.setPose(e.u, { shield: e.v }); break;
    case 'turn': {
      const u = B.get(e.u); R.setActive(e.u); BC.renderInit(e.u);
      if (u) { R.focus(u.x + u.sq / 2, u.y + u.sq / 2); BC.renderUnitCard(u); }
      await R.wait(0.22); break;
    }
    case 'round': $('#roundLbl').textContent = 'Round ' + e.n; await BC.banner('Round ' + e.n); break;
    case 'terrain': if (e.remove) R.removeTerrainFx(e.id); else R.addTerrainFx(e.id, e.cells, e.kind); break;
    case 'over': break;
  }
};
BC.banner = async text => { const b = $('#banner'); b.textContent = text; b.hidden = false; await App.R.wait(0.6); b.hidden = true; };

/* ================= LOG ================= */
BC.addLog = e => {
  const el = document.createElement('div'); el.className = 'll ' + (e.cls || '') + (e.det ? ' has' : '');
  el.textContent = e.text;
  if (e.det) { el.title = e.det; el.onclick = () => { const d = el.querySelector('.det'); if (d) d.remove(); else { const s = document.createElement('span'); s.className = 'det'; s.textContent = e.det; el.appendChild(s); } }; }
  const body = $('#logBody'); body.appendChild(el);
  while (body.children.length > 600) body.removeChild(body.firstChild);
  body.scrollTop = body.scrollHeight;
};

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
    BC.renderActions(); App.R.clearLayers(['move1', 'move2', 'move3', 'valid', 'area']); App.R.showPath(null);
    await App.R.wait(0.12);
    try { B.aiTurn(u); } catch (err) { console.error(err); BC.addLog({ text: 'AI error: ' + err.message, cls: 'bad' }); }
    await BC.play(); if (gen !== BC.gen) return;
    if (!B.over && B.cur === u) B.endTurn(u);
    await BC.play(); if (gen !== BC.gen) return;
  }
};
BC.startPlayerTurn = u => { BC.mode = { type: 'move' }; $('#spellbook').hidden = true; BC.refresh(); };
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
  BC.busy = false; BC.mode = { type: 'move' }; BC.refresh();
};
BC.act = async (id, p) => {
  if (!BC.isPlayerTurn()) return;
  BC.busy = true; $('#spellbook').hidden = true; $('#tip').hidden = true;
  App.R.clearLayers(['move1', 'move2', 'move3', 'valid', 'area', 'hoverArea']); App.R.showPath(null); App.R.setTargeted([]);
  const r = BC.B.doAction(BC.cur, id, p);
  if (!r.ok) { BC.busy = false; BC.addLog({ text: r.err, cls: 'warn' }); BC.flash(r.err); BC.mode = { type: 'move' }; BC.refresh(); return; }
  await BC.after();
};
BC.endTurn = async () => {
  if (!BC.isPlayerTurn()) return;
  BC.busy = true; App.R.clearLayers(); App.R.showPath(null); $('#spellbook').hidden = true; $('#tip').hidden = true;
  BC.B.endTurn(BC.cur); await BC.play(); BC.busy = false; BC.advance();
};
BC.flash = msg => { const b = $('#banner'); b.textContent = msg; b.hidden = false; b.style.fontSize = '22px'; clearTimeout(BC._ft); BC._ft = setTimeout(() => { b.hidden = true; b.style.fontSize = ''; }, 1300); };
BC.finish = () => {
  const B = BC.B; if (!B) return; BC.busy = false;
  App.R.clearLayers(); App.R.showPath(null); App.R.setActive(null); BC.renderActions();
  const win = B.over === 'win'; const st = BC.stats;
  const pcs = B.units.filter(u => u.team === 'pc');
  const res = $('#result');
  res.innerHTML = '<h2 style="color:' + (win ? 'var(--crit)' : 'var(--foe)') + '">' + (win ? 'Victory' : 'Defeat') + '</h2><div class="dim">' + B.round + ' round' + (B.round === 1 ? '' : 's') + ' · ' + esc(BC.threatText()) + '</div>' +
    '<div class="stats"><div><b>' + st.dmg.pc + '</b><small>damage dealt</small></div><div><b>' + st.dmg.foe + '</b><small>damage taken</small></div><div><b>' + st.crits.pc + '</b><small>critical hits</small></div></div>' +
    '<div class="dim" style="font-size:13px">' + pcs.map(p => esc(p.name) + ' ' + (p.dead ? '† dead' : p.hp <= 0 ? 'down' : p.hp + '/' + B.maxHP(p))).join(' · ') + '</div>' +
    '<div class="row gap" style="justify-content:center;flex-wrap:wrap"><button class="btn primary" id="rAgain">Fight again</button><button class="btn" id="rEdit">Edit skirmish</button><button class="btn ghost" id="rHome">Home</button></div>';
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
  $('#initBar').innerHTML = ids.map(id => { const u = B.get(id); const s = BC.disp[id] || B.snap(u); const pct = Math.max(0, s.hp / Math.max(1, s.maxHP)); return '<div class="ichip ' + u.team + (id === curId ? ' cur' : '') + (s.dead || s.down ? ' down' : '') + '" data-uid="' + id + '"><b>' + esc(u.name) + '</b><span class="in">' + (u.initRoll != null ? u.initRoll : '–') + '</span><div class="hpb"><i style="width:' + (pct * 100) + '%;' + (u.team === 'foe' ? 'background:var(--foe)' : '') + '"></i></div></div>'; }).join('');
};
BC.renderUnitCard = (u, quiet) => {
  const B = BC.B; if (!B || !u) { $('#unitCard').innerHTML = ''; return; }
  BC.shown = u;
  const s = B.snap(u); const cls = u.cls || '';
  const pct = Math.max(0, s.hp / s.maxHP) * 100, tp = Math.min(100 - pct, (s.temp / s.maxHP) * 100);
  const sv = k => App.sgn(B.stat(u, k));
  const isCur = B.cur === u;
  const pips = isCur ? Array.from({ length: 3 }, (_, i) => '<span class="pip' + (i < u.turn.acts ? ' on' : '') + '"></span>').join('') + (u.turn.quick ? '<span class="pip quick on" title="Quickened: ' + u.turn.quick.join('/') + '"></span>' : '') : '';
  const react = '<span class="pip react' + (u.react > 0 ? ' on' : '') + '" title="Reaction"></span>';
  $('#unitCard').innerHTML = '<div class="uc-head">' + (u.team === 'pc' ? App.badge(cls, (u.clsName || '?').charAt(0)) : App.badge('', u.name.charAt(0), true)) + '<div style="min-width:0"><b>' + esc(u.name) + '</b><span>' + esc(u.team === 'pc' ? 'Level ' + u.level + ' ' + (u.sheet ? u.sheet.ancName + ' ' + u.sheet.clsName : '') : 'Creature ' + u.level) + '</span></div></div>' +
    '<div class="hpbar"><i style="width:' + pct + '%"></i><em style="left:' + pct + '%;width:' + tp + '%"></em><span>' + s.hp + ' / ' + s.maxHP + (s.temp ? ' (+' + s.temp + ')' : '') + (s.dying ? ' · dying ' + s.dying : '') + '</span></div>' +
    '<div class="ucstats"><span>AC <b>' + B.stat(u, 'ac') + '</b></span><span>Fort <b>' + sv('fort') + '</b></span><span>Ref <b>' + sv('ref') + '</b></span><span>Will <b>' + sv('will') + '</b></span><span>Per <b>' + sv('per') + '</b></span><span>Speed <b>' + B.speedOf(u) + '</b></span>' + (u.focus ? '<span>Focus <b>' + u.focus.cur + '/' + u.focus.max + '</b></span>' : '') + (u.hero ? '<span>Hero <b>' + u.hero + '</b></span>' : '') + '</div>' +
    '<div class="pips">' + pips + react + (isCur ? '<span style="margin-left:6px">' + (u.turn.attacks ? 'MAP ' + B.mapPen(u, u.strikes[0]) : '') + '</span>' : '') + '</div>' +
    '<div class="chips">' + s.conds.map(c => '<span class="chip ' + (c.bad ? 'bad' : 'good') + '" title="' + esc((PF.COND[c.k] || {}).d || '') + '">' + esc(c.n) + '</span>').join('') + '</div>';
};
App.unitBlock = (u, B) => {
  let h = '<div class="sb"><h3>' + esc(u.name) + ' <span class="dim">· ' + (u.team === 'pc' ? 'Level ' : 'Creature ') + u.level + '</span></h3>';
  h += '<div class="traits">' + [u.size].concat(u.traits).map(t => '<span class="trait">' + esc(t) + '</span>').join('') + '</div>';
  h += '<div class="stats">' + [['HP', u.hp + '/' + B.maxHP(u)], ['AC', B.stat(u, 'ac')], ['Fort', App.sgn(B.stat(u, 'fort'))], ['Ref', App.sgn(B.stat(u, 'ref'))], ['Will', App.sgn(B.stat(u, 'will'))], ['Perc', App.sgn(B.stat(u, 'per'))], ['Speed', B.speedOf(u)]].map(([k, v]) => '<div class="stat"><small>' + k + '</small><b>' + v + '</b></div>').join('') + '</div>';
  if (u.immune && u.immune.length) h += '<div class="line"><b>Immune</b> ' + esc(u.immune.join(', ')) + '</div>';
  if (Object.keys(u.resist || {}).length) h += '<div class="line"><b>Resist</b> ' + Object.entries(u.resist).map(([k, v]) => k + ' ' + v).join(', ') + '</div>';
  if (Object.keys(u.weak || {}).length) h += '<div class="line"><b>Weak</b> ' + Object.entries(u.weak).map(([k, v]) => k + ' ' + v).join(', ') + '</div>';
  if (u.regen) h += '<div class="line"><b>Regeneration</b> ' + u.regen.v + ' (off: ' + u.regen.off.join(', ') + ')' + (u.regen.disabled ? ' — currently off' : '') + '</div>';
  h += '<hr>';
  u.strikes.forEach(s => { h += '<div class="line"><b>' + (s.kind === 'melee' ? 'Melee' : 'Ranged') + '</b> ' + esc(s.name) + ' <span class="num">' + App.sgn(s.atk.base + s.atk.item) + '</span> · ' + esc(s.dmg.map(d => U.dstr(d) + ' ' + d.type).join(' + ')) + (s.traits.length ? ' <span class="dim">(' + esc(s.traits.join(', ')) + ')</span>' : '') + '</div>'; });
  (u.abil || []).forEach(a => { const ab = D.abilities[a]; if (ab) h += '<div class="line"><b>' + esc(ab.name) + '</b></div>'; });
  const conds = B.condList(u);
  if (conds.length) h += '<hr>' + conds.map(c => '<div class="line"><b>' + esc(c.n) + '</b> <span class="dim">' + esc((PF.COND[c.k] || {}).d || '') + '</span></div>').join('');
  if (u.spells) { const cs = B.castables(u).filter(c => c.src !== 'cantrip'); h += '<hr><div class="line"><b>Spells</b> DC ' + B.spellDC(u) + ' · ' + esc(cs.map(c => c.name + (c.left ? ' ×' + c.left : '')).join(', ') || 'none left') + '</div>'; }
  return h + '</div>';
};
BC.inspect = u => {
  const el = $('#inspect'); if (!u) { el.hidden = true; return; }
  el.innerHTML = '<div class="row" style="justify-content:flex-end"><button class="x" id="insClose" aria-label="Close">×</button></div>' + App.unitBlock(u, BC.B);
  el.hidden = false; $('#insClose').onclick = () => { el.hidden = true; };
};

/* ================= ACTION BAR ================= */
const ORDER = { strike: 0, class: 1, monster: 1, basic: 2, skill: 3, item: 4, spell: 5 };
BC.renderActions = () => {
  const B = BC.B; const bar = $('#actionBar');
  const u = BC.cur;
  if (!B || BC.phase !== 'battle' || !u || !BC.isPlayerTurn()) {
    bar.innerHTML = BC.phase === 'deploy' ? '' : (B && B.over ? '' : '<div class="dim" style="padding:12px">' + (u ? esc(u.name) + ' is acting…' : '') + '</div>');
    BC.hot = []; return;
  }
  const acts = B.actionsFor(u);
  const groups = {}; const spells = [];
  acts.forEach(a => { if (a.id === 'cast') { spells.push(a); return; } (groups[a.group] = groups[a.group] || []).push(a); });
  BC.acts = acts; BC.hot = [];
  let html = '';
  const btn = (a, key) => {
    const idx = BC.hot.length; BC.hot.push(key);
    const sel = BC.mode && BC.mode.key === key;
    return '<button class="abtn' + (a.why ? ' off' : '') + (sel ? ' sel' : '') + '" data-akey="' + esc(key) + '" title="' + esc((a.why ? a.why + ' — ' : '') + (a.desc || '')) + '"><span class="hk">' + (idx < 10 ? (idx + 1) % 10 : '') + '</span><span class="cost">' + GLYPH(a.costN) + '</span><span class="nm">' + esc(a.name) + '</span>' + (a.sref ? '<span class="cnt num">' + App.sgn(a.sref.atk.base + a.sref.atk.item) + '</span>' : '') + '</button>';
  };
  BC.keyMap = {};
  Object.keys(groups).sort((a, b) => (ORDER[a] ?? 9) - (ORDER[b] ?? 9)).forEach(g => {
    html += '<div class="agroup">' + groups[g].map(a => { const key = a.id + (a.strike ? ':' + a.strike : '') + (a.stance ? ':' + a.stance : '') + (a.abil ? ':' + a.abil : ''); BC.keyMap[key] = a; return btn(a, key); }).join('') + '</div>';
  });
  if (spells.length) { const any = spells.some(s => !s.why); BC.keyMap.spells = { id: 'spells', name: 'Spells', costN: 0, why: any ? '' : 'No castable spells', desc: 'Open your spells' }; html += '<div class="agroup"><button class="abtn spell' + (any ? '' : ' off') + (!$('#spellbook').hidden ? ' sel' : '') + '" data-akey="spells"><span class="hk"></span><span class="cost">✦</span><span class="nm">Spells (' + spells.filter(s => !s.why).length + ')</span></button></div>'; }
  html += '<div class="agroup"><button class="abtn end" data-akey="end" title="End your turn (Space)"><span class="cost">⏎</span><span class="nm">End turn</span></button></div>';
  bar.innerHTML = html;
  BC.spells = spells;
  spells.forEach(a => { BC.keyMap['cast:' + a.castKey] = a; });
};
BC.renderSpellbook = () => {
  const el = $('#spellbook'); const sp = BC.spells || [];
  const groups = {};
  sp.forEach(a => { const c = a.cast; const k = c.src === 'cantrip' ? '0 Cantrips' : c.src === 'comp' ? '0 Compositions' : c.src === 'focus' ? '0 Focus spells' + (BC.cur.focus ? ' (' + BC.cur.focus.cur + ' FP)' : '') : c.src === 'font' ? '1 Divine font' : PF.ordinal(c.rank) + ' rank'; (groups[k] = groups[k] || []).push(a); });
  const keys = Object.keys(groups).sort();
  el.innerHTML = '<div class="row" style="justify-content:space-between"><b>Spells · DC ' + BC.B.spellDC(BC.cur) + ' · attack ' + App.sgn(BC.B.stat(BC.cur, 'spellatk')) + '</b><button class="x" id="sbClose" aria-label="Close">×</button></div>' +
    keys.map(k => '<div class="sbrank"><div class="rk">' + esc(k.replace(/^[01] /, '')) + '</div><div class="opts">' + groups[k].map(a => { const key = 'cast:' + a.castKey; BC.keyMap[key] = a; return '<button class="abtn spell' + (a.why ? ' off' : '') + '" data-akey="' + esc(key) + '" title="' + esc((a.why ? a.why + ' — ' : '') + a.desc) + '"><span class="cost">' + GLYPH(a.costN) + '</span><span class="nm">' + esc(a.name) + '</span><span class="cnt">' + (a.cast.src === 'slot' ? a.left + ' slot' + (a.left > 1 ? 's' : '') : a.cast.src === 'font' || a.cast.src === 'innate' ? a.left + ' left' : a.cast.src === 'prepared' ? 'prepared' : a.cast.src === 'focus' ? '1 FP' : 'rank ' + a.rank) + '</span></button>'; }).join('') + '</div></div>').join('') +
    '<div id="costPick"></div>';
  el.hidden = false;
  $('#sbClose').onclick = () => { el.hidden = true; BC.renderActions(); };
};
BC.choose = key => {
  if (!BC.isPlayerTurn()) return;
  if (key === 'end') return BC.endTurn();
  if (key === 'spells') { const sb = $('#spellbook'); if (sb.hidden) BC.renderSpellbook(); else sb.hidden = true; BC.renderActions(); return; }
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
    BC.renderActions(); BC.drawMode();
  };
  if (costs.length === 1) return go(costs[0]);
  const lab = n => sp.tgt === 'heal' ? ['', 'Touch', '30 ft, +8/rank', '30-ft burst'][n] : sp.id === 'forceBarrage' ? n + ' shard' + (n > 1 ? 's' : '') + ' per volley' : n + ' actions';
  $('#costPick').innerHTML = '<div class="costpick"><b>' + esc(sp.name) + ':</b>' + costs.map(n => '<button class="btn small" data-cost="' + n + '">' + GLYPH(n) + ' ' + esc(lab(n)) + '</button>').join('') + '</div>';
  $$('[data-cost]').forEach(b => b.onclick = () => go(+b.dataset.cost));
};
BC.cancel = () => { BC.mode = { type: 'move' }; $('#tip').hidden = true; App.R.setTargeted([]); BC.renderActions(); BC.drawMode(); };

/* ================= MODE DRAWING ================= */
BC.drawMode = () => {
  const R = App.R, B = BC.B, u = BC.cur, m = BC.mode;
  R.clearLayers(['move1', 'move2', 'move3', 'valid', 'area', 'hoverArea']); R.showPath(null); R.setTargeted([]);
  if (!m || !u || !BC.isPlayerTurn()) return;
  if (m.type === 'move' && !m.act) {
    if (B.immobile(u)) return;
    const sp = B.speedOf(u); const c1 = [], c2 = [], c3 = [];
    BC.P.best.forEach((c, k) => { const [x, y] = k.split(',').map(Number); if ((x === u.x && y === u.y) || !B.canEnd(u, x, y)) return; const n = Math.ceil(c / sp); (n <= 1 ? c1 : n === 2 ? c2 : c3).push([x, y]); });
    R.layer('move1', c1, '#4fa8e0', 0.26); R.layer('move2', c2, '#d6a84c', 0.2); R.layer('move3', c3, '#e07a3a', 0.16);
  } else if (m.type === 'move' || m.type === 'move2' || m.type === 'move+unit') {
    const P = B.paths(u, m.maxFt); m.P = P; const cells = [];
    P.best.forEach((c, k) => { const [x, y] = k.split(',').map(Number); if (B.canEnd(u, x, y)) cells.push([x, y]); });
    R.layer('move1', cells, m.type === 'move+unit' ? '#d6a84c' : '#4fa8e0', 0.24);
    if (m.type === 'move+unit') { const tg = B.foesOf(u).filter(f => f.hp > 0); R.setTargeted(tg.map(t => t.id)); }
  } else if (m.type === 'step' || m.type === 'step+unit') {
    const range = u.fx.some(f => f.key === 'stance' && f.stance === 'tiger') && m.type === 'step' ? 10 : 5;
    const P = B.paths(u, range, { noDifficult: true }); m.P = P; const cells = [];
    P.best.forEach((c, k) => { const [x, y] = k.split(',').map(Number); if ((x !== u.x || y !== u.y) && B.canEnd(u, x, y)) cells.push([x, y]); });
    R.layer('move1', cells, '#4fa8e0', 0.3);
    if (m.type === 'step+unit') R.setTargeted(B.foesOf(u).filter(f => f.hp > 0).map(t => t.id));
  } else if (m.type === 'unit' || m.type === 'spell') {
    const ids = B.units.filter(t => B.alive(t) && !BC.targetWhy(t)).map(t => t.id); R.setTargeted(ids);
    const cells = []; B.units.forEach(t => { if (ids.includes(t.id)) B.cellsOf(t).forEach(c => cells.push(c)); }); R.layer('valid', cells, '#e0524a', 0.22);
  } else if (m.type === 'tile') {
    const cells = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) if (B.distPt(u, x, y) <= (m.spell.range || 0) && B.canEnd(u, x, y)) cells.push([x, y]); R.layer('move1', cells, '#8f7cff', 0.2);
  }
};
// why a unit is not a valid target in the current mode ('' if valid)
BC.targetWhy = t => {
  const B = BC.B, u = BC.cur, m = BC.mode; if (!m) return 'No action';
  if (m.type === 'spell') {
    if (m.picked.includes(t.id)) return 'Already chosen';
    return B.validSpellTarget(u, m.cast, t, m.actions, u.turn.meta);
  }
  const a = m.act;
  if (a.id === 'strike') { const s = u.strikes.find(x => x.id === a.strike); if (t.team === u.team) return 'Target a foe'; const R = B.prepStrike(u, s, t); return R.ok ? '' : R.why; }
  if (B.A[a.id] && B.A[a.id].valid) return B.A[a.id].valid(u, t);
  if (a.id === 'medicine') return B.A.medicine.valid(u, t);
  return t.team === u.team ? 'Target a foe' : '';
};

/* ================= HOVER PREVIEW ================= */
const pct = x => Math.round(x * 100) + '%';
BC.rsAlong = (u, path) => {
  const B = BC.B; const names = []; const used = new Set(); const ox = u.x, oy = u.y;
  for (let i = 0; i < path.length - 1; i++) { u.x = path[i][0]; u.y = path[i][1]; B.units.forEach(r => { if (used.has(r.id) || r.team === u.team || !B.alive(r) || !(r.flags.reactiveStrike || (r.flags.disruptPrey && r.prey === u.id)) || !B.canReact(r, 'reactiveStrike')) return; if (B.inReach(r, u, B.reachOf(r))) { used.add(r.id); names.push(r.name); } }); }
  u.x = ox; u.y = oy; return names;
};
BC.tip = (html, cx, cy) => { const t = $('#tip'); if (!html) { t.hidden = true; return; } t.innerHTML = html; t.hidden = false; const W = G.innerWidth, H = G.innerHeight; const r = t.getBoundingClientRect(); let x = cx + 18, y = cy + 18; if (x + r.width > W - 8) x = cx - r.width - 18; if (y + r.height > H - 8) y = cy - r.height - 18; t.style.left = Math.max(4, x) + 'px'; t.style.top = Math.max(4, y) + 'px'; };
BC.strikeTip = (u, s, t, o) => {
  const B = BC.B; const pv = B.strikePreview(u, s, t, o || {});
  if (!pv.ok) return '<b>' + esc(t.name) + '</b><div class="warn">' + esc(pv.why) + '</div>';
  const atk = PF.sumMods(pv.atk), ac = PF.sumMods(pv.ac);
  const warn = [];
  if (pv.flat) warn.push('DC ' + pv.flat + ' flat check (' + pv.flatWhy + ')');
  if (s.kind === 'ranged') { const rs = B.units.filter(r => r.team !== u.team && B.alive(r) && r.flags.reactiveStrike && B.canReact(r, 'reactiveStrike') && B.inReach(r, u, B.reachOf(r))); if (rs.length) warn.push('Provokes Reactive Strike from ' + rs.map(r => r.name).join(', ')); }
  const spec = pv.spec;
  return '<div class="row2"><span class="big">' + pv.hitPct + '%</span><span>hit<br><b>' + pv.critPct + '%</b> crit</span></div>' +
    '<div><b>' + esc(s.name) + '</b> → ' + esc(t.name) + '</div>' +
    '<div class="num">' + App.sgn(pv.atkTotal) + ' vs AC ' + pv.acTotal + ' · avg ' + Math.round(pv.avgHit) + ' / crit ' + Math.round(pv.avgCrit) + '</div>' +
    '<div class="mods">atk: ' + esc(PF.modText(atk.used) || 'base') + '<br>AC: ' + esc(PF.modText(ac.used) || 'base') + (spec.prec.length ? '<br>+ ' + esc(spec.prec.map(p => U.dstr(p) + ' ' + p.s).join(', ')) : '') + '</div>' +
    warn.map(w => '<div class="warn">' + esc(w) + '</div>').join('');
};
BC.checkTip = (label, mod, dc, extra) => { const p = PF.pdeg(mod, dc); return '<div class="row2"><span class="big">' + pct(p[2] + p[3]) + '</span><span>success<br><b>' + pct(p[3]) + '</b> crit</span></div><div><b>' + esc(label) + '</b></div><div class="num">' + App.sgn(mod) + ' vs DC ' + dc + ' · crit fail ' + pct(p[0]) + '</div>' + (extra || ''); };
BC.saveTip = (t, kind, dc, name) => { const B = BC.B; const mod = B.stat(t, kind); const p = PF.pdeg(mod, dc); return '<div class="row2"><span class="big">' + pct(p[0] + p[1]) + '</span><span>fails<br><b>' + pct(p[0]) + '</b> crit fail</span></div><div><b>' + esc(name) + '</b> → ' + esc(t.name) + '</div><div class="num">' + ({ fort: 'Fortitude', ref: 'Reflex', will: 'Will' }[kind]) + ' ' + App.sgn(mod) + ' vs DC ' + dc + '</div>'; };
BC.unitTip = (t, cx, cy) => {
  const B = BC.B, u = BC.cur, m = BC.mode;
  if (!m || m.type === 'move' && !m.act) {
    const s = BC.disp[t.id] || B.snap(t);
    return BC.tip('<b>' + esc(t.name) + '</b> <span class="dim">' + (t.team === 'pc' ? 'Level ' : 'Creature ') + t.level + '</span><div class="num">HP ' + s.hp + '/' + s.maxHP + ' · AC ' + B.stat(t, 'ac') + '</div>' + (s.conds.length ? '<div class="mods">' + esc(s.conds.map(c => c.n).join(', ')) + '</div>' : '') + '<div class="dim" style="font-size:11px">Click to inspect</div>', cx, cy);
  }
  const why = BC.targetWhy(t);
  if (why) return BC.tip('<b>' + esc(t.name) + '</b><div class="warn">' + esc(why) + '</div>', cx, cy);
  const a = m.act;
  if (m.type === 'spell') {
    const sp = m.spell; let h = '';
    if (sp.atk) { const fake = { name: sp.name, kind: sp.melee ? 'melee' : 'ranged', traits: ['attack'], atk: { base: 0, item: 0 }, atkAttr: 'spell', range: sp.range, reach: 5, dmg: [{ n: 0, d: 0, m: 0, type: 'untyped' }] }; const R = B.prepStrike(u, fake, t, { spellAtk: true }); const p = PF.pdeg(R.atkTotal, R.acTotal); h = '<div class="row2"><span class="big">' + pct(p[2] + p[3]) + '</span><span>hit<br><b>' + pct(p[3]) + '</b> crit</span></div><div><b>' + esc(sp.name) + '</b> → ' + esc(t.name) + '</div><div class="num">spell attack ' + App.sgn(R.atkTotal) + ' vs AC ' + R.acTotal + '</div>' + (sp.dmg ? '<div class="mods">' + esc(sp.dmg(m.cast.rank, { adjacent: B.inReach(u, t, 5) }).map(d => U.dstr(d) + ' ' + d.type).join(' + ')) + '</div>' : ''); }
    else if (sp.save && t.team !== u.team) { h = BC.saveTip(t, sp.save, B.spellDC(u), sp.name) + (sp.dmg ? '<div class="mods">' + esc(sp.dmg(m.cast.rank, {}).map(d => U.dstr(d) + ' ' + d.type).join(' + ')) + (sp.basic ? ' (basic save)' : '') + '</div>' : ''); if (sp.incap && t.level > m.cast.rank * 2) h += '<div class="warn">Incapacitation: the target treats its save as one degree better.</div>'; }
    else h = '<b>' + esc(sp.name) + '</b> → ' + esc(t.name);
    if (m.need > 1) h += '<div class="dim" style="font-size:11px">Target ' + (m.picked.length + 1) + ' of ' + m.need + ' · Enter to cast early</div>';
    return BC.tip(h, cx, cy);
  }
  if (a.id === 'strike') return BC.tip(BC.strikeTip(u, u.strikes.find(x => x.id === a.strike), t), cx, cy);
  if (['trip', 'shove', 'grapple'].includes(a.id)) { const def = a.id === 'trip' ? 'ref' : 'fort'; return BC.tip(BC.checkTip(a.name + ' → ' + t.name, B.stat(u, 'skill:athletics') + B.mapPen(u, null, t), B.dcOf(t, def), '<div class="mods">Athletics vs ' + (def === 'ref' ? 'Reflex' : 'Fortitude') + ' DC</div>'), cx, cy); }
  if (a.id === 'demoralize') return BC.tip(BC.checkTip('Demoralize → ' + t.name, B.stat(u, 'skill:intimidation'), B.dcOf(t, 'will')), cx, cy);
  if (a.id === 'feint') return BC.tip(BC.checkTip('Feint → ' + t.name, B.stat(u, 'skill:deception'), B.dcOf(t, 'per')), cx, cy);
  if (a.id === 'bonMot') return BC.tip(BC.checkTip('Bon Mot → ' + t.name, B.stat(u, 'skill:diplomacy'), B.dcOf(t, 'will')), cx, cy);
  if (a.group === 'class' || a.group === 'monster') {
    const s = B.bestStrike(u, t, x => !['huntedShot', 'doubleShot', 'tripleShot', 'huntersAim'].includes(a.id) ? x.kind === 'melee' || a.id === 'skirmishStrike' : x.kind === 'ranged');
    if (s) { const o = a.id === 'huntersAim' ? { atkMods: [{ t: 'circ', v: 2, s: "hunter's aim" }], ignoreConceal: true } : a.id === 'viciousSwing' ? { extraDice: u.level >= 10 ? 2 : 1 } : a.id === 'lunge' ? { extraReach: 5 } : {}; return BC.tip('<div class="dim" style="font-size:11px">' + esc(a.name) + '</div>' + BC.strikeTip(u, s, t, o), cx, cy); }
  }
  return BC.tip('<b>' + esc(a.name) + '</b> → ' + esc(t.name), cx, cy);
};
BC.hover = (pk, cx, cy) => {
  const B = BC.B, R = App.R; if (!B) return;
  BC.lastHover = pk;
  if (BC.phase === 'deploy') { if (pk && pk.unit) BC.unitTip(B.get(pk.unit), cx, cy); else BC.tip(null); return; }
  if (!BC.isPlayerTurn()) { if (pk && pk.unit) { const t = B.get(pk.unit); BC.mode = BC.mode || null; const s = BC.disp[t.id] || B.snap(t); BC.tip('<b>' + esc(t.name) + '</b><div class="num">HP ' + s.hp + '/' + s.maxHP + ' · AC ' + B.stat(t, 'ac') + '</div>', cx, cy); } else BC.tip(null); return; }
  const u = BC.cur, m = BC.mode || { type: 'move' };
  R.showPath(null); R.clearLayer('hoverArea');
  if (!pk) { BC.tip(null); return; }
  const t = pk.unit ? B.get(pk.unit) : null;
  if ((m.type === 'unit' || m.type === 'spell') ) { if (t) BC.unitTip(t, cx, cy); else BC.tip(null); return; }
  if (m.type === 'move+unit' || m.type === 'step+unit') {
    if (!t || t.team === u.team) { BC.tip(null); return; }
    const plan = BC.planApproach(t); if (!plan) { BC.tip('<b>' + esc(t.name) + '</b><div class="warn">Can’t reach a striking position</div>', cx, cy); return; }
    if (plan.path && plan.path.length > 1) R.showPath(plan.path, '#d6a84c');
    const s = B.bestStrike(u, t, x => m.type === 'step+unit' || x.kind === 'melee' || (m.act.id === 'flyingKick' && x.traits.includes('unarmed')));
    const tipHtml = s ? (() => { const ox = u.x, oy = u.y; u.x = plan.dest[0]; u.y = plan.dest[1]; const h = BC.strikeTip(u, s, t); u.x = ox; u.y = oy; return h; })() : '';
    const rs = plan.path ? BC.rsAlong(u, plan.path) : [];
    BC.tip('<div class="dim" style="font-size:11px">' + esc(m.act.name) + '</div>' + tipHtml + (rs.length ? '<div class="warn">Moving provokes Reactive Strike from ' + esc(rs.join(', ')) + '</div>' : ''), cx, cy); return;
  }
  if (m.type === 'area') {
    const shape = m.shape; let p;
    if (shape.t === 'burst') { const gx = Math.round(pk.fx), gy = Math.round(pk.fy); p = { gx, gy }; } else p = { px: pk.fx, py: pk.fy };
    const cells = B.areaCells(u, shape, p); const origin = B.areaOrigin(u, shape, p);
    let bad = '';
    if (shape.t === 'burst') { const rng = shape.range || (m.spell && m.spell.area && m.spell.area.range) || 30; if (B.distPt(u, Math.min(p.gx, B.W - 1), Math.min(p.gy, B.H - 1)) > rng + 5) bad = 'Out of range (' + rng + ' ft)'; else if (B.trace(u, origin).blocked) bad = 'No line of effect'; }
    R.layer('hoverArea', cells, bad ? '#777' : '#ff6a2a', 0.55, { lift: 0.01 });
    const hit = B.unitsInCells(cells, origin).filter(x => !(x === u && shape.t !== 'burst'));
    const foes = hit.filter(x => x.team !== u.team), allies = hit.filter(x => x.team === u.team);
    BC.mode.areaP = p; BC.mode.areaBad = bad;
    const sp = m.spell; const dc = sp ? B.spellDC(u) : B.classDC(u); const kind = sp ? sp.save : 'ref';
    BC.tip('<b>' + esc(m.act.name) + '</b> · ' + shape.r + '-ft ' + shape.t + (bad ? '<div class="warn">' + esc(bad) + '</div>' : '') + (kind ? '<div class="num">DC ' + dc + ' ' + ({ fort: 'Fortitude', ref: 'Reflex', will: 'Will' }[kind] || '') + '</div>' : '') +
      (foes.length ? '<div class="mods">' + foes.map(f => esc(f.name) + (kind ? ' fails ' + pct(PF.pdeg(B.stat(f, kind), dc)[0] + PF.pdeg(B.stat(f, kind), dc)[1]) : '')).join('<br>') + '</div>' : '<div class="dim">No foes in the area</div>') +
      (allies.length ? '<div class="warn">Also hits ' + esc(allies.map(a => a.name).join(', ')) + '</div>' : ''), cx, cy);
    return;
  }
  // tile-based movement modes
  if (t && m.type === 'move' && !m.act) { BC.unitTip(t, cx, cy); return; }
  const P = (m.type === 'move' && !m.act) ? BC.P : m.P;
  if (!P) { BC.tip(null); return; }
  const path = B.pathFrom(P, pk.x, pk.y);
  if (!path || path.length < 2 || !B.canEnd(u, pk.x, pk.y)) { BC.tip(null); return; }
  if (m.type === 'tile') { BC.tip('<b>' + esc(m.spell.name) + '</b> here', cx, cy); return; }
  let segs = 1, label = m.act ? m.act.name : 'Stride';
  if (m.type === 'move' && !m.act) { segs = B.splitStrides(u, path, B.speedOf(u)).length; label = 'Stride' + (segs > 1 ? ' ×' + segs : ''); }
  const ft = P.best.get(pk.x + ',' + pk.y);
  const col = segs <= 1 ? '#7cc0ee' : segs === 2 ? '#e3b65a' : '#ee8a4a';
  R.showPath(path, col);
  const rs = (m.act && (m.act.id === 'mobility' || m.type === 'step')) ? [] : BC.rsAlong(u, path);
  const tl = B.tile(pk.x, pk.y);
  BC.tip('<b>' + GLYPH(m.act ? (m.act.costN || 1) : segs) + ' ' + esc(label) + '</b> <span class="num dim">' + ft + ' ft</span><div class="dim">' + esc((tl.obj ? PF.OBJ[tl.obj].name + ' · ' : '') + PF.TERR[tl.terr].name) + (tl.diff ? ' (difficult)' : '') + (tl.h ? ' · elevation ' + tl.h * 5 + ' ft' : '') + '</div>' + (rs.length ? '<div class="warn">Provokes Reactive Strike from ' + esc(rs.join(', ')) + '</div>' : '') + (tl.hazard ? '<div class="warn">Lava! Burns on entry and at end of turn.</div>' : ''), cx, cy);
};
// for charge / skirmish: best destination to strike target t
BC.planApproach = t => {
  const B = BC.B, u = BC.cur, m = BC.mode;
  const melee = s => m.type === 'step+unit' || s.kind === 'melee' || false;
  const canFrom = () => u.strikes.some(s => (m.type === 'step+unit' ? true : s.kind === 'melee') && (m.act.id !== 'flyingKick' || s.traits.includes('unarmed')) && B.prepStrike(u, s, t).ok);
  if (canFrom()) return { dest: [u.x, u.y], path: null };
  let best = null;
  m.P.best.forEach((c, k) => { const [x, y] = k.split(',').map(Number); if (!B.canEnd(u, x, y)) return; const ox = u.x, oy = u.y; u.x = x; u.y = y; const ok = canFrom(); const fl = ok && B.offGuardWhy(t, u) ? -3 : 0; u.x = ox; u.y = oy; if (ok && (!best || c + fl * 5 < best.c)) best = { c: c + fl * 5, dest: [x, y] }; });
  if (!best) return null;
  return { dest: best.dest, path: B.pathFrom(m.P, best.dest[0], best.dest[1]) };
};

/* ================= CLICK ================= */
BC.click = pk => {
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
  if (m.type === 'move' && !m.act) {
    if (t && t !== u) { BC.inspect(t); return; }
    if (t === u) { BC.inspect(u); return; }
    if (B.canEnd(u, pk.x, pk.y)) BC.act('move', { dest: [pk.x, pk.y] });
    return;
  }
  if (m.type === 'unit') { if (!t) return; const why = BC.targetWhy(t); if (why) { BC.flash(why); return; } BC.act(m.act.id, Object.assign({}, m.p, { target: t.id })); return; }
  if (m.type === 'spell') {
    if (!t) return; const why = BC.targetWhy(t); if (why) { BC.flash(why); return; }
    m.picked.push(t.id);
    if (m.picked.length >= m.need || !B.units.some(x => B.alive(x) && !BC.targetWhy(x))) BC.act('cast', Object.assign({}, m.p, { targets: m.picked }));
    else { BC.drawMode(); App.R.setTargeted(m.picked.concat(B.units.filter(x => B.alive(x) && !BC.targetWhy(x)).map(x => x.id))); }
    return;
  }
  if (m.type === 'move+unit' || m.type === 'step+unit') {
    if (!t || t.team === u.team) return; const plan = BC.planApproach(t); if (!plan) { BC.flash('Can’t reach a striking position'); return; }
    BC.act(m.act.id, Object.assign({}, m.p, { dest: plan.dest, target: t.id })); return;
  }
  if (m.type === 'area') { BC.hover(pk, 0, 0); if (BC.mode.areaBad) { BC.flash(BC.mode.areaBad); return; } BC.act(m.act.id === 'cast' ? 'cast' : m.act.id, Object.assign({}, m.p, BC.mode.areaP)); return; }
  if (m.type === 'move' || m.type === 'move2' || m.type === 'step' || m.type === 'tile') {
    if (!B.canEnd(u, pk.x, pk.y)) return;
    if (m.type === 'tile') return BC.act('cast', Object.assign({}, m.p, { x: pk.x, y: pk.y }));
    if (m.type === 'move2') return BC.act('cast', Object.assign({}, m.p, { dest: [pk.x, pk.y] }));
    const path = B.pathFrom(m.P, pk.x, pk.y); if (!path) return;
    return BC.act(m.act.id, Object.assign({}, m.p, { dest: [pk.x, pk.y] }));
  }
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
    lastMove = e; if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (App.screen === 'battle' && BC.B && lastMove) BC.hover(App.R.pick(lastMove.clientX, lastMove.clientY), lastMove.clientX, lastMove.clientY); });
  });
  cv.addEventListener('pointerup', e => {
    const d = down; down = null; if (!d) return;
    if (!d.moved && d.b === 0 && App.screen === 'battle') { const pk = App.R.pick(e.clientX, e.clientY); BC.click(pk); if (BC.B) BC.hover(pk, e.clientX, e.clientY); }
    if (!d.moved && d.b === 2 && App.screen === 'battle') BC.cancel();
  });
  cv.addEventListener('pointerleave', () => { $('#tip').hidden = true; });
  cv.addEventListener('wheel', e => { e.preventDefault(); App.R.zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  // touch pinch
  let pinch = null;
  cv.addEventListener('touchstart', e => { if (e.touches.length === 2) { const [a, b] = e.touches; pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); down = null; } }, { passive: true });
  cv.addEventListener('touchmove', e => { if (e.touches.length === 2 && pinch) { const [a, b] = e.touches; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); App.R.zoom(pinch / d); pinch = d; } }, { passive: true });
  cv.addEventListener('touchend', () => { pinch = null; }, { passive: true });
  document.addEventListener('keydown', e => {
    if (App.screen !== 'battle' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { BC.keys[k] = true; e.preventDefault(); return; }
    if (k === 'q') App.R.rotate(Math.PI / 4); if (k === 'e') App.R.rotate(-Math.PI / 4);
    if (k === 'escape') { if (!$('#spellbook').hidden) { $('#spellbook').hidden = true; BC.renderActions(); } else BC.cancel(); }
    if (k === ' ') { e.preventDefault(); if (BC.phase === 'deploy') BC.begin(); else BC.endTurn(); }
    if (k === 'enter' && BC.mode && BC.mode.type === 'spell' && BC.mode.picked.length) BC.act('cast', Object.assign({}, BC.mode.p, { targets: BC.mode.picked }));
    if (/^[0-9]$/.test(k) && BC.hot) { const i = (+k + 9) % 10; if (BC.hot[i]) BC.choose(BC.hot[i]); }
  });
  document.addEventListener('keyup', e => { BC.keys[e.key.toLowerCase()] = false; });
  G.addEventListener('blur', () => { BC.keys = {}; });
  $('#actionBar').addEventListener('click', e => { const b = e.target.closest('[data-akey]'); if (b) BC.choose(b.dataset.akey); });
  $('#spellbook').addEventListener('click', e => { const b = e.target.closest('[data-akey]'); if (b) BC.choose(b.dataset.akey); });
  $('#initBar').addEventListener('click', e => { const c = e.target.closest('[data-uid]'); if (!c || !BC.B) return; const u = BC.B.get(c.dataset.uid); App.R.focus(u.x + u.sq / 2, u.y + u.sq / 2); BC.inspect(u); });
  $('#btnBegin').onclick = () => BC.begin();
  $('#btnLeave').onclick = () => { BC.teardown(); App.show('setup'); };
  $('#btnLog').onclick = () => $('#logPanel').classList.toggle('closed');
  $('#btnHelp').onclick = () => { $('#helpPanel').hidden = !$('#helpPanel').hidden; };
  $('#btnHelpClose').onclick = () => { $('#helpPanel').hidden = true; };
  $('#autoParty').onchange = () => { if ($('#autoParty').checked && BC.isPlayerTurnRaw()) { BC.mode = null; App.R.clearLayers(); BC.advanceFromPlayer(); } };
  $('#animSpeed').onchange = () => { App.R.speed = +$('#animSpeed').value; };
  if (G.innerWidth < 760) $('#logPanel').classList.add('closed');
};
BC.isPlayerTurnRaw = () => BC.B && BC.cur && BC.B.cur === BC.cur && !BC.busy && BC.phase === 'battle' && !BC.B.over;
BC.advanceFromPlayer = async () => { const B = BC.B, u = BC.cur; BC.busy = true; B.aiTurn(u); await BC.play(); if (!B.over && B.cur === u) B.endTurn(u); await BC.play(); BC.busy = false; BC.advance(); };
})(typeof window !== 'undefined' ? window : globalThis);
