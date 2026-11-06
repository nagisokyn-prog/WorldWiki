<template>
  <div
    class="plan-arc-group"
    :style="arcGroup.color ? { borderLeftColor: arcGroup.color } : {}"
  >
    <!-- Header of Arc Group -->
    <div class="arc-group-header flex items-center justify-between">
      <div class="flex items-center gap-1.5 overflow-hidden">
        <span class="arc-group-icon">⚡</span>
        <span class="arc-group-title" :title="arcGroup.title">{{ arcGroup.title }}</span>
        <span v-if="arcGroup.phaseLabel" class="arc-phase-badge">
          {{ arcGroup.phaseLabel }}
        </span>
      </div>
      <span class="arc-group-stats text-xs text-muted">
        {{ doneCount }}/{{ arcGroup.todos.length }}
      </span>
    </div>

    <!-- Todos in this arc -->
    <div class="arc-group-todos flex flex-col gap-1.5 mt-2">
      <PlanItemRow
        v-for="todo in arcGroup.todos"
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

    <!-- Add task into this arc -->
    <div class="arc-group-footer mt-2">
      <div v-if="isAdding" class="flex items-center gap-1.5 w-full">
        <input
          ref="addInputRef"
          v-model="newTodoText"
          class="plan-inline-add-input flex-1"
          placeholder="Новая задача для этой арки..."
          @keydown.enter.prevent="submitAdd"
          @keydown.esc="cancelAdd"
        />
        <button type="button" class="btn-subtle text-xs px-2 py-1" @click="submitAdd">ОК</button>
        <button type="button" class="btn-subtle text-xs px-2 py-1 text-muted" @click="cancelAdd">✕</button>
      </div>
      <button
        v-else
        type="button"
        class="btn-add-todo-in-arc"
        @click="startAdding"
      >
        <span>＋</span> Добавить задачу в арку
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlanArcGroupProps, PlanArcGroupEmits } from './PlanArcGroup.model';
import { usePlanArcGroup } from './usePlanArcGroup';
import PlanItemRow from '../PlanItemRow/PlanItemRow.vue';

const props = defineProps<PlanArcGroupProps>();
const emit = defineEmits<PlanArcGroupEmits>();

const {
  doneCount,
  isAdding,
  newTodoText,
  addInputRef,
  startAdding,
  cancelAdd,
  submitAdd
} = usePlanArcGroup(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/PlanningPanel.css"></style>
