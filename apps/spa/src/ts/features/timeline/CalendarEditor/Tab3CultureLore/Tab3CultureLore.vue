<template>
  <div class="tab3-culture-lore">
    <!-- СЕКЦИЯ 1: ВРЕМЕНА ГОДА (СЕЗОНЫ) -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">🍂 Времена года (Сезоны)</div>
          <div class="section-desc">Климатические сезоны, закрепленные за месяцами и днями года.</div>
        </div>
        <button v-if="!isReadOnly" type="button" class="btn-ghost-sm" @click="addSeason">
          ➕ Добавить сезон
        </button>
      </header>

      <div class="flex flex-col gap-2 mb-3">
        <div
          v-for="(s, idx) in seasons"
          :key="idx"
          class="p-2 rounded bg-surface border border-subtle flex flex-col gap-2"
        >
          <div class="flex items-center gap-2">
            <input
              v-model="s.название"
              type="text"
              class="table-input font-medium flex-1"
              placeholder="Название сезона..."
              :disabled="isReadOnly"
              @input="updateSeasons([...seasons])"
            />
            <input
              v-model="s.время_восхода"
              type="text"
              class="table-input w-24"
              placeholder="Восход (06:00)"
              :disabled="isReadOnly"
              @input="updateSeasons([...seasons])"
            />
            <input
              v-model="s.время_заката"
              type="text"
              class="table-input w-24"
              placeholder="Закат (18:00)"
              :disabled="isReadOnly"
              @input="updateSeasons([...seasons])"
            />
            <button
              v-if="!isReadOnly && seasons.length > 1"
              type="button"
              class="btn-icon-table"
              title="Удалить сезон"
              @click="removeSeason(idx)"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- СЕКЦИЯ 2: ПРАЗДНИКИ И ПАМЯТНЫЕ ДАТЫ -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">🎉 Праздники и Памятные даты культуры</div>
          <div class="section-desc">Традиционные фестивали, памятные дни и интеркалярные праздники.</div>
        </div>
        <button v-if="!isReadOnly" type="button" class="btn-ghost-sm" @click="addHoliday">
          ➕ Добавить праздник
        </button>
      </header>

      <table class="items-table mb-3">
        <thead>
          <tr>
            <th>Название праздника</th>
            <th class="w-24">Месяц</th>
            <th class="w-20">День</th>
            <th>Описание лора</th>
            <th class="w-12"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(h, idx) in holidays" :key="idx">
            <td>
              <input
                v-model="h.название"
                type="text"
                class="table-input font-medium"
                :disabled="isReadOnly"
                @input="updateHolidays([...holidays])"
              />
            </td>
            <td>
              <input
                v-model.number="h.дата_начала.месяц"
                type="number"
                class="table-input"
                min="0"
                :disabled="isReadOnly"
                @input="updateHolidays([...holidays])"
              />
            </td>
            <td>
              <input
                v-model.number="h.дата_начала.день"
                type="number"
                class="table-input"
                min="1"
                :disabled="isReadOnly"
                @input="updateHolidays([...holidays])"
              />
            </td>
            <td>
              <input
                v-model="h.описание"
                type="text"
                class="table-input"
                placeholder="Традиции, обычаи..."
                :disabled="isReadOnly"
                @input="updateHolidays([...holidays])"
              />
            </td>
            <td>
              <button
                v-if="!isReadOnly"
                type="button"
                class="btn-icon-table"
                title="Удалить праздник"
                @click="removeHoliday(idx)"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- СЕКЦИЯ 3: ЛУННЫЕ ФАЗЫ В КУЛЬТУРЕ -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">🌕 Лунные фазы в культуре (Спутник: Луна)</div>
          <div class="section-desc">Традиционные народные названия фаз спутников планеты.</div>
        </div>
        <button v-if="!isReadOnly" type="button" class="btn-ghost-sm" @click="addMoonPhase">
          ➕ Добавить фазу
        </button>
      </header>

      <div class="grid-2">
        <div
          v-for="(mp, idx) in moonPhases"
          :key="idx"
          class="p-2 rounded bg-surface border border-subtle flex items-center justify-between"
        >
          <input
            v-model="mp.name"
            type="text"
            class="table-input font-medium flex-1 mr-2"
            :disabled="isReadOnly"
            @input="updateMoonPhases([...moonPhases])"
          />
          <button
            v-if="!isReadOnly && moonPhases.length > 1"
            type="button"
            class="btn-icon-table"
            title="Удалить фазу"
            @click="removeMoonPhase(idx)"
          >
            🗑️
          </button>
        </div>
      </div>
    </section>

    <!-- СЕКЦИЯ 4: ПРАВИЛО ВОЗРАСТА ПЕРСОНАЖЕЙ (СПЕЦИФИКАЦИЯ 4.13) -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">🧓 Правило возраста персонажей (Спецификация 4.13)</div>
          <div class="section-desc">
            Формула расчета возраста жителей этой планеты в эквиваленте земных / биологических лет.
          </div>
        </div>
      </header>

      <div class="grid-3">
        <div class="form-group">
          <label class="form-label">Режим расчета возраста</label>
          <select
            :value="ageRule.mode"
            class="form-select"
            :disabled="isReadOnly"
            @change="updateAgeRule({ mode: ($event.target as HTMLSelectElement).value as any })"
          >
            <option value="tropical_years">По годам планеты (1 год = 1 оборот)</option>
            <option value="earth_standard_equivalent">Эквивалент Земли (365.2422 сут)</option>
            <option value="custom_ratio">Кастомный коэффициент</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Коэффициент пересчета к Земле</label>
          <input
            type="number"
            step="0.01"
            class="form-input"
            :value="ageRule.ratio_to_earth"
            :disabled="isReadOnly"
            @input="updateAgeRule({ ratio_to_earth: parseFloat(($event.target as HTMLInputElement).value) || 1.0 })"
          />
        </div>

        <div class="form-group flex flex-col justify-end">
          <label class="flex items-center gap-2 text-xs cursor-pointer mb-2">
            <input
              type="checkbox"
              :checked="ageRule.step_on_new_year"
              :disabled="isReadOnly"
              @change="updateAgeRule({ step_on_new_year: ($event.target as HTMLInputElement).checked })"
            />
            <span>Возраст увеличивается строго 1 января</span>
          </label>
        </div>
      </div>
    </section>

    <!-- СЕКЦИЯ 5: РЕГИОНЫ И ЧАСОВОЙ ПОЯС КАЛЕНДАРЯ (СПЕЦИФИКАЦИЯ 4.11) -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">🗺️ Географические регионы и часовой пояс календаря (Спецификация 4.11)</div>
          <div class="section-desc">Привязка летоисчисления культуры к географическому часовому поясу планеты.</div>
        </div>
      </header>

      <div class="form-group max-w-sm">
        <label class="form-label">Основной часовой пояс календаря</label>
        <input
          type="text"
          class="form-input"
          :value="calendarTimezone"
          placeholder="UTC+0"
          :disabled="isReadOnly"
          @input="setCalendarTimezone(($event.target as HTMLInputElement).value)"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Tab3CultureLoreProps, Tab3CultureLoreEmits } from './Tab3CultureLore.model';
import { useTab3CultureLore } from './useTab3CultureLore';

const props = defineProps<Tab3CultureLoreProps>();
const emit = defineEmits<Tab3CultureLoreEmits>();

const {
  seasons,
  holidays,
  moonPhases,
  ageRule,
  calendarTimezone,
  updateSeasons,
  addSeason,
  removeSeason,
  updateHolidays,
  addHoliday,
  removeHoliday,
  updateMoonPhases,
  addMoonPhase,
  removeMoonPhase,
  updateAgeRule,
  setCalendarTimezone,
} = useTab3CultureLore(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarEditor.css"></style>
