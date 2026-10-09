/* data_rules.js — equipment, ancestries, heritages, backgrounds, general & skill feats */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D = PF.D || {};

/* ---------- weapons ---------- */
const W = (id, name, cat, kind, die, dt, hands, traits, group, range = 0, reload = 0) =>
  ({ id, name, cat, kind, die, dt, hands, traits: traits ? traits.split(' ') : [], group, range, reload });
D.weapons = {};
[
  W('fist', 'Fist', 'unarmed', 'm', 4, 'B', 0, 'agile finesse nonlethal unarmed', 'brawling'),
  W('club', 'Club', 'simple', 'm', 6, 'B', 1, 'thrown-10', 'club'),
  W('dagger', 'Dagger', 'simple', 'm', 4, 'P', 1, 'agile finesse thrown-10 versatile-S', 'knife'),
  W('lightmace', 'Light Mace', 'simple', 'm', 4, 'B', 1, 'agile finesse shove', 'club'),
  W('mace', 'Mace', 'simple', 'm', 6, 'B', 1, 'shove', 'club'),
  W('morningstar', 'Morningstar', 'simple', 'm', 6, 'B', 1, 'versatile-P', 'club'),
  W('sickle', 'Sickle', 'simple', 'm', 4, 'S', 1, 'agile finesse trip', 'knife'),
  W('spear', 'Spear', 'simple', 'm', 6, 'P', 1, 'thrown-20', 'spear'),
  W('staff', 'Staff', 'simple', 'm', 4, 'B', 1, 'two-hand-d8 monk', 'club'),
  W('longspear', 'Longspear', 'simple', 'm', 8, 'P', 2, 'reach', 'spear'),
  W('gauntlet', 'Gauntlet', 'simple', 'm', 4, 'B', 1, 'agile free-hand', 'brawling'),
  W('crossbow', 'Crossbow', 'simple', 'r', 8, 'P', 2, '', 'bow', 120, 1),
  W('hcrossbow', 'Heavy Crossbow', 'simple', 'r', 10, 'P', 2, '', 'bow', 120, 2),
  W('handxbow', 'Hand Crossbow', 'simple', 'r', 6, 'P', 1, '', 'bow', 60, 1),
  W('sling', 'Sling', 'simple', 'r', 6, 'B', 1, 'propulsive', 'sling', 50, 1),
  W('javelin', 'Javelin', 'simple', 'r', 6, 'P', 1, 'thrown', 'dart', 30),
  W('dart', 'Dart', 'simple', 'r', 4, 'P', 1, 'agile thrown', 'dart', 20),
  W('longsword', 'Longsword', 'martial', 'm', 8, 'S', 1, 'versatile-P', 'sword'),
  W('bastard', 'Bastard Sword', 'martial', 'm', 8, 'S', 1, 'two-hand-d12', 'sword'),
  W('greatsword', 'Greatsword', 'martial', 'm', 12, 'S', 2, 'versatile-P', 'sword'),
  W('shortsword', 'Shortsword', 'martial', 'm', 6, 'P', 1, 'agile finesse versatile-S', 'sword'),
  W('rapier', 'Rapier', 'martial', 'm', 6, 'P', 1, 'deadly-d8 disarm finesse', 'sword'),
  W('scimitar', 'Scimitar', 'martial', 'm', 6, 'S', 1, 'forceful sweep', 'sword'),
  W('battleaxe', 'Battle Axe', 'martial', 'm', 8, 'S', 1, 'sweep', 'axe'),
  W('greataxe', 'Greataxe', 'martial', 'm', 12, 'S', 2, 'sweep', 'axe'),
  W('warhammer', 'Warhammer', 'martial', 'm', 8, 'B', 1, 'shove', 'hammer'),
  W('maul', 'Maul', 'martial', 'm', 12, 'B', 2, 'shove', 'hammer'),
  W('greatclub', 'Greatclub', 'martial', 'm', 10, 'B', 2, 'backswing shove', 'club'),
  W('flail', 'Flail', 'martial', 'm', 6, 'B', 1, 'disarm sweep trip', 'flail'),
  W('warflail', 'War Flail', 'martial', 'm', 10, 'B', 2, 'disarm sweep trip', 'flail'),
  W('pick', 'Pick', 'martial', 'm', 6, 'P', 1, 'fatal-d10', 'pick'),
  W('glaive', 'Glaive', 'martial', 'm', 8, 'S', 2, 'deadly-d8 forceful reach', 'polearm'),
  W('halberd', 'Halberd', 'martial', 'm', 10, 'P', 2, 'reach versatile-S', 'polearm'),
  W('guisarme', 'Guisarme', 'martial', 'm', 10, 'S', 2, 'reach trip', 'polearm'),
  W('falchion', 'Falchion', 'martial', 'm', 10, 'S', 2, 'forceful sweep', 'sword'),
  W('trident', 'Trident', 'martial', 'm', 8, 'P', 1, 'thrown-20', 'spear'),
  W('whip', 'Whip', 'martial', 'm', 4, 'S', 1, 'disarm finesse nonlethal reach trip', 'flail'),
  W('kukri', 'Kukri', 'martial', 'm', 6, 'S', 1, 'agile finesse trip', 'knife'),
  W('dogslicer', 'Dogslicer', 'martial', 'm', 6, 'S', 1, 'agile backstabber finesse', 'sword'),
  W('horsechopper', 'Horsechopper', 'martial', 'm', 8, 'S', 2, 'reach trip versatile-P', 'polearm'),
  W('necksplitter', 'Orc Necksplitter', 'martial', 'm', 8, 'S', 1, 'forceful sweep', 'axe'),
  W('shortbow', 'Shortbow', 'martial', 'r', 6, 'P', 2, 'deadly-d10', 'bow', 60),
  W('cshortbow', 'Composite Shortbow', 'martial', 'r', 6, 'P', 2, 'deadly-d10 propulsive', 'bow', 60),
  W('longbow', 'Longbow', 'martial', 'r', 8, 'P', 2, 'deadly-d10 volley-30', 'bow', 100),
  W('clongbow', 'Composite Longbow', 'martial', 'r', 8, 'P', 2, 'deadly-d10 propulsive volley-30', 'bow', 100)
].forEach(w => { D.weapons[w.id] = w; });

D.ancWeapons = {
  elf: ['longbow', 'clongbow', 'longsword', 'rapier', 'shortbow', 'cshortbow'],
  dwarf: ['battleaxe', 'pick', 'warhammer'],
  gnome: ['glaive', 'kukri'],
  goblin: ['dogslicer', 'horsechopper'],
  halfling: ['sling', 'shortsword'],
  orc: ['falchion', 'greataxe', 'necksplitter']
};

/* ---------- armor & shields ---------- */
const A = (id, name, cat, ac, cap, check, speed, str) => ({ id, name, cat, ac, cap, check, speed, str });
D.armors = {};
[
  A('none', 'Unarmored', 'unarmored', 0, 99, 0, 0, 0),
  A('explorer', "Explorer's Clothing", 'unarmored', 0, 5, 0, 0, 0),
  A('padded', 'Padded Armor', 'light', 1, 3, 0, 0, 0),
  A('leather', 'Leather Armor', 'light', 1, 4, -1, 0, 0),
  A('studded', 'Studded Leather', 'light', 2, 3, -1, 0, 1),
  A('chainshirt', 'Chain Shirt', 'light', 2, 3, -1, 0, 1),
  A('hide', 'Hide Armor', 'medium', 3, 2, -2, -5, 2),
  A('scale', 'Scale Mail', 'medium', 3, 2, -2, -5, 2),
  A('chainmail', 'Chain Mail', 'medium', 4, 1, -2, -5, 3),
  A('breastplate', 'Breastplate', 'medium', 4, 1, -2, -5, 3),
  A('halfplate', 'Half Plate', 'heavy', 5, 1, -3, -10, 3),
  A('splint', 'Splint Mail', 'heavy', 5, 1, -3, -10, 3),
  A('fullplate', 'Full Plate', 'heavy', 6, 0, -3, -10, 4)
].forEach(a => { D.armors[a.id] = a; });

const S = (id, name, ac, hard, hp, bt, lvl, tower) => ({ id, name, ac, hard, hp, bt, lvl, tower: !!tower });
D.shields = {};
[
  S('buckler', 'Buckler', 1, 3, 6, 3, 0),
  S('wooden', 'Wooden Shield', 2, 3, 12, 6, 0),
  S('steel', 'Steel Shield', 2, 5, 20, 10, 0),
  S('tower', 'Tower Shield', 2, 5, 20, 10, 0, true),
  S('sturdy4', 'Sturdy Shield (Minor)', 2, 8, 64, 32, 4),
  S('sturdy7', 'Sturdy Shield (Lesser)', 2, 10, 80, 40, 7),
  S('sturdy10', 'Sturdy Shield (Moderate)', 2, 13, 104, 52, 10),
  S('sturdy13', 'Sturdy Shield (Greater)', 2, 15, 120, 60, 13),
  S('sturdy16', 'Sturdy Shield (Major)', 2, 17, 136, 68, 16),
  S('sturdy19', 'Sturdy Shield (Supreme)', 2, 20, 160, 80, 19)
].forEach(s => { D.shields[s.id] = s; });
D.shieldForLevel = (lvl, base) => {
  if (base === 'buckler' || base === 'tower' || base === 'wooden') return base;
  const t = [19, 16, 13, 10, 7, 4].find(l => lvl >= l);
  return t ? 'sturdy' + t : 'steel';
};

/* Standard fundamental runes by character level (matches GM Core treasure expectations) */
D.runesForLevel = L => ({
  pot: L >= 16 ? 3 : L >= 10 ? 2 : L >= 2 ? 1 : 0,
  str: L >= 19 ? 3 : L >= 12 ? 2 : L >= 4 ? 1 : 0,
  arm: L >= 18 ? 3 : L >= 11 ? 2 : L >= 5 ? 1 : 0,
  res: L >= 20 ? 3 : L >= 14 ? 2 : L >= 8 ? 1 : 0,
  prop: L >= 10 ? 1 : 0, // one energy property rune from level 10 (optional)
  potion: L >= 18 ? 'major' : L >= 12 ? 'greater' : L >= 6 ? 'moderate' : L >= 3 ? 'lesser' : 'minor'
});
D.potions = {
  minor: { name: 'Minor Healing Potion', dice: { n: 1, d: 8, m: 0 } },
  lesser: { name: 'Lesser Healing Potion', dice: { n: 2, d: 8, m: 5 } },
  moderate: { name: 'Moderate Healing Potion', dice: { n: 3, d: 8, m: 10 } },
  greater: { name: 'Greater Healing Potion', dice: { n: 6, d: 8, m: 20 } },
  major: { name: 'Major Healing Potion', dice: { n: 8, d: 8, m: 30 } }
};
D.propertyRunes = { flaming: 'fire', frost: 'cold', shock: 'electricity', corrosive: 'acid', thundering: 'sonic' };

/* ---------- ancestries ---------- */
D.ancestries = {
  human: { name: 'Human', hp: 8, size: 'medium', speed: 25, boosts: ['free', 'free'], flaws: [], vision: 'normal', traits: ['human', 'humanoid'] },
  elf: { name: 'Elf', hp: 6, size: 'medium', speed: 30, boosts: ['dex', 'int', 'free'], flaws: ['con'], vision: 'low-light', traits: ['elf', 'humanoid'] },
  dwarf: { name: 'Dwarf', hp: 10, size: 'medium', speed: 20, boosts: ['con', 'wis', 'free'], flaws: ['cha'], vision: 'darkvision', traits: ['dwarf', 'humanoid'] },
  gnome: { name: 'Gnome', hp: 8, size: 'small', speed: 25, boosts: ['con', 'cha', 'free'], flaws: ['str'], vision: 'low-light', traits: ['gnome', 'humanoid'] },
  goblin: { name: 'Goblin', hp: 6, size: 'small', speed: 25, boosts: ['dex', 'cha', 'free'], flaws: ['wis'], vision: 'darkvision', traits: ['goblin', 'humanoid'] },
  halfling: { name: 'Halfling', hp: 6, size: 'small', speed: 25, boosts: ['dex', 'wis', 'free'], flaws: ['str'], vision: 'normal', traits: ['halfling', 'humanoid'] },
  orc: { name: 'Orc', hp: 10, size: 'medium', speed: 25, boosts: ['str', 'free'], flaws: [], vision: 'darkvision', traits: ['orc', 'humanoid'] }
};
D.heritages = {
  versatileHuman: { anc: 'human', name: 'Versatile Human', desc: 'Gain a 1st-level general feat (Toughness or Fleet by default).', fx: { bonusGeneral: true } },
  skilledHuman: { anc: 'human', name: 'Skilled Human', desc: 'Trained in one extra skill; it becomes expert at 5th level.', fx: { bonusSkill: true } },
  cavernElf: { anc: 'elf', name: 'Cavern Elf', desc: 'Darkvision.', fx: {} },
  woodlandElf: { anc: 'elf', name: 'Woodland Elf', desc: 'Climb through foliage; Take Cover anywhere in forest terrain.', fx: { forestCover: true } },
  rockDwarf: { anc: 'dwarf', name: 'Rock Dwarf', desc: '+2 circumstance bonus to your DC against Shove and Trip.', fx: { rockDwarf: true } },
  strongBlooded: { anc: 'dwarf', name: 'Strong-Blooded Dwarf', desc: 'Poison resistance equal to half your level (min 1).', fx: { resist: { poison: 'half' } } },
  umbralGnome: { anc: 'gnome', name: 'Umbral Gnome', desc: 'Darkvision.', fx: {} },
  sensateGnome: { anc: 'gnome', name: 'Sensate Gnome', desc: '+2 circumstance bonus to Perception to locate undetected creatures within 30 feet.', fx: { seekBonus: 2 } },
  unbreakableGoblin: { anc: 'goblin', name: 'Unbreakable Goblin', desc: 'Ancestry Hit Points become 10; falling damage halved.', fx: { hp: 10, halfFall: true } },
  charhideGoblin: { anc: 'goblin', name: 'Charhide Goblin', desc: 'Fire resistance equal to half your level (min 1).', fx: { resist: { fire: 'half' } } },
  gutsyHalfling: { anc: 'halfling', name: 'Gutsy Halfling', desc: 'A success on a save against an emotion effect becomes a critical success.', fx: { gutsy: true } },
  nomadicHalfling: { anc: 'halfling', name: 'Nomadic Halfling', desc: 'Extra languages (no combat effect).', fx: {} },
  holdScarred: { anc: 'orc', name: 'Hold-Scarred Orc', desc: 'Ancestry Hit Points become 12; you gain Diehard.', fx: { hp: 12, diehard: true } },
  battleReady: { anc: 'orc', name: 'Battle-Ready Orc', desc: 'Trained in Intimidation; Intimidating Glare.', fx: { trainSkill: 'intimidation' } }
};

/* ---------- backgrounds ---------- */
D.backgrounds = {
  acolyte: { name: 'Acolyte', boosts: ['int', 'wis'], skill: 'religion' },
  acrobat: { name: 'Acrobat', boosts: ['str', 'dex'], skill: 'acrobatics' },
  bountyHunter: { name: 'Bounty Hunter', boosts: ['str', 'wis'], skill: 'survival' },
  criminal: { name: 'Criminal', boosts: ['dex', 'int'], skill: 'stealth' },
  emissary: { name: 'Emissary', boosts: ['int', 'cha'], skill: 'diplomacy' },
  entertainer: { name: 'Entertainer', boosts: ['dex', 'cha'], skill: 'performance' },
  farmhand: { name: 'Farmhand', boosts: ['con', 'wis'], skill: 'athletics' },
  fieldMedic: { name: 'Field Medic', boosts: ['con', 'wis'], skill: 'medicine', feat: 'battleMedicine' },
  gladiator: { name: 'Gladiator', boosts: ['str', 'cha'], skill: 'performance' },
  guard: { name: 'Guard', boosts: ['str', 'cha'], skill: 'intimidation' },
  herbalist: { name: 'Herbalist', boosts: ['con', 'wis'], skill: 'nature' },
  hunter: { name: 'Hunter', boosts: ['dex', 'wis'], skill: 'survival' },
  martialDisciple: { name: 'Martial Disciple', boosts: ['str', 'dex'], skill: 'acrobatics', feat: 'catFall' },
  scholar: { name: 'Scholar', boosts: ['int', 'wis'], skill: 'arcana' },
  tinker: { name: 'Tinker', boosts: ['dex', 'int'], skill: 'crafting' },
  warrior: { name: 'Warrior', boosts: ['str', 'con'], skill: 'intimidation', feat: 'intimidatingGlare' }
};

/* ---------- ancestry, general and skill feats ----------
   fx keys are read by the builder (static) or the engine (flags on the unit). */
D.feats = D.feats || {};
const F = (id, o) => { D.feats[id] = Object.assign({ id }, o); };
// ancestry feats
F('naturalAmbition', { type: 'ancestry', anc: 'human', lvl: 1, name: 'Natural Ambition', desc: 'Gain an extra 1st-level class feat.', fx: { bonusClassFeat: true } });
F('generalTraining', { type: 'ancestry', anc: 'human', lvl: 1, name: 'General Training', desc: 'Gain an extra 1st-level general feat.', fx: { bonusGeneral: true } });
F('nimbleElf', { type: 'ancestry', anc: 'elf', lvl: 1, name: 'Nimble Elf', desc: '+5 feet to your Speed.', fx: { speed: 5 } });
F('elvenWeaponFamiliarity', { type: 'ancestry', anc: 'elf', lvl: 1, name: 'Elven Weapon Familiarity', desc: 'Trained with longbows, shortbows, longswords and rapiers; elven martial weapons count as simple.', fx: { ancWeapons: 'elf' } });
F('elfStep', { type: 'ancestry', anc: 'elf', lvl: 9, name: 'Elf Step', desc: 'Step twice as a single action.', fx: { flag: 'elfStep' } });
F('dwarvenWeaponFamiliarity', { type: 'ancestry', anc: 'dwarf', lvl: 1, name: 'Dwarven Weapon Familiarity', desc: 'Trained with battle axes, picks and warhammers; dwarven martial weapons count as simple.', fx: { ancWeapons: 'dwarf' } });
F('unburdenedIron', { type: 'ancestry', anc: 'dwarf', lvl: 1, name: 'Unburdened Iron', desc: 'Ignore the Speed reduction from armor (reduce penalties by 5 feet).', fx: { flag: 'unburdenedIron' } });
F('gnomeWeaponFamiliarity', { type: 'ancestry', anc: 'gnome', lvl: 1, name: 'Gnome Weapon Familiarity', desc: 'Trained with glaives and kukris; gnome martial weapons count as simple.', fx: { ancWeapons: 'gnome' } });
F('goblinWeaponFamiliarity', { type: 'ancestry', anc: 'goblin', lvl: 1, name: 'Goblin Weapon Familiarity', desc: 'Trained with dogslicers and horsechoppers; goblin martial weapons count as simple.', fx: { ancWeapons: 'goblin' } });
F('burnIt', { type: 'ancestry', anc: 'goblin', lvl: 1, name: 'Burn It!', desc: 'Your fire spells deal extra damage equal to half the spell rank, and persistent fire you deal increases by 1.', fx: { flag: 'burnIt' } });
F('halflingLuck', { type: 'ancestry', anc: 'halfling', lvl: 1, name: 'Halfling Luck', desc: 'Once per day, reroll a failed saving throw (fortune).', fx: { flag: 'halflingLuck' } });
F('halflingWeaponFamiliarity', { type: 'ancestry', anc: 'halfling', lvl: 1, name: 'Halfling Weapon Familiarity', desc: 'Trained with slings and shortswords; halfling martial weapons count as simple.', fx: { ancWeapons: 'halfling' } });
F('orcFerocity', { type: 'ancestry', anc: 'orc', lvl: 1, name: 'Orc Ferocity', desc: 'Reaction: once per day when reduced to 0 HP, stay at 1 HP and increase wounded by 1.', fx: { flag: 'ferocity' } });
F('orcWeaponFamiliarity', { type: 'ancestry', anc: 'orc', lvl: 1, name: 'Orc Weapon Familiarity', desc: 'Trained with falchions, greataxes and orc necksplitters; orc martial weapons count as simple.', fx: { ancWeapons: 'orc' } });
['elf', 'dwarf', 'gnome', 'goblin', 'halfling', 'orc'].forEach(a => {
  const nm = { elf: 'Elven Weapon Elegance', dwarf: 'Dwarven Weapon Cunning', gnome: 'Gnome Weapon Innovator', goblin: 'Goblin Weapon Frenzy', halfling: 'Halfling Weapon Trickster', orc: 'Orc Weapon Carnage' }[a];
  F(a + 'WeaponCrit', { type: 'ancestry', anc: a, lvl: 5, name: nm, req: [a === 'elf' ? 'elvenWeaponFamiliarity' : a + 'WeaponFamiliarity'], desc: 'Critical specialization effects with your ancestral weapons.', fx: { critSpecAnc: a } });
});
F('incredibleFerocity', { type: 'ancestry', anc: 'orc', lvl: 13, name: 'Incredible Ferocity', req: ['orcFerocity'], desc: 'Orc Ferocity can be used once per encounter-hour (refreshes each battle here).', fx: { flag: 'incredibleFerocity' } });
// general feats
F('toughness', { type: 'general', lvl: 1, name: 'Toughness', desc: '+1 HP per level; recovery check DC reduced by 1.', fx: { hpPerLevel: 1, flag: 'toughness' } });
F('fleet', { type: 'general', lvl: 1, name: 'Fleet', desc: '+5 feet to your Speed.', fx: { speed: 5 } });
F('shieldBlockG', { type: 'general', lvl: 1, name: 'Shield Block', desc: 'Reaction: block damage with a raised shield.', fx: { flag: 'shieldBlock' } });
F('diehard', { type: 'general', lvl: 1, name: 'Diehard', desc: 'You die at dying 5 instead of dying 4.', fx: { flag: 'diehard' } });
F('incredibleInitiative', { type: 'general', lvl: 1, name: 'Incredible Initiative', desc: '+2 circumstance bonus to initiative rolls.', fx: { flag: 'incredibleInit' } });
F('cannyAcumen', { type: 'general', lvl: 1, name: 'Canny Acumen', desc: 'Become an expert in your weakest save or Perception (master at 17th).', fx: { cannyAcumen: true } });
F('armorProficiency', { type: 'general', lvl: 1, name: 'Armor Proficiency', desc: 'Become trained in the next armor category.', fx: { armorProf: true } });
// skill feats
F('battleMedicine', { type: 'skill', lvl: 1, skill: 'medicine', name: 'Battle Medicine', desc: '1 action: heal an adjacent creature with Medicine (once per day per target).', fx: { flag: 'battleMedicine' } });
F('catFall', { type: 'skill', lvl: 1, skill: 'acrobatics', name: 'Cat Fall', desc: 'Treat falls as shorter: 10 ft trained, 25 ft expert, 50 ft master.', fx: { flag: 'catFall' } });
F('intimidatingGlare', { type: 'skill', lvl: 1, skill: 'intimidation', name: 'Intimidating Glare', desc: 'Demoralize without the language penalty (visual).', fx: { flag: 'intimidatingGlare' } });
F('titanWrestler', { type: 'skill', lvl: 1, skill: 'athletics', name: 'Titan Wrestler', desc: 'Trip, Shove and Grapple creatures up to two sizes larger (three at legendary).', fx: { flag: 'titanWrestler' } });
F('bonMot', { type: 'skill', lvl: 1, skill: 'diplomacy', name: 'Bon Mot', desc: '1 action: Diplomacy vs Will DC; target takes -2 status to Perception and Will (-3 on crit) for 1 minute.', fx: { flag: 'bonMot' } });
F('kipUp', { type: 'skill', lvl: 7, skill: 'acrobatics', rank: 3, name: 'Kip Up', desc: 'Stand as a free action without triggering reactions.', fx: { flag: 'kipUp' } });
F('battleCry', { type: 'skill', lvl: 7, skill: 'intimidation', rank: 3, name: 'Battle Cry', desc: 'Demoralize an enemy as a free action when initiative is rolled.', fx: { flag: 'battleCry' } });
F('assuranceAthletics', { type: 'skill', lvl: 1, skill: 'athletics', name: 'Assurance (Athletics)', desc: 'Fortune: take 10 + proficiency bonus on Athletics instead of rolling (used when it beats your expected roll).', fx: { flag: 'assuranceAthletics' } });

})(typeof window !== 'undefined' ? window : globalThis);
