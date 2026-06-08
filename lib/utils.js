/**
 * Context Resolver — Shared Utilities
 * Common helper functions used across the extension.
 */

// Use a namespace to avoid global collisions in content script context
const ContextResolverUtils = (() => {
  'use strict';

  /**
   * Generate a unique context ID with timestamp prefix.
   * @returns {string} Unique ID like "ctx_1717856400000_a3f2"
   */
  function generateId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6);
    return `ctx_${timestamp}_${random}`;
  }

  /**
   * Get current ISO 8601 timestamp.
   * @returns {string} ISO timestamp
   */
  function now() {
    return new Date().toISOString();
  }

  /**
   * Calculate the byte size of a string (UTF-8).
   * @param {string} str - Input string
   * @returns {number} Size in bytes
   */
  function byteSize(str) {
    return new Blob([str]).size;
  }

  /**
   * Format byte size to human-readable string.
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size like "12.3 KB"
   */
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  /**
   * Format a date to a human-readable relative time string.
   * @param {string} isoDate - ISO 8601 date string
   * @returns {string} Relative time like "2 hours ago"
   */
  function timeAgo(isoDate) {
    const date = new Date(isoDate);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  }

  /**
   * Truncate a string to a maximum length with ellipsis.
   * @param {string} str - Input string
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated string
   */
  function truncate(str, maxLength = 100) {
    if (!str || str.length <= maxLength) return str || '';
    return str.substring(0, maxLength - 1) + '…';
  }

  /**
   * Debounce a function call.
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * Sanitize HTML to plain text.
   * @param {string} html - HTML string
   * @returns {string} Plain text
   */
  function htmlToText(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }

  /**
   * Escape HTML special characters.
   * @param {string} str - Input string
   * @returns {string} Escaped string
   */
  function escapeHtml(str) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return str.replace(/[&<>"']/g, (char) => map[char]);
  }

  /**
   * Platform display names and icons.
   */
  const PLATFORMS = {
    chatgpt: { name: 'ChatGPT', icon: '🤖', color: '#10a37f' },
    claude: { name: 'Claude', icon: '🟠', color: '#d97757' },
    gemini: { name: 'Gemini', icon: '✨', color: '#4285f4' },
    perplexity: { name: 'Perplexity', icon: '🔍', color: '#20b8cd' },
    deepseek: { name: 'DeepSeek', icon: '🐋', color: '#4d6bfe' },
    grok: { name: 'Grok', icon: '⚡', color: '#1d9bf0' },
    unknown: { name: 'Unknown', icon: '❓', color: '#666666' },
  };

  /**
   * Get platform info by key.
   * @param {string} platformKey - Platform identifier
   * @returns {object} Platform info
   */
  function getPlatformInfo(platformKey) {
    return PLATFORMS[platformKey] || PLATFORMS.unknown;
  }

  /**
   * Count total messages in a context.
   * @param {Array} messages - Array of message objects
   * @returns {{ user: number, assistant: number, total: number }}
   */
  function countMessages(messages) {
    const user = messages.filter((m) => m.role === 'user').length;
    const assistant = messages.filter((m) => m.role === 'assistant').length;
    return { user, assistant, total: messages.length };
  }

  /**
   * Extract a title from the first user message.
   * @param {Array} messages - Array of message objects
   * @returns {string} Generated title
   */
  function generateTitle(messages) {
    const firstUser = messages.find((m) => m.role === 'user');
    if (!firstUser) return 'Untitled Context';
    // Take the first line, truncated
    const firstLine = firstUser.content.split('\n')[0].trim();
    return truncate(firstLine, 60) || 'Untitled Context';
  }

  // Expose public API
  return {
    generateId,
    now,
    byteSize,
    formatBytes,
    timeAgo,
    truncate,
    debounce,
    htmlToText,
    escapeHtml,
    PLATFORMS,
    getPlatformInfo,
    countMessages,
    generateTitle,
  };
})();

// Make available in module context (service worker) if needed
if (typeof globalThis !== 'undefined') {
  globalThis.ContextResolverUtils = ContextResolverUtils;
}
