/* ui_builder.js — roster list and stepped character builder with a sticky live sheet */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D, U = PF.U, App = PF.App;
const $ = App.$, $$ = App.$$, esc = U.esc, ico = App.icon;

App.edit = null; // {def, level, uid|null, iconic|null}
const opt = (v, label, sel) => '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(label) + '</option>';
const field = (label, inner, title) => '<label class="field"' + (title ? ' title="' + esc(title) + '"' : '') + '><span>' + label + '</span>' + inner + '</label>';
const STEPS = [['anc', 'Ancestry'], ['bg', 'Background'], ['cls', 'Class'], ['attr', 'Attributes'], ['feats', 'Feats'], ['spells', 'Spells'], ['gear', 'Gear'], ['mini', 'Miniature']];
const sec = (id, n, title, sub, body) => '<section class="fsec" id="bs-' + id + '" data-step="' + id + '"><h4><i>' + String(n).padStart(2, '0') + '</i>' + title + (sub ? ' <small>' + sub + '</small>' : '') + '</h4>' + body + '</section>';

App.newDef = () => ({ uid: U.uid('c'), name: 'New Hero', anc: 'human', her: 'versatileHuman', bg: 'warrior', cls: 'fighter', sub: null, attrs: D.classes.fighter.def.attrs.slice(), weapon: 'longsword', ranged: 'javelin', armor: 'chainmail', shield: 'steel', feats: {}, look: { body: '#6c7a8c', trim: '#c8a24a', acc: 'helm' } });
App.openEdit = (kind, id) => {
  if (kind === 'iconic') { if (!D.iconics[id]) return; App.edit = { def: Object.assign(U.clone(D.iconics[id]), { feats: {} }), level: App.edit ? App.edit.level : App.setup.pl, uid: null, iconic: id }; }
  else if (kind === 'custom') { const c = App.roster.find(r => r.uid === id); if (!c) return; App.edit = { def: U.clone(c), level: App.edit ? App.edit.level : App.setup.pl, uid: id, iconic: null }; }
  else { const d = kind === 'random' ? Object.assign(PF.Build.random(App.setup.pl), { uid: U.uid('c'), feats: {} }) : App.newDef(); delete d.level; App.edit = { def: d, level: App.setup.pl, uid: null, iconic: null, fresh: true }; }
  App.renderRoster();
};
App.renderRoster = () => {
  if (!App.edit) App.openEdit('iconic', D.iconicOrder[0]);
  const E = App.edit;
  const row = (kind, id, d) => { const cls = D.classes[d.cls]; const on = (kind === 'iconic' && E.iconic === id) || (kind === 'custom' && E.uid === id); return '<button class="rchar' + (on ? ' on' : '') + '" data-open="' + kind + ':' + id + '">' + App.emblem({ cls: d.cls }) + '<div><b>' + esc(d.name) + '</b><span>' + esc(D.ancestries[d.anc].name + ' ' + cls.name) + '</span></div></button>'; };
  $('#rosterList').innerHTML = '<div class="sec-label">Your characters</div>' + (App.roster.length ? App.roster.map(c => row('custom', c.uid, c)).join('') : '<div class="empty">Nothing saved yet.</div>') + '<div class="sec-label">Pregenerated heroes</div>' + D.iconicOrder.filter(id => D.iconics[id]).map(id => row('iconic', id, D.iconics[id])).join('');
  App.renderForm();
};
App.renderForm = () => {
  const E = App.edit; const d = E.def; const L = E.level;
  let S; try { S = PF.Build.make(Object.assign({}, d, { level: L })); } catch (e) { console.error(e); $('#buildForm').innerHTML = '<div class="empty">This build could not be computed: ' + esc(e.message) + '</div>'; return; }
  const cls = D.classes[d.cls];
  let h = '';
  h += '<div class="bf-head"><h3><small>' + (E.iconic ? 'Pregenerated hero' : E.uid ? 'Your character' : 'New character') + '</small>' + esc(d.name) + '</h3>' +
    (E.iconic ? '<button class="btn primary" data-act="saveCopy">' + ico('copy', 16) + ' Save as my copy</button>' : '<button class="btn primary" data-act="save">' + ico('save', 16) + ' ' + (E.uid ? 'Save changes' : 'Save character') + '</button>') +
    '<button class="btn" data-act="toParty">' + ico('plus', 16) + ' Add to party</button>' + (E.uid ? '<button class="btn ghost danger" data-act="del">' + ico('trash', 16) + ' Delete</button>' : '') + '</div>';
  h += '<nav class="bf-steps" aria-label="Builder steps">' + STEPS.map(([id, n], i) => '<button data-goto="' + id + '"' + (id === 'spells' && !S.spells ? ' style="opacity:.5"' : '') + '><i>' + (i + 1) + '</i>' + n + '</button>').join('') + '</nav>';
  // identity strip
  let idb = '<div class="fgrid">' + field('Name', '<input type="text" id="fName" value="' + esc(d.name) + '">') +
    field('Preview level', '<select id="fLevel">' + Array.from({ length: 20 }, (_, i) => opt(i + 1, 'Level ' + (i + 1), i + 1 === L)).join('') + '</select>', 'Characters are rebuilt at the party level in a skirmish.') + '</div>';
  if (E.iconic) idb += '<p class="desc">' + esc(d.blurb || '') + ' Pregenerated heroes are read-only; change anything and save a copy to keep it.</p>';
  // 1 ancestry
  const anc = D.ancestries[d.anc] || {};
  let b1 = idb + '<div class="fgrid">' + field('Ancestry', '<select id="fAnc">' + Object.entries(D.ancestries).map(([k, a]) => opt(k, a.name + ' (' + a.hp + ' HP, ' + a.speed + ' ft)', k === d.anc)).join('') + '</select>') +
    field('Heritage', '<select id="fHer">' + Object.entries(D.heritages).filter(([, x]) => x.anc === d.anc).map(([k, x]) => opt(k, x.name, k === S.her)).join('') + '</select>', (D.heritages[S.her] || {}).desc) + '</div>';
  if ((D.heritages[S.her] || {}).desc) b1 += '<p class="desc"><b>' + esc(D.heritages[S.her].name) + ':</b> ' + esc(D.heritages[S.her].desc) + '</p>';
  h += sec('anc', 1, 'Ancestry', esc(anc.name || '') + ' · ' + (anc.hp || '?') + ' HP · ' + (anc.speed || '?') + ' ft', b1);
  // 2 background & skills
  let b2 = '<div class="fgrid">' + field('Background', '<select id="fBg">' + Object.entries(D.backgrounds).map(([k, b]) => opt(k, b.name + ' (' + b.boosts.map(x => x.toUpperCase()).join('/') + ', ' + U.cap(b.skill) + ')', k === d.bg)).join('') + '</select>') +
    field('Initiative', '<select id="fInit">' + opt('perception', 'Perception', (d.initSkill || 'perception') === 'perception') + opt('stealth', 'Stealth (ambush)', d.initSkill === 'stealth') + '</select>') + '</div>';
  b2 += '<p class="desc">Ticked skills are trained first and get skill increases first. Class-granted skills are always trained.</p><div class="skillgrid">' +
    Object.keys(PF.SKILLS).map(k => '<label><input type="checkbox" data-skill="' + k + '"' + ((d.skillPri || []).includes(k) ? ' checked' : '') + '> ' + U.cap(k) + ' <span class="rk">' + PF.RANK[S.skills[k]] + ' ' + App.sgn(S.sk[k].base) + '</span></label>').join('') + '</div>';
  h += sec('bg', 2, 'Background & skills', esc((D.backgrounds[d.bg] || {}).name || ''), b2);
  // 3 class
  let b3 = '<div class="clsgrid" role="radiogroup" aria-label="Class">' + Object.entries(D.classes).map(([k, c]) => '<button class="clscard' + (k === d.cls ? ' on' : '') + '" data-cls="' + k + '" role="radio" aria-checked="' + (k === d.cls) + '" title="' + esc(c.desc || '') + '">' + App.emblem({ cls: k }) + '<b>' + esc(c.name) + '</b><small>' + c.hp + ' HP · ' + c.key.map(x => x.toUpperCase()).join('/') + '</small></button>').join('') + '</div>';
  b3 += '<p class="desc">' + esc(cls.desc || '') + '</p><div class="fgrid">';
  if (cls.sub) b3 += field(cls.sub.label, '<select id="fSub">' + Object.entries(cls.sub.opts).map(([k, o]) => opt(k, o.name, k === S.sub)).join('') + '</select>', cls.sub.opts[S.sub] ? cls.sub.opts[S.sub].desc : '');
  if (d.cls === 'cleric' || d.cls === 'champion') b3 += field('Deity', '<select id="fDeity">' + opt('', '—', !d.deity) + Object.entries(D.deities).map(([k, x]) => opt(k, x.name + ' (' + D.weapons[x.weapon].name + ')', k === d.deity)).join('') + '</select>');
  if (cls.key.length > 1) b3 += field('Key attribute', '<select id="fKey">' + cls.key.map(k => opt(k, PF.ATTRN[k], k === S.key)).join('') + '</select>');
  b3 += '</div>';
  if (cls.sub && cls.sub.opts[S.sub]) b3 += '<p class="desc"><b>' + esc(cls.sub.opts[S.sub].name) + ':</b> ' + esc(cls.sub.opts[S.sub].desc) + '</p>';
  h += sec('cls', 3, 'Class', esc(cls.name) + (S.subName ? ' · ' + esc(S.subName) : ''), b3);
  // 4 attributes
  const pri = (d.attrs && d.attrs.length === 6) ? d.attrs : cls.def.attrs;
  h += sec('attr', 4, 'Attribute boosts', 'priority order', '<p class="desc">Order your priorities. Boosts from ancestry, background, class and the four free boosts at 1st level (and at 5th, 10th, 15th and 20th) go to the highest priorities, with partial boosts above +4.</p><div class="attrorder">' +
    pri.map((a, i) => '<span class="attrchip"><button data-mv="' + i + ':-1" aria-label="Raise ' + PF.ATTRN[a] + ' priority">' + ico('back', 14) + '</button><span class="an"><small>' + (i + 1) + '. ' + a.toUpperCase() + '</small><b>' + App.sgn(S.attr[a]) + '</b></span><button data-mv="' + i + ':1" aria-label="Lower ' + PF.ATTRN[a] + ' priority">' + ico('next', 14) + '</button></span>').join('') + '</div>');
  // 5 feats
  const taken = new Set(S.feats.filter(f => f.id).map(f => f.id));
  let b5 = '<div class="featgrid">';
  S.feats.forEach(fl => {
    if (fl.slot === 'bg') { b5 += field('Background · 1', '<select disabled>' + opt('', fl.name, true) + '</select>'); return; }
    const slot = S.featSlots.find(s => s.key === fl.slot) || { key: fl.slot, type: fl.type, lvl: fl.lvl };
    const others = new Set([...taken].filter(x => x !== fl.id));
    const ctx = { cls: d.cls, anc: d.anc, sub: S.sub, has: id => others.has(id), skillOK: f => !f.skill || S.skills[f.skill] >= (f.rank || 1) };
    const opts = Object.values(D.feats).filter(f => PF.Build.featOK(f, slot, ctx));
    const cur = d.feats && d.feats[slot.key];
    const lab = U.cap(slot.type) + ' · ' + slot.lvl + (fl.bonus ? ' (' + fl.bonus + ')' : '');
    b5 += field(lab, '<select data-feat="' + slot.key + '">' + opt('*', 'Auto: ' + (fl.id ? fl.name : 'none'), cur == null) + opt('', '— none —', cur === '') + opts.map(f => opt(f.id, f.name + (f.lvl > 1 ? ' (' + f.lvl + ')' : ''), cur === f.id)).join('') + '</select>', fl.id && D.feats[fl.id] ? D.feats[fl.id].desc : '');
  });
  b5 += '</div>';
  h += sec('feats', 5, 'Feats', S.feats.filter(f => f.id).length + ' chosen', b5);
  // 6 spells
  if (S.spells) {
    const sp = S.spells; const trad = sp.trad; const list = D.spellList(trad);
    const cur = d.cantrips && d.cantrips.length ? d.cantrips : sp.cantrips;
    let b6 = '<div class="featgrid">' + [0, 1, 2, 3, 4].map(i => field('Cantrip ' + (i + 1), '<select data-cantrip="' + i + '">' + list.filter(s => s.rank === 0).map(s => opt(s.id, s.name, cur[i] === s.id)).join('') + '</select>')).join('') + '</div>';
    const maxRank = Math.min(9, Math.ceil(L / 2));
    for (let r = 1; r <= maxRank; r++) {
      const entries = sp.kind === 'prepared' ? sp.prepared.filter(e => e.rank === r) : sp.rep.filter(e => e.rank === r);
      if (!entries.length) continue;
      const key = sp.kind === 'prepared' ? 'prepared' : 'repertoire';
      b6 += '<div class="featgrid">' + entries.map((e, i) => field(PF.ordinal(r) + ' rank ' + (sp.kind === 'prepared' ? 'slot' : 'known') + ' ' + (i + 1), '<select data-spell="' + key + ':' + r + ':' + i + '">' + list.filter(s => s.rank > 0 && s.rank <= r).sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name)).map(s => opt(s.id, s.name + (s.rank < r ? ' (' + PF.ordinal(s.rank) + ')' : ''), e.id === s.id)).join('') + '</select>', D.spells[e.id].desc)).join('') + '</div>';
    }
    h += sec('spells', 6, 'Spells', esc(U.cap(trad) + ' · ' + sp.kind + ' · DC ' + sp.dc), b6);
  } else h += sec('spells', 6, 'Spells', 'none', '<p class="desc">' + esc(cls.name) + 's don’t cast spells' + (S.focus && S.focus.max ? ', but have focus spells: ' + esc(S.focus.spells.map(id => D.spells[id] ? D.spells[id].name : id).join(', ')) : '') + '.</p>');
  // 7 gear
  const wOpts = (curW, filter, none) => (none ? opt('', '— none —', !curW) : '') + Object.values(D.weapons).filter(filter).map(w => opt(w.id, w.name + ' (d' + w.die + ' ' + w.dt + ', ' + w.cat + ')', w.id === curW)).join('');
  let b7 = '<div class="fgrid">' + field('Main weapon', '<select id="fWeapon">' + wOpts(d.weapon || cls.def.weapon, () => true) + '</select>');
  const mainW = D.weapons[d.weapon || cls.def.weapon];
  if (mainW && mainW.kind === 'r') b7 += field('Melee backup', '<select id="fMelee">' + wOpts(d.melee || cls.def.melee, w => w.kind === 'm' && w.cat !== 'unarmed', true) + '</select>');
  b7 += field('Ranged / thrown', '<select id="fRanged">' + wOpts(d.ranged === undefined ? cls.def.ranged : d.ranged, w => w.kind === 'r' || w.traits.some(t => t.startsWith('thrown')), true) + '</select>');
  b7 += field('Armor', '<select id="fArmor">' + Object.values(D.armors).map(a => opt(a.id, a.name + (a.ac ? ' (+' + a.ac + ', ' + a.cat + ')' : ''), a.id === (d.armor || cls.def.armor))).join('') + '</select>');
  b7 += field('Shield', '<select id="fShield">' + opt('', '— none —', !(d.shield === undefined ? cls.def.shield : d.shield)) + ['buckler', 'wooden', 'steel', 'tower'].map(k => opt(k, D.shields[k].name, k === (d.shield === undefined ? cls.def.shield : d.shield))).join('') + '</select>');
  b7 += '</div><p class="desc">Runes, shield upgrades and a healing potion are added automatically for the level. Two-handed weapons drop the shield.</p>';
  h += sec('gear', 7, 'Gear', esc(S.armor.name), b7);
  // 8 miniature
  const lk = d.look || {};
  h += sec('mini', 8, 'Miniature', '', '<div class="colors"><label>Body <input type="color" id="fBody" value="' + (lk.body || '#6c7a8c') + '"></label><label>Trim <input type="color" id="fTrim" value="' + (lk.trim || '#c8a24a') + '"></label><label>Headgear <select id="fAcc">' + ['none', 'helm', 'hood', 'hat'].map(a => opt(a, U.cap(a), a === (lk.acc || 'none'))).join('') + '</select></label></div>');
  $('#buildForm').innerHTML = h;
  $('#sheetView').innerHTML = '<div class="sheet-tag">Live sheet · level ' + L + '</div>' + App.sheetBlock(S);
  App.bindForm(S);
  App.syncStep();
};
App.syncStep = () => {
  const body = $('#roster .page-body'); if (!body) return;
  const top = body.getBoundingClientRect().top + 60; let cur = STEPS[0][0];
  $$('#buildForm .fsec').forEach(s => { if (s.getBoundingClientRect().top <= top) cur = s.dataset.step; });
  $$('#buildForm .bf-steps button').forEach(b => b.classList.toggle('on', b.dataset.goto === cur));
};
App.bindForm = S => {
  const E = App.edit, d = E.def; const F = $('#buildForm');
  const upd = (fn) => { fn(); App.renderForm(); };
  const on = (id, ev, fn) => { const el = $('#' + id, F); if (el) el.addEventListener(ev, () => upd(() => fn(el))); };
  const setCls = v => { const c = D.classes[v]; d.cls = v; d.sub = c.def.sub || null; d.attrs = c.def.attrs.slice(); d.weapon = c.def.weapon; d.ranged = c.def.ranged; d.melee = c.def.melee; d.armor = c.def.armor; d.shield = c.def.shield; d.feats = {}; d.prepared = null; d.repertoire = null; d.cantrips = null; d.spellPri = null; d.featPri = null; d.key = undefined; if (v === 'cleric') d.deity = 'sarenrae'; if (v === 'champion') d.deity = 'iomedae'; };
  on('fName', 'change', el => { d.name = el.value || 'Hero'; });
  on('fLevel', 'change', el => { E.level = +el.value; });
  on('fAnc', 'change', el => { d.anc = el.value; d.her = Object.keys(D.heritages).find(k => D.heritages[k].anc === d.anc); d.feats = {}; });
  on('fHer', 'change', el => { d.her = el.value; });
  on('fBg', 'change', el => { d.bg = el.value; });
  on('fCls', 'change', el => setCls(el.value));
  $$('[data-cls]', F).forEach(b => b.onclick = () => { if (b.dataset.cls !== d.cls) upd(() => setCls(b.dataset.cls)); });
  on('fSub', 'change', el => { d.sub = el.value; d.feats = {}; d.repertoire = null; d.prepared = null; d.cantrips = null; });
  on('fDeity', 'change', el => { d.deity = el.value || null; });
  on('fKey', 'change', el => { d.key = el.value; const a = d.attrs || D.classes[d.cls].def.attrs.slice(); a.splice(a.indexOf(el.value), 1); a.unshift(el.value); d.attrs = a; });
  on('fInit', 'change', el => { d.initSkill = el.value; });
  on('fWeapon', 'change', el => { d.weapon = el.value; const w = D.weapons[el.value]; if (w.hands === 2) d.shield = null; });
  on('fMelee', 'change', el => { d.melee = el.value || null; });
  on('fRanged', 'change', el => { d.ranged = el.value || null; });
  on('fArmor', 'change', el => { d.armor = el.value; });
  on('fShield', 'change', el => { d.shield = el.value || null; });
  ['fBody', 'fTrim', 'fAcc'].forEach(id => on(id, 'change', el => { d.look = d.look || {}; d.look[{ fBody: 'body', fTrim: 'trim', fAcc: 'acc' }[id]] = el.value; }));
  $$('[data-mv]', F).forEach(b => b.onclick = () => upd(() => { const [i, dir] = b.dataset.mv.split(':').map(Number); const a = (d.attrs && d.attrs.length === 6) ? d.attrs : D.classes[d.cls].def.attrs.slice(); const j = i + dir; if (j < 0 || j > 5) return; [a[i], a[j]] = [a[j], a[i]]; d.attrs = a; }));
  $$('[data-feat]', F).forEach(s => s.onchange = () => upd(() => { d.feats = d.feats || {}; if (s.value === '*') delete d.feats[s.dataset.feat]; else d.feats[s.dataset.feat] = s.value; }));
  $$('[data-cantrip]', F).forEach(s => s.onchange = () => upd(() => { const cur = (d.cantrips && d.cantrips.length ? d.cantrips : S.spells.cantrips).slice(); cur[+s.dataset.cantrip] = s.value; d.cantrips = cur.filter((v, i, a) => a.indexOf(v) === i); }));
  $$('[data-spell]', F).forEach(s => s.onchange = () => upd(() => { const [key, r, i] = s.dataset.spell.split(':'); const sp = S.spells; d[key] = d[key] || {}; const cur = d[key][r] || (key === 'prepared' ? sp.prepared.filter(e => e.rank === +r) : sp.rep.filter(e => e.rank === +r)).map(e => e.id); cur[+i] = s.value; d[key][r] = cur; }));
  $$('[data-skill]', F).forEach(c => c.onchange = () => upd(() => { const k = c.dataset.skill; const p = (d.skillPri || []).filter(x => x !== k); if (c.checked) p.push(k); d.skillPri = p; }));
  $$('[data-goto]', F).forEach(b => b.onclick = () => { const t = $('#bs-' + b.dataset.goto, F); if (t) t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); });
  $$('[data-act]', F).forEach(b => b.onclick = () => {
    const a = b.dataset.act;
    if (a === 'save' || a === 'saveCopy') {
      const c = U.clone(d); delete c.level; delete c.iconic;
      if (a === 'saveCopy' || !E.uid) { c.uid = (a === 'saveCopy' || !c.uid || App.roster.some(r => r.uid === c.uid)) ? U.uid('c') : c.uid; if (a === 'saveCopy') c.name = d.name + (D.iconics[E.iconic] && d.name === D.iconics[E.iconic].name ? ' (copy)' : ''); App.roster.push(c); E.uid = c.uid; E.iconic = null; E.def = U.clone(c); }
      else { const i = App.roster.findIndex(r => r.uid === E.uid); c.uid = E.uid; if (i >= 0) App.roster[i] = c; else App.roster.push(c); }
      App.saveRoster(); App.renderRoster(); App.toast('Saved ' + c.name + '.');
    }
    if (a === 'del') { App.roster = App.roster.filter(r => r.uid !== E.uid); App.saveRoster(); App.setup.party = App.setup.party.filter(p => p.ref !== 'custom:' + E.uid); App.saveSetup(); App.edit = null; App.renderRoster(); }
    if (a === 'toParty') {
      let ref;
      if (E.iconic) ref = 'iconic:' + E.iconic;
      else { if (!E.uid) { const c = U.clone(d); c.uid = c.uid && !App.roster.some(r => r.uid === c.uid) ? c.uid : U.uid('c'); App.roster.push(c); App.saveRoster(); E.uid = c.uid; } else { const i = App.roster.findIndex(r => r.uid === E.uid); if (i >= 0) { App.roster[i] = Object.assign(U.clone(d), { uid: E.uid }); App.saveRoster(); } } ref = 'custom:' + E.uid; }
      if (App.setup.party.length >= 6) { App.toast('The party is full (6).'); return; }
      App.setup.party.push({ ref, ai: false }); App.saveSetup(); App.show('setup');
    }
  });
};
App.bindRoster = () => {
  $('#rosterList').addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (!b) return; const [k, id] = b.dataset.open.split(':'); App.openEdit(k, id); });
  $('#btnNewChar').onclick = () => App.openEdit('new');
  $('#btnRandChar').onclick = () => App.openEdit('random');
  let raf = 0; $('#roster .page-body').addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; App.syncStep(); }); }, { passive: true });
};
})(typeof window !== 'undefined' ? window : globalThis);
