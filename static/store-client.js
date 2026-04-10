// Store client — handles async encrypted file store operations.
// Uses age-encryption for E2E encryption and Web Crypto for blob ID derivation.

import { Encrypter, Decrypter } from '/static/age.js';
import { WORDLIST } from '/static/wordlist.js';

// --- Passphrase Generation ---

// Generate a 4-word diceware passphrase using crypto-secure randomness.
// ~51.7 bits of entropy (7776^4 combinations).
function generatePassphrase() {
  const indices = new Uint32Array(4);
  crypto.getRandomValues(indices);
  return Array.from(indices)
    .map(n => WORDLIST[n % WORDLIST.length])
    .join('-');
}

// --- Blob ID ---

// Derive a blob ID from the passphrase via SHA-256.
// This is NOT the encryption key — it's used for server-side lookup only.
// Returns a 64-char hex string.
async function computeBlobId(passphrase) {
  const encoder = new TextEncoder();
  const data = encoder.encode(passphrase);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// --- Metadata Framing ---

// Build the plaintext payload: 4-byte length prefix + JSON metadata + raw file bytes.
// This is what gets encrypted by age.
function buildPayload(file, fileBytes) {
  const meta = JSON.stringify({
    name: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size
  });
  const metaBytes = new TextEncoder().encode(meta);
  const metaLen = new DataView(new ArrayBuffer(4));
  metaLen.setUint32(0, metaBytes.length, false); // big-endian

  const payload = new Uint8Array(4 + metaBytes.length + fileBytes.length);
  payload.set(new Uint8Array(metaLen.buffer), 0);
  payload.set(metaBytes, 4);
  payload.set(new Uint8Array(fileBytes), 4 + metaBytes.length);
  return payload;
}

// Parse the decrypted payload back into metadata + file bytes.
function parsePayload(decrypted) {
  const view = new DataView(decrypted.buffer, decrypted.byteOffset, decrypted.byteLength);
  const metaLen = view.getUint32(0, false); // big-endian
  const metaBytes = decrypted.slice(4, 4 + metaLen);
  const meta = JSON.parse(new TextDecoder().decode(metaBytes));
  const fileBytes = decrypted.slice(4 + metaLen);
  return { meta, fileBytes };
}

// --- Encrypt & Upload ---

// Encrypt a file with age passphrase encryption and upload to the server.
// callbacks: { onStatus(text), onProgress(pct), onError(msg), onComplete(passphrase, shareUrl) }
async function encryptAndUpload(file, callbacks) {
  try {
    callbacks.onStatus('Generating passphrase...');
    const passphrase = generatePassphrase();
    const blobId = await computeBlobId(passphrase);

    callbacks.onStatus('Reading file...');
    const fileBytes = await file.arrayBuffer();

    // Check size limit (100MB)
    if (file.size > 100 * 1024 * 1024) {
      callbacks.onError('File is too large (max 100 MB). Use Send Live for larger files.');
      return;
    }

    callbacks.onStatus('Encrypting...');
    callbacks.onProgress(10);

    const payload = buildPayload(file, new Uint8Array(fileBytes));

    // Encrypt with age passphrase encryption
    const encrypter = new Encrypter();
    encrypter.setPassphrase(passphrase);
    const encrypted = await encrypter.encrypt(payload);

    callbacks.onProgress(50);
    callbacks.onStatus('Uploading...');

    // Upload to server
    const response = await fetch('/api/store/' + blobId, {
      method: 'POST',
      headers: {
        'Content-Length': encrypted.length.toString()
      },
      body: encrypted
    });

    if (response.status === 409) {
      // Extremely rare: passphrase collision. Retry with new passphrase.
      callbacks.onStatus('Retrying...');
      return encryptAndUpload(file, callbacks);
    }

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 413) {
        callbacks.onError('File is too large for the server.');
      } else if (response.status === 429) {
        callbacks.onError('Too many uploads. Please wait and try again.');
      } else if (response.status === 503) {
        callbacks.onError('Store is not available. Use Send Live instead.');
      } else {
        callbacks.onError('Upload failed: ' + text);
      }
      return;
    }

    callbacks.onProgress(100);
    const shareUrl = window.location.origin + '/store#' + passphrase;
    callbacks.onComplete(passphrase, shareUrl);
  } catch (err) {
    callbacks.onError('Upload failed: ' + err.message);
  }
}

// --- Download & Decrypt ---

// Fetch an encrypted blob from the server and decrypt it.
// callbacks: { onStatus(text), onProgress(pct), onError(msg), onMeta(size), onComplete(filename, blob) }
async function fetchAndDecrypt(passphrase, callbacks) {
  try {
    const blobId = await computeBlobId(passphrase);

    callbacks.onStatus('Checking file...');

    // Check metadata first
    const metaResp = await fetch('/api/store/' + blobId + '/meta');
    if (metaResp.status === 404) {
      callbacks.onError('No file found with this code. Check the code and try again.');
      return;
    }
    if (metaResp.status === 410) {
      callbacks.onError('This file has expired or was already downloaded. Ask the sender to store it again.');
      return;
    }
    if (!metaResp.ok) {
      callbacks.onError('Failed to check file: ' + await metaResp.text());
      return;
    }

    const metaData = await metaResp.json();
    callbacks.onMeta(metaData.size);

    callbacks.onStatus('Downloading...');
    callbacks.onProgress(10);

    // Download the encrypted blob
    const downloadResp = await fetch('/api/store/' + blobId);
    if (!downloadResp.ok) {
      if (downloadResp.status === 410) {
        callbacks.onError('This file has expired or was already downloaded.');
      } else {
        callbacks.onError('Download failed: ' + await downloadResp.text());
      }
      return;
    }

    const encrypted = new Uint8Array(await downloadResp.arrayBuffer());
    callbacks.onProgress(60);

    callbacks.onStatus('Decrypting...');

    // Decrypt with age
    const decrypter = new Decrypter();
    decrypter.addPassphrase(passphrase);
    let decrypted;
    try {
      decrypted = await decrypter.decrypt(encrypted);
    } catch (e) {
      callbacks.onError("Couldn't decrypt this file. The code might be wrong — check for typos.");
      return;
    }

    callbacks.onProgress(90);

    // Parse metadata + file from decrypted payload
    const { meta, fileBytes } = parsePayload(new Uint8Array(decrypted));

    callbacks.onStatus('Saving ' + meta.name + '...');

    // Trigger download
    const blob = new Blob([fileBytes], { type: meta.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    callbacks.onProgress(100);
    callbacks.onComplete(meta.name, meta.size);
  } catch (err) {
    callbacks.onError('Download failed: ' + err.message);
  }
}

// Export on window for use by app.js (no build step, vanilla JS)
window.storeClient = {
  generatePassphrase,
  computeBlobId,
  encryptAndUpload,
  fetchAndDecrypt
};
