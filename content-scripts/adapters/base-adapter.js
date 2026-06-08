/**
 * Context Resolver — Base Adapter
 * Abstract base class for platform-specific DOM extractors/injectors.
 * Each platform adapter extends this class and overrides the abstract methods.
 */

class BaseAdapter {
  /**
   * @param {string} platformKey - Platform identifier (e.g., 'chatgpt', 'claude')
   */
  constructor(platformKey) {
    this.platformKey = platformKey;
  }

  /**
   * Check if this adapter matches the current page URL.
   * @param {string} url - The current page URL
   * @returns {boolean} True if this adapter handles this URL
   */
  static matches(url) {
    throw new Error('Subclass must implement static matches()');
  }

  /**
   * Extract the conversation title from the page.
   * @returns {string} Conversation title
   */
  getConversationTitle() {
    // Default: try to find a common title element
    const titleEl =
      document.querySelector('h1') ||
      document.querySelector('[data-testid="conversation-title"]') ||
      document.querySelector('title');
    return titleEl?.textContent?.trim() || 'Untitled Conversation';
  }

  /**
   * Extract all messages from the conversation.
   * @returns {Array<{role: string, content: string}>} Array of message objects
   */
  getMessages() {
    throw new Error('Subclass must implement getMessages()');
  }

  /**
   * Get the chat input element (textarea or contenteditable div).
   * @returns {HTMLElement|null} The input element
   */
  getInputElement() {
    throw new Error('Subclass must implement getInputElement()');
  }

  /**
   * Inject text into the chat input.
   * @param {string} text - Text to inject
   * @returns {boolean} True if injection succeeded
   */
  injectText(text) {
    const input = this.getInputElement();
    if (!input) return false;

    try {
      // Focus the input
      input.focus();

      if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
        // For standard input elements
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set || Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;

        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(input, text);
        } else {
          input.value = text;
        }

        // Dispatch events to trigger React/framework state updates
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (input.contentEditable === 'true' || input.getAttribute('contenteditable')) {
        // For contenteditable divs (used by some platforms)
        input.focus();

        // Clear existing content
        input.innerHTML = '';

        // Use execCommand for better framework compatibility
        document.execCommand('insertText', false, text);

        // Also dispatch input events
        input.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text,
        }));
      }

      return true;
    } catch (error) {
      console.error(`[Context Resolver] Injection failed for ${this.platformKey}:`, error);
      return false;
    }
  }

  /**
   * Extract text content from an element, preserving code blocks.
   * @param {HTMLElement} element - The element to extract text from
   * @returns {string} Extracted text with code blocks preserved
   */
  extractTextContent(element) {
    if (!element) return '';

    const clone = element.cloneNode(true);
    const parts = [];

    // Walk through child nodes
    this._walkNodes(clone, parts);

    return parts.join('').trim();
  }

  /**
   * Recursively walk DOM nodes and extract text with formatting.
   * @param {Node} node - The node to process
   * @param {Array} parts - Output array
   * @private
   */
  _walkNodes(node, parts) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        parts.push(child.textContent);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();

        if (tag === 'pre' || (tag === 'code' && child.parentElement?.tagName.toLowerCase() === 'pre')) {
          // Preserve code blocks
          const lang = child.className?.match(/language-(\w+)/)?.[1] || '';
          const codeEl = tag === 'pre' ? child.querySelector('code') || child : child;
          parts.push(`\n\`\`\`${lang}\n${codeEl.textContent}\n\`\`\`\n`);
        } else if (tag === 'code') {
          // Inline code
          parts.push(`\`${child.textContent}\``);
        } else if (tag === 'br') {
          parts.push('\n');
        } else if (tag === 'p' || tag === 'div') {
          parts.push('\n');
          this._walkNodes(child, parts);
          parts.push('\n');
        } else if (tag === 'li') {
          parts.push('\n- ');
          this._walkNodes(child, parts);
        } else if (tag === 'ol') {
          let i = 1;
          for (const li of child.children) {
            parts.push(`\n${i}. `);
            this._walkNodes(li, parts);
            i++;
          }
        } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
          const level = parseInt(tag[1]);
          parts.push(`\n${'#'.repeat(level)} `);
          this._walkNodes(child, parts);
          parts.push('\n');
        } else if (tag === 'strong' || tag === 'b') {
          parts.push('**');
          this._walkNodes(child, parts);
          parts.push('**');
        } else if (tag === 'em' || tag === 'i') {
          parts.push('*');
          this._walkNodes(child, parts);
          parts.push('*');
        } else if (tag === 'a') {
          const href = child.getAttribute('href');
          parts.push('[');
          this._walkNodes(child, parts);
          parts.push(`](${href})`);
        } else if (tag === 'img') {
          // Skip images but note them
          const alt = child.getAttribute('alt') || 'image';
          parts.push(`[${alt}]`);
        } else if (tag === 'table') {
          parts.push('\n');
          this._extractTable(child, parts);
          parts.push('\n');
        } else if (!['script', 'style', 'svg', 'button', 'nav'].includes(tag)) {
          this._walkNodes(child, parts);
        }
      }
    }
  }

  /**
   * Extract table content as markdown.
   * @param {HTMLElement} table - Table element
   * @param {Array} parts - Output array
   * @private
   */
  _extractTable(table, parts) {
    const rows = table.querySelectorAll('tr');
    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('th, td');
      const cellTexts = Array.from(cells).map((c) => c.textContent.trim());
      parts.push('| ' + cellTexts.join(' | ') + ' |\n');
      if (rowIndex === 0) {
        parts.push('| ' + cellTexts.map(() => '---').join(' | ') + ' |\n');
      }
    });
  }

  /**
   * Full extraction pipeline: get all data from the page.
   * @returns {object} Extracted context data
   */
  extract() {
    const messages = this.getMessages();
    const title = this.getConversationTitle();

    return {
      source: this.platformKey,
      sourceUrl: window.location.href,
      title: title,
      messages: messages,
    };
  }
}

// Make available globally
if (typeof globalThis !== 'undefined') {
  globalThis.BaseAdapter = BaseAdapter;
}
