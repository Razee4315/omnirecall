# Audit implementation progress

Branch: `audit/full-implementation`. Single source of truth for what is left.

Status values: `todo` / `in-progress` / `done` / `verified` / `blocked`.

**Environment constraint:** this machine has no Rust toolchain (no `cargo`, `rustc`, or MSVC build tools), so the
Tauri backend cannot be compiled or run here. Frontend work is verified with `tsc`, `vitest`, a production build, and
a browser session against a mocked Tauri IPC layer. Anything whose proof needs the compiled backend or the native
window is marked `blocked` with the reason once implemented.

## Findings

| ID | Tier | Item | Status | Note |
|---|---|---|---|---|
| F-01 | 1 | Input loses focus after every answer | todo | |
| F-02 | 1 | Global cancel flag / unlabelled stream channel | todo | |
| F-03 | 1 | Anthropic not streamed, 60s watchdog drops answers | todo | |
| F-04 | 1 | Silent empty responses | todo | |
| F-05 | 1 | Mid-stream error loses the turn | todo | |
| F-06 | 1 | Markdown: tables, nested lists, highlighting | todo | |
| F-07 | 1 | Render-blocking Google Fonts | todo | |
| F-08 | 1 | Hotkey registration failure is silent | todo | |
| F-09 | 1 | Hard-coded model list, Anthropic key test | todo | |
| F-10 | 1 | First connected provider never auto-selected | verified | vitest: adoptProviderIfActiveUnusable (3 cases) |
| F-11 | 1 | SSE parser duplicates / corrupts UTF-8 | todo | |
| F-12 | 1 | Right-click disabled, text not selectable | todo | |
| F-13 | 1 | Spotlight parity (retry, scroll, actions, branches) | todo | |
| F-14 | 1 | Enter submits during IME composition | todo | |
| F-15 | 1 | Ctrl+N during streaming corrupts session | todo | |
| F-16 | 1 | Esc in inline editors hides the window | done | stopPropagation in model dropdown, custom-model input, folder inputs, branch menu/rename |
| F-17 | 1 | Context meter ignores docs; history never trimmed | todo | |
| F-18 | 1 | Hide-on-blur vs dialogs/drag; monitor clamp | todo | |
| F-19 | 1 | System prompt sent as document context | todo | |
| F-20 | 2 | .docx offered but rejected; silent doc failures | todo | |
| F-21 | 2 | Removed documents stay in the vector index | todo | |
| F-22 | 2 | Indexing silent / no re-index / uncapped fallback | todo | |
| F-23 | 2 | Esc collapses Dashboard; two adjacent X buttons | todo | |
| F-24 | 2 | Docs always on, no sources shown | todo | |
| F-25 | 2 | Docs list states, labels, picker types | todo | |
| F-26 | 2 | Scroll-to-bottom button scrolls away | todo | |
| F-27 | 2 | Editing first message overwrites the thread | todo | |
| F-28 | 2 | Retry after failed regenerate is a no-op | todo | |
| F-29 | 2 | Search: empty state, titles/branches, scroll to hit | todo | |
| F-30 | 2 | Maximize state; leaving maximized Dashboard | todo | |
| F-31 | 2 | Command palette search, index reset, commands | todo | |
| F-32 | 2 | History grouped by creation date | todo | |
| F-33 | 2 | Regenerate branch pile-up (version arrows) | todo | |
| F-34 | 3 | Onboarding opens Settings behind the tour (P0) | done | tour returns null and releases focus trap while isSettingsOpen; resumes on same step |
| F-35 | 3 | Ollama base URL ignored for chat | todo | |
| F-36 | 3 | API keys stored in plain JSON | todo | |
| F-37 | 3 | Folders: no way to file a chat without HTML5 drag | todo | |
| F-38 | 3 | Onboarding copy, Esc, hard-coded hotkey | todo | |
| F-39 | 3 | API key saved only on blur; missing labels | todo | |
| F-40 | 3 | Hotkey recorder uses e.key; stale tray tooltip | todo | |
| F-41 | 3 | Reset all data is incomplete | todo | |
| F-42 | 3 | Export/import reachability and stale export | todo | |
| F-43 | 3 | Native confirm(); dead Branch label | todo | |
| F-44 | 3 | CSP off, unchecked link hrefs | todo | |
| F-45 | 3 | Theme contrast (ocean, compare colours) | todo | |
| F-46 | 3 | Three shortcut lists; no /system feedback | todo | |
| F-47 | 3 | Accessibility: roles, labels, inert sidebar | todo | |
| F-48 | 4 | Model Compare timing, stream sharing, cancel | todo | |
| F-49 | 4 | RAG debug panel duplicated | todo | |
| F-50 | 4 | Release pipeline / docs mismatch | todo | |

## Missing must-haves

| ID | Tier | Item | Status | Note |
|---|---|---|---|---|
| M-01 | all | Auto-update | todo | |
| M-02 | 1 | Launch at login and single-instance guard | todo | |
| M-03 | 2 | Source citations on document answers | todo | |
| M-04 | 2 | Per-chat document toggle | todo | |
| M-05 | 1 | Live model lists | todo | |
| M-06 | all | Error boundary | todo | |
| M-07 | 1 | Model recorded per message | todo | |
| M-08 | 3 | Restore-backup entry | todo | |
| M-09 | 1 | Per-chat draft retention | todo | |
| M-10 | 1 | Clipboard capture into the composer | todo | |
| M-11 | all | Frontend tests | in-progress | vitest + happy-dom harness with mocked Tauri IPC; tests added alongside each change |

## Cleanup

| ID | Tier | Item | Status | Note |
|---|---|---|---|---|
| C-01 | - | Delete stray `-o` binary | verified | git rm; no references in repo (grep), build unaffected |
| C-02 | - | Unused npm packages | todo | |
| C-03 | - | Unused crates | todo | |
| C-04 | - | Clipboard plugin either used or removed | todo | |
| C-05 | - | Unused store signals | todo | |
| C-06 | - | Dead components and exports | todo | |
| C-07 | - | Unused skeleton components | todo | |
| C-08 | - | Unused icons | todo | |
| C-09 | - | Unused CSS | todo | |
| C-10 | - | Non-streaming chat functions | todo | |
| C-11 | - | Unused embedding paths and helpers | todo | |
| C-12 | - | Unused AppConfig fields, stale allow(dead_code) | todo | |
| C-13 | - | Archive stale audit docs | todo | |
| C-14 | - | demo/demo.mp4 reference check | todo | |
| C-15 | - | Duplication: settings cards/tabs, add-documents, downloads, fade-in | todo | |
| C-16 | - | Shared error helper, import validation, remove `any` | todo | |
| C-17 | - | Onboarding flag moved into the app store | todo | |

## Optimizations

| ID | Tier | Item | Status | Note |
|---|---|---|---|---|
| O-01 | - | Bundle fonts (same change as F-07) | todo | |
| O-02 | - | Reuse HTTP clients | todo | |
| O-03 | - | Per-session persistence | todo | |
| O-04 | - | Document context assembled in Rust | todo | |
| O-05 | - | Batch embeddings | todo | |
| O-06 | - | Vector search without loading every chunk body | todo | |
| O-07 | - | Memoized message rows | todo | |
| O-08 | - | Trim history, cap document fallback | todo | |
| O-09 | - | Lazy-load overlays | todo | |
| O-10 | - | Build weight (same change as C-02/C-03) | todo | |
