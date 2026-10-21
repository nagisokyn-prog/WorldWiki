<template>
  <div class="section-card" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);">
    <div class="section-header" style="margin-bottom: 10px;">
      <div>
        <div class="section-title" style="font-size: 13px;">
          🔬 Интерактивный симулятор суток перехода (Gap & Fold Inspector)
        </div>
        <div class="section-desc">
          Проверьте, как система автоматически защищает писателя от парадоксов несуществующего часа и двойного часа.
        </div>
      </div>
      <div style="display: flex; gap: 6px;">
        <button
          type="button"
          class="btn-ghost-sm"
          :style="{ fontWeight: simTab === 'spring' ? '600' : 'normal', borderColor: simTab === 'spring' ? 'var(--accent-primary)' : 'var(--border-subtle)' }"
          @click="$emit('switch-sim-tab', 'spring')"
        >
          🌸 Весенний прыжок (Gap)
        </button>
        <button
          type="button"
          class="btn-ghost-sm"
          :style="{ fontWeight: simTab === 'autumn' ? '600' : 'normal', borderColor: simTab === 'autumn' ? 'var(--accent-purple)' : 'var(--border-subtle)' }"
          @click="$emit('switch-sim-tab', 'autumn')"
        >
          🍂 Осенний откат (Fold)
        </button>
      </div>
    </div>

    <!-- Панель симуляции: Весна -->
    <div v-if="simTab === 'spring'">
      <div style="margin-bottom: 10px;">
        <label class="form-label" style="display: flex; justify-content: space-between;">
          <span>Локальное время в ночь весеннего перехода (передвиньте ползунок):</span>
          <strong style="color: var(--accent-primary); font-family: var(--font-mono); font-size: 14px;">{{ springTimeStr }}</strong>
        </label>
        <input
          type="range"
          min="60"
          max="240"
          step="5"
          :value="springSliderVal"
          style="width: 100%; accent-color: var(--accent-primary);"
          @input="$emit('update-spring-slider', +($event.target as HTMLInputElement).value)"
        />
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-dim); margin-top: 2px;">
          <span>01:00 (Зима)</span>
          <span style="color: var(--accent-warning);">01:59:59 ⏩ Прыжок</span>
          <span style="color: var(--accent-danger);">02:00..02:59 (Провал)</span>
          <span style="color: var(--accent-success);">03:00 (Лето)</span>
          <span>04:00</span>
        </div>
      </div>

      <div :style="springAlertStyle" style="padding: 10px 14px; border-radius: var(--radius-sm); border-width: 1px; border-style: solid;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">⚠️</span>
          <div>
            <strong :style="{ color: springAlertTextColor, fontSize: '13px' }">{{ springAlertTitle }}</strong>
            <div style="font-size: 12px; color: var(--text-main); margin-top: 2px;">{{ springAlertDesc }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Панель симуляции: Осень -->
    <div v-else>
      <div style="margin-bottom: 10px;">
        <label class="form-label" style="display: flex; justify-content: space-between;">
          <span>Локальное время в ночь осеннего отката (передвиньте ползунок):</span>
          <strong style="color: var(--accent-purple); font-family: var(--font-mono); font-size: 14px;">{{ autumnTimeStr }}</strong>
        </label>
        <input
          type="range"
          min="60"
          max="240"
          step="5"
          :value="autumnSliderVal"
          style="width: 100%; accent-color: var(--accent-purple);"
          @input="$emit('update-autumn-slider', +($event.target as HTMLInputElement).value)"
        />
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-dim); margin-top: 2px;">
          <span>01:00 (Лето)</span>
          <span style="color: var(--accent-purple);">02:00 (1-й раз)</span>
          <span style="color: var(--accent-warning);">02:59:59 ⏪ Откат</span>
          <span style="color: var(--accent-purple);">02:00 (2-й раз)</span>
          <span>04:00 (Зима)</span>
        </div>
      </div>

      <div :style="autumnAlertStyle" style="padding: 10px 14px; border-radius: var(--radius-sm); border-width: 1px; border-style: solid;">
        <div style="display: flex; align-items: flex-start; gap: 10px;">
          <span style="font-size: 18px;">🔀</span>
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong style="color: var(--accent-purple); font-size: 13px;">НЕОДНОЗНАЧНОЕ ВРЕМЯ (AMBIGUITY / FOLD)</strong>
              <div style="display: flex; gap: 8px;">
                <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                  <input type="radio" :checked="autumnFold === 0" @change="$emit('update-autumn-fold', 0)" />
                  <span>Fold 0 (1-й час, Летнее UTC+1)</span>
                </label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                  <input type="radio" :checked="autumnFold === 1" @change="$emit('update-autumn-fold', 1)" />
                  <span>Fold 1 (2-й час, Зимнее UTC+0)</span>
                </label>
              </div>
            </div>
            <div style="font-size: 12px; color: var(--text-main); margin-top: 4px;">{{ autumnAlertDesc }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  simTab: 'spring' | 'autumn';
  springSliderVal: number;
  autumnSliderVal: number;
  autumnFold: number;
  springTimeStr: string;
  autumnTimeStr: string;
  springAlertTitle: string;
  springAlertDesc: string;
  springAlertStyle: Record<string, string>;
  springAlertTextColor: string;
  autumnAlertDesc: string;
  autumnAlertStyle: Record<string, string>;
}>();

defineEmits<{
  (e: 'switch-sim-tab', tab: 'spring' | 'autumn'): void;
  (e: 'update-spring-slider', val: number): void;
  (e: 'update-autumn-slider', val: number): void;
  (e: 'update-autumn-fold', val: number): void;
}>();
</script>
