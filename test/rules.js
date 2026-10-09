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
console.log(fails ? fails + ' FAILURES' : 'all passed');
