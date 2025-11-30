import { useState } from "preact/hooks";
import {
  isSettingsOpen,
  providers,
  updateProviderApiKey,
  setProviderConnected,
  theme,
} from "../../stores/appStore";
import {
  CloseIcon,
  KeyIcon,
  CheckIcon,
  AlertIcon,
  EyeIcon,
  EyeOffIcon,
  SpinnerIcon,
} from "../icons";
import { clsx } from "clsx";

type SettingsTab = "providers" | "appearance" | "shortcuts" | "advanced";

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("providers");

  const handleClose = () => {
    isSettingsOpen.value = false;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-3xl max-h-[80vh] bg-bg-primary rounded-xl border border-border shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="flex h-[calc(80vh-73px)]">
          {/* Sidebar */}
          <div className="w-48 bg-bg-secondary border-r border-border p-3">
            <nav className="space-y-1">
              {[
                { id: "providers", label: "AI Providers" },
                { id: "appearance", label: "Appearance" },
                { id: "shortcuts", label: "Shortcuts" },
                { id: "advanced", label: "Advanced" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={clsx(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                    activeTab === tab.id
                      ? "bg-accent-primary/10 text-accent-primary"
                      : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "providers" && <ProvidersTab />}
            {activeTab === "appearance" && <AppearanceTab />}
            {activeTab === "shortcuts" && <ShortcutsTab />}
            {activeTab === "advanced" && <AdvancedTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProvidersTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-text-primary mb-1">
          AI Providers
        </h3>
        <p className="text-sm text-text-secondary">
          Configure your API keys for different AI providers. Your keys are
          stored securely on your device.
        </p>
      </div>

      <div className="space-y-4">
        {providers.value.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>

      <div className="pt-4 border-t border-border">
        <h4 className="text-sm font-medium text-text-primary mb-3">
          Embedding Provider
        </h4>
        <p className="text-xs text-text-secondary mb-3">
          Choose which provider to use for document embeddings. Changing this
          requires re-indexing all documents.
        </p>
        <select className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary text-sm outline-none focus:border-accent-primary">
          <option value="gemini">Google Gemini - text-embedding-004</option>
          <option value="openai">OpenAI - text-embedding-3-small</option>
          <option value="ollama">Ollama - nomic-embed-text</option>
        </select>
      </div>
    </div>
  );
}

interface ProviderCardProps {
  provider: {
    id: string;
    name: string;
    models: string[];
    apiKey: string;
    isConnected: boolean;
    baseUrl?: string;
  };
}

function ProviderCard({ provider }: ProviderCardProps) {
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState(provider.apiKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const getApiKeyUrl = () => {
    switch (provider.id) {
      case "gemini":
        return "https://aistudio.google.com/apikey";
      case "openai":
        return "https://platform.openai.com/api-keys";
      case "anthropic":
        return "https://console.anthropic.com/";
      case "ollama":
        return "https://ollama.ai";
      default:
        return null;
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    // Simulate API test
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const success = apiKey.length > 10 || provider.id === "ollama";
    setTestResult(success ? "success" : "error");
    setProviderConnected(provider.id, success);
    setTesting(false);
  };

  const handleSave = () => {
    updateProviderApiKey(provider.id, apiKey);
  };

  return (
    <div className="p-4 bg-bg-secondary rounded-xl border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center">
            <KeyIcon size={20} className="text-text-secondary" />
          </div>
          <div>
            <h4 className="font-medium text-text-primary">{provider.name}</h4>
            <div className="flex items-center gap-2 text-xs">
              {provider.isConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                  <span className="text-[#22c55e]">Connected</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-text-tertiary" />
                  <span className="text-text-tertiary">Not connected</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {provider.id !== "ollama" ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              API Key
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onInput={(e) =>
                    setApiKey((e.target as HTMLInputElement).value)
                  }
                  onBlur={handleSave}
                  placeholder="Enter your API key..."
                  className="w-full px-3 py-2 pr-10 bg-bg-tertiary border border-border rounded-lg text-text-primary text-sm outline-none focus:border-accent-primary"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary"
                >
                  {showKey ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              </div>
              <button
                onClick={handleTest}
                disabled={testing || !apiKey}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  testing || !apiKey
                    ? "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                    : "bg-accent-primary text-white hover:bg-accent-primary/90"
                )}
              >
                {testing ? (
                  <SpinnerIcon size={16} />
                ) : testResult === "success" ? (
                  <CheckIcon size={16} />
                ) : testResult === "error" ? (
                  <AlertIcon size={16} />
                ) : (
                  "Test"
                )}
              </button>
            </div>
            {testResult === "error" && (
              <p className="text-xs text-[#ef4444] mt-1">
                Invalid API key. Please check and try again.
              </p>
            )}
          </div>

          {getApiKeyUrl() && (
            <a
              href={getApiKeyUrl()!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent-primary hover:underline"
            >
              Get your API key here
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              Endpoint URL
            </label>
            <input
              type="text"
              value={provider.baseUrl}
              placeholder="http://localhost:11434"
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-text-primary text-sm outline-none focus:border-accent-primary"
            />
          </div>
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium hover:bg-accent-primary/90 transition-colors"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
          <p className="text-xs text-text-tertiary">
            Make sure Ollama is running locally. Download from{" "}
            <a
              href="https://ollama.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-primary hover:underline"
            >
              ollama.ai
            </a>
          </p>
        </div>
      )}

      {/* Model selector */}
      <div className="mt-4 pt-4 border-t border-border">
        <label className="block text-xs text-text-secondary mb-1.5">
          Default Model
        </label>
        <select className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-text-primary text-sm outline-none focus:border-accent-primary">
          {provider.models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function AppearanceTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-text-primary mb-1">
          Appearance
        </h3>
        <p className="text-sm text-text-secondary">
          Customize how OmniRecall looks.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-3">
            Theme
          </label>
          <div className="flex gap-3">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  if (t === "dark" || t === "light") {
                    theme.value = t;
                    document.documentElement.classList.toggle(
                      "dark",
                      t === "dark"
                    );
                  }
                }}
                className={clsx(
                  "flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-colors capitalize",
                  theme.value === t
                    ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                    : "border-border bg-bg-secondary text-text-secondary hover:border-text-tertiary"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-3">
            Font Size
          </label>
          <div className="flex gap-3">
            {["Small", "Medium", "Large"].map((size) => (
              <button
                key={size}
                className={clsx(
                  "flex-1 px-4 py-2 rounded-lg border text-sm transition-colors",
                  size === "Medium"
                    ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                    : "border-border bg-bg-secondary text-text-secondary hover:border-text-tertiary"
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-3">
            Accent Color
          </label>
          <div className="flex gap-2">
            {["#4a9eff", "#22c55e", "#7c3aed", "#f59e0b", "#ef4444"].map(
              (color) => (
                <button
                  key={color}
                  className={clsx(
                    "w-8 h-8 rounded-lg transition-transform hover:scale-110",
                    color === "#4a9eff" && "ring-2 ring-white ring-offset-2 ring-offset-bg-primary"
                  )}
                  style={{ backgroundColor: color }}
                />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutsTab() {
  const shortcuts = [
    { action: "Open Spotlight", keys: "Alt + Space", editable: true },
    { action: "Open Dashboard", keys: "Alt + Shift + S", editable: true },
    { action: "Open Settings", keys: "Ctrl + ,", editable: false },
    { action: "New Conversation", keys: "Ctrl + N", editable: false },
    { action: "New Space", keys: "Ctrl + Shift + N", editable: false },
    { action: "Toggle Sidebar", keys: "Ctrl + B", editable: false },
    { action: "Toggle Documents", keys: "Ctrl + D", editable: false },
    { action: "Send Message", keys: "Enter", editable: false },
    { action: "New Line", keys: "Shift + Enter", editable: false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-text-primary mb-1">
          Keyboard Shortcuts
        </h3>
        <p className="text-sm text-text-secondary">
          Customize keyboard shortcuts for quick access.
        </p>
      </div>

      <div className="space-y-2">
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.action}
            className="flex items-center justify-between px-4 py-3 bg-bg-secondary rounded-lg"
          >
            <span className="text-sm text-text-primary">{shortcut.action}</span>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-bg-tertiary rounded text-xs text-text-secondary font-mono">
                {shortcut.keys}
              </kbd>
              {shortcut.editable && (
                <button className="text-xs text-accent-primary hover:underline">
                  Change
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdvancedTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-text-primary mb-1">
          Advanced Settings
        </h3>
        <p className="text-sm text-text-secondary">
          Configure advanced options and RAG parameters.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Max Context Chunks
          </label>
          <p className="text-xs text-text-secondary mb-2">
            Number of document chunks to include in context (1-20)
          </p>
          <input
            type="number"
            min="1"
            max="20"
            defaultValue="5"
            className="w-24 px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary text-sm outline-none focus:border-accent-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Similarity Threshold
          </label>
          <p className="text-xs text-text-secondary mb-2">
            Minimum similarity score for retrieval (0.5-0.95)
          </p>
          <input
            type="range"
            min="50"
            max="95"
            defaultValue="70"
            className="w-full"
          />
          <div className="flex justify-between text-xs text-text-tertiary mt-1">
            <span>0.50 (More results)</span>
            <span>0.95 (Higher relevance)</span>
          </div>
        </div>

        <div className="flex items-center justify-between py-3">
          <div>
            <div className="text-sm font-medium text-text-primary">
              Show Token Count
            </div>
            <div className="text-xs text-text-secondary">
              Display token usage in responses
            </div>
          </div>
          <button className="w-12 h-6 rounded-full bg-accent-primary relative">
            <span className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white" />
          </button>
        </div>

        <div className="flex items-center justify-between py-3">
          <div>
            <div className="text-sm font-medium text-text-primary">
              Hybrid Search
            </div>
            <div className="text-xs text-text-secondary">
              Combine vector and keyword search
            </div>
          </div>
          <button className="w-12 h-6 rounded-full bg-bg-tertiary relative">
            <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-text-tertiary" />
          </button>
        </div>

        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-text-primary mb-3">
            Data Management
          </h4>
          <div className="space-y-2">
            <button className="w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-text-tertiary transition-colors text-left">
              Export All Data
            </button>
            <button className="w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-text-tertiary transition-colors text-left">
              Import Data
            </button>
            <button className="w-full px-4 py-2 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg text-sm text-[#ef4444] hover:bg-[#ef4444]/20 transition-colors text-left">
              Clear All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
