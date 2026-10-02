import { Component, ComponentChildren } from "preact";
import { errorMessage } from "../../lib/errors";

interface ErrorBoundaryState {
  error: string | null;
}

/// Catches render errors so a bug shows a recoverable message instead of a
/// blank window (which, in a frameless tray app, looks like a hang).
export class ErrorBoundary extends Component<{ children: ComponentChildren }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: errorMessage(error, "Unknown error") };
  }

  componentDidCatch(error: unknown) {
    console.error("Unhandled render error:", error);
  }

  render() {
    if (this.state.error === null) return this.props.children;

    return (
      <div className="h-full w-full flex items-center justify-center p-4">
        <div role="alert" className="max-w-sm w-full bg-bg-primary border border-border rounded-xl shadow-2xl p-5 text-center">
          <h1 className="text-sm font-semibold text-text-primary">Something went wrong</h1>
          <p className="text-xs text-text-secondary mt-1.5">
            The window hit an unexpected error. Your chats are saved; reloading usually fixes it.
          </p>
          <pre className="selectable mt-3 p-2 rounded bg-bg-tertiary text-[10px] text-text-tertiary text-left whitespace-pre-wrap break-words max-h-24 overflow-auto">
            {this.state.error}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-lg bg-accent-primary text-on-accent text-xs font-medium hover:bg-accent-primary/90 transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
