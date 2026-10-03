import { useState, useRef, useEffect } from "preact/hooks";
import {
  activeModel,
  activeProvider,
  providers,
  customModels,
  setActiveModel,
  addCustomModel,
  removeCustomModel,
  getProviderModels,
  isCustomModel,
  isValidModelName,
  AIProvider,
} from "../../stores/appStore";
import { useClickOutside } from "../../hooks/useClickOutside";
import { ChevronDownIcon, CloseIcon, PlusIcon, CheckIcon } from "../icons";
import { focusOnMount } from "../../lib/dom";

interface ModelSelectorProps {
  /** Compact variant for Spotlight (smaller text + tighter padding). */
  compact?: boolean;
}

/**
 * Unified model picker. Built-in models per provider plus user-added
 * custom models, with an inline "Add custom model" affordance for every
 * provider — important because cloud providers retire model names
 * without notice and we don't want to ship a release every time.
 */
export function ModelSelector({ compact = false }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);
  const listRef = useRef<HTMLDivElement>(null);

  const currentProvider = providers.value.find(p => p.id === activeProvider.value);
  const currentProviderLabel = currentProvider?.name.replace(" (Local)", "") ?? activeProvider.value;

  const select = (providerId: string, model: string) => {
    setActiveModel(providerId, model);
    setOpen(false);
  };

  // Move focus to the active model when the dropdown opens, so the arrow
  // keys work straight away.
  useEffect(() => {
    if (open) {
      const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      el?.scrollIntoView({ block: "nearest" });
      el?.focus();
    }
  }, [open]);

  // Arrow keys / Home / End move between models.
  const handleListKeyDown = (e: KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const options = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    if (options.length === 0) return;
    e.preventDefault();
    const current = options.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? options.length - 1
      : e.key === "ArrowDown" ? Math.min(current + 1, options.length - 1)
      : Math.max(current - 1, 0);
    options[next].focus();
  };

  return (
    <div
      className="relative"
      ref={ref}
      onKeyDown={(e) => {
        // Close only the dropdown; the global Escape handler would otherwise
        // also hide the window.
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Active model: ${currentProviderLabel} ${activeModel.value}. Click to change.`}
        title={`${currentProviderLabel} · ${activeModel.value}`}
        className={`flex items-center gap-1.5 min-w-0 rounded-lg bg-bg-tertiary hover:bg-border transition-colors text-text-secondary ${
          compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            currentProvider?.isConnected
              ? "bg-success"
              : currentProvider?.id === "ollama"
              ? "bg-warning"
              : "bg-text-tertiary"
          }`}
          aria-hidden="true"
        />
        {/* Spotlight has room for the model name only; the provider is in
            the tooltip and the dropdown. */}
        {!compact && (
          <>
            <span className="text-text-tertiary truncate">{currentProviderLabel}</span>
            <span className="text-text-tertiary">·</span>
          </>
        )}
        <span className={compact ? "max-w-[120px] truncate" : "truncate"}>{activeModel.value}</span>
        <ChevronDownIcon size={compact ? 10 : 14} className="flex-shrink-0" />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label="Available AI models"
          onKeyDown={handleListKeyDown}
          className={`absolute top-full left-0 mt-1 bg-bg-primary border border-border rounded-lg shadow-xl z-50 py-1 overflow-y-auto ${
            compact ? "w-64 max-h-72" : "w-72 max-h-96"
          }`}
        >
          {providers.value.map(provider => (
            <ProviderModelGroup
              key={provider.id}
              provider={provider}
              activeProviderId={activeProvider.value}
              activeModelName={activeModel.value}
              onSelect={select}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface GroupProps {
  provider: AIProvider;
  activeProviderId: string;
  activeModelName: string;
  onSelect: (providerId: string, model: string) => void;
  compact: boolean;
}

function ProviderModelGroup({ provider, activeProviderId, activeModelName, onSelect, compact }: GroupProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Subscribes this group to custom-model changes; the list itself comes
  // from the store (live provider list when known, plus custom models).
  void customModels.value;
  const models = getProviderModels(provider.id);
  const showWarn = !provider.apiKey && provider.id !== "ollama";

  const submitDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    if (!isValidModelName(trimmed)) {
      setError("Letters, numbers, dots, dashes, slashes, colons only.");
      return;
    }
    const result = addCustomModel(provider.id, trimmed);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    onSelect(provider.id, trimmed);
    setDraft("");
    setError(null);
    setAdding(false);
  };

  return (
    <div>
      <div className="px-3 py-1.5 text-xs text-text-tertiary font-medium border-b border-border flex items-center justify-between">
        <span>{provider.name}</span>
        {showWarn && <span className="text-warning text-[10px]">(no key)</span>}
        {provider.isConnected && (
          <span className="text-success text-[10px] flex items-center gap-0.5">
            <CheckIcon size={10} /> connected
          </span>
        )}
      </div>

      {models.map(model => {
        const isActive = activeProviderId === provider.id && activeModelName === model;
        const userAdded = isCustomModel(provider.id, model);
        return (
          <div
            key={model}
            className={`group flex items-center justify-between hover:bg-bg-tertiary transition-colors ${
              isActive ? "bg-accent-primary/10" : ""
            }`}
          >
            <button
              role="option"
              aria-selected={isActive}
              onClick={() => onSelect(provider.id, model)}
              className={`flex-1 text-left px-3 py-2 truncate ${
                compact ? "text-xs" : "text-sm"
              } ${isActive ? "text-accent-primary" : "text-text-primary"}`}
            >
              {model}
              {userAdded && (
                <span className="ml-2 text-[10px] text-text-tertiary uppercase tracking-wide">custom</span>
              )}
            </button>
            {userAdded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeCustomModel(provider.id, model);
                }}
                className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-1 mr-1.5 rounded text-text-tertiary hover:text-error hover:bg-error/10 transition-opacity"
                aria-label={`Remove custom model ${model}`}
                title="Remove custom model"
              >
                <CloseIcon size={10} />
              </button>
            )}
          </div>
        );
      })}

      {/* Add custom model affordance — available for every provider, not just Ollama. */}
      <div className="px-3 py-2 border-t border-border bg-bg-secondary/30">
        {adding ? (
          <div className="space-y-1">
            <input
              type="text"
              ref={focusOnMount}
              value={draft}
              onInput={(e) => {
                setDraft((e.target as HTMLInputElement).value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitDraft();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setAdding(false);
                  setDraft("");
                  setError(null);
                }
              }}
              placeholder={
                provider.id === "ollama"
                  ? "e.g. llama3.2:1b"
                  : provider.id === "gemini"
                  ? "e.g. gemini-2.5-pro"
                  : provider.id === "openai"
                  ? "e.g. gpt-4o-mini"
                  : provider.id === "anthropic"
                  ? "e.g. claude-3-5-sonnet-20241022"
                  : "exact model id"
              }
              maxLength={80}
              aria-label={`Custom ${provider.name} model name`}
              className={`w-full px-2 py-1 bg-bg-tertiary border border-border rounded text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-primary ${
                compact ? "text-xs" : "text-sm"
              }`}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-text-tertiary">
                Enter to save · Esc to cancel
              </p>
              {error && <p className="text-[10px] text-error">{error}</p>}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className={`w-full flex items-center gap-1.5 text-left text-text-tertiary hover:text-accent-primary transition-colors ${
              compact ? "text-xs" : "text-sm"
            }`}
          >
            <PlusIcon size={12} />
            <span>Add custom model</span>
          </button>
        )}
      </div>
    </div>
  );
}
