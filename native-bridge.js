(() => {
  'use strict';
  if (!window.chrome || !window.chrome.webview) return;

  const webview = window.chrome.webview;
  const pending = new Map();
  const listeners = new Map();
  let requestSequence = 0;
  const readyEvents = new Set();

  function call(method, ...args) {
    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${++requestSequence}`;
      const timeout = window.setTimeout(() => {
        pending.delete(id);
        reject(new Error(`The Windows host did not respond to ${method}.`));
      }, 120000);
      pending.set(id, { resolve, reject, timeout });
      webview.postMessage({ type: 'call', id, method, args });
    });
  }

  function subscribe(name, callback) {
    if (typeof callback !== 'function') return () => {};
    const group = listeners.get(name) || new Set();
    group.add(callback);
    listeners.set(name, group);
    if (!readyEvents.has(name) && ['openMedia', 'discoveredMedia'].includes(name)) {
      readyEvents.add(name);
      const readyMethod = name === 'openMedia' ? 'openMediaReady' : 'discoveryReady';
      call(readyMethod).catch(() => {});
    }
    return () => {
      group.delete(callback);
      if (!group.size) listeners.delete(name);
    };
  }

  webview.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.type === 'response') {
      const pendingCall = pending.get(String(message.id));
      if (!pendingCall) return;
      pending.delete(String(message.id));
      window.clearTimeout(pendingCall.timeout);
      if (message.error) pendingCall.reject(new Error(String(message.error)));
      else pendingCall.resolve(message.result);
      return;
    }
    if (message.type !== 'event') return;
    for (const listener of listeners.get(String(message.name)) || []) {
      try { listener(message.data); } catch (error) { console.error('KnightWin native event failed:', error); }
    }
  });

  function proxyUrl(stream) {
    if (!stream || !stream.url) return '';
    try {
      const url = new URL('https://proxy.revibe.local/');
      url.searchParams.set('url', stream.url);
      if (stream.referrer) url.searchParams.set('ref', stream.referrer);
      if (stream.userAgent) url.searchParams.set('ua', stream.userAgent);
      return url.href;
    } catch { return stream.url; }
  }

  window.revibe = Object.freeze({
    // The renderer uses this legacy capability flag to enable desktop-only UI.
    // The application host is C#/WPF + WebView2; it does not contain Electron.
    isDesktop: true,
    getVersion: () => call('getVersion'),
    getPlatform: () => call('getPlatform'),
    getNativeTheme: () => call('getNativeTheme'),
    getSystemAccentColor: () => call('getSystemAccentColor'),
    onSystemAccentChanged: (callback) => subscribe('systemAccentChanged', callback),
    onMediaResponse: (callback) => subscribe('mediaResponse', callback),
    readSettings: () => call('readSettings'),
    saveSettings: (patch) => call('saveSettings', patch),
    chooseFolder: (kind, defaultPath = '') => call('chooseFolder', kind, defaultPath),
    scanFolder: (folder, kind) => call('scanFolder', folder, kind),
    refreshFolder: (folder, kind) => call('refreshFolder', folder, kind),
    chooseFiles: (kind) => call('chooseFiles', kind),
    onOpenMedia: (callback) => subscribe('openMedia', callback),
    getOpenTvCatalog: (force = false) => call('getOpenTvCatalog', force),
    getExternalStorages: () => call('getExternalStorages'),
    rescanExternalStorages: () => call('rescanExternalStorages'),
    getMediaArtwork: (filePath, kind, refreshLocal, refreshSidecar) => call('getMediaArtwork', filePath, kind, Boolean(refreshLocal), Boolean(refreshSidecar)),
    searchArtwork: (item) => call('searchArtwork', item),
    onExternalStorages: (callback) => subscribe('externalStorages', callback),
    onDiscoveredMedia: (callback) => subscribe('discoveredMedia', callback),
    clearApplicationCaches: () => call('clearApplicationCaches'),
    fileUrl: (filePath) => call('fileUrl', filePath),
    getDroppedFilePath: () => '',
    proxyUrl,
    openSoundSettings: () => call('openSoundSettings'),
    windowAction: (action) => call('windowAction', action),
    rendererReady: () => webview.postMessage({ type: 'rendererReady' }),
    setMusicPresentationMode: (enabled) => call('setMusicPresentationMode', Boolean(enabled)),
    isMaximized: () => call('isMaximized'),
    onWindowState: (callback) => subscribe('windowState', (state) => callback(Boolean(state?.maximized), Boolean(state?.squareCorners ?? state?.maximized))),
    getWindowAppearance: () => call('getWindowAppearance'),
    setWindowMaterial: (mode) => call('setWindowMaterial', mode)
  });

  // WebView2 is an HWND child that covers the WPF client area, so WindowChrome's
  // native resize-border hit testing cannot see clicks along the edges. Forward
  // pointer hits in a small edge band to Windows as native resize hit tests.
  const resizeBand = 8;
  function resizeEdgeAt(x, y) {
    if (document.body.classList.contains('window-maximized') || document.body.classList.contains('media-player-fullscreen')) return '';
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    if (!width || !height) return '';
    const left = x <= resizeBand;
    const right = x >= width - resizeBand;
    const top = y <= resizeBand;
    const bottom = y >= height - resizeBand;
    if (top && left) return 'top-left';
    if (top && right) return 'top-right';
    if (bottom && left) return 'bottom-left';
    if (bottom && right) return 'bottom-right';
    if (left) return 'left';
    if (right) return 'right';
    if (top) return 'top';
    if (bottom) return 'bottom';
    return '';
  }

  function resizeCursorFor(edge) {
    if (!edge) return '';
    if (edge === 'left' || edge === 'right') return 'ew';
    if (edge === 'top' || edge === 'bottom') return 'ns';
    return edge === 'top-left' || edge === 'bottom-right' ? 'nwse' : 'nesw';
  }

  document.addEventListener('pointermove', (event) => {
    const edge = event.pointerType === 'mouse' ? resizeEdgeAt(event.clientX, event.clientY) : '';
    const cursor = resizeCursorFor(edge);
    if (cursor) document.documentElement.dataset.nativeResizeEdge = cursor;
    else delete document.documentElement.dataset.nativeResizeEdge;
  }, { capture: true, passive: true });
  window.addEventListener('blur', () => { delete document.documentElement.dataset.nativeResizeEdge; });

  // Forward a titlebar pointer-down so Windows performs the real caption drag.
  // In windowed Music presentation, empty player-bar space doubles as a draggable caption.
  // Resolve edge hits first, keeping corner drags mapped to the matching resize mode.
  document.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    if (event.pointerType === 'mouse') {
      const edge = resizeEdgeAt(event.clientX, event.clientY);
      if (edge) {
        event.preventDefault();
        event.stopImmediatePropagation();
        webview.postMessage({ type: 'resize', edge });
        return;
      }
    }
    const target = event.target;
    const titlebar = target && target.closest && target.closest('.titlebar');
    const presentationBar = document.body.classList.contains('music-presentation') &&
      target && target.closest && target.closest('.player-bar');
    if (!titlebar && !presentationBar) return;
    if (target.closest && target.closest('.window-action')) return;
    if (presentationBar && !titlebar && target.closest &&
        target.closest('button, input, select, textarea, a, [role="button"], [role="slider"], [contenteditable="true"]')) return;
    webview.postMessage({ type: 'drag' });
  }, true);

  // Keep media CORS-enabled so the Web Audio graph (EQ, reverb and visualizer)
  // can analyze local files served through the native media endpoint.
  document.addEventListener('DOMContentLoaded', () => {
    for (const media of document.querySelectorAll('audio, video')) media.crossOrigin = 'anonymous';
  }, { once: true });
})();
