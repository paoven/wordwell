// Optional browser checks: install Playwright separately, or provide its module path.
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dailyWord, scoreGuess, keyboardColors } from '../src/lib/game.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const words = JSON.parse(readFileSync(new URL('../src/data/vocabulary.json', import.meta.url)));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
const errors = [];
const artifacts = mkdtempSync(join(tmpdir(), 'wordwell-browser-'));
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Rome' });
const page = await context.newPage();
await page.addInitScript(() => { Math.random = () => 0; });
page.on('pageerror', error => errors.push(error.message));
const url = process.env.TEST_URL || 'http://127.0.0.1:5173/';
async function checkColors(guess, target) {
  const expected = scoreGuess(guess, target);
  const row = page.locator('.board-row').first();
  for (let i = 0; i < expected.length; i++) assert.ok((await row.locator('.tile').nth(i).getAttribute('class')).split(' ').includes(expected[i]));
  for (const [letter, color] of Object.entries(keyboardColors([guess], target))) {
    assert.ok((await page.locator('.key').filter({ hasText: new RegExp(`^${letter}$`, 'i') }).getAttribute('class')).split(' ').includes(color));
  }
}
async function type(text) { await page.locator('h1').click(); await page.keyboard.type(text); }
async function currentFreeWord() {
  const definition = await page.locator('.definition').textContent();
  return words.find(item => item.definition === definition);
}
try {
  await page.goto(url);
  await page.locator('.board-row').first().waitFor();
  await page.screenshot({ path: join(artifacts, 'desktop.png'), fullPage: true });
  const date = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const target = dailyWord(words, date).word;
  await type('x'); await page.keyboard.press('Enter');
  assert.match(await page.getByRole('status').first().textContent(), /Inserisci/);
  await page.keyboard.press('Backspace');
  const invalid = 'z'.repeat(target.length);
  await type(invalid); await page.keyboard.press('Enter');
  assert.match(await page.getByRole('status').first().textContent(), /non è nel vocabolario/);
  assert.equal(await page.locator('.tile.correct,.tile.present,.tile.absent').count(), 0);
  await page.reload();
  assert.equal(await page.locator('.board-row').first().innerText().then(value => value.replace(/\s/g, '').toLowerCase()), invalid);
  for (let i = 0; i < target.length; i++) await page.keyboard.press('Backspace');
  const guess = words.find(item => item.word.length === target.length && item.word !== target).word;
  await type(guess); await page.keyboard.press('Enter'); await checkColors(guess, target);
  await type('ab'); await page.reload();
  assert.equal(await page.locator('.board-row').nth(1).innerText().then(value => value.replace(/\s/g, '').toLowerCase()), 'ab');
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  await type(target); await page.keyboard.press('Enter');
  assert.match(await page.getByRole('status').first().textContent(), /Ben fatto/);
  assert.equal(await page.locator('.key:disabled').count(), 28);
  await page.reload(); assert.match(await page.getByRole('status').first().textContent(), /Ben fatto/);
  await page.getByRole('button', { name: 'Modalità libera' }).click();
  await page.keyboard.type('abc');
  await page.keyboard.press('Enter');
  assert.match(await page.getByRole('status').first().textContent(), /Inserisci/);
  await page.getByRole('button', { name: 'Nuova parola' }).click();
  for (const category of ['Food', 'Travel', 'Business', 'Technology']) {
    await page.locator('#category').selectOption(category);
    const selected = await currentFreeWord(); assert.equal(selected.category, category);
    if (category === 'Food') {
      // The virtual keyboard applies the same rule, with no attempt consumed.
      for (let i = 0; i < selected.word.length; i++) await page.getByRole('button', { name: 'Z', exact: true }).click();
      await page.getByRole('button', { name: 'ENTER', exact: true }).click();
      assert.match(await page.getByRole('status').first().textContent(), /non è nel vocabolario/);
      assert.equal(await page.locator('.tile.correct,.tile.present,.tile.absent').count(), 0);
      for (let i = 0; i < selected.word.length; i++) await page.getByRole('button', { name: 'Backspace, cancella ultima lettera' }).click();
      const otherCategory = words.find(item => item.category !== category && item.word.length === selected.word.length).word;
      for (const letter of otherCategory) await page.locator('.key').filter({ hasText: new RegExp(`^${letter}$`, 'i') }).click();
      await page.getByRole('button', { name: 'ENTER', exact: true }).click();
      await checkColors(otherCategory, selected.word);
    }
    await type(selected.word); await page.keyboard.press('Enter');
    assert.match(await page.getByRole('status').first().textContent(), /Ben fatto/);
    await page.getByRole('button', { name: 'Gioca ancora' }).click();
    assert.notEqual((await currentFreeWord()).word, selected.word);
    assert.equal(await page.locator('.tile.correct').count(), 0);
  }
  const losingWord = (await currentFreeWord()).word;
  const wrongWord = words.find(item => item.word.length === losingWord.length && item.word !== losingWord).word;
  for (let i = 0; i < 6; i++) { await type(wrongWord); await page.keyboard.press('Enter'); }
  assert.match(await page.getByRole('status').first().textContent(), new RegExp(`La parola era ${losingWord.toUpperCase()}`));
  assert.equal(await page.locator('.key:disabled').count(), 28);
  await page.getByRole('button', { name: 'Gioca ancora' }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  assert.ok(await page.locator('.keyboard').evaluate(node => node.getBoundingClientRect().bottom <= innerHeight), 'Mobile keyboard is visible at the bottom of the viewport');
  await page.getByRole('button', { name: 'Q', exact: true }).click();
  assert.equal(await page.locator('.board-row').first().locator('.tile').first().textContent(), 'q');
  await page.getByRole('button', { name: 'Backspace, cancella ultima lettera' }).click();
  assert.equal(await page.locator('.board-row').first().locator('.tile').first().textContent(), '');
  await page.screenshot({ path: join(artifacts, 'mobile.png'), fullPage: true });
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow at ${width}px`);
  }
  await page.getByRole('button', { name: 'Come si gioca' }).click();
  assert.equal(await page.locator('dialog').evaluate(node => node.open), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog').evaluate(node => node.open), false);
  // A fresh page with a controllable browser clock verifies local midnight rollover.
  const midnight = await context.newPage();
  midnight.on('pageerror', error => errors.push(error.message));
  await midnight.clock.install({ time: new Date('2026-10-13T23:59:59+02:00') });
  await midnight.goto(url);
  await midnight.locator('h1').click(); await midnight.keyboard.type('ab');
  await midnight.clock.runFor(2000);
  assert.match(await midnight.locator('.clue-card').textContent(), /14 ottobre 2026/);
  assert.equal(await midnight.locator('.definition').textContent(), dailyWord(words, '2026-10-14').definition);
  assert.equal(await midnight.locator('.tile.filled').count(), 0);
  // Blocked storage must not stop play.
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw Error('blocked'); } }));
  const blockedPage = await blocked.newPage();
  blockedPage.on('pageerror', error => errors.push(error.message));
  await blockedPage.goto(url);
  assert.match(await blockedPage.getByRole('status').last().textContent(), /non consente il salvataggio/);
  await blockedPage.locator('h1').click(); await blockedPage.keyboard.type('a');
  assert.equal(await blockedPage.locator('.tile.filled').count(), 1);
  // Previously saved random-letter guesses cannot bypass dictionary validation.
  const legacy = await context.newPage();
  legacy.on('pageerror', error => errors.push(error.message));
  await legacy.addInitScript(({ date, target }) => {
    localStorage.setItem(`wordwell:daily:v1:${date}`, JSON.stringify({ word: target, guesses: ['z'.repeat(target.length)], input: '' }));
  }, { date, target });
  await legacy.goto(url);
  assert.equal(await legacy.locator('.tile.correct,.tile.present,.tile.absent').count(), 0);
  await legacy.locator('h1').click(); await legacy.keyboard.type(target); await legacy.keyboard.press('Enter');
  assert.match(await legacy.getByRole('status').first().textContent(), /Ben fatto/);
  // Force the longest word to verify the grid and keyboard at narrow widths.
  const longest = [...words].sort((a, b) => b.word.length - a.word.length)[0];
  const pool = words.filter(word => word.category === longest.category);
  const sample = (pool.findIndex(word => word.word === longest.word) + 0.5) / pool.length;
  const longPage = await context.newPage();
  longPage.on('pageerror', error => errors.push(error.message));
  await longPage.addInitScript(value => { Math.random = () => value; }, sample);
  await longPage.goto(url);
  await longPage.getByRole('button', { name: 'Modalità libera' }).click();
  await longPage.locator('#category').selectOption(longest.category);
  assert.equal(await longPage.locator('.definition').textContent(), longest.definition);
  for (const width of [320, 375, 768, 1440]) {
    await longPage.setViewportSize({ width, height: 900 });
    await longPage.locator('h1').click();
    await longPage.keyboard.type(longest.word);
    assert.ok(await longPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await longPage.locator('.tile.filled').evaluateAll(nodes => nodes.every(node =>
      node.querySelector('span').getBoundingClientRect().width <= node.getBoundingClientRect().width)));
    for (let i = 0; i < longest.word.length; i++) await longPage.keyboard.press('Backspace');
  }
  await longPage.keyboard.type(longest.word); await longPage.keyboard.press('Enter');
  assert.match(await longPage.getByRole('status').first().textContent(), /Ben fatto/);
  await longPage.getByRole('link', { name: 'Fonti del vocabolario' }).click();
  await longPage.getByRole('link', { name: 'licenza completa di WordNet' }).click();
  assert.match(await longPage.locator('body').textContent(), /WordNet 3.0 Copyright 2006/);
  assert.deepEqual(errors, []);
  console.log('PASS: daily persistence and win, category play and reset, loss, virtual/physical input, colors, 4 viewport sizes, help, midnight rollover, blocked storage; no browser errors.');
  console.log(`Screenshots: ${artifacts}`);
} finally { await browser.close(); }
