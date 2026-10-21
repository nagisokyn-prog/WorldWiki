<template>
  <div class="section-card calendar-correction-card">
    <!-- Заголовок карточки с аккордеоном -->
    <div class="correction-header" style="cursor: pointer;" @click="isCollapsed = !isCollapsed">
      <div class="correction-header-title">
        <h4 style="margin: 0; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
          <span>📅</span> Календарная коррекция и праздники
        </h4>
        <span
          v-if="extraDaysCount > 0"
          class="badge-count"
          style="background: rgba(56, 189, 248, 0.15); color: var(--accent-primary); font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600;"
        >
          +{{ extraDaysCount }} дн. праздников
        </span>
      </div>
      <div class="correction-header-meta">
        <span class="drift-badge" :class="driftIsOk ? 'drift-ok' : 'drift-warning'" title="Вековой дрейф календаря относительно орбиты планеты">
          {{ driftLabel }}
        </span>
        <span class="correction-collapse-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
      </div>
    </div>

    <!-- Тело секции -->
    <div v-show="!isCollapsed" class="correction-content">
      <!-- Баннер расхождения базового года и орбиты планеты -->
      <div v-if="showWarningBanner" class="drift-warning-banner" style="display: flex; flex-direction: column; gap: 6px;">
        <div>
          ⚠️ Базовый год ({{ totalNominalDays }} дн.: {{ monthsDaysSum }} в месяцах + {{ extraDaysCount }} праздничных)
          на {{ Math.abs(totalNominalDays - Math.round(orbitDays)) }} дн.
          {{ totalNominalDays > orbitDays ? 'длиннее' : 'короче' }}
          орбитального года планеты ({{ orbitDays.toFixed(2) }} сут.).
        </div>
        <div class="drift-warning-actions">
          <button type="button" class="drift-action-btn" :disabled="isReadOnly" @click="$emit('balance-months-extra')">
            🪄 Сбалансировать месяцы под праздники
          </button>
          <button type="button" class="drift-action-btn" :disabled="isReadOnly" @click="$emit('reset-extra-days')">
            Сбросить праздничные дни в 0
          </button>
        </div>
      </div>

      <!-- Быстрые пресеты и выбор правила -->
      <Tab1LeapPresets
        :active-system-preset="activeSystemPreset"
        :rule-type="ruleType"
        :orbit-days="orbitDays"
        :show-suggestions="showSuggestions"
        :suggestions="suggestions"
        :is-read-only="isReadOnly"
        @select-system-preset="$emit('select-system-preset', $event)"
        @select-rule-type="$emit('select-rule-type', $event)"
        @toggle-suggestions="showSuggestions = !showSuggestions"
        @apply-suggestion="$emit('apply-suggestion', $event)"
      />

      <!-- Дни вне месяцев и лента структуры года -->
      <Tab1ExtraDaysTape
        :extra-days-count="extraDaysCount"
        :extra-days-name="extraDaysName"
        :placement="placement"
        :after-month-index="afterMonthIndex"
        :pause-weekdays="pauseWeekdays"
        :months="months"
        :year-tape="yearTape"
        :is-read-only="isReadOnly"
        @update-extra-days="$emit('update-extra-days', $event)"
        @update-extra-name="$emit('update-extra-name', $event)"
        @update-placement="$emit('update-placement', $event)"
        @update-after-month="$emit('update-after-month', $event)"
        @update-pause-weekdays="$emit('update-pause-weekdays', $event)"
      />

      <!-- Високосная надбавка, конструктор гармоник и инспектор лет -->
      <Tab1LeapRulesInspector
        :rule-type="ruleType"
        :leap-offset="leapOffset"
        :target-mode="targetMode"
        :target-month-index="targetMonthIndex"
        :target-month-preview="targetMonthPreview"
        :months="months"
        :harmonics="harmonics"
        :custom-drift-label="driftLabel"
        :custom-drift-is-ok="driftIsOk"
        :base-year-days="totalNominalDays"
        :upcoming-years="upcomingYears"
        :is-read-only="isReadOnly"
        @update-leap-offset="$emit('update-leap-offset', $event)"
        @update-target-mode="$emit('update-target-mode', $event)"
        @update-target-month="$emit('update-target-month', $event)"
        @update-harmonic-period="(idx, period) => $emit('update-harmonic-period', idx, period)"
        @remove-harmonic="$emit('remove-harmonic', $event)"
        @add-harmonic="(w, p) => $emit('add-harmonic', w, p)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { CalendarMonth } from '@/services/Calendars/calendar.types';
import type {
  HarmonicRule,
  LeapRuleType,
  LeapSuggestionDto,
  SystemPresetType,
} from '../Tab1Structure.model';
import type { UpcomingYearDto, YearTapeItem } from '../tab1Leap.utils';
import Tab1LeapPresets from './Tab1LeapPresets.vue';
import Tab1ExtraDaysTape from './Tab1ExtraDaysTape.vue';
import Tab1LeapRulesInspector from './Tab1LeapRulesInspector.vue';

defineProps<{
  activeSystemPreset: SystemPresetType;
  ruleType: LeapRuleType;
  orbitDays: number;
  driftLabel: string;
  driftIsOk: boolean;
  showWarningBanner: boolean;
  totalNominalDays: number;
  monthsDaysSum: number;
  extraDaysCount: number;
  extraDaysName: string;
  placement: 'end_of_year' | 'mid_year' | 'start_of_year' | 'after_month';
  afterMonthIndex: number;
  pauseWeekdays: boolean;
  months: CalendarMonth[];
  yearTape: YearTapeItem[];
  leapOffset: number;
  targetMode: 'in_month' | 'in_extra_days';
  targetMonthIndex: number;
  targetMonthPreview: string;
  harmonics: HarmonicRule[];
  upcomingYears: UpcomingYearDto[];
  suggestions: LeapSuggestionDto[];
  isReadOnly?: boolean;
}>();

defineEmits<{
  (e: 'select-system-preset', preset: SystemPresetType): void;
  (e: 'select-rule-type', rule: LeapRuleType): void;
  (e: 'apply-suggestion', key: string): void;
  (e: 'balance-months-extra'): void;
  (e: 'reset-extra-days'): void;
  (e: 'update-extra-days', val: number): void;
  (e: 'update-extra-name', val: string): void;
  (e: 'update-placement', val: 'end_of_year' | 'mid_year' | 'start_of_year' | 'after_month'): void;
  (e: 'update-after-month', val: number): void;
  (e: 'update-pause-weekdays', val: boolean): void;
  (e: 'update-leap-offset', val: number): void;
  (e: 'update-target-mode', val: 'in_month' | 'in_extra_days'): void;
  (e: 'update-target-month', val: number): void;
  (e: 'update-harmonic-period', idx: number, period: number): void;
  (e: 'remove-harmonic', idx: number): void;
  (e: 'add-harmonic', weight: number, defaultPeriod: number): void;
}>();

const isCollapsed = ref(false);
const showSuggestions = ref(false);
</script>
