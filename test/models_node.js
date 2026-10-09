// Node smoke test for src/models.js: node test/models_node.js
// Creates every hero class x ancestry and every Monster Core entry, runs all clips, reports counts.
const path = require('path');
global.window = { THREE: require(path.join(__dirname, '../vendor/three.min.js')) };
global.performance = global.performance || { now: () => Date.now() };
require(path.join(__dirname, '../src/models.js'));
const M = window.PF.Models;
const classes = ['fighter', 'rogue', 'ranger', 'barbarian', 'champion', 'monk', 'bard', 'cleric', 'wizard', 'sorcerer', 'druid'];
const ancs = ['human', 'elf', 'dwarf', 'gnome', 'goblin', 'halfling', 'orc'];
const wpn = { fighter: ['longsword', 'sword'], rogue: ['rapier', 'sword'], ranger: ['longbow', 'bow', 'ranged'], barbarian: ['greataxe', 'axe'], champion: ['longsword', 'sword'], monk: ['fist', 'brawling'], bard: ['rapier', 'sword'], cleric: ['mace', 'club'], wizard: ['staff', 'club'], sorcerer: ['staff', 'club'], druid: ['sickle', 'knife'] };
const clips = ['melee', 'ranged', 'cast', 'breath', 'hit', 'dodge', 'block', 'die', 'cheer', 'idleFlourish', 'stand'];
let ok = 0, fail = 0, meshes = [], errs = [];
function exercise(fig) {
  fig.setMoving(true, 4); for (let i = 0; i < 10; i++) fig.update(1 / 30); fig.setMoving(false);
  clips.forEach(c => { fig.play(c, { color: '#ff0000' }); for (let i = 0; i < 50; i++) fig.update(1 / 30); });
  ['prone', 'down', 'dead', 'stand'].forEach(p => { fig.setPose(p); for (let i = 0; i < 20; i++) fig.update(1 / 30); });
  fig.setShield(true); fig.setFlying(true); for (let i = 0; i < 10; i++) fig.update(1 / 30);
  fig.group.updateMatrixWorld(true);
  let bad = false; fig.group.traverse(o => { if (o.isObject3D && !isFinite(o.matrixWorld.elements[12] + o.matrixWorld.elements[13])) bad = true; });
  if (bad) throw new Error('NaN transform');
}
classes.forEach(cls => ancs.forEach(anc => {
  const [wid, group, kind] = wpn[cls];
  const u = { kind: 'pc', name: cls + anc, cls, anc, size: ['gnome', 'goblin', 'halfling'].includes(anc) ? 'small' : 'medium', look: { body: '#7f93a8', trim: '#c8a24a', acc: 'none' }, strikes: [{ wid, group, kind: kind || 'melee', name: wid }], shield: cls === 'fighter' || cls === 'champion' ? { name: 'Steel Shield' } : null };
  try { const f = M.create(M.descForUnit(u)); exercise(f); ok++; meshes.push(f.meshCount); } catch (e) { fail++; errs.push(cls + '/' + anc + ': ' + e.stack.split('\n').slice(0, 3).join(' | ')); }
}));
console.log('heroes ok', ok, 'fail', fail, 'meshes min/max', Math.min(...meshes), Math.max(...meshes));
let list = []; try { list = require(path.join(__dirname, 'mc_list.json')); } catch (e) { }
const plans = {}; let mok = 0, mfail = 0; const mm = [];
list.forEach(c => {
  try {
    const d = M.descForCreature(c.name, c.traits, c.size, c.strikes, Object.assign({ land: c.speed }, c.other || {}));
    if (!M.plans.includes(d.plan)) throw new Error('bad plan ' + d.plan);
    plans[d.plan] = (plans[d.plan] || 0) + 1;
    const f = M.create(d); exercise(f); mok++; mm.push(f.meshCount);
  } catch (e) { mfail++; errs.push(c.name + ': ' + e.stack.split('\n').slice(0, 3).join(' | ')); }
});
console.log('monsters ok', mok, 'fail', mfail, 'meshes max', Math.max(0, ...mm));
console.log('plans', JSON.stringify(plans));
errs.slice(0, 25).forEach(e => console.log('ERR', e));
