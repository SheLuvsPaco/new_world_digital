#!/usr/bin/env python3
"""Fix 3: the whole /assets/img/snimki/ folder is missing on the live site (7 photos, every size).

There are no original photos to restore, so each missing photo is replaced by the closest
unbranded photo the site already has. The script writes the 640/1200 sizes under the original
file names, drops the 2000w size (no source is that large) and rewrites the alt text so it
describes what the stand-in photo actually shows.
"""
import glob, os, re
from PIL import Image

MIRROR = os.path.join(os.path.dirname(__file__), '..', 'mirror')
IMG = os.path.join(MIRROR, 'assets', 'img')

PHOTOS = {  # missing name: (stand-in source, new alt text)
    'ogled-1': ('blog/kak-proticha-komunikatsiyata-s-remontna-firma-1024.webp', 'Майстор и клиент обсъждат плана на ремонта'),
    'ogled-2': ('blog/tsyalosten-remont-ili-rabota-s-razlichni-maystori-koe-e-po-dobriyat-izbor-1024.webp', 'Една и съща стая преди и след ремонта'),
    'dogovor-2': ('obekti/ednostaen-apartament-v-kv-vazrazhdane-varna-1-1080.webp', 'Готовото жилище, предадено на клиента'),
    'izpalnenie-1': ('blog/predi-i-sled-remonta-kak-pravilnoto-planirane-pravi-razlikata-1024.webp', 'Подът преди и след ремонта'),
    'izpalnenie-3': ('blog/vanshna-toploizolatsiya-i-remont-na-fasadi-vav-varna-kakvo-tryabva-da-znae-etazhnata-sobstvenost-1024.webp', 'Майстори работят по фасадата'),
    'pochistvane-1': ('obekti/dvustaen-apartament-briz-varna-1-1080.webp', 'Почистен хол след края на ремонта'),
    'pochistvane-2': ('obekti/dvustaen-apartament-v-tsentara-na-varna-1-1080.webp', 'Готово и почистено жилище'),
}
SIZES = (640, 1200)


def make_images():
    out = os.path.join(IMG, 'snimki')
    os.makedirs(out, exist_ok=True)
    for name, (src, _) in PHOTOS.items():
        im = Image.open(os.path.join(IMG, src)).convert('RGB')
        for w in SIZES:
            h = round(im.height * w / im.width)
            im.resize((w, h), Image.LANCZOS).save(os.path.join(out, f'{name}-{w}.webp'), 'WEBP', quality=82, method=6)


def fix_html():
    changed = 0
    for f in glob.glob(MIRROR + '/**/index.html', recursive=True):
        t = open(f, encoding='utf8').read()
        orig = t
        for name, (_, alt) in PHOTOS.items():
            base = f'/assets/img/snimki/{name}'
            t = t.replace(f'{base}-2000.webp 2000w, ', '').replace(f'src="{base}-2000.webp"', f'src="{base}-1200.webp"')
            t = re.sub(r'(<img[^>]*' + re.escape(base) + r'-[^>]*?alt=")[^"]*(")', r'\g<1>' + alt + r'\2', t)
        if t != orig:
            open(f, 'w', encoding='utf8').write(t)
            changed += 1
    return changed


if __name__ == '__main__':
    make_images()
    print('pages changed:', fix_html())
