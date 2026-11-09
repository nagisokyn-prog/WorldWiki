/**
 * @file character_journey.ts
 * @description Точка входа для отдельного плавающего окна «Путь Персонажа & Навигатор Сцен»
 */

import { createApp, h, type Plugin } from 'vue';
import { createPinia } from 'pinia';

import '@worldwiki/resources/styles/tokens/fonts.css';
import '@worldwiki/resources/styles/font-awesome.min.css';
import '@worldwiki/resources/styles/styles.css';
import '@worldwiki/resources/styles/base/glass-animations.css';

import { autoAnimatePlugin } from '@formkit/auto-animate/vue';
import { MotionPlugin } from '@vueuse/motion';
import { setupGlass } from '@/utils/v-glass';
import { settingsService, i18n, setLocale } from '@worldwiki/components';
import CharacterJourney from '../features/entities/CharacterJourney/CharacterJourney.vue';
import type { JourneyTimelineItem } from '../features/entities/CharacterJourney/CharacterJourney.model';

async function init() {
  const params = new URLSearchParams(window.location.search);
  const project = params.get('project') || 'default';
  const initialEntityId = params.get('entity') || undefined;

  // Загружаем и применяем настройки темы и дизайн-системы
  await settingsService
    .loadSettings()
    .catch((e: unknown) => console.warn('Failed to load settings:', e));
  settingsService.applySettings();
  setLocale(settingsService.getSettings().locale || 'ru');

  const pinia = createPinia();

  const app = createApp({
    name: 'CharacterJourneyStandaloneApp',
    setup() {
      const handleSelectScene = async (item: JourneyTimelineItem) => {
        try {
          const { emit } = await import('@tauri-apps/api/event');
          await emit('ww-journey-select-scene', {
            chapterId: item.chapter_id,
            paragraphIndex: item.paragraph_index,
            blockId: item.block_id,
            item,
          });
        } catch (e) {
          console.warn('[CharacterJourney Standalone] Tauri emit error:', e);
        }

        if (window.opener) {
          window.opener.postMessage({
            type: 'JOURNEY_SELECT_SCENE',
            chapterId: item.chapter_id,
            paragraphIndex: item.paragraph_index,
            blockId: item.block_id,
            quote: item.fullText || item.title || '',
            item,
          }, '*');
        }
      };

      return () =>
        h('div', { style: 'width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden;' }, [
          h(CharacterJourney, {
            projectId: project,
            entityId: initialEntityId,
            class: 'flex-1',
            onSelectScene: handleSelectScene,
          }),
        ]);
    },
  });

  app.use(pinia);
  app.use(autoAnimatePlugin as unknown as Plugin);
  app.use(MotionPlugin as unknown as Plugin);
  setupGlass(app);
  app.use(i18n as unknown as Plugin);

  app.mount('#app');
}

init().catch((e) => console.error('[character_journey] init error:', e));
