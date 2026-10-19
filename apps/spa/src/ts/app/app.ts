/**
 * @file app.ts
 * @description Точка входа — только init + createApp + регистрация компонентов.
 * Вся логика в useAppShell.
 */
import { createApp, defineAsyncComponent, type Plugin } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';

import '@worldwiki/resources/styles/tokens/fonts.css';
import '@worldwiki/resources/styles/font-awesome.min.css';
import '@worldwiki/resources/styles/styles.css';
import '@worldwiki/resources/styles/base/glass-animations.css';

import { entityApi } from '../services/Entity/entity.api';
import { autoAnimatePlugin } from '@formkit/auto-animate/vue';
import { MotionPlugin } from '@vueuse/motion';
import { setupGlass } from '../utils/v-glass';
import { i18n, setLocale, settingsService } from '@worldwiki/components';
import AppSwitcher from '../features/shell/AppSwitcher.vue';
import { router } from './router';

import { ensureWasmInitialized } from '../services/Calendars/calendar.wasm-bridge';
import ChapterTreeVue from '../features/chapters/ChapterTree/ChapterTree.vue';
import ChaptersMainVue from '../features/chapters/ChaptersMain/ChaptersMain.vue';
import {
  QuickOpen as QuickOpenVue, CommandPalette as CommandPaletteVue,
  EditorTabBar as EditorTabBarVue, EditorGroupPane as EditorGroupPaneVue,
} from '@worldwiki/components';

// ✅ ОПТИМИЗАЦИЯ: Тяжелые компоненты — динамический импорт
import EntityEditorVue from '../features/entities/EntityEditor/EntityEditor.vue';
import ChaptersViewVue from '../features/chapters/ChaptersView.vue';
import EditorCoreVue from '../features/chapters/EditorCoreTiptap/EditorCoreTiptap.vue';
import TimelinePanelVue from '../features/timeline/TimelinePanel/TimelinePanel.vue';
import ParticipantsPanelVue from '../features/chapters/ParticipantsPanel/ParticipantsPanel.vue';
import PlanningPanelVue from '../features/chapters/PlanningPanel/PlanningPanel.vue';
import ExportModalVue from '../features/chapters/Export/ExportModal.vue';

import TagsManagerModalVue from '../features/entities/TagsManagerModal.vue';
import SchemaEditorMainVue from '../features/schemas/SchemaEditor/SchemaEditorMain.vue';
import CloudSyncModalVue from '../features/sync/CloudSyncModal.vue';

// TagsField can stay async if it's not statically imported elsewhere
const TagsField = defineAsyncComponent(() => import('@worldwiki/components').then(m => m.TagsField));

async function init() {
  const params = new URLSearchParams(window.location.search);
  const projectName = params.get('project') || 'default';

  // Загружаем и синхронизируем схемы сущностей
  try {
    await entityApi.getSchemas(projectName);
  } catch (e) {
    console.warn('Failed to load schemas:', e);
  }

  // Инициализируем WebAssembly-движок календаря
  await ensureWasmInitialized().catch(e => console.warn('Failed to initialize calendar WASM:', e));

  // Применяем настройки
  settingsService.applySettings();
  await settingsService.loadSettings().catch(e => console.warn('Failed to load settings:', e));
  setLocale(settingsService.getSettings().locale || 'ru');

  const app = createApp(AppSwitcher);

  const pinia = createPinia();
  app.use(pinia);
  app.use(router);
  app.use(VueQueryPlugin);

  // Регистрация компонентов
  app.component('EntityEditorVue', EntityEditorVue);
  app.component('ChaptersViewVue', ChaptersViewVue);
  app.component('ChaptersMainVue', ChaptersMainVue);
  app.component('ChapterTreeVue', ChapterTreeVue);
  app.component('EditorCoreVue', EditorCoreVue);
  app.component('TimelinePanelVue', TimelinePanelVue);
  app.component('ParticipantsPanelVue', ParticipantsPanelVue);
  app.component('PlanningPanelVue', PlanningPanelVue);
  app.component('ExportModalVue', ExportModalVue);

  app.component('QuickOpenVue', QuickOpenVue);
  app.component('CommandPaletteVue', CommandPaletteVue);
  app.component('TagsManagerModalVue', TagsManagerModalVue);
  app.component('TagsFieldVue', TagsField);
  app.component('SchemaEditorMainVue', SchemaEditorMainVue);
  app.component('EditorTabBarVue', EditorTabBarVue);
  app.component('EditorGroupPaneVue', EditorGroupPaneVue);
  app.component('CloudSyncModalVue', CloudSyncModalVue);

  app.use(autoAnimatePlugin as unknown as Plugin);
  app.use(MotionPlugin as unknown as Plugin);
  setupGlass(app);
  app.use(i18n as unknown as Plugin);

  app.config.errorHandler = (err, instance, info) => {
    console.error('🔥 [Vue Global Error Handler]:', err, info);
  };

  await router.isReady();
  app.mount('#app');
}

const onError = (e: ErrorEvent) => {
  console.error('🔥 [Window Global Error]:', e.error || e.message);
};

const onRejection = (e: PromiseRejectionEvent) => {
  console.error('🔥 [Unhandled Promise Rejection]:', e.reason);
};

window.addEventListener('error', onError);
window.addEventListener('unhandledrejection', onRejection);

export function disposeApp(): void {
  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onRejection);
}

export function unmounted(): void {
  disposeApp();
}

init().catch(e => console.error('[app] init error:', e));