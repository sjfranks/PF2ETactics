/* ai.js — utility-based tactical AI used for monsters and optional party autoplay */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D, U = PF.U;

PF.installAI = function (B) {
  const A = () => B.A;
  const foes = u => B.foesOf(u).filter(t => t.hp > 0 && B.alive(t) && !(B.cv(t, 'unconscious') && t.hp <= 0));
  const threatOf = t => 1 + t.level * 0.15 + (t.spells ? 0.25 : 0) + (t.hp / Math.max(1, B.maxHP(t)) < 0.35 ? 0.4 : 0);
  // run with the unit temporarily at another position
  const at = (u, x, y, fn) => { const ox = u.x, oy = u.y; u.x = x; u.y = y; try { return fn(); } finally { u.x = ox; u.y = oy; } };
  const killBonus = (t, ev, avg) => (t.hp + t.temp <= avg ? 1.35 : 1) * threatOf(t);

  // best single strike value from current position
  B.aiBestStrike = (u, o = {}) => {
    let best = null;
    foes(u).forEach(t => {
      if (B.isHiddenTo(t, u) && o.skipHidden) return;
      u.strikes.forEach(s => {
        if (o.kind && s.kind !== o.kind) return;
        const pv = B.strikePreview(u, s, t, o.prev || {}); if (!pv.ok) return;
        const v = pv.ev * killBonus(t, pv.ev, pv.avgHit);
        if (!best || v > best.v) best = { v, s, t, pv };
      });
    });
    return best;
  };
  // danger of walking a path: expected Reactive Strike damage
  B.aiPathDanger = (u, path) => {
    if (!path || path.length < 2) return 0;
    let d = 0; const used = new Set();
    const ox = u.x, oy = u.y;
    for (let i = 0; i < path.length - 1; i++) {
      u.x = path[i][0]; u.y = path[i][1];
      B.units.forEach(r => {
        if (used.has(r.id) || r.team === u.team || !B.alive(r) || !(r.flags.reactiveStrike) || !B.canReact(r, 'reactiveStrike')) return;
        if (B.inReach(r, u, B.reachOf(r))) { used.add(r.id); const s = r.strikes.find(x => x.kind === 'melee'); if (s) { const pv = B.strikePreview(r, s, u, { noMAP: true }); d += pv.ok ? pv.ev : 6; } }
      });
    }
    u.x = ox; u.y = oy;
    return d;
  };
  // value of standing at x,y for ranged/caster units
  const posValue = (u, x, y) => at(u, x, y, () => {
    let v = 0;
    const fs = foes(u);
    fs.forEach(f => {
      const c = B.coverVs(u, f); v += c >= 2 ? 1.5 : c === 1 ? 0.5 : 0;
      if (f.strikes.some(s => s.kind === 'melee') && B.inReach(f, u, B.reachOf(f))) v -= 4;
    });
    const tl = B.tile(x, y); if (tl && tl.hazard) v -= 30;
    return v;
  });

  // evaluate a spell castable: returns {v, p}
  const saveP = (t, kind, dc) => PF.pdeg(B.stat(t, kind), dc);
  const avgParts = parts => parts.reduce((a, p) => a + (p.n || 0) * ((p.d || 0) + 1) / 2 + (p.m || 0), 0);
  const effDmg = (t, parts) => { let a = 0; parts.forEach(p => { const avg = (p.n || 0) * ((p.d || 0) + 1) / 2 + (p.m || 0); if (B.immuneTo(t, p.type)) return; if (p.type === 'vitality' && !B.isUndead(t)) return; if (p.type === 'void' && !B.isLiving(t)) return; a += Math.max(0, avg - B.resistOf(t, p.type) + B.weakOf(t, p.type)); }); return a; };
  B.aiSpell = (u, c, actionsLeft) => {
    const sp = c.spell; const costs = B.spellCosts(sp); const r = c.rank; const ai = sp.ai || {};
    const allies = B.units.filter(t => t.team === u.team && B.alive(t));
    const slotCost = (c.src === 'prepared' || c.src === 'slot' || c.src === 'innate' || c.src === 'font' || c.src === 'focus') ? 1.5 + r * 0.6 : 0;
    let best = null; const consider = (v, p, acts) => { v -= slotCost; if (!best || v > best.v) best = { v, p: Object.assign({ castKey: c.key, actions: acts }, p), acts }; };
    if (c.src === 'comp' && u.turn.comp) return null;
    const dc = B.spellDC(u);
    const fs = foes(u);
    // heal / harm
    if (sp.tgt === 'heal') {
      const kind = sp.id;
      const healable = t => kind === 'heal' ? B.isLiving(t) : B.isUndead(t);
      costs.forEach(n => {
        if (n > actionsLeft) return;
        const amt = r * (u.flags.healingHands && kind === 'heal' ? 5.5 : 4.5) + (n === 2 ? 8 * r : 0);
        if (n === 3) {
          let v = 0; B.unitsWithin(u, 30).forEach(t => { if (t.team === u.team && healable(t)) v += Math.min(amt, B.maxHP(t) - t.hp) * (t.dying ? 3 : 1); else if (t.team !== u.team && !healable(t) && (kind === 'heal' ? B.isUndead(t) : B.isLiving(t))) v += amt * 0.6; });
          consider(v / 1.6, {}, 3);
        } else {
          allies.forEach(t => {
            if (!healable(t)) return; const miss = B.maxHP(t) - t.hp; if (miss < amt * 0.6 && !t.dying) return;
            if (n === 1 && !(t === u || B.inReach(u, t, 5))) return; if (n === 2 && (B.dist(u, t) > 30 || B.trace(u, t).blocked)) return;
            const v = Math.min(amt, miss) * (t.dying ? 3.2 : B.hp100(t) < 0.35 ? 1.6 : 1); consider(v / (n === 1 ? 1 : 1.5), { targets: [t.id] }, n);
          });
          fs.forEach(t => { if (healable(t) || !(kind === 'heal' ? B.isUndead(t) : B.isLiving(t))) return; if (n === 1 && !B.inReach(u, t, 5)) return; if (n === 2 && (B.dist(u, t) > 30 || B.trace(u, t).blocked)) return; const p = saveP(t, 'fort', dc); consider(amt * (p[0] * 2 + p[1] + p[2] * 0.5) / n * threatOf(t), { targets: [t.id] }, n); });
        }
      });
      return best;
    }
    if (sp.id === 'forceBarrage' || sp.id === 'forceBolt') {
      fs.forEach(t => { if (B.dist(u, t) > (sp.range || 30) || B.trace(u, t).blocked) return; const per = (1 + Math.floor((r - 1) / 2)) * 3.5; costs.forEach(n => { if (n > actionsLeft) return; const v = (sp.id === 'forceBolt' ? r * 3.5 : per * n) * threatOf(t) * (t.hp <= per * n ? 1.4 : 1); consider(v / n * 1.15 * (n === 1 ? 1 : 1), { targets: [t.id] }, n); }); });
      return best;
    }
    if (sp.tgt === 'self' || (!sp.area && !sp.atk && !sp.save && sp.cast)) {
      const n = costs[0]; if (n > actionsLeft) return null;
      const near = fs.filter(f => B.dist(u, f) <= 60).length; if (!near) return null;
      if (ai.kind === 'anthem') { if (u.fx.some(f => f.key === 'anthem') && u.fx.find(f => f.key === 'anthem').exp && u.fx.find(f => f.key === 'anthem').exp.n > 1) return null; const n2 = allies.filter(t => B.dist(u, t) <= 60 && B.conscious(t) && !t.fx.some(f => f.key === 'anthem' && f.exp && f.exp.n > 1)).length; consider(2.6 * n2 + 2, {}, n); }
      else if (ai.kind === 'rally') { if (u.fx.some(f => f.key === 'rally' || f.key === 'anthem')) return null; const n2 = allies.filter(t => B.dist(u, t) <= 60).length; consider(1.6 * n2, {}, n); }
      else if (ai.kind === 'dirge') { const n2 = fs.filter(t => B.dist(u, t) <= 30 && !B.cv(t, 'frightened') && !B.immuneTo(t, 'mental')).length; consider(3 * n2, {}, n); }
      else if (ai.kind === 'bless') { if (u.fx.some(f => f.key === 'bless')) return null; const n2 = allies.filter(t => B.dist(u, t) <= 15).length; consider(2.2 * n2, {}, n); }
      else if (ai.kind === 'shieldSpell') { if (u.enc.shieldSpellUsed || B.hasFx(u, 'shieldSpell')) return null; const threatened = fs.some(f => B.dist(u, f) <= 30); consider(threatened ? 2.5 : 0.5, {}, n); }
      else if (ai.kind === 'sureStrike') { return null; }
      else if (ai.kind === 'clawsBuff') { if (u.strikes.some(s => s.grantKey === 'Dragon Claw')) return null; consider(fs.some(f => B.dist(u, f) <= 10) ? 5 : 0, {}, n); }
      return best;
    }
    if (ai.kind === 'buffOne' || ai.kind === 'haste') {
      const n = costs[0]; if (n > actionsLeft) return null;
      allies.forEach(t => {
        if (!B.conscious(t) || B.validSpellTarget(u, c, t, n)) return;
        if (sp.id === 'haste' && B.hasFx(t, 'haste')) return; if (sp.id === 'heroism' && B.hasFx(t, 'heroism')) return; if (sp.id === 'blur' && B.hasFx(t, 'blur')) return;
        const martial = t.strikes.some(s => s.atk && s.atk.base + s.atk.item >= t.level + 6);
        consider((ai.val || (sp.id === 'haste' ? 14 : 8)) * (martial ? 1.2 : 0.8), { targets: [t.id] }, n);
      });
      return best;
    }
    if (ai.kind === 'healOne') {
      const n = costs[0]; if (n > actionsLeft) return null;
      allies.forEach(t => { if (B.validSpellTarget(u, c, t, n)) return; const miss = B.maxHP(t) - t.hp; const amt = ai.avg ? ai.avg(r) : 10; if (miss < amt * 0.5 && !t.dying) return; consider(Math.min(miss, amt) * (t.dying ? 3 : 1), { targets: [t.id] }, n); });
      return best;
    }
    if (sp.tgt === 'dying') { allies.forEach(t => { if (t.dying >= 2 && !B.validSpellTarget(u, c, t, 2)) consider(25, { targets: [t.id] }, costs[0]); }); return best; }
    if (sp.tgt === 'tile' || sp.tgt === 'move2' || ai.kind === 'none') return null;
    // offensive
    const n = costs.length > 1 ? costs[1] : costs[0]; if (n > actionsLeft) return null;
    const dmgParts = sp.dmg ? sp.dmg(r, {}) : null;
    const valueOn = (t, area) => {
      if (sp.livingOnly && !B.isLiving(t)) return 0; if (sp.undeadOnly && !B.isUndead(t)) return 0;
      if (sp.traits.includes('mental') && B.immuneTo(t, 'mental')) return 0;
      let v = 0;
      if (sp.atk) {
        const fake = { name: sp.name, kind: sp.melee ? 'melee' : 'ranged', traits: ['attack'], atk: { base: 0, item: 0 }, atkAttr: 'spell', range: sp.range, reach: 5, dmg: [{ n: 0, d: 0, m: 0, type: 'untyped' }] };
        const R = B.prepStrike(u, fake, t, { spellAtk: true }); if (!R.ok) return 0;
        const p = PF.pdeg(R.atkTotal, R.acTotal); const d = dmgParts ? effDmg(t, sp.dmg(r, { adjacent: B.inReach(u, t, 5) })) : 0;
        v = (p[2] + p[3] * 2) * d * (R.flat ? (21 - R.flat) / 20 : 1);
      } else if (sp.save) {
        const mods = []; const p = saveP(t, sp.save, dc);
        if (dmgParts && sp.basic) v += effDmg(t, dmgParts) * (p[0] * 2 + p[1] + p[2] * 0.5);
        if (ai.kind === 'debuff' || ai.kind === 'fear' || (!dmgParts && sp.onDeg)) {
          let val = ai.val || (sp.id === 'fear' ? 7 : 6);
          if (sp.id === 'fear' && B.cv(t, 'frightened') >= 2) val = 1;
          if (sp.id === 'slow' && B.cv(t, 'slowed')) val = 2;
          if (sp.incap && t.level > r * 2) { val *= 0.3; }
          const fail = p[0] + p[1] + (sp.id === 'fear' || sp.id === 'slow' ? p[2] * 0.45 : 0);
          v += val * fail * (0.6 + t.level / Math.max(1, u.level) * 0.4) * (B.hp100(t) > 0.4 ? 1 : 0.5);
        }
        if (dmgParts && !sp.basic && sp.onDeg) v += effDmg(t, dmgParts) * (p[0] + p[1]);
      }
      return v * threatOf(t) * (t.hp <= 8 ? 1.1 : 1);
    };
    if (sp.area) {
      const shape = sp.area;
      const tryCells = (p, origin) => {
        const cells = B.areaCells(u, shape, p); const hit = B.unitsInCells(cells, origin);
        let v = 0, enemies = 0;
        hit.forEach(t => { if (t === u && shape.t !== 'burst') return; if (t.team === u.team) v -= valueOn(t, true) * 1.4 + (sp.dmg ? 6 : 2); else if (t.hp > 0) { v += valueOn(t, true); enemies++; } });
        return enemies ? v : -1;
      };
      if (shape.t === 'burst') {
        const rng = shape.range || 30; const seen = new Set();
        fs.forEach(f => { for (let gx = f.x - 1; gx <= f.x + f.sq + 1; gx++) for (let gy = f.y - 1; gy <= f.y + f.sq + 1; gy++) {
          const k = gx + ',' + gy; if (seen.has(k)) continue; seen.add(k);
          if (B.distPt(u, Math.min(gx, B.W - 1), Math.min(gy, B.H - 1)) > rng + 5) continue; const o = B.cornerPt(gx, gy); if (B.trace(u, o).blocked) continue;
          const v = tryCells({ gx, gy }, o); if (v > 0) consider(v, { gx, gy }, n);
        } });
      } else {
        fs.forEach(f => { const c2 = B.center(f); const v = tryCells({ px: c2.x, py: c2.y }, u); if (v > 0) consider(v, { px: c2.x, py: c2.y }, n); });
      }
      return best;
    }
    // targeted
    const want = B.spellTargetsN(sp, r);
    const cands = fs.filter(t => !B.validSpellTarget(u, c, t, n)).map(t => ({ t, v: valueOn(t) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, want);
    if (cands.length) consider(cands.reduce((a, x) => a + x.v, 0), { targets: cands.map(x => x.t.id) }, n);
    return best;
  };

  // generate candidate plans for the next action
  B.aiOptions = u => {
    const out = []; const left = B.actsTotal(u); const acts = B.actionsFor(u); const can = id => acts.find(a => a.id === id && !a.why);
    const fs = foes(u); if (!fs.length) return out;
    const add = (v, id, p, cost, note) => out.push({ v, id, p: p || {}, cost: cost || 1, note });
    const nearest = fs.slice().sort((a, b) => B.dist(u, a) - B.dist(u, b))[0];
    const dNear = B.dist(u, nearest);
    // fleeing
    if (B.cv(u, 'fleeing') && can('stride')) {
      const P = B.paths(u, B.speedOf(u)); let best = null, bd = -1;
      P.best.forEach((c, k) => { const [x, y] = k.split(',').map(Number); if (!B.canEnd(u, x, y)) return; const d = at(u, x, y, () => Math.min(...fs.map(f => B.dist(u, f)))); if (d > bd) { bd = d; best = [x, y]; } });
      if (best) { add(100, 'move', { dest: best }, 1, 'flee'); return out; }
    }
    if (B.cv(u, 'prone') && can('stand')) add(fs.some(f => B.threatens(f, u)) || u.strikes.every(s => s.kind === 'melee') ? 20 : 12, 'stand', {}, 1);
    if ((B.cv(u, 'grabbed') || B.cv(u, 'restrained')) && can('escape')) add(B.cv(u, 'restrained') ? 18 : 6, 'escape', {}, 1);
    if (B.cv(u, 'sickened') >= 2 && can('retch')) add(4, 'retch', {}, 1);
    // strikes from here
    acts.filter(a => a.id === 'strike' && !a.why).forEach(a => {
      fs.forEach(t => { const pv = B.strikePreview(u, a.sref, t); if (!pv.ok) return; add(pv.ev * killBonus(t, pv.ev, pv.avgHit) + 0.3, 'strike', { strike: a.strike, target: t.id }, 1, a.name); });
    });
    // class strike variants
    const bs = B.aiBestStrike(u, { kind: 'melee' });
    const bsr = B.aiBestStrike(u, { kind: 'ranged' });
    if (can('flurry')) fs.forEach(t => { const s = B.bestStrike(u, t, x => x.traits.includes('unarmed')); if (!s) return; const p1 = B.strikePreview(u, s, t); if (!p1.ok) return; const n0 = u.turn.attacks; u.turn.attacks++; const p2 = B.strikePreview(u, s, t); u.turn.attacks = n0; add((p1.ev + (p2.ok ? p2.ev : 0)) * killBonus(t, p1.ev, p1.avgHit) + 1, 'flurry', { target: t.id }, 1); });
    if (can('huntedShot') && u.prey) { const t = B.get(u.prey); if (t && B.alive(t)) { const s = u.strikes.find(x => x.kind === 'ranged' && !x.reload); if (s) { const p1 = B.strikePreview(u, s, t); if (p1.ok) { const n0 = u.turn.attacks; u.turn.attacks++; const p2 = B.strikePreview(u, s, t); u.turn.attacks = n0; add(p1.ev + (p2.ok ? p2.ev : 0) + 1, 'huntedShot', { target: t.id }, 1); } } } }
    if (can('twinTakedown') && u.prey) { const t = B.get(u.prey); if (t && B.alive(t) && bs && bs.t === t) add(bs.pv.ev * 1.8, 'twinTakedown', { target: t.id }, 1); }
    if (bs && left >= 2) {
      if (can('viciousSwing') && u.turn.attacks === 0) { const pv = B.strikePreview(u, bs.s, bs.t, { extraDice: u.level >= 10 ? 2 : 1 }); add(pv.ev * 0.5 * killBonus(bs.t, pv.ev, pv.avgHit) + 0.2, 'viciousSwing', { target: bs.t.id }, 2); }
      if (can('knockdown')) add((bs.pv.ev + 4 * (bs.pv.p[2] + bs.pv.p[3]) * 0.5) * 0.55 * threatOf(bs.t), 'knockdown', { target: bs.t.id }, 2);
      if (can('intimidatingStrike') && !B.cv(bs.t, 'frightened') && !B.immuneTo(bs.t, 'mental')) add((bs.pv.ev + 5 * (bs.pv.p[2] + bs.pv.p[3])) * 0.5 * threatOf(bs.t), 'intimidatingStrike', { target: bs.t.id }, 2);
      if (can('swipe') || can('monsterSwipe')) { const others = fs.filter(f => f !== bs.t && B.prepStrike(u, bs.s, f).ok && B.inReach(bs.t, f, 5)); if (others.length) add((bs.pv.ev + B.strikePreview(u, bs.s, others[0]).ev) * 0.62, can('swipe') ? 'swipe' : 'monsterSwipe', { target: bs.t.id, abil: (acts.find(a => a.id === 'monsterSwipe') || {}).abil }, 2); }
      if (can('frenzy')) add(bs.pv.ev * 1.4 * threatOf(bs.t), 'frenzy', { target: bs.t.id }, 2);
      if (can('furiousFinish') && bs.t.hp < bs.pv.avgHit * 1.6) add(bs.pv.ev * 1.5 * killBonus(bs.t, bs.pv.ev, bs.pv.avgHit), 'furiousFinish', { target: bs.t.id }, 1);
    }
    if (bs && u.turn.attacks > 0) {
      if (can('exactingStrike')) { const pv = B.strikePreview(u, bs.s, bs.t); add(pv.ev * 1.1 * threatOf(bs.t) + 0.4, 'exactingStrike', { target: bs.t.id }, 1); }
      if (can('certainStrike')) { const pv = B.strikePreview(u, bs.s, bs.t, { certain: true }); add(pv.ev * threatOf(bs.t) + 0.4, 'certainStrike', { target: bs.t.id }, 1); }
    }
    if (bsr && can('huntersAim') && u.prey === bsr.t.id && left >= 2) { const pv = B.strikePreview(u, bsr.s, bsr.t, { atkMods: [{ t: 'circ', v: 2, s: 'aim' }], ignoreConceal: true }); add(pv.ev * 0.6 * threatOf(bsr.t), 'huntersAim', { target: bsr.t.id }, 2); }
    if (bsr && can('doubleShot') && left >= 2) add(bsr.pv.ev * 0.85, 'doubleShot', { target: bsr.t.id }, 2);
    // buffs / setup
    if (can('rage') && dNear <= 60) add(14, 'rage', {}, 1);
    if (can('stance') && !u.fx.some(f => f.key === 'stance')) { const st = acts.find(a => a.id === 'stance' && !a.why); add(9, 'stance', { stance: st.stance }, 1); }
    if (can('huntPrey') && (!u.prey || !B.get(u.prey) || !B.alive(B.get(u.prey)) || B.get(u.prey).hp <= 0)) { const t = fs.slice().sort((a, b) => (b.level * 10 - B.dist(u, b) / 5) - (a.level * 10 - B.dist(u, a) / 5))[0]; add(u.flags.edgePrecision || u.flags.edgeFlurry ? 9 : 6, 'huntPrey', { target: t.id }, 1); }
    if (can('giantsStature')) add(6, 'giantsStature', {}, 1);
    if (can('pointBlankStance') && bsr) add(4, 'pointBlankStance', {}, 1);
    if (can('reload') && !u.strikes.some(s => s.kind === 'ranged' && (!s.reload || s.loaded))) add(bsr ? 8 : 6, 'reload', {}, 1);
    if (can('demoralize')) fs.forEach(t => { if (B.dist(u, t) > 30 || B.cv(t, 'frightened') || t.enc.demoImmune[u.id] || B.immuneTo(t, 'mental')) return; const p = PF.pdeg(B.stat(u, 'skill:intimidation'), B.dcOf(t, 'will')); add((p[2] * 4 + p[3] * 7) * threatOf(t) * 0.85, 'demoralize', { target: t.id }, 1); });
    if (can('trip')) fs.forEach(t => { if (A().trip.valid(u, t) || B.cv(t, 'prone')) return; const p = PF.pdeg(B.stat(u, 'skill:athletics') + B.mapPen(u, null, t), B.dcOf(t, 'ref')); const allies = B.alliesOf(u).filter(a => B.threatens(a, t)).length; add((p[2] + p[3]) * (3 + allies * 3) * threatOf(t) - p[0] * 3, 'trip', { target: t.id }, 1); });
    if (can('shove')) fs.forEach(t => { if (A().shove.valid(u, t)) return; const c = B.center(u), d = B.center(t); const vx = Math.sign(Math.round(d.x - c.x)), vy = Math.sign(Math.round(d.y - c.y)); const nx = t.x + vx, ny = t.y + vy; const tl = B.tile(nx, ny); const bonus = tl && (tl.hazard === 'lava' || tl.h < B.elev(t) - 1) ? 14 : 0; if (!bonus) return; const p = PF.pdeg(B.stat(u, 'skill:athletics') + B.mapPen(u, null, t), B.dcOf(t, 'fort')); add((p[2] + p[3]) * bonus * threatOf(t), 'shove', { target: t.id }, 1); });
    if (can('potion') && B.hp100(u) < 0.4) add(10 + (1 - B.hp100(u)) * 10, 'potion', {}, 1);
    if (can('medicine')) B.units.filter(t => t.team === u.team && B.alive(t) && (t === u || B.inReach(u, t, 5)) && !A().medicine.valid(u, t)).forEach(t => { const miss = B.maxHP(t) - t.hp; if (miss > 9 || t.dying) add(Math.min(miss, 10 + u.level) * (t.dying ? 2.5 : 0.9), 'medicine', { target: t.id }, 1); });
    if (can('lingering') && left >= 2 && fs.length && !u.turn.comp) add(6, 'lingering', {}, 1);
    if (can('fortissimo') && left >= 2 && !u.turn.comp) add(4, 'fortissimo', {}, 1);
    if (can('drainBonded') && u.spells && u.spells.prepared.some(e => e.used && e.rank >= 2)) add(30, 'drainBonded', {}, 0);
    // breath / screech
    acts.filter(a => (a.id === 'breath' || a.id === 'dragonBreath') && !a.why).forEach(a => {
      if (left < 2) return;
      const ab = a.id === 'dragonBreath' ? null : D.abilities[a.abil];
      const shape = ab ? ab.area : { t: 'cone', r: 30 };
      const parts = ab ? [U.dice(ab.dmg, ab.type)] : [{ n: u.level, d: 6, m: 0, type: 'fire' }];
      const dc = ab ? ab.dc + (u.abilDC || 0) : B.classDC(u);
      fs.forEach(f => {
        const c = B.center(f); const cells = B.areaCells(u, shape, { px: c.x, py: c.y }); const hit = B.unitsInCells(cells, u);
        let v = 0, ne = 0;
        hit.forEach(t => { if (t === u) return; const p = saveP(t, 'ref', dc); const e = effDmg(t, parts) * (p[0] * 2 + p[1] + p[2] * 0.5); if (t.team === u.team) v -= e * 1.3; else if (t.hp > 0) { v += e * threatOf(t); ne++; } });
        if (ne) add(v / 2 * 1.1, a.id, { px: c.x, py: c.y, abil: a.abil }, 2);
      });
    });
    acts.filter(a => a.id === 'screech' && !a.why).forEach(a => { const n = fs.filter(f => B.dist(u, f) <= 30 && !B.cv(f, 'frightened')).length; if (n) add(n * 4, 'screech', { abil: a.abil }, 1); });
    // spells
    acts.filter(a => a.id === 'cast' && !a.why).forEach(a => { const r = B.aiSpell(u, a.cast, left); if (r && r.v > 0) add(r.v / Math.max(1, r.acts) * (r.acts > 1 ? 1.12 : 1), 'cast', r.p, r.acts, a.name); });
    // movement plans
    B.aiMovePlans(u, add, left, acts, bs, bsr);
    // defensive fallbacks
    if (can('raiseShield')) add(fs.some(f => B.dist(u, f) <= 30) ? 3.2 : 0.5, 'raiseShield', {}, 1);
    if (can('takeCover') && fs.some(f => f.strikes.some(s => s.kind === 'ranged') || f.spells) && fs.some(f => B.coverVs(u, f) >= 2)) add(2.2, 'takeCover', {}, 1);
    if (can('hide') && u.kind === 'pc' && (u.flags.sneakAttack || u.initSkill === 'stealth') && !(u.hiddenFrom && u.hiddenFrom.size)) add(2.5, 'hide', {}, 1);
    return out;
  };

  // movement-oriented plans
  B.aiMovePlans = (u, add, left, acts, bs, bsr) => {
    if (B.immobile(u) || !acts.some(a => a.id === 'stride' && !a.why)) return;
    const fs = foes(u); const speed = B.speedOf(u);
    const melee = u.strikes.filter(s => s.kind === 'melee' && !(s.wid === 'fist' && u.strikes.length > 1 && !u.flags.powerfulFist));
    const ranged = u.strikes.filter(s => s.kind === 'ranged' && (s.qty == null || s.qty > 0));
    const isCaster = !!(u.spells && B.castables(u).some(c => c.spell.rank >= 0 && (c.spell.dmg || c.spell.ai && c.spell.ai.kind === 'damage')));
    const prefersRange = (ranged.length && (!melee.length || Math.max(...ranged.map(s => s.atk.base + s.atk.item)) > Math.max(...melee.map(s => s.atk.base + s.atk.item)) + 1)) || (isCaster && u.st.ac.base + u.st.ac.item < 10 + u.level + 6 + 3);
    const P = B.paths(u, speed * Math.max(1, left));
    const tiles = [];
    P.best.forEach((c, k) => { const [x, y] = k.split(',').map(Number); if ((x !== u.x || y !== u.y) && B.canEnd(u, x, y)) tiles.push({ x, y, c }); });
    const stridesFor = t => Math.ceil(t.c / speed);
    let bestMove = null;
    const consider = (v, dest, why) => { if (!bestMove || v > bestMove.v) bestMove = { v, dest, why }; };
    const curStrike = prefersRange ? bsr : bs;
    const curV = curStrike ? curStrike.v : 0;
    if (!prefersRange && melee.length) {
      const sc = acts.find(a => (a.id === 'suddenCharge' || a.id === 'monsterCharge' || a.id === 'flyingKick') && !a.why);
      tiles.forEach(t => {
        const n = stridesFor(t); if (n >= left) return;
        const r = at(u, t.x, t.y, () => { let best = null; fs.forEach(f => melee.forEach(s => { const pv = B.strikePreview(u, s, f); if (!pv.ok) return; const v = pv.ev * killBonus(f, pv.ev, pv.avgHit); if (!best || v > best.v) best = { v, f }; })); return best; });
        if (!r) return;
        const path = B.pathFrom(P, t.x, t.y); const danger = B.aiPathDanger(u, path);
        const lava = B.tile(t.x, t.y).hazard ? 40 : 0;
        const v = r.v * (left - n >= 2 ? 1.6 : 1) - danger * 1.2 - lava - n * 0.4;
        if (v > curV * (left - n >= 2 ? 1.6 : 1) * 0.95 - 0.5 || !curStrike) consider(v / n, [t.x, t.y], 'close');
        if (sc && t.c <= speed * (sc.id === 'flyingKick' ? 1 : 2) && left >= 2 && (!curStrike)) add((r.v - danger * 1.2 - lava) * 0.95, sc.id, { dest: [t.x, t.y], target: r.f.id, abil: sc.abil }, 2, 'charge');
      });
    } else if (prefersRange) {
      const curPos = posValue(u, u.x, u.y);
      tiles.forEach(t => {
        const n = stridesFor(t); if (n > 1 || n >= left) return;
        const r = at(u, t.x, t.y, () => { let v = 0; ranged.forEach(s => fs.forEach(f => { const pv = B.strikePreview(u, s, f); if (pv.ok) v = Math.max(v, pv.ev * killBonus(f, pv.ev, pv.avgHit)); })); if (isCaster) fs.forEach(f => { if (B.dist(u, f) <= 30 && !B.trace(u, f).blocked) v = Math.max(v, 6 + u.level); }); return v; });
        const path = B.pathFrom(P, t.x, t.y); const danger = B.aiPathDanger(u, path);
        const pv = posValue(u, t.x, t.y);
        const v = r * 1.2 + pv * 1.5 - danger * 1.3 - (curV * 1.2 + curPos * 1.5);
        if (r > 0 && v > 1.5) consider(v, [t.x, t.y], 'reposition');
      });
    }
    // approach if nothing to do
    if (!curStrike && !bestMove) {
      const target = fs.slice().sort((a, b) => B.dist(u, a) - B.dist(u, b))[0];
      const P2 = B.paths(u, 400, { ignoreFoes: false });
      let goal = null, gd = Infinity;
      // find nearest reachable tile adjacent to target (or within 25 ft for ranged)
      P2.best.forEach((c, k) => { const [x, y] = k.split(',').map(Number); if (!B.canEnd(u, x, y)) return; const d = at(u, x, y, () => B.dist(u, target)); const want = prefersRange ? 30 : 5; if (d <= want && c < gd) { gd = c; goal = [x, y]; } });
      if (goal) {
        const path = B.pathFrom(P2, goal[0], goal[1]);
        // walk as far along as this turn allows (keeping 1 action if possible)
        let budget = speed * Math.max(1, left - (left > 1 ? 1 : 0));
        let dest = null; for (let i = path.length - 1; i > 0; i--) { const pc = P2.best.get(path[i][0] + ',' + path[i][1]); if (pc <= budget && B.canEnd(u, path[i][0], path[i][1])) { dest = path[i]; break; } }
        if (dest) consider(2.5, dest, 'approach');
      } else {
        // just move closer as the crow flies
        let bt = null, bd = B.dist(u, target);
        tiles.forEach(t => { if (stridesFor(t) > 1) return; const d = at(u, t.x, t.y, () => B.dist(u, target)); if (d < bd) { bd = d; bt = t; } });
        if (bt) consider(2, [bt.x, bt.y], 'approach');
      }
    }
    if (bestMove) add(bestMove.v, 'move', { dest: bestMove.dest }, 1, bestMove.why);
  };

  // play a full turn
  B.aiTurn = u => {
    let guard = 0;
    while (!B.over && B.cur === u && B.canAct(u) && B.actsTotal(u) > 0 && guard++ < 10) {
      const opts = B.aiOptions(u).filter(o => o.cost <= B.actsTotal(u) && o.v > 0.1);
      if (!opts.length) break;
      opts.sort((a, b) => b.v - a.v);
      let done = false;
      for (const o of opts.slice(0, 4)) {
        const before = B.actsTotal(u);
        const r = B.doAction(u, o.id, o.p);
        if (r.ok && B.actsTotal(u) < before) { done = true; break; }
        if (r.ok && o.cost === 0) { done = true; break; }
      }
      if (!done) break;
    }
  };
};

})(typeof window !== 'undefined' ? window : globalThis);
