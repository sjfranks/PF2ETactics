#!/usr/bin/env python3
"""Screenshot test/models_gallery.html.  usage: tools/shoot.py OUT.png 'query string' [w h]"""
import asyncio, sys, os
from playwright.async_api import async_playwright
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out, qs = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'mode=heroes'
w = int(sys.argv[3]) if len(sys.argv) > 3 else 1600
h = int(sys.argv[4]) if len(sys.argv) > 4 else 1000
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--allow-file-access-from-files'])
        pg = await b.new_page(viewport={'width': w, 'height': h})
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append('pageerror: ' + str(e)))
        await pg.goto('file://' + root + '/test/models_gallery.html?' + qs + '&w=%d&h=%d' % (w, h))
        await pg.wait_for_function('window.READY === true', timeout=240000)
        await pg.wait_for_timeout(300)
        info = await pg.evaluate("document.getElementById('info').textContent")
        chk = await pg.evaluate("window.CHECK ? JSON.stringify(window.CHECK) : ''")
        await pg.screenshot(path=out)
        print(info[:600]); print(chk[:3000])
        for l in logs[:20]: print(l)
        await b.close()
asyncio.run(main())
