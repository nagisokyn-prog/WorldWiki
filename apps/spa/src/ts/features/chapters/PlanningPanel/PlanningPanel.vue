<template>
  <div class="planning-panel">
    <!-- Заголовок -->
    <div class="plan-header">
      <div class="plan-title">
        <span class="plan-icon">{{ nodeIcon }}</span>
        <span class="plan-name">{{ nodeName }}</span>
      </div>
      <div v-if="items.length" class="plan-stats">
        <span class="plan-done">{{ doneCount }}</span>/<span class="plan-total">{{ items.length }}</span>
      </div>
    </div>

    <!-- Прогресс бар -->
    <div v-if="items.length" class="plan-progress-bar">
      <div class="plan-progress-fill" :style="{ width: progressPct + '%' }"></div>
    </div>

    <!-- Список пунктов -->
    <div ref="listEl" class="plan-list">
      <div
        v-for="(item, idx) in items"
        :key="item.id"
        class="plan-item"
        :style="{ paddingLeft: (12 + item.indent * 20) + 'px' }"
      >
        <!-- Кружок статуса -->
        <button
          class="plan-toggle"
          :class="{ done: item.done }"
          :title="item.done ? 'Отметить как невыполненное' : 'Отметить как выполненное'"
          @click="toggleItem(item)"
        >
          <span v-if="item.done">✓</span>
          <span v-else class="circle-empty"></span>
        </button>

        <!-- Текст пункта -->
        <input
          v-model="item.text"
          class="plan-text"
          :class="{ done: item.done }"
          placeholder="Пункт плана..."
          @blur="saveItem(item)"
          @keydown.enter.exact.prevent="addItemAfter(idx, item.indent)"
          @keydown.tab.exact.prevent="indentItem(item, 1)"
          @keydown.shift.tab.prevent="indentItem(item, -1)"
          @keydown.delete="onDeleteKey($event, item, idx)"
        />

        <!-- Кнопка удаления -->
        <button class="plan-delete" title="Удалить" @click="deleteItem(item, idx)">×</button>
      </div>

      <!-- Пусто -->
      <div v-if="!items.length" class="plan-empty">
        <span>Нет пунктов плана.</span>
        <span style="display:block; margin-top:4px; font-size:11px;">Нажмите "+" чтобы добавить</span>
      </div>
    </div>

    <!-- Кнопка добавить -->
    <div class="plan-footer">
      <button class="plan-add-btn" @click="addItem">
        <span>＋</span> Добавить пункт
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePlanningPanel } from './usePlanningPanel';

const props = withDefaults(defineProps<{
  project: string;
  parentType?: string | null;
  parentId?: string | null;
  parentTitle?: string;
}>(), {
  parentType: null,
  parentId: null,
  parentTitle: ''
});

const {
  items,
  listEl,
  nodeIcon,
  nodeName,
  doneCount,
  progressPct,
  saveItem,
  toggleItem,
  addItem,
  addItemAfter,
  indentItem,
  deleteItem,
  onDeleteKey
} = usePlanningPanel(props);

defineExpose({
  addItem
});
</script>

<style scoped src="./PlanningPanel.vue.css"></style>