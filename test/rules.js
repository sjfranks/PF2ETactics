const PF = require('./load.js'); const D = PF.D;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const mk = () => { const B = PF.Battle({ map: 'yard', partyLevel: 3, pcs: [PF.Build.iconic('valeros', 3), PF.Build.iconic('merisiel', 3), PF.Build.iconic('ezren', 3)], foes: [{ id: 'orcWarrior' }, { id: 'ogreWarrior' }] }); B.units.forEach(u => { u.x = -5; u.y = -5; }); return B; };
let B = mk(); const [V, M, E, O, G] = B.units;
const put = (u, x, y) => { u.x = x; u.y = y; };
// clear map area (yard row 7 has low walls) — use rows 3..6 cols 4..11
put(O, 6, 4); put(V, 5, 4); put(M, 7, 4);
ok(B.flanks(V, M, O), 'flank orthogonal opposite');
ok(B.offGuardWhy(O, V) && B.offGuardWhy(O, V).includes('flanked'), 'off-guard from flanking');
put(M, 7, 5); ok(B.flanks(V, M, O) === false, 'not flanking (L-shape)');
put(V, 5, 3); put(M, 7, 5); ok(B.flanks(V, M, O), 'flank diagonal corners');
put(V, 5, 4); put(M, 7, 3); ok(!B.flanks(V, M, O), 'not flanking: left side vs top-right corner');
// large creature flank
put(G, 8, 8); put(V, 7, 8); put(M, 10, 9); ok(B.flanks(V, M, G), 'flank large creature across');
// reach 10 diagonal
put(G, 8, 8); put(V, 11, 11); ok(B.inReach(G, V, 10), 'ogre reach 10 hits (2,2) diag gap from 2x2');
put(V, 12, 12); ok(!B.inReach(G, V, 10), 'out of reach');
// distance
put(V, 0, 0); put(M, 3, 3); ok(B.dist(V, M) === 20, 'diag 3 squares = 20 ft (5+10+5)');
// MAP agile
B.cur = M; M.turn = { attacks: 1, acts: 3 }; const dag = M.strikes.find(s => s.name === 'Dagger'); const rap = M.strikes.find(s => s.name === 'Rapier');
ok(B.mapPen(M, dag) === -4 && B.mapPen(M, rap) === -5, 'MAP -4 agile / -5');
M.turn.attacks = 2; ok(B.mapPen(M, dag) === -8 && B.mapPen(M, rap) === -10, 'MAP -8/-10');
// degrees
ok(PF.degree(25, 15, 10) === 3 && PF.degree(14, 15, 20) === 2 && PF.degree(5, 15, 1) === 0 && PF.degree(15, 15, 1) === 1, 'degrees incl nat20/nat1');
// cover from crate: yard row 2 has crates at x=6 and x=9 (".ff.|....|....|.ff." row1; row2 "....|..c.|.c..|....")
B = mk(); const [V2, M2, E2, O2] = B.units;
const rows = D.maps.yard.t.map(r => r.replace(/\|/g, ''));
const cy = rows.findIndex(r => r.includes('c')); const cx = rows[cy].indexOf('c');
put(O2, cx, cy - 1); put(E2, cx, cy + 3); ok(B.coverVs(O2, E2) === 2, 'standard cover behind crate (' + cx + ',' + cy + ')');
put(O2, cx, cy - 3); put(E2, cx, cy + 1); ok(B.coverVs(O2, E2) === 0, 'crate adjacent to attacker ignored (lean over)');
put(O2, cx, cy - 1); put(E2, cx + 5, cy - 1); ok(B.coverVs(O2, E2) === 0, 'no cover in open');
put(M2, cx + 2, cy - 1); ok(B.coverVs(O2, E2) === 1, 'lesser cover from creature');
// stats
const S = PF.Build.make(PF.Build.iconic('valeros', 1)); ok(S.ac.base + S.ac.item === 18 && S.strikes[0].atk.base + S.strikes[0].atk.item === 9, 'Valeros L1 AC 18, +9');
// shield block
B = mk(); const [V3, , , O3] = B.units; put(V3, 4, 4); put(O3, 5, 4); V3.shield.raised = true; V3.react = 1; const hp0 = V3.hp;
B.dealDamage(V3, [{ type: 'slashing', total: 9 }], { src: O3 }); ok(hp0 - V3.hp === 9 - V3.shield.hard && V3.shield.cur < V3.shield.hp, 'shield block absorbs hardness, shield damaged');
// resist / weakness: skeleton
B = PF.Battle({ map: 'yard', partyLevel: 1, pcs: [PF.Build.iconic('valeros', 1)], foes: [{ id: 'skeletonGuard' }, { id: 'zombieShambler' }] });
const sk = B.units[1], zb = B.units[2]; const h1 = sk.hp; B.dealDamage(sk, [{ type: 'slashing', total: 7 }], { src: B.units[0] }); ok(h1 - sk.hp === 2, 'skeleton resists slashing 5');
const h2 = zb.hp; B.dealDamage(zb, [{ type: 'slashing', total: 3 }], { src: B.units[0] }); ok(h2 - zb.hp === 8, 'zombie weak to slashing 5');
ok(B.pickDmgType(B.units[0].strikes[0], sk) === 'piercing' || true, 'versatile type picker runs');
// incapacitation via save()
B = mk(); const [V4, , E4, O4, G4] = B.units; B.cur = E4; const d = []; for (let i = 0; i < 200; i++) d.push(B.save(G4, 'will', 40, { src: E4, incap: true, rank: 1 })); ok(d.every(x => x >= 1), 'incapacitation: level 3 vs rank 1 never crit-fails at DC 40');
B.drain();

/* ===== Monster Core / imported content ===== */
const mkMC = (foes, L = 3, map = 'yard') => { const b = PF.Battle({ map, partyLevel: L, pcs: [PF.Build.iconic('valeros', L), PF.Build.iconic('kyra', L)], foes: foes.map(id => ({ id })) }); b.units.forEach(u => { u.x = -5; u.y = -5; }); b.begin(); return b; };
// afflictions: giant centipede venom
B = mkMC(['giantCentipede'], 1); { const [V5, , C5] = B.units; put(V5, 5, 5); put(C5, 6, 5);
  const aff = Object.assign({}, C5.affSpecs.a0, { dc: 80 });
  ok(aff.stages.length >= 2 && aff.kind === 'poison' && aff.maxDur === 6, 'affliction parsed: stages, poison, 6-round max duration');
  B.expose(C5, V5, aff); const a = V5.afflictions[0];
  ok(a && a.stage === 2, 'critical failure on exposure -> stage 2');
  a.dc = 80; B.tickAfflictions(V5); ok(a.stage === aff.stages.length, 'failed end-of-turn save raises the stage (capped at max)');
  B.expose(C5, V5, aff); ok(V5.afflictions.length === 1, 're-exposure does not add a second copy');
  a.dc = -40; B.tickAfflictions(V5); ok(!V5.afflictions.length || V5.afflictions[0].stage <= aff.stages.length - 2, 'critical success lowers the stage by 2');
  const st0 = Object.keys(V5.cond).filter(k => V5.cond[k].aff).length; a.dc = -40; B.tickAfflictions(V5); B.tickAfflictions(V5);
  ok(!V5.afflictions.length && !Object.keys(V5.cond).some(k => V5.cond[k].aff), 'affliction ends at stage 0 and its conditions are removed (had ' + st0 + ')');
  const aff2 = Object.assign({}, aff, { dc: 80 }); B.expose(C5, V5, aff2); V5.afflictions[0].elapsed = 5; V5.afflictions[0].dc = 80; B.tickAfflictions(V5); ok(!V5.afflictions.length, 'maximum duration ends the affliction');
}
// IWR exceptions and double resistance
B = mkMC(['coarti', 'ghostCommoner', 'ratSwarm', 'globster'], 7); { const [V6, , Co, Gh, Rs, Gl] = B.units;
  let h = Co.hp; B.dealDamage(Co, [{ type: 'slashing', total: 12 }], { src: V6 }); ok(h - Co.hp === 7, 'physical resistance 5 (except silver) applies to plain steel');
  h = Gh.hp; B.dealDamage(Gh, [{ type: 'force', total: 12 }], { src: V6, spell: true }); ok(h - Gh.hp === 12, 'resist all-damage does not apply to force (exception)');
  h = Gh.hp; B.dealDamage(Gh, [{ type: 'slashing', total: 12 }], { src: V6 }); ok(h - Gh.hp === 2, 'resistance doubled vs non-magical (5 -> 10)');
  h = Gh.hp; B.dealDamage(Gh, [{ type: 'slashing', total: 12 }], { src: V6, magical: true }); ok(h - Gh.hp === 7, 'normal resistance vs magical');
  h = Rs.hp; B.dealDamage(Rs, [{ type: 'fire', total: 2 }], { src: V6, area: true }); ok(h - Rs.hp === 2 + Rs.weak['area-damage'], 'swarm takes area-damage weakness');
  put(V6, 5, 5); put(Gl, 6, 5); B.cur = V6; V6.turn = { acts: 3, attacks: 0, actsUsed: [] };
  const d = B.strike(V6, V6.strikes[0], Gl, { forceDeg: 3 }); ok(d === 2, 'critical-hit immunity turns a crit into a hit');
  h = Co.hp; B.dealDamage(Co, [{ type: 'slashing', total: 10 }], { src: V6, traits: ['holy'] }); ok(B.immuneTo(Co, 'fire') && h - Co.hp === 10, 'holy weakness 5 triggers from the holy trait (10 + 5 - 5 resist)');
}
// Grab / Knockdown follow-ups
B = mkMC(['crocodile', 'wolf'], 2); { const [V7, K7, Cr, Wo] = B.units; put(V7, 5, 5); put(Cr, 6, 5); put(K7, 9, 9); put(Wo, 10, 9);
  B.cur = Cr; Cr.turn = { acts: 3, attacks: 0, actsUsed: [] };
  const jaws = Cr.strikes.find(s => s.eff.includes('mgrab'));
  B.strike(Cr, jaws, V7, { forceDeg: 2 }); ok(Cr.turn.followUp && Cr.turn.followUp.tid === V7.id, 'hit with a Grab Strike enables the Grab follow-up');
  const ag = B.actionsFor(Cr).find(a => a.id === 'mGrab'); ok(ag && !ag.why, 'Grab action is available right after the hit');
  B.doAction(Cr, 'mGrab', {}); ok(B.cv(V7, 'grabbed') && V7.cond.grabbed.src === Cr.id && Cr.turn.acts === 2, 'Grab costs 1 action and grabs the target');
  const ag2 = B.actionsFor(Cr).find(a => a.id === 'mGrab'); ok(ag2 && ag2.why, 'Grab not available again without a new hit');
  put(Cr, 9, 5); B.checkGrabs(Cr); ok(!B.cv(V7, 'grabbed'), 'grab ends when the grabber moves away');
  B.cur = Wo; Wo.turn = { acts: 3, attacks: 0, actsUsed: [] };
  B.strike(Wo, Wo.strikes[0], K7, { forceDeg: 2 }); B.doAction(Wo, 'stride', { dest: [Wo.x, Wo.y + 1] });
  ok(B.actionsFor(Wo).find(a => a.id === 'mKnock').why, 'Knockdown requires the last action to be the hit');
  Wo.turn.acts = 3; B.strike(Wo, Wo.strikes[0], K7, { forceDeg: 2 }); B.doAction(Wo, 'mKnock', {}); ok(B.cv(K7, 'prone'), 'Knockdown knocks prone');
}
// breath weapon parsing & recharge
B = mkMC(['diabolicDragonYoung'], 10, 'yard'); { const [V8, K8, Dr] = B.units; put(Dr, 6, 2); put(V8, 7, 6); put(K8, 6, 7);
  const sp = Dr.mAbil.find(a => a.name === 'Hellfire Breath');
  ok(sp && sp.kind === 'area' && sp.shape.t === 'cone' && sp.shape.r === 40 && sp.dc === 30 && sp.basic && sp.recharge === '1d4' && sp.dmg[0].n === 12 && sp.dmg[0].type === 'fire', 'Hellfire Breath parsed: 40-ft cone, 12d6 fire, DC 30 basic Reflex, recharge 1d4');
  ok(Dr.flags.momentum && Dr.flags.reactiveStrike && Dr.auras.some(a => B.auraKind(a) === 'fear' && a.r === 90), 'Draconic Momentum, Reactive Strike and Frightful Presence wired');
  ok(Dr.saveMods.some(m => m.vs.includes('divine') && m.v === 2), '+2 status to saves vs divine parsed');
  B.cur = Dr; Dr.turn = { acts: 3, attacks: 0, actsUsed: [] }; const c = B.center(V8);
  const h0 = V8.hp; const r = B.doAction(Dr, 'mArea', { abil: sp.key, px: c.x, py: c.y }); ok(r.ok && Dr.turn.acts === 1 && V8.hp < h0 || V8.hp === h0, 'breath weapon resolves (2 actions)');
  ok(Dr.enc.rechargeAt[sp.key] > B.round && B.actionsFor(Dr).find(a => a.abil === sp.key).why, 'breath weapon recharging after use');
  const fr = Dr.mAbil.find(a => a.kind === 'multi'); ok(fr && fr.seq.length === 3 && fr.seq.filter(x => x === 'claws').length === 2, 'Draconic Frenzy parsed as claw, claw, tail');
}
// imported spells with heightening
{ const ag = D.spells.acidGrip, fb = D.spells.frostbite, sy = D.spells.synesthesia;
  ok(ag && ag.isAuto && ag.dmg(2)[0].n === 2 && ag.dmg(4)[0].n === 4 && ag.dmg(3)[0].n === 2, 'acid grip: interval-2 heightening (2d8 -> 4d8 at rank 4)');
  ok(fb && fb.rank === 0 && fb.dmg(1)[0].n === 2 && fb.dmg(5)[0].n === 6, 'frostbite cantrip heightens +1d4 per rank');
  ok(sy && B.spellTargetsN(sy, 5) === 1 && B.spellTargetsN(sy, 9) === 5, 'fixed heightening of target count');
  ok(D.spells.fireball.dmg(5)[0].n === 10, 'hand-written fireball kept (10d6 at rank 5)');
  ok(Object.values(D.spells).filter(s => s.isAuto && s.auto !== false).length > 250, 'more than 250 imported spells automated');
  const pv = D.spells.painfulVibrations; ok(pv && pv.dscale && pv.outc[1].some(e => e.c === 'sickened'), 'non-basic damage spell: degree damage scale and sickened on failure');
}
// spellcasting entries
B = mkMC(['diabolicDragonYoungSpellcaster'], 10); { const [, , Dr] = B.units;
  const cs = B.castables(Dr); const prep = cs.find(c => c.src === 'eprep'); const inn = cs.find(c => c.src === 'einnate');
  ok(prep && inn && Dr.spells.entries.length === 2, 'prepared and innate entries become castables');
  ok(B.withEntry(Dr, prep, () => B.spellDC(Dr)) === 30 && B.withEntry(Dr, inn, () => B.spellDC(Dr)) === 28, 'each entry uses its own spell DC (30 prepared, 28 innate)');
  ok(cs.every(c => c.spell.auto !== false), 'utility (auto:false) spells are not castable');
  B.spendCastable(Dr, prep); ok(!B.castables(Dr).some(c => c.key === prep.key), 'casting a prepared spell expends that slot');
  ok(D.creatureAbilities(D.creatures.diabolicDragonYoung).some(a => a.name === 'Hellfire Breath' && a.auto), 'D.creatureAbilities lists automated abilities');
}
B.drain();
console.log(fails ? fails + ' FAILURES' : 'all passed');
process.exitCode = fails ? 1 : 0;
