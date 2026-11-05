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

        <select
          v-model="filters.selectedType"
          class="arcboard-select"
        >
          <option value="all">Все типы</option>
          <option value="character">Арка персонажа</option>
          <option value="event">Арка события</option>
          <option value="relationship">Арка отношений</option>
          <option value="theme">Тематическая арка</option>
        </select>

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
import type { ArcBoardProps, ArcBoardEmits } from './ArcBoard.model';
import ArcCard from './components/ArcCard.vue';
import ArcCreateModal from './components/ArcCreateModal.vue';
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
