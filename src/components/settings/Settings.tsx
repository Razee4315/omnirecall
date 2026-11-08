import { ComponentChild } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { disable as disableAutostart, enable as enableAutostart, isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";
import {
  AIProvider,
  chatHistory,
  exportDialog,
  formatHotkey,
  getProviderModels,
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
import { providerMeta } from "../../lib/models";
import {
  AlertIcon,
  CheckIcon,
  CloseIcon,
  CodeIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  KeyboardIcon,
  KeyIcon,
  PaletteIcon,
  ShieldIcon,
  SlidersIcon,
  SpinnerIcon,
  TrashIcon,
  UploadIcon,
} from "../icons";
import { exportAllChats } from "../common/ExportImport";
import { ProviderTile } from "../common/ProviderTile";
import { RagDebugPanel } from "../common/RagDebugPanel";
import { focusOnMount } from "../../lib/dom";

const TABS: { id: SettingsTab; label: string; description: string; icon: ComponentChild; dashboardOnly?: boolean }[] = [
  { id: "providers", label: "AI providers", description: "Keys stay on this device, in your operating system's credential manager.", icon: <KeyIcon size={15} /> },
  { id: "appearance", label: "Appearance", description: "Pick the look that suits your desk.", icon: <PaletteIcon size={15} /> },
  { id: "behavior", label: "Behavior", description: "How OmniRecall starts and how it talks to you.", icon: <SlidersIcon size={15} /> },
  { id: "shortcuts", label: "Shortcuts", description: "The global shortcut that shows and hides OmniRecall.", icon: <KeyboardIcon size={15} /> },
  { id: "privacy", label: "Privacy & data", description: "Everything is stored locally. Messages go only to the provider you choose.", icon: <ShieldIcon size={15} /> },
  { id: "developer", label: "Developer", description: "Inspect the document search index.", icon: <CodeIcon size={15} />, dashboardOnly: true },
];

interface ThemePreview {
  bg: string;
  surface: string;
  bubble: string;
  accent: string;
  line: string;
  fg: string;
}

const THEMES: { id: Theme; label: string; desc: string; preview: ThemePreview }[] = [
  { id: "dark", label: "Graphite", desc: "Quiet near-black", preview: { bg: "#0c0c0e", surface: "#131316", bubble: "#1b1b1f", accent: "#9391ff", line: "#ffffff14", fg: "#ededef" } },
  { id: "light", label: "Porcelain", desc: "Crisp and bright", preview: { bg: "#f8f8f7", surface: "#ffffff", bubble: "#f1f1ef", accent: "#4f46e5", line: "#18181b17", fg: "#18181b" } },
  { id: "transparent", label: "Glass", desc: "See-through panels", preview: { bg: "linear-gradient(135deg,#3b2f6b,#123d4a)", surface: "#1a1a20aa", bubble: "#ffffff18", accent: "#a9b6ff", line: "#ffffff22", fg: "#f4f4f5" } },
  { id: "paper", label: "Paper", desc: "Warm and editorial", preview: { bg: "#f6f2eb", surface: "#fbf8f3", bubble: "#eee8de", accent: "#b14f27", line: "#402a121f", fg: "#211c16" } },
  { id: "rose", label: "Dusk", desc: "Plum night, rose light", preview: { bg: "#130f16", surface: "#1a151e", bubble: "#231d28", accent: "#f5a8c8", line: "#ffe1ff14", fg: "#f6eff7" } },
  { id: "ocean", label: "Tide", desc: "Deep sea, aqua glow", preview: { bg: "#091018", surface: "#0e1720", bubble: "#14202b", accent: "#5eead4", line: "#a5dcff14", fg: "#e7f0f5" } },
];

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
  const active = tabs.find(tab => tab.id === activeTab)!;
  const close = () => {
    isSettingsOpen.value = false;
  };

  const panel = (
    <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`} className="animate-fade" key={activeTab}>
      {activeTab === "providers" && <ProvidersTab />}
      {activeTab === "appearance" && <AppearanceTab compact={compact} />}
      {activeTab === "behavior" && <BehaviorTab />}
      {activeTab === "shortcuts" && <ShortcutsTab />}
      {activeTab === "privacy" && <PrivacyTab />}
      {activeTab === "developer" && <RagDebugPanel />}
    </div>
  );

  if (compact) {
    return (
      <div ref={dialogRef} className="fixed inset-0 z-50 p-2" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="scrim absolute inset-2 rounded-[18px]" onClick={close} />
        <div className="relative h-full flex flex-col bg-overlay rounded-[18px] border border-line-strong shadow-pop overflow-hidden animate-pop-in">
          <div className="flex items-center justify-between h-12 pl-4 pr-2 flex-shrink-0">
            <h2 className="text-[15px] font-semibold">Settings</h2>
            <button onClick={close} className="icon-btn" aria-label="Close settings">
              <CloseIcon size={16} />
            </button>
          </div>
          <div className="flex gap-1 px-3 pb-2 overflow-x-auto flex-shrink-0 [scrollbar-width:none]" role="tablist" aria-label="Settings sections">
            {tabs.map(tab => (
              <button
                key={tab.id}
                role="tab"
                id={`settings-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls="settings-panel"
                onClick={() => (settingsTab.value = tab.id)}
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted hover:text-fg"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4 border-t border-line pt-3">{panel}</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="scrim absolute inset-0" onClick={close} />
      <div className="dialog relative w-full max-w-[860px] h-[min(660px,calc(100vh-48px))] flex">
        <nav className="w-56 flex-shrink-0 bg-surface border-r border-line p-3 flex flex-col" role="tablist" aria-orientation="vertical" aria-label="Settings sections">
          <h2 className="px-2 pt-1 pb-4 text-[15px] font-semibold">Settings</h2>
          <div className="space-y-0.5">
            {tabs.map(tab => (
              <button
                key={tab.id}
                role="tab"
                id={`settings-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls="settings-panel"
                onClick={() => (settingsTab.value = tab.id)}
                className={`w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] text-left transition-colors ${
                  activeTab === tab.id ? "bg-surface-3 text-fg font-medium" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                <span className={activeTab === tab.id ? "text-accent" : "text-fg-subtle"}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-auto px-2 text-2xs text-fg-subtle">OmniRecall · local-first</div>
        </nav>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-4 px-7 pt-6 pb-4 flex-shrink-0">
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.01em]">{active.label}</h3>
              <p className="text-[13px] text-fg-muted mt-0.5">{active.description}</p>
            </div>
            <button onClick={close} className="icon-btn -mr-2 -mt-1" aria-label="Close settings">
              <CloseIcon size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-7 pb-7">{panel}</div>
        </div>
      </div>
    </div>
  );
}

/// A settings row: label and description on the left, control on the right.
function Row({ title, description, children, id }: { title: string; description?: string; children: ComponentChild; id?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 p-3.5 card">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-fg" id={id}>{title}</div>
        {description && <p className="text-xs text-fg-subtle mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function ProvidersTab() {
  return (
    <div className="space-y-2.5">
      {providers.value.map((provider) => (
        <ProviderCard key={provider.id} provider={provider} />
      ))}
    </div>
  );
}

type TestState = { status: "idle" } | { status: "testing" } | { status: "ok" } | { status: "error"; message: string };

function ProviderCard({ provider }: { provider: AIProvider }) {
  const isOllama = provider.id === "ollama";
  const meta = providerMeta(provider.id);
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
  const canTest = test.status !== "testing" && (isOllama || apiKey.trim() !== "");
  const status = test.status === "error"
    ? { label: "Error", className: "bg-danger/12 text-danger" }
    : connected
    ? { label: "Connected", className: "bg-success/12 text-success" }
    : provider.apiKey
    ? { label: "Not verified", className: "bg-warning/12 text-warning" }
    : { label: isOllama ? "Local" : "Not set up", className: "bg-surface-3 text-fg-subtle" };

  return (
    <div className={`card p-4 transition-colors ${test.status === "error" ? "border-danger/35" : connected ? "border-success/25" : ""}`}>
      <div className="flex items-start gap-3">
        <ProviderTile providerId={provider.id} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium">{provider.name}</span>
            <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] font-medium ${status.className}`}>
              {connected && <CheckIcon size={10} />}
              {status.label}
            </span>
          </div>
          <p className="text-xs text-fg-subtle mt-0.5 leading-relaxed">{meta.blurb}</p>
        </div>
        {meta.keyUrl && (
          <a href={meta.keyUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline whitespace-nowrap mt-0.5">
            Get a key ↗
          </a>
        )}
      </div>

      <div className="flex gap-2 mt-3">
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
            className="field font-mono text-xs"
          />
        ) : (
          <div className="relative flex-1 min-w-0">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onInput={(e) => handleKeyInput((e.target as HTMLInputElement).value)}
              onBlur={flushKey}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canTest) void handleTest();
              }}
              placeholder="Paste your API key"
              aria-label={`${provider.name} API key`}
              autocomplete="off"
              spellcheck={false}
              className="field pr-10 font-mono text-xs"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="icon-btn icon-btn-sm absolute right-1.5 top-1/2 -translate-y-1/2"
              aria-label={showKey ? "Hide API key" : "Show API key"}
              aria-pressed={showKey}
            >
              {showKey ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
            </button>
          </div>
        )}
        <button onClick={() => void handleTest()} disabled={!canTest} className={`btn h-9 min-w-[96px] ${connected ? "btn-secondary" : "btn-primary"}`}>
          {test.status === "testing" ? <SpinnerIcon size={13} /> : connected ? <CheckIcon size={13} /> : null}
          {test.status === "testing" ? "Testing" : test.status === "error" ? "Retry" : connected ? "Re-test" : isOllama ? "Connect" : "Verify"}
        </button>
      </div>

      <div aria-live="polite">
        {test.status === "error" && (
          <p className="selectable flex items-start gap-1.5 text-xs text-danger mt-2">
            <AlertIcon size={12} className="flex-shrink-0 mt-px" />
            {test.message}
          </p>
        )}
        {test.status === "ok" && (
          <p className="text-xs text-success mt-2">
            Connected — {getProviderModels(provider.id).length} models available from your account.
          </p>
        )}
        {isOllama && test.status === "idle" && (
          <p className="text-xs text-fg-subtle mt-2">Start Ollama, then Connect to load the models you've pulled.</p>
        )}
      </div>
    </div>
  );
}

function ThemeSwatch({ preview, label }: { preview: ThemePreview; label: string }) {
  return (
    <div className="relative h-[84px] w-full rounded-lg overflow-hidden border border-line" style={{ background: preview.bg }} aria-hidden="true" title={label}>
      <div className="absolute left-0 top-0 bottom-0 w-[30%]" style={{ background: preview.surface, borderRight: `1px solid ${preview.line}` }}>
        <div className="m-2 h-1.5 w-[60%] rounded-full" style={{ background: preview.accent }} />
        {[70, 55, 62].map((w, i) => (
          <div key={i} className="mx-2 mt-1.5 h-1 rounded-full opacity-40" style={{ width: `${w}%`, background: preview.fg }} />
        ))}
      </div>
      <div className="absolute right-2.5 top-3 h-3 w-[38%] rounded-md" style={{ background: preview.bubble, border: `1px solid ${preview.line}` }} />
      <div className="absolute left-[36%] top-8 h-1 w-[46%] rounded-full opacity-50" style={{ background: preview.fg }} />
      <div className="absolute left-[36%] top-10 h-1 w-[34%] rounded-full opacity-30" style={{ background: preview.fg }} />
      <div
        className="absolute left-[36%] right-2.5 bottom-2 h-4 rounded-md flex items-center justify-end pr-0.5"
        style={{ background: preview.surface, border: `1px solid ${preview.line}` }}
      >
        <div className="w-3 h-3 rounded-full" style={{ background: preview.accent }} />
      </div>
    </div>
  );
}

function AppearanceTab({ compact }: { compact: boolean }) {
  return (
    <div className="space-y-3">
      <div className="section-label" id="theme-label">Theme</div>
      <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-3"} gap-2.5`} role="radiogroup" aria-labelledby="theme-label">
        {THEMES.map((t) => {
          const selected = theme.value === t.id;
          return (
            <button
              key={t.id}
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(t.id)}
              className={`group text-left rounded-xl p-1.5 border transition-all ${
                selected ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-line-strong"
              }`}
            >
              <ThemeSwatch preview={t.preview} label={t.label} />
              <div className="flex items-center justify-between px-1 pt-2 pb-0.5">
                <div>
                  <div className="text-[13px] font-medium">{t.label}</div>
                  <div className="text-2xs text-fg-subtle">{t.desc}</div>
                </div>
                {selected && (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent text-accent-fg">
                    <CheckIcon size={11} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
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

function KeyCaps({ hotkey }: { hotkey: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {formatHotkey(hotkey).split(" + ").map((key, i) => (
        <span key={i} className="kbd h-6 min-w-[24px] px-1.5 text-[11px]">{key}</span>
      ))}
    </span>
  );
}

function ShortcutsTab() {
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

  return (
    <div className="space-y-2.5">
      {hotkeyError.value && !recording && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30 text-xs text-warning" role="alert">
          <AlertIcon size={14} className="flex-shrink-0 mt-px" />
          <span>{hotkeyError.value}</span>
        </div>
      )}

      <div className={`card p-4 transition-colors ${recording ? "border-accent/60" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-medium">Show / hide OmniRecall</div>
            <p className="text-xs text-fg-subtle mt-0.5">
              {recording ? "Press the new combination — Esc to cancel" : "Works from any app, wherever your cursor is"}
            </p>
          </div>
          {recording ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <input
                type="text"
                readOnly
                ref={focusOnMount}
                value={recorded ? formatHotkey(recorded) : ""}
                placeholder="Listening…"
                onKeyDown={handleKeyDown}
                aria-label="Press the new shortcut"
                className="w-36 h-8 px-2 rounded-lg bg-accent/10 border border-accent/50 text-xs text-accent font-mono text-center outline-none placeholder:text-accent/60"
              />
              <button onClick={() => void handleSave()} disabled={!recorded || saving} className="btn btn-sm btn-primary">
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={cancelRecording} className="btn btn-sm btn-ghost">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={startRecording}
              className="group flex items-center gap-2 flex-shrink-0 h-9 pl-2 pr-3 rounded-lg border border-line hover:border-accent/50 hover:bg-surface-2 transition-colors"
              aria-label={`Global shortcut ${formatHotkey(globalHotkey.value)}. Change`}
            >
              <KeyCaps hotkey={globalHotkey.value} />
              <span className="text-xs text-fg-subtle group-hover:text-accent">Change</span>
            </button>
          )}
        </div>
        {error && <p className="text-xs text-danger mt-2" role="alert">{error}</p>}
      </div>

      <button
        onClick={() => {
          isSettingsOpen.value = false;
          isShortcutsHelpOpen.value = true;
        }}
        className="btn btn-secondary w-full h-9"
      >
        <KeyboardIcon size={14} />
        See every keyboard shortcut
      </button>
    </div>
  );
}

/// Launch-at-login switch. The OS setting is the source of truth, so the
/// state is read from it rather than stored.
function LaunchAtLogin() {
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
    <Row id="autostart-label" title="Launch at login" description="Start quietly in the tray when you sign in, so the shortcut is always ready.">
      <button
        role="switch"
        aria-checked={enabled === true}
        aria-labelledby="autostart-label"
        disabled={enabled === null || busy}
        onClick={() => void toggle()}
        className="switch"
      />
    </Row>
  );
}

/// Behavior tab: startup and the persistent system prompt. The text area is
/// bounded to MAX_SYSTEM_PROMPT_CHARS at the store level — the visible
/// counter exists so users see how much budget they have.
function BehaviorTab() {
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
    <div className="space-y-2.5">
      <LaunchAtLogin />

      <div className="card p-4">
        <label htmlFor="system-prompt" className="block text-[13px] font-medium">
          System prompt
        </label>
        <p className="text-xs text-fg-subtle mt-0.5 mb-3">
          Persona, tone or context sent with every message, in every chat. You can also type <span className="font-mono">/system …</span> in the composer.
        </p>
        <textarea
          id="system-prompt"
          value={draft}
          onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
          placeholder="e.g. You are a senior software engineer. Be concise and direct. Prefer code examples."
          rows={6}
          maxLength={MAX_SYSTEM_PROMPT_CHARS + 100}
          aria-invalid={tooLong}
          className={`field resize-y min-h-[120px] ${tooLong ? "!border-danger" : ""}`}
        />
        <div className="flex items-center justify-between mt-2.5">
          <span className={`text-2xs tabular-nums ${tooLong ? "text-danger" : "text-fg-subtle"}`}>
            {draft.length.toLocaleString()} / {MAX_SYSTEM_PROMPT_CHARS.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-success" role="status">Saved</span>}
            {isDirty && (
              <button onClick={() => setDraft(systemPrompt.value)} className="btn btn-sm btn-ghost">
                Discard
              </button>
            )}
            <button onClick={handleSave} disabled={!isDirty || tooLong} className="btn btn-sm btn-primary">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/// Privacy tab: back up, restore, and erase local data.
function PrivacyTab() {
  const [resetting, setResetting] = useState(false);
  const chatCount = chatHistory.value.length;

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
    <div className="space-y-2.5">
      <Row title="Back up chats" description="One JSON file with every chat, branch and folder.">
        <button onClick={() => void exportAllChats()} disabled={chatCount === 0} className="btn btn-secondary">
          <DownloadIcon size={14} />
          {chatCount === 0 ? "No chats yet" : `Export ${chatCount}`}
        </button>
      </Row>

      <Row title="Restore from a backup" description="Adds the chats from a backup file. Chats you already have are kept.">
        <button
          onClick={() => {
            isSettingsOpen.value = false;
            exportDialog.value = "import";
          }}
          className="btn btn-secondary"
        >
          <UploadIcon size={14} />
          Import…
        </button>
      </Row>

      <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-danger/25 bg-danger/5">
        <div className="min-w-0">
          <div className="text-[13px] font-medium">Reset all data</div>
          <p className="text-xs text-fg-subtle mt-0.5 leading-relaxed">
            Deletes chats, folders, documents and their index, API keys, custom models and settings from this device.
          </p>
        </div>
        <button onClick={() => void handleReset()} disabled={resetting} className="btn btn-danger flex-shrink-0">
          <TrashIcon size={14} />
          {resetting ? "Clearing…" : "Reset…"}
        </button>
      </div>
    </div>
  );
}
