// Art for the README. One shared style block keeps every image looking like
// one art-directed shoot. Images never contain text: all words live in the
// Markdown, and the logo is always the real file.

export const STYLE = `
Style: premium studio still life, rendered like a high-end product photograph.
Materials: sculpted frosted glass with a soft inner glow, polished graphite, satin metal.
Light: soft key light from the upper left, gentle rim light tinted periwinkle (#9391ff) and lavender (#c4a1ff), smooth falloff, no harsh specular hotspots.
Lens: 85mm, shallow depth of field, crisp subject, creamy soft background.
Palette: deep graphite near-black (#0c0c0e), periwinkle, lavender, a touch of cool white. Restrained and calm.
Mood: quiet, precise, minimal, a lot of negative space.
Avoid: any text, letters, numbers, logos, labels, signs, watermarks, signatures, user interfaces, screens, people, hands, clutter.
`.trim();

const TRANSPARENT =
  "Background: a genuinely transparent background (real alpha channel). No backdrop, no surface, no floor, no cast shadow, no vignette. The object floats alone.";

/** @type {{ id: string, shape: string, transparent: boolean, prompt: string, edits?: { id: string, prompt: string }[] }[]} */
export const IMAGES = [
  {
    id: "hero-dark",
    shape: "an ultra-wide panorama, 3:1 aspect ratio (for example 1536x512)",
    transparent: false,
    prompt: `
A single sculptural glass loop floats slightly right of center in a vast, deep graphite space: a smooth ribbon of frosted glass that curves into a ring and returns into itself, like a gesture of recalling something. A soft periwinkle light glows from inside the glass and spills a faint halo into the darkness around it. Far in the soft-focus background, a few tiny out-of-focus points of lavender light drift like distant memories. The left half of the frame is calm, empty darkness. Cinematic, minimal, elegant.
`.trim(),
    edits: [
      {
        id: "hero-light",
        prompt: `
Edit the image you just made. Keep exactly the same framing, composition, object shape, position and size. Change only the environment and light for a light theme: the background becomes a soft, warm porcelain off-white (#f6f5f2) with a very gentle gradient, the glass loop becomes clear frosted glass with a soft indigo (#4f46e5) and lavender inner glow, and the distant out-of-focus points become pale lavender. Bright, airy, calm. No text.
`.trim(),
      },
    ],
  },
  {
    id: "feature-cursor",
    shape: "square, 1:1",
    transparent: true,
    prompt: `
A small, chunky frosted-glass mouse-pointer arrow, seen at a slight three-quarter angle, with a tiny glowing periwinkle orb hovering just beside its tip, as if summoning something. The glass is softly tinted periwinkle so it reads clearly on both white and black backgrounds. Centered, generous margins on every side.
`.trim(),
  },
  {
    id: "feature-docs",
    shape: "square, 1:1",
    transparent: true,
    prompt: `
Three thin sheets of frosted glass stacked and slightly fanned like pages, floating at a gentle three-quarter angle, with a soft periwinkle light glowing up through them from below, as if knowledge is being read from them. The glass is softly tinted lavender so it reads clearly on both white and black backgrounds. Blank surfaces, no writing. Centered, generous margins on every side.
`.trim(),
  },
  {
    id: "feature-models",
    shape: "square, 1:1",
    transparent: true,
    prompt: `
Three smooth glass spheres of slightly different sizes nestled together in a tight, balanced cluster, each tinted a different soft hue (periwinkle, lavender, pale cool blue), with light passing and refracting between them. Polished and calm. The spheres are tinted enough to read clearly on both white and black backgrounds. Centered, generous margins on every side.
`.trim(),
  },
  {
    id: "feature-private",
    shape: "square, 1:1",
    transparent: true,
    prompt: `
A small, rounded frosted-glass shield shape with soft beveled edges, standing upright at a slight three-quarter angle, with a gentle periwinkle glow held safely inside it like a protected light. The glass is softly tinted periwinkle so it reads clearly on both white and black backgrounds. Plain surface, no symbols, no keyhole. Centered, generous margins on every side.
`.trim(),
  },
];

export function buildPrompt(image, body = image.prompt, isEdit = false) {
  const rules = `
Important instructions for you, the assistant:
- Do NOT run any shell commands. Do NOT read, write, copy or list any files. Your shell is unavailable.
- Only call your built-in image generation tool (image_gen) ${isEdit ? "to edit the previous image" : "once"}.
- After the image is generated, reply with just the saved file path and nothing else.
`.trim();
  return [
    rules,
    "",
    `Shape: ${image.shape}.`,
    body,
    image.transparent ? TRANSPARENT : "",
    "",
    STYLE,
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}
