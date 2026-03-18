# SmartShot — Publication Checklist

Step-by-step guide to publish on Chrome Web Store, Firefox AMO and Edge Add-ons.

---

## Before publishing

- [ ] Run `npm test` — all tests must pass
- [ ] Test full-page capture on 3+ different websites
- [ ] Test Select Area mode
- [ ] Test Clipboard on Chrome and Edge
- [ ] Test Settings save and persist after browser restart
- [ ] Test keyboard shortcut Alt+Shift+S
- [ ] Convert `icons/icon.svg` to PNG at 16, 32, 48 and 128px
      → Use Inkscape, GIMP, or https://svgtopng.com
- [ ] Take 4 screenshots (1280×800) for store listing
      → See STORE_LISTING.md for what to capture
- [ ] Host the Privacy Policy text (STORE_LISTING.md) at a public URL
      → Simplest: create a GitHub Gist and copy the raw URL
- [ ] Bump version in manifest.json if needed

---

## Build the extension ZIP

Run this in the project folder — this is the file you upload to the stores:

```bash
cd smartshot
zip -r smartshot-v1.0.0.zip . \
  --exclude "node_modules/*" \
  --exclude ".git/*" \
  --exclude "tests/*" \
  --exclude "*.md" \
  --exclude "package*.json" \
  --exclude ".gitignore"
```

The ZIP must contain `manifest.json` at the root level.

---

## Chrome Web Store

**Cost: $5 one-time (already paid if you registered)**

1. Go to https://chrome.google.com/webstore/devconsole
2. Click **New item**
3. Upload `smartshot-v1.0.0.zip`
4. Fill in the listing:
   - Name, Short description, Detailed description → copy from `STORE_LISTING.md`
   - Category → `Productivity`
   - Language → `English`
   - Upload 4 screenshots (1280×800 or 640×400)
   - Upload store icon (128×128 PNG)
5. Privacy tab:
   - Paste Privacy Policy URL
   - Permissions justification:
     - activeTab → "To access the current page content for screenshot capture"
     - scripting → "To inject the capture script into the active tab"
     - downloads → "To save screenshot files to the user's Downloads folder"
     - storage → "To persist user settings (format, scale, delay) across sessions"
6. Click **Submit for review**
7. Wait 1–3 business days for approval

---

## Firefox AMO (addons.mozilla.org)

**Cost: Free**

1. Go to https://addons.mozilla.org/developers/
2. Click **Submit a New Add-on**
3. Select **On this site** (listed on AMO)
4. Upload `smartshot-v1.0.0.zip`
5. If code is minified → also upload a source ZIP (not needed here)
6. Fill in the listing:
   - Name, Summary, Description → copy from `STORE_LISTING.md`
   - Categories → `Screenshots`, `Privacy & Security`
   - Upload screenshots
7. Add Privacy Policy URL
8. Submit — automated review is usually fast (minutes to hours)
   Manual review may be triggered for sensitive permissions

---

## Microsoft Edge Add-ons

**Cost: Free — uses the same ZIP as Chrome**

1. Go to https://partner.microsoft.com/dashboard/microsoftedge
2. Create a developer account (free)
3. Click **Create new extension**
4. Upload the same `smartshot-v1.0.0.zip` (Chrome MV3 works directly)
5. Fill in store listing (same texts as Chrome)
6. Submit for review (~1–7 business days)

---

## After publishing

- [ ] Update README.md with real store links
- [ ] Create a GitHub Release tagged `v1.0.0`
      ```bash
      git tag v1.0.0
      git push origin v1.0.0
      ```
- [ ] On GitHub: Releases → Draft new release → Select tag v1.0.0
      → Attach `smartshot-v1.0.0.zip` as a release asset
- [ ] Enable GitHub Sponsors (optional, free):
      → GitHub profile → Settings → Sponsor this project
- [ ] Set up Ko-fi account at https://ko-fi.com and update links in:
      - `src/popup/popup.html` (donate-link href)
      - `src/options/options.html` (Ko-fi link)
      - `README.md`

---

## Update an existing version

1. Make changes and bump version in `manifest.json` (e.g. `1.0.1`)
2. Add entry to `CHANGELOG.md`
3. Run `npm test`
4. Build new ZIP
5. Chrome: Developer Console → Your extension → **Upload new package**
6. Firefox: Add-ons Developer Hub → Your extension → **Upload new version**
7. Edge: Partner Center → Your extension → **Update**
8. Git tag the new version and create a GitHub Release
