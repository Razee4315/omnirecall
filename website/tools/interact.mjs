// Exercises the interactive parts in headless Chrome and photographs each state:
// the visitor's Alt + Space window, typing into it, Esc, the theme switch, the model picker.
//   node tools/interact.mjs [width]x[height]
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, 'shots')
mkdirSync(OUT, { recursive: true })
const [width, height] = (process.argv[2] || '1440x900').split('x').map(Number)
const url = process.env.SITE_URL || 'http://localhost:5199/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = (page, name) => page.screenshot({ path: join(OUT, `i-${name}.png`) }).then(() => console.log(`i-${name}.png`))

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--force-color-profile=srgb', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width, height })
const problems = []
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
await page.goto(url, { waitUntil: 'networkidle0' })
await page.evaluate(() => document.fonts.ready)
const scrollTo = (sel) => page.evaluate((s) => window.scrollTo({ top: document.querySelector(s).getBoundingClientRect().top + window.scrollY, behavior: 'instant' }), sel)
const open = () => page.evaluate(() => document.querySelector('#summon').classList.contains('is-on'))

// Alt + Space in the middle of the hero.
await page.mouse.move(width * 0.36, height * 0.62)
await page.keyboard.down('Alt')
await page.keyboard.press('Space')
await page.keyboard.up('Alt')
await sleep(4200)
console.log('summoned:', await open(), '| focus in window:', await page.evaluate(() => document.activeElement?.tagName))
await shot(page, 'summon')

// Type a question of our own.
await page.keyboard.type('Will this answer me?')
await page.keyboard.press('Enter')
await sleep(3800)
await shot(page, 'summon-typed')

// Esc closes it.
await page.keyboard.press('Escape')
await sleep(500)
console.log('after Esc:', await open())

// Near the bottom edge it has to open above the cursor; near the right edge it has to stay on screen.
await page.mouse.move(width - 40, height - 60)
await page.keyboard.down('Alt')
await page.keyboard.press('Space')
await page.keyboard.up('Alt')
await sleep(1200)
const rect = await page.evaluate(() => {
  const r = document.querySelector('#summon .orw__card').getBoundingClientRect()
  return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) }
})
console.log('corner placement:', JSON.stringify(rect), rect.right <= width && rect.bottom <= height && rect.left >= 0 && rect.top >= 0 ? 'on screen' : 'OFF SCREEN')
await shot(page, 'summon-corner')
// Clicking away hides it, like the app losing focus.
await page.mouse.click(60, 300)
await sleep(500)
console.log('after click away:', await open())

// The button does the same thing.
await page.click('[data-summon]')
await sleep(900)
console.log('button:', await open())
await page.keyboard.press('Escape')
await sleep(400)

// Themes.
await scrollTo('#dashboard')
await sleep(1200)
for (const theme of ['light', 'transparent', 'paper', 'rose', 'ocean']) {
  await page.click(`[data-set-theme="${theme}"]`)
  await sleep(1500)
  await shot(page, `theme-${theme}`)
}

// Model picker.
await scrollTo('#models')
await sleep(4200)
await page.click('[data-models] li:nth-child(4) button')
await sleep(1600)
await shot(page, 'model-glm')

// Keyboard: tab order reaches every control.
await scrollTo('#top')
const order = []
for (let i = 0; i < 24; i++) {
  await page.keyboard.press('Tab')
  order.push(await page.evaluate(() => (document.activeElement?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)))
}
console.log('tab order:', order.join(' > '))
console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'console clean')
await browser.close()
