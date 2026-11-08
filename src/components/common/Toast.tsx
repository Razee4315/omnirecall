import { toasts, dismissToast, ToastType } from "../../stores/toastStore";
import { viewMode } from "../../stores/appStore";
import { AlertIcon, CloseIcon, ErrorCircleIcon, InfoIcon, SuccessCircleIcon } from "../icons";

function toastStyle(type: ToastType) {
  switch (type) {
    case "success":
      return { color: "text-success", icon: <SuccessCircleIcon size={16} /> };
    case "error":
      return { color: "text-danger", icon: <ErrorCircleIcon size={16} /> };
    case "warning":
      return { color: "text-warning", icon: <AlertIcon size={16} /> };
    case "info":
    default:
      return { color: "text-accent", icon: <InfoIcon size={16} /> };
  }
}

/// Notifications, stacked bottom-center just above the composer.
export function ToastContainer() {
  if (toasts.value.length === 0) return null;
  const compact = viewMode.value === "spotlight";

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none ${
        compact ? "bottom-[118px] w-[calc(100%-40px)]" : "bottom-[132px] w-[min(440px,calc(100%-48px))]"
      }`}
      role="status"
      aria-live="polite"
    >
      {toasts.value.map((toast) => {
        const style = toastStyle(toast.type);
        return (
          <div
            key={toast.id}
            className="pointer-events-auto w-full flex items-center gap-2.5 pl-3 pr-1.5 py-2 rounded-xl border border-line-strong bg-overlay shadow-pop animate-toast-in"
          >
            <span className={`flex-shrink-0 ${style.color}`}>{style.icon}</span>
            <span className="text-[13px] text-fg flex-1 min-w-0 leading-snug">{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick();
                  dismissToast(toast.id);
                }}
                className="btn btn-sm btn-secondary"
              >
                {toast.action.label}
              </button>
            )}
            <button onClick={() => dismissToast(toast.id)} className="icon-btn icon-btn-sm" aria-label="Dismiss notification">
              <CloseIcon size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
