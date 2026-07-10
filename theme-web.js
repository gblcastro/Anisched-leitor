const THEME_STORAGE_KEY = 'theme_preference';

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('sl-theme-dark');
  } else {
    document.documentElement.classList.remove('sl-theme-dark');
  }
}

function initTheme() {
  let theme = localStorage.getItem(THEME_STORAGE_KEY);
  if (!theme) {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(theme);
  
  // Need to wait for DOM for the button
  document.addEventListener("DOMContentLoaded", () => updateToggleButton(theme));
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
      updateToggleButton(theme);
  }
}

function toggleTheme() {
  let current = localStorage.getItem(THEME_STORAGE_KEY);
  if (!current) {
    current = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  const newTheme = current === 'dark' ? 'light' : 'dark';
  
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  applyTheme(newTheme);
  updateToggleButton(newTheme);
}

function updateToggleButton(theme) {
  const btn = document.getElementById('btnThemeToggle');
  if (btn) {
    if (btn.tagName && btn.tagName.toLowerCase() === 'sl-icon-button') {
      btn.name = theme === 'dark' ? 'sun' : 'moon';
    } else {
      const icon = btn.querySelector('sl-icon');
      if (icon) {
        icon.name = theme === 'dark' ? 'sun' : 'moon';
      }
    }
    if (!btn.hasAttribute('data-theme-listener')) {
      btn.addEventListener('click', toggleTheme);
      btn.setAttribute('data-theme-listener', 'true');
    }
  }
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (!localStorage.getItem(THEME_STORAGE_KEY)) {
    const newTheme = e.matches ? 'dark' : 'light';
    applyTheme(newTheme);
    updateToggleButton(newTheme);
  }
});

globalThis.ThemeSettings = {
    toggleTheme,
    applyTheme
};

initTheme();
