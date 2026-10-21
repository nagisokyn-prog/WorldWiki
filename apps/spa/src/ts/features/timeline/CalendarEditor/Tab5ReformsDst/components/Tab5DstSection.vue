<template>
  <div class="section-card">
    <div class="section-header">
      <div>
        <div class="section-title">☀️ Сезонный перевод часов (Daylight Saving Time / DST)</div>
        <div class="section-desc">
          Настройка правил летнего времени (перевод часов весной вперед и осенью назад). Система автоматически обрабатывает «провал во времени» и повторяющийся «час-дубликат» (Fold).
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
      <label class="form-label">Тип политики DST (DstPolicy):</label>
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
          <span><strong>Отключено (None)</strong></span>
        </label>
      </div>
    </div>

    <!-- Величина сезонного сдвига времени -->
    <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; margin-bottom: 12px;">
      <div class="grid-2" style="align-items: center;">
        <div class="form-group">
          <label class="form-label">⚙️ Величина сезонного сдвига времени (shift_minutes)</label>
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
    <div class="grid-2" style="margin-bottom: 14px;" :style="{ opacity: policyConfig.policy === 'none' ? '0.3' : '1.0', pointerEvents: policyConfig.policy === 'none' ? 'none' : 'auto' }">
      <!-- Весенний переход -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <strong style="color: var(--accent-success); font-size: 13px;">🌸 Весенний переход (+{{ policyConfig.shiftMinutes }} мин)</strong>
          <span class="status-chip success" style="font-size: 10px;">02:00 → 03:00</span>
        </div>
        <div class="form-group" style="margin-bottom: 8px;">
          <label class="form-label">Месяц перехода</label>
          <select class="form-select" :value="policyConfig.springRule.month" :disabled="isReadOnly" @change="$emit('update-spring-rule', { month: +($event.target as HTMLSelectElement).value })">
            <option v-for="(m, i) in monthNames" :key="i" :value="i + 1">{{ i + 1 }}. {{ m }}</option>
          </select>
        </div>
        <div v-if="policyConfig.policy === 'relative'" class="form-group" style="margin-bottom: 8px;">
          <label class="form-label">Правило дня недели</label>
          <div style="display: flex; gap: 6px;">
            <select class="form-select" :value="policyConfig.springRule.occurrence" style="flex: 1;" :disabled="isReadOnly" @change="$emit('update-spring-rule', { occurrence: ($event.target as HTMLSelectElement).value as WeekdayOccurrence })">
              <option value="first">Первое</option><option value="second">Второе</option><option value="third">Третье</option><option value="fourth">Четвертое</option><option value="last">Последнее</option>
            </select>
            <select class="form-select" :value="policyConfig.springRule.weekday" style="flex: 1;" :disabled="isReadOnly" @change="$emit('update-spring-rule', { weekday: +($event.target as HTMLSelectElement).value })">
              <option v-for="(w, i) in weekdayNames" :key="i" :value="i">{{ w }}</option>
            </select>
          </div>
        </div>
        <div v-else-if="policyConfig.policy === 'fixed'" class="form-group" style="margin-bottom: 8px;">
          <label class="form-label">Фиксированный день месяца</label>
          <input type="number" class="form-input" :value="policyConfig.springRule.fixedDay" min="1" max="31" :disabled="isReadOnly" @input="$emit('update-spring-rule', { fixedDay: +($event.target as HTMLInputElement).value })" />
        </div>
        <div class="form-group">
          <label class="form-label">Момент перевода (локальное время)</label>
          <input type="time" class="form-input" :value="policyConfig.springRule.time" style="width: 110px;" :disabled="isReadOnly" @input="$emit('update-spring-rule', { time: ($event.target as HTMLInputElement).value })" />
        </div>
      </div>

      <!-- Осенний переход -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <strong style="color: var(--accent-warning); font-size: 13px;">🍂 Осенний возврат (-{{ policyConfig.shiftMinutes }} мин)</strong>
          <span class="status-chip warning" style="font-size: 10px;">03:00 → 02:00</span>
        </div>
        <div class="form-group" style="margin-bottom: 8px;">
          <label class="form-label">Месяц возврата</label>
          <select class="form-select" :value="policyConfig.autumnRule.month" :disabled="isReadOnly" @change="$emit('update-autumn-rule', { month: +($event.target as HTMLSelectElement).value })">
            <option v-for="(m, i) in monthNames" :key="i" :value="i + 1">{{ i + 1 }}. {{ m }}</option>
          </select>
        </div>
        <div v-if="policyConfig.policy === 'relative'" class="form-group" style="margin-bottom: 8px;">
          <label class="form-label">Правило дня недели</label>
          <div style="display: flex; gap: 6px;">
            <select class="form-select" :value="policyConfig.autumnRule.occurrence" style="flex: 1;" :disabled="isReadOnly" @change="$emit('update-autumn-rule', { occurrence: ($event.target as HTMLSelectElement).value as WeekdayOccurrence })">
              <option value="first">Первое</option><option value="second">Второе</option><option value="third">Третье</option><option value="fourth">Четвертое</option><option value="last">Последнее</option>
            </select>
            <select class="form-select" :value="policyConfig.autumnRule.weekday" style="flex: 1;" :disabled="isReadOnly" @change="$emit('update-autumn-rule', { weekday: +($event.target as HTMLSelectElement).value })">
              <option v-for="(w, i) in weekdayNames" :key="i" :value="i">{{ w }}</option>
            </select>
          </div>
        </div>
        <div v-else-if="policyConfig.policy === 'fixed'" class="form-group" style="margin-bottom: 8px;">
          <label class="form-label">Фиксированный день месяца</label>
          <input type="number" class="form-input" :value="policyConfig.autumnRule.fixedDay" min="1" max="31" :disabled="isReadOnly" @input="$emit('update-autumn-rule', { fixedDay: +($event.target as HTMLInputElement).value })" />
        </div>
        <div class="form-group">
          <label class="form-label">Момент перевода (локальное время)</label>
          <input type="time" class="form-input" :value="policyConfig.autumnRule.time" style="width: 110px;" :disabled="isReadOnly" @input="$emit('update-autumn-rule', { time: ($event.target as HTMLInputElement).value })" />
        </div>
      </div>
    </div>

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
import type {
  DstPolicyConfig,
  DstPolicyType,
  DstPresetKey,
  DstTransitionRule,
  WeekdayOccurrence,
} from '../Tab5ReformsDst.model';
import Tab5DstSimulatorCard from './Tab5DstSimulatorCard.vue';

defineProps<{
  policyConfig: DstPolicyConfig;
  policyBadgeText: string;
  shiftBadgeText: string;
  shiftSelectVal: string;
  activePreset: DstPresetKey | null;
  presets: Array<{ key: DstPresetKey; label: string }>;
  monthNames: string[];
  weekdayNames: string[];
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
  isReadOnly?: boolean;
}>();

defineEmits<{
  (e: 'select-preset', key: DstPresetKey): void;
  (e: 'update-policy-type', policy: DstPolicyType): void;
  (e: 'update-shift-select', val: string): void;
  (e: 'update-shift-minutes', val: number): void;
  (e: 'update-spring-rule', patch: Partial<DstTransitionRule>): void;
  (e: 'update-autumn-rule', patch: Partial<DstTransitionRule>): void;
  (e: 'switch-sim-tab', tab: 'spring' | 'autumn'): void;
  (e: 'update-spring-slider', val: number): void;
  (e: 'update-autumn-slider', val: number): void;
  (e: 'update-autumn-fold', val: number): void;
}>();
</script>
