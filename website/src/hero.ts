// The hero's cursor: a photographed porcelain pointer, far larger than life.
// It begins at the end of the headline, where the sentence leaves it ("...at your cursor."),
// crosses to the black card on a shallow arc, presses, and the window opens where it landed.
//
// There are two copies, a black one and a white one, generated as a matched pair so they line
// up exactly. The black copy sits on the white page under the card; the white copy sits inside
// the card and is clipped to it. Moved together, the pointer changes from black to white at the
// card's edge, part by part, as it crosses.

import { asset } from './lib/asset'

/** Where the arrow's tip sits inside the image, as a fraction of its width and height. */
const TIP = { x: 0.03, y: 0.015 }

interface Copy {
  root: HTMLElement
  rise: HTMLElement
  /** The box its coordinates are measured from. */
  frame: HTMLElement
}

function makeCopy(parent: HTMLElement, tone: 'dark' | 'light', src: string): Copy {
  const root = document.createElement('div')
  root.className = `hero__cursor hero__cursor--${tone}`
  root.setAttribute('aria-hidden', 'true')
  // Three nested boxes: one travels sideways, one travels up and down and scales (on a different
  // curve, which is what bends the path), one leans towards the visitor's pointer.
  root.innerHTML = `<div class="hero__cursor-rise"><div class="hero__cursor-lean"><img src="${src}" width="531" height="760" alt="" /></div></div>`
  parent.appendChild(root)
  return { root, rise: root.firstElementChild as HTMLElement, frame: parent }
}

export class HeroCursor {
  private copies: Copy[]
  private width = 0

  constructor(hero: HTMLElement, card: HTMLElement) {
    const over = document.createElement('div')
    over.className = 'card__over'
    card.appendChild(over)
    this.copies = [makeCopy(hero, 'dark', asset('img/pointer-black.webp')), makeCopy(over, 'light', asset('img/pointer-white.webp'))]
    this.measure()
  }

  measure() {
    this.width = this.copies[0].root.getBoundingClientRect().width || 120
  }

  /** Move the tip to a viewport point over `ms` milliseconds, at a given scale. */
  moveTo(point: { x: number; y: number }, scale: number, ms: number) {
    const height = this.width * (760 / 531)
    for (const copy of this.copies) {
      const frame = copy.frame.getBoundingClientRect()
      const x = point.x - frame.left - this.width * TIP.x
      const y = point.y - frame.top - height * TIP.y
      copy.root.style.setProperty('--t', `${ms}ms`)
      copy.root.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`
      copy.rise.style.transform = `translate3d(0,${y.toFixed(1)}px,0) scale(${scale})`
    }
  }

  show() {
    this.copies.forEach((copy) => copy.root.classList.add('is-on'))
  }

  hide() {
    this.copies.forEach((copy) => copy.root.classList.remove('is-on'))
  }

  /** A click: the pointer dips and comes back. */
  press() {
    this.copies.forEach((copy) => copy.root.classList.add('is-down'))
    window.setTimeout(() => this.copies.forEach((copy) => copy.root.classList.remove('is-down')), 150)
  }
}

/** Layers in the hero shift a little with the pointer, the near ones most. */
export function heroParallax(hero: HTMLElement, reduced: () => boolean) {
  let tx = 0
  let ty = 0
  let x = 0
  let y = 0
  let running = false
  const step = () => {
    x += (tx - x) * 0.07
    y += (ty - y) * 0.07
    hero.style.setProperty('--mx', x.toFixed(4))
    hero.style.setProperty('--my', y.toFixed(4))
    if (Math.abs(tx - x) + Math.abs(ty - y) > 0.002) requestAnimationFrame(step)
    else running = false
  }
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || reduced()) return
    if (hero.getBoundingClientRect().bottom < 0) return
    tx = (e.clientX / window.innerWidth) * 2 - 1
    ty = (e.clientY / window.innerHeight) * 2 - 1
    if (!running) {
      running = true
      requestAnimationFrame(step)
    }
  }, { passive: true })
}
