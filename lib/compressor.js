/**
 * Context Resolver — Compression Engine
 * Rule-based context compression with three levels: full, summary, key-points.
 * All processing happens locally — no external API calls.
 */

const ContextCompressor = (() => {
  'use strict';

  // Patterns to detect important content
  const PATTERNS = {
    codeBlock: /```[\s\S]*?```/g,
    inlineCode: /`[^`]+`/g,
    decision: /(?:let'?s?\s+(?:go\s+with|use|choose|pick|stick\s+with|do)|i(?:'ve|'ll|\s+will)\s+(?:go\s+with|use|decide|choose)|the\s+(?:approach|solution|plan|decision)\s+is|we\s+(?:decided|agreed|chose|settled\s+on)|(?:final|chosen|selected)\s+(?:approach|solution|design|implementation))/i,
    requirement: /(?:must\s+(?:be|have|support|include)|should\s+(?:be|have|support|include)|need(?:s?\s+to|\s+for)|require(?:ment|d|s)?|mandatory|essential|critical\s+(?:requirement|feature))/i,
    actionItem: /(?:todo|to-do|action\s+item|next\s+step|follow[\s-]up|task|will\s+(?:need\s+to|implement|create|add|fix|update|build|write))/i,
    url: /https?:\/\/[^\s)>\]]+/g,
    filePath: /(?:\/[\w.-]+)+\.\w+|[\w.-]+\.(?:js|ts|py|java|go|rs|rb|css|html|json|yaml|yml|md|sql|sh)/g,
    heading: /^#+\s+.+$/gm,
    listItem: /^\s*[-*•]\s+.+$/gm,
    numberedItem: /^\s*\d+[\.)]\s+.+$/gm,
    error: /(?:error|exception|fail(?:ed|ure)|bug|issue|problem|crash|broken)/i,
    summary: /(?:in\s+summary|to\s+summarize|overall|in\s+conclusion|key\s+(?:takeaway|point|finding)|the\s+(?:main|key|important)\s+(?:thing|point|takeaway))/i,
  };

  /**
   * Compress messages based on the specified level.
   * @param {Array} messages - Array of {role, content} objects
   * @param {string} level - 'full' | 'summary' | 'key-points'
   * @returns {object} { text, stats }
   */
  function compress(messages, level = 'summary') {
    if (!messages || messages.length === 0) {
      return { text: '', stats: { original: 0, compressed: 0, ratio: 0 } };
    }

    const originalText = messages.map((m) => m.content).join('\n');
    const originalSize = originalText.length;

    let result;
    switch (level) {
      case 'full':
        result = compressFull(messages);
        break;
      case 'summary':
        result = compressSummary(messages);
        break;
      case 'key-points':
        result = compressKeyPoints(messages);
        break;
      default:
        result = compressSummary(messages);
    }

    return {
      text: result,
      stats: {
        original: originalSize,
        compressed: result.length,
        ratio: originalSize > 0 ? Math.round((result.length / originalSize) * 100) : 0,
      },
    };
  }

  /**
   * Full compression — keeps all messages, minimal formatting cleanup.
   */
  function compressFull(messages) {
    return messages
      .map((m) => {
        const prefix = m.role === 'user' ? '**User:**' : '**Assistant:**';
        return `${prefix}\n${m.content.trim()}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * Summary compression — keeps first/last exchanges, code blocks, decisions.
   */
  function compressSummary(messages) {
    const parts = [];
    const codeBlocks = [];
    const decisions = [];
    const errors = [];

    // Always keep the first 3 and last 3 exchanges
    const keepFirst = Math.min(6, messages.length); // 3 exchanges = 6 messages
    const keepLast = Math.min(6, messages.length);
    const firstMessages = messages.slice(0, keepFirst);
    const lastMessages =
      messages.length > keepFirst
        ? messages.slice(Math.max(keepFirst, messages.length - keepLast))
        : [];

    // Extract important content from middle messages
    const middleMessages = messages.slice(keepFirst, Math.max(keepFirst, messages.length - keepLast));

    for (const msg of middleMessages) {
      // Extract code blocks
      const codes = msg.content.match(PATTERNS.codeBlock);
      if (codes) {
        codeBlocks.push(...codes);
      }

      // Extract decisions
      const lines = msg.content.split('\n');
      for (const line of lines) {
        if (PATTERNS.decision.test(line)) {
          decisions.push(line.trim());
        }
        if (PATTERNS.error.test(line) && line.trim().length < 200) {
          errors.push(line.trim());
        }
      }
    }

    // Build summary
    parts.push('### Opening Context');
    parts.push(
      firstMessages
        .map((m) => {
          const prefix = m.role === 'user' ? '**User:**' : '**Assistant:**';
          return `${prefix}\n${m.content.trim()}`;
        })
        .join('\n\n')
    );

    if (middleMessages.length > 0) {
      parts.push(`\n### Middle Section (${middleMessages.length} messages summarized)`);

      if (decisions.length > 0) {
        parts.push('\n**Key Decisions:**');
        decisions.forEach((d) => parts.push(`- ${d}`));
      }

      if (errors.length > 0) {
        parts.push('\n**Issues Discussed:**');
        [...new Set(errors)].slice(0, 5).forEach((e) => parts.push(`- ${e}`));
      }

      if (codeBlocks.length > 0) {
        parts.push('\n**Code Blocks from Discussion:**');
        // Keep last 5 code blocks (most likely to be the final versions)
        codeBlocks.slice(-5).forEach((code) => parts.push(code));
      }
    }

    if (lastMessages.length > 0 && messages.length > keepFirst) {
      parts.push('\n### Most Recent Exchanges');
      parts.push(
        lastMessages
          .map((m) => {
            const prefix = m.role === 'user' ? '**User:**' : '**Assistant:**';
            return `${prefix}\n${m.content.trim()}`;
          })
          .join('\n\n')
      );
    }

    return parts.join('\n');
  }

  /**
   * Key-points compression — extracts only critical information.
   */
  function compressKeyPoints(messages) {
    const keyPoints = {
      topic: '',
      decisions: [],
      requirements: [],
      codeContext: [],
      actionItems: [],
      finalState: '',
    };

    // Topic from first user message
    const firstUser = messages.find((m) => m.role === 'user');
    if (firstUser) {
      const firstLine = firstUser.content.split('\n')[0].trim();
      keyPoints.topic = firstLine.length > 120 ? firstLine.substring(0, 120) + '…' : firstLine;
    }

    // Scan all messages for important content
    for (const msg of messages) {
      const lines = msg.content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 5) continue;

        if (PATTERNS.decision.test(trimmed) && trimmed.length < 200) {
          keyPoints.decisions.push(trimmed);
        }
        if (PATTERNS.requirement.test(trimmed) && trimmed.length < 200) {
          keyPoints.requirements.push(trimmed);
        }
        if (PATTERNS.actionItem.test(trimmed) && trimmed.length < 200) {
          keyPoints.actionItems.push(trimmed);
        }
      }

      // Extract code blocks (keep only the last few)
      const codes = msg.content.match(PATTERNS.codeBlock);
      if (codes) {
        keyPoints.codeContext.push(...codes);
      }
    }

    // Final state from last assistant message
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant) {
      const lastContent = lastAssistant.content;
      // Take the last paragraph or list
      const paragraphs = lastContent.split('\n\n').filter((p) => p.trim());
      keyPoints.finalState = paragraphs.slice(-2).join('\n\n');
      if (keyPoints.finalState.length > 500) {
        keyPoints.finalState = keyPoints.finalState.substring(0, 500) + '…';
      }
    }

    // Deduplicate
    keyPoints.decisions = [...new Set(keyPoints.decisions)].slice(0, 10);
    keyPoints.requirements = [...new Set(keyPoints.requirements)].slice(0, 10);
    keyPoints.actionItems = [...new Set(keyPoints.actionItems)].slice(0, 10);
    keyPoints.codeContext = keyPoints.codeContext.slice(-3);

    // Build output
    const parts = [];

    parts.push(`**Topic:** ${keyPoints.topic}`);

    if (keyPoints.decisions.length > 0) {
      parts.push('\n**Decisions Made:**');
      keyPoints.decisions.forEach((d) => parts.push(`- ${d}`));
    }

    if (keyPoints.requirements.length > 0) {
      parts.push('\n**Requirements/Constraints:**');
      keyPoints.requirements.forEach((r) => parts.push(`- ${r}`));
    }

    if (keyPoints.actionItems.length > 0) {
      parts.push('\n**Action Items:**');
      keyPoints.actionItems.forEach((a) => parts.push(`- ${a}`));
    }

    if (keyPoints.codeContext.length > 0) {
      parts.push('\n**Final Code Context:**');
      keyPoints.codeContext.forEach((c) => parts.push(c));
    }

    if (keyPoints.finalState) {
      parts.push('\n**Where We Left Off:**');
      parts.push(keyPoints.finalState);
    }

    return parts.join('\n');
  }

  /**
   * Extract all code blocks from messages.
   * @param {Array} messages - Array of {role, content}
   * @returns {Array} Array of code block strings
   */
  function extractCodeBlocks(messages) {
    const blocks = [];
    for (const msg of messages) {
      const matches = msg.content.match(PATTERNS.codeBlock);
      if (matches) blocks.push(...matches);
    }
    return blocks;
  }

  /**
   * Extract key decisions from messages.
   * @param {Array} messages - Array of {role, content}
   * @returns {Array} Array of decision strings
   */
  function extractDecisions(messages) {
    const decisions = [];
    for (const msg of messages) {
      const lines = msg.content.split('\n');
      for (const line of lines) {
        if (PATTERNS.decision.test(line) && line.trim().length < 200) {
          decisions.push(line.trim());
        }
      }
    }
    return [...new Set(decisions)];
  }

  return {
    compress,
    compressFull,
    compressSummary,
    compressKeyPoints,
    extractCodeBlocks,
    extractDecisions,
    PATTERNS,
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.ContextCompressor = ContextCompressor;
}
