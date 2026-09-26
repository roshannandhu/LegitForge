"""Rebuild app/fonts/archivo-latin.woff2: Archivo (variable wght 100-900, wdth 62-125) as ONE
subset holding ASCII, Latin-1, the site's punctuation and ₹, limited to what Google Fonts serves in
its latin / latin-ext / vietnamese files (so nothing renders differently from next/font/google).

  python3 -m venv /tmp/fe && /tmp/fe/bin/pip install fonttools brotli
  /tmp/fe/bin/python scripts/subset-archivo.py "extra characters to include"

Run it when copy gains a new Latin character (npm run check's "font coverage" names it)."""
import json, os, re, sys, urllib.parse, urllib.request
from fontTools import subset
from fontTools.ttLib import TTFont

UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'}
FAMILY = 'Archivo:wdth,wght@62..125,100..900'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'app', 'fonts', 'archivo-latin.woff2')

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()

# what Google serves in Archivo (latin, latin-ext, vietnamese files)
css = get(f'https://fonts.googleapis.com/css2?family={FAMILY}&display=swap').decode()
allowed = set()
for name, body in re.findall(r'/\* ([a-z-]+) \*/\s*@font-face\s*{([^}]*)}', css):
    if name not in ('latin', 'latin-ext', 'vietnamese'):
        continue
    for part in re.search(r'unicode-range:\s*([^;]+);', body).group(1).split(','):
        part = part.strip()[2:]
        if '?' in part:
            lo, hi = int(part.replace('?', '0'), 16), int(part.replace('?', 'F'), 16)
        elif '-' in part:
            lo, hi = (int(x, 16) for x in part.split('-'))
        else:
            lo = hi = int(part, 16)
        allowed.update(range(lo, hi + 1))

want = set(range(0x20, 0x7F)) | set(range(0xA0, 0x100)) | {0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x2122, 0x20B9}
want |= {ord(c) for c in (sys.argv[1] if len(sys.argv) > 1 else '')}
want &= allowed

# one font file holding exactly those characters, both axes kept
text = ''.join(chr(c) for c in sorted(want) if c != 0x20)
src_css = get(f'https://fonts.googleapis.com/css2?family={FAMILY}&display=swap&text=' + urllib.parse.quote(text)).decode()
src = get(re.search(r'url\((https://[^)]+)\)', src_css).group(1))
tmp = OUT + '.src'
open(tmp, 'wb').write(src)

opts = subset.Options()
opts.layout_features = ['*']      # kerning, ligatures, tabular figures: rendering unchanged
opts.flavor = 'woff2'
opts.hinting = False
opts.notdef_outline = True
opts.name_IDs = ['*']
font = TTFont(tmp)
s = subset.Subsetter(opts)
s.populate(unicodes=want)
s.subset(font)
font.flavor = 'woff2'
font.save(OUT)
os.remove(tmp)
cmap = sorted(TTFont(OUT).getBestCmap().keys())
json.dump(cmap, open(OUT.replace('.woff2', '.codepoints.json'), 'w'))
print(f'{OUT}: {os.path.getsize(OUT)} bytes, {len(cmap)} code points')
