const PF = require('./load.js');
const [map, L, ...foes] = process.argv.slice(2);
const B = PF.Battle({ map, partyLevel: +L, pcs: ['valeros','kyra','ezren','merisiel'].map(id => Object.assign(PF.Build.iconic(id, +L), { ai: true })), foes: foes.map(id => ({ id })) });
B.deploy(); B.begin(); let u, n = 0; const t0 = Date.now();
while ((u = B.next()) && n++ < 300) { const t1 = Date.now(); B.aiTurn(u); if (Date.now() - t1 > 2000) console.log('slow turn', u.name, Date.now() - t1); if (!B.over) B.endTurn(u); if (B.round > 30) break; }
console.log(B.over, B.round, Date.now() - t0, 'ms');
