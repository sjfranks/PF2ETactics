#!/usr/bin/env python3
"""Batch screenshots of test/models_gallery.html.
usage: tools/shoot_many.py OUTDIR name1='query1' name2='query2' ...   (each saved as OUTDIR/name.png)"""
import asyncio, sys, os
from playwright.async_api import async_playwright
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
outdir = sys.argv[1]; jobs = [a.split('=', 1) for a in sys.argv[2:]]
W, H = int(os.environ.get('W', 1600)), int(os.environ.get('H', 1000))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--allow-file-access-from-files'])
        for name, qs in jobs:
            pg = await b.new_page(viewport={'width': W, 'height': H}); logs = []
            pg.on('console', lambda m: logs.append(m.text) if m.type == 'error' else None)
            pg.on('pageerror', lambda e: logs.append('pageerror: ' + str(e)))
            await pg.goto('file://' + root + '/test/models_gallery.html?' + qs + '&w=%d&h=%d' % (W, H))
            await pg.wait_for_function('window.READY === true', timeout=300000)
            info = await pg.evaluate("document.getElementById('info').textContent")
            await pg.screenshot(path=os.path.join(outdir, name + '.png'))
            print(name, '|', info[:300], '|', ' ; '.join(logs[:5]))
            await pg.close()
        await b.close()
asyncio.run(main())
