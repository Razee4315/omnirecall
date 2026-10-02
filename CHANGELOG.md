# Changelog

All notable changes to OmniRecall will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Implementation of the full product audit. See `AUDIT_PROGRESS.md` for the item-by-item status.

### Added
- Claude responses now stream; every provider can be stopped mid-answer
- Model lists are fetched from each provider when its key is verified
- Regenerated answers are kept as versions you step through with arrows
- Per-chat switch for attached documents, and the documents an answer used are listed under it
- "Move to folder" menu on every chat
- Launch at login, and a single running instance
- Quote the clipboard into a message (`Ctrl+Shift+V`)
- Restore a backup from Settings; import no longer needs an open chat
- Pin button to keep the Spotlight window open
- Tables, nested lists, task lists and syntax highlighting in answers
- Frontend and backend test suites

### Changed
- API keys are stored in the operating system's credential store (existing keys are moved automatically)
- Chats are saved one per record instead of rewriting the whole history
- Document text is read and assembled in the backend; large, unindexed documents are truncated instead of sent whole
- Fonts are bundled; the app makes no network request at startup
- `Esc` no longer collapses the Dashboard
- The message box stays enabled and focused while an answer streams

### Fixed
- The onboarding tour opened Settings underneath itself
- Verifying a provider did not select it when the active provider had no key
- A stopped or failed answer could be lost or bleed into the next message
- Removed documents could still be retrieved from the search index
- A custom Ollama address was ignored when chatting
- Starting a new chat while an answer streamed could corrupt the saved session

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
