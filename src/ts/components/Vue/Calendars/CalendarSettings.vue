<template>
  <div class="calendar-section interactive-el">
    <div class="section-header" @click="isCollapsed = !isCollapsed" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;">
      <h4 style="margin: 0;">⚙️ Физика времени и планеты</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div class="grid-2">
        <div class="calendar-field">
          <label class="glass-label">Часов в сутках</label>
          <input type="number" v-model.number="settings.часов_в_сутках" min="1" class="interactive-el">
        </div>
        <div class="calendar-field">
          <label class="glass-label">Минут в часе</label>
          <input type="number" v-model.number="settings.минут_в_часе" min="1" class="interactive-el">
        </div>
      </div>
      
      <div style="margin-top: 16px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 16px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-color);">
          <input type="checkbox" v-model="settings.учитывать_сезонную_длительность_дня" class="interactive-el">
          Учитывать световой день и солнцестояния
        </label>
        
        <div v-if="settings.учитывать_сезонную_длительность_дня" style="margin-top: 12px; display: flex; flex-direction: column; gap: 12px;">
          <div class="calendar-field">
            <label class="glass-label">Широта (0 = экватор, 90 = полюс)</label>
            <input type="number" v-model.number="settings.широта" min="-90" max="90" class="interactive-el">
            <small class="glass-label">Влияет только на лор, реальный расчет идет по часам ниже.</small>
          </div>
          
          <div class="grid-2" v-if="dayLengthAnchor">
            <div class="calendar-field">
              <label class="glass-label" style="color: #f39c12;">Летнее солнцестояние (часы света)</label>
              <input type="number" v-model.number="dayLengthAnchor.summer_solstice_hours" min="1" max="100" step="0.1" class="interactive-el">
            </div>
            <div class="calendar-field">
              <label class="glass-label" style="color: #3498db;">Зимнее солнцестояние (часы света)</label>
              <input type="number" v-model.number="dayLengthAnchor.winter_solstice_hours" min="0" max="100" step="0.1" class="interactive-el">
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
