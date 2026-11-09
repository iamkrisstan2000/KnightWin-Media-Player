(() => {
  'use strict';

  let preferences = {};
  try {
    const stored = localStorage.getItem('revibe.preferences.v1');
    const parsed = stored ? JSON.parse(stored) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) preferences = parsed;
  } catch { /* Use the system theme if local preferences are unavailable. */ }

  let mode = ['dark', 'light', 'system'].includes(preferences.theme) ? preferences.theme : 'system';
  if (mode === 'system') {
    try { mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
    catch { mode = 'light'; }
  }

  const accents = ['red', 'white', 'pink', 'matcha', 'purple', 'cyan', 'rgb', 'system'];
  const accent = accents.includes(preferences.accent) ? preferences.accent : 'matcha';
  document.documentElement.dataset.revibeMode = mode;
  document.documentElement.dataset.revibeAccent = accent;

  const applyToBody = () => {
    if (!document.body) return false;
    if (window.revibe?.isDesktop) document.body.classList.add('desktop-window');
    document.body.dataset.mode = mode;
    document.body.dataset.accent = accent;
    return true;
  };
  if (!applyToBody()) {
    const observer = new MutationObserver(() => {
      if (applyToBody()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true });
  }
})();
