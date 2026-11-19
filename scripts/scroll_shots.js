// Scroll a page like a user (wheel) on a phone and take viewport screenshots along the way.
//   node scripts/scroll_shots.js /route/ [--out screenshots/scroll] [--step 800] [--width 390]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const arg = (f, d) => { const i = args.indexOf(f); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const ROUTE = args[0] && !args[0].startsWith('--') ? args[0] : '/';
const OUT = path.resolve(arg('--out', 'screenshots/scroll'));
const STEP = +arg('--step', 800);
const W = +arg('--width', 390), H = +arg('--height', 844);
const BASE = arg('--base', 'http://localhost:8080');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const c = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 900, hasTouch: W < 900 });
  const p = await c.newPage();
  await p.goto(BASE + ROUTE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(3000);
  const slug = ROUTE === '/' ? 'home' : ROUTE.replace(/^\/|\/$/g, '').replace(/\//g, '__');
  let i = 0, last = -1;
  while (i < 60) {
    await p.screenshot({ path: path.join(OUT, `${slug}-${String(i).padStart(2, '0')}.png`) });
    const y = await p.evaluate(() => scrollY);
    if (y === last) break;
    last = y; i++;
    await p.mouse.move(W / 2, H / 2);
    await p.mouse.wheel(0, STEP);
    await p.waitForTimeout(900);
  }
  console.log(slug, i, 'frames');
  await b.close();
})();
