// SmartShot — Preview page script

async function init() {
  const stored  = await chrome.storage.local.get('previewDataUrl');
  const dataUrl = stored.previewDataUrl;

  document.getElementById('loading').style.display = 'none';

  if (!dataUrl) {
    document.getElementById('loading').textContent = 'No preview available.';
    document.getElementById('loading').style.display = 'block';
    return;
  }

  await chrome.storage.local.remove('previewDataUrl');

  const img = document.getElementById('preview-img');
  img.src = dataUrl;
  img.style.display = 'block';

  const toolbar = document.getElementById('toolbar');
  toolbar.style.display = 'flex';

  // Save button — download the image and show confirmation
  document.getElementById('btn-save').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'smartshot-preview.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Show confirmation message
    const msg = document.getElementById('save-msg');
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  });

  // Close button — close this tab
  document.getElementById('btn-close').addEventListener('click', () => {
    window.close();
  });
}

init();