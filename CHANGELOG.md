# Changelog

All notable changes to SmartShot are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-03-18

### First public release 🎉

#### Added
- Full-page capture with automatic scroll and frame stitching
- Select Area mode — drag to capture any region of the page
- Save to file — JPG or PNG, auto-named with domain + timestamp
- Copy to clipboard — paste directly into Teams, Slack, Jira, Outlook
- Save + Copy mode — both destinations at once
- Countdown delay (0–10 seconds) with visible overlay before capture
- Preview tab — opens screenshot in new tab after capture
- Capture history — last 10 captures shown in popup with domain, size, format and time
- Configurable settings — format, scale (1×/1.5×/2×), max height, delay, preview
- Keyboard shortcut Alt+Shift+S for instant capture
- Fixed/sticky element hiding during scroll (prevents repeated headers in output)
- Max page height limit with visible warning when truncated
- 50+ unit tests with Jest
- GitHub Actions CI — tests run on every push
- Chrome, Edge and Firefox support (Manifest V3)
