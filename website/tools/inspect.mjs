// Drives the installed Chrome headlessly and photographs the running site.
//   node tools/inspect.mjs <name> <width>x<height> <#section[+offset][@waitMs]> ...
// Each stop scrolls a section to the top of the viewport (plus an optional pixel offset),
// waits, and saves tools/shots/<name>-<section>.png. `full` saves the whole page instead.
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, 'shots')
mkdirSync(OUT, { recursive: true })
const [name, size, ...stops] = process.argv.slice(2)
const [width, height] = size.split('x').map(Number)
const url = process.env.SITE_URL || 'http://localhost:5199/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--force-color-profile=srgb', '--hide-scrollbars'],
})
const page = await browser.newPage()
const mobile = width < 600
await page.setViewport({ width, height, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })
if (process.env.REDUCED) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
const problems = []
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('requestfailed', (r) => problems.push(`failed: ${r.url()}`))
await page.goto(url, { waitUntil: 'networkidle0' })
await page.evaluate(() => document.fonts.ready)
if (!mobile) await page.mouse.move(width * 0.5, height * 0.6)

for (const stop of stops) {
  const [target, wait = '2200'] = stop.split('@')
  const [sel, offset = '0'] = target.split('+')
  if (sel === 'full') {
    // Walk the page first so every section has revealed itself.
    const total = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y < total; y += height * 0.7) {
      await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y)
      await sleep(350)
    }
    await sleep(Number(wait))
    const file = join(OUT, `${name}-full.png`)
    await page.screenshot({ path: file, fullPage: true })
    console.log(file)
    continue
  }
  await page.evaluate(
    (s, o) => {
      const el = document.querySelector(s)
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + Number(o), behavior: 'instant' })
    },
    sel,
    offset,
  )
  await sleep(Number(wait))
  const file = join(OUT, `${name}-${sel.replace('#', '')}${offset !== '0' ? `_${offset}` : ''}${stop.includes('@') ? `-${wait}` : ''}.png`)
  await page.screenshot({ path: file })
  console.log(file)
}
console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'console clean')
await browser.close()
