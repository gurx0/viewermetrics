// Multi-Channel Manager - Manages automatic tracking of multiple channels
export class MultiChannelManager {
  constructor(backgroundService) {
    this.backgroundService = backgroundService;
    this.channels = []; // Array of { channelName, config, enabled }
    this.autoStartEnabled = false;
    this.loadChannelsFromStorage();
  }

  // Load channels configuration from storage
  async loadChannelsFromStorage() {
    try {
      const result = await chrome.storage.local.get(['multiChannelConfig']);
      if (result.multiChannelConfig) {
        this.channels = result.multiChannelConfig.channels || [];
        this.autoStartEnabled = result.multiChannelConfig.autoStartEnabled || false;

        if (this.autoStartEnabled && this.channels.length > 0) {
          // Auto-start tracking for enabled channels
          this.startAllEnabledChannels();
        }
      }
    } catch (error) {
      console.error('Error loading multi-channel config:', error);
    }
  }

  // Save channels configuration to storage
  async saveChannelsToStorage() {
    try {
      await chrome.storage.local.set({
        multiChannelConfig: {
          channels: this.channels,
          autoStartEnabled: this.autoStartEnabled,
          lastUpdated: Date.now()
        }
      });
    } catch (error) {
      console.error('Error saving multi-channel config:', error);
    }
  }

  // Add channel to tracking list
  async addChannel(channelName, config = {}) {
    // Check if channel already exists
    const existingIndex = this.channels.findIndex(c => c.channelName === channelName);
    
    if (existingIndex >= 0) {
      // Update existing channel config
      this.channels[existingIndex] = {
        channelName,
        config: { ...this.channels[existingIndex].config, ...config },
        enabled: true
      };
    } else {
      // Add new channel
      this.channels.push({
        channelName,
        config: {
          refreshInterval: 30000,
          requestInterval: 5000,
          timeoutDuration: 300000,
          batchSize: 20,
          concurrentUserInfoBatches: 50,
          ...config
        },
        enabled: true
      });
    }

    await this.saveChannelsToStorage();

    // Start tracking if auto-start is enabled
    if (this.autoStartEnabled) {
      await this.startChannelTracking(channelName);
    }

    return { success: true, channelName };
  }

  // Remove channel from tracking list
  async removeChannel(channelName) {
    const index = this.channels.findIndex(c => c.channelName === channelName);
    if (index >= 0) {
      // Stop tracking if active
      await this.backgroundService.stopBackgroundTracking(channelName);
      
      // Remove from list
      this.channels.splice(index, 1);
      await this.saveChannelsToStorage();
      return { success: true, channelName };
    }
    return { success: false, error: 'Channel not found' };
  }

  // Enable/disable channel
  async setChannelEnabled(channelName, enabled) {
    const channel = this.channels.find(c => c.channelName === channelName);
    if (channel) {
      channel.enabled = enabled;
      await this.saveChannelsToStorage();

      if (enabled) {
        await this.startChannelTracking(channelName);
      } else {
        await this.backgroundService.stopBackgroundTracking(channelName);
      }

      return { success: true, channelName, enabled };
    }
    return { success: false, error: 'Channel not found' };
  }

  // Start tracking for a single channel
  async startChannelTracking(channelName) {
    const channel = this.channels.find(c => c.channelName === channelName);
    if (!channel || !channel.enabled) {
      return { success: false, error: 'Channel not found or disabled' };
    }

    // Check if already tracking
    if (this.backgroundService.trackingSessions.has(channelName)) {
      return { success: true, message: 'Already tracking' };
    }

    // Start tracking (use null tabId for background-only tracking)
    const result = await this.backgroundService.startBackgroundTracking(
      channelName,
      { ...channel.config, stopAllSessions: false },
      null // No tab ID for background-only tracking
    );

    return result;
  }

  // Start tracking for all enabled channels
  async startAllEnabledChannels() {
    const results = [];
    for (const channel of this.channels) {
      if (channel.enabled) {
        try {
          const result = await this.startChannelTracking(channel.channelName);
          results.push({ channelName: channel.channelName, ...result });
        } catch (error) {
          results.push({ channelName: channel.channelName, success: false, error: error.message });
        }
      }
    }
    return results;
  }

  // Stop tracking for all channels
  async stopAllChannels() {
    const results = [];
    for (const channel of this.channels) {
      try {
        const result = await this.backgroundService.stopBackgroundTracking(channel.channelName);
        results.push({ channelName: channel.channelName, ...result });
      } catch (error) {
        results.push({ channelName: channel.channelName, success: false, error: error.message });
      }
    }
    return results;
  }

  // Get list of all channels
  getChannels() {
    return this.channels.map(channel => ({
      channelName: channel.channelName,
      enabled: channel.enabled,
      config: channel.config,
      isTracking: this.backgroundService.trackingSessions.has(channel.channelName)
    }));
  }

  // Get tracking status for all channels
  getTrackingStatus() {
    const status = [];
    for (const channel of this.channels) {
      const session = this.backgroundService.trackingSessions.get(channel.channelName);
      status.push({
        channelName: channel.channelName,
        enabled: channel.enabled,
        isTracking: !!session,
        isPaused: session?.paused || false,
        viewerCount: session?.data?.metadata?.viewerCount || 0,
        authenticatedCount: session?.data?.metadata?.authenticatedCount || 0,
        totalViewers: session?.data?.viewers?.size || 0
      });
    }
    return status;
  }

  // Enable/disable auto-start
  async setAutoStartEnabled(enabled) {
    this.autoStartEnabled = enabled;
    await this.saveChannelsToStorage();

    if (enabled) {
      await this.startAllEnabledChannels();
    } else {
      await this.stopAllChannels();
    }

    return { success: true, autoStartEnabled: enabled };
  }

  // Update channel configuration
  async updateChannelConfig(channelName, newConfig) {
    const channel = this.channels.find(c => c.channelName === channelName);
    if (channel) {
      channel.config = { ...channel.config, ...newConfig };
      await this.saveChannelsToStorage();

      // Update active session if exists
      if (this.backgroundService.trackingSessions.has(channelName)) {
        await this.backgroundService.updateTrackingConfig(channelName, newConfig);
      }

      return { success: true, channelName, config: channel.config };
    }
    return { success: false, error: 'Channel not found' };
  }
}

