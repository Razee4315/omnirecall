<h1 align="center">OmniRecall</h1>

<p align="center">
  <strong>Your AI-Powered Knowledge Assistant</strong><br>
  Instant access to AI chat with document context, right at your cursor.
</p>

<p align="center">
  <a href="#demo">Demo</a> •
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#development">Development</a>
</p>

<p align="center">
  <a href="https://github.com/Razee4315/omnirecall/releases">
    <img src="https://img.shields.io/github/v/release/Razee4315/omnirecall?style=flat-square&color=blue" alt="Release">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  </a>
  <a href="https://github.com/Razee4315/omnirecall/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/Razee4315/omnirecall/ci.yml?style=flat-square" alt="Build">
  </a>
  <img src="https://img.shields.io/badge/platform-Windows%20|%20macOS%20|%20Linux-lightgrey?style=flat-square" alt="Platform">
</p>

---

## Demo

## Demo

<video src="https://github.com/user-attachments/assets/demo.mp4" controls="controls" style="max-width: 100%;">
</video>

> [Download Video](demo/demo.mp4)

---

## Screenshots

| Spotlight Mode | Dashboard Mode |
|----------------|----------------|
| ![Spotlight](demo/spotlight.png) | ![Dashboard](demo/dashboard.png) |


---

## Features

### 🚀 Instant Access
- **Appears at cursor** - Press `Alt+Space` and the window appears right where you're working
- **Spotlight-style UI** - Clean, minimal interface that doesn't interrupt your flow
- **System tray** - Always running in background, ready when you need it

### 🤖 Multi-Provider AI
| Provider | Models | Free Tier |
|----------|--------|-----------|
| **Google Gemini** | gemini-2.0-flash, gemini-1.5-pro | Generous |
| **OpenAI** | GPT-4o, GPT-4-turbo | No |
| **Anthropic** | Claude 3.5 Sonnet, Haiku | No |
| **Ollama** | Llama 3.2, Mistral, any local | 100% Local |

### Document RAG
- **Add documents** - PDF, TXT, MD, code files
- **Context-aware** - AI answers based on your documents
- **Persistent** - Documents stay loaded between sessions

### Smart Chat
- **Markdown rendering** - Bold, lists, headers formatted beautifully
- **Code blocks** - Syntax display with one-click copy
- **Chat history** - Persistent conversations, searchable

### Beautiful UI
- **Dark & Light themes** - Easy on the eyes
- **Glass effect** - Modern transparent design
- **Responsive** - Adapts to Spotlight and Dashboard modes

### Privacy First
- **Local storage** - All data stays on your device
- **Your API keys** - Stored securely in OS credential manager
- **No telemetry** - Zero data collection

---

## Installation

### Download

Get the latest release for your platform:

| Platform | Download | Size |
|----------|----------|------|
| **Windows** | [OmniRecall_x64-setup.exe](https://github.com/Razee4315/omnirecall/releases/latest) | ~3 MB |
| **Windows** | [OmniRecall_x64.msi](https://github.com/Razee4315/omnirecall/releases/latest) | ~5 MB |
| **macOS** | Coming soon | - |
| **Linux** | Coming soon | - |

### Build from Source

```bash
# Prerequisites: Node.js 18+, Rust 1.70+

# Clone
git clone https://github.com/Razee4315/omnirecall.git
cd omnirecall

# Install dependencies
npm install

# Development
npm run tauri dev

# Production build
npm run tauri build
```

---

## Usage

### Quick Start

1. **Launch** OmniRecall from Start Menu or desktop
2. **Press `Alt+Space`** to open at your cursor
3. **Add API Key** - Click ⚙️ Settings → Add your Gemini/OpenAI key
4. **Start chatting!**

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + Space` | Toggle window at cursor |
| `Ctrl + ,` | Open Settings |
| `Escape` | Hide window |
| `Enter` | Send message |
| `Shift + Enter` | New line |

### Two Modes

**Spotlight Mode** (Small Window)
- Quick questions
- Appears at cursor
- Hides when clicking outside
- Perfect for quick lookups

**Dashboard Mode** (Full Window)
- Click expand icon or use full interface
- Chat history sidebar
- Document management
- Stays open until you close it

### Adding Documents

1. Click 📁 folder icon in header
2. Select PDF, TXT, MD, or code files
3. Documents load automatically
4. Ask questions about your docs!

---

## Configuration

### Get API Keys

| Provider | Link | Notes |
|----------|------|-------|
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | **Recommended** - Free, fast |
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | Requires payment |
| Anthropic | [console.anthropic.com](https://console.anthropic.com/) | Requires payment |
| Ollama | [ollama.ai](https://ollama.ai) | 100% local, free |

### Settings

Access via `Ctrl + ,`:

- **AI Providers** - Add/test API keys, select default model
- **Appearance** - Dark/Light theme
- **Shortcuts** - View keyboard shortcuts

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Tauri v2](https://tauri.app/) |
| Frontend | [Preact](https://preactjs.com/) + TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Backend | [Rust](https://www.rust-lang.org/) |
| State | [Preact Signals](https://preactjs.com/guide/v10/signals/) |
| Storage | [Tauri Store](https://tauri.app/plugin/store/) |

---

## Development

### Project Structure

```
omnirecall/
├── src/                    # Frontend
│   ├── components/         # UI components
│   │   ├── spotlight/      # Spotlight mode
│   │   ├── dashboard/      # Dashboard mode
│   │   ├── settings/       # Settings panel
│   │   ├── common/         # Shared (Markdown, etc.)
│   │   └── icons/          # SVG icons
│   ├── stores/             # State management
│   └── styles/             # CSS
├── src-tauri/              # Backend (Rust)
│   └── src/
│       ├── commands/       # IPC commands
│       └── services/       # AI client, documents
├── demo/                   # Demo video & screenshots
└── .github/workflows/      # CI/CD
```

### Commands

```bash
npm run dev          # Frontend only (port 1420)
npm run tauri dev    # Full app with hot reload
npm run tauri build  # Production build
npm run build        # TypeScript check
```

---

## Roadmap

- [x] Multi-provider AI support
- [x] Document RAG
- [x] Persistent chat history
- [x] Markdown rendering
- [x] Cursor-position window
- [ ] Streaming responses (real-time typing)
- [ ] Clipboard integration
- [ ] Voice input
- [ ] Image support (vision models)
- [ ] macOS & Linux builds
- [ ] Web search integration

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
# Fork → Clone → Branch → Code → PR
git checkout -b feature/your-feature
git commit -m "Add your feature"
git push origin feature/your-feature
```

---

## License

MIT License - see [LICENSE](LICENSE)

---

## Author

<p align="center">
  <strong>Saqlain Razee</strong><br>
  <a href="https://github.com/Razee4315">GitHub</a> •
  <a href="https://linkedin.com/in/saqlainrazee">LinkedIn</a> •
  <a href="mailto:saqlainrazee@gmail.com">Email</a>
</p>

---

<p align="center">
  <strong>⭐ Star this repo if you find it useful!</strong>
</p>

<p align="center">
  <a href="https://github.com/Razee4315/omnirecall/stargazers">
    <img src="https://img.shields.io/github/stars/Razee4315/omnirecall?style=social" alt="Stars">
  </a>
</p>
