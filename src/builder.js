/* builder.js — turns a build definition into a computed sheet and a battle unit */
(function (G) {
'use strict';
const PF = G.PF, D = PF.D, U = PF.U;
const B = PF.Build = {};

B.rankAt = (tbl, L) => { let r = 0; if (tbl) for (const [lv, rk] of tbl) if (L >= lv) r = rk; return r; };
B.mod = v => v; // Remaster attributes are stored as modifiers
const SKILL_INC = L => { const a = []; for (let l = 3; l <= L; l += 2) a.push(l); return a; };
const capRank = L => L >= 15 ? 4 : L >= 7 ? 3 : L >= 2 ? 2 : 1;

/* ---------- attribute boosts ---------- */
B.attributes = function (def, cls, anc, bg, L) {
  const pri = (def.attrs && def.attrs.length === 6) ? def.attrs.slice() : cls.def.attrs.slice();
  const a = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  const log = [];
  const boostSet = (list) => { const used = new Set(); for (const x of list) { if (!x) continue; a[x] += 1; used.add(x); } return used; };
  // ancestry
  const fixed = anc.boosts.filter(b => b !== 'free');
  const nFree = anc.boosts.length - fixed.length;
  const ancList = fixed.slice();
  for (const p of pri) { if (ancList.length >= fixed.length + nFree) break; if (!ancList.includes(p)) ancList.push(p); }
  boostSet(ancList); anc.flaws.forEach(f => { a[f] -= 1; });
  log.push('Ancestry: ' + ancList.map(x => x.toUpperCase()).join(', ') + (anc.flaws.length ? '; flaw ' + anc.flaws.join(', ').toUpperCase() : ''));
  // background: one of two, plus one free
  const bgPick = pri.indexOf(bg.boosts[0]) <= pri.indexOf(bg.boosts[1]) ? bg.boosts[0] : bg.boosts[1];
  const bgFree = pri.find(p => p !== bgPick);
  boostSet([bgPick, bgFree]);
  // class key
  const key = def.key && cls.key.includes(def.key) ? def.key : (cls.key.slice().sort((x, y) => pri.indexOf(x) - pri.indexOf(y))[0]);
  a[key] += 1;
  // four free boosts at 1st
  boostSet(pri.slice(0, 4));
  // level boosts with partial boosts above +4
  const partial = {};
  [5, 10, 15, 20].forEach(lv => {
    if (L < lv) return;
    pri.slice(0, 4).forEach(x => {
      if (a[x] >= 4) { if (partial[x]) { a[x] += 1; partial[x] = false; } else partial[x] = true; }
      else a[x] += 1;
    });
  });
  return { a, key, log };
};

/* ---------- feat slots ---------- */
B.featSlots = function (cls, L, extra) {
  const s = [];
  cls.featLv.forEach(l => { if (l <= L) s.push({ key: 'c' + l, type: 'class', lvl: l }); });
  [1, 5, 9, 13, 17].forEach(l => { if (l <= L) s.push({ key: 'a' + l, type: 'ancestry', lvl: l }); });
  [3, 7, 11, 15, 19].forEach(l => { if (l <= L) s.push({ key: 'g' + l, type: 'general', lvl: l }); });
  const sk = cls.skillFeatEvery ? Array.from({ length: L }, (_, i) => i + 1) : [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
  sk.forEach(l => { if (l <= L) s.push({ key: 's' + l, type: 'skill', lvl: l }); });
  if (extra.bonusGeneral) s.push({ key: 'gH', type: 'general', lvl: 1, bonus: 'heritage' });
  return s;
};
B.featOK = function (f, slot, ctx) {
  if (!f || f.type === 'feature') return false;
  if (slot.type === 'class') { if (f.type !== 'class') return false; const c = [].concat(f.cls); if (!c.includes(ctx.cls)) return false; if (f.sub && f.sub !== ctx.sub) return false; }
  else if (slot.type === 'ancestry') { if (f.type !== 'ancestry' || f.anc !== ctx.anc) return false; }
  else if (slot.type === 'general') { if (f.type !== 'general' && f.type !== 'skill') return false; if (f.type === 'skill' && !ctx.skillOK(f)) return false; }
  else if (slot.type === 'skill') { if (f.type !== 'skill' || !ctx.skillOK(f)) return false; }
  if (f.lvl > slot.lvl) return false;
  if (f.req && !f.req.every(r => ctx.has(r))) return false;
  if (ctx.has(f.id)) return false;
  return true;
};

/* ---------- main builder ---------- */
B.make = function (def0) {
  const def = Object.assign({}, def0);
  const L = U.clamp(def.level | 0 || 1, 1, 20);
  const cls = D.classes[def.cls]; const anc = D.ancestries[def.anc];
  const bg = D.backgrounds[def.bg] || D.backgrounds.warrior;
  if (!cls || !anc) throw new Error('Unknown class or ancestry');
  const her = D.heritages[def.her] && D.heritages[def.her].anc === def.anc ? D.heritages[def.her] : Object.values(D.heritages).find(h => h.anc === def.anc);
  const sub = cls.sub ? (cls.sub.opts[def.sub] ? def.sub : (cls.def.sub || Object.keys(cls.sub.opts)[0])) : null;
  const subD = sub ? cls.sub.opts[sub] : null;
  const S = { def: U.clone(def0), name: def.name || 'Adventurer', level: L, cls: def.cls, anc: def.anc, her: her ? Object.keys(D.heritages).find(k => D.heritages[k] === her) : null, bg: def.bg, sub, deity: def.deity || null };
  S.clsName = cls.name; S.ancName = anc.name; S.herName = her ? her.name : ''; S.bgName = bg.name; S.subName = subD ? subD.name : '';
  S.flags = {}; S.acts = []; S.focusSpells = []; S.comps = []; S.notes = [];
  if (subD && subD.flag) S.flags[subD.flag] = true;
  if (her && her.fx) Object.assign(S.flags, her.fx.flagSet || {});
  if (her && her.fx.diehard) S.flags.diehard = true;
  if (her && her.fx.rockDwarf) S.flags.rockDwarf = true;
  if (her && her.fx.gutsy) S.flags.gutsy = true;
  if (her && her.fx.halfFall) S.flags.halfFall = true;
  if (her && her.fx.forestCover) S.flags.forestCover = true;
  if (def.anc === 'halfling') S.flags.keenEyes = true;
  // attributes
  const at = B.attributes(def, cls, anc, bg, L); S.attr = at.a; S.key = at.key;
  if (sub === 'ruffian' || sub === 'scoundrel') { /* key choice handled via def.key */ }
  // proficiencies
  const prof = {}; Object.keys(cls.prof).forEach(k => { prof[k] = B.rankAt(cls.prof[k], L); });
  if (def.cls === 'cleric' && sub === 'warpriest') {
    prof.fort = B.rankAt([[1, 1], [3, 2], [15, 3]], L);
    prof.medium = B.rankAt([[1, 1], [13, 2]], L);
    prof.martial = B.rankAt([[1, 1], [7, 2], [19, 3]], L); prof.simple = Math.max(prof.simple, prof.martial);
    prof.spell = B.rankAt([[1, 1], [11, 2], [19, 3]], L); prof.classDC = prof.spell;
    S.flags.shieldBlock = true;
  }
  if (def.cls === 'rogue' && sub === 'ruffian') prof.medium = prof.light;
  ['per', 'fort', 'ref', 'will', 'simple', 'martial', 'advanced', 'unarmed', 'unarmored', 'light', 'medium', 'heavy', 'classDC', 'spell'].forEach(k => { if (prof[k] == null) prof[k] = 0; });
  S.prof = prof;
  // class features
  cls.features.forEach(([lv, id]) => {
    if (lv > L) return; const f = D.feats[id]; if (!f) return;
    if (f.flag) S.flags[f.flag] = true; if (f.act) S.acts.push(f.act); if (f.focus) S.focusSpells.push(f.focus); if (f.comp) S.comps.push(f.comp);
    if (f.focusPool) S.flags.focusPool = (S.flags.focusPool || 0) + f.focusPool;
  });
  if (def.cls === 'sorcerer') { if (sub === 'elemental') S.focusSpells.push('elementalToss'); if (sub === 'draconic') S.focusSpells.push('dragonClaws'); if (sub === 'angelic') S.focusSpells.push('angelicHalo'); }
  if (def.cls === 'cleric' && sub === 'cloistered' && L >= 1) { /* cloistered: domain initiate available as a feat */ }
  // skills
  const skills = {}; Object.keys(PF.SKILLS).forEach(k => { skills[k] = 0; });
  const train = k => { if (k && skills[k] != null && skills[k] < 1) { skills[k] = 1; return true; } return false; };
  cls.skills.fixed.forEach(train);
  if (def.cls === 'fighter') train(S.key === 'dex' ? 'acrobatics' : 'athletics');
  train(bg.skill); if (subD && subD.skill) train(subD.skill); if (subD && subD.skills) subD.skills.forEach(train);
  if (her && her.fx.trainSkill) train(her.fx.trainSkill);
  const skPri = (def.skillPri && def.skillPri.length ? def.skillPri : []).concat(cls.skills.pri, Object.keys(PF.SKILLS)).filter(k => skills[k] != null);
  let picks = cls.skills.pick + Math.max(0, S.attr.int) + (her && her.fx.bonusSkill ? 1 : 0);
  for (const k of skPri) { if (picks <= 0) break; if (train(k)) picks--; }
  const incLv = cls.skillIncEvery ? Array.from({ length: Math.max(0, L - 1) }, (_, i) => i + 2) : SKILL_INC(L);
  const trainedPri = skPri.filter((k, i, arr) => arr.indexOf(k) === i && skills[k] >= 1);
  incLv.forEach(l => { for (const k of trainedPri) { if (skills[k] < capRank(l)) { skills[k]++; break; } } });
  if (her && her.fx.bonusSkill && L >= 5) { const k = trainedPri.find(x => skills[x] === 1); if (k) skills[k] = 2; }
  S.skills = skills;
  // feats
  const extra = { bonusGeneral: her && her.fx.bonusGeneral };
  const slots = B.featSlots(cls, L, extra);
  const taken = new Set(); const featList = [];
  const ctx = {
    cls: def.cls, anc: def.anc, sub, has: id => taken.has(id),
    skillOK: f => !f.skill || skills[f.skill] >= (f.rank || 1)
  };
  const explicit = def.feats || {};
  const priFor = slot => {
    if (slot.type === 'class') return (def.featPri || []).concat(cls.featPri);
    if (slot.type === 'ancestry') return (def.ancPri || []).concat(Object.values(D.feats).filter(f => f.type === 'ancestry' && f.anc === def.anc).map(f => f.id));
    if (slot.type === 'general') return (def.genPri || []).concat(['toughness', 'fleet', 'incredibleInitiative', 'diehard', 'cannyAcumen']);
    return (def.skillFeatPri || []).concat(bg.feat ? [bg.feat] : [], ['battleMedicine', 'intimidatingGlare', 'catFall', 'titanWrestler', 'bonMot', 'kipUp', 'battleCry', 'assuranceAthletics']);
  };
  const addFeat = (slot, id) => {
    const f = D.feats[id]; taken.add(id); featList.push({ slot: slot.key, type: slot.type, lvl: slot.lvl, id, name: f.name, bonus: slot.bonus });
    if (f.fx && f.fx.bonusClassFeat) {
      const s2 = { key: 'c1b', type: 'class', lvl: 1, bonus: 'Natural Ambition' }; slots.push(s2);
    }
    if (f.fx && f.fx.bonusGeneral) slots.push({ key: 'g1b', type: 'general', lvl: 1, bonus: f.name });
  };
  // background skill feat is granted free
  if (bg.feat && D.feats[bg.feat]) { taken.add(bg.feat); featList.push({ slot: 'bg', type: 'skill', lvl: 1, id: bg.feat, name: D.feats[bg.feat].name, bonus: 'background' }); }
  if (def.cls === 'bard') { taken.add('lingeringComposition'); }
  if (sub === 'fury') slots.push({ key: 'c1f', type: 'class', lvl: 1, bonus: 'Fury instinct' });
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    let pick = explicit[slot.key];
    if (pick === '') { featList.push({ slot: slot.key, type: slot.type, lvl: slot.lvl, id: null, name: '—', bonus: slot.bonus }); continue; }
    if (!pick || !B.featOK(D.feats[pick], slot, ctx)) pick = priFor(slot).find(id => B.featOK(D.feats[id], slot, ctx));
    if (pick) addFeat(slot, pick); else featList.push({ slot: slot.key, type: slot.type, lvl: slot.lvl, id: null, name: '—', bonus: slot.bonus });
  }
  S.featSlots = slots; S.feats = featList;
  // apply feat effects
  let speedBonus = 0, hpPerLevel = 0; const ancWeap = new Set();
  featList.forEach(fl => {
    if (!fl.id) return; const f = D.feats[fl.id];
    if (f.flag) S.flags[f.flag] = true; if (f.act) S.acts.push(f.act); if (f.focus) S.focusSpells.push(f.focus); if (f.comp) S.comps.push(f.comp);
    if (f.focusPool) S.flags.focusPool = (S.flags.focusPool || 0) + f.focusPool;
    if (f.fx) {
      if (f.fx.flag) S.flags[f.fx.flag] = true;
      if (f.fx.speed) speedBonus += f.fx.speed;
      if (f.fx.hpPerLevel) hpPerLevel += f.fx.hpPerLevel;
      if (f.fx.ancWeapons) ancWeap.add(f.fx.ancWeapons);
      if (f.fx.critSpecAnc) S.flags['critSpecAnc_' + f.fx.critSpecAnc] = true;
      if (f.fx.cannyAcumen) { const k = ['will', 'ref', 'fort', 'per'].sort((x, y) => prof[x] - prof[y])[0]; prof[k] = Math.max(prof[k], L >= 17 ? 3 : 2); S.notes.push('Canny Acumen: ' + k); }
      if (f.fx.armorProf) { if (!prof.light) prof.light = 1; else if (!prof.medium) prof.medium = 1; else if (!prof.heavy) prof.heavy = 1; }
    }
  });
  if (her && her.fx.diehard) S.flags.diehard = true;
  // equipment
  const runes = Object.assign(D.runesForLevel(L), def.runes && typeof def.runes === 'object' ? def.runes : {});
  S.runes = runes;
  const armor = D.armors[def.armor] || D.armors[cls.def.armor] || D.armors.none;
  S.armor = armor;
  let shieldId = def.shield === undefined ? cls.def.shield : def.shield;
  if (shieldId && !(prof.light || prof.medium || prof.heavy || S.flags.shieldBlock)) shieldId = null;
  if (shieldId) shieldId = D.shieldForLevel(L, shieldId);
  S.shield = shieldId ? Object.assign({}, D.shields[shieldId]) : null;
  if (S.shield && S.flags.shieldAlly) { S.shield.hard += 2; S.shield.hp = Math.floor(S.shield.hp * 1.5); S.shield.bt = Math.floor(S.shield.bt * 1.5); S.shield.name += ' (shield ally)'; }
  // deity weapon (clerics / champions)
  const deity = def.deity && D.deities[def.deity] ? D.deities[def.deity] : null;
  S.deityWeapon = deity ? deity.weapon : null;
  // weapon proficiency resolver
  const weaponRank = w => {
    if (w.cat === 'unarmed') return prof.unarmed;
    let r = 0;
    if (w.cat === 'simple') r = prof.simple;
    if (w.cat === 'martial') {
      const famAnc = [...ancWeap].some(a => (D.ancWeapons[a] || []).includes(w.id));
      if (famAnc) r = Math.max(prof.simple, prof.martial);
      else if (cls.martialFilter) r = cls.martialFilter(w, S) ? Math.max(prof.martial, prof.simple) : (prof.martial && def.cls !== 'rogue' && def.cls !== 'bard' && def.cls !== 'cleric' ? prof.martial : 0);
      else r = prof.martial;
      if (def.cls === 'cleric' && w.id === S.deityWeapon) r = Math.max(r, prof.simple, prof.martial);
    }
    if (w.cat === 'advanced') r = prof.advanced || 0;
    if (def.cls === 'monk' && w.traits.includes('monk')) r = Math.max(r, prof.unarmed);
    return r;
  };
  S.weaponRank = weaponRank;
  // derived numbers
  const A = S.attr;
  const armorRank = armor.cat === 'unarmored' ? prof.unarmored : (prof[armor.cat] || 0);
  const strOK = A.str >= armor.str;
  S.armorRank = armorRank;
  const dexCap = armor.cap;
  S.ac = { base: 10 + Math.min(A.dex, dexCap) + PF.prof(armorRank, L), item: armor.ac + (armor.id !== 'none' || def.cls === 'monk' || def.cls === 'wizard' || def.cls === 'sorcerer' ? runes.arm : 0), dexCap, armorRank };
  if (armor.id === 'none' && runes.arm) S.ac.item = runes.arm; // bracers/explorer's clothing potency
  let speed = anc.speed + speedBonus;
  let armorSpeed = armor.speed; if (strOK && armorSpeed) armorSpeed += 5; if (S.flags.unburdenedIron && armorSpeed) armorSpeed = Math.min(0, armorSpeed + 5);
  speed += Math.min(0, armorSpeed);
  if (S.flags.incredibleMovement && (armor.cat === 'unarmored')) speed += L >= 19 ? 30 : L >= 15 ? 25 : L >= 11 ? 20 : L >= 7 ? 15 : 10;
  S.speed = speed;
  S.checkPen = strOK ? 0 : armor.check;
  const res = runes.res;
  S.saves = { fort: { base: PF.prof(prof.fort, L) + A.con, item: res }, ref: { base: PF.prof(prof.ref, L) + A.dex, item: res }, will: { base: PF.prof(prof.will, L) + A.wis, item: res } };
  S.per = { base: PF.prof(prof.per, L) + A.wis, item: 0 };
  S.sk = {}; Object.keys(PF.SKILLS).forEach(k => { const at2 = PF.SKILLS[k]; S.sk[k] = { base: PF.prof(skills[k], L) + A[at2] + ((at2 === 'str' || at2 === 'dex') && k !== 'acrobatics' && k !== 'athletics' && k !== 'stealth' && k !== 'thievery' ? 0 : ((at2 === 'str' || at2 === 'dex') ? S.checkPen : 0)), item: 0, rank: skills[k] }; });
  const keyAttr = S.key;
  S.classDC = 10 + PF.prof(prof.classDC, L) + A[keyAttr];
  // HP
  const ancHP = her && her.fx.hp ? her.fx.hp : anc.hp;
  S.maxHP = ancHP + (cls.hp + A.con) * L + hpPerLevel * L;
  S.size = anc.size; S.traits = anc.traits.slice();
  // strikes
  S.strikes = [];
  const wsLvl = cls.ws || [];
  const specFor = rank => { if (L < (wsLvl[0] || 99)) return 0; const base = [0, 0, 2, 3, 4][rank]; return L >= (wsLvl[1] || 99) ? base * 2 : base; };
  const mkStrike = (wid, kind, opts = {}) => {
    const w = D.weapons[wid]; if (!w) return;
    const rank = weaponRank(w);
    const isRanged = kind === 'r';
    const twoHand = !S.shield && (w.hands === 2 || w.traits.some(t => t.startsWith('two-hand')));
    let die = w.die;
    const th = w.traits.find(t => t.startsWith('two-hand-d')); if (th && twoHand) die = +th.slice(10);
    if (w.id === 'fist' && S.flags.powerfulFist) die = 6;
    const finesse = w.traits.includes('finesse');
    const atkAttr = isRanged ? 'dex' : (finesse && A.dex > A.str ? 'dex' : 'str');
    const thrown = isRanged && (w.kind === 'm' || w.traits.includes('thrown'));
    let dmgAttr = null, dmgMod = 0;
    if (!isRanged || thrown) { dmgAttr = 'str'; dmgMod = A.str; }
    if (isRanged && w.traits.includes('propulsive')) { dmgAttr = 'str'; dmgMod = A.str > 0 ? Math.floor(A.str / 2) : A.str; }
    if (!isRanged && finesse && S.flags.thief && A.dex > A.str) { dmgAttr = 'dex'; dmgMod = A.dex; }
    const dice = 1 + (w.cat === 'unarmed' && wid !== 'fist' ? runes.str : runes.str);
    const traits = w.traits.slice();
    let range = 0;
    if (isRanged) { const tt = w.traits.find(t => t.startsWith('thrown-')); range = tt ? +tt.slice(7) : w.range; }
    const reach = !isRanged && w.traits.includes('reach') ? 10 : 5;
    const st = {
      id: 'w' + S.strikes.length, wid, name: w.name + (isRanged && w.kind === 'm' ? ' (thrown)' : ''), kind: isRanged ? 'ranged' : 'melee', group: w.group, cat: w.cat,
      atk: { base: PF.prof(rank, L) + A[atkAttr], item: runes.pot }, atkAttr, rank,
      dmg: [{ n: dice, d: die, m: dmgMod + specFor(rank), type: PF.DT[w.dt] }], dmgAttr, spec: specFor(rank),
      traits, range, reach, reload: w.reload, loaded: true, w: true, thrown,
      qty: thrown ? (wid === 'javelin' ? 4 : wid === 'dart' ? 6 : 2) : null
    };
    const vers = w.traits.find(t => t.startsWith('versatile-')); if (vers) st.alt = PF.DT[vers.slice(10)];
    if (runes.prop && def.prop) st.dmg.push({ n: 1, d: 6, m: 0, type: D.propertyRunes[def.prop] || 'fire', rune: def.prop });
    if (opts.unarmedStance) Object.assign(st, opts.unarmedStance);
    S.strikes.push(st);
  };
  const mainW = def.weapon || cls.def.weapon;
  const W0 = D.weapons[mainW];
  if (W0) {
    if (W0.kind === 'r') mkStrike(mainW, 'r');
    else { mkStrike(mainW, 'm'); if (W0.traits.some(t => t.startsWith('thrown'))) mkStrike(mainW, 'r'); }
  }
  const melee2 = def.melee || (W0 && W0.kind === 'r' ? cls.def.melee : null);
  if (melee2 && D.weapons[melee2] && melee2 !== mainW) mkStrike(melee2, 'm');
  const rangedW = def.ranged === undefined ? cls.def.ranged : def.ranged;
  if (rangedW && rangedW !== mainW && D.weapons[rangedW]) {
    const RW = D.weapons[rangedW];
    if (RW.kind === 'm' && RW.traits.some(t => t.startsWith('thrown'))) mkStrike(rangedW, 'm');
    mkStrike(rangedW, 'r');
  }
  if (!S.strikes.some(s => s.wid === 'fist')) mkStrike('fist', 'm');
  // spellcasting
  S.spells = null;
  const cst = cls.caster;
  const spellAttr = cst ? cst.key : (cls.spellKey || null);
  if (spellAttr) { S.spellDC = 10 + PF.prof(prof.spell, L) + A[spellAttr]; S.spellAtk = PF.prof(prof.spell, L) + A[spellAttr]; }
  if (cst) {
    const trad = cst.trad === 'bloodline' ? (subD ? subD.trad : 'arcane') : cst.trad;
    const maxRank = Math.min(9, Math.ceil(L / 2));
    const slotsFor = r => { if (r > maxRank) return 0; const first = 2 * r - 1; if (cst.slots === 'sorc') return L >= first + 1 ? 4 : 3; return L >= first + 1 ? 3 : 2; };
    const list = D.spellList(trad);
    const pri = (def.spellPri && def.spellPri.length ? def.spellPri : []).concat(cls.spellPri || [], list.map(s => s.id))
      .filter((id, i, arr) => arr.indexOf(id) === i && D.spells[id] && D.spells[id].trad.includes(trad) && !D.spells[id].focus && D.spells[id].rank > 0);
    const cpri = (def.cantripPri || []).concat(cls.cantripPri || [], list.filter(s => s.rank === 0).map(s => s.id))
      .filter((id, i, arr) => arr.indexOf(id) === i && D.spells[id] && D.spells[id].rank === 0 && D.spells[id].trad.includes(trad));
    const sp = S.spells = { trad, kind: cst.kind, dc: S.spellDC, atk: S.spellAtk, cantripRank: maxRank, cantrips: (def.cantrips && def.cantrips.length ? def.cantrips : cpri).slice(0, 5), prepared: [], slots: {}, rep: [], sig: [], comps: S.comps.slice() };
    const pickFor = (r, n) => {
      const cands = pri.filter(id => D.spells[id].rank <= r).sort((x, y) => (D.spells[x].rank === r ? 0 : 1) - (D.spells[y].rank === r ? 0 : 1));
      const out = []; if (!cands.length) return out;
      for (let i = 0; out.length < n; i++) out.push(cands[i % cands.length]);
      return out;
    };
    for (let r = 1; r <= maxRank; r++) {
      const n = slotsFor(r) + (cst.curriculum ? 1 : 0);
      if (cst.kind === 'prepared') {
        const chosen = def.prepared && def.prepared[r] ? def.prepared[r].slice(0, n) : [];
        const auto = pickFor(r, n);
        for (let i = 0; i < n; i++) { const id = chosen[i] && D.spells[chosen[i]] && D.spells[chosen[i]].rank <= r ? chosen[i] : auto[i]; if (id) sp.prepared.push({ id, rank: r, used: false }); }
      } else {
        sp.slots[r] = { max: n, used: 0 };
        const known = def.repertoire && def.repertoire[r] ? def.repertoire[r].filter(id => D.spells[id] && D.spells[id].rank <= r) : pickFor(r, Math.min(n, r === maxRank ? n : n)).filter((id, i, a) => a.indexOf(id) === i);
        known.slice(0, n).forEach(id => sp.rep.push({ id, rank: r }));
      }
    }
    if (cst.kind === 'spontaneous') {
      if (subD && subD.granted) subD.granted.forEach(id => { const s = D.spells[id]; if (s && s.rank <= maxRank && !sp.rep.some(x => x.id === id)) sp.rep.push({ id, rank: s.rank }); });
      // one signature spell per rank: the best heightenable spell learned at that rank
      const seen = new Set();
      for (let r = 1; r <= maxRank; r++) { const e = sp.rep.find(x => x.rank === r && !seen.has(x.id)); if (e) { sp.sig.push(e.id); seen.add(e.id); } }
    }
    if (cst.font) { sp.font = { id: S.flags.harmFont ? 'harm' : 'heal', rank: maxRank, max: L >= 15 ? 6 : L >= 5 ? 5 : 4, used: 0 }; }
  }
  S.focus = { spells: S.focusSpells.filter((v, i, a) => a.indexOf(v) === i), max: 0 };
  S.focus.max = Math.min(3, S.focus.spells.length + (S.flags.focusPool || 0));
  if (S.focus.max && !S.spellDC) { S.spellDC = 10 + PF.prof(Math.max(1, prof.spell || prof.classDC), L) + A[cls.spellKey || S.key]; S.spellAtk = S.spellDC - 10; }
  // potions & misc
  S.potion = runes.potion; S.potions = 1;
  S.initSkill = def.initSkill || (def.cls === 'rogue' ? 'stealth' : 'perception');
  S.look = def.look || null;
  S.resist = {};
  if (her && her.fx.resist) Object.keys(her.fx.resist).forEach(k => { S.resist[k] = Math.max(1, Math.floor(L / 2)); });
  S.reach = 5;
  return S;
};

/* ---------- unit factories ---------- */
let unitN = 0;
B.unitFromSheet = function (S, team = 'pc') {
  const u = {
    id: 'p' + (++unitN), name: S.name, team, kind: 'pc', level: S.level, size: S.size, sq: PF.SIZE[S.size].sq, traits: S.traits.slice(),
    attr: Object.assign({}, S.attr), hp: S.maxHP, maxHP: S.maxHP, temp: 0,
    speed: { land: S.speed }, st: {
      ac: { base: S.ac.base, item: S.ac.item }, fort: Object.assign({}, S.saves.fort), ref: Object.assign({}, S.saves.ref), will: Object.assign({}, S.saves.will),
      per: Object.assign({}, S.per), skills: U.clone(S.sk), classDC: S.classDC, spellDC: S.spellDC || null, spellAtk: S.spellAtk || null
    },
    ranks: Object.assign({}, S.prof, { skills: Object.assign({}, S.skills) }), dexCap: S.ac.dexCap, armorCat: S.armor.cat, armorName: S.armor.name,
    strikes: U.clone(S.strikes), shield: S.shield ? Object.assign({ cur: S.shield.hp, raised: false, broken: false }, S.shield) : null,
    flags: Object.assign({}, S.flags), acts: S.acts.slice(), feats: S.feats.filter(f => f.id).map(f => f.id),
    focus: S.focus.max ? { max: S.focus.max, cur: S.focus.max, spells: S.focus.spells.slice() } : null,
    spells: S.spells ? U.clone(S.spells) : null, cls: S.cls, sub: S.sub, anc: S.anc,
    resist: Object.assign({}, S.resist), weak: {}, immune: [],
    potions: { n: S.potions, tier: S.potion }, hero: 1, initSkill: S.initSkill, look: S.look, sheet: S,
    glyph: (D.classes[S.cls].name || '?').charAt(0), clsName: S.clsName
  };
  if (u.spells && u.spells.comps) u.comps = u.spells.comps; else u.comps = S.comps.slice();
  return u;
};

B.iconic = function (id, L) {
  const ic = D.iconics[id]; if (!ic) return null;
  return Object.assign(U.clone(ic), { level: L, iconic: id });
};

B.random = function (L, opts = {}) {
  const clsId = opts.cls || U.pick(Object.keys(D.classes));
  const cls = D.classes[clsId];
  const ancId = opts.anc || U.pick(Object.keys(D.ancestries));
  const hers = Object.keys(D.heritages).filter(k => D.heritages[k].anc === ancId);
  const subs = cls.sub ? Object.keys(cls.sub.opts) : [null];
  const sub = U.pick(subs);
  const names = ['Arden', 'Brisa', 'Corvin', 'Dalia', 'Eamon', 'Fenna', 'Garret', 'Hesper', 'Ilsa', 'Jorund', 'Kaela', 'Lorcan', 'Mirela', 'Niall', 'Odette', 'Perrin', 'Quill', 'Rhosyn', 'Sabine', 'Tamsin', 'Ulric', 'Vesna', 'Wren', 'Yara', 'Zoltan', 'Ashra', 'Bodhi', 'Cael', 'Daska', 'Ember'];
  const weaponsBy = {
    fighter: [['longsword', 'steel'], ['greatsword', null], ['glaive', null], ['battleaxe', 'steel'], ['longbow', null], ['warhammer', 'steel']],
    rogue: [['rapier', null], ['shortsword', null], ['dagger', null], ['shortbow', null]],
    ranger: [['longbow', null], ['shortsword', null], ['crossbow', null]],
    barbarian: [['greataxe', null], ['greatsword', null], ['maul', null], ['glaive', null]],
    champion: [['longsword', 'steel'], ['warhammer', 'steel'], ['greatsword', null]],
    monk: [['fist', null]], bard: [['rapier', null], ['shortsword', null]], cleric: [['mace', null], ['morningstar', null]],
    wizard: [['staff', null]], sorcerer: [['staff', null]], druid: [['sickle', null], ['spear', null]]
  };
  const [weapon, shield] = U.pick(weaponsBy[clsId]);
  const attrs = cls.def.attrs.slice();
  if (clsId === 'rogue' && sub === 'ruffian') { attrs.splice(attrs.indexOf('str'), 1); attrs.unshift('str'); }
  if (clsId === 'rogue' && sub === 'scoundrel') { attrs.splice(attrs.indexOf('cha'), 1); attrs.splice(1, 0, 'cha'); }
  if (clsId === 'fighter' && (weapon === 'longbow')) { attrs.splice(attrs.indexOf('dex'), 1); attrs.unshift('dex'); }
  if (clsId === 'ranger' && weapon === 'shortsword') { attrs.splice(attrs.indexOf('str'), 1); attrs.unshift('str'); }
  const deities = { cleric: ['sarenrae', 'pharasma', 'torag', 'desna'], champion: ['iomedae', 'torag'] }[clsId];
  const bgs = Object.keys(D.backgrounds);
  const def = {
    name: U.pick(names), level: L, cls: clsId, anc: ancId, her: U.pick(hers), bg: U.pick(bgs), sub, attrs, weapon, shield,
    deity: deities ? U.pick(deities) : null, key: clsId === 'rogue' ? (sub === 'ruffian' ? 'str' : sub === 'scoundrel' ? 'cha' : 'dex') : undefined,
    look: { body: '#' + Math.floor(0x404040 + U.rand() * 0x9f9f9f).toString(16).padStart(6, '0'), trim: U.pick(['#c8a24a', '#b0c4d8', '#d6825a', '#8fc49a']), acc: U.pick(['none', 'hood', 'helm', 'hat']) }
  };
  if (clsId === 'cleric' && def.deity) def.weapon = U.pick([D.deities[def.deity].weapon, 'mace']);
  if (clsId === 'barbarian' && sub === 'giant') def.weapon = U.pick(['greatsword', 'bastard']);
  if (D.weapons[def.weapon] && D.weapons[def.weapon].kind === 'r') def.melee = clsId === 'fighter' ? 'longsword' : 'shortsword';
  return def;
};
})(typeof window !== 'undefined' ? window : globalThis);
