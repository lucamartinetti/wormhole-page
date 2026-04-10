// --- State ---
let currentCode = null;
let qrModeWeb = true; // true = web URL, false = wormhole-transfer:
let transferActive = false;

// --- Analytics helpers ---
function track(event, data) {
  if (typeof umami !== 'undefined') umami.track(event, data);
}

function sizeBucket(bytes) {
  if (bytes < 1024 * 1024) return '<1MB';
  if (bytes < 10 * 1024 * 1024) return '1-10MB';
  if (bytes < 100 * 1024 * 1024) return '10-100MB';
  if (bytes < 1024 * 1024 * 1024) return '100MB-1GB';
  return '>1GB';
}

// --- Beforeunload warning ---
window.addEventListener('beforeunload', function(e) {
  if (transferActive) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// --- Helpers ---
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

// --- Tab Switching ---
function switchTab(tab) {
  var sendTab = document.getElementById('main-tab-send');
  var recvTab = document.getElementById('main-tab-receive');
  var sendPanel = document.getElementById('panel-send');
  var recvPanel = document.getElementById('panel-receive');
  if (tab === 'send') {
    sendTab.classList.add('active');
    sendTab.setAttribute('aria-selected', 'true');
    recvTab.classList.remove('active');
    recvTab.setAttribute('aria-selected', 'false');
    sendPanel.classList.remove('hidden');
    recvPanel.classList.add('hidden');
  } else {
    recvTab.classList.add('active');
    recvTab.setAttribute('aria-selected', 'true');
    sendTab.classList.remove('active');
    sendTab.setAttribute('aria-selected', 'false');
    recvPanel.classList.remove('hidden');
    sendPanel.classList.add('hidden');
  }
}

// --- Dark Mode Toggle ---
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : (current === 'light' ? 'dark' :
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark'));
  html.setAttribute('data-theme', next);
  updateThemeToggle(next === 'dark');
  try { localStorage.setItem('theme', next); } catch (_) {}
}

function updateThemeToggle(isDark) {
  document.getElementById('theme-icon-sun').style.display = isDark ? 'none' : '';
  document.getElementById('theme-icon-moon').style.display = isDark ? '' : 'none';
  const btn = document.getElementById('theme-toggle');
  btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  btn.setAttribute('aria-checked', String(isDark));
}

// Initialize theme
(function() {
  let theme;
  try { theme = localStorage.getItem('theme'); } catch (_) {}
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeToggle(theme === 'dark');
  } else {
    updateThemeToggle(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
})();

// --- QR ---
function renderQr(text) {
  const container = document.getElementById('qr-display');
  container.innerHTML = '';
  if (typeof qrcode === 'undefined') return;
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  // cellSize=6 for better scannability on phone cameras
  container.innerHTML = qr.createSvgTag(6, 0);
}

function getReceiveUrl() {
  return window.location.origin + '/receive/' + currentCode;
}

function updateCodeDisplay() {
  const box = document.getElementById('send-code');
  if (qrModeWeb) {
    box.textContent = getReceiveUrl();
  } else {
    box.textContent = currentCode;
  }
}

function setQrMode(web) {
  qrModeWeb = web;
  document.getElementById('tab-web').classList.toggle('active', web);
  document.getElementById('tab-wormhole').classList.toggle('active', !web);
  document.getElementById('tab-web').setAttribute('aria-selected', String(web));
  document.getElementById('tab-wormhole').setAttribute('aria-selected', String(!web));
  if (web) {
    renderQr(getReceiveUrl());
  } else {
    renderQr('wormhole-transfer:' + currentCode);
  }
  updateCodeDisplay();
}

function copyCode() {
  const text = qrModeWeb ? getReceiveUrl() : currentCode;
  track('code-copy', { mode: qrModeWeb ? 'web' : 'wormhole' });
  navigator.clipboard.writeText(text).then(() => {
    const label = document.getElementById('copy-label');
    label.textContent = 'Copied!';
    setTimeout(() => { label.textContent = 'Copy'; }, 1000);
  });
}

function shareCode() {
  track('code-share', { mode: qrModeWeb ? 'web' : 'wormhole' });
  const text = qrModeWeb ? getReceiveUrl() : 'wormhole receive ' + currentCode;
  const data = { text: text };
  if (qrModeWeb) {
    data.title = 'Receive file via wormhole.page';
    data.url = getReceiveUrl();
  } else {
    data.title = 'Receive file via wormhole';
  }
  navigator.share(data).catch(() => {});
}

// --- Send ---
// Accepts a single File or an array of Files
function startSend(fileOrFiles) {
  if (!window.wasmClient || !window.wasmClient.ready) {
    // WASM not loaded -- can't proceed
    return;
  }
  // Clean up any previous send to avoid leaking relay connections
  window.wasmClient.cancelSend();
  var files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
  if (files.length === 0) return;
  startSendWasm(files.length === 1 ? files[0] : files);
}

function startSendWasm(fileOrFiles) {
  hide('send-initial');
  show('send-status');

  var files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
  var isMulti = files.length > 1;

  if (isMulti) {
    var totalSize = files.reduce(function(sum, f) { return sum + f.size; }, 0);
    document.getElementById('send-filename').textContent = files.length + ' files';
    document.getElementById('send-filesize').textContent = formatSize(totalSize) + ' total (will be sent as zip)';
  } else {
    document.getElementById('send-filename').textContent = files[0].name;
    document.getElementById('send-filesize').textContent = formatSize(files[0].size);
  }
  document.getElementById('send-status-text').textContent = 'allocating code...';
  document.getElementById('send-status-text').className = 'status-text';
  document.getElementById('send-progress').style.width = '0%';
  document.getElementById('send-progress').className = 'progress-bar';
  document.getElementById('send-progress').setAttribute('aria-valuenow', '0');
  hide('send-code-section');
  hide('send-transfer-info');
  show('send-keep-open');

  document.getElementById('send-status-text').focus();

  var totalSize = files.reduce(function(sum, f) { return sum + f.size; }, 0);
  track('send-start', { files: files.length, size: sizeBucket(totalSize) });

  window.wasmClient.send(fileOrFiles, {
    onCode(code) {
      currentCode = code;
      show('send-code-section');
      setQrMode(true);
      if (navigator.share) {
        document.getElementById('btn-share').style.display = '';
      }
    },
    onStatus(text) {
      document.getElementById('send-status-text').textContent = text;
    },
    onProgress(pct, speed, connType) {
      transferActive = true;
      document.getElementById('send-progress').style.width = pct + '%';
      document.getElementById('send-progress').setAttribute('aria-valuenow', String(pct));
      if (speed) {
        var info = speed + (connType ? ' \u00b7 ' + connType : '');
        document.getElementById('send-transfer-info').textContent = info;
        show('send-transfer-info');
      }
    },
    onError(msg) {
      transferActive = false;
      hide('send-keep-open');
      track('send-error', { error: msg });
      document.getElementById('send-status-text').textContent = msg;
      document.getElementById('send-status-text').className = 'status-text error';
      var btn = document.getElementById('send-cancel-btn');
      btn.textContent = 'New Transfer';
      btn.className = 'btn';
      btn.style.width = '100%';
      btn.style.marginTop = '8px';
      btn.focus();
    },
    onComplete() {
      transferActive = false;
      track('send-complete');
      markSendComplete();
    },
  });
}

function markSendComplete() {
  hide('send-code-section');
  hide('send-keep-open');
  document.getElementById('send-progress').style.width = '100%';
  document.getElementById('send-progress').className = 'progress-bar done';
  document.getElementById('send-progress').setAttribute('aria-valuenow', '100');
  document.getElementById('send-status-text').textContent = '\u2714 Transfer complete!';
  document.getElementById('send-status-text').className = 'status-text done';
  // Change cancel to New Transfer with primary style
  var btn = document.getElementById('send-cancel-btn');
  btn.textContent = 'New Transfer';
  btn.className = 'btn';
  btn.style.width = '100%';
  btn.style.marginTop = '8px';
  btn.focus();
}

function cancelSend() {
  if (window.wasmClient) window.wasmClient.cancelSend();
  transferActive = false;
  currentCode = null;
  hide('send-status');
  show('send-initial');
  document.getElementById('file-input').value = '';
  document.getElementById('folder-input').value = '';
  // Reset button
  var btn = document.getElementById('send-cancel-btn');
  btn.textContent = 'Cancel';
  btn.className = 'btn btn-cancel';
  btn.style.width = '';
  btn.style.marginTop = '';
  // Update progress bar ARIA
  var prog = document.getElementById('send-progress');
  if (prog) prog.setAttribute('aria-valuenow', '0');
}

// --- Receive ---
function startReceive() {
  var input = document.getElementById('receive-code');
  var code = input.value.trim().toLowerCase().replace(/\s+/g, '');
  if (!code) return;
  input.value = ''; // code is single-use — clear it immediately
  if (!window.wasmClient || !window.wasmClient.ready) return;
  // Clean up any previous receive to avoid leaking relay connections
  window.wasmClient.cancelReceive();
  startReceiveWasm(code);
}

function startReceiveWasm(code) {
  hide('receive-initial');
  show('receive-status');
  hide('receive-file-info');
  hide('receive-progress-section');
  hide('receive-transfer-info');
  document.getElementById('receive-spinner').style.display = '';
  document.getElementById('receive-status-text').textContent = 'establishing encrypted connection...';
  document.getElementById('receive-status-text').className = 'status-text';


  document.getElementById('receive-status-text').focus();

  var isDirectLink = window.location.pathname.match(/^\/receive\/.+$/);
  track('receive-start', { method: isDirectLink ? 'link' : 'code' });

  window.wasmClient.receive(code, {
    onFileInfo(filename, filesize) {
      document.getElementById('receive-filename').textContent = filename;
      var sizeText = formatSize(filesize);
      if (filename.endsWith('.zip')) {
        sizeText += ' (zip archive — extract after download)';
      }
      document.getElementById('receive-filesize').textContent = sizeText;
      show('receive-file-info');
      document.getElementById('receive-spinner').style.display = 'none';
    },
    onStatus(text) {
      document.getElementById('receive-status-text').textContent = text;
    },
    onProgress(pct, speed, connType) {
      transferActive = true;
      show('receive-progress-section');
      document.getElementById('receive-progress').style.width = pct + '%';
      document.getElementById('receive-progress').setAttribute('aria-valuenow', String(pct));
      if (speed) {
        var info = speed + (connType ? ' \u00b7 ' + connType : '');
        document.getElementById('receive-transfer-info').textContent = info;
        show('receive-transfer-info');
      }
    },
    onError(msg) {
      transferActive = false;
      track('receive-error', { error: msg });
      document.getElementById('receive-status-text').textContent = msg;
      document.getElementById('receive-status-text').className = 'status-text error';
      document.getElementById('receive-spinner').style.display = 'none';
      var btn = document.getElementById('receive-cancel-btn');
      btn.textContent = 'New Transfer';
      btn.className = 'btn';
      btn.style.width = '100%';
      btn.style.marginTop = '8px';
      btn.focus();
    },
    onComplete() {
      transferActive = false;
      track('receive-complete');
      document.getElementById('receive-progress').style.width = '100%';
      document.getElementById('receive-progress').className = 'progress-bar done';
      document.getElementById('receive-progress').setAttribute('aria-valuenow', '100');
      document.getElementById('receive-status-text').textContent = '\u2714 Transfer complete!';
      document.getElementById('receive-status-text').className = 'status-text done';
      // Change cancel to New Transfer
      var btn = document.getElementById('receive-cancel-btn');
      btn.textContent = 'New Transfer';
      btn.className = 'btn';
      btn.style.width = '100%';
      btn.style.marginTop = '8px';
      btn.focus();
    },
  });
}

function cancelReceive() {
  if (window.wasmClient) window.wasmClient.cancelReceive();
  transferActive = false;
  // If on a /receive/<code> URL, redirect to clean root
  if (window.location.pathname.match(/^\/receive\/.+$/)) {
    window.history.replaceState(null, '', '/');
  }
  hide('receive-status');
  show('receive-initial');
  // Reset button
  var btn = document.getElementById('receive-cancel-btn');
  btn.textContent = 'Cancel';
  btn.className = 'btn btn-cancel';
  btn.style.width = '';
  btn.style.marginTop = '';
  // Update progress bar ARIA
  var prog = document.getElementById('receive-progress');
  if (prog) prog.setAttribute('aria-valuenow', '0');
}

// --- Drag and drop ---
var dz = document.getElementById('dropzone');

dz.addEventListener('click', function(e) {
  if (e.target.id !== 'file-input' && e.target.id !== 'folder-input') {
    document.getElementById('file-input').click();
  }
});

dz.addEventListener('dragover', function(e) {
  e.preventDefault();
  dz.classList.add('dragover');
});

dz.addEventListener('dragleave', function() {
  dz.classList.remove('dragover');
});

dz.addEventListener('drop', function(e) {
  e.preventDefault();
  dz.classList.remove('dragover');
  var items = e.dataTransfer.items;
  // Check if any item is a directory (use webkitGetAsEntry for folder detection)
  var hasEntries = items && items.length > 0 && items[0].webkitGetAsEntry;
  if (hasEntries) {
    // Use entry API to traverse directories
    window.wasmClient.traverseEntries(items).then(function(files) {
      if (files.length > 0) {
        startSend(files.length === 1 ? files[0] : files);
      }
    }).catch(function() {
      // Fallback to flat file list
      var files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        startSend(files.length === 1 ? files[0] : files);
      }
    });
  } else if (e.dataTransfer.files.length > 0) {
    var files = Array.from(e.dataTransfer.files);
    startSend(files.length === 1 ? files[0] : files);
  }
});

dz.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    document.getElementById('file-input').click();
  }
});

document.getElementById('file-input').addEventListener('change', function() {
  if (this.files.length > 0) {
    var files = Array.from(this.files);
    startSend(files.length === 1 ? files[0] : files);
  }
});

document.getElementById('folder-input').addEventListener('change', function() {
  if (this.files.length > 0) {
    startSend(Array.from(this.files));
  }
});

// Click code box to copy
document.getElementById('send-code').addEventListener('click', copyCode);

// --- WASM initialization ---
if (window.wasmClient) {
  window.wasmClient.initWasm();
}

// --- Pre-filled receive from URL ---
(function() {
  var match = window.location.pathname.match(/^\/receive\/(.+)$/);
  if (match) {
    var code = decodeURIComponent(match[1]);
    // Wait for WASM to be ready (up to 3 seconds), then start
    var attempts = 0;
    var tryStart = function() {
      if (window.wasmClient && window.wasmClient.ready) {
        switchTab('receive');
        document.getElementById('receive-code').value = code;
        startReceive();
      } else if (attempts < 30) {
        attempts++;
        setTimeout(tryStart, 100);
      } else {
        // Fallback: fill the code input and let user click
        switchTab('receive');
        document.getElementById('receive-code').value = code;
      }
    };
    tryStart();
  }
})();

// --- Store Mode ---

function switchSendMode(mode) {
  var liveTab = document.getElementById('send-mode-live');
  var storeTab = document.getElementById('send-mode-store');
  var liveInitial = document.getElementById('send-initial');
  var liveStatus = document.getElementById('send-status');
  var storeInitial = document.getElementById('store-send-initial');
  var storeStatus = document.getElementById('store-send-status');

  if (mode === 'live') {
    liveTab.classList.add('active');
    liveTab.setAttribute('aria-selected', 'true');
    storeTab.classList.remove('active');
    storeTab.setAttribute('aria-selected', 'false');
    liveInitial.classList.remove('hidden');
    storeInitial.classList.add('hidden');
    storeStatus.classList.add('hidden');
  } else {
    storeTab.classList.add('active');
    storeTab.setAttribute('aria-selected', 'true');
    liveTab.classList.remove('active');
    liveTab.setAttribute('aria-selected', 'false');
    liveInitial.classList.add('hidden');
    liveStatus.classList.add('hidden');
    storeInitial.classList.remove('hidden');
  }
}

function switchRecvMode(mode) {
  var liveTab = document.getElementById('recv-mode-live');
  var storeTab = document.getElementById('recv-mode-store');
  var liveInitial = document.getElementById('receive-initial');
  var liveStatus = document.getElementById('receive-status');
  var storeInitial = document.getElementById('store-receive-initial');
  var storeStatus = document.getElementById('store-receive-status');

  if (mode === 'live') {
    liveTab.classList.add('active');
    liveTab.setAttribute('aria-selected', 'true');
    storeTab.classList.remove('active');
    storeTab.setAttribute('aria-selected', 'false');
    liveInitial.classList.remove('hidden');
    storeInitial.classList.add('hidden');
    storeStatus.classList.add('hidden');
  } else {
    storeTab.classList.add('active');
    storeTab.setAttribute('aria-selected', 'true');
    liveTab.classList.remove('active');
    liveTab.setAttribute('aria-selected', 'false');
    liveInitial.classList.add('hidden');
    liveStatus.classList.add('hidden');
    storeInitial.classList.remove('hidden');
  }
}

function startStoreSend(file) {
  if (!window.storeClient) {
    alert('Store mode is loading. Please wait a moment and try again.');
    return;
  }
  if (file.size > 100 * 1024 * 1024) {
    alert('File is too large (max 100 MB). Use Send Live for larger files.');
    return;
  }

  hide('store-send-initial');
  show('store-send-status');
  hide('store-code-section');
  document.getElementById('store-send-filename').textContent = file.name;
  document.getElementById('store-send-filesize').textContent = formatSize(file.size);
  document.getElementById('store-send-new-btn').style.display = 'none';
  transferActive = true;

  window.storeClient.encryptAndUpload(file, {
    onStatus: function(text) {
      document.getElementById('store-send-status-text').textContent = text;
      document.getElementById('store-send-status-text').className = 'status-text';
    },
    onProgress: function(pct) {
      var bar = document.getElementById('store-send-progress');
      bar.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', pct);
      if (pct >= 100) bar.classList.add('done');
    },
    onError: function(msg) {
      document.getElementById('store-send-status-text').textContent = msg;
      document.getElementById('store-send-status-text').className = 'status-text error';
      document.getElementById('store-send-new-btn').style.display = '';
      transferActive = false;
    },
    onComplete: function(passphrase, shareUrl) {
      document.getElementById('store-passphrase').textContent = passphrase.replace(/-/g, '  ');
      show('store-code-section');
      document.getElementById('store-send-status-text').textContent = 'File stored. Share the code or link.';
      document.getElementById('store-send-status-text').className = 'status-text done';
      document.getElementById('store-send-new-btn').style.display = '';
      transferActive = false;
      // Render QR code for share URL
      if (typeof qrcode !== 'undefined') {
        var container = document.getElementById('store-qr-display');
        container.innerHTML = '';
        var qr = qrcode(0, 'M');
        qr.addData(shareUrl, 'Byte');
        qr.make();
        container.innerHTML = qr.createSvgTag(6, 0);
      }
      // Store share URL for copy buttons
      document.getElementById('store-btn-copy-link').dataset.url = shareUrl;
      document.getElementById('store-btn-copy-code').dataset.code = passphrase;
      track('store-send', { size: sizeBucket(file.size) });
    }
  });
}

function startStoreReceive() {
  if (!window.storeClient) {
    alert('Store mode is loading. Please wait a moment and try again.');
    return;
  }
  var input = document.getElementById('store-receive-code');
  var passphrase = input.value.trim();
  if (!passphrase) return;

  hide('store-receive-initial');
  show('store-receive-status');
  hide('store-receive-file-info');
  document.getElementById('store-receive-new-btn').style.display = 'none';
  transferActive = true;

  window.storeClient.fetchAndDecrypt(passphrase, {
    onStatus: function(text) {
      document.getElementById('store-receive-status-text').textContent = text;
      document.getElementById('store-receive-status-text').className = 'status-text';
    },
    onProgress: function(pct) {
      var bar = document.getElementById('store-receive-progress');
      bar.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', pct);
      if (pct >= 100) bar.classList.add('done');
    },
    onError: function(msg) {
      document.getElementById('store-receive-status-text').textContent = msg;
      document.getElementById('store-receive-status-text').className = 'status-text error';
      document.getElementById('store-receive-new-btn').style.display = '';
      transferActive = false;
    },
    onMeta: function(size) {
      show('store-receive-file-info');
      document.getElementById('store-receive-filesize').textContent = formatSize(size) + ' (encrypted)';
    },
    onComplete: function(filename, size) {
      document.getElementById('store-receive-filename').textContent = filename;
      document.getElementById('store-receive-filesize').textContent = formatSize(size);
      show('store-receive-file-info');
      document.getElementById('store-receive-status-text').textContent = 'File decrypted and saved.';
      document.getElementById('store-receive-status-text').className = 'status-text done';
      document.getElementById('store-receive-new-btn').style.display = '';
      transferActive = false;
      track('store-receive', { size: sizeBucket(size) });
    }
  });
}

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// --- Event Listeners (replacing inline handlers for CSP compliance) ---
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('main-tab-send').addEventListener('click', function() { switchTab('send'); });
document.getElementById('main-tab-receive').addEventListener('click', function() { switchTab('receive'); });
document.getElementById('btn-folder').addEventListener('click', function() { document.getElementById('folder-input').click(); });
document.getElementById('btn-copy').addEventListener('click', copyCode);
document.getElementById('btn-share').addEventListener('click', shareCode);
document.getElementById('tab-web').addEventListener('click', function() { setQrMode(true); });
document.getElementById('tab-wormhole').addEventListener('click', function() { setQrMode(false); });
document.getElementById('send-cancel-btn').addEventListener('click', cancelSend);
document.getElementById('receive-code').addEventListener('keydown', function(e) { if (e.key === 'Enter') startReceive(); });
document.getElementById('receive-btn').addEventListener('click', startReceive);
document.getElementById('receive-cancel-btn').addEventListener('click', cancelReceive);

// Store mode tabs
document.getElementById('send-mode-live').addEventListener('click', function() { switchSendMode('live'); });
document.getElementById('send-mode-store').addEventListener('click', function() { switchSendMode('store'); });
document.getElementById('recv-mode-live').addEventListener('click', function() { switchRecvMode('live'); });
document.getElementById('recv-mode-store').addEventListener('click', function() { switchRecvMode('store'); });

// Store send: file input + dropzone
document.getElementById('store-dropzone').addEventListener('click', function() {
  document.getElementById('store-file-input').click();
});
document.getElementById('store-dropzone').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('store-file-input').click(); }
});
document.getElementById('store-file-input').addEventListener('change', function() {
  if (this.files.length > 0) startStoreSend(this.files[0]);
});
document.getElementById('store-dropzone').addEventListener('dragover', function(e) {
  e.preventDefault(); this.classList.add('dragover');
});
document.getElementById('store-dropzone').addEventListener('dragleave', function() {
  this.classList.remove('dragover');
});
document.getElementById('store-dropzone').addEventListener('drop', function(e) {
  e.preventDefault(); this.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) startStoreSend(e.dataTransfer.files[0]);
});

// Store send: copy buttons
document.getElementById('store-btn-copy-link').addEventListener('click', function() {
  var url = this.dataset.url;
  if (url) {
    navigator.clipboard.writeText(url);
    document.getElementById('store-copy-link-label').textContent = 'Copied!';
    setTimeout(function() { document.getElementById('store-copy-link-label').textContent = 'Copy Link'; }, 2000);
  }
});
document.getElementById('store-btn-copy-code').addEventListener('click', function() {
  var code = this.dataset.code;
  if (code) {
    navigator.clipboard.writeText(code);
    document.getElementById('store-copy-code-label').textContent = 'Copied!';
    setTimeout(function() { document.getElementById('store-copy-code-label').textContent = 'Copy Code'; }, 2000);
  }
});

// Store send: new button
document.getElementById('store-send-new-btn').addEventListener('click', function() {
  hide('store-send-status');
  show('store-send-initial');
  document.getElementById('store-send-progress').style.width = '0%';
  document.getElementById('store-send-progress').classList.remove('done');
  document.getElementById('store-file-input').value = '';
});

// Store receive: start
document.getElementById('store-receive-btn').addEventListener('click', startStoreReceive);
document.getElementById('store-receive-code').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') startStoreReceive();
});

// Store receive: new button
document.getElementById('store-receive-new-btn').addEventListener('click', function() {
  hide('store-receive-status');
  show('store-receive-initial');
  document.getElementById('store-receive-progress').style.width = '0%';
  document.getElementById('store-receive-progress').classList.remove('done');
  document.getElementById('store-receive-code').value = '';
});

// Auto-detect /store#passphrase URL
(function() {
  if (window.location.pathname === '/store' && window.location.hash.length > 1) {
    var passphrase = decodeURIComponent(window.location.hash.slice(1));
    switchTab('receive');
    switchRecvMode('store');
    document.getElementById('store-receive-code').value = passphrase;
    // Wait for store-client.js module to load, then start
    var attempts = 0;
    var tryStart = function() {
      if (window.storeClient) {
        startStoreReceive();
      } else if (attempts < 50) {
        attempts++;
        setTimeout(tryStart, 100);
      }
    };
    tryStart();
  }
})();
