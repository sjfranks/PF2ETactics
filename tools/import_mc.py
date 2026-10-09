#!/usr/bin/env python3
"""import_mc.py — Foundry pf2e Pathfinder Monster Core pack -> src/data_mc.js

Registers all Monster Core creatures into D.creatures in the record shape used by D.unitFromCreature.
Creature ids are the camelCase of the Foundry slug (file name): goblin-warrior -> goblinWarrior,
diabolic-dragon-young -> diabolicDragonYoung, adamantine-dragon-adult-spellcaster -> adamantineDragonAdultSpellcaster.

Each creature carries abilities: [{id, name, cost, traits, text, auto, spec}] where spec.kind is one of
  flag | regen | fastHeal | aura | follow | affliction | rider | react | area | save | multi | constrict |
  swallow | trample | rend | passive
(see the README block at the top of data_mc.js). Anything we cannot automate keeps auto:false and its text.
Run: python3 tools/import_mc.py   (after tools/import_spells.py)
"""
import json, glob, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pf2text import *  # noqa
import import_spells

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MC_DIR = import_spells.MC_DIR

SIZES = {'tiny': 'tiny', 'sm': 'small', 'med': 'medium', 'lg': 'large', 'huge': 'huge', 'grg': 'gargantuan'}
SIZE_WORD = {'tiny': 'tiny', 'small': 'small', 'medium': 'medium', 'large': 'large', 'huge': 'huge', 'gargantuan': 'gargantuan'}
IMM_MAP = {'death-effects': 'death', 'fear-effects': 'fear', 'critical-hits': 'critical-hits', 'precision': 'precision'}
SKILLS = ['acrobatics', 'arcana', 'athletics', 'crafting', 'deception', 'diplomacy', 'intimidation', 'medicine', 'nature',
          'occultism', 'performance', 'religion', 'society', 'stealth', 'survival', 'thievery']
NUMW = {'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'eight': 8}
SAVES = ('fortitude', 'reflex', 'will')


def first_save_check(html):
    for c in checks(html):
        if c['stat'] in SAVES and c.get('dc'):
            return c
    return None


def strip_heal(parts):
    return [p for p in parts if p['type'] != 'healing']


def split_parts(parts):
    """-> (normal parts, persistent parts) in engine format"""
    norm, pers = [], []
    for p in parts:
        q = {'n': p['n'], 'd': p['d'], 'm': p['m'], 'type': p['type']}
        if p.get('cat') == 'persistent':
            q['persistent'] = True
            pers.append(q)
        elif p['type'] != 'healing':
            norm.append(q)
    return norm, pers


def recharge_of(html):
    m = re.search(r'\[\[/gmr (\d*d\d+) #Recharge', html)
    return m.group(1) if m else None


def freq_of(text):
    m = re.search(r'frequency\s*once per (round|turn|day|hour|minute|10 minutes|\d+ \w+)', text.lower())
    if not m:
        return None
    return 'round' if m.group(1) in ('round', 'turn') else 'battle'


def strip_outc(o, basic):
    if not o:
        return None
    out = {}
    for k, v in o.items():
        v2 = [e for e in v if not ('dmg' in e)]
        if v2:
            out[str(k)] = v2
    return out or None


def dscale_from(o):
    sc = {}
    for k, v in (o or {}).items():
        for e in v:
            if 'dmg' in e:
                sc[int(k)] = e['dmg']
    if not sc:
        return None
    return [sc.get(0, 2 if 1 in sc else 0), sc.get(1, 0), sc.get(2, 0), sc.get(3, 0)]


def outcomes_any(html):
    o = outcomes_from_paras(html)
    if not o:
        o = inline_outcomes(html)
    return o


def burst_range(text):
    t = text.lower()
    for rx in (r'range of (\d+) feet', r'within (\d+) feet', r'up to (\d+) feet away', r'(\d+) feet away'):
        m = re.search(rx, t)
        if m:
            return int(m.group(1))
    if 'adjacent' in t:
        return 5
    return 30


class Ctx:
    def __init__(self, d):
        self.d = d
        self.s = d['system']
        self.lvl = self.s['details']['level']['value']
        self.strikes = [it for it in d['items'] if it['type'] == 'melee']
        self.strike_names = [it['name'].lower() for it in self.strikes]
        self.by_slug = {}
        for it in d['items']:
            if it['type'] == 'action':
                sl = it['system'].get('slug') or slugify(it['name'])
                self.by_slug.setdefault(sl, it)
                self.by_slug.setdefault(slugify(it['name']), it)
        self.referenced = set()   # action ids referenced by attackEffects
        self.flags = set()


def strike_name_match(ctx, words):
    """map a phrase like 'claw' / 'dragon jaws' / 'melee' to a strike name ('*' = any melee)"""
    w = words.strip().lower()
    w = re.sub(r'^(its|their|his|her|the)\s+', '', w)
    if w in ('', 'melee', 'unarmed', 'weapon', 'different', 'separate', 'single', 'normal'):
        return '*'
    if w in ('ranged',):
        return '*ranged'
    for n in ctx.strike_names:
        if w == n or w.rstrip('s') == n.rstrip('s'):
            return n
    for n in ctx.strike_names:
        if w in n or n in w or w.rstrip('s') in n:
            return n
    last = w.split()[-1] if w.split() else w
    for n in ctx.strike_names:
        if last.rstrip('s') in n:
            return n
    return None


# ---------------------------------------------------------------- abilities

def parse_multi(ctx, html, text, cost):
    t = text.lower()
    if re.search(r'\b(leaps?|burrows?|teleports?|interact|armor is broken|falls|descend on|retreat|swallow|grenade|bomb|cast|spell)\b', t):
        return None
    sp = {'kind': 'multi', 'cost': cost}
    req = re.search(r'requirements?(.*?)(effect|$)', t)
    if req:
        r = req.group(1)
        if 'grabbed' in r or 'grabbing' in r:
            sp['req'] = 'grabbed'
        else:
            return None
    if re.search(r'creature (it|they|she|he) (has|is) grab|it has grabbed|it is grabbing|it has a creature grabbed', t):
        sp['req'] = 'grabbed'
    mv = 0
    if re.search(r'strides? twice|strides? up to (double|twice)|flies up to (double|twice)|swims twice|stride twice', t):
        mv = 2
    elif re.search(r'\b(strides?|flies|swims|stride)\b', t):
        mv = 1
    if mv:
        sp['move'] = mv
        m = re.search(r'(?:strides?|flies|swims) up to (\d+) feet', t)
        if m:
            sp['moveFt'] = int(m.group(1))
        m = re.search(r'\+(\d+)-foot circumstance bonus to (its|their) speed', t)
        if m:
            sp['moveFt'] = None
    seq = []
    # "a Strike with its dragon jaws, lion jaws, and goat horns"
    m = re.search(r'strikes? with (?:its|their|his|her) ([a-z ,\'’]+?)(?:,? each|\.|;| at )', t)
    if m and not re.search(r'strike with (its|their) (two|three|four)', t):
        for part in re.split(r',\s*(?:and\s+)?|\s+and\s+', m.group(1)):
            nm = strike_name_match(ctx, part)
            if nm:
                seq.append(nm)
    if not seq:
        for m in re.finditer(r'\b(?:makes?|making|with|and|attempts?)\s+(?:up to\s+)?(a|an|one|two|three|four|five|six|eight|\d+)\s+([a-z\'’ \-]+?)\s+strikes?\b', t):
            n = m.group(1)
            n = int(n) if n.isdigit() else NUMW.get(n, 1)
            words = m.group(2)
            alts = re.split(r'\s+or\s+', words)
            nm = None
            for a in alts:
                nm = strike_name_match(ctx, a)
                if nm:
                    break
            if nm is None:
                continue
            seq += [nm] * min(n, 6)
    if not seq:
        m = re.search(r'makes? (?:a |one |an )?strike', t)
        if m:
            seq = ['*']
        m2 = re.search(r'makes? (two|three|four) strikes', t)
        if m2:
            seq = ['*'] * NUMW[m2.group(1)]
    if re.search(r'against each (creature|enemy|foe) (with)?in (its|their) reach', t):
        seq = (seq or ['*'])[:1] * 4
        sp['diff'] = True
    if re.search(r'up to (its|their) number of heads', t):
        seq = (seq or ['*'])[:1] * 4
    if not seq:
        return None
    sp['seq'] = seq[:6]
    if re.search(r'different (target|creature|foe|enemies)|each (targeting|against) a different', t):
        sp['diff'] = True
    if re.search(r"(penalty|it) (doesn't|does not|don't) increase (the )?until", t) or 'penalty increases only after' in t:
        sp['hold'] = True
    m = re.search(r'counts? (?:as )?(?:only )?(one|two|three|four) attacks?', t)
    if m:
        sp['mapCount'] = NUMW[m.group(1)]
        sp['hold'] = True
    m = re.search(r'(?:each )?at a [–-](\d) penalty', t)
    if m:
        sp['pen'] = -int(m.group(1))
    m = re.search(r'\+(\d) circumstance bonus to (?:its |their |the )?attack', t)
    if m:
        sp['atk'] = int(m.group(1))
    m = re.search(r'\+(\d) circumstance bonus to damage', t)
    if m:
        sp['dmg'] = int(m.group(1))
    m = re.search(r'compares? the attack roll (?:result )?to the ac(?:s)? of up to (two|three|four)', t)
    if m:
        sp['swipe'] = NUMW[m.group(1)]
        sp['seq'] = sp['seq'][:1]
    m = re.search(r'(?:if (?:it|the strike|the attack|the claw|either strike) hits|on a hit)[,]? (.*?)(?:\.|$)', t)
    if m:
        eff = effects_in(m.group(1), False)
        eff = [e for e in eff if ('c' in e or 'push' in e)]
        if 'grab' in m.group(1) and not any(e.get('c') == 'grabbed' for e in eff):
            eff.append({'c': 'grabbed', 'v': 1, 'dur': {'k': 'eont'}})
        if eff:
            sp['onHit'] = eff
    return sp


def parse_area(ctx, html, text, cost):
    tp = templates(html)
    if not tp:
        return None
    t0 = tp[0]
    shp = t0['t']
    r = t0['r'] or 5
    if shp in ('cylinder', 'cube', 'square'):
        shp = 'burst'
        r = max(5, r // 2) if t0['t'] != 'cylinder' else r
    if shp not in ('burst', 'cone', 'line', 'emanation'):
        return None
    chk = first_save_check(html)
    dm = strip_heal(damages(html))
    if not chk and not dm:
        return None
    norm, pers = split_parts(dm)
    sp = {'kind': 'area', 'cost': cost, 'shape': {'t': shp, 'r': r}}
    if shp == 'burst':
        sp['shape']['range'] = burst_range(text)
    if chk:
        sp['save'] = SAVE_MAP[chk['stat']]
        sp['dc'] = chk['dc']
        if chk['basic']:
            sp['basic'] = True
    outc = outcomes_any(html)
    if norm:
        sp['dmg'] = norm
        if sp.get('save') and not sp.get('basic'):
            ds = dscale_from(outc)
            if ds:
                sp['dscale'] = ds
            else:
                sp['basic'] = True
    if pers:
        sp['pdmg'] = pers
    oc = strip_outc(outc, sp.get('basic'))
    if oc:
        sp['outc'] = oc
    if not norm and not pers and not oc:
        return None
    if not sp.get('save') and not norm:
        return None
    rc = recharge_of(html)
    if rc:
        sp['recharge'] = rc
    fq = freq_of(text)
    if fq:
        sp['freq'] = fq
    tl = text.lower()
    if re.search(r'\beach enemy|\benemies in|non-[a-z]+ (creature|within)|\bfoes? in', tl):
        sp['foesOnly'] = True
    if re.search(r'each living creature|living creatures in', tl):
        sp['living'] = True
    if re.search(r'requirements?', tl) and not re.search(r'requirements?[^.]*grabbed', tl):
        return None
    return sp


def parse_save_ability(ctx, html, text, cost):
    chk = first_save_check(html)
    if not chk:
        return None
    tl = text.lower()
    if re.search(r'requirements?', tl) and not re.search(r'requirements?[^.]*(grabbed|restrained)', tl):
        return None
    if re.search(r'possess|soul|dies|instantly die|curse|dream|telepath|disguise|item|weapon|object|hour|day', tl) and not re.search(r'damage', tl):
        return None
    dm = strip_heal(damages(html))
    norm, pers = split_parts(dm)
    sp = {'kind': 'save', 'cost': cost, 'save': SAVE_MAP[chk['stat']], 'dc': chk['dc']}
    if chk['basic']:
        sp['basic'] = True
    if re.search(r'(has|have) (a |at least one )?creatures? grabbed|creature (it|they) (has|have) grabbed|grabbed or restrained|grabbed creature|it is grabbing', tl):
        sp['targets'] = 'grabbed'
    elif re.search(r"swarm's space|each adjacent|adjacent (creature|enemy|enemies|foe)s?|within (its|their) (melee )?reach", tl):
        sp['targets'] = 'adjacent'
    elif re.search(r'(each|all|every) (\w+ )?(creature|enemy|enemies|foe)s? within (\d+) feet', tl):
        sp['targets'] = 'all'
        sp['range'] = int(re.search(r'within (\d+) feet', tl).group(1))
    else:
        sp['targets'] = 'one'
        m = re.search(r'within (\d+) feet|up to (\d+) feet away|(\d+) feet away', tl)
        sp['range'] = int(next(g for g in m.groups() if g)) if m else (5 if re.search(r'touch|adjacent|bite|kiss|embrace', tl) else 30)
    outc = outcomes_any(html)
    if norm:
        sp['dmg'] = norm
        if not sp.get('basic'):
            ds = dscale_from(outc)
            if ds:
                sp['dscale'] = ds
            else:
                sp['basic'] = True
    if pers:
        sp['pdmg'] = pers
    oc = strip_outc(outc, sp.get('basic'))
    if oc:
        sp['outc'] = oc
    if not norm and not pers and not oc:
        return None
    rc = recharge_of(html)
    if rc:
        sp['recharge'] = rc
    fq = freq_of(text)
    if fq:
        sp['freq'] = fq
    if 'living creature' in tl:
        sp['living'] = True
    return sp


def parse_affliction(html, name, traits):
    chk = first_save_check(html)
    stages = []
    for m in re.finditer(r'<strong>\s*Stage (\d+)\s*</strong>(.*?)(?=</p>|<p>|<strong>\s*Stage|$)', html, re.S):
        seg = m.group(2)
        txt = clean(seg).lower()
        dm = strip_heal(damages(seg))
        norm, pers = split_parts(dm)
        conds = [c for c in conds_in(txt) if c['c'] not in ('controlled',)]
        long_ = bool(re.search(r'\((?:\d+|one) (minute|hour|day|week)s?\)|every (hour|day)', txt))
        if 'every hour' in txt or 'every day' in txt:
            norm, pers = [], []
        st = {'dmg': norm + pers, 'conds': conds}
        if long_:
            st['long'] = True
        stages.append(st)
    if not stages:
        return None
    tl = clean(html).lower()
    md = None
    m = re.search(r'maximum duration\s*(\d+) (round|minute|hour|day)s?', tl)
    if m:
        n = int(m.group(1))
        md = n if m.group(2) == 'round' else (n * 10 if m.group(2) == 'minute' else None)
    nl = name.lower()
    kind = 'curse' if 'curse' in traits else 'disease' if ('disease' in traits or re.search(r'fever|plague|rot|pox|weeps|pestilence|sickness', nl)) else 'poison'
    return {'kind': kind, 'save': SAVE_MAP.get(chk['stat'], 'fort') if chk else 'fort', 'dc': chk['dc'] if chk else 10 + 0, 'maxDur': md,
            'stages': stages, 'traits': traits}


def parse_rider(html, text, traits):
    chk = first_save_check(html)
    dm = damages(html)
    heal = [p for p in dm if p['type'] == 'healing']
    norm, pers = split_parts(dm)
    tl = text.lower()
    sp = {'traits': traits}
    if chk:
        sp['save'] = SAVE_MAP[chk['stat']]
        sp['dc'] = chk['dc']
        if chk['basic']:
            sp['basic'] = True
    if norm or pers:
        sp['dmg'] = norm + pers
    oc = strip_outc(outcomes_any(html), sp.get('basic'))
    if oc and chk:
        sp['outc'] = oc
    if heal and heal[0]['n'] == 0:
        sp['heal'] = heal[0]['m']
    m = re.search(r'gains? (\d+) temporary hit points', tl)
    if m:
        sp['temp'] = int(m.group(1))
    if re.search(r'regains? (an equal number|hit points equal to (the|half the) damage)', tl):
        sp['drainHeal'] = True
    first = tl.split('.')[0]
    if re.search(r'critical(ly)? hit', first):
        sp['crit'] = True
    if re.search(r'damaged by|damages', first):
        sp['needDmg'] = True
    if 'living creature' in first:
        sp['living'] = True
    if re.search(r'temporarily immune', tl):
        sp['once'] = True
    if not chk and not norm and not pers:
        return None
    if chk and not oc and not norm and not pers:
        return None
    if re.search(r'curse|weakness to|can\'t regain|release|soul|die\b|dies\b|instantly', tl) and not oc:
        return None
    return sp


def parse_reaction(ctx, html, text, name):
    tl = text.lower()
    m = re.search(r'trigger\s*(.*?)\s*effect\s*(.*)$', tl, re.S)
    if not m:
        return None
    trig, eff = m.group(1), m.group(2)
    tg = None
    if re.search(r'critically hit(s)? (by|with) (a |an |any )?melee', trig) or 'critically hit with a melee' in trig:
        tg = 'critMelee'
    elif re.search(r'(is )?critically hit', trig) or 'critically hits' in trig:
        tg = 'crit'
    elif re.search(r'critically fails a melee', trig):
        tg = 'critFailMelee'
    elif re.search(r'adjacent (enemy|creature) damages', trig):
        tg = 'damagedAdj'
    elif re.search(r'(successfully )?damages the [\w\s]+ with a( melee)? strike|hits the [\w\s]+ with a melee', trig):
        tg = 'damagedInReach'
    elif re.search(r'hits or touches', trig):
        tg = 'hitMelee'
    elif re.search(r'ends its turn adjacent', trig):
        tg = 'endTurnAdj'
    elif re.search(r'(uses a move action|leaves a square)', trig) and 'within reach' in trig or re.search(r'moves from beyond the reach', trig):
        sn = None
        mm = re.search(r'within reach of (?:the [\w\s]+?\'s|its|their) (\w+)', trig)
        if mm:
            sn = strike_name_match(ctx, mm.group(1))
        mm = re.search(r'makes? a (\w+) strike', eff)
        if mm and not sn:
            sn = strike_name_match(ctx, mm.group(1))
        return {'kind': 'flag', 'flag': 'reactiveStrike', 'rsOnly': [sn] if sn and sn != '*' else None, 'rsMoveOnly': True}
    if not tg:
        return None
    chk = first_save_check(html)
    if 'recharge' in eff and re.search(r'breath|recharges', eff):
        return {'kind': 'react', 'trig': tg, 'eff': {'kind': 'recharge'}}
    if chk:
        r = parse_rider(html, eff, [])
        if not r:
            return None
        r['kind'] = 'save'
        r.pop('crit', None)
        r.pop('needDmg', None)
        return {'kind': 'react', 'trig': tg, 'eff': r}
    mm = re.search(r'makes? (?:a |one )?([\w\s]*?) strike', eff) or re.search(r'attempts? to strike', eff)
    if mm:
        sn = strike_name_match(ctx, mm.group(1)) if mm.groups() else '*'
        e = {'kind': 'strike'}
        if sn and sn not in ('*', '*ranged'):
            e['strike'] = sn
        pm = re.search(r'with a [–-](\d) penalty', eff)
        if pm:
            e['pen'] = -int(pm.group(1))
        dm = re.search(r'additional (\d+)d(\d+) damage', eff)
        if dm:
            e['extra'] = [{'n': int(dm.group(1)), 'd': int(dm.group(2)), 'm': 0, 'type': 'untyped'}]
        if re.search(r'teleport|redirect|swap|instead', eff):
            return None
        return {'kind': 'react', 'trig': tg, 'eff': e}
    return None


def glossary_key(html):
    m = re.search(r'@Localize\[PF2E\.NPC\.Abilities\.Glossary\.(\w+)\]', html)
    return m.group(1) if m else None


def parse_ability(ctx, it):
    sy = it['system']
    html = sy['description']['value'] or ''
    name = it['name']
    at = sy['actionType']['value']
    nact = sy['actions']['value']
    cost = {'action': str(nact or 1), 'reaction': 'reaction', 'free': 'free', 'passive': 'passive'}.get(at, 'passive')
    traits = list(sy['traits']['value'])
    slug = sy.get('slug') or slugify(name)
    gk = glossary_key(html)
    text = clean(html)
    rules = sy.get('rules') or []
    nm = name.lower()
    sp = None
    auto = False
    ncost = int(nact) if (at == 'action' and nact) else 1

    def done(spec, ok=True):
        return spec, ok

    # ---- glossary abilities
    if gk == 'ReactiveStrike' or slug in ('reactive-strike', 'attack-of-opportunity'):
        m = re.search(r'\((\w+) only\)', nm)
        sn = strike_name_match(ctx, m.group(1)) if m else None
        sp = {'kind': 'flag', 'flag': 'reactiveStrike'}
        if sn and sn != '*':
            sp['rsOnly'] = [sn]
        return sp, True, text
    if gk == 'Ferocity':
        return {'kind': 'flag', 'flag': 'ferocity'}, True, text
    if gk in ('Grab', 'Knockdown', 'Push'):
        if gk == 'Push':
            m = re.search(r'(\d+) feet', nm)
            ctx.push_ft = int(m.group(1)) if m else 5
        return {'kind': 'follow', 'follow': {'Grab': 'mGrab', 'Knockdown': 'mKnock', 'Push': 'mPush'}[gk]}, True, text
    if gk in ('ImprovedGrab', 'ImprovedKnockdown', 'ImprovedPush'):
        if gk == 'ImprovedPush':
            m = re.search(r'(\d+) feet', nm)
            ctx.push_ft = int(m.group(1)) if m else 5
        return {'kind': 'passive', 'note': 'strike rider'}, True, text
    if gk in ('Constrict', 'GreaterConstrict'):
        dm, _ = split_parts(strip_heal(damages(html)))
        chk = first_save_check(html)
        if dm and chk:
            return {'kind': 'constrict', 'cost': 1, 'dmg': dm, 'dc': chk['dc'], 'greater': gk == 'GreaterConstrict'}, True, text
        return None, False, text
    if gk == 'SwallowWhole':
        dm, _ = split_parts(strip_heal(damages(html)))
        m = re.match(r'\s*(tiny|small|medium|large|huge|gargantuan)', text.lower())
        if dm:
            return {'kind': 'swallow', 'cost': 1, 'dmg': dm, 'size': m.group(1) if m else 'medium'}, True, text
        return None, False, text
    if gk == 'Trample':
        tl = text.lower()
        m = re.match(r'\s*(tiny|small|medium|large|huge|gargantuan)(?: or smaller)?,\s*([a-z ]+?),', tl)
        chk = first_save_check(html)
        if m and chk:
            sn = strike_name_match(ctx, m.group(2)) or '*'
            return {'kind': 'trample', 'cost': 3, 'size': m.group(1), 'strike': sn if sn != '*' else '', 'dc': chk['dc']}, True, text
        return None, False, text
    if gk == 'Rend':
        first = clean(html.split('<hr')[0]).strip().lower()
        sn = strike_name_match(ctx, first) or first
        return {'kind': 'rend', 'cost': 1, 'strike': sn}, True, text
    if gk == 'FrightfulPresence' or gk == 'Stench':
        chk = first_save_check(html)
        r = next((x.get('radius') for x in rules if x.get('key') == 'Aura'), None)
        if not r:
            m = re.search(r'(\d+) feet', text)
            r = int(m.group(1)) if m else 30
        if chk:
            return {'kind': 'aura', 'aura': {'kind': 'fear' if gk == 'FrightfulPresence' else 'stench', 'r': int(r), 'dc': chk['dc'], 'save': SAVE_MAP[chk['stat']], 'traits': traits}}, True, text
        return None, False, text
    if gk == 'Regeneration' or gk == 'FastHealing' or any(x.get('key') == 'FastHealing' for x in rules):
        fh = next((x for x in rules if x.get('key') == 'FastHealing'), None)
        if fh and isinstance(fh.get('value'), int):
            pred = fh.get('predicate') or []
            if any(isinstance(p, str) and p != 'fast-healing' for p in pred):
                return None, False, text
            if fh.get('type') == 'regeneration':
                return {'kind': 'regen', 'v': fh['value'], 'off': fh.get('deactivatedBy') or []}, True, text
            return {'kind': 'fastHeal', 'v': fh['value']}, True, text
        return None, False, text
    if gk == 'NegativeHealing' or nm == 'void healing':
        return {'kind': 'flag', 'flag': 'voidHealing'}, True, text
    if gk == 'ThrowRock':
        return {'kind': 'passive', 'note': 'rock Strike'}, True, text
    if gk == 'ShieldBlock':
        return {'kind': 'flag', 'flag': 'shieldBlock'}, True, text
    if gk == 'SwarmMind':
        return {'kind': 'passive', 'note': 'immune to mental'}, True, text
    if gk == 'AllAroundVision':
        return {'kind': 'flag', 'flag': 'denyAdvantage'}, True, text
    if gk:
        return None, False, text
    # ---- save modifiers
    fm = [x for x in rules if x.get('key') == 'FlatModifier']
    if fm and re.search(r'saves|saving', nm):
        return {'kind': 'passive', 'note': 'save bonus'}, True, text
    # ---- recognised named passives
    if 'draconic momentum' in nm or (at == 'passive' and re.search(r'recharges? (their|its) [\w\s]+ whenever (they|it) scores? a critical hit', text.lower())):
        return {'kind': 'flag', 'flag': 'momentum'}, True, text
    if nm.startswith('pack attack'):
        dd = next((x for x in rules if x.get('key') == 'DamageDice'), None)
        n, d = (dd.get('diceNumber', 1), int(str(dd.get('dieSize', 'd4'))[1:])) if dd else (1, 4)
        return {'kind': 'flag', 'flag': 'packAttack', 'n': n, 'd': d}, True, text
    if nm.startswith('sneak attack'):
        dd = next((x for x in rules if x.get('key') == 'DamageDice'), None)
        m = re.search(r'(\d+)d6 extra precision', text)
        n = dd.get('diceNumber', 1) if dd else (int(m.group(1)) if m else 1)
        return {'kind': 'flag', 'flag': 'mSneak', 'dice': n}, True, text
    if nm == 'slow' and 'slowed 1' in text.lower():
        return {'kind': 'flag', 'flag': 'zombieSlow'}, True, text
    if gk is None and re.match(r'^(greater darkvision|darkvision|low-light vision|tremorsense|lifesense|scent|wavesense|thoughtsense|smoke vision|telepathy)', nm):
        return {'kind': 'passive', 'note': 'sense'}, False, text
    if nm == 'steady spellcasting':
        return {'kind': 'flag', 'flag': 'steadySpellcasting'}, True, text
    if nm == 'formation':
        return {'kind': 'flag', 'flag': 'formation'}, True, text
    # ---- afflictions
    if re.search(r'<strong>\s*Stage \d', html):
        a = parse_affliction(html, name, traits)
        if a:
            return {'kind': 'affliction', 'aff': a}, None, text   # auto decided by references
        return None, False, text
    # ---- auras
    is_aura = 'aura' in traits or any(x.get('key') == 'Aura' for x in rules)
    if is_aura and at == 'passive':
        r = next((x.get('radius') for x in rules if x.get('key') == 'Aura'), None)
        if not r:
            m = re.search(r'(\d+) feet', text)
            r = int(m.group(1)) if m else 10
        chk = first_save_check(html)
        dm = strip_heal(damages(html))
        norm, pers = split_parts(dm)
        tl = text.lower()
        if norm or pers:
            a = {'kind': 'dmg', 'r': int(r), 'dmg': norm + pers, 'traits': traits}
            if chk:
                a['save'] = SAVE_MAP[chk['stat']]
                a['dc'] = chk['dc']
            else:
                a['dc'] = 0
            return {'kind': 'aura', 'aura': a}, True, text
        if chk:
            oc = strip_outc(outcomes_any(html), False)
            if oc and not re.search(r'subject to|spell|telepath|allies in the aura', tl):
                a = {'kind': 'cond', 'r': int(r), 'save': SAVE_MAP[chk['stat']], 'dc': chk['dc'], 'outc': oc, 'traits': traits}
                if 'temporarily immune' not in tl and 'until it succeeds' not in tl:
                    a['mode'] = 'once' if 'first' in tl else None
                return {'kind': 'aura', 'aura': a}, True, text
        return None, False, text
    # ---- reactions
    if at == 'reaction':
        r = parse_reaction(ctx, html, text, name)
        if r:
            return r, True, text
        return None, False, text
    # ---- passive strike riders (referenced from attackEffects)
    if at == 'passive':
        if '@Check' in html or '@Damage' in html:
            r = parse_rider(html, text, traits)
            if r:
                return {'kind': 'rider', 'rider': r}, None, text
        return None, False, text
    # ---- actions
    if at in ('action', 'free') and ncost <= 3:
        tl = text.lower()
        if '@Template' in html:
            sp = parse_area(ctx, html, text, ncost)
            if sp:
                return sp, True, text
        if re.search(r'\bstrikes?\b', tl) and not re.search(r'@check', html.lower()):
            sp = parse_multi(ctx, html, text, ncost)
            if sp:
                return sp, True, text
        if '@Check' in html and '@Template' not in html:
            if re.search(r'\bstrikes?\b', tl) and re.search(r'makes? (a|an|one|two|three)? ?[\w\s]*strikes?', tl):
                return None, False, text
            sp = parse_save_ability(ctx, html, text, ncost)
            if sp:
                return sp, True, text
    return None, False, text


# ---------------------------------------------------------------- strikes

def build_strikes(ctx, abil_by_slug, improved, push_ft):
    out = []
    for it in ctx.strikes:
        sy = it['system']
        parts = []
        for k, v in (sy.get('damageRolls') or {}).items():
            p = parse_formula(str(v.get('damage', '')))
            if not p:
                continue
            p['type'] = v.get('damageType') or 'untyped'
            if v.get('category') == 'persistent' or p['type'] == 'bleed':
                p['persistent'] = True
            elif v.get('category') == 'splash':
                p['splash'] = True
            elif v.get('category') == 'precision':
                p['precision'] = True
            parts.append(p)
        if not parts:
            parts = [{'n': 1, 'd': 4, 'm': 0, 'type': 'bludgeoning'}]
        PH = ('bludgeoning', 'piercing', 'slashing')

        def score(p):
            if p.get('persistent') or p.get('splash'):
                return -1000
            return (p['n'] * (p['d'] + 1) / 2 + p['m']) + (5 if p['type'] in PH else 0) + (3 if p['m'] else 0)
        parts.sort(key=score, reverse=True)
        traits = list(sy['traits']['value'])
        rng = sy.get('range') or None
        kind = 'ranged' if rng and rng.get('increment') else 'melee'
        reach = 0
        if kind == 'melee':
            reach = 5
            for t in traits:
                m = re.match(r'^reach-(\d+)$', t)
                if m:
                    reach = max(5, int(m.group(1)))
                elif t == 'reach':
                    reach = 10
        reload = 0
        for t in traits:
            m = re.match(r'^reload-(\d+)$', t)
            if m:
                reload = int(m.group(1))
        eff = []
        for a in sy.get('attackEffects', {}).get('value', []) or []:
            if a in ('grab',):
                eff.append('igrab' if 'grab' in improved else 'mgrab')
            elif a == 'improved-grab':
                eff.append('igrab')
            elif a == 'knockdown':
                eff.append('iknock' if 'knockdown' in improved else 'mknock')
            elif a == 'improved-knockdown':
                eff.append('iknock')
            elif a == 'push':
                eff.append(('ipush:' if 'push' in improved else 'mpush:') + str(push_ft))
            elif a == 'improved-push':
                eff.append('ipush:' + str(push_ft))
            elif a == 'push-or-pull-10-feet':
                eff.append('mpush:10')
            else:
                ab = abil_by_slug.get(a)
                if ab:
                    if ab['spec'] and ab['spec']['kind'] == 'affliction':
                        eff.append('aff:' + ab['id'])
                        ab['auto'] = True
                    elif ab['spec'] and ab['spec']['kind'] == 'rider':
                        eff.append('rider:' + ab['id'])
                        ab['auto'] = True
                    elif ab['spec'] and ab['spec']['kind'] == 'follow':
                        eff.append({'mGrab': 'mgrab', 'mKnock': 'mknock', 'mPush': 'mpush:5'}[ab['spec']['follow']])
                    else:
                        eff.append('note:' + a)
                else:
                    eff.append('note:' + a)
        out.append({'name': it['name'], 'kind': kind, 'bonus': sy['bonus']['value'], 'dmg': parts, 'traits': traits,
                    'range': (rng or {}).get('increment') or 0, 'reach': reach, 'w': bool((it.get('flags') or {}).get('pf2e', {}).get('linkedWeapon')),
                    'eff': eff, 'reload': reload, 'qty': None, 'agile': 'agile' in traits})
    # melee first
    out.sort(key=lambda s: 0 if s['kind'] == 'melee' else 1)
    return out


# ---------------------------------------------------------------- spellcasting

def build_casting(ctx, spell_ids, spell_auto):
    d = ctx.d
    entries = []
    items = {it['_id']: it for it in d['items']}
    sp_items = [it for it in d['items'] if it['type'] == 'spell']
    unknown = []
    for e in [it for it in d['items'] if it['type'] == 'spellcastingEntry']:
        sy = e['system']
        kind = sy['prepared']['value']
        if kind not in ('prepared', 'spontaneous', 'innate', 'focus'):
            continue
        dc = (sy.get('spelldc') or {}).get('dc') or 10
        atk = (sy.get('spelldc') or {}).get('value') or 0
        trad = sy['tradition']['value'] or 'arcane'
        mine = [it for it in sp_items if (it['system'].get('location') or {}).get('value') == e['_id']]
        slots = sy.get('slots') or {}
        maxr = max([int(k[4:]) for k, v in slots.items() if k.startswith('slot') and int(v.get('max') or 0) > 0 and int(k[4:]) > 0] or [0])
        cr = (sy.get('autoHeightenLevel') or {}).get('value') or maxr or max(1, (ctx.lvl + 1) // 2)
        E = {'name': e['name'], 'kind': kind, 'trad': trad, 'dc': dc, 'atk': atk, 'cantripRank': max(1, min(10, cr)), 'cantrips': [], 'listed': []}

        def sid_of(it):
            sl = it['system'].get('slug') or slugify(re.sub(r'\s*\(.*\)$', '', it['name']))
            return camel(sl)

        def known(sid, it):
            if sid in spell_ids:
                return True
            unknown.append(it['name'])
            return False
        if kind == 'prepared':
            E['prepared'] = []
            for k, v in slots.items():
                if not k.startswith('slot'):
                    continue
                r = int(k[4:])
                for p in v.get('prepared') or []:
                    it = items.get(p.get('id'))
                    if not it:
                        continue
                    sid = sid_of(it)
                    E['listed'].append(it['name'])
                    if not known(sid, it):
                        continue
                    if r == 0 or 'cantrip' in it['system']['traits']['value']:
                        if sid not in E['cantrips']:
                            E['cantrips'].append(sid)
                    else:
                        E['prepared'].append({'id': sid, 'rank': r})
        elif kind == 'spontaneous':
            E['slots'] = {}
            for k, v in slots.items():
                if k.startswith('slot') and int(k[4:]) > 0 and int(v.get('max') or 0) > 0:
                    E['slots'][str(int(k[4:]))] = int(v['max'])
            E['rep'] = []
            E['sig'] = []
            for it in mine:
                sid = sid_of(it)
                E['listed'].append(it['name'])
                if not known(sid, it):
                    continue
                loc = it['system'].get('location') or {}
                if 'cantrip' in it['system']['traits']['value']:
                    if sid not in E['cantrips']:
                        E['cantrips'].append(sid)
                    continue
                r = loc.get('heightenedLevel') or it['system']['level']['value']
                E['rep'].append({'id': sid, 'rank': r})
                if loc.get('signature'):
                    E['sig'].append(sid)
            # without explicit signatures, let each spell be heightened from its known rank (Foundry lists heightened copies)
        elif kind == 'innate':
            E['innate'] = []
            for it in mine:
                nm = it['name']
                sid = sid_of(it)
                E['listed'].append(nm)
                if re.search(r'\(constant', nm, re.I):
                    continue
                if not known(sid, it):
                    continue
                loc = it['system'].get('location') or {}
                lv = it['system']['level']['value']
                if 'cantrip' in it['system']['traits']['value']:
                    E['innate'].append({'id': sid, 'rank': loc.get('heightenedLevel') or max(1, (ctx.lvl + 1) // 2), 'uses': 99})
                    continue
                uses = (loc.get('uses') or {}).get('max') or (99 if re.search(r'at will', nm, re.I) else 1)
                E['innate'].append({'id': sid, 'rank': loc.get('heightenedLevel') or lv, 'uses': uses})
        elif kind == 'focus':
            E['focus'] = []
            for it in mine:
                sid = sid_of(it)
                E['listed'].append(it['name'])
                if not known(sid, it):
                    continue
                if 'cantrip' in it['system']['traits']['value']:
                    E['cantrips'].append(sid)
                else:
                    E['focus'].append(sid)
            E['focusRank'] = max(1, (ctx.lvl + 1) // 2)
        entries.append(E)
    return entries, unknown


# ---------------------------------------------------------------- creature

THEME_BY_TRAIT = [('goblin', 'goblin'), ('hobgoblin', 'goblin'), ('bugbear', 'goblin'), ('kobold', 'kobold'), ('orc', 'orc'),
                  ('undead', 'undead'), ('animal', 'beast'), ('beast', 'beast'), ('dinosaur', 'beast'), ('dragon', 'dragon'),
                  ('giant', 'giant'), ('troll', 'giant'), ('fiend', 'fiend'), ('celestial', 'celestial'), ('fey', 'fey'),
                  ('elemental', 'elemental'), ('aberration', 'aberration'), ('construct', 'construct'), ('humanoid', 'humanoid'),
                  ('plant', 'plant'), ('fungus', 'plant'), ('leshy', 'plant'), ('swarm', 'swarm'), ('aquatic', 'aquatic'),
                  ('amphibious', 'aquatic'), ('ooze', 'ooze'), ('monitor', 'monitor'), ('spirit', 'undead')]


def themes_of(traits, name):
    th = []
    for t, k in THEME_BY_TRAIT:
        if t in traits and k not in th:
            th.append(k)
    nl = name.lower()
    if 'fire' in traits or 'fire' in nl:
        th.append('fire')
    if 'human' in traits and 'humanoid' in traits and ('bandit' in nl or 'thug' in nl or 'guard' in nl):
        th.append('bandit')
    if not th:
        th.append('humanoid')
    return th


def shape_of(traits, size, speed, name):
    nl = name.lower()
    if 'dragon' in traits:
        return 'dragon'
    if 'skeleton' in traits:
        return 'skeleton'
    if 'zombie' in traits or 'ghoul' in traits or 'mummy' in traits:
        return 'zombie'
    if 'giant' in traits or 'troll' in traits or ('humanoid' in traits and size in ('large', 'huge', 'gargantuan')):
        return 'giant'
    if speed.get('fly') and ('fiend' in traits or 'celestial' in traits or 'humanoid' in traits):
        return 'winged'
    if 'animal' in traits or 'beast' in traits or 'dinosaur' in traits or 'swarm' in traits or 'ooze' in traits:
        return 'rat' if size in ('tiny',) else 'beast'
    if 'humanoid' in traits and size in ('small', 'tiny'):
        return 'small'
    if speed.get('fly'):
        return 'winged'
    return 'humanoid'


COLOR = {'undead': '#9a9a86', 'dragon': '#9a3a2a', 'fiend': '#7a2a2a', 'celestial': '#d8c27a', 'fey': '#6aa86a', 'elemental': '#5a6a7a',
         'aberration': '#6a4a7a', 'construct': '#8c867a', 'plant': '#4f7a3a', 'beast': '#7a6a52', 'goblin': '#6f8a3b', 'kobold': '#a2552f',
         'orc': '#5f7040', 'giant': '#a07a56', 'swarm': '#5a5048', 'aquatic': '#3a6a8a', 'ooze': '#6a8a3a', 'humanoid': '#8a6a4a', 'monitor': '#6a6a8a'}


def describe(c, abilities):
    bits = []
    sz = c['size']
    main = next((t for t in ('dragon', 'undead', 'fiend', 'celestial', 'fey', 'elemental', 'aberration', 'construct', 'giant', 'animal', 'beast',
                             'plant', 'ooze', 'swarm', 'humanoid', 'monitor', 'spirit') if t in c['traits']), 'creature')
    mv = []
    sp = c['speed']
    if sp.get('fly'):
        mv.append('flies')
    if sp.get('swim'):
        mv.append('swims')
    if sp.get('burrow'):
        mv.append('burrows')
    hl = []
    for a in abilities:
        s = a.get('spec') or {}
        k = s.get('kind')
        if k == 'area' and s.get('recharge'):
            hl.append('a %d-foot %s %s' % (s['shape']['r'], s['shape']['t'], 'breath' if 'breath' in a['name'].lower() else 'blast'))
        elif k == 'aura' and s['aura']['kind'] == 'fear':
            hl.append('a frightening aura')
        elif k == 'aura':
            hl.append('a harmful aura')
        elif k == 'affliction' and a.get('auto'):
            hl.append('a ' + s['aff']['kind'])
        elif k == 'regen':
            hl.append('regeneration')
        elif k == 'swallow':
            hl.append('can swallow prey')
        elif k == 'trample':
            hl.append('tramples')
        elif k == 'follow' and s['follow'] == 'mGrab':
            hl.append('grabs')
    if c.get('casting'):
        hl.append('spellcasting')
    hl2 = []
    for h in hl:
        if h not in hl2:
            hl2.append(h)
    s = '%s %s' % (sz.capitalize(), main)
    if mv:
        s += ' that ' + ' and '.join(mv)
    if hl2:
        s += (', with ' if mv else ' with ') + ', '.join(hl2[:4])
    return s + '.'


def build_creature(path, spell_ids, spell_auto):
    d = json.load(open(path))
    s = d['system']
    slug = os.path.basename(path)[:-5]
    cid = camel(slug)
    ctx = Ctx(d)
    ctx.push_ft = 5
    size = SIZES.get(s['traits']['size']['value'], 'medium')
    traits = list(s['traits']['value'])
    attr = {k: (s['abilities'].get(k) or {}).get('mod', 0) for k in ('str', 'dex', 'con', 'int', 'wis', 'cha')}
    sv = s['saves']
    spd = s['attributes']['speed']
    speed = {'land': spd.get('value') or 0}
    for o in spd.get('otherSpeeds') or []:
        if o.get('type') in ('fly', 'swim', 'climb', 'burrow'):
            speed[o['type']] = o.get('value') or 0
    aquatic = False
    if not speed['land']:
        if speed.get('swim') and not speed.get('fly'):
            aquatic = True
            speed['land'] = 5
        elif not speed.get('fly'):
            speed['land'] = speed.get('burrow') or speed.get('climb') or 5
    if 'aquatic' in traits and speed.get('swim') and not speed.get('fly') and speed['land'] <= 10:
        aquatic = True
        speed['land'] = max(5, speed['land'])
    skills = {}
    for k, v in (s.get('skills') or {}).items():
        if k in SKILLS:
            skills[k] = v.get('base', 0)
    attrs = s['attributes']
    resist, resistX, weak, immune = {}, {}, {}, []
    for x in attrs.get('resistances') or []:
        t = 'all' if x['type'] == 'all-damage' else x['type']
        resist[t] = x.get('value') or 0
        ex = [e if isinstance(e, str) else e.get('label', '') for e in (x.get('exceptions') or [])]
        dv = [e if isinstance(e, str) else '' for e in (x.get('doubleVs') or [])]
        if ex or dv:
            resistX[t] = {}
            if ex:
                resistX[t]['except'] = ex
            if dv:
                resistX[t]['double'] = dv
    for x in attrs.get('weaknesses') or []:
        weak[x['type']] = x.get('value') or 0
    for x in attrs.get('immunities') or []:
        immune.append(IMM_MAP.get(x['type'], x['type']))
    if 'mindless' in traits and 'mental' not in immune:
        pass
    if 'swarm-mind' in immune and 'mental' not in immune:
        immune.append('mental')
    # save modifiers from rule elements
    saveMods = []
    for it in d['items']:
        for r in it['system'].get('rules') or []:
            if r.get('key') != 'FlatModifier':
                continue
            sel = r.get('selector')
            sels = sel if isinstance(sel, list) else [sel]
            sm = {'saving-throw': 'save', 'fortitude': 'fort', 'reflex': 'ref', 'will': 'will'}
            if not all(x in sm for x in sels):
                continue
            pred = r.get('predicate') or []
            vs = []
            ok = True
            for p in pred:
                if isinstance(p, str):
                    if p == 'item:magical':
                        vs.append('magical')
                    elif p.startswith('item:trait:'):
                        vs.append(p[11:])
                    elif p.startswith('origin:trait:'):
                        vs.append(p[13:])
                    elif re.match(r'^[a-z\-]+$', p) and p in ('mental', 'fear', 'cold', 'death', 'vitality', 'void', 'poison', 'disease', 'magical', 'emotion', 'sonic', 'fire', 'illusion', 'curse', 'arcane', 'divine', 'occult', 'primal', 'auditory', 'visual'):
                        vs.append(p)
                    else:
                        ok = False
                elif isinstance(p, dict) and 'or' in p and all(isinstance(q, str) for q in p['or']):
                    vs += [q.replace('item:trait:', '') for q in p['or']]
                else:
                    ok = False
            if not ok or not isinstance(r.get('value'), int):
                continue
            for x in sels:
                saveMods.append({'sel': sm[x], 't': {'status': 'status', 'circumstance': 'circ', 'item': 'item'}.get(r.get('type'), 'unt'), 'v': r['value'], 'vs': vs, 's': it['name']})
    # abilities
    abilities = []
    improved = set()
    ab_items = [it for it in d['items'] if it['type'] == 'action']
    for it in ab_items:
        gk = glossary_key(it['system']['description']['value'] or '')
        if gk == 'ImprovedGrab':
            improved.add('grab')
        if gk == 'ImprovedKnockdown':
            improved.add('knockdown')
        if gk == 'ImprovedPush':
            improved.add('push')
    by_slug = {}
    for i, it in enumerate(ab_items):
        try:
            spec, auto, text = parse_ability(ctx, it)
        except Exception as e:  # never let one odd ability break the import
            spec, auto, text = None, False, clean(it['system']['description']['value'] or '')
            print('  parse error', d['name'], it['name'], e, file=sys.stderr)
        sy = it['system']
        at = sy['actionType']['value']
        nact = sy['actions']['value']
        cost = {'action': str(nact or 1), 'reaction': 'reaction', 'free': 'free', 'passive': 'passive'}.get(at, 'passive')
        if len(text) > 700:
            text = text[:700].rsplit(' ', 1)[0] + '…'
        a = {'id': 'a%d' % i, 'name': it['name'], 'cost': cost, 'traits': list(sy['traits']['value']), 'text': text, 'auto': bool(auto), 'spec': spec}
        if auto is None:
            a['auto'] = False
        abilities.append(a)
        sl = sy.get('slug') or slugify(it['name'])
        by_slug.setdefault(sl, a)
        by_slug.setdefault(slugify(it['name']), a)
    strikes = build_strikes(ctx, by_slug, improved, ctx.push_ft)
    # abilities referencing afflictions in text ("is exposed to scorpion venom")
    for a in abilities:
        s2 = a.get('spec') or {}
        if s2.get('kind') in ('area', 'save') and re.search(r'exposed to ([\w\s]+?)(\.|,|$)', a['text'].lower()):
            nmx = re.search(r'exposed to ([\w\s]+?)(\.|,|$)', a['text'].lower()).group(1).strip()
            ref = next((b for b in abilities if b['name'].lower() == nmx and (b.get('spec') or {}).get('kind') == 'affliction'), None)
            if ref:
                s2['aff'] = ref['id']
                ref['auto'] = True
    # follow-up abilities only automated if some strike carries the token
    tokens = set(e.split(':')[0] for st in strikes for e in st['eff'])
    for a in abilities:
        s2 = a.get('spec') or {}
        if s2.get('kind') == 'follow':
            need = {'mGrab': 'mgrab', 'mKnock': 'mknock', 'mPush': 'mpush'}[s2['follow']]
            if need not in tokens:
                a['auto'] = need.replace('m', 'i', 1) in tokens
        if s2.get('kind') == 'passive' and s2.get('note') == 'strike rider':
            a['auto'] = any(t.startswith('i') for t in tokens)
    # shield
    shield = None
    sh = next((it for it in d['items'] if it['type'] == 'shield'), None)
    if sh:
        hp = (sh['system'].get('hp') or {}).get('max') or 20
        shield = {'ac': sh['system'].get('acBonus') or 2, 'hard': sh['system'].get('hardness') or 3, 'hp': hp, 'bt': hp // 2}
    entries, unknown = build_casting(ctx, spell_ids, spell_auto)
    focus_pts = ((s.get('resources') or {}).get('focus') or {}).get('max') or 0
    c = {'id': cid, 'slug': slug, 'name': d['name'], 'lvl': ctx.lvl, 'size': size, 'traits': traits, 'attr': attr,
         'per': s['perception']['mod'], 'ac': attrs['ac']['value'], 'fort': sv['fortitude']['value'], 'ref': sv['reflex']['value'], 'will': sv['will']['value'],
         'hp': attrs['hp']['max'], 'speed': speed, 'skills': skills, 'strikes': strikes, 'resist': resist, 'weak': weak, 'immune': immune}
    if resistX:
        c['resistX'] = resistX
    if saveMods:
        c['saveMods'] = saveMods
    if aquatic:
        c['aquatic'] = True
    if shield and any((a.get('spec') or {}).get('flag') == 'shieldBlock' for a in abilities):
        c['shield'] = shield
    if entries:
        c['casting'] = entries
        if focus_pts:
            c['focusPoints'] = focus_pts
    c['abilities'] = abilities
    c['theme'] = themes_of(traits, d['name'])
    c['shape'] = shape_of(traits, size, speed, d['name'])
    c['color'] = COLOR.get(c['theme'][0], '#8a6a4a')
    c['desc'] = describe(c, abilities)
    rar = s['traits'].get('rarity')
    if rar and rar != 'common':
        c['rarity'] = rar
    return c, unknown


def main():
    specs, hand = import_spells.build_all()
    spell_ids = set(specs) | hand
    spell_auto = {k: v['auto'] for k, v in specs.items()}
    creatures = []
    unk = {}
    for f in sorted(glob.glob(MC_DIR + '/*.json')):
        c, unknown = build_creature(f, spell_ids, spell_auto)
        creatures.append(c)
        for u in unknown:
            unk[u] = unk.get(u, 0) + 1
    n_ab = sum(len(c['abilities']) for c in creatures)
    n_auto = sum(1 for c in creatures for a in c['abilities'] if a['auto'])
    lines = [json.dumps(c, separators=(',', ':'), ensure_ascii=False) for c in creatures]
    hdr = ('/* data_mc.js — GENERATED by tools/import_mc.py from the Foundry VTT pf2e system data (pathfinder-monster-core pack). Do not edit by hand.\n'
           '   Contains material from Pathfinder Monster Core (Paizo Inc.), used under the ORC License. Creature descriptions are original one-line summaries.\n'
           '   %d creatures; %d abilities, %d automated. Creature ids: camelCase of the Foundry slug (goblin-warrior -> goblinWarrior).\n'
           '   Ability spec kinds: flag regen fastHeal aura follow affliction rider react area save multi constrict swallow trample rend passive. */\n' % (len(creatures), n_ab, n_auto))
    js = hdr + ("(function (G) {\n'use strict';\nconst PF = G.PF, D = PF.D;\n"
                "D.ORC_NOTICE = 'This product contains material from Pathfinder Monster Core and Pathfinder Player Core (Paizo Inc.), used under the ORC License (Open RPG Creative License). Creature, ability and spell rules text are ORC licensed material; the simulator code and creature summaries are original.';\n"
                "const MC = [\n" + ',\n'.join(lines) + "\n];\nD.registerMC(MC);\n})(typeof window !== 'undefined' ? window : globalThis);\n")
    open(ROOT + '/src/data_mc.js', 'w').write(js)
    print('creatures:', len(creatures), 'abilities:', n_ab, 'automated:', n_auto)
    print('unknown spells (listed only):', len(unk), sorted(unk.items(), key=lambda x: -x[1])[:15])


if __name__ == '__main__':
    main()
