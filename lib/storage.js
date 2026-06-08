/**
 * Context Resolver — Storage Layer
 * Type-safe wrapper around chrome.storage.local for context CRUD operations.
 */

const ContextStorage = (() => {
  'use strict';

  const STORAGE_KEYS = {
    CONTEXTS: 'cr_contexts',
    SETTINGS: 'cr_settings',
  };

  const DEFAULT_SETTINGS = {
    defaultCompression: 'summary',
    theme: 'dark',
    maxContexts: 50,
    autoDetectPlatform: true,
    showNotifications: true,
  };

  // ─── Settings ───────────────────────────────────────────

  /**
   * Get extension settings, merged with defaults.
   * @returns {Promise<object>} Settings object
   */
  async function getSettings() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) };
  }

  /**
   * Update extension settings (partial update).
   * @param {object} updates - Partial settings object
   * @returns {Promise<object>} Updated settings
   */
  async function updateSettings(updates) {
    const current = await getSettings();
    const merged = { ...current, ...updates };
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: merged });
    return merged;
  }

  // ─── Contexts CRUD ─────────────────────────────────────

  /**
   * Get all saved contexts, sorted by capturedAt (newest first).
   * @returns {Promise<Array>} Array of context objects
   */
  async function getAllContexts() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CONTEXTS);
    const contexts = result[STORAGE_KEYS.CONTEXTS] || [];
    return contexts.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
  }

  /**
   * Get a single context by ID.
   * @param {string} id - Context ID
   * @returns {Promise<object|null>} Context object or null
   */
  async function getContext(id) {
    const contexts = await getAllContexts();
    return contexts.find((ctx) => ctx.id === id) || null;
  }

  /**
   * Save a new context.
   * @param {object} context - Context object to save
   * @returns {Promise<object>} Saved context with generated metadata
   */
  async function saveContext(context) {
    const contexts = await getAllContexts();
    const settings = await getSettings();

    // Generate metadata if not provided
    const enriched = {
      id: context.id || ContextResolverUtils.generateId(),
      title: context.title || ContextResolverUtils.generateTitle(context.messages || []),
      source: context.source || 'unknown',
      sourceUrl: context.sourceUrl || '',
      capturedAt: context.capturedAt || ContextResolverUtils.now(),
      messageCount: (context.messages || []).length,
      messages: context.messages || [],
      summary: context.summary || '',
      keyPoints: context.keyPoints || [],
      tags: context.tags || [],
      sizeBytes: ContextResolverUtils.byteSize(JSON.stringify(context.messages || [])),
    };

    // Enforce max contexts limit — remove oldest if at capacity
    if (contexts.length >= settings.maxContexts) {
      contexts.pop(); // Remove oldest (already sorted newest-first)
    }

    contexts.unshift(enriched);
    await chrome.storage.local.set({ [STORAGE_KEYS.CONTEXTS]: contexts });
    return enriched;
  }

  /**
   * Update an existing context by ID (partial update).
   * @param {string} id - Context ID
   * @param {object} updates - Partial context updates
   * @returns {Promise<object|null>} Updated context or null if not found
   */
  async function updateContext(id, updates) {
    const contexts = await getAllContexts();
    const index = contexts.findIndex((ctx) => ctx.id === id);
    if (index === -1) return null;

    contexts[index] = { ...contexts[index], ...updates };

    // Recalculate size if messages changed
    if (updates.messages) {
      contexts[index].messageCount = updates.messages.length;
      contexts[index].sizeBytes = ContextResolverUtils.byteSize(
        JSON.stringify(updates.messages)
      );
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.CONTEXTS]: contexts });
    return contexts[index];
  }

  /**
   * Delete a context by ID.
   * @param {string} id - Context ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async function deleteContext(id) {
    const contexts = await getAllContexts();
    const filtered = contexts.filter((ctx) => ctx.id !== id);
    if (filtered.length === contexts.length) return false;
    await chrome.storage.local.set({ [STORAGE_KEYS.CONTEXTS]: filtered });
    return true;
  }

  /**
   * Delete all saved contexts.
   * @returns {Promise<void>}
   */
  async function clearAllContexts() {
    await chrome.storage.local.set({ [STORAGE_KEYS.CONTEXTS]: [] });
  }

  /**
   * Get storage usage statistics.
   * @returns {Promise<object>} Usage stats
   */
  async function getStorageStats() {
    const contexts = await getAllContexts();
    const totalBytes = contexts.reduce((sum, ctx) => sum + (ctx.sizeBytes || 0), 0);
    return {
      contextCount: contexts.length,
      totalSizeBytes: totalBytes,
      totalSizeFormatted: ContextResolverUtils.formatBytes(totalBytes),
    };
  }

  /**
   * Export all contexts as a JSON string (for backup).
   * @returns {Promise<string>} JSON string of all contexts
   */
  async function exportAll() {
    const contexts = await getAllContexts();
    const settings = await getSettings();
    return JSON.stringify({ contexts, settings, exportedAt: ContextResolverUtils.now() }, null, 2);
  }

  /**
   * Import contexts from a JSON string.
   * @param {string} jsonString - JSON string with contexts array
   * @returns {Promise<number>} Number of contexts imported
   */
  async function importAll(jsonString) {
    const data = JSON.parse(jsonString);
    if (!data.contexts || !Array.isArray(data.contexts)) {
      throw new Error('Invalid import format: missing contexts array');
    }

    const existing = await getAllContexts();
    const existingIds = new Set(existing.map((c) => c.id));

    // Only import contexts that don't already exist
    const newContexts = data.contexts.filter((c) => !existingIds.has(c.id));
    const merged = [...existing, ...newContexts];

    await chrome.storage.local.set({ [STORAGE_KEYS.CONTEXTS]: merged });

    // Import settings if present
    if (data.settings) {
      await updateSettings(data.settings);
    }

    return newContexts.length;
  }

  return {
    getSettings,
    updateSettings,
    getAllContexts,
    getContext,
    saveContext,
    updateContext,
    deleteContext,
    clearAllContexts,
    getStorageStats,
    exportAll,
    importAll,
    STORAGE_KEYS,
    DEFAULT_SETTINGS,
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.ContextStorage = ContextStorage;
}
