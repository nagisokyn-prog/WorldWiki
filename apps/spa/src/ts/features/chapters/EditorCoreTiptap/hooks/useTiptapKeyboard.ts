import { onMounted, onUnmounted } from 'vue';
import type { Ref } from 'vue';
import { settingsService, type AppSettings } from '@worldwiki/components';

export interface UseTiptapKeyboardOptions {
  ctrlPressed: Ref<boolean>;
  settings: Ref<AppSettings | null>;
  hasUnsavedChanges: () => boolean;
  onSave: () => void;
  onRestorePosition: () => void;
  onSavePosition: () => void;
  onBeforeUnload: (e: BeforeUnloadEvent) => void;
  onToggleStructure?: () => void;
}

export function useTiptapKeyboard(options: UseTiptapKeyboardOptions) {
  let autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  let downHandler: ((e: KeyboardEvent) => void) | null = null;
  let upHandler: ((e: KeyboardEvent) => void) | null = null;
  let toggleStructureHandler: (() => void) | null = null;

  const startAutoSave = () => {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    const interval = options.settings.value?.editor?.autoSaveInterval;
    if (interval && interval > 0) {
      autoSaveTimer = setInterval(() => {
        if (options.hasUnsavedChanges()) options.onSave();
      }, interval * 1000);
    }
  };

  onMounted(() => {
    settingsService.onChange((newS: AppSettings) => {
      options.settings.value = newS;
      startAutoSave();
    });

    startAutoSave();
    setTimeout(() => options.onRestorePosition(), 100);
    window.addEventListener('beforeunload', options.onBeforeUnload);

    downHandler = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') options.ctrlPressed.value = true;

      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.code === 'KeyB' || e.key === 'b' || e.key === 'B' || e.key === 'и' || e.key === 'И')) {
        e.preventDefault();
        const current = localStorage.getItem('chapters-right-panel-visible') === 'true';
        const next = !current;
        localStorage.setItem('chapters-right-panel-visible', String(next));
        document.dispatchEvent(new CustomEvent('ww:toggle-right-panel', { detail: { visible: next } }));
        return;
      }

      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
        e.preventDefault();
        options.onSavePosition();
        options.onSave();
        setTimeout(() => window.location.reload(), 300);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы')) {
        e.preventDefault();
        options.onSave();
        return;
      }

      if (options.onToggleStructure && (e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К')) {
        e.preventDefault();
        options.onToggleStructure();
      }
    };

    toggleStructureHandler = () => {
      if (options.onToggleStructure) options.onToggleStructure();
    };
    document.addEventListener('ww:toggle-split-structure', toggleStructureHandler);
    document.addEventListener('ww:toggle-structure', toggleStructureHandler);

    upHandler = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') options.ctrlPressed.value = false;
    };

    const blurHandler = () => {
      options.ctrlPressed.value = false;
    };

    window.addEventListener('blur', blurHandler);
    window.addEventListener('keydown', downHandler);
    window.addEventListener('keyup', upHandler);
    document.addEventListener('keydown', downHandler);
    document.addEventListener('keyup', upHandler);
  });

  onUnmounted(() => {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    window.removeEventListener('beforeunload', options.onBeforeUnload);
    if (downHandler) {
      window.removeEventListener('keydown', downHandler);
      document.removeEventListener('keydown', downHandler);
    }
    if (upHandler) {
      window.removeEventListener('keyup', upHandler);
      document.removeEventListener('keyup', upHandler);
    }
    if (toggleStructureHandler) {
      document.removeEventListener('ww:toggle-split-structure', toggleStructureHandler);
      document.removeEventListener('ww:toggle-structure', toggleStructureHandler);
    }
  });
}
