/**
 * Context Resolver — Gemini Adapter
 * Extracts conversations from gemini.google.com
 */

class GeminiAdapter extends BaseAdapter {
  constructor() {
    super('gemini');
  }

  static matches(url) {
    return /^https:\/\/gemini\.google\.com/i.test(url);
  }

  getConversationTitle() {
    // Try conversation title from header/nav
    const titleEl = document.querySelector(
      '[data-conversation-title], .conversation-title, [class*="title"]'
    );
    if (titleEl?.textContent?.trim()) return titleEl.textContent.trim();

    // Try page title
    const pageTitle = document.title?.replace(' - Gemini', '').replace('Gemini - ', '').trim();
    if (pageTitle && pageTitle !== 'Gemini') return pageTitle;

    return 'Gemini Conversation';
  }

  getMessages() {
    const messages = [];

    // Strategy 1: Query/response containers
    const queryContainers = document.querySelectorAll(
      '.query-content, [class*="query-text"], [class*="user-query"]'
    );
    const responseContainers = document.querySelectorAll(
      '.response-content, .model-response-text, [class*="response-container"] .markdown'
    );

    if (queryContainers.length > 0 || responseContainers.length > 0) {
      const allMsgs = [];
      queryContainers.forEach((el) => {
        allMsgs.push({ el, role: 'user', pos: this._getDocPosition(el) });
      });
      responseContainers.forEach((el) => {
        allMsgs.push({ el, role: 'assistant', pos: this._getDocPosition(el) });
      });

      allMsgs.sort((a, b) => a.pos - b.pos);
      allMsgs.forEach(({ el, role }) => {
        const content = this.extractTextContent(el);
        if (content.trim()) {
          messages.push({ role, content: content.trim() });
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 2: Turn-based containers
    const turns = document.querySelectorAll(
      '[class*="turn"], [class*="conversation-turn"], message-content'
    );
    if (turns.length > 0) {
      turns.forEach((turn) => {
        const isUser = turn.querySelector('[class*="user"], [class*="query"]') !== null ||
                       turn.className?.includes('user') ||
                       turn.className?.includes('query');
        const role = isUser ? 'user' : 'assistant';
        const contentEl = turn.querySelector('.markdown, p, [class*="text"]') || turn;
        const content = this.extractTextContent(contentEl);
        if (content.trim() && content.length > 1) {
          messages.push({ role, content: content.trim() });
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 3: Broader structural search
    const mainContent = document.querySelector('main, [role="main"], .chat-container');
    if (mainContent) {
      // Look for any message-like blocks
      const blocks = mainContent.querySelectorAll(
        '[class*="message"], [class*="chunk"], [class*="part"]'
      );
      let isUser = true;
      blocks.forEach((block) => {
        const content = this.extractTextContent(block);
        if (content.trim() && content.length > 5) {
          messages.push({ role: isUser ? 'user' : 'assistant', content: content.trim() });
          isUser = !isUser;
        }
      });
    }

    return messages;
  }

  getInputElement() {
    return (
      document.querySelector('.ql-editor[contenteditable="true"]') ||
      document.querySelector('[contenteditable="true"][aria-label*="prompt"]') ||
      document.querySelector('rich-textarea [contenteditable="true"]') ||
      document.querySelector('[contenteditable="true"]') ||
      document.querySelector('textarea')
    );
  }

  _getDocPosition(el) {
    const rect = el.getBoundingClientRect();
    return rect.top + window.scrollY;
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.GeminiAdapter = GeminiAdapter;
}
