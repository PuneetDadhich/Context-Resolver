/**
 * Context Resolver — Platform Detector
 * Detects which AI platform is active and routes messages to the correct adapter.
 * This is the main entry point for content scripts.
 */

(() => {
  'use strict';

  // Registry of all platform adapters
  const ADAPTERS = [
    ChatGPTAdapter,
    ClaudeAdapter,
    GeminiAdapter,
    PerplexityAdapter,
    DeepSeekAdapter,
    GrokAdapter,
  ];

  let activeAdapter = null;

  /**
   * Detect which platform the current page belongs to.
   * @returns {BaseAdapter|null} The matched adapter instance, or null
   */
  function detectPlatform() {
    const url = window.location.href;

    for (const AdapterClass of ADAPTERS) {
      if (AdapterClass.matches(url)) {
        return new AdapterClass();
      }
    }

    return null;
  }

  /**
   * Initialize: detect platform and notify the service worker.
   */
  function init() {
    activeAdapter = detectPlatform();

    if (activeAdapter) {
      console.log(`[Context Resolver] Detected platform: ${activeAdapter.platformKey}`);

      // Notify the service worker
      chrome.runtime.sendMessage({
        type: 'PLATFORM_DETECTED',
        data: { platform: activeAdapter.platformKey },
      }).catch(() => {
        // Service worker may not be ready yet
      });
    }
  }

  /**
   * Handle messages from the service worker.
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!activeAdapter) {
      sendResponse({
        success: false,
        error: 'No supported AI platform detected on this page.',
      });
      return true;
    }

    switch (message.type) {
      case 'EXTRACT_CONTEXT':
        try {
          const data = activeAdapter.extract();
          if (!data.messages || data.messages.length === 0) {
            sendResponse({
              success: false,
              error: 'No conversation messages found. Make sure you have an active conversation.',
            });
          } else {
            sendResponse({ success: true, data });
          }
        } catch (error) {
          console.error('[Context Resolver] Extraction error:', error);
          sendResponse({
            success: false,
            error: `Extraction failed: ${error.message}`,
          });
        }
        break;

      case 'INJECT_CONTEXT':
        try {
          const { context, compression } = message.data;

          // Import compressor and template modules
          // They're loaded via content_scripts in manifest.json, but we need
          // them here. Since they attach to globalThis, they should be available.
          const compressor = globalThis.ContextCompressor;
          const template = globalThis.ContextTemplate;

          if (!compressor || !template) {
            sendResponse({
              success: false,
              error: 'Compression modules not loaded. Please refresh the page.',
            });
            break;
          }

          // Compress the context
          const compressed = compressor.compress(context.messages, compression);

          // Generate the handoff prompt
          const handoffText = template.generateForPlatform(
            context,
            compressed.text,
            compression,
            activeAdapter.platformKey
          );

          // Inject into the chat input
          const injected = activeAdapter.injectText(handoffText);

          if (injected) {
            sendResponse({ success: true });
          } else {
            sendResponse({
              success: false,
              error: 'Could not find the chat input. Make sure the chat is open and visible.',
            });
          }
        } catch (error) {
          console.error('[Context Resolver] Injection error:', error);
          sendResponse({
            success: false,
            error: `Injection failed: ${error.message}`,
          });
        }
        break;

      default:
        sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
    }

    return true; // Keep sendResponse channel open for async
  });

  // Initialize on load
  init();

  // Re-detect on URL changes (SPA navigation)
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      init();
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });
})();
