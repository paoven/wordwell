import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dailyWord, storageKey } from '../src/lib/game.js';
import { buildShareText } from '../src/lib/share.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
const vocabulary = JSON.parse(readFileSync(new URL('../src/data/vocabulary.json', import.meta.url)));
const date = '2026-10-14';
const target = dailyWord(vocabulary, date).word;
const url = process.env.TEST_URL || 'http://127.0.0.1:5173/';
const errors = [];

async function open({ guesses, clipboard, nativeShare } = {}) {
  const context = await browser.newContext({
    timezoneId: 'Europe/Rome', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  await context.addInitScript(kind => {
    Math.random = () => 0;
    window.nativeShareCalls = [];
    window.clipboardWrites = [];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: kind ? data => {
        window.nativeShareCalls.push({ data, active: navigator.userActivation.isActive });
        if (kind === 'success') return Promise.resolve();
        if (kind === 'pending') return new Promise(resolve => { window.finishShare = resolve; });
        if (kind === 'throw') throw new DOMException('Blocked', 'NotAllowedError');
        return Promise.reject(new DOMException('Unavailable', kind === 'abort' ? 'AbortError' : 'NotAllowedError'));
      } : undefined,
    });
    if (kind) Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: text => { window.clipboardWrites.push(text); return Promise.resolve(); } },
    });
  }, nativeShare);
  if (guesses) await context.addInitScript(({ key, target, guesses }) => {
    localStorage.setItem(key, JSON.stringify({ word: target, guesses, input: '' }));
  }, { key: storageKey(date), target, guesses });
  if (clipboard) await context.addInitScript(kind => {
    window.originalClipboard = navigator.clipboard;
    if (kind === 'insecure') Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    else Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: kind === 'missing' ? undefined : { writeText: kind === 'throw' ? () => { throw new DOMException('Blocked', 'NotAllowedError'); } : () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) },
    });
  }, clipboard);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.clock.install({ time: new Date('2026-10-14T12:00:00+02:00') });
  await page.goto(url);
  await page.locator('.board-row').first().waitFor();
  return { page, context };
}

try {
  const { page, context } = await open();
  const share = page.getByRole('button', { name: 'Condividi Risultato' });
  assert.equal(await share.count(), 0, 'No share button during play');
  const guesses = ['e'.repeat(target.length), target];
  await page.locator('h1').click();
  for (const guess of guesses) { await page.keyboard.type(guess); await page.keyboard.press('Enter'); }
  await share.click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), buildShareText(guesses, target, date));
  const grid = await page.locator('.board-row').evaluateAll(rows => rows.filter(row => row.querySelector('.correct,.present,.absent')).map(row => [...row.querySelectorAll('.tile')].map(tile => tile.classList.contains('correct') ? '🟩' : tile.classList.contains('present') ? '🟨' : '⬛').join('')).join('\n'));
  assert.equal((await page.evaluate(() => navigator.clipboard.readText())).split('\n\n')[1], grid, 'Copied emojis match rendered tiles');
  assert.equal(await page.getByText('Copiato negli appunti!', { exact: true }).count(), 1);
  await page.clock.runFor(3100);
  assert.equal(await page.getByText('Copiato negli appunti!', { exact: true }).count(), 0, 'Success feedback expires');
  await page.reload(); await share.click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), buildShareText(guesses, target, date));
  await page.getByRole('button', { name: 'Modalità libera' }).click();
  const freeDefinition = await page.locator('.definition').textContent();
  const freeTarget = vocabulary.find(item => item.definition === freeDefinition).word;
  await page.locator('h1').click(); await page.keyboard.type(freeTarget); await page.keyboard.press('Enter');
  assert.match(await page.locator('.game-message').textContent(), /Ben fatto/);
  assert.equal(await share.count(), 0, 'No share button after a free-mode win');
  await page.getByRole('button', { name: 'Parola del giorno' }).click();
  assert.equal(await share.count(), 1);
  await context.close();

  const loss = Array(6).fill('z'.repeat(target.length));
  const lost = await open({ guesses: loss });
  await lost.page.getByRole('button', { name: 'Condividi Risultato' }).click();
  assert.equal(await lost.page.evaluate(() => navigator.clipboard.readText()), buildShareText(loss, target, date));
  assert.match(await lost.page.locator('.game-message').textContent(), /La parola era/);
  await lost.context.close();

  for (const clipboard of ['denied', 'throw', 'missing', 'insecure']) {
    const blocked = await open({ guesses: loss, clipboard });
    await blocked.page.getByRole('button', { name: 'Condividi Risultato' }).click();
    const manual = blocked.page.getByRole('textbox', { name: 'Risultato da copiare manualmente' });
    await manual.waitFor();
    assert.equal(await manual.inputValue(), buildShareText(loss, target, date));
    assert.equal(await blocked.page.getByText('Copiato negli appunti!', { exact: true }).count(), 0);
    await blocked.page.getByRole('button', { name: 'Seleziona testo' }).click();
    assert.ok(await manual.evaluate(node => node.selectionStart === 0 && node.selectionEnd === node.value.length));
    if (clipboard === 'denied') {
      await blocked.page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: window.originalClipboard, configurable: true }));
      await blocked.page.getByRole('button', { name: 'Condividi Risultato' }).click();
      assert.equal(await blocked.page.evaluate(() => navigator.clipboard.readText()), buildShareText(loss, target, date));
      assert.equal(await manual.count(), 0, 'Successful retry clears manual fallback');
    }
    await blocked.context.close();
  }
  for (const guesses of [[target], loss]) {
    const native = await open({ guesses, nativeShare: 'success' });
    await native.page.getByRole('button', { name: 'Condividi Risultato' }).click();
    assert.deepEqual(await native.page.evaluate(() => window.nativeShareCalls), [
      { data: { text: buildShareText(guesses, target, date) }, active: true },
    ]);
    assert.deepEqual(await native.page.evaluate(() => window.clipboardWrites), []);
    assert.equal(await native.page.getByText('Copiato negli appunti!', { exact: true }).count(), 0);
    assert.equal(await native.page.getByRole('textbox').count(), 0);
    await native.context.close();
  }
  const cancelled = await open({ guesses: loss, nativeShare: 'abort' });
  const cancelledButton = cancelled.page.getByRole('button', { name: 'Condividi Risultato' });
  await cancelledButton.click();
  assert.deepEqual(await cancelled.page.evaluate(() => window.clipboardWrites), []);
  assert.equal(await cancelled.page.getByRole('textbox').count(), 0);
  assert.equal(await cancelledButton.isEnabled(), true);
  await cancelledButton.click();
  assert.equal(await cancelled.page.evaluate(() => window.nativeShareCalls.length), 2);
  await cancelled.context.close();

  for (const nativeShare of ['denied', 'throw']) {
    const failed = await open({ guesses: loss, nativeShare });
    await failed.page.getByRole('button', { name: 'Condividi Risultato' }).click();
    assert.deepEqual(await failed.page.evaluate(() => window.clipboardWrites), [buildShareText(loss, target, date)]);
    assert.equal(await failed.page.getByText('Copiato negli appunti!', { exact: true }).count(), 1);
    await failed.context.close();
  }
  const blockedShare = await open({ guesses: loss, nativeShare: 'denied', clipboard: 'missing' });
  await blockedShare.page.getByRole('button', { name: 'Condividi Risultato' }).click();
  assert.equal(await blockedShare.page.getByRole('textbox').inputValue(), buildShareText(loss, target, date));
  await blockedShare.context.close();

  const insecureShare = await open({ guesses: loss, nativeShare: 'success', clipboard: 'insecure' });
  await insecureShare.page.getByRole('button', { name: 'Condividi Risultato' }).click();
  assert.deepEqual(await insecureShare.page.evaluate(() => window.nativeShareCalls), []);
  assert.equal(await insecureShare.page.getByRole('textbox').inputValue(), buildShareText(loss, target, date));
  await insecureShare.context.close();

  const pendingShare = await open({ guesses: loss, nativeShare: 'pending' });
  const pendingButton = pendingShare.page.getByRole('button', { name: 'Condividi Risultato' });
  await pendingButton.click();
  assert.equal(await pendingButton.isDisabled(), true);
  await pendingButton.evaluate(node => node.click());
  assert.equal(await pendingShare.page.evaluate(() => window.nativeShareCalls.length), 1);
  await pendingShare.page.evaluate(() => window.finishShare());
  await pendingButton.waitFor();
  assert.equal(await pendingButton.isEnabled(), true);
  await pendingShare.context.close();
  assert.deepEqual(errors, []);
  console.log('PASS: native share payload and click activation, cancellation, concurrent clicks, clipboard/manual fallbacks, real clipboard for daily win/loss, exact text and emojis, feedback, reload, no sharing in free mode; no console errors.');
} finally { await browser.close(); }
