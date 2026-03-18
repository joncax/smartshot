# SmartShot 📷

> Full-page screenshot browser extension — JPG/PNG, 100% local, no account, no data sent anywhere.

[![CI](https://github.com/joncax/smartshot/actions/workflows/ci.yml/badge.svg)](https://github.com/joncax/smartshot/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](manifest.json)

---

## Features

- **Full-page capture** — scrolls from top to bottom automatically, stitches into one image
- **Select area** — drag to capture any region of the page
- **Save to file** — JPG or PNG directly to your Downloads folder, named automatically
- **Copy to clipboard** — paste straight into Teams, Slack, Jira, Outlook, Notion
- **Save + Copy** — both at once
- **Countdown delay** — 1–10 seconds before capture (useful for menus, tooltips, hover states)
- **Preview tab** — open the screenshot in a new tab before saving
- **Capture history** — last 10 captures shown in the popup
- **100% local** — no server, no account, no analytics, no data leaves your computer
- **Keyboard shortcut** — `Alt+Shift+S` (configurable in browser settings)
- **Works in Chrome, Edge and Firefox**

---

## Install from store

| Browser | Link |
|---|---|
| Chrome / Edge | [Chrome Web Store](https://chromewebstore.google.com) *(coming soon)* |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org) *(coming soon)* |

---

## Install for development

### Prerequisites
- Node.js 18+
- Chrome, Edge or Firefox

### 1. Clone the repository

```bash
git clone https://github.com/joncax/smartshot.git
cd smartshot
npm install
```

### 2. Load in Chrome / Edge

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `smartshot` folder

### 3. Load in Firefox

1. Open `about:debugging`
2. Click **This Firefox**
3. Click **Load Temporary Add-on**
4. Select `manifest.json` inside the `smartshot` folder

---

## Running tests

```bash
# Run all unit tests once
npm test

# Watch mode — reruns on every file save
npm run test:watch

# With coverage report
npm run test:cover
```

---

## Project structure

```
smartshot/
├── manifest.json                  # Extension manifest (MV3)
├── src/
│   ├── utils.js                   # Pure utility functions (testable)
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js               # Capture flow, history, clipboard
│   ├── content/
│   │   └── content.js             # Injected into pages — scroll, capture, area selection
│   ├── background/
│   │   └── background.js          # Service worker — orchestration, downloads, history
│   └── options/
│       ├── options.html
│       ├── options.css
│       └── options.js             # Settings page
├── icons/                         # Extension icons (16, 32, 48, 128px)
├── _locales/en/messages.json      # Internationalisation (EN)
├── tests/
│   └── utils.test.js              # 50+ Jest unit tests
├── .github/workflows/ci.yml       # GitHub Actions CI — runs on every push
└── package.json
```

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests where applicable
4. Run `npm test` — all tests must pass
5. Open a Pull Request with a clear description

---

## Support the project

SmartShot is free and always will be. If it saves you time, consider:

- ☕ [Ko-fi](https://ko-fi.com/joncardoso) — one-time coffee, no account needed
- 💙 [PayPal](https://paypal.com) — direct donation
- ⭐ **Star the repository** — it really helps discoverability!

---

## License

[MIT](LICENSE) © 2026 — João Cardoso
