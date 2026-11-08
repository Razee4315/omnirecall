#!/usr/bin/env node
// Generate README art with the Codex CLI's built-in image tool.
//
//   node tools/readme-art/generate.mjs [--only id,id] [--concurrency 16] [--force] [--out DIR]
//
// One Codex session per manifest entry. An entry with `edits` asks for the
// base image and then each edit in the same session, so the versions stay
// pixel-aligned. Codex saves images under ~/.codex/generated_images/<session>;
// this script reads the session id from Codex's output and copies the PNGs to
// <out>/<id>.png. Existing outputs are skipped unless --force is given.

import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { IMAGES, buildPrompt } from "./manifest.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const only = flag("only", "")?.split(",").filter(Boolean) ?? [];
const concurrency = Number(flag("concurrency", "16"));
const force = args.includes("--force");
const outDir = flag("out", "tools/readme-art/raw");
const logDir = join(outDir, "logs");
const imagesRoot = join(homedir(), ".codex", "generated_images");
mkdirSync(logDir, { recursive: true });

const ids = (image) => [image.id, ...(image.edits ?? []).map((e) => e.id)];
const done = (image) => ids(image).every((id) => existsSync(join(outDir, `${id}.png`)));

const queue = IMAGES.filter((img) => (only.length === 0 || ids(img).some((id) => only.includes(id))) && (force || !done(img)));

function promptFor(image) {
  if (!image.edits?.length) return buildPrompt(image);
  // Base image, then each edit, in one session.
  const steps = [
    `Step 1 — generate this image:\n${image.prompt}`,
    ...image.edits.map((edit, i) => `Step ${i + 2} — after step ${i + 1} is done, call image_gen again to EDIT the image from step 1:\n${edit.prompt}`),
  ].join("\n\n");
  return buildPrompt(image, `This task has ${image.edits.length + 1} steps. Call the image tool once per step, in order. Reply with all saved paths, one per line.\n\n${steps}`, true);
}

function runCodex(image) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(
      "codex",
      ["exec", "--skip-git-repo-check", "--sandbox", "read-only", "-c", 'model_reasoning_effort="low"', "--color", "never", "-"],
      { shell: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.stdin.end(promptFor(image));
    child.on("close", (code) => {
      writeFileSync(join(logDir, `${image.id}.log`), output);
      resolve({ code, output, seconds: Math.round((Date.now() - started) / 1000) });
    });
  });
}

async function generate(image) {
  const { code, output, seconds } = await runCodex(image);
  const session = output.match(/session id:\s*([0-9a-f-]{36})/i)?.[1];
  const dir = session && join(imagesRoot, session);
  if (!dir || !existsSync(dir)) {
    return { id: image.id, ok: false, note: `no images (exit ${code}, ${seconds}s) — see logs/${image.id}.log` };
  }
  // Oldest first: base image, then the edits in the order they were made.
  const pngs = readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => a.t - b.t)
    .map(({ f }) => join(dir, f));
  const wanted = ids(image);
  if (pngs.length < wanted.length) {
    return { id: image.id, ok: false, note: `expected ${wanted.length} images, got ${pngs.length} (${seconds}s)` };
  }
  wanted.forEach((id, i) => copyFileSync(pngs[i], join(outDir, `${id}.png`)));
  return { id: wanted.join(" + "), ok: true, note: `${seconds}s · session ${session}` };
}

console.log(`Generating ${queue.length} session(s), ${concurrency} at a time → ${outDir}`);
const results = [];
let next = 0;
async function worker() {
  while (next < queue.length) {
    const image = queue[next++];
    console.log(`… ${image.id} started`);
    const result = await generate(image);
    results.push(result);
    console.log(`${result.ok ? "ok  " : "FAIL"} ${result.id}  ${result.note}`);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
const failed = results.filter((r) => !r.ok).length;
console.log(`\nDone: ${results.length - failed} ok, ${failed} failed.`);
process.exit(failed ? 1 : 0);
