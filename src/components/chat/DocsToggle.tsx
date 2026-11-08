import {
  docsEnabled,
  documentStatus,
  readableDocumentCount,
  setDocsEnabled,
} from "../../stores/appStore";
import { BookIcon } from "../icons";

const MODE_HINT: Record<string, string> = {
  full: "sent in full",
  semantic: "most relevant excerpts are sent",
  truncated: "too large to send whole and not indexed, so only the beginning of each is sent",
};

/// Chip showing how many documents are attached, and the switch for whether
/// this chat uses them. Hidden when there are no readable documents.
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
      className={`inline-flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap rounded-full h-7 px-2.5 text-xs font-medium border transition-colors ${
        enabled
          ? "bg-accent/12 border-accent/25 text-accent hover:bg-accent/20"
          : "bg-transparent border-line text-fg-subtle hover:text-fg-muted hover:border-line-strong"
      }`}
    >
      <BookIcon size={13} />
      <span className={enabled ? "" : "line-through decoration-1"}>{compact ? count : label}</span>
    </button>
  );
}
