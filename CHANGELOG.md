# Changelog

All notable changes to OmniRecall will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-10-03

Implementation of the full product audit. Item-by-item status: `AUDIT_PROGRESS.md`.

### Features
- Claude answers now stream, and every provider can be stopped mid-answer (F-02, F-03)
- Model lists are fetched from your account when a key is verified; the first working provider is selected for you (F-09, F-10, M-05)
- Regenerated answers are kept as versions you step through with arrows (F-33)
- Switch documents on or off per chat; answers list the documents they used (F-24, M-03, M-04)
- Document panel shows whether each file could be read and indexed, with re-index (F-20, F-22, F-25)
- "Move to folder" menu on every chat (F-37)
- Command palette searches commands, models, chat titles and message text (F-31)
- Search covers titles and every branch and jumps to the match (F-29)
- Tables, nested and task lists, and syntax highlighting in answers (F-06)
- Launch at login and a single running instance (M-02)
- Quote the clipboard into a message with `Ctrl+Shift+V` (M-10)
- Restore a backup from Settings; import works without an open chat (F-42, M-08)
- Pin button keeps the Spotlight window open while you work elsewhere (F-18)
- Model name shown on each answer; unsent drafts kept per chat (M-07, M-09)
- Error screen with Reload instead of a blank window (M-06)

### Fixes
- The onboarding tour opened Settings underneath itself (F-34)
- A stopped, failed or empty answer could be lost, or bleed into the next message (F-04, F-05, F-11)
- Starting a new chat while an answer streamed could corrupt the saved session (F-15)
- Removed documents could still be retrieved from the search index (F-21)
- A custom Ollama address was ignored when chatting (F-35)
- Editing the first message overwrote the whole chat (F-27); "Try again" after a failed regenerate did nothing (F-28)
- `Esc` inside menus hid the window, and `Esc` in the Dashboard collapsed it (F-16, F-23)
- The hotkey recorder produced invalid shortcuts for shifted keys; a failed change left no hotkey; registration failures were silent (F-08, F-40)
- Reset all data left the search index, hotkey and keys behind (F-41)
- The scroll-to-latest button scrolled out of view (F-26)
- System prompt is now sent as a real system instruction (F-19)

### Performance
- Fonts are bundled: no network request at startup (F-07)
- Chats are saved one record at a time instead of rewriting the whole history (O-03)
- Document text is read and cached in the backend; embeddings are batched; search only loads the best matches (O-04, O-05, O-06)
- HTTP connections are reused between messages (O-02)
- Long chats are trimmed to fit the model's context window; large unindexed documents are truncated instead of sent whole (F-17, O-08)
- Settings, Compare, Export and the syntax highlighter load on first use (O-09)

### Accessibility
- The message box stays enabled and focused while an answer streams, and refocuses when the window is shown (F-01)
- IME composition no longer sends on Enter (F-14)
- Right-click copy/paste and text selection on messages and errors (F-12)
- Tab, menu, switch and dialog roles; labels on icon buttons; arrow keys in the model list; collapsed sidebar removed from the tab order (F-47)
- In-app confirmation dialogs replace browser `confirm()` (F-43)
- Contrast fixes for the Ocean theme and Compare labels on light themes (F-45)

### Security
- API keys are stored in the operating system's credential store (F-36)
- Links in answers are limited to http, https and mailto (F-44)

### Cleanup
- Removed dead components, icons, styles and dependencies; merged duplicated settings code (C-01 – C-17)
- Frontend and backend test suites; CI runs them (M-11, F-50)

### Upgrade notes
- **Automatic migrations on first launch:** chat history moves to one record per chat; API keys move from `omnirecall-data.json` to the OS credential store; documents are re-indexed with `gemini-embedding-001`; onboarding state moves into the app store. Going back to 1.1.x afterwards will not show your existing chats.
- **Removed:** `.docx` from the file picker (it could never be read); Spotlight's bottom Copy/Clear bar (use New chat in the header, the copy button on each message, or `Ctrl+Shift+C`).
- **Not yet included:** automatic updates (M-01) and a Content Security Policy (F-44).
- No new environment variables.

## [1.1.0] - 2025-11-30

### Added
- **Cursor Position Window** - Window now appears at your cursor location instead of fixed position
- **Markdown Rendering** - AI responses now render with proper formatting:
  - Bold, italic, and inline code
  - Code blocks with syntax label and copy button
  - Headers (h1, h2, h3)
  - Bullet and numbered lists
  - Blockquotes
  - Links
- **Persistent Storage** - Chat history and documents now persist between app restarts
- **GitHub CI/CD** - Automated build and release workflows

### Changed
- Improved Settings UI with responsive layout for small windows
- Better window behavior: Spotlight hides on focus loss, Dashboard stays open
- Updated Gemini models to latest: `gemini-3-flash-preview`, `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash-lite`

### Fixed
- Document upload dialog now properly opens file picker
- Chat history no longer lost when closing window
- Settings modal now fits properly in Spotlight mode

## [1.0.0] - 2025-11-30

### Added
- Initial release of OmniRecall
- **Spotlight Mode**: Quick-access overlay triggered by `Alt+Space`
- **Dashboard Mode**: Full-featured interface with sidebar
- **Multi-Provider AI Support**:
  - Google Gemini (gemini-2.0-flash, gemini-1.5-pro)
  - OpenAI (GPT-4o, GPT-4-turbo)
  - Anthropic Claude (Claude 3.5 Sonnet, Haiku)
  - Ollama (local models: Llama 3.2, Mistral, etc.)
- **Document RAG**: Add PDF, TXT, MD, code files for context-aware responses
- **Secure API Key Storage**: Using OS credential manager
- **Settings Panel**: Configure providers, themes, view shortcuts
- **Dark/Light Theme**: Clean design system
- **System Tray**: Background operation with tray icon
- **Keyboard Shortcuts**: Full keyboard navigation

### Technical
- Built with Tauri v2 for native performance (~3MB installer)
- Preact + TypeScript frontend
- Rust backend
- Tailwind CSS design system

## Planned
- Voice input
- Image support (vision models)
- macOS builds
- Web search integration
- Automatic updates
