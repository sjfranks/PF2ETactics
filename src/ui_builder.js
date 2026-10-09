/* ui_builder.js — roster list and character builder */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D, U = PF.U, App = PF.App;
const $ = App.$, $$ = App.$$, esc = U.esc;
const ATTRS = PF.ATTR;

App.edit = null; // {def, level, uid|null, iconic|null}
const opt = (v, label, sel) => '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(label) + '</option>';
const field = (label, inner, title) => '<label class="field"' + (title ? ' title="' + esc(title) + '"' : '') + '><span>' + label + '</span>' + inner + '</label>';

App.newDef = () => ({ uid: U.uid('c'), name: 'New Hero', anc: 'human', her: 'versatileHuman', bg: 'warrior', cls: 'fighter', sub: null, attrs: D.classes.fighter.def.attrs.slice(), weapon: 'longsword', ranged: 'javelin', armor: 'chainmail', shield: 'steel', feats: {}, look: { body: '#6c7a8c', trim: '#c8a24a', acc: 'helm' } });
App.openEdit = (kind, id) => {
  if (kind === 'iconic') { App.edit = { def: Object.assign(U.clone(D.iconics[id]), { feats: {} }), level: App.edit ? App.edit.level : App.setup.pl, uid: null, iconic: id }; }
  else if (kind === 'custom') { const c = App.roster.find(r => r.uid === id); if (!c) return; App.edit = { def: U.clone(c), level: App.edit ? App.edit.level : App.setup.pl, uid: id, iconic: null }; }
  else { const d = kind === 'random' ? Object.assign(PF.Build.random(App.setup.pl), { uid: U.uid('c'), feats: {} }) : App.newDef(); delete d.level; App.edit = { def: d, level: App.setup.pl, uid: null, iconic: null, fresh: true }; }
  App.renderRoster();
};
App.renderRoster = () => {
  if (!App.edit) App.openEdit('iconic', 'valeros');
  const E = App.edit;
  const row = (kind, id, d) => { const cls = D.classes[d.cls]; const on = (kind === 'iconic' && E.iconic === id) || (kind === 'custom' && E.uid === id); return '<button class="rchar' + (on ? ' on' : '') + '" data-open="' + kind + ':' + id + '">' + App.badge(d.cls, cls.name.charAt(0)) + '<div><b>' + esc(d.name) + '</b><span>' + esc(D.ancestries[d.anc].name + ' ' + cls.name) + '</span></div></button>'; };
  $('#rosterList').innerHTML = '<div class="label">Your characters</div>' + (App.roster.length ? App.roster.map(c => row('custom', c.uid, c)).join('') : '<div class="empty">Nothing saved yet.</div>') + '<div class="label grp">Iconics</div>' + D.iconicOrder.map(id => row('iconic', id, D.iconics[id])).join('');
  App.renderForm();
};
App.renderForm = () => {
  const E = App.edit; const d = E.def; const L = E.level;
  let S; try { S = PF.Build.make(Object.assign({}, d, { level: L })); } catch (e) { console.error(e); $('#buildForm').innerHTML = '<div class="empty">This build could not be computed: ' + esc(e.message) + '</div>'; return; }
  const cls = D.classes[d.cls];
  let h = '';
  h += '<div class="row gap wrap"><h3 style="margin:0;font-family:var(--f-display);font-weight:400;font-size:22px" class="grow">' + (E.iconic ? 'Iconic: ' + esc(d.name) : E.uid ? 'Editing ' + esc(d.name) : 'New character') + '</h3>' +
    (E.iconic ? '<button class="btn primary" data-act="saveCopy">Save as my copy</button>' : '<button class="btn primary" data-act="save">' + (E.uid ? 'Save changes' : 'Save character') + '</button>') +
    '<button class="btn" data-act="toParty">Add to party</button>' + (E.uid ? '<button class="btn ghost" data-act="del">Delete</button>' : '') + '</div>';
  if (E.iconic) h += '<p class="desc">' + esc(d.blurb || '') + ' Iconics are read-only; change anything and save a copy to keep it.</p>';
  // identity
  h += '<div class="fgrid">';
  h += field('Name', '<input type="text" id="fName" value="' + esc(d.name) + '">');
  h += field('Preview level', '<select id="fLevel">' + Array.from({ length: 20 }, (_, i) => opt(i + 1, 'Level ' + (i + 1), i + 1 === L)).join('') + '</select>', 'Characters are rebuilt at the party level in a skirmish.');
  h += field('Ancestry', '<select id="fAnc">' + Object.entries(D.ancestries).map(([k, a]) => opt(k, a.name + ' (' + a.hp + ' HP, ' + a.speed + ' ft)', k === d.anc)).join('') + '</select>');
  h += field('Heritage', '<select id="fHer">' + Object.entries(D.heritages).filter(([, x]) => x.anc === d.anc).map(([k, x]) => opt(k, x.name, k === S.her)).join('') + '</select>', (D.heritages[S.her] || {}).desc);
  h += field('Background', '<select id="fBg">' + Object.entries(D.backgrounds).map(([k, b]) => opt(k, b.name + ' (' + b.boosts.map(x => x.toUpperCase()).join('/') + ', ' + U.cap(b.skill) + ')', k === d.bg)).join('') + '</select>');
  h += field('Class', '<select id="fCls">' + Object.entries(D.classes).map(([k, c]) => opt(k, c.name + ' (' + c.hp + ' HP)', k === d.cls)).join('') + '</select>', cls.desc);
  if (cls.sub) h += field(cls.sub.label, '<select id="fSub">' + Object.entries(cls.sub.opts).map(([k, o]) => opt(k, o.name, k === S.sub)).join('') + '</select>', cls.sub.opts[S.sub] ? cls.sub.opts[S.sub].desc : '');
  if (d.cls === 'cleric' || d.cls === 'champion') h += field('Deity', '<select id="fDeity">' + opt('', '—', !d.deity) + Object.entries(D.deities).map(([k, x]) => opt(k, x.name + ' (' + D.weapons[x.weapon].name + ')', k === d.deity)).join('') + '</select>');
  if (cls.key.length > 1) h += field('Key attribute', '<select id="fKey">' + cls.key.map(k => opt(k, PF.ATTRN[k], k === S.key)).join('') + '</select>');
  h += field('Initiative', '<select id="fInit">' + opt('perception', 'Perception', (d.initSkill || 'perception') === 'perception') + opt('stealth', 'Stealth (ambush)', d.initSkill === 'stealth') + '</select>');
  h += '</div>';
  if (cls.sub && cls.sub.opts[S.sub]) h += '<p class="desc">' + esc(cls.sub.opts[S.sub].desc) + '</p>';
  // attributes
  const pri = (d.attrs && d.attrs.length === 6) ? d.attrs : cls.def.attrs;
  h += '<div class="fsec"><h4>Attribute boosts</h4><p class="desc">Order your priorities. Boosts from ancestry, background, class and the four free boosts at 1st level (and at 5th, 10th, 15th and 20th) go to the highest priorities, with partial boosts above +4.</p><div class="attrorder">' +
    pri.map((a, i) => '<span class="attrchip"><button data-mv="' + i + ':-1" aria-label="Raise priority">◀</button>' + a.toUpperCase() + ' <b>' + App.sgn(S.attr[a]) + '</b><button data-mv="' + i + ':1" aria-label="Lower priority">▶</button></span>').join('') + '</div></div>';
  // equipment
  const wOpts = (cur, filter, none) => (none ? opt('', '— none —', !cur) : '') + Object.values(D.weapons).filter(filter).map(w => opt(w.id, w.name + ' (d' + w.die + ' ' + w.dt + ', ' + w.cat + ')', w.id === cur)).join('');
  h += '<div class="fsec"><h4>Equipment</h4><div class="fgrid">';
  h += field('Main weapon', '<select id="fWeapon">' + wOpts(d.weapon || cls.def.weapon, () => true) + '</select>');
  const mainW = D.weapons[d.weapon || cls.def.weapon];
  if (mainW && mainW.kind === 'r') h += field('Melee backup', '<select id="fMelee">' + wOpts(d.melee || cls.def.melee, w => w.kind === 'm' && w.cat !== 'unarmed', true) + '</select>');
  h += field('Ranged / thrown', '<select id="fRanged">' + wOpts(d.ranged === undefined ? cls.def.ranged : d.ranged, w => w.kind === 'r' || w.traits.some(t => t.startsWith('thrown')), true) + '</select>');
  h += field('Armor', '<select id="fArmor">' + Object.values(D.armors).map(a => opt(a.id, a.name + (a.ac ? ' (+' + a.ac + ', ' + a.cat + ')' : ''), a.id === (d.armor || cls.def.armor))).join('') + '</select>');
  h += field('Shield', '<select id="fShield">' + opt('', '— none —', !(d.shield === undefined ? cls.def.shield : d.shield)) + ['buckler', 'wooden', 'steel', 'tower'].map(k => opt(k, D.shields[k].name, k === (d.shield === undefined ? cls.def.shield : d.shield))).join('') + '</select>');
  h += '</div><p class="desc">Runes, shield upgrades and a healing potion are added automatically for the level. Two-handed weapons drop the shield.</p></div>';
  // feats
  const taken = new Set(S.feats.filter(f => f.id).map(f => f.id));
  h += '<div class="fsec"><h4>Feats</h4><div class="featgrid">';
  S.feats.forEach(fl => {
    if (fl.slot === 'bg') { h += field('Background · ' + 1, '<select disabled>' + opt('', fl.name, true) + '</select>'); return; }
    const slot = S.featSlots.find(s => s.key === fl.slot) || { key: fl.slot, type: fl.type, lvl: fl.lvl };
    const others = new Set([...taken].filter(x => x !== fl.id));
    const ctx = { cls: d.cls, anc: d.anc, sub: S.sub, has: id => others.has(id), skillOK: f => !f.skill || S.skills[f.skill] >= (f.rank || 1) };
    const opts = Object.values(D.feats).filter(f => PF.Build.featOK(f, slot, ctx));
    const cur = d.feats && d.feats[slot.key];
    const lab = U.cap(slot.type) + ' · ' + slot.lvl + (fl.bonus ? ' (' + fl.bonus + ')' : '');
    h += field(lab, '<select data-feat="' + slot.key + '">' + opt('*', 'Auto: ' + (fl.id ? fl.name : 'none'), cur == null) + opt('', '— none —', cur === '') + opts.map(f => opt(f.id, f.name + (f.lvl > 1 ? ' (' + f.lvl + ')' : ''), cur === f.id)).join('') + '</select>', fl.id && D.feats[fl.id] ? D.feats[fl.id].desc : '');
  });
  h += '</div></div>';
  // spells
  if (S.spells) {
    const sp = S.spells; const trad = sp.trad; const list = D.spellList(trad);
    h += '<div class="fsec"><h4>Spells <span class="dim" style="font-size:13px">(' + trad + ', ' + sp.kind + ')</span></h4>';
    const cur = d.cantrips && d.cantrips.length ? d.cantrips : sp.cantrips;
    h += '<div class="featgrid">' + [0, 1, 2, 3, 4].map(i => field('Cantrip ' + (i + 1), '<select data-cantrip="' + i + '">' + list.filter(s => s.rank === 0).map(s => opt(s.id, s.name, cur[i] === s.id)).join('') + '</select>')).join('') + '</div>';
    const maxRank = Math.min(9, Math.ceil(L / 2));
    for (let r = 1; r <= maxRank; r++) {
      const entries = sp.kind === 'prepared' ? sp.prepared.filter(e => e.rank === r) : sp.rep.filter(e => e.rank === r);
      if (!entries.length) continue;
      const key = sp.kind === 'prepared' ? 'prepared' : 'repertoire';
      h += '<div class="featgrid">' + entries.map((e, i) => field(PF.ordinal(r) + ' rank ' + (sp.kind === 'prepared' ? 'slot' : 'known') + ' ' + (i + 1), '<select data-spell="' + key + ':' + r + ':' + i + '">' + list.filter(s => s.rank > 0 && s.rank <= r).sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name)).map(s => opt(s.id, s.name + (s.rank < r ? ' (' + PF.ordinal(s.rank) + ')' : ''), e.id === s.id)).join('') + '</select>', D.spells[e.id].desc)).join('') + '</div>';
    }
    h += '</div>';
  }
  // skills & look
  h += '<div class="fsec"><h4>Skill priorities</h4><p class="desc">Ticked skills are trained first and get skill increases first. Class-granted skills are always trained.</p><div class="row gap wrap">' +
    Object.keys(PF.SKILLS).map(k => '<label><input type="checkbox" data-skill="' + k + '"' + ((d.skillPri || []).includes(k) ? ' checked' : '') + '> ' + U.cap(k) + ' <span class="dim">' + PF.RANK[S.skills[k]] + '</span></label>').join('') + '</div></div>';
  const lk = d.look || {};
  h += '<div class="fsec"><h4>Miniature</h4><div class="colors"><label>Body <input type="color" id="fBody" value="' + (lk.body || '#6c7a8c') + '"></label><label>Trim <input type="color" id="fTrim" value="' + (lk.trim || '#c8a24a') + '"></label><label>Headgear <select id="fAcc">' + ['none', 'helm', 'hood', 'hat'].map(a => opt(a, U.cap(a), a === (lk.acc || 'none'))).join('') + '</select></label></div></div>';
  $('#buildForm').innerHTML = h;
  $('#sheetView').innerHTML = App.sheetBlock(S);
  App.bindForm(S);
};
App.bindForm = S => {
  const E = App.edit, d = E.def; const F = $('#buildForm');
  const upd = (fn) => { fn(); App.renderForm(); };
  const on = (id, ev, fn) => { const el = $('#' + id, F); if (el) el.addEventListener(ev, () => upd(() => fn(el))); };
  on('fName', 'change', el => { d.name = el.value || 'Hero'; });
  on('fLevel', 'change', el => { E.level = +el.value; });
  on('fAnc', 'change', el => { d.anc = el.value; d.her = Object.keys(D.heritages).find(k => D.heritages[k].anc === d.anc); d.feats = {}; });
  on('fHer', 'change', el => { d.her = el.value; });
  on('fBg', 'change', el => { d.bg = el.value; });
  on('fCls', 'change', el => { const c = D.classes[el.value]; d.cls = el.value; d.sub = c.def.sub || null; d.attrs = c.def.attrs.slice(); d.weapon = c.def.weapon; d.ranged = c.def.ranged; d.melee = c.def.melee; d.armor = c.def.armor; d.shield = c.def.shield; d.feats = {}; d.prepared = null; d.repertoire = null; d.cantrips = null; d.spellPri = null; d.featPri = null; d.key = undefined; if (el.value === 'cleric') d.deity = 'sarenrae'; if (el.value === 'champion') d.deity = 'iomedae'; });
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
  $$('[data-act]', F).forEach(b => b.onclick = () => {
    const a = b.dataset.act;
    if (a === 'save' || a === 'saveCopy') {
      const c = U.clone(d); delete c.level; delete c.iconic;
      if (a === 'saveCopy' || !E.uid) { c.uid = (a === 'saveCopy' || !c.uid || App.roster.some(r => r.uid === c.uid)) ? U.uid('c') : c.uid; if (a === 'saveCopy') c.name = d.name + (d.name === D.iconics[E.iconic].name ? ' (copy)' : ''); App.roster.push(c); E.uid = c.uid; E.iconic = null; E.def = U.clone(c); }
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
};
})(typeof window !== 'undefined' ? window : globalThis);
