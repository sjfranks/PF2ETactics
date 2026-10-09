"""UI regression screenshots for the HUD redesign. Writes PNGs to shots/hud/ and prints page errors / overflow."""
import asyncio, os, sys
from playwright.async_api import async_playwright
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = W + '/shots/hud/'
URL = 'file://' + W + '/dist/local.html'
errs = []

async def overflow(pg, tag):
    r = await pg.evaluate("() => [document.documentElement.scrollWidth, innerWidth]")
    if r[0] != r[1]: errs.append(f'OVERFLOW {tag}: {r}')

async def wait_player(pg, name=None, n=60):
    for i in range(n):
        await pg.wait_for_timeout(250)
        ok = await pg.evaluate("(n) => PF.App.Battle.isPlayerTurn() && (!n || PF.App.Battle.cur.name === n)", name)
        if ok: return True
        if name and await pg.evaluate("() => PF.App.Battle.isPlayerTurn()"):
            await pg.evaluate("() => PF.App.Battle.endTurn(true)")
    return False

NEAR = """() => { const A = PF.App, B = A.B, BC = A.Battle, u = BC.cur; if (!u) return; let k = 0;
  const spots = []; for (let r = 1; r <= 5; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) spots.push([u.x + dx, u.y + dy]);
  B.units.filter(f => f.team === 'foe' && f.hp > 0).forEach((f, i) => { const want = i === 0 ? 1 : 3; for (const [x, y] of spots) { if (Math.max(Math.abs(x - u.x), Math.abs(y - u.y)) < want) continue; if (B.canEnd(f, x, y) && !B.trace(u, { x, y, sq: 1 }).blocked) { f.x = x; f.y = y; A.R.place(A.R.units[f.id], x, y); break; } } });
  BC.refresh(); A.R.focus(u.x, u.y, true); }"""
async def foe_pos(pg, idx=0):
    return await pg.evaluate("""(i) => { const B = PF.App.B, R = PF.App.R; const f = B.units.filter(u => u.team === 'foe' && u.hp > 0)[i]; if (!f) return null; const p = R.unitScreen(f.id); const r = R.renderer.domElement.getBoundingClientRect(); return [p.x + r.left, p.y + r.top + 45]; }""", idx)

async def desktop(b):
    pg = await b.new_page(viewport={'width': 1440, 'height': 900})
    pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'fonts' not in m.text and 'ERR_' not in m.text else None)
    await pg.goto(URL); await pg.wait_for_timeout(1500)
    await pg.screenshot(path=OUT + 'd01_home.png'); await overflow(pg, 'home')
    await pg.click('#btnSetup'); await pg.wait_for_timeout(700)
    await pg.screenshot(path=OUT + 'd02_setup.png'); await overflow(pg, 'setup')
    await pg.fill('#bSearch', 'gob'); await pg.wait_for_timeout(300)
    await pg.click('#bList .brow[data-bopen]'); await pg.wait_for_timeout(300)
    await pg.screenshot(path=OUT + 'd03_bestiary.png')
    await pg.keyboard.press('Escape'); await pg.click('#bReset')
    await pg.evaluate("() => { PF.App.show('roster'); PF.App.openEdit('iconic','seoni'); }"); await pg.wait_for_timeout(500)
    await pg.screenshot(path=OUT + 'd04_builder.png'); await overflow(pg, 'builder')
    await pg.click('[data-goto="spells"]'); await pg.wait_for_timeout(600)
    await pg.screenshot(path=OUT + 'd05_builder_spells.png')
    await pg.evaluate("() => PF.App.openSettings()"); await pg.wait_for_timeout(300)
    await pg.screenshot(path=OUT + 'd06_settings.png')
    await pg.evaluate("() => PF.App.closeModal()")
    # battle
    await pg.evaluate("""() => PF.App.startBattle({ map: 'forest', partyLevel: 5, title: 'Orc Raiders', pcs: ['valeros','ezren','kyra','merisiel'].map(id => PF.Build.iconic(id, 5)), foes: ['orcWarrior','orcWarrior','orcBrute','orcBrute','goblinPyro'].map(id => ({id})) })""")
    await pg.wait_for_timeout(800)
    await pg.screenshot(path=OUT + 'd07_deploy.png')
    await pg.select_option('#animSpeed', '5')
    await pg.click('#btnBegin')
    await wait_player(pg)
    await pg.wait_for_timeout(700)
    await pg.evaluate(NEAR); await pg.wait_for_timeout(500)
    await pg.screenshot(path=OUT + 'd08_turn.png'); await overflow(pg, 'battle')
    pos = await foe_pos(pg)
    if pos:
        await pg.mouse.move(pos[0] - 120, pos[1] + 80); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT + 'd09_move_hover.png')
    # strike targeting
    k = await pg.evaluate("() => Object.keys(PF.App.Battle.keyMap).find(k => k.startsWith('strike:') && PF.App.Battle.keyMap[k].sref.kind === 'ranged') || Object.keys(PF.App.Battle.keyMap).find(k => k.startsWith('strike:'))")
    await pg.click(f'[data-akey="{k}"]'); await pg.wait_for_timeout(400)
    await pg.screenshot(path=OUT + 'd10_target.png')
    await pg.keyboard.press('Tab'); await pg.wait_for_timeout(400)
    await pg.screenshot(path=OUT + 'd11_target_tab.png')
    await pg.keyboard.press('Escape')
    # skills tab
    await pg.click('[data-tab="skills"]'); await pg.wait_for_timeout(200)
    await pg.click('[data-akey^="demoralize"]'); await pg.wait_for_timeout(300)
    await pg.screenshot(path=OUT + 'd12_skill_target.png')
    await pg.keyboard.press('Escape'); await pg.click('[data-tab="combat"]')
    # Ezren spells
    ok = await wait_player(pg, 'Ezren', 240)
    print('ezren turn', ok)
    await pg.evaluate(NEAR); await pg.wait_for_timeout(500)
    if await pg.query_selector('[data-akey="spells"]'): await pg.click('[data-akey="spells"]')
    await pg.wait_for_timeout(300)
    await pg.screenshot(path=OUT + 'd13_spellbook.png')
    fb = await pg.query_selector('#spellbook [data-akey^="cast:prepared:fireball"]')
    if fb:
        await fb.click(); await pg.wait_for_timeout(200)
        pos = await foe_pos(pg) or [700, 400]
        await pg.mouse.move(pos[0], pos[1]); await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT + 'd14_area.png')
        await pg.keyboard.press('Escape')
    await pg.evaluate("() => { const BC = PF.App.Battle; BC.choose(Object.keys(BC.keyMap).find(k => k.includes('electricArc') || k.includes('daze'))); }"); await pg.wait_for_timeout(300)
    await pg.screenshot(path=OUT + 'd15_spell_save.png')
    await pg.keyboard.press('Escape')
    await pg.click('#btnLog'); await pg.wait_for_timeout(200)
    # enemy turn banner
    await pg.select_option('#animSpeed', '1')
    await pg.evaluate("() => PF.App.Battle.endTurn(true)")
    for i in range(40):
        await pg.wait_for_timeout(100)
        if await pg.evaluate("() => !document.querySelector('#banner').hidden && document.querySelector('#banner').classList.contains('foe')"):
            await pg.screenshot(path=OUT + 'd16_enemy_banner.png'); break
    if not os.path.exists(OUT + 'd16_enemy_banner.png'):
        await pg.evaluate("() => PF.App.Battle.banner({ kind: 'foe', k: 'Enemy activity', t: 'Orc Warrior 1', s: '5 hostile' }, 3)"); await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT + 'd16_enemy_banner.png')
    await pg.select_option('#animSpeed', '5')
    await pg.check('#autoParty')
    for i in range(240):
        await pg.wait_for_timeout(500)
        if await pg.is_visible('#result'): break
    await pg.wait_for_timeout(400)
    await pg.screenshot(path=OUT + 'd17_result.png')
    await pg.close()

async def mobile(b):
    pg = await b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR m: ' + str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(1500)
    await pg.screenshot(path=OUT + 'm01_home.png'); await overflow(pg, 'm home')
    await pg.tap('#btnSetup'); await pg.wait_for_timeout(700)
    await pg.screenshot(path=OUT + 'm02_setup.png'); await overflow(pg, 'm setup')
    await pg.evaluate("() => document.querySelector('#setup .page-body').scrollTop = 700"); await pg.wait_for_timeout(200)
    await pg.screenshot(path=OUT + 'm03_setup_bestiary.png')
    await pg.evaluate("() => { PF.App.show('roster'); PF.App.openEdit('iconic','valeros'); }"); await pg.wait_for_timeout(500)
    await pg.screenshot(path=OUT + 'm04_builder.png'); await overflow(pg, 'm builder')
    await pg.evaluate("() => PF.App.show('setup')")
    await pg.tap('#btnDeploy'); await pg.wait_for_timeout(800)
    await pg.screenshot(path=OUT + 'm05_deploy.png')
    await pg.evaluate("() => { PF.App.settings.speed = 5; PF.App.saveSettings(); }")
    await pg.tap('#btnBegin')
    await wait_player(pg)
    await pg.wait_for_timeout(600)
    await pg.screenshot(path=OUT + 'm06_turn.png'); await overflow(pg, 'm battle')
    k = await pg.evaluate("() => Object.keys(PF.App.Battle.keyMap).find(k => k.startsWith('strike:'))")
    await pg.tap(f'[data-akey="{k}"]'); await pg.wait_for_timeout(400)
    await pg.screenshot(path=OUT + 'm07_target.png')
    await pg.keyboard.press('Escape')
    await pg.tap('#btnLog'); await pg.wait_for_timeout(300)
    await pg.screenshot(path=OUT + 'm08_log.png')
    await pg.close()

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
        which = sys.argv[1] if len(sys.argv) > 1 else 'both'
        if which in ('both', 'd'): await desktop(b)
        if which in ('both', 'm'): await mobile(b)
        await b.close()
    print('\n'.join(errs) or 'no errors')
asyncio.run(main())
