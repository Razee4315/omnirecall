// OmniRecall's Spotlight window, rebuilt in HTML from the product's own component
// (src/components/spotlight/Spotlight.tsx and the chat components it uses): same structure,
// same icons, same colours, spacing and copy. It is scripted here; nothing is sent anywhere.

import { Script } from '../lib/script'

const icon = (body: string, viewBox = '0 0 20 20') =>
  `<svg viewBox="${viewBox}" fill="none" aria-hidden="true" focusable="false">${body}</svg>`
const stroke = (d: string, w = 1.5) =>
  `<path d="${d}" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`

// Paths copied from the product's icon set (src/components/icons/index.tsx).
const ICONS = {
  logo: icon(
    '<path d="M65 35L50 50L65 65" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M50 50H70C81.0457 50 90 41.0457 90 30C90 18.9543 81.0457 10 70 10H50C27.9086 10 10 27.9086 10 50C10 72.0914 27.9086 90 50 90C72.0914 90 90 72.0914 90 50" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
    '0 0 100 100',
  ),
  chevron: icon(stroke('M5 7.5L10 12.5L15 7.5', 2)),
  plus: icon(stroke('M10 4.16667V15.8333', 2) + stroke('M4.16667 10H15.8333', 2)),
  folder: icon(
    stroke('M18.3333 15.8333C18.3333 16.2754 18.1577 16.6993 17.8452 17.0118C17.5326 17.3244 17.1087 17.5 16.6667 17.5H3.33333C2.8913 17.5 2.46738 17.3244 2.15482 17.0118C1.84226 16.6993 1.66667 16.2754 1.66667 15.8333V4.16667C1.66667 3.72464 1.84226 3.30072 2.15482 2.98816C2.46738 2.67559 2.8913 2.5 3.33333 2.5H7.5L9.16667 5H16.6667C17.1087 5 17.5326 5.17559 17.8452 5.48816C18.1577 5.80072 18.3333 6.22464 18.3333 6.66667V15.8333Z'),
  ),
  pin: icon(stroke('M12.5 2.5 17.5 7.5M11 4 4 11l-1.5 4.5L7 14l7-7M9 6l5 5', 1.6)),
  settings: icon(
    stroke('M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z') +
      stroke('M16.1667 12.5C16.0558 12.7513 16.0227 13.0302 16.0717 13.3005C16.1207 13.5708 16.2496 13.8203 16.4417 14.0167L16.4917 14.0667C16.6467 14.2215 16.7696 14.4053 16.8535 14.6076C16.9374 14.81 16.9806 15.027 16.9806 15.2458C16.9806 15.4647 16.9374 15.6817 16.8535 15.884C16.7696 16.0864 16.6467 16.2702 16.4917 16.425C16.3369 16.58 16.1531 16.7029 15.9507 16.7868C15.7484 16.8707 15.5314 16.9139 15.3125 16.9139C15.0937 16.9139 14.8767 16.8707 14.6743 16.7868C14.472 16.7029 14.2882 16.58 14.1333 16.425L14.0833 16.375C13.887 16.1829 13.6375 16.054 13.3672 16.005C13.0969 15.956 12.818 15.9891 12.5667 16.1C12.3203 16.2056 12.1125 16.3819 11.9687 16.6074C11.825 16.8328 11.7517 17.0973 11.7583 17.3658V17.5C11.7583 17.942 11.5828 18.3659 11.2702 18.6785C10.9577 18.9911 10.5338 19.1667 10.0917 19.1667C9.64966 19.1667 9.22574 18.9911 8.91318 18.6785C8.60062 18.3659 8.425 17.942 8.425 17.5V17.425C8.42545 17.1493 8.34197 16.8797 8.18522 16.6538C8.02847 16.428 7.8061 16.2569 7.55 16.1667C7.29871 16.0558 7.01982 16.0227 6.74951 16.0717C6.4792 16.1207 6.22972 16.2496 6.03333 16.4417L5.98333 16.4917C5.82849 16.6467 5.6447 16.7696 5.44236 16.8535C5.24002 16.9374 5.02299 16.9806 4.80417 16.9806C4.58534 16.9806 4.36831 16.9374 4.16597 16.8535C3.96363 16.7696 3.77984 16.6467 3.625 16.4917C3.46999 16.3369 3.34709 16.1531 3.26319 15.9507C3.17929 15.7484 3.13612 15.5314 3.13612 15.3125C3.13612 15.0937 3.17929 14.8767 3.26319 14.6743C3.34709 14.472 3.46999 14.2882 3.625 14.1333L3.675 14.0833C3.86712 13.887 3.99603 13.6375 4.04502 13.3672C4.09402 13.0969 4.0609 12.818 3.95 12.5667C3.84439 12.3203 3.66812 12.1125 3.44267 11.9687C3.21722 11.825 2.95267 11.7517 2.68417 11.7583H2.5C2.05797 11.7583 1.63405 11.5828 1.32149 11.2702C1.00893 10.9577 0.833333 10.5338 0.833333 10.0917C0.833333 9.64966 1.00893 9.22574 1.32149 8.91318C1.63405 8.60062 2.05797 8.425 2.5 8.425H2.575C2.85073 8.42545 3.12035 8.34197 3.34622 8.18522C3.57208 8.02847 3.74313 7.8061 3.83333 7.55C3.94424 7.29871 3.97735 7.01982 3.92835 6.74951C3.87936 6.4792 3.75045 6.22972 3.55833 6.03333L3.50833 5.98333C3.35333 5.82849 3.23043 5.6447 3.14652 5.44236C3.06262 5.24002 3.01945 5.02299 3.01945 4.80417C3.01945 4.58534 3.06262 4.36831 3.14652 4.16597C3.23043 3.96363 3.35333 3.77984 3.50833 3.625C3.66318 3.46999 3.84696 3.34709 4.0493 3.26319C4.25165 3.17929 4.46867 3.13612 4.6875 3.13612C4.90633 3.13612 5.12335 3.17929 5.3257 3.26319C5.52804 3.34709 5.71183 3.46999 5.86667 3.625L5.91667 3.675C6.11306 3.86712 6.36254 3.99603 6.63285 4.04502C6.90316 4.09402 7.18205 4.0609 7.43333 3.95H7.5C7.74645 3.84439 7.95419 3.66812 8.09795 3.44267C8.24171 3.21722 8.31499 2.95267 8.30833 2.68417V2.5C8.30833 2.05797 8.48393 1.63405 8.79649 1.32149C9.10905 1.00893 9.53297 0.833333 9.975 0.833333C10.417 0.833333 10.841 1.00893 11.1535 1.32149C11.4661 1.63405 11.6417 2.05797 11.6417 2.5V2.575C11.635 2.84349 11.7083 3.10805 11.852 3.33349C11.9958 3.55894 12.2036 3.73522 12.45 3.84083C12.7013 3.95174 12.9802 3.98485 13.2505 3.93586C13.5208 3.88686 13.7703 3.75795 13.9667 3.56583L14.0167 3.51583C14.1715 3.36083 14.3553 3.23793 14.5576 3.15402C14.76 3.07012 14.977 3.02695 15.1958 3.02695C15.4147 3.02695 15.6317 3.07012 15.834 3.15402C16.0364 3.23793 16.2202 3.36083 16.375 3.51583C16.53 3.67068 16.6529 3.85446 16.7368 4.05681C16.8207 4.25915 16.8639 4.47617 16.8639 4.695C16.8639 4.91383 16.8207 5.13085 16.7368 5.3332C16.6529 5.53554 16.53 5.71932 16.375 5.87417L16.325 5.92417C16.1329 6.12056 16.004 6.37004 15.955 6.64035C15.906 6.91066 15.9391 7.18955 16.05 7.44083V7.5C16.1556 7.74645 16.3319 7.95419 16.5573 8.09795C16.7828 8.24171 17.0473 8.31499 17.3158 8.30833H17.5C17.942 8.30833 18.3659 8.48393 18.6785 8.79649C18.9911 9.10905 19.1667 9.53297 19.1667 9.975C19.1667 10.417 18.9911 10.841 18.6785 11.1535C18.3659 11.4661 17.942 11.6417 17.5 11.6417H17.425C17.1565 11.635 16.892 11.7083 16.6665 11.852C16.4411 11.9958 16.2648 12.2036 16.1592 12.45L16.1667 12.5Z'),
  ),
  expand: icon(stroke('M13 1H19V7', 2) + stroke('M7 19H1V13', 2) + stroke('M19 1L11 9', 2) + stroke('M1 19L9 11', 2)),
  close: icon(stroke('M15 5L5 15', 2) + stroke('M5 5L15 15', 2)),
  clipboard: icon(
    stroke('M13.3333 3.33333H14.1667C14.6087 3.33333 15.0326 3.50893 15.3452 3.82149C15.6577 4.13405 15.8333 4.55797 15.8333 5V16.6667C15.8333 17.1087 15.6577 17.5326 15.3452 17.8452C15.0326 18.1577 14.6087 18.3333 14.1667 18.3333H5.83333C5.39131 18.3333 4.96738 18.1577 4.65482 17.8452C4.34226 17.5326 4.16667 17.1087 4.16667 16.6667V5C4.16667 4.55797 4.34226 4.13405 4.65482 3.82149C4.96738 3.50893 5.39131 3.33333 5.83333 3.33333H6.66667') +
      stroke('M12.5 1.66667H7.5C7.03976 1.66667 6.66667 2.03977 6.66667 2.50001V4.16667C6.66667 4.62691 7.03976 5.00001 7.5 5.00001H12.5C12.9602 5.00001 13.3333 4.62691 13.3333 4.16667V2.50001C13.3333 2.03977 12.9602 1.66667 12.5 1.66667Z'),
  ),
  send: icon(stroke('M18.5 1.5L9 11', 2) + stroke('M18.5 1.5L12.5 18.5L9 11L1.5 7.5L18.5 1.5Z', 2)),
  doc: icon(
    stroke('M11.6667 1.66667H5C4.55797 1.66667 4.13405 1.84226 3.82149 2.15482C3.50893 2.46738 3.33333 2.8913 3.33333 3.33333V16.6667C3.33333 17.1087 3.50893 17.5326 3.82149 17.8452C4.13405 18.1577 4.55797 18.3333 5 18.3333H15C15.442 18.3333 15.866 18.1577 16.1785 17.8452C16.4911 17.5326 16.6667 17.1087 16.6667 16.6667V6.66667L11.6667 1.66667Z') +
      stroke('M11.6667 1.66667V6.66667H16.6667') +
      stroke('M13.3333 10.8333H6.66667') +
      stroke('M13.3333 14.1667H6.66667') +
      stroke('M8.33333 7.5H7.5H6.66667'),
  ),
  token: icon('<circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.5"/>' + stroke('M10 5V10L13 13')),
  check: icon(stroke('M16.6667 5L7.5 14.1667L3.33333 10', 2)),
}

/** The providers and their built-in model lists, as the product ships them (src/stores/appStore.ts). */
export const PROVIDERS = [
  { name: 'Google Gemini', models: ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'], pick: 'gemini-2.5-flash' },
  { name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], pick: 'gpt-4o' },
  { name: 'Anthropic Claude', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'], pick: 'claude-3-5-sonnet-20241022' },
  { name: 'Z AI GLM', models: ['glm-4.7', 'glm-4.6', 'glm-4.5', 'glm-4.5-air', 'glm-4.5-flash'], pick: 'glm-4.7' },
  { name: 'Ollama (Local)', models: ['llama3.2', 'mistral', 'codellama', 'gemma3:1b', 'qwen3-vl:8b', 'qwen3-vl:4b'], pick: 'llama3.2' },
]

export interface Answer {
  /** Plain text with `code` and **bold** markers, as the app's Markdown renders them. */
  text: string
  sources?: string[]
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Split an answer into pieces that can appear one at a time, like a stream. */
function chunks(text: string): string[] {
  const out: string[] = []
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|([^`*\s]+\s*)|(\s+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m[1]) out.push(`<code>${escapeHtml(m[1].slice(1, -1))}</code>`)
    else if (m[2]) out.push(`<strong>${escapeHtml(m[2].slice(2, -2))}</strong>`)
    else out.push(escapeHtml(m[0]))
  }
  return out
}

export class AppWindow {
  root: HTMLElement
  private card: HTMLElement
  private model: HTMLElement
  private usage: HTMLElement
  private docs: HTMLElement
  private docsCount: HTMLElement
  private newChat: HTMLElement
  private log: HTMLElement
  private empty: HTMLElement
  private thread: HTMLElement
  private input: HTMLTextAreaElement
  private sendButton: HTMLElement
  private caption: HTMLElement
  private menu: HTMLElement
  isOpen = false
  /** Called when the visitor sends their own text. */
  onSubmit: ((text: string) => void) | null = null
  /** Called when the visitor closes the window with its own button. */
  onClose: (() => void) | null = null

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'orw'
    this.root.innerHTML = `
      <div class="orw__card">
        <div class="orw__head">
          <div class="orw__head-left">
            <span class="orw__logo">${ICONS.logo}</span>
            <span class="orw__model"><i></i><b data-model>gemini-2.5-flash</b>${ICONS.chevron}</span>
            <span class="orw__usage" hidden>${ICONS.token}<span>0%</span></span>
            <span class="orw__docs" hidden>${ICONS.doc}<span data-docs>4</span></span>
          </div>
          <div class="orw__head-right">
            <span class="orw__btn" data-new hidden>${ICONS.plus}</span>
            <span class="orw__btn">${ICONS.folder}</span>
            <span class="orw__btn">${ICONS.pin}</span>
            <span class="orw__btn">${ICONS.settings}</span>
            <span class="orw__btn">${ICONS.expand}</span>
            <button class="orw__btn" type="button" data-close aria-label="Hide window">${ICONS.close}</button>
          </div>
        </div>
        <div class="orw__log">
          <div class="orw__empty">
            <div class="orw__empty-mark">${ICONS.logo}</div>
            <p class="orw__empty-title">Ask anything</p>
            <p class="orw__empty-sub">Chat, or add documents to ask about them</p>
            <div class="orw__chips"><span>Explain simply</span><span>Brainstorm ideas</span><span>Draft a reply</span></div>
            <div class="orw__hints"><span><kbd>Enter</kbd> send</span><span><kbd>Ctrl+K</kbd> commands</span><span><kbd>Esc</kbd> hide</span></div>
          </div>
          <div class="orw__thread"></div>
        </div>
        <div class="orw__menu" hidden>
          ${PROVIDERS.map(
            (p) => `<div class="orw__group"><div class="orw__group-head"><span>${p.name}</span><span class="orw__ok">${ICONS.check} connected</span></div>${p.models
              .map((m) => `<div class="orw__opt" data-opt="${m}">${m}</div>`)
              .join('')}<div class="orw__add">${ICONS.plus}<span>Add custom model</span></div></div>`,
          ).join('')}
        </div>
        <div class="orw__composer">
          <textarea rows="1" placeholder="Ask anything..." aria-label="Chat message input" tabindex="-1"></textarea>
          <span class="orw__tool">${ICONS.clipboard}</span>
          <span class="orw__send">${ICONS.send}</span>
        </div>
      </div>
      <p class="orw__caption"></p>`
    parent.appendChild(this.root)
    const q = <T extends HTMLElement>(sel: string) => this.root.querySelector<T>(sel)!
    this.card = q('.orw__card')
    this.model = q('[data-model]')
    this.usage = q('.orw__usage')
    this.docs = q('.orw__docs')
    this.docsCount = q('[data-docs]')
    this.newChat = q('[data-new]')
    this.log = q('.orw__log')
    this.empty = q('.orw__empty')
    this.thread = q('.orw__thread')
    this.input = q('textarea')
    this.sendButton = q('.orw__send')
    this.caption = q('.orw__caption')
    this.menu = q('.orw__menu')

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault()
        const text = this.input.value.trim()
        if (text && this.onSubmit) {
          this.input.value = ''
          this.syncSend()
          this.onSubmit(text)
        }
      }
    })
    this.input.addEventListener('input', () => this.syncSend())
    q('[data-close]').addEventListener('click', () => this.onClose?.())
  }

  /** Size of the card in px, for placing it the way the app places its window. */
  get size() {
    const r = this.card.getBoundingClientRect()
    return { w: r.width || 420, h: r.height || 360 }
  }

  /** The app's own rule (place_near_cursor in src-tauri/src/lib.rs): centred under the
      cursor with a 10px gap, kept on screen, and flipped above when there is no room below. */
  static placeNearCursor(cursor: { x: number; y: number }, size: { w: number; h: number }, screen: { w: number; h: number }, top = 0) {
    const MARGIN = 10
    let x = cursor.x - size.w / 2
    let y = cursor.y + MARGIN
    if (x + size.w > screen.w) x = screen.w - size.w - MARGIN
    if (x < 0) x = MARGIN
    if (y + size.h > screen.h) y = cursor.y - size.h - MARGIN
    if (y < top) y = top + MARGIN
    return { x, y }
  }

  moveTo(x: number, y: number) {
    this.root.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`
  }

  /** The app lets the window be 380 to 500 wide. */
  setWidth(px: number) {
    this.root.style.setProperty('--w', String(px))
  }

  setHeight(px: number | null) {
    this.card.style.height = px ? `${px}px` : ''
  }

  show() {
    this.isOpen = true
    this.root.classList.add('is-open')
  }

  hide() {
    this.isOpen = false
    this.root.classList.remove('is-open')
    this.input.blur()
  }

  /** Let the visitor type in it (their own window) or keep it out of the tab order (scripted). */
  setInteractive(on: boolean) {
    this.root.classList.toggle('is-live', on)
    this.input.tabIndex = on ? 0 : -1
    this.input.readOnly = !on
    if (on) {
      this.root.setAttribute('role', 'dialog')
      this.root.setAttribute('aria-label', 'OmniRecall window, scripted demo')
      this.root.removeAttribute('inert')
      this.input.focus({ preventScroll: true })
    } else {
      this.root.removeAttribute('role')
      this.root.removeAttribute('aria-label')
      this.root.setAttribute('inert', '')
    }
  }

  setCaption(text: string) {
    this.caption.textContent = text
  }

  setModel(name: string) {
    this.model.textContent = name
    this.menu.querySelectorAll<HTMLElement>('[data-opt]').forEach((opt) => {
      const active = opt.dataset.opt === name
      opt.classList.toggle('is-active', active)
      if (active && !this.menu.hidden) {
        const top = opt.offsetTop - this.menu.clientHeight / 2 + opt.offsetHeight / 2
        this.menu.scrollTo({ top, behavior: Script.instant ? 'auto' : 'smooth' })
      }
    })
  }

  /** The model list that drops from the header chip. */
  setMenu(open: boolean) {
    this.menu.hidden = !open
    this.root.classList.toggle('has-menu', open)
    if (open) this.setModel(this.model.textContent ?? '')
  }

  setDocs(count: number) {
    this.docs.hidden = count === 0
    this.docsCount.textContent = String(count)
    this.input.placeholder = count ? 'Ask about your docs...' : 'Ask anything...'
    const title = this.empty.querySelector('.orw__empty-title')!
    const sub = this.empty.querySelector('.orw__empty-sub')!
    const chips = this.empty.querySelector<HTMLElement>('.orw__chips')!
    title.textContent = count ? `${count} document${count > 1 ? 's' : ''} ready` : 'Ask anything'
    sub.textContent = count ? 'Ask questions about your documents' : 'Chat, or add documents to ask about them'
    chips.hidden = count > 0
  }

  /** A fresh, empty chat. */
  reset() {
    this.thread.innerHTML = ''
    this.empty.hidden = false
    this.usage.hidden = true
    this.newChat.hidden = true
    this.input.value = ''
    this.syncSend()
  }

  private syncSend() {
    this.sendButton.classList.toggle('is-ready', this.input.value.trim().length > 0)
  }

  private scrollDown() {
    this.log.scrollTop = this.log.scrollHeight
  }

  /** Type a question into the composer one character at a time. */
  async type(s: Script, text: string) {
    this.input.value = ''
    for (let i = 1; i <= text.length; i++) {
      this.input.value = text.slice(0, i)
      this.syncSend()
      if (!Script.instant) await s.wait(22 + Math.random() * 30 + (text[i - 1] === ' ' ? 24 : 0))
    }
    await s.wait(260)
  }

  /** Send: the question becomes a bubble, as it does on Enter in the app. */
  send(text: string) {
    this.input.value = ''
    this.syncSend()
    this.empty.hidden = true
    this.usage.hidden = false
    this.newChat.hidden = false
    const row = document.createElement('div')
    row.className = 'orw__row orw__row--user'
    row.innerHTML = `<div class="orw__bubble">${escapeHtml(text)}</div>`
    this.thread.appendChild(row)
    this.scrollDown()
  }

  /** The typing dots, then the answer streaming in, then its sources. */
  async answer(s: Script, answer: Answer) {
    const row = document.createElement('div')
    row.className = 'orw__row orw__row--bot'
    row.innerHTML = '<div class="orw__bubble orw__bubble--dots"><i></i><i></i><i></i></div>'
    this.thread.appendChild(row)
    this.scrollDown()
    await s.wait(520)
    const bubble = row.firstElementChild as HTMLElement
    bubble.className = 'orw__bubble'
    bubble.innerHTML = '<div class="orw__md"></div>'
    const md = bubble.firstElementChild as HTMLElement
    for (const piece of chunks(answer.text)) {
      md.insertAdjacentHTML('beforeend', piece)
      this.scrollDown()
      if (!Script.instant) await s.wait(26 + Math.random() * 34)
    }
    if (answer.sources?.length) {
      await s.wait(160)
      bubble.insertAdjacentHTML(
        'beforeend',
        `<div class="orw__sources"><span>Sources:</span>${answer.sources
          .map((name) => `<em data-source="${escapeHtml(name)}">${ICONS.doc}<span>${escapeHtml(name)}</span></em>`)
          .join('')}</div>`,
      )
      this.scrollDown()
    }
  }
}
