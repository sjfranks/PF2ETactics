/* ui_core.js — app shell: storage, home, skirmish setup, stat blocks, modal */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D, U = PF.U;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = U.esc;
const App = PF.App = { screen: 'home', prev: 'home' };
App.$ = $; App.$$ = $$;

/* ---------- storage ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};
App.store = store;
App.roster = store.get('tat.roster.v1', []);
App.saveRoster = () => store.set('tat.roster.v1', App.roster);
App.setup = Object.assign({ pl: 1, party: [], foes: [], map: 'chapel', threat: 'moderate', theme: 'any' }, store.get('tat.setup.v1', {}));
if (!App.setup.party.length) App.setup.party = ['valeros', 'kyra', 'ezren', 'merisiel'].map(id => ({ ref: 'iconic:' + id, ai: false }));
if (!App.setup.foes.length) App.setup.foes = D.presets[0].foes.map(id => ({ id, adj: null }));
App.saveSetup = () => store.set('tat.setup.v1', { pl: App.setup.pl, party: App.setup.party, foes: App.setup.foes.filter(f => D.creatures[f.id] && !D.creatures[f.id].generated), map: App.setup.map, threat: App.setup.threat, theme: App.setup.theme });

/* ---------- helpers ---------- */
App.CLSC = { fighter: '#b9c4cf', rogue: '#a08bc6', ranger: '#94b56c', barbarian: '#d68a5a', champion: '#e6c870', monk: '#e39d4c', bard: '#c97fd0', cleric: '#f0d896', wizard: '#72a8e6', sorcerer: '#e36d6a', druid: '#7cc38d' };
App.badge = (cls, letter, foe) => '<div class="badge' + (foe ? ' foe' : '') + '" style="' + (foe ? '' : 'background:' + (App.CLSC[cls] || '#999')) + '">' + esc(letter) + '</div>';
App.resolveRef = (ref, L) => {
  const [kind, id] = ref.split(':');
  if (kind === 'iconic') return PF.Build.iconic(id, L);
  const c = App.roster.find(r => r.uid === id); if (!c) return null;
  return Object.assign(U.clone(c), { level: L });
};
App.refName = ref => { const [k, id] = ref.split(':'); if (k === 'iconic') return D.iconics[id] ? D.iconics[id].name : id; const c = App.roster.find(r => r.uid === id); return c ? c.name : '(deleted)'; };
App.sheetFor = (ref, L) => { const d = App.resolveRef(ref, L); if (!d) return null; try { return PF.Build.make(d); } catch (e) { console.error(e); return null; } };
App.sgn = n => (n >= 0 ? '+' : '−') + Math.abs(n);
App.show = name => {
  $$('.screen').forEach(s => { s.hidden = s.id !== name; });
  if (name !== App.screen) App.prev = App.screen;
  App.screen = name;
  if (name === 'home' || name === 'setup' || name === 'roster') App.showDiorama();
  if (name === 'setup') App.renderSetup();
  if (name === 'roster') App.renderRoster();
};

/* ---------- modal ---------- */
App.modal = (html, onBind) => { const m = $('#modal'); $('#modalCard').innerHTML = html; m.hidden = false; if (onBind) onBind($('#modalCard')); };
App.closeModal = () => { $('#modal').hidden = true; };
document.addEventListener('click', e => { if (e.target.id === 'modal') App.closeModal(); });

/* ---------- stat blocks ---------- */
const traitHTML = list => '<div class="traits">' + list.map(t => '<span class="trait">' + esc(t) + '</span>').join('') + '</div>';
const strikeLine = (s, L) => {
  const b = (s.atk ? s.atk.base + s.atk.item : s.bonus);
  const dmg = (s.dmg || []).map(d => U.dstr(d) + ' ' + d.type).join(' plus ');
  return '<div class="line"><b>' + (s.kind === 'melee' ? 'Melee' : 'Ranged') + '</b> ◆ ' + esc(s.name) + ' <span class="num">' + App.sgn(b) + '</span>' + (s.traits && s.traits.length ? ' <span class="dim">(' + esc(s.traits.join(', ')) + (s.reach > 5 ? ', reach ' + s.reach + ' ft' : '') + (s.range ? ', range ' + s.range + ' ft' : '') + ')</span>' : (s.range ? ' <span class="dim">(range ' + s.range + ' ft)</span>' : '')) + ', <b>Damage</b> ' + esc(dmg) + '</div>';
};
App.creatureBlock = (c, adj) => {
  const x = D.adjustCreature(c, adj);
  const abil = (x.abil || []).map(a => D.abilities[a]).filter(Boolean);
  let h = '<div class="sb"><h3>' + esc(x.name) + ' <span class="dim">· Creature ' + x.lvl + '</span></h3>';
  h += traitHTML([x.size].concat(x.traits));
  h += '<div class="stats"><div class="stat"><small>AC</small><b>' + x.ac + '</b></div><div class="stat"><small>HP</small><b>' + x.hp + '</b></div><div class="stat"><small>Fort</small><b>' + App.sgn(x.fort) + '</b></div><div class="stat"><small>Ref</small><b>' + App.sgn(x.ref) + '</b></div><div class="stat"><small>Will</small><b>' + App.sgn(x.will) + '</b></div><div class="stat"><small>Perc</small><b>' + App.sgn(x.per) + '</b></div></div>';
  h += '<div class="line"><b>Speed</b> ' + Object.entries(x.speed).map(([k, v]) => (k === 'land' ? '' : k + ' ') + v + ' ft').join(', ') + '</div>';
  if (Object.keys(x.skills || {}).length) h += '<div class="line"><b>Skills</b> ' + Object.entries(x.skills).map(([k, v]) => U.cap(k) + ' ' + App.sgn(v)).join(', ') + '</div>';
  if (x.immune && x.immune.length) h += '<div class="line"><b>Immunities</b> ' + esc(x.immune.join(', ')) + '</div>';
  if (Object.keys(x.resist || {}).length) h += '<div class="line"><b>Resistances</b> ' + Object.entries(x.resist).map(([k, v]) => k + ' ' + v).join(', ') + '</div>';
  if (Object.keys(x.weak || {}).length) h += '<div class="line"><b>Weaknesses</b> ' + Object.entries(x.weak).map(([k, v]) => k + ' ' + v).join(', ') + '</div>';
  h += '<hr>';
  x.strikes.forEach(s => { h += strikeLine(s); if (s.eff && s.eff.length) h += '<div class="line dim" style="padding-left:14px">Plus ' + esc(s.eff.map(e => e.replace(/(\d+)$/, ' DC $1').replace('persistFire1', '1 persistent fire').replace('splash1', '1 fire splash')).join(', ')) + '</div>'; });
  if (x.spells) h += '<div class="line"><b>' + U.cap(x.spells.trad) + ' Innate Spells</b> DC ' + x.spells.dc + ', attack ' + App.sgn(x.spells.atk) + '; ' + x.spells.list.map(s => esc(D.spells[s.id].name) + ' (' + s.uses + '/battle)').join(', ') + '; <b>Cantrips</b> ' + x.spells.cantrips.map(id => esc(D.spells[id].name)).join(', ') + '</div>';
  abil.forEach(a => { h += '<div class="line"><b>' + esc(a.name) + '</b>' + (a.dc ? ' (DC ' + (a.dc + (x.abilDC || 0)) + ')' : '') + (a.dmg ? ' ' + a.dmg + ' ' + a.type + ', ' + a.area.r + '-foot ' + a.area.t : '') + '</div>'; });
  if (x.desc) h += '<p class="desc">' + esc(x.desc) + '</p>';
  return h + '</div>';
};
App.sheetBlock = S => {
  const ac = S.ac.base + S.ac.item;
  const R = PF.RANKN;
  let h = '<div class="sb"><h3>' + esc(S.name) + ' <span class="dim">· Level ' + S.level + '</span></h3>';
  h += '<div class="sub">' + esc([S.herName || S.ancName, S.bgName, S.clsName + (S.subName ? ' (' + S.subName + ')' : '')].join(' · ')) + '</div>';
  h += '<div class="stats">' + [['HP', S.maxHP], ['AC', ac], ['Fort', App.sgn(S.saves.fort.base + S.saves.fort.item)], ['Ref', App.sgn(S.saves.ref.base + S.saves.ref.item)], ['Will', App.sgn(S.saves.will.base + S.saves.will.item)], ['Perc', App.sgn(S.per.base)], ['Speed', S.speed], ['Class DC', S.classDC]].concat(S.spellDC ? [['Spell DC', S.spellDC]] : []).map(([k, v]) => '<div class="stat"><small>' + k + '</small><b>' + v + '</b></div>').join('') + '</div>';
  h += '<div class="line"><b>Attributes</b> <span class="num">' + PF.ATTR.map(a => a.toUpperCase() + ' ' + App.sgn(S.attr[a])).join(' · ') + '</span></div>';
  h += '<div class="line"><b>Gear</b> ' + esc(S.armor.name) + (S.shield ? ', ' + esc(S.shield.name) + ' (hardness ' + S.shield.hard + ')' : '') + (S.runes.pot ? ', +' + S.runes.pot + ' weapon potency' : '') + (S.runes.str ? ', ' + ['', 'striking', 'greater striking', 'major striking'][S.runes.str] : '') + (S.runes.arm ? ', +' + S.runes.arm + ' armor' : '') + (S.runes.res ? ', ' + ['', 'resilient', 'greater resilient', 'major resilient'][S.runes.res] : '') + ', ' + esc((D.potions[S.potion] || {}).name || '') + '</div>';
  h += '<div class="line"><b>Skills</b> ' + Object.keys(S.skills).filter(k => S.skills[k] > 0).map(k => U.cap(k) + ' ' + App.sgn(S.sk[k].base) + ' <span class="dim">' + PF.RANK[S.skills[k]] + '</span>').join(', ') + '</div>';
  h += '<div class="line"><b>Proficiency</b> <span class="dim">' + ['per', 'fort', 'ref', 'will', 'simple', 'martial', 'unarmored', 'light', 'medium', 'heavy', 'spell', 'classDC'].filter(k => S.prof[k]).map(k => ({ per: 'Perception', fort: 'Fort', ref: 'Ref', will: 'Will', classDC: 'Class DC', spell: 'Spells' }[k] || U.cap(k)) + ' ' + PF.RANK[S.prof[k]]).join(', ') + '</span></div>';
  h += '<hr>';
  S.strikes.forEach(s => { h += strikeLine(s); });
  const feats = S.feats.filter(f => f.id);
  if (feats.length) h += '<div class="line"><b>Feats</b> ' + feats.map(f => esc(f.name) + ' <span class="dim">' + f.lvl + '</span>').join(', ') + '</div>';
  const feat = D.classes[S.cls].features.filter(([l]) => l <= S.level).map(([, id]) => D.feats[id] ? D.feats[id].name : id);
  h += '<div class="line"><b>Class features</b> ' + esc(feat.join(', ')) + '</div>';
  if (S.spells) {
    const sp = S.spells;
    h += '<div class="line"><b>' + U.cap(sp.trad) + ' ' + (sp.kind === 'prepared' ? 'prepared' : 'spontaneous') + ' spells</b> DC ' + sp.dc + ', attack ' + App.sgn(sp.atk) + '</div>';
    const byR = {};
    (sp.kind === 'prepared' ? sp.prepared : sp.rep).forEach(e => { (byR[e.rank] = byR[e.rank] || []).push(D.spells[e.id].name); });
    Object.keys(byR).sort((a, b) => b - a).forEach(r => { h += '<div class="line" style="padding-left:10px"><b>' + PF.ordinal(+r) + '</b> ' + (sp.slots && sp.slots[r] ? '(' + sp.slots[r].max + ' slots) ' : '') + esc(byR[r].join(', ')) + '</div>'; });
    h += '<div class="line" style="padding-left:10px"><b>Cantrips (' + PF.ordinal(sp.cantripRank) + ')</b> ' + esc(sp.cantrips.map(id => D.spells[id].name).join(', ')) + '</div>';
    if (sp.font) h += '<div class="line" style="padding-left:10px"><b>Divine font</b> ' + sp.font.max + ' × ' + D.spells[sp.font.id].name + ' (' + PF.ordinal(sp.font.rank) + ')</div>';
    if (sp.sig && sp.sig.length) h += '<div class="line" style="padding-left:10px"><b>Signature</b> ' + esc(sp.sig.map(id => D.spells[id].name).join(', ')) + '</div>';
  }
  if (S.comps && S.comps.length) h += '<div class="line"><b>Compositions</b> ' + esc(S.comps.map(id => D.spells[id].name).join(', ')) + '</div>';
  if (S.focus && S.focus.max) h += '<div class="line"><b>Focus spells</b> (' + S.focus.max + ' Focus Points) ' + esc(S.focus.spells.map(id => D.spells[id] ? D.spells[id].name : id).join(', ')) + '</div>';
  return h + '</div>';
};
PF.ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)] || 'th');

/* ---------- minimap ---------- */
App.drawMinimap = (cv, mapId) => {
  const m = D.maps[mapId]; const B = PF.Battle({ map: mapId, pcs: [], foes: [] });
  const s = 6; cv.width = B.W * s; cv.height = B.H * s; const g = cv.getContext('2d');
  const base = { grass: '#5b7340', dirt: '#7b6747', stone: '#6f6c66', cave: '#4b4641', ash: '#3f3a37' }[m.base] || '#5b7340';
  const TC = { ',': '#8a7354', ':': '#87847b', '=': '#7a5a37', '+': '#a39e94', 'R': '#7c4434', 'r': '#77726a', ';': '#3f6a2a', '~': '#4d3d2a', 'w': '#3f7a96', 'W': '#22445a', 'L': '#e2561c', 'F': '#9aa6ab', '_': '#1d1b19' };
  const OC = { '#': '#c9c2b4', 'P': '#bdb5a5', 'T': '#2c4a20', 's': '#a8a39a', 'c': '#a27a44', 'b': '#7a5634', 'f': '#a49d90', 'o': '#8a857c', 'S': '#b0a99a', 'A': '#d8cfb6', 't': '#8a6440' };
  for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
    const t = B.tile(x, y); let c = OC[t.obj] || TC[t.terr] || base;
    g.fillStyle = c; g.fillRect(x * s, y * s, s, s);
    if (t.h > 0 && !t.obj) { g.fillStyle = 'rgba(255,255,255,' + Math.min(0.28, t.h * 0.07) + ')'; g.fillRect(x * s, y * s, s, s); }
  }
  g.fillStyle = 'rgba(88,174,228,.45)'; B.zone.pc.forEach(([x, y]) => g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2));
  g.fillStyle = 'rgba(226,87,78,.45)'; B.zone.foe.forEach(([x, y]) => g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2));
};

/* ---------- setup screen ---------- */
App.partyDefs = () => App.setup.party.map(p => { const d = App.resolveRef(p.ref, App.setup.pl); if (d) d.ai = p.ai; return d; }).filter(Boolean);
App.xpInfo = () => {
  const pl = App.setup.pl, n = Math.max(1, App.setup.party.length);
  const xp = D.encounterXP(App.setup.foes.filter(f => D.creatures[f.id]), pl);
  const th = PF.threatFor(xp, n);
  return { xp, th, n, pl };
};
App.renderSetup = () => {
  const S = App.setup;
  $('#plVal').textContent = S.pl;
  // presets
  $('#presetList').innerHTML = D.presets.map(p => '<button class="preset" data-preset="' + p.id + '"><b>' + esc(p.name) + '</b><span>Party level ' + p.pl + ' · ' + esc(D.maps[p.map].name) + '</span><span>' + esc(p.desc) + '</span></button>').join('');
  // party
  const pl = S.pl;
  $('#partyList').innerHTML = S.party.length ? S.party.map((p, i) => {
    const sh = App.sheetFor(p.ref, pl); if (!sh) return '';
    const st = sh.strikes[0];
    return '<div class="item">' + App.badge(sh.cls, sh.clsName.charAt(0)) + '<div class="meta"><b>' + esc(sh.name) + '</b><span>' + esc(sh.ancName + ' ' + sh.clsName + (sh.subName ? ' (' + sh.subName + ')' : '')) + '</span><span class="num">HP ' + sh.maxHP + ' · AC ' + (sh.ac.base + sh.ac.item) + (st ? ' · ' + esc(st.name) + ' ' + App.sgn(st.atk.base + st.atk.item) : '') + (sh.spellDC ? ' · DC ' + sh.spellDC : '') + '</span></div><div class="ctl"><label title="Let the AI control this hero"><input type="checkbox" data-ai="' + i + '"' + (p.ai ? ' checked' : '') + '> AI</label><button class="btn tiny ghost" data-view="' + i + '" title="View sheet">Sheet</button><button class="x" data-rm="' + i + '" aria-label="Remove">×</button></div></div>';
  }).join('') : '<div class="empty">No heroes yet. Add up to six.</div>';
  // xp
  const xi = App.xpInfo();
  const maxB = xi.th.budgets[4] * 1.25;
  $('#xpLabel').textContent = xi.th.label + ' · ' + xi.xp + ' XP';
  $('#xpBar').innerHTML = '<div class="fill" style="width:' + Math.min(100, xi.xp / maxB * 100) + '%"></div>' + PF.THREATS.map((t, i) => i === 0 ? '' : '<div class="tick" style="left:' + (xi.th.budgets[i] / maxB * 100) + '%" title="' + t.name + ' ' + xi.th.budgets[i] + ' XP"><span>' + t.name.slice(0, 3) + ' ' + xi.th.budgets[i] + '</span></div>').join('');
  // foes
  $('#foeList').innerHTML = S.foes.length ? S.foes.map((f, i) => {
    const c0 = D.creatures[f.id]; if (!c0) return '';
    const c = D.adjustCreature(c0, f.adj); const xp = PF.creatureXP(c.lvl, pl);
    return '<div class="item">' + App.badge('', c0.name.charAt(0), true) + '<div class="meta"><b>' + esc(c.name) + '</b><span class="num">Level ' + c.lvl + ' · AC ' + c.ac + ' · HP ' + c.hp + ' · ' + (c.lvl - pl > 4 ? 'beyond the table' : xp + ' XP') + '</span></div><div class="ctl"><div class="seg" role="group" aria-label="Adjustment">' + [['weak', 'Weak'], [null, '—'], ['elite', 'Elite']].map(([a, l]) => '<button data-adj="' + i + ':' + (a || '') + '" class="' + (f.adj === a ? 'on' : '') + '">' + l + '</button>').join('') + '</div><button class="btn tiny ghost" data-fview="' + i + '">Stats</button><button class="x" data-frm="' + i + '" aria-label="Remove">×</button></div></div>';
  }).join('') : '<div class="empty">No opposition. Add creatures from the bestiary or generate an encounter.</div>';
  App.renderBestiary();
  // maps
  const ml = $('#mapList');
  if (!ml.dataset.built) {
    ml.innerHTML = D.mapOrder.map(id => '<button class="mapcard" data-map="' + id + '"><canvas></canvas><b>' + esc(D.maps[id].name) + '</b><span>' + esc(D.maps[id].desc) + '</span></button>').join('');
    $$('.mapcard', ml).forEach(b => App.drawMinimap($('canvas', b), b.dataset.map));
    ml.dataset.built = '1';
  }
  $$('.mapcard', ml).forEach(b => b.classList.toggle('on', b.dataset.map === S.map));
  $('#genThreat').value = S.threat; $('#genTheme').value = S.theme;
  App.saveSetup();
};
App.themes = () => { const s = new Set(); Object.values(D.creatures).forEach(c => (c.theme || []).forEach(t => s.add(t))); return ['any'].concat([...s].sort()); };
App.renderBestiary = () => {
  const q = ($('#bSearch').value || '').toLowerCase(); const th = $('#bTheme').value || 'any'; const pl = App.setup.pl;
  const list = Object.values(D.creatures).filter(c => (!q || c.name.toLowerCase().includes(q) || c.traits.join(' ').includes(q)) && (th === 'any' || (c.theme || []).includes(th) || (th === 'custom' && c.generated)))
    .sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name));
  $('#bList').innerHTML = list.map(c => { const xp = PF.creatureXP(c.lvl, pl); const d = c.lvl - pl; return '<div class="brow"><div class="lv">' + c.lvl + '</div><div class="nm">' + esc(c.name) + '<small>' + esc(c.size + ' ' + c.traits.slice(0, 2).join(' ')) + '</small></div><span class="xp' + (d < -4 || d > 4 ? ' off' : '') + '">' + (d < -4 ? 'trivial' : d > 4 ? 'too strong' : xp + ' XP') + '</span><span class="row gap"><button class="btn tiny ghost" data-binfo="' + c.id + '">i</button><button class="btn tiny" data-badd="' + c.id + '" aria-label="Add ' + esc(c.name) + '">+</button></span></div>'; }).join('');
};
App.loadPreset = id => {
  const p = D.presets.find(x => x.id === id); if (!p) return;
  App.setup.pl = p.pl; App.setup.map = p.map; App.setup.foes = p.foes.map(f => ({ id: f, adj: null }));
  if (!App.setup.party.length) App.setup.party = ['valeros', 'kyra', 'ezren', 'merisiel'].map(id => ({ ref: 'iconic:' + id, ai: false }));
  App.renderSetup();
};
App.pickHero = () => {
  const ic = D.iconicOrder.map(id => ({ ref: 'iconic:' + id, d: D.iconics[id] }));
  const cu = App.roster.map(c => ({ ref: 'custom:' + c.uid, d: c }));
  const card = (r) => { const cls = D.classes[r.d.cls]; return '<button class="rchar" data-pick="' + r.ref + '">' + App.badge(r.d.cls, cls.name.charAt(0)) + '<div><b>' + esc(r.d.name) + '</b><span>' + esc(D.ancestries[r.d.anc].name + ' ' + cls.name) + '</span></div></button>'; };
  App.modal('<h3>Add a hero</h3><div class="label">Iconics</div><div class="pick">' + ic.map(card).join('') + '</div><div class="label">Your characters</div>' + (cu.length ? '<div class="pick">' + cu.map(card).join('') + '</div>' : '<div class="empty">None yet. Build one on the Characters screen.</div>') + '<div class="row gap"><button class="btn" id="mRandom">Random hero</button><button class="btn ghost" id="mClose">Close</button></div>', el => {
    $$('[data-pick]', el).forEach(b => b.onclick = () => { if (App.setup.party.length >= 6) return; App.setup.party.push({ ref: b.dataset.pick, ai: false }); App.closeModal(); App.renderSetup(); });
    $('#mRandom', el).onclick = () => { const d = PF.Build.random(App.setup.pl); d.uid = U.uid('c'); delete d.level; App.roster.push(d); App.saveRoster(); App.setup.party.push({ ref: 'custom:' + d.uid, ai: false }); App.closeModal(); App.renderSetup(); };
    $('#mClose', el).onclick = App.closeModal;
  });
};
App.bindSetup = () => {
  $('#plUp').onclick = () => { App.setup.pl = Math.min(20, App.setup.pl + 1); App.renderSetup(); };
  $('#plDown').onclick = () => { App.setup.pl = Math.max(1, App.setup.pl - 1); App.renderSetup(); };
  $('#btnAddHero').onclick = App.pickHero;
  $('#btnIconicParty').onclick = () => { App.setup.party = ['valeros', 'kyra', 'ezren', 'merisiel'].map(id => ({ ref: 'iconic:' + id, ai: false })); App.renderSetup(); };
  $('#genTheme').innerHTML = App.themes().map(t => '<option value="' + t + '">' + (t === 'any' ? 'Any theme' : U.cap(t)) + '</option>').join('');
  $('#bTheme').innerHTML = App.themes().concat(['custom']).map(t => '<option value="' + t + '">' + (t === 'any' ? 'All creatures' : U.cap(t)) + '</option>').join('');
  $('#cRole').innerHTML = Object.entries(D.roles).map(([k, r]) => '<option value="' + k + '">' + r.name + '</option>').join('');
  $('#cFlavor').innerHTML = Object.entries(D.flavors).map(([k, r]) => '<option value="' + k + '">' + r.name + '</option>').join('');
  $('#bSearch').oninput = App.renderBestiary; $('#bTheme').onchange = App.renderBestiary;
  $('#btnGen').onclick = () => { App.setup.threat = $('#genThreat').value; App.setup.theme = $('#genTheme').value; App.setup.foes = D.autoEncounter(App.setup.pl, App.setup.threat, Math.max(1, App.setup.party.length), App.setup.theme); App.renderSetup(); };
  $('#btnClearFoes').onclick = () => { App.setup.foes = []; App.renderSetup(); };
  $('#btnCustom').onclick = () => { const c = D.makeCreature({ level: +$('#cLvl').value || 1, role: $('#cRole').value, flavor: $('#cFlavor').value }); App.setup.foes.push({ id: c.id, adj: null }); App.renderSetup(); };
  $('#setup').addEventListener('click', e => {
    const t = e.target.closest('button,input'); if (!t) return;
    const d = t.dataset;
    if (d.preset) App.loadPreset(d.preset);
    if (d.rm != null) { App.setup.party.splice(+d.rm, 1); App.renderSetup(); }
    if (d.view != null) { const sh = App.sheetFor(App.setup.party[+d.view].ref, App.setup.pl); App.modal(App.sheetBlock(sh) + '<button class="btn" onclick="PF.App.closeModal()">Close</button>'); }
    if (d.ai != null) { App.setup.party[+d.ai].ai = t.checked; App.saveSetup(); }
    if (d.frm != null) { App.setup.foes.splice(+d.frm, 1); App.renderSetup(); }
    if (d.adj) { const [i, a] = d.adj.split(':'); App.setup.foes[+i].adj = a || null; App.renderSetup(); }
    if (d.fview != null) { const f = App.setup.foes[+d.fview]; App.modal(App.creatureBlock(D.creatures[f.id], f.adj) + '<button class="btn" onclick="PF.App.closeModal()">Close</button>'); }
    if (d.binfo) App.modal(App.creatureBlock(D.creatures[d.binfo]) + '<div class="row gap"><button class="btn primary" id="mAdd">Add to encounter</button><button class="btn ghost" onclick="PF.App.closeModal()">Close</button></div>', el => { $('#mAdd', el).onclick = () => { App.setup.foes.push({ id: d.binfo, adj: null }); App.closeModal(); App.renderSetup(); }; });
    if (d.badd) { App.setup.foes.push({ id: d.badd, adj: null }); App.renderSetup(); }
    if (d.map) { App.setup.map = d.map; App.renderSetup(); App.showDiorama(d.map); }
  });
  $('#btnDeploy').onclick = () => {
    if (!App.setup.party.length) { App.toast('Add at least one hero.'); return; }
    if (!App.setup.foes.length) { App.toast('Add at least one creature.'); return; }
    App.startBattle({ map: App.setup.map, partyLevel: App.setup.pl, pcs: App.partyDefs(), foes: App.setup.foes.map(f => ({ id: f.id, adj: f.adj })) });
  };
};
App.toast = msg => { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(App._tt); App._tt = setTimeout(() => { t.hidden = true; }, 1800); };

/* ---------- diorama (home / setup background) ---------- */
App.showDiorama = mapId => {
  if (!App.R) return;
  const id = mapId || (App.screen === 'home' ? 'chapel' : App.setup.map);
  if (App.dioramaMap === id && !App.B) return;
  if (App.B && App.screen !== 'battle') { App.B = null; App.Battle && App.Battle.teardown(); }
  App.dioramaMap = id;
  const B = PF.Battle({ map: id, pcs: [], foes: [] });
  App.R.loadMap(B);
  App.R.cam.gdist = 30; App.R.cam.gpitch = 0.85;
};

/* ---------- boot ---------- */
App.boot = () => {
  if (!G.THREE) { document.getElementById('app').innerHTML = '<div style="padding:24px">The 3D engine (three.js) could not be loaded. Check your connection and reload.</div>'; return; }
  App.R = PF.Render($('#stage'));
  App.R.onFrame = dt => { if (App.screen !== 'battle') App.R.cam.gyaw += dt * 0.06; if (App.Battle && App.screen === 'battle') App.Battle.frame(dt); };
  App.bindSetup();
  App.bindRoster && App.bindRoster();
  App.Battle && App.Battle.bind();
  $('#btnQuick').onclick = () => {
    const p = U.pick(D.presets.filter(x => x.id !== 'training'));
    App.setup.pl = p.pl; App.setup.map = p.map; App.setup.foes = p.foes.map(id => ({ id, adj: null }));
    App.setup.party = ['valeros', 'kyra', 'ezren', 'merisiel'].map(id => ({ ref: 'iconic:' + id, ai: false })); App.saveSetup();
    App.startBattle({ map: p.map, partyLevel: p.pl, pcs: App.partyDefs(), foes: p.foes.map(id => ({ id })), title: p.name });
  };
  $('#btnSetup').onclick = () => App.show('setup');
  $('#btnRoster').onclick = () => App.show('roster');
  $$('[data-go]').forEach(b => b.onclick = () => App.show(b.dataset.go === 'back' ? (App.prev === 'roster' ? 'home' : App.prev || 'home') : b.dataset.go));
  App.show('home');
  App.showDiorama('chapel');
};
})(typeof window !== 'undefined' ? window : globalThis);
