# OmniRecall website

The marketing site for OmniRecall. It is separate from the app: its own dependencies, its own build, and it only reads from the product folder (the app icon, and the real interface when capturing screenshots).

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:5199. `npm run build` type-checks and writes the static site to `dist/`; `npm run preview` serves that build.

## Deploy

```bash
npm run deploy
```

Builds the site and pushes `dist/` to the `gh-pages` branch, which GitHub Pages serves at https://razee4315.github.io/omnirecall/. It does not touch `main`, so it does not start the app's CI or release workflows.

## What is in it

- `index.html`, `src/` — the page. Hand-written TypeScript and CSS, no framework.
- `src/app/window.ts`, `src/styles/window.css` — OmniRecall's Spotlight window rebuilt from the product's own component, icons and colours. The demos are scripted; nothing is sent anywhere.
- `src/hero.ts` — the hero's pointer: a matched black and white pair that swaps at the edge of the black card.
- `public/img/dashboard-*.webp` — real captures of the app's Dashboard in its six themes, with demo data.
- `public/img/pointer-*.webp`, `paper-*.webp`, `key-steel.webp` — the only generated images: a porcelain pointer (white, and the same object in black), four pieces of paper and a key. `tools/generate.mjs` makes them with Codex from `tools/manifest.mjs` into `assets-raw/`; `npm run images` trims them and makes them black-and-white.
- `tools/capture/` — serves the real app frontend with a demo IPC layer and photographs it (`npm run capture`, with the capture server running), then `npm run images` converts the captures.
- `tools/inspect.mjs`, `tools/interact.mjs` — headless Chrome screenshots and interaction checks of the running site.
- `assets-raw/` and `archive/` are not in the repository: the raw PNGs behind the images above, and an earlier photographic direction that is not used. The finished images in `public/img` are what the site needs.
