const PF = require('./load.js'); const D = PF.D, U = PF.U;
const N = +(process.argv[2] || 40); let crashes = 0; const stats = { win: 0, loss: 0, timeout: 0 };
const seen = {};
for (let i = 0; i < N; i++) {
  const L = 1 + (i % 20); const size = 3 + (i % 4);
  const threat = ['low', 'moderate', 'severe', 'extreme'][i % 4];
  const themes = ['any', 'goblin', 'undead', 'beast', 'giant', 'bandit', 'kobold', 'orc'];
  const theme = themes[i % themes.length];
  const map = D.mapOrder[i % D.mapOrder.length];
  const pcs = []; for (let k = 0; k < size; k++) pcs.push(Object.assign(PF.Build.random(L), { ai: true }));
  const foes = D.autoEncounter(L, threat, size, theme);
  try {
    const B = PF.Battle({ map, partyLevel: L, pcs, foes });
    B.deploy(); B.begin(); let u, n = 0;
    while ((u = B.next()) && n++ < 600) { B.aiTurn(u); if (!B.over) B.endTurn(u); if (B.round > 20) break; }
    const ev = B.drain();
    ev.filter(e => e.t === 'log').forEach(e => { const k = e.text.replace(/[0-9]+/g, '#').slice(0, 50); seen[k] = (seen[k] || 0) + 1; });
    stats[B.over || 'timeout']++;
    if (!B.over) console.log('timeout', L, threat, theme, map, pcs.map(p => p.cls).join(','), foes.map(f => f.id).join(','));
  } catch (e) { crashes++; console.log('CRASH L' + L, map, threat, theme, pcs.map(p => p.cls).join(','), '\n', e.stack.split('\n').slice(0, 5).join('\n')); }
}
console.log(stats, 'crashes', crashes);
if (process.argv[3] === 'logs') Object.entries(seen).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(v, k));
