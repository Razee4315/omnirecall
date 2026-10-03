import { render } from "preact";
import { App } from "./App";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { loadPersistedData } from "./stores/appStore";
// Fonts are bundled so first paint never waits on the network.
import "@fontsource-variable/inter/wght.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
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
