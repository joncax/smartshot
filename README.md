# SmartShot 📷

> Full-page screenshot browser extension — JPG/PNG, 100% local, no account, no data sent anywhere.

[![CI](https://github.com/YOUR_USERNAME/smartshot/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/smartshot/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

- **Full-page capture** — scrolls from top to bottom automatically
- **Save to file** — JPG or PNG directly to your Downloads folder
- **Copy to clipboard** — paste straight into Teams, Slack, Jira, email
- **100% local** — no server, no account, no analytics, no data leaves your computer
- **Keyboard shortcut** — `Alt+Shift+S` (configurable)
- **Configurable** — format (JPG/PNG/PDF), scale (1×/1.5×/2×), max height, delay

---

## Installation (development)

### Prerequisites
- Node.js 18+
- Chrome, Firefox, or Edge

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/smartshot.git
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

# Watch mode — reruns on file save
npm run test:watch

# With coverage report
npm run test:cover
```

---

## Project structure

```
smartshot/
├── manifest.json              # Extension manifest (MV3)
├── src/
│   ├── utils.js               # Pure utility functions (testable)
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── content/
│   │   └── content.js         # Injected into pages — scroll & capture
│   ├── background/
│   │   └── background.js      # Service worker — orchestration
│   └── options/
│       └── options.html       # Settings page
├── icons/                     # Extension icons (16, 32, 48, 128px)
├── _locales/en/messages.json  # Internationalisation
├── tests/
│   └── utils.test.js          # Jest unit tests
├── .github/workflows/ci.yml   # GitHub Actions CI
└── package.json
```

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Make changes and add tests
4. Run `npm test` — all tests must pass
5. Open a Pull Request

---

## Support the project

SmartShot is free and always will be. If it saves you time, consider:

- ☕ [Ko-fi](https://ko-fi.com) — one-time coffee
- 💙 [PayPal](https://paypal.com) — direct donation
- ⭐ Star the repository — it really helps!

---

## License

[MIT](LICENSE) © 2026
