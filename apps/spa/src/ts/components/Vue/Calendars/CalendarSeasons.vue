<template>
  <div class="calendar-section interactive-el">
    <div class="section-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;" @click="isCollapsed = !isCollapsed">
      <h4 style="margin: 0;">🌤️ Сезоны</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div class="item-list">
        <div
          v-for="(season, sIdx) in modelValue.сезоны"
          :key="sIdx"
          class="item-row"
          style="flex-direction: column; align-items: stretch"
        >
          <div style="display: flex; gap: 10px; margin-bottom: 10px">
            <input
              v-model="season.название"
              type="text"
              class="item-name interactive-el"
              placeholder="Название сезона"
              style="flex: 1"
            />
            <div class="item-actions">
              <button
                class="btn-icon interactive-el"
                :disabled="Number(sIdx) === 0"
                @click.prevent="moveItem(Number(sIdx), -1)"
              >
                ↑
              </button>
              <button
                class="btn-icon interactive-el"
                :disabled="Number(sIdx) === (modelValue.сезоны?.length || 0) - 1"
                @click.prevent="moveItem(Number(sIdx), 1)"
              >
                ↓
              </button>
              <button
                class="btn-icon interactive-el"
                @click.prevent="modelValue.сезоны.splice(Number(sIdx), 1)"
              >
                🗑️
              </button>
            </div>
          </div>
          <div>
            <div
              style="
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                gap: 5px;
              "
            >
              <label
                v-for="(m, mIdx) in modelValue.месяцы || []"
                :key="mIdx"
                class="interactive-el"
                style="
                  display: flex;
                  align-items: center;
                  gap: 5px;
                  font-size: 11px;
                  padding: 4px;
                  border-radius: 4px;
                  cursor: pointer;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                "
                :style="
                  season.месяцы && season.месяцы.includes(mIdx)
                    ? {
                        background: 'var(--accent)',
                        borderColor: 'var(--accent)',
                        color: 'white',
                      }
                    : {}
                "
              >
                <input
                  v-model="season.месяцы"
                  type="checkbox"
                  :value="mIdx"
                  style="display: none"
                />
                {{ m.название }}
              </label>
            </div>
            <div
              v-if="!season.месяцы || season.месяцы.length === 0"
              style="color: #e74c3c; font-size: 11px; margin-top: 5px"
            >
              ⚠️ Выберите месяцы для сезона
            </div>
          </div>
        </div>
      </div>
      <button class="btn-add interactive-el" @click.prevent="addSeason">➕ Добавить сезон</button>
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
  const arr = props.modelValue.сезоны;
  const n = idx + delta;
  if (n >= 0 && n < arr.length) {
    [arr[idx], arr[n]] = [arr[n], arr[idx]];
  }
};

const addSeason = () => {
  if (!props.modelValue.сезоны) props.modelValue.сезоны = [];
  const used = new Set<number>();
  props.modelValue.сезоны.forEach((s: any) => s.месяцы?.forEach((m: number) => used.add(m)));
  const available = (props.modelValue.месяцы || [])
    .map((_: any, i: number) => i)
    .filter((i: number) => !used.has(i));

  props.modelValue.сезоны.push({
    название: `Сезон ${props.modelValue.сезоны.length + 1}`,
    месяцы: available.slice(0, 3),
  });
};

const isMonthInSeason = (sIdx: number, mIdx: number) => {
  return props.modelValue.сезоны?.[sIdx]?.месяцы?.includes(mIdx) || false;
};

const toggleMonthInSeason = (sIdx: number, mIdx: number) => {
  const season = props.modelValue.сезоны?.[sIdx];
  if (!season) return;
  if (!season.месяцы) season.месяцы = [];

  const pos = season.месяцы.indexOf(mIdx);
  if (pos > -1) {
    season.месяцы.splice(pos, 1);
  } else {
    props.modelValue.сезоны.forEach((s: any, i: number) => {
      if (i !== sIdx && s.месяцы) {
        const p = s.месяцы.indexOf(mIdx);
        if (p > -1) s.месяцы.splice(p, 1);
      }
    });
    season.месяцы.push(mIdx);
    season.месяцы.sort((a: number, b: number) => a - b);
  }
};
</script>
