;(function () {
  'use strict';

  // ─── Guard: remover overlay anterior e prevenir listeners duplicados ────────

  // Remover overlay de captura anterior se existir
  document.getElementById('__smartshot_overlay')?.remove();

  // Usar flag no window para evitar listeners duplicados
  // No Firefox, executeScript re-injeta o IIFE, criando listeners duplicados
  if (window.__smartshotLoaded) {
    // Já carregado — apenas resetar estado ativo para permitir nova captura
    window.__smartshotActive = false;
    return;
  }
  window.__smartshotLoaded = true;
  window.__smartshotActive = false;

  // ─── Countdown overlay ──────────────────────────────────────────────────────

  function showCountdown(seconds) {
    return new Promise((resolve) => {
      if (seconds <= 0) return resolve();
      const overlay = makeOverlay(`SmartShot captures in ${seconds}s`);
      document.body.appendChild(overlay);
      let remaining = seconds;
      const iv = setInterval(() => {
        remaining--;
        if (remaining <= 0) { clearInterval(iv); overlay.remove(); resolve(); }
        else overlay.textContent = `SmartShot captures in ${remaining}s`;
      }, 1000);
    });
  }

  // ─── Fixed/sticky element helpers ───────────────────────────────────────────

  function getFixedElements() {
    const fixed = [];
    document.querySelectorAll('*').forEach((el) => {
      const s = window.getComputedStyle(el);
      if (s.position === 'fixed' || s.position === 'sticky') {
        fixed.push({ el, orig: el.style.visibility });
      }
    });
    return fixed;
  }
  function hideFixed(els)    { els.forEach(({ el }) => (el.style.visibility = 'hidden')); }
  function restoreFixed(els) { els.forEach(({ el, orig }) => (el.style.visibility = orig)); }

  // ─── Area selection overlay ─────────────────────────────────────────────────

  function selectArea() {
    return new Promise((resolve, reject) => {
      const overlay = document.createElement('div');
      overlay.id = '__smartshot_overlay';
      overlay.style.cssText = `
        position:fixed;inset:0;z-index:2147483646;
        cursor:crosshair;background:rgba(0,0,0,0.35);
      `;

      const hint = document.createElement('div');
      hint.style.cssText = `
        position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
        background:rgba(15,17,23,0.92);color:#fff;
        font:500 14px/1 system-ui,sans-serif;
        padding:10px 18px;border-radius:8px;
        border:1px solid rgba(79,127,255,0.5);pointer-events:none;
      `;
      hint.textContent = 'Drag to select area  ·  Esc to cancel';
      overlay.appendChild(hint);

      const sel = document.createElement('div');
      sel.style.cssText = `
        position:fixed;border:2px solid #4f7fff;
        background:rgba(79,127,255,0.12);
        pointer-events:none;display:none;
      `;
      overlay.appendChild(sel);
      document.body.appendChild(overlay);

      let startX, startY, dragging = false;

      overlay.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startX = e.clientX; startY = e.clientY; dragging = true;
        hint.style.display = 'none';
        sel.style.display = 'block';
        sel.style.left = startX + 'px'; sel.style.top = startY + 'px';
        sel.style.width = '0'; sel.style.height = '0';
      });

      overlay.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const x = Math.min(e.clientX, startX);
        const y = Math.min(e.clientY, startY);
        sel.style.left   = x + 'px'; sel.style.top    = y + 'px';
        sel.style.width  = Math.abs(e.clientX - startX) + 'px';
        sel.style.height = Math.abs(e.clientY - startY) + 'px';
      });

      overlay.addEventListener('mouseup', (e) => {
        if (!dragging) return;
        dragging = false;
        overlay.remove();
        const x = Math.min(e.clientX, startX);
        const y = Math.min(e.clientY, startY);
        const w = Math.abs(e.clientX - startX);
        const h = Math.abs(e.clientY - startY);
        if (w < 10 || h < 10) return reject(new Error('Selection too small'));
        resolve({ x, y, w, h });
      });

      document.addEventListener('keydown', function onEsc(e) {
        if (e.key === 'Escape') {
          overlay.remove();
          document.removeEventListener('keydown', onEsc);
          reject(new Error('Cancelled'));
        }
      });
    });
  }

  // ─── Progress ────────────────────────────────────────────────────────────────

  function sendProgress(percent) {
    chrome.runtime.sendMessage({ type: 'CAPTURE_PROGRESS', percent });
  }

  // ─── Max height warning ──────────────────────────────────────────────────────

  function showMaxHeightWarning() {
    const warn = makeOverlay('⚠ Page truncated at max height limit');
    warn.style.background  = 'rgba(160,90,0,0.92)';
    warn.style.borderColor = 'rgba(255,160,0,0.7)';
    document.body.appendChild(warn);
    setTimeout(() => warn.remove(), 3000);
  }

  function makeOverlay(text) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;top:20px;right:20px;z-index:2147483647;
      background:rgba(15,17,23,0.9);color:#fff;
      font:600 14px/1 system-ui,sans-serif;
      padding:12px 18px;border-radius:10px;
      border:1.5px solid rgba(79,127,255,0.6);
      pointer-events:none;
    `;
    el.textContent = text;
    return el;
  }

  // ─── Area capture ────────────────────────────────────────────────────────────

  async function captureArea(options = {}) {
    const { format = 'jpg', scale = 1 } = options;

    let rect;
    try { rect = await selectArea(); }
    catch (err) {
      delete window.__smartshotActive;
      // Only notify if not cancelled by user
      if (err.message !== 'Cancelled' && err.message !== 'Selection too small') {
        chrome.runtime.sendMessage({ type: 'AREA_CAPTURE_RESULT', ok: false, error: err.message });
      }
      return;
    }

    await sleep(80);
    const dataUrl = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE' });

    const img = await loadImage(dataUrl);
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(rect.w * scale);
    canvas.height = Math.round(rect.h * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img,
      rect.x * dpr, rect.y * dpr, rect.w * dpr, rect.h * dpr,
      0, 0, canvas.width, canvas.height
    );

    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const quality  = format === 'png' ? undefined : 0.92;
    const result   = canvas.toDataURL(mimeType, quality);

    // Send result to background (popup may be closed)
    chrome.runtime.sendMessage({ type: 'AREA_CAPTURE_RESULT', ok: true, dataUrl: result });
    // Reset flag so extension can be used again without reload
    delete window.__smartshotActive;
  }

  // ─── Full page capture ───────────────────────────────────────────────────────

  async function captureFullPage(options = {}) {
    const { scale = 1, maxHeight = 30000, format = 'jpg', delay = 0 } = options;

    if (delay > 0) await showCountdown(delay);
    await sleep(80);

    const scrollX   = window.scrollX;
    const scrollY   = window.scrollY;
    const realH     = document.body.scrollHeight;
    const truncated = realH > maxHeight;
    const totalH    = Math.min(realH, maxHeight);
    const viewW     = window.innerWidth;
    const viewH     = window.innerHeight;

    const fixedEls = getFixedElements();
    hideFixed(fixedEls);
    window.scrollTo(0, 0);
    await sleep(150);

    const frames = [];
    let captured = 0;

    while (captured < totalH) {
      sendProgress(Math.round((captured / totalH) * 88));
      const dataUrl = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE' });
      frames.push({ dataUrl, y: captured });
      captured += viewH;
      if (captured < totalH) { window.scrollTo(0, captured); await sleep(160); }
    }

    sendProgress(92);
    restoreFixed(fixedEls);
    window.scrollTo(scrollX, scrollY);

    if (truncated) showMaxHeightWarning();

    const canvas = await stitchFrames(frames, viewW, totalH, viewH, scale);
    sendProgress(98);

    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const quality  = format === 'png' ? undefined : 0.92;
    const result   = canvas.toDataURL(mimeType, quality);

    sendProgress(100);
    delete window.__smartshotActive;
    return result;
  }

  // ─── Canvas helpers ──────────────────────────────────────────────────────────

  function stitchFrames(frames, viewW, totalH, viewH, scale) {
    return new Promise((resolve) => {
      const canvas  = document.createElement('canvas');
      canvas.width  = Math.round(viewW  * scale);
      canvas.height = Math.round(totalH * scale);
      const ctx = canvas.getContext('2d');
      let loaded = 0;
      frames.forEach(({ dataUrl, y }) => {
        const img = new Image();
        img.onload = () => {
          const destY = Math.round(y * scale);
          const srcH  = Math.min(viewH, totalH - y);
          const destH = Math.round(srcH * scale);
          ctx.drawImage(img, 0, 0, img.width, Math.round(srcH * scale), 0, destY, canvas.width, destH);
          if (++loaded === frames.length) resolve(canvas);
        };
        img.src = dataUrl;
      });
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // ─── Message listener ────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'START_CAPTURE') {
      captureFullPage(msg.options)
        .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
        .catch((err)   => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    if (msg.type === 'START_AREA_CAPTURE') {
      // Fire and forget — result goes to background via AREA_CAPTURE_RESULT
      captureArea(msg.options);
      sendResponse({ ok: true });
      return true;
    }
  });

})();