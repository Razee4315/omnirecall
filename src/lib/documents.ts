import { open } from "@tauri-apps/plugin-dialog";
import { addDocumentPaths, getSupportedExtensions, holdWindowOpen } from "../stores/appStore";
import { toast } from "../stores/toastStore";
import { errorMessage } from "./errors";

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/// Add files as documents and tell the user what happened. Shared by the file
/// picker and drag-and-drop so both report the same way.
export async function addDocumentsWithFeedback(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const { added, unsupported, duplicates } = await addDocumentPaths(paths);
    const notes: string[] = [];
    if (unsupported > 0) notes.push(`${plural(unsupported, "unsupported file")} skipped`);
    if (duplicates > 0) notes.push(`${duplicates} already added`);
    const suffix = notes.length > 0 ? ` (${notes.join(", ")})` : "";

    if (added > 0) toast.success(`Added ${plural(added, "document")}${suffix}`);
    else toast.warning(`No documents added${suffix}`);
  } catch (err) {
    toast.error(errorMessage(err, "Failed to add documents"));
  }
}

/// Open the native file picker and add the chosen files as documents.
export async function pickAndAddDocuments(): Promise<void> {
  // The native dialog takes focus; keep Spotlight from hiding behind it.
  holdWindowOpen("file-dialog", true);
  try {
    const extensions = await getSupportedExtensions();
    const selected = await open({
      multiple: true,
      directory: false,
      filters: extensions.length > 0 ? [{ name: "Documents", extensions }] : undefined,
    });
    if (!selected) return;
    await addDocumentsWithFeedback(Array.isArray(selected) ? selected : [selected]);
  } catch (err) {
    toast.error(errorMessage(err, "Failed to open the file picker"));
  } finally {
    holdWindowOpen("file-dialog", false);
  }
}
