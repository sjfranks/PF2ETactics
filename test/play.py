import asyncio, sys, json, random
from playwright.async_api import async_playwright
LEVEL = int(sys.argv[1]) if len(sys.argv) > 1 else 5
PRESET = sys.argv[2] if len(sys.argv) > 2 else 'goblinRaid'
JS_STATE = """() => { const BC = PF.App.Battle, B = BC.B; if (!B) return {none:1};
 const R = PF.App.R; const u = BC.cur;
 const scr = (x,y) => { const p = R.project(x+0.5, R.tileTop(x,y,true)+0.3, y+0.5); const r = R.renderer.domElement.getBoundingClientRect(); return [p.x + r.left, p.y + r.top]; };
 const st = { over: B.over, player: BC.isPlayerTurn(), busy: BC.busy, phase: BC.phase };
 if (!st.player) return st;
 st.name = u.name; st.acts = B.actsTotal(u);
 st.keys = Object.entries(BC.keyMap||{}).filter(([k,a]) => !a.why).map(([k,a]) => [k, a.id, a.tgt||'', a.name]);
 st.foes = B.foesOf(u).filter(f => f.hp > 0).map(f => { const c = [f.x + (f.sq-1)/2, f.y + (f.sq-1)/2]; const p = R.unitScreen(f.id); return { id: f.id, name: f.name, scr: [p.x + R.renderer.domElement.getBoundingClientRect().left, p.y + 40], d: B.dist(u, f) }; });
 // reachable tile closest to nearest foe
 const P = BC.P; let best=null, bd=1e9; const near = B.foesOf(u).filter(f=>f.hp>0).sort((a,b)=>B.dist(u,a)-B.dist(u,b))[0];
 if (P && near) P.best.forEach((c,k) => { const [x,y]=k.split(',').map(Number); if (!B.canEnd(u,x,y) || c > B.speedOf(u)) return; const ox=u.x, oy=u.y; u.x=x; u.y=y; const d=B.dist(u,near); u.x=ox; u.y=oy; if (d<bd) {bd=d; best=[x,y];} });
 st.moveTo = best ? scr(best[0], best[1]) : null; st.moveTile = best;
 return st; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1440,'height':900})
        errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERROR: '+str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        await pg.goto('file:///home/claude/pf2e/dist/local.html'); await pg.wait_for_timeout(1500)
        await pg.click('#btnSetup'); await pg.wait_for_timeout(500)
        await pg.click(f'[data-preset="{PRESET}"]'); await pg.wait_for_timeout(300)
        # set level
        for _ in range(LEVEL - 1): await pg.click('#plUp')
        await pg.click('#btnGen'); await pg.wait_for_timeout(300)
        await pg.click('#btnDeploy'); await pg.wait_for_selector('#animSpeed', state='visible', timeout=15000)
        await pg.select_option('#animSpeed', '5')
        await pg.click('#btnBegin')
        pg.set_default_timeout(5000)
        shots = 0; turns = 0; used = {}
        for it in range(int(sys.argv[3]) if len(sys.argv) > 3 else 400):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#result'): break
            st = await pg.evaluate(JS_STATE)
            if it % 10 == 0: print('it', it, st.get('name'), st.get('player'), st.get('busy'), await pg.evaluate('() => PF.App.B && PF.App.B.round'), flush=True)
            if st.get('none') or not st.get('player'): continue
            turns += 1
            keys = st['keys']; foes = st['foes']
            # try a spell first sometimes
            did = False
            spells = [k for k in keys if k[0] == 'spells']
            if spells and random.random() < 0.6:
                if not await pg.is_visible('#spellbook'):
                    await pg.click('[data-akey="spells"]'); await pg.wait_for_timeout(200)
                opts = await pg.evaluate("() => [...document.querySelectorAll('#spellbook [data-akey]')].filter(b=>!b.classList.contains('off')).map(b=>b.dataset.akey)")
                random.shuffle(opts)
                if not opts: await pg.keyboard.press('Escape')
                for k in opts[:1]:
                    await pg.click(f'#spellbook [data-akey="{k}"]'); await pg.wait_for_timeout(200)
                    if await pg.is_visible('#costPick .btn'):
                        btns = await pg.query_selector_all('#costPick .btn'); await btns[-1].click(); await pg.wait_for_timeout(200)
                    mode = await pg.evaluate("() => PF.App.Battle.mode && PF.App.Battle.mode.type")
                    used[k.split(':')[2] if k.count(':')>=2 else k] = used.get(k,0)+1
                    if mode in ('spell','area') and foes:
                        f = random.choice(foes)
                        for _ in range(3):
                            await pg.mouse.move(f['scr'][0], f['scr'][1]); await pg.wait_for_timeout(120)
                            await pg.mouse.click(f['scr'][0], f['scr'][1]); await pg.wait_for_timeout(250)
                            m2 = await pg.evaluate("() => PF.App.Battle.mode && PF.App.Battle.mode.type")
                            if m2 not in ('spell','area'): break
                        await pg.keyboard.press('Enter'); await pg.keyboard.press('Escape')
                    elif mode in ('spell',):
                        await pg.keyboard.press('Escape')
                    did = True
                if shots < 3 and did: await pg.screenshot(path=f'shots/p{shots}.png'); shots += 1
                continue
            strike = [k for k in keys if k[1] == 'strike']
            hit = False
            if strike and foes:
                k = strike[0][0]
                await pg.click(f'[data-akey="{k}"]'); await pg.wait_for_timeout(150)
                for f in sorted(foes, key=lambda f: f['d']):
                    await pg.mouse.move(f['scr'][0], f['scr'][1]); await pg.wait_for_timeout(150)
                    tip = await pg.inner_text('#tip') if await pg.is_visible('#tip') else ''
                    if '%' in tip:
                        if shots < 6: await pg.screenshot(path=f'shots/p{shots}.png'); shots += 1
                        await pg.mouse.click(f['scr'][0], f['scr'][1]); hit = True; break
                if not hit: await pg.keyboard.press('Escape')
            if not hit and st.get('moveTo'):
                await pg.mouse.move(*st['moveTo']); await pg.wait_for_timeout(150)
                await pg.mouse.click(*st['moveTo'])
                await pg.wait_for_timeout(200)
                st2 = await pg.evaluate(JS_STATE)
                if st2.get('player') and st2.get('acts') == st.get('acts'):
                    await pg.keyboard.press('Space')
            elif not hit:
                await pg.keyboard.press('Space')
        await pg.screenshot(path='shots/p_end.png')
        res = await pg.inner_text('#result') if await pg.is_visible('#result') else 'NO RESULT'
        print('turns', turns, '|', res.replace('\n',' ')[:200]); print('spells used', used)
        print('\n'.join(errs[:30]))
        await b.close()
asyncio.run(main())
