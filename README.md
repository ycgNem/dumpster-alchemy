# Dumpster Alchemy

A janky, gross, loud merge game. Run the night shift at a raccoon-run landfill, merge junk into
better junk, keep the stink down, and build the Trash King.

**Play it:** https://ycgnem.github.io/dumpster-alchemy/

Drag junk onto matching junk to merge it up the chain, drop *different* junk together to brew one
of 20 recipes, feed the raccoons' orders, and hit the night's quota before 6 AM. A run is ten
nights across the County Dump: pick your road on the map, draft rule-bending Contraband, beat
three bosses, and build the Trash King. Or try the Daily Dump.

What's new: [CHANGELOG.md](CHANGELOG.md).

```
npm install
npm run dev
```

- Design: [docs/DESIGN.md](docs/DESIGN.md), v2 plan and as-built notes: [docs/V2.md](docs/V2.md)
- Build plan: [docs/PLAN.md](docs/PLAN.md)
- Code shape: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Look: [STYLE.md](STYLE.md)
- Art budget: [docs/ART_PLAN.md](docs/ART_PLAN.md)

TypeScript + Vite + Canvas 2D, no engine. Pixel art drafted with PixelLab and finished by script
in `pixel-art/`. Every sound is synthesized with WebAudio.
