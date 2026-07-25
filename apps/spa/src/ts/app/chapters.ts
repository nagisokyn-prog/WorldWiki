/**
 * @file chapters.ts
 * @description Точка входа для страницы управления главами
 * Монтирует полное Vue приложение ChaptersMain
 */

import { createApp } from 'vue';
import ChaptersMainVue from '../features/chapters/ChaptersMain/ChaptersMain.vue';
import ChapterTreeVue from '../features/chapters/ChapterTree/ChapterTree.vue';
import EditorCoreVue from '../features/chapters/EditorCoreTiptap/EditorCoreTiptap.vue';
import TimelinePanelVue from '../features/timeline/Calendars/TimelinePanel/TimelinePanel.vue';
import ParticipantsPanelVue from '../features/chapters/ParticipantsPanel/ParticipantsPanel.vue';
import PlanningPanelVue from '../features/chapters/PlanningPanel/PlanningPanel.vue';
import ExportModalVue from '../features/chapters/Export/ExportModal.vue';
import WowilonDrawerVue from '../features/chapters/WowilonDrawer.vue';

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const project = urlParams.get('project');

  console.log('📖 chapters.ts инициализирован, проект:', project);
  console.log('📖 Контейнер #app:', document.getElementById('app'));

  if (!project) {
    console.error('Проект не указан в URL - используем "default"');
    // Используем default проект для тестирования
  }

  const projectId = project || 'default';

  // Создаем Vue приложение с ChaptersMain
  const app = createApp(ChaptersMainVue, { project: projectId });

  // Регистрируем компоненты глобально
  app.component('ChapterTree', ChapterTreeVue);
  app.component('EditorCore', EditorCoreVue);
  app.component('TimelinePanel', TimelinePanelVue);
  app.component('ParticipantsPanel', ParticipantsPanelVue);
  app.component('PlanningPanel', PlanningPanelVue);
  app.component('ExportModal', ExportModalVue);
  app.component('WowilonDrawer', WowilonDrawerVue);

  const appContainer = document.getElementById('app');
  if (appContainer) {
    app.mount(appContainer);
    console.log('✅ ChaptersMain Vue приложение монтировано, проект:', projectId);
  } else {
    console.error('❌ Контейнер #app не найден');
  }
});