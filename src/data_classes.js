/* data_classes.js — class progressions (levels 1–20), features, class feats, iconic pregens */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D = PF.D || {};
D.feats = D.feats || {};
const F = (id, o) => { D.feats[id] = Object.assign({ id }, o); };

const MARTIAL_FEATS = [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
const CASTER_FEATS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
const P = (...pairs) => pairs; // [[level, rank], ...]

/* ---------- classes ---------- */
D.classes = {
  fighter: {
    name: 'Fighter', hp: 10, key: ['str', 'dex'], featLv: MARTIAL_FEATS, ws: [7, 15],
    prof: { per: P([1, 2], [7, 3]), fort: P([1, 2], [9, 3]), ref: P([1, 2], [15, 3]), will: P([1, 1], [3, 2]),
      simple: P([1, 2], [5, 3], [13, 4]), martial: P([1, 2], [5, 3], [13, 4]), advanced: P([1, 1], [5, 2], [13, 3]), unarmed: P([1, 2], [5, 3], [13, 4]),
      unarmored: P([1, 1], [11, 2], [17, 3]), light: P([1, 1], [11, 2], [17, 3]), medium: P([1, 1], [11, 2], [17, 3]), heavy: P([1, 1], [11, 2], [17, 3]), classDC: P([1, 1], [11, 2], [19, 3]) },
    skills: { fixed: [], pick: 3, pri: ['athletics', 'intimidation', 'acrobatics', 'medicine', 'survival', 'diplomacy', 'stealth'] },
    features: [[1, 'reactiveStrike'], [1, 'shieldBlock'], [3, 'bravery'], [5, 'fighterWeaponMastery'], [7, 'battlefieldSurveyor']],
    def: { weapon: 'longsword', ranged: 'javelin', armor: 'chainmail', shield: 'steel', attrs: ['str', 'con', 'dex', 'wis', 'int', 'cha'] },
    featPri: ['suddenCharge', 'reactiveShield', 'intimidatingStrike', 'knockdown', 'shatterDefenses', 'combatReflexes', 'certainStrike', 'exactingStrike', 'lunge', 'snaggingStrike', 'viciousSwing', 'furiousFocus', 'swipe', 'doubleSlice'],
    desc: 'Weapon masters with expert attacks from 1st level, Reactive Strike and Shield Block.'
  },
  rogue: {
    name: 'Rogue', hp: 8, key: ['dex', 'str', 'cha'], featLv: MARTIAL_FEATS, ws: [7, 15], skillFeatEvery: true, skillIncEvery: true,
    prof: { per: P([1, 2], [7, 3], [13, 4]), fort: P([1, 1], [9, 2]), ref: P([1, 2], [7, 3], [13, 4]), will: P([1, 2], [17, 3]),
      simple: P([1, 1], [5, 2], [13, 3]), martial: P([1, 1], [5, 2], [13, 3]), unarmed: P([1, 1], [5, 2], [13, 3]),
      unarmored: P([1, 1], [11, 2], [19, 3]), light: P([1, 1], [11, 2], [19, 3]), classDC: P([1, 1], [11, 2], [19, 3]) },
    martialFilter: w => w.traits.includes('agile') || w.traits.includes('finesse') || w.id === 'shortbow' || w.id === 'cshortbow',
    skills: { fixed: ['stealth'], pick: 7, pri: ['acrobatics', 'deception', 'thievery', 'athletics', 'intimidation', 'diplomacy', 'medicine', 'society', 'survival', 'perception', 'crafting'] },
    features: [[1, 'sneakAttack'], [1, 'surpriseAttack'], [3, 'denyAdvantage'], [5, 'weaponTricks'], [9, 'debilitatingStrikes']],
    sub: { label: 'Racket', opts: {
      thief: { name: 'Thief', desc: 'Add Dexterity instead of Strength to damage with finesse melee weapons.', skill: 'thievery', flag: 'thief' },
      ruffian: { name: 'Ruffian', desc: 'Sneak attack with any simple weapon; medium armor; critical specialization against off-guard foes.', skill: 'intimidation', flag: 'ruffian', key: 'str' },
      scoundrel: { name: 'Scoundrel', desc: 'Successful Feints leave the target off-guard until the end of your next turn.', skill: 'deception', flag: 'scoundrel', key: 'cha' }
    } },
    def: { weapon: 'rapier', ranged: 'shortbow', armor: 'leather', shield: null, attrs: ['dex', 'con', 'wis', 'cha', 'str', 'int'], sub: 'thief' },
    featPri: ['nimbleDodge', 'twinFeint', 'mobility', 'gangUp', 'opportuneBackstab', 'slyStriker', 'youreNext', 'skirmishStrike'],
    desc: 'Precise strikers who deal sneak attack damage to off-guard foes.'
  },
  ranger: {
    name: 'Ranger', hp: 10, key: ['dex', 'str'], featLv: MARTIAL_FEATS, ws: [7, 15],
    prof: { per: P([1, 2], [7, 3], [15, 4]), fort: P([1, 2], [11, 3]), ref: P([1, 2], [7, 3]), will: P([1, 1], [3, 2]),
      simple: P([1, 1], [5, 2], [13, 3]), martial: P([1, 1], [5, 2], [13, 3]), unarmed: P([1, 1], [5, 2], [13, 3]),
      unarmored: P([1, 1], [11, 2], [19, 3]), light: P([1, 1], [11, 2], [19, 3]), medium: P([1, 1], [11, 2], [19, 3]), classDC: P([1, 1], [9, 2], [17, 3]) },
    skills: { fixed: ['nature', 'survival'], pick: 4, pri: ['stealth', 'athletics', 'acrobatics', 'medicine', 'intimidation', 'crafting', 'diplomacy'] },
    features: [[1, 'huntPrey']],
    sub: { label: "Hunter's Edge", opts: {
      flurry: { name: 'Flurry', desc: 'Multiple attack penalty against your prey is −3/−6 (−2/−4 agile).', flag: 'edgeFlurry' },
      precision: { name: 'Precision', desc: 'First hit each round against your prey deals 1d8 extra precision damage (2d8 at 11th, 3d8 at 19th).', flag: 'edgePrecision' },
      outwit: { name: 'Outwit', desc: '+2 circumstance to Deception, Intimidation and Stealth against your prey, +1 circumstance to AC against its attacks.', flag: 'edgeOutwit' }
    } },
    def: { weapon: 'longbow', melee: 'shortsword', armor: 'leather', shield: null, attrs: ['dex', 'con', 'wis', 'str', 'int', 'cha'], sub: 'precision' },
    featPri: ['huntedShot', 'huntersAim', 'twinTakedown', 'runningReload', 'skirmishStrike', 'disruptPrey', 'crossbowAce'],
    desc: 'Hunters who mark prey with Hunt Prey and exploit it with their edge.'
  },
  barbarian: {
    name: 'Barbarian', hp: 12, key: ['str'], featLv: MARTIAL_FEATS, ws: [7, 15],
    prof: { per: P([1, 2], [17, 3]), fort: P([1, 2], [9, 3]), ref: P([1, 1], [7, 2]), will: P([1, 2], [15, 3]),
      simple: P([1, 1], [5, 2], [13, 3]), martial: P([1, 1], [5, 2], [13, 3]), unarmed: P([1, 1], [5, 2], [13, 3]),
      unarmored: P([1, 1], [13, 2], [19, 3]), light: P([1, 1], [13, 2], [19, 3]), medium: P([1, 1], [13, 2], [19, 3]), classDC: P([1, 1], [11, 2], [19, 3]) },
    skills: { fixed: ['athletics'], pick: 3, pri: ['intimidation', 'acrobatics', 'survival', 'nature', 'medicine', 'stealth'] },
    features: [[1, 'rage'], [3, 'denyAdvantage'], [5, 'brutality'], [9, 'ragingResistance']],
    sub: { label: 'Instinct', opts: {
      fury: { name: 'Fury', desc: 'Rage damage +2 (+6 at 7th, +12 at 15th) and an extra 1st-level class feat.', flag: 'fury' },
      giant: { name: 'Giant', desc: 'Wield an oversized weapon: Rage damage +6 (+10, +18) but clumsy 1 while raging.', flag: 'giant' },
      dragon: { name: 'Dragon', desc: 'Rage damage +4 (+8, +16); Dragon’s Rage Breath at 6th.', flag: 'dragon' },
      animal: { name: 'Animal', desc: 'Jaws unarmed attack (1d10 piercing) while raging; Rage damage +2 (+5, +12).', flag: 'animal' }
    } },
    def: { weapon: 'greataxe', ranged: 'javelin', armor: 'hide', shield: null, attrs: ['str', 'con', 'dex', 'wis', 'cha', 'int'], sub: 'fury' },
    featPri: ['suddenCharge', 'ragingIntimidation', 'furiousFinish', 'swipe', 'knockback', 'reactiveStrikeB', 'cleave', 'giantsStature', 'dragonsRageBreath', 'furiousBully', 'brutalBully', 'fastMovement'],
    desc: 'Furious warriors whose Rage adds damage and temporary Hit Points at the cost of AC.'
  },
  champion: {
    name: 'Champion', hp: 10, key: ['str', 'dex'], featLv: MARTIAL_FEATS, ws: [7, 15], spellKey: 'cha',
    prof: { per: P([1, 1], [11, 2]), fort: P([1, 2], [9, 3]), ref: P([1, 1], [9, 2]), will: P([1, 2], [11, 3]),
      simple: P([1, 1], [5, 2], [13, 3]), martial: P([1, 1], [5, 2], [13, 3]), unarmed: P([1, 1], [5, 2], [13, 3]),
      unarmored: P([1, 1], [7, 2], [13, 3], [17, 4]), light: P([1, 1], [7, 2], [13, 3], [17, 4]), medium: P([1, 1], [7, 2], [13, 3], [17, 4]), heavy: P([1, 1], [7, 2], [13, 3], [17, 4]),
      classDC: P([1, 1], [9, 2], [17, 3]), spell: P([1, 1], [9, 2], [17, 3]) },
    skills: { fixed: ['religion'], pick: 3, pri: ['athletics', 'diplomacy', 'medicine', 'intimidation', 'society'] },
    features: [[1, 'championReaction'], [1, 'shieldBlock'], [1, 'layOnHandsF'], [3, 'divineAlly']],
    sub: { label: 'Cause', opts: {
      justice: { name: 'Justice', desc: 'Retributive Strike: when a foe damages an ally near you, the ally gains resistance 2 + level and you Strike the foe if it’s in reach.', flag: 'causeJustice' },
      redemption: { name: 'Redemption', desc: 'Glimpse of Redemption: the ally gains resistance 2 + level and the foe is enfeebled 2 until the end of its turn.', flag: 'causeRedemption' },
      liberation: { name: 'Liberation', desc: 'Liberating Step: the ally gains resistance 2 + level and can Step.', flag: 'causeLiberation' }
    } },
    def: { weapon: 'longsword', ranged: 'javelin', armor: 'fullplate', shield: 'steel', attrs: ['str', 'cha', 'con', 'wis', 'dex', 'int'], sub: 'justice' },
    featPri: ['rangedReprisal', 'divineGrace', 'mercy', 'auraOfCourage', 'shieldWarden', 'reactiveStrikeC', 'quickShieldBlock'],
    desc: 'Divine defenders who protect allies with a champion’s reaction and Lay on Hands.'
  },
  monk: {
    name: 'Monk', hp: 10, key: ['str', 'dex'], featLv: MARTIAL_FEATS, ws: [7, 15], spellKey: 'wis',
    prof: { per: P([1, 1], [5, 2]), fort: P([1, 2]), ref: P([1, 2], [7, 3], [15, 4]), will: P([1, 2], [11, 3]),
      simple: P([1, 1], [5, 2], [13, 3]), unarmed: P([1, 1], [5, 2], [13, 3]), unarmored: P([1, 2], [13, 3], [17, 4]),
      classDC: P([1, 1], [9, 2], [17, 3]), spell: P([1, 1], [9, 2], [17, 3]) },
    skills: { fixed: [], pick: 4, pri: ['acrobatics', 'athletics', 'stealth', 'medicine', 'religion', 'intimidation'] },
    features: [[1, 'flurryOfBlows'], [1, 'powerfulFist'], [3, 'incredibleMovement'], [3, 'mysticStrikes'], [5, 'monkCritSpec']],
    def: { weapon: 'fist', ranged: null, armor: 'explorer', shield: null, attrs: ['str', 'dex', 'con', 'wis', 'int', 'cha'] },
    featPri: ['tigerStance', 'innerUpheaval', 'stunningBlows', 'flyingKick', 'tigerSlash', 'qiRush', 'mountainStance', 'wolfStance', 'craneStance', 'dragonStance'],
    desc: 'Unarmed martial artists: Flurry of Blows, high speed and stances.'
  },
  bard: {
    name: 'Bard', hp: 8, key: ['cha'], featLv: CASTER_FEATS, ws: [13],
    caster: { trad: 'occult', kind: 'spontaneous', slots: 'std', key: 'cha' },
    prof: { per: P([1, 2], [11, 3]), fort: P([1, 1], [9, 2]), ref: P([1, 1], [3, 2]), will: P([1, 2], [9, 3], [17, 4]),
      simple: P([1, 1], [11, 2]), martial: P([1, 1], [11, 2]), unarmed: P([1, 1], [11, 2]), unarmored: P([1, 1], [13, 2]), light: P([1, 1], [13, 2]),
      spell: P([1, 1], [7, 2], [15, 3], [19, 4]), classDC: P([1, 1], [7, 2], [15, 3], [19, 4]) },
    martialFilter: w => ['longsword', 'rapier', 'shortbow', 'cshortbow', 'shortsword', 'whip'].includes(w.id),
    skills: { fixed: ['occultism', 'performance'], pick: 4, pri: ['diplomacy', 'deception', 'acrobatics', 'intimidation', 'medicine', 'society', 'stealth'] },
    features: [[1, 'compositions'], [1, 'museMaestro']],
    def: { weapon: 'rapier', ranged: 'shortbow', armor: 'studded', shield: null, attrs: ['cha', 'dex', 'con', 'wis', 'int', 'str'] },
    featPri: ['rallyingAnthem', 'dirgeOfDoom', 'fortissimoComposition', 'steadySpellcasting'],
    spellPri: ['soothe', 'fear', 'command', 'dizzyingColors', 'sureStrike', 'laughingFit', 'noiseBlast', 'slow', 'haste', 'heroism', 'paralyze', 'blindness', 'shadowBlast', 'spiritBlast', 'enfeeble', 'phantomPain', 'blur'],
    cantripPri: ['daze', 'telekineticProjectile', 'needleDarts', 'shield', 'voidWarp'],
    desc: 'Occult spellcasters whose compositions bolster allies and hinder foes.'
  },
  cleric: {
    name: 'Cleric', hp: 8, key: ['wis'], featLv: CASTER_FEATS, ws: [13],
    caster: { trad: 'divine', kind: 'prepared', slots: 'std', key: 'wis', font: true },
    prof: { per: P([1, 1], [5, 2]), fort: P([1, 1], [9, 2]), ref: P([1, 1], [11, 2]), will: P([1, 2], [9, 3]),
      simple: P([1, 1], [11, 2]), martial: P([1, 1], [11, 2]), unarmed: P([1, 1], [11, 2]), unarmored: P([1, 1], [13, 2]), light: P([1, 1], [13, 2]),
      spell: P([1, 1], [7, 2], [15, 3], [19, 4]), classDC: P([1, 1], [7, 2], [15, 3], [19, 4]) },
    martialFilter: (w, b) => b && w.id === b.deityWeapon,
    skills: { fixed: ['religion'], pick: 2, pri: ['medicine', 'diplomacy', 'athletics', 'nature', 'occultism', 'society'] },
    features: [[1, 'divineFont']],
    sub: { label: 'Doctrine', opts: {
      warpriest: { name: 'Warpriest', desc: 'Trained in light and medium armor and your deity’s weapon; Shield Block; Fortitude expert at 3rd. Spellcasting advances more slowly.', flag: 'warpriest' },
      cloistered: { name: 'Cloistered Cleric', desc: 'Faster spellcasting proficiency and a domain spell (Fire Ray).', flag: 'cloistered' }
    } },
    def: { weapon: 'mace', ranged: 'sling', armor: 'leather', shield: null, attrs: ['wis', 'con', 'str', 'dex', 'cha', 'int'], sub: 'cloistered' },
    featPri: ['healingHands', 'communalHealing', 'domainInitiate', 'reachSpell', 'castDown', 'selectiveEnergy', 'steadySpellcasting'],
    spellPri: ['bless', 'fear', 'command', 'heroism', 'noiseBlast', 'blindness', 'divineWrath', 'spiritBlast', 'vampiricFeast', 'sunburst', 'enfeeble'],
    cantripPri: ['voidWarp', 'vitalityLash', 'daze', 'shield', 'stabilize'],
    desc: 'Divine casters with extra heal (or harm) spells from their divine font.'
  },
  wizard: {
    name: 'Wizard', hp: 6, key: ['int'], featLv: CASTER_FEATS, ws: [13],
    caster: { trad: 'arcane', kind: 'prepared', slots: 'std', key: 'int', curriculum: true },
    prof: { per: P([1, 1], [11, 2]), fort: P([1, 1], [9, 2]), ref: P([1, 1], [5, 2]), will: P([1, 2], [17, 3]),
      simple: P([1, 1], [11, 2]), unarmed: P([1, 1], [11, 2]), unarmored: P([1, 1], [13, 2]),
      spell: P([1, 1], [7, 2], [15, 3], [19, 4]), classDC: P([1, 1], [7, 2], [15, 3], [19, 4]) },
    skills: { fixed: ['arcana'], pick: 2, pri: ['occultism', 'society', 'medicine', 'religion', 'nature', 'crafting', 'diplomacy'] },
    features: [[1, 'battleMagic'], [1, 'drainBondedItem']],
    def: { weapon: 'staff', ranged: 'crossbow', armor: 'explorer', shield: null, attrs: ['int', 'dex', 'con', 'wis', 'cha', 'str'], mysticArmor: true },
    featPri: ['widenSpell', 'reachSpell', 'steadySpellcasting'],
    spellPri: ['fireball', 'lightningBolt', 'slow', 'haste', 'forceBarrage', 'breatheFire', 'sleep', 'fear', 'grease', 'thunderstrike', 'noiseBlast', 'laughingFit', 'blur', 'paralyze', 'dimensionDoor', 'howlingBlizzard', 'chainLightning', 'disintegrate', 'polarRay', 'hydraulicPush', 'enfeeble', 'dizzyingColors', 'gustOfWind', 'blindness'],
    cantripPri: ['electricArc', 'telekineticProjectile', 'ignition', 'shield', 'needleDarts', 'causticBlast'],
    desc: 'Prepared arcane casters with a wide spell selection and a battle-magic focus spell.'
  },
  sorcerer: {
    name: 'Sorcerer', hp: 6, key: ['cha'], featLv: CASTER_FEATS, ws: [13],
    caster: { trad: 'bloodline', kind: 'spontaneous', slots: 'sorc', key: 'cha' },
    prof: { per: P([1, 1], [11, 2]), fort: P([1, 1], [9, 2]), ref: P([1, 1], [5, 2]), will: P([1, 2], [17, 3]),
      simple: P([1, 1], [11, 2]), unarmed: P([1, 1], [11, 2]), unarmored: P([1, 1], [13, 2]),
      spell: P([1, 1], [7, 2], [15, 3], [19, 4]), classDC: P([1, 1], [7, 2], [15, 3], [19, 4]) },
    skills: { fixed: [], pick: 2, pri: ['intimidation', 'deception', 'diplomacy', 'arcana', 'nature', 'religion', 'medicine'] },
    features: [[1, 'bloodline']],
    sub: { label: 'Bloodline', opts: {
      elemental: { name: 'Elemental (fire)', trad: 'primal', desc: 'Primal spells; Elemental Toss focus spell; blood magic adds fire damage.', flag: 'bloodElemental', skills: ['intimidation', 'nature'], granted: ['breatheFire', 'fireball', 'howlingBlizzard'] },
      draconic: { name: 'Draconic', trad: 'arcane', desc: 'Arcane spells; Dragon Claws focus spell; blood magic grants +1 status AC.', flag: 'bloodDraconic', skills: ['arcana', 'intimidation'], granted: ['sureStrike', 'haste', 'chainLightning'] },
      angelic: { name: 'Angelic', trad: 'divine', desc: 'Divine spells including heal; Angelic Halo focus spell; blood magic grants +1 status to saves.', flag: 'bloodAngelic', skills: ['diplomacy', 'religion'], granted: ['heal', 'heroism', 'divineWrath'] }
    } },
    def: { weapon: 'staff', ranged: 'crossbow', armor: 'explorer', shield: null, attrs: ['cha', 'dex', 'con', 'wis', 'int', 'str'], sub: 'elemental', mysticArmor: true },
    featPri: ['widenSpell', 'dangerousSorcery', 'reachSpell', 'steadySpellcasting'],
    spellPri: ['fireball', 'lightningBolt', 'slow', 'haste', 'heal', 'forceBarrage', 'breatheFire', 'thunderstrike', 'fear', 'sleep', 'command', 'bless', 'heroism', 'noiseBlast', 'divineWrath', 'howlingBlizzard', 'chainLightning', 'spiritBlast', 'sunburst', 'disintegrate', 'polarRay', 'grease', 'hydraulicPush', 'blur', 'gustOfWind'],
    cantripPri: ['electricArc', 'ignition', 'causticBlast', 'telekineticProjectile', 'voidWarp', 'daze', 'shield', 'vitalityLash'],
    desc: 'Spontaneous casters with extra slots; their bloodline sets their tradition.'
  },
  druid: {
    name: 'Druid', hp: 8, key: ['wis'], featLv: CASTER_FEATS, ws: [13],
    caster: { trad: 'primal', kind: 'prepared', slots: 'std', key: 'wis' },
    prof: { per: P([1, 1], [3, 2]), fort: P([1, 1], [3, 2]), ref: P([1, 1], [5, 2]), will: P([1, 2], [11, 3]),
      simple: P([1, 1], [11, 2]), unarmed: P([1, 1], [11, 2]), unarmored: P([1, 1], [13, 2]), light: P([1, 1], [13, 2]), medium: P([1, 1], [13, 2]),
      spell: P([1, 1], [7, 2], [15, 3], [19, 4]), classDC: P([1, 1], [7, 2], [15, 3], [19, 4]) },
    skills: { fixed: ['nature', 'acrobatics'], pick: 2, pri: ['medicine', 'survival', 'athletics', 'intimidation', 'diplomacy', 'religion'] },
    features: [[1, 'stormOrder']],
    def: { weapon: 'sickle', ranged: 'sling', armor: 'leather', shield: null, attrs: ['wis', 'con', 'dex', 'str', 'int', 'cha'] },
    featPri: ['widenSpell', 'reachSpell', 'steadySpellcasting'],
    spellPri: ['heal', 'thunderstrike', 'slow', 'haste', 'fireball', 'lightningBolt', 'breatheFire', 'fear', 'hydraulicPush', 'gustOfWind', 'grease', 'howlingBlizzard', 'chainLightning', 'sunburst', 'polarRay', 'blindness', 'enfeeble'],
    cantripPri: ['electricArc', 'ignition', 'causticBlast', 'vitalityLash', 'stabilize'],
    desc: 'Primal casters of the storm order: Tempest Surge and nature’s fury.'
  }
};

/* ---------- class features (granted automatically) ---------- */
const FT = (id, name, desc, o = {}) => F(id, Object.assign({ type: 'feature', name, desc }, o));
FT('reactiveStrike', 'Reactive Strike', 'Reaction: Strike a creature in reach that uses a manipulate or move action, makes a ranged attack, or leaves a square. A critical hit disrupts a manipulate action.', { flag: 'reactiveStrike' });
FT('shieldBlock', 'Shield Block', 'Reaction: when you take physical damage with your shield raised, reduce it by the shield’s Hardness; you and the shield split the rest.', { flag: 'shieldBlock' });
FT('bravery', 'Bravery', 'Will successes against fear become critical successes; frightened values you gain are reduced by 1.', { flag: 'bravery' });
FT('fighterWeaponMastery', 'Fighter Weapon Mastery', 'Master proficiency and critical specialization effects with your weapons.', { flag: 'critSpec' });
FT('battlefieldSurveyor', 'Battlefield Surveyor', '+2 circumstance bonus to Perception for initiative.', { flag: 'surveyor' });
FT('sneakAttack', 'Sneak Attack', 'Deal 1d6 extra precision damage to off-guard creatures with agile, finesse or ranged weapons (2d6 at 5th, 3d6 at 11th, 4d6 at 17th).', { flag: 'sneakAttack' });
FT('surpriseAttack', 'Surprise Attack', 'In the first round, creatures that haven’t acted are off-guard to you if you rolled Stealth or Deception for initiative.', { flag: 'surpriseAttack' });
FT('denyAdvantage', 'Deny Advantage', 'You aren’t off-guard to flanking or hidden creatures of your level or lower.', { flag: 'denyAdvantage' });
FT('weaponTricks', 'Weapon Tricks', 'Critical specialization with agile and finesse weapons against off-guard targets.', { flag: 'weaponTricks' });
FT('debilitatingStrikes', 'Debilitating Strikes', 'When your sneak attack damages a creature, it’s also off-guard until the end of your next turn (free action).', { flag: 'debilitating' });
FT('huntPrey', 'Hunt Prey', '1 action: designate a prey; ignore the second range increment penalty against it and gain your hunter’s edge.', { act: 'huntPrey' });
FT('rage', 'Rage', '1 action: gain temporary HP (level + Con), +2 damage on melee Strikes (by instinct) and −1 AC; no concentrate actions except rage ones.', { act: 'rage' });
FT('brutality', 'Brutality', 'Critical specialization effects with melee weapons while raging.', { flag: 'brutality' });
FT('ragingResistance', 'Raging Resistance', 'While raging, resistance 3 + Con to damage types set by your instinct.', { flag: 'ragingResistance' });
FT('championReaction', "Champion's Reaction", 'Your cause grants a reaction that protects allies within 15 feet when a foe damages them.', { flag: 'championReaction' });
FT('layOnHandsF', 'Lay on Hands', 'Focus spell: 1 action, heal 6 HP per rank and grant +2 AC.', { focus: 'layOnHands' });
FT('divineAlly', 'Divine Ally (Shield)', 'Your shield gains +2 Hardness and 50% more Hit Points.', { flag: 'shieldAlly' });
FT('flurryOfBlows', 'Flurry of Blows', '1 action (flourish): make two unarmed Strikes.', { act: 'flurry' });
FT('powerfulFist', 'Powerful Fist', 'Your fists deal 1d6 damage.', { flag: 'powerfulFist' });
FT('incredibleMovement', 'Incredible Movement', '+10 feet Speed while unarmored (+15 at 7th, +20 at 11th, +25 at 15th, +30 at 19th).', { flag: 'incredibleMovement' });
FT('mysticStrikes', 'Mystic Strikes', 'Your unarmed attacks are magical.', {});
FT('monkCritSpec', 'Expert Strikes', 'Critical specialization effects with unarmed attacks.', { flag: 'critSpecUnarmed' });
FT('compositions', 'Compositions', 'Courageous Anthem composition cantrip (1 action): allies gain +1 to attacks, damage and fear saves.', { comp: 'courageousAnthem' });
FT('museMaestro', 'Muse: Maestro', 'Lingering Composition: spend a Focus Point and roll Performance to extend a composition to 3 or 4 rounds.', { flag: 'lingering', focusPool: 1 });
FT('divineFont', 'Divine Font', 'Extra heal spells at your highest rank (4, 5 at 5th, 6 at 15th).', { flag: 'divineFont' });
FT('battleMagic', 'Arcane School: Battle Magic', 'Force Bolt focus spell and an extra curriculum slot of each rank.', { focus: 'forceBolt' });
FT('drainBondedItem', 'Drain Bonded Item', 'Free action, once per battle: regain one spent spell slot.', { act: 'drainBonded' });
FT('bloodline', 'Bloodline', 'Your bloodline grants a tradition, a focus spell and blood magic.', { flag: 'bloodline' });
FT('stormOrder', 'Druidic Order: Storm', 'Tempest Surge focus spell.', { focus: 'tempestSurge' });

/* ---------- class feats ---------- */
const CF = (id, cls, lvl, name, desc, o = {}) => F(id, Object.assign({ type: 'class', cls, lvl, name, desc }, o));
// Fighter
CF('suddenCharge', ['fighter', 'barbarian'], 1, 'Sudden Charge', '2 actions (flourish): Stride twice, then make a melee Strike.', { act: 'suddenCharge' });
CF('reactiveShield', 'fighter', 1, 'Reactive Shield', 'Reaction: when a melee Strike hits you, Raise a Shield; the bonus may turn the hit into a miss.', { flag: 'reactiveShield' });
CF('doubleSlice', 'fighter', 1, 'Double Slice', '2 actions: Strike with each of two melee weapons at your current multiple attack penalty.', { act: 'doubleSlice' });
CF('exactingStrike', 'fighter', 1, 'Exacting Strike', '1 action (press): a Strike that doesn’t increase your multiple attack penalty if it misses.', { act: 'exactingStrike' });
CF('snaggingStrike', 'fighter', 1, 'Snagging Strike', '1 action (free hand): Strike; on a hit the target is off-guard until the start of your next turn.', { act: 'snaggingStrike' });
CF('viciousSwing', 'fighter', 1, 'Vicious Swing', '2 actions (flourish): a melee Strike with one extra weapon damage die (2 at 10th, 3 at 18th). Counts as two attacks for your multiple attack penalty.', { act: 'viciousSwing' });
CF('pointBlankStance', 'fighter', 1, 'Point-Blank Stance', 'Stance: no volley penalty, and +2 circumstance damage within your weapon’s first range increment.', { act: 'pointBlankStance' });
CF('intimidatingStrike', 'fighter', 2, 'Intimidating Strike', '2 actions: a melee Strike that leaves the target frightened 1 (2 on a critical hit).', { act: 'intimidatingStrike' });
CF('lunge', 'fighter', 2, 'Lunge', '1 action: a melee Strike with +5 feet of reach.', { act: 'lunge' });
CF('knockdown', 'fighter', 4, 'Knockdown', '2 actions (flourish): a melee Strike; if it hits, attempt an Athletics check to Trip the target.', { act: 'knockdown' });
CF('swipe', ['fighter', 'barbarian'], 4, 'Swipe', '2 actions (flourish): one attack roll against up to two adjacent foes in your reach.', { act: 'swipe' });
CF('doubleShot', 'fighter', 4, 'Double Shot', '2 actions (flourish): two ranged Strikes against different targets, each at −2.', { act: 'doubleShot' });
CF('shatterDefenses', 'fighter', 6, 'Shatter Defenses', 'Frightened creatures in your reach are off-guard to you.', { flag: 'shatterDefenses' });
CF('furiousFocus', 'fighter', 6, 'Furious Focus', 'Vicious Swing counts as one attack for your multiple attack penalty.', { flag: 'furiousFocus', req: ['viciousSwing'] });
CF('tripleShot', 'fighter', 6, 'Triple Shot', '3 actions: three ranged Strikes at −4 each.', { act: 'tripleShot', req: ['doubleShot'] });
CF('certainStrike', 'fighter', 10, 'Certain Strike', '1 action (press): a Strike that deals the weapon’s minimum damage on a failure.', { act: 'certainStrike' });
CF('combatReflexes', 'fighter', 10, 'Combat Reflexes', 'An extra reaction each round, usable only for Reactive Strike.', { flag: 'combatReflexes' });
// Rogue
CF('nimbleDodge', 'rogue', 1, 'Nimble Dodge', 'Reaction: +2 circumstance bonus to AC against an attack that targets you.', { flag: 'nimbleDodge' });
CF('twinFeint', 'rogue', 1, 'Twin Feint', '2 actions: two melee Strikes; the target is off-guard against the second.', { act: 'twinFeint' });
CF('youreNext', 'rogue', 1, "You're Next", 'Reaction: after you drop a foe, Demoralize another creature within 60 feet.', { flag: 'youreNext' });
CF('mobility', 'rogue', 2, 'Mobility', 'Stride half your Speed without triggering reactions.', { act: 'mobility' });
CF('gangUp', 'rogue', 6, 'Gang Up', 'A foe within your reach is off-guard to you if any ally also threatens it.', { flag: 'gangUp' });
CF('skirmishStrike', ['rogue', 'ranger'], 4, 'Skirmish Strike', '1 action (flourish): Step and Strike, in either order.', { act: 'skirmishStrike' });
CF('opportuneBackstab', 'rogue', 8, 'Opportune Backstab', 'Reaction: when an ally hits a creature in your reach with a melee Strike, Strike it too.', { flag: 'opportuneBackstab' });
CF('slyStriker', 'rogue', 8, 'Sly Striker', 'Your Strikes against creatures that aren’t off-guard still deal 1d6 precision (2d6 at 14th).', { flag: 'slyStriker' });
// Ranger
CF('huntedShot', 'ranger', 1, 'Hunted Shot', '1 action (flourish): two ranged Strikes against your prey with a reload 0 weapon.', { act: 'huntedShot' });
CF('twinTakedown', 'ranger', 1, 'Twin Takedown', '1 action (flourish): two melee Strikes against your prey, one with each weapon.', { act: 'twinTakedown' });
CF('crossbowAce', 'ranger', 1, 'Crossbow Ace', 'After Hunt Prey or reloading, your next crossbow Strike gains +2 circumstance damage; simple crossbows step up a die size.', { flag: 'crossbowAce' });
CF('huntersAim', 'ranger', 2, "Hunter's Aim", '2 actions: a ranged Strike against your prey with +2 circumstance to hit that ignores concealment.', { act: 'huntersAim' });
CF('runningReload', 'ranger', 4, 'Running Reload', '1 action: Stride and reload.', { act: 'runningReload' });
CF('disruptPrey', 'ranger', 4, 'Disrupt Prey', 'Reaction: Strike your prey when it moves or manipulates in your reach.', { flag: 'disruptPrey' });
// Barbarian
CF('ragingIntimidation', 'barbarian', 1, 'Raging Intimidation', 'Demoralize gains the rage trait so you can use it while raging.', { flag: 'ragingIntimidation' });
CF('furiousFinish', 'barbarian', 2, 'Furious Finish', '1 action (rage): a Strike that deals maximum weapon damage dice; your rage then ends and you’re fatigued.', { act: 'furiousFinish' });
CF('knockback', 'barbarian', 4, 'Knockback', '1 action (press): when your last action was a melee hit, Shove the target with Athletics.', { act: 'knockback' });
CF('fastMovement', 'barbarian', 4, 'Fast Movement', '+10 feet Speed while raging.', { flag: 'fastMovement' });
CF('reactiveStrikeB', 'barbarian', 6, 'Reactive Strike', 'Gain the Reactive Strike reaction.', { flag: 'reactiveStrike' });
CF('cleave', 'barbarian', 6, 'Cleave', 'Reaction (rage): when you drop a foe with a melee Strike, Strike an adjacent foe.', { flag: 'cleave' });
CF('giantsStature', 'barbarian', 6, "Giant's Stature", '1 action (rage, giant): grow to Large with +5 feet reach until your rage ends.', { act: 'giantsStature', sub: 'giant' });
CF('dragonsRageBreath', 'barbarian', 6, "Dragon's Rage Breath", '2 actions (rage, dragon): 30-foot cone, 1d6 fire per level, basic Reflex vs class DC. Once per battle.', { act: 'dragonBreath', sub: 'dragon' });
CF('brutalBully', 'barbarian', 6, 'Brutal Bully', 'Successful Shove or Trip while raging deals bludgeoning damage equal to your Strength modifier.', { flag: 'brutalBully' });
CF('furiousBully', 'barbarian', 8, 'Furious Bully', '+2 circumstance bonus to Athletics attack checks while raging.', { flag: 'furiousBully' });
// Champion
CF('rangedReprisal', 'champion', 1, 'Ranged Reprisal', 'Your Retributive Strike can be made with a ranged weapon against a foe within its first range increment.', { flag: 'rangedReprisal' });
CF('divineGrace', 'champion', 2, 'Divine Grace', 'Reaction: +2 circumstance bonus to a save against a spell.', { flag: 'divineGrace' });
CF('mercy', 'champion', 4, 'Mercy', 'Lay on Hands also removes frightened.', { flag: 'mercy' });
CF('auraOfCourage', 'champion', 4, 'Aura of Courage', 'Frightened you gain is reduced by 1; allies within 15 feet reduce frightened by 1 extra at the end of their turns.', { flag: 'auraOfCourage' });
CF('shieldWarden', ['champion', 'fighter'], 6, 'Shield Warden', 'Use Shield Block when an adjacent ally takes physical damage.', { flag: 'shieldWarden' });
CF('reactiveStrikeC', 'champion', 6, 'Reactive Strike', 'Gain the Reactive Strike reaction.', { flag: 'reactiveStrike' });
CF('quickShieldBlock', 'champion', 8, 'Quick Shield Block', 'An extra reaction each round, usable only for Shield Block.', { flag: 'quickShieldBlock' });
// Monk
CF('tigerStance', 'monk', 1, 'Tiger Stance', 'Stance: tiger claw unarmed attack (1d8 slashing, agile, finesse) and Step 10 feet.', { act: 'stance', stance: 'tiger' });
CF('mountainStance', 'monk', 1, 'Mountain Stance', 'Stance: +4 item bonus to AC with Dex capped at +0, −5 ft Speed, falling stone attack (1d8 bludgeoning).', { act: 'stance', stance: 'mountain' });
CF('craneStance', 'monk', 1, 'Crane Stance', 'Stance: +1 circumstance bonus to AC; crane wing attack (1d6 bludgeoning, agile, finesse).', { act: 'stance', stance: 'crane' });
CF('wolfStance', 'monk', 1, 'Wolf Stance', 'Stance: wolf jaw attack (1d8 piercing, agile, backstabber, finesse) that gains trip while you flank.', { act: 'stance', stance: 'wolf' });
CF('dragonStance', 'monk', 1, 'Dragon Stance', 'Stance: dragon tail attack (1d10 bludgeoning, backswing) and ignore difficult terrain when Striding.', { act: 'stance', stance: 'dragon' });
CF('innerUpheaval', 'monk', 1, 'Inner Upheaval', 'Qi spell (focus): 1 action unarmed Strike, +1 status to hit and +1d6 force.', { focus: 'innerUpheaval' });
CF('qiRush', 'monk', 1, 'Qi Rush', 'Qi spell (focus): 1 action, move up to twice your Speed and become concealed.', { focus: 'qiRush' });
CF('stunningBlows', 'monk', 2, 'Stunning Blows', 'If both Flurry of Blows Strikes hit the same creature, it must save (Fortitude vs class DC) or be stunned 1 (3 on a critical failure).', { flag: 'stunningBlows' });
CF('flyingKick', 'monk', 4, 'Flying Kick', '2 actions: Stride, then make an unarmed Strike.', { act: 'flyingKick' });
CF('tigerSlash', 'monk', 6, 'Tiger Slash', '2 actions (tiger stance): tiger claw Strike with two extra damage dice (three at 14th) that pushes the target 5 feet.', { act: 'tigerSlash', req: ['tigerStance'] });
// Bard
CF('rallyingAnthem', 'bard', 2, 'Rallying Anthem', 'Composition cantrip: allies within 30 feet gain +1 status to AC and saves and resistance to physical damage equal to half your level.', { comp: 'rallyingAnthem' });
CF('dirgeOfDoom', 'bard', 4, 'Dirge of Doom', 'Composition cantrip: foes within 30 feet are frightened 1.', { comp: 'dirgeOfDoom' });
CF('fortissimoComposition', 'bard', 8, 'Fortissimo Composition', 'Spend a Focus Point: Performance check makes Courageous Anthem +2 (+3 on a critical success).', { flag: 'fortissimo', focusPool: 1 });
// Cleric
CF('healingHands', 'cleric', 2, 'Healing Hands', 'Your heal spells use d10s instead of d8s.', { flag: 'healingHands' });
CF('communalHealing', 'cleric', 2, 'Communal Healing', 'When you heal another creature with heal, you regain HP equal to the spell rank.', { flag: 'communalHealing' });
CF('domainInitiate', 'cleric', 2, 'Domain Initiate (Fire)', 'Fire Ray focus spell.', { focus: 'fireRay' });
CF('castDown', 'cleric', 6, 'Cast Down', 'Heal or harm that damages a creature also knocks it prone on a failed save.', { flag: 'castDown' });
CF('selectiveEnergy', 'cleric', 6, 'Selective Energy', 'Your 3-action heal or harm doesn’t affect foes.', { flag: 'selectiveEnergy' });
// Casters
CF('steadySpellcasting', ['bard', 'cleric', 'wizard', 'sorcerer', 'druid'], 6, 'Steady Spellcasting', 'If a reaction would disrupt your spell, attempt a DC 15 flat check to keep it.', { flag: 'steadySpellcasting' });
CF('reachSpell', ['bard', 'cleric', 'wizard', 'sorcerer', 'druid'], 1, 'Reach Spell', '1 action (metamagic): if your next action is to cast a spell with a range, its range increases by 30 feet (touch spells gain a 30-foot range).', { act: 'reachSpell' });
CF('widenSpell', ['wizard', 'sorcerer', 'druid'], 1, 'Widen Spell', '1 action (metamagic): if your next action is to cast a burst, cone or line spell, its area grows (bursts of 10+ feet +5 feet; cones and lines +5 feet if 15 feet or shorter, otherwise +10 feet).', { act: 'widenSpell' });
CF('dangerousSorcery', 'sorcerer', 4, 'Dangerous Sorcery', 'Your damaging slot spells deal extra damage equal to the spell rank.', { flag: 'dangerousSorcery' });

/* ---------- deities (favored weapon) ---------- */
D.deities = {
  sarenrae: { name: 'Sarenrae', weapon: 'scimitar' }, iomedae: { name: 'Iomedae', weapon: 'longsword' }, torag: { name: 'Torag', weapon: 'warhammer' },
  gorum: { name: 'Gorum', weapon: 'greatsword' }, erastil: { name: 'Erastil', weapon: 'longbow' }, desna: { name: 'Desna', weapon: 'shortbow' },
  pharasma: { name: 'Pharasma', weapon: 'dagger' }, gozreh: { name: 'Gozreh', weapon: 'trident' }, cayden: { name: 'Cayden Cailean', weapon: 'rapier' }
};

/* ---------- iconic pregens (built at any level) ---------- */
D.iconics = {
  valeros: { name: 'Brannoc', anc: 'human', her: 'versatileHuman', bg: 'warrior', cls: 'fighter', weapon: 'longsword', ranged: 'javelin', armor: 'chainmail', shield: 'steel',
    attrs: ['str', 'con', 'dex', 'wis', 'int', 'cha'], featPri: ['suddenCharge', 'reactiveShield', 'intimidatingStrike', 'knockdown', 'shatterDefenses', 'combatReflexes', 'certainStrike', 'lunge', 'snaggingStrike', 'exactingStrike', 'shieldWarden'],
    ancPri: ['naturalAmbition', 'generalTraining'], genPri: ['toughness', 'fleet', 'incredibleInitiative', 'diehard', 'cannyAcumen'], skillPri: ['athletics', 'intimidation', 'acrobatics', 'survival', 'medicine'],
    skillFeatPri: ['intimidatingGlare', 'titanWrestler', 'battleCry', 'assuranceAthletics'], look: { body: '#7f93a8', trim: '#c8a24a', acc: 'helm' }, blurb: 'Human fighter. Sword and board, Reactive Strike, Shield Block.' },
  kyra: { name: 'Sadira', anc: 'human', her: 'skilledHuman', bg: 'acolyte', cls: 'cleric', sub: 'warpriest', deity: 'sarenrae', weapon: 'scimitar', ranged: 'sling', armor: 'scale', shield: 'steel',
    attrs: ['wis', 'str', 'con', 'dex', 'cha', 'int'], featPri: ['communalHealing', 'domainInitiate', 'healingHands', 'castDown', 'selectiveEnergy', 'steadySpellcasting'],
    ancPri: ['generalTraining', 'naturalAmbition'], genPri: ['toughness', 'diehard', 'fleet'], skillPri: ['medicine', 'religion', 'diplomacy', 'athletics'], skillFeatPri: ['battleMedicine'],
    spellPri: ['bless', 'fear', 'command', 'heroism', 'noiseBlast', 'blindness', 'divineWrath', 'spiritBlast', 'sunburst'],
    look: { body: '#d8c48e', trim: '#d9813a', acc: 'hood' }, blurb: 'Human warpriest of Sarenrae. Scimitar, shield and a font of heal spells.' },
  merisiel: { name: 'Ilvara', anc: 'elf', her: 'cavernElf', bg: 'criminal', cls: 'rogue', sub: 'thief', weapon: 'rapier', ranged: 'dagger', armor: 'leather', shield: null,
    attrs: ['dex', 'con', 'wis', 'cha', 'str', 'int'], featPri: ['nimbleDodge', 'twinFeint', 'mobility', 'skirmishStrike', 'gangUp', 'opportuneBackstab', 'slyStriker', 'youreNext'],
    ancPri: ['nimbleElf', 'elvenWeaponFamiliarity', 'elfStep', 'elfWeaponCrit'], genPri: ['toughness', 'fleet', 'incredibleInitiative'], skillPri: ['stealth', 'acrobatics', 'thievery', 'deception', 'athletics', 'intimidation', 'medicine', 'society'],
    skillFeatPri: ['catFall', 'kipUp', 'battleMedicine', 'bonMot'], initSkill: 'stealth', look: { body: '#4b3a5c', trim: '#a8b3b0', acc: 'hood' }, blurb: 'Elf thief. Rapier, thrown daggers, sneak attack.' },
  ezren: { name: 'Corwin', anc: 'human', her: 'versatileHuman', bg: 'scholar', cls: 'wizard', weapon: 'staff', ranged: 'crossbow', armor: 'explorer', shield: null,
    attrs: ['int', 'dex', 'con', 'wis', 'cha', 'str'], featPri: ['steadySpellcasting'], ancPri: ['generalTraining', 'naturalAmbition'], genPri: ['toughness', 'fleet', 'incredibleInitiative'],
    skillPri: ['arcana', 'occultism', 'society', 'medicine', 'religion'], skillFeatPri: ['battleMedicine'],
    spellPri: ['fireball', 'lightningBolt', 'slow', 'haste', 'forceBarrage', 'grease', 'sleep', 'fear', 'breatheFire', 'noiseBlast', 'laughingFit', 'paralyze', 'howlingBlizzard', 'chainLightning', 'disintegrate', 'polarRay'],
    look: { body: '#3c5a8a', trim: '#cfa64a', acc: 'hat' }, blurb: 'Human battle wizard. Force Bolt, Fireball and friends.' },
  seelah: { name: 'Tamsin', anc: 'human', her: 'versatileHuman', bg: 'acolyte', cls: 'champion', sub: 'justice', deity: 'iomedae', weapon: 'longsword', ranged: 'javelin', armor: 'fullplate', shield: 'steel',
    attrs: ['str', 'cha', 'con', 'wis', 'dex', 'int'], featPri: ['rangedReprisal', 'divineGrace', 'mercy', 'auraOfCourage', 'shieldWarden', 'reactiveStrikeC', 'quickShieldBlock'],
    ancPri: ['naturalAmbition', 'generalTraining'], genPri: ['toughness', 'diehard', 'fleet'], skillPri: ['religion', 'athletics', 'diplomacy', 'medicine', 'intimidation'], skillFeatPri: ['battleMedicine', 'titanWrestler'],
    look: { body: '#c9ccd2', trim: '#d4a64a', acc: 'helm' }, blurb: 'Human champion of justice. Full plate, Retributive Strike, Lay on Hands.' },
  harsk: { name: 'Durgan', anc: 'dwarf', her: 'rockDwarf', bg: 'bountyHunter', cls: 'ranger', sub: 'precision', weapon: 'crossbow', melee: 'battleaxe', armor: 'leather', shield: null,
    attrs: ['dex', 'wis', 'con', 'str', 'int', 'cha'], featPri: ['crossbowAce', 'huntersAim', 'runningReload', 'skirmishStrike', 'disruptPrey', 'twinTakedown'],
    ancPri: ['dwarvenWeaponFamiliarity', 'unburdenedIron', 'dwarfWeaponCrit'], genPri: ['toughness', 'incredibleInitiative', 'fleet'], skillPri: ['survival', 'nature', 'stealth', 'athletics', 'medicine'], skillFeatPri: ['battleMedicine'],
    look: { body: '#6b5a3a', trim: '#8a8f52', acc: 'hood' }, blurb: 'Dwarf ranger. Crossbow, Hunt Prey, precision edge.' },
  amiri: { name: 'Ragna', anc: 'human', her: 'versatileHuman', bg: 'warrior', cls: 'barbarian', sub: 'giant', weapon: 'bastard', ranged: 'javelin', armor: 'hide', shield: null,
    attrs: ['str', 'con', 'dex', 'wis', 'cha', 'int'], featPri: ['suddenCharge', 'ragingIntimidation', 'furiousFinish', 'swipe', 'giantsStature', 'reactiveStrikeB', 'knockback', 'cleave', 'furiousBully'],
    ancPri: ['naturalAmbition', 'generalTraining'], genPri: ['toughness', 'fleet', 'diehard'], skillPri: ['athletics', 'intimidation', 'survival', 'acrobatics'], skillFeatPri: ['intimidatingGlare', 'battleCry', 'titanWrestler'],
    look: { body: '#7a4a32', trim: '#bfa27a', acc: 'none' }, blurb: 'Human barbarian of the giant instinct. Oversized bastard sword, Rage.' },
  lem: { name: 'Pip', anc: 'halfling', her: 'gutsyHalfling', bg: 'entertainer', cls: 'bard', weapon: 'shortsword', ranged: 'shortbow', armor: 'studded', shield: null,
    attrs: ['cha', 'dex', 'con', 'wis', 'int', 'str'], featPri: ['rallyingAnthem', 'dirgeOfDoom', 'fortissimoComposition', 'steadySpellcasting'],
    ancPri: ['halflingLuck', 'halflingWeaponFamiliarity', 'halflingWeaponCrit'], genPri: ['toughness', 'fleet'], skillPri: ['performance', 'occultism', 'diplomacy', 'deception', 'acrobatics', 'medicine'], skillFeatPri: ['bonMot', 'battleMedicine'],
    look: { body: '#6a3f7c', trim: '#d6b25a', acc: 'hat' }, blurb: 'Halfling bard. Courageous Anthem, Dirge of Doom, occult spells.' },
  sajan: { name: 'Jun Wei', anc: 'human', her: 'versatileHuman', bg: 'martialDisciple', cls: 'monk', weapon: 'fist', armor: 'explorer', shield: null,
    attrs: ['dex', 'str', 'con', 'wis', 'int', 'cha'], featPri: ['tigerStance', 'innerUpheaval', 'stunningBlows', 'flyingKick', 'tigerSlash', 'qiRush', 'craneStance'],
    ancPri: ['naturalAmbition', 'generalTraining'], genPri: ['toughness', 'fleet', 'incredibleInitiative'], skillPri: ['acrobatics', 'athletics', 'stealth', 'religion'], skillFeatPri: ['catFall', 'titanWrestler', 'kipUp'],
    look: { body: '#c4692e', trim: '#3b3b3b', acc: 'none' }, blurb: 'Human monk. Flurry of Blows, Tiger Stance, Stunning Blows.' },
  seoni: { name: 'Ashka', anc: 'human', her: 'versatileHuman', bg: 'emissary', cls: 'sorcerer', sub: 'elemental', weapon: 'staff', ranged: 'crossbow', armor: 'explorer', shield: null,
    attrs: ['cha', 'dex', 'con', 'wis', 'int', 'str'], featPri: ['dangerousSorcery', 'steadySpellcasting'], ancPri: ['generalTraining', 'naturalAmbition'], genPri: ['toughness', 'fleet', 'incredibleInitiative'],
    skillPri: ['intimidation', 'nature', 'diplomacy', 'deception', 'medicine'], skillFeatPri: ['intimidatingGlare', 'battleMedicine'],
    spellPri: ['fireball', 'breatheFire', 'thunderstrike', 'slow', 'haste', 'lightningBolt', 'fear', 'grease', 'hydraulicPush', 'howlingBlizzard', 'chainLightning', 'sunburst', 'polarRay'],
    look: { body: '#8a2c3a', trim: '#e0b45c', acc: 'none' }, blurb: 'Human elemental sorcerer. Elemental Toss and a repertoire of fire.' },
  lini: { name: 'Fenna', anc: 'gnome', her: 'sensateGnome', bg: 'herbalist', cls: 'druid', weapon: 'sickle', ranged: 'sling', armor: 'leather', shield: null,
    attrs: ['wis', 'con', 'dex', 'cha', 'str', 'int'], featPri: ['steadySpellcasting'], ancPri: ['gnomeWeaponFamiliarity', 'gnomeWeaponCrit'], genPri: ['toughness', 'fleet', 'incredibleInitiative'],
    skillPri: ['nature', 'medicine', 'acrobatics', 'survival', 'diplomacy'], skillFeatPri: ['battleMedicine', 'catFall'],
    spellPri: ['heal', 'thunderstrike', 'slow', 'lightningBolt', 'fireball', 'gustOfWind', 'fear', 'haste', 'howlingBlizzard', 'chainLightning', 'sunburst'],
    look: { body: '#4d6b3c', trim: '#b0d06a', acc: 'hood' }, blurb: 'Gnome storm druid. Tempest Surge, heal and primal blasts.' }
};
D.iconicOrder = ['valeros', 'kyra', 'merisiel', 'ezren', 'seelah', 'harsk', 'amiri', 'lem', 'sajan', 'seoni', 'lini'];
})(typeof window !== 'undefined' ? window : globalThis);
