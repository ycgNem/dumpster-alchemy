import { defineConfig } from 'vite';

// Relative asset paths, so the build runs from any folder (GitHub Pages, itch.io, a zip).
export default defineConfig({
  base: './',
});
