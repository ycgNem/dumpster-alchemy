# Dumpster Alchemy

A janky, gross, loud merge game: run the night shift at a raccoon-run landfill. The design is in
`docs/DESIGN.md`, the build order in `docs/PLAN.md`, the look in `STYLE.md`, the art budget in
`docs/ART_PLAN.md`, the code shape and the contracts between agents (events, atlases, who owns
which folder) in `docs/ARCHITECTURE.md`.

## Stack

- TypeScript with `"strict": true`, built with Vite, drawn on a plain Canvas 2D. No game engine.
- `npm run dev` to play, `npm run typecheck`, `npm run build`, `npm run sim [nights]
  [secondsPerAction]` (a bot plays nights headless and prints the balance numbers).
- Dev builds have `window.dev` (`src/dev/devtools.ts`): give, fill, stink, skip, win, lose, auto,
  step, reloadArt.
- Python art scripts: use `python3` (plain `python` has no Pillow on this machine).
- 640 × 360 logical screen, whole-number scaling (`src/engine/screen.ts`).
- Game numbers and content are data: `src/data/items.ts`, `raccoons.ts`, `tuning.ts`,
  `palette.ts`. Tune there, not in the systems.

## Layout

```
src/engine/   screen scaling, the fixed-step loop, pointer input, seeded RNG
src/data/     palette, items (both chains), raccoons, tuning
src/game/     board model and the game systems (truck, dumpster, orders, stink, gulls, shift)
src/render/   layout rects, drawing, effects, UI
pixel-art/    Python/Pillow scripts that build every sprite (pal.py reads palette.ts)
art-src/      raw PixelLab downloads (dl/) and the job log (prompts.md)
public/art/   built atlases the game loads
```

## Art rules

- **PixelLab only within the cap**: 50 generations for this build, floor **845.9 remaining**
  (set 2026-11-07). Check `get_balance` before and after, log each job in `art-src/prompts.md`.
  Never spend the USD credits.
- Never SpriteCook.
- Every sprite is built by a script in `pixel-art/` (the pixel-art-studio skill), never a
  hand-edited PNG. PixelLab drafts are finished there.
- Every pixel snaps to the palette; `imageSmoothingEnabled = false` everywhere.

## Tone

It's meant to be shitty in a lovable way: crude, wobbly, wet, over the top. Juice before
polish. Gross, not grim.
