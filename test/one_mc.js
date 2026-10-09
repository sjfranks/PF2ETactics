// quick check: node test/one_mc.js <creatureId> [count] [map] [-v]
const PF = require('./load.js'); const D = PF.D;
const [id, n = 1, map = 'yard'] = process.argv.slice(2).filter(a => a !== '-v');
const v = process.argv.includes('-v');
const c = D.creatures[id]; if (!c) { console.log('no creature', id); process.exit(1); }
const L = Math.max(1, c.lvl - 1);
const B = PF.Battle({ map, partyLevel: L, pcs: ['valeros', 'kyra', 'ezren', 'merisiel'].map(i => Object.assign(PF.Build.iconic(i, L), { ai: true })), foes: Array.from({ length: +n }, () => ({ id })) });
B.deploy(); B.begin(); let u, k = 0; const t0 = Date.now();
while ((u = B.next()) && k++ < 300) { const t1 = Date.now(); B.aiTurn(u); if (Date.now() - t1 > 1000) console.log('slow turn', u.name, Date.now() - t1); if (!B.over) B.endTurn(u); if (B.round > 15) break; }
const ev = B.drain(); if (v) ev.filter(e => e.t === 'log').forEach(e => console.log('  ', e.text));
console.log(B.over || 'timeout', B.round, Date.now() - t0, 'ms');
