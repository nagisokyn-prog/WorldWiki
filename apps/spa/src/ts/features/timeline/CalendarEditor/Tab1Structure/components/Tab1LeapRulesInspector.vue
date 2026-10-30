<template>
  <div>
    <!-- БЛОК 2: Високосная надбавка и куда начислять -->
    <div v-if="ruleType !== 'none'" class="correction-subcard" style="margin-top: 12px;">
      <div class="correction-subcard-title">
        <span>⚡ Високосная надбавка и куда начислять</span>
      </div>

      <div class="grid-2 gap-3">
        <div class="form-group">
          <label class="form-label">Сколько дней добавлять в високос (+N)</label>
          <input
            type="number"
            class="form-input"
            :value="leapOffset"
            min="1"
            :disabled="isReadOnly"
            @input="$emit('update-leap-offset', parseInt(($event.target as HTMLInputElement).value) || 1)"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Куда начислять високосные дни</label>
          <div style="display: flex; gap: 12px; padding-top: 6px;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;">
              <input
                type="radio"
                name="target-mode"
                value="in_month"
                :checked="targetMode === 'in_month'"
                :disabled="isReadOnly"
                @change="$emit('update-target-mode', 'in_month')"
              />
              <span>В конкретный месяц</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;">
              <input
                type="radio"
                name="target-mode"
                value="in_extra_days"
                :checked="targetMode === 'in_extra_days'"
                :disabled="isReadOnly"
                @change="$emit('update-target-mode', 'in_extra_days')"
              />
              <span>В праздники вне месяцев</span>
            </label>
          </div>
        </div>
      </div>

      <div v-if="targetMode === 'in_month'" class="form-group" style="margin-top: 6px;">
        <label class="form-label">Целевой високосный месяц</label>
        <div style="display: flex; gap: 10px; align-items: center;">
          <select
            class="form-select"
            style="max-width: 200px;"
            :value="targetMonthIndex"
            :disabled="isReadOnly"
            @change="$emit('update-target-month', parseInt(($event.target as HTMLSelectElement).value) || 0)"
          >
            <option v-for="(m, idx) in months" :key="idx" :value="idx">
              {{ idx + 1 }}. {{ m.название || `Месяц ${idx + 1}` }}
            </option>
          </select>
          <span class="status-chip warning" style="font-size: 11px;">
            {{ targetMonthPreview }}
          </span>
        </div>
      </div>
    </div>

    <!-- БЛОК 3: Пользовательский конструктор условий (гармоник) -->
    <div v-if="ruleType === 'custom'" class="correction-subcard" style="margin-top: 12px;">
      <div class="correction-subcard-title">
        <span>⚙️ Правила добавления и исключения високосных дней</span>
        <span class="drift-badge" :class="customDriftIsOk ? 'drift-ok' : 'drift-warning'">
          {{ customDriftLabel }}
        </span>
      </div>

      <div class="harmonics-list">
        <div v-for="(h, idx) in harmonics" :key="idx" class="harmonic-item">
          <span class="harmonic-sign" :class="h.weight >= 0 ? 'positive' : 'negative'">
            {{ h.weight >= 0 ? '+' : '-' }}
          </span>
          <span style="font-size: 12px;">Каждые</span>
          <input
            type="number"
            class="harmonic-period-input"
            :value="h.period"
            min="1"
            :disabled="isReadOnly"
            @input="$emit('update-harmonic-period', idx, parseInt(($event.target as HTMLInputElement).value) || 1)"
          />
          <span style="font-size: 12px;">лет добавлять {{ Math.abs(h.weight) }} дн.</span>
          <button
            type="button"
            class="harmonic-delete-btn"
            :disabled="isReadOnly"
            title="Удалить правило"
            @click="$emit('remove-harmonic', idx)"
          >
            🗑️
          </button>
        </div>
      </div>

      <div class="add-harmonic-row">
        <button
          type="button"
          class="add-harmonic-btn"
          :disabled="isReadOnly"
          @click="$emit('add-harmonic', 1, 4)"
        >
          ➕ Добавить: Добавлять каждые N лет
        </button>
        <button
          type="button"
          class="add-harmonic-btn"
          :disabled="isReadOnly"
          @click="$emit('add-harmonic', -1, 100)"
        >
          ➖ Добавить: Исключать каждые N лет
        </button>
      </div>
    </div>

    <!-- БЛОК 4: Инспектор ближайших лет -->
    <div class="correction-subcard" style="margin-top: 12px;">
      <div class="correction-subcard-title">
        <span>🔍 Проверка високосных годов в хронологии:</span>
        <span style="font-size: 11px; color: var(--text-muted);">
          Базовый год: {{ baseYearDays }} сут.
        </span>
      </div>
      <div class="upcoming-years-row">
        <div
          v-for="y in upcomingYears"
          :key="y.year"
          class="upcoming-year-pill"
          :class="{ 'is-leap': y.isLeap }"
        >
          <strong>{{ y.year }}</strong>: {{ y.days }} дн.
          <span v-if="y.isLeap" style="font-size: 10px; margin-left: 2px;">(+{{ leapOffset }})</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tab1LeapRulesInspectorProps, Tab1LeapRulesInspectorEmits } from './Tab1LeapRulesInspector.model';

defineProps<Tab1LeapRulesInspectorProps>();

defineEmits<Tab1LeapRulesInspectorEmits>();
</script>
