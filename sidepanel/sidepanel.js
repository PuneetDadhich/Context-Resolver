/**
 * Context Resolver — Side Panel Logic
 * Handles UI rendering, state management, and communication with the service worker.
 */

(() => {
  'use strict';

  // ─── State ──────────────────────────────────────────

  const state = {
    contexts: [],
    currentView: 'library', // 'library' | 'detail' | 'settings'
    selectedContextId: null,
    selectedCompression: 'summary',
    searchQuery: '',
    settings: {},
    activePlatform: null,
  };

  // ─── DOM References ─────────────────────────────────

  const $ = (id) => document.getElementById(id);

  const dom = {
    platformStatus: $('platformStatus'),
    captureBtn: $('captureBtn'),
    contextCount: $('contextCount'),
    storageUsage: $('storageUsage'),
    toastContainer: $('toastContainer'),
    searchInput: $('searchInput'),
    emptyState: $('emptyState'),
    contextList: $('contextList'),
    viewLibrary: $('viewLibrary'),
    viewDetail: $('viewDetail'),
    viewSettings: $('viewSettings'),
    backBtn: $('backBtn'),
    settingsBtn: $('settingsBtn'),
    settingsBackBtn: $('settingsBackBtn'),
    deleteContextBtn: $('deleteContextBtn'),
    detailContent: $('detailContent'),
    compressionToggle: $('compressionToggle'),
    injectBtn: $('injectBtn'),
    settingCompression: $('settingCompression'),
    settingMaxContexts: $('settingMaxContexts'),
    exportBtn: $('exportBtn'),
    importBtn: $('importBtn'),
    importFileInput: $('importFileInput'),
    clearAllBtn: $('clearAllBtn'),
  };

  // ─── Initialization ─────────────────────────────────

  async function init() {
    await loadSettings();
    await loadContexts();
    await detectActivePlatform();
    setupEventListeners();
    setupMessageListener();
    updateMetaBadges();
  }

  // ─── Data Loading ───────────────────────────────────

  async function loadSettings() {
    const response = await sendMessage({ type: 'GET_SETTINGS' });
    if (response.success) {
      state.settings = response.settings;
      applySettings();
    }
  }

  async function loadContexts() {
    const response = await sendMessage({ type: 'GET_ALL_CONTEXTS' });
    if (response.success) {
      state.contexts = response.contexts;
      renderContextList();
    }
  }

  async function detectActivePlatform() {
    const response = await sendMessage({ type: 'GET_ACTIVE_PLATFORM' });
    if (response.success && response.platform) {
      state.activePlatform = response.platform;
      const info = ContextResolverUtils.getPlatformInfo(response.platform);
      dom.platformStatus.textContent = `${info.icon} Connected to ${info.name}`;
      dom.platformStatus.style.color = info.color;
    } else {
      dom.platformStatus.textContent = 'Navigate to an AI chat to start';
    }
  }

  function applySettings() {
    dom.settingCompression.value = state.settings.defaultCompression || 'summary';
    dom.settingMaxContexts.value = state.settings.maxContexts || 50;
    state.selectedCompression = state.settings.defaultCompression || 'summary';

    // Update compression toggle active state
    updateCompressionToggle(state.selectedCompression);
  }

  // ─── Event Listeners ───────────────────────────────

  function setupEventListeners() {
    // Capture
    dom.captureBtn.addEventListener('click', handleCapture);

    // Navigation
    dom.backBtn.addEventListener('click', () => switchView('library'));
    dom.settingsBtn.addEventListener('click', () => switchView('settings'));
    dom.settingsBackBtn.addEventListener('click', () => switchView('library'));

    // Search
    dom.searchInput.addEventListener(
      'input',
      ContextResolverUtils.debounce((e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        renderContextList();
      }, 200)
    );

    // Context detail actions
    dom.deleteContextBtn.addEventListener('click', handleDeleteContext);
    dom.injectBtn.addEventListener('click', handleInject);

    // Compression toggle
    dom.compressionToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.compression-opt');
      if (!btn) return;
      state.selectedCompression = btn.dataset.level;
      updateCompressionToggle(state.selectedCompression);
      updateCompressionPreview();
    });

    // Settings
    dom.settingCompression.addEventListener('change', (e) => {
      saveSettings({ defaultCompression: e.target.value });
    });
    dom.settingMaxContexts.addEventListener('change', (e) => {
      saveSettings({ maxContexts: parseInt(e.target.value) });
    });
    dom.exportBtn.addEventListener('click', handleExport);
    dom.importBtn.addEventListener('click', () => dom.importFileInput.click());
    dom.importFileInput.addEventListener('change', handleImport);
    dom.clearAllBtn.addEventListener('click', handleClearAll);
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
      switch (message.type) {
        case 'CONTEXT_SAVED':
          // Refresh the list when a new context is saved (e.g., via keyboard shortcut)
          loadContexts();
          updateMetaBadges();
          showToast('Context captured successfully!', 'success');
          break;
        case 'SHOW_INJECT_PICKER':
          // Switch to library if not already there, to pick a context
          if (state.currentView !== 'library') {
            switchView('library');
          }
          showToast('Select a context to inject', 'info');
          break;
      }
    });
  }

  // ─── Handlers ───────────────────────────────────────

  async function handleCapture() {
    dom.captureBtn.classList.add('capturing');
    dom.captureBtn.disabled = true;

    try {
      const response = await sendMessage({ type: 'CAPTURE_CONTEXT' });
      if (response.success) {
        state.contexts.unshift(response.context);
        renderContextList();
        updateMetaBadges();
        showToast('✅ Context captured successfully!', 'success');
      } else {
        showToast(`❌ ${response.error}`, 'error');
      }
    } catch (error) {
      showToast(`❌ ${error.message}`, 'error');
    } finally {
      dom.captureBtn.classList.remove('capturing');
      dom.captureBtn.disabled = false;
    }
  }

  async function handleInject() {
    if (!state.selectedContextId) return;

    dom.injectBtn.disabled = true;
    dom.injectBtn.querySelector('span').textContent = 'Injecting…';

    try {
      const response = await sendMessage({
        type: 'INJECT_CONTEXT',
        contextId: state.selectedContextId,
        compression: state.selectedCompression,
      });

      if (response.success) {
        showToast('✅ Context injected successfully!', 'success');
      } else {
        showToast(`❌ ${response.error}`, 'error');
      }
    } catch (error) {
      showToast(`❌ ${error.message}`, 'error');
    } finally {
      dom.injectBtn.disabled = false;
      dom.injectBtn.querySelector('span').textContent = 'Inject into Current Chat';
    }
  }

  async function handleDeleteContext() {
    if (!state.selectedContextId) return;

    const ctx = state.contexts.find((c) => c.id === state.selectedContextId);
    if (!ctx) return;

    if (!confirm(`Delete "${ContextResolverUtils.truncate(ctx.title, 40)}"?`)) return;

    const response = await sendMessage({
      type: 'DELETE_CONTEXT',
      contextId: state.selectedContextId,
    });

    if (response.success) {
      state.contexts = state.contexts.filter((c) => c.id !== state.selectedContextId);
      state.selectedContextId = null;
      switchView('library');
      renderContextList();
      updateMetaBadges();
      showToast('Context deleted', 'info');
    }
  }

  async function handleExport() {
    const response = await sendMessage({ type: 'EXPORT_ALL' });
    if (response.success) {
      const blob = new Blob([response.json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `context-resolver-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✅ Export downloaded!', 'success');
    }
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const response = await sendMessage({
          type: 'IMPORT_ALL',
          jsonString: event.target.result,
        });
        if (response.success) {
          await loadContexts();
          updateMetaBadges();
          showToast(`✅ Imported ${response.imported} contexts`, 'success');
        } else {
          showToast(`❌ ${response.error}`, 'error');
        }
      } catch (error) {
        showToast(`❌ Invalid file format`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  }

  async function handleClearAll() {
    if (!confirm('Delete ALL saved contexts? This cannot be undone.')) return;

    const response = await sendMessage({ type: 'CLEAR_ALL_CONTEXTS' });
    if (response.success) {
      state.contexts = [];
      renderContextList();
      updateMetaBadges();
      switchView('library');
      showToast('All contexts cleared', 'info');
    }
  }

  async function saveSettings(updates) {
    const response = await sendMessage({ type: 'UPDATE_SETTINGS', settings: updates });
    if (response.success) {
      state.settings = response.settings;
    }
  }

  // ─── View Management ────────────────────────────────

  function switchView(view) {
    state.currentView = view;

    // Hide all views
    dom.viewLibrary.classList.remove('view-active');
    dom.viewDetail.classList.remove('view-active');
    dom.viewSettings.classList.remove('view-active');

    // Show target view
    switch (view) {
      case 'library':
        dom.viewLibrary.classList.add('view-active');
        break;
      case 'detail':
        dom.viewDetail.classList.add('view-active');
        renderDetailView();
        break;
      case 'settings':
        dom.viewSettings.classList.add('view-active');
        break;
    }
  }

  // ─── Rendering ──────────────────────────────────────

  function renderContextList() {
    let filtered = state.contexts;

    // Apply search filter
    if (state.searchQuery) {
      filtered = filtered.filter(
        (ctx) =>
          (ctx.title || '').toLowerCase().includes(state.searchQuery) ||
          (ctx.source || '').toLowerCase().includes(state.searchQuery) ||
          (ctx.tags || []).some((t) => t.toLowerCase().includes(state.searchQuery))
      );
    }

    // Toggle empty state
    const isEmpty = filtered.length === 0;
    dom.emptyState.style.display = isEmpty ? 'flex' : 'none';
    dom.contextList.style.display = isEmpty ? 'none' : 'flex';

    if (isEmpty) return;

    dom.contextList.innerHTML = filtered
      .map((ctx) => {
        const platform = ContextResolverUtils.getPlatformInfo(ctx.source);
        return `
          <div class="context-card" data-id="${ctx.id}" data-platform="${ctx.source}">
            <div class="context-card-header">
              <div class="context-card-title">${ContextResolverUtils.escapeHtml(ctx.title)}</div>
              <span class="context-card-platform">
                ${platform.icon} ${platform.name}
              </span>
            </div>
            <div class="context-card-meta">
              <span>💬 ${ctx.messageCount} messages</span>
              <span>📦 ${ContextResolverUtils.formatBytes(ctx.sizeBytes)}</span>
              <span>🕐 ${ContextResolverUtils.timeAgo(ctx.capturedAt)}</span>
            </div>
          </div>
        `;
      })
      .join('');

    // Attach click listeners
    dom.contextList.querySelectorAll('.context-card').forEach((card) => {
      card.addEventListener('click', () => {
        state.selectedContextId = card.dataset.id;
        switchView('detail');
      });
    });
  }

  function renderDetailView() {
    const ctx = state.contexts.find((c) => c.id === state.selectedContextId);
    if (!ctx) {
      switchView('library');
      return;
    }

    const platform = ContextResolverUtils.getPlatformInfo(ctx.source);
    const msgCounts = ContextResolverUtils.countMessages(ctx.messages);

    dom.detailContent.innerHTML = `
      <h2 class="detail-title">${ContextResolverUtils.escapeHtml(ctx.title)}</h2>

      <div class="detail-meta-grid">
        <div class="detail-meta-item">
          <div class="detail-meta-label">Source</div>
          <div class="detail-meta-value">${platform.icon} ${platform.name}</div>
        </div>
        <div class="detail-meta-item">
          <div class="detail-meta-label">Captured</div>
          <div class="detail-meta-value">${ContextResolverUtils.timeAgo(ctx.capturedAt)}</div>
        </div>
        <div class="detail-meta-item">
          <div class="detail-meta-label">Messages</div>
          <div class="detail-meta-value">${msgCounts.user} user / ${msgCounts.assistant} AI</div>
        </div>
        <div class="detail-meta-item">
          <div class="detail-meta-label">Size</div>
          <div class="detail-meta-value">${ContextResolverUtils.formatBytes(ctx.sizeBytes)}</div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Conversation (${ctx.messages.length} messages)</div>
        <div class="detail-messages">
          ${ctx.messages
            .map(
              (msg) => `
              <div class="detail-message detail-message-${msg.role}">
                <div class="detail-message-role">${msg.role}</div>
                <div class="detail-message-content">${ContextResolverUtils.escapeHtml(
                  ContextResolverUtils.truncate(msg.content, 500)
                )}</div>
              </div>
            `
            )
            .join('')}
        </div>
      </div>

      <div class="preview-container" id="compressionPreview">
        <!-- Populated by updateCompressionPreview() -->
      </div>
    `;

    // Reset compression to default
    state.selectedCompression = state.settings.defaultCompression || 'summary';
    updateCompressionToggle(state.selectedCompression);
    updateCompressionPreview();
  }

  function updateCompressionToggle(level) {
    dom.compressionToggle.querySelectorAll('.compression-opt').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.level === level);
    });
  }

  function updateCompressionPreview() {
    const ctx = state.contexts.find((c) => c.id === state.selectedContextId);
    if (!ctx) return;

    const preview = document.getElementById('compressionPreview');
    if (!preview) return;

    const compressed = ContextCompressor.compress(ctx.messages, state.selectedCompression);

    preview.innerHTML = `
      <div class="preview-label">Compression Preview (${state.selectedCompression})</div>
      <div class="preview-box">${ContextResolverUtils.escapeHtml(
        ContextResolverUtils.truncate(compressed.text, 1000)
      )}</div>
      <div class="preview-stats">
        <span class="preview-stat">Original: ${ContextResolverUtils.formatBytes(compressed.stats.original)}</span>
        <span class="preview-stat">Compressed: ${ContextResolverUtils.formatBytes(compressed.stats.compressed)}</span>
        <span class="preview-stat">
          Ratio: <span class="preview-stat-highlight">${compressed.stats.ratio}%</span>
        </span>
      </div>
    `;
  }

  async function updateMetaBadges() {
    const response = await sendMessage({ type: 'GET_STORAGE_STATS' });
    if (response.success) {
      dom.contextCount.textContent = `${response.stats.contextCount} saved`;
      dom.storageUsage.textContent = response.stats.totalSizeFormatted;
    }
  }

  // ─── Toast Notifications ────────────────────────────

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }

  // ─── Messaging ──────────────────────────────────────

  function sendMessage(message) {
    return chrome.runtime.sendMessage(message);
  }

  // ─── Boot ───────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', init);
})();
