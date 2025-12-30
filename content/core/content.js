// Main Content Script - Modular Viewer Metrics

// Handle unhandled promise rejections for request cancellations
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'RequestCancelledError' || event.reason?.isExpected) {
    // Silently handle expected cancellation errors
    event.preventDefault();
    return;
  }
  // Let other unhandled rejections bubble up normally
});

class TwitchViewerMetrics {
  constructor() {
    // Simplified - only need basic managers for the simple UI
    this.errorHandler = new window.ErrorHandler();
    this.settingsManager = new window.SettingsManager(this.errorHandler);

    // State
    this.channelName = null;
    this.trackingPageTabId = null;

    this.init();
  }

  async init() {
    try {
      // Setup page handlers
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setup());
      } else {
        this.setup();
      }

      // Setup message listeners
      this.setupMessageListeners();
    } catch (error) {
      this.errorHandler.handle(error, 'TVM Init');
    }
  }

  setup() {
    try {
      this.detectChannel();
      this.watchForNavigation();
      this.injectSimpleUI();
    } catch (error) {
      this.errorHandler.handle(error, 'TVM Setup');
    }
  }

  detectChannel() {
    const pathParts = window.location.pathname.split('/').filter(p => p);

    if (pathParts.length > 0 && !['directory', 'videos', 'settings'].includes(pathParts[0])) {
      this.channelName = pathParts[0].toLowerCase();
    } else {
      this.channelName = null;
    }
  }

  async injectSimpleUI() {
    if (!this.channelName) return;

    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.log('Extension context invalidated, skipping UI injection');
        return;
      }

      // Wait for target element to be available
      const targetElement = await this.waitForElement('.channel-info-content');

      if (targetElement) {
        // Remove existing UI if present
        const existing = document.getElementById('twitch-viewer-metrics');
        if (existing) {
          existing.remove();
        }

        // Create simple UI container        
        const uiContainer = document.createElement('div');
        uiContainer.id = 'twitch-viewer-metrics';
        uiContainer.innerHTML = HTMLTemplates.generateSimpleUI(this.channelName);

        // If element with id live-channel-stream-information exists inside targetElement, insert after it
        const streamInfoElement = targetElement.querySelector('#live-channel-stream-information');
        if (streamInfoElement) {
          targetElement.insertBefore(uiContainer, streamInfoElement.nextSibling);
        } else {
          targetElement.appendChild(uiContainer);
        }


        // Setup event listeners
        this.setupStartTrackingButton();
        this.setupMultiChannelUI();
        this.loadChannelsList();
      }
    } catch (error) {
      this.errorHandler.handle(error, 'TVM Inject Simple UI');
    }
  }

  setupStartTrackingButton() {
    const startBtn = document.getElementById('tvm-start-tracking');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.handleStartTracking());
    }
  }

  setupMultiChannelUI() {
    // Toggle show/hide
    const showBtn = document.getElementById('tvm-show-multi-channel');
    const hideBtn = document.getElementById('tvm-toggle-multi-channel');
    const section = document.getElementById('tvm-multi-channel-section');
    
    if (showBtn && hideBtn && section) {
      showBtn.addEventListener('click', () => {
        section.style.display = 'block';
        showBtn.style.display = 'none';
      });
      
      hideBtn.addEventListener('click', () => {
        section.style.display = 'none';
        showBtn.style.display = 'block';
      });
    }

    // Add channel
    const addBtn = document.getElementById('tvm-add-channel-btn');
    const addInput = document.getElementById('tvm-add-channel-input');
    if (addBtn && addInput) {
      addBtn.addEventListener('click', () => this.handleAddChannel());
      addInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleAddChannel();
      });
    }

    // Start all channels
    const startAllBtn = document.getElementById('tvm-start-all-channels');
    if (startAllBtn) {
      startAllBtn.addEventListener('click', () => this.handleStartAllChannels());
    }

    // Stop all channels
    const stopAllBtn = document.getElementById('tvm-stop-all-channels');
    if (stopAllBtn) {
      stopAllBtn.addEventListener('click', () => this.handleStopAllChannels());
    }

    // Refresh channels list
    const refreshBtn = document.getElementById('tvm-refresh-channels');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadChannelsList());
    }

    // CSV export toggle
    const csvToggle = document.getElementById('tvm-csv-export-enabled');
    if (csvToggle) {
      csvToggle.addEventListener('change', () => this.handleCSVToggle());
      this.loadCSVSettings();
    }

    // Save CSV settings
    const saveCSVBtn = document.getElementById('tvm-save-csv-settings');
    if (saveCSVBtn) {
      saveCSVBtn.addEventListener('click', () => this.handleSaveCSVSettings());
    }

    // Export all CSV
    const exportAllBtn = document.getElementById('tvm-export-all-csv');
    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', () => this.handleExportAllCSV());
    }
  }

  async handleAddChannel() {
    const input = document.getElementById('tvm-add-channel-input');
    if (!input) return;

    const channelName = input.value.trim().toLowerCase();
    if (!channelName) {
      alert('Please enter a channel name');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ADD_MULTI_CHANNEL',
        channelName: channelName,
        config: {
          refreshInterval: 30000,
          requestInterval: 5000,
          timeoutDuration: 300000
        }
      });

      if (response.success) {
        input.value = '';
        this.loadChannelsList();
        this.showMessage(`Channel ${channelName} added successfully`, 'success');
      } else {
        this.showMessage(`Failed to add channel: ${response.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Error adding channel:', error);
      this.showMessage('Error adding channel. Check console for details.', 'error');
    }
  }

  async handleStartAllChannels() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_ALL_CHANNELS'
      });

      if (response.success) {
        this.loadChannelsList();
        this.showMessage('All channels started', 'success');
      } else {
        this.showMessage('Failed to start channels', 'error');
      }
    } catch (error) {
      console.error('Error starting channels:', error);
      this.showMessage('Error starting channels', 'error');
    }
  }

  async handleStopAllChannels() {
    if (!confirm('Stop tracking for all channels?')) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'STOP_ALL_CHANNELS'
      });

      if (response.success) {
        this.loadChannelsList();
        this.showMessage('All channels stopped', 'success');
      } else {
        this.showMessage('Failed to stop channels', 'error');
      }
    } catch (error) {
      console.error('Error stopping channels:', error);
      this.showMessage('Error stopping channels', 'error');
    }
  }

  async loadChannelsList() {
    const listContainer = document.getElementById('tvm-channels-list');
    if (!listContainer) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_MULTI_CHANNEL_STATUS'
      });

      if (response.success && response.status) {
        const channels = response.status;
        
        if (channels.length === 0) {
          listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #adadb8; font-size: 14px;">No channels added yet</div>';
          return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
        
        for (const channel of channels) {
          const statusIcon = channel.isTracking ? '🟢' : '⚪';
          const statusText = channel.isTracking ? (channel.isPaused ? 'Paused' : 'Tracking') : 'Stopped';
          const viewerCount = channel.totalViewers || 0;
          const authCount = channel.authenticatedCount || 0;

          html += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: #0e0e10; border-radius: 4px; border: 1px solid #2e2e35;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span style="font-size: 12px;">${statusIcon}</span>
                  <strong style="color: #efeff1; font-size: 14px;">${channel.channelName}</strong>
                  <span style="color: #adadb8; font-size: 12px;">${statusText}</span>
                </div>
                <div style="color: #adadb8; font-size: 11px;">
                  Viewers: ${viewerCount} | Auth: ${authCount}
                </div>
              </div>
              <div style="display: flex; gap: 4px;">
                <button class="tvm-channel-toggle" data-channel="${channel.channelName}" data-enabled="${channel.enabled}" 
                  style="padding: 4px 8px; font-size: 11px; background: ${channel.enabled ? '#9147ff' : '#2e2e35'}; color: #efeff1; border: none; border-radius: 4px; cursor: pointer;">
                  ${channel.enabled ? 'Disable' : 'Enable'}
                </button>
                <button class="tvm-channel-remove" data-channel="${channel.channelName}"
                  style="padding: 4px 8px; font-size: 11px; background: #e91916; color: #efeff1; border: none; border-radius: 4px; cursor: pointer;">
                  Remove
                </button>
              </div>
            </div>
          `;
        }

        html += '</div>';
        listContainer.innerHTML = html;

        // Setup event listeners for channel actions
        listContainer.querySelectorAll('.tvm-channel-toggle').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const channelName = e.target.dataset.channel;
            const enabled = e.target.dataset.enabled === 'true';
            this.handleToggleChannel(channelName, !enabled);
          });
        });

        listContainer.querySelectorAll('.tvm-channel-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const channelName = e.target.dataset.channel;
            this.handleRemoveChannel(channelName);
          });
        });
      } else {
        listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #adadb8; font-size: 14px;">Error loading channels</div>';
      }
    } catch (error) {
      console.error('Error loading channels:', error);
      listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #e91916; font-size: 14px;">Error loading channels</div>';
    }
  }

  async handleToggleChannel(channelName, enabled) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SET_CHANNEL_ENABLED',
        channelName: channelName,
        enabled: enabled
      });

      if (response.success) {
        this.loadChannelsList();
        this.showMessage(`Channel ${channelName} ${enabled ? 'enabled' : 'disabled'}`, 'success');
      } else {
        this.showMessage(`Failed to toggle channel: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error toggling channel:', error);
      this.showMessage('Error toggling channel', 'error');
    }
  }

  async handleRemoveChannel(channelName) {
    if (!confirm(`Remove channel ${channelName} from tracking list?`)) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'REMOVE_MULTI_CHANNEL',
        channelName: channelName
      });

      if (response.success) {
        this.loadChannelsList();
        this.showMessage(`Channel ${channelName} removed`, 'success');
      } else {
        this.showMessage(`Failed to remove channel: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error removing channel:', error);
      this.showMessage('Error removing channel', 'error');
    }
  }

  async loadCSVSettings() {
    try {
      const csvToggle = document.getElementById('tvm-csv-export-enabled');
      const intervalInput = document.getElementById('tvm-csv-interval');
      
      if (!csvToggle) return;

      // Get current CSV settings from background
      const response = await chrome.runtime.sendMessage({
        type: 'GET_CSV_CONFIG'
      });

      if (response.success && response.config) {
        csvToggle.checked = response.config.enabled || false;
        if (intervalInput && response.config.writeIntervalMs) {
          intervalInput.value = Math.round(response.config.writeIntervalMs / 1000);
        }
      } else {
        // Default to disabled if can't get settings
        csvToggle.checked = false;
      }
    } catch (error) {
      console.error('Error loading CSV settings:', error);
      const csvToggle = document.getElementById('tvm-csv-export-enabled');
      if (csvToggle) {
        csvToggle.checked = false; // Default to disabled on error
      }
    }
  }

  async handleCSVToggle() {
    const csvToggle = document.getElementById('tvm-csv-export-enabled');
    if (!csvToggle) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: csvToggle.checked ? 'ENABLE_CSV_EXPORT' : 'DISABLE_CSV_EXPORT',
        config: csvToggle.checked ? {
          writeIntervalMs: parseInt(document.getElementById('tvm-csv-interval')?.value || '60') * 1000
        } : {}
      });

      if (response.success) {
        this.showMessage(`CSV export ${csvToggle.checked ? 'enabled' : 'disabled'}`, 'success');
      } else {
        csvToggle.checked = !csvToggle.checked; // Revert on error
        this.showMessage('Failed to toggle CSV export', 'error');
      }
    } catch (error) {
      console.error('Error toggling CSV:', error);
      csvToggle.checked = !csvToggle.checked;
      this.showMessage('Error toggling CSV export', 'error');
    }
  }

  async handleSaveCSVSettings() {
    const intervalInput = document.getElementById('tvm-csv-interval');
    const csvToggle = document.getElementById('tvm-csv-export-enabled');
    
    if (!intervalInput || !csvToggle) return;

    const interval = parseInt(intervalInput.value) * 1000; // Convert to milliseconds
    
    if (interval < 10000 || interval > 600000) {
      alert('Interval must be between 10 and 600 seconds');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_CSV_CONFIG',
        config: {
          writeIntervalMs: interval,
          enabled: csvToggle.checked
        }
      });

      if (response.success) {
        this.showMessage('CSV settings saved', 'success');
      } else {
        this.showMessage('Failed to save CSV settings', 'error');
      }
    } catch (error) {
      console.error('Error saving CSV settings:', error);
      this.showMessage('Error saving CSV settings', 'error');
    }
  }

  async handleExportAllCSV() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_MULTI_CHANNELS'
      });

      if (response.success && response.channels) {
        const channels = response.channels.filter(c => c.isTracking);
        
        if (channels.length === 0) {
          alert('No active channels to export');
          return;
        }

        this.showMessage(`Exporting ${channels.length} channels...`, 'info');

        for (const channel of channels) {
          try {
            await chrome.runtime.sendMessage({
              type: 'EXPORT_CHANNEL_TO_CSV',
              channelName: channel.channelName
            });
          } catch (error) {
            console.error(`Error exporting ${channel.channelName}:`, error);
          }
        }

        this.showMessage(`Exported ${channels.length} channels to CSV`, 'success');
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      this.showMessage('Error exporting CSV', 'error');
    }
  }

  showMessage(message, type = 'info') {
    // Simple message display (can be improved with better UI)
    const colors = {
      success: '#00d9ff',
      error: '#e91916',
      info: '#9147ff'
    };

    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: #18181b;
      border: 1px solid ${colors[type] || colors.info};
      border-radius: 4px;
      color: ${colors[type] || colors.info};
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    msgDiv.textContent = message;
    document.body.appendChild(msgDiv);

    setTimeout(() => {
      msgDiv.remove();
    }, 3000);
  }

  async handleStartTracking() {
    try {
      // Send message to background script to handle tab operations
      const response = await chrome.runtime.sendMessage({
        type: 'OPEN_TRACKING_PAGE',
        channelName: this.channelName
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to open tracking page');
      }

      console.log('Tracking page opened/switched successfully');
    } catch (error) {
      console.error('Error handling start tracking:', error);
      alert('Failed to open tracking page. Please try again.');
    }
  }



  // Simplified navigation handling
  watchForNavigation() {
    let lastChannel = this.channelName;

    new MutationObserver(() => {
      const oldChannel = lastChannel;
      this.detectChannel();

      if (oldChannel !== this.channelName) {
        console.log('Channel change detected:', oldChannel, '->', this.channelName);
        lastChannel = this.channelName;
        this.injectSimpleUI(); // Re-inject for new channel
      }
    }).observe(document, { subtree: true, childList: true });
  }

  async waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Handle any messages if needed
    });
  }
}

// Initialize the simplified extension
const metrics = new TwitchViewerMetrics();
