/**
 * @file settings.ts
 * @description Страница настроек
 */

import { createApp, type Plugin } from 'vue';

import '@worldwiki/resources/styles/tokens/fonts.css';
import '@worldwiki/resources/styles/font-awesome.min.css';
import '@worldwiki/resources/styles/styles.css';
import '@worldwiki/resources/styles/base/glass-animations.css';



import { autoAnimatePlugin } from '@formkit/auto-animate/vue';
import { settingsService, i18n, setLocale, Settings } from '@worldwiki/components';

let appInstance: ReturnType<typeof createApp> | null = null;
let saveHandler: (() => Promise<void>) | null = null;
let backHandler: (() => void) | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

async function init() {
  console.log('[settings] initializing...');
  
  // Сначала загружаем настройки
  await settingsService.loadSettings();
  console.log('[settings] settings loaded');
  
  // Применяем настройки
  settingsService.applySettings();
  setLocale(settingsService.getSettings().locale || 'ru');
  
  // Монтируем Vue компонент Settings
  appInstance = createApp(Settings);
  appInstance.use(autoAnimatePlugin as unknown as Plugin);
  appInstance.use(i18n as unknown as Plugin).mount('#settingsContent');
  console.log('[settings] Settings component mounted');
  
  // Кнопка "Сохранить"
  saveHandler = async () => {
    console.log('[saveBtn] clicked');
    try {
      await settingsService.saveSettings(null, true);
      
      const btn = document.getElementById('saveBtn');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✅ Сохранено!';
        btn.style.background = 'var(--accent-active, var(--color-success))';
        setTimeout(() => {
          btn.textContent = orig;
          btn.style.background = '';
        }, 2000);
      }
    } catch (e) {
      console.error('[saveBtn] error:', e);
    }
  };

  backHandler = () => {
    console.log('[backBtn] clicked');
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = './app.html#/launcher';
    }
  };

  keydownHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && backHandler) {
      backHandler();
    }
  };

  document.getElementById('saveBtn')?.addEventListener('click', saveHandler);
  document.getElementById('backBtn')?.addEventListener('click', backHandler);
  window.addEventListener('keydown', keydownHandler);
}

export function disposeSettings(): void {
  if (saveHandler) {
    document.getElementById('saveBtn')?.removeEventListener('click', saveHandler);
    saveHandler = null;
  }
  if (backHandler) {
    document.getElementById('backBtn')?.removeEventListener('click', backHandler);
    backHandler = null;
  }
  if (keydownHandler) {
    window.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
  if (appInstance) {
    appInstance.unmount();
    appInstance = null;
  }
}

export function unmounted(): void {
  disposeSettings();
}

init().catch(e => console.error('[settings] init error:', e));


