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
| F-02 | 1 | Global cancel flag / unlabelled stream channel | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine. Per-request stream id + CancellationToken; frontend filtering verified (vitest: ignores other streams; browser mock) |
| F-03 | 1 | Anthropic not streamed, 60s watchdog drops answers | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine. Anthropic now streams via SSE; idle watchdog kept |
| F-04 | 1 | Silent empty responses | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine for the EmptyResponse error; frontend error + retry verified (vitest + browser mock) |
| F-05 | 1 | Mid-stream error loses the turn | verified | vitest: partial answer saved + marked interrupted on mid-stream failure, retry regenerates; browser mock |
| F-06 | 1 | Markdown: tables, nested lists, highlighting | todo | |
| F-07 | 1 | Render-blocking Google Fonts | done | build emits woff2 assets; dist/index.html has no external stylesheet |
| F-08 | 1 | Hotkey registration failure is silent | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine for startup status + register-before-release; warning toast, Settings alert and onboarding copy verified against mock |
| F-09 | 1 | Hard-coded model list, Anthropic key test | blocked | frontend verified (vitest verifyProvider: live list replaces built-ins, stale active model replaced; browser mock); list_models request/parse code is Rust, backend half not compiled here (no Rust toolchain). Anthropic test now uses GET /v1/models |
| F-10 | 1 | First connected provider never auto-selected | verified | vitest: adoptProviderIfActiveUnusable (3 cases) |
| F-11 | 1 | SSE parser duplicates / corrupts UTF-8 | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine. LineBuffer frames on bytes, yields each line once; unit tests cover split UTF-8 and split lines |
| F-12 | 1 | Right-click disabled, text not selectable | done | contextmenu allowed on inputs/.selectable/.markdown-content; user bubbles and error text selectable |
| F-13 | 1 | Spotlight parity (retry, scroll, actions, branches) | todo | |
| F-14 | 1 | Enter submits during IME composition | todo | |
| F-15 | 1 | Ctrl+N during streaming corrupts session | verified | vitest: new chat / chat switch mid-stream saves to the originating thread; browser mock (Ctrl+N while streaming) |
| F-16 | 1 | Esc in inline editors hides the window | done | stopPropagation in model dropdown, custom-model input, folder inputs, branch menu/rename |
| F-17 | 1 | Context meter ignores docs; history never trimmed | blocked | frontend verified (vitest trimHistory + contextTokens; browser: meter 38% with a truncated 400k-char doc); document token estimate comes from the backend, backend half not compiled here (no Rust toolchain) |
| F-18 | 1 | Hide-on-blur vs dialogs/drag; monitor clamp | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine for set_blur_hide_suspended and cursor-monitor placement (unit tests); hold/release around dialogs and Settings verified (vitest + browser mock); pin button added |
| F-19 | 1 | System prompt sent as document context | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine. System prompt sent in each provider's system field; unit tests on request bodies |
| F-20 | 2 | .docx offered but rejected; silent doc failures | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine for the shared extension list + per-document errors; frontend feedback verified (browser mock: docx skipped, scanned PDF error shown) |
| F-21 | 2 | Removed documents stay in the vector index | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine for remove_document_index; frontend call verified (vitest + browser mock) |
| F-22 | 2 | Indexing silent / no re-index / uncapped fallback | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine for scoped search, model-tagged vectors (gemini-embedding-001), capped fallback; index state, auto-index and re-index verified (vitest + browser mock) |
| F-23 | 2 | Esc collapses Dashboard; two adjacent X buttons | todo | |
| F-24 | 2 | Docs always on, no sources shown | todo | |
| F-25 | 2 | Docs list states, labels, picker types | todo | |
| F-26 | 2 | Scroll-to-bottom button scrolls away | todo | |
| F-27 | 2 | Editing first message overwrites the thread | verified | vitest: editing the first message starts a new chat, saved thread untouched; later messages branch |
| F-28 | 2 | Retry after failed regenerate is a no-op | verified | vitest: failed regenerate discards the empty version, returns to the previous answer, Try again works; browser mock |
| F-29 | 2 | Search: empty state, titles/branches, scroll to hit | verified | vitest: searches titles + every branch, opens branch and scrolls to hit; browser: empty state, highlight |
| F-30 | 2 | Maximize state; leaving maximized Dashboard | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine for unmaximize/exit-fullscreen before shrinking; maximize icon state wired to command result |
| F-31 | 2 | Command palette search, index reset, commands | todo | |
| F-32 | 2 | History grouped by creation date | verified | vitest: orderedSessions (pinned, then last activity) drives sidebar and Ctrl+1-9; browser: groups by activity day with year |
| F-33 | 2 | Regenerate branch pile-up (version arrows) | verified | vitest: regenerations are sibling versions (getMessageVersions), hidden from the branch list; browser: arrows 1/2, 2/2 |
| F-34 | 3 | Onboarding opens Settings behind the tour (P0) | done | tour returns null and releases focus trap while isSettingsOpen; resumes on same step |
| F-35 | 3 | Ollama base URL ignored for chat | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine. baseUrl passed from the store to send_message_stream; argument verified (vitest) |
| F-36 | 3 | API keys stored in plain JSON | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine for the keyring commands; migration, stripped store file and fallback verified (vitest); keychain round-trip not run |
| F-37 | 3 | Folders: no way to file a chat without HTML5 drag | todo | |
| F-38 | 3 | Onboarding copy, Esc, hard-coded hotkey | todo | |
| F-39 | 3 | API key saved only on blur; missing labels | todo | |
| F-40 | 3 | Hotkey recorder uses e.key; stale tray tooltip | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine for pause/resume + tray tooltip; recorder (e.code, Esc to cancel, failure message) verified in browser mock + vitest |
| F-41 | 3 | Reset all data is incomplete | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine for reset_backend_data; frontend reset verified (vitest + browser mock: store, secrets, backend call, onboarding) |
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
| M-02 | 1 | Launch at login and single-instance guard | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine. tauri-plugin-single-instance + tauri-plugin-autostart (--hidden login launch); Launch at login switch verified against mock |
| M-03 | 2 | Source citations on document answers | todo | |
| M-04 | 2 | Per-chat document toggle | todo | |
| M-05 | 1 | Live model lists | blocked | same change as F-09: fetched lists persisted per provider; backend half not compiled here (no Rust toolchain) |
| M-06 | all | Error boundary | todo | |
| M-07 | 1 | Model recorded per message | verified | vitest + browser: model stored on each assistant message and shown in the message toolbar |
| M-08 | 3 | Restore-backup entry | todo | |
| M-09 | 1 | Per-chat draft retention | verified | vitest: unsent text kept per chat across loadSession/startNewChat |
| M-10 | 1 | Clipboard capture into the composer | todo | |
| M-11 | all | Frontend tests | in-progress | vitest + happy-dom harness with mocked Tauri IPC; tests added alongside each change |

## Cleanup

| ID | Tier | Item | Status | Note |
|---|---|---|---|---|
| C-01 | - | Delete stray `-o` binary | verified | git rm; no references in repo (grep), build unaffected |
| C-02 | - | Unused npm packages | todo | |
| C-03 | - | Unused crates | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine. async-stream, chrono, anyhow, regex removed; keyring now used; Cargo.lock cannot be regenerated here |
| C-04 | - | Clipboard plugin either used or removed | todo | |
| C-05 | - | Unused store signals | verified | isLoading, isSearching, searchQuery, searchResults, commandPaletteQuery, compareModels, compareResponses, hasCompletedOnboarding removed; tsc noUnusedLocals + grep |
| C-06 | - | Dead components and exports | todo | |
| C-07 | - | Unused skeleton components | todo | |
| C-08 | - | Unused icons | todo | |
| C-09 | - | Unused CSS | todo | |
| C-10 | - | Non-streaming chat functions | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine. Removed with the streaming rewrite; no remaining references (grep) |
| C-11 | - | Unused embedding paths and helpers | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine. OpenAI/Ollama embedding paths, embed-per-chunk loop, dimension() removed |
| C-12 | - | Unused AppConfig fields, stale allow(dead_code) | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine. AppConfig reduced to hotkey; stale allow(dead_code) and Unknown variant removed |
| C-13 | - | Archive stale audit docs | todo | |
| C-14 | - | demo/demo.mp4 reference check | todo | |
| C-15 | - | Duplication: settings cards/tabs, add-documents, downloads, fade-in | todo | |
| C-16 | - | Shared error helper, import validation, remove `any` | verified | errorMessage()/parseApiError shared; sanitizeSession/Folder/Document validate stored + imported data (vitest); no any left (grep) |
| C-17 | - | Onboarding flag moved into the app store | verified | vitest (resetAllData) + browser: onboardingComplete lives in the store, localStorage flag migrated and removed |

## Optimizations

| ID | Tier | Item | Status | Note |
|---|---|---|---|---|
| O-01 | - | Bundle fonts (same change as F-07) | done | build emits woff2 assets; dist/index.html has no external stylesheet |
| O-02 | - | Reuse HTTP clients | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine. Shared OnceLock reqwest clients |
| O-03 | - | Per-session persistence | verified | vitest: migration from chatHistory to session:<id> keys, only changed sessions written, delete removes key |
| O-04 | - | Document context assembled in Rust | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine. Context is assembled in the backend from paths with an mtime-keyed text cache |
| O-05 | - | Batch embeddings | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine. batchEmbedContents, 50 texts per request |
| O-06 | - | Vector search without loading every chunk body | blocked | implemented with Rust unit tests, but NOT compiled or run: no Rust toolchain on this machine. Scores ids+embeddings, loads bodies for the top-k only |
| O-07 | - | Memoized message rows | todo | |
| O-08 | - | Trim history, cap document fallback | verified | vitest: trimHistory keeps newest turns within 75% of the context window; fallback cap is in the backend (F-22) |
| O-09 | - | Lazy-load overlays | todo | |
| O-10 | - | Build weight (same change as C-02/C-03) | todo | |
