// CSV Writer for automatic data export
export class CSVWriter {
  constructor() {
    this.writeInterval = null;
    this.writeIntervalMs = 60000; // Write every minute by default
    this.outputDirectory = 'twitch_viewer_data'; // Default directory name
    this.enabled = false;
  }

  // Initialize CSV writer with configuration
  init(config = {}) {
    this.writeIntervalMs = config.writeIntervalMs || 60000;
    this.outputDirectory = config.outputDirectory || 'twitch_viewer_data';
    this.enabled = config.enabled !== undefined ? config.enabled : true;

    if (this.enabled) {
      this.startPeriodicWrite();
    }
  }

  // Start periodic CSV writing
  startPeriodicWrite() {
    if (this.writeInterval) {
      clearInterval(this.writeInterval);
    }

    this.writeInterval = setInterval(() => {
      this.writeAllChannelsToCSV();
    }, this.writeIntervalMs);

    console.log(`CSV writer started: writing every ${this.writeIntervalMs / 1000} seconds`);
  }

  // Stop periodic CSV writing
  stopPeriodicWrite() {
    if (this.writeInterval) {
      clearInterval(this.writeInterval);
      this.writeInterval = null;
    }
    console.log('CSV writer stopped');
  }

  // Write all active channels to CSV
  async writeAllChannelsToCSV(trackingSessions) {
    if (!trackingSessions || trackingSessions.size === 0) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dateStr = new Date().toISOString().split('T')[0];

    // Process all channels in parallel
    const promises = [];
    for (const [channelName, session] of trackingSessions.entries()) {
      if (!session.isActive || session.paused) {
        continue;
      }

      promises.push(
        this.writeChannelDataToCSV(channelName, session, timestamp, dateStr)
          .catch(error => {
            console.error(`Error writing CSV for channel ${channelName}:`, error);
          })
      );
    }

    await Promise.allSettled(promises);
  }

  // Write single channel data to CSV
  async writeChannelDataToCSV(channelName, session, timestamp, dateStr) {
    const viewers = Array.from(session.data.viewers.values());
    if (viewers.length === 0) {
      return;
    }

    // Prepare CSV data
    const csvLines = [];
    
    // Add header if file doesn't exist
    csvLines.push('channel,username,id,display_name,created_at,description,first_seen,last_seen,time_in_stream_seconds,viewer_count,authenticated_count,timestamp\n');

    // Add data rows
    const currentTimestamp = new Date().toISOString();
    const viewerCount = session.data.metadata.viewerCount || 0;
    const authenticatedCount = session.data.metadata.authenticatedCount || 0;

    for (const viewer of viewers) {
      const row = [
        this.escapeCSV(channelName),
        this.escapeCSV(viewer.username || ''),
        this.escapeCSV(viewer.id || ''),
        this.escapeCSV(viewer.displayName || viewer.username || ''),
        this.escapeCSV(viewer.createdAt || ''),
        this.escapeCSV(viewer.description || ''),
        this.escapeCSV(new Date(viewer.firstSeen).toISOString()),
        this.escapeCSV(new Date(viewer.lastSeen).toISOString()),
        Math.round((viewer.lastSeen - viewer.firstSeen) / 1000),
        viewerCount,
        authenticatedCount,
        currentTimestamp
      ].join(',');

      csvLines.push(row + '\n');
    }

    const csvContent = csvLines.join('');

    // Use Chrome downloads API to save file
    const filename = `${this.outputDirectory}/${channelName}_${dateStr}_${timestamp}.csv`;
    
    try {
      // Convert CSV to data URL
      const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);

      // Download file using Chrome downloads API
      if (chrome.downloads && chrome.downloads.download) {
        await chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: false // Save to default downloads folder
        });
        console.log(`CSV written for channel ${channelName}: ${filename}`);
      } else {
        // Fallback: save to storage
        await this.saveCSVToStorage(channelName, csvContent, timestamp);
        console.log(`CSV saved to storage for channel ${channelName} (downloads API not available)`);
      }
    } catch (error) {
      console.error(`Error downloading CSV for ${channelName}:`, error);
      // Fallback: try to save via storage and log
      await this.saveCSVToStorage(channelName, csvContent, timestamp);
    }
  }

  // Fallback: save CSV to chrome.storage
  async saveCSVToStorage(channelName, csvContent, timestamp) {
    try {
      const key = `csv_export_${channelName}_${timestamp}`;
      await chrome.storage.local.set({ [key]: csvContent });
      console.log(`CSV saved to storage with key: ${key}`);
    } catch (error) {
      console.error('Error saving CSV to storage:', error);
    }
  }

  // Write viewer count history to CSV
  async writeViewerCountHistoryToCSV(channelName, history, timestamp, dateStr) {
    if (!history || history.length === 0) {
      return;
    }

    const csvLines = [];
    csvLines.push('channel,timestamp,viewer_count,authenticated_count\n');

    for (const entry of history) {
      const row = [
        this.escapeCSV(channelName),
        this.escapeCSV(new Date(entry.timestamp).toISOString()),
        entry.viewerCount || 0,
        entry.authenticatedCount || 0
      ].join(',');

      csvLines.push(row + '\n');
    }

    const csvContent = csvLines.join('');
    const filename = `${this.outputDirectory}/${channelName}_history_${dateStr}_${timestamp}.csv`;

    try {
      const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);

      if (chrome.downloads && chrome.downloads.download) {
        await chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: false
        });
        console.log(`Viewer count history CSV written for channel ${channelName}: ${filename}`);
      } else {
        await this.saveCSVToStorage(channelName + '_history', csvContent, timestamp);
        console.log(`Viewer count history CSV saved to storage for channel ${channelName}`);
      }
    } catch (error) {
      console.error(`Error downloading history CSV for ${channelName}:`, error);
      await this.saveCSVToStorage(channelName + '_history', csvContent, timestamp);
    }
  }

  // Escape CSV values
  escapeCSV(str) {
    if (str === null || str === undefined) return '';
    str = String(str);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  // Update configuration
  updateConfig(config) {
    if (config.writeIntervalMs !== undefined) {
      this.writeIntervalMs = config.writeIntervalMs;
    }
    if (config.outputDirectory !== undefined) {
      this.outputDirectory = config.outputDirectory;
    }
    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
      if (this.enabled) {
        this.startPeriodicWrite();
      } else {
        this.stopPeriodicWrite();
      }
    }
  }
}

