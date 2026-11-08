import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  activeModel,
  activeProvider,
  addCustomModel,
  AIProvider,
  customModels,
  fetchedModels,
  getProviderModels,
  isCustomModel,
  isSettingsOpen,
  isValidModelName,
  providers,
  removeCustomModel,
  setActiveModel,
  settingsTab,
} from "../../stores/appStore";
import { modelLabel, modelNote, providerMeta } from "../../lib/models";
import { useClickOutside } from "../../hooks/useClickOutside";
import { focusOnMount } from "../../lib/dom";
import { CheckIcon, ChevronDownIcon, CloseIcon, PlusIcon, SearchIcon, SlidersIcon } from "../icons";
import { ProviderTile } from "./ProviderTile";

interface ModelSelectorProps {
  /** Spotlight variant: narrower trigger and popover. */
  compact?: boolean;
}

function providerReady(provider: AIProvider): boolean {
  return provider.apiKey !== "" || provider.id === "ollama";
}

/**
 * The model picker. Every provider's models (the live list once a key is
 * verified, else the built-in list) plus user-added ones, with search and an
 * "Add custom model" field per provider, so a model the list doesn't know is
 * never out of reach.
 */
export function ModelSelector({ compact = false }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const currentProvider = providers.value.find(p => p.id === activeProvider.value);
  const meta = providerMeta(activeProvider.value);
  const label = modelLabel(activeModel.value);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    // Focus the search box, but scroll the active model into view.
    requestAnimationFrame(() => {
      searchRef.current?.focus();
      listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    });
  }, [open]);

  const select = (providerId: string, model: string) => {
    setActiveModel(providerId, model);
    setOpen(false);
  };

  // Ready providers first, so the models you can use are on top.
  const ordered = useMemo(
    () => [...providers.value].sort((a, b) => Number(providerReady(b)) - Number(providerReady(a))),
    [providers.value],
  );

  const moveFocus = (e: KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const options = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    if (options.length === 0) return;
    const inField = (e.target as HTMLElement).tagName === "INPUT";
    if (inField && e.target !== searchRef.current) return;
    e.preventDefault();
    const current = options.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? options.length - 1
      : e.key === "ArrowDown" ? (current === -1 ? 0 : Math.min(current + 1, options.length - 1))
      : current <= 0 ? -1 : current - 1;
    if (next === -1) searchRef.current?.focus();
    else options[next].focus();
  };

  return (
    <div
      className="relative min-w-0"
      ref={ref}
      data-no-drag
      onKeyDown={(e) => {
        // Close only the popover; the app-level Escape would otherwise also
        // hide the window.
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
        aria-label={`Model: ${meta.short} ${label}. Change model`}
        title={`${currentProvider?.name ?? meta.short} · ${activeModel.value}`}
        className={`group flex items-center gap-2 min-w-0 h-8 rounded-lg pl-1.5 pr-2 transition-colors ${
          open ? "bg-surface-3" : "hover:bg-surface-2"
        }`}
      >
        <ProviderTile providerId={activeProvider.value} size={20} />
        <span className={`truncate text-[13px] font-medium text-fg ${compact ? "max-w-[150px]" : "max-w-[240px]"}`}>{label}</span>
        <ChevronDownIcon size={13} className={`flex-shrink-0 text-fg-subtle transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={`menu absolute top-full left-0 mt-1.5 z-50 flex flex-col p-0 ${compact ? "w-[300px] max-h-[min(420px,calc(100vh-80px))]" : "w-[340px] max-h-[min(520px,calc(100vh-90px))]"}`}
          onKeyDown={moveFocus}
        >
          <div className="flex items-center gap-2 px-3 h-10 border-b border-line flex-shrink-0">
            <SearchIcon size={14} className="text-fg-subtle" />
            <input
              ref={searchRef}
              value={query}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              placeholder="Search models…"
              aria-label="Search models"
              className="flex-1 min-w-0 bg-transparent text-[13px] outline-none placeholder:text-fg-subtle"
            />
          </div>

          <div ref={listRef} role="listbox" aria-label="Available models" className="overflow-y-auto p-1 flex-1">
            {ordered.map(provider => (
              <ProviderModelGroup
                key={provider.id}
                provider={provider}
                query={query.trim().toLowerCase()}
                onSelect={select}
              />
            ))}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              settingsTab.value = "providers";
              isSettingsOpen.value = true;
            }}
            className="flex items-center gap-2 px-3 h-9 border-t border-line text-xs text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors flex-shrink-0"
          >
            <SlidersIcon size={13} />
            Manage providers and API keys
          </button>
        </div>
      )}
    </div>
  );
}

interface GroupProps {
  provider: AIProvider;
  query: string;
  onSelect: (providerId: string, model: string) => void;
}

function ProviderModelGroup({ provider, query, onSelect }: GroupProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Subscribe to list changes; the list itself comes from the store.
  void customModels.value;
  void fetchedModels.value;
  const all = getProviderModels(provider.id);
  const meta = providerMeta(provider.id);
  const models = query
    ? all.filter(m => `${provider.name} ${m} ${modelLabel(m)}`.toLowerCase().includes(query))
    : all;
  const ready = providerReady(provider);

  if (query && models.length === 0) return null;

  const submitDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    if (!isValidModelName(trimmed)) {
      setError("Letters, numbers, dots, dashes, slashes and colons only.");
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
    <div className="mb-1 last:mb-0" role="group" aria-label={provider.name}>
      <div className="flex items-center gap-2 px-2 pt-2 pb-1">
        <ProviderTile providerId={provider.id} size={16} />
        <span className="text-xs font-medium text-fg-muted">{provider.name.replace(" (Local)", "")}</span>
        <span className="ml-auto">
          {provider.isConnected ? (
            <span className="inline-flex items-center gap-1 text-2xs text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success" /> Connected
            </span>
          ) : !ready ? (
            <span className="text-2xs text-fg-subtle">No API key</span>
          ) : null}
        </span>
      </div>

      {models.map(model => {
        const isActive = activeProvider.value === provider.id && activeModel.value === model;
        const userAdded = isCustomModel(provider.id, model);
        const label = modelLabel(model);
        const note = modelNote(model);
        return (
          <div key={model} className="group relative flex items-center">
            <button
              role="option"
              aria-selected={isActive}
              onClick={() => onSelect(provider.id, model)}
              className={`flex-1 min-w-0 flex items-center gap-2.5 pl-8 pr-8 py-1.5 rounded-lg text-left transition-colors outline-none focus-visible:bg-surface-2 hover:bg-surface-2 ${
                isActive ? "bg-accent/10" : ""
              } ${ready ? "" : "opacity-60"}`}
            >
              <span className="min-w-0 flex-1">
                <span className={`flex items-center gap-1.5 text-[13px] ${isActive ? "text-accent font-medium" : "text-fg"}`}>
                  <span className="truncate">{label}</span>
                  {userAdded && <span className="chip h-4 px-1.5 text-[9px] uppercase tracking-wide">custom</span>}
                </span>
                <span className="block truncate text-2xs text-fg-subtle font-mono">
                  {note ? <span className="font-sans">{note}</span> : model}
                </span>
              </span>
            </button>
            {isActive && <CheckIcon size={14} className="absolute right-2.5 text-accent pointer-events-none" />}
            {userAdded && !isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeCustomModel(provider.id, model);
                }}
                className="icon-btn icon-btn-sm absolute right-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:!text-danger"
                aria-label={`Remove custom model ${model}`}
                title="Remove custom model"
              >
                <CloseIcon size={12} />
              </button>
            )}
          </div>
        );
      })}

      {!query && (
        <div className="pl-8 pr-2 py-1">
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
                placeholder={`e.g. ${meta.example}`}
                maxLength={80}
                aria-label={`Custom ${provider.name} model id`}
                className="field h-8 text-xs font-mono"
              />
              <p className={`text-2xs ${error ? "text-danger" : "text-fg-subtle"}`}>{error ?? "Exact model id · Enter to add · Esc to cancel"}</p>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 h-6 text-2xs text-fg-subtle hover:text-accent transition-colors"
            >
              <PlusIcon size={11} />
              Add a model id
            </button>
          )}
        </div>
      )}
    </div>
  );
}
