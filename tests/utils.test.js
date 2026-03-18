/**
 * SmartShot — Unit Tests (Jest) — Phase 1 + Phase 2
 * Run: npm test
 */

import {
  generateFilename,
  clamp,
  resolveScale,
  isCapturableUrl,
  formatBytes,
  defaultSettings,
  dataUrlToBlob,
  actionLabel,
  buildHistoryEntry,
  addToHistory,
} from '../src/utils.js';

// ─── generateFilename ─────────────────────────────────────────────────────────

describe('generateFilename', () => {
  const fixedDate = new Date('2026-03-18T14:30:00');

  test('produces correct format for a normal URL', () => {
    expect(generateFilename('https://github.com/user/repo', 'jpg', fixedDate)).toBe('github.com_2026-03-18_1430.jpg');
  });

  test('strips www. from domain', () => {
    expect(generateFilename('https://www.google.com/search?q=test', 'png', fixedDate)).toBe('google.com_2026-03-18_1430.png');
  });

  test('uses "page" as fallback for invalid URL', () => {
    const name = generateFilename('not-a-url', 'jpg', fixedDate);
    expect(name).toContain('page_');
    expect(name).toMatch(/\.jpg$/);
  });

  test('supports pdf format', () => {
    expect(generateFilename('https://example.com', 'pdf', fixedDate)).toMatch(/\.pdf$/);
  });

  test('pads single-digit month and day', () => {
    const d = new Date('2026-01-05T09:07:00');
    expect(generateFilename('https://example.com', 'jpg', d)).toBe('example.com_2026-01-05_0907.jpg');
  });

  test('sanitises special characters in domain', () => {
    expect(generateFilename('https://my-site.co.uk/path', 'jpg', fixedDate)).toMatch(/^my-site\.co\.uk_/);
  });
});

// ─── clamp ────────────────────────────────────────────────────────────────────

describe('clamp', () => {
  test('returns value when within range', () => expect(clamp(5, 1, 10)).toBe(5));
  test('returns min when value is below',  () => expect(clamp(-3, 0, 100)).toBe(0));
  test('returns max when value is above',  () => expect(clamp(999, 0, 100)).toBe(100));
  test('handles equal min and max',        () => expect(clamp(50, 7, 7)).toBe(7));
});

// ─── resolveScale ─────────────────────────────────────────────────────────────

describe('resolveScale', () => {
  test('returns 1 for "1x"',   () => expect(resolveScale('1x')).toBe(1));
  test('returns 1.5 for "1.5x"', () => expect(resolveScale('1.5x')).toBe(1.5));
  test('returns 2 for "2x"',   () => expect(resolveScale('2x')).toBe(2));
  test('defaults to 1 for unknown preference', () => expect(resolveScale('5x')).toBe(1));
  test('never exceeds 2',      () => expect(resolveScale('2x', 3)).toBe(2));
});

// ─── isCapturableUrl ──────────────────────────────────────────────────────────

describe('isCapturableUrl', () => {
  test('allows https URLs',             () => expect(isCapturableUrl('https://example.com')).toBe(true));
  test('allows http URLs',              () => expect(isCapturableUrl('http://localhost:3000')).toBe(true));
  test('blocks chrome://',              () => expect(isCapturableUrl('chrome://settings')).toBe(false));
  test('blocks chrome-extension://',   () => expect(isCapturableUrl('chrome-extension://abc/popup.html')).toBe(false));
  test('blocks about:',                () => expect(isCapturableUrl('about:blank')).toBe(false));
  test('blocks moz-extension://',      () => expect(isCapturableUrl('moz-extension://abc/page.html')).toBe(false));
  test('blocks edge://',               () => expect(isCapturableUrl('edge://settings')).toBe(false));
  test('returns false for empty string', () => expect(isCapturableUrl('')).toBe(false));
  test('returns false for null',        () => expect(isCapturableUrl(null)).toBe(false));
  test('returns false for undefined',   () => expect(isCapturableUrl(undefined)).toBe(false));
});

// ─── formatBytes ─────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  test('formats bytes under 1KB', () => expect(formatBytes(512)).toBe('512 B'));
  test('formats kilobytes',       () => expect(formatBytes(2048)).toBe('2.0 KB'));
  test('formats megabytes',       () => expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MB'));
});

// ─── defaultSettings ─────────────────────────────────────────────────────────

describe('defaultSettings', () => {
  test('has all expected keys', () => {
    const s = defaultSettings();
    ['format','scale','action','delay','maxHeight','autoPreview','historyMax'].forEach((k) => {
      expect(s).toHaveProperty(k);
    });
  });
  test('default format is jpg',       () => expect(defaultSettings().format).toBe('jpg'));
  test('default scale is 1x',         () => expect(defaultSettings().scale).toBe('1x'));
  test('maxHeight prevents infinite scroll', () => expect(defaultSettings().maxHeight).toBeLessThanOrEqual(30000));
  test('historyMax is positive',      () => expect(defaultSettings().historyMax).toBeGreaterThan(0));
  test('returns fresh object each call', () => {
    const a = defaultSettings();
    a.format = 'png';
    expect(defaultSettings().format).toBe('jpg');
  });
});

// ─── actionLabel ─────────────────────────────────────────────────────────────

describe('actionLabel', () => {
  test('returns label for file',      () => expect(actionLabel('file')).toBe('Save to file'));
  test('returns label for clipboard', () => expect(actionLabel('clipboard')).toBe('Copy to clipboard'));
  test('returns label for both',      () => expect(actionLabel('both')).toBe('Save + Copy'));
  test('returns Unknown for invalid', () => expect(actionLabel('unknown')).toBe('Unknown'));
});

// ─── buildHistoryEntry ───────────────────────────────────────────────────────

describe('buildHistoryEntry', () => {
  const fixedDate = new Date('2026-03-18T14:30:00.000Z');
  const entry = buildHistoryEntry('https://github.com/user', 'github.com_2026-03-18_1430.jpg', 'jpg', 204800, fixedDate);

  test('has required fields', () => {
    ['id','url','filename','format','bytes','size','timestamp','domain'].forEach((k) => {
      expect(entry).toHaveProperty(k);
    });
  });

  test('domain strips www', () => {
    const e = buildHistoryEntry('https://www.google.com', 'google.com_test.jpg', 'jpg', 1024, fixedDate);
    expect(e.domain).toBe('google.com');
  });

  test('size is human-readable string', () => {
    expect(typeof entry.size).toBe('string');
    expect(entry.size).toContain('KB');
  });

  test('timestamp is ISO string', () => {
    expect(entry.timestamp).toBe('2026-03-18T14:30:00.000Z');
  });

  test('id is unique across calls', () => {
    const e1 = buildHistoryEntry('https://a.com', 'a.jpg', 'jpg', 100);
    const e2 = buildHistoryEntry('https://b.com', 'b.jpg', 'jpg', 100);
    expect(e1.id).not.toBe(e2.id);
  });
});

// ─── addToHistory ────────────────────────────────────────────────────────────

describe('addToHistory', () => {
  const makeEntry = (domain) => buildHistoryEntry(`https://${domain}.com`, `${domain}.jpg`, 'jpg', 1024);

  test('adds entry to front of array', () => {
    const h = [makeEntry('old')];
    const e = makeEntry('new');
    const result = addToHistory(h, e);
    expect(result[0].domain).toBe('new.com');
  });

  test('trims to maxEntries', () => {
    const h = Array.from({ length: 10 }, (_, i) => makeEntry(`site${i}`));
    const e = makeEntry('newest');
    const result = addToHistory(h, e, 10);
    expect(result.length).toBe(10);
    expect(result[0].domain).toBe('newest.com');
  });

  test('does not mutate original array', () => {
    const h = [makeEntry('a')];
    const original = [...h];
    addToHistory(h, makeEntry('b'));
    expect(h.length).toBe(original.length);
  });

  test('works on empty history', () => {
    const e = makeEntry('first');
    const result = addToHistory([], e);
    expect(result.length).toBe(1);
    expect(result[0].domain).toBe('first.com');
  });
});
