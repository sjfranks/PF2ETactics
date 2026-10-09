import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1440,'height':900}); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/pf2e/dist/local.html'); await pg.wait_for_timeout(1200)
        n = await pg.evaluate("""() => { const D = PF.D; const ids = Object.keys(D.creatures).filter(k => !D.creatures[k].generated);
          ['beast','undead','fiend','elemental','humanoid'].forEach(f => ['brute','sniper','caster'].forEach(r => ids.push(D.makeCreature({level: 5, role: r, flavor: f}).id)));
          PF.App.startBattle({ map: 'yard', partyLevel: 5, pcs: PF.D.iconicOrder.map(id => PF.Build.iconic(id, 5)), foes: ids.slice(0, 40).map(id => ({id})) }); return PF.App.B.units.length; }""")
        await pg.wait_for_timeout(1500)
        await pg.evaluate("() => { PF.App.R.cam.gdist = 34; PF.App.R.focus(10, 6, true); }"); await pg.wait_for_timeout(800)
        await pg.screenshot(path='shots/allfig.png')
        print('units', n); print('\n'.join(errs))
        await b.close()
asyncio.run(main())
