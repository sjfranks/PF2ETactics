import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1440,'height':900})
        errs = []
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR: '+str(e)))
        await pg.goto('file:///home/claude/pf2e/dist/local.html')
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path='shots/1home.png')
        await pg.click('#btnSetup'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='shots/2setup.png', full_page=False)
        await pg.click('#btnDeploy'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='shots/3deploy.png')
        await pg.click('#btnBegin'); await pg.wait_for_timeout(3000)
        await pg.screenshot(path='shots/4battle.png')
        # hover a foe-ish location and select strike
        await pg.mouse.move(720, 380); await pg.wait_for_timeout(500)
        await pg.screenshot(path='shots/5hover.png')
        await pg.select_option('#animSpeed', '5')
        await pg.check('#autoParty')
        for i in range(60):
            await pg.wait_for_timeout(1000)
            if await pg.is_visible('#result'): break
        await pg.screenshot(path='shots/6result.png')
        await pg.click('#rEdit'); await pg.wait_for_timeout(500)
        await pg.click('[data-go=home]'); await pg.wait_for_timeout(300)
        await pg.click('#btnRoster'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='shots/7roster.png')
        print('\n'.join(errs[:40]))
        await b.close()
asyncio.run(main())
