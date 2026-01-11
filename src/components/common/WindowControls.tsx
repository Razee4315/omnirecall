import { invoke } from "@tauri-apps/api/core";
import { CloseIcon } from "../icons";

// Icons for window controls
function MinimizeIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function MaximizeIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <rect x="3" y="3" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    );
}

function RestoreIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <rect x="5" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 5v6a2 2 0 002 2h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function FullscreenIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function ExitFullscreenIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M6 3v3H3M10 3v3h3M6 13v-3H3M10 13v-3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

interface WindowControlsProps {
    isMaximized?: boolean;
    isFullscreen?: boolean;
    showMinimize?: boolean;
    showMaximize?: boolean;
    showFullscreen?: boolean;
    showClose?: boolean;
    onClose?: () => void;
    className?: string;
}

export function WindowControls({
    isMaximized = false,
    isFullscreen = false,
    showMinimize = true,
    showMaximize = true,
    showFullscreen = true,
    showClose = true,
    onClose,
    className = "",
}: WindowControlsProps) {
    const handleMinimize = async () => {
        await invoke("minimize_window");
    };

    const handleMaximize = async () => {
        await invoke("toggle_maximize");
    };

    const handleFullscreen = async () => {
        await invoke("toggle_fullscreen");
    };

    const handleClose = async () => {
        if (onClose) {
            onClose();
        } else {
            await invoke("hide_window");
        }
    };

    return (
        <div className={`flex items-center gap-0.5 no-drag ${className}`}>
            {showFullscreen && (
                <button
                    onClick={handleFullscreen}
                    className="p-1.5 hover:bg-bg-tertiary rounded transition-colors text-text-tertiary hover:text-text-primary"
                    title={isFullscreen ? "Exit Fullscreen (F11)" : "Fullscreen (F11)"}
                >
                    {isFullscreen ? <ExitFullscreenIcon size={14} /> : <FullscreenIcon size={14} />}
                </button>
            )}
            {showMinimize && (
                <button
                    onClick={handleMinimize}
                    className="p-1.5 hover:bg-bg-tertiary rounded transition-colors text-text-tertiary hover:text-text-primary"
                    title="Minimize"
                >
                    <MinimizeIcon size={14} />
                </button>
            )}
            {showMaximize && (
                <button
                    onClick={handleMaximize}
                    className="p-1.5 hover:bg-bg-tertiary rounded transition-colors text-text-tertiary hover:text-text-primary"
                    title={isMaximized ? "Restore" : "Maximize"}
                >
                    {isMaximized ? <RestoreIcon size={14} /> : <MaximizeIcon size={14} />}
                </button>
            )}
            {showClose && (
                <button
                    onClick={handleClose}
                    className="p-1.5 hover:bg-error/20 rounded transition-colors text-text-tertiary hover:text-error"
                    title="Close"
                >
                    <CloseIcon size={14} />
                </button>
            )}
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
