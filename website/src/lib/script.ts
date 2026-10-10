/** Thrown inside a script when it is cancelled; `play` swallows it. */
class Cancelled extends Error {}

/** A cancellable sequence of timed steps: `await s.wait(400)`. */
export class Script {
  cancelled = false
  private timers = new Set<number>()
  private rejects = new Set<(e: Error) => void>()

  wait(ms: number): Promise<void> {
    if (this.cancelled) return Promise.reject(new Cancelled())
    if (Script.instant) ms = Math.min(ms, 30)
    return new Promise((resolve, reject) => {
      const id = window.setTimeout(() => {
        this.timers.delete(id)
        this.rejects.delete(reject)
        resolve()
      }, ms)
      this.timers.add(id)
      this.rejects.add(reject)
    })
  }

  cancel() {
    if (this.cancelled) return
    this.cancelled = true
    this.timers.forEach((id) => clearTimeout(id))
    this.rejects.forEach((reject) => reject(new Cancelled()))
    this.timers.clear()
    this.rejects.clear()
  }

  /** Reduced motion: scripts jump to their end states instead of playing out. */
  static instant = false
}

export function play(fn: (s: Script) => Promise<void>): Script {
  const s = new Script()
  fn(s).catch((e) => {
    if (!(e instanceof Cancelled)) console.error(e)
  })
  return s
}
