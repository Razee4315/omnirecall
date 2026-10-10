import '@fontsource-variable/inter/opsz.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import './styles/base.css'
import './styles/window.css'

import { AppWindow, PROVIDERS, type Answer } from './app/window'
import { Demo, type DemoOptions } from './demo'
import { HeroCursor, heroParallax } from './hero'
import { asset } from './lib/asset'
import { play, Script } from './lib/script'

interface Exchange extends Answer {
  ask: string
}

// Small questions: the kind the app is for.
const SMALL: Exchange[] = [
  { ask: 'Debounce or throttle for a scroll handler?', text: 'Throttle. You want regular updates while the page scrolls, not a single one at the end.' },
  { ask: 'Past tense of “lead”?', text: '**Led.** “Lead” with an a is the metal.' },
  { ask: 'Regex for an ISO date?', text: '`^\\d{4}-\\d{2}-\\d{2}$` matches the date part, like 2026-03-04.' },
  { ask: 'How many seconds in a day?', text: '**86,400.** That is 24 × 60 × 60.' },
]

// What the visitor's own window answers. Every line is drawn from the file it cites.
const ABOUT: Exchange[] = [
  { ask: 'What is OmniRecall?', text: 'A desktop app that opens an AI chat **at your cursor**. Press the shortcut in any app, ask, then press `Esc` and carry on.', sources: ['README.md'] },
  { ask: 'Which models can I use?', text: 'Gemini, OpenAI, Claude and GLM with your own API key, or local models through **Ollama** with no key.', sources: ['README.md'] },
  { ask: 'Is it free?', text: '**Free for personal and educational use.** Commercial use needs permission from the author.', sources: ['LICENSE'] },
  { ask: 'Where are my API keys kept?', text: 'In your operating system’s **credential store**, not in a file.', sources: ['CHANGELOG.md'] },
]
const CANNOT: Answer = {
  text: 'This window is a scripted demo, so it can’t answer that. In the app, your question goes to the model you chose.',
}

const DOC_QUESTION: Exchange = {
  ask: 'What changed in the export format?',
  text: 'Three things changed in **v3**: timestamps are ISO 8601 strings, each record carries a `schema` field, and attachments moved into a separate `files` array.',
  sources: ['api-spec.md', 'migration-notes.pdf'],
}

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
const applyMotion = () => {
  Script.instant = reduced.matches
  document.documentElement.classList.toggle('reduced', reduced.matches)
}
reduced.addEventListener('change', applyMotion)
applyMotion()

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!
const $$ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)]

// --- words rise into place once, when their section arrives ------------------------------------

const reveal = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('is-in')
      reveal.unobserve(entry.target)
    }
  },
  { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
)
$$('[data-reveal]').forEach((el) => reveal.observe(el))

// --- keys ------------------------------------------------------------------------------------------

/** Press a key graphic: down, then back up. */
function tap(nodes: HTMLElement[], hold = 260) {
  nodes.forEach((node) => node.classList.add('is-down'))
  window.setTimeout(() => nodes.forEach((node) => node.classList.remove('is-down')), hold)
}
const heroKeys = $$('.hero .lede kbd')
const caps = (name: string) => $$(`[data-key="${name}"]`)

async function exchange(s: Script, win: AppWindow, q: Exchange) {
  await s.wait(420)
  await win.type(s, q.ask)
  win.send(q.ask)
  await win.answer(s, q)
}

// --- the scripted demos --------------------------------------------------------------------------

let small = 0
const demos: { demo: Demo; run: (s: Script, demo: Demo) => Promise<void>; script: Script | null; leave?: () => void }[] = []

function stage(name: string, opts: DemoOptions, run: (s: Script, demo: Demo) => Promise<void>, leave?: () => void) {
  const demo = new Demo($(`[data-demo="${name}"]`), opts)
  demos.push({ demo, run, script: null, leave })
  return demo
}

// 1. The hero. A large porcelain cursor starts where the headline ends, crosses to the stage,
//    presses, and the window opens where it landed. Two sheets of paper slide out from behind.
const hero = $('.hero')
const heroCursor = new HeroCursor(hero, $('.card--hero'))
const headlineEnd = $('.hero h1 .ln:last-child > span')
heroParallax(hero, () => reduced.matches)
let heroPlayed = false

const heroDemo = stage('hero', { height: 318, bare: true }, async (s, demo) => {
  const box = () => demo.box.getBoundingClientRect()
  /** The end of the sentence. */
  const atHeadline = () => {
    // Measured on the line, not the rising text inside it, which may still be on its way up.
    const line = headlineEnd.parentElement!.getBoundingClientRect()
    return { x: line.left + headlineEnd.offsetWidth + line.height * 0.1, y: line.top + line.height * 0.36 }
  }
  /** Top centre of the stage: where the shortcut is pressed. */
  const atPress = () => {
    const p = demo.spot(0.5, 12)
    return { x: box().left + p.x, y: box().top + p.y }
  }
  /** Resting on the window's lower right corner, clear of what is being read. */
  const atRest = () => {
    const card = $('.orw__card', demo.box).getBoundingClientRect()
    const narrow = window.innerWidth < 900
    return { x: card.right - (narrow ? 30 : 16) * demo.k, y: card.bottom - 12 * demo.k }
  }
  const restScale = () => 1
  const open = () => demo.open(0.5, 12, () => demo.win.setDocs(0))

  if (Script.instant) {
    open()
    heroCursor.moveTo(atRest(), restScale(), 0)
    heroCursor.show()
    const q = SMALL[small++ % SMALL.length]
    demo.win.send(q.ask)
    await demo.win.answer(s, q)
    return
  }

  heroCursor.measure()
  heroCursor.moveTo(atHeadline(), 0.8, 0)
  // First time, let the headline finish rising before its last piece appears.
  await s.wait(heroPlayed ? 250 : 1250)
  heroPlayed = true
  heroCursor.show()
  await s.wait(1150)
  heroCursor.moveTo(atPress(), 1, 1200)
  await s.wait(1260)
  for (;;) {
    heroCursor.press()
    tap(heroKeys.slice(0, 2))
    await s.wait(170)
    open()
    await s.wait(620)
    heroCursor.moveTo(atRest(), restScale(), 1000)
    await exchange(s, demo.win, SMALL[small++ % SMALL.length])
    await s.wait(5200)
    tap(heroKeys.slice(2))
    await s.wait(150)
    demo.hide()
    await s.wait(700)
    heroCursor.moveTo(atPress(), 1, 850)
    await s.wait(1000)
  }
}, () => heroCursor.hide())
// Two sheets of paper tucked behind the hero's window.
heroDemo.box.insertAdjacentHTML(
  'afterbegin',
  `<img class="hero-sheet hero-sheet--a" src="${asset('img/paper-sheet.webp')}" width="480" height="620" alt="" />` +
    `<img class="hero-sheet hero-sheet--b" src="${asset('img/paper-notebook.webp')}" width="422" height="620" alt="" />`,
)

// 3. Open, ask, Esc: three times, in three places.
stage('shortcut', { height: 296 }, async (s, demo) => {
  const spots: [number, number][] = [[0.36, 4], [0.64, 40], [0.5, 22]]
  demo.park(...spots[0])
  await s.wait(500)
  for (let i = 0; ; i++) {
    await demo.summon(s, ...spots[i % spots.length], () => tap([...caps('alt'), ...caps('space')]), () => demo.win.setDocs(0))
    await exchange(s, demo.win, SMALL[(small++ % (SMALL.length - 1)) + 1])
    if (Script.instant) return
    await s.wait(1900)
    tap(caps('esc'))
    await s.wait(150)
    demo.hide()
    await s.wait(900)
  }
})

// 4. The answer names its sources, and those files light up.
const files = $$('.file')
const fileList = $('.files')
stage(
  'documents',
  { height: 318, width: 460 },
  async (s, demo) => {
    demo.park(0.5, 12)
    await s.wait(400)
    await demo.summon(s, 0.5, 12, () => {}, () => demo.win.setDocs(4))
    await exchange(s, demo.win, DOC_QUESTION)
    await s.wait(150)
    files.forEach((file) => file.classList.toggle('is-cited', DOC_QUESTION.sources!.includes(file.dataset.file!)))
    fileList.classList.add('has-cited')
  },
  () => {
    files.forEach((file) => file.classList.remove('is-cited'))
    fileList.classList.remove('has-cited')
  },
)

// 5. The model list, open; one provider after another.
const modelButtons = $$<HTMLButtonElement>('[data-models] button')
let modelIndex = 0
let modelHold = 0
let modelDemo: Demo | null = null
const modelCard = $('[data-card="models"]')
function setModel(index: number) {
  modelIndex = index
  modelCard.dataset.model = String(index)
  modelButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)))
  modelDemo?.win.setModel(PROVIDERS[index].pick)
}
modelButtons.forEach((button, i) =>
  button.addEventListener('click', () => {
    modelHold = performance.now() + 9000
    setModel(i)
  }),
)
stage('models', { height: 392 }, async (s, demo) => {
  modelDemo = demo
  demo.park(0.5, 12)
  await s.wait(400)
  await demo.summon(s, 0.5, 12, () => {}, () => demo.win.setDocs(0))
  await s.wait(500)
  demo.win.setMenu(true)
  setModel(modelIndex)
  if (Script.instant) return
  for (;;) {
    await s.wait(2600)
    if (performance.now() > modelHold) setModel((modelIndex + 1) % PROVIDERS.length)
  }
})

// A demo plays while it is on screen and resets when it leaves.
const watcher = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const item = demos.find((d) => d.demo.box === entry.target)
      if (!item) continue
      if (entry.isIntersecting && !item.script) {
        item.script = play((s) => item.run(s, item.demo))
      } else if (!entry.isIntersecting && item.script) {
        item.script.cancel()
        item.script = null
        item.demo.clear()
        item.leave?.()
      }
    }
  },
  { threshold: 0.35 },
)
demos.forEach((item) => watcher.observe(item.demo.box))

let resizeTimer = 0
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    demos.forEach((item) => {
      item.demo.layout()
      // Positions were measured for the old size: play the stage again from the top.
      if (item.script) {
        item.script.cancel()
        item.demo.clear()
        item.leave?.()
        item.script = play((s) => item.run(s, item.demo))
      }
    })
  }, 200)
})

// --- the visitor's own Alt + Space -----------------------------------------------------------------
// It works anywhere on the page, as the real shortcut works in any app, and the window lands
// by the app's own rule: centred under the cursor, kept on screen, above if there is no room below.

const layer = document.createElement('div')
layer.id = 'summon'
document.body.appendChild(layer)
const own = new AppWindow(layer)
own.setInteractive(false)
own.setWidth(460)

const pointer = { x: 0, y: 0, seen: false }
window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return
  pointer.x = e.clientX
  pointer.y = e.clientY
  pointer.seen = true
}, { passive: true })

let summoned = false
let ownScript: Script | null = null
let about = 0
let returnFocus: HTMLElement | null = null

function summon(at?: { x: number; y: number }) {
  if (summoned) return dismiss()
  summoned = true
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const narrow = window.innerWidth < 720
  const k = narrow ? 1 : 1.1
  layer.style.setProperty('--k', String(k))
  own.reset()
  own.setDocs(3)
  own.setModel(PROVIDERS[0].pick)
  own.setHeight(Math.round((narrow ? 320 : 350) * k))
  const spot = at ?? (pointer.seen ? pointer : { x: window.innerWidth / 2, y: window.innerHeight * 0.24 })
  const pos = AppWindow.placeNearCursor(spot, { w: Math.min(460 * k, window.innerWidth - 24), h: (narrow ? 320 : 350) * k + 40 }, { w: window.innerWidth, h: window.innerHeight })
  own.moveTo(pos.x, pos.y + 8 * k)
  own.setCaption('Scripted demo. Press Esc to close.')
  layer.classList.add('is-on')
  document.documentElement.classList.add('is-summoned')
  own.show()
  own.setInteractive(true)
  ownScript = play((s) => exchange(s, own, ABOUT[about++ % ABOUT.length]))
}

function dismiss() {
  if (!summoned) return
  summoned = false
  ownScript?.cancel()
  ownScript = null
  own.setInteractive(false)
  own.hide()
  layer.classList.remove('is-on')
  document.documentElement.classList.remove('is-summoned')
  returnFocus?.focus({ preventScroll: true })
  returnFocus = null
}

own.onClose = dismiss
own.onSubmit = (text) => {
  ownScript?.cancel()
  own.send(text)
  ownScript = play((s) => own.answer(s, CANNOT))
}

let comboUsed = false
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.altKey && !e.repeat) {
    e.preventDefault()
    comboUsed = true
    summon()
  } else if (e.key === 'Escape' && summoned) {
    e.preventDefault()
    dismiss()
  }
})
window.addEventListener('keyup', (e) => {
  // Keep the browser from opening its own menu when Alt comes back up.
  if (e.key === 'Alt' && comboUsed) {
    e.preventDefault()
    comboUsed = false
  }
})
window.addEventListener('pointerdown', (e) => {
  const target = e.target as HTMLElement
  if (summoned && !own.root.contains(target) && !target.closest('[data-summon]')) dismiss()
})
window.addEventListener('scroll', () => summoned && dismiss(), { passive: true })
$$('[data-summon]').forEach((button) =>
  button.addEventListener('click', (e) => {
    const rect = button.getBoundingClientRect()
    const fine = pointer.seen && (e as MouseEvent).detail > 0
    summon(fine ? { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY + 16 } : { x: rect.left + rect.width / 2, y: rect.bottom + 4 })
  }),
)

// --- the Dashboard in the app's six themes ---------------------------------------------------------

const themeSection = $('#dashboard')
const shots = $('[data-shots]')
const themeButtons = $$<HTMLButtonElement>('[data-set-theme]')

function setTheme(theme: string) {
  themeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.setTheme === theme)))
  themeSection.dataset.theme = theme
  let img = $<HTMLImageElement>(`[data-shot="${theme}"]`, shots)
  if (!img) {
    img = document.createElement('img')
    img.dataset.shot = theme
    img.alt = ''
    img.width = 1000
    img.height = 640
    img.decoding = 'async'
    img.sizes = '(max-width: 760px) 760px, min(1000px, 88vw)'
    img.srcset = `${asset(`img/dashboard-${theme}.1x.webp`)} 1000w, ${asset(`img/dashboard-${theme}.webp`)} 2000w`
    img.src = asset(`img/dashboard-${theme}.1x.webp`)
    shots.appendChild(img)
  }
  const show = () => $$('img', shots).forEach((node) => node.classList.toggle('is-on', node === img))
  if (img.complete && img.naturalWidth) show()
  else img.addEventListener('load', show, { once: true })
}
themeButtons.forEach((button) => button.addEventListener('click', () => setTheme(button.dataset.setTheme!)))
