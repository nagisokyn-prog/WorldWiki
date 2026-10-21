<template>
  <div>
    <!-- СЕКЦИЯ 4: ПРАВИЛО ВОЗРАСТА ПЕРСОНАЖЕЙ (СПЕЦИФИКАЦИЯ 4.13) -->
    <div class="section-card">
      <div class="section-header">
        <div>
          <div class="section-title">🧓 Правило возраста персонажей (Спецификация 4.13)</div>
          <div class="section-desc">Как жители этой культуры считают возраст своих героев в диалогах и биографиях книги.</div>
        </div>
      </div>

      <div class="grid-3" style="margin-top: 6px;">
        <div class="form-group">
          <label class="form-label">Возраст при рождении</label>
          <select
            :value="ageRule.age_at_birth"
            class="form-select"
            :disabled="isReadOnly"
            @change="$emit('update-age-rule', { age_at_birth: parseInt(($event.target as HTMLSelectElement).value) || 0 })"
          >
            <option :value="0">0 лет — Европейский стандарт (новорожденному 0 лет)</option>
            <option :value="1">1 год — Восточноазиатский стандарт (сяй: ребенок рождается в возрасте 1 года)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Когда персонаж взрослеет (+1 год к возрасту)</label>
          <select
            :value="ageRule.step_on_new_year ? 'new_year' : 'birthday'"
            class="form-select"
            :disabled="isReadOnly"
            @change="$emit('update-age-rule', { step_on_new_year: ($event.target as HTMLSelectElement).value === 'new_year' })"
          >
            <option value="birthday">🎂 В личный день рождения (индивидуальная годовщина)</option>
            <option value="new_year">🎍 1-го января Нового Года (коллективно взрослеют в Сольналь)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Точность проверки дня рождения</label>
          <select
            :value="ageRule.year_only ? 'year_only' : 'exact_date'"
            class="form-select"
            :disabled="isReadOnly"
            @change="$emit('update-age-rule', { year_only: ($event.target as HTMLSelectElement).value === 'year_only' })"
          >
            <option value="exact_date">По точной дате (Месяц, День)</option>
            <option value="year_only">Грубо: только по разнице номеров годов</option>
          </select>
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
          <div class="section-title">🗺️ Географические регионы и часовой пояс календаря (Спецификация 4.11)</div>
          <div class="section-desc">Где используется этот календарь. Одна культура может охватывать несколько регионов и городов планеты.</div>
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

      <div class="grid-2" style="margin-top: 6px;">
        <div class="form-group">
          <label class="form-label">Регионы и провинции распространения (Множественный выбор)</label>
          <div class="chip-list">
            <span
              v-for="reg in regionsList"
              :key="reg.id"
              class="preset-chip"
              :class="{ active: selectedRegions.includes(reg.id) }"
              style="cursor: pointer;"
              @click="$emit('toggle-region', reg.id)"
            >
              {{ selectedRegions.includes(reg.id) ? '✓ ' : '' }}{{ reg.name }}
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
          <select
            :value="calendarTimezone"
            class="form-select"
            :disabled="isReadOnly"
            @change="$emit('set-calendar-timezone', ($event.target as HTMLSelectElement).value)"
          >
            <option value="UTC+0">Столичный меридиан (UTC+0, 0ч)</option>
            <option value="UTC+3">Восточный рубеж (UTC+3, +3ч)</option>
            <option value="UTC+8">Дальний Архипелаг (UTC+8, +8ч)</option>
            <option value="UTC-5">Западные Земли (UTC-5, -5ч)</option>
          </select>
          <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
            События книги в тексте будут выводиться с учетом часового пояса выбранного региона.
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { CharacterAgeRuleDto } from '../Tab3CultureLore.model';

defineProps<{
  ageRule: CharacterAgeRuleDto;
  calendarTimezone: string;
  regionsList: { id: string; name: string }[];
  selectedRegions: string[];
  isReadOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update-age-rule', patch: Partial<CharacterAgeRuleDto>): void;
  (e: 'set-calendar-timezone', tz: string): void;
  (e: 'toggle-region', id: string): void;
  (e: 'add-region', name: string): void;
}>();

const showAddRegion = ref(false);
const newRegionName = ref('');

function submitNewRegion() {
  const name = newRegionName.value.trim();
  if (name) {
    emit('add-region', name);
    newRegionName.value = '';
    showAddRegion.value = false;
  }
}
</script>
