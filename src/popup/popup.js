/**
 * SmartShot — Popup script (Phase 2)
 * Adds: history panel, delay awareness, clipboard, format badge.
 */

import { isCapturableUrl, formatBytes } from '../utils.js';

const $ = (id) => document.getElementById(id);

const btnCapture    = $('btn-capture');
const btnLabel      = $('btn-label');
const progressWrap  = $('progress-wrap');
const progressFill  = $('progress-fill');
const progressLbl   = $('progress-label');
const statusEl      = $('status');
const historySection = $('history-section');
const historyList   = $('history-list');
const btnClearHist  = $('btn-clear-history');

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

  // Show delay info in button if delay > 0
  if (settings.delay > 0) {
    btnLabel.textContent = `Starting in ${settings.delay}s…`;
  } else {
    btnLabel.textContent = 'Capturing…';
  }

  btnCapture.disabled = true;
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
          scale:     settings.scale === '2x' ? 2 : settings.scale === '1.5x' ? 1.5 : 1,
          maxHeight: settings.maxHeight,
          format:    settings.format,
          delay:     settings.delay,
        },
      }, resolve);
    });

    if (!response?.ok) throw new Error(response?.error ?? 'Capture failed');

    // Clipboard (needs to run in popup context — user gesture)
    if (currentDest === 'clipboard' || currentDest === 'both') {
      await copyToClipboard(response.dataUrl);
    }

    // Save to file via background
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
    btnCapture.disabled = false;
    btnLabel.textContent = 'Capture Full Page';
    setTimeout(() => progressWrap.classList.add('hidden'), 1500);
  }
}

// ─── Clipboard ────────────────────────────────────────────────────────────────

async function copyToClipboard(dataUrl) {
  // Clipboard API only supports image/png — convert if needed
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

  const res  = await fetch(pngUrl);
  const blob = await res.blob();
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
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
        <span class="history-meta" style="margin-left:4px">${time}</span>
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
