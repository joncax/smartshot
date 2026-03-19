/**
 * SmartShot — Popup script (Phase 3 — fixed)
 * Fixes: area capture closes popup too early, settings not loading.
 */

import { isCapturableUrl } from '../utils.js';

const $ = (id) => document.getElementById(id);

const btnCapture     = $('btn-capture');
const btnLabel       = $('btn-label');
const progressWrap   = $('progress-wrap');
const progressFill   = $('progress-fill');
const progressLbl    = $('progress-label');
const statusEl       = $('status');
const historySection = $('history-section');
const historyList    = $('history-list');
const btnClearHist   = $('btn-clear-history');

// ─── Capture mode ─────────────────────────────────────────────────────────────

let captureMode = 'full';

document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    captureMode = btn.dataset.mode;
    btnLabel.textContent = captureMode === 'area' ? 'Select Area' : 'Capture Full Page';
  });
});

// ─── Destination toggles ──────────────────────────────────────────────────────

let currentDest = 'file';

document.querySelectorAll('.dest-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dest-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentDest = btn.dataset.dest;
    chrome.storage.sync.set({ destPref: currentDest });
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

// ─── Progress ─────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'PROGRESS_UPDATE') setProgress(msg.percent);
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
    showStatus('Cannot capture this page.', 'error');
    return;
  }

  const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });

  // ── Area mode ─────────────────────────────────────────────────────────────
  if (captureMode === 'area') {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['/src/content/content.js'],
    });

    // Store pending info (dest, settings, url) for background to use
    await chrome.storage.local.set({
      pendingAreaCapture: {
        dest:     currentDest,
        settings: { ...settings},
        url:      tab.url,
        needsClipboard: currentDest === 'clipboard' || currentDest === 'both',
      }
    });

    // Ask content script to start area selection — it will send
    // AREA_CAPTURE_RESULT to background when done.
    chrome.tabs.sendMessage(tab.id, {
      type: 'START_AREA_CAPTURE',
      options: {
        scale:           settings.scale === '2x' ? 2 : settings.scale === '1.5x' ? 1.5 : 1,
        format:          settings.format,
      },
    });

    // Close popup AFTER message is sent
    window.close();
    return;
  }

  // ── Full page mode ─────────────────────────────────────────────────────────
  btnCapture.disabled = true;
  btnLabel.textContent = settings.delay > 0 ? `Starting in ${settings.delay}s…` : 'Capturing…';
  progressWrap.classList.remove('hidden');
  statusEl.classList.add('hidden');
  setProgress(0);

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['/src/content/content.js'],
    });

    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'START_CAPTURE',
        options: {
          scale:           settings.scale === '2x' ? 2 : settings.scale === '1.5x' ? 1.5 : 1,
          maxHeight:       settings.maxHeight,
          format:          settings.format,
          delay:           settings.delay || 0,
        },
      }, resolve);
    });

    if (!response?.ok) throw new Error(response?.error ?? 'Capture failed');

    // Save to file via background
    await chrome.runtime.sendMessage({
      type:     'SAVE_SCREENSHOT',
      dataUrl:  response.dataUrl,
      url:      tab.url,
      settings: { ...settings, action: currentDest === 'clipboard' ? 'none' : currentDest },
    });

    // Clipboard — try/catch separately so file save still works if clipboard fails
    let clipboardOk = false;
    if (currentDest === 'clipboard' || currentDest === 'both') {
      try {
        await copyToClipboard(response.dataUrl);
        clipboardOk = true;
      } catch (clipErr) {
        console.warn('[SmartShot] clipboard failed:', clipErr.message);
        showStatus('✓ Saved! (clipboard not supported in this browser)', 'ok');
        await loadHistory();
        return;
      }
    }

    // Preview tab — open via background to avoid dataUrl restriction in Firefox
    if (settings.autoPreview) {
      try {
        await chrome.runtime.sendMessage({ type: 'OPEN_PREVIEW', dataUrl: response.dataUrl });
      } catch (e) {
        console.warn('[SmartShot] preview tab failed:', e.message);
      }
    }

    const label = currentDest === 'clipboard' ? '✓ Copied to clipboard!'
                : currentDest === 'both'      ? '✓ Saved + copied!'
                :                               '✓ Screenshot saved!';
    showStatus(label, 'ok');
    await loadHistory();

  } catch (err) {
    showStatus(`Error: ${err.message}`, 'error');
  } finally {
    btnCapture.disabled  = false;
    btnLabel.textContent = 'Capture Full Page';
    setTimeout(() => progressWrap.classList.add('hidden'), 1500);
  }
}

// ─── Clipboard ────────────────────────────────────────────────────────────────

async function copyToClipboard(dataUrl) {
  // Convert to PNG blob using regular canvas (works in both Chrome and Firefox)
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width  = img.width;
  canvas.height = img.height;
  canvas.getContext('2d').drawImage(img, 0, 0);

  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

  // Try modern Clipboard API first
  if (navigator.clipboard && navigator.clipboard.write) {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    return;
  }

  // Fallback: not supported
  throw new Error('Clipboard API not available in this browser');
}


// ─── History ──────────────────────────────────────────────────────────────────

async function loadHistory() {
  const history = await chrome.runtime.sendMessage({ type: 'GET_HISTORY' });
  if (!history || history.length === 0) {
    historySection.classList.add('hidden');
    return;
  }
  historySection.classList.remove('hidden');
  historyList.innerHTML = '';
  history.slice(0, 5).forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Build DOM safely — no innerHTML with dynamic values
    const domain = document.createElement('span');
    domain.className = 'history-domain';
    domain.title = entry.filename;
    domain.textContent = entry.domain;

    const meta = document.createElement('span');
    meta.className = 'history-meta';

    const sizeText = document.createTextNode(entry.size + ' ');

    const badge = document.createElement('span');
    badge.className = 'history-badge';
    badge.textContent = entry.format;

    const timeSpan = document.createElement('span');
    timeSpan.style.marginLeft = '4px';
    timeSpan.textContent = time;

    meta.appendChild(sizeText);
    meta.appendChild(badge);
    meta.appendChild(timeSpan);

    item.appendChild(domain);
    item.appendChild(meta);
    historyList.appendChild(item);
  });
}

btnClearHist.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
  historySection.classList.add('hidden');
  historyList.innerHTML = '';
});

// ─── Settings link ────────────────────────────────────────────────────────────

$('btn-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// ─── Status ───────────────────────────────────────────────────────────────────

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className   = `status ${type}`;
  setTimeout(() => statusEl.classList.add('hidden'), 3500);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

loadDestPref();
loadHistory();