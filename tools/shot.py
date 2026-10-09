"""Screenshot helper for gfx tests.
usage: python3 tools/shot.py <html relative to repo> <out.png> [query] [wait_ms] [w] [h]
Prints console messages (errors/warnings + 'GFX' logs)."""
import asyncio, sys, os
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

async def main():
    page = sys.argv[1]; out = sys.argv[2]
    q = sys.argv[3] if len(sys.argv) > 3 else ''
    wait = int(sys.argv[4]) if len(sys.argv) > 4 else 3000
    w = int(sys.argv[5]) if len(sys.argv) > 5 else 1280
    h = int(sys.argv[6]) if len(sys.argv) > 6 else 800
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': w, 'height': h})
        pg.on('console', lambda m: print(m.type, m.text[:2000]))
        pg.on('pageerror', lambda e: print('PAGEERROR', e))
        url = 'file://' + os.path.join(ROOT, page) + (('?' + q) if q else '')
        await pg.goto(url, wait_until='commit', timeout=0)
        # demo pages may set window.__ready when the frozen frame is rendered
        errs = []
        pg.on('pageerror', lambda e: errs.append(e))
        t = 0
        while t < wait:
            if errs: break
            try:
                if await pg.evaluate('window.__ready === true'): break
            except Exception: pass
            await pg.wait_for_timeout(500); t += 500
        if t >= wait: print('note: __ready not set within', wait, 'ms')
        await pg.screenshot(path=out)
        await b.close()

asyncio.run(main())
