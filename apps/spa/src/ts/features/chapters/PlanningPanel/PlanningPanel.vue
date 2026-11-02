<template>
  <div class="planning-panel">
    <!-- Заголовок -->
    <div class="plan-header">
      <div class="plan-title">
        <span class="plan-icon">{{ nodeIcon }}</span>
        <span class="plan-name">{{ nodeName }}</span>
      </div>
      <div v-if="items.length" class="plan-stats flex items-center gap-2">
        <span v-if="inProgressCount > 0" class="badge-subtle text-[11px]" title="Задач в работе">
          🟡 {{ inProgressCount }}
        </span>
        <span class="plan-done">{{ doneCount }}</span>/<span class="plan-total">{{ items.length }}</span>
      </div>
    </div>

    <!-- Прогресс бар -->
    <div v-if="items.length" class="plan-progress-bar">
      <div class="plan-progress-fill" :style="{ '--plan-progress': progressPct + '%' }"></div>
    </div>

    <!-- Список пунктов -->
    <div ref="listEl" class="plan-list">
      <div
        v-for="(item, idx) in items"
        :key="item.id"
        class="plan-item flex-col items-stretch"
        :class="{
          'is-blocked': item.status === 'blocked',
          'in-progress': item.status === 'in_progress'
        }"
        :style="{ '--indent-pl': (12 + item.indent * 20) + 'px' }"
      >
        <div class="flex items-center gap-1.5 w-full">
          <!-- Индикатор статуса -->
          <button
            class="plan-toggle"
            :class="[`status-${item.status}`, { done: item.status === 'done' || item.done }]"
            :title="getStatusTitle(item)"
            @click="toggleItem(item)"
            @contextmenu.prevent="cycleStatus(item)"
          >
            <span v-if="item.status === 'done' || item.done">✓</span>
            <span v-else-if="item.status === 'in_progress'" class="circle-pulse" title="В работе 🟡"></span>
            <span v-else-if="item.status === 'blocked'" title="Ожидает 🔒">🔒</span>
            <span v-else class="circle-empty" title="В планах ⚪"></span>
          </button>

          <!-- Текст пункта -->
          <input
            v-model="item.text"
            class="plan-text flex-1"
            :class="{ done: item.status === 'done' || item.done }"
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

        <!-- Мета-строка (Сюжетная арка и Зависимость) -->
        <div v-if="item.arc_id || item.depends_on" class="plan-meta-row">
          <span
            v-if="item.arc_id"
            class="plan-arc-pill"
            :title="'Сюжетная арка: ' + (item.arc_title || getArcTitle(item.arc_id))"
            @click.stop="$emit('select-arc', item.arc_id)"
          >
            <span>⚡</span>
            <span>{{ item.arc_title || getArcTitle(item.arc_id) }}</span>
          </span>
          <span
            v-if="item.depends_on"
            class="plan-dependency-pill"
            :title="'Ожидает выполнения предшествующей задачи'"
          >
            <span>🔗</span>
            <span>Ожидает</span>
          </span>
        </div>
      </div>

      <!-- Пусто -->
      <div v-if="!items.length" class="plan-empty">
        <span>Нет пунктов плана.</span>
        <span class="plan-empty-sub">Нажмите "+" чтобы добавить</span>
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
import type { PlanningPanelProps, PlanningPanelEmits, PlanItem, TodoStatus } from './PlanningPanel.model';
import { usePlanningPanel } from './usePlanningPanel';

const props = withDefaults(defineProps<PlanningPanelProps>(), {
  project: undefined,
  parentType: undefined,
  parentId: undefined,
  parentTitle: '',
  arcsList: () => [],
  selectedArcFilter: null
});

defineEmits<PlanningPanelEmits>();

const {
  items,
  listEl,
  nodeIcon,
  nodeName,
  doneCount,
  inProgressCount,
  progressPct,
  saveItem,
  toggleItem,
  setItemStatus,
  addItem,
  addItemAfter,
  indentItem,
  deleteItem,
  onDeleteKey
} = usePlanningPanel(props);

const getStatusTitle = (item: PlanItem): string => {
  if (item.status === 'done') return 'Готово 🟢 (кликните, чтобы вернуть в планы)';
  if (item.status === 'in_progress') return 'В работе 🟡 (кликните, чтобы завершить)';
  if (item.status === 'blocked') return 'Ожидает 🔒 (заблокировано предшествующей задачей)';
  return 'В планах ⚪ (кликните, чтобы отметить готовым)';
};

const getArcTitle = (arcId?: string | null): string => {
  if (!arcId) return 'Арка';
  const found = props.arcsList?.find(a => a.id === arcId || a.id.endsWith(arcId) || arcId.endsWith(a.id));
  return found?.title || 'Арка';
};

const cycleStatus = async (item: PlanItem): Promise<void> => {
  const transitions: Record<TodoStatus, TodoStatus> = {
    planned: 'in_progress',
    in_progress: 'done',
    done: 'planned',
    blocked: 'planned'
  };
  await setItemStatus(item, transitions[item.status] || 'planned');
};

defineExpose({
  addItem
});
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/PlanningPanel.css"></style>
