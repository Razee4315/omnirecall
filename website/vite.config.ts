import { defineConfig } from 'vite'

export default defineConfig({
  // Relative URLs, so the same build works at a domain root and under a path (GitHub Pages serves /omnirecall/).
  base: './',
  server: { port: 5199, strictPort: true },
  preview: { port: 5199, strictPort: true },
  build: { target: 'es2022', assetsInlineLimit: 0 },
  // The site stands apart from the product's build: don't pick up the PostCSS / Tailwind config one folder up.
  css: { postcss: { plugins: [] } },
})
