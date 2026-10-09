"""pf2text.py — shared helpers for the Foundry pf2e importers.

Turns Foundry HTML + inline roll tags (@Damage, @Check, @Template, @UUID, @Localize, [[/gmr]])
into readable text and structured data (damage parts, checks, templates, outcome effects).
Used by tools/import_spells.py and tools/import_mc.py.
"""
import re, html as _html

DMG_TYPES = ['bludgeoning', 'piercing', 'slashing', 'fire', 'cold', 'electricity', 'acid', 'sonic', 'force', 'void',
             'vitality', 'mental', 'poison', 'spirit', 'bleed', 'untyped', 'healing', 'precision']
VALUED = ['frightened', 'sickened', 'clumsy', 'enfeebled', 'drained', 'stupefied', 'stunned', 'slowed', 'doomed', 'wounded']
FLAGC = ['dazzled', 'blinded', 'deafened', 'immobilized', 'paralyzed', 'fleeing', 'off-guard', 'fascinated', 'confused',
         'grabbed', 'restrained', 'fatigued', 'unconscious', 'petrified', 'prone', 'quickened', 'controlled']
COND_ENGINE = {'off-guard': 'offguard'}   # engine condition keys
SAVE_MAP = {'fortitude': 'fort', 'reflex': 'ref', 'will': 'will'}

# Short, original summaries of the standard creature-ability glossary entries.
GLOSSARY = {
    'Grab': 'Requirement: the last action was a successful Strike that lists Grab. The target is grabbed until the end of the creature\'s next turn (Escape against its Athletics DC).',
    'ImprovedGrab': 'As Grab, but as a free action right after the hit.',
    'Knockdown': 'Requirement: the last action was a successful Strike that lists Knockdown. The target falls prone.',
    'ImprovedKnockdown': 'As Knockdown, but as a free action right after the hit.',
    'Push': 'Requirement: the last action was a successful Strike that lists Push. The target is pushed away (5 feet unless listed).',
    'ImprovedPush': 'As Push, but as a free action right after the hit.',
    'Pull': 'Requirement: the last action was a successful Strike that lists Pull. The target is pulled closer.',
    'Constrict': 'Deals the listed damage to every creature the monster has grabbed or restrained (basic Fortitude save).',
    'GreaterConstrict': 'As Constrict; a creature that fails its save also falls unconscious.',
    'ReactiveStrike': 'Reaction. Trigger: a creature within reach uses a manipulate or move action, makes a ranged attack, or leaves a square during a move action. Effect: make a melee Strike against it.',
    'Ferocity': 'Reaction. Trigger: reduced to 0 HP. Effect: stay at 1 HP and increase wounded by 1.',
    'FrightfulPresence': 'Aura. A creature that first enters the area attempts a Will save: success frightened 1, failure frightened 2, critical failure frightened 4. It is then immune for the rest of the battle.',
    'Stench': 'Aura. A creature entering or starting its turn in the area attempts a Fortitude save: failure sickened 1, critical failure also slowed 1 while sickened. A success makes it immune.',
    'SwallowWhole': 'Swallow a grabbed creature of the listed size or smaller. It is restrained and slowed, takes the listed damage immediately and at the end of each of the monster\'s turns, and can Escape.',
    'Trample': 'Stride up to double Speed through the spaces of creatures of the listed size or smaller; each takes the listed Strike\'s damage (basic Reflex).',
    'Rend': 'Requirement: hit the same enemy with two consecutive Strikes of the listed type this turn. Deal that Strike\'s damage again.',
    'Regeneration': 'Regain the listed HP at the start of each turn. Cannot be destroyed while it works; the listed damage types switch it off until the end of its next turn.',
    'FastHealing': 'Regain the listed HP at the start of each turn.',
    'NegativeHealing': 'Void healing: harmed by vitality, healed by void effects.',
    'ThrowRock': 'Pick up a rock and throw it with a ranged rock Strike.',
    'ShieldBlock': 'Reaction: reduce damage by the shield\'s Hardness.',
    'Buck': 'Reaction against a rider (not used in this simulator).',
    'ConstantSpells': 'Some spells are always active (not modelled).',
    'AtWillSpells': 'Some innate spells can be cast at will.',
    'Telepathy': 'Communicates telepathically.',
    'ChangeShape': 'Can change shape (not modelled).',
    'Tremorsense': 'Senses vibrations.', 'Lifesense': 'Senses life force.', 'GreaterDarkvision': 'Sees in magical darkness.',
    'AllAroundVision': 'Sees in all directions; cannot be flanked by position alone.', 'Scent': 'Senses by smell.', 'Wavesense': 'Senses movement in water.',
    'LightBlindness': 'Dazzled in bright light.', 'SwarmMind': 'Mindless hive behaviour; immune to mental.',
    'AquaticAmbush': 'Ambush from hiding in water (not modelled).', 'Coven': 'Coven magic (not modelled).', 'Engulf': 'Engulfs creatures (not modelled).',
    'Darkvision': 'Sees in darkness.', 'Disease': 'An affliction.', 'Poison': 'An affliction.',
}


def balanced(s, start):
    """s[start] == '['; return index of the matching ']' (or -1)."""
    depth = 0
    for i in range(start, len(s)):
        if s[i] == '[':
            depth += 1
        elif s[i] == ']':
            depth -= 1
            if depth == 0:
                return i
    return -1


def find_tags(s, tag):
    """yield (start, end, inner, label) for @Tag[inner]{label}."""
    out = []
    i = 0
    key = '@' + tag + '['
    while True:
        j = s.find(key, i)
        if j < 0:
            break
        b = j + len(key) - 1
        e = balanced(s, b)
        if e < 0:
            break
        inner = s[b + 1:e]
        label = None
        end = e + 1
        if end < len(s) and s[end] == '{':
            k = s.find('}', end)
            if k > 0:
                label = s[end + 1:k]
                end = k + 1
        out.append((j, end, inner, label))
        i = end
    return out


DICE_RE = re.compile(r'^\(?\s*(?:(\d+)d(\d+))?\s*([+-]\s*\d+)?\s*\)?$')


def parse_formula(f):
    f = f.strip().replace(' ', '')
    f = re.sub(r'^\{(.*)\}$', r'\1', f)
    while f.startswith('(') and f.endswith(')') and balanced(f.replace('(', '[').replace(')', ']'), 0) == len(f) - 1:
        f = f[1:-1]
    m = re.match(r'^(\d+)d(\d+)([+-]\d+)?$', f)
    if m:
        return {'n': int(m.group(1)), 'd': int(m.group(2)), 'm': int(m.group(3) or 0)}
    m = re.match(r'^(\d+)([+-])(\d+)d(\d+)$', f)
    if m:
        return {'n': int(m.group(3)), 'd': int(m.group(4)), 'm': int(m.group(1))}
    m = re.match(r'^-?\d+$', f)
    if m:
        return {'n': 0, 'd': 0, 'm': int(f)}
    m = re.match(r'^d(\d+)$', f)
    if m:
        return {'n': 1, 'd': int(m.group(1)), 'm': 0}
    return None


def parse_damage_inner(inner):
    """'8d6[acid],1d6[persistent,acid]|options:area-damage' -> list of parts"""
    body = inner.split('|')[0]
    parts = []
    # split on top-level commas
    depth = 0
    cur = ''
    chunks = []
    for ch in body:
        if ch in '[(':
            depth += 1
        elif ch in '])':
            depth -= 1
        if ch == ',' and depth == 0:
            chunks.append(cur)
            cur = ''
        else:
            cur += ch
    if cur:
        chunks.append(cur)
    for c in chunks:
        c = c.strip()
        m = re.match(r'^(.*)\[([^\[\]]*)\]$', c)
        if not m:
            fm = parse_formula(c)
            if fm:
                fm['type'] = 'untyped'
                parts.append(fm)
            continue
        fm = parse_formula(m.group(1))
        if not fm:
            # nested: (2d6[fire])  or formula with @ references
            sub = re.findall(r'([\dd+\-() ]+)\[([a-z,]+)\]', m.group(1))
            if not sub:
                continue
            fm = parse_formula(sub[0][0])
            if not fm:
                continue
        tags = [t.strip() for t in m.group(2).split(',') if t.strip()]
        typ = 'untyped'
        cat = None
        for t in tags:
            if t in ('persistent', 'splash', 'precision'):
                cat = t
            elif t in DMG_TYPES:
                typ = t
            elif t == 'healing':
                typ = 'healing'
        if 'healing' in tags:
            typ = 'healing'
        if typ == 'bleed':
            cat = 'persistent'
        fm['type'] = typ
        if cat:
            fm['cat'] = cat
        parts.append(fm)
    return parts


def dstr(p):
    s = ''
    if p.get('n'):
        s = '%dd%d' % (p['n'], p['d'])
    if p.get('m'):
        s += ('+' if p['m'] > 0 and s else '') + str(p['m'])
    return s or '0'


def part_text(p):
    t = dstr(p)
    if p.get('cat') == 'persistent':
        t += ' persistent'
    elif p.get('cat') == 'splash':
        t += ' splash'
    if p['type'] not in ('untyped',):
        t += ' ' + p['type']
    return t


def parse_check_inner(inner):
    bits = inner.split('|')
    stat = bits[0].strip().lower()
    o = {'stat': stat, 'dc': None, 'basic': False, 'inflicts': [], 'against': None}
    for b in bits[1:]:
        b = b.strip()
        if b.startswith('dc:'):
            try:
                o['dc'] = int(re.sub(r'[^\d-]', '', b[3:]) or 0) or None
            except ValueError:
                pass
        elif b == 'basic':
            o['basic'] = True
        elif b.startswith('options:'):
            for x in b[8:].split(','):
                if x.startswith('inflicts:'):
                    o['inflicts'].append(x[9:])
        elif b.startswith('against:') or b.startswith('defense:'):
            o['against'] = b.split(':', 1)[1]
    return o


def checks(s):
    return [parse_check_inner(i) for (_, _, i, _) in find_tags(s, 'Check')]


def templates(s):
    out = []
    for (_, _, inner, _) in find_tags(s, 'Template'):
        bits = inner.split('|')
        t = bits[0].strip()
        if ':' in t:
            t = t.split(':', 1)[1]
        dist = 0
        for b in bits[1:]:
            if b.startswith('distance:'):
                try:
                    dist = int(b[9:])
                except ValueError:
                    pass
        out.append({'t': t, 'r': dist})
    return out


def damages(s):
    out = []
    for (_, _, inner, _) in find_tags(s, 'Damage'):
        out.extend(parse_damage_inner(inner))
    return out


def deslug(x):
    x = re.sub(r'([a-z])([A-Z])', r'\1 \2', x)
    return x.replace('-', ' ').strip()


def clean(s, glossary=True):
    """Foundry description HTML -> readable plain text (paragraphs separated by newlines)."""
    if not s:
        return ''
    # tags with labels / structure
    def rep_tags(s, tag, fn):
        res = ''
        last = 0
        for (a, b, inner, label) in find_tags(s, tag):
            res += s[last:a] + fn(inner, label)
            last = b
        return res + s[last:]

    def dmg_fn(inner, label):
        if label:
            return label
        ps = parse_damage_inner(inner)
        return ' plus '.join(part_text(p) for p in ps) if ps else ''

    def chk_fn(inner, label):
        c = parse_check_inner(inner)
        st = c['stat']
        if st == 'flat':
            return 'DC %s flat check' % c['dc'] if c['dc'] else 'flat check'
        nm = {'fortitude': 'Fortitude', 'reflex': 'Reflex', 'will': 'Will'}.get(st, st.capitalize())
        if label and not re.match(r'^\s*(fortitude|reflex|will)\s*$', label, re.I):
            return label
        txt = ('DC %d ' % c['dc'] if c['dc'] else '') + ('basic ' if c['basic'] else '') + nm
        if c['against']:
            txt = nm + ' check against ' + c['against'].replace('-dc', '').capitalize() + ' DC'
        return txt

    def tpl_fn(inner, label):
        if label:
            return label
        t = templates('@Template[' + inner + ']')
        if not t:
            return ''
        return '%d-foot %s' % (t[0]['r'], t[0]['t'])

    def uuid_fn(inner, label):
        if label:
            return label
        return deslug(inner.split('.')[-1])

    def loc_fn(inner, label):
        k = inner.split('.')[-1]
        return GLOSSARY.get(k, '') if glossary else ''

    s = rep_tags(s, 'UUID', uuid_fn)
    s = rep_tags(s, 'Damage', dmg_fn)
    s = rep_tags(s, 'Check', chk_fn)
    s = rep_tags(s, 'Template', tpl_fn)
    s = rep_tags(s, 'Localize', loc_fn)
    s = re.sub(r'\[\[/[a-z]+ [^\]]*\]\]\{([^}]*)\}', r'\1', s)
    s = re.sub(r'\[\[/act ([a-z\-]+)[^\]]*\]\]', lambda m: deslug(m.group(1)).title(), s)
    s = re.sub(r'\[\[/\w+ ([^\]#]*)(#[^\]]*)?\]\]', lambda m: m.group(1).strip(), s)
    s = re.sub(r'@\w+\[[^\]]*\](\{[^}]*\})?', '', s)
    s = re.sub(r'<hr\s*/?>', '\n', s)
    s = re.sub(r'</p>|<br\s*/?>|</li>|</h\d>', '\n', s)
    s = re.sub(r'<li>', '• ', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = _html.unescape(s)
    s = re.sub(r'Spell Effect: [\w\' -]+', '', s)
    lines = [re.sub(r'[ \t]+', ' ', l).strip() for l in s.split('\n')]
    return '\n'.join(l for l in lines if l)


def degree_paras(html):
    """return {3: html, 2: html, 1: html, 0: html} for **Critical Success** etc. paragraphs."""
    out = {}
    for m in re.finditer(r'<strong>\s*(Critical Success|Success|Failure|Critical Failure)\s*</strong>(.*?)(?=</p>|<p>|<strong>\s*(?:Critical Success|Success|Failure|Critical Failure)\s*</strong>|$)', html, re.S):
        k = {'Critical Success': 3, 'Success': 2, 'Failure': 1, 'Critical Failure': 0}[m.group(1)]
        if k not in out:
            out[k] = m.group(2)
    return out


DUR_RE = [
    (re.compile(r'for (\d+|one|two|three) rounds?'), 'r'),
    (re.compile(r'for (\d+|one|ten) minutes?'), 'min'),
    (re.compile(r'until the end of (?:your|its|the [\w\s]+?\'s|their|his|her) next turn'), 'eont'),
    (re.compile(r'until the start of (?:your|its|the [\w\s]+?\'s|their|his|her) next turn'), 'sont'),
    (re.compile(r'until the end of (?:your|its|their) turn'), 'eot'),
    (re.compile(r'for (\d+) hours?|for 24 hours|for 1 day|permanently|unlimited duration'), 'long'),
]
NUM = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'ten': 10}


def dur_of(text):
    t = text.lower()
    for rx, k in DUR_RE:
        m = rx.search(t)
        if m:
            if k == 'r':
                g = m.group(1)
                return {'k': 'r', 'n': int(NUM.get(g, g))}
            if k == 'min':
                return {'k': 'min'}
            return {'k': k}
    return None


def conds_in(text):
    """find conditions with values in a lowercase-ish text. returns list of {c, v}"""
    t = text.lower()
    # negations / immunity phrases
    t = re.sub(r'(immune to|isn\'t|is not|no longer|aren\'t|can\'t be|cannot be|not already|already) [\w\s-]{0,30}?\b(' + '|'.join(VALUED + FLAGC) + r')\b', ' ', t)
    t = re.sub(r'(reduces?|decreases?|reduce|lower)[\w\s]{0,25}?(' + '|'.join(VALUED) + r')[\w\s]{0,10}by \d', ' ', t)
    out = []
    seen = set()
    for m in re.finditer(r'\b(' + '|'.join(VALUED) + r')\s+(\d+)', t):
        c = m.group(1)
        if c in seen:
            continue
        seen.add(c)
        out.append({'c': c, 'v': int(m.group(2))})
    for m in re.finditer(r'\b(' + '|'.join(FLAGC) + r')\b', t):
        c = m.group(1)
        if c in seen:
            continue
        if c == 'prone' and not re.search(r'(fall|falls|knocked|knocks?|knock|is|are|becomes?|be|lands?|and) (\w+ )?prone|prone\b', t):
            continue
        if c == 'grabbed' and re.search(r'(has|have) [\w\s]*grabbed', t):
            continue
        seen.add(c)
        out.append({'c': COND_ENGINE.get(c, c), 'v': 1})
    # valued without explicit number ("is frightened")
    for m in re.finditer(r'\b(' + '|'.join(VALUED) + r')\b(?!\s+\d)', t):
        c = m.group(1)
        if c in seen:
            continue
        if re.search(r'\b' + c + r' (condition )?value', t):
            continue
        seen.add(c)
        out.append({'c': c, 'v': 1})
    return out


def effects_in(raw_html_or_text, is_html=True):
    """parse a (degree) segment into effect list."""
    raw = raw_html_or_text
    text = clean(raw) if is_html else raw
    tl = text.lower()
    effs = []
    if re.match(r'^\s*(the (target|creature) is )?(unaffected|no effect)', tl) and len(tl) < 60:
        return effs
    # persistent damage
    for p in (damages(raw) if is_html else []):
        if p.get('cat') == 'persistent':
            effs.append({'persist': {'n': p['n'], 'd': p['d'], 'm': p['m'], 'type': p['type']}})
    # damage scale words
    if re.search(r'double (the )?(\w+ )?damage|twice the damage', tl):
        effs.append({'dmg': 2})
    elif re.search(r'half (the )?(\w+ )?damage', tl):
        effs.append({'dmg': 0.5})
    elif re.search(r'full damage|takes? (the )?(full |listed )?damage|takes? \d+d\d+', tl):
        effs.append({'dmg': 1})
    elif re.search(r'no damage', tl):
        effs.append({'dmg': 0})
    m = re.search(r'(?:pushed|knocked|moved|pushes it|pushes the target)\s*(?:back|away)?\s*(?:up to )?(\d+) feet', tl)
    if m:
        effs.append({'push': int(m.group(1))})
    m = re.search(r'(?:spend|spends|waste|wastes|lose|loses) (its|their|the target\'s)? ?(first |next )?(\d|one|two|all)? ?actions?', tl)
    if m and ('next' in tl or 'turn' in tl):
        n = m.group(3)
        n = 3 if n == 'all' else int(NUM.get(n, n)) if n else 1
        effs.append({'lose': n})
    sents = re.split(r'(?<=[.;])\s+', text)
    for s in sents:
        d = dur_of(s)
        for c in conds_in(s):
            e = {'c': c['c'], 'v': c['v']}
            if d:
                e['dur'] = d
            effs.append(e)
    return effs


def merge_like(effs_base, extra):
    out = [dict(e) for e in effs_base]
    for e in extra:
        if 'c' in e:
            out = [x for x in out if x.get('c') != e['c']]
        if 'dmg' in e:
            out = [x for x in out if 'dmg' not in x]
        out.append(e)
    return out


def outcomes_from_paras(html):
    paras = degree_paras(html)
    if not paras:
        return None
    out = {}
    for k in (3, 2, 1, 0):
        if k not in paras:
            continue
        seg = paras[k]
        txt = clean(seg).lower()
        base = []
        m = re.search(r'as (a |the )?(critical failure|failure|success|critical success)', txt)
        if m:
            ref = {'critical failure': 0, 'failure': 1, 'success': 2, 'critical success': 3}[m.group(2)]
            base = out.get(ref, [])
        effs = effects_in(seg)
        out[k] = merge_like(base, effs) if base else effs
    return out


def inline_outcomes(text_html):
    """for ability text without degree paragraphs: 'must succeed at a X save or become Frightened 2 (or Frightened 3 on a critical failure)'."""
    text = clean(text_html)
    tl = text.lower()
    out = {0: [], 1: [], 2: [], 3: []}
    found = False
    # critical-failure parentheticals
    cf_extra = []
    for m in re.finditer(r'\((?:or |and )?([^()]*?)\s+on a critical failure\)', tl):
        cf_extra += effects_in(m.group(1), False)
    tl2 = re.sub(r'\((?:or |and )?[^()]*?\s+on a critical failure\)', ' ', tl)
    sents = re.split(r'(?<=[.;])\s+', tl2)
    for s in sents:
        degs = None
        if re.search(r'on a critical failure|critically fails', s):
            # "on a failure, x; on a critical failure, y" — split
            parts = re.split(r'on a critical failure|critically fails', s)
            pre, post = parts[0], parts[-1]
            if re.search(r'fail', pre):
                e = effects_in(pre, False)
                if e:
                    out[1] += e
                    found = True
            e = effects_in(post, False)
            if e:
                out[0] += e
                found = True
            continue
        if re.search(r'on a critical success', s):
            continue
        if re.search(r'on a success|succeeds? at (its|the|their) save', s) and not re.search(r'must succeed|or (be|become)', s):
            e = effects_in(s, False)
            e = [x for x in e if 'c' in x or 'persist' in x]
            if e:
                out[2] += e
                found = True
            continue
        if re.search(r'regardless', s):
            continue
        if re.search(r'must succeed|or (be|become|fall|is|are|take)|fails?|failed|unless (it|they) succeeds?|on a failure|that fail', s):
            frag = s
            m = re.search(r'(?:or (?:be |become |is |are )?|on a failure,? |that fails?( its| the)? save( is| are)? (also )?|fail(?:s|ed)? (?:the |its )?save,? )(.*)', s)
            if m:
                frag = m.group(m.lastindex)
            e = effects_in(frag, False)
            e = [x for x in e if 'c' in x or 'persist' in x or 'push' in x or 'lose' in x]
            if e:
                out[1] += e
                found = True
    if not found and not cf_extra:
        return None
    # critical failure defaults: failure effects with valued conditions +1, unless noted
    if not out[0]:
        cf = []
        for e in out[1]:
            e2 = dict(e)
            if 'c' in e2 and e2['c'] in VALUED and e2['c'] not in ('doomed', 'wounded'):
                e2['v'] = e2['v'] + 1
            cf.append(e2)
        out[0] = cf
    else:
        # failure effects not overridden carry to crit failure
        names = set(x.get('c') for x in out[0])
        out[0] = out[0] + [dict(e) for e in out[1] if e.get('c') not in names and 'c' in e] + [dict(e) for e in out[1] if 'c' not in e and not any(k in x for x in out[0] for k in e)]
    if cf_extra:
        out[0] = merge_like(out[0], cf_extra)
    return out


def camel(slug):
    bits = [b for b in re.split(r'[^a-zA-Z0-9]+', slug) if b]
    if not bits:
        return slug
    s = bits[0].lower() + ''.join(b[:1].upper() + b[1:].lower() for b in bits[1:])
    if s[0].isdigit():
        s = 'n' + s
    return s


def slugify(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
