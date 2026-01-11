import { signal, computed } from "@preact/signals";
import { Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";

export type ViewMode = "spotlight" | "dashboard";
export type Theme = "dark" | "light" | "transparent";

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
  size: number;
  type: string;
  addedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  parentId?: string | null;
  branchIndex?: number;
  tokenCount?: number;
}

export interface Branch {
  id: string;
  name: string;
  fromMessageId: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  branches: Branch[];
  createdAt: string;
  folderId?: string | null;
  activeBranchId?: string | null;
}

export interface ChatFolder {
  id: string;
  name: string;
  color: string;
  icon?: string;
  createdAt: string;
  isCollapsed?: boolean;
}

export interface SearchResult {
  sessionId: string;
  sessionTitle: string;
  messageId: string;
  content: string;
  matchIndex: number;
  role: "user" | "assistant";
}

// App State Signals
export const viewMode = signal<ViewMode>("spotlight");
export const theme = signal<Theme>("dark");
export const isLoading = signal(false);
export const currentQuery = signal("");
export const isGenerating = signal(false);
export const isSettingsOpen = signal(false);
export const globalHotkey = signal<string>("Alt+Space");

// Command Palette State
export const isCommandPaletteOpen = signal(false);
export const commandPaletteQuery = signal("");

// Search State
export const searchQuery = signal("");
export const searchResults = signal<SearchResult[]>([]);
export const isSearching = signal(false);

// Model Comparison State
export const isCompareMode = signal(false);
export const compareModels = signal<{ provider: string; model: string }[]>([]);
export const compareResponses = signal<{ model: string; content: string; isLoading: boolean }[]>([]);

// Window State
export const isMaximized = signal(false);
export const isFullscreen = signal(false);

// AI Provider State
export const providers = signal<AIProvider[]>([
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
    models: [
      "glm-4.7",
      "glm-4.6",
      "glm-4.5",
      "glm-4.5-air",
      "glm-4.5-flash",
    ],
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
]);

export const activeProvider = signal("gemini");
export const activeModel = signal<string>("gemini-3-flash-preview");

// Documents State
export const documents = signal<Document[]>([]);

// Chat History State (persistent)
export const chatHistory = signal<ChatSession[]>([]);
export const currentMessages = signal<ChatMessage[]>([]);
export const activeSessionId = signal<string | null>(null);
export const activeBranchId = signal<string | null>(null);

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
    const folderId = session.folderId || null;
    const existing = folders.get(folderId) || [];
    existing.push(session);
    folders.set(folderId, existing);
  }

  return folders;
});

// Computed: Total token count for current session
export const currentSessionTokenCount = computed(() => {
  return currentMessages.value.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0);
});

// Store instance
let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load("omnirecall-data.json");
  }
  return store;
}

// Simple token estimation (4 chars ≈ 1 token for English text)
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// Search chat history
export function searchChatHistory(query: string): SearchResult[] {
  if (!query.trim()) {
    searchResults.value = [];
    return [];
  }

  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  for (const session of chatHistory.value) {
    for (const msg of session.messages) {
      const lowerContent = msg.content.toLowerCase();
      const matchIndex = lowerContent.indexOf(lowerQuery);
      if (matchIndex !== -1) {
        results.push({
          sessionId: session.id,
          sessionTitle: session.title,
          messageId: msg.id,
          content: msg.content,
          matchIndex,
          role: msg.role,
        });
      }
    }
  }

  searchResults.value = results;
  return results;
}

// Load data from persistent storage
export async function loadPersistedData() {
  try {
    const s = await getStore();

    // Load chat history
    const savedHistory = await s.get<ChatSession[]>("chatHistory");
    if (savedHistory) {
      // Migrate old sessions without branches/folders
      chatHistory.value = savedHistory.map(session => ({
        ...session,
        branches: session.branches || [],
        folderId: session.folderId || null,
      }));
    }

    // Load chat folders
    const savedFolders = await s.get<ChatFolder[]>("chatFolders");
    if (savedFolders) {
      chatFolders.value = savedFolders;
    }

    // Load API keys
    const savedProviders = await s.get<AIProvider[]>("providers");
    if (savedProviders) {
      // Merge saved API keys with current providers
      providers.value = providers.value.map(p => {
        const saved = savedProviders.find(sp => sp.id === p.id);
        return saved ? { ...p, apiKey: saved.apiKey, isConnected: saved.isConnected } : p;
      });
    }

    // Load theme
    const savedTheme = await s.get<Theme>("theme");
    if (savedTheme) {
      theme.value = savedTheme;
      applyThemeClasses(savedTheme);
    }

    // Load documents
    const savedDocs = await s.get<Document[]>("documents");
    if (savedDocs) {
      documents.value = savedDocs;
    }

    // Load current hotkey from backend
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const currentHotkey = await invoke<string>("get_current_hotkey");
      if (currentHotkey) {
        globalHotkey.value = currentHotkey;
      }
    } catch (e) {
      console.error("Failed to load hotkey:", e);
    }
  } catch (e) {
    console.error("Failed to load persisted data:", e);
  }
}

// Save chat history
export async function saveChatHistory() {
  try {
    const s = await getStore();
    await s.set("chatHistory", chatHistory.value);
    await s.save();
  } catch (e) {
    console.error("Failed to save chat history:", e);
  }
}

// Save chat folders
export async function saveChatFolders() {
  try {
    const s = await getStore();
    await s.set("chatFolders", chatFolders.value);
    await s.save();
  } catch (e) {
    console.error("Failed to save chat folders:", e);
  }
}

// Save providers (API keys)
export async function saveProviders() {
  try {
    const s = await getStore();
    await s.set("providers", providers.value);
    await s.save();
  } catch (e) {
    console.error("Failed to save providers:", e);
  }
}

// Save theme
export async function saveTheme() {
  try {
    const s = await getStore();
    await s.set("theme", theme.value);
    await s.save();
  } catch (e) {
    console.error("Failed to save theme:", e);
  }
}

// Save documents
export async function saveDocuments() {
  try {
    const s = await getStore();
    await s.set("documents", documents.value);
    await s.save();
  } catch (e) {
    console.error("Failed to save documents:", e);
  }
}

// Actions
export function updateProviderApiKey(providerId: string, apiKey: string) {
  providers.value = providers.value.map((p) =>
    p.id === providerId ? { ...p, apiKey } : p
  );
  saveProviders();
}

export function setProviderConnected(providerId: string, connected: boolean) {
  providers.value = providers.value.map((p) =>
    p.id === providerId ? { ...p, isConnected: connected } : p
  );
  saveProviders();
}

export function addChatSession(session: ChatSession) {
  chatHistory.value = [session, ...chatHistory.value];
  saveChatHistory();
}

export function updateChatSession(sessionId: string, messages: ChatMessage[]) {
  chatHistory.value = chatHistory.value.map(s =>
    s.id === sessionId ? { ...s, messages } : s
  );
  saveChatHistory();
}

export function deleteChatSession(sessionId: string) {
  chatHistory.value = chatHistory.value.filter(s => s.id !== sessionId);
  saveChatHistory();
}

export function updateSessionFolder(sessionId: string, folderId: string | null) {
  chatHistory.value = chatHistory.value.map(s =>
    s.id === sessionId ? { ...s, folderId } : s
  );
  saveChatHistory();
}

export function addDocument(doc: Document) {
  documents.value = [...documents.value, doc];
  saveDocuments();

  // Auto-index the document for semantic search (async, non-blocking)
  indexDocumentAsync(doc.id, doc.name, doc.path);
}

// Index a document for semantic search
export async function indexDocumentAsync(docId: string, docName: string, filePath: string) {
  const provider = providers.value.find(p => p.id === "gemini" && p.apiKey);
  if (!provider) return; // Skip if no Gemini API key for embeddings

  try {
    await invoke("index_document", {
      documentId: docId,
      documentName: docName,
      filePath: filePath,
      provider: "gemini",
      apiKey: provider.apiKey,
    });
  } catch (e) {
    console.error("Failed to index document:", e);
  }
}

// Get relevant context for a query using semantic search
export async function getSemanticContext(query: string): Promise<string> {
  const provider = providers.value.find(p => p.id === "gemini" && p.apiKey);
  if (!provider) return "";

  try {
    const context = await invoke<string>("get_relevant_context", {
      query,
      provider: "gemini",
      apiKey: provider.apiKey,
      maxTokens: 4000,
    });
    return context;
  } catch (e) {
    console.error("Failed to get semantic context:", e);
    return "";
  }
}

export function removeDocument(docId: string) {
  documents.value = documents.value.filter(d => d.id !== docId);
  saveDocuments();
}

// Folder Actions
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
  saveChatHistory();

  // Delete the folder
  chatFolders.value = chatFolders.value.filter(f => f.id !== folderId);
  saveChatFolders();
}

export function toggleFolderCollapse(folderId: string) {
  chatFolders.value = chatFolders.value.map(f =>
    f.id === folderId ? { ...f, isCollapsed: !f.isCollapsed } : f
  );
  saveChatFolders();
}

// Branching Actions
export function branchFromMessage(sessionId: string, messageId: string, branchName?: string) {
  const session = chatHistory.value.find(s => s.id === sessionId);
  if (!session) return null;

  const messageIndex = session.messages.findIndex(m => m.id === messageId);
  if (messageIndex === -1) return null;

  const branchId = crypto.randomUUID();
  const newBranch: Branch = {
    id: branchId,
    name: branchName || `Branch ${session.branches.length + 1}`,
    fromMessageId: messageId,
    createdAt: new Date().toISOString(),
  };

  // Copy messages up to and including the branch point
  const branchedMessages = session.messages.slice(0, messageIndex + 1).map(m => ({
    ...m,
    id: crypto.randomUUID(),
    branchIndex: session.branches.length,
  }));

  // Update the session with the new branch
  chatHistory.value = chatHistory.value.map(s => {
    if (s.id === sessionId) {
      return {
        ...s,
        branches: [...s.branches, newBranch],
        activeBranchId: branchId,
      };
    }
    return s;
  });

  // Set the branched messages as current
  currentMessages.value = branchedMessages;
  activeBranchId.value = branchId;
  saveChatHistory();

  return branchId;
}

// Export/Import Actions
export function exportSession(session: ChatSession, format: 'json' | 'md'): string {
  if (format === 'json') {
    return JSON.stringify(session, null, 2);
  }

  // Markdown format
  let md = `# ${session.title}\n\n`;
  md += `*Created: ${new Date(session.createdAt).toLocaleString()}*\n\n`;
  md += `---\n\n`;

  for (const msg of session.messages) {
    const roleLabel = msg.role === 'user' ? '**You**' : '**Assistant**';
    md += `${roleLabel}:\n\n${msg.content}\n\n---\n\n`;
  }

  return md;
}

export function importSession(jsonString: string): ChatSession | null {
  try {
    const data = JSON.parse(jsonString);
    if (data.id && data.title && Array.isArray(data.messages)) {
      const session: ChatSession = {
        id: crypto.randomUUID(), // Generate new ID to avoid conflicts
        title: data.title,
        messages: data.messages.map((m: any) => ({
          id: crypto.randomUUID(),
          role: m.role,
          content: m.content,
          tokenCount: estimateTokens(m.content),
        })),
        branches: [],
        createdAt: new Date().toISOString(),
        folderId: null,
      };
      addChatSession(session);
      return session;
    }
    return null;
  } catch (e) {
    console.error("Failed to import session:", e);
    return null;
  }
}

function applyThemeClasses(newTheme: Theme) {
  const html = document.documentElement;
  html.classList.remove("dark", "transparent");
  if (newTheme === "dark" || newTheme === "transparent") {
    html.classList.add("dark");
  }
  if (newTheme === "transparent") {
    html.classList.add("transparent");
  }
}

export function setTheme(newTheme: Theme) {
  theme.value = newTheme;
  applyThemeClasses(newTheme);
  saveTheme();
}

// Stop generation
export function stopGeneration() {
  isGenerating.value = false;
}
