// A small stage for the app window: a cursor arrives, the shortcut is pressed, and the window
// opens under it, the way it does on a desktop.

import { AppWindow } from './app/window'
import { asset } from './lib/asset'
import { clamp } from './lib/math'
import type { Script } from './lib/script'

export interface DemoOptions {
  /** Height of the window's card at scale 1 (the app allows 200 to 700). */
  height: number
  /** Width at scale 1 (the app allows 380 to 500). */
  width?: number
  /** No small cursor of its own: the hero brings a large one. */
  bare?: boolean
}

export class Demo {
  win: AppWindow
  k = 1
  private cursor: HTMLElement | null = null
  private tip = { x: 0, y: 0 }

  constructor(public box: HTMLElement, private opts: DemoOptions) {
    this.win = new AppWindow(box)
    this.win.setInteractive(false)
    if (!opts.bare) {
      this.cursor = document.createElement('span')
      this.cursor.className = 'demo__cursor'
      this.cursor.innerHTML = `<img src="${asset('img/pointer-white.webp')}" width="531" height="760" alt="" />`
      box.appendChild(this.cursor)
    }
    this.layout()
  }

  /** Scale the window to the space it has, and give the stage room for it. */
  layout() {
    const width = this.opts.width ?? 420
    const room = this.box.clientWidth
    this.k = clamp((room - 8) / (width + 56), 0.86, 1.24)
    this.box.style.setProperty('--k', this.k.toFixed(3))
    this.box.style.height = `${Math.round((this.opts.height + 74) * this.k)}px`
    this.win.setWidth(width)
    this.win.setHeight(Math.round(this.opts.height * this.k))
    if (this.win.isOpen) this.place()
  }

  /** A point on the stage: `fx` across its width, a little below its top edge. */
  spot(fx: number, drop: number) {
    return { x: this.box.clientWidth * fx, y: (18 + drop) * this.k }
  }

  private moveCursor(x: number, y: number, ms: number) {
    if (!this.cursor) return
    this.cursor.style.transitionDuration = `${ms}ms, 400ms`
    this.cursor.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`
  }

  private place() {
    const size = this.win.size
    // In the app the window has an 8px transparent margin, so the card starts 18px under the cursor.
    const x = clamp(this.tip.x - size.w / 2, 0, Math.max(0, this.box.clientWidth - size.w))
    this.win.moveTo(x, this.tip.y + 18 * this.k)
  }

  /** Put the cursor somewhere without showing the trip. */
  park(fx: number, drop: number) {
    const p = this.spot(fx, drop)
    this.moveCursor(p.x + 90 * this.k, p.y + 150 * this.k, 0)
  }

  /** Open a fresh window under a spot. */
  open(fx: number, drop: number, prepare: () => void) {
    this.tip = this.spot(fx, drop)
    this.win.reset()
    prepare()
    this.place()
    this.win.show()
    this.box.classList.add('is-open')
  }

  /** Glide to a spot, press the shortcut, and open the window there. */
  async summon(s: Script, fx: number, drop: number, onPress: () => void, prepare: () => void) {
    const p = this.spot(fx, drop)
    this.cursor?.classList.add('is-on')
    this.moveCursor(p.x, p.y, 950)
    await s.wait(1040)
    onPress()
    await s.wait(170)
    this.open(fx, drop, prepare)
    // The hand leaves the mouse for the keyboard; the cursor idles just clear of the window.
    await s.wait(480)
    const size = this.win.size
    this.moveCursor(Math.min(p.x + size.w * 0.34, this.box.clientWidth - 14 * this.k), p.y - 6 * this.k, 800)
  }

  hide() {
    this.win.hide()
  }

  /** Leave the stage: window gone, cursor gone. */
  clear() {
    this.win.hide()
    this.win.setMenu(false)
    this.cursor?.classList.remove('is-on')
  }
}
