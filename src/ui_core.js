/* ui_core.js — app shell: storage, settings, icons/emblems, home, skirmish setup (bestiary, budget, maps), stat blocks, modal */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D, U = PF.U;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = U.esc;
const App = PF.App = { screen: 'home', prev: 'home' };
App.$ = $; App.$$ = $$;
const Icons = PF.Icons;
const ico = App.icon = (n, s, c, t) => Icons.svg(n, s, c, t);

/* ---------- storage ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};
App.store = store;
const DEFAULT_PARTY = ['valeros', 'kyra', 'ezren', 'merisiel'];
App.defaultParty = () => DEFAULT_PARTY.filter(id => D.iconics[id]).concat(D.iconicOrder.filter(id => !DEFAULT_PARTY.includes(id))).slice(0, 4).map(id => ({ ref: 'iconic:' + id, ai: false }));
App.roster = store.get('tat.roster.v1', []);
App.saveRoster = () => store.set('tat.roster.v1', App.roster);
App.setup = Object.assign({ pl: 1, party: [], foes: [], map: 'chapel', threat: 'moderate', theme: 'any' }, store.get('tat.setup.v1', {}));
if (!App.setup.party.length) App.setup.party = App.defaultParty();
if (!App.setup.foes.length) App.setup.foes = D.presets[0].foes.map(id => ({ id, adj: null }));
if (!D.maps[App.setup.map]) App.setup.map = D.mapOrder[0];
App.saveSetup = () => store.set('tat.setup.v1', { pl: App.setup.pl, party: App.setup.party, foes: App.setup.foes.filter(f => D.creatures[f.id] && !D.creatures[f.id].generated), map: App.setup.map, threat: App.setup.threat, theme: App.setup.theme });

/* ---------- settings ----------
   App.settings.gfx: 'high'|'medium'|'low'|'off' (also mirrored raw in localStorage 'tat.gfx' for the renderer)
   App.settings.reactions: 'auto'|'defensive'|'never'   App.settings.heroPoints: 'death'|'reroll'
   A 'tat:settings' window event fires after every change with detail = App.settings. */
const SET_DEF = { gfx: Math.min(G.innerWidth, G.innerHeight) < 700 ? 'medium' : 'high', speed: 1, follow: true, grid: true, confirmEnd: true, reactions: 'auto', heroPoints: 'death', banners: true, logOpen: null, sound: false, haptics: false };
App.settings = Object.assign({}, SET_DEF, store.get('tat.settings.v1', {}));
try { const g = localStorage.getItem('tat.gfx'); if (['high', 'medium', 'low', 'off'].includes(g)) App.settings.gfx = g; } catch (e) { /* no storage */ }
App.saveSettings = () => {
  store.set('tat.settings.v1', App.settings);
  try { localStorage.setItem('tat.gfx', App.settings.gfx); } catch (e) { /* no storage */ }
  App.applySettings();
};
App.applySettings = () => {
  const S = App.settings;
  const sp = $('#animSpeed'); if (sp && String(+sp.value) !== String(S.speed)) sp.value = String(S.speed);
  if (App.R) { App.R.speed = +S.speed || 1; if (typeof App.R.applyGfx === 'function') { try { App.R.applyGfx(S.gfx); } catch (e) { console.warn(e); } } }
  App.applyGrid();
  try { G.dispatchEvent(new CustomEvent('tat:settings', { detail: S })); } catch (e) { /* old browser */ }
};
// grid line visibility: uses renderer method if present, otherwise toggles the black LineSegments grid in the scene
App.applyGrid = () => {
  const R = App.R; if (!R) return;
  if (typeof R.setGrid === 'function') { R.setGrid(App.settings.grid); return; }
  if (!R.scene) return;
  R.scene.traverse(o => { if (o.isLineSegments && o.material && o.material.color && o.material.color.getHex && o.material.color.getHex() === 0) o.visible = !!App.settings.grid; });
};

/* ---------- helpers ---------- */
App.hydrateIcons = (root = document) => { $$('[data-ico]', root).forEach(el => { if (!el.querySelector('svg')) el.insertAdjacentHTML('afterbegin', ico(el.dataset.ico)); }); };
App.CLSC = Icons.CLASS_COLOR;
// emblem portrait. o: unit, sheet, creature or iconic def. opts: {foe, size:'sm'|'lg'|'xl', lv}
App.emblem = (o, opts = {}) => {
  const e = Icons.emblemFor(o);
  const foe = opts.foe != null ? opts.foe : !(o && (o.cls || o.team === 'pc'));
  return '<div class="emb' + (foe ? ' foe' : '') + (opts.size ? ' ' + opts.size : '') + '" style="--c:' + e.color + '">' + ico(e.icon) + (opts.lv != null ? '<span class="lv">' + esc(opts.lv) + '</span>' : '') + '</div>';
};
App.badge = (cls, letter, foe) => App.emblem(foe ? { traits: [] } : { cls }, { foe: !!foe, size: 'sm' }); // legacy signature
App.costGlyph = n => {
  if (n === 'r' || n === 'reaction') return '⟲';
  if (n === 0 || n === 'free' || n === 'f') return '◇';
  if (Array.isArray(n)) return n.length > 2 ? '◆–' + '◆'.repeat(n[n.length - 1]) : n.map(x => '◆'.repeat(x)).join('/');
  const k = +n; return k > 0 ? '◆'.repeat(k) : (n == null ? '' : String(n));
};
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
  if (name !== 'battle' && App.R) App.R.setViewportInsets(0, 0);
  if (name !== 'setup') App.closeFly && App.closeFly();
  if (name === 'home' || name === 'setup' || name === 'roster') App.showDiorama();
  if (name === 'setup') App.renderSetup();
  if (name === 'roster') App.renderRoster();
};

/* ---------- modal / toast ---------- */
App.modal = (html, onBind) => {
  const m = $('#modal'), card = $('#modalCard');
  if (m.hidden) App.modalReturn = document.activeElement;
  if (App.Battle) App.Battle.keys = {};
  card.innerHTML = html; App.hydrateIcons(card); m.hidden = false;
  const heading = card.querySelector('h3'); if (heading) { heading.id = 'modalTitle'; card.setAttribute('aria-labelledby', heading.id); }
  if (onBind) onBind(card);
  const f = card.querySelector('button, select, input'); if (f) f.focus({ preventScroll: true });
};
App.closeModal = () => { $('#modal').hidden = true; if (App.modalReturn && App.modalReturn.isConnected) App.modalReturn.focus({ preventScroll: true }); };
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || $('#modal').hidden) return;
  const els = $$('button, input, select, textarea, a[href], [tabindex="0"]', $('#modalCard')).filter(el => !el.disabled && el.getClientRects().length);
  const first = els[0], last = els[els.length - 1]; if (!first) return;
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
document.addEventListener('click', e => { if (e.target.id === 'modal') App.closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#modal').hidden) { App.closeModal(); e.stopPropagation(); } else if (App.flyOpen) App.closeFly(); } }, true);
App.toast = msg => { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(App._tt); App._tt = setTimeout(() => { t.hidden = true; }, 2000); };
const mhead = (title, sub) => '<div class="mhead"><div><h3>' + title + '</h3>' + (sub ? '<div class="dim" style="font-size:13px">' + sub + '</div>' : '') + '</div><button class="x" onclick="PF.App.closeModal()" aria-label="Close">×</button></div>';
App.mhead = mhead;

/* ---------- settings panel ---------- */
App.openSettings = () => {
  const S = App.settings;
  const seg = (key, opts) => '<div class="seg" role="group">' + opts.map(([v, l]) => '<button data-set="' + key + '" data-val="' + v + '" class="' + (String(S[key]) === String(v) ? 'on' : '') + '">' + l + '</button>').join('') + '</div>';
  const sw = (key) => '<label class="switch"><input type="checkbox" data-sw="' + key + '"' + (S[key] ? ' checked' : '') + ' aria-label="' + key + '"><span></span></label>';
  const row = (t, s, ctl) => '<div class="set-row"><div><b>' + t + '</b><small>' + s + '</small></div>' + ctl + '</div>';
  App.modal(mhead('<span data-ico="gear"></span> Settings') + '<div class="set-grid">' +
    row('Graphics quality', 'Shadows, lighting and effects detail. Lower it on slow devices.', seg('gfx', [['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['off', 'Minimal']])) +
    row('Animation speed', 'How fast moves, attacks and spell effects play.', seg('speed', [[0.75, 'Slow'], [1, 'Normal'], [2, 'Fast'], [5, 'Instant']])) +
    row('Camera follow', 'Pan to whoever is acting.', sw('follow')) +
    row('Show grid', 'Draw square outlines on the battlefield.', sw('grid')) +
    row('Turn banners', '“Your turn” and “Enemy activity” announcements.', sw('banners')) +
    row('Sound effects', 'Soft cues for actions, hits, spells and the start of your turn.', sw('sound')) +
    row('Touch feedback', 'Short vibrations for actions and critical hits, on supported devices.', sw('haptics')) +
    row('Confirm end turn', 'Ask before ending a turn with actions left.', sw('confirmEnd')) +
    row('Reactions', 'Which reactions your heroes use automatically: all (Reactive Strike, Shield Block, Nimble Dodge…), only Shield Block, or none.', seg('reactions', [['auto', 'All'], ['defensive', 'Shield only'], ['never', 'None']])) +
    row('Hero Points', 'Spend Hero Points to avoid death, or to reroll a failed saving throw (the point is then gone).', seg('heroPoints', [['death', 'Avoid death'], ['reroll', 'Reroll']])) +
    '</div><div class="row gap" style="justify-content:flex-end"><button class="btn ghost" onclick="PF.App.openHelp()">How to play</button><button class="btn" onclick="PF.App.closeModal()">Done</button></div>', el => {
    $$('[data-set]', el).forEach(b => b.onclick = () => { const k = b.dataset.set; let v = b.dataset.val; if (k === 'speed') v = +v; S[k] = v; $$('[data-set="' + k + '"]', el).forEach(x => x.classList.toggle('on', x === b)); App.saveSettings(); });
    $$('[data-sw]', el).forEach(c => c.onchange = () => { S[c.dataset.sw] = c.checked; App.saveSettings(); });
  });
};
App.openHelp = () => {
  App.modal(mhead('How to play') + '<div class="help-body">' + $('#helpPanel').innerHTML.replace(/<div class="row"[\s\S]*?<\/div>/, '') + '</div>');
};

/* ---------- stat blocks ---------- */
const TRAIT_CLS = t => ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'].includes(t) ? ' size' : ['uncommon', 'rare', 'unique'].includes(t) ? ' rare' : '';
const traitHTML = list => '<div class="traits">' + list.filter(Boolean).map(t => '<span class="trait' + TRAIT_CLS(t) + '">' + esc(t) + '</span>').join('') + '</div>';
App.traitHTML = traitHTML;
const effText = (e, c) => { const m = /^(aff|rider|eff):(a\d+)$/.exec(e); if (m && c && c.abilities) { const a = c.abilities.find(x => x.id === m[2]); if (a) return a.name; } if (/^(aff|rider|eff):/.test(e)) return ''; return effText0(e); };
const effText0 = e => ({ persistFire1: '1 persistent fire', splash1: '1 fire splash', knockdown: 'Knockdown', grab: 'Grab', improvedGrab: 'Improved Grab' }[e] || e.replace(/([a-z])(\d+)$/, '$1 DC $2').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
const strikeLine = s => {
  const b = (s.atk ? s.atk.base + s.atk.item : s.bonus);
  const dmg = (s.dmg || []).map(d => U.dstr(d) + ' ' + d.type).join(' plus ');
  const tr = (s.traits || []).slice(); if (s.reach > 5 && s.kind === 'melee') tr.push('reach ' + s.reach + ' ft'); if (s.range) tr.push('range increment ' + s.range + ' ft');
  return '<div class="line"><b>' + (s.kind === 'melee' ? 'Melee' : 'Ranged') + '</b><span class="act">◆</span>' + esc(s.name) + ' <span class="num">' + App.sgn(b) + '</span>' + (tr.length ? ' <span class="dim">(' + esc(tr.join(', ')) + ')</span>' : '') + ', <b>Damage</b> ' + esc(dmg) + ((s.eff && s.eff.length) ? ' plus ' + esc(s.eff.map(e => effText(e, App._sbC)).filter(Boolean).join(', ')) : '') + '</div>';
};
App.strikeLine = strikeLine;
const ABIL_COST = { breath: 2, screech: 1, frenzy: 2, monsterCharge: 2, swipe: 2 };
const ABIL_REACT = { reactiveStrike: 1, shieldBlockM: 1, ferocity: 1 };
// abilities of a creature record in the {name, cost, traits, text, auto} shape
App.creatureAbilities = c => {
  if (typeof D.creatureAbilities === 'function') { try { const r = D.creatureAbilities(c); if (Array.isArray(r)) return r; } catch (e) { console.warn(e); } }
  if (Array.isArray(c.abilities)) return c.abilities;
  return (c.abil || []).map(id => {
    const a = D.abilities[id]; if (!a) return null;
    let text = '', cost = null, traits = [];
    if (a.kind === 'aura') { text = a.r + '-foot aura' + (a.dc ? ', DC ' + a.dc + (a.fear ? ' Will; frightened on a failure' : ' Fortitude') : '') + '.'; traits = ['aura'].concat(a.fear ? ['emotion', 'fear', 'mental'] : []); }
    else if (a.kind === 'regen') text = 'Regains ' + a.v + ' HP at the start of each turn. Deactivated by ' + a.off.join(' or ') + ' damage.';
    else if (a.kind === 'act') {
      cost = ABIL_COST[a.act] || 1;
      if (a.act === 'breath') text = a.area.r + '-foot ' + a.area.t + ', ' + a.dmg + ' ' + a.type + ' damage (DC ' + a.dc + ' basic Reflex). Can’t be used again for 1d4 rounds.';
      else if (a.act === 'screech') text = 'Creatures within ' + a.r + ' feet must succeed at a DC ' + a.dc + ' Will save or become frightened.';
      else if (a.act === 'monsterCharge') text = 'Stride twice, then Strike' + (a.bonus ? ' with a +' + a.bonus + ' circumstance bonus' : '') + (a.dmg ? ', dealing ' + a.dmg + ' extra damage' : '') + '.';
      else if (a.act === 'swipe') text = 'One melee attack roll compared against up to two adjacent foes.';
      else if (a.act === 'frenzy') text = 'Two claw Strikes and one jaws or tail Strike.';
    } else if (ABIL_REACT[id]) cost = 'r';
    return { name: a.name, cost, traits, text, auto: true };
  }).filter(Boolean);
};
const abilHTML = list => list.map(a => '<div class="abil' + (a.auto ? ' auto' : '') + '"><b>' + esc(a.name) + '</b>' + (a.cost != null && a.cost !== '' ? '<span class="act">' + App.costGlyph(a.cost) + '</span>' : '') + (a.traits && a.traits.length ? ' <span class="tr">(' + esc(a.traits.join(', ')) + ')</span>' : '') + '<span class="mk" title="' + (a.auto ? 'Resolved automatically by the rules engine' : 'Shown for reference; not automated') + '">' + (a.auto ? ico('check', 10) + 'auto' : 'ref') + '</span>' + (a.text ? '<p>' + esc(a.text) + '</p>' : '') + '</div>').join('');
App.abilHTML = abilHTML;
const statsGrid = arr => '<div class="stats">' + arr.map(([k, v, c]) => '<div class="stat' + (c ? ' ' + c : '') + '"><small>' + k + '</small><b>' + v + '</b></div>').join('') + '</div>';
App.statsGrid = statsGrid;
App.creatureBlock = (c, adj) => {
  const x = D.adjustCreature(c, adj);
  let h = '<div class="sb"><div class="sb-head">' + App.emblem(c, { foe: true, size: 'lg' }) + '<div class="nm"><h3>' + esc(x.name) + '</h3>' + (x.desc ? '<div class="sub">' + esc(x.desc) + '</div>' : '') + '</div><span class="kind">Creature ' + x.lvl + '</span></div>';
  h += traitHTML([x.rarity && x.rarity !== 'common' ? x.rarity : null, x.size].concat(x.traits));
  h += statsGrid([['AC', x.ac, 'ac'], ['HP', x.hp, 'hp'], ['Fort', App.sgn(x.fort)], ['Ref', App.sgn(x.ref)], ['Will', App.sgn(x.will)], ['Perc', App.sgn(x.per)]]);
  h += '<div class="line"><b>Speed</b> ' + Object.entries(x.speed).map(([k, v]) => (k === 'land' ? '' : k + ' ') + v + ' feet').join(', ') + '</div>';
  if (Object.keys(x.skills || {}).length) h += '<div class="line"><b>Skills</b> ' + Object.entries(x.skills).map(([k, v]) => U.cap(k) + ' ' + App.sgn(v)).join(', ') + '</div>';
  if (x.attr) h += '<div class="line"><span class="num">' + PF.ATTR.map(a => '<b class="l">' + U.cap(a) + '</b> ' + App.sgn(x.attr[a] || 0)).join(', ') + '</span></div>';
  if (x.immune && x.immune.length) h += '<div class="line"><b>Immunities</b> ' + esc(x.immune.join(', ')) + '</div>';
  if (Object.keys(x.resist || {}).length) h += '<div class="line"><b>Resistances</b> ' + Object.entries(x.resist).map(([k, v]) => esc(k) + ' ' + v).join(', ') + '</div>';
  if (Object.keys(x.weak || {}).length) h += '<div class="line"><b>Weaknesses</b> ' + Object.entries(x.weak).map(([k, v]) => esc(k) + ' ' + v).join(', ') + '</div>';
  h += '<hr>';
  App._sbC = c; x.strikes.forEach(s => { h += strikeLine(s); }); App._sbC = null;
  if (x.spells) h += '<div class="line"><b>' + U.cap(x.spells.trad) + ' Innate Spells</b> DC ' + x.spells.dc + ', attack ' + App.sgn(x.spells.atk) + '; ' + x.spells.list.map(s => esc(D.spells[s.id].name) + ' <span class="dim">(' + s.uses + '/battle)</span>').join(', ') + '; <b>Cantrips</b> ' + x.spells.cantrips.map(id => esc(D.spells[id].name)).join(', ') + '</div>';
  const ab = App.creatureAbilities(c);
  if (ab.length) h += '<hr>' + abilHTML(ab.map(a => a.text && x.abilDC && /DC \d+/.test(a.text) ? Object.assign({}, a, { text: a.text.replace(/DC (\d+)/g, (m, d) => 'DC ' + (+d + x.abilDC)) }) : a));
  return h + '</div>';
};
App.sheetBlock = S => {
  const ac = S.ac.base + S.ac.item;
  let h = '<div class="sb"><div class="sb-head">' + App.emblem({ cls: S.cls }, { size: 'lg' }) + '<div class="nm"><h3>' + esc(S.name) + '</h3><div class="sub">' + esc([S.herName || S.ancName, S.bgName, S.clsName + (S.subName ? ' (' + S.subName + ')' : '')].join(' · ')) + '</div></div><span class="kind">Level ' + S.level + '</span></div>';
  h += traitHTML([S.size].concat(S.traits || []));
  h += statsGrid([['HP', S.maxHP, 'hp'], ['AC', ac, 'ac'], ['Fort', App.sgn(S.saves.fort.base + S.saves.fort.item)], ['Ref', App.sgn(S.saves.ref.base + S.saves.ref.item)], ['Will', App.sgn(S.saves.will.base + S.saves.will.item)], ['Perc', App.sgn(S.per.base)], ['Speed', S.speed], ['Class DC', S.classDC]].concat(S.spellDC ? [['Spell DC', S.spellDC]] : []));
  h += '<div class="line"><span class="num">' + PF.ATTR.map(a => '<b class="l">' + U.cap(a) + '</b> ' + App.sgn(S.attr[a])).join(', ') + '</span></div>';
  h += '<div class="line"><b>Skills</b> ' + Object.keys(S.skills).filter(k => S.skills[k] > 0).map(k => U.cap(k) + ' ' + App.sgn(S.sk[k].base) + ' <span class="dim">' + PF.RANK[S.skills[k]] + '</span>').join(', ') + '</div>';
  h += '<div class="line"><b>Proficiency</b> <span class="dim">' + ['per', 'fort', 'ref', 'will', 'simple', 'martial', 'unarmored', 'light', 'medium', 'heavy', 'spell', 'classDC'].filter(k => S.prof[k]).map(k => ({ per: 'Perception', fort: 'Fort', ref: 'Ref', will: 'Will', classDC: 'Class DC', spell: 'Spells' }[k] || U.cap(k)) + ' ' + PF.RANK[S.prof[k]]).join(', ') + '</span></div>';
  h += '<div class="line"><b>Gear</b> ' + esc(S.armor.name) + (S.shield ? ', ' + esc(S.shield.name) + ' (hardness ' + S.shield.hard + ')' : '') + (S.runes.pot ? ', +' + S.runes.pot + ' weapon potency' : '') + (S.runes.str ? ', ' + ['', 'striking', 'greater striking', 'major striking'][S.runes.str] : '') + (S.runes.arm ? ', +' + S.runes.arm + ' armor' : '') + (S.runes.res ? ', ' + ['', 'resilient', 'greater resilient', 'major resilient'][S.runes.res] : '') + ', ' + esc((D.potions[S.potion] || {}).name || '') + '</div>';
  h += '<hr>';
  S.strikes.forEach(s => { h += strikeLine(s); });
  const feats = S.feats.filter(f => f.id);
  if (feats.length) h += '<div class="line"><b>Feats</b> ' + feats.map(f => esc(f.name) + ' <span class="dim">' + f.lvl + '</span>').join(', ') + '</div>';
  const feat = D.classes[S.cls].features.filter(([l]) => l <= S.level).map(([, id]) => D.feats[id] ? D.feats[id].name : id);
  h += '<div class="line"><b>Class features</b> ' + esc(feat.join(', ')) + '</div>';
  if (S.spells) {
    const sp = S.spells;
    h += '<hr><div class="line"><b>' + U.cap(sp.trad) + ' ' + (sp.kind === 'prepared' ? 'Prepared' : 'Spontaneous') + ' Spells</b> DC ' + sp.dc + ', attack ' + App.sgn(sp.atk) + '</div>';
    const byR = {};
    (sp.kind === 'prepared' ? sp.prepared : sp.rep).forEach(e => { (byR[e.rank] = byR[e.rank] || []).push(D.spells[e.id].name); });
    Object.keys(byR).sort((a, b) => b - a).forEach(r => { h += '<div class="line ind"><b>' + PF.ordinal(+r) + '</b> ' + (sp.slots && sp.slots[r] ? '<span class="dim">(' + sp.slots[r].max + ' slots)</span> ' : '') + esc(byR[r].join(', ')) + '</div>'; });
    h += '<div class="line ind"><b>Cantrips (' + PF.ordinal(sp.cantripRank) + ')</b> ' + esc(sp.cantrips.map(id => D.spells[id].name).join(', ')) + '</div>';
    if (sp.font) h += '<div class="line ind"><b>Divine font</b> ' + sp.font.max + ' × ' + D.spells[sp.font.id].name + ' (' + PF.ordinal(sp.font.rank) + ')</div>';
    if (sp.sig && sp.sig.length) h += '<div class="line ind"><b>Signature</b> ' + esc(sp.sig.map(id => D.spells[id].name).join(', ')) + '</div>';
  }
  if (S.comps && S.comps.length) h += '<div class="line"><b>Compositions</b> ' + esc(S.comps.map(id => D.spells[id].name).join(', ')) + '</div>';
  if (S.focus && S.focus.max) h += '<div class="line"><b>Focus Spells</b> <span class="dim">(' + S.focus.max + ' Focus Point' + (S.focus.max > 1 ? 's' : '') + ')</span> ' + esc(S.focus.spells.map(id => D.spells[id] ? D.spells[id].name : id).join(', ')) + '</div>';
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
    const t = B.tile(x, y); const c = OC[t.obj] || TC[t.terr] || base;
    g.fillStyle = c; g.fillRect(x * s, y * s, s, s);
    if (t.h > 0 && !t.obj) { g.fillStyle = 'rgba(255,255,255,' + Math.min(0.28, t.h * 0.07) + ')'; g.fillRect(x * s, y * s, s, s); }
  }
  g.fillStyle = 'rgba(75,216,232,.5)'; B.zone.pc.forEach(([x, y]) => g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2));
  g.fillStyle = 'rgba(255,93,85,.5)'; B.zone.foe.forEach(([x, y]) => g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2));
};

/* ---------- setup screen ---------- */
App.partyDefs = () => App.setup.party.map(p => { const d = App.resolveRef(p.ref, App.setup.pl); if (d) d.ai = p.ai; return d; }).filter(Boolean);
App.xpInfo = () => {
  const pl = App.setup.pl, n = Math.max(1, App.setup.party.length);
  const xp = D.encounterXP(App.setup.foes.filter(f => D.creatures[f.id]), pl);
  const th = PF.threatFor(xp, n);
  return { xp, th, n, pl };
};
const threatIdx = th => th.label === 'Beyond Extreme' ? 5 : th.idx;
App.threatTag = th => '<span class="threat-tag t' + threatIdx(th) + '">' + esc(th.label) + '</span>';
App.xpBarHTML = xi => {
  const b = xi.th.budgets; const maxB = b[4] * 1.3;
  const edges = [0, b[1], b[2], b[3], b[4], maxB];
  const names = ['Trivial', 'Low', 'Moderate', 'Severe', 'Extreme'];
  let h = '<div class="zones">' + names.map((n, i) => '<div class="zone z' + i + '" style="width:' + ((edges[i + 1] - edges[i]) / maxB * 100) + '%" title="' + n + ': ' + (i ? b[i] + ' XP' : 'under ' + b[1] + ' XP') + '"><span>' + n + '</span></div>').join('') + '</div>';
  h += '<div class="fill" style="width:' + Math.min(100, xi.xp / maxB * 100) + '%"></div>';
  h += [1, 2, 3, 4].map(i => '<span class="mark" style="left:' + (b[i] / maxB * 100) + '%">' + b[i] + '</span>').join('');
  return h;
};
App.renderSetup = () => {
  const S = App.setup;
  $('#plVal').textContent = S.pl;
  const pl = S.pl;
  // presets
  $('#presetList').innerHTML = D.presets.map(p => { const lead = D.creatures[p.foes[p.foes.length - 1]] || D.creatures[p.foes[0]] || {}; const xp = D.encounterXP(p.foes.filter(f => D.creatures[f]).map(f => ({ id: f })), p.pl); const th = PF.threatFor(xp, 4); return '<button class="preset" data-preset="' + p.id + '">' + App.emblem(lead, { foe: true }) + '<b>' + esc(p.name) + '</b><span class="pm">Level ' + p.pl + ' · ' + esc(D.maps[p.map].name) + ' · ' + App.threatTag(th) + '</span><span class="pd">' + esc(p.desc) + '</span></button>'; }).join('');
  // party
  $('#partyList').innerHTML = S.party.length ? S.party.map((p, i) => {
    const sh = App.sheetFor(p.ref, pl); if (!sh) return '';
    const st = sh.strikes[0];
    return '<div class="item">' + App.emblem({ cls: sh.cls }, { lv: pl }) + '<div class="meta"><b>' + esc(sh.name) + '</b><span>' + esc(sh.ancName + ' ' + sh.clsName + (sh.subName ? ' · ' + sh.subName : '')) + '</span><span class="num">HP ' + sh.maxHP + ' · AC ' + (sh.ac.base + sh.ac.item) + (st ? ' · ' + esc(st.name) + ' ' + App.sgn(st.atk.base + st.atk.item) : '') + (sh.spellDC ? ' · DC ' + sh.spellDC : '') + '</span></div><div class="ctl"><label class="aitog" title="Let the AI control this hero"><input type="checkbox" data-ai="' + i + '"' + (p.ai ? ' checked' : '') + '> AI</label><button class="btn tiny ghost" data-view="' + i + '" title="View character sheet">Sheet</button><button class="x" data-rm="' + i + '" aria-label="Remove ' + esc(sh.name) + '">×</button></div></div>';
  }).join('') : '<div class="empty">No heroes yet. Add up to six.</div>';
  // budget
  const xi = App.xpInfo();
  $('#xpLabel').innerHTML = App.threatTag(xi.th) + ' <span class="num">' + xi.xp + ' XP</span>';
  $('#xpBar').innerHTML = App.xpBarHTML(xi);
  $('#xpBar').title = 'Encounter budget for ' + xi.n + ' heroes of level ' + pl + ': ' + xi.xp + ' XP (' + xi.th.label + ')';
  // foes
  $('#foeList').innerHTML = S.foes.length ? S.foes.map((f, i) => {
    const c0 = D.creatures[f.id]; if (!c0) return '';
    const c = D.adjustCreature(c0, f.adj); const xp = PF.creatureXP(c.lvl, pl);
    return '<div class="item foe">' + App.emblem(c0, { foe: true, lv: c.lvl }) + '<div class="meta"><b>' + esc(c.name) + (c0.generated ? '<span class="badge-t gen">custom</span>' : '') + '</b><span class="num">Level ' + c.lvl + ' · AC ' + c.ac + ' · HP ' + c.hp + ' · <span class="xp' + (c.lvl - pl > 4 ? ' hi' : '') + '">' + (c.lvl - pl > 4 ? 'beyond table' : c.lvl - pl < -4 ? '0 XP' : xp + ' XP') + '</span></span></div><div class="ctl"><div class="seg" role="group" aria-label="Adjustment">' + [['weak', 'Weak'], [null, 'Base'], ['elite', 'Elite']].map(([a, l]) => '<button data-adj="' + i + ':' + (a || '') + '" class="' + (f.adj === a ? 'on ' + (a || '') : '') + '">' + l + '</button>').join('') + '</div><button class="btn tiny ghost" data-fview="' + i + '">Stats</button><button class="x" data-frm="' + i + '" aria-label="Remove ' + esc(c.name) + '">×</button></div></div>';
  }).join('') : '<div class="empty">No opposition. Add creatures from the bestiary or generate an encounter.</div>';
  // summary
  $('#setupSum').innerHTML = '<span class="pill">' + ico('users', 14) + S.party.length + ' hero' + (S.party.length === 1 ? '' : 'es') + '</span><span class="pill">Level <b class="num">' + pl + '</b></span><span class="pill">' + ico('skull', 14) + S.foes.length + ' · ' + App.threatTag(xi.th) + '</span><span class="pill">' + ico('map', 14) + esc((D.maps[S.map] || {}).name || '') + '</span>';
  App.renderBestiary();
  // maps
  const ml = $('#mapList');
  if (!ml.dataset.built) {
    ml.innerHTML = D.mapOrder.map(id => '<button class="mapcard" data-map="' + id + '"><canvas></canvas><b>' + esc(D.maps[id].name) + '</b>' + (D.maps[id].size ? '<span class="msz">' + esc(D.maps[id].size) + '</span>' : '') + '<span>' + esc(D.maps[id].desc) + '</span></button>').join('');
    $$('.mapcard', ml).forEach(b => App.drawMinimap($('canvas', b), b.dataset.map));
    ml.dataset.built = '1';
  }
  $$('.mapcard', ml).forEach(b => { b.classList.toggle('on', b.dataset.map === S.map); b.setAttribute('aria-pressed', b.dataset.map === S.map); });
  $('#genThreat').value = S.threat; $('#genTheme').value = S.theme;
  App.saveSetup();
};
App.themes = () => { const s = new Set(); Object.values(D.creatures).forEach(c => (c.theme || []).forEach(t => s.add(t))); return ['any'].concat([...s].sort()); };

/* ---------- bestiary (filterable, virtualized) ---------- */
// Keep this in sync with .brow: virtual rows must not overlap on touch screens.
const ROW_H = 56;
App.bf = { q: '', tag: 'any', size: 'any', lmin: '', lmax: '', sort: 'lvl', group: true, sel: null };
App.bestiaryTags = () => {
  const cnt = {}; Object.values(D.creatures).forEach(c => (c.traits || []).forEach(t => { cnt[t] = (cnt[t] || 0) + 1; }));
  const traits = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || a.localeCompare(b)).slice(0, 80).sort();
  return { themes: App.themes().slice(1), traits };
};
App.bestiaryList = () => {
  const f = App.bf; const q = f.q.trim().toLowerCase(); const pl = App.setup.pl;
  const lmin = f.lmin === '' ? -99 : +f.lmin, lmax = f.lmax === '' ? 99 : +f.lmax;
  const list = Object.values(D.creatures).filter(c => {
    if (c.lvl < lmin || c.lvl > lmax) return false;
    if (f.size !== 'any' && c.size !== f.size) return false;
    if (f.tag !== 'any') {
      const [k, v] = f.tag.split(':');
      if (k === 'th' && !(c.theme || []).includes(v)) return false;
      if (k === 'tr' && !(c.traits || []).includes(v)) return false;
      if (k === 'custom' && !c.generated) return false;
    }
    if (q && !(c.name.toLowerCase().includes(q) || (c.traits || []).some(t => t.includes(q)) || (c.theme || []).some(t => t.includes(q)))) return false;
    return true;
  });
  const xp = c => PF.creatureXP(c.lvl, pl);
  list.sort(f.sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : f.sort === 'xp' ? (a, b) => xp(b) - xp(a) || a.name.localeCompare(b.name) : (a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name));
  const items = [];
  if (f.group && f.sort === 'lvl') { let cur = null; list.forEach(c => { if (c.lvl !== cur) { cur = c.lvl; items.push({ grp: c.lvl, n: list.filter(x => x.lvl === cur).length }); } items.push({ c }); }); }
  else list.forEach(c => items.push({ c }));
  return { list, items };
};
App.renderBestiary = () => {
  const host = $('#bList'); if (!host) return;
  const r = App.bestiaryList(); App._bItems = r.items;
  $('#bCount').textContent = r.list.length + ' of ' + Object.keys(D.creatures).length + ' creatures';
  host.innerHTML = '<div class="vpad" style="height:' + (r.items.length * ROW_H) + 'px"></div>' + (r.items.length ? '' : '<div class="bestiary-empty">No creatures match these filters.</div>');
  App._bRendered = null; App.paintBestiary(true);
};
App.paintBestiary = force => {
  const host = $('#bList'); const items = App._bItems || []; if (!host) return;
  const pad = host.firstChild; if (!pad) return;
  const top = host.scrollTop, h = host.clientHeight || 380;
  const a = Math.max(0, Math.floor(top / ROW_H) - 6), b = Math.min(items.length, Math.ceil((top + h) / ROW_H) + 6);
  const key = a + ':' + b + ':' + (App.bf.sel || '');
  if (!force && App._bRendered === key) return; App._bRendered = key;
  const pl = App.setup.pl;
  let html = '';
  for (let i = a; i < b; i++) {
    const it = items[i]; const y = i * ROW_H;
    if (it.grp != null) { const xp = PF.creatureXP(it.grp, pl); const d = it.grp - pl; html += '<div class="brow grp" style="top:' + y + 'px"><span>Level</span><b>' + it.grp + '</b><span class="dim">' + it.n + ' · ' + (d < -4 ? 'no XP' : d > 4 ? 'beyond the table' : xp + ' XP each at party level ' + pl) + '</span></div>'; continue; }
    const c = it.c; const xp = PF.creatureXP(c.lvl, pl); const d = c.lvl - pl;
    const tr = (c.traits || []).filter(t => t !== c.size).slice(0, 4).join(' · ');
    html += '<div class="brow' + (App.bf.sel === c.id ? ' on' : '') + '" role="listitem" style="top:' + y + 'px" data-bopen="' + esc(c.id) + '"><div class="lv">' + c.lvl + '</div><div class="nm"><b>' + esc(c.name) + (c.generated ? '<span class="badge-t gen">custom</span>' : '') + (c.rarity && c.rarity !== 'common' ? '<span class="badge-t">' + esc(c.rarity) + '</span>' : '') + '</b><small>' + esc(tr) + '</small></div><span class="sz">' + esc(c.size) + '</span><span class="xp' + (d < -4 ? ' off' : d > 4 ? ' hi' : '') + '">' + (d < -4 ? 'trivial' : d > 4 ? 'too strong' : xp + ' XP') + '</span><span class="act"><button class="btn tiny ghost" data-binfo="' + esc(c.id) + '" title="Stat block" aria-label="Stat block for ' + esc(c.name) + '">' + ico('info', 15) + '</button><button class="btn tiny" data-badd="' + esc(c.id) + '" title="Add to encounter" aria-label="Add ' + esc(c.name) + '">' + ico('plus', 15) + '</button></span></div>';
  }
  // keep spacer, replace rows
  while (pad.nextSibling) host.removeChild(pad.nextSibling);
  pad.insertAdjacentHTML('afterend', html || (items.length ? '' : '<div class="bestiary-empty">No creatures match these filters.</div>'));
};
App.openFly = id => {
  const c = D.creatures[id]; if (!c) return;
  App.bf.sel = id; App.paintBestiary(true);
  const pl = App.setup.pl; const xp = PF.creatureXP(c.lvl, pl); const d = c.lvl - pl;
  const el = $('#bFly');
  el.innerHTML = '<div class="row" style="justify-content:space-between"><span class="label">Bestiary · ' + (d < -4 ? 'trivial at level ' + pl : d > 4 ? 'beyond the XP table at level ' + pl : xp + ' XP at party level ' + pl) + '</span><button class="x" id="flyClose" aria-label="Close">×</button></div>' + App.creatureBlock(c) +
    '<div class="fly-actions"><button class="btn primary" data-fadd="">' + ico('plus', 16) + ' Add</button><button class="btn" data-fadd="elite">Add elite</button><button class="btn" data-fadd="weak">Add weak</button></div>';
  el.hidden = false; App.flyOpen = true;
  $('#flyClose', el).onclick = App.closeFly;
  $$('[data-fadd]', el).forEach(b => b.onclick = () => { App.setup.foes.push({ id, adj: b.dataset.fadd || null }); App.renderSetup(); App.toast('Added ' + (b.dataset.fadd ? U.cap(b.dataset.fadd) + ' ' : '') + c.name + '.'); });
};
App.closeFly = () => { const el = $('#bFly'); if (el) el.hidden = true; App.flyOpen = false; if (App.bf.sel) { App.bf.sel = null; App.paintBestiary(true); } };

App.loadPreset = id => {
  const p = D.presets.find(x => x.id === id); if (!p) return;
  App.setup.pl = p.pl; App.setup.map = p.map; App.setup.foes = p.foes.map(f => ({ id: f, adj: null }));
  if (!App.setup.party.length) App.setup.party = App.defaultParty();
  App.renderSetup(); App.showDiorama(p.map);
};
const heroCard = r => { const cls = D.classes[r.d.cls]; return '<button class="rchar" data-pick="' + r.ref + '">' + App.emblem({ cls: r.d.cls }) + '<div><b>' + esc(r.d.name) + '</b><span>' + esc(D.ancestries[r.d.anc].name + ' ' + cls.name) + '</span></div></button>'; };
App.heroCard = heroCard;
App.pickHero = () => {
  const ic = D.iconicOrder.map(id => ({ ref: 'iconic:' + id, d: D.iconics[id] })).filter(r => r.d);
  const cu = App.roster.map(c => ({ ref: 'custom:' + c.uid, d: c }));
  App.modal(mhead('Add a hero', 'Party ' + App.setup.party.length + ' / 6') + '<div class="label">Pregenerated heroes</div><div class="pick">' + ic.map(heroCard).join('') + '</div><div class="label">Your characters</div>' + (cu.length ? '<div class="pick">' + cu.map(heroCard).join('') + '</div>' : '<div class="empty">None yet. Build one on the Characters screen.</div>') + '<div class="row gap"><button class="btn" id="mRandom">' + ico('d20', 16) + ' Random hero</button><div class="grow"></div><button class="btn ghost" id="mClose">Close</button></div>', el => {
    $$('[data-pick]', el).forEach(b => b.onclick = () => { if (App.setup.party.length >= 6) { App.toast('The party is full (6).'); return; } App.setup.party.push({ ref: b.dataset.pick, ai: false }); App.closeModal(); App.renderSetup(); });
    $('#mRandom', el).onclick = () => { if (App.setup.party.length >= 6) { App.toast('The party is full (6).'); return; } const d = PF.Build.random(App.setup.pl); d.uid = U.uid('c'); delete d.level; App.roster.push(d); App.saveRoster(); App.setup.party.push({ ref: 'custom:' + d.uid, ai: false }); App.closeModal(); App.renderSetup(); };
    $('#mClose', el).onclick = App.closeModal;
  });
};
App.bindSetup = () => {
  $('#plUp').onclick = () => { App.setup.pl = Math.min(20, App.setup.pl + 1); App.renderSetup(); };
  $('#plDown').onclick = () => { App.setup.pl = Math.max(1, App.setup.pl - 1); App.renderSetup(); };
  $('#btnAddHero').onclick = App.pickHero;
  $('#btnIconicParty').onclick = () => { App.setup.party = App.defaultParty(); App.renderSetup(); };
  $('#genTheme').innerHTML = App.themes().map(t => '<option value="' + t + '">' + (t === 'any' ? 'Any theme' : U.cap(t)) + '</option>').join('');
  const tags = App.bestiaryTags();
  $('#bTheme').innerHTML = '<option value="any">All traits & themes</option><optgroup label="Themes">' + tags.themes.map(t => '<option value="th:' + esc(t) + '">' + esc(U.cap(t)) + '</option>').join('') + '<option value="custom">Custom (generated)</option></optgroup><optgroup label="Traits">' + tags.traits.map(t => '<option value="tr:' + esc(t) + '">' + esc(U.cap(t)) + '</option>').join('') + '</optgroup>';
  const sizes = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
  $('#bSize').innerHTML = '<option value="any">Any size</option>' + sizes.map(s => '<option value="' + s + '">' + U.cap(s) + '</option>').join('');
  $('#cRole').innerHTML = Object.entries(D.roles).map(([k, r]) => '<option value="' + k + '">' + r.name + '</option>').join('');
  $('#cFlavor').innerHTML = Object.entries(D.flavors).map(([k, r]) => '<option value="' + k + '">' + r.name + '</option>').join('');
  const bf = App.bf; let deb = 0;
  $('#bSearch').oninput = e => { bf.q = e.target.value; clearTimeout(deb); deb = setTimeout(App.renderBestiary, 80); };
  $('#bTheme').onchange = e => { bf.tag = e.target.value; App.renderBestiary(); };
  $('#bSize').onchange = e => { bf.size = e.target.value; App.renderBestiary(); };
  $('#bLvMin').oninput = e => { bf.lmin = e.target.value; App.renderBestiary(); };
  $('#bLvMax').oninput = e => { bf.lmax = e.target.value; App.renderBestiary(); };
  $('#bSort').onchange = e => { bf.sort = e.target.value; App.renderBestiary(); };
  $('#bGroup').onchange = e => { bf.group = e.target.checked; App.renderBestiary(); };
  $('#bReset').onclick = () => { Object.assign(bf, { q: '', tag: 'any', size: 'any', lmin: '', lmax: '', sort: 'lvl', group: true }); $('#bSearch').value = ''; $('#bTheme').value = 'any'; $('#bSize').value = 'any'; $('#bLvMin').value = ''; $('#bLvMax').value = ''; $('#bSort').value = 'lvl'; $('#bGroup').checked = true; App.renderBestiary(); };
  let raf = 0; $('#bList').addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; App.paintBestiary(); }); }, { passive: true });
  $('#btnGen').onclick = () => { App.setup.threat = $('#genThreat').value; App.setup.theme = $('#genTheme').value; App.setup.foes = D.autoEncounter(App.setup.pl, App.setup.threat, Math.max(1, App.setup.party.length), App.setup.theme); App.renderSetup(); };
  $('#btnClearFoes').onclick = () => { App.setup.foes = []; App.renderSetup(); };
  $('#btnCustom').onclick = () => { const c = D.makeCreature({ level: +$('#cLvl').value || 1, role: $('#cRole').value, flavor: $('#cFlavor').value }); App.setup.foes.push({ id: c.id, adj: null }); App.renderSetup(); };
  $('#setup').addEventListener('click', e => {
    const t = e.target.closest('button,input,[data-bopen]'); if (!t) return;
    const d = t.dataset;
    if (d.preset) App.loadPreset(d.preset);
    if (d.rm != null) { App.setup.party.splice(+d.rm, 1); App.renderSetup(); }
    if (d.view != null) { const sh = App.sheetFor(App.setup.party[+d.view].ref, App.setup.pl); if (sh) App.modal(mhead('Character sheet') + App.sheetBlock(sh) + '<div class="row" style="justify-content:flex-end"><button class="btn" onclick="PF.App.closeModal()">Close</button></div>'); }
    if (d.ai != null) { App.setup.party[+d.ai].ai = t.checked; App.saveSetup(); }
    if (d.frm != null) { App.setup.foes.splice(+d.frm, 1); App.renderSetup(); }
    if (d.adj) { const [i, a] = d.adj.split(':'); App.setup.foes[+i].adj = a || null; App.renderSetup(); }
    if (d.fview != null) { const f = App.setup.foes[+d.fview]; App.modal(mhead('Stat block') + App.creatureBlock(D.creatures[f.id], f.adj) + '<div class="row" style="justify-content:flex-end"><button class="btn" onclick="PF.App.closeModal()">Close</button></div>'); }
    if (d.binfo) { App.openFly(d.binfo); return; }
    if (d.badd) { App.setup.foes.push({ id: d.badd, adj: null }); App.renderSetup(); App.toast('Added ' + D.creatures[d.badd].name + '.'); return; }
    if (d.bopen && !e.target.closest('button')) App.openFly(d.bopen);
    if (d.map) { App.setup.map = d.map; App.renderSetup(); App.showDiorama(d.map); }
  });
  $('#btnDeploy').onclick = () => {
    if (!App.setup.party.length) { App.toast('Add at least one hero.'); return; }
    if (!App.setup.foes.length) { App.toast('Add at least one creature.'); return; }
    App.startBattle({ map: App.setup.map, partyLevel: App.setup.pl, pcs: App.partyDefs(), foes: App.setup.foes.map(f => ({ id: f.id, adj: f.adj })) });
  };
};

/* ---------- diorama (home / setup background) ---------- */
App.showDiorama = mapId => {
  if (!App.R) return;
  const id = mapId || (App.screen === 'home' ? 'chapel' : App.setup.map);
  if (App.dioramaMap === id && !App.B) return;
  if (App.B && App.screen !== 'battle') { App.B = null; App.Battle && App.Battle.teardown(); }
  App.dioramaMap = id;
  const B = PF.Battle({ map: id, pcs: [], foes: [] });
  App.R.loadMap(B); App.applyGrid();
  App.R.cam.gdist = 30; App.R.cam.gpitch = 0.85;
};

/* ---------- boot ---------- */
App.boot = () => {
  App.hydrateIcons();
  if (!G.THREE) { document.getElementById('app').innerHTML = '<div style="padding:24px">The 3D engine (three.js) could not be loaded. Check your connection and reload.</div>'; return; }
  App.R = PF.Render($('#stage'));
  App.R.onFrame = dt => { if (App.screen !== 'battle' && !G.matchMedia('(prefers-reduced-motion: reduce)').matches) App.R.cam.gyaw += dt * 0.05; if (App.Battle && App.screen === 'battle') App.Battle.frame(dt); };
  App.bindSetup();
  App.bindRoster && App.bindRoster();
  App.Battle && App.Battle.bind();
  App.launchPreset = (p, guided = false) => {
    App.setup.pl = p.pl; App.setup.map = p.map; App.setup.foes = p.foes.map(id => ({ id, adj: null }));
    App.setup.party = App.defaultParty(); App.saveSetup();
    $('#autoParty').checked = false;
    App.startBattle({ map: p.map, partyLevel: p.pl, pcs: App.partyDefs(), foes: p.foes.map(id => ({ id })), title: guided ? 'First skirmish' : p.name, guided });
  };
  $('#btnQuick').onclick = () => App.launchPreset(U.pick(D.presets.filter(x => x.id !== 'training' && x.pl <= 3)));
  $('#btnLearn').onclick = () => App.launchPreset(D.presets.find(x => x.id === 'training'), true);
  $('#btnSetup').onclick = () => App.show('setup');
  $('#btnRoster').onclick = () => App.show('roster');
  $('#btnHomeSettings').onclick = App.openSettings;
  $('#btnHomeHelp').onclick = App.openHelp;
  $$('[data-go]').forEach(b => b.onclick = () => App.show(b.dataset.go === 'back' ? (App.prev === 'roster' ? 'home' : App.prev || 'home') : b.dataset.go));
  App.show('home');
  App.showDiorama('chapel');
  App.applySettings();
};
})(typeof window !== 'undefined' ? window : globalThis);
