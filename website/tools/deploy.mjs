// Builds the site and publishes dist/ to the gh-pages branch, which GitHub Pages serves.
//   npm run deploy
// It pushes a single fresh commit to gh-pages from a throwaway repository, so it never touches
// main and never starts the app's CI or release workflows.
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
const read = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8' }).trim()

const remote = read('git', ['remote', 'get-url', 'origin'], root)
const source = read('git', ['rev-parse', '--short', 'HEAD'], root)

run('npm', ['run', 'build'], root)

const out = mkdtempSync(join(tmpdir(), 'omnirecall-pages-'))
try {
  cpSync(join(root, 'dist'), out, { recursive: true })
  // No Jekyll: serve the files exactly as built.
  writeFileSync(join(out, '.nojekyll'), '')
  run('git', ['init', '-q', '-b', 'gh-pages'], out)
  run('git', ['add', '-A'], out)
  run('git', ['-c', 'user.name=' + read('git', ['config', 'user.name'], root), '-c', 'user.email=' + read('git', ['config', 'user.email'], root), 'commit', '-q', '-m', `"Deploy website from ${source}"`], out)
  run('git', ['push', '--force', remote, 'gh-pages'], out)
  console.log('\nPublished to the gh-pages branch.')
} finally {
  rmSync(out, { recursive: true, force: true })
}
