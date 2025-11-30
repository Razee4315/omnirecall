# Contributing to OmniRecall

First off, thank you for considering contributing to OmniRecall! It's people like you that make OmniRecall such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

**Bug Report Template:**

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
A clear description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g., Windows 11]
 - OmniRecall Version: [e.g., 1.0.0]
 - AI Provider: [e.g., Gemini, OpenAI]

**Additional context**
Add any other context about the problem here.
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- Use a clear and descriptive title
- Provide a detailed description of the suggested enhancement
- Explain why this enhancement would be useful
- Include mockups or examples if applicable

### Pull Requests

1. **Fork the repo** and create your branch from `main`
2. **Install dependencies**: `npm install`
3. **Make your changes** and ensure they follow our coding style
4. **Test your changes**: `npm run tauri dev`
5. **Update documentation** if needed
6. **Submit a pull request**

## Development Setup

### Prerequisites

- Node.js 18+
- Rust 1.70+
- Tauri CLI

### Local Development

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/omnirecall.git
cd omnirecall

# Install dependencies
npm install

# Start development server
npm run tauri dev
```

### Project Structure

```
omnirecall/
├── src/                    # Frontend (Preact + TypeScript)
│   ├── components/         # UI components
│   ├── stores/            # State management
│   └── styles/            # CSS styles
├── src-tauri/             # Backend (Rust)
│   └── src/
│       ├── commands/      # Tauri commands
│       └── services/      # Business logic
└── package.json
```

## Coding Guidelines

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow the existing code style
- Use meaningful variable and function names
- Add comments for complex logic
- Use Preact Signals for state management

### Rust

- Follow Rust naming conventions
- Use `Result` for error handling
- Document public functions with `///` comments
- Keep functions small and focused

### CSS

- Use Tailwind CSS utility classes
- Follow the design system in `tailwind.config.js`
- Use CSS variables for theming

### Commits

- Use clear, descriptive commit messages
- Start with a verb: "Add", "Fix", "Update", "Remove"
- Reference issues when applicable: "Fix #123"

**Examples:**
```
Add support for OpenAI GPT-4o model
Fix clipboard detection on Windows
Update README with installation instructions
Remove deprecated API endpoint
```

## Testing

Before submitting a PR:

1. Ensure the app builds: `npm run build`
2. Test in development: `npm run tauri dev`
3. Test the production build: `npm run tauri build`

## Getting Help

- Open an issue for questions
- Join discussions in GitHub Discussions
- Contact the maintainer: saqlainrazee@gmail.com

## Recognition

Contributors will be recognized in:
- The README.md file
- Release notes
- The app's About section

Thank you for contributing to OmniRecall!
