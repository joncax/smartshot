/**
 * SmartShot — Popup script
 */

import { isCapturableUrl } from '../utils.js';

const $ = (id) => document.getElementById(id);

const btnCapture   = $('btn-capture');
const btnLabel     = $('btn-label');
const progressWrap = $('progress-wrap');
const progressFill = $('progress-fill');
const progressLbl  = $('progress-label');
const statusEl     = $('status');
const btnOptions   = $('btn-options');

// ─── Destination toggles ──────────────────────────────────────────────────────

let currentDest = 'file';

document.querySelectorAll('.dest-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dest-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentDest = btn.dataset.dest;
    saveDestPref(currentDest);
  });
});

async function loadDestPref() {
  const { destPref } = await chrome.storage.sync.get('destPref');
  if (destPref) {
    currentDest = destPref;
    document.querySelectorAll('.dest-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.dest === destPref);
    });
  }
}

function saveDestPref(dest) {
  chrome.storage.sync.set({ destPref: dest });
}

// ─── Progress listener ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'PROGRESS_UPDATE') {
    setProgress(msg.percent);
  }
});

function setProgress(pct) {
  progressFill.style.width = `${pct}%`;
  progressLbl.textContent  = `${pct}%`;
}

// ─── Capture ──────────────────────────────────────────────────────────────────

btnCapture.addEventListener('click', startCapture);

async function startCapture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !isCapturableUrl(tab.url)) {
    showStatus('Cannot capture this page (browser pages are restricted).', 'error');
    return;
  }

  // UI: capturing state
  btnCapture.disabled = true;
  btnLabel.textContent = 'Capturing…';
  progressWrap.classList.remove('hidden');
  statusEl.classList.add('hidden');
  setProgress(0);

  try {
    // Inject content script (idempotent — content script guards double-injection)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content/content.js'],
    });

    // Get current settings
    const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });

    // Start capture
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tab.id,
        {
          type: 'START_CAPTURE',
          options: {
            scale:     settings.scale === '2x' ? 2 : settings.scale === '1.5x' ? 1.5 : 1,
            maxHeight: settings.maxHeight,
            format:    settings.format,
          },
        },
        resolve
      );
    });

    if (!response?.ok) throw new Error(response?.error ?? 'Capture failed');

    // Save / copy
    await chrome.runtime.sendMessage({
      type:     'SAVE_SCREENSHOT',
      dataUrl:  response.dataUrl,
      url:      tab.url,
      settings: { ...settings, action: currentDest },
    });

    // Clipboard (handled in popup because clipboard API requires user gesture context)
    if (currentDest === 'clipboard' || currentDest === 'both') {
      await copyToClipboard(response.dataUrl);
    }

    showStatus('✓ Screenshot saved!', 'ok');

  } catch (err) {
    showStatus(`Error: ${err.message}`, 'error');
  } finally {
    btnCapture.disabled = false;
    btnLabel.textContent = 'Capture Full Page';
    setTimeout(() => progressWrap.classList.add('hidden'), 1200);
  }
}

// ─── Clipboard ────────────────────────────────────────────────────────────────

async function copyToClipboard(dataUrl) {
  const res    = await fetch(dataUrl);
  const blob   = await res.blob();
  const item   = new ClipboardItem({ 'image/png': blob });
  await navigator.clipboard.write([item]);
}

// ─── Settings link ────────────────────────────────────────────────────────────

btnOptions.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// ─── Status helper ────────────────────────────────────────────────────────────

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className   = `status ${type}`;
  setTimeout(() => statusEl.classList.add('hidden'), 3500);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

loadDestPref();
