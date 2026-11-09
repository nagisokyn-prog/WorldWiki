/**
 * @file ui_editor.ts
 * @description Точка входа для отдельного плавающего окна «Редактор сущности»
 */

import { createApp, defineAsyncComponent, h, type Plugin } from 'vue';
import { createPinia } from 'pinia';

import '@worldwiki/resources/styles/tokens/fonts.css';
import '@worldwiki/resources/styles/font-awesome.min.css';
import '@worldwiki/resources/styles/styles.css';
import '@worldwiki/resources/styles/base/glass-animations.css';

import { autoAnimatePlugin } from '@formkit/auto-animate/vue';
import { MotionPlugin } from '@vueuse/motion';
import { setupGlass } from '@/utils/v-glass';
import { settingsService, i18n, setLocale } from '@worldwiki/components';
import EntityEditorWindow from '../features/entities/EntityEditorWindow/EntityEditorWindow.vue';

const TagsField = defineAsyncComponent(() =>
  import('@worldwiki/components').then((m) => m.TagsField)
);

async function init() {
  const params = new URLSearchParams(window.location.search);
  const project = params.get('project') || 'default';
  const entityType = params.get('type') || '';
  const entityId = params.get('id') || '';

  // Загружаем сохраненные настройки темы и дизайн-системы (Glass UI)
  await settingsService
    .loadSettings()
    .catch((e: unknown) => console.warn('Failed to load settings in ui_editor:', e));
  settingsService.applySettings();
  setLocale(settingsService.getSettings().locale || 'ru');

  const pinia = createPinia();

  const app = createApp({
    name: 'EntityEditorStandaloneApp',
    render: () =>
      h(EntityEditorWindow, {
        project,
        entityType,
        entityId,
      }),
  });

  app.use(pinia);
  app.use(autoAnimatePlugin as unknown as Plugin);
  app.use(MotionPlugin as unknown as Plugin);
  setupGlass(app);
  app.use(i18n as unknown as Plugin);
  app.component('TagsFieldVue', TagsField);

  app.mount('#app');
}

init().catch((e) => console.error('[ui_editor] init error:', e));
