/**
 * @file app.ts
 * @description Точка входа — только init + createApp + регистрация компонентов.
 * Вся логика в useAppShell.
 */
import { createApp, defineAsyncComponent, type Plugin } from 'vue';
import { createPinia } from 'pinia';

import '@worldwiki/resources/styles/fonts.css';
import '@worldwiki/resources/styles/font-awesome.min.css';
import '@worldwiki/resources/styles/glass-theme.css';
import '@worldwiki/resources/styles/modules/settings.css';
import '@worldwiki/resources/styles/new-ui-theme.css';
import '@worldwiki/resources/styles/chapter-tree.css';

import { apiService } from '../services/api.service';
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
const EntityEditorVue = defineAsyncComponent(() => import('../features/entities/EntityEditor/EntityEditor.vue'));
const ChaptersViewVue = defineAsyncComponent(() => import('../features/chapters/ChaptersView.vue'));
const EditorCoreVue = defineAsyncComponent(() => import('../features/chapters/EditorCoreTiptap/EditorCoreTiptap.vue'));
const TimelinePanelVue = defineAsyncComponent(() => import('../features/timeline/Calendars/TimelinePanel/TimelinePanel.vue'));
const ParticipantsPanelVue = defineAsyncComponent(() => import('../features/chapters/ParticipantsPanel/ParticipantsPanel.vue'));
const PlanningPanelVue = defineAsyncComponent(() => import('../features/chapters/PlanningPanel/PlanningPanel.vue'));
const ExportModalVue = defineAsyncComponent(() => import('../features/chapters/Export/ExportModal.vue'));
const WowilonDrawerVue = defineAsyncComponent(() => import('../features/chapters/WowilonDrawer.vue'));
const TagsManagerModalVue = defineAsyncComponent(() => import('../features/entities/TagsManagerModal.vue'));
const TagsField = defineAsyncComponent(() => import('@worldwiki/components').then(m => m.TagsField));
const SchemaEditorMainVue = defineAsyncComponent(() => import('../features/schemas/SchemaEditor/SchemaEditorMain.vue'));
const CloudSyncModalVue = defineAsyncComponent(() => import('../features/sync/CloudSyncModal.vue'));

async function init() {
  const params = new URLSearchParams(window.location.search);
  const projectName = params.get('project') || 'default';

  // Загружаем схемы сущностей
  try {
    await apiService.getSchemas(projectName);
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