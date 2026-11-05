<template>
    <div class="app-container">
        <AppDialog />
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
                            <div class="project-card-layout">
                                <div v-if="project.cover_image" class="project-cover-container">
                                    <img :src="resolveCoverUrl(project.cover_image)" class="project-card-cover" alt="Обложка" />
                                </div>
                                <div v-else class="project-icon-placeholder">
                                    <span class="project-icon">{{ project.icon }}</span>
                                </div>
                                <div class="project-card-meta">
                                    <h3>{{ project.name }}</h3>
                                    <div v-if="project.stats" class="project-stats">
                                        <span>{{ project.stats.chapters || 0 }} глав</span>
                                    </div>
                                </div>
                            </div>
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
                        <span class="text-xs text-muted ml-auto">Ctrl+K / Ctrl+Shift+P — командная панель</span>
                    </div>
                    <div class="hotkeys-grid-cols">
                        <div class="hk-item"><kbd>Ctrl+K</kbd> <span>Командная панель</span></div>
                        <div class="hk-item"><kbd>Ctrl+P</kbd> <span>Быстрое открытие</span></div>
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
        <div v-if="modalVisible" id="createProjectModal" class="glass-modal-overlay visible">
            <div class="glass-modal large-modal">
                <div class="modal-header">
                    <h2 class="glass-title">{{ modalTitle }}</h2>
                    <button class="close-btn glass-btn" @click="closeModal">×</button>
                </div>
                <div class="modal-body">
                    <form id="createProjectForm" @submit.prevent="submitForm">
                        <div class="project-modal-columns">
                            <!-- Левая колонка: Обложка произведения -->
                            <div class="project-cover-column">
                                <label class="glass-label">Обложка</label>
                                <div class="project-cover-slot" @click="selectCoverImage">
                                    <template v-if="formData.cover_image">
                                        <img :src="resolveCoverUrl(formData.cover_image)" class="project-cover-poster" alt="Обложка произведения">
                                    </template>
                                    <template v-else>
                                        <div class="cover-empty-placeholder">
                                            <span class="cover-upload-icon">🖼️</span>
                                            <span class="cover-upload-text">Выбрать обложку</span>
                                            <small class="cover-upload-hint">.png, .jpg, .webp</small>
                                        </div>
                                    </template>
                                </div>
                                <div v-if="formData.cover_image" class="cover-slot-controls">
                                    <button type="button" class="glass-btn outline sm flex-1" @click.stop="selectCoverImage">
                                        🖼️ Заменить
                                    </button>
                                    <button type="button" class="glass-btn outline sm flex-1" @click.stop="removeCoverImage">
                                        🗑️ Удалить
                                    </button>
                                </div>
                            </div>

                            <!-- Правая колонка: Название, Тип и Жанры -->
                            <div class="project-info-column">
                                <div class="project-compact-header">
                                    <div class="form-group flex-1">
                                        <label class="glass-label" for="projectName">Название произведения</label>
                                        <input
id="projectName" v-model="formData.name" type="text" class="glass-input"
                                            placeholder="Введите название произведения" required>
                                        <small class="glass-label">Название вашего произведения</small>
                                    </div>

                                    <div class="form-group form-group-fixed-type">
                                        <label class="glass-label">Тип произведения</label>
                                        <vanilla-xbox-wheel
                                            v-model="formData.type"
                                            :options="availableProjectTypes"></vanilla-xbox-wheel>
                                        <div v-if="formData.type === 'custom'" class="flex gap-2 mt-2">
                                            <input
                                                v-model="customTypeInput"
                                                type="text"
                                                class="glass-input custom-type-input flex-1"
                                                placeholder="Введите тип (напр. Манга, Фанфик...)"
                                                @keydown.enter.prevent="saveCustomTypeToWheel"
                                            >
                                            <button
                                                type="button"
                                                class="glass-btn primary sm"
                                                title="Сохранить и добавить в барабан"
                                                @click.prevent="saveCustomTypeToWheel"
                                            >
                                                + В барабан
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div class="form-group genres-fullwidth">
                                    <label class="glass-label">Жанры произведения</label>
                                    <div class="genres-grid glass-card">
                                        <div class="glass-card-bg"></div>
                                        <div class="glass-card-content genres-card-content">
                                            <div class="genres-grid-inner">
                                                <!-- Стандартные жанры -->
                                                <label v-for="genre in genres" :key="genre.value" class="genre-checkbox">
                                                    <input v-model="formData.genres" type="checkbox" :value="genre.value">
                                                    <span>{{ (genre as any).icon || '' }} {{ genre.label }}</span>
                                                </label>

                                                <!-- Кастомные жанры пользователя -->
                                                <label
                                                    v-for="cGenre in customGenresList"
                                                    :key="cGenre.value"
                                                    class="genre-checkbox custom-genre"
                                                    :title="'Кастомный жанр: ' + cGenre.label"
                                                >
                                                    <input v-model="formData.genres" type="checkbox" :value="cGenre.value">
                                                    <span>✨ {{ cGenre.label }}</span>
                                                    <button
                                                        type="button"
                                                        class="custom-genre-remove"
                                                        title="Удалить этот жанр"
                                                        @click.stop.prevent="deleteCustomGenre(cGenre.value)"
                                                    >×</button>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Строка ввода своего жанра -->
                                    <div class="custom-genres-row">
                                        <input
                                            v-model="customGenreInput"
                                            type="text"
                                            class="glass-input flex-1"
                                            placeholder="Добавить свой жанр..."
                                            @keydown.enter.prevent="addCustomGenre"
                                        >
                                        <button type="button" class="glass-btn outline" @click="addCustomGenre">
                                            Добавить
                                        </button>
                                    </div>
                                    <small class="glass-label">Выберите предустановленные жанры или добавьте свои</small>
                                </div>
                            </div>
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
import { AppDialog, XboxWheel as VanillaXboxWheel } from '@worldwiki/components';
import CloudSyncModal from '@/features/sync/CloudSyncModal.vue';
import { useProjectLauncher } from './useProjectLauncher';

const {
  projects,
  sortedProjects,
  modalVisible,
  formData,
  customGenreInput,
  customTypeInput,
  customGenresList,
  availableProjectTypes,
  saveCustomTypeToWheel,
  genres,
  modalTitle,
  submitButtonText,
  openCreateModal,
  openProject,
  editProject,
  confirmDelete,
  submitForm,
  closeModal,
  addCustomGenre,
  deleteCustomGenre,
  selectCoverImage,
  removeCoverImage,
  resolveCoverUrl,
  openCloudSync,
  showToast
} = useProjectLauncher();
</script>

<style scoped src="@worldwiki/resources/styles/features/shell/ProjectLauncher.css"></style>
