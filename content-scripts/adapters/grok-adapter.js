/**
 * Context Resolver — Grok Adapter
 * Extracts conversations from grok.com and x.com/i/grok
 */

class GrokAdapter extends BaseAdapter {
  constructor() {
    super('grok');
  }

  static matches(url) {
    return /^https:\/\/(grok\.com|x\.com\/i\/grok)/i.test(url);
  }

  getConversationTitle() {
    const titleEl = document.querySelector(
      '[class*="conversation-title"], [class*="thread-title"], h1'
    );
    if (titleEl?.textContent?.trim()) return titleEl.textContent.trim();

    const pageTitle = document.title?.replace(' - Grok', '').replace('Grok - ', '').trim();
    if (pageTitle && pageTitle !== 'Grok') return pageTitle;

    return 'Grok Conversation';
  }

  getMessages() {
    const messages = [];

    // Strategy 1: Message containers with role indicators
    const msgEls = document.querySelectorAll(
      '[class*="message"], [class*="chat-turn"], [data-role]'
    );
    if (msgEls.length > 0) {
      msgEls.forEach((el) => {
        const dataRole = el.getAttribute('data-role');
        const className = el.className || '';
        const text = el.textContent || '';

        let role;
        if (dataRole === 'user' || className.includes('user') || className.includes('human')) {
          role = 'user';
        } else if (dataRole === 'assistant' || className.includes('assistant') || className.includes('grok') || className.includes('bot')) {
          role = 'assistant';
        } else {
          return;
        }

        const contentEl = el.querySelector('.markdown, [class*="content"], p') || el;
        const content = this.extractTextContent(contentEl);
        if (content.trim() && content.length > 1) {
          messages.push({ role, content: content.trim() });
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 2: Structural — look for the chat thread
    const chatThread = document.querySelector(
      '[class*="thread"], [class*="conversation"], [class*="chat-log"], main'
    );
    if (chatThread) {
      const blocks = chatThread.querySelectorAll(
        '[class*="bubble"], [class*="msg"], [class*="response"], [class*="query"]'
      );
      let isUser = true;
      blocks.forEach((block) => {
        const content = this.extractTextContent(block);
        if (content.trim() && content.length > 3) {
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
      document.querySelector('textarea[placeholder*="message"]') ||
      document.querySelector('textarea') ||
      document.querySelector('[contenteditable="true"]')
    );
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.GrokAdapter = GrokAdapter;
}
