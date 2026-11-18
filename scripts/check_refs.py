#!/usr/bin/env python3
"""List every local file referenced by the mirror's HTML/CSS/JS that does not exist on disk.

    python3 scripts/check_refs.py            # report only
    python3 scripts/check_refs.py --fetch    # also download missing files from the live site
"""
import glob, os, re, sys, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'mirror')
LIVE = 'https://konkurs-zadacha.vercel.app'
ATTR = re.compile(r'(?:src|href|srcset|data-src|data-srcset|poster|content)="([^"]+)"')
CSSURL = re.compile(r'url\(([^)]+)\)')
QUOTED = re.compile(r'["\'](/assets/[^"\'\s]+)["\']')


def refs():
    out = set()
    for f in glob.glob(ROOT + '/**/*', recursive=True):
        if not f.endswith(('.html', '.css', '.js')):
            continue
        t = open(f, encoding='utf8', errors='ignore').read()
        for m in ATTR.finditer(t):
            for part in m.group(1).split(','):
                u = part.strip().split(' ')[0]
                if u.startswith('/') and not u.startswith('//'):
                    out.add(u.split('#')[0].split('?')[0])
        for m in CSSURL.finditer(t):
            u = m.group(1).strip('\'" ')
            if u.startswith('/'):
                out.add(u.split('?')[0])
        for m in QUOTED.finditer(t):
            out.add(m.group(1).split('?')[0])
    return out


def exists(u):
    p = os.path.join(ROOT, u.lstrip('/'))
    return os.path.exists(p) and (not os.path.isdir(p) or os.path.exists(os.path.join(p, 'index.html')))


def main():
    fetch = '--fetch' in sys.argv
    missing = sorted(u for u in refs() if not exists(u) and not u.endswith('/assets/img/3d/'))
    print(f'{len(missing)} missing')
    for u in missing:
        status = ''
        if fetch:
            dest = os.path.join(ROOT, u.lstrip('/'))
            if u.endswith('/'):
                dest = os.path.join(dest, 'index.html')
            try:
                data = urllib.request.urlopen(LIVE + u, timeout=20).read()
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                open(dest, 'wb').write(data)
                status = f'fetched {len(data)} B'
            except Exception as e:
                status = f'FAILED {getattr(e, "code", e)}'
        print(' ', u, status)


if __name__ == '__main__':
    main()
