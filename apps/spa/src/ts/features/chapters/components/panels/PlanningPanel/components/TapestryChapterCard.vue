<template>
  <div
    :id="'chapter-card-' + chapter.chapterId.replace(/^[a-z_]+:/, '')"
    class="tapestry-chapter-card"
    :class="{ 'is-focused': chapter.isCurrent, 'is-collapsed': chapter.isCollapsed }"
  >
    <!-- Collapsed Compact Header (for any collapsed chapter) -->
    <div v-if="chapter.isCollapsed" class="chapter-compact-header flex items-center justify-between cursor-pointer" @click="onToggleCollapse">
      <div class="flex items-center gap-2 overflow-hidden">
        <span class="text-muted text-xs">▸</span>
        <span class="chapter-icon">📄</span>
        <span class="chapter-compact-title font-medium text-xs text-main">{{ chapter.title }}</span>
        <span v-if="chapter.isCurrent" class="chip-current-focus text-[10px]">📍 ТЕКУЩАЯ</span>
      </div>
      <div class="flex items-center gap-1.5 text-xs">
        <span v-if="chapter.totalCount > 0" class="text-muted font-medium">{{ chapter.doneCount }}/{{ chapter.totalCount }}</span>
        <span v-if="chapter.totalCount > 0 && chapter.doneCount === chapter.totalCount" class="chapter-done-check">✓</span>
      </div>
    </div>

    <!-- Expanded Full Detail View (for expanded chapter) -->
    <div v-else class="chapter-expanded-content">
      <!-- Chapter Main Header -->
      <div
        class="chapter-expanded-header flex items-center justify-between pb-2 border-b border-border cursor-pointer"
        title="Свернуть главу"
        @click="onToggleCollapse"
      >
        <div class="flex items-center gap-2 overflow-hidden">
          <button
            type="button"
            class="text-muted text-xs hover:text-main"
            title="Свернуть главу"
            @click.stop="onToggleCollapse"
          >
            ▼
          </button>
          <span class="chapter-icon">📄</span>
          <span class="chapter-main-title font-semibold text-sm text-main">{{ chapter.title }}</span>
          <span v-if="chapter.isCurrent" class="chip-current-focus text-[10px]">📍 ТЕКУЩАЯ</span>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="text-muted font-medium">{{ chapter.doneCount }}/{{ chapter.totalCount }} задач</span>
        </div>
      </div>

      <!-- Bound Story Arcs Section -->
      <div class="chapter-arcs-section mt-3 flex flex-col gap-2">
        <div class="flex items-center justify-between px-1">
          <span class="plan-section-label">⚡ Сюжетные арки главы</span>
          <div class="relative">
            <button type="button" class="btn-add-arc-to-chapter" title="Привязать арку" @click="isArcPickerOpen = !isArcPickerOpen">
              <span>＋</span> Арка
            </button>
            <div v-if="isArcPickerOpen" class="arc-quick-picker-dropdown" @click.stop>
              <div class="p-1.5 border-b border-border text-[11px] font-semibold text-muted">Доступные арки проекта:</div>
              <div class="max-h-40 overflow-y-auto p-1 flex flex-col gap-0.5">
                <button
                  v-for="arc in availableArcs"
                  :key="arc.id || ''"
                  type="button"
                  class="arc-picker-item text-left text-xs px-2 py-1 rounded hover:bg-hover flex items-center gap-1.5"
                  @click="selectArcToAttach(arc.id)"
                >
                  <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: arc.color || 'var(--accent)' }"></span>
                  <span class="text-main">{{ arc.title }}</span>
                </button>
                <div v-if="availableArcs.length === 0" class="text-xs text-muted p-2 text-center">Все арки уже привязаны</div>
              </div>
            </div>
          </div>
        </div>

        <PlanArcGroup
          v-for="group in chapter.arcGroups"
          :key="group.arcId"
          :arc-group="group"
          :chapter-id="chapter.chapterId"
          :all-todos="allTodos"
          @toggle="$emit('toggle', $event)"
          @cycle-status="$emit('cycle-status', $event)"
          @set-status="(item, status) => $emit('set-status', item, status)"
          @save="$emit('save', $event)"
          @delete="$emit('delete', $event)"
          @navigate="$emit('navigate', $event)"
          @add-todo="$emit('add-todo', $event)"
          @set-dependency="(item, pid) => $emit('set-dependency', item, pid)"
        />

        <div v-if="chapter.arcGroups.length === 0" class="empty-arcs-hint text-xs text-muted px-2 py-1 italic">
          К этой главе пока не привязаны сквозные сюжетные арки. Нажмите «＋ Арка», чтобы привязать линию.
        </div>
      </div>

      <!-- Standalone Text & Editorial Todos Section -->
      <div class="chapter-standalone-section mt-4 pt-2 border-t border-border">
        <div class="flex items-center justify-between px-1 mb-2">
          <span class="plan-section-label">📝 Задачи по тексту главы (Редактура)</span>
          <span class="text-xs text-muted">
            {{ chapter.standaloneTodos.filter(t => t.status === 'done' || t.done).length }}/{{ chapter.standaloneTodos.length }}
          </span>
        </div>

        <div class="flex flex-col gap-1.5">
          <PlanItemRow
            v-for="todo in chapter.standaloneTodos"
            :key="todo.id"
            :item="todo"
            :all-todos="allTodos"
            @toggle="$emit('toggle', $event)"
            @cycle-status="$emit('cycle-status', $event)"
            @set-status="(item, status) => $emit('set-status', item, status)"
            @save="$emit('save', $event)"
            @delete="$emit('delete', $event)"
            @navigate="$emit('navigate', $event)"
            @set-dependency="(item, pid) => $emit('set-dependency', item, pid)"
          />
        </div>

        <div class="mt-2">
          <div v-if="isAddingStandalone" class="flex items-center gap-1.5 w-full">
            <input
              ref="standaloneInputRef"
              v-model="newStandaloneText"
              class="plan-inline-add-input flex-1"
              placeholder="Новая задача по тексту главы..."
              @keydown.enter.prevent="submitStandalone"
              @keydown.esc="cancelStandalone"
            />
            <button type="button" class="btn-subtle text-xs px-2 py-1" @click="submitStandalone">ОК</button>
            <button type="button" class="btn-subtle text-xs px-2 py-1 text-muted" @click="cancelStandalone">✕</button>
          </div>
          <button v-else type="button" class="btn-add-standalone" @click="startAddingStandalone">
            <span>＋</span> Добавить задачу главы
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TapestryChapterCardProps, TapestryChapterCardEmits } from './TapestryChapterCard.model';
import { useTapestryChapterCard } from './useTapestryChapterCard';
import PlanArcGroup from './PlanArcGroup.vue';
import PlanItemRow from './PlanItemRow.vue';

const props = defineProps<TapestryChapterCardProps>();
const emit = defineEmits<TapestryChapterCardEmits>();

const {
  isArcPickerOpen,
  availableArcs,
  selectArcToAttach,
  isAddingStandalone,
  newStandaloneText,
  standaloneInputRef,
  startAddingStandalone,
  cancelStandalone,
  submitStandalone,
  onToggleCollapse
} = useTapestryChapterCard(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/PlanningPanel.css"></style>
