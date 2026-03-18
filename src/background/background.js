/**
 * SmartShot — Background Service Worker
 * Orchestrates capture flow, handles downloads, clipboard, and keyboard shortcut.
 */

import { generateFilename, defaultSettings, isCapturableUrl } from '../utils.js';

// ─── Message router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CAPTURE_VISIBLE') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' })
      .then(sendResponse)
      .catch((err) => sendResponse(null));
    return true;
  }

  if (msg.type === 'SAVE_SCREENSHOT') {
    handleSave(msg).then(sendResponse).catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === 'CAPTURE_PROGRESS') {
    // Relay progress to popup (if open)
    chrome.runtime.sendMessage({ type: 'PROGRESS_UPDATE', percent: msg.percent }).catch(() => {});
  }

  if (msg.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }
});

// ─── Keyboard shortcut ────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-page') {
    triggerCapture();
  }
});

// ─── Core functions ───────────────────────────────────────────────────────────

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
      scale:     settings.scale === '2x' ? 2 : settings.scale === '1.5x' ? 1.5 : 1,
      maxHeight: settings.maxHeight,
      format:    settings.format,
    },
  }, async (response) => {
    if (!response?.ok) return;
    await handleSave({ dataUrl: response.dataUrl, url: tab.url, settings });
  });
}

async function handleSave({ dataUrl, url, settings }) {
  if (!settings) settings = await getSettings();

  const filename = generateFilename(url, settings.format);
  const action   = settings.action; // 'file' | 'clipboard' | 'both'

  if (action === 'file' || action === 'both') {
    await chrome.downloads.download({
      url:      dataUrl,
      filename: filename,
      saveAs:   false,
    });
  }

  return { ok: true, filename };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

async function getSettings() {
  const stored = await chrome.storage.sync.get('settings');
  return { ...defaultSettings(), ...(stored.settings ?? {}) };
}
