<div align="center">

<img src="src-tauri/icons/icon.png" alt="OmniRecall Logo" width="120" />

# OmniRecall

**AI-powered desktop knowledge assistant**

Instant AI chat with document context at your cursor.

[![Release](https://img.shields.io/github/v/release/Razee4315/omnirecall)](https://github.com/Razee4315/omnirecall/releases) [![Build](https://img.shields.io/github/actions/workflow/status/Razee4315/omnirecall/ci.yml)](https://github.com/Razee4315/omnirecall/actions) [![License](https://img.shields.io/badge/license-Source%20Available-blue)](LICENSE)

**Windows** · **Linux**

</div>

---

## Overview

OmniRecall is a lightweight desktop app that gives you fast AI chat with document-aware context. It runs quietly in the background and appears instantly at your cursor when you need it.

<img src="demo/dashboard.png" alt="OmniRecall Dashboard" width="800" />

---

## Features

- Cursor-based quick access (Spotlight-style)
- Multiple AI providers (Gemini, OpenAI, Claude, GLM, Ollama)
- Document-based Q&A (PDF, TXT, Markdown, code)
- Persistent local document storage
- Dark and light themes
- Local-first and private by design

<img src="demo/spotlight.png" alt="Spotlight Mode" width="400" />

---

## Installation

Download the latest release:

- Windows: `.exe`, `.msi`
- Linux: `.deb`, `.AppImage`

macOS support coming soon.

---

## Usage

**Keyboard shortcuts**

- `Alt + Space` (Windows) / `Ctrl + Alt + Space` (Linux): Open at cursor
- `Ctrl + ,`: Settings
- `Esc`: Hide

**Documents**

- Add PDFs, text, markdown, or code files
- Ask questions based on loaded documents
- Files persist between sessions

---

## API Providers

- Google Gemini (recommended, free tier)
- OpenAI
- Anthropic Claude
- Z AI (GLM models)
- Ollama (fully local)

---

## Development

**Requirements**

- Node.js 18+
- Rust 1.70+
- Tauri system dependencies

**Run locally**

```bash
git clone https://github.com/Razee4315/omnirecall.git
cd omnirecall
npm install
npm run tauri dev
```

**Build**

```bash
npm run tauri build
```

---

## License

This project uses a **Source Available** license. See [LICENSE](LICENSE) for details.

- ✅ Free for personal and educational use
- ✅ Free to modify for personal use
- ❌ Commercial use requires permission
- ❌ Redistribution for profit requires a license

---

## Author

**Saqlain Razee**

- GitHub: [Razee4315](https://github.com/Razee4315)
- LinkedIn: [saqlainrazee](https://linkedin.com/in/saqlainrazee)
