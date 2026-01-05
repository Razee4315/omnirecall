<div align="center">

# OmniRecall

AI-powered desktop knowledge assistant.

Instant AI chat with document context at your cursor.

[Release](https://github.com/Razee4315/omnirecall/releases) · [Build](https://github.com/Razee4315/omnirecall/actions) · [License](LICENSE) · Windows | Linux

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

<img src="demo/spotlight.png" alt="Spotlight Mode" width="200" />

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

MIT License. See [LICENSE](LICENSE).

---

## Author

Saqlain Razee

GitHub: https://github.com/Razee4315
LinkedIn: https://linkedin.com/in/saqlainrazee

