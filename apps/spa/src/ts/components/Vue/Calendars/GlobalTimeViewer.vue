<template>
  <Transition name="fade">
  <div v-if="isVisible" class="global-time-viewer" v-motion-slide-top>
    <div class="header">
      <h3><i class="fas fa-globe"></i> Мировое Время</h3>
      <button @click="close" class="close-btn">×</button>
    </div>
    
    <div class="content">
      <div class="master-clock">
        <label>Абсолютная минута (Master Clock)</label>
        <div class="clock-input-group">
          <button @click="minute -= 1000">-</button>
          <input type="number" v-model.number="minute" />
          <button @click="minute += 1000">+</button>
        </div>
      </div>

      <div class="local-calendars" v-auto-animate>
        <h4>Конвертация в локальные календари:</h4>
        <div v-if="loading" class="loading">Загрузка календарей...</div>
        <div v-for="cal in localDates" :key="cal.id" class="calendar-card">
          <div class="cal-name">{{ cal.name }}</div>
          <div class="cal-date">
            {{ cal.date.year }} год, Месяц {{ cal.date.month }}, День {{ cal.date.day }}
          </div>
          <div class="cal-time">
            {{ String(cal.date.hour).padStart(2, '0') }}:{{ String(cal.date.minute).padStart(2, '0') }}
          </div>
        </div>
      </div>
    </div>
  </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { invoke } from '@worldwiki/components';
import { calendarService } from '../../../services/calendar.service';
import { useShellStore } from '../../../stores/shell';

const isVisible = ref(false);
const minute = ref(0);
const calendars = ref<any[]>([]);
const localDates = ref<any[]>([]);
const loading = ref(false);

const shellStore = useShellStore();

const open = () => { isVisible.value = true; };
const close = () => { isVisible.value = false; };

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown);
  if (shellStore.projectName) {
    await loadCalendars();
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

const handleKeydown = (e: KeyboardEvent) => {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyT') {
    e.preventDefault();
    isVisible.value = !isVisible.value;
  }
};

const loadCalendars = async () => {
  loading.value = true;
  calendars.value = await calendarService.getCalendars(shellStore.projectName!);
  loading.value = false;
  await updateLocalDates();
};

const updateLocalDates = async () => {
  if (calendars.value.length === 0) return;
  const results = [];
  for (const cal of calendars.value) {
    const data = cal.data || cal;
    const date = await invoke<any>('convert_absolute_to_local', {
      absoluteMinute: minute.value,
      calendar: data,
      eraIndex: 0
    });
    results.push({ id: cal.id, name: cal.name, date });
  }
  localDates.value = results;
};

watch(minute, () => {
  updateLocalDates();
});

watch(() => shellStore.projectName, async (newVal) => {
  if (newVal && isVisible.value) {
    await loadCalendars();
  }
});
</script>

<style scoped>
.global-time-viewer {
  position: fixed;
  top: 50px;
  right: 50px;
  width: 350px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  z-index: 10000;
  display: flex;
  flex-direction: column;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: var(--bg-alt);
  border-bottom: 1px solid var(--border);
  border-radius: 8px 8px 0 0;
}
.header h3 { margin: 0; font-size: 14px; }
.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
}
.content {
  padding: 15px;
  max-height: 500px;
  overflow-y: auto;
}
.clock-input-group {
  display: flex;
  margin-top: 5px;
}
.clock-input-group button {
  background: var(--accent);
  color: white;
  border: none;
  padding: 5px 10px;
  cursor: pointer;
}
.clock-input-group input {
  flex: 1;
  text-align: center;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
}
.local-calendars {
  margin-top: 20px;
}
.calendar-card {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 10px;
}
.cal-name { font-weight: bold; font-size: 13px; color: var(--accent); }
.cal-date { font-size: 12px; margin-top: 5px; }
.cal-time { font-size: 11px; color: var(--text-muted); }
</style>
