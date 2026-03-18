/**
 * SmartShot — Background Service Worker (Phase 2)
 * Adds: history, PDF (foundation), delay relay, preview tab, clipboard relay.
 */

import { generateFilename, defaultSettings, isCapturableUrl, buildHistoryEntry, addToHistory } from '../utils.js';

// ─── Message router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'CAPTURE_VISIBLE') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' })
      .then(sendResponse)
      .catch(() => sendResponse(null));
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
});

// ─── Keyboard shortcut ────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-page') triggerCapture();
});

// ─── Trigger from keyboard shortcut ──────────────────────────────────────────

async function triggerCapture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !isCapturableUrl(tab.url)) return;

  const settings = await getSettings();

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['src/content/content.js'],
  });

  chrome.tabs.sendMessage(tab.id, {
    type: 'START_CAPTURE',
    options: {
      scale:     resolveScaleNumber(settings.scale),
      maxHeight: settings.maxHeight,
      format:    settings.format,
      delay:     settings.delay,
    },
  }, async (response) => {
    if (!response?.ok) return;
    await handleSave({ dataUrl: response.dataUrl, url: tab.url, settings });
  });
}

// ─── Save handler ─────────────────────────────────────────────────────────────

export async function handleSave({ dataUrl, url, settings }) {
  if (!settings) settings = await getSettings();

  const filename = generateFilename(url, settings.format);
  const action   = settings.action;

  // Save to file
  if (action === 'file' || action === 'both') {
    await chrome.downloads.download({
      url:      dataUrl,
      filename: filename,
      saveAs:   false,
    });
  }

  // Estimate size from base64 length
  const base64 = dataUrl.split(',')[1] ?? '';
  const bytes   = Math.round(base64.length * 0.75);

  // Add to history
  const entry   = buildHistoryEntry(url, filename, settings.format, bytes);
  const current = await getHistory();
  const updated = addToHistory(current, entry, settings.historyMax ?? 10);
  await chrome.storage.local.set({ history: updated });

  // Open preview tab if enabled
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
  return { ...defaultSettings(), ...(stored.settings ?? {}) };
}

async function getHistory() {
  const stored = await chrome.storage.local.get('history');
  return stored.history ?? [];
}
