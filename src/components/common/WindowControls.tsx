import { invoke } from "@tauri-apps/api/core";
import { toggleMaximize } from "../../lib/window";

/// Caption glyphs drawn at 10px on a pixel grid, matching the weight of the
/// native Windows 11 caption buttons.
function Glyph({ kind }: { kind: "min" | "max" | "restore" | "close" }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" shape-rendering="geometricPrecision">
      {kind === "min" && <path d="M0 5.5h10" stroke="currentColor" strokeWidth="1" />}
      {kind === "max" && <rect x="0.5" y="0.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1" />}
      {kind === "restore" && (
        <>
          <rect x="0.5" y="2.5" width="7" height="7" rx="1.25" stroke="currentColor" strokeWidth="1" />
          <path d="M2.5 2.5V2a1.5 1.5 0 0 1 1.5-1.5H8A1.5 1.5 0 0 1 9.5 2v4A1.5 1.5 0 0 1 8 7.5h-.5" stroke="currentColor" strokeWidth="1" />
        </>
      )}
      {kind === "close" && <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1" />}
    </svg>
  );
}

const caption =
  "h-full w-[46px] flex items-center justify-center text-fg-muted transition-colors duration-100 hover:bg-surface-3 hover:text-fg focus-visible:outline-offset-[-2px]";

/// Minimize / maximize / hide-to-tray for the frameless Dashboard, laid out
/// like native caption buttons: full title-bar height, flush right.
export function WindowControls({ isMaximized }: { isMaximized: boolean }) {
  return (
    <div className="flex items-stretch h-full self-stretch" data-no-drag>
      <button onClick={() => invoke("minimize_window")} className={caption} title="Minimize" aria-label="Minimize window">
        <Glyph kind="min" />
      </button>
      <button
        onClick={() => void toggleMaximize()}
        className={caption}
        title={isMaximized ? "Restore" : "Maximize"}
        aria-label={isMaximized ? "Restore window" : "Maximize window"}
      >
        <Glyph kind={isMaximized ? "restore" : "max"} />
      </button>
      <button
        onClick={() => invoke("hide_window")}
        className="h-full w-[46px] flex items-center justify-center text-fg-muted transition-colors duration-100 hover:bg-[#c42b1c] hover:text-white focus-visible:outline-offset-[-2px]"
        title="Hide to tray"
        aria-label="Hide window to tray"
      >
        <Glyph kind="close" />
      </button>
    </div>
  );
}
