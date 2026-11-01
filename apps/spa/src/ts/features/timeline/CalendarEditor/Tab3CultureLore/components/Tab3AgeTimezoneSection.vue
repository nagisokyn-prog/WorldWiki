<template>
  <div>
    <!-- СЕКЦИЯ 4: ПРАВИЛО ВОЗРАСТА ПЕРСОНАЖЕЙ (СПЕЦИФИКАЦИЯ 4.13) -->
    <div class="section-card">
      <div class="section-header">
        <div>
          <div class="section-title">🧓 Правило возраста персонажей</div>
          <div class="section-desc">Как жители этой культуры считают возраст своих героев в диалогах и биографиях книги.</div>
        </div>
      </div>

      <div class="grid-3" style="margin-top: 8px;">
        <div class="form-group">
          <label class="form-label">Возраст при рождении</label>
          <XboxWheel
            :model-value="String(ageRule.age_at_birth)"
            :options="ageAtBirthOptions"
            @update:model-value="$emit('update-age-rule', { age_at_birth: parseInt($event) || 0 })"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Когда персонаж взрослеет (+1 год к возрасту)</label>
          <XboxWheel
            :model-value="ageRule.step_on_new_year ? 'new_year' : 'birthday'"
            :options="stepOnNewYearOptions"
            @update:model-value="$emit('update-age-rule', { step_on_new_year: $event === 'new_year' })"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Точность проверки дня рождения</label>
          <XboxWheel
            :model-value="ageRule.year_only ? 'year_only' : 'exact_date'"
            :options="yearOnlyOptions"
            @update:model-value="$emit('update-age-rule', { year_only: $event === 'year_only' })"
          />
        </div>
      </div>

      <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">
        💡 <strong>Как это работает в книге:</strong> Персонаж всегда стареет по законам <em>своей родной культуры</em>, даже находясь в чужих землях или на космическом корабле.
      </div>
    </div>

    <!-- СЕКЦИЯ 5: ГЕОГРАФИЧЕСКИЕ РЕГИОНЫ И ЧАСОВОЙ ПОЯС (СПЕЦИФИКАЦИЯ 4.11) -->
    <div class="section-card" style="margin-top: 12px;">
      <div class="section-header">
        <div>
          <div class="section-title">🗺️ Регионы распространения и часовой пояс</div>
          <div class="section-desc">Где используется этот календарь на планете. Культура может охватывать несколько регионов и городов мира.</div>
        </div>
        <button
          v-if="!isReadOnly"
          type="button"
          class="btn-ghost-sm"
          @click="showAddRegion = true"
        >
          + Добавить регион
        </button>
      </div>

      <div class="grid-2" style="margin-top: 8px;">
        <div class="form-group">
          <label class="form-label">Регионы и провинции планеты (Множественный выбор)</label>
          <div class="chip-list">
            <span
              v-for="reg in regionsList"
              :key="reg.id"
              class="preset-chip"
              :class="{ active: selectedRegions.includes(reg.id) }"
              style="cursor: pointer;"
              @click="$emit('toggle-region', reg.id)"
            >
              <span v-if="selectedRegions.includes(reg.id)">✓ </span>{{ reg.name }}
            </span>
          </div>

          <div v-if="showAddRegion && !isReadOnly" style="display: flex; gap: 6px; margin-top: 8px;">
            <input
              v-model="newRegionName"
              type="text"
              class="form-input"
              style="flex: 1; padding: 4px 8px; font-size: 12px;"
              placeholder="Название нового региона..."
              @keydown.enter="submitNewRegion"
            />
            <button
              type="button"
              class="btn-action btn-primary"
              style="padding: 4px 10px; font-size: 12px;"
              @click="submitNewRegion"
            >
              Добавить
            </button>
            <button
              type="button"
              class="btn-ghost-sm"
              @click="showAddRegion = false"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Основной часовой пояс культуры по умолчанию</label>
          <XboxWheel
            :model-value="calendarTimezone"
            :options="timezonesOptions"
            @update:model-value="$emit('set-calendar-timezone', $event)"
          />
          <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px; display: block;">
            События книги в тексте будут выводиться с учетом часового пояса выбранного региона планеты.
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { XboxWheel } from '@worldwiki/components';
import type { Tab3AgeTimezoneSectionProps, Tab3AgeTimezoneSectionEmits } from './Tab3AgeTimezoneSection.model';
import { useTab3AgeTimezoneSection } from './useTab3AgeTimezoneSection';

const props = defineProps<Tab3AgeTimezoneSectionProps>();

const emit = defineEmits<Tab3AgeTimezoneSectionEmits>();

const { showAddRegion, newRegionName, submitNewRegion } = useTab3AgeTimezoneSection(emit);

const ageAtBirthOptions = [
  { value: '0', label: '0 лет — Европейский стандарт (новорожденному 0 лет)' },
  { value: '1', label: '1 год — Восточноазиатский стандарт (сяй: ребенок рождается в возрасте 1 года)' },
];

const stepOnNewYearOptions = [
  { value: 'birthday', label: '🎂 В личный день рождения (индивидуальная годовщина)' },
  { value: 'new_year', label: '🎍 1-го января Нового Года (коллективно взрослеют в Сольналь)' },
];

const yearOnlyOptions = [
  { value: 'exact_date', label: 'По точной дате (Месяц, День)' },
  { value: 'year_only', label: 'Грубо: только по разнице номеров годов' },
];

const timezonesOptions = computed(() => {
  if (props.timezonesList && props.timezonesList.length > 0) {
    return props.timezonesList;
  }
  return [
    { value: 'UTC+0', label: 'Столичный меридиан (UTC+0, 0ч)' },
    { value: 'UTC+1', label: 'Центральная Европа (UTC+1, +1ч)' },
    { value: 'UTC+2', label: 'Восточноевропейский пояс (UTC+2, +2ч)' },
    { value: 'UTC+3', label: 'Московское время (UTC+3, +3ч)' },
    { value: 'UTC+8', label: 'Восточная Азия / Китай (UTC+8, +8ч)' },
    { value: 'UTC+9', label: 'Япония / Корея (UTC+9, +9ч)' },
    { value: 'UTC-5', label: 'Восточное побережье США (UTC-5, -5ч)' },
  ];
});
</script>
