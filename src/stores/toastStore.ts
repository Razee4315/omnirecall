import { signal } from "@preact/signals";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

// Toast queue
export const toasts = signal<Toast[]>([]);

// Show a toast notification
export function showToast(message: string, type: ToastType = "info", duration: number = 3000) {
    const id = crypto.randomUUID();
    const toast: Toast = { id, message, type, duration };

    toasts.value = [...toasts.value, toast];

    // Auto-dismiss after duration
    if (duration > 0) {
        setTimeout(() => {
            dismissToast(id);
        }, duration);
    }

    return id;
}

// Dismiss a specific toast
export function dismissToast(id: string) {
    toasts.value = toasts.value.filter(t => t.id !== id);
}

// Clear all toasts
export function clearAllToasts() {
    toasts.value = [];
}

// Convenience methods
export const toast = {
    success: (message: string, duration?: number) => showToast(message, "success", duration),
    error: (message: string, duration?: number) => showToast(message, "error", duration),
    info: (message: string, duration?: number) => showToast(message, "info", duration),
    warning: (message: string, duration?: number) => showToast(message, "warning", duration),
};
