<template>
  <div class="calendar-section interactive-el">
    <div class="section-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;" @click="isCollapsed = !isCollapsed">
      <h4 style="margin: 0;">📆 Месяцы</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div class="item-list">
        <div v-for="(month, mIdx) in modelValue.месяцы" :key="mIdx" class="item-row">
          <input v-model="month.название" type="text" class="item-name interactive-el" style="max-width: 120px;" />
          <input
            v-model.number="month.дней"
            type="number"
            min="1"
            max="100"
            class="item-duration interactive-el"
            style="max-width: 60px;"
          />
          <div class="item-actions">
            <button
              class="btn-icon interactive-el"
              :disabled="Number(mIdx) === 0"
              @click.prevent="moveItem(Number(mIdx), -1)"
            >
              ↑
            </button>
            <button
              class="btn-icon interactive-el"
              :disabled="Number(mIdx) === (modelValue.месяцы?.length || 0) - 1"
              @click.prevent="moveItem(Number(mIdx), 1)"
            >
              ↓
            </button>
            <button
              class="btn-icon interactive-el"
              @click.prevent="modelValue.месяцы.splice(Number(mIdx), 1)"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
      <button class="btn-add interactive-el" @click.prevent="addMonth">➕ Добавить месяц</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const isCollapsed = ref(false);

const props = defineProps({
  modelValue: { type: Object, required: true },
});

const moveItem = (idx: number, delta: number) => {
  const arr = props.modelValue.месяцы;
  const n = idx + delta;
  if (n >= 0 && n < arr.length) {
    [arr[idx], arr[n]] = [arr[n], arr[idx]];
  }
};

const addMonth = () => {
  if (!props.modelValue.месяцы) props.modelValue.месяцы = [];
  props.modelValue.месяцы.push({
    название: `Месяц ${props.modelValue.месяцы.length + 1}`,
    дней: 30,
  });
};
</script>
