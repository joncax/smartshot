/**
 * SmartShot — Background Service Worker (Phase 3 — final)
 * Clipboard for area capture: injected function into the active tab.
 */

import { generateFilename, defaultSettings, isCapturableUrl, buildHistoryEntry, addToHistory } from '../utils.js';

// ─── Message router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'CAPTURE_VISIBLE') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' })
      .then(sendResponse).catch(() => sendResponse(null));
    return true;
  }

  if (msg.type === 'SAVE_SCREENSHOT') {
    handleSave(msg).then(sendResponse).catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === 'CAPTURE_PROGRESS') {
    chrome.runtime.sendMessage({ type: 'PROGRESS_UPDATE', percent: msg.percent }).catch(() => {});
  }

  if (msg.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }

  if (msg.type === 'GET_HISTORY') {
    getHistory().then(sendResponse);
    return true;
  }

  if (msg.type === 'CLEAR_HISTORY') {
    chrome.storage.local.remove('history').then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'AREA_CAPTURE_RESULT') {
    handleAreaCaptureResult(msg, sender.tab).catch(console.error);
    sendResponse({ ok: true });
    return true;
  }
});

// ─── Keyboard shortcut ────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-page') triggerCapture();
});

async function triggerCapture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !isCapturableUrl(tab.url)) return;
  const settings = await getSettings();
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['/src/content/content.js'] });
  chrome.tabs.sendMessage(tab.id, {
    type: 'START_CAPTURE',
    options: {
      scale:           resolveScaleNumber(settings.scale),
      maxHeight:       settings.maxHeight,
      format:          settings.format,
      delay:           settings.delay || 0,
    },
  }, async (response) => {
    if (!response?.ok) return;
    await handleSave({ dataUrl: response.dataUrl, url: tab.url, settings });
  });
}

// ─── Area capture result ──────────────────────────────────────────────────────

async function handleAreaCaptureResult(msg, senderTab) {
  if (!msg.ok || !msg.dataUrl) return;

  const stored  = await chrome.storage.local.get('pendingAreaCapture');
  const pending = stored.pendingAreaCapture;
  if (!pending) return;
  await chrome.storage.local.remove('pendingAreaCapture');

  const settings       = pending.settings || await getSettings();
  const dest           = pending.dest || 'file';
  const url            = pending.url || senderTab?.url || 'https://unknown';
  const needsClipboard = pending.needsClipboard || false;
  const format         = settings.format || 'jpg';
  const filename       = generateFilename(url, format);

  // Save to file
  if (dest === 'file' || dest === 'both') {
    await chrome.downloads.download({ url: msg.dataUrl, filename, saveAs: false });
  }

  // Clipboard — inject function into the active tab (has user-gesture context)
  if (needsClipboard) {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab) {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: copyDataUrlToClipboard,
          args: [msg.dataUrl],
        });
      }
    } catch (err) {
      console.error('[SmartShot] clipboard inject error:', err.message);
    }
  }

  // History
  const base64  = msg.dataUrl.split(',')[1] ?? '';
  const bytes   = Math.round(base64.length * 0.75);
  const entry   = buildHistoryEntry(url, filename, format, bytes);
  const current = await getHistory();
  const updated = addToHistory(current, entry, settings.historyMax || 10);
  await chrome.storage.local.set({ history: updated });

  // Preview
  if (settings.autoPreview) {
    await chrome.tabs.create({ url: msg.dataUrl });
  }
}

/**
 * This function is injected into the page tab to access clipboard.
 * Must be self-contained (no closure references).
 */
async function copyDataUrlToClipboard(dataUrl) {
  try {
    const res  = await fetch(dataUrl);
    const blob = await res.blob();
    let pngBlob = blob;
    if (blob.type !== 'image/png') {
      const img    = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(img.width, img.height);
      canvas.getContext('2d').drawImage(img, 0, 0);
      pngBlob = await canvas.convertToBlob({ type: 'image/png' });
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
  } catch (e) {
    console.error('[SmartShot] clipboard error:', e.message);
  }
}

// ─── Full page save handler ───────────────────────────────────────────────────

export async function handleSave({ dataUrl, url, settings }) {
  if (!settings) settings = await getSettings();

  const filename = generateFilename(url, settings.format || 'jpg');
  const action   = settings.action;

  if (action === 'file' || action === 'both') {
    await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
  }

  const base64  = dataUrl.split(',')[1] ?? '';
  const bytes   = Math.round(base64.length * 0.75);
  const entry   = buildHistoryEntry(url, filename, settings.format || 'jpg', bytes);
  const current = await getHistory();
  const updated = addToHistory(current, entry, settings.historyMax || 10);
  await chrome.storage.local.set({ history: updated });

  if (settings.autoPreview) {
    await chrome.tabs.create({ url: dataUrl });
  }

  return { ok: true, filename, bytes };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveScaleNumber(scale) {
  return scale === '2x' ? 2 : scale === '1.5x' ? 1.5 : 1;
}


async function getSettings() {
  const stored = await chrome.storage.sync.get('settings');
  return Object.assign({}, defaultSettings(), stored.settings || {});
}

async function getHistory() {
  const stored = await chrome.storage.local.get('history');
  return stored.history || [];
}