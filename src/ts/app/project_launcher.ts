/**
 * @file project_launcher.ts
 * @description Лаунчер проектов World Wiki
 * @note Использует Vue.js для UI
 */

import * as Vue from 'vue';
import { createApp, ref, computed, onMounted, nextTick, shallowRef } from 'vue';
import { projectService } from '../services/project.service';
import { settingsService } from '../../../tauri-surreal-kit/frontend/src/js/services/settings.service';
import XboxWheel from "../../../tauri-surreal-kit/frontend/src/components/Vue/XboxWheel.vue";
import CalendarsPanel from '../components/Vue/CalendarsPanel.vue';
import CloudSyncModalVue from '../components/Vue/CloudSyncModal.vue';

// Export Vue globally for components that use window.Vue
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).Vue = Vue;
}

const app = createApp({
  setup() {
    // ✅ ОПТИМИЗАЦИЯ: shallowRef для больших массивов проектов
    const projects = shallowRef<Array<{ name: string; icon: string; stats: Record<string, number> }>>([]);
    const modalVisible = ref(false);
    const isEditing = ref(false);
    const editingProjectName = ref('');
    const calendarsPanelRef = ref<any>(null);

    const formData = ref<{
      name: string;
      type: string;
      genres: string[];
      perfLevel: string;
      calendar: any;
    }>({
      name: '',
      type: 'book',
      genres: [],
      perfLevel: 'auto',
      calendar: {}
    });

    const projectTypes = [
      { value: 'book', label: 'Книга' },
      { value: 'story', label: 'Рассказ' },
      { value: 'novel', label: 'Роман' },
      { value: 'series', label: 'Серия' },
      { value: 'world', label: 'Мир' },
      { value: 'other', label: 'Другое' }
    ];

const genres = [
  { value: 'avant-garde', label: 'Авангард' },
  { value: 'autobiography', label: 'Автобиография' },
  { value: 'alternative-history', label: 'Альтернативная история' },
  { value: 'alternate-universe', label: 'AU (Альтернативная вселенная)' },
  { value: 'anime', label: 'Аниме' },
  { value: 'anthology-series', label: 'Антология' },
  { value: 'anti-war', label: 'Антивоенный' },
  { value: 'anti-detective', label: 'Антидетектив' },
  { value: 'art-house', label: 'Артхаус' },
  { value: 'fable', label: 'Басня' },
  { value: 'bizarro', label: 'Бизарро' },
  { value: 'biography', label: 'Биография' },
  { value: 'action', label: 'Боевик' },
  { value: 'web-novel', label: 'Веб-новелла' },
  { value: 'webtoon', label: 'Вебтун' },
  { value: 'western', label: 'Вестерн' },
  { value: 'video-game', label: 'Видеоигра' },
  { value: 'adult', label: 'Взрослая литература' },
  { value: 'coming-of-age', label: 'Взросление' },
  { value: 'visual-novel', label: 'Визуальная новелла' },
  { value: 'war', label: 'Военный' },
  { value: 'military-scifi', label: 'Военная НФ' },
  { value: 'high-fantasy', label: 'Высокое фэнтези' },
  { value: 'survival', label: 'Выживание' },
  { value: 'gangster', label: 'Гангстерский' },
  { value: 'heroic-fantasy', label: 'Героическое фэнтези' },
  { value: 'urban-fantasy', label: 'Городское фэнтези' },
  { value: 'gothic-horror', label: 'Готические ужасы' },
  { value: 'childrens', label: 'Для детей' },
  { value: 'detective', label: 'Детектив' },
  { value: 'children', label: 'Детская литература' },
  { value: 'dieselpunk', label: 'Дизельпанк' },
  { value: 'josei', label: 'Дзёсэй' },
  { value: 'documentary', label: 'Документалистика' },
  { value: 'road-trip', label: 'Дорожное приключение' },
  { value: 'drama', label: 'Драма' },
  { value: 'drama-play', label: 'Драма (пьеса)' },
  { value: 'ancient-history', label: 'Древний мир' },
  { value: 'life-story', label: 'Жизнеописание' },
  { value: 'zombie', label: 'Зомби' },
  { value: 'gamebook', label: 'Книга-игра' },
  { value: 'picture-book', label: 'Книжка-картинка' },
  { value: 'classic', label: 'Классическая литература' },
  { value: 'classic-detective', label: 'Классический детектив' },
  { value: 'climate-fiction', label: 'Климатическая фантастика' },
  { value: 'comedy', label: 'Комедия' },
  { value: 'short-film', label: 'Короткометражка' },
  { value: 'space-opera', label: 'Космоопера' },
  { value: 'space-western', label: 'Космический вестерн' },
  { value: 'crime', label: 'Криминал' },
  { value: 'crossover', label: 'Кроссовер' },
  { value: 'cultivation', label: 'Культивация' },
  { value: 'cyberpunk', label: 'Киберпанк' },         // первый
  { value: 'lovecraftian-horror', label: 'Лавкрафтовские ужасы' },
  { value: 'litrpg', label: 'ЛитРПГ' },
  { value: 'magical-realism', label: 'Магический реализм' },
  { value: 'manga', label: 'Манга' },
  { value: 'manhwa', label: 'Манхва' },
  { value: 'manhua', label: 'Маньхуа' },
  { value: 'mafia', label: 'Мафия' },
  { value: 'melodrama', label: 'Мелодрама' },
  { value: 'memoir', label: 'Мемуары' },
  { value: 'mini-series', label: 'Мини-сериал' },
  { value: 'mystery', label: 'Мистика' },
  { value: 'mythology', label: 'Мифология' },
  { value: 'young-adult', label: 'Молодёжная литература' },
  { value: 'musical', label: 'Мюзикл' },
  { value: 'soft-scifi', label: 'Мягкая НФ' },
  { value: 'silent-film', label: 'Немое кино' },
  { value: 'low-fantasy', label: 'Низкое фэнтези' },
  { value: 'educational', label: 'Образовательное' },
  { value: 'occult', label: 'Оккультизм' },
  { value: 'original', label: 'Оригинальное произведение' },
  { value: 'heist', label: 'Ограбление' },
  { value: 'workplace-drama', label: 'Офисная драма' },
  { value: 'paranormal-romance', label: 'Паранормальная романтика' },
  { value: 'parody', label: 'Пародия' },
  { value: 'first-contact', label: 'Первый контакт' },
  { value: 'slice-of-life', label: 'Повседневность' },
  { value: 'novella', label: 'Повесть' },
  { value: 'teen-drama', label: 'Подростковая драма' },
  { value: 'feature-film', label: 'Полный метр' },
  { value: 'post-apocalyptic', label: 'Постапокалипсис' },
  { value: 'adventure', label: 'Приключения' },
  { value: 'adventure-story', label: 'Приключенческий роман' },
  { value: 'parable', label: 'Притча' },
  { value: 'progression-fantasy', label: 'Прогрессивное фэнтези' },
  { value: 'psychological', label: 'Психологическое' },
  { value: 'psychological-horror', label: 'Психологические ужасы' },
  { value: 'psychological-thriller', label: 'Психологический триллер' },
  { value: 'journey', label: 'Путешествия' },
  { value: 'time-travel', label: 'Путешествия во времени' },
  { value: 'light-novel', label: 'Ранобэ' },
  { value: 'short-story', label: 'Рассказ' },
  { value: 'renaissance', label: 'Ренессанс' },
  { value: 'retro-futurism', label: 'Ретрофутуризм' },
  { value: 'role-playing', label: 'Ролевая игра' },
  { value: 'romance', label: 'Романтика' },
  { value: 'romantic-comedy', label: 'Романтическая комедия' },
  { value: 'romantic-fantasy', label: 'Романтическое фэнтези' },
  { value: 'saga', label: 'Сага' },
  { value: 'satire', label: 'Сатира' },
  { value: 'supernatural', label: 'Сверхъестественное' },
  { value: 'family-drama', label: 'Семейная драма' },
  { value: 'serial', label: 'Серийная публикация' },
  { value: 'fairy-tale', label: 'Сказка' },
  { value: 'slasher', label: 'Слэшер' },
  { value: 'slipstream', label: 'Слипстрим' },
  { value: 'solarpunk', label: 'Соларпанк' },
  { value: 'sports', label: 'Спорт' },
  { value: 'steampunk', label: 'Стимпанк' },
  { value: 'contemporary-romance', label: 'Современный любовный роман' },
  { value: 'contemporary', label: 'Современная проза' },
  { value: 'medieval', label: 'Средневековье' },      // повтор (но в списке уже был)
  { value: 'surrealism', label: 'Сюрреализм' },
  { value: 'seinen', label: 'Сэйнэн' },
  { value: 'hard-scifi', label: 'Твёрдая НФ' },
  { value: 'theatre-of-absurd', label: 'Театр абсурда' },
  { value: 'dark-fantasy', label: 'Тёмное фэнтези' },
  { value: 'dark-romance', label: 'Тёмная романтика' },
  { value: 'tragedy', label: 'Трагедия' },
  { value: 'tragicomedy', label: 'Трагикомедия' },
  { value: 'transgressive', label: 'Трансгрессивная литература' },
  { value: 'thriller', label: 'Триллер' },
  { value: 'horror', label: 'Ужасы' },
  { value: 'wuxia', label: 'Уся' },
  { value: 'utopian', label: 'Утопия' },
  { value: 'fanfiction', label: 'Фанфикшн' },
  { value: 'fan-made', label: 'Фан-контент' },
  { value: 'fantasy', label: 'Фэнтези' },             // первый
  { value: 'fantasy-romance', label: 'Фэнтези-романтика' },
  { value: 'fantasy-of-manners', label: 'Фэнтези этикета' },
  { value: 'philosophical', label: 'Философское' },
  { value: 'film', label: 'Кино' },
  { value: 'folk-horror', label: 'Фольклорные ужасы' },
  { value: 'historical-fiction', label: 'Исторический роман' },
  { value: 'historical-fantasy', label: 'Историческое фэнтези' },
  { value: 'historical-romance', label: 'Исторический любовный роман' },
  { value: 'cold-war', label: 'Холодная война' },
  { value: 'chronicle', label: 'Хроника' },
  { value: 'epic', label: 'Эпос' },
  { value: 'erotica', label: 'Эротика' },
  { value: 'erotic-romance', label: 'Эротический роман' },
  { value: 'esoteric', label: 'Эзотерика' },
  { value: 'exploitation', label: 'Эксплуатационное кино' },
  { value: 'prose-poetry', label: 'Верлибр' }
];

    const sortedProjects = computed(() => {
      return [...projects.value].sort((a, b) => a.name.localeCompare(b.name));
    });

    const modalTitle = computed(() => {
      return isEditing.value ? 'Редактировать проект' : 'Создать проект';
    });

    const submitButtonText = computed(() => {
      return isEditing.value ? 'Сохранить' : 'Создать';
    });


    async function loadProjects() {
      try {
        const list = await projectService.getProjects();
        // ✅ ОПТИМИЗАЦИЯ: Обновляем значение shallowRef чтобы Vue заметил изменение
        projects.value = list.map(p => ({
          name: p.name,
          icon: String(p.icon) || '📁',
          stats: p.stats || {}
        }));
      } catch (e) {
        console.error('Ошибка загрузки проектов:', e);
        projects.value = [];
      }
    }

    function openCreateModal() {
      isEditing.value = false;
      editingProjectName.value = '';
      formData.value = {
        name: '',
        type: 'book',
        genres: [] as string[],
        perfLevel: 'auto',
        calendar: {} as any
      };
      modalVisible.value = true;
    }


    async function openProject(name: string) {
      window.location.href = `app.html?project=${encodeURIComponent(name)}`;
    }

    async function editProject(name: string) {
      isEditing.value = true;
      editingProjectName.value = name;
      formData.value.name = name;
      try {
        const config = await projectService.getProjectConfig(name);
        if (config) {
          formData.value.type = (config.type as string) || 'book';
          formData.value.genres = (config.genres as string[]) || [];
          formData.value.perfLevel = (config.perfLevel as string) || 'auto';
        }
      } catch (e) {
        console.error('Ошибка загрузки конфигурации:', e);
      }
      modalVisible.value = true;
    }

    async function confirmDelete(name: string) {
      if (confirm(`Удалить проект "${name}"?`)) {
        try {
          await projectService.deleteProject(name);
          await loadProjects();
        } catch (e) {
          console.error('Ошибка удаления проекта:', e);
        }
      }
    }

    async function submitForm() {
      try {
        if (isEditing.value) {
          console.log('Updating project:', formData.value);
          await projectService.saveProjectConfig(editingProjectName.value, {
            type: formData.value.type,
            genres: formData.value.genres,
            perfLevel: formData.value.perfLevel,
            calendar: formData.value.calendar
          });
          await loadProjects();
        } else {
          await projectService.createProject({
            name: formData.value.name,
            type: formData.value.type,
            genres: formData.value.genres,
            perfLevel: formData.value.perfLevel,
            calendar: formData.value.calendar
          });
          await loadProjects();
        }
        closeModal();
      } catch (e) {
        console.error('Ошибка сохранения проекта:', e);
      }
    }

    function closeModal() {
      modalVisible.value = false;
    }


    onMounted(async () => {
      window.addEventListener('keydown', (e) => {
        if (e.code === 'F11') {
          e.preventDefault();
          const tauri = (window as any).__TAURI__;
          if (tauri) {
            tauri.core.invoke('toggle_fullscreen').catch((err: any) => console.error(err));
          }
        }
      }, true);

      await settingsService.loadSettings();
      settingsService.applySettings();
      loadProjects();
    });

    const cloudSyncModalRef = ref<any>(null);
    const cloudSyncMode = ref<'import' | 'export'>('export');

    function openCloudSync(mode: 'import' | 'export') {
      console.log('Button clicked! Mode:', mode);
      cloudSyncMode.value = mode;
      window.dispatchEvent(new CustomEvent('open-cloud-sync', { detail: mode }));
    }

    function showToast(toast: any) {
      // Implement toast or reuse existing logic
      console.log('Toast:', toast);
    }

    return {
      projects,
      sortedProjects,
      modalVisible,
      isEditing,
      formData,
      projectTypes,
      genres,
      modalTitle,
      submitButtonText,
      openCreateModal,
      openProject,
      editProject,
      confirmDelete,
      submitForm,
      closeModal,
      cloudSyncModalRef,
      openCloudSync,
      showToast
    };
  }
});

// Register CalendarsPanel
app.component('calendars-panel', CalendarsPanel);
app.component('vanilla-xbox-wheel', XboxWheel);
app.component('cloud-sync-modal', CloudSyncModalVue);

// Get the HTML template content and use it as Vue template
const appEl = document.getElementById('app');
if (appEl) {
  app.mount('#app');
}


