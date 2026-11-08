import { render } from "preact";
import { App } from "./App";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { loadPersistedData } from "./stores/appStore";
// Fonts are bundled so first paint never waits on the network.
import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist-mono/wght.css";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "./styles/globals.css";

// Load persisted data before rendering so the first paint already has the
// user's theme, chats and settings.
loadPersistedData().then(() => {
  render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
    document.getElementById("app")!,
  );
});
