import asyncio, sys
from playwright.async_api import async_playwright
PRE = sys.argv[1] if len(sys.argv) > 1 else 'goblinAmbush'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1440,'height':900}); errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERROR: '+str(e)))
        pg.on('console', lambda m: errs.append(m.type+': '+m.text[:300]) if m.type in ('error','warning') and 'TUNNEL' not in m.text and 'GPU stall' not in m.text and 'swiftshader' not in m.text.lower() else None)
        await pg.goto('file:///home/claude/pf2e/dist/local.html'); await pg.wait_for_timeout(15000)
        await pg.screenshot(path='shots/v2_home.png')
        await pg.evaluate(f"""() => {{ const p = PF.D.presets.find(x => x.id === '{PRE}') || PF.D.presets[0]; PF.App.startBattle({{ map: p.map, partyLevel: p.pl, pcs: ['valeros','kyra','ezren','merisiel'].map(id => PF.Build.iconic(id, p.pl)), foes: p.foes.map(id => ({{id}})) }}); }}""")
        await pg.wait_for_timeout(15000)
        await pg.screenshot(path='shots/v2_deploy.png')
        await pg.evaluate("() => { const R = PF.App.R; const u = PF.App.B.units[0]; R.focus(u.x+0.5, u.y-1, true); R.cam.gdist = R.cam.dist = 9; R.cam.gpitch = R.cam.pitch = 0.6; }")
        await pg.wait_for_timeout(6000)
        await pg.screenshot(path='shots/v2_close.png')
        print('\n'.join(errs[:30]))
        await b.close()
asyncio.run(main())
