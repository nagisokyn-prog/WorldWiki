<template>
  <div class="calendar-section interactive-el">
    <h4>🏛️ Эпохи</h4>
    <div class="item-list">
      <div v-for="(era, eIdx) in modelValue.эпохи" :key="eIdx" style="margin-bottom: 10px">
        <div class="item-row">
          <input
            type="text"
            v-model="era.название"
            class="item-name interactive-el"
            placeholder="Название эпохи"
          />
          <input
            type="number"
            v-model.number="era.год_начала"
            class="item-duration interactive-el"
            placeholder="Начало"
          />
          <input
            type="number"
            v-model.number="era.год_конца"
            class="item-duration interactive-el"
            placeholder="Конец"
          />
          <div class="item-actions">
            <button
              class="btn-icon interactive-el"
              @click.prevent="moveItem(Number(eIdx), -1)"
              :disabled="Number(eIdx) === 0"
            >
              ↑
            </button>
            <button
              class="btn-icon interactive-el"
              @click.prevent="moveItem(Number(eIdx), 1)"
              :disabled="Number(eIdx) === (modelValue.эпохи?.length || 0) - 1"
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
            <input type="checkbox" v-model="era.обратный_отсчет" />
            Считать назад (До нашей эры)
          </label>
        </div>
      </div>
    </div>
    <button class="btn-add interactive-el" @click.prevent="addEra">➕ Добавить эпоху</button>
  </div>
</template>

<script setup lang="ts">
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
