import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1440,'height':900})
        errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERROR: '+str(e)+' '+str(e.stack)[:600]))
        await pg.goto('file:///home/claude/pf2e/dist/local.html'); await pg.wait_for_timeout(1500)
        await pg.click('#btnSetup'); await pg.wait_for_timeout(500)
        await pg.click('[data-preset="orcRaid"]'); await pg.wait_for_timeout(300)
        for _ in range(2): await pg.click('#plUp')
        await pg.click('#btnGen'); await pg.wait_for_timeout(300)
        print(await pg.evaluate("() => JSON.stringify(PF.App.setup)"))
        await pg.click('#btnDeploy'); await pg.wait_for_timeout(800)
        print(await pg.evaluate("() => PF.App.screen")); print(await pg.evaluate("() => document.querySelector('#toast').textContent"))
        print('\n'.join(errs))
        await b.close()
asyncio.run(main())
