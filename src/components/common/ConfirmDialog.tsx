import { useRef } from "preact/hooks";
import { confirmRequest, settleConfirm } from "../../stores/confirmStore";
import { useFocusTrap } from "../../hooks/useFocusTrap";

/// Renders the pending `confirmAction()` request, if any.
export function ConfirmDialog() {
  const panelRef = useRef<HTMLDivElement>(null);
  const request = confirmRequest.value;
  useFocusTrap(panelRef, request !== null, () => settleConfirm(false));

  if (!request) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => settleConfirm(false)}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-bg-primary border border-border rounded-xl shadow-2xl p-4 animate-scale-in"
      >
        <h2 id="confirm-title" className="text-sm font-semibold text-text-primary">{request.title}</h2>
        <p id="confirm-message" className="text-xs text-text-secondary mt-1.5 leading-relaxed">{request.message}</p>
        <div className="flex justify-end gap-2 mt-4">
          {/* Cancel comes first so it receives initial focus. */}
          <button
            onClick={() => settleConfirm(false)}
            className="px-3 py-1.5 rounded-lg text-xs text-text-secondary border border-border hover:bg-bg-tertiary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => settleConfirm(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              request.danger
                ? "bg-error text-white hover:bg-error/90"
                : "bg-accent-primary text-on-accent hover:bg-accent-primary/90"
            }`}
          >
            {request.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
