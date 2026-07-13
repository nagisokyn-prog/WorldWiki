<template>
  <div class="calendar-section interactive-el">
    <h4>📆 Месяцы</h4>
    <div class="item-list">
      <div v-for="(month, mIdx) in modelValue.месяцы" :key="mIdx" class="item-row">
        <input type="text" v-model="month.название" class="item-name interactive-el" />
        <input
          type="number"
          v-model.number="month.дней"
          min="1"
          max="100"
          class="item-duration interactive-el"
        />
        <div class="item-actions">
          <button
            class="btn-icon interactive-el"
            @click.prevent="moveItem(Number(mIdx), -1)"
            :disabled="Number(mIdx) === 0"
          >
            ↑
          </button>
          <button
            class="btn-icon interactive-el"
            @click.prevent="moveItem(Number(mIdx), 1)"
            :disabled="Number(mIdx) === (modelValue.месяцы?.length || 0) - 1"
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
</template>

<script setup lang="ts">
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
