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
  const hiddenSelectors = parseSelectors(settings.hiddenSelectors || '');

  // ── Area mode ─────────────────────────────────────────────────────────────
  if (captureMode === 'area') {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content/content.js'],
    });

    // Store pending info (dest, settings, url) for background to use
    await chrome.storage.session.set({
      pendingAreaCapture: {
        dest:     currentDest,
        settings: { ...settings, hiddenSelectors },
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
        hiddenSelectors,
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
      files: ['src/content/content.js'],
    });

    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'START_CAPTURE',
        options: {
          scale:           settings.scale === '2x' ? 2 : settings.scale === '1.5x' ? 1.5 : 1,
          maxHeight:       settings.maxHeight,
          format:          settings.format,
          delay:           settings.delay || 0,
          hiddenSelectors,
        },
      }, resolve);
    });

    if (!response?.ok) throw new Error(response?.error ?? 'Capture failed');

    if (currentDest === 'clipboard' || currentDest === 'both') {
      await copyToClipboard(response.dataUrl);
    }

    await chrome.runtime.sendMessage({
      type:     'SAVE_SCREENSHOT',
      dataUrl:  response.dataUrl,
      url:      tab.url,
      settings: { ...settings, action: currentDest === 'clipboard' ? 'none' : currentDest },
    });

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
  let pngUrl = dataUrl;
  if (!dataUrl.startsWith('data:image/png')) {
    const img    = await createImageBitmap(await (await fetch(dataUrl)).blob());
    const canvas = new OffscreenCanvas(img.width, img.height);
    canvas.getContext('2d').drawImage(img, 0, 0);
    const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
    pngUrl = await new Promise((res) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.readAsDataURL(pngBlob);
    });
  }
  const blob = await (await fetch(pngUrl)).blob();
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSelectors(str) {
  if (!str) return [];
  return str.split(',').map((s) => s.trim()).filter(Boolean);
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
    item.innerHTML = `
      <span class="history-domain" title="${entry.filename}">${entry.domain}</span>
      <span class="history-meta">
        ${entry.size}
        <span class="history-badge">${entry.format}</span>
        <span style="margin-left:4px">${time}</span>
      </span>
    `;
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
