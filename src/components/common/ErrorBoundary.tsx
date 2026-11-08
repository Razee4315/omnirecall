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
        <div role="alert" className="max-w-sm w-full bg-overlay border border-line rounded-2xl shadow-pop p-6 text-center">
          <h1 className="font-display text-[26px] leading-tight text-fg">Something went wrong</h1>
          <p className="text-[13px] text-fg-muted mt-2 leading-relaxed">
            The window hit an unexpected error. Your chats are saved; reloading usually fixes it.
          </p>
          <pre className="selectable mt-4 p-2.5 rounded-lg bg-surface-2 border border-line font-mono text-[10.5px] text-fg-subtle text-left whitespace-pre-wrap break-words max-h-24 overflow-auto">
            {this.state.error}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary mt-5"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
