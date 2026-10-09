/* data_bestiary.js — creatures, GM Core building tables, generator, elite/weak, encounter presets */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D = PF.D || {}, U = PF.U;
D.creatures = {};
const ATTRS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
// strike tuple: [name, 'm'|'r', bonus, damage, type, traits, extra]
function C(id, o) {
  o.id = id; o.traits = (o.traits || '').split(' ').filter(Boolean);
  const av = (o.attrs || '0 0 0 0 0 0').split(' ').map(Number); o.attr = {}; ATTRS.forEach((k, i) => { o.attr[k] = av[i] || 0; });
  o.strikes = (o.strikes || []).map(s => {
    const [name, k, bonus, dmg, dt, traits, ex] = s; const e = ex || {};
    const parts = [U.dice(dmg, PF.DT[dt] || dt)];
    if (e.plus) e.plus.split(',').forEach(p => { const m = p.trim().match(/^(\S+)\s+(\w+)$/); if (m) parts.push(U.dice(m[1], m[2])); });
    const tr = (traits || '').split(' ').filter(Boolean);
    return { name, kind: k === 'r' ? 'ranged' : 'melee', bonus, dmg: parts, traits: tr, range: e.range || 0, reach: e.reach || (k === 'm' ? 5 : 0), w: !!e.w, eff: e.eff || [], reload: e.reload || 0, qty: e.qty || null, agile: tr.includes('agile') };
  });
  o.resist = o.resist || {}; o.weak = o.weak || {}; o.immune = (o.immune || '').split(' ').filter(Boolean);
  o.abil = o.abil || []; o.speed = typeof o.speed === 'object' ? o.speed : { land: o.speed || 25 };
  D.creatures[id] = o;
}
const UNDEAD_IMM = 'death disease mental paralyzed poison unconscious sleep';

C('goblinWarrior', { name: 'Goblin Warrior', lvl: -1, size: 'small', traits: 'goblin humanoid', per: 2, ac: 16, fort: 5, ref: 7, will: 3, hp: 6, speed: 25, attrs: '0 3 1 0 -1 1',
  skills: { acrobatics: 5, athletics: 2, stealth: 5 }, strikes: [['Dogslicer', 'm', 7, '1d6', 'S', 'agile backstabber finesse', { w: 1 }], ['Shortbow', 'r', 6, '1d6', 'P', 'deadly-d10', { range: 60, w: 1 }]],
  shape: 'small', color: '#6f8a3b', theme: ['goblin'], desc: 'Scrappy, cowardly, and dangerous in numbers.' });
C('kobold', { name: 'Kobold Warrior', lvl: -1, size: 'small', traits: 'kobold humanoid', per: 3, ac: 16, fort: 4, ref: 7, will: 3, hp: 8, speed: 25, attrs: '1 3 1 0 0 0',
  skills: { acrobatics: 5, stealth: 5, athletics: 3 }, strikes: [['Spear', 'm', 6, '1d6+1', 'P', '', { w: 1 }], ['Sling', 'r', 7, '1d6', 'B', 'propulsive', { range: 50, w: 1 }]],
  shape: 'small', color: '#a2552f', theme: ['kobold'], desc: 'Trap-loving draconic humanoids.' });
C('giantRat', { name: 'Giant Rat', lvl: -1, size: 'small', traits: 'animal', per: 5, ac: 15, fort: 6, ref: 7, will: 2, hp: 8, speed: { land: 30, climb: 10 }, attrs: '1 3 2 -4 1 -3',
  skills: { athletics: 3, stealth: 5 }, strikes: [['Jaws', 'm', 7, '1d6', 'P', 'finesse']], shape: 'rat', color: '#7a6a5a', theme: ['beast', 'sewer'], desc: 'A dog-sized rodent.' });
C('skeletonGuard', { name: 'Skeleton Guard', lvl: -1, size: 'medium', traits: 'mindless skeleton undead', per: 2, ac: 16, fort: 2, ref: 8, will: 2, hp: 4, speed: 25, attrs: '2 4 0 -5 0 0',
  resist: { cold: 5, electricity: 5, fire: 5, piercing: 5, slashing: 5 }, immune: UNDEAD_IMM, skills: { acrobatics: 6, athletics: 3 },
  strikes: [['Scimitar', 'm', 6, '1d6+2', 'S', 'forceful sweep', { w: 1 }], ['Claw', 'm', 6, '1d4+2', 'S', 'agile finesse'], ['Shortbow', 'r', 6, '1d6', 'P', 'deadly-d10', { range: 60, w: 1 }]],
  shape: 'skeleton', color: '#d8d0b8', theme: ['undead'], desc: 'Animated bones that shrug off blades and arrows.' });
C('zombieShambler', { name: 'Zombie Shambler', lvl: -1, size: 'medium', traits: 'mindless undead zombie', per: 0, ac: 13, fort: 6, ref: 0, will: 2, hp: 20, speed: 25, attrs: '3 -2 2 -5 0 -2',
  weak: { slashing: 5, vitality: 5 }, immune: UNDEAD_IMM, abil: ['zombieSlow'], skills: { athletics: 5 },
  strikes: [['Fist', 'm', 7, '1d6+2', 'B', '']], shape: 'zombie', color: '#7d8c6a', theme: ['undead'], desc: 'Slowed and relentless; vulnerable to slashing.' });
C('thug', { name: 'Thug', lvl: 0, size: 'medium', traits: 'human humanoid', per: 4, ac: 15, fort: 7, ref: 5, will: 3, hp: 18, speed: 25, attrs: '3 1 2 -1 0 0',
  skills: { athletics: 7, intimidation: 5 }, strikes: [['Club', 'm', 8, '1d6+3', 'B', 'thrown-10', { w: 1 }], ['Sling', 'r', 6, '1d6+1', 'B', 'propulsive', { range: 50, w: 1 }]],
  shape: 'humanoid', color: '#8a6b4a', theme: ['bandit'], desc: 'A hired bruiser.' });
C('orcBrute', { name: 'Orc Brute', lvl: 0, size: 'medium', traits: 'orc humanoid', per: 5, ac: 15, fort: 9, ref: 4, will: 4, hp: 16, speed: 25, attrs: '4 1 3 -1 0 0',
  abil: ['ferocity'], skills: { athletics: 7, intimidation: 5 }, strikes: [['Orc Necksplitter', 'm', 8, '1d8+3', 'S', 'forceful sweep', { w: 1 }], ['Javelin', 'r', 5, '1d6+3', 'P', 'thrown', { range: 30, w: 1, qty: 3 }]],
  shape: 'humanoid', color: '#6f7a4a', theme: ['orc'], desc: 'Muscle with Orc Ferocity.' });
C('goblinCommando', { name: 'Goblin Commando', lvl: 1, size: 'small', traits: 'goblin humanoid', per: 5, ac: 17, fort: 5, ref: 8, will: 5, hp: 18, speed: 25, attrs: '2 3 1 0 0 1',
  skills: { acrobatics: 6, athletics: 5, stealth: 6, intimidation: 5 }, strikes: [['Horsechopper', 'm', 8, '1d8+2', 'S', 'reach trip versatile-P', { reach: 10, w: 1 }], ['Shortbow', 'r', 8, '1d6', 'P', 'deadly-d10', { range: 60, w: 1 }]],
  shape: 'small', color: '#56782f', theme: ['goblin'], desc: 'A goblin veteran with a polearm.' });
C('goblinPyro', { name: 'Goblin Pyro', lvl: 1, size: 'small', traits: 'goblin humanoid', per: 6, ac: 17, fort: 4, ref: 8, will: 5, hp: 15, speed: 25, attrs: '0 3 1 1 0 2',
  skills: { acrobatics: 6, crafting: 5, stealth: 6 }, strikes: [['Dogslicer', 'm', 8, '1d6', 'S', 'agile backstabber finesse', { w: 1 }], ['Alchemist’s Fire', 'r', 8, '1d8', 'fire', 'splash', { range: 20, eff: ['persistFire1', 'splash1'] }]],
  shape: 'small', color: '#a8622c', theme: ['goblin'], desc: 'Throws bottled fire with glee.' });
C('koboldScout', { name: 'Kobold Scout', lvl: 1, size: 'small', traits: 'kobold humanoid', per: 7, ac: 18, fort: 5, ref: 9, will: 5, hp: 16, speed: 25, attrs: '0 4 1 0 1 0',
  abil: ['sneakAttack1'], skills: { acrobatics: 7, stealth: 7, survival: 5 }, strikes: [['Shortsword', 'm', 8, '1d6', 'P', 'agile finesse versatile-S', { w: 1 }], ['Crossbow', 'r', 9, '1d8', 'P', '', { range: 120, reload: 1, w: 1 }]],
  shape: 'small', color: '#b0633a', theme: ['kobold'], desc: 'Sneaky crossbow sniper.' });
C('wolf', { name: 'Wolf', lvl: 1, size: 'medium', traits: 'animal', per: 7, ac: 15, fort: 7, ref: 9, will: 5, hp: 24, speed: 35, attrs: '2 4 1 -4 1 -2',
  abil: ['packAttack'], skills: { acrobatics: 7, athletics: 5, stealth: 7, survival: 7 }, strikes: [['Jaws', 'm', 7, '1d6+2', 'P', '', { eff: ['knockdown'] }]],
  shape: 'beast', color: '#8a8a90', theme: ['beast'], desc: 'Pack hunters that trip their prey.' });
C('ghoul', { name: 'Ghoul', lvl: 1, size: 'medium', traits: 'ghoul undead', per: 7, ac: 16, fort: 4, ref: 9, will: 7, hp: 20, speed: 30, attrs: '1 4 1 1 2 2',
  immune: 'disease paralyzed poison', skills: { acrobatics: 7, athletics: 4, stealth: 7 },
  strikes: [['Jaws', 'm', 9, '1d6+1', 'P', 'finesse', { eff: ['paralysis15'] }], ['Claw', 'm', 9, '1d4+1', 'S', 'agile finesse', { eff: ['paralysis15'] }]],
  shape: 'zombie', color: '#8d9a8f', theme: ['undead'], desc: 'Hungry undead whose touch paralyzes.' });
C('orcWarrior', { name: 'Orc Warrior', lvl: 1, size: 'medium', traits: 'orc humanoid', per: 6, ac: 18, fort: 9, ref: 5, will: 5, hp: 23, speed: 25, attrs: '4 2 3 -1 1 0',
  abil: ['ferocity'], skills: { athletics: 7, intimidation: 5, survival: 4 }, strikes: [['Orc Necksplitter', 'm', 9, '1d8+4', 'S', 'forceful sweep', { w: 1 }], ['Javelin', 'r', 7, '1d6+4', 'P', 'thrown', { range: 30, w: 1, qty: 3 }]],
  shape: 'humanoid', color: '#5f7040', theme: ['orc'], desc: 'Disciplined orc fighter with Ferocity.' });
C('hobgoblinSoldier', { name: 'Hobgoblin Soldier', lvl: 1, size: 'medium', traits: 'hobgoblin humanoid', per: 6, ac: 18, fort: 7, ref: 6, will: 5, hp: 20, speed: 25, attrs: '3 2 2 0 0 -1',
  abil: ['formation'], skills: { athletics: 7, intimidation: 4 }, strikes: [['Longsword', 'm', 9, '1d8+3', 'S', 'versatile-P', { w: 1 }], ['Shortbow', 'r', 8, '1d6', 'P', 'deadly-d10', { range: 60, w: 1 }]],
  shape: 'humanoid', color: '#9a5a3a', theme: ['goblin', 'military'], desc: 'Fights in formation (+1 AC beside another hobgoblin).' });
C('bandit', { name: 'Bandit', lvl: 1, size: 'medium', traits: 'human humanoid', per: 6, ac: 17, fort: 6, ref: 9, will: 5, hp: 20, speed: 25, attrs: '1 4 1 0 1 1',
  abil: ['sneakAttack1'], skills: { acrobatics: 7, deception: 5, stealth: 7, intimidation: 5 }, strikes: [['Shortsword', 'm', 9, '1d6+1', 'P', 'agile finesse versatile-S', { w: 1 }], ['Shortbow', 'r', 9, '1d6', 'P', 'deadly-d10', { range: 60, w: 1 }]],
  shape: 'humanoid', color: '#5b4a3a', theme: ['bandit'], desc: 'Highway robber who strikes the unwary.' });
C('cultist', { name: 'Cultist', lvl: 1, size: 'medium', traits: 'human humanoid', per: 7, ac: 15, fort: 5, ref: 5, will: 9, hp: 16, speed: 25, attrs: '0 1 1 0 3 2',
  skills: { religion: 7, deception: 5, intimidation: 5 }, strikes: [['Dagger', 'm', 6, '1d4+2', 'P', 'agile finesse versatile-S', { w: 1 }]],
  spells: { trad: 'divine', dc: 17, atk: 9, list: [{ id: 'fear', rank: 1, uses: 1 }, { id: 'harm', rank: 1, uses: 2 }], cantrips: ['voidWarp', 'daze'] },
  shape: 'caster', color: '#5a2a3a', theme: ['cult'], desc: 'Zealot with harm and fear.' });
C('boar', { name: 'Boar', lvl: 2, size: 'medium', traits: 'animal', per: 8, ac: 18, fort: 10, ref: 5, will: 6, hp: 30, speed: 40, attrs: '4 0 4 -4 2 -3',
  abil: ['ferocity', 'boarCharge'], skills: { athletics: 8, survival: 6 }, strikes: [['Tusk', 'm', 10, '1d10+5', 'P', '']],
  shape: 'beast', color: '#5a4636', theme: ['beast'], desc: 'Charging tusks and Ferocity.' });
C('zombieBrute', { name: 'Zombie Brute', lvl: 2, size: 'large', traits: 'mindless undead zombie', per: 4, ac: 15, fort: 11, ref: 3, will: 5, hp: 70, speed: 25, attrs: '5 -2 4 -5 0 -2',
  weak: { slashing: 5, vitality: 5 }, immune: UNDEAD_IMM, abil: ['zombieSlow'], skills: { athletics: 9 },
  strikes: [['Fist', 'm', 11, '2d8+6', 'B', '', { reach: 10 }]], shape: 'zombie', color: '#6d7a5a', theme: ['undead'], desc: 'A hulking zombie with long reach.' });
C('skeletalChampion', { name: 'Skeletal Champion', lvl: 2, size: 'medium', traits: 'skeleton undead', per: 8, ac: 19, fort: 8, ref: 11, will: 7, hp: 25, speed: 25, attrs: '4 3 2 -1 1 0',
  resist: { cold: 5, electricity: 5, fire: 5, piercing: 5, slashing: 5 }, immune: 'death disease paralyzed poison unconscious', abil: ['shieldBlockM'], shield: { ac: 2, hard: 5, hp: 20, bt: 10 },
  skills: { athletics: 9, intimidation: 7 }, strikes: [['Longsword', 'm', 10, '1d8+4', 'S', 'versatile-P', { w: 1 }]],
  shape: 'skeleton', color: '#cfc6a8', theme: ['undead'], desc: 'An armored skeleton that raises its shield.' });
C('gnollHunter', { name: 'Gnoll Hunter', lvl: 2, size: 'medium', traits: 'gnoll humanoid', per: 8, ac: 17, fort: 9, ref: 8, will: 6, hp: 32, speed: 25, attrs: '3 2 3 -1 1 0',
  abil: ['packAttack'], skills: { athletics: 8, intimidation: 6, survival: 8 }, strikes: [['Flail', 'm', 10, '1d6+5', 'B', 'disarm sweep trip', { w: 1 }], ['Composite Longbow', 'r', 9, '1d8+2', 'P', 'deadly-d10 propulsive volley-30', { range: 100, w: 1 }]],
  shape: 'humanoid', color: '#9a7a4a', theme: ['beast', 'bandit'], desc: 'Hyena-like raider that hunts in packs.' });
C('koboldMage', { name: 'Kobold Dragon Mage', lvl: 2, size: 'small', traits: 'kobold humanoid', per: 7, ac: 17, fort: 5, ref: 7, will: 9, hp: 25, speed: 25, attrs: '0 2 1 2 1 4',
  skills: { arcana: 8, stealth: 7 }, strikes: [['Spear', 'm', 8, '1d6+2', 'P', '', { w: 1 }]],
  spells: { trad: 'arcane', dc: 18, atk: 10, list: [{ id: 'forceBarrage', rank: 1, uses: 2 }, { id: 'breatheFire', rank: 1, uses: 1 }], cantrips: ['electricArc', 'telekineticProjectile'] },
  shape: 'small', color: '#c24a2a', theme: ['kobold'], desc: 'Draconic sorcerer with force shards and fire.' });
C('ghast', { name: 'Ghast', lvl: 2, size: 'medium', traits: 'ghoul undead', per: 8, ac: 18, fort: 7, ref: 11, will: 9, hp: 30, speed: 30, attrs: '2 4 1 1 2 3',
  immune: 'disease paralyzed poison', abil: ['stench18'], skills: { acrobatics: 9, athletics: 6, stealth: 9 },
  strikes: [['Jaws', 'm', 11, '1d8+4', 'P', 'finesse', { eff: ['paralysis18'] }], ['Claw', 'm', 11, '1d6+4', 'S', 'agile finesse', { eff: ['paralysis18'] }]],
  shape: 'zombie', color: '#6d7d74', theme: ['undead'], desc: 'Ghoul lord with a sickening stench.' });
C('ogreWarrior', { name: 'Ogre Warrior', lvl: 3, size: 'large', traits: 'giant humanoid', per: 5, ac: 17, fort: 11, ref: 6, will: 5, hp: 50, speed: 25, attrs: '5 0 4 -2 0 -2',
  abil: ['reactiveStrike'], skills: { athletics: 12, intimidation: 7 }, strikes: [['Ogre Hook', 'm', 12, '1d10+7', 'P', 'deadly-d10 reach trip', { reach: 10, w: 1 }], ['Javelin', 'r', 6, '1d6+7', 'P', 'thrown', { range: 30, w: 1, qty: 3 }]],
  shape: 'giant', color: '#9a8466', theme: ['giant'], desc: 'Huge, cruel, and punishing to those who move past it.' });
C('hellhound', { name: 'Hellhound', lvl: 3, size: 'medium', traits: 'beast fiend fire', per: 9, ac: 19, fort: 9, ref: 11, will: 7, hp: 40, speed: 40, attrs: '3 4 3 -2 2 -2',
  immune: 'fire', weak: { cold: 5 }, abil: ['breathHellhound'], skills: { acrobatics: 9, athletics: 9, stealth: 9 },
  strikes: [['Jaws', 'm', 11, '1d8+4', 'P', '', { plus: '1d6 fire' }]], shape: 'beast', color: '#7a2a1e', theme: ['fiend', 'fire'], desc: 'Fiendish hound that breathes fire.' });
C('banditCaptain', { name: 'Bandit Captain', lvl: 3, size: 'medium', traits: 'human humanoid', per: 9, ac: 19, fort: 8, ref: 11, will: 9, hp: 45, speed: 25, attrs: '2 4 2 1 1 3',
  abil: ['sneakAttack1', 'reactiveStrike'], skills: { acrobatics: 10, deception: 10, intimidation: 10 },
  strikes: [['Rapier', 'm', 12, '1d6+6', 'P', 'deadly-d8 disarm finesse', { w: 1 }], ['Hand Crossbow', 'r', 11, '1d6+3', 'P', '', { range: 60, reload: 1, w: 1 }]],
  shape: 'humanoid', color: '#3e3a5a', theme: ['bandit'], desc: 'A duelist leader.' });
C('owlbear', { name: 'Owlbear', lvl: 4, size: 'large', traits: 'animal', per: 13, ac: 21, fort: 13, ref: 7, will: 11, hp: 70, speed: 25, attrs: '6 1 5 -4 3 0',
  abil: ['screech21'], skills: { acrobatics: 7, athletics: 14 }, strikes: [['Beak', 'm', 14, '1d12+7', 'P', ''], ['Talon', 'm', 14, '1d10+7', 'S', 'agile', { eff: ['grab'] }]],
  shape: 'owlbear', color: '#7a5a3a', theme: ['beast'], desc: 'Grabs with talons and screeches terror.' });
C('gargoyle', { name: 'Gargoyle', lvl: 4, size: 'medium', traits: 'earth', per: 10, ac: 21, fort: 12, ref: 10, will: 10, hp: 40, speed: { land: 25, fly: 40 }, attrs: '4 2 3 -2 2 -2',
  resist: { physical: 5 }, skills: { acrobatics: 10, stealth: 12 }, strikes: [['Jaws', 'm', 14, '1d10+6', 'P', ''], ['Claw', 'm', 14, '1d6+6', 'S', 'agile']],
  shape: 'winged', color: '#6c6c70', theme: ['construct', 'ruins'], desc: 'Flying stone predator that resists physical damage.' });
C('minotaur', { name: 'Minotaur', lvl: 4, size: 'large', traits: 'beast humanoid', per: 13, ac: 20, fort: 13, ref: 9, will: 11, hp: 70, speed: 35, attrs: '6 0 4 -2 2 -1',
  abil: ['powerfulCharge'], skills: { athletics: 14, intimidation: 9 }, strikes: [['Greataxe', 'm', 14, '1d12+8', 'S', 'sweep', { reach: 10, w: 1 }], ['Horn', 'm', 14, '1d8+6', 'P', '', { reach: 10 }]],
  shape: 'giant', color: '#5a3a2a', theme: ['beast', 'giant'], desc: 'Horned brute with a devastating charge.' });
C('troll', { name: 'Troll', lvl: 5, size: 'large', traits: 'giant troll', per: 11, ac: 20, fort: 17, ref: 11, will: 7, hp: 115, speed: 30, attrs: '5 2 6 -2 0 -2',
  weak: { fire: 10 }, abil: ['regen20', 'reactiveStrike', 'rend'], skills: { athletics: 12, intimidation: 12 },
  strikes: [['Jaws', 'm', 14, '2d10+6', 'P', '', { reach: 10 }], ['Claw', 'm', 14, '2d8+6', 'S', 'agile', { reach: 10 }]],
  shape: 'giant', color: '#4f6a3a', theme: ['giant'], desc: 'Regenerates unless burned or melted.' });
C('manticore', { name: 'Manticore', lvl: 6, size: 'large', traits: 'beast', per: 15, ac: 23, fort: 15, ref: 14, will: 11, hp: 90, speed: { land: 25, fly: 40 }, attrs: '5 3 4 -2 2 -1',
  skills: { acrobatics: 13, athletics: 15, stealth: 13 }, strikes: [['Jaws', 'm', 17, '2d8+7', 'P', '', { reach: 10 }], ['Claw', 'm', 17, '2d6+7', 'S', 'agile', { reach: 10 }], ['Tail Spike', 'r', 16, '1d10+6', 'P', '', { range: 100 }]],
  shape: 'winged', color: '#9a5a2a', theme: ['beast'], desc: 'Winged lion that hurls tail spikes.' });
C('hillGiant', { name: 'Hill Giant', lvl: 7, size: 'large', traits: 'giant humanoid', per: 13, ac: 24, fort: 18, ref: 12, will: 13, hp: 140, speed: 35, attrs: '7 0 4 -2 0 -1',
  abil: ['wideSwing'], skills: { athletics: 18, intimidation: 13 }, strikes: [['Greatclub', 'm', 18, '2d10+10', 'B', 'backswing shove', { reach: 10, w: 1 }], ['Rock', 'r', 16, '2d8+10', 'B', 'thrown', { range: 120 }]],
  shape: 'giant', color: '#a07a56', theme: ['giant'], desc: 'Clubs and boulders.' });
C('youngRedDragon', { name: 'Young Red Dragon', lvl: 10, size: 'large', traits: 'dragon fire', per: 20, ac: 30, fort: 21, ref: 17, will: 19, hp: 210, speed: { land: 40, fly: 120 }, attrs: '7 2 5 1 3 4',
  immune: 'fire paralyzed sleep', weak: { cold: 10 }, abil: ['breathRedYoung', 'frightful27', 'draconicFrenzy'], skills: { acrobatics: 17, athletics: 21, intimidation: 21 },
  strikes: [['Jaws', 'm', 23, '2d12+12', 'P', '', { reach: 10, plus: '2d6 fire' }], ['Claw', 'm', 23, '2d10+12', 'S', 'agile', { reach: 10 }], ['Tail', 'm', 21, '2d10+10', 'B', '', { reach: 15 }]],
  shape: 'dragon', color: '#b2301c', theme: ['dragon', 'fire'], desc: 'Fire breath, frightful presence and a flurry of claws.' });

/* ---------- monster ability definitions (data; engine implements kinds) ---------- */
D.abilities = {
  reactiveStrike: { kind: 'flag', flag: 'reactiveStrike', name: 'Reactive Strike' },
  ferocity: { kind: 'flag', flag: 'ferocity', name: 'Ferocity' },
  zombieSlow: { kind: 'flag', flag: 'zombieSlow', name: 'Slow (slowed 1, no reactions)' },
  packAttack: { kind: 'flag', flag: 'packAttack', name: 'Pack Attack (+1d4 vs foes in reach of 2 allies)' },
  formation: { kind: 'flag', flag: 'formation', name: 'Formation (+1 AC next to an ally)' },
  sneakAttack1: { kind: 'flag', flag: 'mSneak', dice: 1, name: 'Sneak Attack 1d6' },
  shieldBlockM: { kind: 'flag', flag: 'shieldBlock', name: 'Shield Block' },
  rend: { kind: 'flag', flag: 'rend', name: 'Rend (two claw hits: extra claw damage)' },
  regen20: { kind: 'regen', v: 20, off: ['acid', 'fire'], name: 'Regeneration 20 (acid, fire)' },
  stench18: { kind: 'aura', name: 'Stench (10 ft, DC 18)', r: 10, dc: 18 },
  boarCharge: { kind: 'act', act: 'monsterCharge', name: 'Boar Charge', bonus: 2, dmg: 0 },
  powerfulCharge: { kind: 'act', act: 'monsterCharge', name: 'Powerful Charge', bonus: 0, dmg: 4, strike: 'Horn' },
  wideSwing: { kind: 'act', act: 'swipe', name: 'Wide Swing' },
  screech21: { kind: 'act', act: 'screech', name: 'Bloodcurdling Screech', dc: 21, r: 30 },
  breathHellhound: { kind: 'act', act: 'breath', name: 'Breath Weapon', area: { t: 'cone', r: 15 }, dmg: '4d6', type: 'fire', dc: 19 },
  breathRedYoung: { kind: 'act', act: 'breath', name: 'Breath Weapon', area: { t: 'cone', r: 40 }, dmg: '10d6', type: 'fire', dc: 29 },
  frightful27: { kind: 'aura', name: 'Frightful Presence (90 ft, DC 27)', r: 90, dc: 27, fear: true },
  draconicFrenzy: { kind: 'act', act: 'frenzy', name: 'Draconic Frenzy' }
};

/* ---------- GM Core creature-building tables (index = level + 1) ---------- */
const T = D.tables = {
  per: [[9, 8, 5, 2, 0], [10, 9, 6, 3, 1], [11, 10, 7, 4, 2], [12, 11, 8, 5, 3], [14, 12, 9, 6, 4], [15, 14, 11, 8, 6], [17, 15, 12, 9, 7], [18, 17, 14, 11, 8], [20, 18, 15, 12, 10], [21, 19, 16, 13, 11], [23, 21, 18, 15, 12], [24, 22, 19, 16, 14], [26, 24, 21, 18, 15], [27, 25, 22, 19, 16], [29, 26, 23, 20, 18], [30, 28, 25, 22, 19], [32, 29, 26, 23, 20], [33, 30, 28, 25, 22], [35, 32, 29, 26, 23], [36, 33, 30, 27, 24], [38, 35, 32, 29, 26], [39, 36, 33, 30, 27], [41, 38, 35, 32, 28], [43, 39, 36, 33, 30], [44, 40, 37, 34, 31], [46, 42, 38, 36, 32]],
  ac: [[18, 15, 14, 12], [19, 16, 15, 13], [19, 16, 15, 13], [21, 18, 17, 15], [22, 19, 18, 16], [24, 21, 20, 18], [25, 22, 21, 19], [27, 24, 23, 21], [28, 25, 24, 22], [30, 27, 26, 24], [31, 28, 27, 25], [33, 30, 29, 27], [34, 31, 30, 28], [36, 33, 32, 30], [37, 34, 33, 31], [39, 36, 35, 33], [40, 37, 36, 34], [42, 39, 38, 36], [43, 40, 39, 37], [45, 42, 41, 39], [46, 43, 42, 40], [48, 45, 44, 42], [49, 46, 45, 43], [51, 48, 47, 45], [52, 49, 48, 46], [54, 51, 50, 48]],
  hp: [[9, 7, 5], [18, 15, 12], [25, 20, 15], [38, 30, 23], [56, 45, 34], [75, 60, 45], [94, 75, 56], [119, 95, 71], [144, 115, 86], [169, 135, 101], [194, 155, 116], [219, 175, 131], [244, 195, 146], [269, 215, 161], [294, 235, 176], [319, 255, 191], [344, 275, 206], [369, 295, 221], [394, 315, 236], [419, 335, 251], [444, 355, 266], [469, 375, 281], [500, 400, 300], [538, 430, 323], [575, 460, 345], [625, 500, 375]],
  atk: [[10, 8, 6, 4], [10, 8, 6, 4], [11, 9, 7, 5], [13, 11, 9, 7], [14, 12, 10, 8], [16, 14, 12, 9], [17, 15, 13, 11], [19, 17, 15, 12], [20, 18, 16, 13], [22, 20, 18, 15], [23, 21, 19, 16], [25, 23, 21, 17], [27, 24, 22, 19], [28, 26, 24, 20], [29, 27, 25, 21], [31, 29, 27, 23], [32, 30, 28, 24], [34, 32, 30, 25], [35, 33, 31, 27], [37, 35, 33, 28], [38, 36, 34, 29], [40, 38, 36, 31], [41, 39, 37, 32], [43, 41, 39, 33], [44, 42, 40, 35], [46, 44, 42, 36]],
  dmg: [['1d6+1', '1d4+1', '1d4', '1d4'], ['1d6+3', '1d6+2', '1d4+2', '1d4+1'], ['1d8+4', '1d6+3', '1d6+2', '1d4+2'], ['1d12+4', '1d10+4', '1d8+4', '1d6+3'], ['1d12+8', '1d10+6', '1d8+6', '1d6+5'], ['2d10+7', '2d8+5', '2d6+5', '2d4+4'], ['2d12+7', '2d8+7', '2d6+6', '2d4+6'], ['2d12+10', '2d8+9', '2d6+8', '2d4+7'], ['2d12+12', '2d10+9', '2d8+8', '2d6+6'], ['2d12+15', '2d10+11', '2d8+9', '2d6+8'], ['2d12+17', '2d10+13', '2d8+11', '2d6+9'], ['2d12+20', '2d12+13', '2d10+11', '2d6+10'], ['2d12+22', '2d12+15', '2d10+12', '2d8+10'], ['3d12+19', '3d10+14', '3d8+12', '3d6+10'], ['3d12+21', '3d10+16', '3d8+14', '3d6+11'], ['3d12+24', '3d10+18', '3d8+15', '3d6+12'], ['3d12+26', '3d12+17', '3d10+14', '3d6+14'], ['3d12+29', '3d12+18', '3d10+15', '3d6+15'], ['3d12+31', '3d12+19', '3d10+16', '3d6+16'], ['3d12+34', '3d12+20', '3d10+17', '3d6+17'], ['4d12+29', '4d10+20', '4d8+17', '4d6+14'], ['4d12+32', '4d10+22', '4d8+19', '4d6+15'], ['4d12+34', '4d10+24', '4d8+20', '4d6+17'], ['4d12+37', '4d10+26', '4d8+22', '4d6+18'], ['4d12+39', '4d12+24', '4d10+20', '4d6+19'], ['4d12+42', '4d12+26', '4d10+22', '4d6+21']],
  spell: [[19, 16, 13], [19, 16, 13], [20, 17, 14], [22, 18, 15], [23, 20, 17], [25, 21, 18], [26, 22, 19], [27, 24, 21], [29, 25, 22], [30, 26, 23], [32, 28, 25], [33, 29, 26], [34, 30, 27], [36, 32, 29], [37, 33, 30], [39, 34, 31], [40, 36, 33], [41, 37, 34], [43, 38, 35], [44, 40, 37], [46, 41, 38], [47, 42, 39], [48, 44, 41], [50, 45, 42], [51, 46, 43], [52, 48, 44]],
  attr: [[4, 3, 2, 0], [4, 3, 2, 0], [5, 4, 3, 1], [5, 4, 3, 1], [5, 4, 3, 1], [6, 5, 3, 2], [6, 5, 4, 2], [7, 5, 4, 2], [7, 6, 4, 2], [7, 6, 4, 3], [7, 6, 4, 3], [8, 7, 5, 3], [8, 7, 5, 3], [8, 7, 5, 4], [9, 8, 5, 4], [9, 8, 5, 4], [10, 9, 6, 5], [10, 9, 6, 5], [10, 9, 6, 5], [11, 10, 6, 6], [11, 10, 7, 6], [11, 10, 7, 6], [12, 11, 7, 7], [12, 11, 7, 7], [12, 11, 7, 7], [13, 12, 8, 8]]
};
const ti = L => U.clamp(L + 1, 0, 25);
D.roles = {
  brute: { name: 'Brute', per: 3, ac: 3, hp: 0, atk: 2, dmg: 0, fort: 1, ref: 3, will: 3, desc: 'Low defenses, high HP, hits very hard.' },
  soldier: { name: 'Soldier', per: 2, ac: 1, hp: 0, atk: 1, dmg: 1, fort: 1, ref: 2, will: 3, rs: true, desc: 'High AC and HP, Reactive Strike.' },
  skirmisher: { name: 'Skirmisher', per: 2, ac: 1, hp: 1, atk: 1, dmg: 2, fort: 3, ref: 1, will: 2, fast: true, desc: 'Fast and evasive.' },
  sniper: { name: 'Sniper', per: 1, ac: 2, hp: 2, atk: 1, dmg: 1, fort: 3, ref: 1, will: 2, ranged: true, desc: 'Deadly at range, fragile up close.' },
  caster: { name: 'Spellcaster', per: 1, ac: 3, hp: 2, atk: 3, dmg: 3, fort: 3, ref: 2, will: 1, caster: true, desc: 'Area spells and debuffs; weak in melee.' }
};
D.flavors = {
  humanoid: { name: 'Humanoid', shape: 'humanoid', color: '#8a6a4a', melee: ['Longsword', 'S', 'versatile-P'], ranged: ['Longbow', 'P', 'deadly-d10'], trad: 'arcane' },
  beast: { name: 'Beast', shape: 'beast', color: '#7a6a52', melee: ['Jaws', 'P', ''], ranged: ['Spines', 'P', ''], trad: 'primal' },
  undead: { name: 'Undead', shape: 'skeleton', color: '#cfc6a8', melee: ['Claw', 'S', 'agile'], ranged: ['Bone Shard', 'P', ''], trad: 'divine', undead: true },
  fiend: { name: 'Fiend', shape: 'humanoid', color: '#7a2a2a', melee: ['Claw', 'S', 'agile'], ranged: ['Hellfire Bolt', 'fire', ''], trad: 'divine', resist: 'fire' },
  elemental: { name: 'Elemental', shape: 'giant', color: '#5a6a7a', melee: ['Slam', 'B', ''], ranged: ['Hurled Stone', 'B', ''], trad: 'primal', immune: 'poison sleep paralyzed' }
};
D.makeCreature = function (o) {
  const L = U.clamp(o.level | 0, -1, 24), r = D.roles[o.role] || D.roles.soldier, fl = D.flavors[o.flavor] || D.flavors.humanoid, i = ti(L);
  const size = o.size || (o.role === 'brute' && L >= 3 ? 'large' : 'medium');
  const atkB = T.atk[i][r.atk], dmg = T.dmg[i][r.dmg];
  const strikes = [];
  const meleeTr = (fl.melee[2] ? fl.melee[2] + ' ' : '') + (r.atk <= 1 && fl.melee[2] !== 'agile' ? '' : '');
  strikes.push([fl.melee[0], 'm', r.ranged || r.caster ? T.atk[i][r.atk + (r.caster ? 0 : 1)] : atkB, r.ranged || r.caster ? T.dmg[i][Math.min(3, r.dmg + 1)] : dmg, fl.melee[1], meleeTr.trim(), { reach: size === 'large' || size === 'huge' ? 10 : 5 }]);
  if (r.ranged || o.role === 'skirmisher') strikes.push([fl.ranged[0], 'r', r.ranged ? T.atk[i][0] : T.atk[i][2], r.ranged ? T.dmg[i][1] : T.dmg[i][2], fl.ranged[1], fl.ranged[2], { range: r.ranged ? 100 : 40 }]);
  const a = T.attr[i];
  const attrs = [a[r.dmg <= 1 ? 1 : 2], a[r.ref <= 1 ? 1 : 2], a[r.fort <= 1 ? 1 : 2], a[3], a[2], r.caster ? a[1] : a[3]].join(' ');
  const id = 'gen_' + (o.flavor || 'humanoid') + '_' + (o.role || 'soldier') + '_' + L + '_' + Math.floor(U.rand() * 1e6).toString(36);
  const spells = r.caster ? D.genSpells(L, fl.trad, T.spell[i]) : null;
  const def = {
    name: o.name || (fl.name + ' ' + r.name), lvl: L, size, traits: (fl.undead ? 'undead ' : '') + (o.flavor || 'humanoid'), per: T.per[i][r.per], ac: T.ac[i][r.ac], fort: T.per[i][r.fort], ref: T.per[i][r.ref], will: T.per[i][r.will],
    hp: T.hp[i][r.hp], speed: r.fast ? 35 : 25, attrs, strikes, abil: r.rs ? ['reactiveStrike'] : [], skills: { athletics: T.per[i][r.fort === 1 ? 1 : 2], acrobatics: T.per[i][r.ref === 1 ? 1 : 2], stealth: T.per[i][2] },
    resist: fl.resist ? { [fl.resist]: Math.max(2, Math.floor(L / 2) + 2) } : {}, immune: (fl.undead ? UNDEAD_IMM : fl.immune) || '', weak: fl.undead ? { vitality: Math.max(2, Math.floor(L / 2) + 2) } : {},
    shape: o.size === 'small' ? 'small' : fl.shape, color: o.color || fl.color, generated: true, role: o.role, flavor: o.flavor, desc: 'Generated with the GM Core building tables (' + r.name + ').'
  };
  if (spells) def.spells = spells;
  C(id, def);
  return D.creatures[id];
};
D.genSpells = function (L, trad, row) {
  const rank = U.clamp(Math.ceil(L / 2), 1, 9);
  const dc = row[1], atk = dc - 8;
  const list = [];
  const pick = (ids, uses) => { const id = ids.find(x => D.spells[x] && D.spells[x].rank <= rank && D.spells[x].trad.includes(trad)); if (id) list.push({ id, rank, uses }); };
  pick(['chainLightning', 'fireball', 'divineWrath', 'breatheFire', 'noiseBlast', 'thunderstrike'], 2);
  pick(['slow', 'fear', 'enfeeble', 'command'], 1);
  if (trad === 'divine' || trad === 'primal') pick(['heal'], 1);
  const cantrips = ['electricArc', 'voidWarp', 'daze', 'telekineticProjectile', 'ignition'].filter(x => D.spells[x].trad.includes(trad)).slice(0, 2);
  return { trad, dc, atk, list, cantrips };
};

/* ---------- elite / weak (GM Core) ---------- */
D.adjustCreature = function (c, adj) {
  if (!adj) return c;
  const x = U.clone(c); const L = c.lvl;
  const s = adj === 'elite' ? 2 : -2;
  x.ac += s; x.fort += s; x.ref += s; x.will += s; x.per += s;
  Object.keys(x.skills || {}).forEach(k => { x.skills[k] += s; });
  x.strikes.forEach(st => { st.bonus += s; st.dmg[0].m += s; });
  if (x.spells) { x.spells.dc += s; x.spells.atk += s; }
  if (adj === 'elite') x.hp += L <= 1 ? 10 : L <= 4 ? 15 : L <= 19 ? 20 : 30;
  else x.hp = Math.max(1, x.hp - (L <= 2 ? 10 : L <= 5 ? 15 : L <= 20 ? 20 : 30));
  x.lvl = adj === 'elite' ? (L <= 0 ? L + 2 : L + 1) : (L === 1 ? -1 : L - 1);
  x.name = (adj === 'elite' ? 'Elite ' : 'Weak ') + c.name; x.adj = adj;
  x.abilDC = s;
  return x;
};

/* ---------- monster unit factory ---------- */
let mN = 0;
D.unitFromCreature = function (c0, adj) {
  const c = D.adjustCreature(c0, adj);
  const sq = PF.SIZE[c.size].sq;
  const u = {
    id: 'm' + (++mN), name: c.name, team: 'foe', kind: 'npc', cid: c0.id, adj: adj || null, level: c.lvl, size: c.size, sq, traits: c.traits.slice(),
    attr: Object.assign({}, c.attr), hp: c.hp, maxHP: c.hp, temp: 0, speed: Object.assign({}, c.speed),
    st: { ac: { base: c.ac, item: 0 }, fort: { base: c.fort, item: 0 }, ref: { base: c.ref, item: 0 }, will: { base: c.will, item: 0 }, per: { base: c.per, item: 0 }, skills: {},
      classDC: 10 + Math.max(c.fort, c.ref, c.will, c.per) - 2 + 0, spellDC: c.spells ? c.spells.dc : null, spellAtk: c.spells ? c.spells.atk : null },
    ranks: {}, strikes: c.strikes.map((s, i) => ({ id: 'c' + i, name: s.name, kind: s.kind, atk: { base: s.bonus, item: 0 }, atkAttr: s.kind === 'ranged' ? 'dex' : (s.traits.includes('finesse') ? 'dex' : 'str'),
      dmg: U.clone(s.dmg), dmgAttr: s.kind === 'melee' ? 'str' : null, traits: s.traits.slice(), range: s.range, reach: s.reach, reload: s.reload, loaded: true, w: s.w, eff: s.eff.slice(), qty: s.qty, monster: true })),
    shield: c.shield ? Object.assign({ name: 'Shield', cur: c.shield.hp, raised: false, broken: false }, c.shield) : null,
    flags: {}, acts: [], feats: [], focus: null, spells: null, resist: Object.assign({}, c.resist), weak: Object.assign({}, c.weak), immune: c.immune.slice(),
    abil: c.abil.slice(), potions: { n: 0 }, hero: 0, initSkill: 'perception', shape: c.shape, color: c.color, glyph: c.name.charAt(0), clsName: 'Level ' + c.lvl
  };
  Object.keys(PF.SKILLS).forEach(k => { const v = c.skills && c.skills[k] != null ? c.skills[k] : (c.attr[PF.SKILLS[k]] || 0); u.st.skills[k] = { base: v, item: 0, rank: c.skills && c.skills[k] != null ? 2 : 0 }; });
  u.abil.forEach(id => { const a = D.abilities[id]; if (!a) return; if (a.kind === 'flag') { u.flags[a.flag] = true; if (a.dice) u.flags.mSneakDice = a.dice; } if (a.kind === 'act') u.acts.push('m:' + id); if (a.kind === 'regen') u.regen = { v: a.v, off: a.off, disabled: false }; if (a.kind === 'aura') (u.auras = u.auras || []).push(Object.assign({ id }, a)); });
  if (c.abilDC) u.abilDC = c.abilDC;
  if (c.spells) {
    const rank = Math.max(1, Math.ceil(c.lvl / 2));
    u.spells = { trad: c.spells.trad, kind: 'innate', dc: c.spells.dc, atk: c.spells.atk, cantripRank: rank, cantrips: c.spells.cantrips.slice(), innate: c.spells.list.map(s => ({ id: s.id, rank: Math.max(s.rank, D.spells[s.id].rank), uses: s.uses, used: 0 })), comps: [] };
  }
  if (u.flags.zombieSlow) u.flags.noReactions = true;
  return u;
};

/* ---------- encounter presets ---------- */
D.presets = [
  { id: 'goblinRaid', name: 'Goblin Raid', pl: 1, map: 'chapel', foes: ['goblinWarrior', 'goblinWarrior', 'goblinCommando', 'goblinPyro'], desc: 'A goblin warband has looted the chapel. Polearms in front, fire behind.' },
  { id: 'restlessDead', name: 'Restless Dead', pl: 1, map: 'crypt', foes: ['skeletonGuard', 'skeletonGuard', 'zombieShambler', 'zombieShambler', 'skeletonGuard'], desc: 'Bones and shamblers. Bring something that isn’t a blade or an arrow.' },
  { id: 'wolfPack', name: 'Wolf Pack', pl: 1, map: 'forest', foes: ['wolf', 'wolf'], desc: 'Two wolves that trip, flank and gang up.' },
  { id: 'koboldWarren', name: 'Kobold Warren', pl: 2, map: 'warrens', foes: ['kobold', 'kobold', 'koboldScout', 'koboldScout', 'koboldMage'], desc: 'Crossbows across the chasm and a dragon mage behind them.' },
  { id: 'banditAmbush', name: 'Bandit Ambush', pl: 2, map: 'river', foes: ['bandit', 'bandit', 'thug', 'thug', 'banditCaptain'], desc: 'Robbers hold the ford. Their captain duels with a rapier.' },
  { id: 'orcRaid', name: 'Orc Raiders', pl: 2, map: 'market', foes: ['orcWarrior', 'orcWarrior', 'orcBrute', 'orcBrute'], desc: 'Orcs storm the market square. Ferocity keeps them standing.' },
  { id: 'ghoulCrypt', name: 'Ghoul Crypt', pl: 3, map: 'crypt', foes: ['ghast', 'ghoul', 'ghoul'], desc: 'Paralyzing claws and a sickening stench in the mist.' },
  { id: 'ogreDen', name: "Ogre's Den", pl: 3, map: 'warrens', foes: ['ogreWarrior', 'goblinCommando', 'goblinCommando'], desc: 'An ogre with Reactive Strike guards the bridge with goblin lackeys.' },
  { id: 'hellhounds', name: 'Hellhounds', pl: 3, map: 'lava', foes: ['hellhound', 'hellhound'], desc: 'Fire-breathing hounds on volcanic ground.' },
  { id: 'owlbearHunt', name: 'Owlbear Hunt', pl: 3, map: 'forest', foes: ['owlbear'], desc: 'A single grabbing, screeching predator.' },
  { id: 'trollBridge', name: 'Troll at the Ford', pl: 4, map: 'river', foes: ['troll'], desc: 'It regenerates. Fire or acid shuts that off.' },
  { id: 'gargoyleTower', name: 'Gargoyle Watch', pl: 4, map: 'tower', foes: ['gargoyle', 'gargoyle', 'koboldScout'], desc: 'Flying stone sentries around the ruined tower.' },
  { id: 'giantRaid', name: 'Hill Giant', pl: 6, map: 'tower', foes: ['hillGiant', 'ogreWarrior'], desc: 'A hill giant and its ogre bodyguard.' },
  { id: 'redDragon', name: 'Young Red Dragon', pl: 9, map: 'lava', foes: ['youngRedDragon'], desc: 'Breath weapon, frightful presence and Draconic Frenzy. A severe solo fight.' },
  { id: 'training', name: 'Training Dummies', pl: 1, map: 'yard', foes: ['thug', 'thug'], desc: 'Two thugs in an open yard: a clean test of the core math.' }
];
D.encounterXP = function (foes, pl) {
  let xp = 0; foes.forEach(f => { const c = D.adjustCreature(D.creatures[f.id], f.adj); xp += PF.creatureXP(c.lvl, pl); });
  return xp;
};
D.autoEncounter = function (pl, threat, size, theme) {
  const target = (PF.THREATS.find(t => t.id === threat) || PF.THREATS[2]);
  const budget = target.xp + target.adj * (size - 4);
  const pool = Object.values(D.creatures).filter(c => !c.generated && c.lvl >= pl - 4 && c.lvl <= pl + 3 && (!theme || theme === 'any' || (c.theme || []).includes(theme)));
  const out = []; let xp = 0; let guard = 0;
  while (xp < budget - 5 && guard++ < 40) {
    const fits = pool.filter(c => xp + PF.creatureXP(c.lvl, pl) <= budget + 5);
    if (!fits.length) break;
    const leaderOK = out.length === 0 ? fits.filter(c => c.lvl >= pl) : fits;
    const c = U.pick(leaderOK.length ? leaderOK : fits);
    out.push({ id: c.id, adj: null }); xp += PF.creatureXP(c.lvl, pl);
    if (out.length >= 8) break;
  }
  if (!out.length || xp < budget * 0.6) {
    // fill with generated creatures matching the party level
    const flv = theme === 'undead' ? 'undead' : theme === 'beast' ? 'beast' : theme === 'fiend' ? 'fiend' : 'humanoid';
    while (xp < budget - 5 && out.length < 8) {
      const rem = budget - xp; const d = rem >= 120 ? 2 : rem >= 60 ? 0 : rem >= 30 ? -1 : -2;
      const role = U.pick(['brute', 'soldier', 'skirmisher', 'sniper', 'caster']);
      const c = D.makeCreature({ level: pl + d, role, flavor: flv });
      out.push({ id: c.id, adj: null }); xp += PF.creatureXP(c.lvl, pl);
    }
  }
  return out;
};
})(typeof window !== 'undefined' ? window : globalThis);
/* ---------- table-built creatures for levels 6–20 ---------- */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D, U = PF.U;
const T = D.tables; const ti = L => U.clamp(L + 1, 0, 25);
const TIER = { ext: 0, high: 1, mod: 2, low: 3, ter: 4 };
const v = (tbl, L, t) => T[tbl][ti(L)][TIER[t] != null ? TIER[t] : t];
const UNDEAD = 'death disease mental paralyzed poison unconscious sleep';
function TC(id, o) {
  const L = o.lvl;
  const def = {
    name: o.name, lvl: L, size: o.size || 'large', traits: o.traits, attrs: o.attrs || '5 2 4 0 2 0',
    per: v('per', L, o.per || 'mod'), ac: v('ac', L, o.ac || 'mod'), fort: v('per', L, o.fort || 'mod'), ref: v('per', L, o.ref || 'mod'), will: v('per', L, o.will || 'mod'),
    hp: T.hp[ti(L)][{ high: 0, mod: 1, low: 2 }[o.hp || 'mod']], speed: o.speed || 25,
    strikes: o.strikes.map(([n, k, at, dt, ty, tr, ex]) => [n, k, v('atk', L, at), TIER[dt] != null ? v('dmg', L, dt) : dt, ty, tr || '', ex || {}]),
    resist: o.resist, weak: o.weak, immune: o.immune, abil: o.abil || [], skills: o.skills || { athletics: v('per', L, 'high') },
    spells: o.spells, shape: o.shape, color: o.color, theme: o.theme, desc: o.desc
  };
  // reuse the main constructor via a creature generator record
  D.makeCreatureRaw(id, def);
}
G.PF.D.tc = TC;
// wrap the private C() through makeCreature's path: we re-register by cloning an existing record's shape
D.makeCreatureRaw = function (id, def) {
  const ATTRS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const o = Object.assign({}, def); o.id = id; o.traits = (o.traits || '').split(' ').filter(Boolean);
  const av = (o.attrs || '0 0 0 0 0 0').split(' ').map(Number); o.attr = {}; ATTRS.forEach((k, i) => { o.attr[k] = av[i] || 0; });
  o.strikes = o.strikes.map(s => {
    const [name, k, bonus, dmg, dt, traits, ex] = s; const e = ex || {};
    const parts = [U.dice(dmg, PF.DT[dt] || dt)];
    if (e.plus) e.plus.split(',').forEach(p => { const m = p.trim().match(/^(\S+)\s+(\w+)$/); if (m) parts.push(U.dice(m[1], m[2])); });
    const tr = (traits || '').split(' ').filter(Boolean);
    return { name, kind: k === 'r' ? 'ranged' : 'melee', bonus, dmg: parts, traits: tr, range: e.range || 0, reach: e.reach || (k === 'm' ? (o.size === 'huge' ? 15 : o.size === 'large' ? 10 : 5) : 0), w: !!e.w, eff: e.eff || [], reload: 0, qty: e.qty || null, agile: tr.includes('agile') };
  });
  o.resist = o.resist || {}; o.weak = o.weak || {}; o.immune = (o.immune || '').split(' ').filter(Boolean);
  o.abil = o.abil || []; o.speed = typeof o.speed === 'object' ? o.speed : { land: o.speed || 25 };
  D.creatures[id] = o; return o;
};
Object.assign(D.abilities, {
  breathChimera: { kind: 'act', act: 'breath', name: 'Breath Weapon', area: { t: 'cone', r: 30 }, dmg: '9d6', type: 'fire', dc: 26 },
  breathAdultRed: { kind: 'act', act: 'breath', name: 'Breath Weapon', area: { t: 'cone', r: 60 }, dmg: '15d6', type: 'fire', dc: 34 },
  frightful32: { kind: 'aura', name: 'Frightful Presence (90 ft, DC 32)', r: 90, dc: 32, fear: true },
  frightful30: { kind: 'aura', name: 'Frightful Presence (60 ft, DC 30)', r: 60, dc: 30, fear: true },
  hydraHeads: { kind: 'act', act: 'frenzy', name: 'Hydra Heads (three jaws)', seq: ['Jaws', 'Jaws', 'Jaws'] },
  chimeraFrenzy: { kind: 'act', act: 'frenzy', name: 'Three Heads', seq: ['Claw', 'Horns', 'Jaws'] },
  bladeStorm: { kind: 'act', act: 'frenzy', name: 'Blade Storm (three blades)', seq: ['Longsword', 'Longsword', 'Longsword'] },
  draconicFrenzyA: { kind: 'act', act: 'frenzy', name: 'Draconic Frenzy', seq: ['Claw', 'Claw', 'Tail'] },
  regen10: { kind: 'regen', v: 10, off: ['acid', 'fire'], name: 'Regeneration 10 (acid, fire)' },
  flameAura: { kind: 'aura', name: 'Aura of Flames (10 ft, 4d6 fire, DC 42)', r: 10, dc: 42, dmg: '4d6', type: 'fire', every: true },
  coldAura: { kind: 'aura', name: 'Winter Aura (10 ft, 2d6 cold, DC 27)', r: 10, dc: 27, dmg: '2d6', type: 'cold', every: true },
  wideSwingG: { kind: 'act', act: 'swipe', name: 'Wide Swing' }
});
TC('wyvern', { name: 'Wyvern', lvl: 6, traits: 'dragon', ac: 'high', hp: 'mod', fort: 'high', ref: 'mod', will: 'low', per: 'mod', speed: { land: 20, fly: 60 }, attrs: '5 2 4 -3 2 -1',
  strikes: [['Jaws', 'm', 'high', 'high', 'P', ''], ['Stinger', 'm', 'high', 'low', 'P', 'agile', { eff: ['poison:24:3d6'] }]], shape: 'dragon', color: '#6a7a3a', theme: ['dragon', 'beast'], desc: 'A venomous winged drake that swoops and stings.' });
TC('wraith', { name: 'Wraith', lvl: 6, size: 'medium', traits: 'undead wraith incorporeal', ac: 'mod', hp: 'low', fort: 'low', ref: 'high', will: 'high', per: 'high', speed: { land: 0, fly: 40 }, attrs: '-5 4 0 1 2 4',
  strikes: [['Spectral Hand', 'm', 'high', '2d6+9', 'void', 'agile finesse', { eff: ['drained:24'] }]], resist: { physical: 5, all: 5 }, weak: { vitality: 10 }, immune: UNDEAD, shape: 'caster', color: '#2a2f3a', theme: ['undead'], desc: 'An incorporeal hunter that drains life. Resists everything but vitality.' });
TC('hydra', { name: 'Hydra', lvl: 6, size: 'large', traits: 'beast', ac: 'low', hp: 'high', fort: 'high', ref: 'mod', will: 'low', per: 'high', speed: 25, attrs: '6 3 5 -3 2 -2',
  strikes: [['Jaws', 'm', 'high', 'mod', 'P', '', { reach: 10 }]], abil: ['hydraHeads', 'regen10'], weak: { fire: 5 }, shape: 'beast', color: '#3e6a5a', theme: ['beast'], desc: 'Many-headed. Regenerates unless burned or melted.' });
TC('chimera', { name: 'Chimera', lvl: 8, traits: 'beast', ac: 'high', hp: 'mod', fort: 'high', ref: 'mod', will: 'low', per: 'mod', speed: { land: 25, fly: 50 }, attrs: '6 3 5 -3 2 0',
  strikes: [['Jaws', 'm', 'high', 'high', 'P', '', { plus: '2d6 fire' }], ['Horns', 'm', 'high', 'mod', 'P', ''], ['Claw', 'm', 'high', 'mod', 'S', 'agile']], abil: ['chimeraFrenzy', 'breathChimera'], shape: 'dragon', color: '#9a6a3a', theme: ['beast', 'dragon'], desc: 'Lion, goat and dragon in one, with a fiery breath.' });
TC('frostGiant', { name: 'Frost Giant', lvl: 9, traits: 'giant humanoid cold', ac: 'mod', hp: 'high', fort: 'high', ref: 'low', will: 'mod', per: 'mod', speed: 35, attrs: '7 0 5 0 2 0',
  strikes: [['Greataxe', 'm', 'high', 'ext', 'S', 'sweep', { w: 1 }], ['Rock', 'r', 'mod', 'mod', 'B', '', { range: 120 }]], immune: 'cold', weak: { fire: 10 }, abil: ['reactiveStrike', 'coldAura'], shape: 'giant', color: '#9ab3c6', theme: ['giant'], desc: 'Swings a greataxe through a numbing aura of cold.' });
TC('fireGiant', { name: 'Fire Giant', lvl: 10, traits: 'giant humanoid fire', ac: 'high', hp: 'mod', fort: 'high', ref: 'low', will: 'mod', per: 'mod', speed: 35, attrs: '7 0 5 1 2 1',
  strikes: [['Greatsword', 'm', 'high', 'high', 'S', 'versatile-P', { w: 1, plus: '2d6 fire' }], ['Rock', 'r', 'mod', 'mod', 'B', '', { range: 120, plus: '1d6 fire' }]], immune: 'fire', weak: { cold: 10 }, abil: ['reactiveStrike', 'wideSwingG'], shape: 'giant', color: '#a2482a', theme: ['giant', 'fire'], desc: 'A disciplined warrior wreathed in forge heat.' });
TC('stoneGolem', { name: 'Stone Golem', lvl: 11, traits: 'construct golem mindless', ac: 'high', hp: 'mod', fort: 'high', ref: 'low', will: 'low', per: 'low', speed: 20, attrs: '7 -1 5 -5 0 -5',
  strikes: [['Fist', 'm', 'high', 'high', 'B', '', { eff: ['knockdown'] }]], resist: { physical: 10 }, immune: 'bleed death disease fear mental paralyzed poison sleep unconscious', abil: ['wideSwingG'], shape: 'giant', color: '#8c867a', theme: ['construct', 'ruins'], desc: 'Slow, relentless and nearly impervious to weapons.' });
TC('lich', { name: 'Lich', lvl: 12, size: 'medium', traits: 'undead lich', ac: 'mod', hp: 'low', fort: 'low', ref: 'mod', will: 'high', per: 'high', speed: 25, attrs: '0 3 0 6 3 3',
  strikes: [['Hand', 'm', 'mod', 'mod', 'cold', 'agile finesse', { eff: ['paralysis32'] }]], resist: { cold: 10, physical: 5 }, weak: { vitality: 10 }, immune: UNDEAD, abil: ['frightful30'],
  spells: { trad: 'arcane', dc: 32, atk: 24, list: [{ id: 'chainLightning', rank: 6, uses: 1 }, { id: 'fireball', rank: 6, uses: 2 }, { id: 'slow', rank: 6, uses: 1 }, { id: 'paralyze', rank: 6, uses: 1 }], cantrips: ['electricArc', 'telekineticProjectile'] },
  shape: 'caster', color: '#4a3b5a', theme: ['undead', 'cult'], desc: 'An undead archmage: chain lightning, fireballs and a paralyzing touch.' });
TC('stormGiant', { name: 'Storm Giant', lvl: 13, size: 'huge', traits: 'giant humanoid electricity', ac: 'mod', hp: 'high', fort: 'high', ref: 'mod', will: 'mod', per: 'mod', speed: { land: 35 }, attrs: '8 2 5 2 4 3',
  strikes: [['Greatsword', 'm', 'high', 'high', 'S', 'versatile-P', { w: 1, plus: '1d12 electricity' }], ['Longbow', 'r', 'mod', 'mod', 'P', 'deadly-d10', { range: 150 }]], immune: 'electricity', abil: ['reactiveStrike', 'wideSwingG'],
  spells: { trad: 'primal', dc: 33, atk: 25, list: [{ id: 'lightningBolt', rank: 7, uses: 2 }], cantrips: ['electricArc'] }, shape: 'giant', color: '#5a7aa0', theme: ['giant'], desc: 'Calls lightning and swings a sword the size of a door.' });
TC('adultRedDragon', { name: 'Adult Red Dragon', lvl: 14, size: 'huge', traits: 'dragon fire', ac: 'high', hp: 'high', fort: 'high', ref: 'mod', will: 'mod', per: 'mod', speed: { land: 50, fly: 150 }, attrs: '8 3 6 3 4 5',
  strikes: [['Jaws', 'm', 'high', 'high', 'P', '', { plus: '3d6 fire' }], ['Claw', 'm', 'high', 'mod', 'S', 'agile'], ['Tail', 'm', 'mod', 'mod', 'B', '', { reach: 20 }]], immune: 'fire paralyzed sleep', weak: { cold: 15 }, abil: ['breathAdultRed', 'frightful32', 'draconicFrenzyA'],
  shape: 'dragon', color: '#b2301c', theme: ['dragon', 'fire'], desc: 'Fifteen dice of fire, a 90-foot frightful presence and a frenzy of claws.' });
TC('marilith', { name: 'Marilith', lvl: 17, traits: 'fiend demon', ac: 'high', hp: 'mod', fort: 'high', ref: 'high', will: 'mod', per: 'high', speed: 40, attrs: '7 6 5 3 4 6',
  strikes: [['Longsword', 'm', 'high', 'mod', 'S', 'versatile-P', { w: 1 }], ['Tail', 'm', 'high', 'mod', 'B', '', { eff: ['grab'] }]], resist: { physical: 10 }, abil: ['bladeStorm', 'reactiveStrike'], shape: 'winged', color: '#6a2a3a', theme: ['fiend'], desc: 'Six arms, six blades, and a crushing coil.' });
TC('balor', { name: 'Balor', lvl: 20, size: 'huge', traits: 'fiend demon fire', ac: 'high', hp: 'high', fort: 'high', ref: 'mod', will: 'high', per: 'high', speed: { land: 40, fly: 60 }, attrs: '9 4 7 3 5 7',
  strikes: [['Longsword', 'm', 'high', 'high', 'S', 'versatile-P', { w: 1, plus: '3d6 fire' }], ['Whip', 'm', 'high', 'low', 'S', 'disarm', { reach: 30, eff: ['grab'] }]], immune: 'fire', resist: { physical: 15 }, abil: ['flameAura', 'reactiveStrike', 'frightful32'],
  shape: 'winged', color: '#7a1a10', theme: ['fiend', 'fire'], desc: 'A towering demon of flame and shadow. The final exam.' });
D.presets.push(
  { id: 'wyvernNest', name: 'Wyvern Nest', pl: 5, map: 'tower', foes: ['wyvern', 'koboldScout', 'koboldScout'], desc: 'A venomous wyvern dives from the tower while kobold scouts snipe.' },
  { id: 'hydraFord', name: 'Hydra at the Ford', pl: 6, map: 'river', foes: ['hydra', 'hydra'], desc: 'Two hydras in the shallows. Bring fire.' },
  { id: 'frostGiant', name: 'Frost Giant Raid', pl: 8, map: 'market', foes: ['frostGiant', 'wyvern'], desc: 'A frost giant and its wyvern mount tear through the market.' },
  { id: 'lichCrypt', name: "The Lich's Crypt", pl: 11, map: 'crypt', foes: ['lich', 'stoneGolem'], desc: 'A lich behind its golem guardian. Spread out for the fireballs.' },
  { id: 'adultRed', name: 'Adult Red Dragon', pl: 12, map: 'lava', foes: ['adultRedDragon', 'fireGiant', 'fireGiant'], desc: 'A dragon and its fire giant vassals. Severe.' },
  { id: 'balor', name: 'Balor', pl: 18, map: 'lava', foes: ['balor'], desc: 'Solo extreme encounter for a high-level party.' }
);
})(typeof window !== 'undefined' ? window : globalThis);
/* ---------- Monster Core support: registration, unit wiring, stat-block ability list ---------- */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D, U = PF.U;
const COSTG = { '1': '◆', '2': '◆◆', '3': '◆◆◆', reaction: '⟲', free: '◇', passive: '' };
// register generated Monster Core records (data_mc.js). Colliding hand-built ids are replaced.
D.registerMC = function (list) {
  list.forEach(c => {
    c.mc = true; c.abil = []; c.immune = c.immune || []; c.resist = c.resist || {}; c.weak = c.weak || {}; c.skills = c.skills || {};
    (c.abilities || []).forEach(a => { const k = 'mc:' + c.id + ':' + a.id; D.abilities[k] = { kind: 'mc', name: a.name + (COSTG[a.cost] ? ' ' + COSTG[a.cost] : '') + (a.auto ? '' : ' (text)'), dc: a.spec && (a.spec.dc || (a.spec.aura && a.spec.aura.dc)) || undefined }; c.abil.push(k); });
    // compact summary in the legacy shape the stat block reads (x.spells.list / cantrips)
    if (c.casting && c.casting.length) {
      const e0 = c.casting[0]; const list2 = []; const cants = [];
      c.casting.forEach(e => {
        (e.cantrips || []).forEach(id => { if (D.spells[id] && !cants.includes(id)) cants.push(id); });
        (e.prepared || []).forEach(p => { if (D.spells[p.id]) list2.push({ id: p.id, rank: p.rank, uses: 1 }); });
        (e.rep || []).forEach(p => { if (D.spells[p.id]) list2.push({ id: p.id, rank: p.rank, uses: (e.slots && e.slots[p.rank]) || 1 }); });
        (e.innate || []).forEach(p => { if (D.spells[p.id]) list2.push({ id: p.id, rank: p.rank, uses: p.uses > 50 ? '∞' : p.uses }); });
        (e.focus || []).forEach(id => { if (D.spells[id]) list2.push({ id, rank: e.focusRank || 1, uses: 'focus' }); });
      });
      c.spells = { trad: e0.trad, dc: e0.dc, atk: e0.atk, list: list2, cantrips: cants };
    }
    D.creatures[c.id] = c;
  });
  if (D.setupMCPresets) D.setupMCPresets();
};
// abilities for stat-block UIs: [{name, cost, traits, text, auto}]
D.creatureAbilities = function (c) {
  if (!c) return [];
  if (c.abilities) return c.abilities.map(a => ({ name: a.name, cost: a.cost, traits: (a.traits || []).slice(), text: a.text, auto: !!a.auto, kind: a.spec ? a.spec.kind : null }));
  return (c.abil || []).map(id => D.abilities[id]).filter(Boolean).map(a => ({ name: a.name, cost: a.kind === 'act' ? '2' : 'passive', traits: [], text: a.name, auto: true, kind: a.kind }));
};
const adj0 = D.adjustCreature;
D.adjustCreature = function (c, adj) {
  const x = adj0(c, adj);
  if (adj && x.casting) { const s = adj === 'elite' ? 2 : -2; x.casting.forEach(e => { e.dc += s; e.atk += s; }); }
  return x;
};
const uf0 = D.unitFromCreature;
D.unitFromCreature = function (c0, adj) {
  if (!c0.mc) return uf0(c0, adj);
  const c = D.adjustCreature(c0, adj);
  // build the base unit without the legacy innate-spell path, then layer Monster Core features on
  const u = uf0(Object.assign({}, c0, { spells: null, casting: null }), adj);
  D.applyMC(u, c);
  return u;
};
D.applyMC = function (u, c) {
  u.mc = true; u.resistX = U.clone(c.resistX || {}); u.saveMods = U.clone(c.saveMods || []); u.aquatic = !!c.aquatic;
  u.mAbil = []; u.affSpecs = {}; u.riders = {}; u.reacts = []; u.auras = u.auras || []; u.mFollow = [];
  (c.abilities || []).forEach(a => {
    if (!a.auto || !a.spec) return;
    const s = U.clone(a.spec);
    switch (s.kind) {
      case 'flag': u.flags[s.flag] = true; if (s.dice) u.flags.mSneakDice = s.dice; if (s.n) { u.flags.packN = s.n; u.flags.packD = s.d; } if (s.rsOnly) u.rsOnly = s.rsOnly; if (s.rsMoveOnly) u.rsMoveOnly = true; break;
      case 'regen': u.regen = { v: s.v, off: s.off || [], disabled: false }; break;
      case 'fastHeal': u.fastHeal = s.v; break;
      case 'aura': u.auras.push(Object.assign({ id: a.id, name: a.name }, s.aura)); break;
      case 'follow': u.mFollow.push(s.follow); break;
      case 'affliction': u.affSpecs[a.id] = Object.assign({ id: 'aff:' + a.name.toLowerCase(), name: a.name }, s.aff); break;
      case 'rider': u.riders[a.id] = Object.assign({ name: a.name }, s.rider); break;
      case 'react': u.reacts.push({ name: a.name, trig: s.trig, eff: s.eff }); break;
      case 'area': case 'save': case 'multi': case 'constrict': case 'swallow': case 'trample': case 'rend':
        u.mAbil.push(Object.assign({ key: a.id, name: a.name, cost: s.cost || (+a.cost || 1), text: a.text }, s)); break;
      default: break;
    }
  });
  if (u.flags.zombieSlow) { u.flags.noReactions = true; }
  if (c.casting && c.casting.length) {
    const es = c.casting.map(e => ({ name: e.name, kind: e.kind, trad: e.trad, dc: e.dc, atk: e.atk, cantripRank: e.cantripRank, cantrips: (e.cantrips || []).slice(),
      prepared: (e.prepared || []).map(p => ({ id: p.id, rank: p.rank, used: false })),
      slots: e.slots ? Object.fromEntries(Object.entries(e.slots).map(([r, m]) => [r, { max: m, used: 0 }])) : null,
      rep: (e.rep || []).slice(), sig: (e.sig || []).slice(),
      innate: (e.innate || []).map(p => ({ id: p.id, rank: p.rank, uses: p.uses, used: 0 })), focus: (e.focus || []).slice(), focusRank: e.focusRank }));
    const e0 = es[0];
    u.spells = { trad: e0.trad, kind: 'mc', dc: e0.dc, atk: e0.atk, cantripRank: e0.cantripRank, cantrips: [], innate: [], prepared: [], comps: [], entries: es };
    u.st.spellDC = e0.dc; u.st.spellAtk = e0.atk;
    if (es.some(e => e.focus && e.focus.length)) u.focus = { cur: c.focusPoints || 1, max: c.focusPoints || 1, spells: [] };
  }
};
})(typeof window !== 'undefined' ? window : globalThis);
/* ---------- map footprint checks, Monster Core presets, auto-encounters ---------- */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D, U = PF.U;
const fitCache = {};
// can a creature of footprint sq (squares) deploy in the foe zone of a map?
D.mapFits = function (mapId, sq, flies) {
  const k = mapId + ':' + sq + ':' + (flies ? 1 : 0);
  if (fitCache[k] != null) return fitCache[k];
  let ok = true;
  try {
    const B = PF.Battle({ map: mapId, partyLevel: 1, pcs: [], foes: [] });
    const u = { sq, speed: flies ? { land: 25, fly: 30 } : { land: 25 }, team: 'foe' };
    ok = B.zone.foe.some(([x, y]) => B.fits(u, x, y, true) && B.cellsOf(u, x, y).every(([cx, cy]) => B.zone.foe.some(([zx, zy]) => zx === cx && zy === cy)));
  } catch (e) { ok = true; }
  fitCache[k] = ok; return ok;
};
D.mapHasWater = mapId => { const m = D.maps[mapId]; return !!m && m.t.some(r => /[wW]/.test(r.replace(/\|/g, ''))) && mapId === 'river'; };
D.creatureFitsMap = (c, mapId) => {
  if (!mapId || !D.maps[mapId]) return !c.aquatic;
  if (c.aquatic && !D.mapHasWater(mapId)) return false;
  return D.mapFits(mapId, PF.SIZE[c.size].sq, !!(c.speed && c.speed.fly));
};
/* Prebuilt encounters with Monster Core creatures (ids = camelCase of the Foundry slug). */
D.setupMCPresets = function () { D.presets = [
  { id: 'goblinAmbush', name: 'Goblin Ambush', pl: 1, map: 'chapel', foes: ['goblinWarrior', 'goblinWarrior', 'goblinPyro'], desc: 'Goblins loot the ruined chapel; the pyro lobs fire from behind the pews.' },
  { id: 'restlessDead', name: 'Restless Dead', pl: 1, map: 'crypt', foes: ['skeletonGuard', 'skeletonGuard', 'zombieShambler', 'zombieShambler'], desc: 'Bones and shamblers rise from the tombs. Blunt weapons and vitality help.' },
  { id: 'wolfPack', name: 'Wolf Pack', pl: 1, map: 'forest', foes: ['wolf', 'wolf'], desc: 'Two wolves that knock prey down and gang up on it.' },
  { id: 'koboldTunnels', name: 'Kobold Tunnels', pl: 1, map: 'warrens', foes: ['koboldWarrior', 'koboldWarrior', 'koboldScout'], desc: 'Spears at the bridge, a sniper behind them.' },
  { id: 'sewerTrouble', name: 'Sewer Trouble', pl: 2, map: 'market', foes: ['ratSwarm', 'sewerOoze', 'giantRat'], desc: 'Vermin boil up from the drains under the market. Spread out against the swarm.' },
  { id: 'boggardBog', name: 'Boggard Ford', pl: 2, map: 'river', foes: ['boggardWarrior', 'boggardScout', 'giantRat'], desc: 'Frog-folk hold the ford and croak terror at intruders.' },
  { id: 'orcWarband', name: 'Orc Warband', pl: 3, map: 'market', foes: ['orcCommander', 'orcVeteran', 'orcVeteran'], desc: 'A commander and two veterans storm the square.' },
  { id: 'ghoulCrypt', name: 'Ghoul Crypt', pl: 3, map: 'crypt', foes: ['ghoulSoldier', 'ghoulSoldier', 'ghoulStalker'], desc: 'Paralyzing claws and a sickening stench in the mist.' },
  { id: 'hellHounds', name: 'Hell Hounds', pl: 3, map: 'lava', foes: ['hellHound', 'hellHound'], desc: 'Fire-breathing hounds on volcanic ground.' },
  { id: 'ogreBridge', name: "Ogre's Bridge", pl: 3, map: 'warrens', foes: ['ogreWarrior', 'goblinCommando', 'goblinCommando'], desc: 'An ogre and its goblin lackeys guard the chasm crossing.' },
  { id: 'riverDrake', name: 'Drake at the Ford', pl: 4, map: 'river', foes: ['riverDrake', 'crocodile', 'crocodile'], desc: 'A venomous drake circles above while crocodiles lurk in the shallows.' },
  { id: 'gargoyleTower', name: 'Gargoyle Watch', pl: 4, map: 'tower', foes: ['gargoyle', 'gargoyle'], desc: 'Stone sentries swoop from the ruined tower.' },
  { id: 'werebeasts', name: 'Moonlit Hunt', pl: 5, map: 'forest', foes: ['werebear', 'werewolf', 'direWolf'], desc: 'Shapechangers and their wolf hunt in the clearing.' },
  { id: 'trollBridge', name: 'Forest Troll', pl: 5, map: 'warrens', foes: ['forestTroll', 'witchwarg'], desc: 'A regenerating troll with a witchwarg companion. Bring fire or acid.' },
  { id: 'wyvernNest', name: 'Wyvern Nest', pl: 6, map: 'tower', foes: ['wyvern', 'giantEagle', 'giantEagle'], desc: 'A venomous wyvern dives from the tower while eagles harry the flanks.' },
  { id: 'hydraSwamp', name: 'Hydra and Drake', pl: 6, map: 'river', foes: ['hydra', 'jungleDrake'], desc: 'A many-headed hydra blocks the ford; a jungle drake spits venom from above.' },
  { id: 'medusaLair', name: "Medusa's Garden", pl: 7, map: 'chapel', foes: ['medusa', 'giantAnimatedStatue', 'basilisk'], desc: 'Statues everywhere — some of them still move.' },
  { id: 'chimeraRift', name: 'Chimera Rift', pl: 8, map: 'lava', foes: ['chimera', 'desertDrake'], desc: 'Three heads, two breath weapons and nowhere cool to stand.' },
  { id: 'frostGiant', name: 'Frost Giant Raid', pl: 9, map: 'market', foes: ['frostGiant', 'frostDrake', 'frostDrake'], desc: 'A frost giant and its drakes tear through the market.' },
  { id: 'youngDiabolic', name: 'Young Diabolic Dragon', pl: 10, map: 'lava', foes: ['diabolicDragonYoung', 'greaterHellHound'], desc: 'Hellfire breath, frightful presence and a hound from the pit.' },
  { id: 'lichCrypt', name: "The Lich's Crypt", pl: 12, map: 'crypt', foes: ['lich', 'graveknight', 'ghostMage'], desc: 'An undead archmage and its bodyguards. Spread out against the spells.' },
  { id: 'oniRaid', name: 'Shadow and Snow', pl: 13, map: 'market', foes: ['shadowGiant', 'snowOni'], desc: 'A shadow giant and a snow oni descend on the town.' },
  { id: 'fortuneDragon', name: 'Fortune and Fate', pl: 14, map: 'tower', foes: ['fortuneDragonAdult', 'gylou'], desc: 'An adult fortune dragon with a devil ally atop the watchtower.' },
  { id: 'ancientDiabolic', name: 'Ancient Diabolic Dragon', pl: 19, map: 'lava', foes: ['diabolicDragonAncient', 'astradaemon'], desc: 'A gargantuan dragon of Hell and a soul-eating daemon. The final exam.' },
  { id: 'reaper', name: 'The Grim Reaper', pl: 20, map: 'crypt', foes: ['grimReaper', 'nessari'], desc: 'Death itself walks the crypt. Severe.' },
  { id: 'training', name: 'Training Dummies', pl: 1, map: 'yard', foes: ['zombieShambler', 'skeletonGuard'], desc: 'Two weak undead in an open yard: a clean test of the core math.' }
].filter(p => p.foes.every(id => D.creatures[id])); };
D.autoEncounter = function (pl, threat, size, theme, mapId) {
  if (!mapId && PF.App && PF.App.setup) mapId = PF.App.setup.map;
  const target = (PF.THREATS.find(t => t.id === threat) || PF.THREATS[2]);
  const budget = target.xp + target.adj * (size - 4);
  const pool = Object.values(D.creatures).filter(c => !c.generated && c.lvl >= pl - 4 && c.lvl <= pl + 3 && (!theme || theme === 'any' || (c.theme || []).includes(theme)) && D.creatureFitsMap(c, mapId) && !(c.mc && /spellcaster/i.test(c.id) && U.rand() < 0.5));
  const out = []; let xp = 0; let guard = 0;
  while (xp < budget - 5 && guard++ < 40) {
    const fits = pool.filter(c => xp + PF.creatureXP(c.lvl, pl) <= budget + 5 && PF.creatureXP(c.lvl, pl) > 0);
    if (!fits.length) break;
    const leaderOK = out.length === 0 ? fits.filter(c => c.lvl >= pl) : fits.filter(c => out.some(o => (D.creatures[o.id].theme || [])[0] === (c.theme || [])[0]) || U.rand() < 0.3);
    const c = U.pick(leaderOK.length ? leaderOK : fits);
    out.push({ id: c.id, adj: null }); xp += PF.creatureXP(c.lvl, pl);
    if (out.length >= 8) break;
  }
  if (!out.length || xp < budget * 0.6) {
    const flv = theme === 'undead' ? 'undead' : theme === 'beast' ? 'beast' : theme === 'fiend' ? 'fiend' : theme === 'elemental' ? 'elemental' : 'humanoid';
    while (xp < budget - 5 && out.length < 8) {
      const rem = budget - xp; const d = rem >= 120 ? 2 : rem >= 60 ? 0 : rem >= 30 ? -1 : -2;
      const role = U.pick(['brute', 'soldier', 'skirmisher', 'sniper', 'caster']);
      const c = D.makeCreature({ level: pl + d, role, flavor: flv });
      out.push({ id: c.id, adj: null }); xp += PF.creatureXP(c.lvl, pl);
    }
  }
  return out;
};
})(typeof window !== 'undefined' ? window : globalThis);
