# Changelog

All notable changes to OmniRecall will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## [Unreleased]

### Planned
- Streaming responses (real-time typing)
- Clipboard integration
- Voice input
- Image support (vision models)
- macOS and Linux builds
- Web search integration
- Syntax highlighting for code
