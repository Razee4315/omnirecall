<div align="center">

# 🧠 OmniRecall

### AI-Powered Knowledge Assistant for Desktop

*Instant access to AI chat with document context—right at your cursor.*

[![Release](https://img.shields.io/github/v/release/Razee4315/omnirecall?style=for-the-badge&logo=github&color=0d1117)](https://github.com/Razee4315/omnirecall/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/Razee4315/omnirecall/release.yml?style=for-the-badge&logo=githubactions&logoColor=white&label=Build)](https://github.com/Razee4315/omnirecall/actions)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-3b82f6?style=for-the-badge&logo=windows11&logoColor=white)](https://github.com/Razee4315/omnirecall/releases)

<br/>

[**📥 Download**](#-installation) &nbsp;•&nbsp; [**✨ Features**](#-features) &nbsp;•&nbsp; [**📖 Usage**](#-usage) &nbsp;•&nbsp; [**🛠️ Build**](#️-development)

<br/>

<img src="demo/dashboard.png" alt="OmniRecall Dashboard" width="800"/>

</div>

---

## 🎬 Demo

https://github.com/user-attachments/assets/demo.mp4

<details>
<summary><strong>📸 Screenshots</strong></summary>
<br/>

| Spotlight Mode | Dashboard Mode |
|:--------------:|:--------------:|
| ![Spotlight](demo/spotlight.png) | ![Dashboard](demo/dashboard.png) |
| *Appears at cursor, quick queries* | *Full interface, chat history* |

</details>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### ⚡ Instant Access
- **Cursor-positioned** — Press `Alt+Space` (Windows) or `Ctrl+Alt+Space` (Linux)
- **Spotlight-style UI** — Clean, minimal interface
- **System tray** — Always ready in background

</td>
<td width="50%">

### 🤖 Multi-Provider AI
- **Google Gemini** — Fast, generous free tier
- **OpenAI GPT-4o** — Industry standard
- **Anthropic Claude** — Best for reasoning
- **Ollama** — 100% local, fully private

</td>
</tr>
<tr>
<td>

### 📄 Document RAG
- **Load documents** — PDF, TXT, Markdown, code files
- **Context-aware** — AI answers based on your files
- **Persistent** — Documents stay between sessions

</td>
<td>

### 🎨 Beautiful Design
- **Dark & Light themes** — Easy on the eyes
- **Glassmorphism** — Modern transparent design
- **Markdown rendering** — Code blocks with syntax highlighting

</td>
</tr>
</table>

<details>
<summary><strong>🔒 Privacy & Security</strong></summary>

- **Local-first** — All data stays on your device
- **Secure credentials** — API keys in OS credential manager
- **Zero telemetry** — No data collection, ever

</details>

---

## 📥 Installation

### Download Latest Release

| Platform | Installer | Portable |
|:--------:|:---------:|:--------:|
| **Windows** | [`.exe`](https://github.com/Razee4315/omnirecall/releases/latest) | [`.msi`](https://github.com/Razee4315/omnirecall/releases/latest) |
| **Linux** | [`.deb`](https://github.com/Razee4315/omnirecall/releases/latest) | [`.AppImage`](https://github.com/Razee4315/omnirecall/releases/latest) |

> **Note:** macOS support coming soon.

### Quick Setup

1. **Download & Install** the appropriate package for your OS
2. **Launch OmniRecall** from Start Menu (Windows) or Applications (Linux)
3. **Press `Alt+Space`** (Windows) or `Ctrl+Alt+Space` (Linux) to invoke
4. **Add API Key** — Click ⚙️ → Enter your Gemini/OpenAI key
5. **Start chatting!**

---

## 📖 Usage

### Keyboard Shortcuts

| Shortcut | Action |
|:---------|:-------|
| `Alt + Space` / `Ctrl+Alt+Space` | Toggle window at cursor |
| `Ctrl + ,` | Open Settings |
| `Escape` | Hide window |
| `Enter` | Send message |
| `Shift + Enter` | New line in message |

### Two Modes

| Spotlight Mode | Dashboard Mode |
|:---------------|:---------------|
| Appears at cursor | Full-screen interface |
| Quick questions & lookups | Manage chat history |
| Auto-hides on focus loss | Document management panel |
| Press shortcut to toggle | Click expand icon (↗) |

### Adding Documents

1. Click the **📁 folder icon** in the header
2. Select files: `.pdf`, `.txt`, `.md`, `.docx`, or code files
3. Documents load automatically
4. Ask: *"Summarize this document"* or *"What does section 3 say?"*

---

## 🔑 API Keys

| Provider | Get Key | Notes |
|:---------|:--------|:------|
| **Google Gemini** | [aistudio.google.com](https://aistudio.google.com/apikey) | ⭐ **Recommended** — Free tier |
| **OpenAI** | [platform.openai.com](https://platform.openai.com/api-keys) | Requires payment |
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com/) | Requires payment |
| **Ollama** | [ollama.ai](https://ollama.ai) | Local install, no API key needed |

---

## 🛠️ Development

### Prerequisites

- **Node.js** 18+
- **Rust** 1.70+
- **Platform tools**: See [Tauri prerequisites](https://tauri.app/start/prerequisites/)

### Build from Source

```bash
# Clone repository
git clone https://github.com/Razee4315/omnirecall.git
cd omnirecall

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build production release
npm run tauri build
```

### Project Structure

```
omnirecall/
├── src/                    # Frontend (Preact + TypeScript)
│   ├── components/         # UI components
│   │   ├── spotlight/      # Spotlight mode
│   │   ├── dashboard/      # Dashboard mode
│   │   └── settings/       # Settings panel
│   └── stores/             # State management (Signals)
├── src-tauri/              # Backend (Rust)
│   └── src/
│       ├── commands/       # Tauri IPC commands
│       └── services/       # AI client, document processing
└── demo/                   # Screenshots & demo video
```

### Tech Stack

| Component | Technology |
|:----------|:-----------|
| Framework | [Tauri v2](https://tauri.app/) |
| Frontend | [Preact](https://preactjs.com/) + TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Backend | [Rust](https://www.rust-lang.org/) |
| State | [Preact Signals](https://preactjs.com/guide/v10/signals/) |

---

## 🗺️ Roadmap

- [x] Multi-provider AI (Gemini, OpenAI, Claude, Ollama)
- [x] Document RAG with persistent storage
- [x] Streaming responses
- [x] Markdown rendering with code blocks
- [x] Windows & Linux builds
- [ ] Image support (vision models)
- [ ] Web search integration
- [ ] Voice input
- [ ] macOS support

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes and commit
git commit -m "Add amazing feature"

# Push and create a Pull Request
git push origin feature/amazing-feature
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

### Built with ❤️ by [Saqlain Razee](https://github.com/Razee4315)

[GitHub](https://github.com/Razee4315) &nbsp;•&nbsp; [LinkedIn](https://linkedin.com/in/saqlainrazee) &nbsp;•&nbsp; [Email](mailto:saqlainrazee@gmail.com)

<br/>

**⭐ Star this repository if you find it useful!**

[![GitHub Stars](https://img.shields.io/github/stars/Razee4315/omnirecall?style=social)](https://github.com/Razee4315/omnirecall/stargazers)

</div>
