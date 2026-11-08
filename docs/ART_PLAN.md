# Dumpster Alchemy — Art plan

## The PixelLab cap

- **50 generations** for this build, set by the user on 2026-11-07.
- Balance at the start: **895.9** generations remaining, so the **floor was 845.9**.
- **v2 (2026-11-07): +100 generations** for the map scene and the v2 content. Balance 855.9 when
  it was granted, so the **floor is now 745.9**. Stop there.
- Generations only; the USD credit balance ($2.00) is never spent.
- Check `get_balance` before and after each batch. Log every job in `art-src/prompts.md`
  (prompt, tool, size, cost, kept or not).
- **Split**: the key-art agent may spend up to **44** (so it stops at 851.9 remaining). The last
  6 are kept for redos the director asks for after the playtest. Count spend from each job's
  own cost, not only the balance: other sessions on the account may spend too.
- Atlas names and sizes the game expects: `docs/ARCHITECTURE.md`, "Art contract".

## Order of work

1. **Style anchor** (about 3 generations): the Shopping Cart (tier 8) and Gary the raccoon.
   Finish both by hand and report back; the director (main session) reviews the look. The user
   handed over approval on 2026-11-07 ("go until completion of the game").
2. Use the approved anchor as the style reference for everything after it.
3. Items in batches by chain, then characters, then props, then the backdrop.

## Budget

| Asset | Count | Size | Tool (planned) | Gens |
|---|---|---|---|---|
| Style anchor (cart + Gary) | 2 | 32, 48 | pixen | 3 |
| Junk chain, tiers 1-7, 9-12 | 11 | 32 × 32 | pixen | 11 |
| Gull chain G1-G5, Golden Egg, Bin Juice | 7 | 32 × 32 | pixen | 7 |
| Raccoons: Linda, Lil' Pete, Grandma Mange | 3 | 48 × 48 | pixen | 3 |
| Inspector Possum | 1 | 48 × 48 | pixen | 1 |
| The Truck | 1 | 112 × 64 | pixen | 1 |
| The Dumpster | 1 | 48 × 48 | pixen | 1 |
| Backdrop (sky + fence + heaps + streetlight) | 1 | 640 × 360 | pixen / pro | 2 |
| Logo on a cardboard sign | 1 | ~200 × 80 | pixen | 1 |
| **Planned** | | | | **30** |
| Redos and variants (reserve) | | | | 20 |
| **Cap** | | | | **50** |

If a batch comes in cheap (several items in one sheet, cut apart by script), the savings go to
redos, not to new asset types.

## Drawn by hand (free, pixel-art-studio)

- The board: dirt cells, ruts, the drop highlight.
- Every animation frame: raccoon blink, happy, angry; the truck's wheels and reverse light; the
  Dumpster lid; the gulls' hop and flap; the possum playing dead.
- Cardboard UI kit, duct tape, the Stink jar, lid pips, icons, the marker font.
- Effects: stink puffs, flies, sparks, the merge pop, the Golden Egg's glow.
- Silhouettes for the Trash Almanac (from the finished items).

## Pipeline

```
PixelLab draft → art-src/dl/<name>.png (raw, never edited)
              → pixel-art/<slug>/build.py (fit, palette snap, outline, shadow, frames)
              → public/art/<atlas>.png + .json (what the game loads)
```

`pixel-art/pal.py` reads the palette straight from `src/data/palette.ts`, so the scripts and
the game never drift apart.
