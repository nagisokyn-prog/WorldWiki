import { createApp, h } from 'vue';
import { settingsService } from '../services/settings.service';
import Settings from '../../components/Vue/Settings.vue';
import { i18n } from '../i18n';

const cfg = (window as any).__APP_CONFIG__ || {};

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('settingsContent');
  if (!container) {
    console.warn('[settings.ts] settingsContent element not found');
    return;
  }

  const root = document.createElement('div');
  container.appendChild(root);

  const app = createApp({
    render() {
      return h(Settings, {
        onClose: () => {
          window.location.href = cfg.backUrl || 'main.html';
        },
        onBack: () => {
          window.location.href = cfg.backUrl || 'main.html';
        },
      });
    },
  });

  app.use(i18n).mount(root);

  document.getElementById('saveBtn')?.addEventListener('click', async () => {
    try {
      await settingsService.saveSettings(null, true);
      const btn = document.getElementById('saveBtn');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✅ Saved';
        btn.style.background = '#22c55e';
        setTimeout(() => {
          btn.textContent = orig;
          btn.style.background = '';
        }, 2000);
      }
    } catch (e) {
      console.error('[settings.ts] save failed:', e);
    }
  });
});
