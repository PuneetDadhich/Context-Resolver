/**
 * Context Resolver — Service Worker (Background Script)
 * Event-driven message router and context lifecycle manager.
 * Coordinates between content scripts, side panel, and storage.
 */

// Import shared modules
importScripts('../lib/utils.js', '../lib/storage.js');

// ─── Extension Lifecycle ──────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[Context Resolver] Extension installed');
    // Initialize default settings
    await ContextStorage.updateSettings(ContextStorage.DEFAULT_SETTINGS);
  }

  // Enable side panel on action click
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

// ─── Action Click → Open Side Panel ───────────────────────

chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel && chrome.sidePanel.open) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// ─── Keyboard Command Handlers ────────────────────────────

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'capture-context') {
    await handleCaptureFromTab(tab);
  } else if (command === 'inject-context') {
    // Tell side panel to show inject mode
    try {
      await chrome.runtime.sendMessage({
        type: 'SHOW_INJECT_PICKER',
        tabId: tab.id,
      });
    } catch (e) {
      // Side panel may not be open
      console.log('[Context Resolver] Side panel not open for inject command');
    }
  }
});

// ─── Message Router ───────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('[Context Resolver] Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    });

  // Return true to indicate we'll respond asynchronously
  return true;
});

/**
 * Central message handler — routes messages to the appropriate handler.
 * @param {object} message - Message object with `type` and data
 * @param {object} sender - Message sender info
 * @returns {Promise<object>} Response object
 */
async function handleMessage(message, sender) {
  switch (message.type) {
    // ─── Content Script → Service Worker ───
    case 'CONTEXT_CAPTURED':
      return handleContextCaptured(message.data);

    case 'PLATFORM_DETECTED':
      return handlePlatformDetected(message.data, sender);

    case 'INJECTION_COMPLETE':
      return { success: true };

    // ─── Side Panel → Service Worker ───
    case 'CAPTURE_CONTEXT':
      return handleCaptureRequest(message.tabId);

    case 'INJECT_CONTEXT':
      return handleInjectRequest(message.contextId, message.tabId, message.compression);

    case 'GET_ALL_CONTEXTS':
      return handleGetAllContexts();

    case 'GET_CONTEXT':
      return handleGetContext(message.contextId);

    case 'DELETE_CONTEXT':
      return handleDeleteContext(message.contextId);

    case 'UPDATE_CONTEXT':
      return handleUpdateContext(message.contextId, message.updates);

    case 'CLEAR_ALL_CONTEXTS':
      return handleClearAll();

    case 'GET_SETTINGS':
      return handleGetSettings();

    case 'UPDATE_SETTINGS':
      return handleUpdateSettings(message.settings);

    case 'GET_STORAGE_STATS':
      return handleGetStorageStats();

    case 'EXPORT_ALL':
      return handleExportAll();

    case 'IMPORT_ALL':
      return handleImportAll(message.jsonString);

    case 'GET_ACTIVE_PLATFORM':
      return handleGetActivePlatform(message.tabId);

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

// ─── Handler Implementations ──────────────────────────────

/**
 * Handle context data arriving from a content script.
 */
async function handleContextCaptured(data) {
  const context = await ContextStorage.saveContext(data);

  // Notify side panel that a new context was saved
  try {
    await chrome.runtime.sendMessage({
      type: 'CONTEXT_SAVED',
      context,
    });
  } catch (e) {
    // Side panel might not be open
  }

  return { success: true, context };
}

/**
 * Handle platform detection report from content script.
 */
async function handlePlatformDetected(data, sender) {
  // Store the detected platform for this tab
  const tabId = sender.tab?.id;
  if (tabId) {
    await chrome.storage.session.set({ [`platform_${tabId}`]: data.platform });
  }
  return { success: true };
}

/**
 * Request context capture from the active tab's content script.
 */
async function handleCaptureRequest(tabId) {
  try {
    // Get the active tab if no tabId provided
    if (!tabId) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return { success: false, error: 'No active tab found' };
      tabId = tab.id;
    }

    // Try sending to existing content script first
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'EXTRACT_CONTEXT',
      });

      if (response && response.success) {
        const context = await ContextStorage.saveContext(response.data);
        return { success: true, context };
      }

      return { success: false, error: response?.error || 'Extraction failed' };
    } catch (connectionError) {
      // Content script not loaded — inject programmatically and retry
      console.log('[Context Resolver] Content scripts not found, injecting programmatically...');
      const injected = await injectContentScripts(tabId);
      if (!injected) {
        return {
          success: false,
          error: 'This page is not a supported AI tool, or the extension does not have permission to access it.',
        };
      }

      // Wait briefly for scripts to initialize
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Retry the capture
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'EXTRACT_CONTEXT',
      });

      if (response && response.success) {
        const context = await ContextStorage.saveContext(response.data);
        return { success: true, context };
      }

      return { success: false, error: response?.error || 'Extraction failed after script injection' };
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to capture: ${error.message}. Make sure you're on a supported AI tool page.`,
    };
  }
}

/**
 * Programmatically inject content scripts into a tab.
 * Used as fallback when manifest-declared scripts haven't loaded
 * (e.g., tab was open before extension was installed).
 * @param {number} tabId - Tab ID to inject into
 * @returns {Promise<boolean>} True if injection succeeded
 */
async function injectContentScripts(tabId) {
  // The content script files in load order
  const scriptFiles = [
    'lib/utils.js',
    'lib/compressor.js',
    'lib/template.js',
    'content-scripts/adapters/base-adapter.js',
    'content-scripts/adapters/chatgpt-adapter.js',
    'content-scripts/adapters/claude-adapter.js',
    'content-scripts/adapters/gemini-adapter.js',
    'content-scripts/adapters/perplexity-adapter.js',
    'content-scripts/adapters/deepseek-adapter.js',
    'content-scripts/adapters/grok-adapter.js',
    'content-scripts/platform-detector.js',
    'content-scripts/injector.js',
  ];

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: scriptFiles,
    });
    console.log('[Context Resolver] Content scripts injected successfully');
    return true;
  } catch (error) {
    console.error('[Context Resolver] Failed to inject content scripts:', error);
    return false;
  }
}

/**
 * Inject context into the active tab's AI tool.
 */
async function handleInjectRequest(contextId, tabId, compression = 'summary') {
  try {
    const context = await ContextStorage.getContext(contextId);
    if (!context) return { success: false, error: 'Context not found' };

    // Get target tab
    if (!tabId) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return { success: false, error: 'No active tab found' };
      tabId = tab.id;
    }

    try {
      // Send inject request to the content script
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'INJECT_CONTEXT',
        data: {
          context,
          compression,
        },
      });

      return response || { success: false, error: 'Injection failed' };
    } catch (connectionError) {
      console.log('[Context Resolver] Content scripts not found for injection, injecting programmatically...');
      const injected = await injectContentScripts(tabId);
      if (!injected) {
         return {
          success: false,
          error: 'This page is not a supported AI tool, or the extension does not have permission to access it.',
        };
      }

      // Wait briefly for scripts to initialize
      await new Promise((resolve) => setTimeout(resolve, 500));

      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'INJECT_CONTEXT',
        data: {
          context,
          compression,
        },
      });
      return response || { success: false, error: 'Injection failed after script injection' };
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to inject: ${error.message}. Make sure you're on a supported AI tool page.`,
    };
  }
}

/**
 * Trigger capture from a tab (used by keyboard shortcut).
 */
async function handleCaptureFromTab(tab) {
  try {
    const result = await handleCaptureRequest(tab.id);
    if (result.success) {
      // Open side panel to show the captured context
      if (chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }
    }
  } catch (e) {
    console.error('[Context Resolver] Capture from tab failed:', e);
  }
}

// ─── Storage Proxy Handlers ───────────────────────────────

async function handleGetAllContexts() {
  const contexts = await ContextStorage.getAllContexts();
  return { success: true, contexts };
}

async function handleGetContext(contextId) {
  const context = await ContextStorage.getContext(contextId);
  return context
    ? { success: true, context }
    : { success: false, error: 'Context not found' };
}

async function handleDeleteContext(contextId) {
  const deleted = await ContextStorage.deleteContext(contextId);
  return { success: deleted };
}

async function handleUpdateContext(contextId, updates) {
  const context = await ContextStorage.updateContext(contextId, updates);
  return context
    ? { success: true, context }
    : { success: false, error: 'Context not found' };
}

async function handleClearAll() {
  await ContextStorage.clearAllContexts();
  return { success: true };
}

async function handleGetSettings() {
  const settings = await ContextStorage.getSettings();
  return { success: true, settings };
}

async function handleUpdateSettings(settings) {
  const updated = await ContextStorage.updateSettings(settings);
  return { success: true, settings: updated };
}

async function handleGetStorageStats() {
  const stats = await ContextStorage.getStorageStats();
  return { success: true, stats };
}

async function handleExportAll() {
  const json = await ContextStorage.exportAll();
  return { success: true, json };
}

async function handleImportAll(jsonString) {
  try {
    const count = await ContextStorage.importAll(jsonString);
    return { success: true, imported: count };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleGetActivePlatform(tabId) {
  if (!tabId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
  }
  if (!tabId) return { success: false, error: 'No active tab' };

  const result = await chrome.storage.session.get(`platform_${tabId}`);
  const platform = result[`platform_${tabId}`] || null;
  return { success: true, platform };
}

console.log('[Context Resolver] Service worker initialized');
