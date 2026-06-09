# Context Resolver

> **Seamlessly continue AI conversations across tools when you hit context window limits.**

<p align="center">
  <img src="icons/icon-128.png" alt="Context Resolver Logo" width="128" height="128">
</p>

<p align="center">
  <strong>Capture → Compress → Continue</strong>
</p>

---

## The Problem

You're deep in a conversation with ChatGPT, debugging a complex issue. 50 messages in, you hit the context window limit. Now what?

- ❌ Manually copy-paste dozens of messages
- ❌ Re-explain all context from scratch in Claude
- ❌ Lose key decisions, code snippets, and requirements
- ❌ Waste 10-15 minutes reconstructing context

## The Solution

**Context Resolver** is a Chrome extension that acts as portable AI conversation memory:

1. **Capture** — One-click extraction of your full conversation from any supported AI tool
2. **Compress** — Intelligent compression that preserves key decisions, code, and requirements
3. **Continue** — One-click injection of compressed context into any other AI tool

All data stays **100% local** in your browser. No servers. No accounts. No tracking.

---

## Supported Platforms

| Platform | Capture | Inject |
|:---------|:-------:|:------:|
| 🤖 ChatGPT (`chatgpt.com`) | ✅ | ✅ |
| 🟠 Claude (`claude.ai`) | ✅ | ✅ |
| ✨ Gemini (`gemini.google.com`) | ✅ | ✅ |
| 🔍 Perplexity (`perplexity.ai`) | ✅ | ✅ |
| 🐋 DeepSeek (`chat.deepseek.com`) | ✅ | ✅ |
| ⚡ Grok (`grok.com`) | ✅ | ✅ |

---

## Features

### 🎯 One-Click Capture
Navigate to any supported AI chat and click **Capture Context**. The extension extracts all messages, preserving code blocks, formatting, and conversation structure.

### 📦 Smart Compression
Three compression levels to fit any context window:

| Level | Size | What's Preserved |
|:------|:-----|:-----------------|
| **Full** | 100% | Everything — raw conversation |
| **Summary** | ~30-40% | First/last exchanges + all code blocks + key decisions |
| **Key Points** | ~10-15% | Only decisions, requirements, action items, and code |

### 💉 Structured Injection
Injects context with a structured handoff prompt that tells the receiving AI tool:
- Where the conversation came from
- What decisions were made
- What code was discussed
- Where you left off

### 📚 Context Library
Manage multiple saved contexts with:
- Search and filter
- Platform-specific badges and colors
- Size tracking
- Timestamps

### 🔒 Privacy-First
- **Zero network requests** — all processing happens locally
- **No backend** — data stored in `chrome.storage.local`
- **No analytics** — no tracking, no telemetry
- **No accounts** — no sign-up required

### ⌨️ Keyboard Shortcuts
| Shortcut | Action |
|:---------|:-------|
| `⌘⇧C` / `Ctrl+Shift+C` | Capture context from current tab |
| `⌘⇧V` / `Ctrl+Shift+V` | Inject context into current tab |

### 💾 Export & Import
Backup your entire context library to JSON and import it on another machine.

---

## Installation

### Method 1: Download from GitHub Releases (Recommended)

This is the easiest way to install the extension for free:

1. Go to the [Releases page](https://github.com/PuneetDadhich/Context-Resolver/releases) of this repository.
2. Download the latest `context-resolver-vX.X.X.zip` file from the **Assets** section.
3. Extract the `.zip` file into a folder on your computer.
4. Open Google Chrome and navigate to `chrome://extensions/`.
5. Enable **Developer mode** (the toggle in the top-right corner).
6. Click the **Load unpacked** button in the top-left corner.
7. Select the folder you extracted in Step 3.
8. 📌 **Tip:** Click the puzzle piece icon in Chrome's toolbar and pin Context Resolver so the side panel is always accessible!

### Method 2: Build From Source (For Developers)

1. Clone this repository: `git clone https://github.com/PuneetDadhich/Context-Resolver.git`
2. Navigate to the project directory.
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode** and click **Load unpacked**
5. Select the cloned repository folder.

---

## Usage

### Capturing Context

1. Navigate to any supported AI chat (e.g., ChatGPT)
2. Have a conversation (or open an existing one)
3. Click the **Context Resolver** icon in the toolbar to open the side panel
4. Click **Capture Context**
5. Your conversation is saved to the library

### Injecting Context

1. Navigate to a different AI chat (e.g., Claude)
2. Open the Context Resolver side panel
3. Click on a saved context from your library
4. Choose a compression level (Full / Summary / Key Points)
5. Click **Inject into Current Chat**
6. The compressed context is pasted into the chat input
7. Send the message to continue your conversation

---

## Architecture

```
Context Resolver/
├── manifest.json                    # Manifest V3 configuration
├── icons/                           # Extension icons (16-128px)
├── background/
│   └── service-worker.js            # Event-driven message router
├── sidepanel/
│   ├── sidepanel.html               # Side panel UI
│   ├── sidepanel.css                # Premium dark-mode styles
│   └── sidepanel.js                 # UI logic & state management
├── content-scripts/
│   ├── platform-detector.js         # URL-based platform detection
│   ├── injector.js                  # Cross-platform injection utilities
│   └── adapters/
│       ├── base-adapter.js          # Abstract base adapter
│       ├── chatgpt-adapter.js       # ChatGPT DOM extraction
│       ├── claude-adapter.js        # Claude DOM extraction
│       ├── gemini-adapter.js        # Gemini DOM extraction
│       ├── perplexity-adapter.js    # Perplexity DOM extraction
│       ├── deepseek-adapter.js      # DeepSeek DOM extraction
│       └── grok-adapter.js          # Grok DOM extraction
├── lib/
│   ├── utils.js                     # Shared utilities
│   ├── storage.js                   # chrome.storage wrapper
│   ├── compressor.js                # Context compression engine
│   └── template.js                  # Handoff prompt templates
└── styles/
    └── design-tokens.css            # CSS design system
```

### Key Design Decisions

- **Multi-Signal DOM Extraction**: Each adapter uses a tiered strategy (semantic → structural → heuristic → fallback) to handle platform DOM changes gracefully
- **Rule-Based Compression**: Pattern matching for code blocks, decisions, requirements, and action items — no LLM dependency
- **SPA Navigation Aware**: MutationObserver detects URL changes for single-page app platforms
- **Message Passing Architecture**: Clean separation between content scripts, service worker, and side panel via `chrome.runtime.sendMessage`

---

## Troubleshooting

### "No supported AI platform detected"
Make sure you're on the chat page of a supported platform, not a settings or account page.

### Capture returns empty messages
Some platforms lazy-load messages. Try scrolling through the entire conversation before capturing.

### Injection doesn't paste text
Some platforms use custom editors (like ProseMirror or Quill). If direct injection fails, the text is copied to your clipboard — just paste manually with `Ctrl+V`.

### Extension icon not visible
Click the puzzle piece icon in Chrome's toolbar and pin Context Resolver.

---

## Contributing

Contributions are welcome! To add support for a new platform:

1. Create a new adapter in `content-scripts/adapters/`
2. Extend `BaseAdapter` and implement `static matches()`, `getMessages()`, `getInputElement()`
3. Register the adapter in `content-scripts/platform-detector.js`
4. Add the URL pattern to `manifest.json` (content_scripts matches + host_permissions)

---

## Privacy Policy

Context Resolver does **not** collect, transmit, or store any user data externally.

- All conversation data is stored locally in `chrome.storage.local`
- No network requests are made by the extension
- No analytics, tracking, or telemetry of any kind
- No user accounts or authentication
- The extension works entirely offline after installation

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Changelog

### v1.0.0 (2026-06-08)
- Initial release
- Support for 6 AI platforms: ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Grok
- Three compression levels: Full, Summary, Key Points
- Side panel UI with context library
- Export/Import functionality
- Keyboard shortcuts
