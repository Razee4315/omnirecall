import { signal } from "@preact/signals";
import { Store } from "@tauri-apps/plugin-store";

export type ViewMode = "spotlight" | "dashboard";
export type Theme = "dark" | "light" | "system";

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
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

// App State Signals
export const viewMode = signal<ViewMode>("spotlight");
export const theme = signal<Theme>("dark");
export const isLoading = signal(false);
export const currentQuery = signal("");
export const isGenerating = signal(false);
export const isSettingsOpen = signal(false);

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
    id: "ollama",
    name: "Ollama (Local)",
    models: ["llama3.2", "mistral", "codellama"],
    apiKey: "",
    isConnected: false,
    baseUrl: "http://localhost:11434",
  },
]);

export const activeProvider = signal("gemini");
export const activeModel = signal("gemini-2.5-flash");

// Documents State
export const documents = signal<Document[]>([]);

// Chat History State (persistent)
export const chatHistory = signal<ChatSession[]>([]);
export const currentMessages = signal<ChatMessage[]>([]);
export const activeSessionId = signal<string | null>(null);

// Store instance
let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load("omnirecall-data.json");
  }
  return store;
}

// Load data from persistent storage
export async function loadPersistedData() {
  try {
    const s = await getStore();
    
    // Load chat history
    const savedHistory = await s.get<ChatSession[]>("chatHistory");
    if (savedHistory) {
      chatHistory.value = savedHistory;
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
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    }
    
    // Load documents
    const savedDocs = await s.get<Document[]>("documents");
    if (savedDocs) {
      documents.value = savedDocs;
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

export function addDocument(doc: Document) {
  documents.value = [...documents.value, doc];
  saveDocuments();
}

export function removeDocument(docId: string) {
  documents.value = documents.value.filter(d => d.id !== docId);
  saveDocuments();
}

export function setTheme(newTheme: Theme) {
  theme.value = newTheme;
  document.documentElement.classList.toggle("dark", newTheme === "dark");
  saveTheme();
}
