# Privacy Policy — Context Resolver

**Last Updated:** June 8, 2026

## Overview

Context Resolver is a Chrome extension that helps users transfer conversation context between AI chat tools. This privacy policy explains how the extension handles your data.

## Data Collection

**Context Resolver does NOT collect any data.**

Specifically, the extension:

- ❌ Does NOT send any data to external servers
- ❌ Does NOT make any network requests
- ❌ Does NOT use analytics or tracking services
- ❌ Does NOT collect usage statistics
- ❌ Does NOT require user accounts or authentication
- ❌ Does NOT use cookies or tracking pixels
- ❌ Does NOT share data with third parties

## Data Storage

All data is stored **locally on your device** using Chrome's built-in `chrome.storage.local` API:

- **Saved Contexts**: Conversation extracts you capture are stored locally in your browser profile
- **Settings**: Your preferences (compression level, max contexts) are stored locally
- **No Cloud Sync**: Data is NOT synced to any cloud service

## Data Processing

All data processing happens **entirely within your browser**:

- **Context Extraction**: The extension reads the DOM of supported AI chat pages to extract conversation text. This happens locally in your browser tab.
- **Context Compression**: Text compression uses local rule-based algorithms. No AI APIs or external services are used.
- **Context Injection**: Compressed text is pasted into chat input fields locally.

## Permissions Explained

| Permission | Why It's Needed |
|:-----------|:----------------|
| `storage` | To save captured contexts and settings locally |
| `sidePanel` | To display the extension's main UI in Chrome's side panel |
| `activeTab` | To access the current tab when you click Capture or Inject |
| `scripting` | To inject content scripts into AI chat pages for extraction/injection |
| Host permissions | To run on specific AI platform domains (ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Grok) |

## Data Deletion

You can delete all stored data at any time:

1. Open the Context Resolver side panel
2. Go to Settings
3. Click "Clear All Contexts"

Alternatively, uninstalling the extension removes all stored data.

## Third-Party Services

Context Resolver uses **zero** third-party services. The only external resources loaded are:

- **Google Fonts** (Inter, JetBrains Mono) — loaded in the side panel for typography. These requests are subject to [Google's Privacy Policy](https://policies.google.com/privacy).

## Children's Privacy

Context Resolver does not knowingly collect information from children under 13 years of age.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue on the project's GitHub repository.
