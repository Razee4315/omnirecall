import { invoke } from "@tauri-apps/api/core";
import { isMaximized as isMaximizedSignal } from "../../stores/appStore";
import { CloseIcon } from "../icons";

function MinimizeIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function MaximizeIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    );
}

function RestoreIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="5" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 5v6a2 2 0 002 2h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

const controlButton =
    "p-1.5 hover:bg-bg-tertiary rounded transition-colors text-text-tertiary hover:text-text-primary";

/// Minimize / maximize / hide-to-tray buttons for the frameless Dashboard.
export function WindowControls({ isMaximized }: { isMaximized: boolean }) {
    const handleMaximize = async () => {
        // The command reports the resulting state, which drives the icon.
        isMaximizedSignal.value = await invoke<boolean>("toggle_maximize");
    };

    return (
        <div className="flex items-center gap-0.5 no-drag">
            <button onClick={() => invoke("minimize_window")} className={controlButton} title="Minimize" aria-label="Minimize window">
                <MinimizeIcon size={14} />
            </button>
            <button
                onClick={() => void handleMaximize()}
                className={controlButton}
                title={isMaximized ? "Restore" : "Maximize"}
                aria-label={isMaximized ? "Restore window" : "Maximize window"}
            >
                {isMaximized ? <RestoreIcon size={14} /> : <MaximizeIcon size={14} />}
            </button>
            <button
                onClick={() => invoke("hide_window")}
                className="p-1.5 hover:bg-error/20 rounded transition-colors text-text-tertiary hover:text-error"
                title="Hide to tray"
                aria-label="Hide window to tray"
            >
                <CloseIcon size={14} />
            </button>
        </div>
    );
}

// Draggable title bar component
interface DragRegionProps {
    children?: preact.ComponentChildren;
    className?: string;
}

export function DragRegion({ children, className = "" }: DragRegionProps) {
    return (
        <div className={`drag-region flex-1 ${className}`}>
            {children}
        </div>
    );
}
