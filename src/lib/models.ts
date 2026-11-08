/// The built-in model catalog: what each provider offers out of the box, how
/// model ids are shown, and how large each model's context window is.
///
/// These lists are only a starting point. Verifying a provider's key replaces
/// its list with the models the account can actually use, and users can add
/// any model id by hand. Last reviewed November 2026.

export interface ProviderMeta {
  /// Short name for tight spaces.
  short: string;
  /// One- or two-letter monogram shown in the provider tile.
  monogram: string;
  /// Tile background (CSS color/gradient) and its foreground.
  tile: string;
  tileFg: string;
  /// Where to get an API key (absent for local providers).
  keyUrl?: string;
  /// Example id for the "add custom model" field.
  example: string;
  /// One line about what the provider is good for.
  blurb: string;
}

export const PROVIDER_META: Record<string, ProviderMeta> = {
  gemini: {
    short: "Gemini",
    monogram: "G",
    tile: "linear-gradient(135deg, #4f8cff, #8b5cf6 60%, #e05ba8)",
    tileFg: "#ffffff",
    keyUrl: "https://aistudio.google.com/apikey",
    example: "gemini-4-argon",
    blurb: "Fast, 1M-token context, generous free tier. Also powers document search.",
  },
  openai: {
    short: "OpenAI",
    monogram: "O",
    tile: "linear-gradient(135deg, #1f2937, #0b0f14)",
    tileFg: "#ffffff",
    keyUrl: "https://platform.openai.com/api-keys",
    example: "gpt-6.1-sol",
    blurb: "GPT-6 family — strong reasoning and coding.",
  },
  anthropic: {
    short: "Claude",
    monogram: "A",
    tile: "linear-gradient(135deg, #e0896a, #c25e3e)",
    tileFg: "#ffffff",
    keyUrl: "https://console.anthropic.com/settings/keys",
    example: "claude-opus-5-5",
    blurb: "Claude Opus, Sonnet and Haiku — careful writing and analysis.",
  },
  glm: {
    short: "GLM",
    monogram: "Z",
    tile: "linear-gradient(135deg, #3b82f6, #1e40af)",
    tileFg: "#ffffff",
    keyUrl: "https://z.ai/manage-apikey/apikey-list",
    example: "glm-5.3",
    blurb: "Z.ai GLM-5 — long-context open models.",
  },
  ollama: {
    short: "Ollama",
    monogram: "L",
    tile: "linear-gradient(135deg, #e7e5e4, #a8a29e)",
    tileFg: "#1c1917",
    example: "qwen3.6:27b",
    blurb: "Runs open models on your own machine. Private and free; no key needed.",
  },
};

export function providerMeta(id: string): ProviderMeta {
  return (
    PROVIDER_META[id] ?? {
      short: id,
      monogram: id.slice(0, 1).toUpperCase(),
      tile: "var(--surface-3)",
      tileFg: "var(--fg)",
      example: "model-id",
      blurb: "",
    }
  );
}

/// Built-in model lists, best default first.
export const DEFAULT_MODELS: Record<string, string[]> = {
  gemini: [
    "gemini-3.8-flash",
    "gemini-4-argon",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-pro-preview",
  ],
  openai: ["gpt-6.1-sol", "gpt-6-astra", "gpt-6.1-terra", "gpt-6-luna"],
  anthropic: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5", "claude-fable-5-1"],
  glm: ["glm-5.3", "glm-5.2", "glm-5.3-flash", "glm-4.7-flash"],
  ollama: ["gpt-oss:20b", "qwen3.6", "gemma4", "llama3.2", "deepseek-r1"],
};

export const DEFAULT_PROVIDER = "gemini";
export const DEFAULT_MODEL = DEFAULT_MODELS.gemini[0];

/// Built-in ids shipped by earlier versions. A saved selection of one of
/// these that the provider no longer lists is moved to the current default,
/// rather than failing on the first message.
export const RETIRED_MODELS = new Set([
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "glm-4.7",
  "glm-4.6",
  "glm-4.5",
  "glm-4.5-air",
  "glm-4.5-flash",
  "mistral",
  "codellama",
  "gemma3:1b",
  "qwen3-vl:8b",
  "qwen3-vl:4b",
]);

/// Friendly names for well-known ids. Anything else is prettified below.
const MODEL_LABELS: Record<string, string> = {
  "gemini-3.8-flash": "Gemini 3.8 Flash",
  "gemini-4-argon": "Gemini 4 Argon",
  "gemini-3.6-flash": "Gemini 3.6 Flash",
  "gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite",
  "gemini-3.1-pro-preview": "Gemini 3.1 Pro",
  "gpt-6-astra": "GPT-6 Astra",
  "gpt-6.1-sol": "GPT-6.1 Sol",
  "gpt-6.1-terra": "GPT-6.1 Terra",
  "gpt-6-luna": "GPT-6 Luna",
  "claude-fable-5-1": "Claude Fable 5.1",
  "claude-opus-5-5": "Claude Opus 5.5",
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
  "claude-haiku-5-5": "Claude Haiku 5.5",
  "glm-5.3": "GLM-5.3",
  "glm-5.2": "GLM-5.2",
  "glm-5.3-flash": "GLM-5.3 Flash",
  "glm-4.7-flash": "GLM-4.7 Flash",
  "gpt-oss:20b": "gpt-oss 20B",
  "qwen3.6": "Qwen 3.6",
  gemma4: "Gemma 4",
  "llama3.2": "Llama 3.2",
  "deepseek-r1": "DeepSeek R1",
};

/// Short descriptions shown under curated models in the picker.
const MODEL_NOTES: Record<string, string> = {
  "gemini-3.8-flash": "Fast, everyday default",
  "gemini-4-argon": "Most capable · deep reasoning",
  "gemini-3.5-flash-lite": "Lightest and cheapest",
  "gpt-6-astra": "Flagship · complex reasoning",
  "gpt-6.1-sol": "Balanced intelligence and cost",
  "gpt-6.1-terra": "Fast and efficient",
  "gpt-6-luna": "High volume, low cost",
  "claude-fable-5-1": "Most capable Claude",
  "claude-opus-5-5": "Frontier intelligence",
  "claude-sonnet-5-5": "Speed and capability",
  "claude-haiku-5-5": "Fastest, lowest cost",
  "glm-5.3": "Flagship · 1M context",
  "glm-5.3-flash": "Fast multimodal",
  "glm-4.7-flash": "Free tier",
  "gpt-oss:20b": "Runs on 16 GB",
  "qwen3.6": "Strong all-rounder",
  gemma4: "Google · multimodal",
};

const WORD_CASE: Record<string, string> = {
  gpt: "GPT",
  glm: "GLM",
  oss: "OSS",
  ai: "AI",
};

/// A readable name for any model id: "claude-opus-5-5" → "Claude Opus 5.5",
/// "gemini-4-argon" → "Gemini 4 Argon", "llama3.2:3b" → "Llama3.2 3B".
export function modelLabel(id: string): string {
  if (MODEL_LABELS[id]) return MODEL_LABELS[id];
  // Ollama tags: name:tag
  const [name, tag] = id.split(":");
  const base = name.split("/").pop() ?? name;
  const words = base
    .replace(/-(\d+)-(\d+)(?=$|-)/g, "-$1.$2") // claude-x-4-6 → claude-x-4.6
    .split("-")
    .filter(Boolean)
    .map((word) => WORD_CASE[word.toLowerCase()] ?? (/^\d/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)));
  const label = words.join(" ").replace(/^GPT (\d)/, "GPT-$1").replace(/^GLM (\d)/, "GLM-$1");
  return tag && tag !== "latest" ? `${label} ${tag.toUpperCase()}` : label;
}

export function modelNote(id: string): string | undefined {
  return MODEL_NOTES[id];
}

/// A dated snapshot (gpt-…-2026-04-01, claude-…-20250929) of a model that is
/// also listed under its moving alias.
export function isSnapshotId(id: string): boolean {
  return /-\d{4}-\d{2}-\d{2}$/.test(id) || /-\d{8}$/.test(id);
}

/// Order a provider's live model list: curated models first (in curated
/// order), then the rest as reported, with dated snapshots last.
export function orderModels(providerId: string, models: string[]): string[] {
  const curated = DEFAULT_MODELS[providerId] ?? [];
  const available = new Set(models);
  const first = curated.filter((m) => available.has(m));
  const rest = models.filter((m) => !curated.includes(m));
  return [...first, ...rest.filter((m) => !isSnapshotId(m)), ...rest.filter(isSnapshotId)];
}

// Approximate context windows (tokens), matched in order against the model
// id, so the usage meter is relative to the active model's window.
const CONTEXT_WINDOWS: [RegExp, number][] = [
  [/^gemini-1\.0|^gemini-pro$/, 32_000],
  [/^gemini/, 1_000_000],
  [/^gpt-6|^gpt-4\.1/, 1_000_000],
  [/^gpt-5|^o[134]/, 400_000],
  [/^gpt-4o|^gpt-4-turbo|^chatgpt/, 128_000],
  [/^gpt-oss/, 128_000],
  [/^claude-(fable|mythos|opus-5|sonnet-5|haiku-5|opus-4-[678]|sonnet-4-6)/, 1_000_000],
  [/^claude/, 200_000],
  [/^glm-5\.[1-9]/, 1_000_000],
  [/^glm-(5|4\.6|4\.7)/, 200_000],
  [/^glm/, 128_000],
  [/^(qwen3|gemma4|gemma3|llama3\.[123]|deepseek-r1|mistral-small)/, 128_000],
];
const DEFAULT_CONTEXT_WINDOW = 32_000;

export function contextWindowFor(model: string): number {
  const id = model.toLowerCase();
  return CONTEXT_WINDOWS.find(([pattern]) => pattern.test(id))?.[1] ?? DEFAULT_CONTEXT_WINDOW;
}
