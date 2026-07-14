<template>
  <div class="calendar-section interactive-el">
    <div class="section-header" @click="isCollapsed = !isCollapsed" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;">
      <h4 style="margin: 0;">📅 Високосный год</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div class="grid-2">
        <div class="calendar-field">
          <label>Правило</label>
          <XboxWheel
            :horizontal="wheelHorizontal"
            :options="[
              { value: 'григорианское', label: 'Григорианское' },
              { value: 'пользовательское', label: 'Пользовательское' },
              { value: 'отсутствует', label: 'Отсутствует' },
            ]"
            v-model="modelValue.правило_високосного_года"
          >
          </XboxWheel>
        </div>
        <div class="calendar-field" v-if="modelValue.правило_високосного_года === 'пользовательское'">
          <label>Месяц +N дней</label>
          <XboxWheel
            :horizontal="wheelHorizontal"
            :options="
              (modelValue.месяцы || []).map((m: any, idx: number) => ({
                value: idx,
                label: m.название,
              }))
            "
            v-model.number="customRuleMonth"
          >
          </XboxWheel>
          <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px">
            <label style="margin: 0">Смещение (дней):</label>
            <input
              type="number"
              v-model.number="customRuleDays"
              class="interactive-el"
              style="width: 60px"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import XboxWheel from "../../../../../tauri-surreal-kit/frontend/src/components/Vue/XboxWheel.vue";

const isCollapsed = ref(false);
import { settingsService } from "../../../../../tauri-surreal-kit/frontend/src/js/services/settings.service";

const props = defineProps({
  modelValue: { type: Object, required: true },
});

const wheelHorizontal = ref(
  settingsService.getSettings()?.dropdowns?.wheelOrientation === "horizontal",
);

onMounted(() => {
  settingsService.onChange(
    (s) => (wheelHorizontal.value = s.dropdowns?.wheelOrientation === "horizontal"),
  );
  if (!props.modelValue.пользовательское_високосное_правило) {
    props.modelValue.пользовательское_високосное_правило = { месяц: 0, день_смещения: 1 };
  }
});

const customRuleMonth = computed({
  get: () => props.modelValue.пользовательское_високосное_правило?.месяц || 0,
  set: (val) => {
    if (!props.modelValue.пользовательское_високосное_правило) {
      props.modelValue.пользовательское_високосное_правило = { месяц: val, день_смещения: 1 };
    } else {
      props.modelValue.пользовательское_високосное_правило.месяц = val;
    }
  },
});

const customRuleDays = computed({
  get: () => props.modelValue.пользовательское_високосное_правило?.день_смещения || 1,
  set: (val) => {
    if (!props.modelValue.пользовательское_високосное_правило) {
      props.modelValue.пользовательское_високосное_правило = { месяц: 0, день_смещения: val };
    } else {
      props.modelValue.пользовательское_високосное_правило.день_смещения = val;
    }
  },
});
</script>
