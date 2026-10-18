<template>
  <div class="calendar-section planet-editor-container">
    <!-- Шапка планеты -->
    <div class="planet-editor-header flex justify-between items-center mb-4">
      <div class="flex items-center gap-2">
        <h3 class="m-0 text-lg">🪐 Календарь Мира (Физика Планеты): {{ localPlanet.name }}</h3>
      </div>
      <div class="flex gap-2">
        <button type="button" class="btn-icon interactive-el" title="Сохранить планету" @click.prevent="save">
          💾
        </button>
        <button
          v-if="localPlanet.id !== 'earth'"
          type="button"
          class="delete-btn interactive-el"
          title="Удалить планету"
          @click.prevent="remove"
        >
          🗑️
        </button>
      </div>
    </div>

    <!-- Основные физические параметры -->
    <div class="planet-editor-grid mb-4">
      <div class="calendar-field">
        <label class="planet-field-label">Название планеты</label>
        <input
          v-model="localPlanet.name"
          type="text"
          class="planet-input interactive-el"
          placeholder="Земля / Марс / Арракис"
          @input="notifyChange"
        />
      </div>

      <div class="calendar-field">
        <label class="planet-field-label">Длительность суток</label>
        <div class="day-time-inputs-row flex items-center gap-1">
          <input
            v-model.number="dayHours"
            type="number"
            min="0"
            max="999"
            class="planet-input planet-time-input interactive-el"
            title="Часов в сутках"
            @input="onDayTimeChange"
          />
          <span class="time-unit-label">ч</span>
          <input
            v-model.number="dayMinutes"
            type="number"
            min="0"
            max="59"
            class="planet-input planet-time-input interactive-el"
            title="Минут в часе"
            @input="onDayTimeChange"
          />
          <span class="time-unit-label">мин</span>
          <input
            v-model.number="daySeconds"
            type="number"
            min="0"
            max="59"
            class="planet-input planet-time-input interactive-el"
            title="Секунд"
            @input="onDayTimeChange"
          />
          <span class="time-unit-label">с</span>
        </div>
      </div>

      <div class="calendar-field">
        <label class="planet-field-label">Тропический год (дней на орбите)</label>
        <input
          v-model.number="localPlanet.orbit_days"
          type="number"
          step="0.0001"
          min="1"
          class="planet-input interactive-el"
          placeholder="365.2422"
          @input="notifyChange"
        />
      </div>

      <div class="calendar-field">
        <label class="planet-field-label">Наклон оси вращения (°)</label>
        <input
          v-model.number="localPlanet.axial_tilt"
          type="number"
          step="0.1"
          class="planet-input interactive-el"
          placeholder="23.44"
          @input="notifyChange"
        />
      </div>
    </div>

    <div class="flex items-center gap-2 mb-4">
      <label class="planet-checkbox-label flex items-center gap-2 cursor-pointer">
        <input
          v-model="localPlanet.is_retrograde"
          type="checkbox"
          class="interactive-el"
          @change="notifyChange"
        />
        <span>Обратное вращение (солнце восходит на западе)</span>
      </label>
    </div>

    <!-- ❄️☀️ Астрономические точки года -->
    <div class="planet-astronomy-section mb-4">
      <div class="flex justify-between items-center mb-2">
        <h4 class="m-0 text-sm">❄️☀️ Астрономические точки года и солнцестояния</h4>
      </div>

      <div class="calendar-field mb-2" style="max-width: 380px;">
        <label class="planet-field-label">День зимнего солнцестояния на шкале мира (в сутках)</label>
        <input
          v-model.number="localPlanet.solstice_world_day"
          type="number"
          step="1"
          class="planet-input interactive-el"
          placeholder="355"
          @input="notifyChange"
        />
      </div>

      <div v-if="solsticeHumanExplanation" class="text-xs text-muted mb-2">
        {{ solsticeHumanExplanation }}
      </div>

      <button
        v-if="availableCalendars && availableCalendars.length > 0"
        type="button"
        class="btn-calc-daylight interactive-el mb-3"
        @click.prevent="isSolsticeCalcOpen = !isSolsticeCalcOpen"
      >
        {{ isSolsticeCalcOpen ? '▲ Скрыть калькулятор' : '🧮 Рассчитать из культурного календаря' }}
      </button>

      <div v-if="isSolsticeCalcOpen && availableCalendars && availableCalendars.length > 0" class="planet-card-item mb-3">
        <div class="region-main-grid mb-2">
          <div>
            <label class="planet-field-label">Календарь</label>
            <select v-model.number="calcCalendarIdx" class="planet-input interactive-el">
              <option v-for="(c, cIdx) in availableCalendars" :key="c._id || cIdx" :value="cIdx">
                {{ c.название || 'Календарь' }}
              </option>
            </select>
          </div>

          <div>
            <label class="planet-field-label">Месяц</label>
            <select v-model.number="calcMonthIdx" class="planet-input interactive-el">
              <option v-for="(m, mIdx) in calcMonths" :key="mIdx" :value="mIdx">
                {{ m.название }} ({{ m.дней }} дн.)
              </option>
            </select>
          </div>

          <div>
            <label class="planet-field-label">День месяца</label>
            <input
              v-model.number="calcDay"
              type="number"
              min="1"
              :max="calcMaxDays"
              class="planet-input interactive-el"
            />
          </div>

          <div class="flex items-end">
            <button
              type="button"
              class="btn-calc-daylight interactive-el w-full"
              @click.prevent="applySolsticeFromCalendar"
            >
              ⚡ Применить дату
            </button>
          </div>
        </div>
      </div>

      <div class="astronomy-points-grid">
        <div class="astro-card">
          <span class="astro-label">❄️ Зимнее солнцестояние</span>
          <span class="astro-value">{{ astronomicalPoints.winterSolstice }} сут.</span>
        </div>
        <div class="astro-card">
          <span class="astro-label">🌸 Весеннее равноденствие</span>
          <span class="astro-value">{{ astronomicalPoints.springEquinox }} сут.</span>
        </div>
        <div class="astro-card">
          <span class="astro-label">☀️ Летнее солнцестояние</span>
          <span class="astro-value">{{ astronomicalPoints.summerSolstice }} сут.</span>
        </div>
        <div class="astro-card">
          <span class="astro-label">🍂 Осеннее равноденствие</span>
          <span class="astro-value">{{ astronomicalPoints.autumnEquinox }} сут.</span>
        </div>
      </div>
    </div>

    <!-- 🌍 Часовые пояса планеты -->
    <div class="planet-tz-section mb-4">
      <div class="flex justify-between items-center mb-2">
        <h4 class="m-0 text-sm">🌍 Часовые пояса планеты</h4>
        <button type="button" class="btn-add interactive-el" @click.prevent="addTimezone">
          ➕ Добавить пояс
        </button>
      </div>

      <div v-if="!localPlanet.timezones || localPlanet.timezones.length === 0" class="text-xs text-muted mb-2">
        У планеты пока нет часовых поясов. Добавьте пояс нулевого меридиана.
      </div>

      <div v-else class="tz-list">
        <div
          v-for="(tz, tzIdx) in localPlanet.timezones"
          :key="tz.id || tzIdx"
          class="planet-card-item planet-tz-row"
        >
          <input
            v-model="tz.name"
            type="text"
            class="planet-input interactive-el"
            placeholder="Название пояса (Столичный меридиан)"
            @input="notifyChange"
          />
          <input
            v-model="tz.code"
            type="text"
            class="planet-input interactive-el"
            placeholder="Код (UTC/CAP)"
            @input="notifyChange"
          />
          <div class="flex items-center gap-1">
            <input
              v-model.number="tz.base_offset_hours"
              type="number"
              step="0.5"
              class="planet-input interactive-el"
              placeholder="+0"
              @input="notifyChange"
            />
            <span class="text-xs text-muted">ч</span>
          </div>
          <button
            type="button"
            class="btn-icon interactive-el"
            title="Удалить пояс"
            @click.prevent="removeTimezone(tzIdx)"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>

    <!-- 🗺️ Географические регионы планеты -->
    <div class="planet-regions-section mb-4">
      <div class="flex justify-between items-center mb-2">
        <h4 class="m-0 text-sm">🗺️ Географические регионы и города планеты</h4>
        <button type="button" class="btn-add interactive-el" @click.prevent="addRegion">
          ➕ Добавить регион
        </button>
      </div>

      <div v-if="!localPlanet.regions || localPlanet.regions.length === 0" class="text-xs text-muted mb-2">
        У планеты пока нет географических регионов. Добавьте регионы с широтой и долготой.
      </div>

      <div v-else class="regions-list">
        <div
          v-for="(reg, rIdx) in localPlanet.regions"
          :key="reg.id || rIdx"
          class="planet-card-item"
        >
          <div class="region-main-grid mb-2">
            <div>
              <label class="planet-field-label">Название региона / города</label>
              <input
                v-model="reg.name"
                type="text"
                class="planet-input interactive-el"
                placeholder="Столица Империи"
                @input="notifyChange"
              />
            </div>
            <div>
              <label class="planet-field-label">Часовой пояс</label>
              <select
                v-model="reg.timezone_id"
                class="planet-input interactive-el"
                @change="notifyChange"
              >
                <option value="">Без пояса (нулевой)</option>
                <option v-for="t in localPlanet.timezones" :key="t.id" :value="t.id">
                  {{ t.name }} ({{ t.base_offset_hours >= 0 ? '+' : '' }}{{ t.base_offset_hours }} ч)
                </option>
              </select>
            </div>
            <div>
              <label class="planet-field-label">Широта (°)</label>
              <input
                v-model.number="reg.latitude"
                type="number"
                step="0.5"
                min="-90"
                max="90"
                class="planet-input interactive-el"
                placeholder="45.0"
                @input="notifyChange"
              />
            </div>
            <div>
              <label class="planet-field-label">Долгота (°)</label>
              <input
                v-model.number="reg.longitude"
                type="number"
                step="0.5"
                min="-180"
                max="180"
                class="planet-input interactive-el"
                placeholder="0.0"
                @input="notifyChange"
              />
            </div>
          </div>

          <!-- Световой день лето/зима и кнопка расчета -->
          <div class="region-daylight-row">
            <div>
              <label class="planet-field-label">☀️ Макс. световой день (лето)</label>
              <div class="daylight-inputs">
                <input
                  :value="getSummerHours(reg)"
                  type="number"
                  min="0"
                  class="planet-input planet-time-input interactive-el"
                  @input="setSummerHours(reg, Number(($event.target as HTMLInputElement).value))"
                />
                <span class="time-unit-label">ч</span>
                <input
                  :value="getSummerMinutes(reg)"
                  type="number"
                  min="0"
                  max="59"
                  class="planet-input planet-time-input interactive-el"
                  @input="setSummerMinutes(reg, Number(($event.target as HTMLInputElement).value))"
                />
                <span class="time-unit-label">мин</span>
              </div>
            </div>

            <div>
              <label class="planet-field-label">❄️ Мин. световой день (зима)</label>
              <div class="daylight-inputs">
                <input
                  :value="getWinterHours(reg)"
                  type="number"
                  min="0"
                  class="planet-input planet-time-input interactive-el"
                  @input="setWinterHours(reg, Number(($event.target as HTMLInputElement).value))"
                />
                <span class="time-unit-label">ч</span>
                <input
                  :value="getWinterMinutes(reg)"
                  type="number"
                  min="0"
                  max="59"
                  class="planet-input planet-time-input interactive-el"
                  @input="setWinterMinutes(reg, Number(($event.target as HTMLInputElement).value))"
                />
                <span class="time-unit-label">мин</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="btn-calc-daylight interactive-el"
                title="Рассчитать световой день по широте и наклону оси планеты"
                @click.prevent="calculateDaylightForRegion(reg)"
              >
                ⚡ Рассчитать
              </button>
              <button
                type="button"
                class="btn-icon interactive-el"
                title="Удалить регион"
                @click.prevent="removeRegion(rIdx)"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Список спутников и лун -->
    <div class="planet-moons-section">
      <div class="flex justify-between items-center mb-2">
        <h4 class="m-0 text-sm">🌕 Спутники и луны планеты</h4>
        <button type="button" class="btn-add interactive-el" @click.prevent="addMoon">
          ➕ Добавить луну
        </button>
      </div>

      <div v-if="!localPlanet.moons || localPlanet.moons.length === 0" class="text-xs text-muted mb-2">
        У планеты нет естественных спутников.
      </div>

      <div v-else class="moons-table-list">
        <div
          v-for="(moon, mIdx) in localPlanet.moons"
          :key="mIdx"
          class="moon-row flex gap-2 items-center mb-2"
        >
          <input
            v-model="moon.name"
            type="text"
            class="planet-input interactive-el moon-name-input"
            placeholder="Имя спутника"
            @input="notifyChange"
          />
          <span class="text-xs text-muted">Орбитальный период (дней):</span>
          <input
            v-model.number="moon.period_days"
            type="number"
            step="0.01"
            min="0.1"
            class="planet-input interactive-el moon-period-input"
            placeholder="28"
            @input="notifyChange"
          />
          <button
            type="button"
            class="btn-icon interactive-el"
            title="Удалить спутник"
            @click.prevent="removeMoon(mIdx)"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>

    <!-- Опорные исторические события Календаря Мира -->
    <div v-if="masterCalendar" class="mt-4">
      <CalendarAnchorEvents v-model="masterCalendar" />
    </div>
  </div>
</template>

<script setup lang="ts">
import CalendarAnchorEvents from '../CalendarAnchorEvents/CalendarAnchorEvents.vue';
import { usePlanetEditor } from './usePlanetEditor';
import type { PlanetEditorProps, PlanetEditorEmits } from './PlanetEditor.model';

const props = defineProps<PlanetEditorProps>();
const emit = defineEmits<PlanetEditorEmits>();

const {
  localPlanet,
  dayHours,
  dayMinutes,
  daySeconds,
  onDayTimeChange,
  notifyChange,
  astronomicalPoints,
  solsticeHumanExplanation,
  isSolsticeCalcOpen,
  calcCalendarIdx,
  calcMonthIdx,
  calcDay,
  availableCalendars,
  calcMonths,
  calcMaxDays,
  applySolsticeFromCalendar,
  addTimezone,
  removeTimezone,
  addRegion,
  removeRegion,
  calculateDaylightForRegion,
  getSummerHours,
  getSummerMinutes,
  setSummerHours,
  setSummerMinutes,
  getWinterHours,
  getWinterMinutes,
  setWinterHours,
  setWinterMinutes,
  addMoon,
  removeMoon,
  save,
  remove,
} = usePlanetEditor(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/PlanetEditor.css"></style>
