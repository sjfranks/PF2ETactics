/* actions.js — Strikes, basic/skill actions, class & monster abilities, spellcasting, action catalogue */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D, U = PF.U;
const PHYS = ['bludgeoning', 'piercing', 'slashing'];
const SNEAK = L => L >= 17 ? 4 : L >= 11 ? 3 : L >= 5 ? 2 : 1;

PF.installActions = function (B) {

  /* ================= STRIKES ================= */
  B.mapPen = (u, s, t) => {
    const n = u.turn ? u.turn.attacks : 0; if (!n) return 0;
    const agile = s && s.traits && s.traits.includes('agile');
    const flurry = u.flags.edgeFlurry && t && u.prey === t.id;
    if (n === 1) return flurry ? (agile ? -2 : -3) : (agile ? -4 : -5);
    return flurry ? (agile ? -4 : -6) : (agile ? -8 : -10);
  };
  B.rangeOK = (u, s, t, extraReach = 0) => {
    if (s.kind === 'melee') return B.inReach(u, t, B.reachOf(u, s) + extraReach);
    const d = B.dist(u, t); return d <= (s.range || 0) * 6 && d > 0;
  };
  // gather everything needed to resolve or preview a Strike
  B.prepStrike = (u, s, t, o = {}) => {
    const R = { ok: true, why: '', atk: [], ac: [], flat: 0, flatWhy: '', fortune: 0, cover: 0, og: null };
    if (!t || !B.alive(t)) return Object.assign(R, { ok: false, why: 'No target' });
    if (s.kind === 'ranged' && s.qty === 0) return Object.assign(R, { ok: false, why: 'Out of ammunition' });
    if (s.reload && !s.loaded) return Object.assign(R, { ok: false, why: 'Needs reloading' });
    if (!B.rangeOK(u, s, t, o.extraReach || 0)) return Object.assign(R, { ok: false, why: s.kind === 'melee' ? 'Out of reach' : 'Out of range' });
    const tr = B.trace(u, t);
    if (tr.blocked) return Object.assign(R, { ok: false, why: 'No line of effect' });
    if (B.cv(u, 'restrained')) return Object.assign(R, { ok: false, why: 'Restrained' });
    const spell = !!o.spellAtk;
    const ctx = { attr: s.atkAttr || 'str', target: t, melee: s.kind === 'melee' };
    if (spell) R.atk.push({ t: 'unt', v: B.stat(u, 'spellatk'), s: 'spell attack' });
    else { R.atk.push({ t: 'unt', v: s.atk.base, s: 'base' }); if (s.atk.item) R.atk.push({ t: 'item', v: s.atk.item, s: 'potency' }); R.atk = R.atk.concat(B.mods(u, 'atk', ctx)); }
    if (spell) R.atk = R.atk.concat(B.mods(u, 'atk', ctx).filter(m => m.s !== 'prone' || true).filter(m => m.t !== 'item'));
    if (!o.noMAP) { const m = B.mapPen(u, s, t); if (m) R.atk.push({ t: 'unt', v: m, s: 'multiple attack' }); }
    if (s.kind === 'ranged' && !spell) {
      const d = B.dist(u, t); const inc = s.range || 10; const k = Math.floor((d - 1) / inc);
      let pen = -2 * k; if (u.prey === t.id && k >= 1) pen += 2;
      if (pen) R.atk.push({ t: 'unt', v: pen, s: 'range increment' });
      const vol = (s.traits.find(x => x.startsWith('volley-')) || '').slice(7);
      if (vol && d <= +vol && !B.hasFx(u, 'pointBlank')) R.atk.push({ t: 'unt', v: -2, s: 'volley' });
    }
    if (s.traits.includes('sweep') && u.turn.attackedIds && u.turn.attackedIds.size && !u.turn.attackedIds.has(t.id)) R.atk.push({ t: 'circ', v: 1, s: 'sweep' });
    if (o.atkMods) R.atk = R.atk.concat(o.atkMods);
    // defense
    R.ac = B.statParts(t, 'ac', { attacker: u });
    u._meleeNow = s.kind === 'melee';
    R.og = o.forceOG ? 'feint' : B.offGuardWhy(t, u);
    u._meleeNow = false;
    if (R.og) R.ac.push({ t: 'circ', v: -2, s: 'off-guard (' + R.og + ')' });
    R.cover = tr.cover; const tc = B.coverVs(t, u); R.cover = tc;
    if (s.kind === 'melee' && R.cover === 1) R.cover = 0; // creatures don't give cover vs melee in reach
    if (R.cover) R.ac.push({ t: 'circ', v: B.coverMod(R.cover), s: B.COVERN[R.cover] });
    if (t.flags.edgeOutwit && t.prey === u.id) R.ac.push({ t: 'circ', v: 1, s: 'outwit' });
    // flat checks
    if (B.isHiddenTo(t, u) || B.cv(u, 'blinded')) { R.flat = 11; R.flatWhy = 'hidden'; }
    else if (!o.ignoreConceal && (tr.conceal || t.fx.some(f => f.concealed) || B.cv(u, 'dazzled'))) { R.flat = 5; R.flatWhy = 'concealed'; }
    if (u.fx.some(f => f.fortuneStrike) && !spell) R.fortune = 1;
    R.atkTotal = PF.sumMods(R.atk).total; R.acTotal = PF.sumMods(R.ac).total;
    return R;
  };
  B.pickDmgType = (s, t) => {
    const types = [s.dmg[0].type].concat(s.alt ? [s.alt] : []);
    let best = types[0], bs = -999;
    types.forEach(ty => { const sc = B.weakOf(t, ty) - B.resistOf(t, ty) - (B.immuneTo(t, ty) ? 99 : 0); if (sc > bs) { bs = sc; best = ty; } });
    return best;
  };
  // returns damage specification (unrolled) for a strike
  B.dmgSpec = (u, s, t, o = {}, prep = {}) => {
    const main = s.dmg[0]; const type = B.pickDmgType(s, t);
    let n = main.n + (o.extraDice || 0);
    const base = { n, d: main.d, m: main.m, type, main: true };
    const parts = [base];
    s.dmg.slice(1).forEach(p => parts.push(Object.assign({}, p)));
    if (o.extraParts) o.extraParts.forEach(p => parts.push(Object.assign({}, p)));
    const ctx = { dmgAttr: s.dmgAttr, melee: s.kind === 'melee', target: t, strike: s };
    const mods = B.mods(u, 'dmg', ctx).concat(o.dmgMods || []);
    if (s.traits.includes('forceful') && u.turn.attacks >= 1) mods.push({ t: 'circ', v: main.n * (u.turn.attacks >= 2 ? 2 : 1), s: 'forceful' });
    if (s.kind === 'ranged' && B.hasFx(u, 'pointBlank') && B.dist(u, t) <= (s.range || 0)) mods.push({ t: 'circ', v: 2, s: 'point-blank' });
    if (u.flags.crossbowAce && s.wid && s.wid.includes('crossbow') && u.turn.crossbowAce) mods.push({ t: 'circ', v: 2, s: 'crossbow ace' });
    if (u.fx.some(f => f.key === 'rage') && s.kind === 'melee') { /* rage handled via fx mods */ }
    const sm = PF.sumMods(mods); base.m += sm.total;
    const og = prep.og;
    const prec = [];
    const finesseLike = s.traits.includes('agile') || s.traits.includes('finesse') || s.kind === 'ranged' || (u.flags.ruffian && s.cat === 'simple');
    if (u.flags.sneakAttack && og && finesseLike) prec.push({ n: SNEAK(u.level), d: 6, m: 0, type, precision: true, s: 'sneak attack' });
    else if (u.flags.slyStriker && !og && finesseLike) prec.push({ n: u.level >= 14 ? 2 : 1, d: 6, m: 0, type, precision: true, s: 'sly striker' });
    if (u.flags.mSneak && og) prec.push({ n: u.flags.mSneakDice || 1, d: 6, m: 0, type, precision: true, s: 'sneak attack' });
    if (u.flags.edgePrecision && u.prey === t.id && !u.turn.preyHit) prec.push({ n: u.level >= 19 ? 3 : u.level >= 11 ? 2 : 1, d: 8, m: 0, type, precision: true, s: 'precision edge', edge: true });
    if (s.traits.includes('backstabber') && og) prec.push({ n: 0, d: 0, m: s.atk && s.atk.item >= 3 ? 2 : 1, type, precision: true, s: 'backstabber' });
    if (u.flags.packAttack && B.alliesOf(u).filter(a => B.threatens(a, t)).length >= 2) prec.push({ n: u.flags.packN || 1, d: u.flags.packD || 4, m: 0, type, s: 'pack attack' });
    const deadly = s.traits.find(x => x.startsWith('deadly-d')); const fatal = s.traits.find(x => x.startsWith('fatal-d'));
    return { parts, prec, mods: sm, deadly: deadly ? +deadly.slice(8) : 0, fatal: fatal ? +fatal.slice(7) : 0, type, n: main.n };
  };
  B.avgDmg = (spec, crit) => {
    let a = 0; const all = spec.parts.concat(spec.prec);
    all.forEach((p, i) => { let d = p.d; if (crit && spec.fatal && p.main) d = spec.fatal; a += p.max ? (p.n || 0) * d + (p.m || 0) : (p.n || 0) * (d + 1) / 2 + (p.m || 0); });
    a = Math.max(1, a);
    if (crit) { a *= 2; if (spec.deadly) a += (spec.n >= 4 ? 3 : spec.n >= 3 ? 2 : 1) * (spec.deadly + 1) / 2; if (spec.fatal) a += (spec.fatal + 1) / 2; }
    return a;
  };
  // preview for UI and AI
  B.strikePreview = (u, s, t, o = {}) => {
    const R = B.prepStrike(u, s, t, o);
    if (!R.ok) return R;
    const p = PF.pdeg(R.atkTotal, R.acTotal, R.fortune);
    const fc = R.flat ? (21 - R.flat) / 20 : 1;
    R.p = p.map((x, i) => i >= 2 ? x * fc : x);
    R.p[1] += (1 - fc) * (p[2] + p[3]);
    const spec = B.dmgSpec(u, s, t, o, R);
    R.spec = spec; R.avgHit = B.avgDmg(spec, false); R.avgCrit = B.avgDmg(spec, true);
    // resistances rough
    const res = B.resistOf(t, spec.type) - B.weakOf(t, spec.type);
    R.avgHit = Math.max(0, R.avgHit - res); R.avgCrit = Math.max(0, R.avgCrit - res);
    if (B.immuneTo(t, spec.type)) { R.avgHit = 0; R.avgCrit = 0; }
    R.ev = R.p[2] * R.avgHit + R.p[3] * R.avgCrit + (o.certain ? R.p[1] * Math.max(1, spec.parts[0].n + spec.parts[0].m) : 0);
    R.hitPct = Math.round((R.p[2] + R.p[3]) * 100); R.critPct = Math.round(R.p[3] * 100);
    return R;
  };
  B.bestStrike = (u, t, filter) => {
    let best = null, bv = -1;
    u.strikes.forEach(s => { if (filter && !filter(s)) return; const pv = B.strikePreview(u, s, t); if (pv.ok && pv.ev > bv) { bv = pv.ev; best = s; } });
    if (!best) best = u.strikes.find(s => (!filter || filter(s)) && B.prepStrike(u, s, t).ok) || null;
    return best;
  };
  // reactions provoked by u doing something within reach. kind: 'manipulate'|'ranged'|'move'
  B.provoke = (u, kind) => {
    let disrupted = false;
    const rs = B.units.filter(r => r.team !== u.team && B.alive(r) && (r.flags.reactiveStrike || (r.flags.disruptPrey && r.prey === u.id)) && !(r.rsMoveOnly && kind !== 'move') && B.canReact(r, 'reactiveStrike') && B.inReach(r, u, B.rsReach(r)));
    for (const r of rs) {
      if (!B.conscious(u)) break;
      const deg = B.reactiveStrike(r, u, kind === 'manipulate' ? 'uses a manipulate action' : kind === 'ranged' ? 'makes a ranged attack' : 'moves');
      if (deg === 3 && kind === 'manipulate') {
        if (u.flags.steadySpellcasting) { const f = B.flat(15, 'Steady Spellcasting'); B.log(f.txt, f.ok ? 'good' : 'bad'); if (f.ok) continue; }
        disrupted = true;
      }
    }
    return { disrupted };
  };
  B.rsReach = r => r.rsOnly ? Math.max(5, ...r.strikes.filter(x => x.kind === 'melee' && r.rsOnly.some(n => x.name.toLowerCase().includes(n))).map(x => B.reachOf(r, x)), 5) : B.reachOf(r);
  B.reactiveStrike = (r, u, why) => {
    const s = B.bestStrike(r, u, x => x.kind === 'melee' && (!r.rsOnly || r.rsOnly.some(n => x.name.toLowerCase().includes(n))));
    if (!s) return -1;
    B.useReact(r, 'reactiveStrike');
    B.log(B.nm(r) + ' makes a Reactive Strike as ' + B.nm(u) + ' ' + why + '!', 'react');
    B.emit({ t: 'float', u: r.id, text: 'Reactive Strike', c: 'react' });
    return B.strike(r, s, u, { reaction: true, noMAP: true, label: 'Reactive Strike' });
  };

  // execute a Strike. Returns degree (-1 if invalid)
  B.strike = (u, s, t, o = {}) => {
    if (s.kind === 'ranged' && !o.reaction && !o.noProvoke) { B.provoke(u, 'ranged'); if (!B.canAct(u) || !B.alive(t)) return -1; }
    const R = B.prepStrike(u, s, t, o);
    if (!R.ok) { B.log(B.nm(u) + ' cannot Strike ' + B.nm(t) + ': ' + R.why + '.', 'dim'); return -1; }
    // Nimble Dodge (before the roll)
    if (t.flags.nimbleDodge && B.canReact(t) && !B.cv(t, 'unconscious') && t.react > 0) {
      const p = PF.pdeg(R.atkTotal, R.acTotal);
      if (p[2] + p[3] > 0.45) { t.react--; R.ac.push({ t: 'circ', v: 2, s: 'nimble dodge' }); R.acTotal = PF.sumMods(R.ac).total; B.log(B.nm(t) + ' uses Nimble Dodge (+2 AC).', 'react'); }
    }
    if (u.fx.some(f => f.fortuneStrike)) B.removeFx(u, f => f.fortuneStrike);
    const label = o.label || (o.spellAtk ? o.spellName : s.name);
    const ranged = s.kind === 'ranged';
    let deg;
    let flatTxt = '';
    if (R.flat) { const f = B.flat(R.flat, R.flatWhy); flatTxt = ' [' + f.txt + ']'; if (!f.ok) deg = 1; }
    const roll = B.d20(R.fortune); const total = roll.nat + R.atkTotal;
    if (deg == null) deg = PF.degree(total, R.acTotal, roll.nat);
    // Reactive Shield
    if (deg >= 2 && !ranged && t.flags.reactiveShield && t.shield && !t.shield.raised && !t.shield.broken && B.canReact(t)) {
      B.useReact(t); t.shield.raised = true; B.emit({ t: 'shield', u: t.id, v: true });
      const ac2 = R.acTotal + Math.max(0, t.shield.ac - Math.max(0, ...R.ac.filter(m => m.t === 'circ' && m.v > 0).map(m => m.v)));
      const d2 = PF.degree(total, ac2, roll.nat);
      B.log(B.nm(t) + ' snaps up a Reactive Shield' + (d2 < deg ? ' — turning the blow!' : '.'), 'react'); deg = d2; R.acTotal = ac2;
    }
    if (o.forceDeg != null) deg = o.forceDeg;
    let critNote = '';
    if (deg === 3 && B.immuneTo(t, 'critical-hits')) { deg = 2; critNote = ' (immune to critical hits)'; }
    const detail = 'd20 ' + roll.txt + ' ' + U.sgn(R.atkTotal) + ' = ' + total + ' vs AC ' + R.acTotal + ' | atk: ' + PF.modText(PF.sumMods(R.atk).used.concat([])) + ' | AC: ' + PF.modText(PF.sumMods(R.ac).used) + flatTxt;
    B.log(B.nm(u) + ' → ' + B.nm(t) + ' · ' + label + ': ' + total + ' vs AC ' + R.acTotal + ' — ' + PF.DEG[deg] + critNote + (R.og ? ' (off-guard: ' + R.og + ')' : '') + (R.cover ? ' (' + B.COVERN[R.cover] + ')' : '') + (flatTxt && deg === 1 && R.flat ? flatTxt : ''), 'deg' + deg, detail);
    B.emit({ t: 'attack', a: u.id, b: t.id, ranged, deg, c: o.color || (o.spellAtk ? o.spellType : 'weapon'), w: (s.wid || s.group || s.name || '').toLowerCase() });
    if (s.kind === 'ranged') { if (s.qty != null && s.thrown) s.qty--; if (s.reload) s.loaded = false; }
    // attack bookkeeping
    if (!o.noMAPinc && !(o.exacting && deg <= 1)) u.turn.attacks += (o.mapCount || 1);
    (u.turn.attackedIds = u.turn.attackedIds || new Set()).add(t.id);
    if (u.hiddenFrom && u.hiddenFrom.size) B.clearHidden(u, 'attacked');
    u.fx = u.fx.filter(f => f.key !== 'takeCover');
    if (u.turn.crossbowAce && s.wid && s.wid.includes('crossbow')) u.turn.crossbowAce = false;
    t.fx = t.fx.filter(f => !(f.offGuard && f.once && f.vs === u.id && (!f.melee || s.kind === 'melee')));
    const magical = !!(o.spellAtk || s.traits.includes('magical') || (s.atk && s.atk.item > 0) || s.monster && u.level >= 5);
    const splashParts = (s.dmg || []).filter(p => p.splash);
    if (deg >= 2 || (deg === 1 && o.certain)) {
      const spec = B.dmgSpec(u, s, t, o, R);
      const crit = deg === 3;
      const persist = spec.parts.filter(p => p.persistent);
      spec.parts = spec.parts.filter(p => !p.persistent && !p.splash);
      let parts = spec.parts.map(p => Object.assign({}, p, crit && spec.fatal && p.main ? { d: spec.fatal } : {}, o.maxDice && p.main ? { max: true } : {}, deg === 1 ? { min: true } : {}));
      let prec = deg === 1 ? [] : spec.prec;
      if (deg === 1) parts = parts.slice(0, 1);
      if (spec.prec.some(p => p.edge)) u.turn.preyHit = true;
      let rolled = B.rollParts(parts.concat(prec));
      let rp = rolled.parts;
      if (crit) {
        rp = B.scaleParts(rp, 2);
        const extra = [];
        if (spec.deadly) extra.push({ n: spec.n >= 4 ? 3 : spec.n >= 3 ? 2 : 1, d: spec.deadly, m: 0, type: spec.type });
        if (spec.fatal) extra.push({ n: 1, d: spec.fatal, m: 0, type: spec.type });
        if (u.flags.critSpec || (u.fx.some(f => f.key === 'rage') && u.flags.brutality && s.kind === 'melee')) { if (s.group === 'pick') extra.push({ n: 0, d: 0, m: 2 * spec.n, type: spec.type }); }
        if (extra.length) rp = rp.concat(B.rollParts(extra).parts);
      }
      // minimum 1 damage
      const sum = rp.reduce((a, p) => a + p.total, 0); if (sum < 1 && rp.length) rp[0].total = 1;
      const dealt = B.dealDamage(t, rp, { src: u, crit, strike: s, label: '', spell: !!o.spellAtk, magical, traits: s.traits });
      if (deg >= 2) persist.forEach(p => B.addPersistent(t, crit ? Object.assign({}, p, { n: (p.n || 0) * 2, m: (p.m || 0) * 2 }) : Object.assign({}, p), u));
      if (deg >= 2 && splashParts.length) B.splash(u, t, splashParts, s);
      u.turn.lastStrikeHit = t.id;
      if (s.name === 'Claw') { u.turn.clawHits = (u.turn.clawHits || 0) + 1; }
      { const rn = s.name.toLowerCase(), R0 = u.turn.rend; if (R0 && R0.tid === t.id && R0.sname === rn) R0.n++; else u.turn.rend = { tid: t.id, sname: rn, n: 1 }; }
      B.afterHit(u, s, t, deg, o, dealt);
    } else {
      u.turn.lastStrikeHit = null; u.turn.rend = null;
      if (deg === 1 && splashParts.length) B.splash(u, t, splashParts, s);
    }
    if (deg === 3 && u.flags.momentum && Object.keys(u.enc.rechargeAt).some(k => u.enc.rechargeAt[k] > B.round)) { u.enc.rechargeAt = {}; B.log(B.nm(u) + "'s critical hit recharges its breath (Draconic Momentum).", 'warn'); }
    if (deg >= 0 && t.reacts && t.reacts.length && B.alive(t) && !o.reaction) B.onStruck(t, u, s, deg);
    if (o.afterAny) o.afterAny(deg);
    B.touch(u); B.touch(t);
    return deg;
  };
  // splash damage: the target and every other creature within 5 feet (not doubled on a critical hit)
  B.splash = (u, t, parts, s) => {
    const r = B.rollParts(parts.map(p => Object.assign({}, p, { splash: false })));
    B.units.filter(x => B.alive(x) && (x === t || B.inReach(t, x, 5))).forEach(x => B.dealDamage(x, r.parts.map(p => Object.assign({}, p)), { src: u, label: 'Splash', splash: true, traits: s.traits, noReact: true }));
  };
  B.afterHit = (u, s, t, deg, o, dealt) => {
    if (!B.alive(t)) return;
    const crit = deg === 3;
    // Monster Core strike riders (Grab / Knockdown / Push follow-ups, afflictions, extra effects)
    let follow = null;
    (s.eff || []).forEach(e => {
      if (!B.alive(t) || deg < 2) return;
      const [k, a] = e.split(':');
      if (k === 'igrab') { if (!B.cv(t, 'grabbed') && !B.cv(t, 'restrained')) { B.setC(t, 'grabbed', 1, B.endOfNext(u), u); B.log(B.nm(u) + ' grabs ' + B.nm(t) + ' (Improved Grab).', 'bad'); } }
      else if (k === 'iknock') { if (!B.flies(t)) { B.knockProne(t); B.log(B.nm(u) + ' knocks ' + B.nm(t) + ' down (Improved Knockdown).', 'bad'); } }
      else if (k === 'ipush') { B.push(t, u, Math.max(1, Math.round((+a || 5) / 5)), u); }
      else if (k === 'mgrab' || k === 'mknock' || k === 'mpush') { follow = follow || { tid: t.id, sid: s.id, effs: [] }; follow.effs.push(e); }
      else if (k === 'aff') { const sp = u.affSpecs && u.affSpecs[a]; if (sp) B.expose(u, t, sp); }
      else if (k === 'rider') { const sp = u.riders && u.riders[a]; if (sp) B.rider(u, t, sp, deg, dealt); }
    });
    if (follow) u.turn.followUp = follow;
    // monster strike riders
    (s.eff || []).forEach(e => {
      if (!B.alive(t)) return;
      if (e === 'knockdown' && deg >= 2) { const c = B.check(u, 'skill:athletics', B.dcOf(t, 'ref')); B.log(B.nm(u) + ' tries to knock ' + B.nm(t) + ' down: ' + B.fmtCheck(c, 'Athletics'), 'deg' + c.deg); if (c.deg >= 2) B.knockProne(t); }
      const pm = e.match(/^paralysis(\d+)$/);
      if (pm && deg >= 2 && !B.immuneTo(t, 'paralyzed') && t.anc !== 'elf') { const d = B.save(t, 'fort', +pm[1] + (u.abilDC || 0), { src: u }); if (d <= 1) { B.setC(t, 'paralyzed', 1, B.rounds(t, d === 0 ? 2 : 1), u); B.log(B.nm(t) + ' is paralyzed!', 'bad'); } }
      const po = e.match(/^poison:(\d+):(\S+)$/);
      if (po && deg >= 2 && !B.immuneTo(t, 'poison') && B.isLiving(t)) { const d = B.save(t, 'fort', +po[1] + (u.abilDC || 0), { src: u }); if (d <= 1) { const r = B.rollParts([U.dice(po[2], 'poison')]); B.dealDamage(t, d === 0 ? B.scaleParts(r.parts, 2) : r.parts, { src: u, label: 'Poison' }); B.setC(t, 'enfeebled', d === 0 ? 2 : 1, B.rounds(t, 2), u); } }
      const dr = e.match(/^drained:(\d+)$/);
      if (dr && deg >= 2 && B.isLiving(t)) { const d = B.save(t, 'fort', +dr[1] + (u.abilDC || 0), { src: u }); if (d <= 1) { B.setC(t, 'drained', Math.min(4, B.cv(t, 'drained') + (d === 0 ? 2 : 1)), null, u); B.log(B.nm(t) + ' is drained ' + B.cv(t, 'drained') + '.', 'bad'); } }
      if (e === 'grab' && deg >= 2) { B.setC(t, 'grabbed', 1, B.endOfNext(u), u); B.log(B.nm(u) + ' grabs ' + B.nm(t) + '.', 'bad'); }
      if (e === 'persistFire1' && deg >= 2) B.addPersistent(t, { n: 0, d: 0, m: crit ? 2 : 1, type: 'fire' }, u);
      if (e === 'splash1') { B.units.filter(x => x !== t && B.alive(x) && B.inReach(t, x, 5)).concat([t]).forEach(x => B.dealDamage(x, [{ type: 'fire', total: 1 }], { src: u, label: 'Splash' })); }
    });
    // rend
    if (u.flags.rend && s.name === 'Claw' && u.turn.clawHits === 2 && !u.turn.rended) {
      u.turn.rended = true; const r = B.rollParts([Object.assign({}, s.dmg[0])]); B.log(B.nm(u) + ' rends ' + B.nm(t) + '!', 'bad'); B.dealDamage(t, r.parts, { src: u, label: 'Rend' });
    }
    // critical specialization
    if (crit && B.alive(t) && s.group) {
      const cs = u.flags.critSpec || (u.flags.brutality && u.fx.some(f => f.key === 'rage') && s.kind === 'melee') || (u.flags.weaponTricks && (s.traits.includes('agile') || s.traits.includes('finesse')) && B.offGuardWhy(t, u)) ||
        (u.flags.critSpecUnarmed && s.traits.includes('unarmed')) || (u.flags.ruffian && s.cat === 'simple' && B.offGuardWhy(t, u)) ||
        Object.keys(u.flags).some(k => k.startsWith('critSpecAnc_') && (D.ancWeapons[k.slice(12)] || []).includes(s.wid));
      if (cs) B.critSpec(u, s, t);
    }
    // Opportune Backstab from allies
    if (s.kind === 'melee' && deg >= 2 && !o.reaction) {
      const ob = B.alliesOf(u).find(a => a.flags.opportuneBackstab && B.canReact(a) && B.inReach(a, t, B.reachOf(a)) && B.alive(t));
      if (ob) { const s2 = B.bestStrike(ob, t, x => x.kind === 'melee'); if (s2) { B.useReact(ob); B.log(B.nm(ob) + ' seizes the opening — Opportune Backstab!', 'react'); B.strike(ob, s2, t, { reaction: true, noMAP: true, label: 'Opportune Backstab' }); } }
    }
    // cleave
    if (!B.alive(t) || t.hp <= 0) {
      if (u.flags.cleave && s.kind === 'melee' && B.canReact(u) && u.fx.some(f => f.key === 'rage')) {
        const n2 = B.foesOf(u).find(f => f !== t && B.conscious(f) && B.inReach(u, f, B.reachOf(u, s)) && B.inReach(t, f, 5));
        if (n2) { B.useReact(u); B.log(B.nm(u) + ' cleaves through to ' + B.nm(n2) + '!', 'react'); B.strike(u, s, n2, { reaction: true, noMAP: true, label: 'Cleave' }); }
      }
    }
    if (u.flags.debilitating && B.alive(t) && B.offGuardWhy(t, u) && s.kind) { B.addFx(t, { name: 'Debilitated (off-guard)', key: 'debil' + u.id, offGuard: true, vs: null, exp: B.endOfNext(u), bad: true }); }
  };
  // extra effects attached to a monster's Strike (sinful bite, energy drain…): {name, save, dc, basic, dmg, outc, heal, temp, crit, needDmg, living, traits}
  B.rider = (u, t, sp, deg, dealt) => {
    if (!B.alive(t)) return;
    if (sp.crit && deg !== 3) return;
    if (sp.needDmg && !(dealt > 0)) return;
    if (sp.living && !B.isLiving(t)) return;
    const tr = sp.traits || [];
    if ((tr.includes('mental') || tr.includes('emotion')) && B.immuneTo(t, 'mental')) return;
    if (tr.includes('poison') && B.immuneTo(t, 'poison')) return;
    if (tr.includes('death') && B.immuneTo(t, 'death')) return;
    if (sp.once && u.enc.used['rider:' + sp.name + ':' + t.id]) return;
    let d = 1;
    if (sp.save) d = B.save(t, sp.save, sp.dc + (u.abilDC || 0), { src: u, basic: sp.basic, traits: tr, fear: tr.includes('fear'), mental: tr.includes('mental'), emotion: tr.includes('emotion'), incap: tr.includes('incapacitation') });
    if (sp.once) u.enc.used['rider:' + sp.name + ':' + t.id] = true;
    if (sp.dmg && sp.dmg.length && B.alive(t)) {
      const f = sp.save ? (sp.basic ? [2, 1, 0.5, 0][d] : (d <= 1 ? 1 : 0)) : 1;
      if (f > 0) { const r = B.rollParts(sp.dmg.filter(p => !p.persistent)); const got = r.parts.length ? B.dealDamage(t, B.scaleParts(r.parts, f), { src: u, label: sp.name, noReact: true, traits: tr }) : 0; sp.dmg.filter(p => p.persistent).forEach(p => B.addPersistent(t, p, u)); if (sp.drainHeal && got > 0) B.heal(u, got, u, { label: sp.name }); }
    }
    if (sp.outc && sp.outc[d]) B.applyEffects(u, t, sp.outc[d], { name: sp.name, dur: sp.dur });
    if (sp.heal) B.heal(u, sp.heal, u, { label: sp.name });
    if (sp.temp) { u.temp = Math.max(u.temp, sp.temp); B.touch(u); }
  };
  // reactions of a creature that was just attacked: t.reacts = [{name, trig, eff:{kind:'save'|'strike'|'recharge', ...}}]
  const TRIG = {
    crit: (t, a, s, deg) => deg === 3, critMelee: (t, a, s, deg) => deg === 3 && s.kind === 'melee',
    hitMelee: (t, a, s, deg) => deg >= 2 && s.kind === 'melee', damaged: (t, a, s, deg) => deg >= 2,
    damagedAdj: (t, a, s, deg) => deg >= 2 && B.inReach(t, a, 5), damagedInReach: (t, a, s, deg) => deg >= 2 && s.kind === 'melee',
    critFailMelee: (t, a, s, deg) => deg === 0 && s.kind === 'melee', attackedMelee: (t, a, s) => s.kind === 'melee'
  };
  B.onStruck = (t, a, s, deg) => {
    for (const r of t.reacts) {
      if (!TRIG[r.trig] || !B.alive(a) || !B.alive(t) || !B.canReact(t)) continue;
      if (!TRIG[r.trig](t, a, s, deg, r)) continue;
      B.doReaction(t, a, r);
    }
  };
  B.doReaction = (t, a, r) => {
    const e = r.eff || {};
    if (e.kind === 'strike') {
      const st = t.strikes.find(x => e.strike && x.name.toLowerCase().includes(e.strike)) || B.bestStrike(t, a, x => x.kind === 'melee');
      if (!st || !B.prepStrike(t, st, a, { noMAP: true }).ok) return false;
      B.useReact(t); B.log(B.nm(t) + ' reacts: ' + r.name + '!', 'react'); B.emit({ t: 'float', u: t.id, text: r.name, c: 'react' });
      B.strike(t, st, a, { reaction: true, noMAP: true, label: r.name, atkMods: e.pen ? [{ t: 'unt', v: e.pen, s: r.name }] : [], extraParts: e.extra ? e.extra.map(p => Object.assign({}, p)) : null });
      return true;
    }
    if (e.kind === 'save') {
      if (e.range && B.dist(t, a) > e.range) return false;
      B.useReact(t); B.log(B.nm(t) + ' reacts: ' + r.name + '!', 'react'); B.emit({ t: 'float', u: t.id, text: r.name, c: 'react' });
      B.rider(t, a, e, 2, 1); return true;
    }
    if (e.kind === 'recharge') {
      if (!Object.keys(t.enc.rechargeAt).some(k => t.enc.rechargeAt[k] > B.round)) return false;
      B.useReact(t); t.enc.rechargeAt = {}; B.log(B.nm(t) + ' reacts: ' + r.name + ' (abilities recharge).', 'react'); return true;
    }
    return false;
  };
  B.onEndTurn = u => {
    // "a creature ends its turn adjacent" reactions (e.g. biting snakes)
    B.units.forEach(t => {
      if (t.team === u.team || !t.reacts || !B.alive(u) || !B.alive(t)) return;
      t.reacts.forEach(r => { if (r.trig === 'endTurnAdj' && B.canReact(t) && B.inReach(t, u, 5)) B.doReaction(t, u, r); });
    });
  };
  B.critSpec = (u, s, t) => {
    const g = s.group; const nm = B.nm(t);
    if (g === 'sword') { B.addFx(t, { name: 'Off-guard (sword)', key: 'csSword', offGuard: true, exp: B.endOfNext(u), bad: true }); B.log('Critical specialization (sword): ' + nm + ' is off-guard.', 'info'); }
    else if (g === 'hammer' || g === 'flail') { B.knockProne(t); B.log('Critical specialization (' + g + ').', 'info'); }
    else if (g === 'club') { B.push(t, u, 2, u); B.log('Critical specialization (club): knocked back.', 'info'); }
    else if (g === 'polearm' || g === 'shield') { B.push(t, u, 1, u); }
    else if (g === 'spear') { B.setC(t, 'clumsy', 1, B.untilStart(u), u); B.log('Critical specialization (spear): ' + nm + ' is clumsy 1.', 'info'); }
    else if (g === 'knife' || g === 'dart') B.addPersistent(t, { n: 1, d: 6, m: s.atk ? s.atk.item : 0, type: 'bleed' }, u);
    else if (g === 'axe') { const o = B.foesOf(u).find(f => f !== t && B.inReach(u, f, B.reachOf(u, s)) && B.inReach(t, f, 5)); if (o) { B.log('Critical specialization (axe) bites into ' + B.nm(o) + '.', 'info'); B.dealDamage(o, [{ type: s.dmg[0].type, total: s.dmg[0].n }], { src: u, label: 'Axe' }); } }
    else if (g === 'brawling') { const d = B.save(t, 'fort', B.classDC(u), { src: u }); if (d <= 1) B.setC(t, 'slowed', 1, B.endOfNext(u), u); }
    else if (g === 'sling') { const d = B.save(t, 'fort', B.classDC(u), { src: u }); if (d <= 1) B.setC(t, 'stunned', 1, null, u); }
  };

  /* ================= SKILL ACTIONS ================= */
  B.demoralize = (u, t, o = {}) => {
    if (B.immuneTo(t, 'mental') || t.enc.demoImmune[u.id]) { B.log(B.nm(t) + ' is unaffected.', 'dim'); return -1; }
    const c = B.check(u, 'skill:intimidation', B.dcOf(t, 'will'), { ctx: {} });
    t.enc.demoImmune[u.id] = true;
    B.log(B.nm(u) + ' Demoralizes ' + B.nm(t) + ': ' + c.total + ' vs Will DC ' + c.dc + ' → ' + PF.DEG[c.deg], 'deg' + c.deg, B.fmtCheck(c));
    B.emit({ t: 'float', u: t.id, text: 'Demoralize', c: 'info' });
    if (c.deg === 3) B.setC(t, 'frightened', 2, null, u); else if (c.deg === 2) B.setC(t, 'frightened', 1, null, u);
    return c.deg;
  };
  const sizeOK = (u, t) => (PF.SIZE[t.size].ord - PF.SIZE[u.size].ord) <= (u.flags.titanWrestler ? 2 : 1);
  B.athletic = (u, t, kind, o = {}) => {
    const def = kind === 'trip' ? 'ref' : 'fort';
    const mods = [{ t: 'unt', v: B.mapPen(u, null, t), s: 'multiple attack' }].filter(m => m.v);
    if (u.flags.furiousBully && u.fx.some(f => f.key === 'rage')) mods.push({ t: 'circ', v: 2, s: 'furious bully' });
    let dc = B.dcOf(t, def);
    if (t.flags.rockDwarf && (kind === 'trip' || kind === 'shove')) dc += 2;
    const c = B.check(u, 'skill:athletics', dc, { mods });
    if (!o.noMAPinc) u.turn.attacks++;
    const NAME = { trip: 'Trip', shove: 'Shove', grapple: 'Grapple' }[kind];
    B.log(B.nm(u) + ' attempts to ' + NAME + ' ' + B.nm(t) + ': ' + c.total + ' vs ' + (def === 'ref' ? 'Reflex' : 'Fortitude') + ' DC ' + dc + ' → ' + PF.DEG[c.deg], 'deg' + c.deg, B.fmtCheck(c));
    B.emit({ t: 'attack', a: u.id, b: t.id, ranged: false, deg: c.deg, c: 'weapon' });
    u.fx = u.fx.filter(f => f.key !== 'takeCover'); if (u.hiddenFrom && u.hiddenFrom.size) B.clearHidden(u, 'attacked');
    const bully = (u.flags.brutalBully && u.fx.some(f => f.key === 'rage') && c.deg >= 2) ? Math.max(1, u.attr.str) : 0;
    if (kind === 'trip') {
      if (c.deg >= 2) { B.knockProne(t); if (c.deg === 3) B.dealDamage(t, B.rollParts([{ n: 1, d: 6, m: 0, type: 'bludgeoning' }]).parts, { src: u, label: 'Trip' }); }
      if (c.deg === 0) B.knockProne(u);
    } else if (kind === 'shove') {
      if (c.deg >= 2) B.push(t, u, c.deg === 3 ? 2 : 1, u);
      if (c.deg === 0) B.knockProne(u);
    } else if (kind === 'grapple') {
      if (c.deg === 3) { B.setC(t, 'restrained', 1, B.endOfNext(u), u); B.log(B.nm(t) + ' is restrained.', 'bad'); }
      else if (c.deg === 2) { B.setC(t, 'grabbed', 1, B.endOfNext(u), u); B.log(B.nm(t) + ' is grabbed.', 'bad'); }
      if (c.deg === 0) B.knockProne(u);
    }
    if (bully && B.alive(t)) B.dealDamage(t, [{ type: 'bludgeoning', total: bully }], { src: u, label: 'Brutal Bully' });
    return c.deg;
  };
  B.feint = (u, t) => {
    const c = B.check(u, 'skill:deception', B.dcOf(t, 'per'));
    B.log(B.nm(u) + ' Feints at ' + B.nm(t) + ': ' + c.total + ' vs Perception DC ' + c.dc + ' → ' + PF.DEG[c.deg], 'deg' + c.deg, B.fmtCheck(c));
    if (c.deg === 3 || (c.deg === 2 && u.flags.scoundrel)) B.addFx(t, { name: 'Off-guard to ' + u.name, key: 'feint' + u.id, offGuard: true, vs: u.id, melee: true, exp: B.endOfNext(u), bad: true });
    else if (c.deg === 2) B.addFx(t, { name: 'Off-guard to ' + u.name, key: 'feint' + u.id, offGuard: true, vs: u.id, melee: true, once: true, exp: B.endOfTurn(u), bad: true });
    else if (c.deg === 0) B.addFx(u, { name: 'Off-guard to ' + t.name, key: 'feintfail' + t.id, offGuard: true, vs: t.id, melee: true, exp: B.endOfNext(u), bad: true });
    return c.deg;
  };

  /* ================= SPELLS ================= */
  const IMM_TRAITS = ['death', 'poison', 'disease', 'curse', 'emotion', 'visual', 'fear'];
  B.castables = u => {
    const out = []; const sp = u.spells;
    const add = (id, rank, src, ref, extra) => { const s = D.spells[id]; if (!s || s.auto === false) return; out.push(Object.assign({ key: src + ':' + id + ':' + rank + ':' + (ref == null ? '' : ref), id, rank, src, ref, spell: s, name: s.name }, extra || {})); };
    if (sp && sp.entries) {
      // Monster Core spellcasting entries (prepared / spontaneous / innate / focus), each with its own DC and attack
      sp.entries.forEach((e, ei) => {
        const X = { entry: ei };
        (e.cantrips || []).forEach(id => add(id, e.cantripRank, 'cantrip', 'e' + ei, X));
        (e.prepared || []).forEach((p, i) => { if (!p.used) add(p.id, p.rank, 'eprep', ei + '.' + i, X); });
        if (e.slots) Object.keys(e.slots).forEach(rk => {
          const r = +rk; const sl = e.slots[rk]; if (sl.used >= sl.max) return;
          (e.rep || []).forEach(p => { const s0 = D.spells[p.id]; if (!s0) return; if (p.rank === r || ((e.sig || []).includes(p.id) && s0.rank <= r && p.rank < r && !e.rep.some(x => x.id === p.id && x.rank === r))) add(p.id, r, 'eslot', ei + '.' + r, Object.assign({ left: sl.max - sl.used }, X)); });
        });
        (e.innate || []).forEach((p, i) => { if (p.used < p.uses) add(p.id, p.rank, 'einnate', ei + '.' + i, Object.assign({ left: p.uses > 50 ? null : p.uses - p.used }, X)); });
        if (u.focus && u.focus.cur > 0) (e.focus || []).forEach(id => add(id, e.focusRank || Math.max(1, Math.ceil(u.level / 2)), 'efocus', 'e' + ei, X));
      });
    }
    if (sp && !sp.entries) {
      (sp.cantrips || []).forEach(id => add(id, sp.cantripRank, 'cantrip'));
      (sp.prepared || []).forEach((e, i) => { if (!e.used) add(e.id, e.rank, 'prepared', i); });
      if (sp.slots) {
        Object.keys(sp.slots).forEach(rk => {
          const r = +rk; const sl = sp.slots[rk]; if (sl.used >= sl.max) return;
          (sp.rep || []).forEach(e => { if (e.rank === r || (sp.sig.includes(e.id) && D.spells[e.id].rank <= r && e.rank < r && !sp.rep.some(x => x.id === e.id && x.rank === r))) add(e.id, r, 'slot', r, { left: sl.max - sl.used }); });
        });
      }
      if (sp.font && sp.font.used < sp.font.max) add(sp.font.id, sp.font.rank, 'font', null, { left: sp.font.max - sp.font.used });
      (sp.innate || []).forEach((e, i) => { if (e.used < e.uses) add(e.id, e.rank, 'innate', i, { left: e.uses - e.used }); });
    }
    (u.comps || []).forEach(id => add(id, sp ? sp.cantripRank : Math.max(1, Math.ceil(u.level / 2)), 'comp'));
    if (u.focus && u.focus.cur > 0) u.focus.spells.forEach(id => add(id, Math.max(1, Math.ceil(u.level / 2)), 'focus'));
    // dedupe identical keys
    const seen = new Set(); return out.filter(c => { const k = c.id + '|' + c.rank + '|' + c.src; if (seen.has(k)) return false; seen.add(k); return true; });
  };
  B.spellCosts = sp => Array.isArray(sp.cost) ? sp.cost : [sp.cost];
  B.spellRange = (sp, actions, meta) => {
    let r = sp.tgt === 'heal' ? (actions === 1 ? 5 : 30) : (sp.area && sp.area.range) ? sp.area.range : (sp.range || 0);
    if (meta === 'reach' && sp.tgt !== 'self' && (r > 0 || sp.tgt === 'touch')) r = Math.max(30, r + 30);
    return r;
  };
  B.spellTargetsN = (sp, r) => typeof sp.n === 'function' ? sp.n(r) : (sp.n || 1);
  B.spellShape = (sp, actions, meta, r) => {
    if (sp.tgt === 'heal' && actions === 3) return { t: 'emanation', r: 30 };
    if (!sp.area) return null;
    const a = Object.assign({}, sp.areaAt && r ? sp.areaAt(r) : sp.area);
    if (meta === 'widen') { if (a.t === 'burst' && a.r >= 10) a.r += 5; else if (a.t === 'cone' || a.t === 'line') a.r += a.r <= (a.t === 'cone' ? 15 : 30) ? 5 : 10; }
    if (meta === 'reach' && a.range) a.range += 30;
    return a;
  };
  // grid area cells
  B.burstCells = (gx, gy, r) => {
    const out = []; const R = Math.ceil(r / 5) + 1;
    for (let x = gx - R; x < gx + R; x++) for (let y = gy - R; y < gy + R; y++) {
      if (!B.tile(x, y)) continue;
      const dx = x >= gx ? x - gx + 1 : gx - x; const dy = y >= gy ? y - gy + 1 : gy - y;
      if (B.feet(dx, dy) <= r) out.push([x, y]);
    }
    return out;
  };
  B.emanationCells = (u, r) => { const out = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) { if (B.distPt(u, x, y) <= r) out.push([x, y]); } return out; };
  B.coneCells = (u, px, py, r) => {
    const c = B.center(u); const dir = Math.atan2(py - c.y, px - c.x); const out = [];
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
      if (x >= u.x && x < u.x + u.sq && y >= u.y && y < u.y + u.sq) continue;
      const d = B.distPt(u, x, y); if (d > r) continue;
      const a = Math.atan2(y + 0.5 - c.y, x + 0.5 - c.x); let da = Math.abs(a - dir); if (da > Math.PI) da = 2 * Math.PI - da;
      if (da <= Math.PI / 4 + 0.08) out.push([x, y]);
    }
    return out;
  };
  B.lineCells = (u, px, py, r) => {
    const c = B.center(u); const ang = Math.atan2(py - c.y, px - c.x); const len = r / 5 + u.sq / 2; const set = new Map();
    for (let i = 0; i <= len * 8; i++) {
      const d = i / 8; const x = c.x + Math.cos(ang) * d, y = c.y + Math.sin(ang) * d; const tx = Math.floor(x), ty = Math.floor(y);
      const t = B.tile(tx, ty); if (!t) break; if (t.los) break;
      if (tx >= u.x && tx < u.x + u.sq && ty >= u.y && ty < u.y + u.sq) continue;
      set.set(tx + ',' + ty, [tx, ty]);
    }
    return [...set.values()];
  };
  B.areaCells = (u, shape, p) => {
    if (!shape) return [];
    if (shape.t === 'burst') return B.burstCells(p.gx, p.gy, shape.r);
    if (shape.t === 'cone') return B.coneCells(u, p.px, p.py, shape.r);
    if (shape.t === 'line') return B.lineCells(u, p.px, p.py, shape.r);
    if (shape.t === 'emanation') return B.emanationCells(u, shape.r);
    return [];
  };
  B.unitsInCells = (cells, origin) => {
    const set = new Set(cells.map(c => c[0] + ',' + c[1]));
    return B.units.filter(t => B.alive(t) && B.cellsOf(t).some(([x, y]) => set.has(x + ',' + y)) && (!origin || !B.trace(origin, t, { ignoreCreatures: true }).blocked));
  };
  B.areaOrigin = (u, shape, p) => {
    if (shape.t === 'burst') return B.cornerPt(p.gx, p.gy);
    return u;
  };
  B.validSpellTarget = (u, c, t, actions, meta) => {
    const sp = c.spell;
    if (!t || !B.alive(t)) return 'No target';
    const kind = sp.tgt;
    if (kind === 'dying') return t.team === u.team && t.dying > 0 && B.dist(u, t) <= (sp.range || 30) ? '' : 'Needs a dying ally in range';
    const isFoe = t.team !== u.team;
    if (kind === 'enemy' && !isFoe) return 'Target an enemy';
    if (kind === 'ally' && isFoe) return 'Target an ally';
    if ((kind === 'enemy' || kind === 'touch' || kind === 'heal') && !B.conscious(t) && isFoe && t.hp <= 0) return 'Already down';
    if (sp.livingOnly && !B.isLiving(t)) return 'Only affects the living';
    if (sp.undeadOnly && !B.isUndead(t)) return 'Only affects undead';
    const range = B.spellRange(sp, actions, meta === undefined ? u.turn && u.turn.meta : meta);
    if (t !== u) {
      if (range <= 5) { if (!B.inReach(u, t, 5)) return 'Must be adjacent'; }
      else if (B.dist(u, t) > range) return 'Out of range (' + range + ' ft)';
      if (B.trace(u, t).blocked) return 'No line of effect';
    } else if (kind === 'enemy') return 'Target an enemy';
    return '';
  };
  B.spendCastable = (u, c) => {
    const sp = u.spells;
    if (c.src === 'prepared') sp.prepared[c.ref].used = true;
    else if (c.src === 'slot') sp.slots[c.ref].used++;
    else if (c.src === 'font') sp.font.used++;
    else if (c.src === 'innate') sp.innate[c.ref].used++;
    else if (c.src === 'focus' || c.src === 'efocus') u.focus.cur--;
    else if (c.src === 'eprep') { const [ei, i] = c.ref.split('.').map(Number); sp.entries[ei].prepared[i].used = true; }
    else if (c.src === 'eslot') { const [ei, r] = c.ref.split('.').map(Number); sp.entries[ei].slots[r].used++; }
    else if (c.src === 'einnate') { const [ei, i] = c.ref.split('.').map(Number); sp.entries[ei].innate[i].used++; }
  };
  // the spellcasting entry a castable belongs to (its DC / attack / tradition apply while casting)
  B.entryOf = (u, c) => (c && c.entry != null && u.spells && u.spells.entries) ? u.spells.entries[c.entry] : null;
  B.withEntry = (u, c, fn) => { const prev = u._entry; u._entry = B.entryOf(u, c); try { return fn(); } finally { u._entry = prev; } };
  B.findCastable = (u, key) => B.castables(u).find(c => c.key === key) || null;
  // cast; p: {targets:[ids], gx,gy | px,py, actions}
  B.cast = (u, c, p = {}) => B.withEntry(u, c, () => B.castInner(u, c, p));
  B.castInner = (u, c, p = {}) => {
    const sp = c.spell; const r = c.rank; const costs = B.spellCosts(sp);
    const actions = p.actions && costs.includes(p.actions) ? p.actions : costs[0];
    if (c.src === 'comp' && u.turn.comp) return { ok: false, err: 'Only one composition per turn' };
    if (u.fx.some(f => f.key === 'rage') && !sp.traits.includes('rage')) return { ok: false, err: 'Can’t cast while raging' };
    if (!B.canSpend(u, actions, 'cast')) return { ok: false, err: 'Not enough actions' };
    // validate
    const meta = p.meta || null;
    const shape = B.spellShape(sp, actions, meta, r);
    let targets = [];
    if (shape) {
      if (shape.t === 'burst') { const rng = shape.range || 0; const corner = B.cornerPt(p.gx, p.gy); if (B.distPt(u, Math.min(p.gx, B.W - 1), Math.min(p.gy, B.H - 1)) > rng + 5 || B.trace(u, corner).blocked) return { ok: false, err: 'Burst centre out of range or blocked' }; }
    } else if (sp.tgt === 'self') { targets = [u]; }
    else if (sp.tgt === 'tile') { if (!B.canEnd(u, p.x, p.y) || B.distPt(u, p.x, p.y) > (sp.range || 0)) return { ok: false, err: 'Invalid destination' }; }
    else if (sp.tgt === 'move2') { const P = B.paths(u, B.speedOf(u) * 2); const path = p.dest ? B.pathFrom(P, p.dest[0], p.dest[1]) : null; if (!path || !B.canEnd(u, p.dest[0], p.dest[1])) return { ok: false, err: 'Can’t reach that square' }; p = Object.assign({}, p, { path }); }
    else {
      targets = (p.targets || []).map(id => B.get(id)).filter(Boolean);
      const want = B.spellTargetsN(sp, r);
      targets = targets.slice(0, want);
      if (!targets.length) return { ok: false, err: 'Choose a target' };
      for (const t of targets) { const why = B.validSpellTarget(u, c, t, actions, meta); if (why) return { ok: false, err: why }; }
    }
    B.spend(u, actions, 'cast');
    u.turn.actsUsed.push('cast');
    if (c.src === 'comp') { u.turn.comp = true; p = Object.assign({}, p, { linger: u.turn.linger || 1, fortissimo: sp.id === 'courageousAnthem' ? (u.turn.fortissimo || 1) : 1 }); u.turn.linger = 0; u.turn.fortissimo = 0; }
    B.spendCastable(u, c);
    const srcName = { prepared: '', slot: '', font: ' (divine font)', focus: ' (focus)', innate: '', cantrip: ' (cantrip)', comp: ' (composition)' }[c.src] || '';
    B.log(B.nm(u) + ' casts ' + sp.name + (sp.rank > 0 || c.src === 'cantrip' ? ' (rank ' + r + ')' : '') + srcName + (costs.length > 1 ? ' with ' + actions + ' actions' : '') + '.', 'cast');
    B.emit({ t: 'cast', u: u.id, c: (sp.traits.find(x => ['fire', 'cold', 'electricity', 'acid', 'sonic', 'force', 'void', 'vitality', 'mental', 'spirit'].includes(x)) || 'arcane') });
    // provoke
    if (sp.traits.includes('manipulate')) { const pr = B.provoke(u, 'manipulate'); if (pr.disrupted) { B.log(B.nm(u) + "'s spell is disrupted!", 'bad'); return { ok: true }; } if (!B.canAct(u)) return { ok: true }; }
    if (u.hiddenFrom && u.hiddenFrom.size && (sp.atk || sp.save)) B.clearHidden(u, 'cast a spell');
    if (sp.cast) { sp.cast(B, u, r, Object.assign({}, p, { targets: targets.map(t => t.id), c }), actions); B.afterCast(u); return { ok: true }; }
    // generic
    let cells = [], origin = u;
    if (shape) {
      cells = B.areaCells(u, shape, p); origin = B.areaOrigin(u, shape, p);
      targets = B.unitsInCells(cells, origin).filter(t => !(t === u && shape.t !== 'burst'));
      B.emit({ t: 'area', u: u.id, cells, c: sp.traits.find(x => ['fire', 'cold', 'electricity', 'acid', 'sonic', 'void', 'vitality', 'mental', 'spirit', 'force'].includes(x)) || 'arcane', shape: shape.t, origin: { x: origin.pt ? origin.x : origin.x + origin.sq / 2, y: origin.pt ? origin.y : origin.y + origin.sq / 2 } });
    }
    if (sp.livingOnly) targets = targets.filter(t => B.isLiving(t));
    if (sp.undeadOnly) targets = targets.filter(t => B.isUndead(t));
    const dtype = sp.traits.find(x => ['fire', 'cold', 'electricity', 'acid', 'sonic', 'void', 'vitality', 'mental', 'spirit', 'force'].includes(x)) || 'arcane';
    const bonusDmg = (c.src === 'prepared' || c.src === 'slot' || c.src === 'innate') && u.flags.dangerousSorcery ? r : 0;
    const burn = u.flags.burnIt && sp.traits.includes('fire') ? Math.max(1, Math.floor(r / 2)) : 0;
    const extraFlat = bonusDmg + burn;
    if (sp.atk) {
      targets.forEach(t => {
        if (!B.alive(t)) return;
        const fake = { name: sp.name, kind: sp.melee ? 'melee' : 'ranged', traits: ['attack'], atk: { base: 0, item: 0 }, atkAttr: 'spell', range: sp.range, reach: sp.melee ? 5 : 0, dmg: [{ n: 0, d: 0, m: 0, type: 'untyped' }] };
        if (!shape) B.emit({ t: 'bolt', a: u.id, b: t.id, c: dtype });
        const deg = B.spellAttack(u, sp, r, t, fake, extraFlat);
        if (sp.onDeg && B.alive(t)) sp.onDeg(B, u, t, deg, r);
      });
    } else if (sp.save) {
      const dc = B.spellDC(u);
      let roll = null;
      if (sp.dmg) { const parts = sp.dmg(r, {}); if (extraFlat) parts[0] = Object.assign({}, parts[0], { m: (parts[0].m || 0) + extraFlat }); roll = B.rollParts(parts); B.log(sp.name + ' damage: ' + roll.text, 'dim'); }
      if (!shape) targets.forEach(t => B.emit({ t: 'bolt', a: u.id, b: t.id, c: dtype }));
      targets.forEach(t => {
        if (!B.alive(t)) return;
        if ((sp.traits.includes('mental')) && B.immuneTo(t, 'mental')) { B.log(B.nm(t) + ' is immune (mindless).', 'dim'); return; }
        if (sp.traits.includes('sleep') && B.immuneTo(t, 'sleep')) { B.log(B.nm(t) + ' is immune to sleep.', 'dim'); return; }
        const imm = IMM_TRAITS.find(x => sp.traits.includes(x) && B.immuneTo(t, x)); if (imm && !roll) { B.log(B.nm(t) + ' is immune (' + imm + ').', 'dim'); return; }
        const deg = B.save(t, sp.save, dc, { basic: sp.basic, src: u, origin, area: !!shape, fear: sp.traits.includes('fear'), mental: sp.traits.includes('mental'), emotion: sp.traits.includes('emotion'), incap: sp.incap, rank: r, spell: true, traits: sp.traits, trad: u._entry ? u._entry.trad : (u.spells && u.spells.trad) });
        const sc = sp.dscale || (sp.basic ? [2, 1, 0.5, 0] : null);
        if (roll && sc) { const f = sc[deg]; if (f > 0) { const dealt = B.dealDamage(t, B.scaleParts(roll.parts, f), { src: u, spell: true, crit: deg === 0, label: sp.name, area: !!shape, traits: sp.traits }); if (sp.afterDamage) sp.afterDamage(B, u, t, dealt); } }
        if (imm) return;
        if (sp.onDeg && B.alive(t)) sp.onDeg(B, u, t, deg, r);
      });
    } else if (sp.onDeg) targets.forEach(t => sp.onDeg(B, u, t, 2, r));
    if (sp.after) sp.after(B, u, r, p, cells);
    B.afterCast(u);
    return { ok: true };
  };
  B.afterCast = u => { u.fx = u.fx.filter(f => f.key !== 'takeCover'); B.touch(u); };
  B.spellAttack = (u, sp, r, t, fake, extraFlat) => {
    const o = { spellAtk: true, spellName: sp.name, spellType: (sp.traits.find(x => ['fire', 'cold', 'electricity', 'acid', 'force', 'void'].includes(x)) || 'arcane'), noProvoke: true, color: 'spell' };
    const R = B.prepStrike(u, fake, t, o);
    if (!R.ok) { B.log(sp.name + ': ' + R.why + '.', 'dim'); return -1; }
    let deg; let flatTxt = '';
    if (R.flat) { const f = B.flat(R.flat, R.flatWhy); flatTxt = ' [' + f.txt + ']'; if (!f.ok) deg = 1; }
    const roll = B.d20(0); const total = roll.nat + R.atkTotal; if (deg == null) deg = PF.degree(total, R.acTotal, roll.nat);
    if (deg === 3 && B.immuneTo(t, 'critical-hits')) deg = 2;
    u.turn.attacks++;
    B.log(B.nm(u) + ' → ' + B.nm(t) + ' · ' + sp.name + ' (spell attack): ' + total + ' vs AC ' + R.acTotal + ' — ' + PF.DEG[deg] + (R.og ? ' (off-guard)' : '') + (R.cover ? ' (' + B.COVERN[R.cover] + ')' : '') + flatTxt, 'deg' + deg, 'd20 ' + roll.txt + ' ' + U.sgn(R.atkTotal) + ' | AC: ' + PF.modText(PF.sumMods(R.ac).used));
    B.emit({ t: 'attack', a: u.id, b: t.id, ranged: !sp.melee, deg, c: o.spellType, spell: true });
    if (deg >= 2 && sp.dmg) {
      const adj = B.inReach(u, t, 5);
      const parts = sp.dmg(r, { adjacent: adj }); if (extraFlat) parts[0] = Object.assign({}, parts[0], { m: (parts[0].m || 0) + extraFlat });
      let rp = B.rollParts(parts).parts; if (deg === 3) rp = B.scaleParts(rp, 2);
      if (sp.saveAfterHit) { const d2 = B.save(t, sp.saveAfterHit, B.spellDC(u), { basic: true, src: u, spell: true }); rp = B.scaleParts(rp, [2, 1, 0.5, 0][d2]); }
      B.dealDamage(t, rp, { src: u, crit: deg === 3, spell: true, label: sp.name, traits: sp.traits });
    }
    return deg;
  };
  B.castHealHarm = (u, r, p, actions, kind) => {
    const die = u.flags.healingHands && kind === 'heal' ? 10 : 8;
    const parts = [{ n: r, d: die, m: actions === 2 ? 8 * r : 0, type: kind === 'heal' ? 'vitality' : 'void' }];
    const roll = B.rollParts(parts);
    const affectHeal = t => kind === 'heal' ? B.isLiving(t) : B.isUndead(t);
    const affectHarm = t => kind === 'heal' ? B.isUndead(t) : B.isLiving(t);
    let targets = [];
    if (actions === 3) {
      targets = B.unitsWithin(u, 30).filter(t => B.alive(t) && !B.trace(u, t, { ignoreCreatures: true }).blocked);
      if (u.flags.selectiveEnergy) targets = targets.filter(t => t.team === u.team || affectHarm(t));
      B.emit({ t: 'pulse', u: u.id, r: 30, c: kind === 'heal' ? 'heal' : 'void' });
    } else targets = (p.targets || []).map(id => B.get(id)).filter(Boolean);
    B.log(U.cap(kind) + ': ' + roll.text, 'dim');
    targets.forEach(t => {
      if (actions !== 3) B.emit({ t: 'bolt', a: u.id, b: t.id, c: kind === 'heal' ? 'heal' : 'void' });
      if (affectHeal(t)) { if (t.team === u.team || actions !== 3 || !u.flags.selectiveEnergy) B.heal(t, roll.total, u, { spell: true, rank: r, label: kind }); }
      else if (affectHarm(t) && t.team !== u.team) {
        const deg = B.save(t, 'fort', B.spellDC(u), { basic: true, src: u, spell: true });
        const f = [2, 1, 0.5, 0][deg];
        const dmgRoll = actions === 2 ? roll.total : roll.total;
        if (f > 0) B.dealDamage(t, [{ type: kind === 'heal' ? 'vitality' : 'void', total: Math.floor(dmgRoll * f) }], { src: u, spell: true, label: U.cap(kind) });
        if (u.flags.castDown && deg <= 1) B.knockProne(t);
      }
    });
  };
  B.grantStrike = (u, spec) => {
    const base = u.strikes.find(s => s.wid === 'fist') || u.strikes.find(s => s.kind === 'melee');
    if (!base) return;
    u.strikes = u.strikes.filter(s => !(s.granted && s.grantKey === (spec.key || spec.name)));
    const s = U.clone(base);
    Object.assign(s, { id: 'g' + U.uid(''), name: spec.name, wid: null, granted: true, grantKey: spec.key || spec.name, traits: spec.traits.slice(), group: spec.group || 'brawling', reach: spec.reach || 5 });
    s.dmg = [Object.assign({}, base.dmg[0], { d: spec.die, type: spec.dt })].concat((spec.extra || []).map(x => Object.assign({}, x)));
    if (spec.atkBonus) s.atk.base += spec.atkBonus;
    u.strikes.unshift(s);
  };
  B.removeGranted = (u, key) => { u.strikes = u.strikes.filter(s => !(s.granted && s.grantKey === key)); };

  /* ================= ACTION CATALOGUE =================
     Each: name, cost (n | fn), kind (for quickened), tgt, traits, avail(u) -> '' or reason, run(u,p) */
  const A = B.A = {};
  const meleeStrikes = u => u.strikes.filter(s => s.kind === 'melee');
  const hasMelee = u => meleeStrikes(u).length > 0;
  const rageOK = u => !u.fx.some(f => f.key === 'rage') ? '' : '';
  const foeInReach = u => B.foesOf(u).some(f => B.conscious(f) && meleeStrikes(u).some(s => B.inReach(u, f, B.reachOf(u, s))));
  const needFlourish = u => u.turn.flourish ? 'Already used a flourish this turn' : '';
  const raging = u => u.fx.some(f => f.key === 'rage');
  const twoMelee = u => meleeStrikes(u).filter(s => s.wid && s.wid !== 'fist').length >= 2;

  A.stride = { name: 'Stride', cost: 1, kind: 'stride', tgt: 'move', traits: ['move'], group: 'basic', desc: 'Move up to your Speed.',
    avail: u => B.immobile(u) ? 'Immobilized' : '',
    run: (u, p) => { const P = B.paths(u, B.speedOf(u)); const path = B.pathFrom(P, p.dest[0], p.dest[1]); if (!path || !B.canEnd(u, p.dest[0], p.dest[1])) return 'Can’t reach that square'; B.moveAlong(u, path, { actId: U.uid('mv') }); } };
  A.step = { name: 'Step', cost: 1, kind: 'stride', tgt: 'step', traits: ['move'], group: 'basic', desc: 'Move 5 feet without triggering reactions. Can’t Step into difficult terrain.',
    avail: u => B.immobile(u) ? 'Immobilized' : '',
    run: (u, p) => { const [x, y] = p.dest; const range = (u.fx.some(f => f.key === 'stance' && f.stance === 'tiger')) ? 2 : 1; if (Math.max(Math.abs(x - u.x), Math.abs(y - u.y)) > range || !B.canEnd(u, x, y)) return 'Invalid square'; const P = B.paths(u, range * 5, { noDifficult: true }); const path = B.pathFrom(P, x, y); if (!path) return 'Invalid square'; B.moveAlong(u, path, { step: true, kind: 'step' }); } };
  A.strike = { name: 'Strike', cost: 1, kind: 'strike', tgt: 'unit', traits: ['attack'], group: 'strike', desc: 'Attack with a weapon or unarmed attack.',
    avail: u => '', run: (u, p) => { const s = u.strikes.find(x => x.id === p.strike); const t = B.get(p.target); if (!s) return 'No weapon'; const R = B.prepStrike(u, s, t); if (!R.ok) return R.why; B.strike(u, s, t); } };
  A.raiseShield = { name: 'Raise a Shield', cost: 1, tgt: 'none', group: 'basic', desc: 'Your shield grants its circumstance bonus to AC until the start of your next turn; enables Shield Block.',
    avail: u => !u.shield ? 'No shield' : u.shield.broken ? 'Shield is broken' : u.shield.raised ? 'Already raised' : '',
    run: u => { u.shield.raised = true; B.log(B.nm(u) + ' raises their shield (+' + u.shield.ac + ' AC).'); B.emit({ t: 'shield', u: u.id, v: true }); } };
  A.takeCover = { name: 'Take Cover', cost: 1, tgt: 'none', group: 'basic', desc: 'Lesser cover becomes standard and standard becomes greater (+4 AC, Reflex, Stealth) until you move, attack or act otherwise. Prone creatures gain standard cover against ranged attacks.',
    avail: u => B.hasFx(u, 'takeCover') ? 'Already in cover' : '',
    run: u => { B.addFx(u, { name: 'Taking Cover', key: 'takeCover' }); B.log(B.nm(u) + ' takes cover.'); } };
  A.stand = { name: 'Stand', cost: 1, tgt: 'none', traits: ['move'], group: 'basic', desc: 'Stand up from prone. This is a move action and triggers Reactive Strike.',
    avail: u => !B.cv(u, 'prone') ? 'Not prone' : '',
    cost2: u => u.flags.kipUp ? 0 : 1,
    run: u => { if (!u.flags.kipUp) { B.provoke(u, 'move'); if (!B.conscious(u)) return; } B.clrC(u, 'prone'); B.log(B.nm(u) + ' stands up.'); } };
  A.escape = { name: 'Escape', cost: 1, tgt: 'none', traits: ['attack'], group: 'basic', desc: 'Athletics or Acrobatics against the grabber’s DC to break free.',
    avail: u => (B.cv(u, 'grabbed') || B.cv(u, 'restrained')) ? '' : 'Not grabbed',
    run: u => {
      const c0 = u.cond.grabbed || u.cond.restrained; const g = B.get(c0.src);
      const dc = g ? 10 + (g.st.skills.athletics ? g.st.skills.athletics.base : g.level + 5) : 15 + u.level;
      const sk = (u.st.skills.acrobatics.base > u.st.skills.athletics.base) ? 'acrobatics' : 'athletics';
      const c = B.check(u, 'skill:' + sk, dc, { mods: [{ t: 'unt', v: B.mapPen(u), s: 'multiple attack' }].filter(m => m.v) }); u.turn.attacks++;
      B.log(B.nm(u) + ' tries to Escape: ' + B.fmtCheck(c), 'deg' + c.deg);
      if (c.deg >= 2) { B.clrC(u, 'grabbed'); B.clrC(u, 'restrained'); B.log(B.nm(u) + ' breaks free.', 'good'); }
    } };
  A.demoralize = { name: 'Demoralize', cost: 1, tgt: 'unit', traits: ['auditory', 'concentrate', 'emotion', 'fear', 'mental'], group: 'skill', range: 30, desc: 'Intimidation vs Will DC: frightened 1 (2 on a critical success). Each foe becomes immune to your Demoralize for the battle.',
    avail: u => raging(u) && !u.flags.ragingIntimidation ? 'Can’t concentrate while raging' : '',
    valid: (u, t) => t.team === u.team ? 'Target a foe' : B.dist(u, t) > 30 ? 'Out of range (30 ft)' : t.enc.demoImmune[u.id] ? 'Already immune to you' : B.immuneTo(t, 'mental') ? 'Mindless (immune)' : '',
    run: (u, p) => { B.demoralize(u, B.get(p.target)); } };
  A.feint = { name: 'Feint', cost: 1, tgt: 'unit', traits: ['mental'], group: 'skill', desc: 'Deception vs Perception DC: the target is off-guard against your next melee attack this turn (until the end of your next turn on a critical success).',
    valid: (u, t) => t.team === u.team ? 'Target a foe' : !B.inReach(u, t, B.reachOf(u)) ? 'Must be in melee reach' : '',
    run: (u, p) => { B.feint(u, B.get(p.target)); } };
  A.trip = { name: 'Trip', cost: 1, tgt: 'unit', traits: ['attack'], group: 'skill', desc: 'Athletics vs Reflex DC: success knocks the target prone; critical success also deals 1d6 bludgeoning; critical failure, you fall prone.',
    valid: (u, t) => t.team === u.team ? 'Target a foe' : !B.inReach(u, t, Math.max(5, ...meleeStrikes(u).filter(s => s.traits.includes('trip')).map(s => s.reach), 5)) ? 'Out of reach' : !sizeOK(u, t) ? 'Too large' : B.flies(t) ? 'Can’t trip a flyer' : '',
    run: (u, p) => { B.athletic(u, B.get(p.target), 'trip'); } };
  A.shove = { name: 'Shove', cost: 1, tgt: 'unit', traits: ['attack'], group: 'skill', desc: 'Athletics vs Fortitude DC: push the target 5 feet (10 on a critical success). Shove foes into lava or off ledges!',
    valid: (u, t) => t.team === u.team ? 'Target a foe' : !B.inReach(u, t, 5) ? 'Must be adjacent' : !sizeOK(u, t) ? 'Too large' : '',
    run: (u, p) => { B.athletic(u, B.get(p.target), 'shove'); } };
  A.grapple = { name: 'Grapple', cost: 1, tgt: 'unit', traits: ['attack'], group: 'skill', desc: 'Athletics vs Fortitude DC: the target is grabbed (restrained on a critical success) until the end of your next turn.',
    avail: u => u.shield && u.strikes.some(s => s.kind === 'melee' && s.wid && D.weapons[s.wid] && D.weapons[s.wid].hands === 2) ? 'Needs a free hand' : '',
    valid: (u, t) => t.team === u.team ? 'Target a foe' : !B.inReach(u, t, 5) ? 'Must be adjacent' : !sizeOK(u, t) ? 'Too large' : '',
    run: (u, p) => { B.athletic(u, B.get(p.target), 'grapple'); } };
  A.hide = { name: 'Hide', cost: 1, tgt: 'none', traits: ['secret'], group: 'skill', desc: 'Stealth vs the Perception DC of each foe you have standard cover or concealment from. Success: you are hidden (DC 11 flat check to target you, and you make them off-guard).',
    avail: u => B.foesOf(u).some(f => B.conscious(f) && B.hasCoverOrConceal(u, f)) ? '' : 'Need cover or concealment',
    run: u => {
      let n = 0; B.foesOf(u).filter(f => B.conscious(f)).forEach(f => {
        if (!B.hasCoverOrConceal(u, f)) return;
        const mods = []; const cv = B.coverVs(u, f); if (cv >= 2) mods.push({ t: 'circ', v: B.coverMod(cv), s: B.COVERN[cv] });
        const c = B.check(u, 'skill:stealth', B.dcOf(f, 'per'), { mods });
        if (c.deg >= 2) { u.hiddenFrom.add(f.id); n++; }
      });
      B.log(B.nm(u) + ' tries to Hide: hidden from ' + n + ' foe' + (n === 1 ? '' : 's') + '.', n ? 'good' : 'dim'); B.touch(u);
    } };
  A.sneak = { name: 'Sneak', cost: 1, tgt: 'move', half: true, kind: 'stride', traits: ['move', 'secret'], group: 'skill', desc: 'Move up to half your Speed while hidden; Stealth vs Perception DC of each foe. You need cover or concealment at the end.',
    avail: u => !(u.hiddenFrom && u.hiddenFrom.size) ? 'Must be hidden' : B.immobile(u) ? 'Immobilized' : '',
    run: (u, p) => {
      const P = B.paths(u, Math.floor(B.speedOf(u) / 2 / 5) * 5); const path = B.pathFrom(P, p.dest[0], p.dest[1]); if (!path || !B.canEnd(u, p.dest[0], p.dest[1])) return 'Can’t reach that square';
      B.moveAlong(u, path, { sneak: true, actId: U.uid('sn') });
      [...u.hiddenFrom].forEach(id => { const f = B.get(id); if (!f) return; if (!B.hasCoverOrConceal(u, f)) { u.hiddenFrom.delete(id); return; } const c = B.check(u, 'skill:stealth', B.dcOf(f, 'per')); if (c.deg < 2) u.hiddenFrom.delete(id); });
      B.log(B.nm(u) + ' sneaks' + (u.hiddenFrom.size ? ' and stays hidden from ' + u.hiddenFrom.size + '.' : ' but is spotted.'), u.hiddenFrom.size ? 'good' : 'dim'); B.touch(u);
    } };
  A.seek = { name: 'Seek', cost: 1, tgt: 'none', traits: ['concentrate', 'secret'], group: 'skill', desc: 'Perception vs the Stealth DC of hidden foes within 30 feet to reveal them.',
    avail: u => B.foesOf(u).some(f => B.isHiddenTo(f, u)) ? '' : 'No hidden foes',
    run: u => { B.foesOf(u).filter(f => B.isHiddenTo(f, u) && B.dist(u, f) <= 30).forEach(f => { const c = B.check(u, 'per', B.dcOf(f, 'skill:stealth')); B.log(B.nm(u) + ' Seeks ' + B.nm(f) + ': ' + B.fmtCheck(c), 'deg' + c.deg); if (c.deg >= 2) { f.hiddenFrom.delete(u.id); B.touch(f); } }); } };
  A.delay = { name: 'Delay', cost: 0, tgt: 'none', group: 'basic', desc: 'Step out of the initiative order before acting; you act again right after the next creature. Effects that would end at the start of your turn have already ended.',
    avail: u => u.turn.actsUsed.filter(x => x !== 'delay').length ? 'Only before you act' : '', run: u => { B.delay(u); } };
  A.ready = { name: 'Ready Strike', cost: 2, tgt: 'none', traits: ['concentrate'], group: 'basic', desc: 'Prepare a Strike with your best weapon. As a reaction, it triggers when a foe moves into a square where you can hit it (in reach, or in your first range increment). Uses your current multiple attack penalty.',
    avail: u => u.readied ? 'Already readied' : !u.strikes.length ? 'No Strike' : '',
    run: u => { const s = u.strikes.find(x => x.kind === 'melee' && x.wid !== 'fist') || u.strikes.find(x => x.kind === 'ranged') || u.strikes[0]; u.readied = { strike: s.id }; B.log(B.nm(u) + ' readies a Strike with ' + s.name + '.'); B.emit({ t: 'float', u: u.id, text: 'Ready', c: 'info' }); } };
  A.reload = { name: 'Reload', cost: 1, tgt: 'none', traits: ['manipulate'], group: 'basic', desc: 'Interact to reload a weapon with reload 1.',
    avail: u => u.strikes.some(s => s.reload && !s.loaded) ? '' : 'Nothing to reload',
    run: u => { B.provoke(u, 'manipulate'); if (!B.canAct(u)) return; u.strikes.forEach(s => { if (s.reload) s.loaded = true; }); if (u.flags.crossbowAce) u.turn.crossbowAce = true; B.log(B.nm(u) + ' reloads.'); } };
  A.potion = { name: 'Drink Healing Potion', cost: 1, tgt: 'none', traits: ['manipulate'], group: 'item', desc: 'Interact to drink your healing potion.',
    avail: u => !u.potions || u.potions.n <= 0 ? 'No potions left' : B.hp100(u) >= 1 ? 'At full HP' : '',
    run: u => { B.provoke(u, 'manipulate'); if (!B.canAct(u)) return; u.potions.n--; const P = D.potions[u.potions.tier] || D.potions.minor; const r = B.rollParts([P.dice]); B.log(B.nm(u) + ' drinks a ' + P.name + ' (' + r.text + ').'); B.heal(u, r.total, u); } };
  A.medicine = { name: 'Battle Medicine', cost: 1, tgt: 'unit', traits: ['healing', 'manipulate'], group: 'skill', desc: 'Medicine check (DC 15 trained, 20 expert, 30 master) to heal an adjacent creature 2d8 (+10/+30). Once per target per battle.',
    avail: u => u.flags.battleMedicine ? '' : 'Requires Battle Medicine',
    valid: (u, t) => t.team !== u.team ? 'Target an ally' : (t !== u && !B.inReach(u, t, 5)) ? 'Must be adjacent' : t.enc.medImmune ? 'Already treated this battle' : t.hp >= B.maxHP(t) ? 'At full HP' : '',
    run: (u, p) => {
      const t = B.get(p.target); B.provoke(u, 'manipulate'); if (!B.canAct(u)) return;
      const rk = u.st.skills.medicine.rank || 1; const dc = [15, 15, 20, 30, 40][rk]; const bonus = [0, 0, 10, 30, 50][rk];
      const c = B.check(u, 'skill:medicine', dc); t.enc.medImmune = true;
      B.log(B.nm(u) + ' applies Battle Medicine to ' + B.nm(t) + ': ' + B.fmtCheck(c), 'deg' + c.deg);
      if (c.deg >= 2) { let r = B.rollParts([{ n: 2, d: 8, m: bonus }]).total; if (c.deg === 3) r *= 2; B.heal(t, r, u); }
      else if (c.deg === 0) B.dealDamage(t, B.rollParts([{ n: 1, d: 8, m: 0, type: 'untyped' }]).parts, { label: 'Botched treatment' });
    } };
  A.retch = { name: 'Retch', cost: 1, tgt: 'none', group: 'basic', desc: 'Fortitude save to reduce sickened by 1 (2 on a critical success).',
    avail: u => B.cv(u, 'sickened') ? '' : 'Not sickened',
    run: u => { const dc = (u.cond.sickened && u.cond.sickened.dc) || PF.levelDC(u.level); const d = B.save(u, 'fort', dc); if (d >= 2) B.decC(u, 'sickened', d === 3 ? 2 : 1); } };

  /* ---- class actions ---- */
  A.huntPrey = { name: 'Hunt Prey', cost: 1, tgt: 'unit', traits: ['concentrate'], group: 'class', desc: 'Designate a creature you can see within 100 feet as your prey. Ignore the 2nd range increment penalty against it and gain your hunter’s edge.',
    valid: (u, t) => t.team === u.team ? 'Target a foe' : B.dist(u, t) > 100 ? 'Too far' : u.prey === t.id ? 'Already your prey' : '',
    run: (u, p) => { u.prey = p.target; if (u.flags.crossbowAce) u.turn.crossbowAce = true; B.log(B.nm(u) + ' hunts ' + B.nm(B.get(p.target)) + '.'); B.touch(u); } };
  A.rage = { name: 'Rage', cost: 1, tgt: 'none', traits: ['concentrate', 'emotion', 'mental'], group: 'class', desc: 'Gain temporary HP (level + Con), bonus damage on melee Strikes and −1 AC for 1 minute. You can’t use concentrate actions unless they have the rage trait.',
    avail: u => raging(u) ? 'Already raging' : u.enc.used.rageDone ? 'Rage is spent for this battle' : '',
    run: u => {
      const L = u.level; const sub = u.sub;
      const dmg = sub === 'giant' ? (L >= 15 ? 18 : L >= 7 ? 10 : 6) : sub === 'dragon' ? (L >= 15 ? 16 : L >= 7 ? 8 : 4) : sub === 'animal' ? (L >= 15 ? 12 : L >= 7 ? 5 : 2) : (L >= 15 ? 12 : L >= 7 ? 6 : 2);
      const mods = [{ sel: 'dmg', t: 'unt', v: dmg, s: 'rage', when: c => c.melee }, { sel: 'ac', t: 'unt', v: -1, s: 'rage' }];
      const resist = u.flags.ragingResistance ? { [sub === 'dragon' ? 'fire' : sub === 'giant' ? 'bludgeoning' : 'physical']: 3 + u.attr.con } : null;
      B.addFx(u, { name: 'Raging (+' + dmg + ' melee damage)', key: 'rage', mods, resist, exp: B.minute(u), onEnd: (B2, t) => { B2.removeGranted(t, 'jaws'); if (t.fx.some(f => f.key === 'giantsStature')) B2.removeFx(t, f => f.key === 'giantsStature'); } });
      if (sub === 'giant') B.setC(u, 'clumsy', 1, B.minute(u), u);
      if (sub === 'animal') B.grantStrike(u, { name: 'Jaws', key: 'jaws', die: 10, dt: 'piercing', traits: ['unarmed'] });
      const tmp = L + u.attr.con; u.temp = Math.max(u.temp, tmp);
      B.log(B.nm(u) + ' flies into a rage! (+' + tmp + ' temp HP)', 'react'); B.emit({ t: 'float', u: u.id, text: 'RAGE', c: 'crit' });
    } };
  const strikeTarget = (u, p, filter) => { const t = B.get(p.target); const s = p.strike ? u.strikes.find(x => x.id === p.strike) : B.bestStrike(u, t, filter); return [s, t]; };
  const meleeValid = (u, t) => t.team === u.team ? 'Target a foe' : !meleeStrikes(u).some(s => B.prepStrike(u, s, t).ok) ? 'No melee Strike can reach' : '';
  const rangedValid = (u, t) => t.team === u.team ? 'Target a foe' : !u.strikes.some(s => s.kind === 'ranged' && B.prepStrike(u, s, t).ok) ? 'No ranged Strike can reach' : '';
  A.suddenCharge = { name: 'Sudden Charge', cost: 2, tgt: 'move+unit', moveMult: 2, traits: ['flourish', 'open'], group: 'class', desc: 'Stride twice, then make a melee Strike.',
    avail: u => needFlourish(u) || (B.immobile(u) ? 'Immobilized' : '') || (!hasMelee(u) ? 'No melee weapon' : ''),
    run: (u, p) => { u.turn.flourish = true; if (p.dest && (p.dest[0] !== u.x || p.dest[1] !== u.y)) { const P = B.paths(u, B.speedOf(u) * 2); const path = B.pathFrom(P, p.dest[0], p.dest[1]); if (!path || !B.canEnd(u, p.dest[0], p.dest[1])) return 'Can’t reach'; if (!B.moveAlong(u, path, { actId: U.uid('sc') })) return; } const t = B.get(p.target); if (t && B.alive(t)) { const s = B.bestStrike(u, t, x => x.kind === 'melee'); if (s && B.prepStrike(u, s, t).ok) B.strike(u, s, t); else B.log(B.nm(u) + ' can’t reach ' + B.nm(t) + ' after charging.', 'dim'); } } };
  A.monsterCharge = Object.assign({}, A.suddenCharge, { name: 'Charge', desc: 'Stride twice, then Strike with a bonus.', group: 'monster',
    run: (u, p) => { const ab = D.abilities[p.abil] || {}; const r = A.suddenCharge.run; u.turn.flourish = false; const atkMods = ab.bonus ? [{ t: 'circ', v: ab.bonus, s: ab.name }] : []; const dmgMods = ab.dmg ? [{ t: 'circ', v: ab.dmg, s: ab.name }] : [];
      if (p.dest && (p.dest[0] !== u.x || p.dest[1] !== u.y)) { const P = B.paths(u, B.speedOf(u) * 2); const path = B.pathFrom(P, p.dest[0], p.dest[1]); if (!path || !B.canEnd(u, p.dest[0], p.dest[1])) return 'Can’t reach'; if (!B.moveAlong(u, path, { actId: U.uid('mc') })) return; }
      const t = B.get(p.target); if (t && B.alive(t)) { const s = (ab.strike && u.strikes.find(x => x.name === ab.strike)) || B.bestStrike(u, t, x => x.kind === 'melee'); if (s && B.prepStrike(u, s, t).ok) B.strike(u, s, t, { atkMods, dmgMods, label: ab.name }); } } });
  A.doubleSlice = { name: 'Double Slice', cost: 2, tgt: 'unit', traits: [], group: 'class', desc: 'Strike with each of two melee weapons at your current multiple attack penalty.',
    avail: u => !twoMelee(u) ? 'Needs two melee weapons' : '', valid: meleeValid,
    run: (u, p) => { const t = B.get(p.target); const ws = meleeStrikes(u).filter(s => s.wid && s.wid !== 'fist').slice(0, 2); const n0 = u.turn.attacks; ws.forEach(s => { if (B.alive(t) && B.prepStrike(u, s, t).ok) { u.turn.attacks = n0; B.strike(u, s, t, { noMAPinc: true }); } }); u.turn.attacks = n0 + 2; } };
  A.exactingStrike = { name: 'Exacting Strike', cost: 1, tgt: 'unit', traits: ['press'], group: 'class', desc: 'Press: a Strike that doesn’t increase your multiple attack penalty if it misses.',
    avail: u => !u.turn.attacks ? 'Press: needs a previous attack this turn' : '', valid: meleeValid,
    run: (u, p) => { const [s, t] = strikeTarget(u, p, x => x.kind === 'melee'); B.strike(u, s, t, { exacting: true }); } };
  A.snaggingStrike = { name: 'Snagging Strike', cost: 1, tgt: 'unit', group: 'class', desc: 'Strike; on a hit the target is off-guard until the start of your next turn.',
    avail: u => u.shield ? 'Needs a free hand' : '', valid: meleeValid,
    run: (u, p) => { const [s, t] = strikeTarget(u, p, x => x.kind === 'melee'); const d = B.strike(u, s, t); if (d >= 2 && B.alive(t)) B.addFx(t, { name: 'Snagged (off-guard)', key: 'snag', offGuard: true, exp: B.untilStart(u), bad: true }); } };
  A.viciousSwing = { name: 'Vicious Swing', cost: 2, tgt: 'unit', traits: ['flourish'], group: 'class', desc: 'A melee Strike with extra weapon damage dice. Counts as two attacks for your multiple attack penalty (one with Furious Focus).',
    avail: u => needFlourish(u), valid: meleeValid,
    run: (u, p) => { u.turn.flourish = true; const [s, t] = strikeTarget(u, p, x => x.kind === 'melee'); B.strike(u, s, t, { extraDice: u.level >= 18 ? 3 : u.level >= 10 ? 2 : 1, mapCount: u.flags.furiousFocus ? 1 : 2, label: 'Vicious Swing' }); } };
  A.pointBlankStance = { name: 'Point-Blank Stance', cost: 1, tgt: 'none', traits: ['stance'], group: 'class', desc: 'Stance: no volley penalty and +2 circumstance damage within the first range increment.',
    avail: u => B.hasFx(u, 'pointBlank') ? 'Already in stance' : '', run: u => { B.addFx(u, { name: 'Point-Blank Stance', key: 'pointBlank' }); B.log(B.nm(u) + ' takes a point-blank stance.'); } };
  A.intimidatingStrike = { name: 'Intimidating Strike', cost: 2, tgt: 'unit', traits: ['emotion', 'fear', 'mental'], group: 'class', desc: 'A melee Strike; on a hit the target is frightened 1 (2 on a critical hit).',
    valid: meleeValid, run: (u, p) => { const [s, t] = strikeTarget(u, p, x => x.kind === 'melee'); const d = B.strike(u, s, t, { label: 'Intimidating Strike' }); if (d >= 2 && B.alive(t) && !B.immuneTo(t, 'mental')) B.setC(t, 'frightened', d === 3 ? 2 : 1, null, u); } };
  A.lunge = { name: 'Lunge', cost: 1, tgt: 'unit', group: 'class', desc: 'A melee Strike with 5 extra feet of reach.',
    valid: (u, t) => t.team === u.team ? 'Target a foe' : !meleeStrikes(u).some(s => B.prepStrike(u, s, t, { extraReach: 5 }).ok) ? 'Out of reach' : '',
    run: (u, p) => { const t = B.get(p.target); const s = meleeStrikes(u).find(x => B.prepStrike(u, x, t, { extraReach: 5 }).ok); B.strike(u, s, t, { extraReach: 5, label: 'Lunge' }); } };
  A.knockdown = { name: 'Knockdown', cost: 2, tgt: 'unit', traits: ['flourish'], group: 'class', desc: 'A melee Strike; if it hits, Trip the target at the same multiple attack penalty.',
    avail: u => needFlourish(u), valid: meleeValid,
    run: (u, p) => { u.turn.flourish = true; const [s, t] = strikeTarget(u, p, x => x.kind === 'melee'); const n0 = u.turn.attacks; const d = B.strike(u, s, t, { noMAPinc: true, label: 'Knockdown' }); if (d >= 2 && B.alive(t) && sizeOK(u, t)) { u.turn.attacks = n0; B.athletic(u, t, 'trip', { noMAPinc: true }); } u.turn.attacks = n0 + 2; } };
  A.swipe = { name: 'Swipe', cost: 2, tgt: 'unit', traits: ['flourish'], group: 'class', desc: 'One melee attack roll compared against up to two adjacent foes in your reach.',
    avail: u => needFlourish(u), valid: meleeValid,
    run: (u, p) => {
      u.turn.flourish = true; const t = B.get(p.target); const s = B.bestStrike(u, t, x => x.kind === 'melee');
      const t2 = B.foesOf(u).find(f => f !== t && B.conscious(f) && B.prepStrike(u, s, f).ok && B.inReach(t, f, 5));
      const n0 = u.turn.attacks; const nat = U.d(20);
      [t, t2].filter(Boolean).forEach(x => { u.turn.attacks = n0; const R = B.prepStrike(u, s, x); const deg = PF.degree(nat + R.atkTotal, R.acTotal, nat); B.strike(u, s, x, { forceDeg: deg, noMAPinc: true, label: 'Swipe' }); });
      u.turn.attacks = n0 + 2;
    } };
  A.doubleShot = { name: 'Double Shot', cost: 2, tgt: 'unit', traits: ['flourish'], group: 'class', desc: 'Two ranged Strikes (−2 each) against different targets.',
    avail: u => needFlourish(u) || (!u.strikes.some(s => s.kind === 'ranged' && !s.reload) ? 'Needs a reload 0 ranged weapon' : ''), valid: rangedValid,
    run: (u, p) => { u.turn.flourish = true; const t = B.get(p.target); const s = u.strikes.find(x => x.kind === 'ranged' && !x.reload && B.prepStrike(u, x, t).ok); const n0 = u.turn.attacks; const t2 = B.foesOf(u).filter(f => f !== t && B.conscious(f) && B.prepStrike(u, s, f).ok).sort((a, b) => a.hp - b.hp)[0] || null; [t, t2].filter(Boolean).forEach(x => { u.turn.attacks = n0; B.strike(u, s, x, { atkMods: [{ t: 'unt', v: -2, s: 'double shot' }], noMAPinc: true }); }); u.turn.attacks = n0 + 2; } };
  A.tripleShot = { name: 'Triple Shot', cost: 3, tgt: 'unit', group: 'class', desc: 'Three ranged Strikes at −4 each.',
    avail: u => !u.strikes.some(s => s.kind === 'ranged' && !s.reload) ? 'Needs a reload 0 ranged weapon' : '', valid: rangedValid,
    run: (u, p) => { const t = B.get(p.target); const s = u.strikes.find(x => x.kind === 'ranged' && !x.reload && B.prepStrike(u, x, t).ok); const n0 = u.turn.attacks; for (let i = 0; i < 3; i++) { const x = B.alive(t) && B.conscious(t) ? t : B.foesOf(u).find(f => B.conscious(f) && B.prepStrike(u, s, f).ok); if (!x) break; u.turn.attacks = n0; B.strike(u, s, x, { atkMods: [{ t: 'unt', v: -4, s: 'triple shot' }], noMAPinc: true }); } u.turn.attacks = n0 + 3; } };
  A.certainStrike = { name: 'Certain Strike', cost: 1, tgt: 'unit', traits: ['press'], group: 'class', desc: 'Press: a Strike that deals minimum damage even on a failure.',
    avail: u => !u.turn.attacks ? 'Press: needs a previous attack this turn' : '', valid: meleeValid,
    run: (u, p) => { const [s, t] = strikeTarget(u, p, x => x.kind === 'melee'); B.strike(u, s, t, { certain: true, label: 'Certain Strike' }); } };
  A.twinFeint = { name: 'Twin Feint', cost: 2, tgt: 'unit', group: 'class', desc: 'Two melee Strikes against the same target; it is off-guard against the second.',
    avail: u => !twoMelee(u) ? 'Needs two melee weapons' : '', valid: meleeValid,
    run: (u, p) => { const t = B.get(p.target); const ws = meleeStrikes(u).filter(s => s.wid && s.wid !== 'fist'); B.strike(u, ws[0], t); if (B.alive(t)) B.strike(u, ws[1] || ws[0], t, { forceOG: true }); } };
  A.mobility = { name: 'Mobility Stride', cost: 1, kind: 'stride', tgt: 'move', half: true, traits: ['move'], group: 'class', desc: 'Stride up to half your Speed without triggering reactions.',
    avail: u => B.immobile(u) ? 'Immobilized' : '',
    run: (u, p) => { const P = B.paths(u, Math.floor(B.speedOf(u) / 10) * 5); const path = B.pathFrom(P, p.dest[0], p.dest[1]); if (!path || !B.canEnd(u, p.dest[0], p.dest[1])) return 'Can’t reach'; B.moveAlong(u, path, { noReact: true }); } };
  A.skirmishStrike = { name: 'Skirmish Strike', cost: 1, tgt: 'step+unit', traits: ['flourish'], group: 'class', desc: 'Step, then Strike.',
    avail: u => needFlourish(u),
    run: (u, p) => { u.turn.flourish = true; if (p.dest) { const P = B.paths(u, 5, { noDifficult: true }); const path = B.pathFrom(P, p.dest[0], p.dest[1]); if (path && B.canEnd(u, p.dest[0], p.dest[1])) B.moveAlong(u, path, { step: true, kind: 'step' }); } const t = B.get(p.target); const s = B.bestStrike(u, t); if (s && B.prepStrike(u, s, t).ok) B.strike(u, s, t); } };
  A.huntedShot = { name: 'Hunted Shot', cost: 1, tgt: 'unit', traits: ['flourish'], group: 'class', desc: 'Two ranged Strikes against your prey with a reload 0 weapon.',
    avail: u => needFlourish(u) || (!u.prey ? 'Hunt Prey first' : '') || (!u.strikes.some(s => s.kind === 'ranged' && !s.reload) ? 'Needs a reload 0 ranged weapon' : ''),
    valid: (u, t) => t.id !== u.prey ? 'Only your prey' : rangedValid(u, t),
    run: (u, p) => { u.turn.flourish = true; const t = B.get(p.target); const s = u.strikes.find(x => x.kind === 'ranged' && !x.reload && B.prepStrike(u, x, t).ok); B.strike(u, s, t); if (B.alive(t)) B.strike(u, s, t); } };
  A.twinTakedown = { name: 'Twin Takedown', cost: 1, tgt: 'unit', traits: ['flourish'], group: 'class', desc: 'Two melee Strikes against your prey, one with each weapon.',
    avail: u => needFlourish(u) || (!u.prey ? 'Hunt Prey first' : '') || (!twoMelee(u) ? 'Needs two melee weapons' : ''),
    valid: (u, t) => t.id !== u.prey ? 'Only your prey' : meleeValid(u, t),
    run: (u, p) => { u.turn.flourish = true; const t = B.get(p.target); const ws = meleeStrikes(u).filter(s => s.wid && s.wid !== 'fist'); B.strike(u, ws[0], t); if (B.alive(t)) B.strike(u, ws[1] || ws[0], t); } };
  A.huntersAim = { name: "Hunter's Aim", cost: 2, tgt: 'unit', traits: ['concentrate'], group: 'class', desc: 'A ranged Strike against your prey with +2 circumstance to hit that ignores concealment.',
    avail: u => !u.prey ? 'Hunt Prey first' : '', valid: (u, t) => t.id !== u.prey ? 'Only your prey' : rangedValid(u, t),
    run: (u, p) => { const t = B.get(p.target); const s = B.bestStrike(u, t, x => x.kind === 'ranged'); B.strike(u, s, t, { atkMods: [{ t: 'circ', v: 2, s: "hunter's aim" }], ignoreConceal: true, label: "Hunter's Aim" }); } };
  A.runningReload = { name: 'Running Reload', cost: 1, kind: 'stride', tgt: 'move', traits: ['move', 'manipulate'], group: 'class', desc: 'Stride, then reload.',
    avail: u => !u.strikes.some(s => s.reload) ? 'No reload weapon' : B.immobile(u) ? 'Immobilized' : '',
    run: (u, p) => { const P = B.paths(u, B.speedOf(u)); const path = B.pathFrom(P, p.dest[0], p.dest[1]); if (path && B.canEnd(u, p.dest[0], p.dest[1])) B.moveAlong(u, path, {}); if (!B.canAct(u)) return; u.strikes.forEach(s => { if (s.reload) s.loaded = true; }); if (u.flags.crossbowAce) u.turn.crossbowAce = true; B.log(B.nm(u) + ' reloads on the move.'); } };
  A.furiousFinish = { name: 'Furious Finish', cost: 1, tgt: 'unit', traits: ['rage'], group: 'class', desc: 'A Strike that deals maximum damage with its weapon dice; your rage ends and you are fatigued.',
    avail: u => !raging(u) ? 'Must be raging' : '', valid: meleeValid,
    run: (u, p) => { const [s, t] = strikeTarget(u, p, x => x.kind === 'melee'); B.strike(u, s, t, { maxDice: true, label: 'Furious Finish' }); B.removeFx(u, f => f.key === 'rage'); u.enc.used.rageDone = true; B.setC(u, 'fatigued', 1, null, u); } };
  A.knockback = { name: 'Knockback', cost: 1, tgt: 'unit', traits: ['press'], group: 'class', desc: 'Requires your last action to be a successful melee Strike: Shove that target.',
    avail: u => !u.turn.lastStrikeHit ? 'Your last action must be a successful Strike' : '', valid: (u, t) => t.id !== u.turn.lastStrikeHit ? 'Only the creature you just hit' : '',
    run: (u, p) => { B.athletic(u, B.get(p.target), 'shove'); } };
  A.giantsStature = { name: "Giant's Stature", cost: 1, tgt: 'none', traits: ['rage', 'polymorph'], group: 'class', desc: 'Grow to Large size with 5 extra feet of reach until your rage ends.',
    avail: u => !raging(u) ? 'Must be raging' : B.hasFx(u, 'giantsStature') ? 'Already giant' : '',
    run: u => { B.addFx(u, { name: "Giant's Stature (+5 ft reach)", key: 'giantsStature' }); B.log(B.nm(u) + ' swells to giant size!'); } };
  A.dragonBreath = { name: "Dragon's Rage Breath", cost: 2, tgt: 'area', shape: { t: 'cone', r: 30 }, traits: ['rage', 'fire'], group: 'class', desc: '30-foot cone: 1d6 fire per level, basic Reflex vs your class DC. Once per battle.',
    avail: u => !raging(u) ? 'Must be raging' : u.enc.used.dragonBreath ? 'Used this battle' : '',
    run: (u, p) => { u.enc.used.dragonBreath = true; B.areaAttack(u, { t: 'cone', r: 30 }, p, { name: "Dragon's Rage Breath", dmg: [{ n: u.level, d: 6, m: 0, type: 'fire' }], save: 'ref', dc: B.classDC(u), c: 'fire' }); } };
  A.stance = { name: 'Stance', cost: 1, tgt: 'none', traits: ['stance'], group: 'class', desc: '',
    run: (u, p) => {
      const st = p.stance; B.removeFx(u, f => f.key === 'stance'); ['tiger', 'mountain', 'crane', 'wolf', 'dragon'].forEach(k => B.removeGranted(u, k));
      const S = { tiger: ['Tiger Claw', 8, 'slashing', ['agile', 'finesse', 'unarmed']], mountain: ['Falling Stone', 8, 'bludgeoning', ['unarmed', 'forceful']], crane: ['Crane Wing', 6, 'bludgeoning', ['agile', 'finesse', 'unarmed']], wolf: ['Wolf Jaw', 8, 'piercing', ['agile', 'backstabber', 'finesse', 'unarmed']], dragon: ['Dragon Tail', 10, 'bludgeoning', ['backswing', 'unarmed']] }[st];
      B.grantStrike(u, { name: S[0], key: st, die: S[1], dt: S[2], traits: S[3] });
      const mods = st === 'crane' ? [{ sel: 'ac', t: 'circ', v: 1, s: 'crane stance' }] : st === 'mountain' ? [{ sel: 'ac', t: 'item', v: 4, s: 'mountain stance' }] : [];
      B.addFx(u, { name: U.cap(st) + ' Stance', key: 'stance', stance: st, mods, speed: st === 'mountain' ? -5 : 0 });
      B.log(B.nm(u) + ' enters ' + U.cap(st) + ' Stance.');
    } };
  A.flurry = { name: 'Flurry of Blows', cost: 1, tgt: 'unit', traits: ['flourish'], group: 'class', desc: 'Make two unarmed Strikes. If both hit the same creature with Stunning Blows, it must save or be stunned.',
    avail: u => needFlourish(u), valid: (u, t) => t.team === u.team ? 'Target a foe' : !u.strikes.some(s => s.traits.includes('unarmed') && B.prepStrike(u, s, t).ok) ? 'Out of reach' : '',
    run: (u, p) => { u.turn.flourish = true; const t = B.get(p.target); const s = B.bestStrike(u, t, x => x.traits.includes('unarmed')); const d1 = B.strike(u, s, t); let d2 = -1; if (B.alive(t) && B.conscious(t)) d2 = B.strike(u, s, t); else { const t2 = B.foesOf(u).find(f => B.conscious(f) && B.prepStrike(u, s, f).ok); if (t2) B.strike(u, s, t2); }
      if (u.flags.stunningBlows && d1 >= 2 && d2 >= 2 && B.alive(t) && !u.turn.stunUsed) { u.turn.stunUsed = true; const d = B.save(t, 'fort', B.classDC(u), { src: u, incap: true }); if (d <= 1) B.setC(t, 'stunned', d === 0 ? 3 : 1, null, u); } } };
  A.flyingKick = { name: 'Flying Kick', cost: 2, tgt: 'move+unit', moveMult: 1, group: 'class', desc: 'Stride, then make an unarmed Strike.',
    avail: u => B.immobile(u) ? 'Immobilized' : '',
    run: (u, p) => { if (p.dest && (p.dest[0] !== u.x || p.dest[1] !== u.y)) { const P = B.paths(u, B.speedOf(u)); const path = B.pathFrom(P, p.dest[0], p.dest[1]); if (!path || !B.canEnd(u, p.dest[0], p.dest[1])) return 'Can’t reach'; if (!B.moveAlong(u, path, {})) return; } const t = B.get(p.target); const s = B.bestStrike(u, t, x => x.traits.includes('unarmed')); if (s && B.prepStrike(u, s, t).ok) B.strike(u, s, t, { label: 'Flying Kick' }); } };
  A.tigerSlash = { name: 'Tiger Slash', cost: 2, tgt: 'unit', group: 'class', desc: 'Tiger claw Strike with two extra damage dice (three at 14th); pushes the target 5 feet on a hit.',
    avail: u => !(u.fx.some(f => f.key === 'stance' && f.stance === 'tiger')) ? 'Requires Tiger Stance' : '', valid: meleeValid,
    run: (u, p) => { const t = B.get(p.target); const s = u.strikes.find(x => x.grantKey === 'tiger'); const d = B.strike(u, s, t, { extraDice: u.level >= 14 ? 3 : 2, label: 'Tiger Slash' }); if (d >= 2 && B.alive(t)) B.push(t, u, 1, u); } };
  A.drainBonded = { name: 'Drain Bonded Item', cost: 0, tgt: 'none', traits: ['arcane'], group: 'class', desc: 'Free action, once per battle: regain your highest-rank expended spell.',
    avail: u => u.enc.used.drain ? 'Used this battle' : !(u.spells && u.spells.prepared.some(e => e.used)) ? 'No expended spells' : '',
    run: u => { const e = u.spells.prepared.filter(x => x.used).sort((a, b) => b.rank - a.rank)[0]; e.used = false; u.enc.used.drain = true; B.log(B.nm(u) + ' drains their bonded item to recover ' + D.spells[e.id].name + '.', 'good'); } };
  A.lingering = { name: 'Lingering Composition', cost: 1, tgt: 'none', traits: ['focus'], group: 'class', desc: 'Performance check against your level DC: your next composition this turn lasts 3 rounds (4 on a critical success). The Focus Point is only spent on a success.',
    avail: u => !u.flags.lingering ? 'Requires Maestro' : !u.focus || u.focus.cur < 1 ? 'No Focus Points' : u.turn.comp ? 'Already played a composition' : u.turn.linger ? 'Already lingering' : '',
    run: u => { const c = B.check(u, 'skill:performance', PF.levelDC(u.level)); B.log(B.nm(u) + ' attempts a Lingering Composition: ' + B.fmtCheck(c), 'deg' + c.deg); if (c.deg >= 2) { u.focus.cur--; u.turn.linger = c.deg === 3 ? 4 : 3; } } };
  A.fortissimo = { name: 'Fortissimo Composition', cost: 1, tgt: 'none', traits: ['focus'], group: 'class', desc: 'Performance check against a very hard DC: your next Courageous Anthem this turn grants +2 (+3 on a critical success).',
    avail: u => !u.flags.fortissimo ? 'Requires the feat' : !u.focus || u.focus.cur < 1 ? 'No Focus Points' : u.turn.comp ? 'Already played a composition' : '',
    run: u => { const c = B.check(u, 'skill:performance', PF.levelDC(u.level) + 5); B.log(B.nm(u) + ' attempts Fortissimo: ' + B.fmtCheck(c), 'deg' + c.deg); if (c.deg >= 2) { u.focus.cur--; u.turn.fortissimo = c.deg === 3 ? 3 : 2; } } };
  A.bonMot = { name: 'Bon Mot', cost: 1, tgt: 'unit', traits: ['auditory', 'concentrate', 'emotion', 'linguistic', 'mental'], group: 'skill', range: 30, desc: 'Diplomacy vs Will DC: −2 status penalty to the target’s Perception and Will (−3 on a critical success).',
    avail: u => u.flags.bonMot ? '' : 'Requires Bon Mot', valid: (u, t) => t.team === u.team ? 'Target a foe' : B.dist(u, t) > 30 ? 'Out of range' : B.immuneTo(t, 'mental') ? 'Mindless' : '',
    run: (u, p) => { const t = B.get(p.target); const c = B.check(u, 'skill:diplomacy', B.dcOf(t, 'will')); B.log(B.nm(u) + ' delivers a Bon Mot to ' + B.nm(t) + ': ' + B.fmtCheck(c), 'deg' + c.deg); if (c.deg >= 2) { const v = c.deg === 3 ? -3 : -2; B.addFx(t, { name: 'Bon Mot ' + v, key: 'bonmot', mods: [{ sel: 'per', t: 'status', v }, { sel: 'will', t: 'status', v }], exp: B.minute(u), bad: true }); } } };
  A.reachSpell = { name: 'Reach Spell', cost: 1, tgt: 'none', traits: ['concentrate', 'metamagic'], group: 'class', desc: 'Metamagic: your next spell this turn gains 30 feet of range.',
    avail: u => u.turn.meta ? 'Metamagic already active' : '', run: u => { u.turn.meta = 'reach'; B.log(B.nm(u) + ' extends the reach of their next spell.'); } };
  A.widenSpell = { name: 'Widen Spell', cost: 1, tgt: 'none', traits: ['manipulate', 'metamagic'], group: 'class', desc: 'Metamagic: your next burst, cone or line spell this turn covers a larger area.',
    avail: u => u.turn.meta ? 'Metamagic already active' : '', run: u => { u.turn.meta = 'widen'; B.log(B.nm(u) + ' widens their next spell.'); } };

  /* ---- monster actions ---- */
  B.areaAttack = (u, shape, p, o) => {
    const cells = B.areaCells(u, shape, p); const origin = B.areaOrigin(u, shape, p);
    const targets = B.unitsInCells(cells, origin).filter(t => t !== u);
    B.log(B.nm(u) + ' uses ' + o.name + '!', 'cast');
    B.emit({ t: 'area', u: u.id, cells, c: o.c || 'fire', shape: shape.t, origin: { x: u.x + u.sq / 2, y: u.y + u.sq / 2 } });
    const roll = B.rollParts(o.dmg); B.log(o.name + ' damage: ' + roll.text, 'dim');
    targets.forEach(t => { const d = B.save(t, o.save, o.dc, { basic: true, src: u, origin, area: true }); const f = [2, 1, 0.5, 0][d]; if (f > 0) B.dealDamage(t, B.scaleParts(roll.parts, f), { src: u, crit: d === 0, label: o.name }); });
    if (u.hiddenFrom && u.hiddenFrom.size) B.clearHidden(u, 'attacked');
  };
  A.breath = { name: 'Breath Weapon', cost: 2, tgt: 'area', group: 'monster', desc: 'Area breath; basic Reflex. Recharges after 1d4 rounds.',
    run: (u, p) => { const ab = D.abilities[p.abil]; const dc = ab.dc + (u.abilDC || 0); B.areaAttack(u, ab.area, p, { name: ab.name, dmg: [U.dice(ab.dmg, ab.type)], save: 'ref', dc, c: ab.type }); u.enc.rechargeAt[p.abil] = B.round + U.d(4); B.log(B.nm(u) + ' can breathe again in ' + (u.enc.rechargeAt[p.abil] - B.round) + ' round(s).', 'dim'); } };
  A.screech = { name: 'Bloodcurdling Screech', cost: 1, tgt: 'none', group: 'monster', desc: 'Creatures within 30 feet must save or become frightened.',
    run: (u, p) => { const ab = D.abilities[p.abil]; const dc = ab.dc + (u.abilDC || 0); B.log(B.nm(u) + ' lets out a bloodcurdling screech!', 'cast'); B.emit({ t: 'pulse', u: u.id, r: ab.r, c: 'mental' }); u.enc.rechargeAt[p.abil] = B.round + 3;
      B.foesOf(u).filter(t => B.dist(u, t) <= ab.r && !B.immuneTo(t, 'mental')).forEach(t => { const d = B.save(t, 'will', dc, { fear: true, mental: true, emotion: true, src: u }); if (d === 2) B.setC(t, 'frightened', 1, null, u); if (d === 1) B.setC(t, 'frightened', 2, null, u); if (d === 0) B.setC(t, 'frightened', 3, null, u); }); } };
  A.frenzy = { name: 'Draconic Frenzy', cost: 2, tgt: 'unit', group: 'monster', desc: 'Two claw Strikes and one jaws or tail Strike, in any order.',
    valid: meleeValid,
    run: (u, p) => { let t = B.get(p.target); const ab = D.abilities[p.abil] || {}; const seq = (ab.seq || ['Claw', 'Claw', 'Jaws']).map(n => u.strikes.find(s => s.name === n) || u.strikes.find(s => s.kind === 'melee'));
      seq.forEach(s => { if (!s) return; if (!B.alive(t) || !B.conscious(t)) t = B.foesOf(u).find(f => B.conscious(f) && B.prepStrike(u, s, f).ok); if (t && B.prepStrike(u, s, t).ok) B.strike(u, s, t); }); } };
  A.monsterSwipe = Object.assign({}, A.swipe, { name: 'Wide Swing', avail: () => '', group: 'monster', run: (u, p) => { const f = u.turn.flourish; A.swipe.run(u, p); u.turn.flourish = f; } });

  /* ---- Monster Core ability specs (u.mAbil, built by D.unitFromCreature from creature.abilities[].spec) ---- */
  B.mSpec = (u, key) => (u.mAbil || []).find(a => a.key === key) || null;
  const SIZE_ORD = s => (PF.SIZE[s] || PF.SIZE.medium).ord;
  B.grabbedBy = u => B.units.filter(t => B.alive(t) && t !== u && ((t.cond.grabbed && t.cond.grabbed.src === u.id) || (t.cond.restrained && t.cond.restrained.src === u.id)));
  // availability: recharge, frequency and simple requirements
  B.mReady = (u, sp) => {
    if (!sp) return 'Unknown ability';
    if (sp.recharge && u.enc.rechargeAt[sp.key] && B.round < u.enc.rechargeAt[sp.key]) return 'Recharging (round ' + u.enc.rechargeAt[sp.key] + ')';
    if (sp.freq === 'battle' && u.enc.used['m:' + sp.key]) return 'Already used this battle';
    if ((sp.freq === 'round' || sp.freq === 'turn') && u.turn.used && u.turn.used['m:' + sp.key]) return 'Once per turn';
    if (sp.req === 'grabbed' && !B.grabbedBy(u).length) return 'Needs a grabbed creature';
    if (sp.kind === 'multi' && sp.move && B.immobile(u)) return 'Immobilized';
    if (sp.kind === 'trample' && B.immobile(u)) return 'Immobilized';
    if (sp.kind === 'constrict' && !B.grabbedBy(u).length) return 'Nothing grabbed';
    if (sp.kind === 'swallow' && (!B.grabbedBy(u).some(t => SIZE_ORD(t.size) <= SIZE_ORD(sp.size || 'medium') && !t.fx.some(f => f.key === 'swallowed')) || B.units.some(t => t.fx && t.fx.some(f => f.key === 'swallowed' && f.by === u.id) && B.alive(t)))) return 'Nothing to swallow';
    if (sp.kind === 'rend' && !(u.turn.rend && u.turn.rend.n >= 2 && u.turn.rend.sname.includes((sp.strike || '').toLowerCase()))) return 'Needs two hits with ' + (sp.strike || 'the listed Strike');
    return '';
  };
  B.mUse = (u, sp) => {
    if (sp.recharge) { const r = U.dice(sp.recharge); const n = Math.max(1, B.rollParts([r]).total); u.enc.rechargeAt[sp.key] = B.round + n; u.enc.rechargeMsg = sp.name + ' recharges in ' + n + ' round' + (n > 1 ? 's' : '') + '.'; }
    if (sp.freq === 'battle') u.enc.used['m:' + sp.key] = true;
    if (sp.freq === 'round' || sp.freq === 'turn') { u.turn.used = u.turn.used || {}; u.turn.used['m:' + sp.key] = true; }
  };
  B.mCost = (u, p) => { const sp = B.mSpec(u, p && p.abil); return sp ? sp.cost : 1; };
  // resolve a save/damage effect against one target (shared by area abilities, targeted abilities, constrict…)
  B.mResolve = (u, t, sp, roll, o = {}) => {
    if (!B.alive(t)) return;
    const tr = sp.traits || [];
    if ((tr.includes('mental') || tr.includes('emotion')) && B.immuneTo(t, 'mental')) { B.log(B.nm(t) + ' is immune (mental).', 'dim'); return; }
    if (sp.living && !B.isLiving(t)) return;
    let deg = 1;
    if (sp.save) deg = B.save(t, sp.save, (sp.dc || 15) + (u.abilDC || 0), { basic: sp.basic, src: u, origin: o.origin, area: !!o.area, traits: tr, fear: tr.includes('fear'), mental: tr.includes('mental'), emotion: tr.includes('emotion'), incap: tr.includes('incapacitation'), magical: sp.magical });
    if (roll && roll.parts.length) {
      const sc = sp.dscale || (sp.basic || !sp.save ? [2, 1, 0.5, 0] : [2, 1, 0, 0]);
      const f = sp.save ? sc[deg] : 1;
      if (f > 0) B.dealDamage(t, B.scaleParts(roll.parts, f), { src: u, crit: deg === 0 && sp.save, label: sp.name, area: !!o.area, traits: tr, magical: sp.magical });
    }
    (sp.pdmg || []).forEach(p => { if (B.alive(t) && (!sp.save || deg <= 1)) B.addPersistent(t, deg === 0 ? Object.assign({}, p, { n: (p.n || 0) * 2, m: (p.m || 0) * 2 }) : Object.assign({}, p), u); });
    if (sp.outc && sp.outc[deg] && B.alive(t)) B.applyEffects(u, t, sp.outc[deg], { name: sp.name, dur: sp.dur || { k: 'r', n: 1 }, traits: tr });
    if (sp.aff && u.affSpecs && u.affSpecs[sp.aff] && deg <= 1) B.expose(u, t, u.affSpecs[sp.aff]);
    return deg;
  };
  B.mAreaTargets = (u, sp, p) => {
    const shape = sp.shape; const cells = B.areaCells(u, shape, p); const origin = B.areaOrigin(u, shape, p);
    let ts = B.unitsInCells(cells, origin).filter(t => t !== u);
    if (sp.foesOnly) ts = ts.filter(t => t.team !== u.team);
    return { cells, origin, ts };
  };
  A.mArea = { name: 'Area ability', cost: (u, p) => B.mCost(u, p), tgt: 'area', group: 'monster', desc: 'Area attack.',
    run: (u, p) => {
      const sp = B.mSpec(u, p.abil); if (!sp) return 'Unknown ability';
      const shape = sp.shape;
      if (shape.t === 'burst') { const rng = shape.range || 0; if (p.gx == null || B.distPt(u, Math.min(p.gx, B.W - 1), Math.min(p.gy, B.H - 1)) > rng + 5 || B.trace(u, B.cornerPt(p.gx, p.gy)).blocked) return 'Out of range'; }
      if ((shape.t === 'cone' || shape.t === 'line') && p.px == null) return 'Choose a direction';
      B.mUse(u, sp);
      const { cells, origin, ts } = B.mAreaTargets(u, sp, p);
      B.log(B.nm(u) + ' uses ' + sp.name + '!', 'cast');
      const col = (sp.dmg && sp.dmg[0] && sp.dmg[0].type) || (sp.traits || []).find(x => ['fire', 'cold', 'electricity', 'acid', 'sonic', 'void', 'vitality', 'mental', 'spirit', 'force', 'poison'].includes(x)) || 'arcane';
      B.emit({ t: 'area', u: u.id, cells, c: col, shape: shape.t, origin: { x: origin.pt ? origin.x : u.x + u.sq / 2, y: origin.pt ? origin.y : u.y + u.sq / 2 } });
      const roll = sp.dmg && sp.dmg.length ? B.rollParts(sp.dmg.map(x => Object.assign({}, x))) : null;
      if (roll) B.log(sp.name + ' damage: ' + roll.text, 'dim');
      ts.forEach(t => B.mResolve(u, t, sp, roll, { origin, area: true }));
      if (u.enc.rechargeMsg) { B.log(B.nm(u) + ': ' + u.enc.rechargeMsg, 'dim'); u.enc.rechargeMsg = null; }
      if (u.hiddenFrom && u.hiddenFrom.size) B.clearHidden(u, 'attacked');
    } };
  // targets of a non-area save ability
  B.mSaveTargets = (u, sp, p) => {
    if (sp.targets === 'grabbed') return B.grabbedBy(u);
    if (sp.targets === 'adjacent') return B.foesOf(u).filter(t => B.inReach(u, t, 5));
    if (sp.targets === 'all') return B.foesOf(u).filter(t => B.dist(u, t) <= (sp.range || 30) && !B.trace(u, t).blocked);
    const t = B.get(p.target); return t ? [t] : [];
  };
  B.mSaveValid = (u, sp, t) => {
    if (!t || t.team === u.team) return 'Target a foe';
    if (sp.targets === 'grabbed') return B.grabbedBy(u).includes(t) ? '' : 'Must be grabbed';
    const rng = sp.range || 5;
    if (rng <= 5 ? !B.inReach(u, t, Math.max(5, B.reachOf(u))) : B.dist(u, t) > rng) return 'Out of range';
    if (B.trace(u, t).blocked) return 'No line of effect';
    return '';
  };
  A.mSave = { name: 'Ability', cost: (u, p) => B.mCost(u, p), tgt: 'unit', group: 'monster', desc: 'A special ability that forces a saving throw.',
    run: (u, p) => {
      const sp = B.mSpec(u, p.abil); if (!sp) return 'Unknown ability';
      const ts = B.mSaveTargets(u, sp, p).slice(0, sp.n || 99);
      if (!ts.length) return 'No target';
      if ((sp.targets || 'one') === 'one') { const w = B.mSaveValid(u, sp, ts[0]); if (w) return w; }
      B.mUse(u, sp);
      B.log(B.nm(u) + ' uses ' + sp.name + '.', 'cast');
      const roll = sp.dmg && sp.dmg.length ? B.rollParts(sp.dmg.map(x => Object.assign({}, x))) : null;
      ts.forEach(t => { B.emit({ t: 'bolt', a: u.id, b: t.id, c: (sp.dmg && sp.dmg[0] && sp.dmg[0].type) || 'mental' }); B.mResolve(u, t, sp, roll, {}); });
    } };
  A.mConstrict = { name: 'Constrict', cost: 1, tgt: 'none', group: 'monster', desc: 'Damage every creature you have grabbed (basic Fortitude).',
    run: (u, p) => {
      const sp = B.mSpec(u, p.abil); if (!sp) return 'Unknown ability';
      const ts = B.grabbedBy(u); if (!ts.length) return 'Nothing grabbed';
      B.log(B.nm(u) + ' constricts!', 'cast');
      const roll = B.rollParts(sp.dmg.map(x => Object.assign({}, x)));
      ts.forEach(t => B.mResolve(u, t, Object.assign({ save: 'fort', basic: true }, sp, { outc: sp.greater ? { 0: [{ c: 'unconscious', dur: { k: 'eont' } }], 1: [{ c: 'unconscious', dur: { k: 'eont' } }] } : null }), roll, {}));
    } };
  A.mSwallow = { name: 'Swallow Whole', cost: 1, tgt: 'none', traits: ['attack'], group: 'monster', desc: 'Swallow a grabbed creature: it is restrained and takes damage each turn until it Escapes.',
    run: (u, p) => {
      const sp = B.mSpec(u, p.abil); if (!sp) return 'Unknown ability';
      const t = (p.target && B.get(p.target)) || B.grabbedBy(u).find(x => SIZE_ORD(x.size) <= SIZE_ORD(sp.size || 'medium'));
      if (!t || !B.grabbedBy(u).includes(t) || SIZE_ORD(t.size) > SIZE_ORD(sp.size || 'medium')) return 'Nothing to swallow';
      B.clrC(t, 'grabbed'); B.setC(t, 'restrained', 1, null, u);
      B.addFx(t, { name: 'Swallowed by ' + u.name, key: 'swallowed', by: u.id, dmg: sp.dmg.map(x => Object.assign({}, x)), bad: true });
      B.log(B.nm(u) + ' swallows ' + B.nm(t) + ' whole!', 'bad'); B.emit({ t: 'float', u: t.id, text: 'Swallowed!', c: 'crit' });
      B.dealDamage(t, B.rollParts(sp.dmg.map(x => Object.assign({}, x))).parts, { src: u, label: 'Swallow Whole', noReact: true });
    } };
  A.mRend = { name: 'Rend', cost: 1, tgt: 'none', group: 'monster', desc: 'After two hits with the listed Strike, deal its damage again.',
    run: (u, p) => {
      const sp = B.mSpec(u, p.abil); const t = u.turn.rend && B.get(u.turn.rend.tid); const s = u.strikes.find(x => x.name.toLowerCase().includes((sp.strike || '').toLowerCase()));
      if (!t || !B.alive(t) || !s) return 'No target';
      u.turn.rend = null; B.log(B.nm(u) + ' rends ' + B.nm(t) + '!', 'bad');
      const spec = B.dmgSpec(u, s, t, {}, {}); B.dealDamage(t, B.rollParts(spec.parts.filter(x => !x.persistent && !x.splash)).parts, { src: u, label: 'Rend', strike: s, traits: s.traits });
    } };
  A.mTrample = { name: 'Trample', cost: 3, tgt: 'move', group: 'monster', desc: 'Move through smaller creatures; each takes Strike damage (basic Reflex).',
    run: (u, p) => {
      const sp = B.mSpec(u, p.abil); if (!sp || !p.dest) return 'Choose a destination';
      const plan = B.tramplePlan(u, sp, p.dest[0], p.dest[1]); if (!plan) return 'Can’t trample there';
      B.mUse(u, sp); B.log(B.nm(u) + ' tramples!', 'cast');
      if (!B.moveAlong(u, plan.path, { actId: U.uid('tr') })) return;
      const s = u.strikes.find(x => x.name.toLowerCase().includes((sp.strike || '').toLowerCase())) || u.strikes.find(x => x.kind === 'melee');
      plan.hit.forEach(t => { if (!B.alive(t) || !s) return; const spec = B.dmgSpec(u, s, t, {}, {}); const roll = B.rollParts(spec.parts.filter(x => !x.persistent && !x.splash)); B.mResolve(u, t, { name: 'Trample', save: 'ref', basic: true, dc: sp.dc, traits: s.traits }, roll, {}); });
    } };
  B.tramplePlan = (u, sp, x, y) => {
    if (!B.canEnd(u, x, y)) return null;
    const P = B.paths(u, B.speedOf(u) * 2, { ignoreFoes: true }); const path = B.pathFrom(P, x, y); if (!path) return null;
    const lim = SIZE_ORD(sp.size || 'medium'); const hit = new Set();
    for (const [px, py] of path.slice(1)) for (const [cx, cy] of B.cellsOf(u, px, py)) { const o = B.unitAt(cx, cy, u); if (o && o.team !== u.team) { if (SIZE_ORD(o.size) > lim) return null; hit.add(o); } }
    return { path, hit: [...hit] };
  };
  // follow-ups to a successful Strike: Grab / Knockdown / Push (1 action; the Improved versions are free and automatic)
  const followOK = (u, kind) => { const f = u.turn.followUp; if (!f || !f.effs.some(e => e.split(':')[0] === kind)) return null; const t = B.get(f.tid); if (!t || !B.alive(t)) return null; return t; };
  A.mGrab = { name: 'Grab', cost: 1, tgt: 'none', traits: ['attack'], group: 'monster', desc: 'The creature you just hit is grabbed until the end of your next turn.',
    avail: u => { const t = followOK(u, 'mgrab'); return !t ? 'Your last action must be a hit with a Grab Strike' : (B.cv(t, 'grabbed') || B.cv(t, 'restrained')) ? 'Already held' : ''; },
    run: u => { const t = followOK(u, 'mgrab'); if (!t) return 'No target'; B.setC(t, 'grabbed', 1, B.endOfNext(u), u); B.log(B.nm(u) + ' grabs ' + B.nm(t) + '.', 'bad'); B.emit({ t: 'float', u: t.id, text: 'Grabbed', c: 'info' }); } };
  A.mKnock = { name: 'Knockdown', cost: 1, tgt: 'none', traits: ['attack'], group: 'monster', desc: 'The creature you just hit falls prone.',
    avail: u => { const t = followOK(u, 'mknock'); return !t ? 'Your last action must be a hit with a Knockdown Strike' : B.cv(t, 'prone') ? 'Already prone' : B.flies(t) ? 'Can’t knock down a flyer' : ''; },
    run: u => { const t = followOK(u, 'mknock'); if (!t) return 'No target'; B.knockProne(t); B.log(B.nm(u) + ' knocks ' + B.nm(t) + ' down.', 'bad'); } };
  A.mPush = { name: 'Push', cost: 1, tgt: 'none', traits: ['attack'], group: 'monster', desc: 'Push the creature you just hit away.',
    avail: u => followOK(u, 'mpush') ? '' : 'Your last action must be a hit with a Push Strike',
    run: u => { const t = followOK(u, 'mpush'); if (!t) return 'No target'; const e = u.turn.followUp.effs.find(x => x.startsWith('mpush')); const ft = +(e.split(':')[1] || 5); B.push(t, u, Math.max(1, Math.round(ft / 5)), u); } };
  // multi-Strike activities (Draconic Frenzy, Pounce, Storm of Jaws, Wide Swing…)
  // spec: {seq:[names...], move:0|1|2, moveFt, diff, hold, pen, mapCount, atk, dmg, onHit:[effects], swipe:n, reqGrab}
  B.mStrikeFor = (u, name, t) => {
    const ms = u.strikes.filter(s => s.kind === 'melee' || name === '*ranged');
    const nm = (name || '').toLowerCase();
    let c = nm && nm !== '*' ? u.strikes.filter(s => s.name.toLowerCase() === nm || s.name.toLowerCase().includes(nm) || nm.includes(s.name.toLowerCase())) : ms;
    if (!c.length) c = ms;
    if (t) { const ok = c.filter(s => B.prepStrike(u, s, t, { noMAP: true }).ok); if (ok.length) return B.bestStrike(u, t, s => ok.includes(s)) || ok[0]; return null; }
    return c[0] || null;
  };
  A.mStrikes = { name: 'Multi-Strike', cost: (u, p) => B.mCost(u, p), tgt: 'unit', group: 'monster', desc: 'Several Strikes in one activity.',
    run: (u, p) => {
      const sp = B.mSpec(u, p.abil); if (!sp) return 'Unknown ability';
      let t = B.get(p.target);
      if (sp.move && p.dest && (p.dest[0] !== u.x || p.dest[1] !== u.y)) {
        const P = B.paths(u, sp.moveFt || B.speedOf(u) * sp.move); const path = B.pathFrom(P, p.dest[0], p.dest[1]);
        if (!path || !B.canEnd(u, p.dest[0], p.dest[1])) return 'Can’t reach';
        B.mUse(u, sp);
        if (!B.moveAlong(u, path, { actId: U.uid('ms') })) return;
        if (!B.canAct(u)) return;
      } else B.mUse(u, sp);
      const n0 = u.turn.attacks; const atkMods = []; if (sp.pen) atkMods.push({ t: 'unt', v: sp.pen, s: sp.name }); if (sp.atk) atkMods.push({ t: 'circ', v: sp.atk, s: sp.name });
      const dmgMods = sp.dmg ? [{ t: 'circ', v: sp.dmg, s: sp.name }] : [];
      const used = new Set(); let made = 0;
      if (sp.swipe) {
        const s = B.mStrikeFor(u, sp.seq[0], t); if (!s || !t) return 'Out of reach';
        const others = B.foesOf(u).filter(f => f !== t && B.conscious(f) && B.prepStrike(u, s, f).ok && B.inReach(t, f, 5)).slice(0, sp.swipe - 1);
        const nat = U.d(20);
        [t].concat(others).forEach(x => { u.turn.attacks = n0; const R = B.prepStrike(u, s, x, { atkMods }); const deg = PF.degree(nat + R.atkTotal, R.acTotal, nat); B.strike(u, s, x, { forceDeg: deg, noMAPinc: true, label: sp.name, atkMods, dmgMods }); });
        u.turn.attacks = n0 + (sp.mapCount || 2); return;
      }
      for (const name of sp.seq) {
        if (!B.canAct(u)) break;
        let tgt = t && B.alive(t) && B.conscious(t) && !(sp.diff && used.has(t.id)) ? t : null;
        if (!tgt || !B.mStrikeFor(u, name, tgt)) {
          tgt = B.foesOf(u).filter(f => B.conscious(f) && !(sp.diff && used.has(f.id)) && B.mStrikeFor(u, name, f)).sort((a, b) => a.hp - b.hp)[0] || null;
          if (!tgt && !sp.diff && t && B.alive(t) && B.mStrikeFor(u, name, t)) tgt = t;
        }
        if (!tgt) continue;
        const s = B.mStrikeFor(u, name, tgt); if (!s) continue;
        if (sp.hold) u.turn.attacks = n0;
        const d = B.strike(u, s, tgt, { label: sp.name, atkMods, dmgMods, noMAPinc: !!sp.hold });
        used.add(tgt.id); made++;
        if (d >= 2 && sp.onHit && B.alive(tgt)) B.applyEffects(u, tgt, sp.onHit, { name: sp.name });
        if (sp.diff) t = null;
      }
      if (sp.hold) u.turn.attacks = n0 + (sp.mapCount || made);
      else if (sp.mapCount) u.turn.attacks = n0 + sp.mapCount;
    } };

  /* ================= CATALOGUE FOR UI / AI ================= */
  B.hp100 = u => u.hp / B.maxHP(u);
  B.costOf = (u, a, p) => typeof a.cost === 'function' ? a.cost(u, p) : (a.cost2 ? a.cost2(u) : a.cost);
  B.actionsFor = u => {
    const L = [];
    const push = (id, a, extra) => {
      const A0 = Object.assign({}, a, extra || {}); A0.id = id;
      let why = A0.avail ? A0.avail(u) : '';
      const c = B.costOf(u, A0, { abil: A0.abil });
      if (!why && typeof c === 'number' && !B.canSpend(u, c, A0.kind)) why = 'Not enough actions';
      if (!why && raging(u) && (A0.traits || []).includes('concentrate') && !(A0.traits || []).includes('rage') && id !== 'seek' && !(id === 'demoralize' && u.flags.ragingIntimidation)) why = 'Can’t concentrate while raging';
      if (!why && B.cv(u, 'restrained') && id !== 'escape') why = 'Restrained';
      A0.why = why; A0.costN = c; L.push(A0);
    };
    push('stride', A.stride);
    u.strikes.forEach(s => push('strike', A.strike, { name: s.name, strike: s.id, group: 'strike', desc: (s.kind === 'melee' ? 'Melee' : 'Ranged ' + s.range + ' ft') + ' · ' + s.dmg.map(d => U.dstr(d) + ' ' + d.type).join(' + ') + (s.traits.length ? ' · ' + s.traits.join(', ') : '') + (s.qty != null && s.thrown ? ' · ' + s.qty + ' left' : '') + (s.reload ? (s.loaded ? ' · loaded' : ' · needs reload') : ''), sref: s }));
    push('step', A.step);
    if (u.shield) push('raiseShield', A.raiseShield);
    push('takeCover', A.takeCover);
    if (u.kind === 'pc') { push('ready', A.ready); push('delay', A.delay); }
    if (B.cv(u, 'prone')) push('stand', A.stand);
    if (B.cv(u, 'grabbed') || B.cv(u, 'restrained')) push('escape', A.escape);
    if (u.strikes.some(s => s.reload)) push('reload', A.reload);
    if (u.kind === 'pc') {
      push('demoralize', A.demoralize); push('feint', A.feint); push('trip', A.trip); push('shove', A.shove); push('grapple', A.grapple);
      push('hide', A.hide); if (u.hiddenFrom && u.hiddenFrom.size) push('sneak', A.sneak); push('seek', A.seek);
      if (u.potions && u.potions.n > 0) push('potion', A.potion, { name: 'Drink ' + ((D.potions[u.potions.tier] || {}).name || 'Potion') });
      if (u.flags.battleMedicine) push('medicine', A.medicine);
      if (u.flags.bonMot) push('bonMot', A.bonMot);
      if (B.cv(u, 'sickened')) push('retch', A.retch);
    } else {
      if (B.cv(u, 'sickened')) push('retch', A.retch);
    }
    // class acts
    (u.acts || []).forEach(id => {
      if (id.startsWith('m:')) {
        const ab = D.abilities[id.slice(2)]; if (!ab) return;
        const base = A[ab.act === 'swipe' ? 'monsterSwipe' : ab.act]; if (!base) return;
        const rech = u.enc.rechargeAt[id.slice(2)];
        push(ab.act === 'swipe' ? 'monsterSwipe' : ab.act, base, { name: ab.name, abil: id.slice(2), shape: ab.area, avail: u2 => rech && B.round < rech ? 'Recharging' : (base.avail ? base.avail(u2) : '') });
        return;
      }
      if (id === 'stance') return;
      if (A[id]) push(id, A[id]);
    });
    // Monster Core ability specs
    (u.mAbil || []).forEach(sp => {
      const id = { area: 'mArea', save: 'mSave', multi: 'mStrikes', constrict: 'mConstrict', swallow: 'mSwallow', trample: 'mTrample', rend: 'mRend' }[sp.kind]; if (!id) return;
      const base = A[id];
      const tgt = id === 'mArea' ? (sp.shape.t === 'emanation' ? 'none' : 'area') : id === 'mSave' ? ((sp.targets || 'one') === 'one' ? 'unit' : 'none') : id === 'mStrikes' ? (sp.move ? 'move+unit' : 'unit') : base.tgt;
      push(id, base, { name: sp.name, abil: sp.key, shape: sp.shape, tgt, moveMult: sp.move || 1, desc: sp.text || base.desc, avail: u2 => B.mReady(u2, sp) || (base.avail ? base.avail(u2) : '') });
    });
    if (u.mFollow) ['mGrab', 'mKnock', 'mPush'].forEach(id => { if (u.mFollow.includes(id)) push(id, A[id]); });
    (u.feats || []).forEach(fid => { const f = D.feats[fid]; if (!f) return; if (f.act === 'stance') push('stance', A.stance, { name: f.name, stance: f.stance, desc: f.desc, avail: u2 => u2.fx.some(x => x.key === 'stance' && x.stance === f.stance) ? 'Already in this stance' : '' }); });
    if (u.flags.lingering) push('lingering', A.lingering);
    if (u.flags.fortissimo) push('fortissimo', A.fortissimo);
    // spells
    B.castables(u).forEach(c => {
      const sp = c.spell; const costs = B.spellCosts(sp);
      let why = '';
      if (c.src === 'comp' && u.turn.comp) why = 'One composition per turn';
      if (raging(u) && !sp.traits.includes('rage')) why = 'Can’t cast while raging';
      if (!why && !costs.some(n => B.canSpend(u, n, 'cast'))) why = 'Not enough actions';
      L.push({ id: 'cast', name: sp.name, cast: c, castKey: c.key, group: 'spell', costN: costs.length > 1 ? costs : costs[0], costs, tgt: B.spellShape(sp, costs[costs.length > 1 ? 1 : 0]) ? 'area' : sp.tgt, desc: sp.desc, why, rank: c.rank, src: c.src, left: c.left });
    });
    return L;
  };
  // execute an action from the catalogue
  B.doAction = (u, id, p = {}) => {
    if (B.over) return { ok: false, err: 'Battle over' };
    if (B.cur !== u) return { ok: false, err: 'Not your turn' };
    if (id === 'cast' || id === 'move') u.turn.followUp = null;
    if (id === 'cast') { const c = B.findCastable(u, p.castKey); if (!c) return { ok: false, err: 'Spell not available' }; const meta = u.turn.meta; const r = B.cast(u, c, Object.assign({}, p, { meta })); if (r.ok) u.turn.meta = null; return r; }
    if (id !== 'reachSpell' && id !== 'widenSpell') u.turn.meta = null;
    if (id === 'move') return B.doMove(u, p.dest);
    const a = A[id]; if (!a) return { ok: false, err: 'Unknown action' };
    let A0 = a;
    if (p.abil) { const ab = D.abilities[p.abil]; if (ab && ab.act === 'swipe') A0 = A.monsterSwipe; }
    const why = A0.avail ? A0.avail(u) : ''; if (why) return { ok: false, err: why };
    if (p.abil && id.charAt(0) === 'm' && B.mSpec(u, p.abil)) { const w = B.mReady(u, B.mSpec(u, p.abil)); if (w) return { ok: false, err: w }; }
    if (A0.valid && p.target) { const t = B.get(p.target); const w = t ? A0.valid(u, t) : 'No target'; if (w) return { ok: false, err: w }; }
    const cost = B.costOf(u, A0, p);
    if (!B.canSpend(u, cost, A0.kind)) return { ok: false, err: 'Not enough actions' };
    if (raging(u) && (A0.traits || []).includes('concentrate') && !(A0.traits || []).includes('rage') && id !== 'seek' && !(id === 'demoralize' && u.flags.ragingIntimidation)) return { ok: false, err: 'Can’t concentrate while raging' };
    B.spend(u, cost, A0.kind);
    u.turn.actsUsed.push(id);
    if (id !== 'strike' && id !== 'knockback') { /* keep lastStrikeHit only right after a strike */ }
    const prevHit = u.turn.lastStrikeHit;
    const prevFollow = u.turn.followUp; u.turn.followUp = null;
    if (id !== 'knockback') u.turn.lastStrikeHit = null;
    if (id === 'knockback') u.turn.lastStrikeHit = prevHit;
    const err = (id === 'mGrab' || id === 'mKnock' || id === 'mPush') ? (u.turn.followUp = prevFollow, A0.run(u, p)) : A0.run(u, p);
    if (id === 'mGrab' || id === 'mKnock' || id === 'mPush') { if (u.turn.followUp === prevFollow) u.turn.followUp = null; }
    if (err) { B.log(err, 'dim'); }
    B.touch(u);
    B.checkOver();
    return { ok: true };
  };
  // multi-Stride movement to a destination
  B.doMove = (u, dest) => {
    if (B.immobile(u)) return { ok: false, err: 'Immobilized' };
    const speed = B.speedOf(u); const acts = B.actsTotal(u);
    const P = B.paths(u, speed * acts);
    const path = B.pathFrom(P, dest[0], dest[1]);
    if (!path || !B.canEnd(u, dest[0], dest[1])) return { ok: false, err: 'Can’t reach that square' };
    const segs = B.splitStrides(u, path, speed);
    if (segs.length > acts) return { ok: false, err: 'Too far' };
    for (const seg of segs) {
      if (!B.canSpend(u, 1, 'stride')) break;
      B.spend(u, 1, 'stride'); u.turn.actsUsed.push('stride'); u.turn.lastStrikeHit = null;
      const ok = B.moveAlong(u, seg, { actId: U.uid('mv') });
      if (!ok || !B.canAct(u)) break;
    }
    B.touch(u); B.checkOver();
    return { ok: true };
  };
  B.stridesTo = (u, dest, P) => {
    P = P || B.paths(u, B.speedOf(u) * B.actsTotal(u));
    const path = B.pathFrom(P, dest[0], dest[1]); if (!path) return null;
    return { path, segs: B.splitStrides(u, path, B.speedOf(u)) };
  };
};

})(typeof window !== 'undefined' ? window : globalThis);
