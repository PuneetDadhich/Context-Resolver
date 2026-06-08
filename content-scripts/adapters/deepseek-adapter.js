/**
 * Context Resolver — DeepSeek Adapter
 * Extracts conversations from chat.deepseek.com
 */

class DeepSeekAdapter extends BaseAdapter {
  constructor() {
    super('deepseek');
  }

  static matches(url) {
    return /^https:\/\/chat\.deepseek\.com/i.test(url);
  }

  getConversationTitle() {
    // Try sidebar active conversation
    const activeEl = document.querySelector(
      '.active-conversation, [class*="active"] [class*="title"], [class*="selected"] [class*="title"]'
    );
    if (activeEl?.textContent?.trim()) return activeEl.textContent.trim();

    const pageTitle = document.title?.replace(' - DeepSeek', '').replace('DeepSeek - ', '').trim();
    if (pageTitle && !['DeepSeek', 'DeepSeek Chat'].includes(pageTitle)) return pageTitle;

    return 'DeepSeek Conversation';
  }

  getMessages() {
    const messages = [];

    // Strategy 1: Role-based message containers
    const msgEls = document.querySelectorAll(
      '[class*="message"], [class*="chat-message"], [data-role]'
    );
    if (msgEls.length > 0) {
      msgEls.forEach((el) => {
        const dataRole = el.getAttribute('data-role');
        const className = el.className || '';
        
        let role;
        if (dataRole === 'user' || className.includes('user')) {
          role = 'user';
        } else if (dataRole === 'assistant' || className.includes('assistant') || className.includes('bot')) {
          role = 'assistant';
        } else {
          return; // Skip unknown roles
        }

        const contentEl = el.querySelector('.markdown-body, .markdown, [class*="content"], p') || el;
        const content = this.extractTextContent(contentEl);
        if (content.trim() && content.length > 1) {
          messages.push({ role, content: content.trim() });
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 2: Alternating blocks in the main chat area
    const chatArea = document.querySelector(
      '[class*="chat-container"], [class*="conversation"], main'
    );
    if (chatArea) {
      const blocks = chatArea.querySelectorAll(
        '[class*="bubble"], [class*="msg"], [class*="turn"]'
      );
      let isUser = true;
      blocks.forEach((block) => {
        const hasUserIndicator = block.querySelector('[class*="user"], [class*="avatar-user"]');
        const hasBotIndicator = block.querySelector('[class*="bot"], [class*="avatar-bot"], [class*="assistant"]');
        
        let role;
        if (hasUserIndicator) role = 'user';
        else if (hasBotIndicator) role = 'assistant';
        else {
          role = isUser ? 'user' : 'assistant';
          isUser = !isUser;
        }

        const contentEl = block.querySelector('.markdown-body, .markdown, p') || block;
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
      document.querySelector('#chat-input') ||
      document.querySelector('textarea[placeholder]') ||
      document.querySelector('textarea') ||
      document.querySelector('[contenteditable="true"]')
    );
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.DeepSeekAdapter = DeepSeekAdapter;
}
