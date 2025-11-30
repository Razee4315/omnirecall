# Changelog

All notable changes to OmniRecall will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-30

### Added
- Initial release of OmniRecall
- **Spotlight Mode**: Quick-access overlay triggered by global hotkey
- **Dashboard Mode**: Full-featured interface with three-panel layout
- **Multi-Provider AI Support**:
  - Google Gemini (gemini-2.0-flash-exp, gemini-1.5-pro, etc.)
  - OpenAI (GPT-4o, GPT-4-turbo, GPT-3.5-turbo)
  - Anthropic Claude (Claude 3.5 Sonnet, Claude 3 Opus)
  - Ollama (local models: Llama 3.2, Mistral, CodeLlama, etc.)
- **Knowledge Spaces**: Organize documents into separate searchable spaces
- **Document Ingestion**: Support for PDF, Word, Text, Markdown, and code files
- **Secure API Key Storage**: Using OS credential manager (Windows Credential Manager)
- **Settings Panel**: Configure providers, appearance, shortcuts, and RAG parameters
- **Dark/Light Theme**: System-aware theming with custom accent colors
- **Keyboard Shortcuts**: Full keyboard navigation support
- **Streaming Responses**: Real-time AI response streaming
- **Source Citations**: Document references with page numbers
- **Clipboard Integration**: Auto-detect and include clipboard content

### Technical
- Built with Tauri v2 for native performance
- Preact + TypeScript frontend (~77KB bundle)
- Rust backend for speed and security
- LanceDB for local vector storage
- Tailwind CSS design system

## [Unreleased]

### Planned
- macOS and Linux support
- Image embedding and search
- Voice input
- Browser extension
- Plugin system
- Cloud sync (optional)
