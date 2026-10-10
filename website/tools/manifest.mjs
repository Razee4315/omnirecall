// The generated images the site uses. Prompts describe objects only: no text, no interface.

const NO = 'No text, no letters, no numbers, no logos, no labels, no symbols, no engravings, no screens, no user interface, no watermark, no signature.'

const OBJECT =
  'Studio macro product photograph on a 100mm macro lens, photorealistic, extremely fine material detail. ' +
  'A single object floating in empty space. Strictly black-and-white: neutral white studio light only, no coloured light, no colour cast. ' +
  'One large soft key light from the upper left, gentle natural shading on the lower-right side of the object. ' +
  'The whole object is in crisp focus from edge to edge. ' +
  'Genuinely transparent background (real alpha channel): no backdrop, no surface, no floor, no cast shadow, no glow or haze outside the object. ' +
  'The object is centred and fully inside the frame with a clear margin of about 8 percent on every side, nothing cropped. ' +
  NO

// The paper and the key come from an earlier shoot with a faint blue rim light;
// tools/process.mjs makes them black-and-white.
const OBJECT_BLUE_RIM =
  'Studio macro product photograph on a 100mm macro lens, photorealistic, extremely fine material detail. ' +
  'A single object floating in empty space. Lighting: one large soft cool-white key light from the upper left, ' +
  'a thin electric-blue rim light (hex #4a9eff) tracing the right-hand edges, and deep natural shadow on the ' +
  "object's own lower-right side. Palette: near-black, graphite, cool white, clear blue. " +
  'The whole object is in crisp focus from edge to edge. ' +
  'Genuinely transparent background (real alpha channel): no backdrop, no surface, no floor, no cast shadow, ' +
  'no glow or haze outside the object. The object is centred and fully inside the frame with a clear margin ' +
  'of about 8 percent on every side, nothing cropped. ' +
  NO
const object = (id, shape, subject) => ({ id, shape, alpha: true, prompt: `${subject} ${OBJECT_BLUE_RIM}` })

export const images = [
  object('paper-sheet', 'portrait 2:3', 'A single blank sheet of thick uncoated white writing paper, gently curved as if drifting down through the air, seen at a three-quarter angle, with soft paper grain and a slightly curled lower corner.'),
  object('paper-stack', 'landscape 3:2', 'A small stack of about fifteen blank white paper sheets held at the top-left corner by a plain matte black binder clip, the sheets slightly fanned, floating at a three-quarter angle.'),
  object('paper-folded', 'landscape 3:2', 'A blank sheet of white paper folded in thirds like a letter and half opened, floating at an angle, sharp creases, soft paper grain.'),
  object('paper-notebook', 'portrait 2:3', 'A single blank page torn from a spiral notebook, off-white paper with a faint pale grey dot grid, a ragged perforated edge on the left side, slightly bowed, floating at a three-quarter angle.'),
  object('paper-listing', 'portrait 2:3', 'A long narrow strip of blank continuous-feed computer printer paper with rows of small round tractor-feed holes down both edges and faint pale green horizontal bands, curling loosely like a ribbon as it floats.'),
  object('key-steel', 'landscape 3:2', 'A single small plain brushed stainless-steel cylinder door key with a smooth blank round bow, floating at a slight angle, seen from the side so the cut teeth are visible.'),

  // One pointer, twice: white porcelain, then the same object in black. The two line up pixel for
  // pixel, so the site can show the black one on white and the white one on black.
  {
    id: 'pointer',
    shape: 'portrait 2:3',
    alpha: true,
    steps: [
      `A classic computer mouse pointer arrow made as a physical object: a solid slab about 10mm thick of glossy white porcelain with softly rounded edges, the arrow tip pointing to the upper left, seen almost straight on with a slight three-quarter turn so the thickness of its right and bottom edges is visible. ${OBJECT}`,
      'Same object, same framing, same outline, same camera, still on a genuinely transparent background. Change only the material: it is now glossy jet-black porcelain, deep black, with crisp soft white reflections of the studio light along its upper-left edges and a faint grey sheen on its face. Still strictly black-and-white.',
    ],
  },
]
