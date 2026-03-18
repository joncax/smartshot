/**
 * SmartShot — Unit Tests (Jest)
 * Run: npm test
 * All functions tested here are pure (no browser APIs) — no mocks needed.
 */

import {
  generateFilename,
  clamp,
  resolveScale,
  isCapturableUrl,
  formatBytes,
  defaultSettings,
} from '../src/utils.js';

// ─── generateFilename ─────────────────────────────────────────────────────────

describe('generateFilename', () => {
  const fixedDate = new Date('2026-03-18T14:30:00');

  test('produces correct format for a normal URL', () => {
    const name = generateFilename('https://github.com/user/repo', 'jpg', fixedDate);
    expect(name).toBe('github.com_2026-03-18_1430.jpg');
  });

  test('strips www. from domain', () => {
    const name = generateFilename('https://www.google.com/search?q=test', 'png', fixedDate);
    expect(name).toBe('google.com_2026-03-18_1430.png');
  });

  test('uses "page" as fallback for invalid URL', () => {
    const name = generateFilename('not-a-url', 'jpg', fixedDate);
    expect(name).toContain('page_');
    expect(name).toMatch(/\.jpg$/);
  });

  test('supports pdf format', () => {
    const name = generateFilename('https://example.com', 'pdf', fixedDate);
    expect(name).toMatch(/\.pdf$/);
  });

  test('pads single-digit month and day', () => {
    const d = new Date('2026-01-05T09:07:00');
    const name = generateFilename('https://example.com', 'jpg', d);
    expect(name).toBe('example.com_2026-01-05_0907.jpg');
  });

  test('sanitises special characters in domain', () => {
    const name = generateFilename('https://my-site.co.uk/path', 'jpg', fixedDate);
    expect(name).toMatch(/^my-site\.co\.uk_/);
  });
});

// ─── clamp ────────────────────────────────────────────────────────────────────

describe('clamp', () => {
  test('returns value when within range', () => {
    expect(clamp(5, 1, 10)).toBe(5);
  });

  test('returns min when value is below', () => {
    expect(clamp(-3, 0, 100)).toBe(0);
  });

  test('returns max when value is above', () => {
    expect(clamp(999, 0, 100)).toBe(100);
  });

  test('handles equal min and max', () => {
    expect(clamp(50, 7, 7)).toBe(7);
  });
});

// ─── resolveScale ─────────────────────────────────────────────────────────────

describe('resolveScale', () => {
  test('returns 1 for "1x"', () => {
    expect(resolveScale('1x')).toBe(1);
  });

  test('returns 1.5 for "1.5x"', () => {
    expect(resolveScale('1.5x')).toBe(1.5);
  });

  test('returns 2 for "2x"', () => {
    expect(resolveScale('2x')).toBe(2);
  });

  test('defaults to 1 for unknown preference', () => {
    expect(resolveScale('5x')).toBe(1);
  });

  test('never exceeds 2 regardless of devicePixelRatio', () => {
    expect(resolveScale('2x', 3)).toBe(2);
  });
});

// ─── isCapturableUrl ──────────────────────────────────────────────────────────

describe('isCapturableUrl', () => {
  test('allows https URLs', () => {
    expect(isCapturableUrl('https://example.com')).toBe(true);
  });

  test('allows http URLs', () => {
    expect(isCapturableUrl('http://localhost:3000')).toBe(true);
  });

  test('blocks chrome:// URLs', () => {
    expect(isCapturableUrl('chrome://settings')).toBe(false);
  });

  test('blocks chrome-extension:// URLs', () => {
    expect(isCapturableUrl('chrome-extension://abc123/popup.html')).toBe(false);
  });

  test('blocks about: URLs', () => {
    expect(isCapturableUrl('about:blank')).toBe(false);
  });

  test('blocks moz-extension:// URLs', () => {
    expect(isCapturableUrl('moz-extension://abc/page.html')).toBe(false);
  });

  test('blocks edge:// URLs', () => {
    expect(isCapturableUrl('edge://settings')).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(isCapturableUrl('')).toBe(false);
  });

  test('returns false for null/undefined', () => {
    expect(isCapturableUrl(null)).toBe(false);
    expect(isCapturableUrl(undefined)).toBe(false);
  });
});

// ─── formatBytes ─────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  test('formats bytes under 1KB', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  test('formats kilobytes', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  test('formats megabytes', () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MB');
  });
});

// ─── defaultSettings ─────────────────────────────────────────────────────────

describe('defaultSettings', () => {
  test('returns an object with all expected keys', () => {
    const s = defaultSettings();
    expect(s).toHaveProperty('format');
    expect(s).toHaveProperty('scale');
    expect(s).toHaveProperty('action');
    expect(s).toHaveProperty('delay');
    expect(s).toHaveProperty('maxHeight');
    expect(s).toHaveProperty('autoPreview');
  });

  test('default format is jpg', () => {
    expect(defaultSettings().format).toBe('jpg');
  });

  test('default scale is 1x', () => {
    expect(defaultSettings().scale).toBe('1x');
  });

  test('default maxHeight prevents infinite scroll (≤ 30000)', () => {
    expect(defaultSettings().maxHeight).toBeLessThanOrEqual(30000);
  });

  test('each call returns a fresh object (no shared reference)', () => {
    const a = defaultSettings();
    const b = defaultSettings();
    a.format = 'png';
    expect(b.format).toBe('jpg');
  });
});
