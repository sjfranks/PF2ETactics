#!/usr/bin/env python3
"""import_spells.py — Foundry pf2e spell packs -> src/data_spells_auto.js

Imports Remaster spells (publication.remaster, has traditions, not rituals) plus the focus spells that
Monster Core creatures use. Each spell becomes a JSON spec in the same field vocabulary as data_spells.js
(name, rank, trad, cost, traits, range, tgt, n, save, basic, atk, area{t,r,range}) plus generic data that
D.autoSpell (data_spells.js) turns into dmg(r)/onDeg functions:
  dmg   [{n,d,m,type,cat}]   damage parts (cat 'persistent'|'splash'); nr:[mul,div] = dice count scales with rank
  hi    {e: every, add: {idx: {n,d,m}}, ar: area step}      interval heightening
  hf    {rank: {dmg:[...], n, ar}}                          fixed heightening
  outc  {0..3: [effects]}  effects: {c,v,dur}|{persist}|{dmg:factor}|{push}|{lose}
  buff  {mods:[{sel,t,v}], temp, resist}   heal {..}   auto:false = listed only, never cast.
Ids are the camelCase of the slug; ids hand-written in data_spells.js are skipped.
Run: python3 tools/import_spells.py
"""
import json, glob, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pf2text import *  # noqa

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FVTT = os.environ.get('FVTT_PACKS', '/home/claude/fvtt/packs/pf2e')
SPELL_DIR = FVTT + '/spells/spells'
FOCUS_DIR = FVTT + '/spells/focus'
MC_DIR = FVTT + '/pathfinder-monster-core'


def handwritten_ids():
    src = open(ROOT + '/src/data_spells.js').read()
    return set(re.findall(r"def\('(\w+)'", src))


def parse_range(t):
    t = (t or '').lower().strip()
    if t == 'touch':
        return 5, True
    m = re.search(r'([\d,]+)\s*(feet|foot|ft)?', t)
    if m and (m.group(2) or re.match(r'^[\d,]+$', t)):
        return int(m.group(1).replace(',', '')), False
    if t == '':
        return 0, False
    return None, False


def formula_part(f, typ, cat):
    f0 = f.replace(' ', '')
    m = re.match(r'^\(?@item\.(?:level|rank)\)?d(\d+)([+-]\d+)?$', f0)
    if m:
        return {'nr': [1, 1], 'd': int(m.group(1)), 'm': int(m.group(2) or 0), 'type': typ, **({'cat': cat} if cat else {})}
    m = re.match(r'^floor\(@item\.(?:level|rank)/(\d+)\)d(\d+)([+-]\d+)?$', f0)
    if m:
        return {'nr': [1, int(m.group(1))], 'd': int(m.group(2)), 'm': int(m.group(3) or 0), 'type': typ, **({'cat': cat} if cat else {})}
    m = re.match(r'^\(?@item\.(?:level|rank)\*(\d+)\)?d(\d+)$', f0)
    if m:
        return {'nr': [int(m.group(1)), 1], 'd': int(m.group(2)), 'm': 0, 'type': typ, **({'cat': cat} if cat else {})}
    p = parse_formula(f0)
    if not p:
        return None
    p['type'] = typ
    if cat:
        p['cat'] = cat
    return p


def targets_of(t):
    t = (t or '').lower()
    o = {}
    if not t:
        return o
    if 'willing' in t or 'ally' in t or 'allies' in t or 'companion' in t or 'familiar' in t or 'eidolon' in t:
        o['ally'] = True
    if 'living' in t:
        o['living'] = True
    if 'undead' in t and 'living' not in t:
        o['undead'] = True
    if re.search(r'object|corpse|weapon|armor|item|vessel|structure|plant\b|ammunition|square', t) and 'creature' not in t:
        o['bad'] = True
    if 'triggering' in t:
        o['bad'] = True
    m = re.search(r'(?:up to |1 or )?(\d+) (?:\w+ )?(?:willing )?(?:living )?creatures', t)
    if m:
        o['n'] = int(m.group(1))
    elif re.search(r'1 or more|any number', t):
        o['n'] = 6
    elif re.search(r'1 (\w+ )?creature|one creature|1 enemy', t):
        o['n'] = 1
    if t.startswith('you and'):
        o['n'] = o.get('n', 1) + 1
        o['ally'] = True
    return o


BUFF_SEL = [(r'\bac\b|armor class', 'ac'), (r'attack rolls?', 'atk'), (r'all saving throws|saving throws|saves', 'save'),
            (r'reflex saves?', 'ref'), (r'fortitude saves?', 'fort'), (r'will saves?', 'will'), (r'perception', 'per'),
            (r'damage rolls?', 'dmg'), (r'skill checks', 'skill')]


def parse_buff(text):
    t = text.lower()
    mods = []
    for m in re.finditer(r'\+(\d) (status|circumstance|item) bonus to ([^.;]{0,80})', t):
        v, typ, what = int(m.group(1)), m.group(2), m.group(3)
        tt = {'status': 'status', 'circumstance': 'circ', 'item': 'item'}[typ]
        whats = re.split(r',| and | or ', what)
        for w in whats:
            for rx, sel in BUFF_SEL:
                if re.search(rx, w):
                    if 'against' in w or ' vs' in w:
                        break
                    mods.append({'sel': sel, 't': tt, 'v': v})
                    break
    temp = None
    m = re.search(r'gains? (\d+) temporary hit points', t)
    if m:
        temp = int(m.group(1))
    res = {}
    for m in re.finditer(r'resistance (\d+) to (\w+)', t):
        if m.group(2) in DMG_TYPES or m.group(2) in ('physical', 'all'):
            res[m.group(2)] = int(m.group(1))
    if not mods and not temp and not res:
        return None
    seen = set()
    mods2 = []
    for x in mods:
        k = (x['sel'], x['t'])
        if k in seen:
            continue
        seen.add(k)
        mods2.append(x)
    o = {'mods': mods2}
    if temp:
        o['temp'] = temp
    if res:
        o['resist'] = res
    return o


COND_VAL = {'frightened': 3, 'sickened': 3, 'clumsy': 2.5, 'enfeebled': 2.5, 'stupefied': 2, 'drained': 2.5, 'stunned': 8, 'slowed': 10,
            'doomed': 2, 'wounded': 1, 'dazzled': 3, 'blinded': 10, 'deafened': 1, 'immobilized': 5, 'paralyzed': 22, 'fleeing': 9,
            'offguard': 3, 'fascinated': 4, 'confused': 9, 'grabbed': 5, 'restrained': 10, 'fatigued': 2, 'unconscious': 22,
            'petrified': 25, 'prone': 4, 'quickened': 0, 'controlled': 25}


def effect_value(effs):
    v = 0
    for e in effs or []:
        if 'c' in e:
            w = COND_VAL.get(e['c'], 2)
            if e['c'] in VALUED:
                w *= max(1, e.get('v', 1))
            d = e.get('dur')
            if d and d.get('k') in ('r', 'sont', 'eot', 'eont') and (d.get('n', 1) <= 1):
                w *= 0.6
            v += w
        elif 'persist' in e:
            p = e['persist']
            v += 2 * (p.get('n', 0) * (p.get('d', 0) + 1) / 2 + p.get('m', 0))
        elif 'push' in e:
            v += 1
        elif 'lose' in e:
            v += 7 * e['lose']
    return round(v, 1)


def desc_of(html, maxlen=420):
    txt = clean(html)
    lines = txt.split('\n')
    keep = []
    for l in lines:
        if l.startswith('Spell Effect') or l.startswith('Effect:'):
            continue
        keep.append(l)
    s = ' '.join(keep)
    if len(s) > maxlen:
        cut = s[:maxlen]
        cut = cut[:cut.rfind(' ')] if ' ' in cut else cut
        s = cut + '…'
    return s


def build(slug, d, focus=False, ftrad=None, skip=()):
    s = d['system']
    name = d['name']
    sid = camel(slug)
    traits = list(s['traits']['value'])
    cantrip = 'cantrip' in traits
    lvl = s['level']['value']
    rank = 0 if cantrip else lvl
    trad = list(s['traits'].get('traditions') or ([ftrad] if ftrad else []))
    if focus and ftrad and ftrad not in trad:
        trad.append(ftrad)
    html = s['description']['value']
    o = {'id': sid, 'name': name, 'rank': rank, 'trad': trad, 'traits': [t for t in traits if t != 'cantrip'], 'auto': False}
    if focus:
        o['focus'] = True
        o['flvl'] = lvl
    o['desc'] = desc_of(html)
    why = []
    tm = s['time']['value'].strip().lower()
    cost = None
    if tm in ('1', '2', '3'):
        cost = int(tm)
    elif tm in ('1 to 3', '2 or 3', '1 or 2', '2 to 3'):
        cost = 2 if tm != '1 or 2' else 1
    else:
        why.append('time ' + tm)
    o['cost'] = cost or 2
    rng, melee = parse_range(s['range']['value'])
    if rng is None:
        why.append('range')
        rng = 30
    o['range'] = rng
    if melee:
        o['melee'] = True
    area = s.get('area') or None
    if area and area.get('type'):
        t = area['type']
        r = area.get('value') or 5
        if t in ('cylinder', 'cube', 'square'):
            t = 'burst'
            r = max(5, r // 2 if area['type'] != 'cylinder' else r)
        if t not in ('burst', 'cone', 'line', 'emanation'):
            why.append('area ' + t)
        else:
            o['area'] = {'t': t, 'r': r}
            if t == 'burst':
                o['area']['range'] = rng if rng else 0
    tg = targets_of(s['target']['value'])
    if tg.get('bad'):
        why.append('target ' + s['target']['value'])
    if tg.get('living'):
        o['livingOnly'] = True
    if tg.get('undead'):
        o['undeadOnly'] = True
    if tg.get('n') and tg['n'] > 1:
        o['n'] = tg['n']
    df = s.get('defense') or {}
    save = (df.get('save') or {}) if df else {}
    passive = (df.get('passive') or {}) if df else {}
    if save and save.get('statistic'):
        o['save'] = SAVE_MAP.get(save['statistic'], save['statistic'])
        if save.get('basic'):
            o['basic'] = True
    if (passive and passive.get('statistic') == 'ac') or ('attack' in traits and not save and s.get('damage')):
        o['atk'] = True
    elif passive:
        why.append('passive ' + str(passive.get('statistic')))
    if 'incapacitation' in traits:
        o['incap'] = True
    # damage
    dm = s.get('damage') or {}
    keys = list(dm.keys())
    parts = []
    healing = False
    for k in keys:
        v = dm[k]
        kinds = v.get('kinds') or ['damage']
        typ = v.get('type') or 'untyped'
        cat = v.get('category')
        if 'healing' in kinds and 'damage' not in kinds:
            healing = True
            typ = 'healing'
        elif 'healing' in kinds:
            healing = True
        p = formula_part(v.get('formula', ''), typ, cat)
        if not p:
            why.append('formula ' + v.get('formula', ''))
            continue
        p['k'] = k
        parts.append(p)
    h = s.get('heightening') or {}
    if parts:
        o['dmg'] = parts
    if h.get('type') == 'interval':
        hi = {'e': h.get('interval') or 1, 'add': {}}
        for k, f in (h.get('damage') or {}).items():
            idx = next((i for i, p in enumerate(parts) if p.get('k') == k), None)
            fp = parse_formula(str(f))
            if idx is not None and fp:
                hi['add'][str(idx)] = fp
        if h.get('area'):
            hi['ar'] = h['area']
        o['hi'] = hi
    elif h.get('type') == 'fixed':
        hf = {}
        for lv, lvo in (h.get('levels') or {}).items():
            e = {}
            if 'damage' in lvo:
                dl = []
                for k, v in lvo['damage'].items():
                    p = formula_part(v.get('formula', ''), v.get('type') or 'untyped', v.get('category'))
                    if p:
                        dl.append(p)
                if dl:
                    e['dmg'] = dl
            if 'target' in lvo:
                t2 = targets_of((lvo['target'] or {}).get('value', ''))
                if t2.get('n'):
                    e['n'] = t2['n']
            if 'area' in lvo and lvo['area'] and o.get('area'):
                e['ar'] = (lvo['area'].get('value') or o['area']['r']) - o['area']['r']
            if e:
                hf[str(lv)] = e
        if hf:
            o['hf'] = hf
    for p in parts:
        p.pop('k', None)
    # durations
    dur = (s.get('duration') or {}).get('value', '')
    if dur:
        o['dur'] = dur
    if (s.get('duration') or {}).get('sustained'):
        o['sustained'] = True
    # outcomes
    outc = None
    if o.get('save') or o.get('atk'):
        outc = outcomes_from_paras(html)
        if not outc and not o.get('basic'):
            outc = inline_outcomes(html)
        if not outc and o.get('basic'):
            io = inline_outcomes(html)
            if io and any(io[k] for k in io):
                outc = io
    if outc:
        outc = {str(k): v for k, v in outc.items() if v}
        if outc:
            o['outc'] = outc
    # damage scaling for non-basic damaging saves
    dmg_parts = [p for p in parts if p.get('cat') != 'persistent' and p['type'] != 'healing']
    if o.get('save') and not o.get('basic') and dmg_parts:
        sc = {}
        for k, effs in (outc or {}).items():
            for e in effs:
                if 'dmg' in e:
                    sc[int(k)] = e['dmg']
        if sc:
            o['dscale'] = [sc.get(0, 2 if 1 in sc else 0), sc.get(1, 0), sc.get(2, 0), sc.get(3, 0)]
        else:
            o['basic'] = True
    # explicit persistent effects in outcomes?
    if outc and any('persist' in e for v in outc.values() for e in v):
        o['persistInOutc'] = True
    # classify
    harmful = bool(o.get('save') or o.get('atk'))
    o['tgt'] = 'enemy'
    if not harmful:
        if tg.get('ally') or healing:
            o['tgt'] = 'ally'
        elif not s['target']['value'] and not area:
            o['tgt'] = 'self'
        elif area:
            o['tgt'] = 'area'
    ai = None
    effval = 0
    if outc:
        effval = max(effect_value(outc.get('1')), effect_value(outc.get('0')) * 0.5)
    if 'summon' in traits or 'polymorph' in traits or 'teleportation' in traits or 'scrying' in traits or 'detection' in traits:
        why.append('trait')
    if 'counteract' in html.lower() and not dmg_parts and not outc:
        why.append('counteract')
    if s.get('ritual'):
        why.append('ritual')
    if harmful:
        if dmg_parts:
            ai = {'kind': 'damage'}
        elif outc and effval > 0:
            ai = {'kind': 'debuff', 'val': effval}
        else:
            why.append('no parsed effect')
        if o['tgt'] == 'enemy' and not o.get('area') and not tg.get('n') and s['target']['value'] == '':
            # harmful, no target text, no area: unclear
            why.append('targeting')
    elif healing and parts and tg.get('ally') is not None:
        hp = [p for p in parts if p['type'] in ('healing', 'vitality')]
        if hp:
            o['heal'] = True
            ai = {'kind': 'healOne'}
            o.pop('dmg', None)
            o['hdmg'] = hp
        else:
            why.append('heal parse')
    else:
        b = parse_buff(clean(html)) if (tg.get('ally') or o['tgt'] == 'self') else None
        if b and cost and cost <= 2 and not dur.lower().startswith(('8 hours', '24 hours', 'until your next daily', 'until the next time')):
            o['buff'] = b
            ai = {'kind': 'buff', 'val': sum(m['v'] * {'atk': 4, 'ac': 3, 'save': 2, 'dmg': 2}.get(m['sel'], 1) for m in b['mods']) + (b.get('temp', 0) / 3) + sum(b.get('resist', {}).values()) / 2}
            if o['tgt'] == 'area':
                o['tgt'] = 'self'
        else:
            why.append('utility')
    if o.get('dmg') and any(p.get('cat') == 'splash' for p in o['dmg']):
        for p in o['dmg']:
            if p.get('cat') == 'splash':
                p.pop('cat')
    if ai:
        o['ai'] = ai
    o['auto'] = not why
    if why:
        o['why'] = why[:2]
    # tidy
    if not o.get('dmg'):
        o.pop('dmg', None)
    return o


def mc_focus_needs():
    """focus/compositions spells used by Monster Core creatures: slug -> tradition"""
    need = {}
    for f in glob.glob(MC_DIR + '/*.json'):
        d = json.load(open(f))
        ents = {it['_id']: it for it in d['items'] if it['type'] == 'spellcastingEntry'}
        for it in d['items']:
            if it['type'] != 'spell':
                continue
            slug = it['system'].get('slug') or slugify(re.sub(r'\s*\(.*\)$', '', it['name']))
            e = ents.get((it['system'].get('location') or {}).get('value'))
            trad = e['system']['tradition']['value'] if e else None
            need.setdefault(slug, trad)
    return need


def build_all():
    skip = handwritten_ids()
    out = {}
    slugs = {}
    for f in sorted(glob.glob(SPELL_DIR + '/**/*.json', recursive=True)):
        d = json.load(open(f))
        s = d['system']
        slug = os.path.basename(f)[:-5]
        slugs[slug] = f
        if not s['publication'].get('remaster'):
            continue
        if not s['traits'].get('traditions'):
            continue
        if 'ritual' in s['traits']['value']:
            continue
        sid = camel(slug)
        if sid in skip:
            continue
        out[sid] = build(slug, d)
    need = mc_focus_needs()
    for slug, trad in need.items():
        sid = camel(slug)
        if sid in skip or sid in out:
            continue
        fp = FOCUS_DIR + '/' + slug + '.json'
        if os.path.exists(fp):
            d = json.load(open(fp))
            out[sid] = build(slug, d, focus=True, ftrad=trad or 'occult')
    return out, skip


def main():
    specs, skip = build_all()
    ids = sorted(specs)
    n_auto = sum(1 for i in ids if specs[i]['auto'])
    lines = []
    for i in ids:
        lines.append(json.dumps(specs[i], separators=(',', ':'), ensure_ascii=False))
    js = ('/* data_spells_auto.js — GENERATED by tools/import_spells.py from the Foundry VTT pf2e system data. Do not edit by hand.\n'
          '   Contains material from Pathfinder Player Core and other Paizo Remaster rulebooks (Paizo Inc.), used under the ORC License.\n'
          '   %d spells (%d automated, %d listed only). Hand-written spells in data_spells.js take precedence. */\n' % (len(ids), n_auto, len(ids) - n_auto) +
          "(function (G) {\n'use strict';\nconst PF = G.PF, D = PF.D;\nconst S = [\n" + ',\n'.join(lines) + "\n];\n"
          "S.forEach(o => { if (!D.spells[o.id]) D.autoSpell(o); });\n"
          "})(typeof window !== 'undefined' ? window : globalThis);\n")
    open(ROOT + '/src/data_spells_auto.js', 'w').write(js)
    print('spells:', len(ids), 'automated:', n_auto, 'skipped hand-written:', len(skip))


if __name__ == '__main__':
    main()
