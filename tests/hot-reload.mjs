// Run with the development server already listening on TEST_URL (default 5173).
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
const css = new URL('../src/index.css', import.meta.url);
const marker = `hmr-${randomUUID()}`;
const addition = `\n/* ${marker} */\n:root { --wordwell-hmr-check: ${marker}; }\n`;
let modified = false;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173/');
  await page.locator('.board-row').first().waitFor();
  await page.evaluate(value => { window.wordwellHmrSentinel = value; }, marker);
  writeFileSync(css, readFileSync(css, 'utf8') + addition);
  modified = true;
  await page.waitForFunction(value => getComputedStyle(document.documentElement).getPropertyValue('--wordwell-hmr-check').trim() === value, marker, { timeout: 15000 });
  assert.equal(await page.evaluate(() => window.wordwellHmrSentinel), marker, 'CSS changes apply without a full page reload');
  assert.deepEqual(errors, []);
  console.log('PASS: a host CSS edit is picked up by Vite polling and applied through HMR without reloading the page.');
} finally {
  if (modified) writeFileSync(css, readFileSync(css, 'utf8').replace(addition, ''));
  await browser.close();
}
