import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        errs = []
        # desktop: Ezren fireball preview
        pg = await b.new_page(viewport={'width':1440,'height':900})
        pg.on('pageerror', lambda e: errs.append('PAGEERROR: '+str(e)))
        await pg.goto('file:///home/claude/pf2e/dist/local.html'); await pg.wait_for_timeout(1200)
        await pg.evaluate("""() => { const A = PF.App; A.startBattle({ map: 'forest', partyLevel: 5, pcs: ['ezren','valeros','kyra','merisiel'].map(id => PF.Build.iconic(id, 5)), foes: ['orcWarrior','orcWarrior','orcBrute','orcBrute','goblinPyro'].map(id => ({id})) }); }""")
        await pg.wait_for_timeout(600)
        await pg.select_option('#animSpeed', '5')
        await pg.click('#btnBegin')
        for i in range(40):
            await pg.wait_for_timeout(300)
            ok = await pg.evaluate("() => PF.App.Battle.isPlayerTurn() && PF.App.Battle.cur.name === 'Ezren'")
            if ok: break
            if await pg.evaluate("() => PF.App.Battle.isPlayerTurn()"): await pg.keyboard.press('Space')
        await pg.click('[data-akey="spells"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='shots/s1_spellbook.png')
        fb = await pg.query_selector('#spellbook [data-akey^="cast:prepared:fireball"]')
        if fb:
            await fb.click(); await pg.wait_for_timeout(200)
            pos = await pg.evaluate("""() => { const B = PF.App.B, R = PF.App.R; const f = B.units.filter(u => u.team === 'foe')[0]; const p = R.unitScreen(f.id); const r = R.renderer.domElement.getBoundingClientRect(); return [p.x + r.left, p.y + r.top + 50]; }""")
            await pg.mouse.move(pos[0], pos[1]); await pg.wait_for_timeout(400)
            await pg.screenshot(path='shots/s2_fireball.png')
            await pg.mouse.click(pos[0], pos[1]); await pg.wait_for_timeout(2500)
            await pg.screenshot(path='shots/s3_after.png')
        # builder with a caster
        await pg.click('#btnLeave'); await pg.wait_for_timeout(300)
        await pg.evaluate("() => { PF.App.show('roster'); PF.App.openEdit('iconic','seoni'); }"); await pg.wait_for_timeout(500)
        await pg.evaluate("() => { document.querySelector('#fLevel').value='9'; document.querySelector('#fLevel').dispatchEvent(new Event('change')); }"); await pg.wait_for_timeout(500)
        await pg.evaluate("() => document.querySelector('.page-body.builder').scrollTop = 900"); await pg.wait_for_timeout(200)
        await pg.screenshot(path='shots/s4_builder.png')
        await pg.close()
        # mobile
        pg = await b.new_page(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR m: '+str(e)))
        await pg.goto('file:///home/claude/pf2e/dist/local.html'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='shots/m1_home.png')
        await pg.tap('#btnSetup'); await pg.wait_for_timeout(800)
        await pg.screenshot(path='shots/m2_setup.png')
        sw = await pg.evaluate("() => [document.documentElement.scrollWidth, document.querySelector('#setup .page-body').scrollWidth, innerWidth]")
        print('mobile widths', sw)
        await pg.tap('#btnDeploy'); await pg.wait_for_timeout(800)
        await pg.tap('#btnBegin'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path='shots/m3_battle.png')
        print('\n'.join(errs))
        await b.close()
asyncio.run(main())
