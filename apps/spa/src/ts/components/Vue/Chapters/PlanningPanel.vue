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

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { apiService } from '../../../services/api.service';

const props = defineProps({
  project: { type: String, required: true },
  parentType: { type: String, default: null }, // 'chapter' | 'arc' | 'volume'
  parentId:   { type: String, default: null },
  parentTitle:{ type: String, default: '' },
});

const items    = ref([]);
const listEl   = ref(null);
const saving   = ref(false);

// ─── Computed ────────────────────────────────────────────

const nodeIcon = computed(() => {
  if (props.parentType === 'volume') return '📚';
  if (props.parentType === 'arc')    return '🌀';
  return '📖';
});

const nodeName = computed(() => props.parentTitle || 'Без названия');

const doneCount  = computed(() => items.value.filter(i => i.done).length);
const progressPct = computed(() =>
  items.value.length ? Math.round((doneCount.value / items.value.length) * 100) : 0
);

// ─── Load ────────────────────────────────────────────────

const load = async () => {
  if (!props.project || !props.parentType || !props.parentId) {
    items.value = [];
    return;
  }
  try {
    items.value = await apiService.getPlanItems(props.project, props.parentType, props.parentId);
  } catch (e) {
    console.error('Ошибка загрузки плана:', e);
    items.value = [];
  }
};

watch(() => [props.project, props.parentType, props.parentId], load, { immediate: true });

// ─── Save ────────────────────────────────────────────────

const saveItem = async (item) => {
  if (!item.text.trim() && !item.id) return; // пропускаем совсем пустые несохранённые
  try {
    const id = await apiService.savePlanItem(props.project, {
      id: item.id,
      parentType: props.parentType,
      parentId: props.parentId,
      text: item.text,
      done: item.done,
      indent: item.indent,
      sortOrder: item.sortOrder ?? items.value.indexOf(item),
    });
    if (!item.id) item.id = id;
  } catch (e) {
    console.error('Ошибка сохранения пункта:', e);
  }
};

// ─── Toggle ──────────────────────────────────────────────

const toggleItem = async (item) => {
  // Optimistic update
  item.done = !item.done;
  try {
    if (item.id) {
      await apiService.togglePlanItem(props.project, item.id);
    } else {
      await saveItem(item);
    }
  } catch (e) {
    item.done = !item.done; // откат
    console.error('Ошибка переключения статуса:', e);
  }
};

// ─── Add ─────────────────────────────────────────────────

const addItem = async () => {
  const newItem = {
    id: '',
    text: '',
    done: false,
    indent: 0,
    sortOrder: items.value.length,
  };
  items.value.push(newItem);
  await nextTick();
  // Фокус на последний input
  const inputs = listEl.value?.querySelectorAll('.plan-text');
  if (inputs?.length) inputs[inputs.length - 1].focus();
};

const addItemAfter = async (idx, indent) => {
  const newItem = {
    id: '',
    text: '',
    done: false,
    indent: indent,
    sortOrder: idx + 1,
  };
  // Сохранить текущий сначала
  if (items.value[idx]) await saveItem(items.value[idx]);

  items.value.splice(idx + 1, 0, newItem);
  // Пересчитать sortOrder
  items.value.forEach((it, i) => { it.sortOrder = i; });

  await nextTick();
  const inputs = listEl.value?.querySelectorAll('.plan-text');
  if (inputs?.[idx + 1]) inputs[idx + 1].focus();
};

// ─── Indent ──────────────────────────────────────────────

const indentItem = async (item, delta) => {
  item.indent = Math.max(0, Math.min(4, (item.indent || 0) + delta));
  await saveItem(item);
};

// ─── Delete ──────────────────────────────────────────────

const deleteItem = async (item, idx) => {
  items.value.splice(idx, 1);
  if (item.id) {
    try { await apiService.deletePlanItem(props.project, item.id); } catch {}
  }
  // Пересчитать sortOrder
  items.value.forEach((it, i) => { it.sortOrder = i; });
};

const onDeleteKey = async (e, item, idx) => {
  if (item.text === '' && e.key === 'Backspace') {
    e.preventDefault();
    await deleteItem(item, idx);
    await nextTick();
    const inputs = listEl.value?.querySelectorAll('.plan-text');
    if (inputs?.[idx - 1]) inputs[idx - 1].focus();
  }
};

defineExpose({
  addItem
});
</script>

<style scoped>
.planning-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: transparent;
}

.plan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  flex-shrink: 0;
}

.plan-title {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.plan-icon { font-size: 16px; flex-shrink: 0; }

.plan-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main, #e5e7eb);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plan-stats {
  font-size: 11px;
  color: var(--accent, #8b5cf6);
  font-weight: 700;
  flex-shrink: 0;
  margin-left: 8px;
}

.plan-progress-bar {
  height: 2px;
  background: rgba(255,255,255,0.07);
  margin: 0 14px 10px;
  border-radius: 1px;
  overflow: hidden;
  flex-shrink: 0;
}

.plan-progress-fill {
  height: 100%;
  background: var(--accent, #8b5cf6);
  transition: width 0.4s ease;
}

.plan-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 6px;
}

.plan-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0;
  border-radius: 6px;
  padding-top: 3px;
  padding-bottom: 3px;
  padding-right: 6px;
  transition: background 0.15s;
}
.plan-item:hover { background: rgba(255,255,255,0.03); }
.plan-item:hover .plan-delete { opacity: 1; }

.plan-toggle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--accent, #8b5cf6);
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
  color: white;
  font-size: 12px;
  font-weight: 700;
  padding: 0;
}
.plan-toggle.done {
  background: var(--accent, #8b5cf6);
  border-color: var(--accent, #8b5cf6);
}
.plan-toggle:hover { transform: scale(1.1); }

.circle-empty {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  opacity: 0.4;
}

.plan-text {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-main, #e5e7eb);
  font-size: 13px;
  font-family: inherit;
  padding: 0;
  line-height: 1.5;
  min-width: 0;
}
.plan-text.done {
  text-decoration: line-through;
  color: var(--text-muted, #888);
}
.plan-text::placeholder { color: rgba(255,255,255,0.2); }

.plan-delete {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: rgba(239,68,68,0.15);
  color: #ef4444;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  padding: 0;
}
.plan-delete:hover { background: rgba(239,68,68,0.3); }

.plan-empty {
  padding: 24px 14px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted, #888);
}

.plan-footer {
  padding: 8px 14px 12px;
  flex-shrink: 0;
}

.plan-add-btn {
  width: 100%;
  background: rgba(139,92,246,0.1);
  border: 1px dashed rgba(139,92,246,0.3);
  color: var(--accent, #8b5cf6);
  border-radius: 8px;
  padding: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.plan-add-btn:hover {
  background: rgba(139,92,246,0.2);
  border-color: rgba(139,92,246,0.6);
}
</style>

