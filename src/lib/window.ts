import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isFullscreen, isMaximized } from "../stores/appStore";

/// Elements inside a title bar that must keep receiving their own clicks.
const INTERACTIVE = 'button, a, input, textarea, select, label, [role="button"], [role="tab"], [role="switch"], [data-no-drag]';

/// Make a custom title bar behave like a native one: press and drag moves the
/// window, and a double-click runs `onDoubleClick` (maximize in the Dashboard,
/// expand in Spotlight). Controls inside the bar keep working normally.
///
/// Tauri v2 ignores the CSS `-webkit-app-region: drag` property, so dragging
/// has to go through `startDragging()` (which needs the
/// `core:window:allow-start-dragging` permission).
export function handleTitleBarMouseDown(e: MouseEvent, onDoubleClick?: () => void) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest(INTERACTIVE)) return;
  // The OS owns the mouse once dragging starts, so the second click of a
  // double-click arrives as another mousedown with detail 2.
  if (e.detail >= 2) {
    e.preventDefault();
    onDoubleClick?.();
    return;
  }
  getCurrentWindow().startDragging().catch(() => {});
}

/// Mirror the OS window state into the store, so the maximize/restore icon
/// and the rounded window corners stay right when the user maximizes with
/// Win+Up, Aero Snap or a title-bar double-click.
export function watchWindowState(): () => void {
  let disposed = false;
  let unlisten: (() => void) | undefined;
  let frame = 0;

  try {
    const win = getCurrentWindow();
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        void Promise.all([win.isMaximized(), win.isFullscreen()])
          .then(([maximized, fullscreen]) => {
            isMaximized.value = maximized;
            isFullscreen.value = fullscreen;
          })
          .catch(() => {});
      });
    };
    sync();
    win
      .onResized(sync)
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => {});
  } catch {
    // Not running inside Tauri (tests, plain browser).
  }

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    unlisten?.();
  };
}

/// Maximize or restore the Dashboard. Goes through the backend command, which
/// reports the resulting state (the JS toggle needs an extra permission).
export async function toggleMaximize(): Promise<void> {
  try {
    isMaximized.value = await invoke<boolean>("toggle_maximize");
  } catch (e) {
    console.error("Failed to toggle maximize:", e);
  }
}
