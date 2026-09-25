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
          <ArcCard
            v-for="arc in col.arcs"
            :key="arc.id || arc.title"
            :arc="arc"
            :effective-status="getArcEffectiveStatus(arc)"
            :linked-blocks="getLinkedBlocks(arc.id)"
            @update-status="updateArcStatus"
            @delete="deleteArc"
            @locate="$emit('locate', $event)"
          />
        </div>
      </div>
    </div>

    <!-- Simple Create Modal -->
    <ArcCreateModal
      v-if="showCreateModal"
      v-model:title="newArcTitle"
      v-model:arc-type="newArcType"
      @close="showCreateModal = false"
      @create="handleCreate"
    />
  </div>
</template>

<script setup lang="ts">
import ArcCard from './components/ArcCard.vue';
import ArcCreateModal from './components/ArcCreateModal.vue';
import { useArcBoard } from './useArcBoard';

const props = withDefaults(
  defineProps<{
    projectId?: string;
  }>(),
  {
    projectId: '',
  }
);

defineEmits<{
  (e: 'locate', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
}>();

const {
  filters,
  columns,
  isLoading,
  showCreateModal,
  newArcTitle,
  newArcType,
  getArcEffectiveStatus,
  getLinkedBlocks,
  handleCreate,
  updateArcStatus,
  deleteArc,
  refresh,
} = useArcBoard(props.projectId);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/ArcBoard.css"></style>
