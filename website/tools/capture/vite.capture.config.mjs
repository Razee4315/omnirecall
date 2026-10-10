// Serves the real OmniRecall frontend (read-only, from the product folder) with demo IPC,
// so its interface can be photographed. Cache and output stay inside website/.
import preact from "@preact/preset-vite";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export default {
  root: resolve(here, "../../.."),
  cacheDir: resolve(here, "../../.vite-capture"),
  plugins: [
    preact(),
    {
      name: "tauri-demo",
      transformIndexHtml(html) {
        const mock = readFileSync(resolve(here, "tauri-demo.js"), "utf8");
        return html.replace("<head>", () => `<head><script>${mock}</script>`);
      },
    },
  ],
  server: { port: 14380, strictPort: true },
};
