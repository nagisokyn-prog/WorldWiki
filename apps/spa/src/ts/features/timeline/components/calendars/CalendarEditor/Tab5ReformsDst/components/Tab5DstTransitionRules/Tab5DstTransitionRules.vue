<template>
  <div
    class="grid-2"
    style="margin-bottom: 14px;"
    :style="{
      opacity: policyConfig.policy === 'none' ? '0.3' : '1.0',
      pointerEvents: policyConfig.policy === 'none' ? 'none' : 'auto',
    }"
  >
    <!-- Весенний переход -->
    <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
        <strong style="color: var(--accent-success); font-size: 13px;">🌸 Весенний переход (+{{ policyConfig.shiftMinutes }} мин)</strong>
        <span class="status-chip success" style="font-size: 10px;">02:00 → 03:00</span>
      </div>
      <div class="form-group" style="margin-bottom: 8px;">
        <label class="form-label">Месяц перехода</label>
        <XboxWheel
          :model-value="String(policyConfig.springRule.month)"
          :options="monthOptions"
          @update:model-value="$emit('update-spring-rule', { month: parseInt($event) || 1 })"
        />
      </div>
      <div v-if="policyConfig.policy === 'relative'" class="form-group" style="margin-bottom: 8px;">
        <label class="form-label">Правило дня недели</label>
        <div style="display: flex; gap: 6px;">
          <XboxWheel
            :model-value="policyConfig.springRule.occurrence"
            :options="occurrenceOptions"
            style="flex: 1;"
            @update:model-value="$emit('update-spring-rule', { occurrence: $event as WeekdayOccurrence })"
          />
          <XboxWheel
            :model-value="String(policyConfig.springRule.weekday)"
            :options="weekdayOptions"
            style="flex: 1;"
            @update:model-value="$emit('update-spring-rule', { weekday: parseInt($event) || 0 })"
          />
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
        <XboxWheel
          :model-value="String(policyConfig.autumnRule.month)"
          :options="monthOptions"
          @update:model-value="$emit('update-autumn-rule', { month: parseInt($event) || 1 })"
        />
      </div>
      <div v-if="policyConfig.policy === 'relative'" class="form-group" style="margin-bottom: 8px;">
        <label class="form-label">Правило дня недели</label>
        <div style="display: flex; gap: 6px;">
          <XboxWheel
            :model-value="policyConfig.autumnRule.occurrence"
            :options="occurrenceOptions"
            style="flex: 1;"
            @update:model-value="$emit('update-autumn-rule', { occurrence: $event as WeekdayOccurrence })"
          />
          <XboxWheel
            :model-value="String(policyConfig.autumnRule.weekday)"
            :options="weekdayOptions"
            style="flex: 1;"
            @update:model-value="$emit('update-autumn-rule', { weekday: parseInt($event) || 0 })"
          />
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
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { Tab5DstTransitionRulesProps, Tab5DstTransitionRulesEmits } from './Tab5DstTransitionRules.model';
import type { WeekdayOccurrence } from '../../Tab5ReformsDst.model';
import { useTab5DstTransitionRules } from './useTab5DstTransitionRules';

const props = defineProps<Tab5DstTransitionRulesProps>();

defineEmits<Tab5DstTransitionRulesEmits>();

const { monthOptions, occurrenceOptions, weekdayOptions } = useTab5DstTransitionRules(props);
</script>
