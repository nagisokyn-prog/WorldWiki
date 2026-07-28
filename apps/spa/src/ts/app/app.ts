/**
 * @file app.ts
 * @description Точка входа — только init + createApp + регистрация компонентов.
 * Вся логика в useAppShell.
 */
import { createApp, defineAsyncComponent, type Plugin } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';

import '@worldwiki/resources/styles/fonts.css';
import '@worldwiki/resources/styles/font-awesome.min.css';
import '@worldwiki/resources/styles/glass-theme.css';
import '@worldwiki/resources/styles/modules/settings.css';
import '@worldwiki/resources/styles/new-ui-theme.css';
import '@worldwiki/resources/styles/chapter-tree.css';

import * as api from '../services/api.client';;
import { autoAnimatePlugin } from '@formkit/auto-animate/vue';
import { MotionPlugin } from '@vueuse/motion';
import { setupGlass } from '../utils/v-glass';
import { i18n, setLocale, settingsService } from '@worldwiki/components';
import AppSwitcher from '../features/shell/AppSwitcher.vue';
import { router } from './router';

// ✅ ОПТИМИЗАЦИЯ: Критические компоненты загружаются сразу
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
import TimelinePanelVue from '../features/timeline/Calendars/TimelinePanel/TimelinePanel.vue';
import ParticipantsPanelVue from '../features/chapters/ParticipantsPanel/ParticipantsPanel.vue';
import PlanningPanelVue from '../features/chapters/PlanningPanel/PlanningPanel.vue';
import ExportModalVue from '../features/chapters/Export/ExportModal.vue';
import WowilonDrawerVue from '../features/chapters/WowilonDrawer.vue';
import TagsManagerModalVue from '../features/entities/TagsManagerModal.vue';
import SchemaEditorMainVue from '../features/schemas/SchemaEditor/SchemaEditorMain.vue';
import CloudSyncModalVue from '../features/sync/CloudSyncModal.vue';

// TagsField can stay async if it's not statically imported elsewhere
const TagsField = defineAsyncComponent(() => import('@worldwiki/components').then(m => m.TagsField));

async function init() {
  const params = new URLSearchParams(window.location.search);
  const projectName = params.get('project') || 'default';

  // Загружаем схемы сущностей
  try {
    await api.getEntitySchemas(projectName);
  } catch (e) {
    console.warn('Failed to load schemas:', e);
  }

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
  app.component('WowilonDrawerVue', WowilonDrawerVue);
  app.component('QuickOpenVue', QuickOpenVue);
  app.component('CommandPaletteVue', CommandPaletteVue);
  app.component('TagsManagerModalVue', TagsManagerModalVue);
  app.component('TagsFieldVue', TagsField);
  app.component('SchemaEditorMainVue', SchemaEditorMainVue);
  app.component('EditorTabBarVue', EditorTabBarVue);
  app.component('EditorGroupPaneVue', EditorGroupPaneVue);
  app.component('CloudSyncModalVue', CloudSyncModalVue);

  app.use(autoAnimatePlugin);
  app.use(MotionPlugin);
  setupGlass(app);
  app.use(i18n as unknown as Plugin).mount('#app');
}

init().catch(e => console.error('[app] init error:', e));