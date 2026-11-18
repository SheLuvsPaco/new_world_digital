// Screenshot every page on the live site and on the local copy (desktop + mobile),
// and log failed requests / page errors on the local copy.
//   node scripts/compare.js [--local http://localhost:8080] [--out screenshots/compare] [--only local]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (f, d) => { const i = args.indexOf(f); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const LIVE = 'https://konkurs-zadacha.vercel.app';
const LOCAL = arg('--local', 'http://localhost:8080');
const OUT = path.resolve(arg('--out', 'screenshots/compare'));
const ONLY = arg('--only', 'both'); // both | local | live
const MIRROR = path.resolve(__dirname, '..', 'mirror');

function routes() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== 'assets') walk(p);
      else if (e.name === 'index.html') out.push('/' + path.relative(MIRROR, dir).split(path.sep).join('/') + (dir === MIRROR ? '' : '/'));
    }
  })(MIRROR);
  return out.map(r => r.replace('//', '/')).sort();
}

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = [];
  const sites = ONLY === 'both' ? [['live', LIVE], ['local', LOCAL]] : ONLY === 'local' ? [['local', LOCAL]] : [['live', LIVE]];
  for (const [dname, dev] of Object.entries(DEVICES)) {
    const ctx = await browser.newContext(dev);
    for (const r of routes()) {
      for (const [sname, base] of sites) {
        const page = await ctx.newPage();
        const fails = [], errors = [];
        page.on('response', res => { if (res.status() >= 400) fails.push(`${res.status()} ${res.url().replace(base, '')}`); });
        page.on('requestfailed', req => fails.push(`FAILED ${req.url().replace(base, '')}`));
        page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
        try {
          await page.goto(base + r, { waitUntil: 'networkidle', timeout: 45000 });
        } catch (e) { errors.push('goto: ' + e.message.slice(0, 120)); }
        await page.waitForTimeout(3500);
        const slug = (r === '/' ? 'home' : r.replace(/^\/|\/$/g, '').replace(/\//g, '__'));
        await page.screenshot({ path: path.join(OUT, `${dname}-${slug}-${sname}.png`) });
        report.push({ device: dname, route: r, site: sname, fails, errors });
        if (sname === 'local' && (fails.length || errors.length)) console.log(dname, r, JSON.stringify({ fails, errors }));
        await page.close();
      }
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`done: ${report.length} page loads, ${routes().length} routes`);
})();
