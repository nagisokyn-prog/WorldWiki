<template>
  <div
    class="plan-item-row"
    :class="{
      'is-blocked': item.status === 'blocked',
      'is-in-progress': item.status === 'in_progress',
      'is-done': item.status === 'done' || item.done
    }"
  >
    <div class="plan-item-main flex items-center gap-2 w-full">
      <!-- Status Icon Toggle -->
      <button
        type="button"
        class="plan-status-btn"
        :class="[`status-${item.status}`, { done: item.status === 'done' || item.done }]"
        :title="statusTooltip"
        @click="onToggle"
        @contextmenu.prevent="onCycleStatus"
      >
        <span v-if="item.status === 'done' || item.done" class="status-icon-done">✓</span>
        <span v-else-if="item.status === 'in_progress'" class="status-pulse-dot" title="В работе 🟡"></span>
        <span v-else-if="item.status === 'blocked'" class="status-icon-lock" title="Ожидает 🔒">🔒</span>
        <span v-else class="status-icon-planned" title="В планах ⚪"></span>
      </button>

      <!-- Input Text -->
      <input
        v-model="item.text"
        class="plan-item-input flex-1"
        :class="{ done: item.status === 'done' || item.done }"
        placeholder="Пункт плана..."
        @blur="onSave"
        @keydown.enter.prevent="onSave"
      />

      <!-- Dependency Picker Toggle -->
      <div class="relative">
        <button
          type="button"
          class="plan-item-dep-btn text-muted hover:text-accent px-1 text-xs cursor-pointer bg-transparent border-none"
          :class="{ 'text-accent': !!item.depends_on }"
          title="Связать с задачей-предшественником"
          @click.stop="toggleDepMenu"
        >
          🔗
        </button>

        <!-- Dropdown Menu -->
        <div
          v-if="isDepMenuOpen"
          class="dep-picker-dropdown absolute right-0 top-full mt-1 z-50 bg-secondary border border-border rounded shadow-lg p-1.5 min-w-56 max-h-56 overflow-y-auto flex flex-col gap-1 text-xs"
          @click.stop
        >
          <div class="px-1 text-[10px] font-semibold text-muted uppercase">Предшествующее событие:</div>

          <button
            v-if="item.depends_on"
            type="button"
            class="text-left text-danger hover:bg-hover px-2 py-1 rounded flex items-center gap-1 cursor-pointer bg-transparent border-none text-xs"
            @click="onSelectDependency(null)"
          >
            <span>✕</span>
            <span>Снять зависимость</span>
          </button>

          <div v-for="group in groupedCandidates" :key="group.chapterId" class="flex flex-col gap-0.5">
            <div class="text-[10px] text-muted font-medium px-1 mt-1 truncate">📄 {{ group.chapterTitle }}</div>
            <button
              v-for="cand in group.todos"
              :key="cand.id"
              type="button"
              class="text-left text-xs px-2 py-1 rounded hover:bg-hover text-main truncate flex items-center justify-between cursor-pointer bg-transparent border-none"
              :class="{ 'font-semibold text-accent': cand.id === item.depends_on }"
              @click="onSelectDependency(cand.id)"
            >
              <span class="truncate">{{ cand.text }}</span>
              <span v-if="cand.id === item.depends_on" class="text-accent text-[10px] ml-1 shrink-0">✓</span>
            </button>
          </div>

          <div v-if="groupedCandidates.length === 0" class="text-muted text-center p-2 text-xs">
            Нет доступных задач для связи
          </div>
        </div>
      </div>

      <!-- Delete Button -->
      <button
        type="button"
        class="plan-item-delete-btn"
        title="Удалить задачу"
        @click="onDelete"
      >
        ×
      </button>
    </div>

    <!-- Causality Links (Depends On / Blocks) -->
    <div v-if="item.depends_on_title || item.blocks_title" class="plan-item-causality">
      <span
        v-if="item.depends_on_title"
        class="causality-badge depends-badge"
        :title="'Ожидает выполнения: ' + item.depends_on_title"
      >
        <span>⛓️</span>
        <span>Ждёт: {{ item.depends_on_title }}</span>
        <button
          type="button"
          class="ml-1 text-muted hover:text-danger cursor-pointer bg-transparent border-none text-[10px] px-0.5"
          title="Отвязать зависимость"
          @click.stop="onSelectDependency(null)"
        >
          ✕
        </button>
      </span>

      <button
        v-if="item.blocks_title && item.blocks_chapter_id"
        type="button"
        class="causality-badge blocks-badge"
        :title="'Открывает шаг в главе: ' + item.blocks_title"
        @click.stop="onNavigate(item.blocks_chapter_id)"
      >
        <span>🔗</span>
        <span>Открывает: {{ item.blocks_title }} ➔</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlanItemRowProps, PlanItemRowEmits } from './PlanItemRow.model';
import { usePlanItemRow } from './usePlanItemRow';

const props = defineProps<PlanItemRowProps>();
const emit = defineEmits<PlanItemRowEmits>();

const {
  statusTooltip,
  isDepMenuOpen,
  groupedCandidates,
  toggleDepMenu,
  onSelectDependency,
  onToggle,
  onCycleStatus,
  onSave,
  onDelete,
  onNavigate
} = usePlanItemRow(props, emit);
</script>
