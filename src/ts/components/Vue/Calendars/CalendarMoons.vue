<template>
  <div class="calendar-section interactive-el">
    <h4>🌙 Луны и фазы</h4>
    <div class="item-list">
      <div v-for="(moon, mIdx) in calendar.moons" :key="mIdx" class="item-row moon-row" style="flex-direction: column; align-items: stretch; gap: 8px;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="text" v-model="moon.name" class="item-name interactive-el" placeholder="Название луны">
          <label class="glass-label" style="font-size: 11px;">Период (дней):</label>
          <input type="number" v-model.number="moon.period_days" min="1" step="0.1" class="item-duration interactive-el" style="width: 80px;">
          
          <label class="glass-label" style="font-size: 11px;">Старт. фаза (0-1):</label>
          <input type="number" v-model.number="moon.initial_phase" min="0" max="1" step="0.05" class="item-duration interactive-el" style="width: 70px;" title="0 = Новолуние, 0.5 = Полнолуние">
          
          <div class="item-actions">
            <button class="btn-icon interactive-el" @click.prevent="moveItem(calendar.moons, Number(mIdx), -1)" :disabled="Number(mIdx)===0">↑</button>
            <button class="btn-icon interactive-el" @click.prevent="moveItem(calendar.moons, Number(mIdx), 1)" :disabled="Number(mIdx)===(calendar.moons?.length || 0)-1">↓</button>
            <button class="btn-icon interactive-el" @click.prevent="calendar.moons.splice(Number(mIdx), 1)">🗑️</button>
          </div>
        </div>
        
        <div style="display: flex; gap: 8px; font-size: 12px; margin-left: 8px;" v-if="moon.phase_names">
          <input type="text" v-model="moon.phase_names.new" class="interactive-el" style="width: 100px; padding: 2px 4px;" placeholder="Новолуние">
          <input type="text" v-model="moon.phase_names.waxing" class="interactive-el" style="width: 100px; padding: 2px 4px;" placeholder="Растущая">
          <input type="text" v-model="moon.phase_names.full" class="interactive-el" style="width: 100px; padding: 2px 4px;" placeholder="Полнолуние">
          <input type="text" v-model="moon.phase_names.waning" class="interactive-el" style="width: 100px; padding: 2px 4px;" placeholder="Убывающая">
        </div>
      </div>
    </div>
    <button class="btn-add interactive-el" @click.prevent="addMoon">➕ Добавить луну</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update:modelValue']);

const calendar = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const addMoon = () => {
  if (!calendar.value.moons) calendar.value.moons = [];
  calendar.value.moons.push({
    name: `Луна ${calendar.value.moons.length + 1}`,
    period_days: 28,
    initial_phase: 0,
    phase_names: {
      new: 'Новолуние',
      waxing: 'Растущая',
      full: 'Полнолуние',
      waning: 'Убывающая'
    }
  });
};

const moveItem = (arr: any[], idx: number, dir: number) => {
  if (!arr) return;
  if (idx + dir < 0 || idx + dir >= arr.length) return;
  const temp = arr[idx];
  arr[idx] = arr[idx + dir];
  arr[idx + dir] = temp;
};
</script>

<style scoped>
.calendar-section {
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
.calendar-section h4 {
  margin-top: 0;
  margin-bottom: 12px;
  color: var(--text-color);
  font-size: 14px;
}
.item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.item-row {
  display: flex;
  gap: 8px;
  align-items: center;
  background: rgba(0, 0, 0, 0.2);
  padding: 6px 10px;
  border-radius: 6px;
}
.moon-row {
  padding: 10px;
}
.item-name {
  flex: 1;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-color);
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}
.item-name:hover, .item-name:focus {
  border-color: var(--accent);
  background: rgba(0, 0, 0, 0.3);
}
.item-duration {
  width: 60px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 4px 8px;
  border-radius: 4px;
  text-align: center;
}
.btn-icon {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.btn-icon:hover:not(:disabled) {
  color: var(--text-color);
  background: rgba(255, 255, 255, 0.1);
}
.btn-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.btn-add {
  width: 100%;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px dashed var(--border-color);
  color: var(--text-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-add:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--accent);
}
.glass-label {
  color: var(--text-muted);
}
</style>
