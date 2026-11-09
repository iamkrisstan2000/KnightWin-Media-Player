(() => {
  'use strict';

  const bridge = window.revibe || {};
  if (bridge.isDesktop) document.body.classList.add('desktop-window');
  const AUDIO_EXT = new Set(['mp3','m4a','aac','wav','flac','ogg','oga','opus','wma','aiff','aif','ape','alac']);
  const VIDEO_EXT = new Set(['mp4','m4v','mkv','webm','mov','avi','wmv','mpeg','mpg','3gp','ts','m2ts']);
  const STORE_KEY = 'revibe.media-state.v1';
  const SETTINGS_KEY = 'revibe.preferences.v1';
  const CROSSFADE_STEPS = Object.freeze([0.5, 0.8, 1, 1.5, 1.8, 2]);
  function normalizeCrossfadeSeconds(value, fallback = 1.5) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds)) return fallback;
    return CROSSFADE_STEPS.reduce((nearest, step) => Math.abs(step - seconds) < Math.abs(nearest - seconds) ? step : nearest, CROSSFADE_STEPS[0]);
  }

  const EQ_PRESETS = Object.freeze({
    balanced: { label: 'Balanced', gains: [0, 0, 0, 0, 0] },
    bass: { label: 'Bass boost', gains: [5, 3, 0, 1, 2] },
    rock: { label: 'Rock', gains: [4, 2, -1, 2, 4] },
    pop: { label: 'Pop', gains: [-1, 2, 3, 2, -1] },
    vocal: { label: 'Vocal clarity', gains: [-2, 0, 4, 3, 1] },
    jazz: { label: 'Jazz', gains: [3, 2, -1, 2, 3] },
    classical: { label: 'Classical', gains: [0, 1, 0, 3, 4] },
    electronic: { label: 'Electronic', gains: [4, 1, 0, 2, 4] },
    acoustic: { label: 'Acoustic', gains: [2, 1, 2, 3, 2] }
  });
  const ICONS = {
    menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
    eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/>',
    'eye-off': '<path d="M3 3 21 21M10.6 6.2A10.8 10.8 0 0 1 12 6c6.4 0 10 6 10 6a16.1 16.1 0 0 1-3 3.5M6.2 6.8C3.5 8.5 2 12 2 12s3.6 6 10 6c1 0 2-.2 2.8-.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    home: '<path d="m3 10 9-7 9 7"/><path d="M5.5 9.5v10h13v-10M9 19.5v-6h6v6"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
    tv: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 3 4 3 4-3M8 16h8"/>',
    devices: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4M7 8h10"/>',
    settings: '<path d="M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.4 7.4 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.87 2h-3.74a.5.5 0 0 0-.5.42l-.36 2.54a7.4 7.4 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.61.22L2.72 8.48a.5.5 0 0 0 .12.64l2.03 1.58a6.8 6.8 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .61.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.74a.5.5 0 0 0 .5-.42l.36-2.54c.58-.22 1.13-.54 1.63-.94l2.39.96a.5.5 0 0 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64z"/><circle cx="12" cy="12" r="3"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.2 4.2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    broadcast: '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9.2 9.2 0 0 0 0 13M18.5 5.5a9.2 9.2 0 0 1 0 13"/>',
    sparkles: '<path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14ZM5 3l.7 2L8 6l-2.3.7L5 9l-.7-2.3L2 6l2.3-1L5 3Z"/>',
    'arrow-right': '<path d="M4 12h15M13 6l6 6-6 6"/>',
    'panel-right': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M18 9v6"/>',
    folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z"/><path d="M3.5 10h17"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="M8 5.8c0-.8.9-1.3 1.6-.8l9.2 5.8c.6.4.6 1.3 0 1.7l-9.2 5.8c-.7.5-1.6 0-1.6-.8V5.8Z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5h3v14H8zM15 5h3v14h-3z" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/>',
    previous: '<path d="M6 5v14M19 6 9 12l10 6V6Z" fill="currentColor" stroke="none"/>',
    next: '<path d="M18 5v14M5 6l10 6-10 6V6Z" fill="currentColor" stroke="none"/>',
    shuffle: '<path d="M3 17h2.5c2.1 0 3.2-.6 4.4-2.2l4.2-5.6C15.3 7.6 16.4 7 18.5 7H21"/><path d="m18 4 3 3-3 3"/><path d="M3 7h2.5c2.1 0 3.2.6 4.4 2.2l4.2 5.6c1.2 1.6 2.3 2.2 4.4 2.2H21"/><path d="m18 14 3 3-3 3"/>',
    sort: '<path d="M4 6h11M4 11h8M4 16h5"/><path d="M19 3v18m0 0 3-3m-3 3-3-3"/>',
    repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
    volume: '<path d="M4 10v4h3l5 4V6l-5 4H4Z"/><path d="M16 9a5 5 0 0 1 0 6M18.5 6.5a9 9 0 0 1 0 11"/>',
    mute: '<path d="M4 10v4h3l5 4V6l-5 4H4Z"/><path d="m17 9 5 6m0-6-5 6"/>',
    fullscreen: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
    'fullscreen-exit': '<path d="M8 3v5H3M16 3v5h5M3 16h5v5M21 16h-5v5"/>',
    heart: '<path d="M20.8 8.8c0 5.3-8.8 10.2-8.8 10.2S3.2 14.1 3.2 8.8A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.8-2L20 12M4 12l2.6 5a7 7 0 0 0 11.8-2"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/>',
    broom: '<path d="m18.5 3.5 2 2M19.5 4.5l-8.7 8.7"/><path d="m8.8 11.8 4.1 4.1"/><path d="m10 14-5.8 5.8a1.5 1.5 0 0 0 0 2.1l.5.5a1.5 1.5 0 0 0 2.1 0l5.8-5.8"/><path d="m5.2 18.7 3.5 3.5m-1.3-5.5 3.5 3.5m-1.3-5.5 3.2 3.2"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    alert: '<path d="M12 3 2.7 19h18.6L12 3Z"/><path d="M12 9v4m0 3h.01"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
    headphones: '<path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13h3v6H5a1 1 0 0 1-1-1v-5Zm16 0h-3v6h2a1 1 0 0 0 1-1v-5Z"/>',
    monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    moon: '<path d="M20.5 14.2A8.4 8.4 0 0 1 9.8 3.5 8.6 8.6 0 1 0 20.5 14.2Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    musicNote: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    spinner: '<path d="M12 3a9 9 0 1 0 9 9"/>'
  };

  const icon = (name) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`;
  const icons = (root = document) => root.querySelectorAll('.icon-slot[data-icon]').forEach((node) => { node.innerHTML = icon(node.dataset.icon); });
  const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const byId = (id) => document.getElementById(id);
  const safeStorageRead = (key, fallback) => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
  const safeStorageWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Browser preview may use an opaque origin or hit quota. */ } };
  const mediaId = (item) => item?.id || `${item?.type || 'media'}:${item?.path || item?.url || item?.title || Math.random().toString(36).slice(2)}`;
  const typeIcon = (type) => type === 'video' ? 'video' : type === 'tv' ? 'tv' : 'music';
  const typeLabel = (type) => type === 'tv' ? 'TV stream' : type === 'video' ? 'Video' : 'Music';
  const titleFor = (item) => item?.title || item?.name || 'Untitled';
  const SORT_OPTIONS = Object.freeze({
    music: ['default', 'recentPlayed', 'recentAdded', 'artists', 'album', 'alphabetical', 'year'],
    video: ['default', 'recentPlayed', 'recentAdded', 'alphabetical', 'year'],
    tv: ['default', 'recentPlayed', 'recentAdded', 'alphabetical']
  });
  const normalizeSortMode = (kind, value) => SORT_OPTIONS[kind]?.includes(value) ? value : 'default';
  const SORT_DEFAULT_DIRECTIONS = Object.freeze({
    music: { default: 'asc', recentPlayed: 'desc', recentAdded: 'desc', artists: 'asc', album: 'asc', alphabetical: 'asc', year: 'desc' },
    video: { default: 'asc', recentPlayed: 'desc', recentAdded: 'desc', alphabetical: 'asc', year: 'desc' },
    tv: { default: 'asc', recentPlayed: 'desc', recentAdded: 'desc', alphabetical: 'asc' }
  });
  const defaultSortDirection = (kind, mode) => SORT_DEFAULT_DIRECTIONS[kind]?.[mode] || 'asc';
  const normalizeSortDirection = (kind, mode, value) => value === 'asc' || value === 'desc' ? value : defaultSortDirection(kind, mode);
  const SORT_LABELS = Object.freeze({
    music: { default: 'Manual order', recentPlayed: 'Recently Played', recentAdded: 'Recently Added', artists: 'Artists', album: 'Album', alphabetical: 'Alphabetical', year: 'Year' },
    video: { default: 'Manual order', recentPlayed: 'Recently Played', recentAdded: 'Recently Added', alphabetical: 'Alphabetical', year: 'Year' },
    tv: { default: 'Guide order', recentPlayed: 'Recently Played', recentAdded: 'Recently Added', alphabetical: 'Alphabetical' }
  });

  const blankState = {
    musicQueue: [], videoQueue: [], recentPlayed: [], newlyAdded: [],
    library: { music: [], video: [] }, knownMedia: { music: [], video: [] },
    tvSnapshot: {}, tvUpdates: [], favorites: [], volume: 0.72, shuffle: false, sortModes: {}, lastPage: 'home'
  };
  const savedState = safeStorageRead(STORE_KEY, {});
  const state = Object.assign({}, blankState, savedState && typeof savedState === 'object' ? savedState : {});
  state.library = Object.assign({ music: [], video: [] }, state.library || {});
  state.knownMedia = Object.assign({ music: [], video: [] }, state.knownMedia || {});
  state.musicQueue = Array.isArray(state.musicQueue) ? state.musicQueue : [];
  state.videoQueue = Array.isArray(state.videoQueue) ? state.videoQueue : [];
  state.recentPlayed = Array.isArray(state.recentPlayed) ? state.recentPlayed : [];
  state.newlyAdded = Array.isArray(state.newlyAdded) ? state.newlyAdded : [];
  state.tvSnapshot = state.tvSnapshot && typeof state.tvSnapshot === 'object' ? state.tvSnapshot : {};
  state.tvUpdates = Array.isArray(state.tvUpdates) ? state.tvUpdates : [];
  state.favorites = Array.isArray(state.favorites) ? state.favorites : [];
  state.sortModes = Object.assign({ music: 'default', video: 'default', tv: 'default' }, state.sortModes || {});
  state.sortDirections = Object.assign({}, state.sortDirections || {});
  for (const kind of Object.keys(SORT_OPTIONS)) {
    state.sortModes[kind] = normalizeSortMode(kind, state.sortModes[kind]);
    state.sortDirections[kind] = normalizeSortDirection(kind, state.sortModes[kind], state.sortDirections[kind]);
  }

  let settings = Object.assign({ theme: 'system', accent: 'matcha', lastCustomAccent: 'matcha', visualizerIntensity: 70, defaultMusicFolder: '', defaultVideoFolder: '', mediaDiscoveryEnabled: false, externalStorageEnabledIds: {}, automaticArtworkFetch: true, visualizerStyle: 'waves', lowGraphicsMode: false, equalizerEnabled: false, equalizerPreset: 'balanced', crossfadeEnabled: false, crossfadeSeconds: 1.5, reverbEnabled: false, reverbAmount: 24 }, safeStorageRead(SETTINGS_KEY, {}));
  settings.crossfadeSeconds = normalizeCrossfadeSeconds(settings.crossfadeSeconds);
  let currentPage = 'home';
  let activeSettingsSection = state.lastPage === 'devices' ? 'media' : 'appearance';
  let lastHomeRecommendationIds = { music: [], video: [], tv: [] };
  let currentItem = null;
  let isPlaying = false;
  const mediaResponseDiagnostics = new Map();
  let lastPlaybackFailureKey = '';
  let lastPlaybackFailureAt = 0;
  let isShuffle = Boolean(state.shuffle);
  let repeatMode = 'off';
  let muted = false;
  let tvChannels = [];
  let tvFetchInfo = { fetchedAt: 0, stale: false, error: '' };
  let tvCatalogLoading = false;
  let tvCatalogLoaded = false;
  let itemLookup = new Map();
  const artworkMediaIndex = new Map();
  let stageListsInitialized = false;
  let lastStageSelectionKey = '';
  let lastStageItemType = '';
  let lastStagePlaying = false;
  let fallbackPickKind = 'music';
  let fallbackPickPurpose = 'queue';
  const normalizePage = (page) => page === 'devices' ? 'settings' : (['home', 'music', 'video', 'tv', 'settings'].includes(page) ? page : 'home');
  let audioContext = null;
  let analyser = null;
  let analyserBuffer = null;
  let audioSources = new Map();
  let musicDeckGainNodes = [];
  let equalizerFilters = [];
  let reverbConvolver = null;
  let reverbDryGain = null;
  let reverbWetGain = null;
  let reverbReleaseTimer = 0;
  let musicTransition = null;
  let activeMusicDeckIndex = 0;
  let musicDeckLevels = [1, 0];
  let tvHls = null;
  let tvStartSequence = 0;
  let hlsLibraryPromise = null;
  let hlsFailReported = false;
  let dragCounter = 0;
  let settingsSaveTimer = 0;
  let visualizerFrameRequest = 0;
  let visualizerTimer = 0;
  let visualizerResizeObserver = null;
  let visualizerLastErrorAt = 0;
  let previousVizBass = 0;
  let smoothVizBass = 0;
  let smoothVizMids = 0;
  let smoothVizAverage = 0;
  let smoothVizOnset = 0;
  let previousVizTime = 0;
  let cdRotation = 0;
  let cdLastFrameTime = 0;
  let cdPlaybackBlend = 0;
  let cdSmoothedPulse = 0;
  let cdSmoothedKick = 0;
  let cdSmoothedSpinSpeed = .32;
  let cdCoverUrl = '';
  let cdCoverImage = null;
  let playerOverlayHideTimer = 0;
  let externalStorages = [];
  let externalStorageLoaded = false;
  let externalStoragePending = false;
  let externalStorageError = '';
  let appPlatform = '';
  let artworkObserver = null;
  const artworkRequests = new Set();
  const artworkRequestPromises = new Map();
  const automaticArtworkQueue = [];
  const automaticArtworkQueued = new Set();
  let automaticArtworkWorkers = 0;
  let automaticArtworkPaused = false;
  let artworkRefreshInProgress = false;
  let artworkOperation = '';
  let artworkRefreshStatus = 'Artwork will be checked when media is added or displayed.';
  const failedArtworkItems = new Set();
  const observedArtworkNodes = new WeakSet();
  const artworkObserverTargets = new WeakSet();
  const localArtworkScanned = new Map();
  const localArtworkQueued = new Set();
  const localArtworkQueue = [];
  let localArtworkWorkers = 0;
  let localArtworkBatchPending = false;
  let artworkCachePersistTimer = 0;
  let artworkStatePersistTimer = 0;
  const MAX_ITEM_LOOKUP_ENTRIES = 12000;
  const MAX_ARTWORK_SEARCH_CACHE_ENTRIES = 1200;
  const MAX_LOCAL_ARTWORK_SCANNED = 12000;
  const MAX_LOCAL_ARTWORK_WORKERS = 3;
  const MAX_AUTOMATIC_ARTWORK_WORKERS = 3;
  let artworkSearchCache = safeStorageRead('revibe.artwork-cache.v1', {});
  if (!artworkSearchCache || typeof artworkSearchCache !== 'object' || Array.isArray(artworkSearchCache)) artworkSearchCache = {};
  const cachedArtworkIds = Object.keys(artworkSearchCache);
  if (cachedArtworkIds.length > MAX_ARTWORK_SEARCH_CACHE_ENTRIES) {
    for (const id of cachedArtworkIds.slice(0, cachedArtworkIds.length - MAX_ARTWORK_SEARCH_CACHE_ENTRIES)) delete artworkSearchCache[id];
    safeStorageWrite('revibe.artwork-cache.v1', artworkSearchCache);
  }

  const audio = byId('audioPlayer');
  const audioSecondary = byId('audioPlayerSecondary');
  const musicDecks = [audio, audioSecondary].filter(Boolean);
  const video = byId('videoPlayer');
  const tvVideo = byId('tvPlayer');
  const mediaEls = [...musicDecks, video, tvVideo].filter(Boolean);
  for (const media of mediaEls) media.crossOrigin = 'anonymous';

  function persistedItem(item) {
    if (!item || typeof item !== 'object') return item;
    const value = { ...item };
    if (typeof value.url === 'string' && value.url.startsWith('blob:')) value.url = '';
    if (Array.isArray(value.streams)) value.streams = value.streams.slice(0, 2);
    return value;
  }

  function persistState() {
    const payload = {
      musicQueue: state.musicQueue.slice(-5000).map(persistedItem),
      videoQueue: state.videoQueue.slice(-5000).map(persistedItem),
      recentPlayed: state.recentPlayed.slice(0, 8).map(persistedItem),
      newlyAdded: state.newlyAdded.slice(0, 12).map(persistedItem),
      library: {
        music: (state.library.music || []).slice(0, 400).map(persistedItem),
        video: (state.library.video || []).slice(0, 400).map(persistedItem)
      },
      knownMedia: { music: (state.knownMedia.music || []).slice(-5000), video: (state.knownMedia.video || []).slice(-5000) },
      tvSnapshot: Object.fromEntries(Object.entries(state.tvSnapshot || {}).slice(-500)),
      tvUpdates: (state.tvUpdates || []).slice(0, 6).map(persistedItem),
      favorites: (state.favorites || []).slice(0, 1000),
      sortModes: { music: state.sortModes.music, video: state.sortModes.video, tv: state.sortModes.tv },
      sortDirections: { music: state.sortDirections.music, video: state.sortDirections.video, tv: state.sortDirections.tv },
      volume: Number.isFinite(state.volume) ? state.volume : 0.72,
      shuffle: Boolean(isShuffle),
      currentItem: currentItem ? persistedItem(currentItem) : null,
      lastPage: currentPage
    };
    safeStorageWrite(STORE_KEY, payload);
  }

  function persistSettings() {
    safeStorageWrite(SETTINGS_KEY, settings);
    if (bridge.saveSettings) {
      window.clearTimeout(settingsSaveTimer);
      settingsSaveTimer = window.setTimeout(() => bridge.saveSettings(settings).catch(() => {}), 250);
    }
  }

  function shadeHex(hex, factor = -0.18) {
    const clean = String(hex).replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(clean)) return '#737b88';
    const values = [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
    const adjusted = values.map((value) => Math.max(0, Math.min(255, Math.round(factor < 0 ? value * (1 + factor) : value + (255 - value) * factor))));
    return `#${adjusted.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  }

  function parseSystemAccent(value) {
    const text = String(value ?? '').trim();
    const hexMatch = text.match(/^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
    if (hexMatch) return [0, 2, 4].map((offset) => parseInt(hexMatch[1].slice(offset, offset + 2), 16));
    const rgbMatch = text.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    return rgbMatch ? rgbMatch.slice(1, 4).map((part) => Math.max(0, Math.min(255, Number(part)))) : null;
  }

  function applySystemAccentColor(value) {
    const rgb = parseSystemAccent(value);
    if (!rgb) return false;
    const hex = `#${rgb.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
    document.body.style.setProperty('--system-accent', hex);
    if (settings.accent !== 'system') return true;
    document.body.style.setProperty('--accent', hex);
    document.body.style.setProperty('--accent-strong', shadeHex(hex, -0.19));
    document.body.style.setProperty('--accent-rgb', rgb.join(', '));
    drawVisualizerSafely();
    return true;
  }

  async function syncSystemAccent() {
    if (bridge.getSystemAccentColor) {
      try {
        const nativeAccent = await bridge.getSystemAccentColor();
        if (applySystemAccentColor(nativeAccent)) return;
      } catch { /* try the platform's CSS system-color fallback below */ }
    }
    // The browser preview cannot read the host registry; use its AccentColor keyword there.
    if (bridge.isDesktop) return;
    try {
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;color:AccentColor';
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      applySystemAccentColor(color);
    } catch { /* browser does not expose AccentColor; keep the built-in fallback */ }
  }

  function resolveMode() {
    if (settings.theme === 'dark' || settings.theme === 'light') return settings.theme;
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
  }

  function syncVisualizerStyleControl() {
    const styles = ['waves', 'topographic', 'minimal', 'cd'];
    const presentationMode = document.body.classList.contains('music-presentation');
    const style = presentationMode ? 'cd' : styles.includes(settings.visualizerStyle) ? settings.visualizerStyle : 'waves';
    if (!presentationMode) settings.visualizerStyle = style;
    const names = { waves: 'Waves', topographic: 'Topographic lines', minimal: 'Minimal Viz', cd: 'CD' };
    const glyphs = { waves: '〰', topographic: '◎', minimal: '▥', cd: '◉' };
    const nextName = names[styles[(styles.indexOf(style) + 1) % styles.length]];
    const button = byId('visualizerStyleToggle');
    const label = byId('visualizerStyleLabel');
    const glyph = byId('visualizerStyleIcon');
    if (label) label.textContent = names[style];
    if (glyph) glyph.textContent = glyphs[style];
    if (button) {
      button.disabled = presentationMode;
      button.setAttribute('aria-label', presentationMode ? 'CD presentation mode' : `Switch to ${nextName}`);
      button.title = presentationMode ? 'CD presentation mode' : `Switch visualizer to ${nextName}`;
    }
    const wrap = byId('visualizerWrap');
    if (wrap) wrap.dataset.visualizerStyle = style;
    const canvas = byId('visualizer');
    if (canvas) canvas.setAttribute('aria-label', `${names[style]} audio visualization`);
  }

  function toggleVisualizerStyle() {
    if (document.body.classList.contains('music-presentation')) return;
    const styles = ['waves', 'topographic', 'minimal', 'cd'];
    const current = styles.includes(settings.visualizerStyle) ? settings.visualizerStyle : 'waves';
    settings.visualizerStyle = styles[(styles.indexOf(current) + 1) % styles.length];
    persistSettings();
    syncVisualizerStyleControl();
    if (currentPage === 'music') startVisualizerLoop();
    drawVisualizerSafely();
  }

  function syncRangeProgress(input) {
    if (!input) return;
    const min = Number.isFinite(Number(input.min)) ? Number(input.min) : 0;
    const max = Number.isFinite(Number(input.max)) ? Number(input.max) : 100;
    const value = Number.isFinite(Number(input.value)) ? Number(input.value) : min;
    const percent = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
    input.style.setProperty('--range-progress', `${percent}%`);
  }

  function syncAudioSettingsControls() {
    const controls = [
      ['lowGraphicsMode', Boolean(settings.lowGraphicsMode)],
      ['equalizerEnabled', Boolean(settings.equalizerEnabled)],
      ['crossfadeEnabled', Boolean(settings.crossfadeEnabled)],
      ['reverbEnabled', Boolean(settings.reverbEnabled)]
    ];
    for (const [id, enabled] of controls) {
      const input = byId(id);
      if (!input) continue;
      input.checked = enabled;
      const stateLabel = input.parentElement?.querySelector('.setting-switch-state');
      if (stateLabel) stateLabel.textContent = enabled ? 'On' : 'Off';
    }
    const preset = byId('equalizerPreset');
    if (preset) { preset.value = settings.equalizerPreset || 'balanced'; preset.disabled = !settings.equalizerEnabled; }
    settings.crossfadeSeconds = normalizeCrossfadeSeconds(settings.crossfadeSeconds);
    const crossfade = byId('crossfadeSeconds');
    const crossfadeValue = byId('crossfadeSecondsValue');
    if (crossfade) { crossfade.value = String(settings.crossfadeSeconds); crossfade.disabled = !settings.crossfadeEnabled; }
    if (crossfadeValue) crossfadeValue.textContent = `${settings.crossfadeSeconds}s`;
    const reverb = byId('reverbAmount');
    const reverbValue = byId('reverbAmountValue');
    if (reverb) { reverb.value = String(settings.reverbAmount); reverb.disabled = !settings.reverbEnabled; }
    if (reverbValue) reverbValue.textContent = `${settings.reverbAmount}%`;
  }

  function ensureReverbEffect() {
    if (!audioContext || !analyser || reverbConvolver) return;
    let convolver = null;
    let wetGain = null;
    try {
      convolver = audioContext.createConvolver();
      convolver.buffer = createReverbImpulse(audioContext);
      wetGain = audioContext.createGain();
      wetGain.gain.value = 0;
      analyser.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(audioContext.destination);
      reverbConvolver = convolver;
      reverbWetGain = wetGain;
    } catch {
      try { analyser.disconnect(convolver); } catch { /* graph setup may not have reached this edge */ }
      try { convolver?.disconnect(); } catch { /* ignore partial graph cleanup */ }
      try { wetGain?.disconnect(); } catch { /* ignore partial graph cleanup */ }
    }
  }

  function releaseReverbEffect() {
    if (!reverbConvolver) return;
    const convolver = reverbConvolver;
    const wetGain = reverbWetGain;
    reverbConvolver = null;
    reverbWetGain = null;
    try { analyser?.disconnect(convolver); } catch { /* retain the dry analyzer connection */ }
    try { convolver.disconnect(); } catch { /* effect is already disconnected */ }
    try { convolver.buffer = null; } catch { /* release whatever the browser allows */ }
    try { wetGain?.disconnect(); } catch { /* effect is already disconnected */ }
  }

  function applyAudioSettings() {
    if (!audioContext) return;
    const preset = EQ_PRESETS[settings.equalizerPreset] || EQ_PRESETS.balanced;
    const now = audioContext.currentTime;
    equalizerFilters.forEach((filter, index) => {
      const gain = settings.equalizerEnabled ? preset.gains[index] || 0 : 0;
      try { filter.gain.setTargetAtTime(gain, now, .035); } catch { filter.gain.value = gain; }
    });
    if (settings.reverbEnabled) {
      window.clearTimeout(reverbReleaseTimer);
      reverbReleaseTimer = 0;
      ensureReverbEffect();
    }
    if (reverbDryGain) {
      const effectReady = Boolean(settings.reverbEnabled && reverbConvolver && reverbWetGain);
      const mix = effectReady ? Math.max(0, Math.min(60, Number(settings.reverbAmount) || 0)) / 100 : 0;
      try {
        reverbDryGain.gain.setTargetAtTime(1 - mix * .22, now, .05);
        if (reverbWetGain) reverbWetGain.gain.setTargetAtTime(mix * .72, now, .05);
      } catch {
        reverbDryGain.gain.value = 1 - mix * .22;
        if (reverbWetGain) reverbWetGain.gain.value = mix * .72;
      }
      if (!settings.reverbEnabled && reverbConvolver && !reverbReleaseTimer) {
        reverbReleaseTimer = window.setTimeout(() => {
          reverbReleaseTimer = 0;
          if (!settings.reverbEnabled) releaseReverbEffect();
        }, 300);
      }
    }
  }

  function applySettings() {
    const mode = resolveMode();
    document.documentElement.dataset.revibeMode = mode;
    document.documentElement.dataset.revibeAccent = settings.accent || 'matcha';
    document.body.dataset.mode = mode;
    document.body.classList.toggle('low-graphics-mode', Boolean(settings.lowGraphicsMode));
    if (bridge.setWindowMaterial) Promise.resolve(bridge.setWindowMaterial(mode)).catch(() => {});
    document.body.dataset.accent = settings.accent || 'matcha';
    document.body.style.removeProperty('--accent');
    document.body.style.removeProperty('--accent-strong');
    document.body.style.removeProperty('--accent-rgb');
    syncSystemAccent();
    const intensity = Math.max(10, Math.min(100, Number(settings.visualizerIntensity) || 70));
    settings.visualizerIntensity = intensity;
    const label = byId('vizIntensityLabel');
    if (label) label.textContent = `ACCENT · ${settings.accent === 'rgb' ? 'RGB FLOW' : settings.accent.toUpperCase()}`;
    const slider = byId('visualizerIntensity');
    const value = byId('visualizerIntensityValue');
    if (slider) slider.value = String(intensity);
    if (value) value.textContent = `${intensity}%`;
    syncVisualizerStyleControl();
    syncAudioSettingsControls();
    applyAudioSettings();
    resizeVisualizer();
    drawVisualizerSafely();
  }

  async function syncWindowAppearance() {
    if (!bridge.getWindowAppearance) return;
    try {
      const appearance = await bridge.getWindowAppearance();
      document.body.dataset.dwmCorners = appearance?.windowCornerStyle || (appearance?.supportsRoundedCorners ? 'native-rounded' : 'square');
      document.body.dataset.dwmBackdrop = appearance?.supportsBackdropMaterial ? 'supported' : 'fallback';
      document.body.classList.toggle('window-square-corners', Boolean(appearance?.squareCorners ?? document.body.classList.contains('window-maximized')));
    } catch {
      document.body.dataset.dwmCorners = 'square';
      document.body.dataset.dwmBackdrop = 'fallback';
      document.body.classList.toggle('window-square-corners', document.body.classList.contains('window-maximized'));
    }
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const whole = Math.floor(seconds);
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const remaining = whole % 60;
    return hours ? `${hours}:${String(minutes).padStart(2,'0')}:${String(remaining).padStart(2,'0')}` : `${String(minutes).padStart(2,'0')}:${String(remaining).padStart(2,'0')}`;
  }

  function timeAgo(timestamp) {
    if (!timestamp) return 'Recently added';
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  }

  function artClass(type) { return type === 'video' ? 'art-video' : type === 'tv' ? 'art-tv' : 'art-music'; }
  function itemSubtitle(item) {
    if (item.type === 'tv') return [item.country === 'PH' ? 'Philippines' : item.country, item.category || 'Live channel'].filter(Boolean).join(' · ');
    return item.artist || item.folder || item.extension || typeLabel(item.type);
  }
  function trimItemLookup(keepId) {
    const liveIds = new Set();
    if (currentItem) liveIds.add(mediaId(currentItem));
    document.querySelectorAll('[data-item-id], [data-artwork-item-id]').forEach((node) => {
      if (node.dataset.itemId) liveIds.add(node.dataset.itemId);
      if (node.dataset.artworkItemId) liveIds.add(node.dataset.artworkItemId);
    });
    for (const id of itemLookup.keys()) {
      if (id !== keepId && !liveIds.has(id)) itemLookup.delete(id);
    }
  }

  function cacheItem(item) {
    if (!item || typeof item !== 'object') return '';
    const id = mediaId(item);
    item.id = id;
    itemLookup.set(id, item);
    if (['music', 'video', 'tv'].includes(item.type)) {
      artworkMediaIndex.delete(id);
      artworkMediaIndex.set(id, item);
      while (artworkMediaIndex.size > MAX_ITEM_LOOKUP_ENTRIES) artworkMediaIndex.delete(artworkMediaIndex.keys().next().value);
    }
    if (itemLookup.size > MAX_ITEM_LOOKUP_ENTRIES) trimItemLookup(id);
    return id;
  }

  function scheduleArtworkCachePersist() {
    if (artworkCachePersistTimer) return;
    artworkCachePersistTimer = window.setTimeout(() => {
      artworkCachePersistTimer = 0;
      safeStorageWrite('revibe.artwork-cache.v1', artworkSearchCache);
    }, 350);
  }

  function scheduleArtworkStatePersist() {
    if (artworkStatePersistTimer) return;
    artworkStatePersistTimer = window.setTimeout(() => {
      artworkStatePersistTimer = 0;
      persistState();
    }, 500);
  }

  function localArtworkStamp(item) {
    return `${Number(item?.size) || 0}:${Number(item?.modified) || 0}`;
  }

  function hasLocalArtworkScanned(item) {
    return item?._artworkLocalStamp === localArtworkStamp(item);
  }

  function wasLocalArtworkScanned(id, item) {
    return localArtworkScanned.get(id) === localArtworkStamp(item) || hasLocalArtworkScanned(item);
  }

  function markLocalArtworkScanned(id, item) {
    if (!id) return;
    const stamp = localArtworkStamp(item);
    localArtworkScanned.delete(id);
    localArtworkScanned.set(id, stamp);
    if (localArtworkScanned.size > MAX_LOCAL_ARTWORK_SCANNED) {
      localArtworkScanned.delete(localArtworkScanned.keys().next().value);
    }
    if (item && typeof item === 'object') item._artworkLocalStamp = stamp;
    if (currentItem && mediaId(currentItem) === id) currentItem._artworkLocalStamp = stamp;
  }

  function normalizeArtworkUrl(value) {
    return typeof value === 'string' && /^(https?:|file:|data:)/i.test(value) ? value : '';
  }

  function setArtworkUrlForId(id, item, url) {
    const apply = (candidate) => {
      if (!candidate || typeof candidate !== 'object') return;
      if (url) candidate.artworkUrl = url;
      else { delete candidate.artworkUrl; delete candidate._artworkLocalStamp; }
    };
    apply(item);
    const lists = [state.musicQueue, state.videoQueue, state.library?.music, state.library?.video, state.recentPlayed, state.newlyAdded];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const candidate of list) if (candidate && mediaId(candidate) === id) apply(candidate);
    }
    for (const candidate of itemLookup.values()) if (candidate && mediaId(candidate) === id) apply(candidate);
    for (const channel of tvChannels) {
      const channelId = `tv:${String(channel.id || channel.name || 'channel').replace(/^tv:/, '')}`;
      if (channelId === id) apply(channel);
    }
    for (const channel of state.tvUpdates || []) {
      const channelId = `tv:${String(channel.id || channel.name || 'channel').replace(/^tv:/, '')}`;
      if (channelId === id) apply(channel);
    }
    if (currentItem && mediaId(currentItem) === id) apply(currentItem);
  }

  function cacheArtworkResult(id, value, persist = true) {
    delete artworkSearchCache[id];
    artworkSearchCache[id] = value;
    const ids = Object.keys(artworkSearchCache);
    if (ids.length > MAX_ARTWORK_SEARCH_CACHE_ENTRIES) {
      for (const staleId of ids.slice(0, ids.length - MAX_ARTWORK_SEARCH_CACHE_ENTRIES)) delete artworkSearchCache[staleId];
    }
    if (persist) safeStorageWrite('revibe.artwork-cache.v1', artworkSearchCache);
    else scheduleArtworkCachePersist();
  }

  function artworkUrlFor(item) {
    if (!item) return '';
    const id = mediaId(item);
    const cached = artworkSearchCache[id];
    return item.artworkUrl || (typeof cached === 'string' ? cached : '') || item.logo || item.poster || '';
  }

  function artworkAttributes(item) {
    return `data-artwork-item-id="${esc(cacheItem(item))}"`;
  }

  function artworkImageMarkup(item) {
    const url = artworkUrlFor(item);
    return url ? `<img class="artwork-image" src="${esc(url)}" alt="" loading="lazy" decoding="async">` : '';
  }

  function vinylArtworkMarkup() {
    return '<span class="vinyl-art" aria-hidden="true"><span class="vinyl-record"><span class="vinyl-label"><span class="vinyl-spindle"></span></span></span></span>';
  }

  function artworkFallbackMarkup(item, style = 'icon') {
    const type = item?.type || 'music';
    if (type === 'music') return vinylArtworkMarkup();
    const symbol = icon(typeIcon(type));
    return style === 'symbol' ? `<span class="art-symbol">${symbol}</span>` : `<span class="icon-slot">${symbol}</span>`;
  }

  function attachArtworkErrorHandler(image) {
    if (!image) return;
    if (!observedArtworkNodes.has(image)) {
      observedArtworkNodes.add(image);
      image.addEventListener('load', () => {
        if (image.naturalWidth > 0) image.closest('[data-artwork-item-id]')?.classList.add('artwork-loaded');
      });
      image.addEventListener('error', () => {
        const host = image.closest('[data-artwork-item-id]');
        if (!host) { image.remove(); return; }
        const id = host.dataset.artworkItemId;
        const item = itemLookup.get(id);
        const failedUrl = image.currentSrc || image.src;
        image.remove();
        host.classList.remove('has-artwork', 'artwork-loaded');
        if (!item) return;
        if ([item.artworkUrl, item.logo, item.poster].some((url) => url === failedUrl || url === image.src)) {
          delete item.artworkUrl;
          delete item.logo;
          delete item.poster;
        }
        delete artworkSearchCache[id];
        safeStorageWrite('revibe.artwork-cache.v1', artworkSearchCache);
        if (failedArtworkItems.has(id)) return;
        failedArtworkItems.add(id);
        void requestArtwork(item, true);
      });
    }
    if (image.complete && image.naturalWidth > 0) {
      image.closest('[data-artwork-item-id]')?.classList.add('artwork-loaded');
    }
  }

  function updateArtworkNodes(id, item, url) {
    document.querySelectorAll('[data-artwork-item-id]').forEach((host) => {
      if (host.dataset.artworkItemId !== id) return;
      host.classList.toggle('has-artwork', Boolean(url));
      host.classList.remove('artwork-loaded');
      let image = host.querySelector(':scope > img.artwork-image, :scope > .player-art-label > img.artwork-image, :scope > .player-tv-screen > img.artwork-image');
      if (!url) { image?.remove(); return; }
      if (!image) {
        image = document.createElement('img');
        image.className = 'artwork-image';
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
      }
      const playerArtworkSlot = host.querySelector(':scope > .player-art-label, :scope > .player-tv-screen');
      (playerArtworkSlot || host).prepend(image);
      attachArtworkErrorHandler(image);
      if (image.src !== url) image.src = url;
      if (image.complete && image.naturalWidth > 0) host.classList.add('artwork-loaded');
    });
    if (currentItem && mediaId(currentItem) === id) {
      if (item.type === 'video' && video) video.poster = url || '';
      if (item.type === 'tv' && tvVideo) tvVideo.poster = url || '';
    }
  }

  function requestArtwork(item, forceSearch = false, refreshLocal = false, refreshSidecarIndex = false) {
    if (!item || typeof item !== 'object') return Promise.resolve('');
    if (artworkRefreshInProgress && !forceSearch && !refreshLocal) return Promise.resolve('');
    const id = mediaId(item);
    const activeRequest = artworkRequestPromises.get(id);
    if (activeRequest) return activeRequest;
    if (!forceSearch && !refreshLocal && artworkUrlFor(item)) return Promise.resolve('');
    if (!forceSearch && !refreshLocal && Object.prototype.hasOwnProperty.call(artworkSearchCache, id) && artworkSearchCache[id] === false) return Promise.resolve('');
    if (!bridge.getMediaArtwork && !bridge.searchArtwork) return Promise.resolve('');

    const allowOnlineSearch = forceSearch || refreshLocal || settings.automaticArtworkFetch === true;
    artworkRequests.add(id);
    const task = (async () => {
      try {
        let url = '';
        if (!forceSearch && item.path && bridge.getMediaArtwork && (refreshLocal || !wasLocalArtworkScanned(id, item))) {
          if (refreshLocal) {
            localArtworkScanned.delete(id);
            delete item._artworkLocalStamp;
          }
          markLocalArtworkScanned(id, item);
          url = await bridge.getMediaArtwork(item.path, item.type, refreshLocal, refreshSidecarIndex);
          scheduleArtworkStatePersist();
        }
        if (!url && allowOnlineSearch && bridge.searchArtwork) url = await bridge.searchArtwork({
          type: item.type, title: titleFor(item), name: item.name || '', artist: item.artist || '', country: item.country || '', site: item.site || ''
        });
        url = normalizeArtworkUrl(url);
        if (url) {
          cacheArtworkResult(id, url, false);
          setArtworkUrlForId(id, item, url);
          updateArtworkNodes(id, item, url);
          scheduleArtworkStatePersist();
        } else if (allowOnlineSearch && !artworkUrlFor(item)) {
          cacheArtworkResult(id, false, false);
        }
        return url;
      } catch {
        if (allowOnlineSearch && !artworkUrlFor(item)) cacheArtworkResult(id, false, false);
        return '';
      }
    })();
    let tracked;
    tracked = task.finally(() => {
      artworkRequests.delete(id);
      if (artworkRequestPromises.get(id) === tracked) artworkRequestPromises.delete(id);
    });
    artworkRequestPromises.set(id, tracked);
    return tracked;
  }

  function scheduleLocalArtworkPrefetch(items) {
    if (!bridge.getMediaArtwork || !Array.isArray(items)) return;
    let added = false;
    for (const item of items) {
      if (item?.type !== 'music' || typeof item.path !== 'string' || !item.path) continue;
      const id = mediaId(item);
      if (wasLocalArtworkScanned(id, item) || localArtworkQueued.has(id) || artworkRequests.has(id)) continue;
      localArtworkQueued.add(id);
      localArtworkQueue.push({ id, item });
      added = true;
    }
    if (added) localArtworkBatchPending = true;
    drainLocalArtworkQueue();
  }

  function drainLocalArtworkQueue() {
    while (localArtworkWorkers < MAX_LOCAL_ARTWORK_WORKERS && localArtworkQueue.length) {
      const { id, item } = localArtworkQueue.shift();
      localArtworkQueued.delete(id);
      if (!item || wasLocalArtworkScanned(id, item) || artworkRequests.has(id)) continue;
      markLocalArtworkScanned(id, item);
      artworkRequests.add(id);
      localArtworkWorkers += 1;
      void (async () => {
        try {
          const url = normalizeArtworkUrl(await bridge.getMediaArtwork(item.path, 'music'));
          if (url) {
            setArtworkUrlForId(id, item, url);
            cacheArtworkResult(id, url, false);
            updateArtworkNodes(id, item, url);
          }
        } catch { /* Keep the Fluent vinyl fallback if a local file cannot be read. */ }
        finally {
          scheduleArtworkStatePersist();
          artworkRequests.delete(id);
          localArtworkWorkers -= 1;
          if (settings.automaticArtworkFetch === true) scheduleAutomaticArtworkFetch([item]);
          drainLocalArtworkQueue();
        }
      })();
    }
    if (!localArtworkQueue.length && !localArtworkWorkers && localArtworkBatchPending) {
      localArtworkBatchPending = false;
      watchArtwork();
    }
  }

  function scheduleAutomaticArtworkFetch(items) {
    if (settings.automaticArtworkFetch !== true || !Array.isArray(items)) return 0;
    let queued = 0;
    for (const item of items) {
      if (!item || !['music', 'video', 'tv'].includes(item.type)) continue;
      const id = cacheItem(item);
      if (!id || artworkUrlFor(item) || Object.prototype.hasOwnProperty.call(artworkSearchCache, id) ||
          automaticArtworkQueued.has(id) || artworkRequests.has(id)) continue;
      automaticArtworkQueued.add(id);
      automaticArtworkQueue.push({ id, item });
      queued += 1;
    }
    drainAutomaticArtworkQueue();
    return queued;
  }

  function drainAutomaticArtworkQueue() {
    if (automaticArtworkPaused || settings.automaticArtworkFetch !== true) return;
    while (automaticArtworkWorkers < MAX_AUTOMATIC_ARTWORK_WORKERS && automaticArtworkQueue.length) {
      const job = automaticArtworkQueue.shift();
      automaticArtworkQueued.delete(job.id);
      if (!job.item || artworkUrlFor(job.item) || Object.prototype.hasOwnProperty.call(artworkSearchCache, job.id)) continue;
      automaticArtworkWorkers += 1;
      void requestArtwork(job.item).finally(() => {
        automaticArtworkWorkers -= 1;
        drainAutomaticArtworkQueue();
      });
    }
  }

  function collectAllMediaForArtwork(extraItems = []) {
    const sources = [
      ...(state.musicQueue || []), ...(state.videoQueue || []),
      ...(state.library?.music || []), ...(state.library?.video || []),
      ...(state.recentPlayed || []), ...(state.newlyAdded || []),
      ...(currentItem ? [currentItem] : []),
      ...tvChannels.map(channelToItem),
      ...(state.tvUpdates || []).map(channelToItem),
      ...(artworkMediaIndex.values()),
      ...(Array.isArray(extraItems) ? extraItems : [])
    ];
    const unique = new Map();
    for (const item of sources) {
      if (!item || !['music', 'video', 'tv'].includes(item.type)) continue;
      const id = mediaId(item);
      const existing = unique.get(id);
      if (!existing) unique.set(id, item);
      else {
        for (const field of ['path', 'url', 'folder', 'album', 'year', 'addedAt', 'playedAt', 'modified', 'country', 'site', 'logo', 'poster', 'artworkUrl', 'streams']) {
          const value = item[field];
          const missing = existing[field] === undefined || existing[field] === null || existing[field] === '' || existing[field] === 0;
          if (missing && value !== undefined && value !== null && value !== '') existing[field] = value;
        }
        if ((!existing.artist || existing.artist === 'Local library' || existing.artist === 'Unknown Artist' || (item.folder && existing.artist === item.folder)) && item.artist) existing.artist = item.artist;
        if (item.album && item.folder && existing.album === item.folder) existing.album = item.album;
      }
    }
    const items = [...unique.values()];
    for (const item of items) cacheItem(item);
    return items;
  }

  function clearNegativeArtworkResults(items) {
    let changed = false;
    for (const item of items) {
      const id = mediaId(item);
      if (artworkSearchCache[id] === false) { delete artworkSearchCache[id]; changed = true; }
    }
    if (changed) safeStorageWrite('revibe.artwork-cache.v1', artworkSearchCache);
  }

  function setArtworkRefreshStatus(message) {
    artworkRefreshStatus = message;
    const status = byId('artworkRefreshStatus');
    if (status) status.textContent = message;
  }

  function updateArtworkActionButtons() {
    const refreshButton = byId('refreshAllArtwork');
    if (refreshButton) {
      refreshButton.disabled = artworkRefreshInProgress;
      refreshButton.innerHTML = `<span class="icon-slot">${icon('refresh')}</span>${artworkOperation === 'refresh' ? 'Refreshing…' : 'Refresh all artwork'}`;
    }
    const fetchButton = byId('fetchAllArtworkNow');
    if (fetchButton) {
      fetchButton.disabled = artworkRefreshInProgress;
      fetchButton.innerHTML = `<span class="icon-slot">${icon('sparkles')}</span>${artworkOperation === 'fetch' ? 'Fetching…' : 'Fetch All Now'}`;
    }
  }

  function selectedArtworkFolderKinds() {
    return ['music', 'video'].filter((kind) =>
      Boolean(bridge.scanFolder && (kind === 'music' ? settings.defaultMusicFolder : settings.defaultVideoFolder)));
  }

  async function scanSelectedArtworkFolders(items) {
    const foldersToScan = selectedArtworkFolderKinds();
    if (!foldersToScan.length) return items;
    const scanResults = await Promise.all(foldersToScan.map(async (kind) => {
      const folder = kind === 'music' ? settings.defaultMusicFolder : settings.defaultVideoFolder;
      try { return (await bridge.scanFolder(folder, kind) || []).map((item) => normalizeLocalFile(item, kind)); }
      catch { return []; }
    }));
    return collectAllMediaForArtwork([...items, ...scanResults.flat()]);
  }

  async function settleArtworkLookups() {
    // Let active automatic/local work finish before the manual operation starts; queued work stays paused until it completes.
    localArtworkQueue.length = 0;
    localArtworkQueued.clear();
    localArtworkBatchPending = false;
    while (artworkRequestPromises.size) await Promise.allSettled([...artworkRequestPromises.values()]);
    while (localArtworkWorkers > 0) await new Promise((resolve) => window.setTimeout(resolve, 40));
  }

  async function refreshAllArtwork() {
    if (artworkRefreshInProgress) { toast('An artwork action is already running.'); return; }
    let items = collectAllMediaForArtwork();
    const foldersToScan = selectedArtworkFolderKinds();
    if (!items.length && !foldersToScan.length) {
      setArtworkRefreshStatus('No media items are available to refresh yet.');
      toast('Add or scan media before refreshing artwork.');
      return;
    }

    artworkRefreshInProgress = true;
    artworkOperation = 'refresh';
    automaticArtworkPaused = true;
    updateArtworkActionButtons();
    setArtworkRefreshStatus(foldersToScan.length
      ? 'Scanning selected media folders and preparing artwork refresh…'
      : `Preparing artwork refresh for ${items.length.toLocaleString()} media items…`);

    try {
      await settleArtworkLookups();
      items = await scanSelectedArtworkFolders(items);
      if (!items.length) {
        setArtworkRefreshStatus('No media items are available to refresh yet.');
        toast('No media items were found to refresh.');
        return;
      }
      setArtworkRefreshStatus(`Refreshing artwork for ${items.length.toLocaleString()} media items…`);

      for (const item of items) {
        const id = mediaId(item);
        delete artworkSearchCache[id];
        delete item.artworkUrl;
        delete item._artworkLocalStamp;
        localArtworkScanned.delete(id);
        failedArtworkItems.delete(id);
        setArtworkUrlForId(id, item, '');
        updateArtworkNodes(id, item, item.logo || item.poster || '');
      }
      safeStorageWrite('revibe.artwork-cache.v1', artworkSearchCache);
      persistState();

      let cursor = 0;
      let completed = 0;
      let found = 0;
      const refreshedSidecarDirectories = new Set();
      const workerCount = Math.min(MAX_AUTOMATIC_ARTWORK_WORKERS, items.length);
      await Promise.all(Array.from({ length: workerCount }, async () => {
        while (cursor < items.length) {
          const item = items[cursor++];
          let refreshSidecarIndex = false;
          if (item.path) {
            const slash = Math.max(String(item.path).lastIndexOf(String.fromCharCode(92)), String(item.path).lastIndexOf('/'));
            const directory = String(item.path).slice(0, slash).toLowerCase();
            if (directory && !refreshedSidecarDirectories.has(directory)) {
              refreshedSidecarDirectories.add(directory);
              refreshSidecarIndex = true;
            }
          }
          const url = await requestArtwork(item, false, true, refreshSidecarIndex);
          if (url || artworkUrlFor(item)) found += 1;
          completed += 1;
          if (completed === items.length || completed % 5 === 0)
            setArtworkRefreshStatus(`Refreshing artwork · ${completed.toLocaleString()} of ${items.length.toLocaleString()} checked · ${found.toLocaleString()} available`);
        }
      }));
      persistState();
      setArtworkRefreshStatus(`Refresh complete · ${found.toLocaleString()} of ${items.length.toLocaleString()} media items have artwork.`);
      toast(`Artwork refresh complete · ${found.toLocaleString()} of ${items.length.toLocaleString()} items have artwork.`, 'success', 5000);
    } catch (error) {
      setArtworkRefreshStatus(`Artwork refresh stopped: ${error?.message || error}`);
      toast('Artwork refresh could not complete. Try again.', 'error');
    } finally {
      artworkRefreshInProgress = false;
      artworkOperation = '';
      automaticArtworkPaused = false;
      updateArtworkActionButtons();
      drainAutomaticArtworkQueue();
    }
  }

  async function fetchAllArtworkNow() {
    if (artworkRefreshInProgress) { toast('An artwork action is already running.'); return; }
    let items = collectAllMediaForArtwork();
    const foldersToScan = selectedArtworkFolderKinds();
    if (!items.length && !foldersToScan.length) {
      setArtworkRefreshStatus('No media items are available to fetch artwork for yet.');
      toast('Add or scan media before fetching artwork.');
      return;
    }

    artworkRefreshInProgress = true;
    artworkOperation = 'fetch';
    automaticArtworkPaused = true;
    updateArtworkActionButtons();
    setArtworkRefreshStatus(foldersToScan.length
      ? 'Scanning selected media folders and preparing online artwork fetch…'
      : `Preparing online artwork fetch for ${items.length.toLocaleString()} media items…`);

    try {
      await settleArtworkLookups();
      items = await scanSelectedArtworkFolders(items);
      if (!items.length) {
        setArtworkRefreshStatus('No media items are available to fetch artwork for yet.');
        toast('No media items were found to fetch artwork for.');
        return;
      }
      for (const item of items) delete artworkSearchCache[mediaId(item)];
      safeStorageWrite('revibe.artwork-cache.v1', artworkSearchCache);
      setArtworkRefreshStatus(`Fetching online artwork for ${items.length.toLocaleString()} current media items…`);

      let cursor = 0;
      let completed = 0;
      let found = 0;
      const workerCount = Math.min(MAX_AUTOMATIC_ARTWORK_WORKERS, items.length);
      await Promise.all(Array.from({ length: workerCount }, async () => {
        while (cursor < items.length) {
          const item = items[cursor++];
          const url = await requestArtwork(item, true);
          if (url || artworkUrlFor(item)) found += 1;
          completed += 1;
          if (completed === items.length || completed % 5 === 0)
            setArtworkRefreshStatus(`Fetching artwork · ${completed.toLocaleString()} of ${items.length.toLocaleString()} checked · ${found.toLocaleString()} available`);
        }
      }));
      persistState();
      setArtworkRefreshStatus(`Fetch complete · artwork is available for ${found.toLocaleString()} of ${items.length.toLocaleString()} media items.`);
      toast(`Artwork fetch complete · ${found.toLocaleString()} of ${items.length.toLocaleString()} items have artwork.`, 'success', 5000);
    } catch (error) {
      setArtworkRefreshStatus(`Artwork fetch stopped: ${error?.message || error}`);
      toast('Artwork fetch could not complete. Try again.', 'error');
    } finally {
      artworkRefreshInProgress = false;
      artworkOperation = '';
      automaticArtworkPaused = false;
      updateArtworkActionButtons();
      drainAutomaticArtworkQueue();
    }
  }

  function scheduleDetectedMusicArtwork(extraItems = []) {
    const items = [
      ...(currentItem?.type === 'music' ? [currentItem] : []),
      ...(state.musicQueue || []),
      ...(state.library?.music || []),
      ...(state.recentPlayed || []),
      ...(state.newlyAdded || []),
      ...(Array.isArray(extraItems) ? extraItems : [])
    ];
    if (settings.automaticArtworkFetch === true) scheduleAutomaticArtworkFetch(items);
    else scheduleLocalArtworkPrefetch(items);
  }

  function resetStaleMusicArtworkOnce() {
    const migrationKey = 'revibe.artwork-recovery.v1';
    if (safeStorageRead(migrationKey, '') === 'done') return;
    const items = [
      ...(state.musicQueue || []),
      ...(state.library?.music || []),
      ...(state.recentPlayed || []),
      ...(state.newlyAdded || []),
      ...(currentItem?.type === 'music' ? [currentItem] : [])
    ];
    const ids = new Set();
    for (const item of items) {
      if (item?.type !== 'music') continue;
      ids.add(mediaId(item));
      delete item.artworkUrl;
      delete item.logo;
      delete item.poster;
      delete item._artworkLocalStamp;
    }
    for (const id of ids) delete artworkSearchCache[id];
    safeStorageWrite('revibe.artwork-cache.v1', artworkSearchCache);
    const previousPage = currentPage;
    currentPage = normalizePage(state.lastPage);
    persistState();
    currentPage = previousPage;
    safeStorageWrite(migrationKey, 'done');
  }

  function unwatchArtwork(root) {
    if (!root || !artworkObserver) return;
    const nodes = [];
    if (root.matches?.('[data-artwork-item-id]')) nodes.push(root);
    nodes.push(...root.querySelectorAll?.('[data-artwork-item-id]') || []);
    for (const node of nodes) {
      artworkObserver.unobserve(node);
      artworkObserverTargets.delete(node);
    }
  }

  function watchArtwork(root = document) {
    if (!root) return;
    if (root.nodeType === 1 && root.closest('.page')?.hidden) return;
    const nodes = [];
    if (root.matches?.('[data-artwork-item-id]')) nodes.push(root);
    nodes.push(...root.querySelectorAll?.('[data-artwork-item-id]') || []);
    const images = [];
    if (root.matches?.('img.artwork-image')) images.push(root);
    images.push(...root.querySelectorAll?.('img.artwork-image') || []);
    images.forEach((image) => { if (!image.closest('.page')?.hidden) attachArtworkErrorHandler(image); });
    for (const node of nodes) {
      if (node.closest('.page')?.hidden) continue;
      const id = node.dataset.artworkItemId;
      const item = itemLookup.get(id);
      if (!item || artworkUrlFor(item) || artworkRequests.has(id) || localArtworkQueued.has(id)) continue;
      if (Object.prototype.hasOwnProperty.call(artworkSearchCache, id) && artworkSearchCache[id] === false) continue;
      if (typeof IntersectionObserver !== 'function') { void requestArtwork(item); continue; }
      if (!artworkObserver) artworkObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          artworkObserver.unobserve(entry.target);
          artworkObserverTargets.delete(entry.target);
          const visibleItem = itemLookup.get(entry.target.dataset.artworkItemId);
          if (visibleItem) void requestArtwork(visibleItem);
        }
      }, { root: null, rootMargin: '100px' });
      if (artworkObserverTargets.has(node)) continue;
      artworkObserverTargets.add(node);
      artworkObserver.observe(node);
    }
  }

  function artMarkup(item) {
    const type = item?.type || 'music';
    const className = artClass(type);
    const duration = item?.duration ? formatTime(item.duration) : (item?.extension || typeLabel(type)).toUpperCase();
    const hasArtwork = Boolean(artworkUrlFor(item));
    return `<div class="media-art ${className} ${hasArtwork ? 'has-artwork' : ''}" ${artworkAttributes(item)}>${artworkImageMarkup(item)}${artworkFallbackMarkup(item, 'symbol')}<span class="art-time">${esc(duration)}</span></div>`;
  }

  function setArtworkHost(host, item, baseClass) {
    if (!host) return;
    if (!item) {
      const defaultArtAlreadyRendered = host.className === baseClass
        && !host.hasAttribute('data-artwork-item-id')
        && Boolean(host.querySelector(':scope > .vinyl-art'))
        && !host.querySelector(':scope > img.artwork-image');
      if (defaultArtAlreadyRendered) return;
      host.className = baseClass;
      host.removeAttribute('data-artwork-item-id');
      host.innerHTML = vinylArtworkMarkup();
      return;
    }
    const id = cacheItem(item);
    const url = artworkUrlFor(item);
    const className = [baseClass, artClass(item.type), url ? 'has-artwork' : ''].filter(Boolean).join(' ');
    const currentClassName = host.className.split(/\s+/).filter((name) => name !== 'artwork-loaded').join(' ');
    const currentImage = host.querySelector(':scope > img.artwork-image');
    const imageMatches = url ? currentImage?.getAttribute('src') === url : !currentImage;
    if (host.dataset.artworkItemId === id && currentClassName === className && imageMatches) return;
    host.className = className;
    host.setAttribute('data-artwork-item-id', id);
    host.innerHTML = `${artworkImageMarkup(item)}${artworkFallbackMarkup(item)}`;
  }

  function emptyPrompt(title, body, buttonText, kind) {
    const action = kind === 'music' || kind === 'video' ? `data-pick-folder="${kind}"` : `data-goto="${kind || 'music'}"`;
    const buttonIcon = kind === 'tv' ? 'broadcast' : 'folder';
    return `<div class="empty-card"><span class="empty-card-mark">${icon(kind === 'tv' ? 'tv' : kind === 'video' ? 'video' : 'music')}</span><div class="empty-card-copy"><strong>${esc(title)}</strong><p>${esc(body)}</p></div><button class="primary-button" ${action}><span class="icon-slot">${icon(buttonIcon)}</span>${esc(buttonText)}</button></div>`;
  }

  function shuffledItems(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function homeRecommendationCandidates(type) {
    const sourceItems = type === 'tv'
      ? [...tvChannels.map(channelToItem), ...(state.newlyAdded || []), ...(state.recentPlayed || []), ...(currentItem ? [currentItem] : [])]
      : [...(state.library?.[type] || []), ...queueFor(type), ...(state.newlyAdded || []), ...(state.recentPlayed || []), ...(currentItem ? [currentItem] : [])];
    const unique = new Map();
    for (const item of sourceItems) {
      if (item?.type !== type) continue;
      const playable = type === 'tv'
        ? Array.isArray(item.streams) && item.streams.some((stream) => typeof stream?.url === 'string' && stream.url.trim())
        : Boolean(item.path || item.url);
      if (!playable) continue;
      const id = mediaId(item);
      if (!unique.has(id)) unique.set(id, item);
    }
    return [...unique.values()];
  }

  function randomSample(items, count) {
    const pool = [...items];
    const take = Math.min(count, pool.length);
    for (let index = 0; index < take; index += 1) {
      const swapIndex = index + Math.floor(Math.random() * (pool.length - index));
      [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    return pool.slice(0, take);
  }

  function sampleRecommendations(candidates, count, previousIds = []) {
    const previous = new Set(previousIds);
    const unseen = candidates.filter((item) => !previous.has(mediaId(item)));
    const selected = randomSample(unseen, count);
    if (selected.length < count) {
      const selectedIds = new Set(selected.map(mediaId));
      const fallback = candidates.filter((item) => !selectedIds.has(mediaId(item)));
      selected.push(...randomSample(fallback, count - selected.length));
    }
    return selected;
  }

  function recommendationPlaceholderMarkup(type, slotIndex) {
    const details = {
      music: {
        title: slotIndex ? 'Add another song' : 'Add music',
        copy: slotIndex ? 'Grow your library for another music pick.' : 'Choose a folder to get song recommendations.',
        action: 'data-pick-folder="music"', actionText: 'Choose music folder', glyph: 'music'
      },
      video: {
        title: 'Add a video', copy: 'Add a local video to get a random pick.',
        action: 'data-pick-folder="video"', actionText: 'Choose video folder', glyph: 'video'
      },
      tv: {
        title: 'Explore TV streams', copy: 'Open the channel guide for a live recommendation.',
        action: 'data-goto="tv"', actionText: 'Open TV guide', glyph: 'tv'
      }
    }[type];
    return `<article class="media-card recommendation-empty-card"><div class="media-art ${artClass(type)} recommendation-placeholder-art"><span class="recommendation-placeholder-icon">${icon(details.glyph)}</span></div><div class="media-card-copy"><h3>${details.title}</h3><p>${details.copy}</p><button class="text-button recommendation-add-button" ${details.action}>${details.actionText}<span class="icon-slot">${icon('arrow-right')}</span></button></div></article>`;
  }

  function recommendationCardMarkup(item) {
    const id = cacheItem(item);
    return `<article class="media-card recommendation-card" data-item-id="${esc(id)}" tabindex="0" role="button" aria-label="Play ${esc(titleFor(item))}">${artMarkup(item)}<div class="media-card-copy"><h3>${esc(titleFor(item))}</h3><p>${esc(typeLabel(item.type))} · ${esc(itemSubtitle(item))}</p></div></article>`;
  }

  function renderRecommendations() {
    const host = byId('recommendationsGrid');
    if (!host) return;
    const music = sampleRecommendations(homeRecommendationCandidates('music'), 2, lastHomeRecommendationIds.music);
    const video = sampleRecommendations(homeRecommendationCandidates('video'), 1, lastHomeRecommendationIds.video);
    const tv = sampleRecommendations(homeRecommendationCandidates('tv'), 1, lastHomeRecommendationIds.tv);
    lastHomeRecommendationIds = {
      music: music.map(mediaId), video: video.map(mediaId), tv: tv.map(mediaId)
    };
    const slots = [
      ...music.map((item) => ({ item })),
      ...Array.from({ length: 2 - music.length }, (_, index) => ({ type: 'music', slotIndex: music.length + index })),
      ...video.map((item) => ({ item })),
      ...Array.from({ length: 1 - video.length }, () => ({ type: 'video', slotIndex: 0 })),
      ...tv.map((item) => ({ item })),
      ...Array.from({ length: 1 - tv.length }, () => ({ type: 'tv', slotIndex: 0 }))
    ];
    unwatchArtwork(host);
    host.innerHTML = shuffledItems(slots).map((slot) => slot.item
      ? recommendationCardMarkup(slot.item)
      : recommendationPlaceholderMarkup(slot.type, slot.slotIndex)).join('');
    icons(host);
    watchArtwork(host);
  }

  function renderHome() {
    unwatchArtwork(byId('page-home'));
    const recent = state.recentPlayed.slice(0, 4);
    byId('recentGrid').innerHTML = recent.length ? recent.map((item) => {
      const id = cacheItem(item);
      return `<article class="media-card" data-item-id="${esc(id)}" tabindex="0" role="button" aria-label="Play ${esc(titleFor(item))}">${artMarkup(item)}<div class="media-card-copy"><h3>${esc(titleFor(item))}</h3><p>${esc(itemSubtitle(item))} · ${esc(timeAgo(item.playedAt))}</p></div></article>`;
    }).join('') : emptyPrompt('Nothing here just yet', 'Your most recent music, videos and live channels will appear here.', 'Choose music folder', 'music');
    renderRecommendations();

    const updates = state.tvUpdates.slice(0, 3);
    const caption = byId('tvUpdateCaption');
    if (tvFetchInfo.error && !tvChannels.length) {
      caption.textContent = 'The open stream guide could not be reached.';
    } else if (updates.length) {
      caption.textContent = `${updates.length} stream ${updates.length === 1 ? 'update' : 'updates'} found · ${tvFetchInfo.stale ? 'saved guide' : 'IPTV-Org'}`;
    } else if (tvChannels.length) {
      caption.textContent = `${tvChannels.length.toLocaleString()} playable channels · ${tvFetchInfo.stale ? 'saved guide' : `guide synced ${timeAgo(tvFetchInfo.fetchedAt)}`}`;
    } else {
      caption.textContent = 'Open stream guide · checking for updates…';
    }
    if (updates.length) {
      byId('tvUpdateGrid').innerHTML = updates.map((channel) => updateCardMarkup(channel, channel.updateKind === 'new' ? 'NEW' : 'UPDATED')).join('');
    } else if (tvChannels.length) {
      byId('tvUpdateGrid').innerHTML = tvChannels.slice(0, 3).map((channel) => updateCardMarkup(channel, 'LIVE')).join('');
    } else {
      byId('tvUpdateGrid').innerHTML = `<div class="update-empty">${icon('broadcast')}<span>Connect to the open guide to see recently available streams. Your local music and video stay available offline.</span><button class="text-button" data-goto="tv">Open TV</button></div>`;
    }

    const newly = state.newlyAdded.slice(0, 3);
    if (newly.length) {
      byId('newlyGrid').innerHTML = newly.map((item) => {
        const id = cacheItem(item);
        const hasArtwork = Boolean(artworkUrlFor(item));
        return `<article class="newly-card" data-item-id="${esc(id)}" tabindex="0" role="button" aria-label="Play ${esc(titleFor(item))}"><div class="newly-art ${artClass(item.type)} ${hasArtwork ? 'has-artwork' : ''}" ${artworkAttributes(item)}>${artworkImageMarkup(item)}${artworkFallbackMarkup(item)}</div><div class="newly-copy"><strong>${esc(titleFor(item))}</strong><span>${esc(typeLabel(item.type))} · ${esc(timeAgo(item.addedAt))}</span></div></article>`;
      }).join('');
    } else {
      byId('newlyGrid').innerHTML = `<div class="newly-empty"><p>New music, videos and channels you discover will show up here — up to three at a time.</p><button class="text-button" data-pick-folder="music">Add music <span class="icon-slot">${icon('arrow-right')}</span></button><button class="text-button" data-pick-folder="video">Add videos <span class="icon-slot">${icon('arrow-right')}</span></button></div>`;
    }
    icons(byId('page-home'));
    renderSearch(false);
    watchArtwork(byId('page-home'));
  }

  function updateCardMarkup(channel, badge) {
    const item = channelToItem(channel);
    const id = cacheItem(item);
    const live = badge === 'LIVE';
    const hasArtwork = Boolean(artworkUrlFor(item));
    const logo = hasArtwork ? artworkImageMarkup(item) : `<span class="artwork-initials">${esc(initials(channel.name))}</span>`;
    const stateText = live ? `${channel.country === 'PH' ? 'PHILIPPINES' : (channel.country || 'OPEN GUIDE')} · ${esc(channel.category || 'Live stream')}` : `${badge === 'NEW' ? 'NEW STREAM' : 'STREAM UPDATED'} · ${channel.country === 'PH' ? 'PHILIPPINES' : (channel.country || 'OPEN GUIDE')}`;
    const subText = live ? `${esc(channel.category || 'Live channel')} · Play now` : `Added to the guide ${esc(timeAgo(channel.updatedAt || Date.now()))}`;
    return `<article class="update-card" data-item-id="${esc(id)}" tabindex="0" role="button" aria-label="Watch ${esc(channel.name)}"><div class="update-thumb ${hasArtwork ? 'has-artwork' : ''}" ${artworkAttributes(item)}><span class="update-badge ${live ? '' : 'is-new'}">${esc(badge)}</span>${logo}</div><div class="update-card-copy"><span class="channel-meta">${stateText}</span><strong>${esc(channel.name)}</strong><span>${subText}</span></div></article>`;
  }

  function initials(name = '') {
    return String(name).trim().split(/\s+/).slice(0,2).map((part) => part[0] || '').join('').toUpperCase() || 'TV';
  }

  function channelToItem(channel) {
    const rawId = String(channel.id || channel.name || 'channel').replace(/^tv:/, '');
    return {
      ...channel,
      id: `tv:${rawId}`,
      type: 'tv',
      title: channel.name || 'TV channel',
      artist: channel.country === 'PH' ? 'Philippines' : 'Open TV stream',
      streams: Array.isArray(channel.streams) ? channel.streams : []
    };
  }

  function sortMediaItems(items, kind, mode) {
    if (!Array.isArray(items) || mode === 'default') return Array.isArray(items) ? [...items] : [];
    const recentPlayedById = new Map((state.recentPlayed || []).map((item) => [mediaId(item), Number(item.playedAt) || 0]));
    const recentAddedById = new Map((state.newlyAdded || []).map((item) => [mediaId(item), Number(item.addedAt) || Number(item.modified) || 0]));
    const tvUpdatedById = new Map((state.tvUpdates || []).map((channel) => {
      const rawId = String(channel.id || channel.name || '').replace(/^tv:/, '');
      return [`tv:${rawId}`, Number(channel.updatedAt) || 0];
    }));
    const compareText = (left, right) => String(left || '').localeCompare(String(right || ''), undefined, { numeric: true, sensitivity: 'base' });
    const titleCompare = (left, right) => compareText(titleFor(left), titleFor(right));
    const playTime = (item) => Math.max(Number(item.playedAt) || 0, recentPlayedById.get(mediaId(item)) || 0);
    const addTime = (item) => {
      const recorded = Number(item.addedAt) || Number(item.updatedAt) || recentAddedById.get(mediaId(item)) ||
        (item.type === 'tv' ? (tvUpdatedById.get(`tv:${String(item.id || '').replace(/^tv:/, '')}`) || 0) : 0);
      return recorded || Number(item.modified) || 0;
    };
    const releaseYear = (item) => {
      const tagged = Number(item.year) || 0;
      if (tagged >= 1800 && tagged <= 9999) return tagged;
      const modified = Number(item.modified) || 0;
      return modified > 0 ? new Date(modified).getFullYear() : 0;
    };
    const reverseDirection = state.sortDirections?.[kind] !== defaultSortDirection(kind, mode);
    return [...items].map((item, index) => ({ item, index })).sort((left, right) => {
      const a = left.item;
      const b = right.item;
      let result = 0;
      if (mode === 'recentPlayed') {
        const aTime = playTime(a), bTime = playTime(b);
        result = (bTime ? 1 : 0) - (aTime ? 1 : 0) || bTime - aTime;
      } else if (mode === 'recentAdded') {
        const aTime = addTime(a), bTime = addTime(b);
        result = (bTime ? 1 : 0) - (aTime ? 1 : 0) || bTime - aTime;
      } else if (mode === 'artists') {
        result = compareText(a.artist || a.folder || 'Unknown Artist', b.artist || b.folder || 'Unknown Artist');
      } else if (mode === 'album') {
        result = compareText(a.album || a.folder || '', b.album || b.folder || '');
      } else if (mode === 'year') {
        const aYear = releaseYear(a), bYear = releaseYear(b);
        result = (bYear ? 1 : 0) - (aYear ? 1 : 0) || bYear - aYear;
      } else if (mode === 'alphabetical') {
        result = titleCompare(a, b);
      }
      return (result || titleCompare(a, b) || left.index - right.index) * (reverseDirection ? -1 : 1);
    }).map(({ item }) => item);
  }

  function applyQueueSort(kind, persist = false) {
    const queue = queueFor(kind);
    const mode = normalizeSortMode(kind, state.sortModes?.[kind]);
    if (!queue.length || mode === 'default') return false;
    const sorted = sortMediaItems(queue, kind, mode);
    const changed = queue.some((item, index) => mediaId(item) !== mediaId(sorted[index]));
    if (changed) {
      setQueue(kind, sorted);
      if (persist) persistState();
    }
    return changed;
  }

  function sortLabel(kind, mode = state.sortModes?.[kind]) {
    const normalized = normalizeSortMode(kind, mode);
    return SORT_LABELS[kind]?.[normalized] || SORT_LABELS[kind]?.default || 'Manual order';
  }

  function sortDirectionLabel(kind, mode = state.sortModes?.[kind], direction = state.sortDirections?.[kind]) {
    if (mode === 'default') return '';
    const normalized = normalizeSortDirection(kind, mode, direction);
    if (['alphabetical', 'artists', 'album'].includes(mode)) return normalized === 'desc' ? 'Z–A' : 'A–Z';
    if (mode === 'year') return normalized === 'desc' ? 'Newest year first' : 'Oldest year first';
    if (mode === 'recentPlayed' || mode === 'recentAdded') return normalized === 'desc' ? 'Newest first' : 'Oldest first';
    return normalized === 'desc' ? 'Descending' : 'Ascending';
  }

  function syncSortControl(kind) {
    const mode = normalizeSortMode(kind, state.sortModes?.[kind]);
    const label = sortLabel(kind, mode);
    const direction = sortDirectionLabel(kind, mode, state.sortDirections?.[kind]);
    const summary = direction ? `${label} · ${direction}` : label;
    const noun = kind === 'tv' ? 'TV channels' : `${kind === 'music' ? 'Music' : 'Video'} queue`;
    const trigger = byId(`${kind}SortToggle`);
    const menu = byId(`${kind}SortMenu`);
    if (trigger) {
      trigger.title = `Sort by: ${summary}`;
      trigger.setAttribute('aria-label', `Sort ${noun} · ${summary}`);
      trigger.setAttribute('aria-expanded', String(Boolean(menu && !menu.hidden)));
      trigger.classList.toggle('is-sorted', mode !== 'default');
    }
    menu?.querySelectorAll('[data-sort-option]').forEach((option) => {
      const [optionKind, optionMode] = (option.dataset.sortOption || '').split(':');
      const selected = optionKind === kind && optionMode === mode;
      const optionDirection = selected ? direction : '';
      const directionNode = option.querySelector('.sort-option-direction');
      if (directionNode) directionNode.textContent = optionDirection;
      const optionName = SORT_LABELS[optionKind]?.[optionMode] || optionMode;
      option.setAttribute('aria-label', selected && optionDirection ? `${optionName} · ${optionDirection}` : optionName);
      option.setAttribute('aria-checked', String(selected));
      option.classList.toggle('is-selected', selected);
    });
  }

  function closeSortMenus(restoreFocus = false) {
    let focusTarget = null;
    document.querySelectorAll('.sort-menu:not([hidden])').forEach((menu) => {
      menu.hidden = true;
      const trigger = document.querySelector(`[aria-controls="${menu.id}"]`);
      trigger?.setAttribute('aria-expanded', 'false');
      if (!focusTarget) focusTarget = trigger;
    });
    if (restoreFocus) focusTarget?.focus();
  }

  function toggleSortMenu(trigger) {
    const menu = byId(trigger?.getAttribute('aria-controls'));
    if (!menu) return;
    const shouldOpen = menu.hidden;
    closeSortMenus(false);
    if (!shouldOpen) return;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    syncSortControl(trigger.dataset.sortToggle);
    menu.querySelector('[aria-checked="true"]')?.focus();
  }

  function applySortMode(kind, value, notify = true) {
    if (!SORT_OPTIONS[kind]) return false;
    const mode = normalizeSortMode(kind, value);
    const previousMode = normalizeSortMode(kind, state.sortModes?.[kind]);
    const previousDirection = normalizeSortDirection(kind, previousMode, state.sortDirections?.[kind]);
    const direction = mode !== 'default' && mode === previousMode
      ? (previousDirection === 'asc' ? 'desc' : 'asc')
      : defaultSortDirection(kind, mode);
    state.sortModes[kind] = mode;
    state.sortDirections[kind] = direction;
    if (kind === 'tv') {
      renderChannels();
    } else {
      if (isShuffle) { isShuffle = false; state.shuffle = false; syncShuffleControl(); }
      applyQueueSort(kind);
      renderQueue(kind);
      renderPlayerBar();
    }
    persistState();
    if (notify) {
      const noun = kind === 'tv' ? 'TV channels' : `${kind === 'music' ? 'Music' : 'Video'} queue`;
      const directionLabel = sortDirectionLabel(kind, mode, direction);
      toast(`${noun} sorted by ${sortLabel(kind, mode)}${directionLabel ? ` · ${directionLabel}` : ''}.`);
    }
    return true;
  }

  function renderQueue(kind) {
    if (applyQueueSort(kind)) persistState();
    syncSortControl(kind);
    const queue = queueFor(kind);
    const list = byId(kind === 'music' ? 'musicQueueList' : 'videoQueueList');
    const count = byId(kind === 'music' ? 'musicQueueCount' : 'videoQueueCount');
    const hint = byId(kind === 'music' ? 'musicDropHint' : 'videoDropHint');
    if (!list || !count || !hint) return;
    unwatchArtwork(list);
    count.textContent = String(queue.length);
    hint.hidden = queue.length > 0;
    if (!queue.length) {
      list.innerHTML = '';
      return;
    }
    list.innerHTML = queue.map((item, index) => {
      const id = cacheItem(item);
      const current = currentItem && mediaId(currentItem) === id;
      const hasArtwork = Boolean(artworkUrlFor(item));
      return `<div class="queue-item ${current ? 'is-current' : ''}" data-item-id="${esc(id)}" tabindex="0" role="button" aria-label="Play ${esc(titleFor(item))}"><span class="queue-index">${current && isPlaying ? icon('volume') : String(index + 1).padStart(2,'0')}</span><span class="queue-art ${artClass(item.type)} ${hasArtwork ? 'has-artwork' : ''}" ${artworkAttributes(item)}>${artworkImageMarkup(item)}${artworkFallbackMarkup(item)}</span><span class="queue-item-copy"><span class="queue-item-title">${esc(titleFor(item))}</span><span class="queue-item-subtitle">${esc(item.artist || item.extension || typeLabel(item.type))}</span></span><button class="queue-remove" data-remove-queue="${kind}" data-remove-id="${esc(id)}" aria-label="Remove ${esc(titleFor(item))}" title="Remove from queue"><span class="icon-slot">${icon('close')}</span></button></div>`;
    }).join('');
    icons(list);
    watchArtwork(list);
  }

  function renderChannels() {
    const query = (byId('channelSearch')?.value || '').trim().toLowerCase();
    const list = byId('tvChannelList');
    if (!list) return;
    unwatchArtwork(list);
    const mode = normalizeSortMode('tv', state.sortModes?.tv);
    syncSortControl('tv');
    const filtered = tvChannels.filter((channel) => !query || `${channel.name} ${channel.country} ${channel.category} ${(channel.languages || []).join(' ')}`.toLowerCase().includes(query));
    const channelByItemId = new Map(filtered.map((channel) => [`tv:${String(channel.id || channel.name || 'channel').replace(/^tv:/, '')}`, channel]));
    const shown = sortMediaItems(filtered.map(channelToItem), 'tv', mode).map((item) => channelByItemId.get(item.id)).filter(Boolean);
    byId('tvChannelCount').textContent = tvChannels.length ? String(tvChannels.length) : '—';
    if (!shown.length) {
      list.innerHTML = `<div class="channel-empty">${tvChannels.length ? 'No channels match that search.' : 'The channel guide is loading. Use refresh to try again.'}</div>`;
      return;
    }
    list.innerHTML = shown.map((channel) => {
      const item = channelToItem(channel);
      const id = cacheItem(item);
      const hasArtwork = Boolean(artworkUrlFor(item));
      const logo = hasArtwork ? artworkImageMarkup(item) : `<span class="artwork-initials">${esc(initials(channel.name))}</span>`;
      const active = currentItem?.type === 'tv' && currentItem.id === id;
      return `<div class="channel-item ${active ? 'is-current' : ''}" data-item-id="${esc(id)}" tabindex="0" role="button" aria-label="Watch ${esc(channel.name)}"><div class="channel-logo ${hasArtwork ? 'has-artwork' : ''}" ${artworkAttributes(item)}>${logo}</div><div class="channel-item-copy"><strong>${esc(channel.name)}</strong><span>${esc(channel.country === 'PH' ? 'Philippines' : channel.country || 'Open stream')} · ${esc(channel.category || 'General')}</span></div><span class="channel-live-indicator" title="Listed stream"></span></div>`;
    }).join('');
    watchArtwork(list);
  }

  function renderSettings() {
    const host = byId('settingsContent');
    if (!host) return;
    const musicFolder = settings.defaultMusicFolder || 'Not set · choose a folder to build your library';
    const videoFolder = settings.defaultVideoFolder || 'Not set · choose a folder to build your library';
    const themes = [
      ['system', 'System', 'monitor'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']
    ];
    const accents = [
      ['red','Red'], ['white','White'], ['pink','Pink'], ['matcha','Matcha'], ['purple','Purple'], ['cyan','Cyan'], ['rgb','RGB flow'], ['system','System']
    ];
    const sections = [
      { id: 'appearance', label: 'Appearance', glyph: 'sun', title: 'Appearance', description: 'Set the look and feel of KnightWin Media Player.' },
      { id: 'media', label: 'Media and Devices', glyph: 'devices', title: 'Media and Devices', description: 'Manage your media folders and connected external devices.' },
      { id: 'artwork', label: 'Artwork', glyph: 'sparkles', title: 'Album & Poster Art', description: 'Manage local artwork and online lookups for your media.' },
      { id: 'audio', label: 'Audio & Playback', glyph: 'volume', title: 'Audio & Playback', description: 'Fine-tune sound and transitions between tracks.' },
      { id: 'reset', label: 'Reset & Storage', glyph: 'refresh', title: 'Reset & Storage', description: 'Troubleshoot KnightWin Media Player without touching your media files.' },
      { id: 'about', label: 'About', glyph: 'info', title: 'About KnightWin Media Player', description: 'A few details about this app and its community guide.' }
    ];
    const section = sections.find((item) => item.id === activeSettingsSection) || sections[0];
    activeSettingsSection = section.id;
    const presetOptions = Object.entries(EQ_PRESETS).map(([value, preset]) => `<option value="${value}" ${settings.equalizerPreset === value ? 'selected' : ''}>${preset.label}</option>`).join('');
    const crossfadeSeconds = normalizeCrossfadeSeconds(settings.crossfadeSeconds);
    const crossfadeOptions = CROSSFADE_STEPS.map((seconds) => `<option value="${seconds}" ${crossfadeSeconds === seconds ? 'selected' : ''}>${seconds} sec</option>`).join('');
    const reverbAmount = Math.max(0, Math.min(60, Number.isFinite(Number(settings.reverbAmount)) ? Number(settings.reverbAmount) : 24));

    let content = '';
    if (section.id === 'appearance') {
      content = `
        <div class="settings-group" aria-label="Appearance preferences">
          <div class="settings-group-row">
            <div class="settings-row-copy"><strong>Theme</strong><span>Match Windows, or choose a fixed theme.</span></div>
            <div class="segmented-control settings-theme-control">${themes.map(([value,label,glyph]) => `<button type="button" class="${settings.theme === value ? 'is-selected' : ''}" data-setting-theme="${value}"><span class="icon-slot">${icon(glyph)}</span>${label}</button>`).join('')}</div>
          </div>
          <div class="settings-group-row settings-group-row-stacked">
            <div class="settings-row-copy"><strong>Accent color</strong><span>Customize the app and visualizer.</span></div>
            <div class="accent-options">${accents.map(([value,label]) => `<button type="button" class="accent-option ${settings.accent === value ? 'is-selected' : ''}" data-setting-accent="${value}" aria-label="${label} accent"><span class="accent-swatch" data-color="${value}"></span><span>${label}</span></button>`).join('')}</div>
          </div>
          <div class="settings-group-row">
            <div class="settings-row-copy"><strong>Visualizer intensity</strong><span>Adjust the energy of the visual effects.</span></div>
            <div class="settings-inline-range"><input id="visualizerIntensity" type="range" min="10" max="100" step="1" value="${Number(settings.visualizerIntensity) || 70}" aria-label="Visualizer intensity"/><output class="intensity-value" id="visualizerIntensityValue">${Number(settings.visualizerIntensity) || 70}%</output></div>
          </div>
          <div class="settings-group-row">
            <div class="settings-row-copy"><strong>Lite Mode</strong><span>Reduce animation and effects if the player feels slow.</span></div>
            <label class="setting-switch"><input type="checkbox" id="lowGraphicsMode" aria-label="Enable Lite Mode" ${settings.lowGraphicsMode ? 'checked' : ''}/><span class="setting-switch-track"></span><span class="setting-switch-state">${settings.lowGraphicsMode ? 'On' : 'Off'}</span></label>
          </div>
        </div>`;
    } else if (section.id === 'media') {
      content = `
        <div class="settings-group" aria-label="Media folder preferences">
          <div class="settings-group-row">
            <div class="settings-row-copy"><strong>Music folder</strong><span class="settings-folder-path" title="${esc(musicFolder)}">${esc(musicFolder)}</span></div>
            <button type="button" class="secondary-button" data-settings-folder="music"><span class="icon-slot">${icon('folder')}</span>Browse</button>
          </div>
          <div class="settings-group-row">
            <div class="settings-row-copy"><strong>Videos folder</strong><span class="settings-folder-path" title="${esc(videoFolder)}">${esc(videoFolder)}</span></div>
            <button type="button" class="secondary-button" data-settings-folder="video"><span class="icon-slot">${icon('folder')}</span>Browse</button>
          </div>
        </div>
        <div class="settings-footnote"><span class="icon-slot">${icon('info')}</span><span>Folders are scanned on this device. Audio and video files are never uploaded.</span></div>
        <div id="deviceContent" class="settings-devices-host" aria-label="Connected devices"></div>`;
    } else if (section.id === 'artwork') {
      content = `
        <div class="settings-group" aria-label="Artwork preferences">
          <div class="settings-group-row">
            <div class="settings-row-copy"><strong>Automatic artwork lookup</strong><span>Check embedded and sidecar art first, then search online for missing art across current and future Music, Video, and TV entries. Search uses titles and artist names; media files are not uploaded.</span></div>
            <label class="setting-switch"><input type="checkbox" id="automaticArtworkFetch" aria-label="Automatically fetch artwork for all media" ${settings.automaticArtworkFetch ? 'checked' : ''}/><span class="setting-switch-track"></span><span class="setting-switch-state">${settings.automaticArtworkFetch ? 'On' : 'Off'}</span></label>
          </div>
          <div class="settings-group-row settings-action-row">
            <div class="settings-row-copy"><strong>Refresh all artwork</strong><span>Re-check embedded and sidecar art, then retry online lookup for missing art. Works even when automatic lookup is off.</span></div>
            <button type="button" class="secondary-button" id="refreshAllArtwork" ${artworkRefreshInProgress ? 'disabled' : ''}><span class="icon-slot">${icon('refresh')}</span>${artworkOperation === 'refresh' ? 'Refreshing…' : 'Refresh all artwork'}</button>
          </div>
          <div class="settings-group-row settings-action-row">
            <div class="settings-row-copy"><strong>Fetch All Now</strong><span>Search online for every current Music, Video, and TV item, including items that already have art.</span></div>
            <button type="button" class="secondary-button" id="fetchAllArtworkNow" ${artworkRefreshInProgress ? 'disabled' : ''}><span class="icon-slot">${icon('sparkles')}</span>${artworkOperation === 'fetch' ? 'Fetching…' : 'Fetch All Now'}</button>
          </div>
        </div>
        <p class="artwork-refresh-status settings-status" id="artworkRefreshStatus" role="status" aria-live="polite">${esc(artworkRefreshStatus)}</p>`;
    } else if (section.id === 'audio') {
      content = `
        <div class="settings-group" aria-label="Audio and playback settings">
          <div class="settings-group-row">
            <div class="settings-row-copy"><strong>Equalizer</strong><span>Shape the tone of Music playback.</span></div>
            <label class="setting-switch"><input type="checkbox" id="equalizerEnabled" aria-label="Enable equalizer" ${settings.equalizerEnabled ? 'checked' : ''}/><span class="setting-switch-track"></span><span class="setting-switch-state">${settings.equalizerEnabled ? 'On' : 'Off'}</span></label>
          </div>
          <div class="settings-group-row settings-control-row">
            <label class="settings-control-label" for="equalizerPreset">Preset</label>
            <select class="setting-select settings-control-select" id="equalizerPreset" ${settings.equalizerEnabled ? '' : 'disabled'}>${presetOptions}</select>
          </div>
          <div class="settings-group-row">
            <div class="settings-row-copy"><strong>Music crossfade</strong><span>Blend smoothly between queued tracks.</span></div>
            <label class="setting-switch"><input type="checkbox" id="crossfadeEnabled" aria-label="Enable music crossfade" ${settings.crossfadeEnabled ? 'checked' : ''}/><span class="setting-switch-track"></span><span class="setting-switch-state">${settings.crossfadeEnabled ? 'On' : 'Off'}</span></label>
          </div>
          <div class="settings-group-row settings-control-row">
            <label class="settings-control-label" for="crossfadeSeconds">Transition length</label>
            <select class="setting-select settings-control-select" id="crossfadeSeconds" ${settings.crossfadeEnabled ? '' : 'disabled'}>${crossfadeOptions}</select>
          </div>
          <div class="settings-group-row">
            <div class="settings-row-copy"><strong>Reverb</strong><span>Add subtle room ambience to Music.</span></div>
            <label class="setting-switch"><input type="checkbox" id="reverbEnabled" aria-label="Enable reverb" ${settings.reverbEnabled ? 'checked' : ''}/><span class="setting-switch-track"></span><span class="setting-switch-state">${settings.reverbEnabled ? 'On' : 'Off'}</span></label>
          </div>
          <div class="settings-group-row settings-control-row">
            <label class="settings-control-label" for="reverbAmount">Room mix</label>
            <div class="settings-inline-range settings-inline-range-audio"><input class="setting-range" id="reverbAmount" type="range" min="0" max="60" step="1" value="${reverbAmount}" ${settings.reverbEnabled ? '' : 'disabled'} aria-label="Reverb room mix"/><output class="intensity-value" id="reverbAmountValue">${reverbAmount}%</output></div>
          </div>
        </div>
        <div class="settings-footnote"><span class="icon-slot">${icon('info')}</span><span>Audio effects apply to Music only. Crossfade can be set from 0.5 to 2 seconds.</span></div>`;
    } else if (section.id === 'reset') {
      content = `
        <div class="settings-group" aria-label="Reset application settings">
          <div class="settings-group-row settings-reset-row">
            <div class="settings-row-copy"><strong>Clear cache & reset queues</strong><span>Clear app caches and temporary files, reset the selected Music and Video folders, and empty both queue lists.</span></div>
            <button type="button" class="danger-button" id="clearCacheButton"><span class="icon-slot">${icon('refresh')}</span>Reset app</button>
          </div>
        </div>
        <div class="settings-footnote settings-warning-note"><span class="icon-slot">${icon('info')}</span><span>This only resets KnightWin Media Player settings and queue entries. Your actual media files stay untouched.</span></div>`;
    } else {
      content = `
        <div class="settings-group" aria-label="About KnightWin Media Player">
          <div class="settings-group-row settings-about-title-row"><div class="settings-row-copy"><strong>KnightWin Media Player</strong><span>The official modern Windows successor to Revibe Media Centre.</span></div><img class="about-app-icon" src="./assets/app-icon.png" alt="KnightWin Media Player app icon" width="48" height="48" loading="lazy" decoding="async"></div>
          <div class="settings-group-row settings-about-row"><span>Created by</span><strong>Mr KNIGHT (KnightWin)</strong></div>
          <div class="settings-group-row settings-about-row settings-about-ai-row"><span>Made possible with</span><strong>AI</strong></div>
          <div class="settings-group-row settings-about-row"><span>Version</span><strong id="aboutAppVersion">v1.0.0</strong></div>
          <div class="settings-group-row settings-about-support">
            <div class="settings-row-copy"><strong>Support the creator</strong><span>Enjoying this Revibe Media Centre successor? Buy Mr KNIGHT a coffee to help it keep growing—thank you!</span></div>
            <a class="support-creator-link" href="https://ko-fi.com/N7D7292WUD" target="_blank" rel="noopener noreferrer">Support on Ko-fi <span aria-hidden="true">↗</span></a>
          </div>
          <div class="settings-group-row settings-about-info"><div class="settings-row-copy"><strong>Public TV guide</strong><span>Channel listings come from IPTV-Org’s public community directory. KnightWin Media Player does not host streams; availability is controlled by each third-party source.</span></div></div>
          <div class="settings-group-row settings-license-row"><div class="settings-row-copy"><strong>License</strong><span>Free software under the GNU GPL version 3 only; no warranty.</span></div><a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer">View license <span aria-hidden="true">↗</span></a></div>
        </div>`;
    }

    host.innerHTML = `
      <div class="settings-layout">
        <aside class="settings-sidebar" aria-label="Settings navigation">
          <div class="settings-sidebar-header"><h1>Settings</h1></div>
          <nav class="settings-sidebar-nav" aria-label="Settings categories">${sections.map((item) => `<button type="button" class="settings-section-button ${item.id === section.id ? 'is-active' : ''}" data-settings-section="${item.id}" aria-pressed="${item.id === section.id}"><span class="settings-section-icon">${icon(item.glyph)}</span><span>${item.label}</span><span class="settings-section-chevron" aria-hidden="true">›</span></button>`).join('')}</nav>
          <div class="settings-sidebar-footer"><span class="app-version" id="appVersion">KNIGHTWIN MEDIA PLAYER</span></div>
        </aside>
        <section class="settings-detail" aria-labelledby="settingsDetailTitle">
          <header class="settings-detail-heading"><h2 id="settingsDetailTitle">${section.title}</h2></header>
          <div class="settings-groups">${content}</div>
        </section>
      </div>`;
    icons(host);
    if (section.id === 'media') renderDevices();
    syncAudioSettingsControls();
    syncRangeProgress(byId('visualizerIntensity'));
    syncRangeProgress(byId('reverbAmount'));
    const version = byId('appVersion');
    const aboutVersion = byId('aboutAppVersion');
    if (bridge.getVersion) bridge.getVersion().then((value) => {
      if (version) version.textContent = `KNIGHTWIN MEDIA PLAYER · v${value}`;
      if (aboutVersion) aboutVersion.textContent = `v${value}`;
    }).catch(() => {});
  }

  function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const rounded = bytes / (1024 ** power);
    return `${rounded >= 100 ? rounded.toFixed(0) : rounded >= 10 ? rounded.toFixed(1) : rounded.toFixed(2)} ${units[power]}`;
  }

  function isMediaDevicesSettingsOpen() {
    return currentPage === 'settings' && activeSettingsSection === 'media';
  }

  function loadExternalStorages() {
    if (!bridge.getExternalStorages || externalStorageLoaded || externalStoragePending) return;
    externalStoragePending = true;
    externalStorageError = '';
    Promise.resolve().then(() => bridge.getExternalStorages()).then((volumes) => {
      externalStorages = Array.isArray(volumes) ? volumes : [];
      externalStorageLoaded = true;
      externalStorageError = '';
    }).catch(() => {
      externalStorageLoaded = true;
      externalStorageError = 'Could not check external storage. You can try again.';
    }).finally(() => {
      externalStoragePending = false;
      if (isMediaDevicesSettingsOpen()) renderDevices();
    });
  }

  function handleDiscoveredMedia(payload) {
    if (settings.mediaDiscoveryEnabled !== true || !payload || typeof payload !== 'object') return;
    const volume = payload.volume || {};
    if (settings.externalStorageEnabledIds?.[String(volume.id || '')] !== true) return;
    const music = Array.isArray(payload.music) ? payload.music : [];
    const videos = Array.isArray(payload.videos) ? payload.videos : [];
    const musicAdded = queueItems('music', music, { quiet: true, markNew: true });
    const videoAdded = queueItems('video', videos, { quiet: true, markNew: true });
    const found = music.length + videos.length;
    const added = musicAdded + videoAdded;
    if (!found) {
      toast(`No supported music or video files found on ${volume.name || 'the external drive'}.`, 'error');
    } else if (!added) {
      toast(`Media on ${volume.name || 'the external drive'} was already queued, or the queue is full.`, 'error');
    } else {
      const parts = [];
      if (musicAdded) parts.push(`${musicAdded} music ${musicAdded === 1 ? 'track' : 'tracks'}`);
      if (videoAdded) parts.push(`${videoAdded} ${videoAdded === 1 ? 'video' : 'videos'}`);
      const skipped = Math.max(0, found - added);
      toast(`${parts.join(' and ')} added from ${volume.name || 'external storage'}${skipped ? ` · ${skipped} already queued or beyond the queue limit` : ''}.`, 'success', 5000);
    }
    if (isMediaDevicesSettingsOpen()) renderDevices();
  }

  function renderDevices() {
    const host = byId('deviceContent');
    if (!host) return;
    if (isMediaDevicesSettingsOpen()) loadExternalStorages();
    const discoveryEnabled = settings.mediaDiscoveryEnabled === true;
    const supportsDiscovery = Boolean(bridge.isDesktop && appPlatform === 'win32');
    const storageRows = !supportsDiscovery
      ? `<div class="storage-empty">External-drive detection is available in the Windows desktop app.</div>`
      : externalStorageError
        ? `<div class="storage-empty is-error">${esc(externalStorageError)}</div>`
        : !externalStorageLoaded || externalStoragePending
          ? `<div class="storage-empty"><span class="storage-spinner"></span>Checking connected external storage…</div>`
          : !externalStorages.length
            ? `<div class="storage-empty">No USB flash drive or external disk is connected.</div>`
            : externalStorages.map((volume) => {
              const driveId = String(volume.id || '');
              const driveEnabled = settings.externalStorageEnabledIds?.[driveId] === true;
              const syncTitle = driveEnabled
                ? (discoveryEnabled ? 'This drive will sync when connected.' : 'This drive is selected, but the global discovery switch is off.')
                : 'Enable automatic media sync for this drive.';
              return `<div class="external-drive-row"><span class="external-drive-icon">${icon('devices')}</span><span class="external-drive-copy"><span class="external-drive-name"><strong>${esc(volume.name || 'External storage')}</strong><span class="drive-connected-dot" role="img" aria-label="Connected" title="Connected"></span></span><span>${esc(volume.kind || 'External drive')} · ${esc(volume.root || '')}</span><span>${formatBytes(volume.size)} total · ${formatBytes(volume.free)} free</span></span><div class="external-drive-actions"><label class="drive-switch" title="${esc(syncTitle)}"><input type="checkbox" data-drive-sync-id="${esc(driveId)}" aria-label="Automatically sync media from ${esc(volume.name || volume.root || 'this drive')}" ${driveEnabled ? 'checked' : ''}/><span class="drive-switch-track" aria-hidden="true"></span></label><span class="drive-switch-state">${driveEnabled ? 'On' : 'Off'}</span></div></div>`;
            }).join('');
    const discoveryStatus = !supportsDiscovery
      ? 'Connect a supported Windows desktop build to detect removable drives.'
      : discoveryEnabled
        ? 'Discovery is on. Only individually enabled drives are scanned; found music and videos are added to their queues.'
        : 'Global discovery is off. Per-drive selections are saved, but external-drive scans are paused.';
    host.innerHTML = `
      <div class="settings-grid">
        <section class="settings-card wide external-storage-card"><div class="settings-card-heading"><span class="settings-icon">${icon('devices')}</span><div><h2>External storage</h2><p>USB flash drives and external disks detected by Windows.</p></div><span class="storage-count">${supportsDiscovery && externalStorageLoaded ? externalStorages.length : '—'}</span></div>
          <label class="media-discovery-setting ${supportsDiscovery ? '' : 'is-disabled'}"><span class="media-discovery-copy"><strong>Automatically discover media</strong><span>When enabled, scan connected external drives for music and videos and add supported files to their respective queues.</span></span><span class="switch-wrap"><input id="mediaDiscoveryToggle" type="checkbox" ${discoveryEnabled ? 'checked' : ''} ${supportsDiscovery ? '' : 'disabled'} aria-label="Automatically discover media on external drives"><span class="switch-track" aria-hidden="true"></span></span></label>
          <div class="discovery-status"><span class="icon-slot">${icon(discoveryEnabled ? 'check' : 'info')}</span><span>${esc(discoveryStatus)}</span></div>
          <div class="external-storage-list" id="externalStorageList">${storageRows}</div>
          <div class="external-storage-footer"><span>Scanning is local. Only drives switched on above sync, and only while global discovery is enabled. KnightWin Media Player does not copy, upload, or delete files.</span><button class="secondary-button" id="rescanExternalStorage" ${supportsDiscovery && discoveryEnabled ? '' : 'disabled'}><span class="icon-slot">${icon('refresh')}</span>Scan connected drives</button></div>
        </section>
      </div>`;
    icons(host);
  }

  function syncShuffleControl(disabled = false) {
    const button = byId('shuffleButton');
    if (!button) return;
    button.classList.toggle('is-active', isShuffle);
    button.setAttribute('aria-pressed', String(isShuffle));
    button.setAttribute('aria-label', isShuffle ? 'Turn shuffle off' : 'Shuffle upcoming tracks');
    button.title = isShuffle ? 'Shuffle on' : 'Shuffle upcoming tracks';
    button.disabled = disabled;
  }

  function syncRepeatControl() {
    const button = byId('repeatButton');
    if (!button) return;
    const labels = { off: 'Off', all: 'Repeat', one: 'Repeat 1' };
    const name = labels[repeatMode] || labels.off;
    button.dataset.repeatMode = repeatMode;
    button.classList.toggle('is-active', repeatMode !== 'off');
    button.setAttribute('aria-pressed', String(repeatMode !== 'off'));
    button.setAttribute('aria-label', repeatMode === 'one' ? 'Repeat current item' : repeatMode === 'all' ? 'Repeat queue' : 'Turn repeat on');
    button.title = `Repeat: ${name}`;
    button.disabled = currentItem?.type === 'tv';
  }

  function cycleRepeatMode() {
    repeatMode = ({ off: 'all', all: 'one', one: 'off' })[repeatMode] || 'all';
    syncRepeatControl();
    const labels = { off: 'Off', all: 'Repeat', one: 'Repeat 1' };
    toast(`Repeat: ${labels[repeatMode]}.`);
  }

  function toggleShuffle() {
    if (currentItem?.type === 'tv') return;
    isShuffle = !isShuffle;
    state.shuffle = isShuffle;
    const kind = currentItem?.type === 'video' ? 'video' : currentItem?.type === 'music' ? 'music' : currentPage === 'video' ? 'video' : 'music';
    if (isShuffle) {
      state.sortModes[kind] = 'default';
      state.sortDirections[kind] = defaultSortDirection(kind, 'default');
      syncSortControl(kind);
      if (currentItem?.type === kind) ensureItemQueued(currentItem);
      shuffleQueue(kind, true);
    } else {
      persistState();
      toast('Shuffle is off.');
    }
    renderPlayerBar();
  }

  function renderPlayerArtwork(host, item, playing) {
    if (!host) return;
    const type = item?.type || '';
    const artworkUrl = item && (type === 'music' || type === 'tv') ? artworkUrlFor(item) : '';
    const id = item ? cacheItem(item) : '';
    const signature = item
      ? [id, type, artworkUrl, type === 'tv' ? titleFor(item) : ''].join('|')
      : 'idle';

    if (host.dataset.playerArtSignature !== signature) {
      host.dataset.playerArtSignature = signature;
      host.className = ['mini-art', item ? artClass(type) : 'is-idle', artworkUrl ? 'has-artwork' : ''].filter(Boolean).join(' ');
      if (item && (type === 'music' || type === 'tv')) host.setAttribute('data-artwork-item-id', id);
      else host.removeAttribute('data-artwork-item-id');

      if (!item) {
        host.innerHTML = '<img class="player-brand-mark" src="./assets/app-icon.png" alt="" aria-hidden="true" decoding="async">';
      } else if (type === 'music') {
        host.innerHTML = `<span class="player-art-scene"><span class="player-cd-disc" aria-hidden="true"><span class="player-art-label">${artworkUrl ? artworkImageMarkup(item) : ''}<span class="player-cd-center"></span></span></span></span>`;
      } else if (type === 'video') {
        host.innerHTML = `<span class="player-art-scene"><svg class="player-film-reel" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><g class="film-reel-rotor"><circle cx="20" cy="20" r="18" fill="#17232f" stroke="#d8e5ec" stroke-width="1.1"/><circle cx="20" cy="20" r="14.8" fill="#263746" stroke="#8ca4b4" stroke-width=".8"/><circle cx="20" cy="8.8" r="3.2" fill="#0c151d" stroke="#a9c0cb" stroke-width=".65"/><circle cx="30.65" cy="16.55" r="3.2" fill="#0c151d" stroke="#a9c0cb" stroke-width=".65"/><circle cx="27.1" cy="29.1" r="3.2" fill="#0c151d" stroke="#a9c0cb" stroke-width=".65"/><circle cx="12.9" cy="29.1" r="3.2" fill="#0c151d" stroke="#a9c0cb" stroke-width=".65"/><circle cx="9.35" cy="16.55" r="3.2" fill="#0c151d" stroke="#a9c0cb" stroke-width=".65"/><circle cx="20" cy="20" r="4.5" fill="#b5c9d2" stroke="#eef5f8" stroke-width=".8"/><circle cx="20" cy="20" r="1.7" fill="#14212a"/></g></svg></span>`;
      } else if (type === 'tv') {
        host.innerHTML = `<span class="player-art-scene player-tv-scene"><span class="player-tv-antenna"></span><span class="player-tv-body"><span class="player-tv-screen">${artworkUrl ? artworkImageMarkup(item) : ''}<span class="player-tv-monogram">${esc(initials(titleFor(item)))}</span></span><span class="player-tv-controls"><i></i><i></i></span></span><span class="player-tv-feet"></span></span>`;
      } else {
        host.innerHTML = '';
      }
    }

    host.classList.toggle('is-playing', Boolean(playing));
    if (item) {
      if (type === 'music' || type === 'tv') watchArtwork(host);
      if (!artworkUrlFor(item)) void requestArtwork(item);
    }
  }

  function renderPlayerBar() {
    const title = byId('barTitle');
    const subtitle = byId('barSubtitle');
    const art = byId('miniArt');
    const playButton = byId('playPauseButton');
    const favorite = byId('favoriteButton');
    syncRepeatControl();
    if (!currentItem) {
      title.textContent = 'Nothing playing';
      subtitle.textContent = 'Choose music, video or a live channel.';
      renderPlayerArtwork(art, null, false);
      byId('elapsedTime').textContent = '00:00';
      byId('durationTime').textContent = '00:00';
      byId('timeline').value = '0';
      byId('timeline').style.setProperty('--progress', '0%');
      playButton.disabled = true;
      playButton.setAttribute('aria-label','Play');
      playButton.innerHTML = `<span class="icon-slot">${icon('play')}</span>`;
      favorite.classList.remove('is-favorite');
      favorite.disabled = true;
      syncShuffleControl(false);
      renderStageInfo();
      return;
    }
    title.textContent = titleFor(currentItem);
    subtitle.textContent = currentItem.type === 'tv' ? `LIVE · ${currentItem.country === 'PH' ? 'Philippines' : (currentItem.country || 'Open stream')}` : itemSubtitle(currentItem);
    renderPlayerArtwork(art, currentItem, isPlaying);
    playButton.disabled = false;
    playButton.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    playButton.innerHTML = `<span class="icon-slot">${icon(isPlaying ? 'pause' : 'play')}</span>`;
    favorite.disabled = false;
    favorite.classList.toggle('is-favorite', state.favorites.includes(mediaId(currentItem)));
    syncShuffleControl(currentItem.type === 'tv');
    renderStageInfo();
    updateTimeline();
  }

  function releaseInactiveVideoSurface(element) {
    // Pause and unload the inactive media element so its last decoded frame cannot linger in the stage.
    if (!element) return;
    const hadMedia = Boolean(element.getAttribute('src') || element.currentSrc || element.readyState > 0 || element.networkState !== 0);
    try { element.pause(); } catch { /* ignore an already closed media pipeline */ }
    try { element.currentTime = 0; } catch { /* live streams and detached sources may not seek */ }
    element.removeAttribute('src');
    element.removeAttribute('poster');
    if (hadMedia) element.load();
  }

  function renderStageInfo() {
    if (currentItem?.type === 'music') {
      const subtitle = itemSubtitle(currentItem);
      const visualizerTitle = titleFor(currentItem);
      byId('visualizerTitle').textContent = visualizerTitle;
      byId('visualizerTitle').title = visualizerTitle;
      byId('visualizerArtist').textContent = subtitle;
      byId('musicStageSubtitle').textContent = isPlaying ? 'Let the sound find its shape.' : 'Ready when you are.';
      byId('musicStatusLabel').textContent = isPlaying ? 'PLAYING' : 'READY';
      setArtworkHost(byId('vizAlbumArt'), currentItem, 'viz-album-art');
    } else {
      byId('visualizerTitle').textContent = 'Make room for a feeling.';
      byId('visualizerTitle').removeAttribute('title');
      byId('visualizerArtist').textContent = 'Choose a track or drop music into your queue.';
      byId('musicStageSubtitle').textContent = 'The sound is yours.';
      byId('musicStatusLabel').textContent = 'READY';
      setArtworkHost(byId('vizAlbumArt'), null, 'viz-album-art');
    }
    const isVideo = currentItem?.type === 'video';
    if (!isVideo) releaseInactiveVideoSurface(video);
    if (video && isVideo) video.poster = artworkUrlFor(currentItem) || '';
    const videoFrame = byId('videoFrame');
    videoFrame?.classList.toggle('is-ready', Boolean(isVideo));
    const videoTitleOverlay = byId('videoTitleOverlay');
    if (videoTitleOverlay) videoTitleOverlay.textContent = isVideo ? titleFor(currentItem) : 'No video selected';
    videoFrame?.classList.toggle('is-paused', Boolean(isVideo && !isPlaying));
    byId('videoCenterPlay').setAttribute('aria-label', isPlaying ? 'Pause video' : 'Play video');
    byId('videoCenterPlay').innerHTML = `<span class="icon-slot">${icon(isPlaying ? 'pause' : 'play')}</span>`;
    const isTv = currentItem?.type === 'tv';
    if (!isTv) {
      if (tvHls) { tvHls.destroy(); tvHls = null; }
      releaseInactiveVideoSurface(tvVideo);
    }
    if (tvVideo && isTv) tvVideo.poster = artworkUrlFor(currentItem) || '';
    const tvFrame = byId('tvFrame');
    tvFrame?.classList.toggle('is-ready', Boolean(isTv));
    tvFrame?.classList.toggle('is-paused', Boolean(isTv && !isPlaying));
    byId('tvTitleOverlay').textContent = isTv ? titleFor(currentItem) : 'No channel selected';
    byId('tvCenterPlay').setAttribute('aria-label', isPlaying ? 'Pause channel' : 'Play channel');
    byId('tvCenterPlay').innerHTML = `<span class="icon-slot">${icon(isPlaying ? 'pause' : 'play')}</span>`;
    const selectionKey = currentItem ? `${currentItem.type}:${mediaId(currentItem)}` : 'none';
    const selectionChanged = selectionKey !== lastStageSelectionKey;
    const playingChanged = isPlaying !== lastStagePlaying;
    const currentType = currentItem?.type || '';
    if (!stageListsInitialized) {
      renderQueue('music');
      renderQueue('video');
      renderChannels();
      stageListsInitialized = true;
      icons(document);
      watchArtwork(byId('page-music'));
    } else if (selectionChanged) {
      if (lastStageItemType === 'music' || currentType === 'music') renderQueue('music');
      if (lastStageItemType === 'video' || currentType === 'video') renderQueue('video');
      if (lastStageItemType === 'tv' || currentType === 'tv') renderChannels();
      icons(document);
      watchArtwork(byId('page-music'));
    } else if (playingChanged) {
      if (currentType === 'music') renderQueue('music');
      else if (currentType === 'video') renderQueue('video');
    }
    lastStageSelectionKey = selectionKey;
    lastStageItemType = currentType;
    lastStagePlaying = isPlaying;
  }
  function updateTimeline() {
    const active = activeElement();
    const live = currentItem?.type === 'tv';
    const duration = active && Number.isFinite(active.duration) ? active.duration : 0;
    const current = active && Number.isFinite(active.currentTime) ? active.currentTime : 0;
    byId('elapsedTime').textContent = live ? 'LIVE' : formatTime(current);
    byId('durationTime').textContent = live ? 'LIVE' : formatTime(duration);
    const timeline = byId('timeline');
    if (duration > 0 && !live) {
      timeline.max = String(duration);
      timeline.value = String(Math.min(current, duration));
      timeline.style.setProperty('--progress', `${Math.max(0, Math.min(100, current / duration * 100))}%`);
      timeline.disabled = false;
    } else {
      timeline.max = '100';
      timeline.value = '0';
      timeline.style.setProperty('--progress', '0%');
      timeline.disabled = true;
    }
  }

  function activeElement() {
    if (currentItem?.type === 'video') return video;
    if (currentItem?.type === 'tv') return tvVideo;
    if (currentItem?.type === 'music') return musicDecks[activeMusicDeckIndex] || audio;
    return null;
  }

  function musicMediaIsPlaying() {
    const element = currentItem?.type === 'music' ? activeElement() : null;
    return Boolean(element && !element.paused && !element.ended);
  }

  function renderAll() {
    itemLookup = new Map();
    stageListsInitialized = false;
    lastStageSelectionKey = '';
    lastStageItemType = '';
    lastStagePlaying = false;
    renderHome();
    renderPlayerBar();
    // Settings content is created only if the user opens Settings.
  }

  function toast(message, type = 'success', duration = 3200) {
    const region = byId('toastRegion');
    const node = document.createElement('div');
    node.className = `toast ${type === 'error' ? 'is-error' : ''}`;
    node.innerHTML = `<span class="icon-slot">${icon(type === 'error' ? 'alert' : 'check')}</span><span>${esc(message)}</span>`;
    region.appendChild(node);
    window.setTimeout(() => { node.style.opacity = '0'; node.style.transform = 'translateY(6px)'; window.setTimeout(() => node.remove(), 220); }, duration);
  }

  function navigate(page) {
    if (page === 'devices') { page = 'settings'; activeSettingsSection = 'media'; }
    const valid = ['home','music','video','tv','settings'];
    if (!valid.includes(page)) page = 'home';
    const previousPage = currentPage;
    if (page !== 'music' && document.body.classList.contains('music-presentation')) exitMusicPresentation();
    currentPage = page;
    closeSortMenus(false);
    document.querySelectorAll('.page').forEach((node) => {
      const active = node.id === `page-${page}`;
      if (!active) unwatchArtwork(node);
      node.hidden = !active;
      node.classList.toggle('is-visible', active);
    });
    watchArtwork(byId(`page-${page}`));
    document.querySelectorAll('.nav-item[data-page]').forEach((node) => node.classList.toggle('is-active', node.dataset.page === page));
    renderSearch(false);
    state.lastPage = page;
    persistState();
    if (page === 'settings') renderSettings();
    if (page === 'home' && previousPage !== 'home') renderHome();
    if (page === 'tv') {
      renderChannels();
      if (!tvCatalogLoaded) loadTvCatalog(false);
    } else if (page === 'home' && !tvCatalogLoaded) {
      loadTvCatalog(false);
    }
    if (page === 'music') {
      requestAnimationFrame(resizeVisualizer);
      startVisualizerLoop();
    } else stopVisualizerLoop();
  }

  function normalizeLocalFile(item, type) {
    const file = { ...item };
    file.type = type;
    file.id = file.id || mediaId(file);
    file.title = file.title || file.name || 'Untitled';
    file.artist = file.artist || file.folder || 'Local library';
    return file;
  }

  function mergeScannedMetadata(target, source) {
    if (!target || !source) return false;
    let changed = false;
    if (source.folder && target.folder !== source.folder) { target.folder = source.folder; changed = true; }
    if (source.artist && (!target.artist || target.artist === 'Local library' || target.artist === 'Unknown Artist' || target.artist === source.folder)) {
      if (target.artist !== source.artist) { target.artist = source.artist; changed = true; }
    }
    if (source.album && (!target.album || target.album === source.folder)) {
      if (target.album !== source.album) { target.album = source.album; changed = true; }
    }
    if (Number(source.year) > 0 && Number(target.year) !== Number(source.year)) { target.year = Number(source.year); changed = true; }
    if (Number(source.modified) > Number(target.modified || 0)) { target.modified = Number(source.modified); changed = true; }
    if (Number(source.size) > 0 && Number(target.size) !== Number(source.size)) { target.size = Number(source.size); changed = true; }
    return changed;
  }

  function mergeKnownMediaMetadata(kind, source) {
    const id = mediaId(source);
    const lists = [queueFor(kind), state.library?.[kind] || []];
    let changed = false;
    for (const list of lists) {
      for (const candidate of list) if (candidate && mediaId(candidate) === id) changed = mergeScannedMetadata(candidate, source) || changed;
    }
    if (currentItem && currentItem.type === kind && mediaId(currentItem) === id)
      changed = mergeScannedMetadata(currentItem, source) || changed;
    return changed;
  }

  function addToLibrary(kind, items, markNew = true) {
    if (!Array.isArray(items) || !items.length) return { added: [], count: 0 };
    const type = kind === 'video' ? 'video' : 'music';
    const existing = state.library[type] || [];
    const existingIds = new Set(existing.map(mediaId));
    const known = new Set(state.knownMedia[type] || []);
    const candidates = items.map((item) => normalizeLocalFile(item, type));
    for (const item of candidates) { cacheItem(item); mergeKnownMediaMetadata(type, item); }
    const newItems = candidates.filter((item) => !existingIds.has(mediaId(item)));
    const addedAt = Date.now();
    for (const item of newItems) if (!Number.isFinite(Number(item.addedAt))) item.addedAt = addedAt;
    state.library[type] = [...newItems, ...existing].slice(0, 400);
    const initiallyUnknown = !known.size;
    const genuinelyNew = candidates.filter((item) => !known.has(mediaId(item)));
    const markItems = markNew ? (initiallyUnknown ? [...genuinelyNew].sort((a,b) => (b.modified || 0) - (a.modified || 0)).slice(0,3) : genuinelyNew.slice(0, 12)) : [];
    const timestamp = Date.now();
    for (const item of markItems) item.addedAt = timestamp;
    if (markItems.length) {
      const addedIds = new Set(markItems.map(mediaId));
      state.newlyAdded = [...markItems, ...state.newlyAdded.filter((item) => !addedIds.has(mediaId(item)))].slice(0, 12);
    }
    state.knownMedia[type] = [...new Set([...(state.knownMedia[type] || []), ...candidates.map(mediaId)])].slice(-5000);
    persistState();
    if (type === 'music') scheduleDetectedMusicArtwork(candidates);
    else scheduleAutomaticArtworkFetch(candidates);
    renderHome();
    return { added: newItems, count: candidates.length };
  }

  function queueFor(kind) { return kind === 'music' ? state.musicQueue : state.videoQueue; }

  function setQueue(kind, queue) {
    if (kind === 'music') state.musicQueue = queue; else state.videoQueue = queue;
  }

  function shuffledQueueOrder(kind, source, forceDifferent = false) {
    const currentId = currentItem?.type === kind ? mediaId(currentItem) : '';
    const currentIndex = currentId ? source.findIndex((item) => mediaId(item) === currentId) : -1;
    const split = currentIndex >= 0 ? currentIndex + 1 : 0;
    const prefix = source.slice(0, split);
    const upcoming = source.slice(split);
    const originalOrder = upcoming.map(mediaId).join('|');
    for (let index = upcoming.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [upcoming[index], upcoming[swap]] = [upcoming[swap], upcoming[index]];
    }
    if (forceDifferent && upcoming.length > 1 && upcoming.map(mediaId).join('|') === originalOrder) {
      [upcoming[0], upcoming[1]] = [upcoming[1], upcoming[0]];
    }
    return [...prefix, ...upcoming];
  }

  function ensureItemQueued(item) {
    if (!item || !['music', 'video'].includes(item.type)) return false;
    const kind = item.type;
    const id = mediaId(item);
    const queue = queueFor(kind);
    const existingIndex = queue.findIndex((queued) => mediaId(queued) === id);
    if (existingIndex >= 0) {
      if (!queue[existingIndex].url && item.url) {
        const refreshed = [...queue];
        refreshed[existingIndex] = item;
        setQueue(kind, refreshed);
        renderQueue(kind);
        persistState();
      }
      return true;
    }
    if (queue.length >= 5000) {
      toast('The queue is full (5,000 items). The selected item will play, but cannot be added to the queue.', 'error');
      return false;
    }
    const queuedItem = { ...item, addedAt: Number(item.addedAt) || Date.now() };
    let nextQueue = [...queue, queuedItem];
    if (state.sortModes?.[kind] && state.sortModes[kind] !== 'default' && !isShuffle) nextQueue = sortMediaItems(nextQueue, kind, state.sortModes[kind]);
    setQueue(kind, nextQueue);
    scheduleAutomaticArtworkFetch([queuedItem]);
    if (kind === 'music') scheduleDetectedMusicArtwork([queuedItem]);
    renderQueue(kind);
    persistState();
    return true;
  }

  function shuffleQueue(kind, notify = false) {
    const queue = queueFor(kind);
    if (!queue.length) {
      if (notify) toast('Add music or videos to a queue to shuffle.');
      return;
    }
    const currentId = currentItem?.type === kind ? mediaId(currentItem) : '';
    const currentIndex = currentId ? queue.findIndex((item) => mediaId(item) === currentId) : -1;
    const upcomingCount = queue.length - (currentIndex >= 0 ? currentIndex + 1 : 0);
    setQueue(kind, shuffledQueueOrder(kind, queue, notify));
    renderQueue(kind);
    persistState();
    if (notify && upcomingCount < 2) toast('Shuffle is on. Add at least two upcoming items to reorder the queue.');
    else if (notify) toast(`${kind === 'music' ? 'Music' : 'Video'} queue shuffled.`);
  }

  function queueItems(kind, items, options = {}) {
    const queue = queueFor(kind);
    const accepted = (items || []).map((item) => normalizeLocalFile(item, kind)).filter((item) => item && item.url);
    if (!accepted.length) { if (!options.quiet) toast('No supported media files were found in that folder.', 'error'); return 0; }
    let metadataChanged = false;
    for (const item of accepted) metadataChanged = mergeKnownMediaMetadata(kind, item) || metadataChanged;
    const known = new Set(queue.map(mediaId));
    const allAdditions = accepted.filter((item) => !known.has(mediaId(item)));
    const room = Math.max(0, 5000 - queue.length);
    const additions = allAdditions.slice(0, room);
    if (!allAdditions.length) {
      if (metadataChanged) { renderQueue(kind); persistState(); }
      if (!options.quiet) toast('Those files are already in your queue.');
      return 0;
    }
    if (!additions.length) { if (!options.quiet) toast('The queue is full (5,000 items). Remove a few items before adding more.', 'error'); return 0; }
    const addedAt = Date.now();
    for (const item of additions) if (!Number.isFinite(Number(item.addedAt))) item.addedAt = addedAt;
    let combined = [...queue, ...additions];
    if (isShuffle) combined = shuffledQueueOrder(kind, combined);
    else if (state.sortModes?.[kind] && state.sortModes[kind] !== 'default') combined = sortMediaItems(combined, kind, state.sortModes[kind]);
    setQueue(kind, combined);
    addToLibrary(kind, additions, options.markNew !== false);
    if (!currentItem) selectItem(combined[0], false);
    else renderQueue(kind);
    persistState();
    if (!options.quiet) toast(`${additions.length} ${kind === 'music' ? 'track' : 'video'}${additions.length === 1 ? '' : 's'} added to queue.`);
    if (allAdditions.length > additions.length) {
      if (!options.quiet) toast(`Added ${additions.length.toLocaleString()} items; this queue is capped at 5,000.`, 'error');
    }
    if (options.autoplay) playItem(additions[0]);
    return additions.length;
  }

  function removeFromQueue(kind, id) {
    if (kind === 'music') state.musicQueue = state.musicQueue.filter((item) => mediaId(item) !== id);
    else state.videoQueue = state.videoQueue.filter((item) => mediaId(item) !== id);
    renderQueue(kind);
    persistState();
  }

  function clearQueue(kind) {
    const queue = queueFor(kind);
    if (!queue.length) {
      toast(`${kind === 'music' ? 'Music' : 'Video'} queue is already empty.`);
      return;
    }
    setQueue(kind, []);
    renderQueue(kind);
    persistState();
    toast(`${kind === 'music' ? 'Music' : 'Video'} queue cleared. Your media files were not touched.`);
  }

  async function refreshQueueFromFolder(kind, button) {
    const folder = kind === 'music' ? settings.defaultMusicFolder : settings.defaultVideoFolder;
    const label = kind === 'music' ? 'Music' : 'Video';
    if (!folder) {
      toast(`Choose a default ${kind} folder before refreshing this queue.`, 'error');
      return;
    }
    if (!bridge.refreshFolder) {
      toast('Folder refresh is available in the Windows desktop app.', 'error');
      return;
    }
    if (button?.disabled) return;
    if (button) { button.disabled = true; button.classList.add('is-loading'); }
    try {
      const result = await bridge.refreshFolder(folder, kind);
      if (!result?.ok) throw new Error(result?.error || `Could not access the selected ${kind} folder.`);
      const scanned = (Array.isArray(result.files) ? result.files : [])
        .map((item) => normalizeLocalFile(item, kind))
        .filter((item) => item.url)
        .slice(0, 5000);

      if (scanned.length) {
        addToLibrary(kind, scanned, true);
        const refreshedIds = new Set(scanned.map(mediaId));
        state.library[kind] = [...scanned, ...(state.library[kind] || []).filter((item) => !refreshedIds.has(mediaId(item)))].slice(0, 400);
        renderHome();
      }

      const refreshedAt = Date.now();
      for (const item of scanned) if (!Number.isFinite(Number(item.addedAt))) item.addedAt = refreshedAt;
      let refreshedQueue = scanned;
      if (isShuffle && refreshedQueue.length > 1) refreshedQueue = shuffledQueueOrder(kind, refreshedQueue);
      else if (state.sortModes?.[kind] && state.sortModes[kind] !== 'default') refreshedQueue = sortMediaItems(refreshedQueue, kind, state.sortModes[kind]);
      setQueue(kind, refreshedQueue);
      if (kind === 'music') scheduleDetectedMusicArtwork();
      if (!currentItem && refreshedQueue.length) selectItem(refreshedQueue[0], false);
      else renderQueue(kind);
      persistState();
      if (scanned.length) toast(`${scanned.length.toLocaleString()} ${kind === 'music' ? 'tracks' : 'videos'} found. ${label} queue synced to the selected folder.`);
      else toast(`No supported ${kind === 'music' ? 'audio' : 'video'} files found. ${label} queue is empty.`);
    } catch (error) {
      toast(`Could not refresh the ${kind} folder: ${error?.message || error}`, 'error');
    } finally {
      if (button) { button.disabled = false; button.classList.remove('is-loading'); }
    }
  }

  async function fallbackMakeItem(file, kind) {
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    const allowed = kind === 'music' ? AUDIO_EXT : VIDEO_EXT;
    if (!allowed.has(extension)) return null;
    let filePath = '';
    try { if (bridge.getDroppedFilePath) filePath = bridge.getDroppedFilePath(file) || ''; } catch { /* browser file */ }
    let url = '';
    if (filePath && bridge.fileUrl) {
      try { url = await bridge.fileUrl(filePath); } catch { url = ''; }
    }
    if (!url) url = URL.createObjectURL(file);
    const rel = file.webkitRelativePath || '';
    const parent = rel ? rel.split('/').slice(-2, -1)[0] : '';
    return {
      id: filePath || `drop:${kind}:${file.name}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2,7)}`,
      title: file.name.replace(/\.[^.]+$/, '').replace(/[._]+/g, ' '),
      artist: parent || 'Local library', type: kind, path: filePath,
      url, extension: extension.toUpperCase(), size: file.size, modified: file.lastModified || Date.now()
    };
  }

  async function chooseFolder(kind, purpose = 'queue') {
    fallbackPickKind = kind;
    fallbackPickPurpose = purpose;
    if (bridge.chooseFolder) {
      try {
        const result = await bridge.chooseFolder(kind, kind === 'music' ? settings.defaultMusicFolder : settings.defaultVideoFolder);
        if (!result) return;
        const folderKey = kind === 'music' ? 'defaultMusicFolder' : 'defaultVideoFolder';
        settings[folderKey] = result.folder;
        persistSettings();
        const files = Array.isArray(result.files) ? result.files : [];
        const added = addToLibrary(kind, files, true);
        if (purpose === 'queue') {
          queueItems(kind, files, { markNew: false });
          if (!state.musicQueue.length && kind === 'music') renderQueue('music');
        } else {
          toast(`${files.length.toLocaleString()} supported file${files.length === 1 ? '' : 's'} found in your ${kind} folder.`);
        }
        renderSettings();
        if (!files.length) toast(`No supported ${kind === 'music' ? 'audio' : 'video'} files were found in that folder.`, 'error');
        return added;
      } catch (error) {
        toast(`Could not read that folder: ${error?.message || error}`, 'error');
        return;
      }
    }
    const input = byId('fallbackFolderPicker');
    input.value = '';
    input.click();
  }

  async function chooseFiles(kind) {
    if (bridge.chooseFiles) {
      try {
        const items = await bridge.chooseFiles(kind);
        if (items?.length) queueItems(kind, items, { markNew: true });
        else if (items) toast('No files were selected.');
      } catch (error) { toast(`Could not open files: ${error?.message || error}`, 'error'); }
      return;
    }
    fallbackPickKind = kind;
    fallbackPickPurpose = 'queue';
    const input = byId('fallbackFilePicker');
    input.accept = kind === 'music' ? 'audio/*' : 'video/*';
    input.value = '';
    input.click();
  }

  async function handleFallbackFolderChange(event) {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    const kind = fallbackPickKind;
    const folderName = files[0].webkitRelativePath?.split('/')[0] || 'Selected folder';
    const key = kind === 'music' ? 'defaultMusicFolder' : 'defaultVideoFolder';
    settings[key] = folderName;
    persistSettings();
    const items = (await Promise.all(files.map((file) => fallbackMakeItem(file, kind)))).filter(Boolean);
    addToLibrary(kind, items, true);
    if (fallbackPickPurpose === 'queue') queueItems(kind, items, { markNew: false });
    else toast(`${items.length} supported file${items.length === 1 ? '' : 's'} found.`);
    renderSettings();
    if (!items.length) toast('No supported files were found in that folder.', 'error');
  }

  async function handleFallbackFileChange(event) {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    const items = (await Promise.all(files.map((file) => fallbackMakeItem(file, fallbackPickKind)))).filter(Boolean);
    queueItems(fallbackPickKind, items, { markNew: true });
  }

  function selectedItem(item) {
    if (item.type === 'tv') {
      return channelToItem(item);
    }
    return normalizeLocalFile(item, item.type === 'video' ? 'video' : 'music');
  }

  function setMusicDeckGainNow(index, value) {
    const gain = musicDeckGainNodes[index]?.gain;
    if (!gain || !audioContext) return false;
    const now = audioContext.currentTime;
    try {
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(value, now);
    } catch { gain.value = value; }
    return true;
  }

  function applyPlaybackVolumes() {
    const configuredVolume = Number(state.volume ?? .72);
    const master = muted ? 0 : Math.max(0, Math.min(1, Number.isFinite(configuredVolume) ? configuredVolume : .72));
    musicDecks.forEach((deck, index) => {
      const level = Math.max(0, Math.min(1, Number(musicDeckLevels[index] ?? 0)));
      const routed = Boolean(audioSources.has(deck) && musicDeckGainNodes[index]);
      const transitionAutomatesDeck = musicTransition?.mode === 'audio-param'
        && (index === musicTransition.from || index === musicTransition.to);
      deck.muted = muted;
      deck.volume = master * (routed ? 1 : level);
      if (routed && !transitionAutomatesDeck) setMusicDeckGainNow(index, level);
    });
    for (const element of [video, tvVideo].filter(Boolean)) {
      element.muted = muted;
      element.volume = master;
    }
  }

  function cancelMusicTransition(keepIndex = activeMusicDeckIndex) {
    if (musicTransition?.raf) cancelAnimationFrame(musicTransition.raf);
    if (musicTransition?.cleanupTimer) clearTimeout(musicTransition.cleanupTimer);
    musicTransition = null;
    activeMusicDeckIndex = Math.max(0, Math.min(musicDecks.length - 1, keepIndex));
    musicDeckLevels = musicDecks.map((_deck, index) => index === activeMusicDeckIndex ? 1 : 0);
    musicDecks.forEach((deck, index) => {
      if (index === activeMusicDeckIndex) return;
      deck.pause();
      try { deck.currentTime = 0; } catch { /* ignore a deck without metadata */ }
      deck.removeAttribute('src');
      deck.load();
    });
    applyPlaybackVolumes();
  }

  function selectItem(item, autoplay = true) {
    if (!item) return;
    cancelMusicTransition(activeMusicDeckIndex);
    tvStartSequence += 1;
    const prepared = selectedItem(item);
    currentItem = prepared;
    isPlaying = false;
    const src = prepared.url;
    for (const element of mediaEls) {
      if (element !== activeElement()) {
        try { element.pause(); } catch { /* ignore */ }
      }
    }
    if (prepared.type === 'music' && src) {
      const activeAudio = musicDecks[activeMusicDeckIndex] || audio;
      if (activeAudio.src !== src) { activeAudio.src = src; activeAudio.load(); }
      musicDeckLevels[activeMusicDeckIndex] = 1;
      applyPlaybackVolumes();
    } else if (prepared.type === 'video' && src) {
      if (tvHls) { tvHls.destroy(); tvHls = null; }
      if (video.src !== src) { video.src = src; video.load(); }
    }
    if (prepared.type === 'tv') {
      if (tvHls) { tvHls.destroy(); tvHls = null; }
      tvVideo.pause();
      tvVideo.removeAttribute('src');
      tvVideo.load();
    }
    renderPlayerBar();
    persistState();
    if (autoplay) void startSelectedItem(prepared);
  }

  function streamProxyUrl(stream) {
    if (!stream?.url) return '';
    return bridge.proxyUrl ? bridge.proxyUrl(stream) : stream.url;
  }

  function isHlsSource(url = '') {
    return /\.(m3u8?|m3u)(?:$|[?#])/i.test(url) || /format=m3u8/i.test(url);
  }

  function loadHlsLibrary() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (hlsLibraryPromise) return hlsLibraryPromise;
    hlsLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './assets/hls.min.js';
      script.async = true;
      script.onload = () => window.Hls ? resolve(window.Hls) : reject(new Error('HLS.js did not initialize.'));
      script.onerror = () => {
        script.remove();
        reject(new Error('HLS.js could not be loaded.'));
      };
      document.head.appendChild(script);
    }).catch((error) => {
      hlsLibraryPromise = null;
      throw error;
    });
    return hlsLibraryPromise;
  }

  async function refreshLocalMediaUrl(item) {
    if (!item || !['music', 'video'].includes(item.type) || !item.path || !bridge.fileUrl) return item?.url || '';
    try {
      const resolved = await bridge.fileUrl(item.path);
      item.url = typeof resolved === 'string' ? resolved : '';
    } catch { item.url = ''; }
    return item.url || '';
  }

  function mediaResponseKey(url) {
    try { const parsed = new URL(String(url || '')); parsed.hash = ''; return parsed.href.toLowerCase(); }
    catch { return String(url || '').toLowerCase(); }
  }

  function rememberMediaResponse(response) {
    if (!response?.url) return;
    const key = mediaResponseKey(response.url);
    mediaResponseDiagnostics.set(key, response);
    if (mediaResponseDiagnostics.size > 32) mediaResponseDiagnostics.delete(mediaResponseDiagnostics.keys().next().value);
    if (currentItem && activeElement()?.error) reportPlaybackFailure(activeElement());
  }

  function reportPlaybackFailure(element, playError = '') {
    const code = Number(element?.error?.code) || 0;
    const labels = { 1: 'aborted', 2: 'network', 3: 'decode', 4: 'unsupported source' };
    const source = element?.currentSrc || element?.src || '';
    const response = mediaResponseDiagnostics.get(mediaResponseKey(source));
    const status = Number.isFinite(Number(response?.status)) ? response.status : 'none';
    const contentType = response?.contentType || 'no MIME';
    let sourceHost = '';
    try { sourceHost = new URL(source).host; } catch { sourceHost = 'unknown host'; }
    const formatSupport = currentItem?.type === 'video'
      ? `MP4 ${video?.canPlayType?.('video/mp4') || 'no'}`
      : `MP3 ${audio?.canPlayType?.('audio/mpeg') || 'no'}`;
    const fingerprint = `${source}|${code}|${status}|${contentType}`;
    if (fingerprint === lastPlaybackFailureKey && Date.now() - lastPlaybackFailureAt < 2200) return;
    lastPlaybackFailureKey = fingerprint;
    lastPlaybackFailureAt = Date.now();
    const diagnostic = `Playback diagnostic: ${labels[code] || 'unknown'} (${code || '?'}) · HTTP ${status} · ${contentType} · ${formatSupport} · network ${element?.networkState ?? '?'} · ${sourceHost}`;
    console.warn('KnightWin playback diagnostic', { code, responseStatus: response?.status ?? null, contentType: response?.contentType || '', formatSupport, networkState: element?.networkState, readyState: element?.readyState, source, playError });
    toast(`${diagnostic}${playError ? ` · ${playError}` : ''}`, 'error', 7000);
  }

  async function startSelectedItem(item, sourceReady = false) {
    if (!item) return;
    if (item.type === 'tv') return startTv(item);
    if (!sourceReady) await refreshLocalMediaUrl(item);
    const element = item.type === 'video' ? video : (musicDecks[activeMusicDeckIndex] || audio);
    const source = item.url || '';
    if (!source) {
      toast('This file is not available in the current session. Re-select its folder to play it.', 'error');
      return;
    }
    if (element.src !== source) { element.src = source; element.load(); }
    applyPlaybackVolumes();
    if (item.type === 'music') ensureAudioAnalyser();
    const playback = element.play();
    if (playback && playback.catch) playback.catch((error) => {
      isPlaying = false;
      renderPlayerBar();
      if (error?.name !== 'AbortError') reportPlaybackFailure(element, error?.name || 'play rejected');
    });
  }

  function finishMusicCrossfade(transition) {
    if (!transition || musicTransition !== transition) return;
    if (transition.raf) cancelAnimationFrame(transition.raf);
    if (transition.cleanupTimer) clearTimeout(transition.cleanupTimer);
    musicTransition = null;
    const outgoing = musicDecks[transition.from];
    outgoing?.pause();
    try { if (outgoing) outgoing.currentTime = 0; } catch { /* ignore */ }
    outgoing?.removeAttribute('src');
    outgoing?.load();
    musicDeckLevels = musicDecks.map((_deck, index) => index === transition.to ? 1 : 0);
    applyPlaybackVolumes();
  }

  function scheduleMusicCrossfade(transition) {
    if (!audioContext || audioContext.state !== 'running') return false;
    const fromGain = musicDeckGainNodes[transition.from]?.gain;
    const toGain = musicDeckGainNodes[transition.to]?.gain;
    if (!fromGain || !toGain || typeof fromGain.setValueCurveAtTime !== 'function' || typeof toGain.setValueCurveAtTime !== 'function') return false;
    const duration = transition.duration / 1000;
    const startTime = audioContext.currentTime;
    const samples = 64;
    const fadeOut = new Float32Array(samples);
    const fadeIn = new Float32Array(samples);
    for (let index = 0; index < samples; index += 1) {
      const progress = index / (samples - 1);
      fadeOut[index] = Math.cos(progress * Math.PI / 2);
      fadeIn[index] = Math.sin(progress * Math.PI / 2);
    }
    try {
      fromGain.cancelScheduledValues(startTime);
      toGain.cancelScheduledValues(startTime);
      fromGain.setValueAtTime(1, startTime);
      toGain.setValueAtTime(0, startTime);
      fromGain.setValueCurveAtTime(fadeOut, startTime, duration);
      toGain.setValueCurveAtTime(fadeIn, startTime, duration);
    } catch {
      setMusicDeckGainNow(transition.from, 1);
      setMusicDeckGainNow(transition.to, 0);
      return false;
    }
    transition.mode = 'audio-param';
    transition.endTime = startTime + duration;
    transition.cleanupTimer = window.setTimeout(() => finishMusicCrossfade(transition), Math.ceil(transition.duration) + 120);
    return true;
  }

  function crossfadeMusicTo(item, durationSeconds) {
    const from = activeMusicDeckIndex;
    const to = from === 0 ? 1 : 0;
    const outgoing = musicDecks[from];
    const incoming = musicDecks[to];
    if (!outgoing || !incoming || !item?.url) return false;
    const previousItem = currentItem;
    cancelMusicTransition(from);
    outgoing.muted = muted;
    incoming.pause();
    incoming.removeAttribute('src');
    incoming.load();
    activeMusicDeckIndex = to;
    currentItem = item;
    isPlaying = false;
    musicDeckLevels[from] = 1;
    musicDeckLevels[to] = 0;
    incoming.src = item.url;
    incoming.load();
    video?.pause();
    tvVideo?.pause();
    applyPlaybackVolumes();
    renderPlayerBar();
    persistState();
    ensureAudioAnalyser();

    const transition = { from, to, duration: Math.max(.25, Math.min(2, Number(durationSeconds) || 0)) * 1000, cleanupTimer: 0, endTime: 0, mode: 'pending', raf: 0 };
    musicTransition = transition;
    const restorePrevious = (error) => {
      if (musicTransition !== transition) return;
      cancelMusicTransition(from);
      currentItem = previousItem;
      isPlaying = Boolean(outgoing && !outgoing.paused);
      renderPlayerBar();
      persistState();
      if (error?.name !== 'AbortError') toast('The next track could not start, so the current track was kept playing.', 'error');
    };
    const begin = async () => {
      if (musicTransition !== transition || currentItem !== item || activeMusicDeckIndex !== to) return;
      if (audioContext?.state === 'suspended') {
        try { await audioContext.resume(); } catch { /* use the audible hard-switch fallback below */ }
      }
      if (musicTransition !== transition) return;
      if (!scheduleMusicCrossfade(transition)) finishMusicCrossfade(transition);
    };
    try {
      const playback = incoming.play();
      if (playback?.then) playback.then(begin).catch(restorePrevious);
      else void begin().catch(restorePrevious);
    } catch (error) { restorePrevious(error); }
    return true;
  }

  function upcomingMusicItem() {
    if (repeatMode === 'one') return null;
    const queue = state.musicQueue;
    if (!queue.length) return null;
    const id = currentItem ? mediaId(currentItem) : '';
    const index = queue.findIndex((entry) => mediaId(entry) === id);
    const nextIndex = index + 1;
    if (nextIndex < queue.length) return queue[nextIndex];
    if (repeatMode === 'all' && queue.length > 1) return queue[0];
    return null;
  }

  function maybeAutoCrossfade(element) {
    if (element !== activeElement() || currentItem?.type !== 'music' || !isPlaying || musicTransition || !settings.crossfadeEnabled) return;
    const fadeSeconds = normalizeCrossfadeSeconds(settings.crossfadeSeconds);
    if (!Number.isFinite(element.duration)) return;
    const effectiveFade = Math.min(fadeSeconds, Math.max(.5, element.duration * .45));
    const remaining = element.duration - element.currentTime;
    if (remaining > effectiveFade || remaining <= .2) return;
    const upcoming = upcomingMusicItem();
    if (!upcoming || mediaId(upcoming) === mediaId(currentItem)) return;
    playItem(upcoming, { crossfadeSeconds: Math.min(effectiveFade, remaining) });
  }

  function recordRecent(item) {
    const id = mediaId(item);
    state.recentPlayed = [{ ...item, playedAt: Date.now() }, ...state.recentPlayed.filter((old) => mediaId(old) !== id)].slice(0, 8);
    persistState();
    renderHome();
    if (item.type === 'music' || item.type === 'video') renderQueue(item.type);
    else if (item.type === 'tv') renderChannels();
  }

  async function playItem(item, options = {}) {
    if (!item) return;
    const picked = selectedItem(item);
    if (picked.type !== 'tv') {
      await refreshLocalMediaUrl(picked);
      if (!picked.url) {
        toast('This file is not available in the current session. Re-select its folder to play it.', 'error');
        return;
      }
    }
    if (picked.type === 'tv' && (!picked.streams || !picked.streams.length) && itemLookup.get(picked.id)?.streams) picked.streams = itemLookup.get(picked.id).streams;
    if (picked.type === 'music' || picked.type === 'video') ensureItemQueued(picked);
    const outgoing = activeElement();
    const requestedFade = Number(options.crossfadeSeconds ?? settings.crossfadeSeconds);
    const canCrossfade = picked.type === 'music' && currentItem?.type === 'music' && mediaId(picked) !== mediaId(currentItem)
      && isPlaying && outgoing && !outgoing.paused && settings.crossfadeEnabled && requestedFade > 0 && musicDecks.length > 1;
    if (canCrossfade) {
      if (isShuffle) shuffleQueue('music', false);
      if (crossfadeMusicTo(picked, requestedFade)) {
        navigate('music');
        recordRecent(picked);
        return;
      }
    }
    selectItem(picked, false);
    if (isShuffle && (picked.type === 'music' || picked.type === 'video')) shuffleQueue(picked.type, false);
    if (picked.type === 'video') navigate('video');
    else if (picked.type === 'tv') navigate('tv');
    else navigate('music');
    recordRecent(picked);
    void startSelectedItem(picked, true);
  }

  async function openAssociatedMedia(files) {
    const items = [];
    for (const entry of Array.isArray(files) ? files : []) {
      if (!entry || !['music', 'video'].includes(entry.type) || typeof entry.path !== 'string') continue;
      let url = '';
      try { url = await bridge.fileUrl(entry.path); } catch { /* ignore an inaccessible associated file */ }
      if (!url) continue;
      const filename = entry.path.split(/[\\/]/).pop() || 'Untitled';
      const title = filename.replace(/\.[^.]+$/, '').replace(/[._]+/g, ' ') || filename;
      const extension = filename.match(/\.([^.]+)$/)?.[1]?.toUpperCase() || '';
      items.push(selectedItem({
        id: entry.path, path: entry.path, url, type: entry.type,
        title, name: title, artist: 'Local file', extension
      }));
    }
    if (!items.length) {
      toast('The selected file could not be opened.', 'error');
      return;
    }
    items.forEach(ensureItemQueued);
    playItem(items[0]);
  }

  function playTv(channel) {
    playItem(channel.type === 'tv' ? channel : channelToItem(channel));
  }

  async function startTv(item) {
    const stream = Array.isArray(item.streams) ? item.streams[0] : null;
    if (!stream?.url) {
      toast('This channel has no playable stream listed. Refresh the guide or try another channel.', 'error');
      return;
    }
    const startSequence = ++tvStartSequence;
    if (tvHls) { tvHls.destroy(); tvHls = null; }
    hlsFailReported = false;
    tvVideo.pause();
    tvVideo.removeAttribute('src');
    tvVideo.load();
    tvVideo.muted = muted;
    tvVideo.volume = muted ? 0 : Number(state.volume ?? .72);
    const source = streamProxyUrl(stream);
    const hlsSource = isHlsSource(stream.url);
    const nativeHls = Boolean(tvVideo.canPlayType('application/vnd.apple.mpegurl') || tvVideo.canPlayType('application/x-mpegURL'));
    let HlsLibrary = window.Hls;
    if (hlsSource && !nativeHls && !HlsLibrary) {
      try { HlsLibrary = await loadHlsLibrary(); }
      catch {
        if (startSequence === tvStartSequence && currentItem && mediaId(currentItem) === mediaId(item)) {
          renderPlayerBar();
          toast('HLS playback support could not be loaded. Check the app files and try again.', 'error');
        }
        return;
      }
    }
    if (startSequence !== tvStartSequence || !currentItem || mediaId(currentItem) !== mediaId(item)) return;
    if (hlsSource && HlsLibrary && HlsLibrary.isSupported()) {
      tvHls = new HlsLibrary({
        enableWorker: true,
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        maxBufferSize: 30 * 1000 * 1000,
        backBufferLength: 10,
        lowLatencyMode: false,
        capLevelToPlayerSize: true,
        manifestLoadingTimeOut: 18000,
        fragLoadingTimeOut: 18000
      });
      tvHls.on(HlsLibrary.Events.ERROR, (_event, data) => {
        if (!data?.fatal || hlsFailReported) return;
        hlsFailReported = true;
        isPlaying = false;
        renderPlayerBar();
        toast('This stream is offline or blocked by its provider. Try another channel or refresh the guide.', 'error', 5200);
      });
      tvHls.attachMedia(tvVideo);
      tvHls.on(HlsLibrary.Events.MEDIA_ATTACHED, () => tvHls?.loadSource(source));
      tvHls.on(HlsLibrary.Events.MANIFEST_PARSED, () => {
        const result = tvVideo.play();
        if (result?.catch) result.catch(() => toast('Press play once more to start this live stream.', 'error'));
      });
    } else if (hlsSource && !nativeHls) {
      renderPlayerBar();
      toast('This WebView cannot play HLS streams. Try another channel or source.', 'error');
      return;
    } else {
      tvVideo.src = source;
      tvVideo.load();
      const result = tvVideo.play();
      if (result?.catch) result.catch(() => toast('This stream could not start. It may be offline or unsupported.', 'error'));
    }
    renderPlayerBar();
  }

  function createReverbImpulse(context, seconds = 1.8, decay = 2.35) {
    const length = Math.floor(context.sampleRate * seconds);
    const impulse = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const samples = impulse.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        const fade = (1 - i / length) ** decay;
        samples[i] = (Math.random() * 2 - 1) * fade;
      }
    }
    return impulse;
  }

  function resumeAudioContextIfNeeded() {
    if (!audioContext || audioContext.state !== 'suspended' || currentItem?.type !== 'music' || !isPlaying) return;
    audioContext.resume().catch(() => {});
  }

  function ensureAudioAnalyser() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContext) {
        audioContext = new AudioContextClass();
        audioContext.addEventListener('statechange', () => {
          if (audioContext?.state === 'suspended' && currentItem?.type === 'music' && isPlaying) audioContext.resume().catch(() => {});
        });
        const frequencies = [60, 250, 1000, 4000, 12000];
        equalizerFilters = [];
        frequencies.forEach((frequency, index) => {
          const filter = audioContext.createBiquadFilter();
          filter.type = index === 0 ? 'lowshelf' : index === frequencies.length - 1 ? 'highshelf' : 'peaking';
          filter.frequency.value = frequency;
          filter.Q.value = index === 1 || index === 3 ? .85 : 1;
          if (equalizerFilters.length) equalizerFilters[equalizerFilters.length - 1].connect(filter);
          equalizerFilters.push(filter);
        });
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.82;
        analyserBuffer = new Uint8Array(analyser.frequencyBinCount);
        equalizerFilters[equalizerFilters.length - 1].connect(analyser);
        reverbDryGain = audioContext.createGain();
        analyser.connect(reverbDryGain);
        reverbDryGain.connect(audioContext.destination);
        applyAudioSettings();
      }
      musicDecks.forEach((deck, index) => {
        if (audioSources.has(deck)) return;
        try {
          const source = audioContext.createMediaElementSource(deck);
          const gain = audioContext.createGain();
          gain.gain.value = musicDeckLevels[index] ?? 0;
          source.connect(gain);
          gain.connect(equalizerFilters[0]);
          musicDeckGainNodes[index] = gain;
          audioSources.set(deck, source);
        } catch { /* retain playback on platforms that block a secondary media source */ }
      });
      applyPlaybackVolumes();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch {
      // Playback continues without DSP; the visualizer uses its soft-motion fallback.
    }
  }

  function queueNext(kind, direction = 1) {
    const queue = kind === 'music' ? state.musicQueue : state.videoQueue;
    if (!queue.length) return false;
    const currentId = currentItem ? mediaId(currentItem) : '';
    let index = queue.findIndex((item) => mediaId(item) === currentId);
    if (index < 0) index = direction > 0 ? -1 : 0;
    let nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= queue.length) {
      if (repeatMode !== 'all') return false;
      nextIndex = (nextIndex + queue.length) % queue.length;
    }
    playItem(queue[nextIndex]);
    return true;
  }

  function queueTvNext(direction = 1) {
    if (!tvChannels.length) return false;
    const currentId = String(currentItem?.id || '').replace(/^tv:/, '');
    let index = tvChannels.findIndex((channel) => channel.id === currentId);
    if (index < 0) index = direction > 0 ? -1 : 0;
    let nextIndex = index + direction;
    if (nextIndex < 0) nextIndex = tvChannels.length - 1;
    if (nextIndex >= tvChannels.length) nextIndex = 0;
    playTv(tvChannels[nextIndex]);
    return true;
  }

  function next() {
    if (!currentItem) return false;
    if (currentItem.type === 'tv') return queueTvNext(1);
    return queueNext(currentItem.type, 1);
  }
  function previous() {
    const active = activeElement();
    if (active && Number.isFinite(active.currentTime) && active.currentTime > 4 && currentItem?.type !== 'tv') {
      if (currentItem?.type === 'music' && musicTransition) cancelMusicTransition(activeMusicDeckIndex);
      active.currentTime = 0;
      return true;
    }
    if (!currentItem) return false;
    if (currentItem.type === 'tv') return queueTvNext(-1);
    return queueNext(currentItem.type, -1);
  }

  function togglePlayback() {
    if (!currentItem) {
      const first = state.musicQueue[0] || state.videoQueue[0];
      if (first) { playItem(first); return; }
      navigate('music');
      toast('Choose a folder or add a file to get started.');
      return;
    }
    const element = activeElement();
    if (!element) return;
    if (element.paused) {
      if (currentItem.type === 'tv' && !tvVideo.src && !tvHls) startTv(currentItem);
      else void startSelectedItem(currentItem);
    } else {
      if (currentItem.type === 'music' && musicTransition) cancelMusicTransition(activeMusicDeckIndex);
      element.pause();
    }
  }

  function stopPlayback() {
    if (currentItem?.type === 'music' && musicTransition) cancelMusicTransition(activeMusicDeckIndex);
    const element = activeElement();
    if (element) {
      element.pause();
      try { element.currentTime = 0; } catch { /* live streams do not seek */ }
    }
  }

  function updatePlayerFromMedia() {
    const element = activeElement();
    if (!element) return;
    updateTimeline();
    if (currentItem?.type === 'video') {
      byId('videoFrame').classList.toggle('is-paused', element.paused);
    }
    if (currentItem?.type === 'tv') {
      byId('tvFrame').classList.toggle('is-paused', element.paused);
    }
  }

  function bindMediaEvents(element) {
    const syncPlayingState = () => {
      if (element !== activeElement() || element.paused || element.ended) return;
      isPlaying = true;
      if (currentItem?.type === 'music') {
        ensureAudioAnalyser();
        resumeAudioContextIfNeeded();
        if (currentPage === 'music') {
          resizeVisualizer();
          startVisualizerLoop();
          drawVisualizerSafely();
        }
      }
      renderPlayerBar();
      persistState();
    };
    element.addEventListener('play', syncPlayingState);
    element.addEventListener('playing', syncPlayingState);
    element.addEventListener('pause', () => {
      if (element !== activeElement() || !element.paused) return;
      isPlaying = false;
      renderPlayerBar();
      persistState();
    });
    element.addEventListener('timeupdate', () => {
      if (musicTransition?.mode === 'audio-param' && audioContext?.currentTime >= musicTransition.endTime) finishMusicCrossfade(musicTransition);
      if (element === activeElement()) maybeAutoCrossfade(element);
      updatePlayerFromMedia();
    });
    element.addEventListener('loadedmetadata', updatePlayerFromMedia);
    element.addEventListener('durationchange', updatePlayerFromMedia);
    element.addEventListener('ended', () => {
      if (element !== activeElement()) return;
      if (repeatMode === 'one' && currentItem?.type !== 'tv') {
        element.currentTime = 0;
        element.play().catch(() => {});
      } else if (!next()) {
        isPlaying = false;
        renderPlayerBar();
      }
    });
    element.addEventListener('error', () => {
      if (element !== activeElement() || currentItem?.type === 'tv') return;
      if (currentItem) reportPlaybackFailure(element);
    });
  }

  function renderSearch(showResults = true) {
    const input = byId('globalSearch');
    const resultsHost = byId('searchResults');
    if (!input || !resultsHost) return;
    const keepOpen = showResults || !resultsHost.hidden;
    const scope = ['music', 'video', 'tv'].includes(currentPage) ? currentPage : 'all';
    const scopeLabel = scope === 'tv' ? 'TV channels' : scope === 'all' ? 'all media' : scope === 'music' ? 'Music' : 'Video';
    input.placeholder = `Search ${scopeLabel.toLowerCase()}…`;
    input.setAttribute('aria-label', `Search ${scopeLabel}`);
    unwatchArtwork(resultsHost);
    const query = input.value.trim().toLowerCase();
    if (!query) { resultsHost.hidden = true; resultsHost.innerHTML = ''; return; }
    const all = [...(state.library.music || []), ...(state.library.video || []), ...state.musicQueue, ...state.videoQueue, ...state.recentPlayed, ...tvChannels.map(channelToItem)];
    const unique = new Map();
    for (const item of all) {
      if (scope !== 'all' && item.type !== scope) continue;
      const id = cacheItem(item);
      const searchable = `${titleFor(item)} ${itemSubtitle(item)} ${item.country || ''} ${item.category || ''} ${(item.languages || []).join(' ')}`.toLowerCase();
      if (!unique.has(id) && searchable.includes(query)) unique.set(id, item);
    }
    const matches = [...unique.values()].slice(0, 7);
    resultsHost.hidden = !keepOpen;
    resultsHost.innerHTML = matches.length ? matches.map((item) => {
      const id = cacheItem(item);
      const hasArtwork = Boolean(artworkUrlFor(item));
      return `<button class="search-result" data-item-id="${esc(id)}"><span class="search-result-art ${hasArtwork ? 'has-artwork' : ''}" ${artworkAttributes(item)}>${artworkImageMarkup(item)}${artworkFallbackMarkup(item)}</span><span class="search-result-copy"><strong>${esc(titleFor(item))}</strong><span>${esc(typeLabel(item.type))} · ${esc(itemSubtitle(item))}</span></span></button>`;
    }).join('') : `<div class="search-empty">No ${esc(scopeLabel.toLowerCase())} matches.</div>`;
    if (!resultsHost.hidden) watchArtwork(resultsHost);
  }

  function processChannelCatalog(catalog) {
    const channels = Array.isArray(catalog?.channels) ? catalog.channels : [];
    const previous = state.tvSnapshot || {};
    const nextSnapshot = {};
    const updates = [];
    for (const channel of channels) {
      const streams = Array.isArray(channel.streams) ? channel.streams : [];
      const signature = streams.map((stream) => stream.url).join('|').slice(0, 380);
      nextSnapshot[channel.id] = signature;
      if (Object.prototype.hasOwnProperty.call(previous, channel.id) && previous[channel.id] !== signature) {
        updates.push({ ...channel, updateKind: 'changed', updatedAt: Date.now() });
      } else if (Object.keys(previous).length && !Object.prototype.hasOwnProperty.call(previous, channel.id)) {
        updates.push({ ...channel, updateKind: 'new', updatedAt: Date.now() });
      }
    }
    tvChannels = channels;
    tvFetchInfo = { fetchedAt: catalog?.fetchedAt || 0, stale: Boolean(catalog?.stale), error: catalog?.error || '' };
    state.tvSnapshot = nextSnapshot;
    state.tvUpdates = updates.slice(0, 8);
    if (updates.length) {
      const recentUpdates = updates.slice(0, 3).map((channel) => ({ ...channelToItem(channel), addedAt: Date.now() }));
      const updateIds = new Set(recentUpdates.map(mediaId));
      state.newlyAdded = [...recentUpdates, ...state.newlyAdded.filter((item) => !updateIds.has(mediaId(item)))].slice(0, 12);
    }
    persistState();
    renderHome();
    if (currentPage === 'tv') renderChannels();
  }

  async function loadTvCatalog(force = false) {
    if (tvCatalogLoading || (tvCatalogLoaded && !force)) return;
    tvCatalogLoading = true;
    try {
      let catalog;
      if (bridge.getOpenTvCatalog) {
        catalog = await bridge.getOpenTvCatalog(force);
      } else {
        const response = await fetch('./assets/tv-fallback.json');
        if (!response.ok) throw new Error('Open guide is not available in browser preview.');
        const data = await response.json();
        catalog = { channels: Array.isArray(data) ? data : data.channels || [], fetchedAt: Date.now(), stale: false };
      }
      processChannelCatalog(catalog || {});
      tvCatalogLoaded = true;
      if (force && !catalog?.error) toast(`Channel guide refreshed · ${tvChannels.length.toLocaleString()} playable channels.`);
      if (catalog?.error) toast('Showing the last saved channel guide while offline.', 'error', 4000);
    } catch (error) {
      tvFetchInfo.error = error?.message || String(error);
      tvCatalogLoaded = false;
      renderHome();
      if (currentPage === 'tv') renderChannels();
      if (force) toast('Could not refresh the open TV guide. Check your connection and try again.', 'error');
    } finally {
      tvCatalogLoading = false;
    }
  }

  function ingestDrop(files, kind) {
    const chosen = [...files].filter((file) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      return (kind === 'music' ? AUDIO_EXT : VIDEO_EXT).has(ext);
    });
    if (!chosen.length) {
      toast(`Drop supported ${kind === 'music' ? 'audio' : 'video'} files into this queue.`, 'error');
      return;
    }
    Promise.all(chosen.map((file) => fallbackMakeItem(file, kind))).then((items) => queueItems(kind, items.filter(Boolean), { markNew: true }));
  }

  function bindDropTarget(panel, kind) {
    if (!panel) return;
    panel.addEventListener('dragenter', (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      event.preventDefault();
      dragCounter += 1;
      byId(kind === 'music' ? 'musicDropHint' : 'videoDropHint')?.classList.add('is-dragging');
      document.body.classList.add('drop-active');
    });
    panel.addEventListener('dragover', (event) => { if (event.dataTransfer?.types?.includes('Files')) event.preventDefault(); });
    panel.addEventListener('dragleave', (event) => {
      if (event.relatedTarget && panel.contains(event.relatedTarget)) return;
      dragCounter = Math.max(0, dragCounter - 1);
      byId(kind === 'music' ? 'musicDropHint' : 'videoDropHint')?.classList.remove('is-dragging');
      if (!dragCounter) document.body.classList.remove('drop-active');
    });
    panel.addEventListener('drop', (event) => {
      event.preventDefault();
      dragCounter = 0;
      document.body.classList.remove('drop-active');
      byId(kind === 'music' ? 'musicDropHint' : 'videoDropHint')?.classList.remove('is-dragging');
      ingestDrop(event.dataTransfer.files, kind);
    });
  }

  function bindEvents() {
    document.querySelectorAll('.icon-slot[data-icon]').forEach((node) => { node.innerHTML = icon(node.dataset.icon); });
    if (bridge.onOpenMedia) bridge.onOpenMedia((files) => { void openAssociatedMedia(files); });
    if (bridge.onExternalStorages) bridge.onExternalStorages((volumes) => {
      externalStorages = Array.isArray(volumes) ? volumes : [];
      externalStorageLoaded = true;
      externalStoragePending = false;
      externalStorageError = '';
      if (isMediaDevicesSettingsOpen()) renderDevices();
    });
    if (bridge.onDiscoveredMedia) bridge.onDiscoveredMedia(handleDiscoveredMedia);
    if (bridge.onSystemAccentChanged) bridge.onSystemAccentChanged((color) => { if (!applySystemAccentColor(color)) void syncSystemAccent(); });
    if (bridge.onMediaResponse) bridge.onMediaResponse(rememberMediaResponse);
    document.querySelectorAll('.nav-item[data-page]').forEach((node) => node.addEventListener('click', () => navigate(node.dataset.page)));
    byId('visualizerStyleToggle').addEventListener('click', toggleVisualizerStyle);
    byId('visualizerWrap')?.addEventListener('dblclick', (event) => {
      if (event.target instanceof Element && event.target.closest('button')) return;
      event.preventDefault();
      toggleMusicPresentation();
    });
    byId('shuffleButton').addEventListener('click', toggleShuffle);
    window.addEventListener('focus', () => {
      resumeAudioContextIfNeeded();
      if (currentPage === 'music') { resizeVisualizer(); startVisualizerLoop(); }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopVisualizerLoop();
      } else {
        resumeAudioContextIfNeeded();
        if (currentPage === 'music') { resizeVisualizer(); startVisualizerLoop(); drawVisualizerSafely(); }
      }
    });

    byId('globalSearch').addEventListener('input', () => renderSearch());
    byId('globalSearch').addEventListener('focus', () => { if (byId('globalSearch').value.trim()) renderSearch(); });
    byId('globalSearch').addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.currentTarget.value = ''; renderSearch(); event.currentTarget.blur(); }
      if (event.key === 'Enter') byId('searchResults').querySelector('.search-result')?.click();
    });
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!target.closest('.search-wrap')) byId('searchResults').hidden = true;
      if (target.closest('.search-result')) byId('searchResults').hidden = true;
      const sortOption = target.closest('[data-sort-option]');
      if (sortOption) {
        const [kind, mode] = (sortOption.dataset.sortOption || '').split(':');
        if (applySortMode(kind, mode)) closeSortMenus(true);
        return;
      }
      const sortTrigger = target.closest('[data-sort-toggle]');
      if (sortTrigger) { toggleSortMenu(sortTrigger); return; }
      if (!target.closest('.sort-menu-host')) closeSortMenus(false);
      const windowAction = target.closest('[data-window]');
      if (windowAction) { bridge.windowAction?.(windowAction.dataset.window); return; }
      const pageButton = target.closest('[data-goto]');
      if (pageButton) { navigate(pageButton.dataset.goto); return; }
      const folderButton = target.closest('[data-pick-folder]');
      if (folderButton) { chooseFolder(folderButton.dataset.pickFolder, 'queue'); return; }
      const settingsFolder = target.closest('[data-settings-folder]');
      if (settingsFolder) { chooseFolder(settingsFolder.dataset.settingsFolder, 'settings'); return; }
      const addFiles = target.closest('[data-add-files]');
      if (addFiles) { chooseFiles(addFiles.dataset.addFiles); return; }
      const remove = target.closest('[data-remove-queue]');
      if (remove) { removeFromQueue(remove.dataset.removeQueue, remove.dataset.removeId); return; }
      const clearQueueButton = target.closest('[data-clear-queue]');
      if (clearQueueButton) { clearQueue(clearQueueButton.dataset.clearQueue); return; }
      const refreshQueueButton = target.closest('[data-refresh-queue]');
      if (refreshQueueButton) { void refreshQueueFromFolder(refreshQueueButton.dataset.refreshQueue, refreshQueueButton); return; }
      const collapse = target.closest('[data-collapse]');
      if (collapse) { byId(collapse.dataset.collapse).classList.add('is-collapsed'); return; }
      const reopen = target.closest('[data-reopen]');
      if (reopen) { byId(reopen.dataset.reopen).classList.remove('is-collapsed'); return; }
      const settingsSectionButton = target.closest('[data-settings-section]');
      if (settingsSectionButton) { activeSettingsSection = settingsSectionButton.dataset.settingsSection; renderSettings(); return; }
      const themeButton = target.closest('[data-setting-theme]');
      if (themeButton) { settings.theme = themeButton.dataset.settingTheme; persistSettings(); applySettings(); renderSettings(); return; }
      const accentButton = target.closest('[data-setting-accent]');
      if (accentButton) {
        settings.accent = accentButton.dataset.settingAccent;
        if (settings.accent !== 'system') settings.lastCustomAccent = settings.accent;
        persistSettings(); applySettings(); renderSettings(); return;
      }
      const discoveryToggle = target.closest('#mediaDiscoveryToggle');
      if (discoveryToggle) {
        settings.mediaDiscoveryEnabled = Boolean(discoveryToggle.checked);
        persistSettings();
        renderDevices();
        toast(settings.mediaDiscoveryEnabled ? 'External-drive media discovery is on.' : 'External-drive media discovery is off.');
        return;
      }
      if (target.closest('#rescanExternalStorage')) {
        if (!bridge.rescanExternalStorages) { loadExternalStorages(); return; }
        externalStoragePending = true;
        externalStorageLoaded = false;
        externalStorageError = '';
        renderDevices();
        Promise.resolve().then(() => bridge.rescanExternalStorages()).then((volumes) => {
          externalStorages = Array.isArray(volumes) ? volumes : externalStorages;
          externalStorageLoaded = true;
        }).catch(() => {
          externalStorageLoaded = true;
          externalStorageError = 'Could not rescan external storage. Try again.';
        }).finally(() => {
          externalStoragePending = false;
          if (isMediaDevicesSettingsOpen()) renderDevices();
        });
        toast('Connected drives refreshed. Only enabled drives will sync while global discovery is on.');
        return;
      }
      const itemNode = target.closest('[data-item-id]');
      if (itemNode) {
        const item = itemLookup.get(itemNode.dataset.itemId);
        if (item) playItem(item);
        return;
      }
      if (target.closest('#recentViewAll')) {
        const item = state.recentPlayed[0];
        if (item) navigate(item.type === 'tv' ? 'tv' : item.type);
        else navigate('music');
        return;
      }
      if (target.closest('#refreshRecommendations')) { renderRecommendations(); return; }
      if (target.closest('#newlyAddedViewAll')) {
        const item = state.newlyAdded[0];
        if (item) navigate(item.type === 'tv' ? 'tv' : item.type);
        else navigate('music');
        return;
      }
      if (target.closest('#playPauseButton')) { togglePlayback(); return; }
      if (target.closest('#previousButton')) { previous(); return; }
      if (target.closest('#nextButton')) { next(); return; }
      if (target.closest('#stopButton')) { stopPlayback(); return; }
      if (target.closest('#repeatButton')) { cycleRepeatMode(); renderPlayerBar(); return; }
      if (target.closest('#videoCenterPlay')) { togglePlayback(); return; }
      if (target.closest('#tvCenterPlay')) { togglePlayback(); return; }
      if (target.closest('#videoFullscreen')) { requestFullscreen(video); return; }
      if (target.closest('#tvFullscreen')) { requestFullscreen(tvVideo); return; }
      if (target.closest('#globalFullscreen')) {
        if (document.fullscreenElement || document.webkitFullscreenElement) requestFullscreen(activeElement());
        else if (currentPage === 'music') enterMusicVisualizerFullscreen();
        else if (currentItem?.type === 'video') requestFullscreen(video);
        else if (currentItem?.type === 'tv') requestFullscreen(tvVideo);
        else navigate('music');
        return;
      }
      if (target.closest('#favoriteButton')) { toggleFavorite(); return; }
      if (target.closest('#muteButton')) { toggleMute(); return; }
      if (target.closest('#refreshTv')) { loadTvCatalog(true); return; }
      if (target.closest('#refreshAllArtwork')) { void refreshAllArtwork(); return; }
      if (target.closest('#fetchAllArtworkNow')) { void fetchAllArtworkNow(); return; }
      if (target.closest('#clearCacheButton')) { clearCaches(); return; }
    });
    document.addEventListener('fullscreenchange', syncFullscreenControls);
    document.addEventListener('webkitfullscreenchange', syncFullscreenControls);
    document.addEventListener('pointermove', handlePlayerFullscreenActivity, { passive: true });
    document.addEventListener('pointerdown', handlePlayerFullscreenActivity, { passive: true });
    document.addEventListener('touchstart', handlePlayerFullscreenActivity, { passive: true });
    document.addEventListener('keydown', handlePlayerFullscreenActivity);
    document.addEventListener('change', (event) => {
      const control = event.target;
      if (control?.matches?.('[data-drive-sync-id]')) {
        const driveId = control.dataset.driveSyncId;
        settings.externalStorageEnabledIds = { ...(settings.externalStorageEnabledIds || {}) };
        if (control.checked) settings.externalStorageEnabledIds[driveId] = true;
        else delete settings.externalStorageEnabledIds[driveId];
        persistSettings();
        renderDevices();
        toast(control.checked
          ? (settings.mediaDiscoveryEnabled ? 'This drive is enabled for automatic media sync.' : 'This drive is selected; turn on global discovery to start syncing.')
          : 'Automatic media sync is off for this drive.');
        return;
      }
      if (control?.id === 'automaticArtworkFetch') {
        settings.automaticArtworkFetch = Boolean(control.checked);
        const stateLabel = control.parentElement?.querySelector('.setting-switch-state');
        if (stateLabel) stateLabel.textContent = settings.automaticArtworkFetch ? 'On' : 'Off';
        persistSettings();
        if (settings.automaticArtworkFetch) {
          const items = collectAllMediaForArtwork();
          clearNegativeArtworkResults(items);
          const queued = scheduleAutomaticArtworkFetch(items);
          setArtworkRefreshStatus(queued ? `Automatic artwork lookup queued for ${queued.toLocaleString()} media items.` : 'Automatic artwork lookup is on. Existing art is up to date.');
          toast(queued ? `Automatic artwork lookup started for ${queued.toLocaleString()} items.` : 'Automatic artwork lookup is on.');
        } else {
          automaticArtworkQueue.length = 0;
          automaticArtworkQueued.clear();
          setArtworkRefreshStatus('Automatic online lookup is off. Use Refresh all artwork for a one-time update.');
          toast('Automatic online artwork lookup is off.');
        }
        return;
      }
      if (control?.id === 'lowGraphicsMode') {
        settings.lowGraphicsMode = Boolean(control.checked);
        applySettings();
        persistSettings();
        return;
      }
      if (control?.id === 'equalizerEnabled') settings.equalizerEnabled = Boolean(control.checked);
      else if (control?.id === 'equalizerPreset') settings.equalizerPreset = EQ_PRESETS[control.value] ? control.value : 'balanced';
      else if (control?.id === 'crossfadeEnabled') settings.crossfadeEnabled = Boolean(control.checked);
      else if (control?.id === 'crossfadeSeconds') settings.crossfadeSeconds = normalizeCrossfadeSeconds(control.value);
      else if (control?.id === 'reverbEnabled') settings.reverbEnabled = Boolean(control.checked);
      else return;
      syncAudioSettingsControls();
      applyAudioSettings();
      persistSettings();
    });
    document.addEventListener('input', (event) => {
      const control = event.target;
      if (control?.id === 'visualizerIntensity') {
        settings.visualizerIntensity = Number(control.value);
        syncRangeProgress(control);
        const value = byId('visualizerIntensityValue');
        if (value) value.textContent = `${settings.visualizerIntensity}%`;
        const label = byId('vizIntensityLabel');
        if (label) label.textContent = `ACCENT · ${settings.accent === 'rgb' ? 'RGB FLOW' : settings.accent.toUpperCase()}`;
        persistSettings(); drawVisualizerSafely();
        return;
      }
      if (control?.id === 'reverbAmount') settings.reverbAmount = Math.max(0, Math.min(60, Number(control.value) || 0));
      else return;
      syncRangeProgress(control);
      syncAudioSettingsControls();
      applyAudioSettings();
      persistSettings();
    });
    document.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-item-id]')) {
        event.preventDefault(); event.target.click();
      }
      if (event.key === 'Escape') {
        if (document.querySelector('.sort-menu:not([hidden])')) { event.preventDefault(); closeSortMenus(true); }
        byId('searchResults').hidden = true;
        return;
      }
      const sortTrigger = event.target.closest?.('[data-sort-toggle]');
      if (sortTrigger && event.key === 'ArrowDown') {
        event.preventDefault(); toggleSortMenu(sortTrigger); return;
      }
      const sortOption = event.target.closest?.('[data-sort-option]');
      if (sortOption && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        const menu = sortOption.closest('.sort-menu');
        const items = [...(menu?.querySelectorAll('[data-sort-option]') || [])];
        const index = items.indexOf(sortOption);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        event.preventDefault(); items[next]?.focus();
      }
    });
    byId('channelSearch').addEventListener('input', renderChannels);
    byId('timeline').addEventListener('input', (event) => {
      if (currentItem?.type === 'music' && musicTransition) cancelMusicTransition(activeMusicDeckIndex);
      const active = activeElement();
      if (active && Number.isFinite(active.duration) && currentItem?.type !== 'tv') active.currentTime = Number(event.target.value);
    });
    byId('volumeRange').value = String(state.volume ?? .72);
    byId('volumeRange').style.setProperty('--volume-progress', `${(state.volume ?? .72) * 100}%`);
    byId('volumeRange').addEventListener('input', (event) => {
      state.volume = Number(event.target.value);
      muted = state.volume <= 0;
      applyPlaybackVolumes();
      byId('volumeRange').style.setProperty('--volume-progress', `${state.volume * 100}%`);
      updateMuteIcon();
      persistState();
    });
    byId('fallbackFolderPicker').addEventListener('change', handleFallbackFolderChange);
    byId('fallbackFilePicker').addEventListener('change', handleFallbackFileChange);
    byId('musicQueuePanel').addEventListener('click', (event) => { if (event.target.closest('.queue-drop-hint') && !state.musicQueue.length) chooseFiles('music'); });
    byId('videoQueuePanel').addEventListener('click', (event) => { if (event.target.closest('.queue-drop-hint') && !state.videoQueue.length) chooseFiles('video'); });
    bindDropTarget(byId('musicQueuePanel'), 'music');
    bindDropTarget(byId('videoQueuePanel'), 'video');
    window.addEventListener('resize', () => {
      resizeVisualizer();
      if (currentPage === 'music' && !document.hidden) {
        startVisualizerLoop();
        drawVisualizerSafely();
      }
    });
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (settings.theme === 'system') applySettings();
      });
    } catch { /* older WebViews may not expose live system-theme changes */ }
    window.addEventListener('beforeunload', persistState);
    mediaEls.forEach(bindMediaEvents);
    updateMuteIcon();
    if (bridge.onWindowState) bridge.onWindowState((maximized, squareCorners) => {
      document.body.classList.toggle('window-maximized', maximized);
      document.body.classList.toggle('window-square-corners', squareCorners);
      syncWindowAppearance();
    });
    if (!bridge.isDesktop) document.body.classList.add('browser-preview');
  }

  function updateMuteIcon() {
    const button = byId('muteButton');
    button.innerHTML = `<span class="icon-slot">${icon(muted || Number(state.volume) === 0 ? 'mute' : 'volume')}</span>`;
    button.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  }

  function toggleMute() {
    muted = !muted;
    applyPlaybackVolumes();
    updateMuteIcon();
  }

  function toggleFavorite() {
    if (!currentItem) return;
    const id = mediaId(currentItem);
    const idx = state.favorites.indexOf(id);
    if (idx === -1) { state.favorites.push(id); toast('Added to favorites.'); }
    else { state.favorites.splice(idx,1); toast('Removed from favorites.'); }
    renderPlayerBar();
    persistState();
  }

  async function clearCaches() {
    const confirmed = window.confirm('Clear application caches, reset the default Music and Video folders, and empty both queues? Your actual music and video files will not be deleted or changed.');
    if (!confirmed) return;
    state.musicQueue = [];
    state.videoQueue = [];
    settings.defaultMusicFolder = '';
    settings.defaultVideoFolder = '';
    persistState();
    persistSettings();
    renderQueue('music');
    renderQueue('video');
    renderSettings();
    if (!bridge.clearApplicationCaches) {
      toast('Queues cleared and default folders reset. Cache cleanup is available in the Windows desktop app.');
      return;
    }
    try {
      const result = await bridge.clearApplicationCaches();
      if (result?.foldersReset === false) {
        toast('Queues cleared, but the default folder settings could not be saved. Please try again.', 'error');
      } else {
        toast('Cache cleared, default folders reset, and both queues emptied. Your actual media files were not touched.');
      }
    } catch (error) {
      toast(`Queues cleared and folders reset, but cache cleanup failed: ${error?.message || error}`, 'error');
    }
  }

  function enterMusicVisualizerFullscreen() {
    const target = byId('appShell');
    if (!target) return;
    const enter = target.requestFullscreen || target.webkitRequestFullscreen;
    if (!enter) { toast('Fullscreen is not available in this browser preview.'); return; }
    document.body.classList.add('music-visualizer-fullscreen');
    try {
      const result = enter.call(target);
      if (result?.catch) result.catch(() => {
        document.body.classList.remove('music-visualizer-fullscreen');
        toast('Could not enter visualizer fullscreen.', 'error');
      });
    } catch {
      document.body.classList.remove('music-visualizer-fullscreen');
      toast('Could not enter visualizer fullscreen.', 'error');
    }
  }

  function syncNativeMusicPresentationMode(enabled) {
    if (typeof bridge.setMusicPresentationMode !== 'function') return;
    Promise.resolve(bridge.setMusicPresentationMode(enabled)).catch(() => {});
  }

  function toggleMusicPresentation() {
    if (document.body.classList.contains('music-presentation')) {
      exitMusicPresentation();
      return;
    }
    if (currentPage !== 'music') return;
    document.body.classList.add('music-presentation');
    syncNativeMusicPresentationMode(true);
    syncVisualizerStyleControl();
    window.requestAnimationFrame(() => {
      resizeVisualizer();
      drawVisualizerSafely();
    });
  }

  function exitMusicPresentation() {
    if (!document.body.classList.contains('music-presentation')) return;
    document.body.classList.remove('music-presentation');
    syncNativeMusicPresentationMode(false);
    syncVisualizerStyleControl();
    window.requestAnimationFrame(() => {
      resizeVisualizer();
      drawVisualizerSafely();
    });
  }

  function clearPlayerFullscreenMode() {
    window.clearTimeout(playerOverlayHideTimer);
    playerOverlayHideTimer = 0;
    document.body.classList.remove('media-player-fullscreen', 'media-player-fullscreen-video', 'media-player-fullscreen-tv', 'player-overlays-hidden');
  }

  function schedulePlayerOverlayHide() {
    window.clearTimeout(playerOverlayHideTimer);
    playerOverlayHideTimer = 0;
    if (!document.body.classList.contains('media-player-fullscreen')) return;
    playerOverlayHideTimer = window.setTimeout(() => {
      if (document.body.classList.contains('media-player-fullscreen'))
        document.body.classList.add('player-overlays-hidden');
      playerOverlayHideTimer = 0;
    }, 5000);
  }

  function handlePlayerFullscreenActivity() {
    if (!document.body.classList.contains('media-player-fullscreen')) return;
    document.body.classList.remove('player-overlays-hidden');
    schedulePlayerOverlayHide();
  }

  function syncFullscreenControls() {
    const active = document.fullscreenElement || document.webkitFullscreenElement || null;
    const appShell = byId('appShell');
    const mediaFullscreen = active === appShell && document.body.classList.contains('media-player-fullscreen');
    if (!active) {
      document.body.classList.remove('music-visualizer-fullscreen');
      clearPlayerFullscreenMode();
    } else if (document.body.classList.contains('media-player-fullscreen') && !mediaFullscreen) {
      clearPlayerFullscreenMode();
    } else if (mediaFullscreen) {
      document.body.classList.remove('player-overlays-hidden');
      schedulePlayerOverlayHide();
    }
    window.requestAnimationFrame(() => {
      resizeVisualizer();
      if (currentPage === 'music') drawVisualizerSafely();
    });
    for (const [buttonId, frameId, type] of [['videoFullscreen', 'videoFrame', 'video'], ['tvFullscreen', 'tvFrame', 'tv']]) {
      const button = byId(buttonId);
      if (!button) continue;
      const isActive = (mediaFullscreen && document.body.classList.contains(`media-player-fullscreen-${type}`)) || active === byId(frameId);
      button.setAttribute('aria-label', isActive ? 'Exit fullscreen' : 'Enter fullscreen');
      button.title = isActive ? 'Exit fullscreen' : 'Fullscreen';
      const slot = button.querySelector('.icon-slot');
      if (slot) slot.innerHTML = icon(isActive ? 'fullscreen-exit' : 'fullscreen');
    }
    const globalButton = byId('globalFullscreen');
    if (globalButton) {
      const isActive = Boolean(active);
      globalButton.setAttribute('aria-label', isActive ? 'Exit fullscreen' : 'Fullscreen player');
      globalButton.title = isActive ? 'Exit fullscreen' : 'Fullscreen player';
      const slot = globalButton.querySelector('.icon-slot');
      if (slot) slot.innerHTML = icon(isActive ? 'fullscreen-exit' : 'fullscreen');
    }
  }

  function requestFullscreen(element) {
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    if (active) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (!exit) { toast('Fullscreen is not available in this browser preview.'); return; }
      try {
        const result = exit.call(document);
        if (result?.catch) result.catch(() => toast('Could not exit fullscreen.', 'error'));
      } catch { toast('Could not exit fullscreen.', 'error'); }
      return;
    }
    if (!element) return;
    const frame = element.closest('.video-frame');
    const type = frame?.id === 'tvFrame' ? 'tv' : frame ? 'video' : '';
    const target = type ? byId('appShell') : frame || element;
    const enter = target?.requestFullscreen || target?.webkitRequestFullscreen;
    if (!enter) { toast('Fullscreen is not available in this browser preview.'); return; }
    if (type) {
      clearPlayerFullscreenMode();
      document.body.classList.add('media-player-fullscreen', `media-player-fullscreen-${type}`);
      handlePlayerFullscreenActivity();
    }
    try {
      const result = enter.call(target);
      if (result?.catch) result.catch(() => {
        clearPlayerFullscreenMode();
        toast('Fullscreen is not available in this window.', 'error');
      });
    } catch {
      clearPlayerFullscreenMode();
      toast('Fullscreen is not available in this window.', 'error');
    }
  }

  async function scanSavedFolder(kind) {
    if (!bridge.scanFolder) return;
    const folder = kind === 'music' ? settings.defaultMusicFolder : settings.defaultVideoFolder;
    if (!folder) return;
    try {
      const files = await bridge.scanFolder(folder, kind);
      if (files?.length) addToLibrary(kind, files, true);
    } catch { /* An unavailable default folder should not prevent app startup. */ }
  }

  function visualizerPixelRatio() {
    return Math.min(settings.lowGraphicsMode ? 1 : 1.5, window.devicePixelRatio || 1);
  }

  function resizeVisualizer() {
    const canvas = byId('visualizer');
    const box = canvas?.getBoundingClientRect();
    if (!canvas || !box?.width || !box?.height) return;
    const ratio = visualizerPixelRatio();
    const pixelWidth = Math.floor(box.width * ratio);
    const pixelHeight = Math.floor(box.height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const context = canvas.getContext('2d');
    if (context) context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function observeVisualizerBounds() {
    const target = byId('visualizerWrap');
    if (!target || typeof ResizeObserver !== 'function' || visualizerResizeObserver) return;
    visualizerResizeObserver = new ResizeObserver(() => {
      resizeVisualizer();
      if (currentPage === 'music') drawVisualizerSafely();
    });
    visualizerResizeObserver.observe(target);
  }

  function resetVisualizerCanvas() {
    const canvas = byId('visualizer');
    if (!canvas) return;
    try {
      const context = canvas.getContext('2d');
      if (typeof context?.reset === 'function') context.reset();
      else {
        const width = canvas.width;
        const height = canvas.height;
        canvas.width = width;
        canvas.height = height;
      }
    } catch { /* the next render will retry with a fresh canvas state */ }
    resizeVisualizer();
  }

  function reportVisualizerDrawError(error) {
    try { resetVisualizerCanvas(); } catch { /* keep the animation recovery path alive */ }
    const now = Date.now();
    if (now - visualizerLastErrorAt > 5000) {
      visualizerLastErrorAt = now;
      console.warn('Visualizer frame failed; canvas reset and animation will retry.', error);
    }
  }

  function drawVisualizerSafely() {
    try {
      drawVisualizer();
      return true;
    } catch (error) {
      reportVisualizerDrawError(error);
      return false;
    }
  }

  function cssAccentRgb() {
    const raw = getComputedStyle(document.body).getPropertyValue('--accent-rgb').trim();
    return raw || '90, 154, 104';
  }

  function smoothVisualizerValue(target, current, delta, attack = 0.10, release = 0.34) {
    const timeConstant = target > current ? attack : release;
    const blend = 1 - Math.exp(-delta / timeConstant);
    return current + (target - current) * blend;
  }

  function visualizerSignal() {
    const rgb = cssAccentRgb();
    const strength = (Number(settings.visualizerIntensity) || 70) / 100;
    const musicActive = currentItem?.type === 'music' && musicMediaIsPlaying();
    let bass = 0;
    let mids = 0;
    let average = 0;
    let hasAnalyserData = false;
    if (analyser && analyserBuffer && musicActive) {
      try {
        analyser.getByteFrequencyData(analyserBuffer);
        const bassEnd = Math.max(1, Math.floor(analyserBuffer.length * .11));
        const midEnd = Math.max(bassEnd + 1, Math.floor(analyserBuffer.length * .52));
        for (let i = 0; i < analyserBuffer.length; i += 1) {
          const value = analyserBuffer[i] / 255;
          average += value;
          if (i < bassEnd) bass += value;
          else if (i < midEnd) mids += value;
        }
        bass = bass / bassEnd;
        mids = mids / (midEnd - bassEnd);
        average /= analyserBuffer.length;
        hasAnalyserData = average > .003;
      } catch {
        analyserBuffer.fill(0);
      }
    }
    const now = performance.now();
    const time = now / 1000;
    const delta = previousVizTime ? Math.min(.12, Math.max(.016, time - previousVizTime)) : 1 / 30;
    previousVizTime = time;
    smoothVizBass = smoothVisualizerValue(musicActive ? bass : 0, smoothVizBass, delta, .085, .32);
    smoothVizMids = smoothVisualizerValue(musicActive ? mids : 0, smoothVizMids, delta, .105, .36);
    smoothVizAverage = smoothVisualizerValue(musicActive ? average : 0, smoothVizAverage, delta, .12, .38);
    const synthetic = musicActive ? .18 + (Math.sin(time * 3.1) + 1) * .10 : .025;
    const rawOnset = musicActive ? Math.min(.62, Math.max(0, smoothVizBass - previousVizBass) / delta * .10) : 0;
    smoothVizOnset = smoothVisualizerValue(rawOnset, smoothVizOnset, delta, .065, .28);
    previousVizBass = smoothVizBass;
    const bassDrive = Math.min(1, smoothVizBass * 2.25);
    const midDrive = Math.min(1, smoothVizMids * 1.5);
    const averageDrive = Math.min(1, smoothVizAverage * 1.35);
    const reactivity = musicActive ? Math.min(1, Math.max(synthetic, bassDrive, midDrive, averageDrive, smoothVizOnset * 1.15)) : .025;
    const beat = musicActive ? Math.min(1, Math.max(synthetic, smoothVizBass * 1.8, smoothVizAverage * .9, smoothVizOnset)) : .025;
    return { rgb, strength, beat, reactivity, bass: smoothVizBass, mids: smoothVizMids, average: smoothVizAverage, onset: smoothVizOnset, time, playing: musicActive, spectrum: musicActive && hasAnalyserData ? analyserBuffer : null };
  }

  function drawVisualizer() {
    const canvas = byId('visualizer');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (!canvas.width || !canvas.height) resizeVisualizer();
    const context = canvas.getContext('2d');
    if (!context) return;
    const ratio = visualizerPixelRatio();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const width = rect.width;
    const height = rect.height;
    context.clearRect(0, 0, width, height);
    const signal = visualizerSignal();
    if (document.body.classList.contains('music-presentation') || settings.visualizerStyle === 'cd') drawCdVisualizer(context, width, height, signal);
    else if (settings.visualizerStyle === 'topographic') drawTopographicVisualizer(context, width, height, signal);
    else if (settings.visualizerStyle === 'minimal') drawMinimalSpectrumVisualizer(context, width, height, signal);
    else drawXmbWaveVisualizer(context, width, height, signal);
  }

  function loadCdCoverImage() {
    const source = currentItem?.type === 'music' ? artworkUrlFor(currentItem) : '';
    if (source === cdCoverUrl) {
      return cdCoverImage?.complete && cdCoverImage.naturalWidth > 0 ? cdCoverImage : null;
    }
    cdCoverUrl = source;
    cdCoverImage = null;
    if (!source) return null;
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (cdCoverUrl === source) {
        cdCoverImage = image;
        drawVisualizerSafely();
      }
    };
    image.onerror = () => { if (cdCoverUrl === source) cdCoverImage = null; };
    image.src = source;
    cdCoverImage = image;
    return null;
  }

  function cdAccentPaint(context, x, y, rotation, rgb) {
    if (settings.accent !== 'rgb' || typeof context.createConicGradient !== 'function') return `rgba(${rgb}, .98)`;
    const gradient = context.createConicGradient(rotation, x, y);
    const colors = ['#e7717f', '#e9b74c', '#69be89', '#50b8cf', '#9778e7', '#e771b5', '#e7717f'];
    colors.forEach((color, index) => gradient.addColorStop(index / (colors.length - 1), color));
    return gradient;
  }

  function drawCdVisualizer(context, width, height, signal) {
    const { rgb, strength, beat, onset, time, spectrum } = signal;
    const bass = Math.max(0, Number(signal.bass) || 0);
    const mids = Math.max(0, Number(signal.mids) || 0);
    const reactivity = Math.max(0, Number(signal.reactivity) || 0);
    const lowGraphics = Boolean(settings.lowGraphicsMode);
    const delta = cdLastFrameTime ? Math.min(.08, Math.max(0, time - cdLastFrameTime)) : 0;
    cdLastFrameTime = time;
    const playing = Boolean(signal.playing);
    const activity = playing ? Math.max(beat, reactivity * .92, bass * 2.1, mids * 1.35) : 0;
    const targetKick = playing ? Math.min(1, onset * 2.2 + bass * 1.15) : 0;
    const targetPulse = playing
      ? Math.max(0, Math.min(1, (activity * 1.08 + targetKick * .5 + Math.min(1, mids * 1.2) * .15) * (.72 + strength * .48)))
      : 0;
    cdPlaybackBlend = smoothVisualizerValue(playing ? 1 : 0, cdPlaybackBlend, delta, .34, .48);
    cdSmoothedPulse = smoothVisualizerValue(targetPulse, cdSmoothedPulse, delta, .12, .36);
    cdSmoothedKick = smoothVisualizerValue(targetKick, cdSmoothedKick, delta, .06, .24);
    const pulse = cdSmoothedPulse;
    const kick = cdSmoothedKick;
    const targetSpinSpeed = playing ? 1.55 + beat * 1.05 + kick * .72 + Math.min(.35, bass * .42) : .28;
    cdSmoothedSpinSpeed = smoothVisualizerValue(targetSpinSpeed, cdSmoothedSpinSpeed, delta, .58, .82);
    const spinSpeed = .24 + (cdSmoothedSpinSpeed - .24) * cdPlaybackBlend;
    // Keep the phase continuous: wrapping this value while the sheen uses a fractional
    // phase caused an obvious reflection jump every revolution.
    cdRotation += delta * spinSpeed;

    const presentationMode = document.body.classList.contains('music-presentation');
    const cx = width * .5;
    const cy = height * .49;
    const radius = Math.max(42, Math.min(width * .245, height * (presentationMode ? .34 : .31)));
    const ringRadius = radius * (1.045 + pulse * .027 + kick * .016);
    const ringPaint = cdAccentPaint(context, cx, cy, -Math.PI / 2 + time * .18, rgb);

    const aura = context.createRadialGradient(cx, cy, radius * 1.02, cx, cy, radius * (1.34 + pulse * .10 + kick * .06));
    aura.addColorStop(0, `rgba(${rgb}, ${.012 + pulse * .045 + kick * .035})`);
    aura.addColorStop(.72, `rgba(${rgb}, ${.008 + pulse * .028 + kick * .022})`);
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = aura;
    context.fillRect(cx - radius * 1.5, cy - radius * 1.5, radius * 3, radius * 3);

    const segments = lowGraphics ? 96 : 160;
    context.save();
    context.beginPath();
    for (let i = 0; i <= segments; i += 1) {
      const progress = i / segments;
      const angle = progress * Math.PI * 2 - Math.PI / 2;
      const circularSpectrumPosition = .5 - .5 * Math.cos(progress * Math.PI * 2);
      const bin = spectrum?.length ? Math.min(spectrum.length - 1, 2 + Math.floor(circularSpectrumPosition * Math.min(54, spectrum.length - 3))) : 0;
      const energy = spectrum?.length ? spectrum[bin] / 255 : .05 + (Math.sin(time * 2.5 + angle * 5) + 1) * .025;
      const spectralMotion = Math.pow(Math.max(0, energy), .72);
      const beatRipple = Math.sin(angle * 6 - time * (5.2 + beat * 4 + kick * 2)) * (.002 + onset * .009 + kick * .006);
      const localRadius = ringRadius + radius * (.002 + pulse * .016 + spectralMotion * .045 + beatRipple);
      const x = cx + Math.cos(angle) * localRadius;
      const y = cy + Math.sin(angle) * localRadius;
      if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.closePath();
    context.strokeStyle = ringPaint;
    context.lineWidth = 1.15 + pulse * 1.25 + kick * .45;
    context.shadowColor = `rgba(${rgb}, ${.38 + pulse * .32 + kick * .18})`;
    context.shadowBlur = lowGraphics ? 0 : 5 + pulse * 10 + kick * 6;
    context.stroke();
    context.shadowBlur = 0;
    context.globalAlpha = .20 + pulse * .18 + kick * .12;
    context.beginPath();
    context.arc(cx, cy, radius * (1.105 + pulse * .035 + kick * .02), 0, Math.PI * 2);
    context.strokeStyle = ringPaint;
    context.lineWidth = .75 + pulse * .55 + kick * .35;
    context.stroke();
    context.restore();

    const cover = loadCdCoverImage();
    context.save();
    context.translate(cx, cy);
    const discScale = 1 + cdPlaybackBlend * .009 + pulse * .018 + kick * .008;
    context.scale(discScale, discScale);
    context.rotate(cdRotation);

    const discGradient = context.createRadialGradient(0, 0, radius * .018, 0, 0, radius);
    discGradient.addColorStop(0, '#3c4650');
    discGradient.addColorStop(.075, '#10161c');
    discGradient.addColorStop(.105, '#adb8c1');
    discGradient.addColorStop(.16, '#47535e');
    discGradient.addColorStop(.24, '#d2d8dc');
    discGradient.addColorStop(.32, '#687580');
    discGradient.addColorStop(.43, '#c3cbd1');
    discGradient.addColorStop(.55, '#414e59');
    discGradient.addColorStop(.67, '#b7c1c8');
    discGradient.addColorStop(.79, '#65727d');
    discGradient.addColorStop(.91, '#cbd2d7');
    discGradient.addColorStop(.975, '#596671');
    discGradient.addColorStop(1, '#26323c');
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fillStyle = discGradient;
    context.fill();

    context.save();
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.clip();
    if (typeof context.createConicGradient === 'function') {
      const sheen = context.createConicGradient(-cdRotation * .42, 0, 0);
      const sheenColors = settings.accent === 'rgb'
        ? ['rgba(241,126,151,.16)', 'rgba(246,206,120,.13)', 'rgba(135,215,167,.15)', 'rgba(113,211,231,.17)', 'rgba(174,153,245,.15)', 'rgba(239,148,211,.14)', 'rgba(241,126,151,.16)']
        : ['rgba(255,255,255,.18)', `rgba(${rgb},.16)`, 'rgba(255,255,255,.045)', 'rgba(157,215,228,.10)', `rgba(${rgb},.075)`, 'rgba(255,255,255,.045)', 'rgba(255,255,255,.18)'];
      sheenColors.forEach((color, index) => sheen.addColorStop(index / (sheenColors.length - 1), color));
      context.globalAlpha = Math.min(.94, .82 + pulse * .08 + kick * .06);
      context.fillStyle = sheen;
      context.fillRect(-radius, -radius, radius * 2, radius * 2);
      context.globalAlpha = 1;
    }

    // Fine, low-contrast data-track rings: a CD's mirrored surface is smooth,
    // unlike the deep alternating grooves of a vinyl record.
    const trackRings = lowGraphics ? 5 : 9;
    for (let i = 0; i < trackRings; i += 1) {
      const progress = i / Math.max(1, trackRings - 1);
      const trackRadius = radius * (.43 + progress * .53);
      context.beginPath();
      context.arc(0, 0, trackRadius, 0, Math.PI * 2);
      context.strokeStyle = i % 2 ? 'rgba(250,253,255,.10)' : 'rgba(20,30,39,.09)';
      context.lineWidth = i % 3 === 0 ? .72 : .48;
      context.stroke();
    }

    const reflection = context.createLinearGradient(-radius, -radius, radius, radius);
    reflection.addColorStop(0, 'rgba(255,255,255,.19)');
    reflection.addColorStop(.33, 'rgba(255,255,255,.018)');
    reflection.addColorStop(.72, 'rgba(255,255,255,.055)');
    reflection.addColorStop(1, 'rgba(255,255,255,.012)');
    context.fillStyle = reflection;
    context.fillRect(-radius, -radius, radius * 2, radius * 2);
    context.restore();

    const labelRadius = radius * .365;
    context.save();
    context.beginPath();
    context.arc(0, 0, labelRadius, 0, Math.PI * 2);
    context.clip();
    if (cover) {
      const side = Math.min(cover.naturalWidth, cover.naturalHeight);
      const sx = (cover.naturalWidth - side) * .5;
      const sy = (cover.naturalHeight - side) * .5;
      context.drawImage(cover, sx, sy, side, side, -labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
    } else {
      const label = context.createLinearGradient(-labelRadius, -labelRadius, labelRadius, labelRadius);
      label.addColorStop(0, `rgba(${rgb}, .98)`);
      label.addColorStop(1, '#26313d');
      context.fillStyle = label;
      context.fillRect(-labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
      if (currentItem?.type === 'music') {
        context.fillStyle = '#fff';
        context.font = `700 ${Math.max(11, labelRadius * .55)}px Segoe UI, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(initials(titleFor(currentItem)), 0, 0, labelRadius * 1.55);
      }
    }
    context.restore();

    context.beginPath();
    context.arc(0, 0, labelRadius, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(248,252,255,.72)';
    context.lineWidth = 1.35;
    context.stroke();
    context.beginPath();
    context.arc(0, 0, radius * .382, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(24,34,42,.24)';
    context.lineWidth = .7;
    context.stroke();
    context.beginPath();
    context.arc(0, 0, radius * .055, 0, Math.PI * 2);
    context.fillStyle = '#151920';
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,.74)';
    context.lineWidth = 1.1;
    context.stroke();
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(255,255,255,.38)';
    context.lineWidth = 1;
    context.stroke();
    context.restore();
  }

  function drawMinimalSpectrumVisualizer(context, width, height, signal) {
    const { rgb, strength, time, spectrum } = signal;
    const lowGraphics = Boolean(settings.lowGraphicsMode);
    const count = Math.max(lowGraphics ? 18 : 24, Math.min(lowGraphics ? 48 : 72, Math.floor(width / (lowGraphics ? 18 : 12))));
    const span = width * .82;
    const step = span / count;
    const barWidth = Math.max(1.5, Math.min(4, step * .38));
    const startX = (width - span) / 2 + (step - barWidth) / 2;
    const fullscreenInset = document.body.classList.contains('music-visualizer-fullscreen')
      ? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--player-height')) || 82)
      : 0;
    const usableHeight = Math.max(1, height - fullscreenInset);
    const baseline = Math.max(2, usableHeight - Math.min(38, Math.max(12, usableHeight * .1)));
    context.save();
    context.lineCap = 'round';
    context.strokeStyle = `rgba(${rgb}, .16)`;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(startX - step * .3, baseline + 1);
    context.lineTo(startX + span + step * .3, baseline + 1);
    context.stroke();
    for (let i = 0; i < count; i += 1) {
      const position = (i + .5) / count;
      let level;
      if (spectrum?.length) {
        const bin = Math.min(spectrum.length - 1, 1 + Math.floor((position ** 2.15) * (spectrum.length - 2)));
        const lo = Math.max(0, bin - 1);
        const hi = Math.min(spectrum.length - 1, bin + 2);
        let energy = 0;
        for (let j = lo; j < hi; j += 1) energy += spectrum[j] / 255;
        level = energy / Math.max(1, hi - lo);
      } else {
        level = .025 + ((Math.sin(time * 1.7 + i * .44) + 1) * .022);
      }
      const contour = .42 + Math.pow(Math.sin(Math.PI * position), .7) * .55;
      const barHeight = Math.min(usableHeight * .3, Math.max(2, usableHeight * (.025 + Math.sqrt(Math.max(0, level)) * .44 * strength) * contour));
      const x = startX + i * step;
      const y = baseline - barHeight;
      context.fillStyle = `rgba(${rgb}, ${Math.min(.82, .34 + level * .9)})`;
      context.beginPath();
      if (typeof context.roundRect === 'function') context.roundRect(x, y, barWidth, barHeight, barWidth / 2);
      else context.rect(x, y, barWidth, barHeight);
      context.fill();
    }
    context.restore();
  }

  function drawXmbWaveVisualizer(context, width, height, signal) {
    const { rgb, strength, beat, time } = signal;
    const lowGraphics = Boolean(settings.lowGraphicsMode);
    const center = height * .56;
    const phase = time * (0.72 + strength * .16);
    const layers = lowGraphics ? 6 : 9;
    const sampleStep = lowGraphics ? 10 : 6;
    for (let layer = 0; layer < layers; layer += 1) {
      const depth = layer / (layers - 1);
      const baseY = center - height * .12 + depth * height * .26;
      const amplitude = (9 + depth * 27) * strength * (0.58 + beat * 1.35);
      const frequency = .0093 + depth * .0027;
      context.beginPath();
      for (let x = -8; x <= width + 8; x += sampleStep) {
        const normalized = x / width;
        const envelope = Math.sin(Math.PI * normalized) * .62 + .38;
        const wave = Math.sin(x * frequency + phase + depth * 2.2) * amplitude;
        const second = Math.sin(x * frequency * .48 - phase * .74 + depth * 1.7) * amplitude * .34;
        const y = baseY + (wave + second) * envelope;
        if (x === -8) context.moveTo(x, y); else context.lineTo(x, y);
      }
      const opacity = .045 + (1 - depth) * .18 + beat * .10;
      context.strokeStyle = `rgba(${rgb}, ${Math.min(.5, opacity)})`;
      context.lineWidth = 1.1 + (1 - depth) * .8 + beat * 1.4;
      context.shadowColor = `rgba(${rgb}, ${.4 + beat * .28})`;
      context.shadowBlur = lowGraphics ? 0 : 5 + beat * 7;
      context.stroke();
    }
    context.shadowBlur = 0;
    for (let i = 0; i < (lowGraphics ? 3 : 6); i += 1) {
      const x = width * (.12 + i * .145) + Math.sin(time * .32 + i * 3.1) * 17;
      const y = height * (.18 + ((i * 17) % 43) / 100) + Math.cos(time * .23 + i) * 10;
      const radius = 1 + (i % 3) * .55 + beat * 1.5;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(${rgb}, ${.16 + beat * .2})`;
      context.fill();
    }
  }

  function drawTopographicVisualizer(context, width, height, signal) {
    const { rgb, strength, beat, time } = signal;
    const reactivity = Math.max(beat, Number(signal.reactivity) || 0);
    const onset = Number(signal.onset) || 0;
    const minimum = Math.min(width, height);
    const lowGraphics = Boolean(settings.lowGraphicsMode);
    const pulse = reactivity * strength;
    const motionTime = time * (.58 + reactivity * 3.1);
    const centerX = width * (.5 + Math.sin(motionTime * .16) * (.012 + pulse * .012));
    const centerY = height * (.52 + Math.cos(motionTime * .2) * (.014 + pulse * .014));
    const aura = context.createRadialGradient(centerX, centerY, minimum * .025, centerX, centerY, minimum * .78);
    aura.addColorStop(0, `rgba(${rgb}, ${.075 + pulse * .2})`);
    aura.addColorStop(.58, `rgba(${rgb}, ${.025 + pulse * .07})`);
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = aura;
    context.fillRect(0, 0, width, height);

    const islands = [
      { x: .50, y: .53, sx: 1.95, sy: 1.12, scale: 1, layers: lowGraphics ? 9 : 16, phase: .2 },
      { x: .23, y: .64, sx: .94, sy: .66, scale: .62, layers: lowGraphics ? 5 : 10, phase: 2.4 },
      { x: .79, y: .37, sx: .88, sy: .61, scale: .58, layers: lowGraphics ? 5 : 10, phase: 4.2 }
    ];
    const segments = lowGraphics ? 64 : 96;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (let group = 0; group < islands.length; group += 1) {
      const island = islands[group];
      const islandTime = time * (.48 + reactivity * 3.4);
      const cx = width * island.x + Math.sin(islandTime + island.phase) * width * (.004 + pulse * .02);
      const cy = height * island.y + Math.cos(islandTime * .83 + island.phase) * height * (.006 + pulse * .018);
      for (let level = 0; level < island.layers; level += 1) {
        const depth = level / (island.layers - 1);
        const baseRadius = minimum * (.065 + depth * .145) * island.scale;
        const displacement = minimum * (.006 + strength * .012 + pulse * .022 + onset * .014) * island.scale;
        context.beginPath();
        for (let segment = 0; segment <= segments; segment += 1) {
          const angle = segment / segments * Math.PI * 2;
          const broad = Math.sin(angle * 3 + islandTime * .74 + island.phase + depth * 2.1) * (.045 + pulse * .055);
          const middle = Math.cos(angle * 5 - islandTime * 1.1 + island.phase * 1.7) * (.035 + pulse * .045);
          const detail = Math.sin(angle * 9 + islandTime * 1.25 + level * .31 + island.phase) * (.018 + pulse * .03);
          const beatRipple = Math.sin(angle * 2 - time * (2.2 + reactivity * 7) + level * .23) * (pulse * .075 + onset * .08);
          const swell = Math.sin(time * (1.8 + reactivity * 5) + island.phase + level * .28) * pulse * .04;
          const contourNoise = Math.sin(angle * 4 + islandTime + island.phase) * .58 + Math.cos(angle * 7 - islandTime * .7 + depth) * .3;
          const radius = baseRadius * (1 + broad + middle + detail + beatRipple + swell) + displacement * contourNoise;
          const x = cx + Math.cos(angle) * radius * island.sx;
          const y = cy + Math.sin(angle) * radius * island.sy;
          if (segment === 0) context.moveTo(x, y); else context.lineTo(x, y);
        }
        const opacity = Math.min(.62, .12 + (1 - depth) * .065 + pulse * .24 + onset * .06);
        context.strokeStyle = `rgba(${rgb}, ${opacity})`;
        context.lineWidth = .8 + (1 - depth) * .45 + pulse * 1.8 + onset * .65;
        context.shadowColor = `rgba(${rgb}, ${.4 + pulse * .52})`;
        context.shadowBlur = lowGraphics ? 0 : level % 4 === 0 ? 4 + pulse * 8 + onset * 3 : 0;
        context.stroke();
      }
    }
    context.shadowBlur = 0;
    for (let i = 0; i < (lowGraphics ? 5 : 7); i += 1) {
      const x = width * (.08 + i * .105) + Math.sin(motionTime * .3 + i * 2.5) * (13 + pulse * 22);
      const y = height * (.2 + ((i * 19) % 57) / 100) + Math.cos(motionTime * .25 + i * 1.4) * (8 + pulse * 15);
      const radius = .7 + (i % 3) * .35 + pulse * 2.6 + onset * 1.6;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(${rgb}, ${Math.min(.78, .13 + pulse * .46 + onset * .14)})`;
      context.fill();
    }
  }

  function stopVisualizerLoop() {
    if (visualizerFrameRequest) cancelAnimationFrame(visualizerFrameRequest);
    if (visualizerTimer) clearTimeout(visualizerTimer);
    visualizerFrameRequest = 0;
    visualizerTimer = 0;
  }

  function requestVisualizerFrame() {
    if (document.hidden || currentPage !== 'music') return;
    try {
      visualizerFrameRequest = window.requestAnimationFrame(animationLoop);
    } catch {
      visualizerFrameRequest = 0;
      visualizerTimer = window.setTimeout(() => {
        visualizerTimer = 0;
        animationLoop();
      }, 1000 / 30);
    }
  }

  function startVisualizerLoop() {
    if (visualizerFrameRequest || visualizerTimer || document.hidden || currentPage !== 'music') return;
    requestVisualizerFrame();
  }

  function animationLoop() {
    visualizerFrameRequest = 0;
    if (document.hidden || currentPage !== 'music') return;
    const frameInterval = settings.lowGraphicsMode ? 1000 / 24 : 1000 / 30;
    try {
      drawVisualizerSafely();
    } catch (error) {
      reportVisualizerDrawError(error);
    } finally {
      if (!document.hidden && currentPage === 'music') {
        visualizerTimer = window.setTimeout(() => {
          visualizerTimer = 0;
          requestVisualizerFrame();
        }, frameInterval);
      } else {
        visualizerTimer = 0;
      }
    }
  }

  async function loadPreferences() {
    const platformRequest = bridge.getPlatform
      ? Promise.resolve().then(() => bridge.getPlatform()).catch(() => '')
      : Promise.resolve('');
    const settingsRequest = bridge.readSettings
      ? Promise.resolve().then(() => bridge.readSettings()).catch(() => null)
      : Promise.resolve(null);
    const [platform, native] = await Promise.all([platformRequest, settingsRequest]);
    appPlatform = platform || '';
    if (native && typeof native === 'object') settings = Object.assign(settings, native);
    if (settings.volume !== undefined && !Number.isFinite(Number(state.volume))) state.volume = Number(settings.volume);
    settings.theme = ['system','light','dark'].includes(settings.theme) ? settings.theme : 'system';
    const customAccents = ['red','white','pink','matcha','purple','cyan','rgb'];
    settings.accent = [...customAccents, 'system'].includes(settings.accent) ? settings.accent : 'matcha';
    settings.lastCustomAccent = customAccents.includes(settings.lastCustomAccent)
      ? settings.lastCustomAccent
      : settings.accent === 'system' ? 'matcha' : settings.accent;
    settings.visualizerIntensity = Math.max(10, Math.min(100, Number(settings.visualizerIntensity) || 70));
    settings.mediaDiscoveryEnabled = settings.mediaDiscoveryEnabled === true;
    settings.externalStorageEnabledIds = settings.externalStorageEnabledIds && typeof settings.externalStorageEnabledIds === 'object' && !Array.isArray(settings.externalStorageEnabledIds) ? settings.externalStorageEnabledIds : {};
    settings.automaticArtworkFetch = settings.automaticArtworkFetch !== false;
    settings.visualizerStyle = ['waves', 'topographic', 'minimal', 'cd'].includes(settings.visualizerStyle) ? settings.visualizerStyle : 'waves';
    settings.lowGraphicsMode = settings.lowGraphicsMode === true;
    settings.equalizerEnabled = settings.equalizerEnabled === true;
    settings.equalizerPreset = EQ_PRESETS[settings.equalizerPreset] ? settings.equalizerPreset : 'balanced';
    settings.crossfadeEnabled = settings.crossfadeEnabled === true;
    settings.crossfadeSeconds = normalizeCrossfadeSeconds(settings.crossfadeSeconds);
    settings.reverbEnabled = settings.reverbEnabled === true;
    settings.reverbAmount = Math.max(0, Math.min(60, Number.isFinite(Number(settings.reverbAmount)) ? Number(settings.reverbAmount) : 24));
  }

  async function boot() {
    await Promise.all([loadPreferences(), syncWindowAppearance()]);
    applySettings();
    bindEvents();
    observeVisualizerBounds();
    renderAll();
    window.setTimeout(() => {
      if (settings.automaticArtworkFetch === true) {
        const knownArtworkItems = collectAllMediaForArtwork();
        const artworkMigrationKey = 'revibe.artwork-autofetch-migration.v1';
        if (safeStorageRead(artworkMigrationKey, '') !== 'done') {
          clearNegativeArtworkResults(knownArtworkItems);
          safeStorageWrite(artworkMigrationKey, 'done');
        }
        scheduleAutomaticArtworkFetch(knownArtworkItems);
      } else {
        scheduleDetectedMusicArtwork();
      }
    }, 450);
    document.body.dataset.mode = resolveMode();
    if (bridge.isMaximized) bridge.isMaximized().then((maximized) => document.body.classList.toggle('window-maximized', maximized)).catch(() => {});
    const savedPage = normalizePage(state.lastPage);
    navigate(savedPage);
    if (bridge.rendererReady) bridge.rendererReady();
    if (currentItem) {
      const restored = currentItem;
      // Re-issue the native media URL before restoring the player source.
      if (restored.type !== 'tv' && (restored.path || restored.url)) {
        await refreshLocalMediaUrl(restored);
        if (restored.url) selectItem(restored, false);
      }
    }
    byId('volumeRange').value = String(state.volume ?? .72);
    byId('volumeRange').style.setProperty('--volume-progress', `${(state.volume ?? .72) * 100}%`);
    applyPlaybackVolumes();
    syncFullscreenControls();
    updateMuteIcon();
    resizeVisualizer();
    if (currentPage === 'music') startVisualizerLoop();
    window.setTimeout(() => {
      void (async () => {
        await scanSavedFolder('music');
        await scanSavedFolder('video');
      })();
    }, 650);
  }

  // Restore the last selected item separately from the compact history record.
  try {
    const stored = safeStorageRead(STORE_KEY, {});
    if (stored?.currentItem) currentItem = stored.currentItem;
  } catch { /* nothing to restore */ }

  resetStaleMusicArtworkOnce();
  boot();
})();
