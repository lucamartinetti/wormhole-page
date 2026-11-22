import { readFileSync } from 'fs';
import { test, expect, type Page } from '@playwright/test';

// Sending is a no-op until the WASM client has loaded
async function openSendPage(page: Page) {
  await page.goto('/');
  await page.waitForFunction(
    () => window['wasmClient']?.ready === true,
    null,
    { timeout: 5000 },
  );
}

// Sends a file from `page` and returns the wormhole code shown to the sender
async function sendFile(page: Page, name: string, buffer: Buffer): Promise<string> {
  await openSendPage(page);
  await page.setInputFiles('#file-input', { name, mimeType: 'text/plain', buffer });
  await expect(page.locator('#send-code-section')).toBeVisible({ timeout: 15000 });
  const share = await page.locator('#send-code').textContent();
  const code = share?.match(/receive\/([^/\s]+)/)?.[1];
  expect(code).toBeTruthy();
  return code!;
}

test.describe('Send text', () => {
  test('panel toggles and submit is disabled until text is entered', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#send-text-panel')).toHaveClass(/hidden/);

    await page.click('#btn-text');
    await expect(page.locator('#send-text-panel')).toBeVisible();
    await expect(page.locator('#send-text-submit')).toBeDisabled();

    await page.fill('#send-text-input', 'hello');
    await expect(page.locator('#send-text-submit')).toBeEnabled();

    await page.click('#send-text-cancel');
    await expect(page.locator('#send-text-panel')).toHaveClass(/hidden/);
    await expect(page.locator('#send-text-input')).toHaveValue('');
    await expect(page.locator('#btn-text')).toBeVisible();
  });

  test('sends text and the receiver displays it inline', async ({ page, context }) => {
    const message = 'hello wormhole text 👍';
    await openSendPage(page);
    await page.click('#btn-text');
    await page.fill('#send-text-input', message);
    await page.click('#send-text-submit');

    // Sender gets a code shown
    await expect(page.locator('#send-code-section')).toBeVisible({ timeout: 15000 });
    const share = await page.locator('#send-code').textContent();
    const code = share?.match(/receive\/([^/\s]+)/)?.[1];
    expect(code).toBeTruthy();

    // Second tab receives via the share link — like a real recipient
    const receiver = await context.newPage();
    await receiver.goto('/receive/' + code);
    await expect(receiver.locator('#receive-text-panel')).toBeVisible({ timeout: 15000 });
    await expect(receiver.locator('#receive-text-content')).toHaveText(message);
    await expect(receiver.locator('#receive-status-text')).toHaveText(/Transfer complete/);
    await receiver.close();

    // Sender side completes too
    await expect(page.locator('#send-status-text')).toHaveText(/Transfer complete/, { timeout: 15000 });
  });

  test('text transfer-info shows completion on both sides', async ({ page, context }) => {
    await openSendPage(page);
    await page.click('#btn-text');
    await page.fill('#send-text-input', 'second-message-body');
    await page.click('#send-text-submit');
    await expect(page.locator('#send-code-section')).toBeVisible({ timeout: 15000 });
    const share = await page.locator('#send-code').textContent();
    const code = share?.match(/receive\/([^/\s]+)/)?.[1]!;

    const receiver = await context.newPage();
    await receiver.goto('/receive/' + code);
    await expect(receiver.locator('#receive-text-content')).toHaveText('second-message-body', { timeout: 15000 });
    // Inline text must NOT trigger the file download path
    const download = await receiver.waitForEvent('download', { timeout: 1500 })
      .then(() => 'download')
      .catch(() => 'no-download');
    expect(download).toBe('no-download');
    await receiver.close();
  });

  test('a small text file that is not a text message is downloaded, not shown inline', async ({ page, context }) => {
    const body = Buffer.from('plain file body\n');
    const code = await sendFile(page, 'notes.txt', body);

    const receiver = await context.newPage();
    // Take the Blob download path: the native save dialog cannot be driven from a test
    await receiver.addInitScript(() => { delete (window as any).showSaveFilePicker; });
    const downloadPromise = receiver.waitForEvent('download', { timeout: 20000 });
    await receiver.goto('/receive/' + code);
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('notes.txt');
    expect(readFileSync(await download.path()).equals(body)).toBe(true);
    await expect(receiver.locator('#receive-text-panel')).toBeHidden();
    await receiver.close();
  });

  test('downloading a received text message returns the bytes as sent', async ({ page, context }) => {
    // Decoding for display drops a leading UTF-8 BOM; Download must keep it
    const body = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('text with a BOM')]);
    const code = await sendFile(page, 'message.txt', body);

    const receiver = await context.newPage();
    await receiver.goto('/receive/' + code);
    await expect(receiver.locator('#receive-text-content')).toHaveText('text with a BOM', { timeout: 15000 });

    const downloadPromise = receiver.waitForEvent('download');
    await receiver.click('#btn-download-text');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('message.txt');
    expect(readFileSync(await download.path()).equals(body)).toBe(true);
    await receiver.close();
  });
});
