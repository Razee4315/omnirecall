import { useEffect, useRef, useState } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { disable as disableAutostart, enable as enableAutostart, isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";
import {
  AIProvider,
  chatHistory,
  exportDialog,
  formatHotkey,
  globalHotkey,
  holdWindowOpen,
  hotkeyError,
  isSettingsOpen,
  isShortcutsHelpOpen,
  MAX_SYSTEM_PROMPT_CHARS,
  providers,
  refreshHotkeyStatus,
  resetAllData,
  setSystemPrompt,
  setTheme,
  settingsTab,
  SettingsTab,
  systemPrompt,
  Theme,
  theme,
  updateProviderApiKey,
  updateProviderBaseUrl,
  verifyProvider,
  viewMode,
} from "../../stores/appStore";
import { confirmAction } from "../../stores/confirmStore";
import { toast } from "../../stores/toastStore";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { errorMessage } from "../../lib/errors";
import { AlertIcon, CheckIcon, CloseIcon, EyeIcon, EyeOffIcon, KeyIcon, SpinnerIcon } from "../icons";
import { exportAllChats } from "../common/ExportImport";
import { RagDebugPanel } from "../common/RagDebugPanel";
import { focusOnMount } from "../../lib/dom";

const TABS: { id: SettingsTab; label: string; shortLabel: string; dashboardOnly?: boolean }[] = [
  { id: "providers", label: "AI Providers", shortLabel: "AI" },
  { id: "appearance", label: "Appearance", shortLabel: "Theme" },
  { id: "behavior", label: "Behavior", shortLabel: "Behavior" },
  { id: "shortcuts", label: "Shortcuts", shortLabel: "Keys" },
  { id: "privacy", label: "Privacy & Data", shortLabel: "Data" },
  { id: "developer", label: "Developer", shortLabel: "Dev", dashboardOnly: true },
];

const THEMES: { id: Theme; label: string; desc: string; color: string }[] = [
  { id: "dark", label: "Dark", desc: "Easy on the eyes", color: "#0d0d0f" },
  { id: "light", label: "Light", desc: "Bright and clean", color: "#ffffff" },
  { id: "transparent", label: "Glass", desc: "Transparent blur", color: "#1a1a1f" },
  { id: "paper", label: "Paper", desc: "Warm cream tones", color: "#faf8f5" },
  { id: "rose", label: "Rose", desc: "Soft pink accent", color: "#f472b6" },
  { id: "ocean", label: "Ocean", desc: "Deep blue vibes", color: "#38bdf8" },
];

const PROVIDER_KEY_URLS: Record<string, string> = {
  gemini: "https://aistudio.google.com/apikey",
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/",
  glm: "https://api.z.ai/",
};

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
/// Typing pauses this long before the key is written to the credential store.
const KEY_SAVE_DELAY_MS = 600;

export function Settings() {
  const compact = viewMode.value === "spotlight";
  const dialogRef = useRef<HTMLDivElement>(null);
  // Escape is handled by the app-level handler, which knows the overlay order.
  useFocusTrap(dialogRef, true);

  // While Settings is open Spotlight must not hide on focus loss: the user
  // typically switches to a browser to copy an API key.
  useEffect(() => {
    holdWindowOpen("settings", true);
    return () => holdWindowOpen("settings", false);
  }, []);

  const tabs = TABS.filter(tab => !(compact && tab.dashboardOnly));
  const activeTab = tabs.some(tab => tab.id === settingsTab.value) ? settingsTab.value : "providers";
  const close = () => {
    isSettingsOpen.value = false;
  };

  const tabButtons = tabs.map((tab) => (
    <button
      key={tab.id}
      role="tab"
      id={`settings-tab-${tab.id}`}
      aria-selected={activeTab === tab.id}
      aria-controls="settings-panel"
      onClick={() => (settingsTab.value = tab.id)}
      className={
        compact
          ? `flex-1 min-w-[56px] px-2 py-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "text-accent-primary border-accent-primary"
                : "text-text-secondary border-transparent hover:text-text-primary"
            }`
          : `w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              activeTab === tab.id
                ? "bg-accent-primary/10 text-accent-primary"
                : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            }`
      }
    >
      {compact ? tab.shortLabel : tab.label}
    </button>
  ));

  const panel = (
    <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`} className={compact ? "p-3" : "flex-1 overflow-y-auto p-4"}>
      {activeTab === "providers" && <ProvidersTab compact={compact} />}
      {activeTab === "appearance" && <AppearanceTab compact={compact} />}
      {activeTab === "behavior" && <BehaviorTab compact={compact} />}
      {activeTab === "shortcuts" && <ShortcutsTab compact={compact} />}
      {activeTab === "privacy" && <PrivacyTab compact={compact} />}
      {activeTab === "developer" && <DeveloperTab />}
    </div>
  );

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 flex items-center justify-center p-2" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
      <div
        className={`relative w-full bg-bg-primary rounded-xl border border-border shadow-2xl overflow-hidden animate-fade-in ${
          compact ? "max-w-sm max-h-[90vh]" : "max-w-2xl max-h-[85vh]"
        }`}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-secondary">
          <h2 className={`font-semibold text-text-primary ${compact ? "text-sm" : "text-base"}`}>Settings</h2>
          <button
            onClick={close}
            className="p-1 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
            aria-label="Close settings"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {compact ? (
          <div className="overflow-y-auto max-h-[calc(90vh-50px)]">
            <div className="flex border-b border-border overflow-x-auto" role="tablist" aria-label="Settings sections">
              {tabButtons}
            </div>
            {panel}
          </div>
        ) : (
          <div className="flex h-[calc(85vh-50px)]">
            <div className="w-40 bg-bg-secondary border-r border-border p-2 space-y-1" role="tablist" aria-orientation="vertical" aria-label="Settings sections">
              {tabButtons}
            </div>
            {panel}
          </div>
        )}
      </div>
    </div>
  );
}

function TabHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-base font-medium text-text-primary mb-1">{title}</h3>
      <p className="text-xs text-text-secondary">{description}</p>
    </div>
  );
}

function ProvidersTab({ compact }: { compact: boolean }) {
  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {!compact && (
        <TabHeading
          title="AI Providers"
          description="Add a key for any provider you use. Keys stay on this device, in your operating system's credential manager."
        />
      )}
      <div className="space-y-3">
        {providers.value.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} compact={compact} />
        ))}
      </div>
    </div>
  );
}

type TestState = { status: "idle" } | { status: "testing" } | { status: "ok" } | { status: "error"; message: string };

function ProviderCard({ provider, compact }: { provider: AIProvider; compact: boolean }) {
  const isOllama = provider.id === "ollama";
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState(provider.apiKey);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl ?? "");
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const pendingKey = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow external changes to the stored key (import, Reset all data).
  useEffect(() => {
    if (pendingKey.current === null) setApiKey(provider.apiKey);
  }, [provider.apiKey]);
  useEffect(() => setBaseUrl(provider.baseUrl ?? ""), [provider.baseUrl]);

  const flushKey = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (pendingKey.current !== null) {
      updateProviderApiKey(provider.id, pendingKey.current);
      pendingKey.current = null;
    }
  };

  // The key is saved as it is typed (after a short pause) and when the card
  // goes away, so closing Settings with Escape never discards it.
  useEffect(() => flushKey, []);

  const handleKeyInput = (value: string) => {
    setApiKey(value);
    setTest({ status: "idle" });
    pendingKey.current = value.trim();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushKey, KEY_SAVE_DELAY_MS);
  };

  const saveBaseUrl = () => {
    const trimmed = baseUrl.trim();
    if (trimmed !== (provider.baseUrl ?? "")) updateProviderBaseUrl(provider.id, trimmed);
  };

  const handleTest = async () => {
    const key = apiKey.trim();
    if (!key && !isOllama) return;
    flushKey();
    if (isOllama) saveBaseUrl();
    setTest({ status: "testing" });
    try {
      await verifyProvider(provider.id, key, isOllama ? baseUrl.trim() || DEFAULT_OLLAMA_URL : undefined);
      setTest({ status: "ok" });
    } catch (err) {
      setTest({ status: "error", message: errorMessage(err, "Connection failed") });
    }
  };

  const connected = provider.isConnected && test.status !== "error" && test.status !== "testing";
  const inputClass = `w-full bg-bg-tertiary border border-border text-text-primary outline-none focus:border-accent-primary transition-colors ${
    compact ? "px-2 py-1.5 rounded text-xs" : "px-3 py-2 rounded-lg text-sm"
  }`;
  const testClass = `rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 flex-shrink-0 ${
    compact ? "px-2.5 py-1.5 text-xs min-w-[56px]" : "px-4 py-2 text-sm min-w-[88px]"
  } ${
    test.status === "testing"
      ? "bg-bg-tertiary text-text-tertiary"
      : test.status === "error"
      ? "bg-error/20 text-error border border-error/30"
      : connected
      ? "bg-success/20 text-success border border-success/30"
      : !apiKey.trim() && !isOllama
      ? "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
      : "bg-accent-primary text-on-accent hover:bg-accent-primary/90"
  }`;
  const testLabel =
    test.status === "testing" ? "Testing" : test.status === "error" ? "Retry" : connected ? "Verified" : isOllama ? "Test connection" : "Test";

  return (
    <div
      className={`bg-bg-secondary rounded-lg border transition-colors ${compact ? "p-2" : "p-3"} ${
        test.status === "error" ? "border-error/30" : connected ? "border-success/30" : "border-border"
      }`}
    >
      <div className={`flex items-center gap-2 ${compact ? "mb-2" : "mb-3"}`}>
        {!compact && <KeyIcon size={16} className="text-text-secondary" />}
        <span className={`font-medium text-text-primary ${compact ? "text-xs" : "text-sm"}`}>{provider.name}</span>
        {connected && (
          <span className="flex items-center gap-1 text-[10px] text-success">
            <CheckIcon size={12} /> Connected
          </span>
        )}
      </div>

      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        <div className="flex gap-2">
          {isOllama ? (
            <input
              type="url"
              value={baseUrl}
              onInput={(e) => {
                setBaseUrl((e.target as HTMLInputElement).value);
                setTest({ status: "idle" });
              }}
              onBlur={saveBaseUrl}
              placeholder={DEFAULT_OLLAMA_URL}
              aria-label="Ollama server URL"
              className={inputClass}
            />
          ) : (
            <div className="relative flex-1 min-w-0">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onInput={(e) => handleKeyInput((e.target as HTMLInputElement).value)}
                onBlur={flushKey}
                placeholder="Enter API key..."
                aria-label={`${provider.name} API key`}
                autocomplete="off"
                spellcheck={false}
                className={`${inputClass} pr-9`}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary transition-colors"
                aria-label={showKey ? "Hide API key" : "Show API key"}
                aria-pressed={showKey}
              >
                {showKey ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
              </button>
            </div>
          )}
          <button
            onClick={() => void handleTest()}
            disabled={test.status === "testing" || (!apiKey.trim() && !isOllama)}
            className={testClass}
          >
            {test.status === "testing" && <SpinnerIcon size={12} />}
            {test.status === "error" && <AlertIcon size={12} />}
            {connected && <CheckIcon size={12} />}
            <span>{testLabel}</span>
          </button>
        </div>

        <div aria-live="polite">
          {test.status === "error" && <p className="selectable text-xs text-error">{test.message}</p>}
          {test.status === "ok" && <p className="text-xs text-success">Connected. The model list was updated from your account.</p>}
        </div>

        {isOllama ? (
          <p className="text-xs text-text-tertiary">Runs models on your own machine; no key needed. Chats use this address too.</p>
        ) : (
          <a
            href={PROVIDER_KEY_URLS[provider.id]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent-primary hover:underline inline-block"
          >
            Get your API key →
          </a>
        )}
      </div>
    </div>
  );
}

function AppearanceTab({ compact }: { compact: boolean }) {
  return (
    <div className="space-y-4">
      {!compact && <TabHeading title="Appearance" description="Customize how OmniRecall looks." />}
      <div>
        <div className={`font-medium text-text-primary mb-2 ${compact ? "text-xs" : "text-sm"}`} id="theme-label">Theme</div>
        <div className={`grid grid-cols-3 ${compact ? "gap-2" : "gap-3"}`} role="radiogroup" aria-labelledby="theme-label">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={theme.value === t.id}
              onClick={() => setTheme(t.id)}
              className={`rounded-lg border font-medium flex flex-col items-center transition-colors ${
                compact ? "px-2 py-2 text-xs gap-1" : "px-4 py-3 text-sm gap-2"
              } ${
                theme.value === t.id
                  ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                  : "border-border bg-bg-secondary text-text-secondary hover:border-text-tertiary"
              }`}
            >
              <span className={`rounded-full border border-border ${compact ? "w-4 h-4" : "w-6 h-6"}`} style={{ background: t.color }} />
              <span>{t.label}</span>
              {!compact && <span className="text-xs opacity-70 font-normal">{t.desc}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const MODIFIER_CODES = ["ControlLeft", "ControlRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight", "MetaLeft", "MetaRight"];

/// Build a shortcut string for the backend from a key event. The physical
/// key code is used rather than the produced character, so Shift+2 records
/// as "Shift+Digit2" (not "@") and works on any keyboard layout.
export function shortcutFromEvent(e: Pick<KeyboardEvent, "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">): string | null {
  if (!e.code || MODIFIER_CODES.includes(e.code)) return null;
  const modifiers: string[] = [];
  if (e.ctrlKey) modifiers.push("Ctrl");
  if (e.altKey) modifiers.push("Alt");
  if (e.shiftKey) modifiers.push("Shift");
  if (e.metaKey) modifiers.push("Super");
  // A global shortcut without a modifier would swallow ordinary typing.
  if (modifiers.length === 0) return null;
  return [...modifiers, e.code].join("+");
}

function ShortcutsTab({ compact }: { compact: boolean }) {
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef(false);

  // The current global shortcut is released while recording so pressing it
  // is captured here instead of toggling the window.
  const setPaused = (paused: boolean) => {
    recordingRef.current = paused;
    invoke("set_hotkey_paused", { paused }).catch(() => {});
  };

  useEffect(
    () => () => {
      if (recordingRef.current) setPaused(false);
    },
    [],
  );

  const startRecording = () => {
    setRecorded("");
    setError(null);
    setRecording(true);
    setPaused(true);
  };

  const cancelRecording = () => {
    setRecording(false);
    setRecorded("");
    if (recordingRef.current) setPaused(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      cancelRecording();
      return;
    }
    const shortcut = shortcutFromEvent(e);
    if (shortcut) setRecorded(shortcut);
  };

  const handleSave = async () => {
    if (!recorded) return;
    setSaving(true);
    setError(null);
    try {
      await invoke<string>("update_hotkey", { newHotkey: recorded });
      // update_hotkey leaves the shortcut registered, so nothing to resume.
      recordingRef.current = false;
      await refreshHotkeyStatus();
      setRecording(false);
      setRecorded("");
      toast.success(`Shortcut updated. Press ${formatHotkey(recorded)} to show or hide OmniRecall.`);
    } catch (err) {
      recordingRef.current = false;
      await refreshHotkeyStatus();
      const message = errorMessage(err, "Failed to save the shortcut");
      setError(
        message.includes("Invalid")
          ? "That key combination isn't supported. Try another."
          : "That shortcut couldn't be registered — another app may be using it. Your previous shortcut is still active.",
      );
    } finally {
      setSaving(false);
    }
  };

  const text = compact ? "text-xs" : "text-sm";

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {!compact && <TabHeading title="Keyboard Shortcuts" description="Change the global shortcut that shows and hides OmniRecall." />}

      {hotkeyError.value && !recording && (
        <div className="flex items-start gap-2 p-2.5 bg-warning/10 border border-warning/30 rounded-lg text-xs text-warning" role="alert">
          <AlertIcon size={14} className="flex-shrink-0 mt-0.5" />
          <span>{hotkeyError.value}</span>
        </div>
      )}

      <div className={`bg-bg-secondary rounded-lg border transition-colors px-3 py-2 ${recording ? "border-accent-primary" : "border-border"}`}>
        <div className="flex justify-between items-center gap-2">
          <div className="min-w-0">
            <div className={`text-text-primary font-medium ${text}`}>Show / hide window</div>
            <p className="text-xs text-text-tertiary">
              {recording ? "Press the new shortcut (Esc to cancel)" : "Works from any app"}
            </p>
          </div>
          {recording ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <input
                type="text"
                readOnly
                ref={focusOnMount}
                value={recorded ? formatHotkey(recorded) : ""}
                placeholder="…"
                onKeyDown={handleKeyDown}
                aria-label="Press the new shortcut"
                className="w-32 px-2 py-1.5 bg-accent-primary/10 border border-accent-primary rounded-lg text-xs text-accent-primary font-mono text-center outline-none"
              />
              <button
                onClick={() => void handleSave()}
                disabled={!recorded || saving}
                className="px-2.5 py-1.5 bg-success/20 text-success rounded-lg text-xs font-medium disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={cancelRecording} className="px-2.5 py-1.5 bg-bg-tertiary text-text-secondary rounded-lg text-xs font-medium">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={startRecording}
              className="flex-shrink-0 px-3 py-1.5 bg-bg-tertiary hover:bg-accent-primary/10 rounded-lg text-xs text-text-secondary font-mono transition-colors border border-border hover:border-accent-primary"
              aria-label={`Global shortcut ${formatHotkey(globalHotkey.value)}. Change`}
            >
              {formatHotkey(globalHotkey.value)}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-error mt-1.5" role="alert">{error}</p>}
      </div>

      <button
        onClick={() => {
          isSettingsOpen.value = false;
          isShortcutsHelpOpen.value = true;
        }}
        className={`w-full px-3 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-tertiary transition-colors ${text}`}
      >
        View all keyboard shortcuts
      </button>
    </div>
  );
}

function DeveloperTab() {
  return (
    <div className="space-y-4">
      <TabHeading title="Developer Tools" description="Inspect the document search index." />
      <RagDebugPanel />
    </div>
  );
}

/// Launch-at-login switch. The OS setting is the source of truth, so the
/// state is read from it rather than stored.
function LaunchAtLogin({ compact }: { compact: boolean }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isAutostartEnabled()
      .then(setEnabled)
      .catch(() => setEnabled(null));
  }, []);

  const toggle = async () => {
    if (enabled === null) return;
    setBusy(true);
    try {
      if (enabled) await disableAutostart();
      else await enableAutostart();
      setEnabled(!enabled);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't change the startup setting"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-bg-secondary">
      <div className="min-w-0">
        <div className={`font-medium text-text-primary ${compact ? "text-xs" : "text-sm"}`} id="autostart-label">Launch at login</div>
        <p className={`text-text-tertiary mt-0.5 ${compact ? "text-[10px]" : "text-xs"}`}>
          Start in the tray when you sign in, so the shortcut is always ready.
        </p>
      </div>
      <button
        role="switch"
        aria-checked={enabled === true}
        aria-labelledby="autostart-label"
        disabled={enabled === null || busy}
        onClick={() => void toggle()}
        className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${
          enabled ? "bg-accent-primary" : "bg-bg-tertiary border border-border"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-4" : ""
          }`}
        />
      </button>
    </div>
  );
}

/// Behavior tab: startup and the persistent system prompt. The text area is
/// bounded to MAX_SYSTEM_PROMPT_CHARS at the store level — the visible
/// counter exists so users see how much budget they have.
function BehaviorTab({ compact }: { compact: boolean }) {
  const [draft, setDraft] = useState(systemPrompt.value);
  const [saved, setSaved] = useState(false);

  // Re-sync when the underlying signal changes externally (/system, Reset).
  useEffect(() => setDraft(systemPrompt.value), [systemPrompt.value]);

  const handleSave = () => {
    setSystemPrompt(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isDirty = draft !== systemPrompt.value;
  const tooLong = draft.length > MAX_SYSTEM_PROMPT_CHARS;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {!compact && <TabHeading title="Behavior" description="How OmniRecall starts and how it talks to you." />}

      <LaunchAtLogin compact={compact} />

      <div>
        <label htmlFor="system-prompt" className={`block font-medium text-text-primary mb-1.5 ${compact ? "text-xs" : "text-sm"}`}>
          System prompt
        </label>
        <p className={`text-text-tertiary mb-2 ${compact ? "text-[10px]" : "text-xs"}`}>
          Sets persona, tone, or context. Sent with every message, in every chat.
        </p>
        <textarea
          id="system-prompt"
          value={draft}
          onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
          placeholder="e.g. You are a senior software engineer. Be concise and direct. Prefer code examples."
          rows={compact ? 4 : 6}
          maxLength={MAX_SYSTEM_PROMPT_CHARS + 100}
          aria-invalid={tooLong}
          className={`w-full px-3 py-2 bg-bg-tertiary border rounded-lg text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-primary transition-colors resize-y leading-relaxed ${
            compact ? "text-xs" : "text-sm"
          } ${tooLong ? "border-error" : "border-border"}`}
        />
        <div className={`flex items-center justify-between mt-1.5 ${compact ? "text-[10px]" : "text-xs"}`}>
          <span className={tooLong ? "text-error" : "text-text-tertiary"}>
            {draft.length.toLocaleString()} / {MAX_SYSTEM_PROMPT_CHARS.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            {saved && <span className="text-success" role="status">Saved</span>}
            {isDirty && (
              <button
                onClick={() => setDraft(systemPrompt.value)}
                className="px-2 py-1 rounded bg-bg-tertiary text-text-secondary hover:text-text-primary"
              >
                Discard
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty || tooLong}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                !isDirty || tooLong
                  ? "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                  : "bg-accent-primary text-on-accent hover:bg-accent-primary/90"
              }`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/// Privacy tab: back up, restore, and erase local data.
function PrivacyTab({ compact }: { compact: boolean }) {
  const [resetting, setResetting] = useState(false);
  const chatCount = chatHistory.value.length;
  const title = `font-medium text-text-primary ${compact ? "text-xs" : "text-sm"}`;
  const note = `text-text-tertiary mt-0.5 ${compact ? "text-[10px]" : "text-xs"}`;
  const button = `mt-2 w-full px-3 rounded-lg font-medium transition-colors ${compact ? "text-xs py-1.5" : "text-sm py-2"}`;

  const handleReset = async () => {
    const confirmed = await confirmAction({
      title: "Erase all OmniRecall data?",
      message:
        "This permanently deletes every chat, folder, attached document and its search index, API key, custom model, and setting on this device. It cannot be undone.",
      confirmLabel: "Erase everything",
      danger: true,
    });
    if (!confirmed) return;
    setResetting(true);
    try {
      await resetAllData();
      toast.success("All local data cleared");
      isSettingsOpen.value = false;
    } catch (err) {
      toast.error(errorMessage(err, "Failed to clear data"));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {!compact && (
        <TabHeading
          title="Privacy & Data"
          description="Chats, documents and settings are stored on this device only. Messages are sent to the AI provider you choose."
        />
      )}

      <div className="p-3 rounded-lg border border-border bg-bg-secondary">
        <div className={title}>Back up chats</div>
        <p className={note}>One JSON file with all chats, branches, and folders.</p>
        <button
          onClick={() => void exportAllChats()}
          disabled={chatCount === 0}
          className={`${button} ${
            chatCount === 0
              ? "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
              : "bg-accent-primary text-on-accent hover:bg-accent-primary/90"
          }`}
        >
          {chatCount === 0 ? "No chats to export" : `Export ${chatCount} chat${chatCount === 1 ? "" : "s"}`}
        </button>
      </div>

      <div className="p-3 rounded-lg border border-border bg-bg-secondary">
        <div className={title}>Restore from a backup</div>
        <p className={note}>Adds the chats from a backup file. Chats you already have are kept.</p>
        <button
          onClick={() => {
            isSettingsOpen.value = false;
            exportDialog.value = "import";
          }}
          className={`${button} border border-border text-text-secondary hover:bg-bg-tertiary`}
        >
          Import chats…
        </button>
      </div>

      <div className="p-3 rounded-lg border border-error/30 bg-error/5">
        <div className={title}>Reset all data</div>
        <p className={note}>
          Deletes all chats, folders, documents and their search index, API keys, custom models and settings from this device.
        </p>
        <button
          onClick={() => void handleReset()}
          disabled={resetting}
          className={`${button} bg-error/10 text-error border border-error/30 hover:bg-error/20 disabled:opacity-60`}
        >
          {resetting ? "Clearing…" : "Reset all data…"}
        </button>
      </div>
    </div>
  );
}
