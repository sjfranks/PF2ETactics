/* data_spells.js — curated PF2e Remaster spell list with heightening.
   Generic fields are resolved by Battle.castGeneric; complex spells define cast(). */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D = PF.D || {}, U = PF.U;
const SP = D.spells = {};
function def(id, o) {
  o.id = id;
  o.trad = (o.trad || '').split(' ').filter(Boolean);
  o.traits = (o.traits || '').split(' ').filter(Boolean);
  if (!o.traits.includes('concentrate') && !o.comp) o.traits.push('concentrate');
  if (!o.traits.includes('manipulate') && !o.noManip && !o.comp) o.traits.push('manipulate');
  if (o.rank === 0) o.traits.push('cantrip');
  SP[id] = o;
}
const dmgD = (n, d, type, m = 0) => [{ n, d, m, type }];
// riders
const frightenBy = (B, u, t, deg) => {
  if (deg === 2) B.setC(t, 'frightened', 1, null, u);
  else if (deg === 1) B.setC(t, 'frightened', 2, null, u);
  else if (deg === 0) { B.setC(t, 'frightened', 3, null, u); B.setC(t, 'fleeing', 1, B.rounds(u, 1), u); }
};

/* ===== CANTRIPS ===== */
def('electricArc', { name: 'Electric Arc', rank: 0, trad: 'arcane primal', cost: 2, traits: 'electricity', range: 30, tgt: 'enemy', n: 2, save: 'ref', basic: true,
  dmg: r => dmgD(r + 1, 4, 'electricity'), desc: 'Up to two creatures take 2d4 electricity damage (basic Reflex). Heightened +1d4 per rank.' });
def('ignition', { name: 'Ignition', rank: 0, trad: 'arcane primal', cost: 2, traits: 'fire attack', range: 30, tgt: 'enemy', atk: true,
  dmg: (r, c) => dmgD(r + 1, c && c.adjacent ? 6 : 4, 'fire'),
  onDeg: (B, u, t, deg) => { if (deg === 3) B.addPersistent(t, { n: 1, d: 4, m: 0, type: 'fire' }, u); },
  desc: 'Spell attack: 2d4 fire (2d6 if the target is adjacent). Critical hit adds 1d4 persistent fire. Heightened +1 die per rank.' });
def('telekineticProjectile', { name: 'Telekinetic Projectile', rank: 0, trad: 'arcane occult', cost: 2, traits: 'attack', range: 30, tgt: 'enemy', atk: true,
  dmg: r => dmgD(r + 1, 6, 'bludgeoning'), desc: 'Hurl a loose object: spell attack for 2d6 bludgeoning. Heightened +1d6 per rank.' });
def('causticBlast', { name: 'Caustic Blast', rank: 0, trad: 'arcane primal', cost: 2, traits: 'acid', area: { t: 'burst', r: 5, range: 30 }, save: 'ref', basic: true,
  dmg: r => dmgD(2 + Math.floor((r - 1) / 2), 8, 'acid'),
  onDeg: (B, u, t, deg, r) => { if (deg === 0) B.addPersistent(t, { n: 0, d: 0, m: 1 + Math.floor((r - 1) / 2), type: 'acid' }, u); },
  desc: '5-foot burst of acid: 2d8 acid (basic Reflex); critical failure adds persistent acid. Heightened (+2) +1d8.' });
def('voidWarp', { name: 'Void Warp', rank: 0, trad: 'arcane divine occult', cost: 2, traits: 'void', range: 30, tgt: 'enemy', save: 'fort', basic: true, livingOnly: true,
  dmg: r => dmgD(r + 1, 4, 'void'), onDeg: (B, u, t, deg) => { if (deg === 0) B.setC(t, 'enfeebled', 1, B.rounds(u, 1), u); },
  desc: 'Void energy: 2d4 void damage to a living creature (basic Fortitude); critical failure enfeebled 1. Heightened +1d4.' });
def('vitalityLash', { name: 'Vitality Lash', rank: 0, trad: 'divine primal', cost: 2, traits: 'vitality', range: 30, tgt: 'enemy', save: 'fort', basic: true, undeadOnly: true,
  dmg: r => dmgD(r + 1, 6, 'vitality'), onDeg: (B, u, t, deg) => { if (deg === 0) B.setC(t, 'enfeebled', 1, B.rounds(u, 1), u); },
  desc: 'Vital energy lashes an undead creature: 2d6 vitality (basic Fortitude). Heightened +1d6.' });
def('daze', { name: 'Daze', rank: 0, trad: 'arcane divine occult', cost: 2, traits: 'mental nonlethal', range: 60, tgt: 'enemy', save: 'will', basic: true,
  dmg: r => dmgD(1 + Math.floor((r - 1) / 2), 6, 'mental'), onDeg: (B, u, t, deg) => { if (deg === 0) B.setC(t, 'stunned', 1, null, u); },
  desc: '1d6 mental damage (basic Will); critical failure stuns 1. Heightened (+2) +1d6.' });
def('gougingClaw', { name: 'Gouging Claw', rank: 0, trad: 'arcane primal', cost: 2, traits: 'attack morph', range: 5, tgt: 'enemy', atk: true, melee: true,
  dmg: r => dmgD(r + 1, 6, 'slashing'), onDeg: (B, u, t, deg, r) => { if (deg === 3) B.addPersistent(t, { n: 0, d: 0, m: 1 + r, type: 'bleed' }, u); },
  desc: 'Melee spell attack: 2d6 slashing; critical hit adds persistent bleed. Heightened +1d6.' });
def('needleDarts', { name: 'Needle Darts', rank: 0, trad: 'arcane occult', cost: 2, traits: 'attack metal', range: 60, tgt: 'enemy', atk: true,
  dmg: r => dmgD(r + 2, 4, 'piercing'), onDeg: (B, u, t, deg) => { if (deg === 3) B.addPersistent(t, { n: 0, d: 0, m: 1, type: 'bleed' }, u); },
  desc: 'Spell attack: 3d4 piercing; critical hit adds 1 persistent bleed. Heightened +1d4.' });
def('shield', { name: 'Shield', rank: 0, trad: 'arcane divine occult', cost: 1, traits: 'force', tgt: 'self', noManip: true,
  cast: (B, u, r) => {
    if (u.enc.shieldSpellUsed) { B.log(B.nm(u) + "'s magical shield is spent for this battle.", 'dim'); return; }
    B.addFx(u, { name: 'Shield', key: 'shieldSpell', mods: [{ sel: 'ac', t: 'circ', v: 1 }], spellShield: 5 * Math.ceil(r / 2), exp: B.untilStart(u) });
    B.log(B.nm(u) + ' conjures a magical shield (+1 AC, can Shield Block).');
  }, ai: { kind: 'shieldSpell' }, desc: '+1 circumstance bonus to AC until your next turn; you can Shield Block with it (hardness 5, +5 per 2 ranks). Once it blocks, it is spent.' });
def('stabilize', { name: 'Stabilize', rank: 0, trad: 'divine primal', cost: 2, traits: 'healing vitality', range: 30, tgt: 'dying', noManip: false,
  cast: (B, u, r, p) => { const t = B.get(p.targets[0]); if (t && t.dying > 0) { t.dying = 0; B.log(B.nm(t) + ' is stabilized at 0 HP.', 'good'); B.emit({ t: 'float', u: t.id, text: 'Stable', c: 'good' }); } },
  ai: { kind: 'stabilize' }, desc: 'A dying creature within 30 feet loses the dying condition (it stays unconscious at 0 HP).' });

/* ===== COMPOSITIONS (bard focus cantrips & spells) ===== */
def('courageousAnthem', { name: 'Courageous Anthem', rank: 0, trad: 'occult', cost: 1, comp: true, traits: 'composition emotion mental auditory', tgt: 'self',
  cast: (B, u, r, p) => {
    const rounds = p.linger || 1, bonus = p.fortissimo || 1;
    const allies = B.unitsWithin(u, 60).filter(t => t.team === u.team && B.conscious(t));
    allies.forEach(t => {
      B.removeFx(t, f => f.key === 'anthem');
      B.addFx(t, { name: 'Courageous Anthem' + (bonus > 1 ? ' +' + bonus : ''), key: 'anthem', mods: [{ sel: 'atk', t: 'status', v: bonus }, { sel: 'dmg', t: 'status', v: bonus }, { sel: 'save-fear', t: 'status', v: bonus }], exp: B.rounds(u, rounds) });
    });
    B.log(B.nm(u) + ' plays Courageous Anthem: ' + allies.length + ' allies gain +' + bonus + ' status to attacks and damage' + (rounds > 1 ? ' for ' + rounds + ' rounds' : '') + '.');
    B.emit({ t: 'pulse', u: u.id, r: 60, c: 'ally' });
  }, ai: { kind: 'anthem' }, desc: 'Allies within 60 feet gain +1 status bonus to attack rolls, damage rolls, and saves against fear for 1 round.' });
def('dirgeOfDoom', { name: 'Dirge of Doom', rank: 0, trad: 'occult', cost: 1, comp: true, traits: 'composition emotion fear mental auditory', tgt: 'self',
  cast: (B, u, r, p) => {
    const rounds = p.linger || 1;
    const foes = B.unitsWithin(u, 30).filter(t => t.team !== u.team && B.alive(t) && !B.immuneTo(t, 'mental'));
    foes.forEach(t => { B.setC(t, 'frightened', 1, null, u); B.addFx(t, { name: 'Dirge of Doom', key: 'dirge', minFright: 1, exp: B.rounds(u, rounds) }); });
    B.log(B.nm(u) + ' sings a Dirge of Doom: ' + foes.length + ' foes are frightened 1.');
    B.emit({ t: 'pulse', u: u.id, r: 30, c: 'foe' });
  }, ai: { kind: 'dirge' }, desc: 'Foes within 30 feet are frightened 1 and can’t drop below frightened 1 for 1 round.' });

def('rallyingAnthem', { name: 'Rallying Anthem', rank: 0, trad: 'occult', cost: 1, comp: true, traits: 'composition emotion mental auditory', tgt: 'self',
  cast: (B, u, r, p) => {
    const rounds = p.linger || 1;
    const allies = B.unitsWithin(u, 60).filter(t => t.team === u.team && B.conscious(t));
    const res = Math.max(1, Math.floor(u.level / 2));
    allies.forEach(t => { B.removeFx(t, f => f.key === 'rally'); B.addFx(t, { name: 'Rallying Anthem', key: 'rally', mods: [{ sel: 'ac', t: 'status', v: 1 }, { sel: 'save', t: 'status', v: 1 }], resist: { physical: res }, exp: B.rounds(u, rounds) }); });
    B.log(B.nm(u) + ' plays Rallying Anthem: ' + allies.length + ' allies gain +1 status to AC and saves and resistance ' + res + ' to physical damage.');
    B.emit({ t: 'pulse', u: u.id, r: 60, c: 'ally' });
  }, ai: { kind: 'rally' }, desc: 'Allies within 60 feet gain +1 status bonus to AC and saves and physical resistance equal to half your level for 1 round.' });

/* ===== RANK 1 ===== */
def('forceBarrage', { name: 'Force Barrage', rank: 1, trad: 'arcane occult', cost: [1, 2, 3], traits: 'force', range: 120, tgt: 'enemy',
  cast: (B, u, r, p, actions) => {
    const t = B.get(p.targets[0]); if (!t) return;
    const n = actions * (1 + Math.floor((r - 1) / 2));
    const roll = B.rollParts([{ n, d: 4, m: n, type: 'force' }]);
    B.log(B.nm(u) + ' fires ' + n + ' force shard' + (n > 1 ? 's' : '') + ' at ' + B.nm(t) + ' (' + roll.text + ').');
    B.emit({ t: 'bolt', a: u.id, b: t.id, c: 'force', n });
    B.dealDamage(t, roll.parts, { src: u, spell: true });
  }, ai: { kind: 'damage', auto: true, avg: (r, a) => a * (1 + Math.floor((r - 1) / 2)) * 3.5 },
  desc: 'Unerring shards of force: 1d4+1 force per shard, one shard per action spent. Heightened (+2) one more shard per action.' });
def('breatheFire', { name: 'Breathe Fire', rank: 1, trad: 'arcane primal', cost: 2, traits: 'fire', area: { t: 'cone', r: 15 }, save: 'ref', basic: true,
  dmg: r => dmgD(2 * r, 6, 'fire'), desc: '15-foot cone of fire: 2d6 fire (basic Reflex). Heightened +2d6 per rank.' });
def('thunderstrike', { name: 'Thunderstrike', rank: 1, trad: 'arcane primal', cost: 2, traits: 'electricity sonic', range: 120, tgt: 'enemy', save: 'ref', basic: true,
  dmg: r => [{ n: r, d: 12, m: 0, type: 'electricity' }, { n: r, d: 4, m: 0, type: 'sonic' }], desc: 'Lightning strikes one creature: 1d12 electricity + 1d4 sonic (basic Reflex). Heightened +1d12+1d4.' });
def('heal', { name: 'Heal', rank: 1, trad: 'divine primal', cost: [1, 2, 3], traits: 'healing vitality', tgt: 'heal',
  cast: (B, u, r, p, actions) => B.castHealHarm(u, r, p, actions, 'heal'), ai: { kind: 'heal' },
  desc: '1 action: touch, heal 1d8 per rank. 2 actions: 30 feet, heal 1d8+8 per rank. 3 actions: 30-foot emanation heals all living creatures 1d8 per rank. Undead take vitality damage instead (basic Fortitude).' });
def('harm', { name: 'Harm', rank: 1, trad: 'divine', cost: [1, 2, 3], traits: 'void', tgt: 'heal',
  cast: (B, u, r, p, actions) => B.castHealHarm(u, r, p, actions, 'harm'), ai: { kind: 'harm' },
  desc: 'Void energy: 1 action touch or 2 actions at 30 feet deals 1d8 void per rank to a living creature (basic Fortitude); 3 actions affects a 30-foot emanation. Heals undead.' });
def('bless', { name: 'Bless', rank: 1, trad: 'divine occult', cost: 2, traits: 'aura mental', tgt: 'self',
  cast: (B, u, r) => {
    const allies = B.unitsWithin(u, 15).filter(t => t.team === u.team && B.alive(t));
    allies.forEach(t => B.addFx(t, { name: 'Bless', key: 'bless', mods: [{ sel: 'atk', t: 'status', v: 1 }], exp: B.minute(u) }));
    B.log(B.nm(u) + ' casts Bless: ' + allies.length + ' allies within 15 ft gain +1 status bonus to attack rolls.');
    B.emit({ t: 'pulse', u: u.id, r: 15, c: 'ally' });
  }, ai: { kind: 'bless' }, desc: 'You and allies within 15 feet gain a +1 status bonus to attack rolls for 1 minute.' });
def('fear', { name: 'Fear', rank: 1, trad: 'arcane divine occult primal', cost: 2, traits: 'emotion fear mental', range: 30, tgt: 'enemy', n: r => r >= 3 ? 5 : 1, save: 'will',
  onDeg: (B, u, t, deg) => frightenBy(B, u, t, deg), ai: { kind: 'fear' },
  desc: 'Will save: success frightened 1, failure frightened 2, critical failure frightened 3 and fleeing for 1 round. Heightened (3rd) up to five targets.' });
def('command', { name: 'Command', rank: 1, trad: 'arcane divine occult', cost: 2, traits: 'auditory linguistic mental', range: 30, tgt: 'enemy', save: 'will',
  onDeg: (B, u, t, deg) => {
    if (deg <= 1) { B.addFx(t, { name: 'Commanded: Drop Prone', key: 'command', loseActions: deg === 0 ? 3 : 1, prone: true, exp: B.endOfNext(t) }); B.log(B.nm(t) + (deg === 0 ? ' must spend its whole next turn prone.' : ' must spend its next action dropping prone.')); }
  }, ai: { kind: 'debuff', val: 9 }, desc: 'Will save or the creature drops prone on its next turn (failure: spends 1 action; critical failure: its whole turn).' });
def('sureStrike', { name: 'Sure Strike', rank: 1, trad: 'arcane occult', cost: 1, traits: 'fortune', tgt: 'self', noManip: true,
  cast: (B, u) => { B.addFx(u, { name: 'Sure Strike', key: 'sureStrike', fortuneStrike: true, exp: B.endOfTurn(u) }); B.log(B.nm(u) + "'s next Strike this turn is a fortune roll."); },
  ai: { kind: 'sureStrike' }, desc: 'Your next Strike this turn rolls twice and uses the higher result.' });
def('mysticArmor', { name: 'Mystic Armor', rank: 1, trad: 'arcane divine occult primal', cost: 2, traits: 'force', tgt: 'self',
  cast: (B, u, r) => { B.addFx(u, { name: 'Mystic Armor', key: 'mysticArmor', mods: [{ sel: 'ac', t: 'item', v: r >= 10 ? 3 : r >= 6 ? 2 : 1 }].concat(r >= 4 ? [{ sel: 'save', t: 'item', v: r >= 8 ? 2 : 1 }] : []), exp: null }); B.log(B.nm(u) + ' is wrapped in mystic armor.'); },
  ai: { kind: 'none' }, desc: '+1 item bonus to AC while unarmored (until your next daily preparations). Heightened: saves at 4th, +2 at 6th.' });
def('grease', { name: 'Grease', rank: 1, trad: 'arcane primal', cost: 2, area: { t: 'burst', r: 5, range: 30 }, save: 'ref',
  onDeg: (B, u, t, deg) => { if (deg <= 1) B.knockProne(t, 'grease'); },
  after: (B, u, r, p, sq) => B.addTerrainFx(sq, { kind: 'grease', dc: B.spellDC(u), exp: B.minute(u) }),
  ai: { kind: 'debuff', val: 6 }, desc: 'Coat four squares: creatures there must succeed at Reflex or fall prone; the area stays slick for 1 minute (Reflex or fall prone when entering).' });
def('sleep', { name: 'Sleep', rank: 1, trad: 'arcane occult', cost: 2, traits: 'incapacitation mental sleep', area: { t: 'burst', r: 5, range: 30 }, save: 'will', incap: true,
  onDeg: (B, u, t, deg) => {
    if (deg === 2) B.addFx(t, { name: 'Drowsy', mods: [{ sel: 'per', t: 'status', v: -1 }], exp: B.rounds(u, 1) });
    else if (deg <= 1) { B.setC(t, 'unconscious', 1, deg === 0 ? B.minute(u) : B.rounds(u, 1), u); t.sleepWake = true; B.knockProne(t, 'sleep'); B.log(B.nm(t) + ' falls asleep.'); }
  }, ai: { kind: 'debuff', val: 14 }, desc: '5-foot burst: Will save or fall unconscious (1 round, 1 minute on a critical failure); damage wakes them.' });
def('phantomPain', { name: 'Phantom Pain', rank: 1, trad: 'occult', cost: 2, traits: 'illusion mental nonlethal', range: 30, tgt: 'enemy', save: 'will', basic: true,
  dmg: r => dmgD(2 * r, 4, 'mental'),
  onDeg: (B, u, t, deg, r) => { if (deg <= 1) { B.addPersistent(t, { n: r, d: 4, m: 0, type: 'mental' }, u); B.setC(t, 'sickened', deg === 0 ? 2 : 1, B.minute(u), u); } },
  desc: '2d4 mental (basic Will); on a failure also 1d4 persistent mental and sickened 1 (2 on a critical failure). Heightened +2d4/+1d4.' });
def('dizzyingColors', { name: 'Dizzying Colors', rank: 1, trad: 'arcane occult', cost: 2, traits: 'illusion incapacitation visual', area: { t: 'cone', r: 15 }, save: 'will', incap: true,
  onDeg: (B, u, t, deg) => {
    if (deg === 2) B.setC(t, 'dazzled', 1, B.rounds(u, 1), u);
    if (deg === 1) { B.setC(t, 'stunned', 1, null, u); B.setC(t, 'dazzled', 1, B.minute(u), u); }
    if (deg === 0) { B.setC(t, 'stunned', 2, null, u); B.setC(t, 'blinded', 1, B.rounds(u, 1), u); B.setC(t, 'dazzled', 1, B.minute(u), u); }
  }, ai: { kind: 'debuff', val: 10 }, desc: '15-foot cone of colors: dazzled on a success; stunned 1 and dazzled on a failure; stunned 2 and blinded on a critical failure.' });
def('enfeeble', { name: 'Enfeeble', rank: 1, trad: 'arcane divine occult primal', cost: 2, range: 30, tgt: 'enemy', save: 'fort',
  onDeg: (B, u, t, deg) => {
    if (deg === 2) B.setC(t, 'enfeebled', 1, B.untilStart(u), u);
    if (deg === 1) B.setC(t, 'enfeebled', 2, B.minute(u), u);
    if (deg === 0) B.setC(t, 'enfeebled', 3, B.minute(u), u);
  }, ai: { kind: 'debuff', val: 6 }, desc: 'Fortitude save or enfeebled 1 / 2 / 3 depending on the result.' });
def('hydraulicPush', { name: 'Hydraulic Push', rank: 1, trad: 'arcane primal', cost: 2, traits: 'attack water', range: 60, tgt: 'enemy', atk: true,
  dmg: r => dmgD(3 + 2 * (r - 1), 6, 'bludgeoning'), onDeg: (B, u, t, deg) => { if (deg >= 2) B.push(t, u, deg === 3 ? 2 : 1, u); },
  desc: 'Spell attack: 3d6 bludgeoning and push the target 5 feet (10 on a critical hit). Heightened +2d6.' });
def('gustOfWind', { name: 'Gust of Wind', rank: 1, trad: 'arcane primal', cost: 2, traits: 'air', area: { t: 'line', r: 60 }, save: 'fort',
  onDeg: (B, u, t, deg) => {
    if (deg === 1) B.knockProne(t, 'gust');
    if (deg === 0) { B.push(t, u, 6, u); B.knockProne(t, 'gust'); B.dealDamage(t, B.rollParts(dmgD(2, 6, 'bludgeoning')).parts, { src: u, spell: true }); }
  }, ai: { kind: 'debuff', val: 5 }, desc: '60-foot line of wind: Fortitude or be knocked prone; critical failure pushes 30 feet, prone, 2d6 bludgeoning.' });
def('soothe', { name: 'Soothe', rank: 1, trad: 'occult', cost: 2, traits: 'emotion healing mental', range: 30, tgt: 'ally',
  cast: (B, u, r, p) => { const t = B.get(p.targets[0]); if (!t) return; const roll = B.rollParts([{ n: r, d: 10, m: 4 * r, type: 'heal' }]); B.heal(t, roll.total, u); B.addFx(t, { name: 'Soothed', mods: [{ sel: 'save-mental', t: 'status', v: 2 }], exp: B.minute(u) }); },
  ai: { kind: 'healOne', avg: r => r * 9.5 }, desc: 'An ally regains 1d10+4 HP per rank and gains +2 status to saves against mental effects.' });

/* ===== RANK 2 ===== */
def('noiseBlast', { name: 'Noise Blast', rank: 2, trad: 'arcane divine occult primal', cost: 2, traits: 'sonic', area: { t: 'burst', r: 10, range: 30 }, save: 'fort', basic: true,
  dmg: r => dmgD(2 + (r - 2), 10, 'sonic'),
  onDeg: (B, u, t, deg) => { if (deg === 1) B.setC(t, 'deafened', 1, B.rounds(u, 1), u); if (deg === 0) { B.setC(t, 'deafened', 1, B.minute(u), u); B.setC(t, 'stunned', 1, null, u); } },
  desc: '10-foot burst: 2d10 sonic (basic Fortitude); critical failure also stunned 1. Heightened +1d10.' });
def('laughingFit', { name: 'Laughing Fit', rank: 2, trad: 'arcane occult', cost: 2, traits: 'emotion mental', range: 30, tgt: 'enemy', save: 'will',
  onDeg: (B, u, t, deg) => {
    if (deg === 2) B.addFx(t, { name: 'Giggling', noReactions: true, exp: B.rounds(u, 1) });
    if (deg <= 1) { B.setC(t, 'slowed', 1, B.minute(u), u); B.addFx(t, { name: 'Laughing Fit', noReactions: true, exp: B.minute(u) }); }
    if (deg === 0) B.knockProne(t, 'laughter');
  }, ai: { kind: 'debuff', val: 14 }, desc: 'Will save or slowed 1 and unable to use reactions for 1 minute (prone too on a critical failure).' });
def('blur', { name: 'Blur', rank: 2, trad: 'arcane occult', cost: 2, traits: 'illusion visual', range: 5, tgt: 'ally',
  cast: (B, u, r, p) => { const t = B.get(p.targets[0]); if (t) { B.addFx(t, { name: 'Blur', key: 'blur', concealed: true, exp: B.minute(u) }); B.log(B.nm(t) + ' becomes blurry (concealed).'); } },
  ai: { kind: 'buffOne', val: 10 }, desc: 'An adjacent ally (or you) is concealed for 1 minute: attackers must succeed at a DC 5 flat check.' });

/* ===== RANK 3 ===== */
def('fireball', { name: 'Fireball', rank: 3, trad: 'arcane primal', cost: 2, traits: 'fire', area: { t: 'burst', r: 20, range: 500 }, save: 'ref', basic: true,
  dmg: r => dmgD(6 + 2 * (r - 3), 6, 'fire'), desc: 'A 20-foot burst of fire within 500 feet: 6d6 fire (basic Reflex). Heightened +2d6.' });
def('lightningBolt', { name: 'Lightning Bolt', rank: 3, trad: 'arcane primal', cost: 2, traits: 'electricity', area: { t: 'line', r: 120 }, save: 'ref', basic: true,
  dmg: r => dmgD(4 + (r - 3), 12, 'electricity'), desc: '120-foot line: 4d12 electricity (basic Reflex). Heightened +1d12.' });
def('slow', { name: 'Slow', rank: 3, trad: 'arcane occult primal', cost: 2, range: 30, tgt: 'enemy', n: r => r >= 6 ? 10 : 1, save: 'fort',
  onDeg: (B, u, t, deg) => { if (deg === 2) B.setC(t, 'slowed', 1, B.rounds(u, 1), u); if (deg === 1) B.setC(t, 'slowed', 1, B.minute(u), u); if (deg === 0) B.setC(t, 'slowed', 2, B.minute(u), u); },
  ai: { kind: 'debuff', val: 18 }, desc: 'Fortitude save or slowed 1 for 1 minute (1 round on a success, slowed 2 on a critical failure). Heightened (6th) 10 targets.' });
def('haste', { name: 'Haste', rank: 3, trad: 'arcane occult primal', cost: 2, range: 30, tgt: 'ally', n: r => r >= 7 ? 6 : 1,
  cast: (B, u, r, p) => p.targets.map(id => B.get(id)).filter(Boolean).forEach(t => { B.addFx(t, { name: 'Haste', key: 'haste', quick: ['strike', 'stride'], exp: B.minute(u) }); B.log(B.nm(t) + ' is hasted (quickened: Strike or Stride).', 'good'); }),
  ai: { kind: 'haste' }, desc: 'Target is quickened for 1 minute; the extra action can only Strike or Stride. Heightened (7th) six targets.' });
def('paralyze', { name: 'Paralyze', rank: 3, trad: 'arcane occult', cost: 2, traits: 'incapacitation mental', range: 30, tgt: 'enemy', save: 'will', incap: true,
  onDeg: (B, u, t, deg) => { if (deg === 2) B.setC(t, 'stunned', 1, null, u); if (deg === 1) B.setC(t, 'paralyzed', 1, B.rounds(u, 1), u); if (deg === 0) B.setC(t, 'paralyzed', 1, B.rounds(u, 4), u); },
  ai: { kind: 'debuff', val: 22 }, desc: 'Will save: stunned 1 on a success, paralyzed 1 round on a failure, 4 rounds on a critical failure.' });
def('heroism', { name: 'Heroism', rank: 3, trad: 'divine occult', cost: 2, traits: 'mental', range: 5, tgt: 'ally',
  cast: (B, u, r, p) => { const t = B.get(p.targets[0]); if (!t) return; const v = r >= 9 ? 3 : r >= 6 ? 2 : 1; B.addFx(t, { name: 'Heroism +' + v, key: 'heroism', mods: ['atk', 'per', 'save', 'skill'].map(sel => ({ sel, t: 'status', v })), exp: B.minute(u) }); B.log(B.nm(t) + ' is filled with heroism (+' + v + ').', 'good'); },
  ai: { kind: 'buffOne', val: 12 }, desc: '+1 status bonus to attacks, Perception, saves and skills (+2 at 6th, +3 at 9th).' });
def('vampiricFeast', { name: 'Vampiric Feast', rank: 3, trad: 'arcane divine occult', cost: 2, traits: 'void', range: 5, tgt: 'enemy', save: 'fort', basic: true, livingOnly: true,
  dmg: r => dmgD(6 + 2 * (r - 3), 6, 'void'), afterDamage: (B, u, t, dealt) => { if (dealt > 0) { u.temp = Math.max(u.temp, Math.floor(dealt / 2)); B.log(B.nm(u) + ' gains ' + Math.floor(dealt / 2) + ' temporary HP.'); } },
  desc: 'Touch: 6d6 void (basic Fortitude); you gain temporary HP equal to half the damage. Heightened +2d6.' });
def('blindness', { name: 'Blindness', rank: 3, trad: 'arcane divine occult primal', cost: 2, traits: 'incapacitation', range: 30, tgt: 'enemy', save: 'fort', incap: true,
  onDeg: (B, u, t, deg) => { if (deg === 2) B.setC(t, 'blinded', 1, B.untilStart(u), u); if (deg <= 1) B.setC(t, 'blinded', 1, deg === 0 ? null : B.minute(u), u); },
  ai: { kind: 'debuff', val: 16 }, desc: 'Fortitude save or blinded (until your next turn on a success, 1 minute on a failure, permanently on a critical failure).' });

/* ===== RANK 4+ ===== */
def('divineWrath', { name: 'Divine Wrath', rank: 4, trad: 'divine', cost: 2, traits: 'spirit', area: { t: 'burst', r: 20, range: 120 }, save: 'fort', basic: true,
  dmg: r => dmgD(4 + (r - 4), 10, 'spirit'), onDeg: (B, u, t, deg) => { if (deg === 1) B.setC(t, 'sickened', 1, B.minute(u), u); if (deg === 0) { B.setC(t, 'sickened', 2, B.minute(u), u); B.setC(t, 'slowed', 1, B.rounds(u, 1), u); } },
  desc: '20-foot burst of divine fury: 4d10 spirit (basic Fortitude); failure also sickened. Heightened +1d10.' });
def('dimensionDoor', { name: 'Dimension Door', rank: 4, trad: 'arcane occult', cost: 2, traits: 'teleportation', tgt: 'tile', range: 120,
  cast: (B, u, r, p) => B.teleport(u, p.x, p.y), ai: { kind: 'none' }, desc: 'Teleport yourself to a space you can see within 120 feet.' });
def('howlingBlizzard', { name: 'Howling Blizzard', rank: 5, trad: 'arcane primal', cost: 2, traits: 'cold', area: { t: 'cone', r: 60 }, save: 'ref', basic: true,
  dmg: r => dmgD(10 + 2 * (r - 5), 6, 'cold'), desc: '60-foot cone of freezing wind: 10d6 cold (basic Reflex). Heightened +2d6.' });
def('shadowBlast', { name: 'Shadow Blast', rank: 5, trad: 'arcane divine occult', cost: 2, traits: 'shadow', area: { t: 'cone', r: 30 }, save: 'ref', basic: true,
  dmg: r => dmgD(5 + (r - 5), 8, 'cold'), desc: '30-foot cone of shaped shadow: 5d8 damage (cold here) with a basic Reflex save. Heightened +1d8.' });
def('chainLightning', { name: 'Chain Lightning', rank: 6, trad: 'arcane primal', cost: 2, traits: 'electricity', range: 500, tgt: 'enemy',
  cast: (B, u, r, p) => {
    let t = B.get(p.targets[0]); if (!t) return;
    const roll = B.rollParts(dmgD(8 + (r - 6), 12, 'electricity')); const hit = new Set(); let prev = u;
    B.log(B.nm(u) + ' casts Chain Lightning (' + roll.text + ').');
    while (t) {
      hit.add(t.id); B.emit({ t: 'bolt', a: prev.id, b: t.id, c: 'electricity' });
      const deg = B.save(t, 'ref', B.spellDC(u), { basic: true, src: u, origin: prev });
      B.dealDamage(t, B.scaleParts(roll.parts, [2, 1, 0.5, 0][deg]), { src: u, spell: true, crit: deg === 0 });
      if (deg === 3) break;
      prev = t;
      t = B.units.filter(x => x.team !== u.team && B.alive(x) && !hit.has(x.id) && B.dist(prev, x) <= 30 && B.lineOfEffect(prev, x))
        .sort((a, b) => B.dist(prev, a) - B.dist(prev, b))[0];
    }
  }, ai: { kind: 'damage', avg: r => (8 + r - 6) * 6.5, chain: true }, desc: 'Lightning leaps from creature to creature within 30 feet: 8d12 electricity each (basic Reflex) until a target critically succeeds. Heightened +1d12.' });
def('disintegrate', { name: 'Disintegrate', rank: 6, trad: 'arcane', cost: 2, traits: 'attack', range: 120, tgt: 'enemy', atk: true, saveAfterHit: 'fort',
  dmg: r => dmgD(12 + 2 * (r - 6), 10, 'untyped'), desc: 'Spell attack, then a basic Fortitude save on a hit: 12d10 untyped damage. Heightened +2d10.' });
def('spiritBlast', { name: 'Spirit Blast', rank: 6, trad: 'divine occult', cost: 2, traits: 'spirit', range: 30, tgt: 'enemy', save: 'fort', basic: true,
  dmg: r => dmgD(16 + 2 * (r - 6), 6, 'spirit'), desc: 'Strike at a creature’s spirit: 16d6 spirit (basic Fortitude). Heightened +2d6.' });
def('sunburst', { name: 'Sunburst', rank: 7, trad: 'divine primal', cost: 2, traits: 'fire light vitality', area: { t: 'burst', r: 60, range: 500 }, save: 'ref', basic: true,
  dmg: r => dmgD(8 + (r - 7), 10, 'fire'), desc: '60-foot burst of searing light: 8d10 fire (basic Reflex). Heightened +1d10.' });
def('polarRay', { name: 'Polar Ray', rank: 8, trad: 'arcane primal', cost: 2, traits: 'attack cold', range: 120, tgt: 'enemy', atk: true,
  dmg: r => dmgD(10 + 2 * (r - 8), 8, 'cold'), onDeg: (B, u, t, deg) => { if (deg >= 2) B.setC(t, 'drained', deg === 3 ? 4 : 2, null, u); },
  desc: 'Spell attack: 10d8 cold and drained 2 (double and drained 4 on a crit). Heightened +2d8.' });

/* ===== FOCUS SPELLS ===== */
def('forceBolt', { name: 'Force Bolt', rank: 1, focus: true, trad: 'arcane', cost: 1, traits: 'force', range: 30, tgt: 'enemy',
  cast: (B, u, r, p) => { const t = B.get(p.targets[0]); if (!t) return; const roll = B.rollParts([{ n: r, d: 4, m: r, type: 'force' }]); B.log(B.nm(u) + ' hurls a force bolt at ' + B.nm(t) + ' (' + roll.text + ').'); B.emit({ t: 'bolt', a: u.id, b: t.id, c: 'force' }); B.dealDamage(t, roll.parts, { src: u, spell: true }); },
  ai: { kind: 'damage', auto: true, avg: r => r * 3.5 }, desc: '1 action: an unerring bolt deals 1d4+1 force per rank.' });
def('tempestSurge', { name: 'Tempest Surge', rank: 1, focus: true, trad: 'primal', cost: 2, traits: 'air electricity', range: 30, tgt: 'enemy', save: 'ref', basic: true,
  dmg: r => dmgD(r, 12, 'electricity'), onDeg: (B, u, t, deg, r) => { if (deg <= 1) { B.setC(t, 'clumsy', 2, B.rounds(u, 1), u); B.addPersistent(t, { n: 0, d: 0, m: r, type: 'electricity' }, u); } },
  desc: 'A miniature storm: 1d12 electricity per rank (basic Reflex); on a failure clumsy 2 for 1 round and persistent electricity.' });
def('elementalToss', { name: 'Elemental Toss', rank: 1, focus: true, trad: 'primal', cost: 1, traits: 'attack fire', range: 30, tgt: 'enemy', atk: true,
  dmg: r => dmgD(r, 8, 'fire'), desc: '1 action: spell attack hurling elemental fire for 1d8 per rank.' });
def('dragonClaws', { name: 'Dragon Claws', rank: 1, focus: true, trad: 'arcane', cost: 1, traits: 'morph', tgt: 'self', noManip: true,
  cast: (B, u, r) => { B.grantStrike(u, { name: 'Dragon Claw', kind: 'melee', atkFrom: 'unarmed', die: 4, dt: 'slashing', extra: [{ n: r >= 9 ? 3 : r >= 5 ? 2 : 1, d: 6, m: 0, type: 'fire' }], traits: ['agile', 'finesse', 'unarmed'] }); B.addFx(u, { name: 'Dragon Claws', key: 'dragonClaws', resist: { fire: 5 + (r >= 5 ? 5 : 0) + (r >= 9 ? 5 : 0) }, exp: B.minute(u) }); B.log(B.nm(u) + ' grows draconic claws.'); },
  ai: { kind: 'clawsBuff' }, desc: 'Claws (1d4 slashing + 1d6 fire, agile, finesse) and fire resistance 5 for 1 minute.' });
def('angelicHalo', { name: 'Angelic Halo', rank: 1, focus: true, trad: 'divine', cost: 1, tgt: 'self', noManip: true,
  cast: (B, u, r) => { B.addFx(u, { name: 'Angelic Halo', key: 'halo', halo: 2 * r, exp: B.minute(u) }); B.log(B.nm(u) + ' kindles an angelic halo: healing spells on nearby allies are stronger.'); },
  ai: { kind: 'none' }, desc: 'Heal spells that restore HP to allies within 15 feet of you add twice the halo’s rank.' });
def('fireRay', { name: 'Fire Ray', rank: 1, focus: true, trad: 'divine', cost: 2, traits: 'attack fire', range: 60, tgt: 'enemy', atk: true,
  dmg: r => dmgD(2 * r, 6, 'fire'), onDeg: (B, u, t, deg, r) => { if (deg === 3) B.addPersistent(t, { n: r, d: 4, m: 0, type: 'fire' }, u); },
  desc: 'Spell attack: 2d6 fire per rank; a critical hit adds 1d4 persistent fire per rank.' });
def('layOnHands', { name: 'Lay on Hands', rank: 1, focus: true, trad: 'divine', cost: 1, traits: 'healing vitality', range: 5, tgt: 'touch',
  cast: (B, u, r, p) => {
    const t = B.get(p.targets[0]); if (!t) return;
    if (B.isUndead(t)) {
      const roll = B.rollParts(dmgD(2 * r, 6, 'vitality')); const deg = B.save(t, 'fort', B.spellDC(u), { basic: true, src: u });
      B.dealDamage(t, B.scaleParts(roll.parts, [2, 1, 0.5, 0][deg]), { src: u, spell: true, crit: deg === 0 });
      if (deg <= 1) B.addFx(t, { name: 'Lay on Hands', mods: [{ sel: 'ac', t: 'status', v: -2 }], exp: B.rounds(u, 1) });
    } else {
      B.heal(t, 6 * r, u);
      if (t !== u) B.addFx(t, { name: 'Lay on Hands', mods: [{ sel: 'ac', t: 'status', v: 2 }], exp: B.untilStart(u) });
      if (u.flags.mercy && B.cv(t, 'frightened')) { B.clrC(t, 'frightened'); B.log('Mercy removes ' + B.nm(t) + "'s fear."); }
    }
  }, ai: { kind: 'healOne', avg: r => 6 * r, touch: true }, desc: '1 action, touch: an ally regains 6 HP per rank and gains +2 status bonus to AC until your next turn. Undead take 2d6 vitality per rank instead.' });
def('innerUpheaval', { name: 'Inner Upheaval', rank: 1, focus: true, trad: 'divine', cost: 1, traits: 'attack', tgt: 'enemy', range: 5, noManip: true,
  cast: (B, u, r, p) => { const t = B.get(p.targets[0]); const s = B.bestStrike(u, t, x => x.traits.includes('unarmed')); if (t && s) B.strike(u, s, t, { atkMods: [{ t: 'status', v: 1, s: 'inner upheaval' }], extraParts: [{ n: 1 + Math.floor((r - 1) / 4), d: 6, m: 0, type: 'force' }], label: 'Inner Upheaval' }); },
  ai: { kind: 'strikeSpell' }, desc: '1 action: an unarmed Strike with +1 status to hit that deals 1d6 extra force damage (+1d6 every 4 ranks).' });
def('qiRush', { name: 'Qi Rush', rank: 1, focus: true, trad: 'divine', cost: 1, traits: 'move', tgt: 'move2', noManip: true,
  cast: (B, u, r, p) => { B.moveTo(u, p.path, { noReact: false }); B.addFx(u, { name: 'Qi Rush', key: 'qiRush', concealed: true, exp: B.untilStart(u) }); },
  ai: { kind: 'none' }, desc: '1 action: move up to twice your Speed and become concealed until your next turn.' });

/* ===== GENERIC (IMPORTED) SPELLS =====
   D.autoSpell(spec) turns a JSON spec from data_spells_auto.js (tools/import_spells.py) into a spell record
   with dmg(r) (interval + fixed heightening, rank-scaled dice), pdmg(r) (persistent parts), n(r), areaAt(r),
   onDeg (outcome effects per degree via B.applyEffects), and cast() for heal / buff spells. */
const DUR = (B, u, t, d) => {
  if (!d) return null;
  if (typeof d === 'string') { const s = d.toLowerCase(); if (/^1 round|^until the start of your next turn/.test(s)) return B.untilStart(u); if (/end of your next turn|end of the target's next turn/.test(s)) return B.endOfNext(u); if (/(\d+) rounds?/.test(s)) return B.rounds(u, +s.match(/(\d+) rounds?/)[1]); return B.minute(u); }
  if (d.k === 'r') return B.rounds(u, d.n || 1);
  if (d.k === 'min') return B.minute(u);
  if (d.k === 'eont') return B.endOfNext(u);
  if (d.k === 'sont') return B.untilStart(u);
  if (d.k === 'eot') return B.endOfTurn(u);
  return null;
};
D.effDur = DUR;
const avgP = ps => ps.reduce((a, p) => a + (p.n || 0) * ((p.d || 0) + 1) / 2 + (p.m || 0), 0);
D.autoSpell = function (o) {
  const s = Object.assign({}, o);
  s.trad = (o.trad || []).slice(); s.traits = (o.traits || []).slice(); s.isAuto = true;
  if (s.rank === 0 && !s.traits.includes('cantrip')) s.traits.push('cantrip');
  if (s.focus && s.rank !== 0) s.rank = Math.max(1, o.flvl || 1);
  const base = Math.max(1, o.focus ? (o.flvl || 1) : (o.rank || 1));
  const every = (o.hi && o.hi.e) || 1;
  const steps = r => o.hi ? Math.max(0, Math.floor((r - base) / every)) : 0;
  const hfKeys = Object.keys(o.hf || {}).map(Number).sort((a, b) => a - b);
  const fixed = (r, f) => { let v = null; hfKeys.forEach(l => { if (l <= r && o.hf[l][f] != null) v = o.hf[l][f]; }); return v; };
  const partsAt = r => {
    let ps = fixed(r, 'dmg') || o.dmg || [];
    ps = ps.map(p => ({ n: p.nr ? Math.max(1, Math.floor(r * p.nr[0] / p.nr[1])) : (p.n || 0), d: p.d || 0, m: p.m || 0, type: p.type || 'untyped', cat: p.cat || null }));
    if (o.hi && o.hi.add) { const k = steps(r); Object.keys(o.hi.add).forEach(i => { const a = o.hi.add[i], p = ps[+i]; if (p && k) { p.n += (a.n || 0) * k; p.m += (a.m || 0) * k; if (!p.d) p.d = a.d; } }); }
    return ps;
  };
  if (o.dmg || fixed(10, 'dmg')) {
    s.dmg = (r) => partsAt(r).filter(p => p.cat !== 'persistent' && p.type !== 'healing').map(p => ({ n: p.n, d: p.d, m: p.m, type: p.type }));
    s.pdmg = (r) => partsAt(r).filter(p => p.cat === 'persistent').map(p => ({ n: p.n, d: p.d, m: p.m, type: p.type }));
    if (!s.dmg(Math.max(1, s.rank)).length) delete s.dmg;
  }
  if (o.n != null || hfKeys.some(l => o.hf[l].n != null)) s.n = r => fixed(r, 'n') || o.n || 1;
  if (o.area && ((o.hi && o.hi.ar) || hfKeys.some(l => o.hf[l].ar))) s.areaAt = r => Object.assign({}, o.area, { r: o.area.r + (o.hi && o.hi.ar ? o.hi.ar * steps(r) : 0) + (fixed(r, 'ar') || 0) });
  // per-degree effect value for the AI
  const W = { frightened: 3, sickened: 3, clumsy: 2.5, enfeebled: 2.5, stupefied: 2, drained: 2.5, stunned: 8, slowed: 10, doomed: 2, dazzled: 3, blinded: 10, deafened: 1, immobilized: 5, paralyzed: 22, fleeing: 9, offguard: 3, fascinated: 4, confused: 9, grabbed: 5, restrained: 10, fatigued: 2, unconscious: 22, petrified: 25, prone: 4, controlled: 25 };
  s.outcVal = [0, 1, 2, 3].map(k => ((o.outc && o.outc[k]) || []).reduce((a, e) => a + (e.c ? (W[e.c] || 2) * (['frightened', 'sickened', 'clumsy', 'enfeebled', 'stupefied', 'drained', 'stunned', 'slowed'].includes(e.c) ? (e.v || 1) : 1) * (e.dur && (e.dur.k === 'r' && (e.dur.n || 1) <= 1 || e.dur.k === 'sont') ? 0.6 : 1) : e.persist ? avgP([e.persist]) * 2 : e.lose ? 7 * e.lose : e.push ? 1 : 0), 0));
  if (o.save || o.atk) {
    s.onDeg = (B, u, t, deg, r) => {
      const effs = ((o.outc && o.outc[deg]) || []).filter(e => !e.dmg);
      if (effs.length) B.applyEffects(u, t, effs, { name: s.name, spell: s, r, traits: s.traits, dur: o.dur });
      if (!o.persistInOutc && s.pdmg) { const pp = s.pdmg(r); const on = o.atk ? deg >= 2 : deg <= 1; if (pp.length && on && B.alive(t)) pp.forEach(p => B.addPersistent(t, (deg === 0 && !o.atk) || (deg === 3 && o.atk) ? Object.assign({}, p, { n: p.n * 2, m: p.m * 2 }) : p, u)); }
    };
  }
  if (o.heal && o.hdmg) {
    const hp = r => { const ps = (fixed(r, 'dmg') || o.hdmg).map(p => ({ n: p.nr ? Math.max(1, Math.floor(r * p.nr[0] / p.nr[1])) : p.n, d: p.d, m: p.m || 0, type: 'heal' })); if (o.hi && o.hi.add) { const k = steps(r); Object.keys(o.hi.add).forEach(i => { const p = ps[+i]; if (p) { p.n += (o.hi.add[i].n || 0) * k; p.m += (o.hi.add[i].m || 0) * k; } }); } return ps; };
    s.tgt = 'ally'; s.cast = (B, u, r, p) => { const roll = B.rollParts(hp(r)); (p.targets || []).map(id => B.get(id)).filter(Boolean).forEach(t => { if (s.livingOnly && !B.isLiving(t)) return; B.emit({ t: 'bolt', a: u.id, b: t.id, c: 'heal' }); B.heal(t, roll.total, u, { spell: true, rank: r, label: s.name }); }); };
    s.ai = { kind: 'healOne', avg: r => avgP(hp(r)) };
  }
  if (o.buff) {
    const b = o.buff;
    s.cast = (B, u, r, p) => {
      const ts = s.tgt === 'self' ? [u] : (p.targets || []).map(id => B.get(id)).filter(Boolean);
      ts.forEach(t => { B.addFx(t, { name: s.name, key: 'sp:' + s.id, mods: (b.mods || []).map(m => Object.assign({}, m)), resist: b.resist || null, exp: DUR(B, u, t, o.dur || '1 minute') }); if (b.temp) t.temp = Math.max(t.temp, b.temp); B.log(B.nm(t) + ' gains ' + s.name + '.', 'good'); });
    };
    s.ai = Object.assign({}, o.ai, { kind: s.tgt === 'self' ? 'buffSelf' : 'buffOne' });
  }
  if (s.focus) s.trad = s.trad.length ? s.trad : ['occult'];
  SP[o.id] = s;
  return s;
};

// tradition lists
D.spellList = trad => Object.values(SP).filter(s => !s.focus && !s.comp && s.auto !== false && s.trad.includes(trad));
})(typeof window !== 'undefined' ? window : globalThis);
