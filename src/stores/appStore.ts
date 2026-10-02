import { signal, computed } from "@preact/signals";
import { Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { errorMessage } from "../lib/errors";
import { estimateTokens } from "../lib/history";

export { estimateTokens };

export type ViewMode = "spotlight" | "dashboard";
export type Theme = "dark" | "light" | "transparent" | "paper" | "rose" | "ocean";
export type SettingsTab = "providers" | "appearance" | "shortcuts" | "behavior" | "privacy" | "developer";

const THEMES: Theme[] = ["dark", "light", "transparent", "paper", "rose", "ocean"];

export interface AIProvider {
  id: string;
  name: string;
  models: string[];
  apiKey: string;
  isConnected: boolean;
  baseUrl?: string;
}

export interface Document {
  id: string;
  name: string;
  path: string;
  type: string;
  addedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tokenCount?: number;
  /// Model that produced an assistant message.
  model?: string;
  /// Names of the documents sent as context for an assistant message.
  sources?: string[];
  /// The answer was cut short by an error or by the user stopping it.
  interrupted?: boolean;
}

export interface Branch {
  id: string;
  name: string;
  fromMessageId: string;
  createdAt: string;
  /// Set on branches created by "regenerate": the thread ("main" or a branch
  /// id) whose answer this is an alternative version of...
  regenRoot?: string;
  /// ...and the index of the user message the versions answer.
  forkIndex?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[]; // Main thread
  branches: Branch[];
  branchMessages: Record<string, ChatMessage[]>; // Messages per branch ID
  createdAt: string;
  /// Last time a message was added; drives sidebar ordering.
  updatedAt?: string;
  folderId?: string | null;
  activeBranchId?: string | null;
  isPinned?: boolean;
  /// False when the user switched documents off for this chat.
  docsEnabled?: boolean;
}

export interface ChatFolder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  isCollapsed?: boolean;
}

export interface SearchResult {
  sessionId: string;
  sessionTitle: string;
  /// Null for a title match or a main-thread message.
  branchId: string | null;
  /// Null for a title match.
  messageId: string | null;
  content: string;
  matchIndex: number;
  kind: "title" | "user" | "assistant";
}

export interface DocumentState {
  chars: number;
  error: string | null;
  indexedChunks: number;
}

export type ContextMode = "none" | "full" | "semantic" | "truncated";

export interface DocumentStatus {
  loading: boolean;
  byId: Record<string, DocumentState>;
  contextMode: ContextMode;
  /// Estimated tokens the attached documents add to each message.
  contextTokens: number;
}

interface DocumentsStatusResponse {
  documents: (DocumentState & { id: string })[];
  contextMode: ContextMode;
  contextTokens: number;
}

interface HotkeyStatus {
  hotkey: string;
  registered: boolean;
  error: string | null;
}

// App State Signals
export const viewMode = signal<ViewMode>("spotlight");
export const theme = signal<Theme>("dark");
export const currentQuery = signal("");
export const isGenerating = signal(false);
export const isSettingsOpen = signal(false);
/// Tab Settings opens on; lets other surfaces deep-link (e.g. hotkey warning).
export const settingsTab = signal<SettingsTab>("providers");
export const globalHotkey = signal<string>("Alt+Space");
/// Why the global shortcut isn't working, when it isn't.
export const hotkeyError = signal<string | null>(null);

export const isCommandPaletteOpen = signal(false);
export const isCompareMode = signal(false);
/// Which side of the export/import dialog is open, if any.
export const exportDialog = signal<"export" | "import" | null>(null);

// Window State
export const isMaximized = signal(false);
export const isFullscreen = signal(false);
/// Spotlight normally hides when it loses focus; pinning keeps it open (for
/// dragging files in, or copying from another window).
export const isWindowPinned = signal(false);

// Connectivity — reflected in the header and used to short-circuit cloud sends
// while offline (local Ollama still works). Updated by App.tsx online/offline
// listeners.
export const isOnline = signal(typeof navigator !== "undefined" ? navigator.onLine : true);

// True while files are being dragged over the window (drives the drop overlay).
export const isDragOver = signal(false);

// Keyboard Shortcuts Help
export const isShortcutsHelpOpen = signal(false);

// Onboarding State
export const isOnboardingActive = signal(false);

// System Prompt: a persistent instruction prepended to every conversation.
// Lets users set persona/role/tone without having to repeat themselves at
// the top of each new chat. Stored locally and bounded to keep it from
// eating the whole context window.
export const MAX_SYSTEM_PROMPT_CHARS = 8_000;
export const systemPrompt = signal<string>("");

const DEFAULT_PROVIDER = "gemini";
const DEFAULT_MODEL = "gemini-3-flash-preview";

function defaultProviders(): AIProvider[] {
  return [
    {
      id: "gemini",
      name: "Google Gemini",
      models: [
        "gemini-3-flash-preview",
        "gemini-3-pro-preview",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.5-flash-lite",
      ],
      apiKey: "",
      isConnected: false,
    },
    {
      id: "openai",
      name: "OpenAI",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
      apiKey: "",
      isConnected: false,
    },
    {
      id: "anthropic",
      name: "Anthropic Claude",
      models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
      apiKey: "",
      isConnected: false,
    },
    {
      id: "glm",
      name: "Z AI GLM",
      models: ["glm-4.7", "glm-4.6", "glm-4.5", "glm-4.5-air", "glm-4.5-flash"],
      apiKey: "",
      isConnected: false,
    },
    {
      id: "ollama",
      name: "Ollama (Local)",
      models: ["llama3.2", "mistral", "codellama", "gemma3:1b", "qwen3-vl:8b", "qwen3-vl:4b"],
      apiKey: "",
      isConnected: false,
      baseUrl: "http://localhost:11434",
    },
  ];
}

// AI Provider State
export const providers = signal<AIProvider[]>(defaultProviders());
export const activeProvider = signal(DEFAULT_PROVIDER);
export const activeModel = signal<string>(DEFAULT_MODEL);

/// User-added model names per provider. Persists across launches and is
/// merged on top of the provider's model list so users can still reach a
/// model the list doesn't include.
export const customModels = signal<Record<string, string[]>>({});

/// Model ids reported by each provider the last time its key was verified.
/// When present they replace the built-in list, which is only a fallback for
/// providers that haven't been verified yet (hard-coded names go stale).
export const fetchedModels = signal<Record<string, string[]>>({});

/// Hard cap so a runaway paste can't bloat the JSON store. Anything
/// remotely real is well under this length.
const MAX_MODEL_NAME_LENGTH = 80;
const VALID_MODEL_NAME_RE = /^[A-Za-z0-9._:\-/]+$/;

export function isValidModelName(name: string): boolean {
  const trimmed = name.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= MAX_MODEL_NAME_LENGTH &&
    VALID_MODEL_NAME_RE.test(trimmed)
  );
}

/// Models offered for a provider: the live list when we have one (otherwise
/// the built-in fallback), followed by the user's custom models.
export function getProviderModels(providerId: string): string[] {
  const provider = providers.value.find(p => p.id === providerId);
  const fetched = fetchedModels.value[providerId] ?? [];
  const base = fetched.length > 0 ? fetched : provider ? provider.models : [];
  const custom = customModels.value[providerId] ?? [];
  return [...new Set([...base, ...custom])];
}

export function isCustomModel(providerId: string, model: string): boolean {
  return (customModels.value[providerId] ?? []).includes(model);
}

// Documents State
export const documents = signal<Document[]>([]);

const EMPTY_DOCUMENT_STATUS: DocumentStatus = {
  loading: false,
  byId: {},
  contextMode: "none",
  contextTokens: 0,
};
export const documentStatus = signal<DocumentStatus>(EMPTY_DOCUMENT_STATUS);

export type IndexState = { state: "indexing" } | { state: "failed"; error: string };
export const indexStates = signal<Record<string, IndexState>>({});

/// Whether attached documents are sent with messages in the current chat.
export const docsEnabled = signal(true);

/// Number of documents whose text could be read.
export const readableDocumentCount = computed(
  () => documents.value.filter(d => (documentStatus.value.byId[d.id]?.chars ?? 0) > 0).length,
);

// Chat History State (persistent)
export const chatHistory = signal<ChatSession[]>([]);
export const currentMessages = signal<ChatMessage[]>([]);
export const activeSessionId = signal<string | null>(null);
export const activeBranchId = signal<string | null>(null);

/// Incremented whenever the visible thread changes (another chat, a new chat,
/// another branch). An in-flight response compares the value it captured at
/// send time to know whether the user is still looking at its thread.
export const threadEpoch = signal(0);

/// Message to scroll into view once its thread has rendered (search hits).
export const pendingScrollMessageId = signal<string | null>(null);

/// Id of the stream currently being generated in the chat view.
export const activeStreamId = signal<string | null>(null);

// Chat Folders State
export const chatFolders = signal<ChatFolder[]>([]);

// Computed: Get sessions by folder
export const sessionsByFolder = computed(() => {
  const folders = new Map<string | null, ChatSession[]>();
  folders.set(null, []); // Uncategorized

  for (const folder of chatFolders.value) {
    folders.set(folder.id, []);
  }

  for (const session of chatHistory.value) {
    const folderId = session.folderId && folders.has(session.folderId) ? session.folderId : null;
    folders.get(folderId)!.push(session);
  }

  return folders;
});

export function sessionActivity(session: ChatSession): string {
  return session.updatedAt ?? session.createdAt;
}

/// Sessions in the order the sidebar shows them: pinned first, then most
/// recently active. Keyboard navigation (Ctrl+1-9, Ctrl+[ / ]) uses the same
/// order so "chat 1" is the one at the top of the list.
export const orderedSessions = computed(() => {
  const byActivity = (a: ChatSession, b: ChatSession) =>
    sessionActivity(b).localeCompare(sessionActivity(a));
  const pinned = chatHistory.value.filter(s => s.isPinned).sort(byActivity);
  const rest = chatHistory.value.filter(s => !s.isPinned).sort(byActivity);
  return [...pinned, ...rest];
});

// Approximate context-window sizes (tokens) so the UI can show usage as a
// fraction of the active model's window rather than an absolute count. Matched
// by substring against the model id; falls back to a conservative default.
const CONTEXT_WINDOWS: { match: string; tokens: number }[] = [
  { match: "gemini", tokens: 1_000_000 },
  { match: "gpt-4", tokens: 128_000 },
  { match: "claude", tokens: 200_000 },
  { match: "glm-4.6", tokens: 200_000 },
  { match: "glm-4.7", tokens: 200_000 },
  { match: "glm", tokens: 128_000 },
];
const DEFAULT_CONTEXT_WINDOW = 32_000;

export function getContextWindow(model: string): number {
  const m = model.toLowerCase();
  const hit = CONTEXT_WINDOWS.find(c => m.includes(c.match));
  return hit ? hit.tokens : DEFAULT_CONTEXT_WINDOW;
}

/// Estimated tokens the next request will carry: the conversation, the
/// system prompt, and the document context when documents are switched on.
export const contextTokens = computed(() => {
  const messages = currentMessages.value.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0);
  const docs = docsEnabled.value ? documentStatus.value.contextTokens : 0;
  return messages + docs + estimateTokens(systemPrompt.value);
});

// Fraction (0-1) of the active model's context window the next request uses.
export const contextUsageFraction = computed(
  () => contextTokens.value / getContextWindow(activeModel.value),
);

// ============= Persistence =============

// Store instance
let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load("omnirecall-data.json");
  }
  return store;
}

async function persist(key: string, value: unknown) {
  try {
    const s = await getStore();
    await s.set(key, value);
    await s.save();
  } catch (e) {
    console.error(`Failed to save ${key}:`, e);
  }
}

// Debounce utility to prevent excessive disk writes
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingSaves = new Map<string, () => Promise<void>>();

function debouncedSave(key: string, saveFn: () => Promise<void>, delay = 1500) {
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  pendingSaves.set(key, saveFn);
  debounceTimers.set(key, setTimeout(() => {
    debounceTimers.delete(key);
    pendingSaves.delete(key);
    void saveFn();
  }, delay));
}

function cancelPendingSaves() {
  for (const timer of debounceTimers.values()) clearTimeout(timer);
  debounceTimers.clear();
  pendingSaves.clear();
}

/// Run every debounced save now (call before the window unloads).
export async function flushPendingSaves() {
  const saves = [...pendingSaves.values()];
  cancelPendingSaves();
  await Promise.all(saves.map(save => save()));
}

// Sessions are stored one per key plus an ordered index, instead of a single
// array, so saving after a message rewrites one conversation rather than the
// whole history.
const SESSION_INDEX_KEY = "sessionIndex";
const LEGACY_HISTORY_KEY = "chatHistory";
const sessionKey = (id: string) => `session:${id}`;

// What is on disk, by object identity: store updates are immutable, so a
// session needs writing exactly when its object differs from the saved one.
const persistedSessions = new Map<string, ChatSession>();
let persistedOrder = "";
let sessionWrites: Promise<void> = Promise.resolve();

async function writeSessions() {
  try {
    const s = await getStore();
    const sessions = chatHistory.value;
    const live = new Set<string>();
    let changed = false;

    for (const session of sessions) {
      live.add(session.id);
      if (persistedSessions.get(session.id) !== session) {
        await s.set(sessionKey(session.id), session);
        persistedSessions.set(session.id, session);
        changed = true;
      }
    }
    for (const id of [...persistedSessions.keys()]) {
      if (!live.has(id)) {
        await s.delete(sessionKey(id));
        persistedSessions.delete(id);
        changed = true;
      }
    }
    const order = sessions.map(session => session.id);
    const orderKey = order.join("\n");
    if (orderKey !== persistedOrder) {
      await s.set(SESSION_INDEX_KEY, order);
      persistedOrder = orderKey;
      changed = true;
    }
    if (changed) await s.save();
  } catch (e) {
    console.error("Failed to save chat history:", e);
  }
}

function queueSessionWrite(): Promise<void> {
  // Serialise writes so a debounced save and an immediate one can't interleave.
  sessionWrites = sessionWrites.then(writeSessions);
  return sessionWrites;
}

// Save chat history (debounced - won't write to disk more than once per 1.5s)
function saveChatHistory() {
  debouncedSave("sessions", queueSessionWrite);
}

// Force immediate save of chat history (use on stream completion)
export function saveChatHistoryNow(): Promise<void> {
  const existing = debounceTimers.get("sessions");
  if (existing) {
    clearTimeout(existing);
    debounceTimers.delete("sessions");
    pendingSaves.delete("sessions");
  }
  return queueSessionWrite();
}

function saveChatFolders() {
  debouncedSave("chatFolders", () => persist("chatFolders", chatFolders.value));
}

function saveDocuments() {
  debouncedSave("documents", () => persist("documents", documents.value));
}

// ============= Validation of stored / imported data =============

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function sanitizeMessage(raw: unknown): ChatMessage | null {
  if (!isRecord(raw)) return null;
  const content = typeof raw.content === "string" ? raw.content : String(raw.content ?? "");
  const message: ChatMessage = {
    id: asString(raw.id) || crypto.randomUUID(),
    role: raw.role === "assistant" ? "assistant" : "user",
    content,
    tokenCount: typeof raw.tokenCount === "number" ? raw.tokenCount : estimateTokens(content),
  };
  const model = asString(raw.model);
  if (model) message.model = model;
  if (Array.isArray(raw.sources)) {
    message.sources = raw.sources.filter((s): s is string => typeof s === "string");
  }
  if (raw.interrupted === true) message.interrupted = true;
  return message;
}

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeMessage).filter((m): m is ChatMessage => m !== null);
}

function sanitizeBranch(raw: unknown): Branch | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  const branch: Branch = {
    id,
    name: asString(raw.name) || "Branch",
    fromMessageId: asString(raw.fromMessageId) || "",
    createdAt: asString(raw.createdAt) || new Date().toISOString(),
  };
  const regenRoot = asString(raw.regenRoot);
  if (regenRoot && typeof raw.forkIndex === "number") {
    branch.regenRoot = regenRoot;
    branch.forkIndex = raw.forkIndex;
  }
  return branch;
}

/// Validate a session read from disk or from an import file. Returns null
/// when it isn't recognisable as a session; otherwise every field is coerced
/// to the expected shape so malformed data can't break rendering.
export function sanitizeSession(raw: unknown, preserveId: boolean): ChatSession | null {
  if (!isRecord(raw) || !Array.isArray(raw.messages)) return null;
  const title = asString(raw.title)?.trim();
  if (!title) return null;

  const branches = Array.isArray(raw.branches)
    ? raw.branches.map(sanitizeBranch).filter((b): b is Branch => b !== null)
    : [];
  const branchMessages: Record<string, ChatMessage[]> = {};
  if (isRecord(raw.branchMessages)) {
    for (const branch of branches) {
      branchMessages[branch.id] = sanitizeMessages(raw.branchMessages[branch.id]);
    }
  }
  const activeBranch = asString(raw.activeBranchId);

  return {
    id: (preserveId && asString(raw.id)) || crypto.randomUUID(),
    title: title.slice(0, 120),
    messages: sanitizeMessages(raw.messages),
    branches,
    branchMessages,
    createdAt: asString(raw.createdAt) || new Date().toISOString(),
    updatedAt: asString(raw.updatedAt),
    folderId: asString(raw.folderId) ?? null,
    activeBranchId: activeBranch && branches.some(b => b.id === activeBranch) ? activeBranch : null,
    isPinned: raw.isPinned === true,
    docsEnabled: raw.docsEnabled !== false,
  };
}

function sanitizeFolder(raw: unknown): ChatFolder | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const name = asString(raw.name)?.trim();
  if (!id || !name) return null;
  return {
    id,
    name: name.slice(0, 80),
    color: asString(raw.color) || "#3b82f6",
    createdAt: asString(raw.createdAt) || new Date().toISOString(),
    isCollapsed: raw.isCollapsed === true,
  };
}

function sanitizeDocument(raw: unknown): Document | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const path = asString(raw.path);
  if (!id || !path) return null;
  return {
    id,
    path,
    name: asString(raw.name) || fileName(path),
    type: asString(raw.type) || fileExtension(path),
    addedAt: asString(raw.addedAt) || new Date().toISOString(),
  };
}

function sanitizeModelMap(raw: unknown): Record<string, string[]> {
  if (!isRecord(raw)) return {};
  const result: Record<string, string[]> = {};
  for (const [providerId, models] of Object.entries(raw)) {
    if (Array.isArray(models)) {
      result[providerId] = models.filter((m): m is string => typeof m === "string" && isValidModelName(m));
    }
  }
  return result;
}

// ============= Theme =============

// Apply theme CSS classes to document root
export function applyThemeClasses(newTheme: Theme) {
  const html = document.documentElement;
  html.classList.remove("dark", "transparent", "paper", "rose", "ocean");

  switch (newTheme) {
    case "dark":
      html.classList.add("dark");
      break;
    case "transparent":
      html.classList.add("dark", "transparent");
      break;
    case "paper":
      html.classList.add("paper");
      break;
    case "rose":
      html.classList.add("dark", "rose");
      break;
    case "ocean":
      html.classList.add("dark", "ocean");
      break;
  }
}

export function setTheme(newTheme: Theme) {
  theme.value = newTheme;
  applyThemeClasses(newTheme);
  void persist("theme", newTheme);
}

// ============= API keys =============

// True once the OS credential store has answered. Keys then live there and
// the store file holds none; if the credential store is unavailable the keys
// stay in the store file so the app keeps working.
let credentialStoreAvailable = false;

async function saveProviders() {
  const stored = providers.value.map(p => ({
    id: p.id,
    apiKey: credentialStoreAvailable ? "" : p.apiKey,
    isConnected: p.isConnected,
    baseUrl: p.baseUrl,
  }));
  await persist("providers", stored);
}

async function writeApiKeySecret(providerId: string, apiKey: string) {
  if (!credentialStoreAvailable) return;
  try {
    await invoke("set_api_key_secret", { provider: providerId, value: apiKey });
  } catch (e) {
    console.error("Failed to store API key in the credential store:", e);
  }
}

/// Load API keys: prefer the OS credential store, and move any keys still in
/// the store file (older versions kept them there in plain text) across.
async function loadProviders(s: Store) {
  const saved = await s.get<unknown>("providers");
  const savedById = new Map<string, Record<string, unknown>>();
  if (Array.isArray(saved)) {
    for (const entry of saved) {
      if (isRecord(entry) && typeof entry.id === "string") savedById.set(entry.id, entry);
    }
  }

  let secrets: Record<string, string> = {};
  try {
    const loaded = await invoke<unknown>("get_api_key_secrets", {
      providers: providers.value.map(p => p.id),
    });
    if (isRecord(loaded)) {
      credentialStoreAvailable = true;
      for (const [id, value] of Object.entries(loaded)) {
        if (typeof value === "string") secrets[id] = value;
      }
    }
  } catch (e) {
    console.error("Credential store unavailable, keeping API keys in the app store:", e);
    secrets = {};
  }

  const legacyKeys: [string, string][] = [];
  providers.value = providers.value.map(p => {
    const entry = savedById.get(p.id);
    const storedKey = asString(entry?.apiKey) ?? "";
    if (storedKey && credentialStoreAvailable && !secrets[p.id]) legacyKeys.push([p.id, storedKey]);
    return {
      ...p,
      apiKey: secrets[p.id] || storedKey,
      isConnected: entry?.isConnected === true,
      baseUrl: asString(entry?.baseUrl) ?? p.baseUrl,
    };
  });

  if (credentialStoreAvailable) {
    for (const [id, key] of legacyKeys) await writeApiKeySecret(id, key);
    const storeHadKeys = [...savedById.values()].some(entry => asString(entry.apiKey));
    if (storeHadKeys) await saveProviders();
  }
}

export function updateProviderApiKey(providerId: string, apiKey: string) {
  const current = providers.value.find(p => p.id === providerId);
  if (!current || current.apiKey === apiKey) return;
  // Changing the key invalidates any prior "verified" state — the new key
  // hasn't been tested.
  providers.value = providers.value.map((p) =>
    p.id === providerId ? { ...p, apiKey, isConnected: false } : p
  );
  void writeApiKeySecret(providerId, apiKey);
  void saveProviders();
  if (providerId === "gemini") void refreshDocumentStatus();
}

function setProviderConnected(providerId: string, connected: boolean) {
  providers.value = providers.value.map((p) =>
    p.id === providerId ? { ...p, isConnected: connected } : p
  );
  void saveProviders();
}

export function updateProviderBaseUrl(providerId: string, baseUrl: string) {
  providers.value = providers.value.map((p) =>
    p.id === providerId ? { ...p, baseUrl } : p,
  );
  void saveProviders();
}

/// Verify a provider's credentials with the backend. On success the key is
/// saved, the provider is marked connected, its live model list replaces the
/// built-in one, and it becomes the active provider if the current one can't
/// be used. Throws with a user-facing message on failure.
export async function verifyProvider(providerId: string, apiKey: string, baseUrl?: string): Promise<void> {
  try {
    const models = await invoke<unknown>("test_api_key", { provider: providerId, apiKey, baseUrl });
    updateProviderApiKey(providerId, apiKey);
    setProviderConnected(providerId, true);
    if (Array.isArray(models)) {
      const valid = models.filter((m): m is string => typeof m === "string" && isValidModelName(m));
      if (valid.length > 0) {
        fetchedModels.value = { ...fetchedModels.value, [providerId]: valid };
        void persist("fetchedModels", fetchedModels.value);
      }
    }
    adoptProviderIfActiveUnusable(providerId);
    // A model that the provider no longer lists would fail on the first send.
    if (activeProvider.value === providerId) {
      const available = getProviderModels(providerId);
      if (available.length > 0 && !available.includes(activeModel.value)) {
        setActiveModel(providerId, available[0]);
      }
    }
  } catch (err) {
    setProviderConnected(providerId, false);
    const message = errorMessage(err, "Connection failed");
    if (message.includes("Invalid API key")) throw new Error("Invalid API key. Please check it and try again.");
    if (message.includes("Cannot connect to Ollama")) throw new Error("Cannot reach Ollama at that address. Is it running?");
    if (message.startsWith("Network error")) throw new Error("Network error. Check your internet connection.");
    throw new Error(message.length > 160 ? `${message.slice(0, 160)}...` : message);
  }
}

// ============= Models =============

export function addCustomModel(providerId: string, model: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = model.trim();
  if (!isValidModelName(trimmed)) {
    return { ok: false, reason: "Invalid model name. Use letters, numbers, dots, dashes, slashes or colons." };
  }
  if (getProviderModels(providerId).includes(trimmed)) {
    return { ok: false, reason: "That model is already in the list." };
  }
  const existing = customModels.value[providerId] ?? [];
  customModels.value = {
    ...customModels.value,
    [providerId]: [...existing, trimmed],
  };
  void persist("customModels", customModels.value);
  return { ok: true };
}

export function removeCustomModel(providerId: string, model: string) {
  const existing = customModels.value[providerId] ?? [];
  const next = existing.filter(m => m !== model);
  if (next.length === existing.length) return;
  customModels.value = { ...customModels.value, [providerId]: next };
  void persist("customModels", customModels.value);

  // If the removed model was the active one, fall back to the first
  // available model for the same provider.
  if (activeProvider.value === providerId && activeModel.value === model) {
    const [first] = getProviderModels(providerId);
    if (first) setActiveModel(providerId, first);
  }
}

export function setActiveModel(providerId: string, model: string) {
  activeProvider.value = providerId;
  activeModel.value = model;
  void (async () => {
    try {
      const s = await getStore();
      await s.set("activeProvider", providerId);
      await s.set("activeModel", model);
      await s.save();
    } catch (e) {
      console.error("Failed to save active model:", e);
    }
  })();
}

/// After a provider is verified, switch to it when the currently selected
/// provider can't be used (no key and not a local Ollama). Without this a user
/// who adds only an OpenAI key stays on the default Gemini model and gets
/// "No API key" on their first message.
export function adoptProviderIfActiveUnusable(providerId: string) {
  if (activeProvider.value === providerId) return;
  const active = providers.value.find(p => p.id === activeProvider.value);
  const activeUsable = !!active && (active.apiKey !== "" || active.id === "ollama");
  if (activeUsable) return;
  const [firstModel] = getProviderModels(providerId);
  if (firstModel) setActiveModel(providerId, firstModel);
}

/// Save the user's system prompt. Bounded to MAX_SYSTEM_PROMPT_CHARS so
/// pasted megabytes can't bloat the on-disk JSON store.
export function setSystemPrompt(value: string) {
  systemPrompt.value = value.slice(0, MAX_SYSTEM_PROMPT_CHARS);
  debouncedSave("systemPrompt", () => persist("systemPrompt", systemPrompt.value));
}

// ============= Hotkey / window =============

function applyHotkeyStatus(status: unknown) {
  if (!isRecord(status)) return;
  if (typeof status.hotkey === "string" && status.hotkey) globalHotkey.value = status.hotkey;
  hotkeyError.value = typeof status.error === "string" && status.error ? status.error : null;
}

export async function refreshHotkeyStatus() {
  try {
    applyHotkeyStatus(await invoke<HotkeyStatus>("get_hotkey_status"));
  } catch (e) {
    console.error("Failed to load hotkey:", e);
  }
}

/// Format a stored hotkey ("Ctrl+KeyK") for display ("Ctrl + K").
export function formatHotkey(hotkey: string): string {
  return hotkey.replace(/Key([A-Z])/g, "$1").replace(/Digit(\d)/g, "$1").replace(/\+/g, " + ");
}

// Reasons the Spotlight window must not hide when it loses focus. The
// backend flag is on while any reason is active.
const blurHideHolds = new Set<string>();

export function holdWindowOpen(reason: string, hold: boolean) {
  const before = blurHideHolds.size > 0;
  if (hold) blurHideHolds.add(reason);
  else blurHideHolds.delete(reason);
  const after = blurHideHolds.size > 0;
  if (before !== after) {
    invoke("set_blur_hide_suspended", { suspended: after }).catch(() => {});
  }
}

export function setWindowPinned(pinned: boolean) {
  isWindowPinned.value = pinned;
  holdWindowOpen("pinned", pinned);
}

export async function setDashboardMode(dashboard: boolean) {
  viewMode.value = dashboard ? "dashboard" : "spotlight";
  // Leaving the Dashboard also leaves maximized / fullscreen.
  if (!dashboard) {
    isMaximized.value = false;
    isFullscreen.value = false;
  }
  try {
    await invoke("toggle_dashboard", { isDashboard: dashboard });
  } catch (e) {
    console.error("Failed to switch view:", e);
  }
}

// ============= Load =============

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() || "Unknown";
}

function fileExtension(path: string): string {
  const name = fileName(path);
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

async function loadSessions(s: Store) {
  const index = await s.get<unknown>(SESSION_INDEX_KEY);
  if (Array.isArray(index)) {
    const ids = index.filter((id): id is string => typeof id === "string");
    const raw = await Promise.all(ids.map(id => s.get<unknown>(sessionKey(id))));
    const sessions = raw
      .map(entry => sanitizeSession(entry, true))
      .filter((session): session is ChatSession => session !== null);
    chatHistory.value = sessions;
    persistedSessions.clear();
    for (const session of sessions) persistedSessions.set(session.id, session);
    persistedOrder = ids.join("\n");
    return;
  }

  // One-time migration from the single-array layout. The new keys are
  // written before the old one is removed, so an interrupted migration just
  // runs again on the next launch.
  const legacy = await s.get<unknown>(LEGACY_HISTORY_KEY);
  if (Array.isArray(legacy)) {
    chatHistory.value = legacy
      .map(entry => sanitizeSession(entry, true))
      .filter((session): session is ChatSession => session !== null);
    await queueSessionWrite();
    await s.delete(LEGACY_HISTORY_KEY);
    await s.save();
  }
}

let loaded: Promise<void> | null = null;

/// Load data from persistent storage. Safe to call more than once; the work
/// happens on the first call.
export function loadPersistedData(): Promise<void> {
  if (!loaded) loaded = loadFromStore();
  return loaded;
}

async function loadFromStore() {
  try {
    const s = await getStore();

    await loadSessions(s);

    const savedFolders = await s.get<unknown>("chatFolders");
    if (Array.isArray(savedFolders)) {
      chatFolders.value = savedFolders.map(sanitizeFolder).filter((f): f is ChatFolder => f !== null);
    }

    await loadProviders(s);

    // Load model lists before resolving the active model so a custom or
    // provider-reported model is recognised as valid on restore.
    customModels.value = sanitizeModelMap(await s.get<unknown>("customModels"));
    fetchedModels.value = sanitizeModelMap(await s.get<unknown>("fetchedModels"));

    const savedActiveProvider = await s.get<unknown>("activeProvider");
    const savedActiveModel = await s.get<unknown>("activeModel");
    if (
      typeof savedActiveProvider === "string" &&
      typeof savedActiveModel === "string" &&
      providers.value.some(p => p.id === savedActiveProvider)
    ) {
      activeProvider.value = savedActiveProvider;
      activeModel.value = savedActiveModel;
    }

    const savedTheme = await s.get<unknown>("theme");
    if (typeof savedTheme === "string" && (THEMES as string[]).includes(savedTheme)) {
      theme.value = savedTheme as Theme;
      applyThemeClasses(theme.value);
    }

    const savedPrompt = await s.get<unknown>("systemPrompt");
    if (typeof savedPrompt === "string") {
      systemPrompt.value = savedPrompt.slice(0, MAX_SYSTEM_PROMPT_CHARS);
    }

    const savedDocs = await s.get<unknown>("documents");
    if (Array.isArray(savedDocs)) {
      documents.value = savedDocs.map(sanitizeDocument).filter((d): d is Document => d !== null);
    }

    // Onboarding completion used to live in localStorage; carry it over.
    let onboardingComplete = (await s.get<unknown>("onboardingComplete")) === true;
    if (!onboardingComplete && localStorage.getItem("omnirecall_onboarding_complete")) {
      onboardingComplete = true;
      await persist("onboardingComplete", true);
      localStorage.removeItem("omnirecall_onboarding_complete");
    }
    isOnboardingActive.value = !onboardingComplete;
  } catch (e) {
    console.error("Failed to load persisted data:", e);
  }

  await refreshHotkeyStatus();
  void refreshDocumentStatus();
}

export function completeOnboarding() {
  isOnboardingActive.value = false;
  void persist("onboardingComplete", true);
}

// ============= Sessions =============

function touch(session: ChatSession): ChatSession {
  return { ...session, updatedAt: new Date().toISOString() };
}

function replaceSession(sessionId: string, update: (session: ChatSession) => ChatSession) {
  chatHistory.value = chatHistory.value.map(s => (s.id === sessionId ? update(s) : s));
}

function bumpThread() {
  threadEpoch.value += 1;
}

export function addChatSession(session: ChatSession) {
  chatHistory.value = [session, ...chatHistory.value];
  void saveChatHistoryNow(); // Immediate save for new session creation
}

/// Replace the messages of a session's main thread (branchId null) or of one
/// of its branches.
export function updateThreadMessages(sessionId: string, branchId: string | null, messages: ChatMessage[]) {
  replaceSession(sessionId, s =>
    touch(
      branchId === null
        ? { ...s, messages }
        : { ...s, branchMessages: { ...s.branchMessages, [branchId]: messages } },
    ),
  );
  saveChatHistory();
}

export function deleteChatSession(sessionId: string) {
  chatHistory.value = chatHistory.value.filter(s => s.id !== sessionId);
  drafts.delete(sessionId);
  if (activeSessionId.value === sessionId) {
    currentMessages.value = [];
    activeSessionId.value = null;
    activeBranchId.value = null;
    bumpThread();
  }
  void saveChatHistoryNow(); // Immediate for destructive action
}

/// Put a deleted session back where it was in the stored order (Undo).
export function restoreChatSession(session: ChatSession, index: number) {
  if (chatHistory.value.some(s => s.id === session.id)) return;
  const next = [...chatHistory.value];
  next.splice(Math.min(Math.max(index, 0), next.length), 0, session);
  chatHistory.value = next;
  void saveChatHistoryNow();
}

// Unsent composer text per thread, so switching chats doesn't lose a draft.
const NEW_CHAT_DRAFT = "new";
const drafts = new Map<string, string>();

function stashDraft() {
  const key = activeSessionId.value ?? NEW_CHAT_DRAFT;
  if (currentQuery.value.trim()) drafts.set(key, currentQuery.value);
  else drafts.delete(key);
}

/// Canonical "open this conversation" action. Restores the session's active
/// branch (or the given one) and its messages so we never leave activeBranchId
/// pointing at a previous session's branch. Every entry point — sidebar,
/// folders, command palette, search, and the keyboard shortcuts — routes
/// through this so branch state can't drift out of sync.
export function loadSession(session: ChatSession, branchId?: string | null) {
  stashDraft();
  const requested = branchId === undefined ? session.activeBranchId || null : branchId;
  const target = requested && session.branchMessages[requested] ? requested : null;
  currentMessages.value = target ? session.branchMessages[target] : session.messages;
  activeBranchId.value = target;
  activeSessionId.value = session.id;
  docsEnabled.value = session.docsEnabled !== false;
  currentQuery.value = drafts.get(session.id) ?? "";
  bumpThread();
  if (branchId !== undefined && (session.activeBranchId || null) !== target) {
    replaceSession(session.id, s => ({ ...s, activeBranchId: target }));
    saveChatHistory();
  }
}

/// Load a session by its position in the sidebar order (Ctrl+1-9 quick nav).
export function loadSessionByIndex(index: number): boolean {
  const session = orderedSessions.value[index];
  if (!session) return false;
  loadSession(session);
  return true;
}

/// Move to the previous (-1) or next (+1) session relative to the active one.
export function loadAdjacentSession(direction: -1 | 1): boolean {
  if (!activeSessionId.value) return false;
  const sessions = orderedSessions.value;
  const i = sessions.findIndex(s => s.id === activeSessionId.value);
  if (i === -1) return false;
  const next = sessions[i + direction];
  if (!next) return false;
  loadSession(next);
  return true;
}

/// Start a fresh, unsaved chat. Clears the working conversation AND the active
/// branch so the next send can't write into a stale branch.
export function startNewChat() {
  if (activeSessionId.value) stashDraft();
  drafts.delete(NEW_CHAT_DRAFT);
  currentMessages.value = [];
  activeSessionId.value = null;
  activeBranchId.value = null;
  docsEnabled.value = true;
  currentQuery.value = "";
  bumpThread();
}

/// Switch documents on or off for the current chat.
export function setDocsEnabled(enabled: boolean) {
  docsEnabled.value = enabled;
  const sessionId = activeSessionId.value;
  if (sessionId) {
    replaceSession(sessionId, s => ({ ...s, docsEnabled: enabled }));
    saveChatHistory();
  }
}

/// Rename a chat session. Titles are otherwise auto-derived from the first
/// user message; this lets the user give a conversation a meaningful name.
export function updateSessionTitle(sessionId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  replaceSession(sessionId, s => ({ ...s, title: trimmed.slice(0, 120) }));
  void saveChatHistoryNow();
}

/// Toggle a session's pinned state. Pinned sessions surface in their own group
/// above the date groups in the sidebar.
export function toggleSessionPinned(sessionId: string) {
  replaceSession(sessionId, s => ({ ...s, isPinned: !s.isPinned }));
  void saveChatHistoryNow();
}

export function updateSessionFolder(sessionId: string, folderId: string | null) {
  replaceSession(sessionId, s => ({ ...s, folderId }));
  saveChatHistory();
}

// ============= Search =============

/// Find chats by title and by message text, across the main thread and every
/// branch. Pure: callers keep their own result state.
export function searchChatHistory(query: string, limit = 50): SearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const results: SearchResult[] = [];
  const scan = (session: ChatSession, branchId: string | null, messages: ChatMessage[]) => {
    for (const msg of messages) {
      if (results.length >= limit) return;
      const matchIndex = msg.content.toLowerCase().indexOf(needle);
      if (matchIndex !== -1) {
        results.push({
          sessionId: session.id,
          sessionTitle: session.title,
          branchId,
          messageId: msg.id,
          content: msg.content,
          matchIndex,
          kind: msg.role,
        });
      }
    }
  };

  for (const session of orderedSessions.value) {
    if (results.length >= limit) break;
    const titleIndex = session.title.toLowerCase().indexOf(needle);
    if (titleIndex !== -1) {
      results.push({
        sessionId: session.id,
        sessionTitle: session.title,
        branchId: null,
        messageId: null,
        content: session.title,
        matchIndex: titleIndex,
        kind: "title",
      });
    }
    scan(session, null, session.messages);
    for (const branch of session.branches) {
      // A branch starts as a copy of its parent; only report what's new in it.
      const copied = branch.forkIndex !== undefined
        ? branch.forkIndex + 1
        : Math.max(0, (session.branchMessages[branch.id] ?? []).findIndex(m => m.id === branch.fromMessageId) + 1);
      scan(session, branch.id, (session.branchMessages[branch.id] ?? []).slice(copied));
    }
  }
  return results;
}

/// Open the chat (and branch) a search result points at and scroll to the hit.
export function openSearchResult(result: SearchResult) {
  const session = chatHistory.value.find(s => s.id === result.sessionId);
  if (!session) return;
  if (result.messageId === null) {
    loadSession(session);
    return;
  }
  loadSession(session, result.branchId);
  pendingScrollMessageId.value = result.messageId;
}

// ============= Documents =============

let supportedExtensions: string[] | null = null;

/// File types the backend can read. The backend owns the list; it is fetched
/// once and used for both the file picker and drag-and-drop.
export async function getSupportedExtensions(): Promise<string[]> {
  if (supportedExtensions) return supportedExtensions;
  const result = await invoke<unknown>("get_supported_extensions");
  const list = Array.isArray(result) ? result.filter((e): e is string => typeof e === "string") : [];
  if (list.length > 0) supportedExtensions = list;
  return list;
}

function embeddingKey(): string {
  return providers.value.find(p => p.id === "gemini")?.apiKey ?? "";
}

export function hasEmbeddingKey(): boolean {
  return embeddingKey() !== "";
}

function documentRefs(docs: Document[]) {
  return docs.map(({ id, name, path }) => ({ id, name, path }));
}

/// Arguments describing the documents to attach to a chat request.
export function documentRequestArgs(): { documents: { id: string; name: string; path: string }[]; embeddingKey: string | null } {
  return {
    documents: docsEnabled.value ? documentRefs(documents.value) : [],
    embeddingKey: embeddingKey() || null,
  };
}

// Documents we've already tried to index automatically this session, so a
// document that fails to index isn't retried on every status refresh.
const autoIndexAttempted = new Set<string>();
let statusRequest = 0;

/// Ask the backend which documents are readable and indexed, and how they
/// will be sent to the model. Indexes anything not yet indexed when an
/// embedding key is available.
export async function refreshDocumentStatus(): Promise<void> {
  const docs = documents.value;
  const request = ++statusRequest;
  if (docs.length === 0) {
    documentStatus.value = EMPTY_DOCUMENT_STATUS;
    return;
  }
  documentStatus.value = { ...documentStatus.value, loading: true };
  try {
    const response = await invoke<DocumentsStatusResponse>("get_documents_status", {
      documents: documentRefs(docs),
      hasEmbeddingKey: hasEmbeddingKey(),
    });
    if (request !== statusRequest) return;
    const byId: Record<string, DocumentState> = {};
    for (const doc of response.documents) {
      byId[doc.id] = { chars: doc.chars, error: doc.error, indexedChunks: doc.indexedChunks };
    }
    documentStatus.value = {
      loading: false,
      byId,
      contextMode: response.contextMode,
      contextTokens: response.contextTokens,
    };

    if (hasEmbeddingKey()) {
      for (const doc of docs) {
        const state = byId[doc.id];
        if (state && state.chars > 0 && state.indexedChunks === 0 && !autoIndexAttempted.has(doc.id)) {
          autoIndexAttempted.add(doc.id);
          void indexDocument(doc);
        }
      }
    }
  } catch (e) {
    if (request !== statusRequest) return;
    console.error("Failed to load document status:", e);
    documentStatus.value = { ...EMPTY_DOCUMENT_STATUS };
  }
}

/// Index one document for semantic search. Resolves to whether it succeeded;
/// the failure reason is kept in `indexStates` for the UI.
async function indexDocument(doc: Document): Promise<boolean> {
  const apiKey = embeddingKey();
  if (!apiKey) return false;
  indexStates.value = { ...indexStates.value, [doc.id]: { state: "indexing" } };
  let ok = true;
  try {
    await invoke<number>("index_document", {
      documentId: doc.id,
      documentName: doc.name,
      filePath: doc.path,
      apiKey,
    });
    const { [doc.id]: _done, ...rest } = indexStates.value;
    indexStates.value = rest;
  } catch (e) {
    ok = false;
    indexStates.value = {
      ...indexStates.value,
      [doc.id]: { state: "failed", error: errorMessage(e, "Indexing failed") },
    };
  }
  void refreshDocumentStatus();
  return ok;
}

/// Re-index every readable document. Returns how many succeeded and failed.
export async function reindexAllDocuments(): Promise<{ indexed: number; failed: number }> {
  let indexed = 0;
  let failed = 0;
  for (const doc of documents.value) {
    if ((documentStatus.value.byId[doc.id]?.chars ?? 0) === 0) continue;
    autoIndexAttempted.add(doc.id);
    if (await indexDocument(doc)) indexed++;
    else failed++;
  }
  return { indexed, failed };
}

/// Add files as documents. Unsupported types and files already added are
/// skipped; the counts let the caller tell the user what happened.
export async function addDocumentPaths(paths: string[]): Promise<{ added: number; unsupported: number; duplicates: number }> {
  const allowed = await getSupportedExtensions();
  const next = [...documents.value];
  let added = 0;
  let unsupported = 0;
  let duplicates = 0;

  for (const path of paths) {
    const ext = fileExtension(path);
    if (!allowed.includes(ext)) {
      unsupported++;
    } else if (next.some(d => d.path === path)) {
      duplicates++;
    } else {
      next.push({
        id: crypto.randomUUID(),
        name: fileName(path),
        path,
        type: ext,
        addedAt: new Date().toISOString(),
      });
      added++;
    }
  }

  if (added > 0) {
    documents.value = next;
    saveDocuments();
    void refreshDocumentStatus();
  }
  return { added, unsupported, duplicates };
}

export function removeDocument(docId: string) {
  documents.value = documents.value.filter(d => d.id !== docId);
  autoIndexAttempted.delete(docId);
  const { [docId]: _removed, ...rest } = indexStates.value;
  indexStates.value = rest;
  saveDocuments();
  // Drop its vectors too, so a removed document can't be retrieved.
  invoke("remove_document_index", { documentId: docId }).catch((e) => {
    console.error("Failed to remove document from the index:", e);
  });
  void refreshDocumentStatus();
}

/// Put a removed document back (Undo). It is re-indexed on the next refresh.
export function restoreDocument(doc: Document, index: number) {
  if (documents.value.some(d => d.id === doc.id)) return;
  const next = [...documents.value];
  next.splice(Math.min(Math.max(index, 0), next.length), 0, doc);
  documents.value = next;
  saveDocuments();
  void refreshDocumentStatus();
}

// ============= Folders =============

export function addChatFolder(folder: ChatFolder) {
  chatFolders.value = [...chatFolders.value, folder];
  saveChatFolders();
}

export function updateChatFolder(folderId: string, updates: Partial<ChatFolder>) {
  chatFolders.value = chatFolders.value.map(f =>
    f.id === folderId ? { ...f, ...updates } : f
  );
  saveChatFolders();
}

export function deleteChatFolder(folderId: string) {
  // Move all sessions in this folder to uncategorized
  chatHistory.value = chatHistory.value.map(s =>
    s.folderId === folderId ? { ...s, folderId: null } : s
  );
  chatFolders.value = chatFolders.value.filter(f => f.id !== folderId);
  void saveChatHistoryNow();
  saveChatFolders();
}

export function toggleFolderCollapse(folderId: string) {
  chatFolders.value = chatFolders.value.map(f =>
    f.id === folderId ? { ...f, isCollapsed: !f.isCollapsed } : f
  );
  saveChatFolders();
}

// ============= Branches =============

const MAIN_THREAD = "main";

function threadKey(branchId: string | null): string {
  return branchId ?? MAIN_THREAD;
}

function threadMessages(session: ChatSession, branchId: string | null): ChatMessage[] {
  return branchId && session.branchMessages[branchId] ? session.branchMessages[branchId] : session.messages;
}

function createBranch(
  session: ChatSession,
  messageIndex: number,
  branch: Omit<Branch, "id" | "createdAt" | "fromMessageId">,
): string {
  const source = threadMessages(session, activeBranchId.value);
  const branchId = crypto.randomUUID();
  // Copy messages up to and including the branch point, with new ids.
  const branchedMessages = source.slice(0, messageIndex + 1).map(m => ({ ...m, id: crypto.randomUUID() }));

  replaceSession(session.id, s => ({
    ...s,
    branches: [
      ...s.branches,
      { ...branch, id: branchId, fromMessageId: source[messageIndex].id, createdAt: new Date().toISOString() },
    ],
    branchMessages: { ...s.branchMessages, [branchId]: branchedMessages },
    activeBranchId: branchId,
  }));

  currentMessages.value = branchedMessages;
  activeBranchId.value = branchId;
  bumpThread();
  void saveChatHistoryNow(); // Immediate save for branch creation
  return branchId;
}

function explicitBranchCount(session: ChatSession): number {
  return session.branches.filter(b => b.regenRoot === undefined).length;
}

/// Number of threads the user created on purpose (main + explicit branches).
export function visibleThreadCount(session: ChatSession): number {
  return explicitBranchCount(session) + 1;
}

/// Branch the active thread at a message and switch to the new branch.
export function branchFromMessage(sessionId: string, messageId: string): string | null {
  const session = chatHistory.value.find(s => s.id === sessionId);
  if (!session) return null;
  const index = threadMessages(session, activeBranchId.value).findIndex(m => m.id === messageId);
  if (index === -1) return null;
  return createBranch(session, index, { name: `Branch ${explicitBranchCount(session) + 1}` });
}

function regenerationRoot(session: ChatSession, forkIndex: number): string {
  const active = session.branches.find(b => b.id === activeBranchId.value);
  return active?.regenRoot !== undefined && active.forkIndex === forkIndex
    ? active.regenRoot
    : threadKey(activeBranchId.value);
}

/// Start an alternative version of the answer to a user message. The versions
/// of one answer are siblings the user steps through with arrows, rather than
/// a growing list of named branches.
export function createRegenerationBranch(sessionId: string, userMessageId: string): string | null {
  const session = chatHistory.value.find(s => s.id === sessionId);
  if (!session) return null;
  const forkIndex = threadMessages(session, activeBranchId.value).findIndex(m => m.id === userMessageId);
  if (forkIndex === -1) return null;
  const regenRoot = regenerationRoot(session, forkIndex);
  const version = session.branches.filter(b => b.regenRoot === regenRoot && b.forkIndex === forkIndex).length + 2;
  return createBranch(session, forkIndex, { name: `Version ${version}`, regenRoot, forkIndex });
}

/// The alternative versions of the assistant message at `messageIndex` in the
/// active thread, or null when it has only one.
export function getMessageVersions(messageIndex: number): { ids: (string | null)[]; current: number } | null {
  const session = chatHistory.value.find(s => s.id === activeSessionId.value);
  if (!session || messageIndex < 1) return null;
  const forkIndex = messageIndex - 1;
  const root = regenerationRoot(session, forkIndex);
  const siblings = session.branches.filter(b => b.regenRoot === root && b.forkIndex === forkIndex);
  if (siblings.length === 0) return null;
  const rootExists = root === MAIN_THREAD || session.branches.some(b => b.id === root);
  const ids: (string | null)[] = [
    ...(rootExists ? [root === MAIN_THREAD ? null : root] : []),
    ...siblings.map(b => b.id),
  ];
  if (ids.length < 2) return null;
  return { ids, current: Math.max(0, ids.indexOf(activeBranchId.value)) };
}

// Switch to a specific branch
export function switchToBranch(sessionId: string, branchId: string | null) {
  const session = chatHistory.value.find(s => s.id === sessionId);
  if (!session) return;
  if (branchId !== null && !session.branchMessages[branchId]) return;

  currentMessages.value = threadMessages(session, branchId);
  activeBranchId.value = branchId;
  bumpThread();
  replaceSession(sessionId, s => ({ ...s, activeBranchId: branchId }));
  saveChatHistory();
}

/// Threads shown in the branch selector: Main, branches the user created, and
/// the active thread if it is a regenerated version.
export function getBranchesForSession(sessionId: string): { id: string | null; name: string; isActive: boolean }[] {
  const session = chatHistory.value.find(s => s.id === sessionId);
  if (!session) return [];

  return [
    { id: null, name: "Main", isActive: activeBranchId.value === null },
    ...session.branches
      .filter(b => b.regenRoot === undefined || b.id === activeBranchId.value)
      .map(b => ({ id: b.id, name: b.name, isActive: activeBranchId.value === b.id })),
  ];
}

// Delete a branch
export function deleteBranch(sessionId: string, branchId: string) {
  const session = chatHistory.value.find(s => s.id === sessionId);
  if (!session) return;

  const { [branchId]: _removed, ...remainingBranchMessages } = session.branchMessages;
  replaceSession(sessionId, s => ({
    ...s,
    branches: s.branches.filter(b => b.id !== branchId),
    branchMessages: remainingBranchMessages,
    activeBranchId: s.activeBranchId === branchId ? null : s.activeBranchId,
  }));

  // If we deleted the active branch, switch to Main
  if (activeSessionId.value === sessionId && activeBranchId.value === branchId) {
    currentMessages.value = session.messages;
    activeBranchId.value = null;
    bumpThread();
  }

  void saveChatHistoryNow(); // Immediate for destructive action
}

// Rename a branch
export function renameBranch(sessionId: string, branchId: string, newName: string) {
  replaceSession(sessionId, s => ({
    ...s,
    branches: s.branches.map(b => (b.id === branchId ? { ...b, name: newName } : b)),
  }));
  saveChatHistory();
}

/// Put a sent user message back in the composer for revision. The original
/// turns are preserved: mid-conversation the edit continues on a new branch;
/// editing the very first message starts a new chat so the existing one is
/// left untouched. Returns false when the message isn't in the current thread.
export function editMessage(messageId: string): boolean {
  const index = currentMessages.value.findIndex(m => m.id === messageId);
  if (index === -1) return false;
  const text = currentMessages.value[index].content;

  if (index === 0 || !activeSessionId.value) {
    if (activeSessionId.value) startNewChat();
    else currentMessages.value = currentMessages.value.slice(0, index);
  } else {
    const branchId = branchFromMessage(activeSessionId.value, currentMessages.value[index - 1].id);
    if (!branchId) return false;
  }
  currentQuery.value = text;
  return true;
}

// ============= Export / Import =============

export function exportSession(session: ChatSession, format: 'json' | 'md', branchId: string | null): string {
  const messages = threadMessages(session, branchId);
  const branchName = branchId ? session.branches.find(b => b.id === branchId)?.name : undefined;
  const title = branchName ? `${session.title} (${branchName})` : session.title;

  if (format === 'json') {
    if (branchId) {
      return JSON.stringify({ id: session.id, title, messages, createdAt: session.createdAt }, null, 2);
    }
    return JSON.stringify(session, null, 2);
  }

  let md = `# ${title}\n\n`;
  md += `*Created: ${new Date(session.createdAt).toLocaleString()}*\n\n`;
  md += `---\n\n`;

  for (const msg of messages) {
    const roleLabel = msg.role === 'user' ? '**You**' : '**Assistant**';
    md += `${roleLabel}:\n\n${msg.content}\n\n---\n\n`;
  }

  return md;
}

/// Export every chat session in the current store. The output is a single
/// JSON envelope with version + exportedAt so we can read it back from a
/// future schema. Branches are preserved.
export function exportAllSessions(): string {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: chatHistory.value,
    folders: chatFolders.value,
  }, null, 2);
}

export type ImportResult =
  | { ok: true; sessions: number; skipped: number }
  | { ok: false; reason: string };

/// Import either a full backup ({ sessions, folders }) or a single exported
/// chat. Backups keep their ids so folder assignments survive and importing
/// the same backup twice doesn't duplicate chats; a single chat always gets a
/// new id.
export function importChats(jsonString: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch {
    return { ok: false, reason: "That isn't valid JSON." };
  }
  if (!isRecord(data)) return { ok: false, reason: "Unrecognised file format." };

  if (Array.isArray(data.sessions)) {
    if (Array.isArray(data.folders)) {
      const existing = new Set(chatFolders.value.map(f => f.id));
      const incoming = data.folders
        .map(sanitizeFolder)
        .filter((f): f is ChatFolder => f !== null && !existing.has(f.id));
      if (incoming.length > 0) {
        chatFolders.value = [...chatFolders.value, ...incoming];
        saveChatFolders();
      }
    }

    const existingIds = new Set(chatHistory.value.map(s => s.id));
    const restored: ChatSession[] = [];
    let skipped = 0;
    for (const raw of data.sessions) {
      const session = sanitizeSession(raw, true);
      if (!session || existingIds.has(session.id)) {
        skipped++;
        continue;
      }
      existingIds.add(session.id);
      restored.push(session);
    }
    if (restored.length > 0) {
      chatHistory.value = [...restored, ...chatHistory.value];
      void saveChatHistoryNow();
    }
    return { ok: true, sessions: restored.length, skipped };
  }

  const session = sanitizeSession(data, false);
  if (!session) return { ok: false, reason: "No chat found in that file. Expected a title and messages." };
  addChatSession({ ...session, folderId: null });
  return { ok: true, sessions: 1, skipped: 0 };
}

// ============= Reset =============

/// Wipe all locally-stored user data: chat history, folders, documents and
/// their search index, API keys (including the OS credential store), custom
/// models, system prompt, theme, onboarding state and the custom hotkey.
export async function resetAllData() {
  const providerIds = providers.value.map(p => p.id);
  cancelPendingSaves();

  // Clear in-memory state first so the UI updates instantly.
  chatHistory.value = [];
  chatFolders.value = [];
  documents.value = [];
  documentStatus.value = EMPTY_DOCUMENT_STATUS;
  indexStates.value = {};
  autoIndexAttempted.clear();
  customModels.value = {};
  fetchedModels.value = {};
  systemPrompt.value = "";
  activeSessionId.value = null;
  activeBranchId.value = null;
  currentMessages.value = [];
  currentQuery.value = "";
  docsEnabled.value = true;
  drafts.clear();
  bumpThread();
  providers.value = defaultProviders();
  activeProvider.value = DEFAULT_PROVIDER;
  activeModel.value = DEFAULT_MODEL;
  theme.value = "dark";
  applyThemeClasses("dark");
  persistedSessions.clear();
  persistedOrder = "";
  localStorage.removeItem("omnirecall_onboarding_complete");

  await sessionWrites;
  const s = await getStore();
  await s.clear();
  await s.save();

  if (credentialStoreAvailable) {
    await Promise.all(
      providerIds.map(id => invoke("set_api_key_secret", { provider: id, value: "" })),
    );
  }
  applyHotkeyStatus(await invoke<HotkeyStatus>("reset_backend_data"));
  isOnboardingActive.value = true;
}

// Stop generation: signal both frontend and backend to abort the in-flight stream.
export function stopGeneration() {
  const streamId = activeStreamId.value;
  if (!streamId) return;
  // The backend drops its HTTP connection and the pending send resolves as
  // "stopped", which is where the partial answer gets saved.
  invoke("stop_generation", { streamId }).catch(() => {});
}
