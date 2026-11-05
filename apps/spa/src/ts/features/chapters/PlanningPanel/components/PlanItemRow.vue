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
      <div class="plan-status-container relative">
        <button
          type="button"
          class="plan-status-btn"
          :class="[`status-${item.status}`, { done: item.status === 'done' || item.done }]"
          :title="statusTooltip"
          @click="onToggle"
          @contextmenu.prevent.stop="openStatusMenu"
        >
          <span v-if="item.status === 'done' || item.done" class="status-icon-done">✓</span>
          <span v-else-if="item.status === 'in_progress'" class="status-pulse-dot" title="В работе 🟡"></span>
          <span v-else-if="item.status === 'blocked'" class="status-icon-lock" title="Ожидает 🔒">🔒</span>
          <span v-else class="status-icon-planned" title="В планах ⚪"></span>
        </button>

        <div v-if="isStatusMenuOpen" class="status-picker-dropdown" @click.stop>
          <div class="status-picker-header">Статус задачи:</div>
          <button
            type="button"
            class="status-picker-item"
            :class="{ 'is-selected': item.status === 'planned' && !item.done }"
            @click="onSelectStatus('planned')"
          >
            <div class="flex items-center gap-2"><span class="status-dot neutral"></span><span>В планах</span></div>
            <span v-if="item.status === 'planned' && !item.done" class="status-picker-check">✓</span>
          </button>
          <button
            type="button"
            class="status-picker-item"
            :class="{ 'is-selected': item.status === 'in_progress' }"
            @click="onSelectStatus('in_progress')"
          >
            <div class="flex items-center gap-2"><span class="status-dot warning"></span><span>В работе</span></div>
            <span v-if="item.status === 'in_progress'" class="status-picker-check">✓</span>
          </button>
          <button
            type="button"
            class="status-picker-item"
            :class="{ 'is-selected': item.status === 'done' || item.done }"
            @click="onSelectStatus('done')"
          >
            <div class="flex items-center gap-2"><span class="status-dot success"></span><span>Готово</span></div>
            <span v-if="item.status === 'done' || item.done" class="status-picker-check">✓</span>
          </button>
          <button
            type="button"
            class="status-picker-item"
            :class="{ 'is-selected': item.status === 'blocked' }"
            @click="onSelectStatus('blocked')"
          >
            <div class="flex items-center gap-2"><span class="status-dot blocked"></span><span>Ожидает</span></div>
            <span v-if="item.status === 'blocked'" class="status-picker-check">✓</span>
          </button>
        </div>
      </div>

      <input
        v-model="item.text"
        class="plan-item-input flex-1"
        :class="{ done: item.status === 'done' || item.done }"
        placeholder="Пункт плана..."
        @blur="onSave"
        @keydown.enter.prevent="onSave"
      />

      <div class="plan-item-dep-container">
        <button
          type="button"
          class="plan-item-dep-btn"
          :class="{ 'is-linked': !!item.depends_on }"
          title="Связать с задачей-предшественником"
          @click.stop="toggleDepMenu"
        >
          🔗
        </button>

        <div v-if="isDepMenuOpen" class="dep-picker-dropdown" @click.stop>
          <div class="dep-picker-header">Предшествующее событие:</div>
          <button v-if="item.depends_on" type="button" class="dep-picker-unlink-btn" @click="onSelectDependency(null)">
            <span>✕</span><span>Снять зависимость</span>
          </button>

          <div v-for="group in groupedCandidates" :key="group.chapterId" class="dep-picker-group">
            <div class="dep-picker-chapter-title">📄 {{ group.chapterTitle }}</div>
            <button
              v-for="cand in group.todos"
              :key="cand.id"
              type="button"
              class="dep-picker-item"
              :class="{ 'is-selected': cand.id === item.depends_on }"
              @click="onSelectDependency(cand.id)"
            >
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="status-dot shrink-0" :class="cand.status === 'done' ? 'success' : (cand.status === 'in_progress' ? 'warning' : 'neutral')"></span>
                <span class="truncate">{{ cand.text }}</span>
              </div>
              <span v-if="cand.id === item.depends_on" class="text-accent text-[10px] ml-1 shrink-0">✓</span>
            </button>
          </div>

          <div v-if="groupedCandidates.length === 0" class="dep-picker-empty">Нет доступных задач для связи</div>
        </div>
      </div>

      <button type="button" class="plan-item-delete-btn" title="Удалить задачу" @click="onDelete">×</button>
    </div>

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
        <span>🔗</span><span>Открывает: {{ item.blocks_title }} ➔</span>
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
  statusTooltip, isDepMenuOpen, isStatusMenuOpen, groupedCandidates, toggleDepMenu,
  openStatusMenu, onSelectStatus, onSelectDependency, onToggle,
  onSave, onDelete, onNavigate
} = usePlanItemRow(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/PlanningPanel.css"></style>
