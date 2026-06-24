<template>
  <div class="tool-section timeline-section">
    <h4><i class="fas fa-calendar-alt"></i> Календари проекта</h4>
    
    <div class="timeline-events-list">
      <div v-if="calendars.length === 0" style="color: var(--text-muted); font-size: 12px; padding: 10px;">
        Нет календарей в проекте. Создайте первый календарь!
      </div>
      
      <div v-for="(cal, idx) in calendars" :key="cal.id || idx" class="timeline-event-item">
        <div class="event-header" @click="toggleExpand(idx)" style="cursor: pointer;">
          <div class="header-left">
            <span class="expand-icon">{{ isExpanded(idx) ? '▼' : '▶' }}</span>
            <span class="event-title">{{ cal.data?.название || 'Новый календарь' }}</span>
            <span v-if="cal.is_default" class="badge-default" style="margin-left: 8px; font-size: 10px; background: var(--accent); color: white; padding: 2px 6px; border-radius: 4px;">По умолчанию</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" @click.stop="setDefault(idx)" class="btn-icon interactive-el" title="Сделать основным" :style="{ opacity: cal.is_default ? 1 : 0.5 }">🌟</button>
            <button type="button" @click.stop="saveCalendar(idx)" class="btn-icon interactive-el" title="Сохранить">💾</button>
            <button type="button" @click.stop="removeCalendar(idx)" class="delete-btn">🗑️</button>
          </div>
        </div>
        
        <div v-show="isExpanded(idx)" class="event-content">
          <div class="calendar-settings-section">
            <div class="grid-2">
              <div class="calendar-field">
                <label>Название календаря</label>
                <input type="text" v-model="cal.data.название" class="interactive-el">
              </div>
              <div class="calendar-field">
                <label>Дней в неделе</label>
                <input type="number" v-model.number="cal.data.дней_в_неделе" min="1" max="20" class="interactive-el">
              </div>
            </div>
            <div class="calendar-field">
              <label>Первый месяц года</label>
              <XboxWheel :horizontal="wheelHorizontal"
                :options="(cal.data.месяцы || []).map((m: any, mIdx: number) => ({ value: mIdx, label: m.название }))"
                v-model.number="cal.data.первый_месяц_года">
              </XboxWheel>
              <small>Год начинается с этого месяца</small>
            </div>
          </div>

          <div class="calendar-section interactive-el">
            <h4>📅 Дни недели</h4>
            <div class="item-list">
              <div v-for="(day, dIdx) in cal.data.названия_дней_недели" :key="dIdx" class="item-row">
                <input type="text" v-model="cal.data.названия_дней_недели[dIdx]" class="item-name interactive-el">
                <div class="item-actions">
                  <button class="btn-icon interactive-el" @click.prevent="moveItem(cal.data.названия_дней_недели, Number(dIdx), -1)" :disabled="Number(dIdx)===0">↑</button>
                  <button class="btn-icon interactive-el" @click.prevent="moveItem(cal.data.названия_дней_недели, Number(dIdx), 1)" :disabled="Number(dIdx)===(cal.data.названия_дней_недели?.length || 0)-1">↓</button>
                  <button class="btn-icon interactive-el" @click.prevent="cal.data.названия_дней_недели.splice(Number(dIdx), 1)">🗑️</button>
                </div>
              </div>
            </div>
            <button class="btn-add interactive-el" @click.prevent="cal.data.названия_дней_недели.push(`День ${(cal.data.названия_дней_недели?.length || 0) + 1}`)">➕ Добавить день</button>
          </div>

          <div class="calendar-section interactive-el">
            <h4>📆 Месяцы</h4>
            <div class="item-list">
              <div v-for="(month, mIdx) in cal.data.месяцы" :key="mIdx" class="item-row">
                <input type="text" v-model="month.название" class="item-name interactive-el">
                <input type="number" v-model.number="month.дней" min="1" max="100" class="item-duration interactive-el">
                <div class="item-actions">
                  <button class="btn-icon interactive-el" @click.prevent="moveItem(cal.data.месяцы, Number(mIdx), -1)" :disabled="Number(mIdx)===0">↑</button>
                  <button class="btn-icon interactive-el" @click.prevent="moveItem(cal.data.месяцы, Number(mIdx), 1)" :disabled="Number(mIdx)===(cal.data.месяцы?.length || 0)-1">↓</button>
                  <button class="btn-icon interactive-el" @click.prevent="cal.data.месяцы.splice(Number(mIdx), 1)">🗑️</button>
                </div>
              </div>
            </div>
            <button class="btn-add interactive-el" @click.prevent="cal.data.месяцы.push({ название: `Месяц ${(cal.data.месяцы?.length || 0) + 1}`, дней: 30 })">➕ Добавить месяц</button>
          </div>

          <div class="calendar-section interactive-el">
            <h4>🏛️ Эпохи</h4>
            <div class="item-list">
              <div v-for="(era, eIdx) in cal.data.эпохи" :key="eIdx" class="item-row">
                <input type="text" v-model="era.название" class="item-name interactive-el" placeholder="Название эпохи">
                <input type="number" v-model.number="era.год_начала" class="item-duration interactive-el" placeholder="Начало">
                <input type="number" v-model.number="era.год_конца" class="item-duration interactive-el" placeholder="Конец">
                <div class="item-actions">
                  <button class="btn-icon interactive-el" @click.prevent="moveItem(cal.data.эпохи, Number(eIdx), -1)" :disabled="Number(eIdx)===0">↑</button>
                  <button class="btn-icon interactive-el" @click.prevent="moveItem(cal.data.эпохи, Number(eIdx), 1)" :disabled="Number(eIdx)===(cal.data.эпохи?.length || 0)-1">↓</button>
                  <button class="btn-icon interactive-el" @click.prevent="cal.data.эпохи.splice(Number(eIdx), 1)">🗑️</button>
                </div>
              </div>
            </div>
            <button class="btn-add interactive-el" @click.prevent="addEra(cal.data)">➕ Добавить эпоху</button>
          </div>

          <div class="calendar-section interactive-el">
            <h4>🌤️ Сезоны</h4>
            <div class="item-list">
              <div v-for="(season, sIdx) in cal.data.сезоны" :key="sIdx" class="item-row" style="flex-direction: column; align-items: stretch;">
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                  <input type="text" v-model="season.название" placeholder="Название" style="flex: 2;" class="interactive-el">
                  <input type="text" v-model="season.время_восхода" placeholder="Восход" style="flex: 1;" class="interactive-el">
                  <input type="text" v-model="season.время_заката" placeholder="Закат" style="flex: 1;" class="interactive-el">
                  <div class="item-actions" style="margin-left: auto;">
                    <button class="btn-icon interactive-el" @click.prevent="moveItem(cal.data.сезоны, Number(sIdx), -1)" :disabled="Number(sIdx)===0">↑</button>
                    <button class="btn-icon interactive-el" @click.prevent="moveItem(cal.data.сезоны, Number(sIdx), 1)" :disabled="Number(sIdx)===(cal.data.сезоны?.length || 0)-1">↓</button>
                    <button class="btn-icon interactive-el" @click.prevent="cal.data.сезоны.splice(Number(sIdx), 1)">🗑️</button>
                  </div>
                </div>
                <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px;">
                  <label style="display: block; margin-bottom: 8px; font-size: 12px; color: var(--text-muted);">Месяцы сезона:</label>
                  <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    <label v-for="(m, mIdx) in cal.data.месяцы" :key="mIdx"
                           :style="{
                               padding: '4px 8px',
                               borderRadius: '4px',
                               cursor: 'pointer',
                               fontSize: '12px',
                               border: '1px solid ' + (isMonthInSeason(cal.data, sIdx, mIdx) ? 'var(--accent)' : 'var(--border-color)'),
                               background: isMonthInSeason(cal.data, sIdx, mIdx) ? 'var(--accent)' : 'transparent',
                               color: isMonthInSeason(cal.data, sIdx, mIdx) ? 'white' : 'var(--text-muted)'
                           }">
                      <input type="checkbox"
                             :checked="isMonthInSeason(cal.data, sIdx, mIdx)"
                             @change="toggleMonthInSeason(cal.data, sIdx, mIdx)"
                             style="display: none;">
                      {{ m.название }}
                    </label>
                  </div>
                  <div v-if="!season.месяцы || season.месяцы.length === 0" style="color: #e74c3c; font-size: 11px; margin-top: 5px;">
                    ⚠️ Выберите месяцы для сезона
                  </div>
                </div>
              </div>
            </div>
            <button class="btn-add interactive-el" @click.prevent="addSeason(cal.data)">➕ Добавить сезон</button>
          </div>

          <div class="calendar-section interactive-el">
            <h4>🌙 Фазы луны</h4>
            <div class="item-list">
              <div v-for="(phase, pIdx) in cal.data.фазы_луны" :key="pIdx" class="item-row">
                <input type="text" v-model="phase.название" class="item-name interactive-el">
                <input type="number" v-model.number="phase.луна_номер" class="item-duration interactive-el" placeholder="№" style="width: 50px;">
                <input type="number" v-model.number="phase.период_в_днях" class="item-duration interactive-el" placeholder="Дней" style="width: 60px;">
                <div class="item-actions">
                  <button class="btn-icon interactive-el" @click.prevent="moveItem(cal.data.фазы_луны, Number(pIdx), -1)" :disabled="Number(pIdx)===0">↑</button>
                  <button class="btn-icon interactive-el" @click.prevent="moveItem(cal.data.фазы_луны, Number(pIdx), 1)" :disabled="Number(pIdx)===(cal.data.фазы_луны?.length || 0)-1">↓</button>
                  <button class="btn-icon interactive-el" @click.prevent="cal.data.фазы_луны.splice(Number(pIdx), 1)">🗑️</button>
                </div>
              </div>
            </div>
            <button class="btn-add interactive-el" @click.prevent="addMoonPhase(cal.data)">➕ Добавить фазу</button>
          </div>

          <div class="calendar-section interactive-el">
            <h4>🎉 Праздники</h4>
            <div class="item-list">
              <div v-for="(holiday, hIdx) in cal.data.праздники" :key="hIdx" class="item-row">
                <input type="text" v-model="holiday.название" class="item-name interactive-el">
                <div class="item-duration" style="display: flex; gap: 5px; align-items: center;">
                  <XboxWheel :horizontal="wheelHorizontal"
                    :options="(cal.data.месяцы || []).map((m: any, mi: number) => ({ value: mi, label: m.название }))"
                    v-model.number="holiday.дата_начала.месяц" style="width: 120px;">
                  </XboxWheel>
                  <input type="number" v-model.number="holiday.дата_начала.день" min="1" :max="getDaysInMonth(cal.data, (cal.data.точка_отсчета?.год || 0), holiday.дата_начала.месяц)" style="width: 50px;" class="interactive-el">
                  <span>—</span>
                  <XboxWheel :horizontal="wheelHorizontal"
                    :options="(cal.data.месяцы || []).map((m: any, mi: number) => ({ value: mi, label: m.название }))"
                    v-model.number="holiday.дата_конца.месяц" style="width: 120px;">
                  </XboxWheel>
                  <input type="number" v-model.number="holiday.дата_конца.день" min="1" :max="getDaysInMonth(cal.data, (cal.data.точка_отсчета?.год || 0), holiday.дата_конца.месяц)" style="width: 50px;" class="interactive-el">
                </div>
                <div class="item-actions">
                  <button class="btn-icon interactive-el" @click.prevent="moveItem(cal.data.праздники, Number(hIdx), -1)" :disabled="Number(hIdx)===0">↑</button>
                  <button class="btn-icon interactive-el" @click.prevent="moveItem(cal.data.праздники, Number(hIdx), 1)" :disabled="Number(hIdx)===(cal.data.праздники?.length || 0)-1">↓</button>
                  <button class="btn-icon interactive-el" @click.prevent="cal.data.праздники.splice(Number(hIdx), 1)">🗑️</button>
                </div>
              </div>
            </div>
            <button class="btn-add interactive-el" @click.prevent="addHoliday(cal.data)">➕ Добавить праздник</button>
          </div>

          <div class="calendar-section interactive-el">
            <h4>🎯 Точка отсчёта</h4>
            <div class="grid-3" v-if="cal.data.точка_отсчета">
              <div class="calendar-field">
                <label>Год</label>
                <input type="number" v-model.number="cal.data.точка_отсчета.год" class="interactive-el">
              </div>
              <div class="calendar-field">
                <label>Месяц</label>
                <XboxWheel :horizontal="wheelHorizontal"
                  :options="(cal.data.месяцы || []).map((m: any, idx: number) => ({ value: idx, label: m.название }))"
                  v-model.number="cal.data.точка_отсчета.месяц">
                </XboxWheel>
              </div>
              <div class="calendar-field">
                <label>День</label>
                <input type="number" v-model.number="cal.data.точка_отсчета.день" min="1" :max="getDaysInMonth(cal.data, cal.data.точка_отсчета.год, cal.data.точка_отсчета.месяц)" class="interactive-el">
              </div>
            </div>
            <div class="calendar-field" v-if="cal.data.точка_отсчета">
              <label>День недели</label>
              <XboxWheel :horizontal="wheelHorizontal"
                :options="(cal.data.названия_дней_недели || []).map((day: string, idx: number) => ({ value: idx, label: day }))"
                v-model.number="cal.data.точка_отсчета.день_недели">
              </XboxWheel>
            </div>
          </div>

          <div class="calendar-section interactive-el">
            <h4>⏱️ Настройки времени</h4>
            <div class="grid-3" v-if="cal.data.настройки_времени">
              <div class="calendar-field"><label>Часов в сутках</label><input type="number" v-model.number="cal.data.настройки_времени.часов_в_сутках" class="interactive-el"></div>
              <div class="calendar-field"><label>Минут в часе</label><input type="number" v-model.number="cal.data.настройки_времени.минут_в_часе" class="interactive-el"></div>
              <div class="calendar-field"><label>Секунд в минуте</label><input type="number" v-model.number="cal.data.настройки_времени.секунд_в_минуте" class="interactive-el"></div>
            </div>
            <div class="grid-2" v-if="cal.data.настройки_времени">
              <div class="calendar-field"><label>Широта</label><input type="number" step="0.1" v-model.number="cal.data.настройки_времени.широта" class="interactive-el"></div>
              <div class="calendar-field" style="display: flex; align-items: center;">
                <label><input type="checkbox" v-model="cal.data.настройки_времени.учитывать_сезонную_длительность_дня" style="margin-right: 8px;"> Учитывать сезонную длительность дня</label>
              </div>
            </div>
          </div>

          <div class="calendar-section interactive-el">
            <h4>📅 Високосный год</h4>
            <div class="grid-2">
              <div class="calendar-field">
                <label>Правило</label>
                <XboxWheel :horizontal="wheelHorizontal"
                  :options="[{ value: 'григорианское', label: 'Григорианское' }, { value: 'пользовательское', label: 'Пользовательское' }, { value: 'отсутствует', label: 'Отсутствует' }]"
                  v-model="cal.data.правило_високосного_года">
                </XboxWheel>
              </div>
              <div class="calendar-field" v-if="cal.data.правило_високосного_года === 'пользовательское'">
                <label>Месяц +1 дня</label>
                <XboxWheel :horizontal="wheelHorizontal"
                  :options="(cal.data.месяцы || []).map((m: any, idx: number) => ({ value: idx, label: m.название }))"
                  v-model.number="cal.data.пользовательское_високосное_правило.месяц">
                </XboxWheel>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
    
    <button type="button" @click.prevent="addCalendar" class="btn-add interactive-el" style="margin-top: 10px; width: 100%;">➕ Добавить календарь</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { calendarService } from '../../services/calendar.service';
import XboxWheel from "../../../../tauri-surreal-kit/frontend/src/components/Vue/XboxWheel.vue";
import { settingsService } from '../../../../tauri-surreal-kit/frontend/src/js/services/settings.service';

const props = defineProps({
  project: { type: String, required: true }
});

const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');
const calendars = ref<any[]>([]);
const expandedIndices = ref<Set<number>>(new Set());

onMounted(async () => {
  await loadCalendars();
  settingsService.onChange(s => wheelHorizontal.value = s.dropdowns?.wheelOrientation === 'horizontal');
});

const loadCalendars = async () => {
  try {
    const list = await calendarService.getCalendars(props.project);
    calendars.value = list.map(c => ({
      id: c.id,
      is_default: c.is_default,
      data: c.data || calendarService.getDefaultCalendar()
    }));
  } catch (e) {
    console.error(e);
  }
};

const toggleExpand = (idx: number) => {
  if (expandedIndices.value.has(idx)) {
    expandedIndices.value.delete(idx);
  } else {
    expandedIndices.value.add(idx);
  }
};

const isExpanded = (idx: number) => expandedIndices.value.has(idx);

const addCalendar = () => {
  const newCal = {
    id: null,
    is_default: calendars.value.length === 0,
    data: JSON.parse(JSON.stringify(calendarService.getDefaultCalendar()))
  };
  calendars.value.push(newCal);
  expandedIndices.value.add(calendars.value.length - 1);
};

const removeCalendar = async (idx: number) => {
  if (!confirm('Удалить календарь?')) return;
  const cal = calendars.value[idx];
  if (cal.id) {
    await calendarService.deleteCalendar(cal.id);
  }
  calendars.value.splice(idx, 1);
};

const setDefault = async (idx: number) => {
  const cal = calendars.value[idx];
  if (cal.is_default) {
    cal.is_default = false;
  } else {
    calendars.value.forEach((c, i) => c.is_default = (i === idx));
  }
  
  for (let i = 0; i < calendars.value.length; i++) {
    if (calendars.value[i].id || i === idx) {
      await saveCalendar(i, true);
    }
  }
  await loadCalendars();
};

const saveCalendar = async (idx: number, skipReload: boolean = false) => {
  const cal = calendars.value[idx];
  const payload = {
    id: cal.id,
    project_id: `projects:${props.project}`,
    name: cal.data.название || 'Новый календарь',
    data: cal.data,
    is_default: cal.is_default
  };
  try {
    await calendarService.saveCalendar(props.project, payload as any);
    if (!skipReload) await loadCalendars(); // reload to get IDs
  } catch (e) {
    console.error(e);
  }
};

const moveItem = (arr: any[], idx: number, delta: number) => {
  const n = idx + delta;
  if (n >= 0 && n < arr.length) {
    [arr[idx], arr[n]] = [arr[n], arr[idx]];
  }
};

const addEra = (data: any) => {
  if (!data.эпохи) data.эпохи = [];
  const last = data.эпохи[data.эпохи.length - 1]?.год_конца || 0;
  data.эпохи.push({ название: `Эпоха ${data.эпохи.length + 1}`, год_начала: last + 1, год_конца: last + 1000 });
};

const addSeason = (data: any) => {
  if (!data.сезоны) data.сезоны = [];
  const used = new Set<number>();
  data.сезоны.forEach((s: any) => s.месяцы?.forEach((m: number) => used.add(m)));
  const available = (data.месяцы || []).map((_: any, i: number) => i).filter((i: number) => !used.has(i));
  data.сезоны.push({
    название: `Сезон ${data.сезоны.length + 1}`,
    месяцы: available.slice(0, 3),
    время_восхода: '06:00',
    время_заката: '18:00',
    описание: ''
  });
};

const toggleMonthInSeason = (data: any, seasonIdx: number | string, monthIdx: number | string) => {
  const sIdx = Number(seasonIdx);
  const mIdx = Number(monthIdx);
  const season = data.сезоны?.[sIdx];
  if (!season) return;
  if (!season.месяцы) season.месяцы = [];

  const pos = season.месяцы.indexOf(mIdx);
  if (pos > -1) {
    season.месяцы.splice(pos, 1);
  } else {
    data.сезоны.forEach((s: any, i: number) => {
      if (i !== sIdx && s.месяцы) {
        const p = s.месяцы.indexOf(mIdx);
        if (p > -1) s.месяцы.splice(p, 1);
      }
    });
    season.месяцы.push(mIdx);
    season.месяцы.sort((a: number, b: number) => a - b);
  }
};

const isMonthInSeason = (data: any, seasonIdx: number | string, monthIdx: number | string) => {
  return data.сезоны?.[Number(seasonIdx)]?.месяцы?.includes(Number(monthIdx)) || false;
};

const addMoonPhase = (data: any) => {
  if (!data.фазы_луны) data.фазы_луны = [];
  data.фазы_луны.push({ название: `Фаза ${data.фазы_луны.length + 1}`, луна_номер: data.фазы_луны.length + 1, период_в_днях: 4 });
};

const addHoliday = (data: any) => {
  if (!data.праздники) data.праздники = [];
  data.праздники.push({ название: `Праздник ${data.праздники.length + 1}`, дата_начала: { месяц: 0, день: 1 }, дата_конца: { месяц: 0, день: 1 } });
};

const getDaysInMonth = (data: any, year: number, monthIdx: number): number => {
  return calendarService.getDaysInMonth(data, year, monthIdx);
};

const saveAll = async () => {
  for (let i = 0; i < calendars.value.length; i++) {
    await saveCalendar(i);
  }
};

defineExpose({ saveAll });
</script>

<style scoped>
.tool-section { margin-bottom: 24px; }
.tool-section h4 { margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; color: var(--text-muted); display: flex; align-items: center; gap: 8px; }
.timeline-events-list { display: flex; flex-direction: column; gap: 16px; margin-bottom: 12px; }
.timeline-event-item { background: var(--bg-input); padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border-color); transition: all 0.3s ease; }
.timeline-event-item:hover { border-color: var(--border-active); box-shadow: 0 0 0 3px var(--accent-glow); }
.event-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; }
.event-title { font-size: 13px; font-weight: 600; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.5px; }
.header-left { display: flex; align-items: center; gap: 8px; }
.expand-icon { font-size: 10px; color: var(--text-muted); width: 12px; text-align: center; }

.calendar-settings-section { margin-bottom: 15px; }
.calendar-field { margin-bottom: 10px; display: flex; flex-direction: column; }
.calendar-field label { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase; }
.calendar-section { padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 15px; background: var(--bg-secondary); }
.calendar-section h4 { margin-top: 0; margin-bottom: 10px; color: var(--accent); }
.item-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
.item-name { flex: 2; }
.item-duration { width: 60px; }
.item-actions { display: flex; gap: 4px; }
</style>


