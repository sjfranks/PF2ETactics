const PF = require('./load.js'); const D = PF.D, U = PF.U;
const argv = process.argv.slice(2);
const verbose = argv.includes('-v');
function runBattle(cfg, label) {
  const B = PF.Battle(cfg);
  B.deploy(); B.begin();
  let u, turns = 0; const t0 = Date.now();
  while ((u = B.next()) && turns < 400) {
    turns++;
    B.aiTurn(u);
    if (!B.over) B.endTurn(u);
    if (B.round > 25) break;
  }
  const ev = B.drain();
  const logs = ev.filter(e => e.t === 'log');
  if (verbose) logs.forEach(l => console.log('   ', l.text));
  const pcs = B.units.filter(x => x.team === 'pc');
  return { label, result: B.over || 'timeout', rounds: B.round, ms: Date.now() - t0, pcs: pcs.map(p => p.name + ':' + (p.dead ? 'X' : p.hp + '/' + B.maxHP(p))).join(' '), nlog: logs.length };
}
const party = ['valeros', 'kyra', 'ezren', 'merisiel'];
const party2 = ['seelah', 'harsk', 'lem', 'amiri', 'sajan', 'seoni', 'lini'];
const results = [];
const only = argv.find(a => a.startsWith('--p='));
for (const pr of D.presets) {
  if (only && pr.id !== only.slice(4)) continue;
  for (const team of [party, party2.slice(0, 4), party2.slice(3)]) {
    const cfg = { map: pr.map, partyLevel: pr.pl, pcs: team.map(id => Object.assign(PF.Build.iconic(id, pr.pl), { ai: true })), foes: pr.foes.map(id => ({ id })) };
    try { results.push(runBattle(cfg, pr.id + ' [' + team.join(',') + ']')); }
    catch (e) { console.log('CRASH', pr.id, team.join(','), e.stack.split('\n').slice(0, 6).join('\n')); }
  }
}
results.forEach(r => console.log(r.result.padEnd(7), String(r.rounds).padStart(2) + 'r', String(r.ms).padStart(5) + 'ms', r.label, '|', r.pcs));
