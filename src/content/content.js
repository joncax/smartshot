/**
 * SmartShot — Content Script (Phase 2)
 * Adds: configurable delay with countdown overlay, improved fixed element handling.
 */

;(function () {
  'use strict';

  if (window.__smartshotActive) return;
  window.__smartshotActive = true;

  // ─── Countdown overlay ──────────────────────────────────────────────────────

  function showCountdown(seconds) {
    return new Promise((resolve) => {
      if (seconds <= 0) return resolve();

      const overlay = document.createElement('div');
      overlay.id = '__smartshot_countdown';
      overlay.style.cssText = `
        position:fixed; top:20px; right:20px; z-index:2147483647;
        background:rgba(15,17,23,0.88); color:#fff;
        font:600 28px/1 system-ui,sans-serif;
        padding:14px 22px; border-radius:12px;
        border:1.5px solid rgba(79,127,255,0.6);
        pointer-events:none; letter-spacing:-.5px;
      `;

      document.body.appendChild(overlay);

      let remaining = seconds;
      overlay.textContent = `SmartShot captures in ${remaining}s`;

      const iv = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(iv);
          overlay.remove();
          resolve();
        } else {
          overlay.textContent = `SmartShot captures in ${remaining}s`;
        }
      }, 1000);
    });
  }

  // ─── Fixed/sticky element helpers ───────────────────────────────────────────

  function getFixedElements() {
    const fixed = [];
    document.querySelectorAll('*').forEach((el) => {
      const s = window.getComputedStyle(el);
      if (s.position === 'fixed' || s.position === 'sticky') {
        fixed.push({ el, originalVisibility: el.style.visibility });
      }
    });
    return fixed;
  }

  function hideFixed(els) { els.forEach(({ el }) => (el.style.visibility = 'hidden')); }
  function restoreFixed(els) { els.forEach(({ el, originalVisibility }) => (el.style.visibility = originalVisibility)); }

  // ─── Progress ────────────────────────────────────────────────────────────────

  function sendProgress(percent) {
    chrome.runtime.sendMessage({ type: 'CAPTURE_PROGRESS', percent });
  }

  // ─── Main capture ────────────────────────────────────────────────────────────

  async function captureFullPage(options = {}) {
    const { scale = 1, maxHeight = 30000, format = 'jpg', delay = 0 } = options;

    // Delay with visible countdown
    if (delay > 0) await showCountdown(delay);

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const totalH  = Math.min(document.body.scrollHeight, maxHeight);
    const viewW   = window.innerWidth;
    const viewH   = window.innerHeight;

    const fixedEls = getFixedElements();
    hideFixed(fixedEls);

    window.scrollTo(0, 0);
    await sleep(150);

    const frames  = [];
    let captured  = 0;

    while (captured < totalH) {
      sendProgress(Math.round((captured / totalH) * 88));

      const dataUrl = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE' });
      frames.push({ dataUrl, y: captured });

      captured += viewH;
      if (captured < totalH) {
        window.scrollTo(0, captured);
        await sleep(160);
      }
    }

    sendProgress(92);

    restoreFixed(fixedEls);
    window.scrollTo(scrollX, scrollY);

    const canvas = await stitchFrames(frames, viewW, totalH, viewH, scale);
    sendProgress(98);

    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const quality  = format === 'png' ? undefined : 0.92;
    const result   = canvas.toDataURL(mimeType, quality);

    sendProgress(100);
    delete window.__smartshotActive;

    return result;
  }

  // ─── Canvas stitching ────────────────────────────────────────────────────────

  function stitchFrames(frames, viewW, totalH, viewH, scale) {
    return new Promise((resolve) => {
      const canvas  = document.createElement('canvas');
      canvas.width  = Math.round(viewW  * scale);
      canvas.height = Math.round(totalH * scale);
      const ctx     = canvas.getContext('2d');
      let   loaded  = 0;

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

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // ─── Message listener ────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'START_CAPTURE') {
      captureFullPage(msg.options)
        .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
        .catch((err)   => sendResponse({ ok: false, error: err.message }));
      return true;
    }
  });

})();
