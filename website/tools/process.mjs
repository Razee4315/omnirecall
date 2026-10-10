// Makes the site's images web-ready (WebP in public/img) and writes their sizes to src/img.json.
//
//   objects  a few generated cut-outs (assets-raw/*.png): the pointer, paper, a key.
//            Trimmed to their alpha, resized, and made black-and-white.
//   screens  real captures of the app (assets-raw/app, made by tools/capture/capture.mjs).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW = join(root, 'assets-raw')
const OUT = join(root, 'public', 'img')
mkdirSync(OUT, { recursive: true })
const meta = {}

// id -> longest side in px (about twice the size it is shown at).
const OBJECTS = {
  'paper-sheet': 620,
  'paper-notebook': 620,
  'paper-stack': 520,
  'paper-folded': 420,
  'paper-listing': 420,
  'key-steel': 1100,
}

async function alphaBox(file) {
  const { data, info } = await sharp(file).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true })
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[y * info.width + x] > 10) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
}

// The pointer was generated as a pair: white porcelain, then an edit of the same object in black.
// Both take the first one's outline and crop, so the two copies line up exactly on the page.
{
  const white = join(RAW, 'pointer-1.png')
  const black = join(RAW, 'pointer-2.png')
  if (existsSync(white) && existsSync(black)) {
    const box = await alphaBox(white)
    const { width, height } = await sharp(white).metadata()
    const alpha = await sharp(white).ensureAlpha().extractChannel('alpha').toBuffer()
    const scale = Math.min(1, 760 / Math.max(box.width, box.height))
    for (const [name, file] of [['pointer-white', white], ['pointer-black', black]]) {
      const rgb = await sharp(file).resize(width, height, { fit: 'fill' }).removeAlpha().grayscale().toColourspace('srgb').png().toBuffer()
      // Join first, as its own step: sharp joins channels late, after any crop or resize in the same pipeline.
      const joined = await sharp(rgb).joinChannel(alpha).png().toBuffer()
      const out = await sharp(joined)
        .extract(box)
        .resize(Math.round(box.width * scale), Math.round(box.height * scale))
        .webp({ quality: 90, alphaQuality: 94, effort: 5 })
        .toFile(join(OUT, `${name}.webp`))
      meta[name] = { w: out.width, h: out.height }
      console.log(`object  ${name.padEnd(16)} ${out.width}x${out.height}  ${Math.round(out.size / 1024)} KB`)
    }
  } else console.log('skip    pointer (run tools/generate.mjs first)')
}

for (const [id, max] of Object.entries(OBJECTS)) {
  const file = join(RAW, `${id}.png`)
  if (!existsSync(file)) {
    console.log(`skip    ${id} (not in assets-raw)`)
    continue
  }
  const box = await alphaBox(file)
  const scale = Math.min(1, max / Math.max(box.width, box.height))
  const out = await sharp(file)
    .extract(box)
    .resize(Math.round(box.width * scale), Math.round(box.height * scale))
    // The site is black and white: take out the faint blue the objects were lit with.
    .grayscale()
    .toColourspace('srgb')
    .webp({ quality: 88, alphaQuality: 92, effort: 5 })
    .toFile(join(OUT, `${id}.webp`))
  meta[id] = { w: out.width, h: out.height }
  console.log(`object  ${id.padEnd(16)} ${out.width}x${out.height}  ${Math.round(out.size / 1024)} KB`)
}

// Captured at 2x. Both sizes are kept so interface text stays crisp on any screen.
for (const theme of ['dark', 'light', 'transparent', 'paper', 'rose', 'ocean']) {
  const file = join(RAW, 'app', `dashboard-${theme}.png`)
  if (!existsSync(file)) {
    console.log(`skip    dashboard-${theme} (run tools/capture/capture.mjs first)`)
    continue
  }
  const { width, height } = await sharp(file).metadata()
  const full = await sharp(file).webp({ quality: 90, alphaQuality: 100, effort: 5 }).toFile(join(OUT, `dashboard-${theme}.webp`))
  const half = await sharp(file).resize(Math.round(width / 2)).webp({ quality: 88, alphaQuality: 100, effort: 5 }).toFile(join(OUT, `dashboard-${theme}.1x.webp`))
  console.log(`screen  dashboard-${theme.padEnd(12)} ${width}x${height}  ${Math.round((full.size + half.size) / 1024)} KB`)
}

// The app icon, straight from the product (read only).
const icon = join(root, '..', 'src-tauri', 'icons', 'icon.png')
if (existsSync(icon)) await sharp(icon).resize(180, 180).png().toFile(join(root, 'public', 'apple-touch-icon.png'))

writeFileSync(join(root, 'src', 'img.json'), JSON.stringify(meta, null, 2) + '\n')
console.log('wrote src/img.json')
