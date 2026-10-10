"""Real-browser regression coverage for touch input, action costs and responsive UI.

Run `npm run build`, then `npm run test:ui`. Requires Python Playwright and Chromium
(or `python3 -m playwright install chromium`). BROWSER_PATH can select a browser.
Screenshots are written to test/artifacts/mobile/ for visual review.
"""
import asyncio
import json
import os
from pathlib import Path
import shutil
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "test/artifacts/mobile"

STATE = """() => { const C = PF.App.Battle, u = C.cur; return {
  id: u.id, x: u.x, y: u.y, acts: C.B.actsTotal(u), round: C.B.round
}; }"""

# Pick through the real renderer, so a tap exercises both raycasting and the
# controller. Reject projected cells covered by the HUD or a creature model.
DESTINATION = """() => {
  const C = PF.App.Battle, R = PF.App.R, u = C.cur;
  const top = document.querySelector('.hud-top').getBoundingClientRect().bottom + 65;
  const bottom = document.querySelector('#hudBottom').getBoundingClientRect().top - 30;
  for (const [key, cost] of C.P.best) {
    const [x,y] = key.split(',').map(Number);
    if (cost !== 5 || !C.B.canEnd(u,x,y)) continue;
    const p = R.project(x+.5, R.tileTop(x,y)+.03, y+.5);
    if (p.x < 30 || p.x > innerWidth-30 || p.y < top || p.y > bottom) continue;
    const hit = R.pick(p.x,p.y);
    if (hit && !hit.unit && hit.x === x && hit.y === y) return {x,y,cx:p.x,cy:p.y};
  }
  return null;
}"""


async def stable(page):
    await page.wait_for_function("""() => {
      const c = PF.App.R.cam;
      return Math.abs(c.tx-c.gtx)+Math.abs(c.tz-c.gtz)+Math.abs(c.dist-c.gdist) < .05;
    }""", timeout=45000)


async def player_turn(page):
    await page.wait_for_function("PF.App.Battle.isPlayerTurn()", timeout=45000)
    await stable(page)


async def shot(page, name):
    await page.screenshot(path=str(SHOTS / (name + ".png")))


async def main(base_url):
    SHOTS.mkdir(parents=True, exist_ok=True)
    errors = []
    async with async_playwright() as p:
        executable = os.environ.get("BROWSER_PATH") or shutil.which("chromium")
        browser = await p.chromium.launch(
            executable_path=executable,
            args=["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        )
        context = await browser.new_context(
            viewport={"width": 390, "height": 844}, has_touch=True,
            is_mobile=True, device_scale_factor=1, reduced_motion="reduce",
        )
        # The engine must boot without any CDN or font network access.
        await context.route("https://**/*", lambda route: route.abort())
        page = await context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        await page.goto(base_url + "/index.html")
        await page.wait_for_function("window.PF && PF.App.R")
        assert await page.evaluate("PF.App.settings.gfx") == "medium"
        await page.evaluate("PF.App.settings.gfx='low'; PF.App.applySettings()")
        await stable(page)
        await shot(page, "home-390")

        await page.locator("#btnQuick").tap()
        assert await page.evaluate("PF.App.Battle.cfg.partyLevel <= 3")
        await page.locator("#btnLeave").tap()
        await page.locator('#setup [data-go="home"]').tap()
        await page.locator("#btnLearn").tap()
        assert await page.evaluate("PF.App.Battle.cfg.guided && PF.App.Battle.cfg.partyLevel === 1")
        assert await page.locator("#battleGuide").is_visible()
        await shot(page, "guided-deployment-390")

        # Controlled legal positions make rule assertions independent of AI and
        # initiative randomness, while all player actions go through the real UI.
        await page.evaluate("""() => {
          const A = PF.App;
          A.settings.speed=5; A.settings.banners=false; A.applySettings();
          A.startBattle({map:'yard', partyLevel:1, title:'Touch regression',
            pcs:[PF.Build.iconic('valeros',1)], foes:[{id:'zombieShambler'}]});
          const C=A.Battle, [u,f]=C.B.units;
          u.x=5;u.y=4;f.x=8;f.y=4;
          C.B.units.forEach(t=>A.R.place(A.R.units[t.id],t.x,t.y));
          PF.U.seed(42);
        }""")
        await page.locator("#btnBegin").tap()
        await player_turn(page)
        bounds = await page.locator("#hudBottom").bounding_box()
        assert bounds["height"] < 290, bounds
        await shot(page, "battle-390")

        # Pinch + twist must change the camera without spending an action or
        # accidentally leaving a tap armed when the second finger is released.
        before = await page.evaluate(STATE)
        camera = await page.evaluate("({...PF.App.R.cam})")
        cdp = await context.new_cdp_session(page)
        await cdp.send("Input.dispatchTouchEvent", {"type":"touchStart", "touchPoints":[{"x":140,"y":340,"id":1},{"x":230,"y":340,"id":2}]})
        await cdp.send("Input.dispatchTouchEvent", {"type":"touchMove", "touchPoints":[{"x":115,"y":310,"id":1},{"x":255,"y":370,"id":2}]})
        await cdp.send("Input.dispatchTouchEvent", {"type":"touchEnd", "touchPoints":[]})
        assert await page.evaluate(STATE) == before
        assert await page.evaluate("PF.App.Battle.pendingMove === null")
        after_camera = await page.evaluate("({...PF.App.R.cam})")
        assert abs(after_camera["gyaw"]-camera["gyaw"]) > .1
        assert after_camera["gdist"] < camera["gdist"]
        await page.evaluate("Object.assign(PF.App.R.cam, {gdist:15, gyaw:0, gpitch:.88}); PF.App.R.focus(5.5,4.5)")
        await stable(page)

        # First tap only previews. Cancel is free. Confirmation spends exactly
        # one action and follows the destination shown on the card.
        dest = await page.evaluate(DESTINATION)
        assert dest, "No visible one-action destination"
        await page.touchscreen.tap(dest["cx"], dest["cy"])
        assert await page.evaluate(STATE) == before
        assert await page.locator('[data-shot="move"]').is_visible()
        await shot(page, "movement-preview-390")
        await page.locator('[data-shot="cancel"]').tap()
        assert await page.evaluate(STATE) == before
        assert await page.evaluate("PF.App.Battle.pendingMove === null")
        await page.touchscreen.tap(dest["cx"], dest["cy"])
        await page.locator('[data-shot="move"]').tap()
        await player_turn(page)
        moved = await page.evaluate(STATE)
        assert (moved["x"], moved["y"]) == (dest["x"], dest["y"]), moved
        assert moved["acts"] == before["acts"]-1, moved
        assert await page.evaluate("PF.App.Battle.pendingMove === null")

        # A cancelled gesture is not a tap; a stale preview cannot execute after
        # changing ability, ending the turn, or starting another encounter.
        await cdp.send("Input.dispatchTouchEvent", {"type":"touchStart", "touchPoints":[{"x":190,"y":330,"id":3}]})
        await cdp.send("Input.dispatchTouchEvent", {"type":"touchCancel", "touchPoints":[]})
        assert await page.evaluate(STATE) == moved
        assert await page.evaluate("PF.App.Battle.pendingMove === null")
        await page.locator('[data-tab="tactics"]').tap()
        assert await page.locator('[data-akey="raiseShield"]').is_visible()
        await page.locator('[data-tab="combat"]').tap()
        await page.locator('.abtn[data-akey^="strike:"]').filter(has_text="Javelin").tap()
        assert await page.locator("#shotPanel .roll-details").is_visible()
        assert await page.evaluate(STATE) == moved
        await shot(page, "strike-preview-390")
        await page.locator('[data-shot="go"]').tap()
        await player_turn(page)
        struck = await page.evaluate(STATE)
        assert struck["acts"] == moved["acts"]-1

        # Accidentally touching Back must not discard a live encounter.
        await page.locator("#btnLeave").tap()
        assert await page.locator("#keepPlaying").is_visible()
        await page.locator("#keepPlaying").tap()
        assert await page.evaluate(STATE) == struck

        # Check the same battle at narrow, landscape and tablet sizes. Camera
        # and command buttons must stay inside the viewport after orientation.
        for width, height in [(320,568),(844,390),(768,1024)]:
            await page.set_viewport_size({"width":width,"height":height})
            await page.wait_for_timeout(400)
            for selector in ['#btnLeave','[data-akey="end"]','[data-camera="focus"]']:
                box = await page.locator(selector).bounding_box()
                assert box and box["x"] >= 0 and box["y"] >= 0, (selector,box)
                assert box["x"]+box["width"] <= width+1 and box["y"]+box["height"] <= height+1, (selector,box)
            await shot(page, f"battle-{width}")
        await page.set_viewport_size({"width":390,"height":844})
        await page.locator("#autoParty").check()
        await page.wait_for_function("PF.App.Battle.B.over !== null", timeout=90000)
        await page.locator("#result").wait_for(state="visible",timeout=45000)
        await shot(page, "result-390")
        await page.locator("#rEdit").tap()
        assert await page.evaluate("PF.App.Battle.pendingMove === null")
        # Virtualized rows must use the same height as their visual touch boxes.
        rows = await page.locator('.brow:not(.grp)').evaluate_all("els => els.slice(0,6).map(e=>({y:e.offsetTop,h:e.offsetHeight}))")
        assert all(b["y"] >= a["y"]+a["h"] for a,b in zip(rows,rows[1:])), rows
        await shot(page, "setup-390")

        await context.close()
        desktop = await browser.new_context(viewport={"width":1440,"height":900}, reduced_motion="reduce")
        await desktop.route("https://**/*",lambda route:route.abort())
        await desktop.add_init_script("localStorage.setItem('tat.gfx', 'low')")
        dp = await desktop.new_page()
        dp.on("pageerror",lambda error:errors.append(str(error)))
        await dp.goto(base_url + "/dist/local.html", timeout=60000)
        await dp.wait_for_function("window.PF && PF.App.R")
        await dp.evaluate("PF.App.settings.gfx='low'; PF.App.applySettings()")
        await dp.locator('#btnQuick').click()
        await stable(dp)
        await shot(dp, "desktop-deployment")
        assert not errors, errors
        print(json.dumps({"status":"passed","phone_dock_height":round(bounds["height"],1),"viewports":["390×844","320×568","844×390","768×1024","1440×900"],"page_errors":errors,"screenshots":str(SHOTS)}))
        await browser.close()


if __name__ == "__main__":
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *_):
            pass

    with ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT))) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            asyncio.run(main(f"http://127.0.0.1:{server.server_port}"))
        finally:
            server.shutdown()
