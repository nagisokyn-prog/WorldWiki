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
</template>

<script setup lang="ts">
import type { DstPolicyConfig, DstTransitionRule, WeekdayOccurrence } from '../Tab5ReformsDst.model';

defineProps<{
  policyConfig: DstPolicyConfig;
  monthNames: string[];
  weekdayNames: string[];
  isReadOnly?: boolean;
}>();

defineEmits<{
  (e: 'update-spring-rule', patch: Partial<DstTransitionRule>): void;
  (e: 'update-autumn-rule', patch: Partial<DstTransitionRule>): void;
}>();
</script>
