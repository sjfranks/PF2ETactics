"""Stress the bestiary UI with ~500 creatures (generated + fake abilities records) and screenshot it."""
import asyncio, os
from playwright.async_api import async_playwright
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1440,'height':900})
        pg.on('pageerror', lambda e: print('ERR', e))
        await pg.goto('file://' + W + '/dist/local.html'); await pg.wait_for_timeout(1000)
        t = await pg.evaluate("""() => { const D = PF.D; const roles = Object.keys(D.roles), fl = Object.keys(D.flavors);
          for (let i = 0; i < 460; i++) { const c = D.makeCreature({ level: (i % 26) - 1, role: roles[i % roles.length], flavor: fl[i % fl.length], name: 'Test Creature ' + i }); delete c.generated; c.theme = ['test']; if (i % 3 === 0) c.abilities = [{ name: 'Grab', cost: 1, traits: ['attack'], text: 'The creature grabs its target.', auto: true }, { name: 'Weird Aura', cost: null, traits: ['aura'], text: 'Not automated in this sandbox.', auto: false }]; }
          PF.App.show('setup'); const t0 = performance.now(); PF.App.renderBestiary(); return [Object.keys(D.creatures).length, performance.now() - t0, document.querySelectorAll('#bList .brow').length]; }""")
        print('creatures, render ms, rows in DOM:', t)
        await pg.evaluate("() => { document.querySelector('#setup .page-body').scrollTop = 560; const l = document.querySelector('#bList'); l.scrollTop = 6000; }")
        await pg.wait_for_timeout(300)
        await pg.select_option('#bSize', 'large'); await pg.fill('#bLvMin', '3'); await pg.fill('#bLvMax', '8'); await pg.wait_for_timeout(300)
        await pg.evaluate("() => { const r = document.querySelector('#bList .brow[data-bopen]'); if (r) PF.App.openFly(Object.values(PF.D.creatures).find(c => c.abilities).id); }")
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=W + '/shots/hud/d18_bestiary500.png')
        await b.close()
asyncio.run(main())
