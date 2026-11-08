import { ComponentChild } from "preact";
import {
  currentQuery,
  formatHotkey,
  globalHotkey,
  isCommandPaletteOpen,
  providers,
  readableDocumentCount,
  isSettingsOpen,
  settingsTab,
} from "../../stores/appStore";
import { pickAndAddDocuments } from "../../lib/documents";
import { requestComposerFocus } from "./ChatComposer";
import {
  BookIcon,
  CommandIcon,
  DocumentIcon,
  KeyIcon,
  LightbulbIcon,
  LogoMark,
  PaperclipIcon,
  PenIcon,
  SearchIcon,
  SparklesIcon,
  TranslateIcon,
} from "../icons";

interface Suggestion {
  icon: ComponentChild;
  title: string;
  hint: string;
  prompt: string;
}

const GENERAL: Suggestion[] = [
  { icon: <LightbulbIcon size={15} />, title: "Explain simply", hint: "Make a hard idea easy", prompt: "Explain this in simple terms: " },
  { icon: <SparklesIcon size={15} />, title: "Brainstorm", hint: "Ten fresh angles", prompt: "Brainstorm ideas for " },
  { icon: <PenIcon size={15} />, title: "Draft a reply", hint: "Clear and friendly", prompt: "Draft a friendly, concise reply to: " },
  { icon: <TranslateIcon size={15} />, title: "Translate", hint: "Keep the tone", prompt: "Translate into English, keeping the tone: " },
];

const WITH_DOCS: Suggestion[] = [
  { icon: <BookIcon size={15} />, title: "Summarize", hint: "The key points", prompt: "Summarize the key points of my documents." },
  { icon: <SearchIcon size={15} />, title: "Find specifics", hint: "Ask about a detail", prompt: "What do my documents say about " },
  { icon: <DocumentIcon size={15} />, title: "Compare", hint: "Across documents", prompt: "Compare the main ideas across my documents." },
  { icon: <PenIcon size={15} />, title: "Draft from docs", hint: "Grounded writing", prompt: "Using my documents, draft " },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function applySuggestion(prompt: string) {
  currentQuery.value = prompt;
  requestComposerFocus();
}

/// What a new chat shows: a quiet greeting, suggestions, and — until the user
/// has one — a nudge to connect a provider.
export function EmptyState({ compact }: { compact: boolean }) {
  const docCount = readableDocumentCount.value;
  const suggestions = docCount > 0 ? WITH_DOCS : GENERAL;
  const hasProvider = providers.value.some(p => p.apiKey !== "" || (p.id === "ollama" && p.isConnected));

  if (compact) {
    return (
      <div className="ambient h-full flex flex-col justify-center px-5 py-4 animate-rise">
        <h1 className="font-display text-[28px] leading-[1.1] text-fg tracking-[-0.01em]">
          {greeting()}.
          <br />
          <span className="italic text-fg-muted">What should we recall?</span>
        </h1>
        <p className="mt-2 text-xs text-fg-subtle">
          {docCount > 0
            ? `${docCount} document${docCount === 1 ? "" : "s"} ready to ask about.`
            : "Ask anything, or attach a document to ask about it."}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s.title}
              onClick={() => applySuggestion(s.prompt)}
              className="group flex items-center gap-2 h-9 px-2.5 rounded-xl border border-line bg-surface/60 text-left hover:bg-surface-2 hover:border-line-strong transition-colors"
            >
              <span className="text-fg-subtle group-hover:text-accent transition-colors">{s.icon}</span>
              <span className="text-xs font-medium text-fg-muted group-hover:text-fg truncate">{s.title}</span>
            </button>
          ))}
        </div>

        {!hasProvider && <ConnectNudge compact />}
      </div>
    );
  }

  return (
    <div className="ambient min-h-full flex items-center justify-center px-8 py-10">
      <div className="w-full max-w-2xl animate-rise">
        <LogoMark size={40} />
        <h1 className="mt-6 font-display text-[44px] leading-[1.05] tracking-[-0.015em] text-fg">
          {greeting()}.{" "}
          <span className="italic text-fg-muted">What should we recall?</span>
        </h1>
        <p className="mt-3 text-[14px] text-fg-muted max-w-lg leading-relaxed">
          {docCount > 0
            ? `${docCount} document${docCount === 1 ? " is" : "s are"} attached. Answers will draw on them and cite what they used.`
            : "Ask anything. Attach PDFs, notes or code and answers will be grounded in your own files."}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-2.5">
          {suggestions.map((s, i) => (
            <button
              key={s.title}
              onClick={() => applySuggestion(s.prompt)}
              className="group flex items-start gap-3 p-3.5 rounded-2xl border border-line bg-surface text-left hover:border-line-strong hover:bg-surface-2 transition-colors animate-rise"
              style={{ animationDelay: `${60 + i * 40}ms` }}
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-2 text-fg-muted group-hover:text-accent group-hover:bg-accent/10 transition-colors">
                {s.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-fg">{s.title}</span>
                <span className="block text-xs text-fg-subtle mt-0.5">{s.hint}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {docCount === 0 && (
            <button onClick={() => void pickAndAddDocuments()} className="btn btn-secondary">
              <PaperclipIcon size={14} />
              Attach documents
            </button>
          )}
          <button onClick={() => (isCommandPaletteOpen.value = true)} className="btn btn-ghost">
            <CommandIcon size={14} />
            Command palette
            <span className="kbd ml-1">Ctrl K</span>
          </button>
          <span className="ml-auto text-2xs text-fg-subtle hidden lg:inline">
            Summon from anywhere with <span className="kbd">{formatHotkey(globalHotkey.value)}</span>
          </span>
        </div>

        {!hasProvider && <ConnectNudge compact={false} />}
      </div>
    </div>
  );
}

function ConnectNudge({ compact }: { compact: boolean }) {
  return (
    <button
      onClick={() => {
        settingsTab.value = "providers";
        isSettingsOpen.value = true;
      }}
      className={`group mt-4 w-full flex items-center gap-3 rounded-xl border border-dashed border-accent/40 bg-accent/6 text-left hover:bg-accent/10 transition-colors ${compact ? "p-2.5" : "p-3.5"}`}
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/15 text-accent flex-shrink-0">
        <KeyIcon size={15} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-fg">Connect an AI provider</span>
        <span className="block text-xs text-fg-subtle">Add a Gemini, OpenAI, Claude or GLM key — or use Ollama locally.</span>
      </span>
    </button>
  );
}
