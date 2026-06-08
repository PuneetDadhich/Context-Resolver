/**
 * Context Resolver — Handoff Template Generator
 * Generates structured prompts for injecting context into a new AI tool.
 */

const ContextTemplate = (() => {
  'use strict';

  /**
   * Generate a complete handoff prompt for injecting into a new AI tool.
   * @param {object} context - The saved context object
   * @param {string} compressedText - The compressed context text
   * @param {string} compression - Compression level used
   * @returns {string} Formatted handoff prompt
   */
  function generateHandoff(context, compressedText, compression) {
    const platformInfo = ContextResolverUtils.getPlatformInfo(context.source);
    const messageStats = ContextResolverUtils.countMessages(context.messages);
    const capturedDate = new Date(context.capturedAt).toLocaleString();

    const parts = [];

    // Header
    parts.push(`## 📋 Context Handoff from ${platformInfo.name}`);
    parts.push('');
    parts.push(
      `I'm continuing a conversation that started in **${platformInfo.name}**. ` +
        `The original conversation had **${messageStats.total} messages** ` +
        `(${messageStats.user} from me, ${messageStats.assistant} from the AI) ` +
        `and was captured on ${capturedDate}.`
    );
    parts.push('');

    // Compression info
    if (compression !== 'full') {
      parts.push(
        `> **Note:** This context has been compressed using "${compression}" mode. ` +
          `Some intermediate discussion may have been omitted, but key decisions, ` +
          `code, and requirements have been preserved.`
      );
      parts.push('');
    }

    // Divider
    parts.push('---');
    parts.push('');

    // Compressed content
    parts.push(compressedText);
    parts.push('');

    // Footer
    parts.push('---');
    parts.push('');
    parts.push(
      'Please acknowledge that you\'ve received this context and let me know you\'re ' +
        'ready to continue. If anything is unclear from the context above, please ask ' +
        'for clarification before proceeding.'
    );

    return parts.join('\n');
  }

  /**
   * Generate a minimal handoff (just the compressed text with brief header).
   * @param {object} context - The saved context object
   * @param {string} compressedText - The compressed context text
   * @returns {string} Minimal handoff prompt
   */
  function generateMinimal(context, compressedText) {
    const platformInfo = ContextResolverUtils.getPlatformInfo(context.source);
    return (
      `Continuing from ${platformInfo.name}:\n\n` +
      compressedText +
      '\n\n---\nPlease continue from where we left off.'
    );
  }

  /**
   * Generate a structured JSON handoff (for programmatic use).
   * @param {object} context - The saved context object
   * @param {string} compressedText - The compressed context text
   * @param {string} compression - Compression level
   * @returns {string} JSON-formatted handoff
   */
  function generateStructured(context, compressedText, compression) {
    const payload = {
      _meta: {
        tool: 'Context Resolver',
        version: '1.0.0',
        format: 'structured_handoff',
      },
      source: {
        platform: context.source,
        url: context.sourceUrl,
        capturedAt: context.capturedAt,
        messageCount: context.messageCount,
      },
      context: compressedText,
      compression: compression,
      instructions:
        'This is a structured context handoff. Parse the context field and ' +
        'continue the conversation from where it left off.',
    };
    return '```json\n' + JSON.stringify(payload, null, 2) + '\n```';
  }

  /**
   * Generate the appropriate template based on the target platform.
   * Different AI tools may respond better to different formats.
   * @param {object} context - The saved context object
   * @param {string} compressedText - The compressed context text
   * @param {string} compression - Compression level
   * @param {string} targetPlatform - The target AI platform key
   * @returns {string} Formatted handoff prompt
   */
  function generateForPlatform(context, compressedText, compression, targetPlatform) {
    // All platforms currently use the standard handoff format
    // Future: customize per platform if needed
    return generateHandoff(context, compressedText, compression);
  }

  return {
    generateHandoff,
    generateMinimal,
    generateStructured,
    generateForPlatform,
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.ContextTemplate = ContextTemplate;
}
