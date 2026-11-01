<template>
  <div id="planet-tab-timezones-regions" class="tab-pane active">
    <div class="section-card">
      <div class="section-header">
        <div>
          <div class="section-title">🌍 Часовые пояса планеты</div>
          <div class="section-desc">Сетка часовых поясов мира относительно нулевого меридиана.</div>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="btn-ghost-sm interactive-el"
            @click="$emit('apply-preset', 'earth24')"
          >
            🌐 Стандарт (24 пояса)
          </button>
          <button
            type="button"
            class="btn-ghost-sm interactive-el"
            @click="$emit('apply-preset', 'single')"
          >
            0️⃣ Только меридиан
          </button>
        </div>
      </div>

      <table class="items-table mb-3">
        <thead>
          <tr>
            <th>Название часового пояса</th>
            <th class="w-32">Код</th>
            <th class="w-40">Смещение (ч)</th>
            <th class="w-40">☀️ Летнее время (DST)</th>
            <th class="w-12"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(tz, idx) in planet.timezones" :key="idx">
            <td><input v-model="tz.name" type="text" class="table-input" :disabled="isReadOnly" /></td>
            <td><input v-model="tz.code" type="text" class="table-input font-semibold" :disabled="isReadOnly" /></td>
            <td>
              <div class="flex items-center gap-1">
                <input v-model.number="tz.offset_hours" type="number" step="0.5" class="table-input w-20" :disabled="isReadOnly" />
                <span class="text-xs text-muted">ч</span>
              </div>
            </td>
            <td>
              <XboxWheel
                :model-value="tz.dst_rule"
                :options="dstOptions"
                style="min-width: 130px;"
                @update:model-value="tz.dst_rule = $event as any"
              />
            </td>
            <td>
              <button
                v-if="!isReadOnly"
                type="button"
                class="btn-icon-table"
                title="Удалить пояс"
                @click="$emit('remove-timezone', idx)"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <button
        v-if="!isReadOnly"
        type="button"
        class="btn-ghost-sm interactive-el"
        @click="$emit('add-timezone')"
      >
        ➕ Добавить часовой пояс
      </button>
    </div>

    <!-- Географические регионы и города -->
    <div class="section-card">
      <div class="section-header">
        <div>
          <div class="section-title">🗺️ Географические регионы, города и световой день</div>
          <div class="section-desc">Опорные точки планеты для расчета долготы, полудня и длительности светового дня.</div>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="btn-ghost-sm interactive-el"
            @click="$emit('apply-regions-preset', 'earth')"
          >
            🌐 Города Земли
          </button>
          <button
            type="button"
            class="btn-ghost-sm interactive-el"
            @click="$emit('apply-regions-preset', 'fantasy')"
          >
            🏰 Фэнтези регионы
          </button>
          <button
            v-if="!isReadOnly"
            type="button"
            class="btn-ghost-sm interactive-el"
            @click="$emit('add-region')"
          >
            + Добавить регион
          </button>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Город / Регион</th>
            <th class="w-32">Часовой пояс</th>
            <th class="w-24">Широта (°)</th>
            <th class="w-24">Долгота (°)</th>
            <th class="w-36">☀️ Макс. день (лето)</th>
            <th class="w-36">❄️ Мин. день (зима)</th>
            <th class="w-12"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(reg, idx) in planet.regions" :key="idx">
            <td><input v-model="reg.name" type="text" class="table-input" :disabled="isReadOnly" /></td>
            <td>
              <XboxWheel
                :model-value="reg.timezone_code"
                :options="timezoneCodeOptions"
                style="min-width: 100px;"
                @update:model-value="reg.timezone_code = $event"
              />
            </td>
            <td><input v-model.number="reg.latitude" type="number" step="0.1" class="table-input" :disabled="isReadOnly" /></td>
            <td><input v-model.number="reg.longitude" type="number" step="0.1" class="table-input" :disabled="isReadOnly" /></td>
            <td><strong>{{ reg.max_day_hours || '12ч 00м' }}</strong></td>
            <td><strong>{{ reg.min_day_hours || '12ч 00м' }}</strong></td>
            <td>
              <button
                v-if="!isReadOnly"
                type="button"
                class="btn-icon-table"
                title="Удалить регион"
                @click="$emit('remove-region', idx)"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { XboxWheel } from '@worldwiki/components';
import type { PlanetTimezonesTabProps, PlanetTimezonesTabEmits } from './PlanetTimezonesTab.model';

const props = defineProps<PlanetTimezonesTabProps>();

defineEmits<PlanetTimezonesTabEmits>();

const dstOptions = [
  { value: 'none', label: '🚫 Без перевода (None)' },
  { value: 'eu', label: '🇪🇺 EU (+60м)' },
  { value: 'us', label: '🇺🇸 US (+60м)' },
];

const timezoneCodeOptions = computed(() =>
  props.planet.timezones.map((tz) => ({
    value: tz.code,
    label: tz.code,
  }))
);
</script>
