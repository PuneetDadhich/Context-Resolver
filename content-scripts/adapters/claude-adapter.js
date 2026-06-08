/**
 * Context Resolver — Claude Adapter
 * Extracts conversations from claude.ai
 */

class ClaudeAdapter extends BaseAdapter {
  constructor() {
    super('claude');
  }

  static matches(url) {
    return /^https:\/\/claude\.ai/i.test(url);
  }

  getConversationTitle() {
    // Try sidebar active conversation
    const activeConv = document.querySelector('[data-testid="chat-title"], .conversation-title');
    if (activeConv?.textContent?.trim()) return activeConv.textContent.trim();

    // Try page title
    const pageTitle = document.title?.replace(' - Claude', '').replace('Claude - ', '').trim();
    if (pageTitle && pageTitle !== 'Claude') return pageTitle;

    return 'Claude Conversation';
  }

  getMessages() {
    const messages = [];

    // Strategy 1: Data attribute based selectors
    const msgContainers = document.querySelectorAll('[data-testid*="message"], [data-test*="message"]');
    if (msgContainers.length > 0) {
      msgContainers.forEach((container) => {
        const testId = (container.getAttribute('data-testid') || container.getAttribute('data-test') || '').toLowerCase();
        const role = testId.includes('human') || testId.includes('user') ? 'user' : 'assistant';
        const content = this.extractTextContent(container);
        if (content.trim()) {
          messages.push({ role, content: content.trim() });
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 2: Role-based containers
    const humanMessages = document.querySelectorAll('[class*="human"], [class*="user-message"], [data-is-human="true"]');
    const aiMessages = document.querySelectorAll('[class*="assistant"], [class*="ai-message"], [data-is-human="false"]');

    if (humanMessages.length > 0 || aiMessages.length > 0) {
      // Collect all messages with their DOM position for ordering
      const allMsgs = [];
      humanMessages.forEach((el) => {
        allMsgs.push({ el, role: 'user', pos: this._getDocPosition(el) });
      });
      aiMessages.forEach((el) => {
        allMsgs.push({ el, role: 'assistant', pos: this._getDocPosition(el) });
      });

      allMsgs.sort((a, b) => a.pos - b.pos);

      allMsgs.forEach(({ el, role }) => {
        const contentEl = el.querySelector('.markdown, .prose, [class*="content"]') || el;
        const content = this.extractTextContent(contentEl);
        if (content.trim()) {
          messages.push({ role, content: content.trim() });
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 3: Structural — look for the main conversation thread
    const threadContainer = document.querySelector('[class*="thread"], [class*="conversation"], main');
    if (threadContainer) {
      const blocks = threadContainer.querySelectorAll('[class*="message"], [class*="turn"], [class*="block"]');
      let isUser = true;

      blocks.forEach((block) => {
        // Look for role indicators
        const text = block.textContent || '';
        const hasHumanIndicator = block.querySelector('[class*="human"], [class*="user"]') ||
                                   block.className?.includes('human') ||
                                   block.className?.includes('user');
        const hasAIIndicator = block.querySelector('[class*="assistant"], [class*="claude"]') ||
                               block.className?.includes('assistant') ||
                               block.className?.includes('claude');

        let role;
        if (hasHumanIndicator) role = 'user';
        else if (hasAIIndicator) role = 'assistant';
        else {
          role = isUser ? 'user' : 'assistant';
          isUser = !isUser;
        }

        const contentEl = block.querySelector('.markdown, .prose, p') || block;
        const content = this.extractTextContent(contentEl);
        if (content.trim() && content.length > 1) {
          messages.push({ role, content: content.trim() });
        }
      });
    }

    return messages;
  }

  getInputElement() {
    return (
      document.querySelector('[contenteditable="true"].ProseMirror') ||
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector('[data-testid="chat-input"]') ||
      document.querySelector('fieldset [contenteditable="true"]') ||
      document.querySelector('textarea')
    );
  }

  /**
   * Get approximate document position for ordering.
   * @param {HTMLElement} el
   * @returns {number}
   */
  _getDocPosition(el) {
    const rect = el.getBoundingClientRect();
    return rect.top + window.scrollY;
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.ClaudeAdapter = ClaudeAdapter;
}
