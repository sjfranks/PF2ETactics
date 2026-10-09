// Runs an AI-vs-AI battle for EVERY Monster Core creature and reports crashes, automation stats and slow turns.
// usage: node test/mc_all.js [filter-substring] [-v]
const PF = require('./load.js'); const D = PF.D, U = PF.U;
const argv = process.argv.slice(2); const verbose = argv.includes('-v'); const filt = argv.find(a => !a.startsWith('-'));
const party = ['valeros', 'kyra', 'ezren', 'merisiel'];
const mcs = Object.values(D.creatures).filter(c => c.mc && (!filt || c.id.toLowerCase().includes(filt.toLowerCase())));
let crashes = 0, slow = 0; const res = { win: 0, loss: 0, timeout: 0 }; const slowList = []; const crashList = [];
let abTot = 0, abAuto = 0; const kinds = {};
const t00 = Date.now();
U.seed(12345);
mcs.forEach((c, idx) => {
  c.abilities.forEach(a => { abTot++; if (a.auto) { abAuto++; const k = a.spec ? a.spec.kind : '?'; kinds[k] = (kinds[k] || 0) + 1; } });
  const pl = U.clamp(c.lvl - 1, 1, 20);
  const xp = PF.creatureXP(c.lvl, pl) || 10;
  const n = U.clamp(Math.floor(80 / xp), 1, 4);
  const maps = c.aquatic ? ['river'] : D.mapOrder.filter(m => D.creatureFitsMap(c, m));
  const map = maps.length ? maps[idx % maps.length] : 'yard';
  let B;
  try {
    B = PF.Battle({ map, partyLevel: pl, pcs: party.map(id => Object.assign(PF.Build.iconic(id, pl), { ai: true })), foes: Array.from({ length: n }, () => ({ id: c.id })) });
    B.deploy(); B.begin();
    let u, k = 0;
    while ((u = B.next()) && k++ < 400) {
      const t1 = Date.now(); B.aiTurn(u); const dt = Date.now() - t1;
      if (dt > 1000) { slow++; slowList.push(c.id + ' ' + u.name + ' ' + dt + 'ms'); }
      if (!B.over) B.endTurn(u);
      if (B.round > 15) break;
    }
    res[B.over || 'timeout']++;
    const ev = B.drain();
    if (verbose) ev.filter(e => e.t === 'log').forEach(e => console.log('   ', e.text));
  } catch (e) {
    crashes++; crashList.push(c.id);
    console.log('CRASH', c.id, map, '\n', e.stack.split('\n').slice(0, 6).join('\n'));
  }
});
console.log('creatures', mcs.length, 'results', res, 'crashes', crashes, 'slow turns', slow, 'time', ((Date.now() - t00) / 1000).toFixed(1) + 's');
console.log('abilities', abTot, 'automated', abAuto, 'text-only', abTot - abAuto, kinds);
if (slowList.length) console.log('slow:', slowList.slice(0, 20).join('; '));
if (crashList.length) console.log('crashed:', crashList.join(' '));
process.exitCode = crashes ? 1 : 0;
