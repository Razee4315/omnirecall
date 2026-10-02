import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { holdWindowOpen } from "../stores/appStore";

/// Ask where to save and write a text file there. Resolves to false if the
/// user cancelled the dialog; throws if the write fails.
export async function saveTextFile(defaultName: string, contents: string, extension: string): Promise<boolean> {
  // The native dialog takes focus; keep Spotlight from hiding behind it.
  holdWindowOpen("file-dialog", true);
  try {
    const path = await save({
      defaultPath: defaultName,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    });
    if (!path) return false;
    await invoke("save_text_file", { path, contents });
    return true;
  } finally {
    holdWindowOpen("file-dialog", false);
  }
}
