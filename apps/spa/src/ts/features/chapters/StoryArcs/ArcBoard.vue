<template>
  <div class="arcboard-container flex flex-col h-full w-full overflow-hidden bg-surface text-main">
    <!-- Toolbar -->
    <div class="arcboard-toolbar flex flex-wrap items-center justify-between gap-3 p-4 border-b border-subtle bg-surface">
      <div class="flex items-center gap-3">
        <h2 class="text-base font-bold m-0 flex items-center gap-2">
          <span>📋</span> Канбан Сюжетных Арок
        </h2>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="filters.searchQuery"
          type="text"
          placeholder="Поиск арок..."
          class="text-xs px-3 py-1.5 rounded border border-subtle bg-input text-main"
        />

        <select
          v-model="filters.selectedType"
          class="text-xs px-2 py-1.5 rounded border border-subtle bg-input text-main"
        >
          <option value="all">Все типы</option>
          <option value="character">Арка персонажа</option>
          <option value="event">Арка события</option>
          <option value="relationship">Арка отношений</option>
          <option value="theme">Тематическая арка</option>
        </select>

        <button
          class="btn-new-arc text-xs px-3 py-1.5 rounded font-bold bg-accent text-surface cursor-pointer"
          @click="showCreateModal = true"
        >
          ➕ Новая Арка
        </button>

        <button
          class="btn-refresh text-xs px-3 py-1.5 rounded border border-subtle bg-surface-hover hover:bg-surface text-main cursor-pointer"
          :disabled="isLoading"
          @click="refresh"
        >
          🔄 {{ isLoading ? 'Загрузка...' : 'Обновить' }}
        </button>
      </div>
    </div>

    <!-- Kanban Columns Grid -->
    <div class="arcboard-grid flex-1 overflow-x-auto p-6 flex gap-6">
      <div
        v-for="col in columns"
        :key="col.status"
        class="kanban-col flex flex-col flex-1 min-w-[280px] max-w-[340px] rounded-lg border border-subtle bg-surface-subtle overflow-hidden"
      >
        <!-- Column Header -->
        <div class="col-header p-3 border-b border-subtle flex items-center justify-between bg-surface font-bold text-xs">
          <span>{{ col.title }}</span>
          <span class="badge text-2xs px-2 py-0.5 rounded" :class="'badge-' + col.badgeType">
            {{ col.arcs.length }}
          </span>
        </div>

        <!-- Cards List -->
        <div class="col-body flex-1 overflow-y-auto p-3 space-y-3">
          <div
            v-for="arc in col.arcs"
            :key="arc.id || arc.title"
            class="arc-card p-3 rounded border border-subtle bg-surface hover:bg-surface-hover shadow-xs transition-shadow flex flex-col gap-2 cursor-pointer"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="font-bold text-xs text-main">{{ arc.title }}</span>
              <span class="text-2xs px-1.5 py-0.5 rounded bg-surface-hover text-muted capitalize">
                {{ arc.arc_type }}
              </span>
            </div>

            <p v-if="arc.description" class="text-xs text-muted m-0 line-clamp-2">
              {{ arc.description }}
            </p>

            <!-- Card Actions / Move buttons -->
            <div class="flex items-center justify-between pt-2 border-t border-subtle text-2xs text-muted">
              <select
                :value="arc.status"
                class="status-quick-select text-2xs px-1.5 py-0.5 rounded border border-subtle bg-input text-main"
                @change="updateArcStatus(arc, ($event.target as HTMLSelectElement).value as ArcStatus)"
              >
                <option value="planned">Запланировано</option>
                <option value="in_progress">В Процессе</option>
                <option value="completed">Завершено</option>
                <option value="abandoned">Отменено</option>
              </select>

              <button
                class="btn-del hover:text-danger cursor-pointer p-1"
                title="Удалить арку"
                @click.stop="deleteArc(arc.id)"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Simple Create Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 bg-backdrop flex items-center justify-center z-50 p-4"
      @click.self="showCreateModal = false"
    >
      <div class="modal-box p-6 rounded-lg border border-subtle bg-surface w-full max-w-md space-y-4 shadow-lg">
        <h3 class="text-base font-bold m-0">Создать Сюжетную Линию (Арку)</h3>

        <div class="space-y-2">
          <label class="text-xs font-bold text-muted">Название арки:</label>
          <input
            v-model="newArcTitle"
            type="text"
            placeholder="Например: Арка Примирения с Эрис..."
            class="w-full text-xs px-3 py-2 rounded border border-subtle bg-input text-main"
          />
        </div>

        <div class="space-y-2">
          <label class="text-xs font-bold text-muted">Тип арки:</label>
          <select
            v-model="newArcType"
            class="w-full text-xs px-3 py-2 rounded border border-subtle bg-input text-main"
          >
            <option value="character">Персонаж (Character)</option>
            <option value="event">Событие (Event)</option>
            <option value="relationship">Отношения (Relationship)</option>
            <option value="theme">Тема (Theme)</option>
          </select>
        </div>

        <div class="flex justify-end gap-2 pt-3">
          <button
            class="px-4 py-1.5 text-xs rounded border border-subtle bg-surface hover:bg-surface-hover text-main cursor-pointer"
            @click="showCreateModal = false"
          >
            Отмена
          </button>
          <button
            class="px-4 py-1.5 text-xs rounded font-bold bg-accent text-surface cursor-pointer"
            :disabled="!newArcTitle.trim()"
            @click="handleCreate"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useArcBoard } from './useArcBoard';
import type { ArcStatus } from './StoryArcs.model';

const props = withDefaults(
  defineProps<{
    projectId?: string;
  }>(),
  {
    projectId: '',
  }
);

const {
  filters,
  columns,
  isLoading,
  showCreateModal,
  newArcTitle,
  newArcType,
  handleCreate,
  updateArcStatus,
  deleteArc,
  refresh,
} = useArcBoard(props.projectId);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/ArcBoard.css"></style>

