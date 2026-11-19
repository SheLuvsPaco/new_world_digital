// Mobile audit: horizontal overflow, small tap targets, tiny text, and full-page screenshots.
//   node scripts/mobile_audit.js [--out screenshots/mobile] [--widths 360,390] [--shots true]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (f, d) => { const i = args.indexOf(f); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:8080');
const OUT = path.resolve(arg('--out', 'screenshots/mobile'));
const WIDTHS = arg('--widths', '360,390').split(',').map(Number);
const SHOTS = arg('--shots', 'true') === 'true';
const MIRROR = path.resolve(__dirname, '..', 'mirror');

function routes() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== 'assets') walk(p);
      else if (e.name === 'index.html') out.push('/' + path.relative(MIRROR, dir).split(path.sep).join('/') + '/');
    }
  })(MIRROR);
  return out.map(r => r.replace('//', '/')).sort();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = [];
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    for (const r of routes()) {
      const page = await ctx.newPage();
      await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(1500);
      // scroll through so lazy/scroll-triggered content is laid out
      await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
      await page.waitForTimeout(600);
      const res = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const visible = el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && el.getClientRects().length; };
        const desc = el => (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + (el.textContent || '').trim().slice(0, 30) + '"');
        const wide = [];
        for (const el of document.querySelectorAll('body *')) {
          if (!visible(el)) continue;
          const b = el.getBoundingClientRect();
          if (b.right > vw + 1 || b.left < -1) {
            // skip things clipped by an ancestor with overflow hidden/clip
            let a = el.parentElement, clipped = false;
            while (a && a !== document.body) { const o = getComputedStyle(a); if (/(hidden|clip)/.test(o.overflowX) && a.getBoundingClientRect().right <= vw + 1) { clipped = true; break; } a = a.parentElement; }
            if (!clipped) wide.push(desc(el) + ` [${Math.round(b.left)}..${Math.round(b.right)}]`);
          }
        }
        const small = [];
        for (const el of document.querySelectorAll('a[href], button, input, select, textarea, label[for], [role=button]')) {
          if (!visible(el) || el.closest('[inert],[aria-hidden=true]')) continue;
          const b = el.getBoundingClientRect();
          if (b.width && b.height && (b.height < 40 || b.width < 40) && !(el.tagName === 'A' && el.closest('p, li') && getComputedStyle(el).display === 'inline')) small.push(desc(el) + ` ${Math.round(b.width)}x${Math.round(b.height)}`);
        }
        const tiny = new Set();
        for (const el of document.querySelectorAll('body *')) {
          if (!visible(el) || !el.childNodes.length) continue;
          const t = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          if (t && parseFloat(getComputedStyle(el).fontSize) < 12) tiny.add(desc(el) + ' ' + getComputedStyle(el).fontSize);
        }
        return { scrollW: document.documentElement.scrollWidth, vw, wide: wide.slice(0, 15), small: [...new Set(small)].slice(0, 25), tiny: [...tiny].slice(0, 15) };
      });
      const slug = r === '/' ? 'home' : r.replace(/^\/|\/$/g, '').replace(/\//g, '__');
      if (SHOTS && w === 390) await page.screenshot({ path: path.join(OUT, `${slug}.png`), fullPage: true }).catch(() => {});
      report.push({ width: w, route: r, ...res });
      console.log(w, r, `scrollW ${res.scrollW}/${res.vw}`, `wide ${res.wide.length}`, `small ${res.small.length}`, `tiny ${res.tiny.length}`);
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(report, null, 2));
})();
