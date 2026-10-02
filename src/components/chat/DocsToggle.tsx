import {
  docsEnabled,
  documentStatus,
  readableDocumentCount,
  setDocsEnabled,
} from "../../stores/appStore";
import { DocumentIcon } from "../icons";

const MODE_HINT: Record<string, string> = {
  full: "sent in full",
  semantic: "most relevant excerpts are sent",
  truncated: "too large to send whole and not indexed, so only the beginning of each is sent",
};

/// Header chip showing how many documents are attached, and the switch for
/// whether this chat uses them.
export function DocsToggle({ compact }: { compact: boolean }) {
  const count = readableDocumentCount.value;
  if (count === 0) return null;

  const enabled = docsEnabled.value;
  const label = `${count} doc${count === 1 ? "" : "s"}`;
  const hint = MODE_HINT[documentStatus.value.contextMode];
  const title = enabled
    ? `${label} used in this chat${hint ? ` (${hint})` : ""} — click to turn off`
    : `Documents are off for this chat — click to use ${label}`;

  return (
    <button
      onClick={() => setDocsEnabled(!enabled)}
      aria-pressed={enabled}
      aria-label={title}
      title={title}
      className={`flex items-center gap-1 flex-shrink-0 whitespace-nowrap rounded transition-colors ${
        compact ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-xs rounded-lg"
      } ${
        enabled
          ? "bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20"
          : "bg-bg-tertiary text-text-tertiary line-through hover:text-text-secondary"
      }`}
    >
      <DocumentIcon size={compact ? 12 : 14} />
      <span>{compact ? count : label}</span>
    </button>
  );
}
