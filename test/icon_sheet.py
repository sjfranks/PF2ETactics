"""Render every icon in PF.Icons.set to shots/icons.png for visual review."""
import asyncio, os
from playwright.async_api import async_playwright
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def main():
    os.makedirs(W + '/shots', exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1400,'height':900}, device_scale_factor=1)
        await pg.goto('file://'+W+'/dist/local.html'); await pg.wait_for_timeout(800)
        await pg.evaluate("""() => { const I = PF.Icons; const names = Object.keys(I.set);
          document.body.innerHTML = '<div style="display:grid;grid-template-columns:repeat(14,1fr);gap:6px;padding:10px;background:#0b1316;color:#cfe9ee;font:10px sans-serif">' + names.map(n => '<div style="display:grid;justify-items:center;gap:2px;padding:4px;border:1px solid #234">' + I.svg(n, 32) + '<span>' + n + '</span></div>').join('') + '</div>';
          const st = document.createElement('style'); st.textContent = 'svg.ico{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round} svg.ico .f{fill:currentColor;stroke:none} body{overflow:auto!important}'; document.head.appendChild(st); }""")
        await pg.wait_for_timeout(200)
        await pg.screenshot(path=W+'/shots/icons.png', full_page=True)
        await b.close()
asyncio.run(main())
