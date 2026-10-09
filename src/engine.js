/* engine.js — battle state, terrain, geometry, modifiers, conditions, checks, damage, turns */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D, U = PF.U;

/* ---------- terrain ---------- */
const TERR = PF.TERR = {
  '.': { name: 'Ground' }, ',': { name: 'Path' }, ':': { name: 'Flagstones' }, '=': { name: 'Bridge planks' },
  '+': { name: 'Stairs', stairs: 1 }, 'R': { name: 'Rooftop' }, 'r': { name: 'Rubble', diff: 1 },
  ';': { name: 'Brush', diff: 1, conceal: 'in' }, '~': { name: 'Mud', diff: 1 }, 'w': { name: 'Shallow water', diff: 1, water: 1 },
  'W': { name: 'Deep water', diff: 2, water: 2 }, 'L': { name: 'Lava', hazard: 'lava' }, 'F': { name: 'Mist', conceal: 'through' }, '_': { name: 'Pit floor' }
};
const OBJ = PF.OBJ = {
  '#': { name: 'Wall', block: 1, los: 1 }, 'P': { name: 'Pillar', block: 1, los: 1 }, 'T': { name: 'Tree', block: 1, cover: 1 },
  's': { name: 'Statue', block: 1, cover: 1 }, 'c': { name: 'Crate', block: 1, cover: 1 }, 'b': { name: 'Barrel', block: 1, cover: 1 },
  'f': { name: 'Low wall', diff: 1, cover: 1 }, 'o': { name: 'Boulder', block: 1, cover: 1 }, 'S': { name: 'Sarcophagus', diff: 1, cover: 1 },
  'A': { name: 'Altar', block: 1, cover: 1 }, 't': { name: 'Table', diff: 1, cover: 1 }
};

/* ---------- conditions ---------- */
PF.COND = {
  frightened: { n: 'Frightened', v: 1, bad: 1, d: 'Status penalty equal to the value to all checks and DCs. Decreases by 1 at the end of each of your turns.' },
  sickened: { n: 'Sickened', v: 1, bad: 1, d: 'Status penalty equal to the value to all checks and DCs. Spend an action to retch (Fortitude save) to reduce it.' },
  clumsy: { n: 'Clumsy', v: 1, bad: 1, d: 'Status penalty to Dexterity-based checks and DCs, including AC, Reflex saves and ranged attacks.' },
  enfeebled: { n: 'Enfeebled', v: 1, bad: 1, d: 'Status penalty to Strength-based rolls: melee attacks, Strength damage and Athletics.' },
  drained: { n: 'Drained', v: 1, bad: 1, d: 'Status penalty to Constitution-based checks (Fortitude); lose HP equal to level × value.' },
  stupefied: { n: 'Stupefied', v: 1, bad: 1, d: 'Status penalty to Will, Perception, spell attacks and spell DCs.' },
  stunned: { n: 'Stunned', v: 1, bad: 1, d: 'Lose actions equal to the value at the start of your turn.' },
  slowed: { n: 'Slowed', v: 1, bad: 1, d: 'Lose actions equal to the value at the start of each of your turns.' },
  offguard: { n: 'Off-Guard', bad: 1, d: '−2 circumstance penalty to AC.' },
  prone: { n: 'Prone', bad: 1, d: 'Off-guard, −2 circumstance penalty to attack rolls. Stand up costs an action (triggers reactions).' },
  grabbed: { n: 'Grabbed', bad: 1, d: 'Off-guard and immobilized. Use Escape to break free.' },
  restrained: { n: 'Restrained', bad: 1, d: 'Off-guard and immobilized; can’t attack except to Escape.' },
  immobilized: { n: 'Immobilized', bad: 1, d: 'You can’t use move actions to change position.' },
  paralyzed: { n: 'Paralyzed', bad: 1, d: 'Off-guard and can’t act.' },
  blinded: { n: 'Blinded', bad: 1, d: 'Everything is hidden to you (DC 11 flat check to target); off-guard.' },
  dazzled: { n: 'Dazzled', bad: 1, d: 'Everything is concealed to you (DC 5 flat check to target).' },
  deafened: { n: 'Deafened', bad: 1, d: '−2 status penalty to Perception; immune to auditory effects.' },
  fleeing: { n: 'Fleeing', bad: 1, d: 'You must spend your actions moving away from the source of your fear.' },
  fatigued: { n: 'Fatigued', bad: 1, d: '−1 status penalty to AC and saves.' },
  unconscious: { n: 'Unconscious', bad: 1, d: '−4 status penalty to AC, Perception and Reflex; off-guard, prone, can’t act.' },
  dying: { n: 'Dying', v: 1, bad: 1, d: 'You die at dying 4. Recovery check (DC 10 + dying) each turn.' },
  wounded: { n: 'Wounded', v: 1, bad: 1, d: 'Gaining dying adds your wounded value.' },
  quickened: { n: 'Quickened', d: 'An extra action each turn (limited by the source).' }
};
const SAVES = ['fort', 'ref', 'will'];
const CHECKS = ['atk', 'ac', 'fort', 'ref', 'will', 'per', 'spellatk', 'spelldc', 'classdc'];

/* ---------- geometry helpers ---------- */
// Liang–Barsky segment/rect clip; returns [t0,t1] or null
function clip(p, q, x0, y0, x1, y1) {
  let t0 = 0, t1 = 1; const dx = q.x - p.x, dy = q.y - p.y;
  const tests = [[-dx, p.x - x0], [dx, x1 - p.x], [-dy, p.y - y0], [dy, y1 - p.y]];
  for (const [pp, qq] of tests) {
    if (pp === 0) { if (qq < 0) return null; continue; }
    const r = qq / pp;
    if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [t0, t1];
}
function sidesOf(pt, x0, y0, x1, y1) {
  const e = 1e-6, s = [];
  if (Math.abs(pt.x - x0) < e) s.push('L'); if (Math.abs(pt.x - x1) < e) s.push('R');
  if (Math.abs(pt.y - y0) < e) s.push('T'); if (Math.abs(pt.y - y1) < e) s.push('B');
  return s;
}

PF.Battle = function (cfg) {
  const B = { units: [], round: 0, turnIdx: -1, order: [], events: [], over: null, cfg, cur: null, phase: 'deploy', terrainFx: [] };
  B.pl = cfg.partyLevel || 1;

  /* ===== events & log ===== */
  B.emit = e => { B.events.push(e); };
  B.log = (text, cls, det) => B.emit({ t: 'log', text, cls: cls || '', det: det || '' });
  B.nm = u => u ? u.name : '?';
  B.drain = () => { const e = B.events; B.events = []; return e; };
  B.snap = u => ({ hp: u.hp, maxHP: B.maxHP(u), temp: u.temp, dying: u.dying || 0, dead: !!u.dead, down: !!(u.dead || B.cv(u, 'unconscious')), prone: !!B.cv(u, 'prone'), conds: B.condList(u), shield: !!(u.shield && u.shield.raised), x: u.x, y: u.y, sq: u.sq });
  B.touch = u => B.emit({ t: 'state', u: u.id, s: B.snap(u) });

  /* ===== map ===== */
  const map = D.maps[cfg.map] || D.maps.yard;
  B.map = map;
  const rows = map.t.map(r => r.replace(/\|/g, ''));
  B.W = rows[0].length; B.H = rows.length;
  const hRows = map.h ? map.h.map(r => r.replace(/\|/g, '')) : null;
  const hR = {}; if (map.hrows) Object.keys(map.hrows).forEach(k => { hR[k] = map.hrows[k].replace(/\|/g, ''); });
  B.tiles = [];
  for (let y = 0; y < B.H; y++) {
    const row = [];
    for (let x = 0; x < B.W; x++) {
      const ch = rows[y][x] || '.';
      const obj = OBJ[ch] ? ch : null; const terr = obj ? '.' : (TERR[ch] ? ch : '.');
      let h = map.hbase || 0;
      if (map.hdef && map.hdef[ch] != null) h = map.hdef[ch];
      if (hRows) h = +hRows[y][x] || 0;
      else if (hR[y] && /\d/.test(hR[y][x])) h = +hR[y][x];
      const T = TERR[terr], O = obj ? OBJ[obj] : {};
      row.push({ x, y, ch, terr, obj, h, diff: Math.max(T.diff || 0, O.diff || 0), block: !!O.block, los: !!O.los, cover: !!O.cover, conceal: T.conceal || null, hazard: T.hazard || null, stairs: !!T.stairs, water: T.water || 0 });
    }
    B.tiles.push(row);
  }
  B.tile = (x, y) => (x >= 0 && y >= 0 && x < B.W && y < B.H) ? B.tiles[y][x] : null;

  /* ===== units ===== */
  B.get = id => B.units.find(u => u.id === id) || null;
  B.alive = u => !!u && !u.dead;
  B.conscious = u => B.alive(u) && !B.cv(u, 'unconscious') && u.hp > 0;
  B.canAct = u => B.conscious(u) && !B.cv(u, 'paralyzed');
  B.isUndead = u => u.traits.includes('undead');
  B.isLiving = u => !B.isUndead(u) && !u.traits.includes('construct');
  B.immuneTo = (u, trait) => (u.immune || []).includes(trait) || (trait === 'mental' && u.traits.includes('mindless'));
  B.foesOf = u => B.units.filter(t => t.team !== u.team && B.alive(t));
  B.alliesOf = u => B.units.filter(t => t.team === u.team && B.alive(t) && t !== u);
  B.maxHP = u => Math.max(1, u.maxHP - (B.cv(u, 'drained') * Math.max(1, u.level)));
  B.elev = u => { let h = 0; B.cellsOf(u).forEach(([x, y]) => { const t = B.tile(x, y); if (t) h = Math.max(h, t.h); }); return h; };

  B.addUnit = (u, team) => {
    u.team = team; u.x = -1; u.y = -1; u.fx = []; u.cond = {}; u.persist = []; u.dying = 0; u.dead = false; u.react = 1; u.reactX = {};
    u.hiddenFrom = new Set(); u.enc = { demoImmune: {}, medImmune: false, rechargeAt: {}, used: {} }; u.turn = { acts: 0, attacks: 0 }; u.hasActed = false;
    u.speed = u.speed || { land: 25 };
    u.temp = u.temp || 0; u.hero = u.hero || 0;
    if (u.flags.zombieSlow) u.cond.slowed = { v: 1, exp: null, perm: true };
    B.units.push(u); return u;
  };
  (cfg.pcs || []).forEach(def => { const S = def.sheet ? def.sheet : PF.Build.make(def); const u = PF.Build.unitFromSheet(S, 'pc'); u.ai = !!def.ai; B.addUnit(u, 'pc'); });
  (cfg.foes || []).forEach(f => { const c = D.creatures[f.id]; if (!c) return; const u = D.unitFromCreature(c, f.adj); u.ai = true; B.addUnit(u, 'foe'); });
  // disambiguate duplicate names
  const cnt = {}; B.units.forEach(u => { cnt[u.name] = (cnt[u.name] || 0) + 1; });
  const seen = {}; B.units.forEach(u => { if (cnt[u.name] > 1) { seen[u.name] = (seen[u.name] || 0) + 1; u.name = u.name + ' ' + seen[u.name]; } });

  B.cellsOf = (u, x = u.x, y = u.y) => { const c = []; for (let i = 0; i < u.sq; i++) for (let j = 0; j < u.sq; j++) c.push([x + i, y + j]); return c; };
  B.unitAt = (x, y, except) => B.units.find(u => u !== except && B.alive(u) && x >= u.x && x < u.x + u.sq && y >= u.y && y < u.y + u.sq) || null;
  B.bodyAt = (x, y) => B.units.find(u => !u.removed && x >= u.x && x < u.x + u.sq && y >= u.y && y < u.y + u.sq) || null;
  B.flies = u => !!(u.speed && u.speed.fly);
  // can the unit's footprint stand at x,y
  B.fits = (u, x, y, ignoreUnits) => {
    let h0 = null;
    for (const [cx, cy] of B.cellsOf(u, x, y)) {
      const t = B.tile(cx, cy); if (!t || t.block) return false;
      if (h0 == null) h0 = t.h; else if (Math.abs(t.h - h0) > 1 && !B.flies(u)) return false;
      if (!ignoreUnits) { const o = B.unitAt(cx, cy, u); if (o) return false; }
    }
    return true;
  };

  /* ===== deployment ===== */
  const zoneCells = zs => { const out = []; (zs || []).forEach(([x0, y0, x1, y1]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]); }); return out; };
  B.zone = { pc: zoneCells(map.pz), foe: zoneCells(map.ez) };
  B.place = (u, x, y) => { u.x = x; u.y = y; };
  B.deploy = () => {
    ['pc', 'foe'].forEach(team => {
      const cells = U.shuffle(B.zone[team].slice());
      const list = B.units.filter(u => u.team === team).sort((a, b) => b.sq - a.sq);
      list.forEach(u => {
        let spot = cells.find(([x, y]) => B.fits(u, x, y));
        if (!spot) { // fall back: nearest legal tile to zone centre
          const all = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) if (B.fits(u, x, y)) all.push([x, y]);
          const c = cells[0] || [B.W / 2, team === 'pc' ? B.H - 2 : 1];
          all.sort((a, b) => (Math.abs(a[0] - c[0]) + Math.abs(a[1] - c[1])) - (Math.abs(b[0] - c[0]) + Math.abs(b[1] - c[1])));
          spot = all[0];
        }
        if (spot) B.place(u, spot[0], spot[1]);
      });
    });
  };
  B.inZone = (u, x, y) => B.cellsOf(u, x, y).every(([cx, cy]) => B.zone[u.team].some(([zx, zy]) => zx === cx && zy === cy));
  B.redeploy = (u, x, y) => {
    if (B.phase !== 'deploy' || !B.inZone(u, x, y)) return false;
    const other = B.unitAt(x, y, u);
    if (other && other.team === u.team && other.sq === u.sq) { const ox = u.x, oy = u.y; other.x = ox; other.y = oy; u.x = x; u.y = y; return true; }
    if (!B.fits(u, x, y)) return false;
    u.x = x; u.y = y; return true;
  };

  /* ===== distance, reach ===== */
  B.gapSq = (a, b) => {
    const dx = Math.max(0, b.x - (a.x + a.sq - 1), a.x - (b.x + b.sq - 1));
    const dy = Math.max(0, b.y - (a.y + a.sq - 1), a.y - (b.y + b.sq - 1));
    return [dx, dy];
  };
  const feet = (dx, dy) => 5 * (Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2));
  B.feet = feet;
  B.dist = (a, b) => {
    const [dx, dy] = B.gapSq(a, b);
    const dz = (B.flies(a) || B.flies(b)) ? 0 : Math.abs(B.elev(a) - B.elev(b));
    const h = Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2);
    return 5 * (Math.max(h, dz) + Math.floor(Math.min(h, dz) / 2));
  };
  B.distPt = (a, x, y) => { const p = { x, y, sq: 1 }; const [dx, dy] = B.gapSq(a, p); return feet(dx, dy); };
  B.inReach = (a, t, reach) => {
    if (!t || a === t) return false;
    const [dx, dy] = B.gapSq(a, t);
    const dz = (B.flies(a) || B.flies(t)) ? 0 : Math.abs(B.elev(a) - B.elev(t));
    if (reach === 10 && dx === 2 && dy === 2 && dz === 0) return true;
    return B.dist(a, t) <= reach;
  };
  B.reachOf = (u, s) => {
    let r = s ? (s.reach || 5) : Math.max(5, ...u.strikes.filter(x => x.kind === 'melee').map(x => x.reach || 5));
    if (u.fx.some(f => f.key === 'giantsStature')) r += 5;
    return r;
  };
  B.unitsWithin = (u, ft) => B.units.filter(t => B.alive(t) && (t === u || B.dist(u, t) <= ft));
  B.center = u => ({ x: u.x + u.sq / 2, y: u.y + u.sq / 2, z: B.elev(u) + (u.sq > 1 ? 1.4 : 0.8) });

  /* ===== line of effect, cover, concealment ===== */
  B.trace = (src, dst, o = {}) => {
    // src/dst: units or points {x,y,z,pt:true}
    const p = src.pt ? src : B.center(src), q = dst.pt ? dst : B.center(dst);
    const len = Math.hypot(q.x - p.x, q.y - p.y); const n = Math.max(2, Math.ceil(len / 0.2));
    const res = { blocked: false, cover: 0, conceal: false, by: [] };
    const inFoot = (u, x, y) => u && !u.pt && x >= u.x && x < u.x + u.sq && y >= u.y && y < u.y + u.sq;
    const nearFoot = (u, x, y) => { if (!u || u.pt) return false; return x >= u.x - 1 && x <= u.x + u.sq && y >= u.y - 1 && y <= u.y + u.sq; };
    const seenTiles = new Set();
    for (let i = 1; i < n; i++) {
      const f = i / n; const x = p.x + (q.x - p.x) * f, y = p.y + (q.y - p.y) * f, z = p.z + (q.z - p.z) * f;
      const tx = Math.floor(x), ty = Math.floor(y); const key = tx + ',' + ty;
      if (inFoot(src, tx, ty) || inFoot(dst, tx, ty)) continue;
      const t = B.tile(tx, ty); if (!t) { res.blocked = true; break; }
      if (t.los) { res.blocked = true; break; }
      if (t.h > z + 0.05) { res.blocked = true; break; }
      if (seenTiles.has(key)) continue; seenTiles.add(key);
      if (t.cover && (!nearFoot(src, tx, ty) || nearFoot(dst, tx, ty))) { res.cover = Math.max(res.cover, 2); res.by.push(OBJ[t.obj].name); }
      if (t.conceal === 'through') res.conceal = true;
      const occ = B.unitAt(tx, ty);
      if (occ && occ !== src && occ !== dst && !o.ignoreCreatures && B.alive(occ)) { res.cover = Math.max(res.cover, 1); }
    }
    if (!dst.pt) {
      // target standing in concealing terrain
      for (const [cx, cy] of B.cellsOf(dst)) { const t = B.tile(cx, cy); if (t && t.conceal) res.conceal = true; }
    }
    return res;
  };
  B.lineOfEffect = (a, b) => !B.trace(a, b).blocked;
  B.cornerPt = (gx, gy) => { let h = 0; [[gx - 1, gy - 1], [gx, gy - 1], [gx - 1, gy], [gx, gy]].forEach(([x, y]) => { const t = B.tile(x, y); if (t && !t.los) h = Math.max(h, t.h); }); return { x: gx, y: gy, z: h + 0.5, pt: true }; };
  // cover a target gets against an attacker (0 none, 1 lesser, 2 standard, 3 greater)
  B.coverVs = (t, from) => {
    const tr = B.trace(from, t); let c = tr.cover;
    const tc = t.fx.find(f => f.key === 'takeCover');
    if (tc) { if (c >= 2) c = 3; else if (c === 1) c = 2; else if (B.cv(t, 'prone') && !(from.pt) && !B.inReach(from, t, B.reachOf(from))) c = 2; }
    return c;
  };
  B.coverMod = c => c === 3 ? 4 : c === 2 ? 2 : c === 1 ? 1 : 0;
  B.COVERN = ['', 'lesser cover', 'standard cover', 'greater cover'];

  /* ===== conditions ===== */
  B.cv = (u, k) => { const c = u.cond && u.cond[k]; if (!c) return 0; return c.v || 1; };
  B.setC = (t, k, v = 1, exp = null, src = null, extra) => {
    if (!B.alive(t)) return;
    if (k === 'frightened' && B.immuneTo(t, 'fear')) return;
    if (k === 'frightened' && t.flags.bravery) v = Math.max(0, v - 1);
    if (k === 'frightened' && B.units.some(c => c.team === t.team && c.flags.auroOfCourage)) { /* noop */ }
    if (k === 'frightened' && (t.flags.auraOfCourage)) v = Math.max(0, v - 1);
    if (k === 'paralyzed' && B.immuneTo(t, 'paralyzed')) { B.log(B.nm(t) + ' is immune to paralysis.', 'dim'); return; }
    if ((k === 'unconscious') && B.immuneTo(t, 'sleep') && extra && extra.sleep) return;
    if (v <= 0) return;
    const cur = t.cond[k];
    if (cur && (cur.v || 1) >= v && !(exp && cur.exp && false)) { if (!cur.exp || !exp) { if (!exp) cur.exp = null; } return; }
    t.cond[k] = Object.assign({ v, exp, src: src ? src.id : null }, extra || {});
    if (k === 'prone') B.emit({ t: 'prone', u: t.id, v: true });
    if (k === 'stunned' || k === 'paralyzed' || k === 'unconscious') { t.fx = t.fx.filter(f => f.key !== 'takeCover'); }
    B.touch(t);
  };
  B.clrC = (t, k) => { if (t.cond[k]) { delete t.cond[k]; if (k === 'prone') B.emit({ t: 'prone', u: t.id, v: false }); B.touch(t); } };
  B.decC = (t, k, by = 1) => { const c = t.cond[k]; if (!c) return; c.v = (c.v || 1) - by; if (c.v <= 0) B.clrC(t, k); else B.touch(t); };
  B.condList = u => {
    const out = [];
    Object.keys(u.cond).forEach(k => { const C = PF.COND[k]; if (!C || k === 'dying' || k === 'wounded') return; out.push({ k, n: C.n + (C.v ? ' ' + (u.cond[k].v || 1) : ''), bad: !!C.bad }); });
    if (u.dying) out.push({ k: 'dying', n: 'Dying ' + u.dying, bad: true });
    if (B.cv(u, 'wounded')) out.push({ k: 'wounded', n: 'Wounded ' + B.cv(u, 'wounded'), bad: true });
    u.fx.forEach(f => { if (f.name && !f.hide) out.push({ k: 'fx', n: f.name, bad: !!f.bad }); });
    u.persist.forEach(p => out.push({ k: 'persist', n: 'Persistent ' + U.dstr(p) + ' ' + p.type, bad: true }));
    if (u.hiddenFrom && u.hiddenFrom.size) out.push({ k: 'hidden', n: 'Hidden', bad: false });
    if (u.prey && B.get(u.prey) && B.alive(B.get(u.prey))) out.push({ k: 'prey', n: 'Hunting ' + B.get(u.prey).name, bad: false });
    return out;
  };

  /* ===== effects & expiration =====
     exp = {uid, ph:'s'|'e', n} -> expires after n of that unit's turn starts/ends */
  B.untilStart = u => ({ uid: u.id, ph: 's', n: 1 });
  B.rounds = (u, k) => ({ uid: u.id, ph: 's', n: k });
  B.minute = u => ({ uid: u.id, ph: 's', n: 10 });
  B.endOfTurn = u => ({ uid: u.id, ph: 'e', n: 1 });
  B.endOfNext = t => ({ uid: t.id, ph: 'e', n: B.cur === t ? 2 : 1 });
  B.addFx = (t, f) => { if (!B.alive(t)) return; if (f.key) t.fx = t.fx.filter(x => x.key !== f.key || x.stack); t.fx.push(f); B.touch(t); return f; };
  B.removeFx = (t, pred) => { const n = t.fx.length; t.fx = t.fx.filter(f => !pred(f)); if (t.fx.length !== n) B.touch(t); };
  B.hasFx = (t, key) => t.fx.some(f => f.key === key);
  B.tick = (uid, ph) => {
    B.units.forEach(t => {
      let changed = false;
      t.fx = t.fx.filter(f => { if (f.exp && f.exp.uid === uid && f.exp.ph === ph) { f.exp.n--; if (f.exp.n <= 0) { changed = true; if (f.onEnd) f.onEnd(B, t); return false; } } return true; });
      Object.keys(t.cond).forEach(k => { const c = t.cond[k]; if (c.exp && c.exp.uid === uid && c.exp.ph === ph) { c.exp.n--; if (c.exp.n <= 0) { if (k === 'unconscious' && t.hp <= 0) return; B.clrC(t, k); changed = true; } } });
      if (changed) B.touch(t);
    });
    B.terrainFx = B.terrainFx.filter(f => { if (f.exp && f.exp.uid === uid && f.exp.ph === ph) { f.exp.n--; if (f.exp.n <= 0) { B.emit({ t: 'terrain', id: f.id, remove: true }); return false; } } return true; });
  };
  B.addTerrainFx = (cells, f) => { f.id = U.uid('tf'); f.cells = cells.map(c => [c[0], c[1]]); B.terrainFx.push(f); B.emit({ t: 'terrain', id: f.id, cells: f.cells, kind: f.kind }); };
  B.terrainAt = (x, y) => B.terrainFx.filter(f => f.cells.some(c => c[0] === x && c[1] === y));
  B.addPersistent = (t, part, src) => {
    if (!B.alive(t) || B.immuneTo(t, part.type) || (part.type === 'bleed' && !B.isLiving(t))) return;
    if (src && src.flags && src.flags.burnIt && part.type === 'fire') part = Object.assign({}, part, { m: (part.m || 0) + 1 });
    const ex = t.persist.find(p => p.type === part.type);
    if (ex) { if (U.avg(part) > U.avg(ex)) Object.assign(ex, part); } else t.persist.push(Object.assign({}, part));
    B.log(B.nm(t) + ' takes persistent ' + U.dstr(part) + ' ' + part.type + ' damage.', 'bad');
    B.touch(t);
  };

  /* ===== modifiers ===== */
  const SKILL_ATTR = PF.SKILLS;
  function selMatch(ms, sel, ctx) {
    if (ms === sel) return true;
    if (ms === 'save' && SAVES.includes(sel)) return true;
    if (ms === 'save-fear' && SAVES.includes(sel) && ctx.fear) return true;
    if (ms === 'save-mental' && SAVES.includes(sel) && ctx.mental) return true;
    if (ms === 'skill' && sel.startsWith('skill:')) return true;
    if (ms === 'check' && (CHECKS.includes(sel) || sel.startsWith('skill:')) && sel !== 'ac' && !sel.endsWith('dc')) return true;
    if (ms === 'dc' && (sel === 'ac' || sel.endsWith('dc'))) return true;
    return false;
  }
  B.mods = (u, sel, ctx = {}) => {
    const list = [];
    u.fx.forEach(f => (f.mods || []).forEach(m => { if (selMatch(m.sel, sel, ctx) && (!m.vs || (ctx.target && m.vs === ctx.target.id)) && (!m.when || m.when(ctx))) list.push({ t: m.t || 'unt', v: m.v, s: (m.s || f.name || '').toLowerCase() }); }));
    const c = k => B.cv(u, k);
    const isSkill = sel.startsWith('skill:'); const sk = isSkill ? sel.slice(6) : null; const skA = sk ? (SKILL_ATTR[sk] || 'wis') : null;
    if (CHECKS.includes(sel) || isSkill) {
      if (c('frightened')) list.push({ t: 'status', v: -c('frightened'), s: 'frightened' });
      if (c('sickened')) list.push({ t: 'status', v: -c('sickened'), s: 'sickened' });
    }
    if (c('clumsy') && (sel === 'ac' || sel === 'ref' || (sel === 'atk' && ctx.attr === 'dex') || skA === 'dex')) list.push({ t: 'status', v: -c('clumsy'), s: 'clumsy' });
    if (c('enfeebled') && ((sel === 'atk' && ctx.attr === 'str') || (sel === 'dmg' && ctx.dmgAttr === 'str') || skA === 'str')) list.push({ t: 'status', v: -c('enfeebled'), s: 'enfeebled' });
    if (c('drained') && (sel === 'fort' || skA === 'con')) list.push({ t: 'status', v: -c('drained'), s: 'drained' });
    if (c('stupefied') && (['will', 'per', 'spellatk', 'spelldc'].includes(sel) || ['int', 'wis', 'cha'].includes(skA))) list.push({ t: 'status', v: -c('stupefied'), s: 'stupefied' });
    if (c('fatigued') && (sel === 'ac' || SAVES.includes(sel))) list.push({ t: 'status', v: -1, s: 'fatigued' });
    if (c('unconscious') && ['ac', 'per', 'ref'].includes(sel)) list.push({ t: 'status', v: -4, s: 'unconscious' });
    if (c('deafened') && sel === 'per') list.push({ t: 'status', v: -2, s: 'deafened' });
    if (sel === 'atk' && c('prone')) list.push({ t: 'circ', v: -2, s: 'prone' });
    if (sel === 'ac' && u.flags.formation && B.alliesOf(u).some(a => a.flags.formation && B.inReach(u, a, 5))) list.push({ t: 'circ', v: 1, s: 'formation' });
    if (sel === 'ac' && u.prey == null && false) list.push();
    return list;
  };
  B.total = (base, list) => { const all = base.concat(list); const r = PF.sumMods(all); return r; };
  B.statParts = (u, sel, ctx = {}) => {
    const base = [];
    if (sel === 'ac') { base.push({ t: 'unt', v: u.st.ac.base, s: 'base' }); if (u.st.ac.item) base.push({ t: 'item', v: u.st.ac.item, s: 'armor' }); if (u.shield && u.shield.raised && !u.shield.broken) base.push({ t: 'circ', v: u.shield.ac, s: 'shield raised' }); }
    else if (SAVES.includes(sel) || sel === 'per') { const s = u.st[sel]; base.push({ t: 'unt', v: s.base, s: 'base' }); if (s.item) base.push({ t: 'item', v: s.item, s: 'item' }); }
    else if (sel.startsWith('skill:')) { const s = u.st.skills[sel.slice(6)] || { base: 0, item: 0 }; base.push({ t: 'unt', v: s.base, s: 'base' }); if (s.item) base.push({ t: 'item', v: s.item, s: 'item' }); }
    else if (sel === 'spelldc') base.push({ t: 'unt', v: u.st.spellDC || u.st.classDC || 10, s: 'base' });
    else if (sel === 'spellatk') base.push({ t: 'unt', v: u.st.spellAtk != null ? u.st.spellAtk : (u.st.classDC || 10) - 10, s: 'base' });
    else if (sel === 'classdc') base.push({ t: 'unt', v: u.st.classDC || 10, s: 'base' });
    return base.concat(B.mods(u, sel, ctx));
  };
  B.stat = (u, sel, ctx) => PF.sumMods(B.statParts(u, sel, ctx)).total;
  B.spellDC = u => B.stat(u, 'spelldc');
  B.classDC = u => B.stat(u, 'classdc') + (u.abilDC || 0);
  B.dcOf = (u, sel, ctx) => sel === 'ac' ? B.stat(u, 'ac', ctx) : 10 + B.stat(u, sel, ctx);

  /* ===== off-guard ===== */
  B.flanks = (a, b, t) => {
    const ca = B.center(a), cb = B.center(b);
    const x0 = t.x, y0 = t.y, x1 = t.x + t.sq, y1 = t.y + t.sq;
    const r = clip(ca, cb, x0, y0, x1, y1); if (!r) return false;
    const P = { x: ca.x + (cb.x - ca.x) * r[0], y: ca.y + (cb.y - ca.y) * r[0] };
    const Q = { x: ca.x + (cb.x - ca.x) * r[1], y: ca.y + (cb.y - ca.y) * r[1] };
    const s1 = sidesOf(P, x0, y0, x1, y1), s2 = sidesOf(Q, x0, y0, x1, y1);
    return (s1.includes('L') && s2.includes('R')) || (s1.includes('R') && s2.includes('L')) || (s1.includes('T') && s2.includes('B')) || (s1.includes('B') && s2.includes('T'));
  };
  B.threatens = (a, t) => B.canAct(a) && a.strikes.some(s => s.kind === 'melee') && B.inReach(a, t, B.reachOf(a));
  B.flankedBy = (t, a) => {
    if (!B.threatens(a, t)) return null;
    if (t.flags.denyAdvantage && a.level <= t.level) return null;
    for (const ally of B.units) {
      if (ally === a || ally.team !== a.team || !B.threatens(ally, t)) continue;
      if (B.flanks(a, ally, t)) return ally;
    }
    return null;
  };
  B.offGuardWhy = (t, a) => {
    const c = k => B.cv(t, k);
    if (c('offguard')) return 'off-guard';
    if (c('prone')) return 'prone';
    if (c('grabbed') || c('restrained')) return 'grabbed';
    if (c('paralyzed')) return 'paralyzed';
    if (c('unconscious')) return 'unconscious';
    if (c('blinded')) return 'blinded';
    if (t.fx.some(f => f.offGuard && (!f.vs || (a && f.vs === a.id)) && (!f.melee || (a && a._meleeNow)))) return 'feinted';
    if (!a) return null;
    if (a.hiddenFrom && a.hiddenFrom.has(t.id) && !(t.flags.denyAdvantage && a.level <= t.level)) return 'attacker hidden';
    if (a.flags.surpriseAttack && B.round === 1 && !t.hasActed && a.initBy === 'stealth') return 'surprise attack';
    if (a.flags.shatterDefenses && c('frightened') && B.inReach(a, t, B.reachOf(a))) return 'shatter defenses';
    const f = B.flankedBy(t, a); if (f) return 'flanked with ' + f.name;
    if (a.flags.gangUp && B.inReach(a, t, B.reachOf(a)) && B.alliesOf(a).some(x => B.threatens(x, t))) return 'gang up';
    return null;
  };

  /* ===== rolls & checks ===== */
  B.d20 = (fortune = 0) => {
    const a = U.d(20); if (!fortune) return { nat: a, txt: String(a) };
    const b = U.d(20); const nat = fortune > 0 ? Math.max(a, b) : Math.min(a, b);
    return { nat, txt: a + '/' + b + '→' + nat };
  };
  B.rollParts = parts => {
    let total = 0; const out = []; const txt = [];
    parts.forEach(p => {
      if (!p) return;
      const r = U.roll(p.n || 0, p.d || 0); let v = r.t + (p.m || 0); if (p.max) v = (p.n || 0) * (p.d || 0) + (p.m || 0); if (p.min) v = (p.n || 0) + (p.m || 0);
      v = Math.max(p.n ? 1 : 0, v);
      out.push(Object.assign({}, p, { total: v, rolls: r.r }));
      total += v; txt.push(U.dstr(p) + (p.type ? ' ' + p.type : '') + ' [' + (r.r.join(',') || '-') + ']=' + v);
    });
    return { parts: out, total, text: txt.join(' + ') };
  };
  B.scaleParts = (parts, f) => parts.map(p => Object.assign({}, p, { total: f >= 1 ? p.total * f : Math.floor(p.total * f) }));
  B.degText = d => PF.DEG[d];
  // generic check: roller u with stat sel vs dc
  B.check = (u, sel, dc, o = {}) => {
    const parts = B.statParts(u, sel, o.ctx || {}).concat(o.mods || []);
    const sm = PF.sumMods(parts);
    let fortune = o.fortune || 0;
    let r = B.d20(fortune);
    let total = r.nat + sm.total; let deg = PF.degree(total, dc, r.nat);
    return { deg, nat: r.nat, total, mod: sm.total, dc, txt: r.txt, used: sm.used };
  };
  B.fmtCheck = (c, label) => (label ? label + ': ' : '') + 'd20 ' + c.txt + ' ' + U.sgn(c.mod) + ' = ' + c.total + ' vs ' + c.dc + ' → ' + PF.DEG[c.deg] + (c.used && PF.modText(c.used) ? ' (' + PF.modText(c.used) + ')' : '');

  // saving throw by t vs dc; returns degree. o: {basic, src, origin (pt or unit), fear, mental, incap, rank, spell, area}
  B.save = (t, kind, dc, o = {}) => {
    const mods = [];
    if (o.area && kind === 'ref') { const c = B.coverVs(t, o.origin || o.src); const m = B.coverMod(c); if (m) mods.push({ t: 'circ', v: m, s: B.COVERN[c] }); }
    if (o.spell && t.flags.divineGrace && t.react > 0 && !B.cv(t, 'unconscious')) { /* used only if it matters (below) */ }
    const ctx = { fear: !!o.fear, mental: !!o.mental };
    let c = B.check(t, kind, dc, { mods, ctx });
    // reactions / rerolls
    if (c.deg <= 1 && o.spell && t.flags.divineGrace && t.react > 0 && B.conscious(t) && c.total + 2 >= dc) { t.react--; c = Object.assign({}, c, { total: c.total + 2 }); c.deg = PF.degree(c.total, dc, c.nat); B.log(B.nm(t) + ' uses Divine Grace (+2).', 'good'); }
    if (c.deg <= 1 && t.flags.halflingLuck && !t.enc.used.luck) { t.enc.used.luck = true; const c2 = B.check(t, kind, dc, { mods, ctx }); B.log(B.nm(t) + ' uses Halfling Luck to reroll: ' + c2.total + '.', 'good'); c = c2; }
    let deg = c.deg; const notes = [];
    if (deg === 2 && t.ranks && t.ranks[kind] >= 3) { deg = 3; notes.push('master save'); }
    if (deg === 2 && o.fear && t.flags.bravery && kind === 'will') { deg = 3; notes.push('bravery'); }
    if (deg === 2 && o.emotion && t.flags.gutsy) { deg = 3; notes.push('gutsy'); }
    if (o.incap && o.src) { const lim = o.rank != null ? o.rank * 2 : o.src.level; if (t.level > lim) { deg = Math.min(3, deg + 1); notes.push('incapacitation'); } }
    B.log(B.nm(t) + ' ' + ({ fort: 'Fortitude', ref: 'Reflex', will: 'Will' }[kind]) + ' save: ' + c.total + ' vs DC ' + dc + ' → ' + PF.DEG[deg] + (notes.length ? ' (' + notes.join(', ') + ')' : ''), 'deg' + deg,
      'd20 ' + c.txt + ' ' + U.sgn(c.mod) + ' = ' + c.total + (c.used.length ? ' (' + PF.modText(c.used) + ')' : ''));
    return deg;
  };
  B.flat = (dc, label) => { const r = U.d(20); const ok = r >= dc; return { ok, r, txt: (label || 'Flat check') + ' DC ' + dc + ': ' + r + (ok ? ' ✓' : ' ✗') }; };

  /* ===== damage ===== */
  const PHYS = ['bludgeoning', 'piercing', 'slashing'];
  B.resistOf = (t, type) => {
    let r = 0; const R = Object.assign({}, t.resist);
    t.fx.forEach(f => { if (f.resist) Object.keys(f.resist).forEach(k => { R[k] = Math.max(R[k] || 0, f.resist[k]); }); });
    if (R[type]) r = Math.max(r, R[type]);
    if (PHYS.includes(type) && R.physical) r = Math.max(r, R.physical);
    if (R.all && type !== 'untyped') r = Math.max(r, R.all);
    return r;
  };
  B.weakOf = (t, type) => { const W = t.weak || {}; let w = W[type] || 0; if (PHYS.includes(type) && W.physical) w = Math.max(w, W.physical); return w; };

  // parts: rolled parts [{type,total,precision}] ; o: {src, crit, spell, strike, nonlethal, persistent, noReact, label}
  B.dealDamage = (t, parts, o = {}) => {
    if (!B.alive(t)) return 0;
    const src = o.src || null;
    const byType = {}; const notes = [];
    parts.forEach(p => {
      if (!p || !(p.total > 0)) return;
      const type = p.type || 'untyped';
      if (p.precision && B.immuneTo(t, 'precision')) { notes.push('immune to precision'); return; }
      byType[type] = (byType[type] || 0) + p.total;
    });
    // champion's reaction (ally protection) — before resistances
    let champRes = 0; let champ = null;
    if (src && src.team !== t.team && !o.noReact) {
      champ = B.units.find(c => c !== t && c.team === t.team && c.flags.championReaction && B.conscious(c) && c.react > 0 && !c.flags.noReactions && !B.fxBlocksReact(c) && B.dist(c, t) <= 15 && B.dist(c, src) <= 15);
      if (champ) { champ.react--; champRes = 2 + champ.level; notes.push(champ.name + "'s reaction: resistance " + champRes); }
    }
    let total = 0; const typeTxt = [];
    Object.keys(byType).forEach(type => {
      let v = byType[type];
      if (type === 'vitality' && !B.isUndead(t) && !t.traits.includes('void')) { notes.push('vitality harms only undead'); return; }
      if (type === 'void' && !B.isLiving(t)) { notes.push('void doesn\'t harm the undead'); return; }
      if (type === 'bleed' && !B.isLiving(t)) { notes.push('no blood to bleed'); return; }
      if (B.immuneTo(t, type)) { notes.push('immune to ' + type); return; }
      const w = B.weakOf(t, type); if (w) { v += w; notes.push('weakness ' + type + ' ' + w); }
      const r = B.resistOf(t, type) + champRes; if (r) { const before = v; v = Math.max(0, v - r); notes.push('resist ' + type + ' ' + Math.min(r, before)); }
      if (v > 0) { total += v; typeTxt.push(v + ' ' + type); }
      if (t.regen && t.regen.off.includes(type) && v > 0) { t.regen.disabled = true; t.regen.until = B.round + 1; notes.push('regeneration off'); }
    });
    // shield block
    const physTotal = Object.keys(byType).filter(k => PHYS.includes(k) || k === 'force').reduce((a, k) => a + byType[k], 0);
    if (total > 0 && physTotal > 0 && !o.persistent) {
      const blocker = B.shieldBlocker(t, src);
      if (blocker) {
        const sh = blocker.shield || blocker._spellShield;
        const hard = sh.hard;
        const blocked = Math.min(hard, total, physTotal);
        const rest = Math.max(0, Math.min(total, physTotal) - blocked);
        total -= blocked;
        if (blocker.shield && sh === blocker.shield) {
          sh.cur -= rest; if (sh.cur <= sh.bt && !sh.broken) { sh.broken = true; sh.raised = false; B.log(B.nm(blocker) + "'s shield breaks!", 'bad'); B.emit({ t: 'shield', u: blocker.id, v: false }); }
        } else { blocker.enc.shieldSpellUsed = true; B.removeFx(blocker, f => f.key === 'shieldSpell'); }
        if (blocker === t) total = total; // damage reduced
        notes.push((blocker === t ? 'Shield Block' : blocker.name + "'s Shield Warden") + ' −' + blocked);
        if (blocker !== t) { /* shield warden: ally's shield takes the rest */ }
        B.emit({ t: 'float', u: blocker.id, text: 'Block −' + blocked, c: 'info' });
      }
    }
    // apply
    let dealt = 0;
    if (total > 0) {
      if (t.temp > 0) { const a = Math.min(t.temp, total); t.temp -= a; total -= a; dealt += a; if (a) notes.push(a + ' to temp HP'); }
      const before = t.hp; t.hp = Math.max(0, t.hp - total); dealt += total;
      const lbl = (o.label ? o.label + ': ' : '') + B.nm(t) + ' takes ' + (dealt) + ' damage' + (typeTxt.length > 1 || typeTxt.length && !typeTxt[0].endsWith('untyped') ? ' (' + typeTxt.join(', ') + ')' : '') + (notes.length ? ' — ' + notes.join('; ') : '');
      B.log(lbl, 'dmg');
      B.emit({ t: 'float', u: t.id, text: '−' + dealt, c: o.crit ? 'crit' : 'dmg' });
      if (t.sleepWake && B.cv(t, 'unconscious') && t.hp > 0) { B.clrC(t, 'unconscious'); t.sleepWake = false; B.log(B.nm(t) + ' wakes up.'); }
      if (t.hp <= 0 && before > 0) B.drop(t, src, o);
      else if (t.hp <= 0 && t.dying) { B.addDying(t, o.crit ? 2 : 1, src); }
    } else {
      B.log((o.label ? o.label + ': ' : '') + B.nm(t) + ' takes no damage' + (notes.length ? ' — ' + notes.join('; ') : '') + '.', 'dim');
      B.emit({ t: 'float', u: t.id, text: '0', c: 'info' });
    }
    B.touch(t);
    // after-damage champion effects
    if (champ && src && B.alive(src)) B.championFollow(champ, t, src);
    if (dealt > 0 && src && src.team !== t.team && t.flags.youreNext === undefined) { /* placeholder */ }
    return dealt;
  };
  B.fxBlocksReact = u => u.fx.some(f => f.noReactions) || u.flags.noReactions || B.cv(u, 'stunned') > 0 && false;
  B.canReact = (u, kind) => {
    if (!B.conscious(u) || B.cv(u, 'paralyzed') || B.fxBlocksReact(u)) return false;
    if (u.react > 0) return true;
    if (kind && u.reactX[kind] > 0) return true;
    return false;
  };
  B.useReact = (u, kind) => { if (kind && u.reactX[kind] > 0) u.reactX[kind]--; else u.react--; };
  B.shieldBlocker = (t, src) => {
    const can = u => (u.flags.shieldBlock || u.flags.shieldBlockM) && u.shield && u.shield.raised && !u.shield.broken && B.canReact(u, 'shieldBlock');
    if (can(t)) { B.useReact(t, 'shieldBlock'); return t; }
    if (t.fx.some(f => f.key === 'shieldSpell') && !t.enc.shieldSpellUsed && B.canReact(t)) { const f = t.fx.find(f => f.key === 'shieldSpell'); t._spellShield = { hard: f.spellShield }; B.useReact(t); return t; }
    const warden = B.units.find(w => w !== t && w.team === t.team && w.flags.shieldWarden && can(w) && B.inReach(w, t, 5));
    if (warden) { B.useReact(warden, 'shieldBlock'); return warden; }
    return null;
  };
  B.championFollow = (c, ally, foe) => {
    if (c.flags.causeJustice) {
      const s = B.bestStrike(c, foe, x => x.kind === 'melee' || (c.flags.rangedReprisal && x.kind === 'ranged' && B.dist(c, foe) <= (x.range || 0)));
      if (s && (s.kind === 'ranged' || B.inReach(c, foe, B.reachOf(c, s)))) { B.log(B.nm(c) + ' answers with a Retributive Strike!', 'react'); B.strike(c, s, foe, { reaction: true, noMAP: true, label: 'Retributive Strike' }); }
    } else if (c.flags.causeRedemption) {
      B.setC(foe, 'enfeebled', 2, B.endOfTurn(foe), c); B.log(B.nm(foe) + ' is enfeebled 2 by a Glimpse of Redemption.', 'react');
    } else if (c.flags.causeLiberation) {
      const st = B.bestStepAway(ally, foe); if (st) { B.log(B.nm(ally) + ' takes a Liberating Step.', 'react'); B.moveAlong(ally, [[ally.x, ally.y], st], { step: true, noReact: true }); }
    }
  };

  B.drop = (t, src, o = {}) => {
    // ferocity
    if ((t.flags.ferocity) && !t.enc.used.ferocity && B.canReact(t)) {
      t.enc.used.ferocity = true; B.useReact(t); t.hp = 1; B.setC(t, 'wounded', B.cv(t, 'wounded') + 1); B.log(B.nm(t) + ' refuses to fall — Ferocity! (1 HP, wounded ' + B.cv(t, 'wounded') + ')', 'react'); B.emit({ t: 'float', u: t.id, text: 'Ferocity!', c: 'info' }); return;
    }
    if (t.regen && !t.regen.disabled && t.team === 'foe') {
      B.setC(t, 'unconscious', 1); B.setC(t, 'prone', 1); B.log(B.nm(t) + ' collapses, but its flesh is already knitting back together…', 'warn'); B.emit({ t: 'down', u: t.id }); return;
    }
    if (t.kind === 'pc' && !o.nonlethal) {
      B.addDying(t, (o.crit ? 2 : 1), src, true);
    } else if (o.nonlethal) {
      B.setC(t, 'unconscious', 1); B.setC(t, 'prone', 1); B.log(B.nm(t) + ' is knocked out.', 'kill'); B.emit({ t: 'down', u: t.id });
    } else {
      B.kill(t, src);
    }
    // You're Next / cleave
    if (src && src !== t && src.team !== t.team) B.onKill(src, t);
  };
  B.addDying = (t, n, src, fresh) => {
    if (fresh) { n += B.cv(t, 'wounded'); B.setC(t, 'unconscious', 1); B.setC(t, 'prone', 1); B.emit({ t: 'down', u: t.id }); B.clearHidden(t); }
    t.dying = (t.dying || 0) + n;
    const lim = t.flags.diehard ? 5 : 4;
    B.log(B.nm(t) + (fresh ? ' falls unconscious — dying ' : ' is dying ') + t.dying + '.', 'kill');
    if (t.dying >= lim) {
      if (t.hero > 0) { t.hero = 0; t.dying = 0; B.setC(t, 'wounded', B.cv(t, 'wounded') + 1); B.log(B.nm(t) + ' spends their Hero Point to cling to life (stable at 0 HP).', 'good'); B.emit({ t: 'float', u: t.id, text: 'Hero Point!', c: 'good' }); }
      else B.kill(t, src);
    }
    B.touch(t);
  };
  B.kill = (t, src) => {
    t.dead = true; t.hp = 0; t.dying = 0; t.fx = []; t.persist = []; t.hiddenFrom = new Set();
    Object.keys(t.cond).forEach(k => { if (k !== 'wounded') delete t.cond[k]; });
    B.log(B.nm(t) + (t.kind === 'pc' ? ' dies.' : ' is slain.'), 'kill');
    B.emit({ t: 'dead', u: t.id }); B.touch(t);
    // release grabs
    B.units.forEach(u => { if (u.cond.grabbed && u.cond.grabbed.src === t.id) B.clrC(u, 'grabbed'); if (u.cond.restrained && u.cond.restrained.src === t.id) B.clrC(u, 'restrained'); });
  };
  B.onKill = (src, t) => {
    if (src.flags.youreNext && B.canReact(src) && B.conscious(src)) {
      const tgt = B.foesOf(src).filter(f => B.conscious(f) && B.dist(src, f) <= 60 && !f.enc.demoImmune[src.id] && !B.immuneTo(f, 'mental')).sort((a, b) => b.level - a.level)[0];
      if (tgt) { B.useReact(src); B.log(B.nm(src) + ': "You\'re next!"', 'react'); B.demoralize(src, tgt, { free: true }); }
    }
  };
  B.heal = (t, amt, src, o = {}) => {
    if (!B.alive(t) || amt <= 0) return 0;
    const before = t.hp; t.hp = Math.min(B.maxHP(t), t.hp + amt); const got = t.hp - before;
    if (t.dying || (before <= 0 && t.hp > 0)) {
      if (t.dying) { t.dying = 0; B.setC(t, 'wounded', B.cv(t, 'wounded') + 1); }
      if (t.hp > 0) { B.clrC(t, 'unconscious'); B.log(B.nm(t) + ' regains consciousness.', 'good'); B.emit({ t: 'up', u: t.id }); }
    }
    B.log(B.nm(t) + ' regains ' + got + ' HP' + (o.label ? ' (' + o.label + ')' : '') + '.', 'heal');
    B.emit({ t: 'float', u: t.id, text: '+' + got, c: 'heal' });
    if (src && src !== t && src.flags.communalHealing && o.spell) { const r = o.rank || 1; const b2 = src.hp; src.hp = Math.min(B.maxHP(src), src.hp + r); if (src.hp > b2) B.log(B.nm(src) + ' regains ' + (src.hp - b2) + ' HP (Communal Healing).', 'heal'); B.touch(src); }
    B.touch(t);
    return got;
  };
  B.knockProne = (t, why) => { if (!B.alive(t) || B.cv(t, 'prone') || B.flies(t)) return; B.setC(t, 'prone', 1); B.log(B.nm(t) + ' falls prone' + (why && why.length > 3 ? '' : '') + '.', 'bad'); B.emit({ t: 'float', u: t.id, text: 'Prone', c: 'info' }); };

  /* ===== hidden ===== */
  B.clearHidden = (u, why) => { if (u.hiddenFrom && u.hiddenFrom.size) { u.hiddenFrom.clear(); if (why) B.log(B.nm(u) + ' is no longer hidden (' + why + ').', 'dim'); B.touch(u); } };
  B.isHiddenTo = (u, obs) => !!(u.hiddenFrom && u.hiddenFrom.has(obs.id));
  B.hasCoverOrConceal = (u, obs) => { const tr = B.trace(obs, u); return tr.blocked || tr.cover >= 2 || tr.conceal || u.fx.some(f => f.concealed); };

  /* ===== movement ===== */
  // Dijkstra over feet with PF2e alternating diagonals. Returns {cost: Map key->ft, prev}
  B.moveCostInto = (u, fx, fy, x, y) => {
    if (B.flies(u)) return 0;
    let extra = 0; let hMax = -1, hFrom = null;
    for (const [cx, cy] of B.cellsOf(u, x, y)) {
      const t = B.tile(cx, cy); if (!t) return Infinity;
      extra = Math.max(extra, t.diff);
      if (B.terrainAt(cx, cy).some(f => f.kind === 'grease')) extra = Math.max(extra, 1);
      hMax = Math.max(hMax, t.h);
    }
    const t0 = B.tile(fx, fy); hFrom = t0 ? t0.h : hMax;
    const tNew = B.tile(x, y);
    const dh = Math.abs((tNew ? tNew.h : 0) - hFrom);
    if (dh >= 3) return Infinity;
    if (dh === 2) extra = Math.max(extra, 2);
    else if (dh === 1 && !(t0 && t0.stairs) && !(tNew && tNew.stairs)) extra = Math.max(extra, 1);
    return extra;
  };
  B.paths = (u, maxFt, o = {}) => {
    const start = u.x + ',' + u.y + ',0';
    const dist = new Map(); const prev = new Map(); const best = new Map(); const bestKey = new Map();
    dist.set(start, 0); best.set(u.x + ',' + u.y, 0); bestKey.set(u.x + ',' + u.y, start);
    const open = [[0, u.x, u.y, 0]];
    const blocked = (x, y) => { for (const [cx, cy] of B.cellsOf(u, x, y)) { const t = B.tile(cx, cy); if (!t || t.block) return true; const o2 = B.unitAt(cx, cy, u); if (o2 && (o2.team !== u.team && B.conscious(o2) && !o.ignoreFoes)) return true; } return false; };
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [c, x, y, par] = open.splice(bi, 1)[0];
      const k = x + ',' + y + ',' + par; if (c > (dist.get(k) ?? Infinity)) continue;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
        if (blocked(nx, ny)) continue;
        const diag = dx && dy;
        if (diag && (blocked(x + dx, y) || blocked(x, y + dy))) continue;
        const ex = B.moveCostInto(u, x, y, nx, ny); if (ex === Infinity) continue;
        let step = diag ? (par ? 10 : 5) : 5; step += ex * 5;
        if (o.noDifficult && ex > 0) continue;
        const nc = c + step; if (nc > maxFt) continue;
        const np = diag ? 1 - par : par; const nk = nx + ',' + ny + ',' + np;
        if (nc < (dist.get(nk) ?? Infinity)) {
          dist.set(nk, nc); prev.set(nk, k); open.push([nc, nx, ny, np]);
          const tk = nx + ',' + ny; if (nc < (best.get(tk) ?? Infinity)) { best.set(tk, nc); bestKey.set(tk, nk); }
        }
      }
    }
    return { best, bestKey, prev, from: u };
  };
  B.pathFrom = (P, x, y) => {
    let k = P.bestKey.get(x + ',' + y); if (!k) return null;
    const out = []; while (k) { const [a, b] = k.split(',').map(Number); out.unshift([a, b]); k = P.prev.get(k); }
    return out;
  };
  B.canEnd = (u, x, y) => B.fits(u, x, y) && !B.units.some(o => o !== u && B.alive(o) && B.cellsOf(u, x, y).some(([cx, cy]) => cx >= o.x && cx < o.x + o.sq && cy >= o.y && cy < o.y + o.sq));
  B.speedOf = u => {
    let s = u.speed.fly || u.speed.land || 25;
    if (u.fx.some(f => f.key === 'rage') && u.flags.fastMovement) s += 10;
    u.fx.forEach(f => { if (f.speed) s += f.speed; });
    return Math.max(5, s);
  };
  B.immobile = u => B.cv(u, 'grabbed') || B.cv(u, 'restrained') || B.cv(u, 'immobilized') || B.cv(u, 'paralyzed');
  // segment a path into strides: returns array of paths, each within speed
  B.splitStrides = (u, path, speed) => {
    const segs = []; let cur = [path[0]]; let used = 0; let par = 0;
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1], [bx, by] = path[i]; const diag = ax !== bx && ay !== by;
      const ex = B.moveCostInto(u, ax, ay, bx, by); let step = (diag ? (par ? 10 : 5) : 5) + ex * 5;
      if (used + step > speed) { segs.push(cur); cur = [path[i - 1]]; used = 0; par = 0; step = (diag ? 5 : 5) + ex * 5; }
      used += step; if (diag) par = 1 - par; cur.push(path[i]);
    }
    if (cur.length > 1) segs.push(cur);
    return segs;
  };
  // move a unit along a path cell by cell, triggering reactions; returns true if completed
  B.moveAlong = (u, path, o = {}) => {
    if (!path || path.length < 2) return true;
    const done = [[u.x, u.y]];
    for (let i = 1; i < path.length; i++) {
      // leaving current square: reactions
      if (!o.noReact && !o.step) {
        const reactors = B.units.filter(r => r.team !== u.team && B.alive(r) && (r.flags.reactiveStrike || (r.flags.disruptPrey && r.prey === u.id)) && B.canReact(r, 'reactiveStrike') && B.inReach(r, u, B.reachOf(r)) && !r.reactedTo?.[u.id + ':' + (o.actId || '')]);
        for (const r of reactors) {
          if (!B.canReact(r, 'reactiveStrike')) continue;
          if (done.length > 1) B.emit({ t: 'move', u: u.id, path: done.splice(0, done.length - 1).concat([done[done.length - 1]]), kind: o.kind || 'stride' });
          done.length = 0; done.push([u.x, u.y]);
          r.reactedTo = r.reactedTo || {}; r.reactedTo[u.id + ':' + (o.actId || '')] = true;
          B.reactiveStrike(r, u, 'moves');
          if (!B.conscious(u) || B.cv(u, 'prone') || B.immobile(u)) { B.log(B.nm(u) + "'s movement is stopped.", 'bad'); return false; }
        }
      }
      const [nx, ny] = path[i];
      u.x = nx; u.y = ny; done.push([nx, ny]);
      // hazards on entering
      const hz = B.cellsOf(u).map(([x, y]) => B.tile(x, y)).find(t => t && t.hazard === 'lava');
      if (hz && !B.flies(u) && !B.immuneTo(u, 'fire')) {
        B.emit({ t: 'move', u: u.id, path: done.slice(), kind: o.kind || 'stride' }); done.length = 0; done.push([u.x, u.y]);
        B.lavaBurn(u);
        if (!B.conscious(u)) return false;
      }
      const gr = B.cellsOf(u).some(([x, y]) => B.terrainAt(x, y).some(f => f.kind === 'grease'));
      if (gr && !o.noGrease && !B.flies(u)) {
        const f = B.cellsOf(u).map(([x, y]) => B.terrainAt(x, y).find(f => f.kind === 'grease')).find(Boolean);
        B.emit({ t: 'move', u: u.id, path: done.slice(), kind: o.kind || 'stride' }); done.length = 0; done.push([u.x, u.y]);
        const c = B.check(u, 'skill:acrobatics', f.dc);
        B.log(B.nm(u) + ' crosses grease: ' + B.fmtCheck(c, 'Acrobatics'), 'deg' + c.deg);
        if (c.deg <= 1) { B.knockProne(u, 'grease'); return false; }
      }
    }
    if (done.length > 1) B.emit({ t: 'move', u: u.id, path: done.slice(), kind: o.kind || 'stride' });
    u.fx = u.fx.filter(f => f.key !== 'takeCover');
    B.updateHiddenAfterMove(u, o);
    B.checkAuras(u, 'enter');
    B.touch(u);
    return true;
  };
  B.updateHiddenAfterMove = (u, o) => {
    if (!u.hiddenFrom || !u.hiddenFrom.size || o.sneak) return;
    B.clearHidden(u, 'moved');
  };
  B.lavaBurn = u => {
    const n = 2 + Math.floor(B.pl / 2);
    const r = B.rollParts([{ n, d: 6, m: 0, type: 'fire' }]);
    B.log(B.nm(u) + ' is burned by lava!', 'bad');
    B.dealDamage(u, r.parts, { label: 'Lava' });
  };
  B.teleport = (u, x, y) => { if (!B.canEnd(u, x, y)) return false; const from = [u.x, u.y]; u.x = x; u.y = y; B.emit({ t: 'move', u: u.id, path: [from, [x, y]], kind: 'teleport' }); B.log(B.nm(u) + ' teleports.'); B.touch(u); return true; };
  // forced movement: push t away from src by n squares
  B.push = (t, src, n, by) => {
    if (!B.alive(t)) return;
    const c = B.center(src), d = B.center(t);
    let vx = Math.sign(Math.round((d.x - c.x) * 10) / 10), vy = Math.sign(Math.round((d.y - c.y) * 10) / 10);
    if (!vx && !vy) vy = 1;
    const path = [[t.x, t.y]]; let moved = 0; let fell = false;
    for (let i = 0; i < n; i++) {
      const nx = t.x + vx, ny = t.y + vy;
      if (!B.fits(t, nx, ny)) {
        // check fall into lower terrain
        const tt = B.tile(nx, ny);
        if (tt && !tt.block && !B.unitAt(nx, ny, t) && tt.h < B.elev(t) - 1 && !B.flies(t)) { const drop = B.elev(t) - tt.h; t.x = nx; t.y = ny; path.push([nx, ny]); fell = drop; }
        break;
      }
      const ex = B.moveCostInto(t, t.x, t.y, nx, ny); if (ex === Infinity) break;
      t.x = nx; t.y = ny; path.push([nx, ny]); moved++;
    }
    if (path.length > 1) B.emit({ t: 'move', u: t.id, path, kind: 'push' });
    if (moved || fell) B.log(B.nm(t) + ' is pushed ' + (path.length - 1) * 5 + ' feet.', 'info');
    t.fx = t.fx.filter(f => f.key !== 'takeCover');
    if (fell) { const dmg = Math.floor(fell * 5 / 2); B.log(B.nm(t) + ' falls ' + fell * 5 + ' feet!', 'bad'); B.dealDamage(t, [{ type: 'bludgeoning', total: dmg }], { label: 'Fall' }); B.knockProne(t); }
    const lava = B.cellsOf(t).some(([x, y]) => { const tt = B.tile(x, y); return tt && tt.hazard === 'lava'; });
    if (lava && !B.flies(t) && !B.immuneTo(t, 'fire')) B.lavaBurn(t);
    B.touch(t);
  };
  B.bestStepAway = (u, from) => {
    let best = null, bd = -1;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue; const x = u.x + dx, y = u.y + dy;
      if (!B.canEnd(u, x, y) || B.moveCostInto(u, u.x, u.y, x, y) > 0) continue;
      const d = Math.hypot(x - from.x, y - from.y); if (d > bd) { bd = d; best = [x, y]; }
    }
    return best;
  };

  /* ===== auras ===== */
  B.checkAuras = (u, why) => {
    if (!B.conscious(u)) return;
    B.units.forEach(src => {
      if (!src.auras || src.team === u.team || !B.alive(src)) return;
      src.auras.forEach(a => {
        if (B.dist(src, u) > a.r) return;
        const dc = a.dc + (src.abilDC || 0);
        if (a.every) { if (why !== 'start') return; if (B.immuneTo(u, a.type)) return; B.log(B.nm(u) + ' is caught in ' + B.nm(src) + "'s " + a.name.split(' (')[0] + '.', 'warn'); const r = B.rollParts([U.dice(a.dmg, a.type)]); const d = B.save(u, 'ref', dc, { basic: true, src }); const f = [2, 1, 0.5, 0][d]; if (f > 0) B.dealDamage(u, B.scaleParts(r.parts, f), { src, label: a.name.split(' (')[0], noReact: true }); return; }
        if (u.enc.used['aura:' + src.id + a.id]) return;
        u.enc.used['aura:' + src.id + a.id] = 'pending';
        if (a.fear) {
          if (B.immuneTo(u, 'fear') || B.immuneTo(u, 'mental')) return;
          B.log(B.nm(u) + ' faces ' + B.nm(src) + "'s " + a.name.split(' (')[0] + '.', 'warn');
          const d = B.save(u, 'will', dc, { fear: true, mental: true, src, emotion: true });
          if (d === 2) B.setC(u, 'frightened', 1, null, src); if (d === 1) B.setC(u, 'frightened', 2, null, src); if (d === 0) B.setC(u, 'frightened', 4, null, src);
          u.enc.used['aura:' + src.id + a.id] = true;
        } else {
          if (B.immuneTo(u, 'poison') || !B.isLiving(u)) return;
          B.log(B.nm(u) + ' chokes on ' + B.nm(src) + "'s stench.", 'warn');
          const d = B.save(u, 'fort', dc, { src });
          if (d >= 2) u.enc.used['aura:' + src.id + a.id] = true; else u.enc.used['aura:' + src.id + a.id] = false;
          if (d === 1) B.setC(u, 'sickened', 1, null, src, { dc });
          if (d === 0) { B.setC(u, 'sickened', 2, null, src, { dc }); B.setC(u, 'slowed', 1, B.rounds(u, 1), src); }
        }
      });
    });
  };

  /* ===== initiative & turns ===== */
  B.begin = () => {
    B.phase = 'battle';
    B.units.forEach(u => {
      const sk = u.initSkill && u.initSkill !== 'perception' ? 'skill:' + u.initSkill : 'per';
      const mods = []; if (u.flags.incredibleInit) mods.push({ t: 'circ', v: 2, s: 'incredible initiative' }); if (u.flags.surveyor && sk === 'per') mods.push({ t: 'circ', v: 2, s: 'battlefield surveyor' });
      const c = B.check(u, sk, 0, { mods });
      u.init = c.total + (u.team === 'foe' ? 0.5 : 0) + U.rand() * 0.01; u.initBy = sk === 'per' ? 'perception' : u.initSkill;
      u.initRoll = c.total;
      B.log(B.nm(u) + ' rolls initiative (' + (sk === 'per' ? 'Perception' : U.cap(u.initSkill)) + '): ' + c.total, 'init', 'd20 ' + c.txt + ' ' + U.sgn(c.mod));
      if (sk === 'skill:stealth' && u.team === 'pc') { /* rogues starting stealthy are hidden from foes that can't see them */ }
    });
    B.order = B.units.slice().sort((a, b) => b.init - a.init).map(u => u.id);
    B.round = 1; B.turnIdx = -1;
    B.emit({ t: 'round', n: 1 });
    B.log('— Round 1 —', 'round');
    // battle cry
    B.units.forEach(u => { if (u.flags.battleCry && B.conscious(u)) { const t = B.foesOf(u).filter(f => B.dist(u, f) <= 30).sort((a, b) => b.level - a.level)[0]; if (t) { B.log(B.nm(u) + ' lets out a Battle Cry!', 'react'); B.demoralize(u, t, { free: true }); } } });
    B.units.forEach(u => B.checkAuras(u, 'start'));
  };
  B.isCurrent = u => B.cur === u;
  // advance to next unit who can act. Returns unit or null when battle over.
  B.next = () => {
    if (B.checkOver()) return null;
    for (let guard = 0; guard < 500; guard++) {
      B.turnIdx++;
      if (B.turnIdx >= B.order.length) { B.turnIdx = 0; B.round++; B.emit({ t: 'round', n: B.round }); B.log('— Round ' + B.round + ' —', 'round'); B.units.forEach(u => { u.reactedTo = {}; }); }
      const u = B.get(B.order[B.turnIdx]);
      if (!u) continue;
      const can = B.beginTurn(u);
      if (B.checkOver()) return null;
      if (can) return u;
      B.endTurn(u, true);
      if (B.checkOver()) return null;
    }
    return null;
  };
  B.beginTurn = u => {
    B.cur = u; u.hasActed = true;
    u.turn = { acts: 0, attacks: 0, quick: null, comp: false, flourish: false, preyHit: false, actsUsed: [], lastStrikeHit: null, clawHits: 0, strideFree: 0 };
    B.tick(u.id, 's');
    if (!B.alive(u)) return false;
    u.react = 1; u.reactX = {}; if (u.flags.combatReflexes) u.reactX.reactiveStrike = 1; if (u.flags.quickShieldBlock) u.reactX.shieldBlock = 1;
    if (u.shield && u.shield.raised) { u.shield.raised = false; B.emit({ t: 'shield', u: u.id, v: false }); }
    if (u.regen && u.regen.disabled && B.round >= u.regen.until) u.regen.disabled = false;
    B.emit({ t: 'turn', u: u.id });
    // dying
    if (u.dying > 0) {
      const dc = 10 + u.dying - (u.flags.toughness ? 1 : 0); const r = U.d(20);
      const deg = PF.degree(r, dc, r);
      const ch = [2, 1, -1, -2][deg];
      B.log(B.nm(u) + ' recovery check: ' + r + ' vs DC ' + dc + ' → ' + PF.DEG[deg], 'deg' + deg);
      if (ch > 0) B.addDying(u, ch, null); else { u.dying = Math.max(0, u.dying + ch); if (!u.dying) { B.setC(u, 'wounded', B.cv(u, 'wounded') + 1); B.log(B.nm(u) + ' is stable (unconscious at 0 HP).', 'good'); } B.touch(u); }
      return false;
    }
    if (u.regen && !u.regen.disabled && u.hp < B.maxHP(u)) {
      const before = u.hp; u.hp = Math.min(B.maxHP(u), u.hp + u.regen.v);
      B.log(B.nm(u) + ' regenerates ' + (u.hp - before) + ' HP.', 'heal'); B.emit({ t: 'float', u: u.id, text: '+' + (u.hp - before), c: 'heal' });
      if (before <= 0 && u.hp > 0) { B.clrC(u, 'unconscious'); B.emit({ t: 'up', u: u.id }); B.log(B.nm(u) + ' rises again!', 'warn'); }
      B.touch(u);
    } else if (u.regen && u.regen.disabled && u.hp <= 0) { B.kill(u); return false; }
    if (u.hp <= 0 || B.cv(u, 'unconscious')) {
      if (u.cond.unconscious && u.hp > 0 && u.sleepWake) { /* asleep */ }
      return false;
    }
    B.checkAuras(u, 'start');
    if (!B.conscious(u)) return false;
    // actions
    let acts = 3;
    const quick = u.fx.find(f => f.quick);
    if (quick) { u.turn.quick = quick.quick; }
    if (B.cv(u, 'stunned')) { const s = B.cv(u, 'stunned'); const lost = Math.min(s, acts + (quick ? 1 : 0)); acts -= lost; if (acts < 0) { u.turn.quick = null; acts = 0; } B.decC(u, 'stunned', lost); B.log(B.nm(u) + ' is stunned and loses ' + lost + ' action' + (lost > 1 ? 's' : '') + '.', 'bad'); }
    if (B.cv(u, 'slowed')) { const s = B.cv(u, 'slowed'); acts -= s; }
    if (B.cv(u, 'paralyzed')) { acts = 0; u.turn.quick = null; B.log(B.nm(u) + ' is paralyzed.', 'bad'); }
    const cmd = u.fx.find(f => f.key === 'command');
    if (cmd && acts > 0) { const lose = Math.min(acts, cmd.loseActions); acts -= lose; B.knockProne(u, 'command'); B.log(B.nm(u) + ' obeys the command and drops prone.', 'bad'); B.removeFx(u, f => f.key === 'command'); }
    u.turn.acts = Math.max(0, acts);
    if (u.turn.quick && !u.turn.acts && B.cv(u, 'paralyzed')) u.turn.quick = null;
    B.touch(u);
    return u.turn.acts > 0 || !!u.turn.quick;
  };
  B.endTurn = (u, skipped) => {
    if (B.alive(u) && !skipped || (B.alive(u) && u.persist.length)) {
      // persistent damage
      u.persist.slice().forEach(p => {
        if (!B.alive(u)) return;
        const r = B.rollParts([p]);
        B.dealDamage(u, r.parts, { persistent: true, label: 'Persistent ' + p.type });
        const f = B.flat(p.type === 'bleed' && false ? 15 : 15, 'Recovery from persistent ' + p.type);
        B.log(f.txt, f.ok ? 'good' : 'dim');
        if (f.ok) u.persist = u.persist.filter(x => x !== p);
        B.touch(u);
      });
    }
    if (B.alive(u)) {
      const lava = B.cellsOf(u).some(([x, y]) => { const t = B.tile(x, y); return t && t.hazard === 'lava'; });
      if (lava && !B.flies(u) && !B.immuneTo(u, 'fire')) B.lavaBurn(u);
      if (B.cv(u, 'frightened') && !skipped) {
        const min = Math.max(0, ...u.fx.filter(f => f.minFright).map(f => f.minFright));
        const aura = B.units.some(c => c.team === u.team && c.flags.auraOfCourage && B.conscious(c) && B.dist(c, u) <= 15 && c !== u);
        const nv = Math.max(min, B.cv(u, 'frightened') - 1 - (aura ? 1 : 0));
        if (nv <= 0) B.clrC(u, 'frightened'); else if (nv < B.cv(u, 'frightened')) { u.cond.frightened.v = nv; B.touch(u); }
      }
      // hidden check: lose hidden if no cover/concealment from observer
      if (u.hiddenFrom && u.hiddenFrom.size) {
        [...u.hiddenFrom].forEach(id => { const o = B.get(id); if (!o || !B.alive(o) || !B.hasCoverOrConceal(u, o)) u.hiddenFrom.delete(id); });
        if (!u.hiddenFrom.size) B.log(B.nm(u) + ' is exposed and no longer hidden.', 'dim');
      }
      if (u.flags.giantsStatureActive && !u.fx.some(f => f.key === 'rage')) { /* handled in rage end */ }
    }
    B.tick(u.id, 'e');
    B.units.forEach(x => B.touch(x));
    B.emit({ t: 'endturn', u: u.id });
    if (B.cur === u) B.cur = null;
    B.checkOver();
  };
  B.checkOver = () => {
    if (B.over) return true;
    const up = team => B.units.some(u => u.team === team && B.alive(u) && (u.hp > 0) && !(B.cv(u, 'unconscious') && u.hp <= 0));
    const pcsUp = B.units.some(u => u.team === 'pc' && B.conscious(u));
    const foesUp = B.units.some(u => u.team === 'foe' && B.conscious(u));
    if (!foesUp) B.over = 'win'; else if (!pcsUp) B.over = 'loss';
    if (B.over) { B.emit({ t: 'over', result: B.over }); B.log(B.over === 'win' ? 'Victory!' : 'Defeat. The party has fallen.', B.over === 'win' ? 'good' : 'bad'); }
    return !!B.over;
  };

  /* ===== action economy ===== */
  B.actsLeft = u => (u.turn ? u.turn.acts : 0);
  B.canSpend = (u, n, kind) => {
    if (n === 0) return true;
    if (u.turn.quick && n === 1 && kind && u.turn.quick.includes(kind)) return true;
    return u.turn.acts >= n;
  };
  B.spend = (u, n, kind) => {
    if (n === 0) return true;
    if (u.turn.quick && n === 1 && kind && u.turn.quick.includes(kind)) { u.turn.quick = null; return true; }
    if (u.turn.acts < n) return false;
    u.turn.acts -= n; return true;
  };
  B.actsTotal = u => (u.turn.acts || 0) + (u.turn.quick ? 1 : 0);
  B.moveTo = (u, path, o) => B.moveAlong(u, path, o || {});

  PF.installActions(B);
  if (PF.installAI) PF.installAI(B);
  return B;
};

})(typeof window !== 'undefined' ? window : globalThis);
