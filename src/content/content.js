/**
 * SmartShot — Content Script
 * Injected into the active tab. Handles scroll, frame capture, and canvas assembly.
 */

;(function () {
  'use strict';

  // Prevent double-injection
  if (window.__smartshotActive) return;
  window.__smartshotActive = true;

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Collect all elements with position:fixed or position:sticky */
  function getFixedElements() {
    const fixed = [];
    document.querySelectorAll('*').forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'sticky') {
        fixed.push({ el, originalVisibility: el.style.visibility });
      }
    });
    return fixed;
  }

  function hideFixed(fixedEls) {
    fixedEls.forEach(({ el }) => (el.style.visibility = 'hidden'));
  }

  function restoreFixed(fixedEls) {
    fixedEls.forEach(({ el, originalVisibility }) => {
      el.style.visibility = originalVisibility;
    });
  }

  /** Send progress update to popup via background */
  function sendProgress(percent) {
    chrome.runtime.sendMessage({ type: 'CAPTURE_PROGRESS', percent });
  }

  // ─── Main capture ────────────────────────────────────────────────────────────

  async function captureFullPage(options = {}) {
    const {
      scale     = 1,
      maxHeight = 30000,
      format    = 'jpg',
    } = options;

    const scrollX   = window.scrollX;
    const scrollY   = window.scrollY;
    const totalH    = Math.min(document.body.scrollHeight, maxHeight);
    const viewW     = window.innerWidth;
    const viewH     = window.innerHeight;

    // Hide fixed/sticky elements so they don't repeat on every frame
    const fixedEls = getFixedElements();
    hideFixed(fixedEls);

    // Scroll to top before starting
    window.scrollTo(0, 0);
    await sleep(120);

    const frames   = [];
    let   captured = 0;

    while (captured < totalH) {
      sendProgress(Math.round((captured / totalH) * 90));

      // Ask background to capture the visible viewport
      const dataUrl = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE' });
      frames.push({ dataUrl, y: captured });

      captured += viewH;
      if (captured < totalH) {
        window.scrollTo(0, captured);
        await sleep(150); // allow paint
      }
    }

    sendProgress(92);

    // Restore everything
    restoreFixed(fixedEls);
    window.scrollTo(scrollX, scrollY);

    // Stitch frames on a canvas
    const canvas   = await stitchFrames(frames, viewW, totalH, viewH, scale);
    sendProgress(98);

    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const quality  = format === 'png' ? undefined : 0.92;
    const result   = canvas.toDataURL(mimeType, quality);

    sendProgress(100);

    // Clean up flag
    delete window.__smartshotActive;

    return result;
  }

  // ─── Canvas stitching ───────────────────────────────────────────────────────

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
          // Each frame covers one viewport height; last frame may be partial
          const destY     = Math.round(y * scale);
          const srcH      = Math.min(viewH, totalH - y);
          const destH     = Math.round(srcH * scale);

          ctx.drawImage(
            img,
            0, 0, img.width, Math.round(srcH * scale),   // src rect
            0, destY, canvas.width, destH                  // dest rect
          );

          loaded++;
          if (loaded === frames.length) resolve(canvas);
        };
        img.src = dataUrl;
      });
    });
  }

  // ─── Utils ──────────────────────────────────────────────────────────────────

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ─── Message listener ───────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'START_CAPTURE') {
      captureFullPage(msg.options)
        .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
        .catch((err)   => sendResponse({ ok: false, error: err.message }));
      return true; // keep channel open for async response
    }
  });

})();
