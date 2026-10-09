import asyncio, os, sys
from playwright.async_api import async_playwright
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1440,'height':900})
        pg.on('pageerror', lambda e: print('ERR', e))
        await pg.goto('file://' + W + '/dist/local.html'); await pg.wait_for_timeout(1000)
        await pg.evaluate("""() => PF.App.startBattle({ map: 'forest', partyLevel: 5, pcs: ['valeros','ezren','kyra','merisiel'].map(id => PF.Build.iconic(id, 5)), foes: ['orcWarrior','orcBrute'].map(id => ({id})) })""")
        await pg.select_option('#animSpeed','5'); await pg.click('#btnBegin')
        for i in range(80):
            await pg.wait_for_timeout(250)
            r = await pg.evaluate("() => { const BC=PF.App.Battle; return [BC.isPlayerTurn(), BC.cur && BC.cur.name, BC.busy, PF.App.B.round] }")
            if i % 8 == 0: print(r)
            if r[0] and r[1] != 'Ezren': await pg.evaluate("() => PF.App.Battle.endTurn(true)")
            if r[0] and r[1] == 'Ezren': break
        print(await pg.evaluate("() => { const B=PF.App.B, BC=PF.App.Battle; return [B.cur && B.cur.name, BC.cur && BC.cur.name, BC.busy, B.events.length, B.over, document.querySelector('#banner').hidden, BC.gen] }"))
        print(await pg.evaluate("() => { const BC=PF.App.Battle; const k=Object.keys(BC.keyMap).find(k=>k.startsWith('strike:')); BC.choose(k); return [k, PF.App.B.foesOf(BC.cur).map(t=>t.name+':'+BC.targetWhy(t)+'|'+JSON.stringify(BC.evalTarget(t).why))] }"))
        print(await pg.evaluate("() => ['#hudBottom','#trayWrap','#tray','#actionBar','#endWrap','#unitCard'].map(s => { const e=document.querySelector(s); return s+':'+e.getBoundingClientRect().width+'/'+e.scrollWidth; })"))
        print(await pg.evaluate("() => getComputedStyle(document.querySelector('#hudBottom')).gridTemplateColumns"))
        print(await pg.evaluate("() => { const l=document.querySelectorAll('.ll')[2]; const cs=getComputedStyle(l); return [l.className, cs.textAlign, cs.direction, cs.display, l.getBoundingClientRect().width] }"))
        print(await pg.evaluate("() => document.querySelector('#trayTabs').innerHTML.slice(0,400)"))
        await b.close()
asyncio.run(main())
