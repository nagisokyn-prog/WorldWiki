<template>
  <div class="tab1-structure">
    <!-- СЕКЦИЯ 1: ДЕЛЕНИЕ СУТОК (ЦИФЕРБЛАТ: DialHierarchy) -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">⏰ Деление суток (Циферблат: DialHierarchy)</div>
          <div class="section-desc">
            Произвольная цепочка делений дня от старшей к младшей (часы, стражи, минуты, удары гонга).
          </div>
        </div>
      </header>

      <!-- Пресеты циферблатов -->
      <div class="form-group mb-3">
        <label class="form-label">Готовые пресеты циферблатов культур</label>
        <div class="chip-list">
          <button
            type="button"
            class="preset-chip"
            :disabled="isReadOnly"
            @click="applyDialPreset('earth')"
          >
            🌍 Земной стандарт (24ч × 60м × 60с)
          </button>
          <button
            type="button"
            class="preset-chip"
            :disabled="isReadOnly"
            @click="applyDialPreset('fantasy')"
          >
            🏰 Фэнтези: Стражи и Колокола (4 × 6 × 100)
          </button>
          <button
            type="button"
            class="preset-chip"
            :disabled="isReadOnly"
            @click="applyDialPreset('metric')"
          >
            📐 Десятичный (10 × 100 × 100)
          </button>
          <button
            type="button"
            class="preset-chip"
            :disabled="isReadOnly"
            @click="applyDialPreset('agrarian')"
          >
            🌾 Аграрный (без часов, только сутки)
          </button>
        </div>
      </div>

      <!-- Таблица единиц времени -->
      <table class="items-table mb-3">
        <thead>
          <tr>
            <th class="w-10">#</th>
            <th>Название единицы времени</th>
            <th class="w-48">Делений в родительской единице</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(unit, idx) in dialUnits" :key="idx">
            <td>{{ idx + 1 }}</td>
            <td>
              <input
                v-model="unit.name"
                type="text"
                class="table-input"
                :disabled="isReadOnly"
              />
            </td>
            <td>
              <input
                v-model.number="unit.subdivisions"
                type="number"
                class="table-input"
                min="1"
                :disabled="isReadOnly"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Момент смены суток -->
      <div class="form-group">
        <label class="form-label">Момент смены суток (day_start_offset)</label>
        <select
          :value="dayStartOffset"
          class="form-select max-w-sm"
          :disabled="isReadOnly"
          @change="setDayStartOffset(($event.target as HTMLSelectElement).value as any)"
        >
          <option value="midnight">Полночь (00:00, 0 тиков — стандарт)</option>
          <option value="sunrise">Рассвет (+0.25 от суток — Египет, Эфиопия)</option>
          <option value="noon">Полдень (+0.50 от суток — счет JDN)</option>
          <option value="sunset">Закат (-0.25 от суток — древнесемитский, ислам)</option>
          <option value="custom">⚙️ Кастомное время / смещение</option>
        </select>
      </div>
    </section>

    <!-- СЕКЦИЯ 2: ДНИ НЕДЕЛИ -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">📅 Дни недели</div>
          <div class="section-desc">{{ weekdays.length }} дней в цикле недели. Задайте любой цикл (от 3 до 14+ дней).</div>
        </div>
      </header>

      <!-- Пресеты циклов недели -->
      <div class="form-group mb-3">
        <label class="form-label">Готовые пресеты циклов недели</label>
        <div class="chip-list">
          <button type="button" class="preset-chip" :disabled="isReadOnly" @click="applyWeekPreset(7)">
            🌍 7 дней (Земной: Пн-Вс)
          </button>
          <button type="button" class="preset-chip" :disabled="isReadOnly" @click="applyWeekPreset(6)">
            🏰 6 дней (Гексада фэнтези)
          </button>
          <button type="button" class="preset-chip" :disabled="isReadOnly" @click="applyWeekPreset(10)">
            🏛️ 10 дней (Декада Египта)
          </button>
          <button type="button" class="preset-chip" :disabled="isReadOnly" @click="applyWeekPreset(5)">
            ⏳ 5 дней (Пятидневка)
          </button>
        </div>
      </div>

      <!-- Список дней недели с перемещением -->
      <div class="weekdays-edit-list flex flex-col gap-1 mb-3">
        <div
          v-for="(wd, idx) in weekdays"
          :key="idx"
          class="flex items-center gap-2 p-1 rounded bg-surface"
        >
          <span class="text-xs text-muted w-6">{{ idx + 1 }}.</span>
          <input
            v-model="wd.название"
            type="text"
            class="table-input flex-1"
            :disabled="isReadOnly"
          />
          <button
            v-if="!isReadOnly"
            type="button"
            class="btn-icon-table"
            title="Вверх"
            :disabled="idx === 0"
            @click="reorderWeekday(idx, -1)"
          >
            ↑
          </button>
          <button
            v-if="!isReadOnly"
            type="button"
            class="btn-icon-table"
            title="Вниз"
            :disabled="idx === weekdays.length - 1"
            @click="reorderWeekday(idx, 1)"
          >
            ↓
          </button>
          <button
            v-if="!isReadOnly && weekdays.length > 1"
            type="button"
            class="btn-icon-table"
            title="Удалить день"
            @click="removeWeekday(idx)"
          >
            🗑️
          </button>
        </div>
      </div>

      <!-- Добавление своего дня недели -->
      <div v-if="!isReadOnly" class="flex gap-2 items-center mb-3">
        <input
          id="new-weekday-input"
          type="text"
          class="form-input flex-1"
          placeholder="Название нового дня (напр. Солнцевень, Лунь)..."
          @keydown.enter="addNewDay"
        />
        <button
          type="button"
          class="btn-action btn-primary whitespace-nowrap"
          @click="addNewDay"
        >
          ➕ Добавить день
        </button>
      </div>

      <!-- Чекбокс заморозки недели -->
      <div class="border-t border-subtle pt-2">
        <label class="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            :checked="pauseOnHolidays"
            :disabled="isReadOnly"
            @change="setPauseOnHolidays(($event.target as HTMLInputElement).checked)"
          />
          <span>⏸️ Замораживать счет дней недели на время праздников (интеркалярные дни вне недели)</span>
        </label>
      </div>
    </section>

    <!-- СЕКЦИЯ 3: МЕСЯЦЫ ГОДА -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">🗓️ Месяцы года (Сетка базового года)</div>
          <div class="section-desc">Сумма дней: <strong class="status-chip success">{{ totalYearDays }} дн.</strong></div>
        </div>
        <div v-if="!isReadOnly" class="flex gap-2">
          <button type="button" class="btn-ghost-sm" @click="balanceMonthsEvenly">
            🪄 Выровнять поровну
          </button>
          <button type="button" class="btn-ghost-sm" @click="addMonth">
            ➕ Добавить месяц
          </button>
        </div>
      </header>

      <table class="items-table">
        <thead>
          <tr>
            <th class="w-10">#</th>
            <th>Название месяца</th>
            <th class="w-32">Дней</th>
            <th class="w-12"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(month, idx) in months" :key="idx">
            <td>{{ idx + 1 }}</td>
            <td>
              <input
                v-model="month.название"
                type="text"
                class="table-input"
                :disabled="isReadOnly"
                @input="updateMonths([...months])"
              />
            </td>
            <td>
              <input
                v-model.number="month.дней"
                type="number"
                class="table-input"
                min="1"
                :disabled="isReadOnly"
                @input="updateMonths([...months])"
              />
            </td>
            <td>
              <button
                v-if="!isReadOnly && months.length > 1"
                type="button"
                class="btn-icon-table"
                title="Удалить месяц"
                @click="updateMonths(months.filter((_, i) => i !== idx))"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- СЕКЦИЯ 4: ВИСОКОСНЫЕ ПРАВИЛА (В сетке года) -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">⚙️ Високосные правила года</div>
          <div class="section-desc">Правило добавления високосного дня для компенсации тропического года орбиты.</div>
        </div>
      </header>

      <div class="grid-3">
        <div class="form-group">
          <label class="form-label">Интервал високоса (каждые N лет)</label>
          <input
            type="number"
            class="form-input"
            :value="leapRules[0]?.interval || 4"
            min="1"
            :disabled="isReadOnly"
            @input="updateLeapRuleField('interval', parseInt(($event.target as HTMLInputElement).value) || 4)"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Добавлять дней</label>
          <input
            type="number"
            class="form-input"
            :value="leapRules[0]?.day_offset || 1"
            min="1"
            :disabled="isReadOnly"
            @input="updateLeapRuleField('day_offset', parseInt(($event.target as HTMLInputElement).value) || 1)"
          />
        </div>
        <div class="form-group">
          <label class="form-label">В какой месяц добавлять</label>
          <select
            class="form-select"
            :value="leapRules[0]?.target_month ?? 1"
            :disabled="isReadOnly"
            @change="updateLeapRuleField('target_month', parseInt(($event.target as HTMLSelectElement).value) || 0)"
          >
            <option v-for="(m, idx) in months" :key="idx" :value="idx">
              {{ m.название || `Месяц ${idx + 1}` }}
            </option>
          </select>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Tab1StructureProps, Tab1StructureEmits } from './Tab1Structure.model';
import { useTab1Structure } from './useTab1Structure';

const props = defineProps<Tab1StructureProps>();
const emit = defineEmits<Tab1StructureEmits>();

const {
  months,
  weekdays,
  pauseOnHolidays,
  dialUnits,
  dayStartOffset,
  leapRules,
  totalYearDays,
  applyDialPreset,
  setDayStartOffset,
  applyWeekPreset,
  reorderWeekday,
  addCustomWeekday,
  removeWeekday,
  setPauseOnHolidays,
  updateMonths,
  addMonth,
  balanceMonthsEvenly,
  updateLeapRules,
} = useTab1Structure(props, emit);

function addNewDay() {
  const input = document.getElementById('new-weekday-input') as HTMLInputElement | null;
  if (input && input.value.trim()) {
    addCustomWeekday(input.value.trim());
    input.value = '';
  }
}

function updateLeapRuleField(field: 'interval' | 'day_offset' | 'target_month', val: number) {
  const current = leapRules.value[0] || { interval: 4, day_offset: 1, target_month: 1 };
  const updated = [{ ...current, [field]: val }];
  updateLeapRules(updated);
}
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/Tab1Structure.css"></style>
