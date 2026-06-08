/**
 * Context Resolver — Injector
 * Shared injection utilities for cross-platform text injection.
 * This module provides additional injection methods beyond the base adapter.
 */

const ContextInjector = (() => {
  'use strict';

  /**
   * Copy text to clipboard as a fallback injection method.
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} True if copied successfully
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fallback: use execCommand
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
        document.body.appendChild(textarea);
        textarea.select();
        const result = document.execCommand('copy');
        document.body.removeChild(textarea);
        return result;
      } catch (e) {
        console.error('[Context Resolver] Clipboard copy failed:', e);
        return false;
      }
    }
  }

  /**
   * Show a floating notification on the page.
   * @param {string} message - Notification text
   * @param {'success'|'error'|'info'} type - Notification type
   */
  function showPageNotification(message, type = 'success') {
    // Remove any existing notifications
    const existing = document.querySelector('.cr-page-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'cr-page-notification';
    notification.setAttribute('role', 'alert');

    const colors = {
      success: { bg: 'rgba(0, 214, 143, 0.95)', text: '#fff' },
      error: { bg: 'rgba(255, 61, 113, 0.95)', text: '#fff' },
      info: { bg: 'rgba(108, 92, 231, 0.95)', text: '#fff' },
    };

    const { bg, text } = colors[type] || colors.info;

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${bg};
      color: ${text};
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 600;
      z-index: 2147483647;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      animation: cr-notification-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      pointer-events: none;
      max-width: 320px;
      line-height: 1.4;
    `;

    notification.textContent = message;

    // Add animation keyframes if not already added
    if (!document.querySelector('#cr-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'cr-notification-styles';
      style.textContent = `
        @keyframes cr-notification-in {
          from { opacity: 0; transform: translateY(-10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cr-notification-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'cr-notification-out 0.2s ease forwards';
      setTimeout(() => notification.remove(), 200);
    }, 3000);
  }

  return {
    copyToClipboard,
    showPageNotification,
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.ContextInjector = ContextInjector;
}
