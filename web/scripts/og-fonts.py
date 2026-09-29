"""Rebuild the share-image fonts in assets/og/: Anybody as two static TTFs (next/og can't read
variable fonts or woff2), cut from the site's own variable subset (app/fonts/anybody-latin.woff2)
at the width the headlines use (112 %) and the two weights lib/og.tsx draws with (800, 600).
Same characters as the site's font; no download.

  python3 -m venv /tmp/fe && /tmp/fe/bin/pip install fonttools brotli
  /tmp/fe/bin/python scripts/og-fonts.py

Run it after scripts/subset-font.py when copy gains a new character."""
import os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'app', 'fonts', 'anybody-latin.woff2')
OG = os.path.join(HERE, '..', 'assets', 'og')

for weight, name in ((800, 'ExtraBold'), (600, 'SemiBold')):
    font = instancer.instantiateVariableFont(TTFont(SRC), {'wght': weight, 'wdth': 112})
    font.flavor = None                       # plain TrueType
    font['OS/2'].usWeightClass = weight
    out = os.path.join(OG, f'Anybody-Wide-{name}.ttf')
    font.save(out)
    print(f'{out}: {os.path.getsize(out)} bytes, {len(font.getBestCmap())} code points')
