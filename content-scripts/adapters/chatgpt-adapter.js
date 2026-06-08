/**
 * Context Resolver — ChatGPT Adapter
 * Extracts conversations from chat.openai.com and chatgpt.com
 */

class ChatGPTAdapter extends BaseAdapter {
  constructor() {
    super('chatgpt');
  }

  static matches(url) {
    return /^https:\/\/(chat\.openai\.com|chatgpt\.com)/i.test(url);
  }

  getConversationTitle() {
    // Try the active nav item first (sidebar conversation title)
    const activeNav = document.querySelector('nav a.bg-token-sidebar-surface-secondary, nav [class*="active"] span');
    if (activeNav) {
      const text = activeNav.textContent?.trim();
      if (text && text.length > 2) return text;
    }

    // Try the page title (usually "ChatGPT" or the conversation title)
    const pageTitle = document.title?.replace(' | ChatGPT', '').replace('ChatGPT - ', '').trim();
    if (pageTitle && pageTitle !== 'ChatGPT') return pageTitle;

    return 'ChatGPT Conversation';
  }

  getMessages() {
    const messages = [];

    // Strategy 1: Look for article elements with data-testid attributes
    const articles = document.querySelectorAll('article[data-testid]');
    if (articles.length > 0) {
      articles.forEach((article) => {
        const testId = article.getAttribute('data-testid') || '';
        const role = testId.includes('user') ? 'user' : 'assistant';
        const contentEl = article.querySelector('.markdown, .whitespace-pre-wrap, [class*="message"]') || article;
        const content = this.extractTextContent(contentEl);
        if (content.trim()) {
          messages.push({ role, content: content.trim() });
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 2: Look for turn containers with role-based attributes
    const turns = document.querySelectorAll('[data-message-author-role]');
    if (turns.length > 0) {
      turns.forEach((turn) => {
        const role = turn.getAttribute('data-message-author-role') === 'user' ? 'user' : 'assistant';
        const contentEl = turn.querySelector('.markdown, .whitespace-pre-wrap') || turn;
        const content = this.extractTextContent(contentEl);
        if (content.trim()) {
          messages.push({ role, content: content.trim() });
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 3: Structural pattern — alternating message groups in main thread
    const groups = document.querySelectorAll('[class*="group"]:not(nav *)');
    if (groups.length > 0) {
      let isUser = true;
      groups.forEach((group) => {
        // Check for user avatar or assistant avatar
        const hasUserAvatar = group.querySelector('img[alt*="User"], [data-testid*="user"]');
        const hasAssistantAvatar = group.querySelector('img[alt*="ChatGPT"], svg, [data-testid*="assistant"]');
        
        let role;
        if (hasUserAvatar) role = 'user';
        else if (hasAssistantAvatar) role = 'assistant';
        else {
          role = isUser ? 'user' : 'assistant';
          isUser = !isUser;
        }

        const contentEl = group.querySelector('.markdown, .whitespace-pre-wrap, p') || group;
        const content = this.extractTextContent(contentEl);
        if (content.trim() && content.length > 1) {
          messages.push({ role, content: content.trim() });
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 4: Fallback — find any .markdown or prose containers
    const markdownBlocks = document.querySelectorAll('main .markdown, main .prose');
    let isUserTurn = false; // First in main is usually assistant welcome
    markdownBlocks.forEach((block) => {
      const content = this.extractTextContent(block);
      if (content.trim()) {
        messages.push({ role: isUserTurn ? 'user' : 'assistant', content: content.trim() });
        isUserTurn = !isUserTurn;
      }
    });

    return messages;
  }

  getInputElement() {
    return (
      document.querySelector('#prompt-textarea') ||
      document.querySelector('textarea[data-id="root"]') ||
      document.querySelector('main textarea') ||
      document.querySelector('[contenteditable="true"][data-placeholder]') ||
      document.querySelector('div[contenteditable="true"]')
    );
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.ChatGPTAdapter = ChatGPTAdapter;
}
