<template>
  <div class="calendar-section">
    <div class="section-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;" @click="isCollapsed = !isCollapsed">
      <h4 style="margin: 0;">🏛️ Эпохи</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div class="item-list" v-auto-animate>
        <div v-for="(era, eIdx) in modelValue.эпохи" :key="eIdx" style="margin-bottom: 10px" class="item-row">
          <div class="item-row">
            <input
              v-model="era.название"
              type="text"
              class="item-name interactive-el"
              placeholder="Название эпохи"
            />
            <input
              v-model.number="era.год_начала"
              type="number"
              class="item-duration interactive-el"
              placeholder="Начало"
            />
            <input
              v-model.number="era.год_конца"
              type="number"
              class="item-duration interactive-el"
              placeholder="Конец"
            />
            <div class="item-actions">
              <button
                class="btn-icon interactive-el"
                :disabled="Number(eIdx) === 0"
                @click.prevent="moveItem(Number(eIdx), -1)"
              >
                ↑
              </button>
              <button
                class="btn-icon interactive-el"
                :disabled="Number(eIdx) === (modelValue.эпохи?.length || 0) - 1"
                @click.prevent="moveItem(Number(eIdx), 1)"
              >
                ↓
              </button>
              <button
                class="btn-icon interactive-el"
                @click.prevent="modelValue.эпохи.splice(Number(eIdx), 1)"
              >
                🗑️
              </button>
            </div>
          </div>
          <div style="display: flex; align-items: center; margin-top: 5px">
            <label
              style="
                font-size: 11px;
                color: var(--text-muted);
                display: flex;
                align-items: center;
                gap: 5px;
                cursor: pointer;
              "
            >
              <input v-model="era.обратный_отсчет" type="checkbox" />
              Считать назад (До нашей эры)
            </label>
          </div>
        </div>
      </div>
      <button class="btn-add interactive-el" @click.prevent="addEra">➕ Добавить эпоху</button>
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
  const arr = props.modelValue.эпохи;
  const n = idx + delta;
  if (n >= 0 && n < arr.length) {
    [arr[idx], arr[n]] = [arr[n], arr[idx]];
  }
};

const addEra = () => {
  if (!props.modelValue.эпохи) props.modelValue.эпохи = [];
  const last = props.modelValue.эпохи[props.modelValue.эпохи.length - 1]?.год_конца || 0;
  props.modelValue.эпохи.push({
    название: `Эпоха ${props.modelValue.эпохи.length + 1}`,
    год_начала: last + 1,
    год_конца: last + 1000,
    обратный_отсчет: false,
  });
};
</script>
