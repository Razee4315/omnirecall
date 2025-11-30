import { signal, computed } from "@preact/signals";

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

export interface Space {
  id: string;
  name: string;
  icon: string;
  color: string;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  sources?: { documentId: string; page: number; text: string }[];
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  spaceId: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  model: string;
}

export interface AppSettings {
  theme: Theme;
  hotkey: string;
  defaultProvider: string;
  defaultModel: string;
  maxContextChunks: number;
  showTokenCount: boolean;
}

// App State Signals
export const viewMode = signal<ViewMode>("spotlight");
export const theme = signal<Theme>("dark");
export const isLoading = signal(false);
export const clipboardText = signal<string | null>(null);
export const includeClipboard = signal(false);

// AI Provider State
export const providers = signal<AIProvider[]>([
  {
    id: "gemini",
    name: "Google Gemini",
    models: [
      "gemini-2.0-flash-exp",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro",
    ],
    apiKey: "",
    isConnected: false,
  },
  {
    id: "openai",
    name: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    apiKey: "",
    isConnected: false,
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    models: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ],
    apiKey: "",
    isConnected: false,
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    models: ["llama3.2", "llama3.1", "mistral", "codellama", "phi3"],
    apiKey: "",
    isConnected: false,
    baseUrl: "http://localhost:11434",
  },
]);

export const activeProvider = signal("gemini");
export const activeModel = signal("gemini-2.0-flash-exp");

// Spaces State
export const spaces = signal<Space[]>([
  {
    id: "default",
    name: "Quick Notes",
    icon: "N",
    color: "#4a9eff",
    documentCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]);

export const activeSpaceId = signal("default");
export const activeSpace = computed(() =>
  spaces.value.find((s) => s.id === activeSpaceId.value)
);

// Conversation State
export const conversations = signal<Conversation[]>([]);
export const activeConversationId = signal<string | null>(null);
export const activeConversation = computed(() =>
  conversations.value.find((c) => c.id === activeConversationId.value)
);

// Current query state
export const currentQuery = signal("");
export const isGenerating = signal(false);
export const streamingContent = signal("");

// Settings
export const settings = signal<AppSettings>({
  theme: "dark",
  hotkey: "Alt+Space",
  defaultProvider: "gemini",
  defaultModel: "gemini-2.0-flash-exp",
  maxContextChunks: 5,
  showTokenCount: true,
});

// Settings Modal State
export const isSettingsOpen = signal(false);

// Actions
export function setViewMode(mode: ViewMode) {
  viewMode.value = mode;
}

export function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
  document.documentElement.classList.toggle("dark", theme.value === "dark");
}

export function setActiveSpace(spaceId: string) {
  activeSpaceId.value = spaceId;
}

export function createSpace(name: string): Space {
  const newSpace: Space = {
    id: crypto.randomUUID(),
    name,
    icon: name.charAt(0).toUpperCase(),
    color: "#4a9eff",
    documentCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  spaces.value = [...spaces.value, newSpace];
  return newSpace;
}

export function setClipboardText(text: string | null) {
  clipboardText.value = text;
  includeClipboard.value = !!text;
}

export function updateProviderApiKey(providerId: string, apiKey: string) {
  providers.value = providers.value.map((p) =>
    p.id === providerId ? { ...p, apiKey } : p
  );
}

export function setProviderConnected(providerId: string, connected: boolean) {
  providers.value = providers.value.map((p) =>
    p.id === providerId ? { ...p, isConnected: connected } : p
  );
}

export function addMessage(conversationId: string, message: Message) {
  conversations.value = conversations.value.map((c) =>
    c.id === conversationId
      ? {
          ...c,
          messages: [...c.messages, message],
          updatedAt: new Date().toISOString(),
        }
      : c
  );
}

export function createConversation(spaceId: string): Conversation {
  const newConversation: Conversation = {
    id: crypto.randomUUID(),
    spaceId,
    title: "New Conversation",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    model: activeModel.value,
  };
  conversations.value = [...conversations.value, newConversation];
  activeConversationId.value = newConversation.id;
  return newConversation;
}
