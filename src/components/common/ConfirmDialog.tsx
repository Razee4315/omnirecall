import { useRef } from "preact/hooks";
import { confirmRequest, settleConfirm } from "../../stores/confirmStore";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { AlertIcon } from "../icons";

/// Renders the pending `confirmAction()` request, if any.
export function ConfirmDialog() {
  const panelRef = useRef<HTMLDivElement>(null);
  const request = confirmRequest.value;
  useFocusTrap(panelRef, request !== null, () => settleConfirm(false));

  if (!request) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" onClick={() => settleConfirm(false)}>
      <div className="scrim absolute inset-0" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
        className="dialog relative w-full max-w-[380px] p-5"
      >
        {request.danger && (
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-danger/12 text-danger mb-3">
            <AlertIcon size={18} />
          </span>
        )}
        <h2 id="confirm-title" className="text-[15px] font-semibold text-fg">{request.title}</h2>
        <p id="confirm-message" className="text-[13px] text-fg-muted mt-1.5 leading-relaxed">{request.message}</p>
        <div className="flex justify-end gap-2 mt-5">
          {/* Cancel comes first so it receives initial focus. */}
          <button onClick={() => settleConfirm(false)} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={() => settleConfirm(true)} className={`btn ${request.danger ? "btn-danger-solid" : "btn-primary"}`}>
            {request.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
