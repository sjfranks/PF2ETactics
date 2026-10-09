import asyncio, os
from playwright.async_api import async_playwright
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def main():
    os.makedirs(W + '/shots/base', exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1440,'height':900})
        await pg.goto('file://'+W+'/dist/local.html'); await pg.wait_for_timeout(2000)
        await pg.screenshot(path=W+'/shots/base/home.png')
        await pg.click('#btnSetup'); await pg.wait_for_timeout(800)
        await pg.screenshot(path=W+'/shots/base/setup.png')
        await pg.click('#btnDeploy'); await pg.wait_for_timeout(1000)
        await pg.select_option('#animSpeed','5')
        await pg.click('#btnBegin')
        for i in range(30):
            await pg.wait_for_timeout(300)
            if await pg.evaluate("()=>PF.App.Battle.isPlayerTurn()"): break
        await pg.screenshot(path=W+'/shots/base/battle.png')
        await b.close()
asyncio.run(main())
