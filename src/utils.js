/**
 * SmartShot — Utility functions
 * Pure functions: no browser APIs here, fully testable with Jest.
 */

/**
 * Generates a filename from the page URL and current timestamp.
 * Format: domain_YYYY-MM-DD_HHmm.jpg (or .png / .pdf)
 *
 * @param {string} url - Full page URL
 * @param {string} format - 'jpg' | 'png' | 'pdf'
 * @param {Date}   date  - Date object (default: now)
 * @returns {string}
 */
export function generateFilename(url, format = 'jpg', date = new Date()) {
  let domain = 'page';
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch (_) {
    domain = 'page';
  }

  // Sanitise domain — remove characters not safe for filenames
  domain = domain.replace(/[^a-z0-9.-]/gi, '_');

  const pad = (n) => String(n).padStart(2, '0');
  const y  = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d  = pad(date.getDate());
  const h  = pad(date.getHours());
  const mi = pad(date.getMinutes());

  return `${domain}_${y}-${mo}-${d}_${h}${mi}.${format}`;
}

/**
 * Clamps a number between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Returns a capture scale factor based on user preference and device DPR.
 * @param {'1x'|'1.5x'|'2x'} preference
 * @param {number} devicePixelRatio - window.devicePixelRatio (default 1)
 * @returns {number}
 */
export function resolveScale(preference, devicePixelRatio = 1) {
  const map = { '1x': 1, '1.5x': 1.5, '2x': 2 };
  const requested = map[preference] ?? 1;
  // Never exceed 2× regardless of screen DPR
  return clamp(requested, 1, 2);
}

/**
 * Checks whether a URL is capturable.
 * chrome://, about:, moz-extension:// etc. cannot be captured.
 * @param {string} url
 * @returns {boolean}
 */
export function isCapturableUrl(url) {
  if (!url) return false;
  const blocked = ['chrome://', 'chrome-extension://', 'about:', 'moz-extension://', 'edge://'];
  return blocked.every((prefix) => !url.startsWith(prefix));
}

/**
 * Formats bytes into a human-readable size string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Returns default extension settings.
 * @returns {object}
 */
export function defaultSettings() {
  return {
    format:      'jpg',
    scale:       '1x',
    action:      'file',  // 'file' | 'clipboard' | 'both'
    delay:       0,       // seconds before capture starts
    maxHeight:   30000,   // px — prevents infinite scroll loops
    autoPreview: false,
    historyMax:  10,      // max entries kept in local history
  };
}

/**
 * Converts a dataURL to a Blob.
 * @param {string} dataUrl
 * @returns {Blob}
 */
export function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mime    = header.match(/:(.*?);/)[1];
  const binary  = atob(data);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Returns a human-readable label for an action value.
 * @param {'file'|'clipboard'|'both'} action
 * @returns {string}
 */
export function actionLabel(action) {
  const labels = { file: 'Save to file', clipboard: 'Copy to clipboard', both: 'Save + Copy' };
  return labels[action] ?? 'Unknown';
}

/**
 * Builds a history entry object.
 * @param {string} url       - Page URL captured
 * @param {string} filename  - Generated filename
 * @param {string} format    - 'jpg' | 'png' | 'pdf'
 * @param {number} bytes     - File size in bytes
 * @param {Date}   date      - Capture date (default: now)
 * @returns {object}
 */
export function buildHistoryEntry(url, filename, format, bytes, date = new Date()) {
  return {
    id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    url,
    filename,
    format,
    bytes,
    size:      formatBytes(bytes),
    timestamp: date.toISOString(),
    domain:    (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'page'; } })(),
  };
}

/**
 * Adds an entry to the history array, trimming to maxEntries.
 * Returns a NEW array (pure — does not mutate input).
 * @param {object[]} history
 * @param {object}   entry
 * @param {number}   maxEntries
 * @returns {object[]}
 */
export function addToHistory(history, entry, maxEntries = 10) {
  return [entry, ...history].slice(0, maxEntries);
}
