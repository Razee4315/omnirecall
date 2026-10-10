// Photographs the real OmniRecall interface (served by vite.capture.config.mjs with demo data).
//   node tools/capture/capture.mjs
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "../../assets-raw/app");
mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:14380/";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const THEMES = ["dark", "light", "transparent", "paper", "rose", "ocean"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--force-color-profile=srgb"] });

async function open(width, height, query = "") {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  await page.goto(URL + query, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await sleep(500);
  return page;
}
const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`), omitBackground: true });
const click = (page, label) => page.click(`[aria-label="${label}"]`);

// Spotlight: the compact window, 420 x 500 as the app opens it.
{
  const page = await open(420, 500, "?docs=0");
  await shot(page, "spotlight-empty");
  await page.evaluate(() => { window.__DEMO__.stream = { chunks: ["Throttle. ", "You want regular updates ", "while the page scrolls, ", "not a single one at the end."], delay: 30 }; });
  await page.type("textarea", "Debounce or throttle for a scroll handler?");
  await page.keyboard.press("Enter");
  await sleep(1200);
  await shot(page, "spotlight-chat");
  await page.close();
}
{
  const page = await open(420, 500);
  await shot(page, "spotlight-docs-empty");
  await page.evaluate(() => {
    window.__DEMO__.stream = {
      chunks: ["Three things changed in **v3**: ", "timestamps are ISO 8601 strings, ", "each record carries a `schema` field, ", "and attachments moved into a separate `files` array."],
      delay: 30,
      sources: ["api-spec.md", "migration-notes.pdf"],
    };
  });
  await page.type("textarea", "What changed in the export format?");
  await page.keyboard.press("Enter");
  await sleep(1200);
  await shot(page, "spotlight-docs-chat");
  await click(page, "Active model: Google Gemini gemini-2.5-flash. Click to change.").catch(() => {});
  await sleep(300);
  await shot(page, "spotlight-models");
  await page.close();
}

// Dashboard: a 1000 x 640 window (the app opens it at 1000 x 700 and lets you resize it), once per theme.
for (const theme of THEMES) {
  const page = await open(1000, 640, `?theme=${theme}`);
  await click(page, "Expand to Dashboard");
  await sleep(400);
  const opened = await page.evaluate(() => {
    const row = [...document.querySelectorAll("aside *")].find((el) => el.childElementCount === 0 && el.textContent.trim() === "What changed in the export format?");
    if (!row) return false;
    row.click();
    return true;
  });
  if (!opened) console.log("could not open the demo chat in", theme);
  await sleep(700);
  await page.mouse.move(990, 630);
  await page.evaluate(() => document.activeElement?.blur());
  await sleep(150);
  await shot(page, `dashboard-${theme}`);
  if (theme === "dark") {
    await page.keyboard.down("Control");
    await page.keyboard.press("k");
    await page.keyboard.up("Control");
    await sleep(500);
    await shot(page, "dashboard-palette");
    await page.keyboard.press("Escape");
    await sleep(200);
    await page.keyboard.down("Control");
    await page.keyboard.press("/");
    await page.keyboard.up("Control");
    await sleep(500);
    await shot(page, "dashboard-shortcuts");
  }
  await page.close();
}

await browser.close();
console.log("captured to", OUT);
