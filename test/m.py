import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
        await pg.goto('file:///home/claude/pf2e/dist/local.html'); await pg.wait_for_timeout(1200)
        await pg.tap('#btnSetup'); await pg.wait_for_timeout(600)
        r = await pg.evaluate("""() => [...document.querySelectorAll('#setup *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 && !e.closest('.preset-list'); }).slice(0, 12).map(e => e.tagName + '.' + e.className + '#' + e.id + ' ' + Math.round(e.getBoundingClientRect().right))""")
        print('\n'.join(r))
        await b.close()
asyncio.run(main())
