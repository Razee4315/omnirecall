<div align="center">

<img src="src-tauri/icons/icon.png" alt="OmniRecall Logo" width="120" />

# OmniRecall

**AI-powered desktop knowledge assistant**

Instant, context-aware AI right at your cursor.

[![Release](https://img.shields.io/github/v/release/Razee4315/omnirecall)](https://github.com/Razee4315/omnirecall/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/Razee4315/omnirecall/ci.yml)](https://github.com/Razee4315/omnirecall/actions)
[![License](https://img.shields.io/badge/license-Source%20Available-blue)](LICENSE)

**Windows** · **Linux**

</div>

---

## Why OmniRecall

Small questions break focus.

To ask something simple, you usually open a browser, switch tabs, load a website, type a prompt, and wait. That friction adds up and pulls you out of your work.

OmniRecall removes that gap.

Press a shortcut and an AI assistant appears exactly where your cursor is. No browser. No context switching. You stay in flow and get answers instantly, using your own documents when needed.

---

## Overview

OmniRecall is a lightweight, local-first desktop app that provides fast AI chat with document-aware context. It runs quietly in the background and appears only when you need it.

<img src="demo/dashboard.png" alt="OmniRecall Dashboard" width="800" />

---

## Features

- Instant, cursor-based access (Spotlight-style)
- Multiple AI providers: Gemini, OpenAI, Claude, GLM, Ollama
- Document-based Q&A (PDF, TXT, Markdown, code)
- Persistent local document storage
- Clean dark and light themes
- Privacy-focused, local-first design

<img src="demo/spotlight.png" alt="Spotlight Mode" width="400" />

---

## Installation

Download the latest release:

- **Windows**: `.exe`, `.msi`
- **Linux**: `.deb`, `.AppImage`

macOS support is planned.

---

## Usage

### Keyboard Shortcuts

- `Alt + Space` (Windows) / `Ctrl + Alt + Space` (Linux): Open at cursor
- `Ctrl + ,`: Open settings
- `Esc`: Hide window

### Documents

- Add PDF, text, markdown, or code files
- Ask questions using document context
- Files persist across sessions

---

## Supported AI Providers

- Google Gemini (recommended, free tier available)
- OpenAI
- Anthropic Claude
- Z AI (GLM models)
- Ollama (fully local models)

---

## Development

### Requirements

- Node.js 18+
- Rust 1.70+
- Tauri system dependencies

### Run Locally

```bash
git clone https://github.com/Razee4315/omnirecall.git
cd omnirecall
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

---

## License

This project uses a **Source Available** license. See [LICENSE](LICENSE) for details.

- Free for personal and educational use
- Free to modify for personal use
- Commercial use requires permission
- Redistribution for profit requires a license

---

## Author

**Saqlain Razee**

- GitHub: https://github.com/Razee4315
- LinkedIn: https://linkedin.com/in/saqlainrazee

