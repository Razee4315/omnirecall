import { render } from "preact";
import { App } from "./App";
import { loadPersistedData } from "./stores/appStore";
import "./styles/globals.css";

// Load persisted data before rendering
loadPersistedData().then(() => {
  render(<App />, document.getElementById("app")!);
});
