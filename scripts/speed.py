#!/usr/bin/env python3
"""Speed pass for the mirror. Safe to re-run.

  python3 scripts/speed.py textures   # recompress the 1024px 3D colour textures (run once)
  python3 scripts/speed.py build      # delayed 3D start, phone pixel density, version tags

build:
  * The 3D bundles (nachalo/proces/konstruktor.js, ~800 KB each) ran before the first
    paint, so the poster/loader could not show for seconds on phones. They are now
    fetched early at low priority and executed after the page's load event (idle).
  * The 3D scenes rendered phones at 2x pixel density (more than desktop's 1.75x);
    phones now use 1.5x.
  * Every CSS/JS URL gets ?v=<content hash>, so files can be cached for a year and
    still update when they change (see vercel.json).
"""
import glob, hashlib, io, os, re, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'mirror')
ASSETS = os.path.join(ROOT, 'assets')
DELAYED = ['proces.js', 'konstruktor.js']  # homepage 3D (nachalo.js) starts right away
DENSITY = {  # file: (original, replacement)
    'nachalo.js': ('gu(s,{gastota:n?2:1.75})', 'gu(s,{gastota:n?1.5:1.75})'),
    'proces.js': ('{alpha:!1,gastota:HM()?2:1.6}', '{alpha:!1,gastota:HM()?1.5:1.6}'),
}


def textures():
    saved = 0
    for f in sorted(glob.glob(os.path.join(ASSETS, 'img', '3d', '*.jpg'))):
        im = Image.open(f)
        if im.width < 1024 or f.endswith('-n.jpg'):
            continue  # small textures and normal maps stay as they are
        before = os.path.getsize(f)
        buf = io.BytesIO()
        im.convert('RGB').save(buf, 'JPEG', quality=78, optimize=True, progressive=True, subsampling='4:2:0')
        if buf.tell() < before * 0.95:
            open(f, 'wb').write(buf.getvalue())
            saved += before - buf.tell()
            print(f'{os.path.basename(f):22} {before // 1024:4} KB -> {buf.tell() // 1024:4} KB')
    print(f'saved {saved // 1024} KB')


def digest(path):
    return hashlib.md5(open(path, 'rb').read()).hexdigest()[:8]


def images_960():
    """Phones (390px at 1.75-3x) picked the 1280px service images; add a 960px step."""
    out = []
    for src in glob.glob(os.path.join(ASSETS, 'img', 'uslugi', 'u-*-2048.webp')):
        dst = src.replace('-2048.webp', '-960.webp')
        if not os.path.exists(dst):
            im = Image.open(src).convert('RGB')
            im.resize((960, round(im.height * 960 / im.width)), Image.LANCZOS).save(dst, 'WEBP', quality=80, method=6)
        out.append(os.path.basename(src).replace('-2048.webp', ''))
    return out


def build():
    names = images_960()
    font_css = open(os.path.join(ASSETS, 'css', 'shriftove.css'), encoding='utf8').read().replace('url(../fonts/', 'url(/assets/fonts/')
    home_css = open(os.path.join(ASSETS, 'css', 'nachalo.css'), encoding='utf8').read().strip()
    for name, (old, new) in DENSITY.items():
        p = os.path.join(ASSETS, 'js', name)
        t = open(p, encoding='utf8').read()
        if old in t:
            open(p, 'w', encoding='utf8').write(t.replace(old, new))
            print('density:', name)
    hashes = {}
    for p in glob.glob(os.path.join(ASSETS, 'css', '*.css')) + glob.glob(os.path.join(ASSETS, 'js', '*.js')):
        rel = '/' + os.path.relpath(p, ROOT).replace(os.sep, '/')
        hashes[rel] = digest(p)
    pages = 0
    for f in glob.glob(ROOT + '/**/index.html', recursive=True):
        t = open(f, encoding='utf8').read()
        orig = t
        # 960px step in the service image srcsets
        for n in names:
            a = f'/assets/img/uslugi/{n}-1280.webp 1280w'
            b = f'/assets/img/uslugi/{n}-960.webp 960w'
            if a in t and b not in t:
                t = t.replace(a, f'{a}, {b}')
        # the 700-byte @font-face file was a separate render-blocking request: inline it
        t = re.sub(r'<link rel="stylesheet" href="/assets/css/shriftove\.css(\?v=[0-9a-f]+)?">', lambda m: f'<style>{font_css}</style>', t)
        # the homepage-only stylesheet (5 KB gzipped) blocked the first paint as a separate request:
        # inline it; the marked <style> is refreshed from the file on every run
        t = re.sub(r'<link rel="stylesheet" href="/assets/css/nachalo\.css(\?v=[0-9a-f]+)?">|<style data-inline="nachalo\.css">.*?</style>',
                   lambda m: f'<style data-inline="nachalo.css">{home_css}</style>', t, flags=re.S)
        # content-based version tags on every CSS/JS reference
        for rel, h in hashes.items():
            t = re.sub(re.escape(rel) + r'(\?v=[0-9a-f]+)?(?=["\'])', f'{rel}?v={h}', t)
        # delayed start for the heavy 3D bundles
        for name in DELAYED:
            rel = f'/assets/js/{name}'
            tag = re.search(r'<script src="' + re.escape(rel) + r'\?v=[0-9a-f]+" defer></script>', t)
            if tag:
                url = f'{rel}?v={hashes[rel]}'
                loader = ('<link rel="preload" href="%s" as="script" fetchpriority="low">'
                          '<script>(()=>{const go=()=>{const s=document.createElement("script");s.src="%s";document.body.append(s)};'
                          'const later=()=>"requestIdleCallback" in window?requestIdleCallback(go,{timeout:1200}):setTimeout(go,200);'
                          'document.readyState==="complete"?later():addEventListener("load",later,{once:true})})()</script>') % (url, url)
                t = t.replace(tag.group(0), loader)
        if t != orig:
            open(f, 'w', encoding='utf8').write(t)
            pages += 1
    print('pages updated:', pages)


if __name__ == '__main__':
    {'textures': textures, 'build': build}[sys.argv[1]]()
