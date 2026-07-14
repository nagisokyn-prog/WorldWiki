<template>
  <div class="calendar-section interactive-el">
    <div class="section-header" @click="isCollapsed = !isCollapsed" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;">
      <h4 style="margin: 0;">📅 Дни недели</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div class="item-list">
        <div v-for="(day, dIdx) in modelValue.названия_дней_недели" :key="dIdx" class="item-row">
          <input
            type="text"
            v-model="modelValue.названия_дней_недели[dIdx]"
            class="item-name interactive-el"
          />
          <div class="item-actions">
            <button
              class="btn-icon interactive-el"
              @click.prevent="moveItem(Number(dIdx), -1)"
              :disabled="Number(dIdx) === 0"
            >
              ↑
            </button>
            <button
              class="btn-icon interactive-el"
              @click.prevent="moveItem(Number(dIdx), 1)"
              :disabled="Number(dIdx) === (modelValue.названия_дней_недели?.length || 0) - 1"
            >
              ↓
            </button>
            <button
              class="btn-icon interactive-el"
              @click.prevent="modelValue.названия_дней_недели.splice(Number(dIdx), 1)"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
      <button class="btn-add interactive-el" @click.prevent="addDay">➕ Добавить день</button>
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
  const arr = props.modelValue.названия_дней_недели;
  const n = idx + delta;
  if (n >= 0 && n < arr.length) {
    [arr[idx], arr[n]] = [arr[n], arr[idx]];
  }
};

const addDay = () => {
  if (!props.modelValue.названия_дней_недели) props.modelValue.названия_дней_недели = [];
  props.modelValue.названия_дней_недели.push(
    `День ${props.modelValue.названия_дней_недели.length + 1}`,
  );
};
</script>
