/**
 * @file settings.ts
 * @description Страница настроек
 */

import { createApp } from 'vue';
import { settingsService } from '../../../tauri-surreal-kit/frontend/src/js/services/settings.service';
import Settings from '../../../tauri-surreal-kit/frontend/src/components/Vue/Settings.vue';

async function init() {
  console.log('[settings] initializing...');
  
  // Сначала загружаем настройки
  await settingsService.loadSettings();
  console.log('[settings] settings loaded');
  
  // Применяем настройки
  settingsService.applySettings();
  
  // Монтируем Vue компонент Settings
  const app = createApp(Settings);
  app.mount('#settingsContent');
  console.log('[settings] Settings component mounted');
  
  // Кнопка "Сохранить"
  document.getElementById('saveBtn')?.addEventListener('click', async () => {
    console.log('[saveBtn] clicked');
    try {
      await settingsService.saveSettings();
      console.log('[saveBtn] settings saved');
      
      const btn = document.getElementById('saveBtn');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✅ Сохранено!';
        btn.style.background = '#22c55e';
        setTimeout(() => {
          btn.textContent = orig;
          btn.style.background = '';
        }, 2000);
      }
    } catch (e) {
      console.error('[saveBtn] error:', e);
    }
  });
}

init().catch(e => console.error('[settings] init error:', e));


