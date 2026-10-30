<template>
  <div class="section-card">
    <div class="section-header">
      <div>
        <div class="section-title">☀️ Сезонный перевод часов (Летнее и зимнее время)</div>
        <div class="section-desc">
          Настройка правил летнего времени (перевод часов весной вперед и осенью назад). Система автоматически обрабатывает «провал во времени» и повторяющийся час при переводе назад.
        </div>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <span class="status-chip success">{{ policyBadgeText }}</span>
        <span class="status-chip warning">{{ shiftBadgeText }}</span>
      </div>
    </div>

    <!-- Быстрые пресеты DST -->
    <div class="form-group" style="margin-bottom: 14px;">
      <label class="form-label">Готовые пресеты летнего времени:</label>
      <div class="chip-list">
        <button
          v-for="p in presets"
          :key="p.key"
          type="button"
          class="preset-chip"
          :class="{ active: activePreset === p.key }"
          :disabled="isReadOnly"
          @click="$emit('select-preset', p.key)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <!-- Выбор типа политики DST -->
    <div class="form-group" style="margin-bottom: 14px;">
      <label class="form-label">Правило выбора дня перевода:</label>
      <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px;">
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
          <input type="radio" :checked="policyConfig.policy === 'relative'" :disabled="isReadOnly" @change="$emit('update-policy-type', 'relative')" />
          <span><strong>Относительный день недели</strong> (напр. последнее воскресенье)</span>
        </label>
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
          <input type="radio" :checked="policyConfig.policy === 'fixed'" :disabled="isReadOnly" @change="$emit('update-policy-type', 'fixed')" />
          <span><strong>Фиксированная календарная дата</strong> (напр. 25 марта и 25 октября)</span>
        </label>
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
          <input type="radio" :checked="policyConfig.policy === 'none'" :disabled="isReadOnly" @change="$emit('update-policy-type', 'none')" />
          <span><strong>Отключено (без перевода)</strong></span>
        </label>
      </div>
    </div>

    <!-- Величина сезонного сдвига времени -->
    <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; margin-bottom: 12px;">
      <div class="grid-2" style="align-items: center;">
        <div class="form-group">
          <label class="form-label">⚙️ Величина сезонного сдвига времени</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <select class="form-select" :value="shiftSelectVal" style="flex: 1;" :disabled="isReadOnly || policyConfig.policy === 'none'" @change="$emit('update-shift-select', ($event.target as HTMLSelectElement).value)">
              <option value="60">+60 минут (+1 час — стандарт Земли)</option>
              <option value="120">+120 минут (+2 часа — двойное летнее время / жатва)</option>
              <option value="30">+30 минут (+0.5 часа — дробный шаг, Иран/Индия)</option>
              <option value="custom">⚙️ Своё точное значение минут...</option>
            </select>
            <input
              v-if="shiftSelectVal === 'custom'"
              type="number"
              class="form-input"
              style="width: 85px;"
              :value="policyConfig.shiftMinutes"
              min="1"
              max="1440"
              :disabled="isReadOnly"
              @input="$emit('update-shift-minutes', +($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
        <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
          💡 <em>Любой параметр можно настроить вручную:</em> пресеты подставляют базовые значения. Вы можете выбрать любые месяцы, дни, время перевода и величину сдвига.
        </div>
      </div>
    </div>

    <!-- Контейнер правил перехода -->
    <Tab5DstTransitionRules
      :policy-config="policyConfig"
      :month-names="monthNames"
      :weekday-names="weekdayNames"
      :is-read-only="isReadOnly"
      @update-spring-rule="$emit('update-spring-rule', $event)"
      @update-autumn-rule="$emit('update-autumn-rule', $event)"
    />

    <!-- Интерактивный симулятор суток перехода -->
    <Tab5DstSimulatorCard
      :sim-tab="simTab"
      :spring-slider-val="springSliderVal"
      :autumn-slider-val="autumnSliderVal"
      :autumn-fold="autumnFold"
      :spring-time-str="springTimeStr"
      :autumn-time-str="autumnTimeStr"
      :spring-alert-title="springAlertTitle"
      :spring-alert-desc="springAlertDesc"
      :spring-alert-style="springAlertStyle"
      :spring-alert-text-color="springAlertTextColor"
      :autumn-alert-desc="autumnAlertDesc"
      :autumn-alert-style="autumnAlertStyle"
      @switch-sim-tab="$emit('switch-sim-tab', $event)"
      @update-spring-slider="$emit('update-spring-slider', $event)"
      @update-autumn-slider="$emit('update-autumn-slider', $event)"
      @update-autumn-fold="$emit('update-autumn-fold', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { Tab5DstSectionProps, Tab5DstSectionEmits } from './Tab5DstSection.model';
import type {
  DstPolicyConfig,
  DstPolicyType,
  DstPresetKey,
  DstTransitionRule,
} from '../Tab5ReformsDst.model';
import Tab5DstSimulatorCard from './Tab5DstSimulatorCard.vue';
import Tab5DstTransitionRules from './Tab5DstTransitionRules.vue';

defineProps<Tab5DstSectionProps>>();

defineEmits<Tab5DstSectionEmits>>();
</script>
