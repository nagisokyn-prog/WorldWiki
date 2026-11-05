/**
 * @file chapters.ts
 * @description Точка входа для страницы управления главами
 * Монтирует полное Vue приложение ChaptersMain
 */

import { createApp } from 'vue';
import ChaptersMainVue from '../features/chapters/components/workspace/ChaptersMain/ChaptersMain.vue';
import ChapterTreeVue from '../features/chapters/components/tree/ChapterTree/ChapterTree.vue';
import EditorCoreVue from '../features/chapters/components/editor/EditorCoreTiptap/EditorCoreTiptap.vue';
import TimelinePanelVue from '../features/timeline/components/inspectors/TimelinePanel/TimelinePanel.vue';
import ParticipantsPanelVue from '../features/chapters/components/panels/ParticipantsPanel/ParticipantsPanel.vue';
import PlanningPanelVue from '../features/chapters/components/panels/PlanningPanel/PlanningPanel.vue';
import ExportModalVue from '../features/chapters/components/modals/ExportModal/ExportModal.vue';


let appInstance: ReturnType<typeof createApp> | null = null;

export function initChapters(): void {
  const urlParams = new URLSearchParams(window.location.search);
  const project = urlParams.get('project');

  console.log('📖 chapters.ts инициализирован, проект:', project);
  console.log('📖 Контейнер #app:', document.getElementById('app'));

  if (!project) {
    console.error('Проект не указан в URL - используем "default"');
  }

  const projectId = project || 'default';

  // Создаем Vue приложение с ChaptersMain
  appInstance = createApp(ChaptersMainVue, { project: projectId });

  // Регистрируем компоненты глобально
  appInstance.component('ChapterTree', ChapterTreeVue);
  appInstance.component('EditorCore', EditorCoreVue);
  appInstance.component('TimelinePanel', TimelinePanelVue);
  appInstance.component('ParticipantsPanel', ParticipantsPanelVue);
  appInstance.component('PlanningPanel', PlanningPanelVue);
  appInstance.component('ExportModal', ExportModalVue);

  const appContainer = document.getElementById('app');
  if (appContainer) {
    appInstance.mount(appContainer);
    console.log('✅ ChaptersMain Vue приложение монтировано, проект:', projectId);
  } else {
    console.error('❌ Контейнер #app не найден');
  }
}

export function disposeChapters(): void {
  if (appInstance) {
    appInstance.unmount();
    appInstance = null;
  }
}

export function unmounted(): void {
  disposeChapters();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChapters, { once: true });
  } else {
    initChapters();
  }
}