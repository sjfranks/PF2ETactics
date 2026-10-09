/* core.js — namespace, RNG, dice, typed modifiers, degrees of success */
(function (G) {
'use strict';
const PF = G.PF = G.PF || {};
const U = PF.U = {};

/* ---------- RNG (mulberry32, seedable) ---------- */
let _s = (Date.now() ^ 0x9e3779b9) >>> 0;
U.seed = s => { _s = s >>> 0; };
U.rand = () => {
  _s = (_s + 0x6D2B79F5) >>> 0; let t = _s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
U.d = n => 1 + Math.floor(U.rand() * n);
U.pick = a => a[Math.floor(U.rand() * a.length)];
U.shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(U.rand() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
U.sgn = n => (n >= 0 ? '+' : '−') + Math.abs(n);
U.clone = o => JSON.parse(JSON.stringify(o));
let _uid = 0;
U.uid = (p = 'u') => p + (++_uid).toString(36) + Math.floor(U.rand() * 1e5).toString(36);
U.cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
U.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
U.half = n => Math.floor(n / 2);
U.ceilHalf = n => Math.ceil(n / 2);

/* ---------- dice ---------- */
// "2d6+3" -> {n:2,d:6,m:3,type}
U.dice = (str, type) => {
  const s = String(str).replace(/\s+/g, '');
  const m = s.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (m) return { n: m[1] === '' ? 1 : +m[1], d: +m[2], m: m[3] ? +m[3] : 0, type };
  return { n: 0, d: 0, m: +s || 0, type };
};
U.roll = (n, d) => { let t = 0; const r = []; for (let i = 0; i < n; i++) { const v = U.d(d); r.push(v); t += v; } return { t, r }; };
U.avg = p => (p.n || 0) * ((p.d || 0) + 1) / 2 + (p.m || 0);
U.dstr = p => {
  const dice = p.n ? p.n + 'd' + p.d : '';
  if (!p.m) return dice || '0';
  return dice ? dice + (p.m > 0 ? '+' : '−') + Math.abs(p.m) : String(p.m);
};

/* ---------- typed modifiers ----------
   mod = {t:'circ'|'status'|'item'|'unt', v:number, s:'source'}
   Only the best bonus and worst penalty of each typed category apply; untyped stack. */
PF.sumMods = function (mods) {
  const best = {}, worst = {}; let total = 0; const used = [];
  for (const m of mods) {
    if (!m || !m.v) continue;
    const t = m.t || 'unt';
    if (t === 'unt') { total += m.v; used.push(m); continue; }
    if (m.v > 0) { if (!best[t] || m.v > best[t].v) best[t] = m; }
    else if (!worst[t] || m.v < worst[t].v) worst[t] = m;
  }
  for (const k in best) { total += best[k].v; used.push(best[k]); }
  for (const k in worst) { total += worst[k].v; used.push(worst[k]); }
  return { total, used };
};
PF.modText = used => used.filter(m => m.s && m.s !== 'base').map(m => m.s + ' ' + U.sgn(m.v)).join(', ');

/* ---------- degrees of success ---------- */
PF.DEG = ['Critical Failure', 'Failure', 'Success', 'Critical Success'];
PF.DEGC = ['cf', 'f', 's', 'cs'];
PF.degree = (total, dc, nat) => {
  let d = total >= dc + 10 ? 3 : total >= dc ? 2 : total <= dc - 10 ? 0 : 1;
  if (nat === 20) d = Math.min(3, d + 1); else if (nat === 1) d = Math.max(0, d - 1);
  return d;
};
// probability of each degree for d20+mod vs dc; fortune 1 = roll twice keep higher, -1 = keep lower
PF.pdeg = (mod, dc, fortune = 0) => {
  const p = [0, 0, 0, 0];
  for (let n = 1; n <= 20; n++) {
    let w = 1 / 20;
    if (fortune > 0) w = (2 * n - 1) / 400; else if (fortune < 0) w = (2 * (21 - n) - 1) / 400;
    p[PF.degree(n + mod, dc, n)] += w;
  }
  return p;
};
PF.prof = (rank, level) => rank > 0 ? level + 2 * rank : 0;
PF.RANK = ['U', 'T', 'E', 'M', 'L'];
PF.RANKN = ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary'];

/* ---------- static rules data ---------- */
PF.ATTR = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
PF.ATTRN = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
PF.SKILLS = {
  acrobatics: 'dex', arcana: 'int', athletics: 'str', crafting: 'int', deception: 'cha', diplomacy: 'cha',
  intimidation: 'cha', medicine: 'wis', nature: 'wis', occultism: 'int', performance: 'cha', religion: 'wis',
  society: 'int', stealth: 'dex', survival: 'wis', thievery: 'dex'
};
PF.SIZE = {
  tiny: { sq: 1, h: 0.5, ord: 0 }, small: { sq: 1, h: 0.75, ord: 1 }, medium: { sq: 1, h: 1, ord: 2 },
  large: { sq: 2, h: 2, ord: 3 }, huge: { sq: 3, h: 3, ord: 4 }, gargantuan: { sq: 4, h: 4, ord: 5 }
};
PF.PHYS = { bludgeoning: 1, piercing: 1, slashing: 1 };
PF.DT = { B: 'bludgeoning', P: 'piercing', S: 'slashing' };
// GM Core: simple DCs by level (used for Recall Knowledge, Lingering Composition, climbing etc.)
PF.levelDC = L => {
  const t = [13, 14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35, 36, 38, 39, 40, 42, 44, 46, 48, 50];
  return t[U.clamp(L + 1, 0, t.length - 1)];
};
// Encounter budget (GM Core)
PF.XP_BY_DIFF = { '-4': 10, '-3': 15, '-2': 20, '-1': 30, '0': 40, '1': 60, '2': 80, '3': 120, '4': 160 };
PF.creatureXP = (lvl, pl) => {
  const d = lvl - pl;
  if (d < -4) return 0;
  if (d > 4) return 160 + (d - 4) * 80; // beyond the table: extrapolated, flagged in UI
  return PF.XP_BY_DIFF[String(d)];
};
PF.THREATS = [
  { id: 'trivial', name: 'Trivial', xp: 40, adj: 10 },
  { id: 'low', name: 'Low', xp: 60, adj: 15 },
  { id: 'moderate', name: 'Moderate', xp: 80, adj: 20 },
  { id: 'severe', name: 'Severe', xp: 120, adj: 30 },
  { id: 'extreme', name: 'Extreme', xp: 160, adj: 40 }
];
PF.threatFor = (xp, partySize) => {
  const adj = partySize - 4;
  let label = 'Trivial', idx = 0;
  PF.THREATS.forEach((t, i) => { const b = t.xp + t.adj * adj; if (xp >= b - 0.001) { label = t.name; idx = i; } });
  const ext = PF.THREATS[4].xp + PF.THREATS[4].adj * adj;
  if (xp > ext * 1.25) label = 'Beyond Extreme';
  return { label, idx, budgets: PF.THREATS.map(t => t.xp + t.adj * adj) };
};

})(typeof window !== 'undefined' ? window : globalThis);
