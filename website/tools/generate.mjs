// Sends each image in the manifest to its own `codex exec` session and collects the PNGs.
//
//   node tools/generate.mjs                 everything that is missing
//   node tools/generate.mjs key-alt lens    only these ids
//   node tools/generate.mjs --force --c=20  redo, 20 sessions at a time
//
// Codex is used only as an image generator: its shell is broken on this machine, so every
// prompt tells it to call image_gen and nothing else. It runs with this folder as its working
// directory and never sees the product's source.
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { images } from './manifest.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW = join(root, 'assets-raw')
const LOGS = join(root, 'tools', 'logs')
const GENERATED = join(homedir(), '.codex', 'generated_images')
mkdirSync(RAW, { recursive: true })
mkdirSync(LOGS, { recursive: true })

const argv = process.argv.slice(2)
const force = argv.includes('--force')
const concurrency = Number((argv.find((a) => a.startsWith('--c=')) ?? '--c=16').slice(4))
const only = argv.filter((a) => !a.startsWith('--'))
const TIMEOUT_MS = 14 * 60 * 1000

const fileFor = (image, step) => (image.steps ? `${image.id}-${step + 1}.png` : `${image.id}.png`)
const isDone = (image) => existsSync(join(RAW, fileFor(image, (image.steps?.length ?? 1) - 1)))

const queue = images.filter((image) => (only.length ? only.includes(image.id) : true) && (force || !isDone(image)))
console.log(`${queue.length} image job(s), ${concurrency} at a time`)

const HEAD =
  'You are being used purely as an image generator. Shell commands and file tools are broken in this ' +
  'environment: do NOT run any shell command, do NOT read, list or copy any file. Only call the built-in ' +
  'image generation tool (image_gen).\n\n'

function promptFor(image) {
  if (image.steps) {
    return (
      HEAD +
      `Make exactly ${image.steps.length} images, in order, with one image_gen call each. Every step after ` +
      'the first is an EDIT of the image produced by the step before it, which is already visible in this ' +
      'conversation: keep the framing, camera, object position and outline identical, and change only what ' +
      'the step says.\n\n' +
      image.steps.map((step, i) => `STEP ${i + 1} (${image.shape}):\n${step}`).join('\n\n') +
      '\n\nWhen every step is done, reply with only the saved file paths, in order.'
    )
  }
  return (
    HEAD +
    'Call image_gen exactly once with the prompt below, keeping all of its content. ' +
    `Requested shape: ${image.shape}. ` +
    (image.alpha ? 'The output MUST have a genuinely transparent background (real alpha channel). ' : '') +
    'When it returns, reply with only the saved file path.\n\nPROMPT:\n' +
    image.prompt
  )
}

function run(image) {
  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(
      'codex',
      ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '-c', 'model_reasoning_effort="low"', '--color', 'never', '-'],
      { cwd: root, windowsHide: true, shell: process.platform === 'win32' },
    )
    let output = ''
    child.stdout.on('data', (d) => (output += d))
    child.stderr.on('data', (d) => (output += d))
    child.stdin.end(promptFor(image))
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS)
    child.on('error', (e) => (output += `\nSPAWN ERROR ${e.message}`))
    child.on('close', (code) => {
      clearTimeout(timer)
      writeFileSync(join(LOGS, `${image.id}.log`), output)
      const seconds = Math.round((Date.now() - started) / 1000)
      const session = (output.match(/session id:\s*([0-9a-f-]{36})/i) ?? [])[1]
      const dir = session && join(GENERATED, session)
      if (!dir || !existsSync(dir)) {
        console.log(`FAIL  ${image.id}  (${seconds}s, exit ${code}, no image folder)`)
        return resolve(false)
      }
      const files = readdirSync(dir)
        .filter((f) => /\.(png|webp|jpe?g)$/i.test(f))
        .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
        .sort((a, b) => a.t - b.t)
      const wanted = image.steps?.length ?? 1
      if (files.length < wanted) {
        console.log(`FAIL  ${image.id}  (${seconds}s, got ${files.length}/${wanted} images)`)
        return resolve(false)
      }
      files.slice(-wanted).forEach((file, i) => copyFileSync(join(dir, file.f), join(RAW, fileFor(image, i))))
      console.log(`ok    ${image.id}  (${seconds}s)`)
      resolve(true)
    })
  })
}

let next = 0
let failed = 0
await Promise.all(
  Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (next < queue.length) if (!(await run(queue[next++]))) failed++
  }),
)
console.log(failed ? `DONE with ${failed} failure(s)` : 'ALL DONE')
