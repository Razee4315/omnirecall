import { useState } from "preact/hooks";
import {
  activeModel,
  activeProvider,
  providers,
  customModels,
  setActiveModel,
  addCustomModel,
  removeCustomModel,
  isCustomModel,
  isValidModelName,
  AIProvider,
} from "../../stores/appStore";
import { useClickOutside } from "../../hooks/useClickOutside";
import { ChevronDownIcon, CloseIcon, PlusIcon, CheckIcon } from "../icons";

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

  const currentProvider = providers.value.find(p => p.id === activeProvider.value);
  const currentProviderLabel = currentProvider?.name.replace(" (Local)", "") ?? activeProvider.value;

  const select = (providerId: string, model: string) => {
    setActiveModel(providerId, model);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Active model: ${currentProviderLabel} ${activeModel.value}. Click to change.`}
        className={`flex items-center gap-1.5 rounded-lg bg-bg-tertiary hover:bg-border transition-colors text-text-secondary ${
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
        <span className={`text-text-tertiary ${compact ? "max-w-[60px]" : ""} truncate`}>
          {currentProviderLabel}
        </span>
        <span className={compact ? "max-w-[100px] truncate" : ""}>
          <span className="text-text-tertiary mx-1">·</span>
          {activeModel.value}
        </span>
        <ChevronDownIcon size={compact ? 10 : 14} className="flex-shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Available AI models"
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

  const builtIns = provider.models;
  const custom = customModels.value[provider.id] ?? [];
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

      {[...builtIns, ...custom.filter(m => !builtIns.includes(m))].map(model => {
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
                className="opacity-0 group-hover:opacity-100 p-1 mr-1.5 rounded text-text-tertiary hover:text-error hover:bg-error/10 transition-all"
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
              autoFocus
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
