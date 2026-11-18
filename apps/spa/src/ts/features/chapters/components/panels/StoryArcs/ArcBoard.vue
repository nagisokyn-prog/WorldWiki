<template>
  <div class="arcboard-container">
    <!-- Toolbar -->
    <div class="arcboard-toolbar">
      <div class="arcboard-toolbar-title">
        <h2 class="arcboard-title">
          <span class="arcboard-icon">📋</span>
          <span>Канбан Сюжетных Арок</span>
        </h2>
      </div>

      <div class="arcboard-toolbar-controls">
        <input
          v-model="filters.searchQuery"
          type="text"
          placeholder="Поиск арок..."
          class="arcboard-search-input"
        />

        <XboxWheel
          v-model="filters.selectedType"
          :options="arcTypeFilterOptions"
        />

        <button
          class="btn-new-arc"
          @click="showCreateModal = true"
        >
          ➕ Новая Арка
        </button>

        <button
          class="btn-refresh"
          :disabled="isLoading"
          @click="refresh"
        >
          🔄 {{ isLoading ? 'Загрузка...' : 'Обновить' }}
        </button>
      </div>
    </div>

    <!-- Kanban Columns Grid -->
    <div class="arcboard-grid">
      <div
        v-for="col in columns"
        :key="col.status"
        class="kanban-column"
        :class="'kanban-col-' + col.status"
      >
        <!-- Column Header -->
        <div class="kanban-col-header">
          <span class="kanban-col-title">{{ col.title }}</span>
          <span class="kanban-col-count" :class="'badge-' + col.badgeType">
            {{ col.arcs.length }}
          </span>
        </div>

        <!-- Cards List -->
        <div class="kanban-col-body">
          <div v-if="col.arcs.length === 0" class="kanban-empty-col">
            <span class="empty-col-icon">📂</span>
            <span>Нет арок</span>
          </div>

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
import { XboxWheel } from '@worldwiki/components';
import type { ArcBoardProps, ArcBoardEmits } from './ArcBoard.model';

const arcTypeFilterOptions = [
  { value: 'all', label: 'Все типы' },
  { value: 'character', label: 'Арка персонажа' },
  { value: 'event', label: 'Арка события' },
  { value: 'relationship', label: 'Арка отношений' },
  { value: 'theme', label: 'Тематическая арка' },
];
import ArcCard from './components/ArcCard/ArcCard.vue';
import ArcCreateModal from './components/ArcCreateModal/ArcCreateModal.vue';
import { useArcBoard } from './useArcBoard';

const props = withDefaults(
  defineProps<ArcBoardProps>(),
  {
    projectId: '',
  }
);

defineEmits<ArcBoardEmits>();

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
