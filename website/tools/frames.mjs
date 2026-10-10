// Photographs the first seconds after load, frame by frame: node tools/frames.mjs <width>x<height> <ms> <ms> ...
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots')
mkdirSync(OUT, { recursive: true })
const [size, ...times] = process.argv.slice(2)
const [width, height] = size.split('x').map(Number)
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars'] })
const page = await browser.newPage()
const mobile = width < 600
await page.setViewport({ width, height, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })
await page.goto(process.env.SITE_URL || 'http://localhost:5199/', { waitUntil: 'load' })
const start = Date.now()
for (const t of times.map(Number)) {
  await new Promise((r) => setTimeout(r, Math.max(0, t - (Date.now() - start))))
  await page.screenshot({ path: join(OUT, `f${mobile ? 'm' : ''}-${String(t).padStart(5, '0')}.png`) })
}
console.log('frames:', times.join(' '))
await browser.close()
