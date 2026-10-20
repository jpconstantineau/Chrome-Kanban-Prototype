import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = 4174;
const url = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, PORT: String(port) }, stdio: 'pipe' });
let browser;
try {
  await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); server.once('exit', (code) => reject(new Error(`Preview server exited: ${code}`))); });
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  // Exercise the actual unsupported-browser path independently of installed AI hardware.
  await context.addInitScript(() => { Object.defineProperty(globalThis, 'LanguageModel', { value: undefined, configurable: true }); });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await page.locator('#board[aria-busy="false"]').waitFor();
  assert.equal(await page.locator('.column').count(), 3);
  assert.equal(await page.locator('#board-title').textContent(), 'My board');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.brand').evaluate((element) => element === document.activeElement && getComputedStyle(element).outlineStyle === 'solid'), true, 'keyboard focus must be visible through the external stylesheet');
  assert.match(await page.locator('#ai-status').textContent(), /unavailable/);
  assert.equal(await page.locator('#chat-input').isDisabled(), true);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/empty-desktop.png', fullPage: true });

  async function saveCard(title, assignee, description = '', doubleSubmit = false) {
    await page.locator('#new-card').click();
    await page.locator('#card-title').fill(title);
    await page.locator('#card-description').fill(description);
    await page.locator('#card-assignee').fill(assignee);
    if (doubleSubmit) await page.locator('#card-form').evaluate((form) => { form.requestSubmit(); form.requestSubmit(); });
    else await page.getByRole('button', { name: 'Save card', exact: true }).click();
    await page.locator('#card-dialog').waitFor({ state: 'hidden' });
  }
  const card = (title) => page.locator('.card').filter({ has: page.getByRole('button', { name: `Edit card: ${title}`, exact: true }) });
  await saveCard('Plan launch', 'Pierre', 'Review the launch checklist. <img src=x onerror=alert(1)>');
  await saveCard('Write release notes', 'Alex', 'Document the changes.', true);
  assert.equal(await page.locator('.card').count(), 2);
  assert.equal(await page.locator('.card img').count(), 0, 'description must be plain text');
  await card('Plan launch').getByRole('button', { name: 'Rename label Task' }).click();
  await page.getByRole('textbox', { name: 'Label name', exact: true }).fill('Planning');
  await page.locator('#search').click();
  await page.getByRole('button', { name: 'Rename label Planning' }).waitFor();
  await page.locator('#search').fill('checklist');
  await page.locator('#label-filter').selectOption('Planning');
  await page.locator('#assignee-filter').selectOption('Pierre');
  assert.equal(await page.locator('.card').count(), 1);
  await page.locator('#assignee-filter').selectOption('Alex');
  assert.equal(await page.locator('.card').count(), 0);
  await page.getByText('No cards match these filters.', { exact: false }).waitFor();
  await page.locator('#clear-filters').click();

  // Native browser drag/drop: between columns, within a column, and column headers.
  await card('Plan launch').dragTo(page.locator('[data-drop-column="column-progress"]'));
  await page.locator('[data-column-id="column-progress"] .card').waitFor();
  assert.match(await page.locator('[data-column-id="column-progress"] .card-title').textContent(), /Plan launch/);
  await card('Write release notes').dragTo(page.locator('[data-drop-column="column-progress"]'));
  await page.waitForFunction(() => document.querySelectorAll('[data-column-id="column-progress"] .card').length === 2);
  const titlesBefore = await page.locator('[data-column-id="column-progress"] .card-title').allTextContents();
  await page.locator('[data-column-id="column-progress"] .card').nth(1).dragTo(page.locator('[data-column-id="column-progress"] .card').nth(0), { targetPosition: { x: 30, y: 10 } });
  await page.waitForFunction((first) => document.querySelector('[data-column-id="column-progress"] .card-title').textContent !== first, titlesBefore[0]);
  await page.getByRole('button', { name: 'Edit card: Plan launch', exact: true }).click();
  await page.locator('#card-column').selectOption('column-done');
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await page.locator('#card-dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Edit card: Plan launch (complete)', exact: true }).waitFor();
  assert.match(await page.locator('[data-column-id="column-done"] .card-title').textContent(), /✓/);

  await page.locator('#new-column').click();
  await page.locator('#column-name').fill('Review');
  await page.getByRole('button', { name: 'Save column', exact: true }).click();
  await page.locator('#column-dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Edit Review column', exact: true }).click();
  await page.locator('#column-name').fill('Quality');
  await page.getByRole('button', { name: 'Save column', exact: true }).click();
  await page.locator('#column-dialog').waitFor({ state: 'hidden' });
  const quality = page.locator('.column').filter({ has: page.getByRole('button', { name: 'Edit Quality column', exact: true }) });
  const qualityId = await quality.getAttribute('data-column-id');
  await quality.locator('.column-header').dragTo(page.locator('.column').first(), { targetPosition: { x: 8, y: 25 } });
  await page.waitForFunction((id) => document.querySelector('.column').dataset.columnId === id, qualityId);
  await page.getByRole('button', { name: 'Move Quality column right', exact: true }).click();
  await page.waitForFunction((id) => document.querySelectorAll('.column')[1].dataset.columnId === id, qualityId);

  // Archive with cards, restore an individual from an archived column, restore the column.
  await page.getByRole('button', { name: 'Edit card: Plan launch (complete)', exact: true }).click();
  await page.locator('#card-column').selectOption(qualityId);
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await page.locator('#card-dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Edit Quality column', exact: true }).click();
  await page.locator('#archive-column').click();
  await page.locator('#column-dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.card').count(), 1);
  await page.locator('#open-archive').click();
  await page.getByRole('button', { name: 'Restore Plan launch', exact: true }).click();
  await page.getByRole('button', { name: 'Restore Plan launch', exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Restore Quality', exact: true }).click();
  await page.getByRole('button', { name: 'Restore Quality', exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Close archive', exact: true }).click();
  assert.equal(await page.locator('.column').count(), 4);
  await page.getByRole('button', { name: 'Edit card: Plan launch', exact: true }).click();
  await page.locator('#archive-card').click();
  await page.locator('#card-dialog').waitFor({ state: 'hidden' });
  await page.locator('#open-archive').click();
  await page.getByRole('button', { name: 'Restore Plan launch', exact: true }).click();
  await page.getByRole('button', { name: 'Restore Plan launch', exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Close archive', exact: true }).click();

  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.reload();
  await page.locator('#board[aria-busy="false"]').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  assert.equal(await page.locator('.card').count(), 2);
  await page.getByRole('button', { name: 'Rename label Planning' }).waitFor();
  await page.screenshot({ path: 'test-results/filled-light.png', fullPage: true });

  // A persistence failure must preserve the saved board and keep the draft editable.
  await page.evaluate(() => { IDBObjectStore.prototype.put = () => { throw new DOMException('Test quota failure', 'QuotaExceededError'); }; });
  await page.locator('#new-card').click();
  await page.locator('#card-title').fill('Unsaved card');
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await page.locator('#card-form-error').filter({ hasText: 'Test quota failure' }).waitFor();
  assert.equal(await page.locator('#card-dialog').isVisible(), true);
  assert.equal(await page.locator('.card').count(), 2);
  await page.reload();
  await page.locator('#board[aria-busy="false"]').waitFor();
  assert.equal(await page.locator('.card').count(), 2);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, '200% text must remain inside the mobile layout');
  await page.locator('#new-card').click();
  assert.equal(await page.locator('#card-dialog').isVisible(), true);
  assert.equal(await page.locator('#card-dialog').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth), true, 'card editor must contain enlarged text');
  await page.getByRole('button', { name: 'Close card editor', exact: true }).click();
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  assert.deepEqual(errors, []);

  // Browser-level AI contract with a deterministic model double; no real inference claimed.
  const aiContext = await browser.newContext();
  await aiContext.addInitScript(() => {
    globalThis.testTools = [];
    Object.defineProperty(document, 'modelContext', { value: { registerTool(tool) { globalThis.testTools.push(tool); } } });
    const session = () => ({ destroy() {}, async clone() { return session(); }, async *promptStreaming() {
      const reply = JSON.stringify({ message: 'I can add that card.', actions: [{ tool: 'create_card', arguments: { title: 'AI planned task', columnId: 'column-todo' } }] });
      yield reply.slice(0, 30); yield reply.slice(30);
    } });
    Object.defineProperty(globalThis, 'LanguageModel', { value: { async availability() { return 'available'; }, async create() { return session(); } }, configurable: true });
  });
  const aiPage = await aiContext.newPage(); aiPage.on('pageerror', (error) => errors.push(error.message)); aiPage.on('dialog', (dialog) => dialog.accept());
  await aiPage.goto(url);
  await aiPage.locator('#board[aria-busy="false"]').waitFor();
  await aiPage.locator('#ai-enable').click();
  await aiPage.locator('#chat-input:enabled').waitFor();
  await aiPage.locator('#chat-input').fill('Create a task');
  await aiPage.locator('#chat-send').click();
  await aiPage.getByRole('button', { name: 'Edit card: AI planned task', exact: true }).waitFor();
  await aiPage.locator('.chat-message.assistant').filter({ hasText: 'Applied:' }).waitFor();
  assert.equal(await aiPage.evaluate(() => globalThis.testTools.length), 6);
  await aiPage.reload();
  await aiPage.locator('#board[aria-busy="false"]').waitFor();
  assert.equal(await aiPage.locator('.chat-message').count(), 2);
  assert.equal(await aiPage.locator('.card').count(), 1);
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: CRUD, labels, combined filters, native drag/drop, keyboard order, archive/restore, theme/reload, persistence failure, responsive layout, unavailable AI, mocked AI/WebMCP and chat persistence.');
} finally {
  await browser?.close(); server.kill();
}
