<template>
  <div class="calendar-section">
    <div class="section-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;" @click="isCollapsed = !isCollapsed">
      <h4 style="margin: 0;">⚙️ Физика времени и планеты</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div class="grid-2">
        <div class="calendar-field">
          <label class="glass-label">Часов в сутках</label>
          <input v-model.number="settings.часов_в_сутках" type="number" min="1" class="interactive-el">
        </div>
        <div class="calendar-field">
          <label class="glass-label">Минут в часе</label>
          <input v-model.number="settings.минут_в_часе" type="number" min="1" class="interactive-el">
        </div>
      </div>
      
      <div v-if="isMaster" style="margin-top: 16px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 16px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-color);">
          <input v-model="settings.учитывать_сезонную_длительность_дня" type="checkbox" class="interactive-el">
          <span>Учитывать световой день и солнцестояния <span title="Позволяет движку (CalendarMath) высчитывать точное время рассвета и заката для каждого дня в году, выстраивая синусоиду между летним и зимним солнцестоянием. Полезно для реалистичной смены дня и ночи." style="cursor: help; color: #3498db; font-weight: bold; font-size: 0.9em; margin-left: 4px;">[?]</span></span>
        </label>
        
        <div v-if="settings.учитывать_сезонную_длительность_дня" style="margin-top: 12px; display: flex; flex-direction: column; gap: 12px;">
          <div class="calendar-field">
            <label class="glass-label">
              Широта (0 = экватор, 90 = полюс)
              <span title="Точка обзора (где находятся герои). Служит подсказкой для ИИ о климате региона: 0 - тропики (нет зимы), 45 - средняя полоса (4 сезона), 90 - полюс (полярная ночь)." style="cursor: help; color: #3498db; font-weight: bold; font-size: 0.9em; margin-left: 4px;">[?]</span>
            </label>
            <input v-model.number="settings.широта" type="number" min="-90" max="90" class="interactive-el" style="max-width: 33.3%;">
            <small class="glass-label">Влияет на лор. Реальный расчет физики идет по часам ниже.</small>
          </div>
          
          <div v-if="dayLengthAnchor" class="grid-2">
            <div class="calendar-field">
              <label class="glass-label" style="color: #f39c12;">
                Летнее солнцестояние (часы света)
                <span title="Самый длинный световой день в году. Движок будет плавно увеличивать световой день до этого значения к середине лета." style="cursor: help; font-weight: bold; font-size: 0.9em; margin-left: 4px;">[?]</span>
              </label>
              <input v-model.number="dayLengthAnchor.summer_solstice_hours" type="number" min="1" max="100" step="0.1" class="interactive-el">
            </div>
            <div class="calendar-field">
              <label class="glass-label" style="color: #3498db;">
                Зимнее солнцестояние (часы света)
                <span title="Самый короткий световой день в году. Движок будет плавно уменьшать световой день до этого значения к середине зимы." style="cursor: help; font-weight: bold; font-size: 0.9em; margin-left: 4px;">[?]</span>
              </label>
              <input v-model.number="dayLengthAnchor.winter_solstice_hours" type="number" min="0" max="100" step="0.1" class="interactive-el">
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue';

const isCollapsed = ref(false);

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  },
  isMaster: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const calendar = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

// Initialize defaults if they don't exist
if (!calendar.value.настройки_времени) {
  calendar.value.настройки_времени = {
    часов_в_сутках: 24,
    минут_в_часе: 60,
    секунд_в_минуте: 60,
    широта: 45,
    учитывать_сезонную_длительность_дня: false
  };
}

const settings = computed(() => calendar.value.настройки_времени);

watch(() => settings.value.учитывать_сезонную_длительность_дня, (val) => {
  if (val && !calendar.value.day_length_anchor) {
    calendar.value.day_length_anchor = {
      summer_solstice_hours: 16.0,
      winter_solstice_hours: 8.0
    };
  }
});

const dayLengthAnchor = computed(() => calendar.value.day_length_anchor);
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
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.calendar-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.calendar-field label {
  font-size: 12px;
}
.calendar-field input[type="number"], .calendar-field input[type="text"] {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 6px 10px;
  border-radius: 6px;
  width: 100%;
}
.calendar-field small {
  font-size: 10px;
}
.glass-label {
  color: var(--text-muted);
}
</style>
