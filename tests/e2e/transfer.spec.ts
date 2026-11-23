import { readFileSync } from 'fs';
import { test, expect } from '@playwright/test';

test.describe('File transfer', () => {
  test('a file sent from one tab arrives byte-identical in another', async ({ page, context }) => {
    // 200 KB of non-repeating bytes, so the transfer spans many encrypted records
    const body = Buffer.alloc(200 * 1024);
    for (let i = 0; i < body.length; i++) body[i] = (i * 31 + (i >> 8)) & 0xff;

    await page.goto('/');
    // Sending is a no-op until the WASM client has loaded
    await page.waitForFunction(
      () => window['wasmClient']?.ready === true,
      null,
      { timeout: 5000 },
    );
    await page.setInputFiles('#file-input', {
      name: 'payload.bin',
      mimeType: 'application/octet-stream',
      buffer: body,
    });
    await expect(page.locator('#send-code-section')).toBeVisible({ timeout: 15000 });
    const share = await page.locator('#send-code').textContent();
    const code = share?.match(/receive\/([^/\s]+)/)?.[1];
    expect(code).toBeTruthy();

    const receiver = await context.newPage();
    // Take the Blob download path: the native save dialog cannot be driven from a test
    await receiver.addInitScript(() => { delete (window as any).showSaveFilePicker; });
    const downloadPromise = receiver.waitForEvent('download', { timeout: 25000 });
    await receiver.goto('/receive/' + code);
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('payload.bin');
    expect(readFileSync(await download.path()).equals(body)).toBe(true);
    await expect(receiver.locator('#receive-status-text')).toHaveText(/Transfer complete/);
    await expect(page.locator('#send-status-text')).toHaveText(/Transfer complete/, { timeout: 15000 });
    await receiver.close();
  });
});
