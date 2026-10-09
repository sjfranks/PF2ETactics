import asyncio, sys
from playwright.async_api import async_playwright
PRE = sys.argv[1] if len(sys.argv) > 1 else 'goblinAmbush'
SHOTS = int(sys.argv[2]) if len(sys.argv) > 2 else 6
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1440,'height':900}); errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERROR: '+str(e)))
        pg.on('console', lambda m: errs.append(m.type+': '+m.text[:300]) if m.type in ('error',) and 'TUNNEL' not in m.text else None)
        await pg.goto('file:///home/claude/pf2e/dist/local.html'); await pg.wait_for_timeout(8000)
        await pg.evaluate(f"""() => {{ const p = PF.D.presets.find(x => x.id === '{PRE}') || PF.D.presets[0]; PF.App.startBattle({{ map: p.map, partyLevel: p.pl, pcs: ['valeros','kyra','ezren','merisiel'].map(id => Object.assign(PF.Build.iconic(id, p.pl), {{ai:true}})), foes: p.foes.map(id => ({{id}})) }}); }}""")
        await pg.wait_for_timeout(8000)
        await pg.click('#btnBegin')
        n = 0
        for i in range(300):
            await pg.wait_for_timeout(700)
            if await pg.is_visible('#result'): break
            ev = await pg.evaluate("() => { const BC = PF.App.Battle; return BC.busy; }")
            if i % 6 == 3 and n < SHOTS:
                await pg.screenshot(path=f'shots/v3_{n}.png'); n += 1
        await pg.screenshot(path='shots/v3_end.png')
        print('rounds', await pg.evaluate("() => PF.App.B && PF.App.B.round"), 'over', await pg.evaluate("() => PF.App.B && PF.App.B.over"))
        print('\n'.join(errs[:30]))
        await b.close()
asyncio.run(main())
