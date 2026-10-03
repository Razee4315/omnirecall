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
import { AlertIcon, CheckIcon, CloseIcon, DocumentIcon, FolderIcon, PlusIcon, SpinnerIcon } from "../icons";
import { DocumentListSkeleton } from "../common/Skeleton";

const MODE_SUMMARY: Record<string, string> = {
  full: "Documents are small enough to be sent in full with each message.",
  semantic: "Only the excerpts most relevant to each question are sent.",
  truncated: "These documents are too large to send whole, so only the beginning of each is sent.",
};

function DocumentRow({ doc, index }: { doc: Document; index: number }) {
  const state = documentStatus.value.byId[doc.id];
  const indexState = indexStates.value[doc.id];
  const pending = !state && documentStatus.value.loading;

  let detail: string | null = null;
  let detailClass = "text-text-tertiary";
  if (state?.error) {
    detail = state.error.replace(/^File error: /, "");
    detailClass = "text-error";
  } else if (indexState?.state === "indexing") {
    detail = "Indexing for search…";
  } else if (indexState?.state === "failed") {
    detail = `Not indexed: ${indexState.error}`;
    detailClass = "text-warning";
  } else if (state && state.indexedChunks > 0) {
    detail = "Indexed for search";
  }

  const handleRemove = () => {
    removeDocument(doc.id);
    toast.action(`Removed ${doc.name}`, { label: "Undo", onClick: () => restoreDocument(doc, index) }, "info");
  };

  return (
    <li className="group flex items-start gap-2 px-2 py-1.5 rounded hover:bg-bg-tertiary">
      <DocumentIcon size={14} className="text-text-tertiary flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-primary truncate" title={doc.path}>{doc.name}</div>
        {detail && <div className={`text-[10px] leading-snug ${detailClass}`}>{detail}</div>}
      </div>
      <span className="flex-shrink-0 mt-0.5" aria-hidden="true">
        {pending || indexState?.state === "indexing" ? (
          <SpinnerIcon size={12} className="text-text-tertiary" />
        ) : state?.error ? (
          <AlertIcon size={12} className="text-error" />
        ) : state && state.chars > 0 ? (
          <CheckIcon size={12} className="text-success" />
        ) : null}
      </span>
      <button
        onClick={handleRemove}
        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-1 min-w-[24px] min-h-[24px] flex items-center justify-center rounded text-text-tertiary hover:text-error hover:bg-error/10 transition-opacity flex-shrink-0"
        aria-label={`Remove ${doc.name}`}
        title="Remove document"
      >
        <CloseIcon size={10} />
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
    <div className="p-2">
      <div className="flex items-center justify-between px-2 py-1 mb-1">
        <span className="text-xs text-text-tertiary">Documents {docs.length > 0 && `(${docs.length})`}</span>
        <button
          onClick={() => void pickAndAddDocuments()}
          className="p-1 hover:bg-bg-tertiary rounded transition-colors text-text-tertiary hover:text-text-primary"
          title="Add documents"
          aria-label="Add documents"
        >
          <PlusIcon size={14} />
        </button>
      </div>

      {docs.length === 0 ? (
        <button
          onClick={() => void pickAndAddDocuments()}
          className="w-full flex flex-col items-center gap-2 px-3 py-5 rounded-lg border border-dashed border-border hover:border-accent-primary hover:bg-accent-primary/5 transition-colors"
        >
          <FolderIcon size={20} className="text-text-tertiary" />
          <span className="text-xs text-text-secondary">Add documents</span>
          <span className="text-[10px] text-text-tertiary">or drop files anywhere on the window</span>
        </button>
      ) : status.loading && Object.keys(status.byId).length === 0 ? (
        <DocumentListSkeleton count={Math.min(docs.length, 4)} />
      ) : (
        <ul className="space-y-0.5">
          {docs.map((doc, index) => (
            <DocumentRow key={doc.id} doc={doc} index={index} />
          ))}
        </ul>
      )}

      {docs.length > 0 && (
        <div className="mt-3 px-2 space-y-2">
          {MODE_SUMMARY[status.contextMode] && (
            <p className="text-[10px] leading-relaxed text-text-tertiary">{MODE_SUMMARY[status.contextMode]}</p>
          )}
          {canIndex ? (
            <button
              onClick={() => void handleReindex()}
              disabled={reindexing}
              className="w-full px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg border border-border transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {reindexing && <SpinnerIcon size={12} />}
              {reindexing ? "Re-indexing…" : "Re-index documents"}
            </button>
          ) : (
            status.contextMode === "truncated" && (
              <p className="text-[10px] leading-relaxed text-warning">
                Add a Gemini API key in Settings to index large documents, so the relevant parts are found instead.
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
