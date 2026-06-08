/**
 * Context Resolver — Perplexity Adapter
 * Extracts conversations from perplexity.ai
 */

class PerplexityAdapter extends BaseAdapter {
  constructor() {
    super('perplexity');
  }

  static matches(url) {
    return /^https:\/\/(www\.)?perplexity\.ai/i.test(url);
  }

  getConversationTitle() {
    // Perplexity uses the first query as the thread title
    const titleEl = document.querySelector(
      '[class*="ThreadTitle"], h1[class*="title"], .thread-title'
    );
    if (titleEl?.textContent?.trim()) return titleEl.textContent.trim();

    const pageTitle = document.title?.replace(' - Perplexity', '').trim();
    if (pageTitle && pageTitle !== 'Perplexity') return pageTitle;

    return 'Perplexity Thread';
  }

  getMessages() {
    const messages = [];

    // Strategy 1: Query and answer blocks
    const queries = document.querySelectorAll(
      '[class*="Query"], [class*="query-text"], [class*="user-message"]'
    );
    const answers = document.querySelectorAll(
      '[class*="Answer"], [class*="answer-text"], [class*="prose"], .markdown-body'
    );

    if (queries.length > 0 || answers.length > 0) {
      const allMsgs = [];
      queries.forEach((el) => {
        allMsgs.push({ el, role: 'user', pos: this._getDocPosition(el) });
      });
      answers.forEach((el) => {
        // Skip source citations sections
        if (el.closest('[class*="citation"], [class*="source"]')) return;
        allMsgs.push({ el, role: 'assistant', pos: this._getDocPosition(el) });
      });

      allMsgs.sort((a, b) => a.pos - b.pos);
      allMsgs.forEach(({ el, role }) => {
        const content = this.extractTextContent(el);
        if (content.trim() && content.length > 3) {
          messages.push({ role, content: content.trim() });
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 2: Thread-based extraction
    const threadBlocks = document.querySelectorAll(
      '[class*="ThreadMessage"], [class*="thread-block"]'
    );
    if (threadBlocks.length > 0) {
      let isUser = true;
      threadBlocks.forEach((block) => {
        const hasSearchIcon = block.querySelector('svg, [class*="search"]');
        const role = isUser ? 'user' : 'assistant';
        const content = this.extractTextContent(block);
        if (content.trim() && content.length > 3) {
          messages.push({ role, content: content.trim() });
          isUser = !isUser;
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 3: Fallback — look for the main content area
    const mainArea = document.querySelector('main, [role="main"]');
    if (mainArea) {
      const textBlocks = mainArea.querySelectorAll(
        '.prose, [class*="text-content"], p'
      );
      let isUser = true;
      textBlocks.forEach((block) => {
        const content = this.extractTextContent(block);
        if (content.trim() && content.length > 10) {
          messages.push({ role: isUser ? 'user' : 'assistant', content: content.trim() });
          isUser = !isUser;
        }
      });
    }

    return messages;
  }

  getInputElement() {
    return (
      document.querySelector('textarea[placeholder*="Ask"]') ||
      document.querySelector('textarea[placeholder*="follow"]') ||
      document.querySelector('textarea') ||
      document.querySelector('[contenteditable="true"]')
    );
  }

  _getDocPosition(el) {
    const rect = el.getBoundingClientRect();
    return rect.top + window.scrollY;
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.PerplexityAdapter = PerplexityAdapter;
}
