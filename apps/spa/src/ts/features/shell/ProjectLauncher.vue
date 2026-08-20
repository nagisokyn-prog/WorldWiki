<template>
    <div class="app-container">
        <AppDialog />
        <GlobalTimeViewer />
        <!-- Хедер -->
        <header v-motion-slide-top class="launcher-header glass-panel">
            <div class="logo">
                <h1>📚 World Wiki</h1>
                <p>Выберите или создайте проект</p>
            </div>
            <div class="header-actions flex gap-2 items-center">
                <button
class="glass-btn outline interactive-el" title="Загрузить из облака"
                    @click="openCloudSync('import')">
                    ☁️ Импорт
                </button>
                <button
class="glass-btn outline interactive-el" title="Сохранить в облако"
                    @click="openCloudSync('export')">
                    ☁️ Экспорт
                </button>
                <a
href="settings.html" class="glass-btn outline interactive-el header-btn-link" title="Настройки">
                    <i class="fas fa-cog"></i>
                </a>
                <button class="glass-btn primary interactive-el" @click="openCreateModal">
                    <i class="fas fa-plus"></i> Новый проект
                </button>
            </div>
        </header>

        <!-- Основной контент -->
        <main v-motion-slide-bottom class="launcher-main">
            <div class="projects-section">
                <h2 class="glass-title">Ваши проекты</h2>

                <!-- Сетка проектов -->
                <div v-auto-animate class="projects-grid glass-grid-auto">
                    <div
v-for="project in sortedProjects" :key="project.name"
                        class="glass-card push-pull-container interactive-el project-card"
                        @click="openProject(project.name)">
                        <div class="glass-card-bg"></div>
                        <div class="glass-card-content">
                            <div class="project-actions">
                                <button
class="glass-btn outline" title="Редактировать"
                                    @click.stop="editProject(project.name)">✏️</button>
                                <button
class="glass-btn outline" title="Удалить"
                                    @click.stop="confirmDelete(project.name)">🗑️</button>
                            </div>
                            <div class="project-icon">{{ project.icon }}</div>
                            <h3>{{ project.name }}</h3>
                        </div>
                    </div>
                </div>

                <!-- Пустое состояние -->
                <div v-if="projects.length === 0" class="empty-state glass-card">
                    <div class="glass-card-bg"></div>
                    <div class="glass-card-content text-center">
                        <div class="empty-icon">📁</div>
                        <h3>Нет проектов</h3>
                        <p>Создайте свой первый проект чтобы начать работу</p>
                        <button class="glass-btn primary interactive-el" @click="openCreateModal">
                            <i class="fas fa-plus"></i> Создать проект
                        </button>
                    </div>
                </div>
            </div>

            <!-- Hotkeys reminder -->
            <div v-once class="hotkeys-reminder glass-card mt-8">
                <div class="glass-card-bg"></div>
                <div class="glass-card-content px-6 py-5">
                    <div class="hotkeys-header-row">
                        <span class="text-lg">⌨️</span>
                        <h3 class="m-0 text-sm font-semibold text-main">Горячие клавиши в редакторе</h3>
                        <span class="text-xs text-muted ml-auto">Ctrl+Shift+P — открыть список всех команд</span>
                    </div>
                    <div class="hotkeys-grid-cols">
                        <div class="hk-item"><kbd>Ctrl+P</kbd> <span>Быстрое открытие</span></div>
                        <div class="hk-item"><kbd>Ctrl+Shift+P</kbd> <span>Командная панель</span></div>
                        <div class="hk-item"><kbd>Ctrl+S</kbd> <span>Сохранить всё</span></div>
                        <div class="hk-item"><kbd>Ctrl+W</kbd> <span>Закрыть вкладку</span></div>
                        <div class="hk-item"><kbd>Ctrl+Tab</kbd> <span>Следующая вкладка</span></div>
                        <div class="hk-item"><kbd>Ctrl+1…9</kbd> <span>Вкладка по номеру</span></div>
                        <div class="hk-item"><kbd>Ctrl+B</kbd> <span>Скрыть сайдбар</span></div>
                        <div class="hk-item"><kbd>Ctrl+`</kbd> <span>Скрыть терминал</span></div>
                        <div class="hk-item"><kbd>Ctrl+N</kbd> <span>Новая сущность</span></div>
                        <div class="hk-item"><kbd>Ctrl+Shift+N</kbd> <span>Новая глава</span></div>
                        <div class="hk-item"><kbd>Ctrl+= / Ctrl+-</kbd> <span>Масштаб</span></div>
                        <div class="hk-item"><kbd>Alt+1…9</kbd> <span>Секция в редакторе</span></div>
                    </div>
                </div>
            </div>
        </main>

        <!-- Модальное окно создания/редактирования проекта -->
        <div id="createProjectModal" class="glass-modal-overlay" :class="{ visible: modalVisible }" aria-hidden="true">
            <div class="glass-modal large-modal">
                <div class="modal-header">
                    <h2 class="glass-title">{{ modalTitle }}</h2>
                    <button class="close-btn glass-btn" @click="closeModal">×</button>
                </div>
                <div class="modal-body">
                    <form id="createProjectForm" @submit.prevent="submitForm">
                        <div class="project-compact-header">
                            <div class="form-group flex-1">
                                <label class="glass-label" for="projectName">Название произведения</label>
                                <input
id="projectName" v-model="formData.name" type="text" class="glass-input"
                                    :disabled="isEditing" placeholder="Введите название произведения" required>
                                <small class="glass-label">Название вашего произведения</small>
                            </div>

                            <div class="form-group form-group-fixed-type">
                                <label class="glass-label">Тип произведения</label>
                                <vanilla-xbox-wheel
v-model="formData.type"
                                    :options="projectTypes"></vanilla-xbox-wheel>
                            </div>
                        </div>

                        <div class="form-group genres-fullwidth">
                            <label class="glass-label">Жанры произведения</label>
                            <div class="genres-grid glass-card">
                                <div class="glass-card-bg"></div>
                                <div class="glass-card-content genres-card-content">
                                    <div class="genres-grid-inner">
                                        <label v-for="genre in genres" :key="genre.value" class="genre-checkbox">
                                            <input v-model="formData.genres" type="checkbox" :value="genre.value">
                                            <span>{{ (genre as any).icon || '' }} {{ genre.label }}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <small class="glass-label">Выберите один или нескольких жанров</small>
                        </div>

                        <div class="form-group calendar-fullwidth">
                            <label class="glass-label">📅 Календарь мира</label>
                            <calendars-panel ref="calendarsPanelRef" :project="formData.name"></calendars-panel>
                            <small class="glass-label">Управление календарями мира. Эти настройки будут сохранены
                                независимо.</small>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="glass-btn secondary" @click="closeModal">Отмена</button>
                    <button type="button" class="glass-btn primary" @click="submitForm">{{ submitButtonText }}</button>
                </div>
            </div>
        </div>

        <!-- Toast Container -->
        <div id="toastContainer" class="toast-container"></div>

        <cloud-sync-modal @toast="showToast"></cloud-sync-modal>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { projectService } from '../../services/project.service';
import { settingsService, AppDialog } from '@worldwiki/components';
import { XboxWheel as VanillaXboxWheel } from '@worldwiki/components';
import CalendarsPanel from '../../features/timeline/CalendarsPanel/CalendarsPanel.vue';
import CloudSyncModal from '../../features/sync/CloudSyncModal.vue';
import { invoke } from '@tauri-apps/api/core';
import GlobalTimeViewer from '../../features/timeline/Calendars/GlobalTimeViewer/GlobalTimeViewer.vue';

const router = useRouter();

// ✅ ОПТИМИЗАЦИЯ: shallowRef для больших массивов проектов
const projects = shallowRef<Array<{ name: string; icon: string; stats: Record<string, number> }>>([]);
const modalVisible = ref(false);
const isEditing = ref(false);
const editingProjectName = ref('');
const calendarsPanelRef = ref<{ saveAll?: () => Promise<void> } | null>(null);

const formData = ref<{
    name: string;
    type: string;
    genres: string[];
    perfLevel: string;
}>({
    name: '',
    type: 'book',
    genres: [],
    perfLevel: 'auto'
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
    { value: 'cyberpunk', label: 'Киберпанк' },
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
    { value: 'medieval', label: 'Средневековье' },
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
    { value: 'fantasy', label: 'Фэнтези' },
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
        projects.value = list.map((p) => ({
            name: p.name,
            icon: String(p.icon || '📁'),
            stats: (p.stats as unknown as Record<string, number>) || {}
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
        perfLevel: 'auto'
    };
    modalVisible.value = true;
}

async function openProject(name: string) {
    // В SPA переходим через роутер с передачей параметра query
    router.push({ path: '/app', query: { project: name } });
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
    const { appConfirm } = await import('@worldwiki/components');
    if (await appConfirm(`Удалить проект "${name}"?`)) {
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
                perfLevel: formData.value.perfLevel
            });
            if (calendarsPanelRef.value && calendarsPanelRef.value.saveAll) {
                await calendarsPanelRef.value.saveAll();
            }
            await loadProjects();
        } else {
            await projectService.createProject({
                name: formData.value.name,
                type: formData.value.type,
                genres: formData.value.genres,
                perfLevel: formData.value.perfLevel
            });
            if (calendarsPanelRef.value && calendarsPanelRef.value.saveAll) {
                await calendarsPanelRef.value.saveAll();
            }

            await loadProjects();
            closeModal();
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
            invoke('toggle_fullscreen').catch((err: unknown) => console.error(err));
        }
    }, true);

    await settingsService.loadSettings();
    settingsService.applySettings();
    loadProjects();
});

const cloudSyncMode = ref<'import' | 'export'>('export');

function openCloudSync(mode: 'import' | 'export') {
    console.log('Button clicked! Mode:', mode);
    cloudSyncMode.value = mode;
    window.dispatchEvent(new CustomEvent('open-cloud-sync', { detail: mode }));
}

function showToast(toast: { text?: string; type?: string; [key: string]: unknown }) {
    console.log('Toast:', toast);
}
</script>

<style scoped src="@worldwiki/resources/styles/features/shell/ProjectLauncher.css"></style>