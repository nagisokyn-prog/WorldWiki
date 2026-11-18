import { createApp, h, type Plugin } from 'vue';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { settingsService } from '../services/settings.service';
import Settings from '../../components/Vue/Settings.vue';
import { i18n } from '../i18n';
import { autoAnimatePlugin } from '@formkit/auto-animate/vue';
import { MotionPlugin } from '@vueuse/motion';

const cfg = window.__APP_CONFIG__ || {};

let appInstance: ReturnType<typeof createApp> | null = null;
let saveBtnHandler: (() => Promise<void>) | null = null;
let zoomKeydownHandler: ((e: KeyboardEvent) => void) | null = null;

async function applySettingsZoom(level: number): Promise<void> {
  const clamped = Math.max(0.5, Math.min(2, Math.round(level * 100) / 100));
  localStorage.setItem('app-zoom', String(clamped));
  document.documentElement.style.setProperty('--app-zoom', String(clamped));
  try {
    await getCurrentWebview().setZoom(clamped);
  } catch {
    (document.documentElement.style as unknown as Record<string, string>).zoom = String(clamped);
  }
}

export function initSettingsApp(): void {
  const container = document.getElementById('settingsContent');
  if (!container) {
    console.warn('[settings.ts] settingsContent element not found');
    return;
  }

  const root = document.createElement('div');
  container.appendChild(root);

  appInstance = createApp({
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

  appInstance.use(autoAnimatePlugin as Plugin);
  appInstance.use(MotionPlugin as unknown as Plugin);
  appInstance.use(i18n).mount(root);

  saveBtnHandler = async () => {
    try {
      await settingsService.saveSettings(null, true);
      const btn = document.getElementById('saveBtn');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✅ Saved';
        btn.style.background = 'var(--accent-active, var(--color-success))';
        setTimeout(() => {
          btn.textContent = orig;
          btn.style.background = '';
        }, 2000);
      }
    } catch (e) {
      console.error('[settings.ts] save failed:', e);
    }
  };

  document.getElementById('saveBtn')?.addEventListener('click', saveBtnHandler);

  zoomKeydownHandler = (e: KeyboardEvent) => {
    if (!e.ctrlKey || e.shiftKey || e.altKey) return;
    const current = parseFloat(localStorage.getItem('app-zoom') || '1') || 1;
    if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      e.preventDefault();
      void applySettingsZoom(current + 0.1);
    } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      e.preventDefault();
      void applySettingsZoom(current - 0.1);
    } else if (e.code === 'Digit0' || e.code === 'Numpad0') {
      e.preventDefault();
      void applySettingsZoom(1);
    }
  };
  window.addEventListener('keydown', zoomKeydownHandler);
}

export function disposeSettingsApp(): void {
  if (zoomKeydownHandler) {
    window.removeEventListener('keydown', zoomKeydownHandler);
    zoomKeydownHandler = null;
  }
  if (saveBtnHandler) {
    document.getElementById('saveBtn')?.removeEventListener('click', saveBtnHandler);
    saveBtnHandler = null;
  }
  if (appInstance) {
    appInstance.unmount();
    appInstance = null;
  }
}

export function unmounted(): void {
  disposeSettingsApp();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initSettingsApp);
}
