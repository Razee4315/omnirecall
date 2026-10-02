import { signal } from "@preact/signals";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  /// Styles the confirm button as destructive.
  danger?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

export const confirmRequest = signal<ConfirmRequest | null>(null);

/// In-app replacement for window.confirm(): themed, keyboard accessible, and
/// it doesn't take focus away from the window (which would hide Spotlight).
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  // A second request while one is open cancels the first.
  confirmRequest.value?.resolve(false);
  return new Promise<boolean>((resolve) => {
    confirmRequest.value = { ...options, resolve };
  });
}

export function settleConfirm(confirmed: boolean) {
  const request = confirmRequest.value;
  if (!request) return;
  confirmRequest.value = null;
  request.resolve(confirmed);
}
