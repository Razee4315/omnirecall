import { useState } from "preact/hooks";
import {
  Document,
  documents,
  documentStatus,
  hasEmbeddingKey,
  indexStates,
  reindexAllDocuments,
  removeDocument,
  restoreDocument,
} from "../../stores/appStore";
import { pickAndAddDocuments } from "../../lib/documents";
import { toast } from "../../stores/toastStore";
import { AlertIcon, CheckIcon, CloseIcon, PlusIcon, RefreshIcon, SpinnerIcon, UploadIcon } from "../icons";
import { DocumentListSkeleton } from "../common/Skeleton";

const MODE_SUMMARY: Record<string, string> = {
  full: "Small enough to send in full with each message.",
  semantic: "Only the passages most relevant to each question are sent.",
  truncated: "Too large to send whole, so only the beginning of each is sent.",
};

/// Badge colors per file family, so a list of files scans at a glance.
function typeBadge(type: string): { label: string; color: string } {
  const t = type.toLowerCase();
  if (t === "pdf") return { label: "PDF", color: "#e5484d" };
  if (["md", "markdown", "mdx"].includes(t)) return { label: "MD", color: "#3e9bff" };
  if (["txt", "text", "log", "rtf"].includes(t)) return { label: "TXT", color: "#8b8d98" };
  if (["csv", "tsv", "json", "yaml", "yml", "toml", "xml"].includes(t)) return { label: t.toUpperCase().slice(0, 4), color: "#30a46c" };
  if (["doc", "docx"].includes(t)) return { label: "DOC", color: "#3e63dd" };
  return { label: (t || "FILE").toUpperCase().slice(0, 4), color: "#a46eff" };
}

function DocumentRow({ doc, index }: { doc: Document; index: number }) {
  const state = documentStatus.value.byId[doc.id];
  const indexState = indexStates.value[doc.id];
  const pending = !state && documentStatus.value.loading;
  const badge = typeBadge(doc.type);

  let detail = "Ready";
  let detailClass = "text-fg-subtle";
  if (pending) {
    detail = "Reading…";
  } else if (state?.error) {
    detail = state.error.replace(/^File error: /, "");
    detailClass = "text-danger";
  } else if (indexState?.state === "indexing") {
    detail = "Indexing for search…";
  } else if (indexState?.state === "failed") {
    detail = `Not indexed: ${indexState.error}`;
    detailClass = "text-warning";
  } else if (state && state.indexedChunks > 0) {
    detail = `Indexed · ${state.indexedChunks} passages`;
  } else if (state && state.chars > 0) {
    detail = `${Math.max(1, Math.round(state.chars / 1000)).toLocaleString()}K characters`;
  }

  const handleRemove = () => {
    removeDocument(doc.id);
    toast.action(`Removed ${doc.name}`, { label: "Undo", onClick: () => restoreDocument(doc, index) }, "info");
  };

  return (
    <li className="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors">
      <span
        className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 text-[9px] font-bold tracking-wide"
        style={{ background: `color-mix(in srgb, ${badge.color} 14%, transparent)`, color: badge.color }}
        aria-hidden="true"
      >
        {badge.label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-fg truncate" title={doc.path}>{doc.name}</div>
        <div className={`flex items-center gap-1 text-2xs leading-snug truncate ${detailClass}`}>
          {pending || indexState?.state === "indexing" ? (
            <SpinnerIcon size={10} className="flex-shrink-0" />
          ) : state?.error ? (
            <AlertIcon size={10} className="flex-shrink-0" />
          ) : state && state.chars > 0 ? (
            <CheckIcon size={10} className="flex-shrink-0 text-success" />
          ) : null}
          <span className="truncate" title={detail}>{detail}</span>
        </div>
      </div>
      <button
        onClick={handleRemove}
        className="icon-btn icon-btn-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:!text-danger hover:!bg-danger/10"
        aria-label={`Remove ${doc.name}`}
        title="Remove document"
      >
        <CloseIcon size={13} />
      </button>
    </li>
  );
}

/// Sidebar panel listing attached documents with their read and index state.
export function DocumentsPanel() {
  const [reindexing, setReindexing] = useState(false);
  const docs = documents.value;
  const status = documentStatus.value;
  const canIndex = hasEmbeddingKey();

  const handleReindex = async () => {
    setReindexing(true);
    try {
      const { indexed, failed } = await reindexAllDocuments();
      if (failed > 0) toast.warning(`Indexed ${indexed}, ${failed} failed`);
      else toast.success(`Indexed ${indexed} document${indexed === 1 ? "" : "s"}`);
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="px-1.5 pb-3">
      <div className="flex items-center justify-between pl-2.5 pr-1 pt-1 pb-1">
        <span className="section-label">Attached {docs.length > 0 && `· ${docs.length}`}</span>
        <button onClick={() => void pickAndAddDocuments()} className="icon-btn icon-btn-sm" title="Add documents" aria-label="Add documents">
          <PlusIcon size={14} />
        </button>
      </div>

      {docs.length === 0 ? (
        <button
          onClick={() => void pickAndAddDocuments()}
          className="mx-1 mt-1 w-[calc(100%-0.5rem)] flex flex-col items-center gap-2 px-4 py-7 rounded-xl border border-dashed border-line-strong hover:border-accent/60 hover:bg-accent/5 transition-colors"
        >
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface-2 text-fg-subtle">
            <UploadIcon size={18} />
          </span>
          <span className="text-[13px] font-medium text-fg-muted">Add documents</span>
          <span className="text-2xs text-fg-subtle leading-relaxed text-center">
            PDF, text, Markdown or code.
            <br />
            Or drop files anywhere on the window.
          </span>
        </button>
      ) : status.loading && Object.keys(status.byId).length === 0 ? (
        <DocumentListSkeleton count={Math.min(docs.length, 4)} />
      ) : (
        <ul className="space-y-px">
          {docs.map((doc, index) => (
            <DocumentRow key={doc.id} doc={doc} index={index} />
          ))}
        </ul>
      )}

      {docs.length > 0 && (
        <div className="mt-3 mx-1 p-3 rounded-xl bg-canvas/60 border border-line space-y-2.5">
          {MODE_SUMMARY[status.contextMode] && (
            <p className="text-2xs leading-relaxed text-fg-subtle">{MODE_SUMMARY[status.contextMode]}</p>
          )}
          {canIndex ? (
            <button onClick={() => void handleReindex()} disabled={reindexing} className="btn btn-sm btn-secondary w-full">
              {reindexing ? <SpinnerIcon size={12} /> : <RefreshIcon size={12} />}
              {reindexing ? "Re-indexing…" : "Re-index documents"}
            </button>
          ) : (
            status.contextMode === "truncated" && (
              <p className="text-2xs leading-relaxed text-warning">
                Add a Gemini API key in Settings to index large documents, so the relevant parts are found instead.
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
