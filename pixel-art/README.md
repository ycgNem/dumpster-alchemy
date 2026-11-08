# pixel-art

Python/Pillow scripts that build every sprite the game loads (the pixel-art-studio skill).
One folder per family, each with a `build.py` run from inside it:

```
pixel-art/
  pal.py          the palette, read from src/data/palette.ts
  anchor/         the style anchor: shopping cart + Gary (M2, step 1)
  junk/           the 12-tier junk chain
  gulls/          the gull chain, the Golden Egg, Bin Juice
  cast/           raccoons, Inspector Possum (possum*.py: idle, dead, shutdown, walk), king_portrait (king.py)
  props/          the truck, the Dumpster, the Compactor
  board/          dirt cells, ruts, the drop highlight
  ui/             cardboard, tape, the Stink jar, icons, the marker font
  fx/             stink puffs, flies, sparks, the merge pop
  backdrop/       Lot 9 at night, plus the sky sprites moon and gull_fly (sky.py)
  check.py        checks the atlases against the art contract
  review_m7.py    the M7 review sheets (art-src/review/m7/)
```

Rules: read drafts from `art-src/dl/`, never edit them; write finished atlases to `public/art/`;
snap every pixel to `pal.py`; no semi-transparent pixels.
