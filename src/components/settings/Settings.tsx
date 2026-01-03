import { useState } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import {
  isSettingsOpen,
  providers,
  updateProviderApiKey,
  setProviderConnected,
  theme,
  setTheme,
  activeProvider,
  activeModel,
  viewMode,
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

type SettingsTab = "providers" | "appearance" | "shortcuts";

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("providers");
  const isCompact = viewMode.value === "spotlight";

  const handleClose = () => {
    isSettingsOpen.value = false;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className={`relative w-full bg-bg-primary rounded-xl border border-border shadow-2xl overflow-hidden animate-fade-in ${isCompact ? "max-w-sm max-h-[90vh]" : "max-w-2xl max-h-[85vh]"
        }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-secondary">
          <h2 className={`font-semibold text-text-primary ${isCompact ? "text-sm" : "text-base"}`}>Settings</h2>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary">
            <CloseIcon size={16} />
          </button>
        </div>

        {isCompact ? (
          // Compact layout for Spotlight mode
          <div className="overflow-y-auto max-h-[calc(90vh-50px)]">
            {/* Tabs */}
            <div className="flex border-b border-border">
              {["providers", "appearance", "shortcuts"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as SettingsTab)}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${activeTab === tab
                    ? "text-accent-primary border-b-2 border-accent-primary"
                    : "text-text-secondary hover:text-text-primary"
                    }`}
                >
                  {tab === "providers" ? "AI" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <div className="p-3">
              {activeTab === "providers" && <ProvidersTabCompact />}
              {activeTab === "appearance" && <AppearanceTabCompact />}
              {activeTab === "shortcuts" && <ShortcutsTabCompact />}
            </div>
          </div>
        ) : (
          // Full layout for Dashboard mode
          <div className="flex h-[calc(85vh-50px)]">
            <div className="w-36 bg-bg-secondary border-r border-border p-2">
              <nav className="space-y-1">
                {[
                  { id: "providers", label: "AI Providers" },
                  { id: "appearance", label: "Appearance" },
                  { id: "shortcuts", label: "Shortcuts" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === tab.id
                      ? "bg-accent-primary/10 text-accent-primary"
                      : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === "providers" && <ProvidersTab />}
              {activeTab === "appearance" && <AppearanceTab />}
              {activeTab === "shortcuts" && <ShortcutsTab />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact versions for Spotlight mode
function ProvidersTabCompact() {
  return (
    <div className="space-y-3">
      {providers.value.map((provider) => (
        <ProviderCardCompact key={provider.id} provider={provider} />
      ))}
    </div>
  );
}

function ProviderCardCompact({ provider }: { provider: any }) {
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState(provider.apiKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(provider.isConnected ? "success" : null);
  const [testMessage, setTestMessage] = useState<string | null>(provider.isConnected ? "Connected" : null);

  const handleTest = async () => {
    if (!apiKey && provider.id !== "ollama") return;
    setTesting(true);
    setTestResult(null);
    setTestMessage(null);
    try {
      await invoke("test_api_key", { provider: provider.id, apiKey, baseUrl: provider.baseUrl });
      setTestResult("success");
      setTestMessage("✓ Connected!");
      setProviderConnected(provider.id, true);
      if (!providers.value.some(p => p.isConnected)) {
        activeProvider.value = provider.id;
        activeModel.value = provider.models[0];
      }
    } catch (err: any) {
      setTestResult("error");
      const msg = err?.message || err?.toString() || "Connection failed";
      if (msg.includes("InvalidApiKey")) {
        setTestMessage("Invalid API key");
      } else if (msg.includes("Network")) {
        setTestMessage("Network error");
      } else {
        setTestMessage("Failed to connect");
      }
      setProviderConnected(provider.id, false);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => updateProviderApiKey(provider.id, apiKey);

  const getUrl = () => {
    const urls: Record<string, string> = {
      gemini: "https://aistudio.google.com/apikey",
      openai: "https://platform.openai.com/api-keys",
      anthropic: "https://console.anthropic.com/",
      ollama: "https://ollama.ai",
    };
    return urls[provider.id];
  };

  return (
    <div className="p-2 bg-bg-secondary rounded-lg border border-border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-primary">{provider.name}</span>
          {provider.isConnected && <CheckIcon size={12} className="text-success" />}
        </div>
      </div>
      {provider.id !== "ollama" ? (
        <div className="space-y-1.5">
          <div className="flex gap-1">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
                onBlur={handleSave}
                placeholder="API key..."
                className="w-full px-2 py-1.5 pr-7 bg-bg-tertiary border border-border rounded text-text-primary text-xs outline-none focus:border-accent-primary"
              />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary">
                {showKey ? <EyeOffIcon size={12} /> : <EyeIcon size={12} />}
              </button>
            </div>
            <button
              onClick={handleTest}
              disabled={testing || !apiKey}
              className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all duration-200 min-w-[50px] ${testing ? "bg-bg-tertiary text-text-tertiary" :
                testResult === "success" ? "bg-success/20 text-success border border-success/30" :
                  testResult === "error" ? "bg-error/20 text-error border border-error/30" :
                    !apiKey ? "bg-bg-tertiary text-text-tertiary cursor-not-allowed" :
                      "bg-accent-primary text-white hover:bg-accent-primary/90"
                }`}
            >
              {testing ? <SpinnerIcon size={12} className="mx-auto animate-spin" /> :
                testResult === "success" ? "OK" :
                  testResult === "error" ? "!" : "Test"}
            </button>
          </div>
          {testMessage && (
            <p className={`text-xs ${testResult === "success" ? "text-success" : "text-error"}`}>
              {testMessage}
            </p>
          )}
          <a href={getUrl()} target="_blank" className="text-xs text-accent-primary hover:underline block">Get key →</a>
        </div>
      ) : (
        <div className="space-y-1.5">
          <button onClick={handleTest} disabled={testing} className={`w-full px-2 py-1.5 rounded text-xs font-medium transition-all ${testing ? "bg-bg-tertiary text-text-tertiary" :
            testResult === "success" ? "bg-success/20 text-success" :
              testResult === "error" ? "bg-error/20 text-error" :
                "bg-accent-primary text-white hover:bg-accent-primary/90"
            }`}>
            {testing ? "Testing..." : testResult === "success" ? "✓ Connected" : testResult === "error" ? "Connection Failed" : "Test Ollama"}
          </button>
          {testMessage && testResult === "error" && (
            <p className="text-xs text-error">{testMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}

function AppearanceTabCompact() {
  const themes = [
    { id: "dark" as const, label: "Dark" },
    { id: "light" as const, label: "Light" },
    { id: "transparent" as const, label: "Glass" },
  ];
  return (
    <div>
      <label className="text-xs font-medium text-text-primary mb-2 block">Theme</label>
      <div className="flex gap-2">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium ${theme.value === t.id ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border text-text-secondary"
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ShortcutsTabCompact() {
  const shortcuts = [
    { action: "Toggle", keys: "Alt+Space" },
    { action: "Settings", keys: "Ctrl+," },
    { action: "Hide", keys: "Esc" },
    { action: "Send", keys: "Enter" },
  ];
  return (
    <div className="space-y-1">
      {shortcuts.map((s) => (
        <div key={s.action} className="flex justify-between px-2 py-1.5 bg-bg-secondary rounded text-xs">
          <span className="text-text-primary">{s.action}</span>
          <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-secondary font-mono">{s.keys}</kbd>
        </div>
      ))}
    </div>
  );
}

// Full versions for Dashboard mode
function ProvidersTab() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium text-text-primary mb-1">AI Providers</h3>
        <p className="text-xs text-text-secondary">Add your API keys. Keys are stored locally.</p>
      </div>
      <div className="space-y-3">
        {providers.value.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: any }) {
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState(provider.apiKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(provider.isConnected ? "success" : null);
  const [testMessage, setTestMessage] = useState<string | null>(provider.isConnected ? "API key verified" : null);

  const handleTest = async () => {
    if (!apiKey && provider.id !== "ollama") return;
    setTesting(true);
    setTestResult(null);
    setTestMessage(null);
    try {
      await invoke("test_api_key", { provider: provider.id, apiKey, baseUrl: provider.baseUrl });
      setTestResult("success");
      setTestMessage("✓ Connection successful! API key is valid.");
      setProviderConnected(provider.id, true);
      if (!providers.value.some(p => p.isConnected)) {
        activeProvider.value = provider.id;
        activeModel.value = provider.models[0];
      }
    } catch (err: any) {
      setTestResult("error");
      const msg = err?.message || err?.toString() || "Connection failed";
      if (msg.includes("InvalidApiKey")) {
        setTestMessage("✗ Invalid API key. Please check and try again.");
      } else if (msg.includes("Network")) {
        setTestMessage("✗ Network error. Check your internet connection.");
      } else {
        setTestMessage("✗ Connection failed. Please verify your API key.");
      }
      setProviderConnected(provider.id, false);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => updateProviderApiKey(provider.id, apiKey);

  const getUrl = () => {
    const urls: Record<string, string> = {
      gemini: "https://aistudio.google.com/apikey",
      openai: "https://platform.openai.com/api-keys",
      anthropic: "https://console.anthropic.com/",
      ollama: "https://ollama.ai",
    };
    return urls[provider.id];
  };

  return (
    <div className={`p-3 bg-bg-secondary rounded-lg border transition-colors ${testResult === "success" ? "border-success/30" :
      testResult === "error" ? "border-error/30" : "border-border"
      }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <KeyIcon size={16} className="text-text-secondary" />
          <span className="text-sm font-medium text-text-primary">{provider.name}</span>
          {provider.isConnected && <CheckIcon size={14} className="text-success" />}
        </div>
      </div>
      {provider.id !== "ollama" ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
                onBlur={handleSave}
                placeholder="Enter API key..."
                className="w-full px-3 py-2 pr-9 bg-bg-tertiary border border-border rounded-lg text-text-primary text-sm outline-none focus:border-accent-primary transition-colors"
              />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors">
                {showKey ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
              </button>
            </div>
            <button
              onClick={handleTest}
              disabled={testing || !apiKey}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 min-w-[80px] flex items-center justify-center gap-2 ${testing ? "bg-bg-tertiary text-text-tertiary" :
                testResult === "success" ? "bg-success/20 text-success border border-success/30" :
                  testResult === "error" ? "bg-error/20 text-error border border-error/30" :
                    !apiKey ? "bg-bg-tertiary text-text-tertiary cursor-not-allowed" :
                      "bg-accent-primary text-white hover:bg-accent-primary/90"
                }`}
            >
              {testing ? (
                <>
                  <SpinnerIcon size={14} className="animate-spin" />
                  <span>Testing</span>
                </>
              ) : testResult === "success" ? (
                <>
                  <CheckIcon size={14} />
                  <span>Valid</span>
                </>
              ) : testResult === "error" ? (
                <>
                  <AlertIcon size={14} />
                  <span>Failed</span>
                </>
              ) : "Test"}
            </button>
          </div>
          {testMessage && (
            <p className={`text-xs px-1 ${testResult === "success" ? "text-success" : "text-error"}`}>
              {testMessage}
            </p>
          )}
          <a href={getUrl()} target="_blank" className="text-xs text-accent-primary hover:underline">Get your API key →</a>
        </div>
      ) : (
        <div className="space-y-2">
          <input type="text" defaultValue={provider.baseUrl} placeholder="http://localhost:11434"
            className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-text-primary text-sm outline-none focus:border-accent-primary transition-colors" />
          <button
            onClick={handleTest}
            disabled={testing}
            className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${testing ? "bg-bg-tertiary text-text-tertiary" :
              testResult === "success" ? "bg-success/20 text-success" :
                testResult === "error" ? "bg-error/20 text-error" :
                  "bg-accent-primary text-white hover:bg-accent-primary/90"
              }`}
          >
            {testing ? "Testing..." : testResult === "success" ? "✓ Connected" : testResult === "error" ? "Connection Failed" : "Test Connection"}
          </button>
          {testMessage && testResult === "error" && (
            <p className="text-xs text-error px-1">{testMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}

function AppearanceTab() {
  const themes = [
    { id: "dark" as const, label: "Dark", desc: "Easy on the eyes" },
    { id: "light" as const, label: "Light", desc: "Bright and clean" },
    { id: "transparent" as const, label: "Glass", desc: "Transparent blur" },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium text-text-primary mb-1">Appearance</h3>
        <p className="text-xs text-text-secondary">Customize how OmniRecall looks.</p>
      </div>
      <div>
        <label className="text-sm font-medium text-text-primary mb-2 block">Theme</label>
        <div className="grid grid-cols-3 gap-3">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`px-4 py-3 rounded-lg border text-sm font-medium flex flex-col items-center gap-1 transition-all ${theme.value === t.id ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border bg-bg-secondary text-text-secondary hover:border-text-tertiary"
                }`}
            >
              <span>{t.label}</span>
              <span className="text-xs opacity-60">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShortcutsTab() {
  const shortcuts = [
    { action: "Toggle Window", keys: "Alt + Space" },
    { action: "Open Settings", keys: "Ctrl + ," },
    { action: "Close/Hide", keys: "Escape" },
    { action: "Send Message", keys: "Enter" },
    { action: "New Line", keys: "Shift + Enter" },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium text-text-primary mb-1">Keyboard Shortcuts</h3>
        <p className="text-xs text-text-secondary">Quick access shortcuts.</p>
      </div>
      <div className="space-y-1">
        {shortcuts.map((s) => (
          <div key={s.action} className="flex justify-between px-3 py-2 bg-bg-secondary rounded-lg text-sm">
            <span className="text-text-primary">{s.action}</span>
            <kbd className="px-2 py-1 bg-bg-tertiary rounded text-xs text-text-secondary font-mono">{s.keys}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
