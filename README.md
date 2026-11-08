# Dumpster Alchemy

A janky, gross, loud merge game. Run the night shift at a raccoon-run landfill, merge junk into
better junk, keep the stink down, and build the Trash King.

**Play it:** https://ycgnem.github.io/dumpster-alchemy/

Drag junk onto matching junk to merge it up the chain, feed the raccoons' orders, and hit the
night's quota before 6 AM. Ten nights, each with its own rule, then Endless.

```
npm install
npm run dev
```

- Design: [docs/DESIGN.md](docs/DESIGN.md)
- Build plan: [docs/PLAN.md](docs/PLAN.md)
- Code shape: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Look: [STYLE.md](STYLE.md)
- Art budget: [docs/ART_PLAN.md](docs/ART_PLAN.md)

TypeScript + Vite + Canvas 2D, no engine. Pixel art drafted with PixelLab and finished by script
in `pixel-art/`. Every sound is synthesized with WebAudio.
