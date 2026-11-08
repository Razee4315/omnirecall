import { useRef, useState } from "preact/hooks";
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  setSidebarOpen,
  setSidebarWidth,
  sidebarWidth,
} from "../../stores/appStore";

/// Dragging the sidebar narrower than this collapses it.
const COLLAPSE_AT = 150;
const KEY_STEP = 16;

/// The draggable edge between the sidebar and the conversation. Drag to
/// resize, drag far left to collapse, double-click to reset; arrow keys work
/// when it has focus.
export function SidebarResizer({ onDragging }: { onDragging: (dragging: boolean) => void }) {
  const [active, setActive] = useState(false);
  const startRef = useRef({ x: 0, width: 0 });

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, width: sidebarWidth.value };
    setActive(true);
    onDragging(true);
    document.body.style.cursor = "col-resize";
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!active) return;
    const next = startRef.current.width + (e.clientX - startRef.current.x);
    if (next < COLLAPSE_AT) {
      setSidebarOpen(false);
      return;
    }
    setSidebarOpen(true);
    setSidebarWidth(next);
  };

  const end = (e: PointerEvent) => {
    if (!active) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setActive(false);
    onDragging(false);
    document.body.style.cursor = "";
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") setSidebarWidth(sidebarWidth.value - KEY_STEP);
    else if (e.key === "ArrowRight") setSidebarWidth(sidebarWidth.value + KEY_STEP);
    else if (e.key === "Home") setSidebarWidth(SIDEBAR_MIN_WIDTH);
    else if (e.key === "End") setSidebarWidth(SIDEBAR_MAX_WIDTH);
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      aria-valuenow={sidebarWidth.value}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDblClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
      onKeyDown={onKeyDown}
      className="group absolute top-0 bottom-0 -right-[5px] z-30 w-[10px] cursor-col-resize outline-none"
    >
      <div
        className={`mx-auto h-full w-[2px] rounded-full transition-colors duration-150 ${
          active ? "bg-accent" : "bg-transparent group-hover:bg-accent/50 group-focus-visible:bg-accent"
        }`}
      />
    </div>
  );
}
