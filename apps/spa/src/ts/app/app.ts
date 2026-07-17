/**
 * @file app.ts
 * @description Точка входа — только init + createApp + регистрация компонентов.
 * Вся логика в useAppShell.
 */
import { createApp, defineAsyncComponent, type Plugin } from 'vue';

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
import { useAppShell } from '@/composables/useAppShell';

// ✅ ОПТИМИЗАЦИЯ: Критические компоненты загружаются сразу
import ChapterTreeVue from '../components/Vue/Chapters/ChapterTree.vue';
import ChaptersMainVue from '../components/Vue/Chapters/ChaptersMain.vue';
import {
  QuickOpen as QuickOpenVue, CommandPalette as CommandPaletteVue,
  EditorTabBar as EditorTabBarVue, EditorGroupPane as EditorGroupPaneVue,
} from '@worldwiki/components';

// ✅ ОПТИМИЗАЦИЯ: Тяжелые компоненты — динамический импорт
const EntityEditorVue = defineAsyncComponent(() => import('../features/entities/EntityEditor/EntityEditor.vue'));
const ChaptersViewVue = defineAsyncComponent(() => import('../components/Vue/ChaptersView.vue'));
const EditorCoreVue = defineAsyncComponent(() => import('../features/chapters/EditorCoreTiptap/EditorCoreTiptap.vue'));
const TimelinePanelVue = defineAsyncComponent(() => import('../components/Vue/Calendars/TimelinePanel.vue'));
const ParticipantsPanelVue = defineAsyncComponent(() => import('../components/Vue/Chapters/ParticipantsPanel.vue'));
const PlanningPanelVue = defineAsyncComponent(() => import('../components/Vue/Chapters/PlanningPanel.vue'));
const ExportModalVue = defineAsyncComponent(() => import('../components/Vue/Chapters/ExportModal.vue'));
const WowilonDrawerVue = defineAsyncComponent(() => import('../components/Vue/Chapters/WowilonDrawer.vue'));
const TagsManagerModalVue = defineAsyncComponent(() => import('../components/Vue/TagsManagerModal.vue'));
const TagsField = defineAsyncComponent(() => import('@worldwiki/components').then(m => m.TagsField));
const SchemaEditorMainVue = defineAsyncComponent(() => import('../components/Vue/SchemaEditor/SchemaEditorMain.vue'));
const CloudSyncModalVue = defineAsyncComponent(() => import('../components/Vue/CloudSyncModal.vue'));

interface SidebarItem {
  type: 'static' | 'entity' | 'chapters';
  url?: string;
  entityType?: string;
  icon: string;
  emoji: string;
  title: string;
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const projectName = params.get('project') || 'default';

  // Загружаем sidebar.json
  let sidebarItems: SidebarItem[] = [];
  try {
    const res = await fetch('./struct/sidebar.json');
    sidebarItems = await res.json();
  } catch (e) {
    console.warn('Failed to load sidebar.json:', e);
  }

  // Загружаем схемы сущностей
  try {
    const entitySchemas = await apiService.getSchemas(projectName);
    for (const [typeKey, schema] of Object.entries(entitySchemas)) {
      if (!sidebarItems.find(item => item.entityType === typeKey)) {
        sidebarItems.push({
          type: 'entity', entityType: typeKey,
          icon: 'fas fa-cube', emoji: schema.icon || '🧩',
          title: schema.name || typeKey,
        });
      }
    }
  } catch (e) {
    console.warn('Failed to load schemas:', e);
  }

  // Применяем настройки
  settingsService.applySettings();
  await settingsService.loadSettings().catch(e => console.warn('Failed to load settings:', e));
  setLocale(settingsService.getSettings().locale || 'ru');

  const app = createApp({
    setup() {
      return useAppShell({ projectName, sidebarItems });
    },
  });

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