// i18n-web.js - Webapp localization system

globalThis.I18n = {
  currentLang: localStorage.getItem('userLang') || 'pt-BR',
  dictionary: {},
  
  async init() {
    return new Promise(async (resolve) => {
      await this.loadDictionary(this.currentLang);
      resolve();
    });
  },

  async loadDictionary(lang) {
    try {
      const response = await fetch(`./lang/${lang}.json`);
      if (!response.ok) throw new Error("Idioma não encontrado");
      this.dictionary = await response.json();
    } catch (e) {
      console.warn("Erro ao carregar dicionário de idioma:", e);
      if (lang !== 'pt-BR') {
        try {
          const resp = await fetch(`./lang/pt-BR.json`);
          this.dictionary = await resp.json();
        } catch (e2) {}
      }
    }
  },

  setLanguage(lang) {
    localStorage.setItem('userLang', lang);
    location.reload();
  },

  t(key) {
    return this.dictionary[key] || "";
  },

  translatePage() {
    // Update language menu checkmarks
    const itemPt = document.getElementById("menu-lang-pt-BR");
    const itemEn = document.getElementById("menu-lang-en-US");
    
    if (itemPt) {
      if (this.currentLang === 'pt-BR') {
        itemPt.innerHTML = 'Português (BR) <sl-icon slot="suffix" name="check"></sl-icon>';
      } else {
        itemPt.innerHTML = 'Português (BR)';
      }
    }
    
    if (itemEn) {
      if (this.currentLang === 'en-US') {
        itemEn.innerHTML = 'English (US) <sl-icon slot="suffix" name="check"></sl-icon>';
      } else {
        itemEn.innerHTML = 'English (US)';
      }
    }
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (this.dictionary[key]) {
        el.innerHTML = this.t(key);
      }
    });

    document.querySelectorAll('[data-i18n-label]').forEach(el => {
      const key = el.getAttribute('data-i18n-label');
      if (this.dictionary[key]) {
        el.label = this.t(key);
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (this.dictionary[key]) {
        el.title = this.t(key);
      }
    });
  }
};
