/**
 * SmartShot — Options page script (external JS file — required by CSP)
 */

const DEFAULTS = {
  format: 'jpg', scale: '1x', action: 'file',
  delay: 0, maxHeight: 30000, autoPreview: false,
  historyMax: 10, hiddenSelectors: ''
};

const els = {
  format:          document.getElementById('sel-format'),
  scale:           document.getElementById('sel-scale'),
  maxHeight:       document.getElementById('inp-maxheight'),
  delay:           document.getElementById('inp-delay'),
  autoPreview:     document.getElementById('chk-preview'),
  hiddenSelectors: document.getElementById('txt-selectors'),
  btnSave:         document.getElementById('btn-save'),
  savedMsg:        document.getElementById('saved-msg'),
};

async function load() {
  const stored = await chrome.storage.sync.get('settings');
  const s = Object.assign({}, DEFAULTS, stored.settings || {});
  els.format.value          = s.format;
  els.scale.value           = s.scale;
  els.maxHeight.value       = s.maxHeight;
  els.delay.value           = s.delay;
  els.autoPreview.checked   = !!s.autoPreview;
  els.hiddenSelectors.value = s.hiddenSelectors || '';
}

function showMsg(text, type) {
  els.savedMsg.textContent  = text;
  els.savedMsg.className    = 'saved-msg ' + type;
  setTimeout(() => { els.savedMsg.textContent = ''; els.savedMsg.className = 'saved-msg'; }, 3000);
}

els.btnSave.addEventListener('click', async () => {
  els.btnSave.disabled     = true;
  els.btnSave.textContent  = 'Saving…';

  const s = {
    format:          els.format.value,
    scale:           els.scale.value,
    maxHeight:       Number(els.maxHeight.value) || 30000,
    delay:           Number(els.delay.value) || 0,
    autoPreview:     els.autoPreview.checked,
    hiddenSelectors: els.hiddenSelectors.value.trim(),
  };

  try {
    await chrome.storage.sync.set({ settings: s });
    showMsg('✓ Settings saved', 'ok');
  } catch (err) {
    showMsg('✗ Error: ' + err.message, 'error');
  } finally {
    els.btnSave.disabled    = false;
    els.btnSave.textContent = 'Save settings';
  }
});

load();
