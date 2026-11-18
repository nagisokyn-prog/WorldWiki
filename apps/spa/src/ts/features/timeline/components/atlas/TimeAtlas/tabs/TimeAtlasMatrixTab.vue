<template>
  <div class="atlas-tab-pane tab-pane">
    <div class="matrix-toolbar glass-panel">
      <div class="matrix-selector-group">
        <label>Базовый календарь (сетка):</label>
        <XboxWheel
          :model-value="matrixBaseCalId"
          :options="calendarWheelOptions"
          class="interactive-el glass-select"
          @update:model-value="$emit('update:matrixBaseCalId', $event)"
        />
      </div>

      <div class="matrix-selector-group">
        <label>Сравнительный (в углах ячеек):</label>
        <XboxWheel
          :model-value="matrixCompareCalId"
          :options="calendarWheelOptions"
          class="interactive-el glass-select"
          @update:model-value="$emit('update:matrixCompareCalId', $event)"
        />
      </div>

      <div class="matrix-nav-group">
        <button class="matrix-btn interactive-el" title="Предыдущий месяц" @click="$emit('prevMonth')">◀</button>
        
        <!-- Era Select -->
        <XboxWheel
          v-if="matrixBaseCal?.эпохи && matrixBaseCal.эпохи.length > 0"
          :model-value="matrixEra || 0"
          :options="eraWheelOptions"
          class="interactive-el glass-select matrix-era-select"
          @update:model-value="$emit('update:matrixEra', Number($event))"
        />

        <!-- Year Input -->
        <input
          :value="matrixYear"
          type="number"
          class="interactive-el glass-input matrix-year-input"
          title="Год"
          @change="$emit('update:matrixYear', Number(($event.target as HTMLInputElement).value))"
        />

        <!-- Month Select -->
        <XboxWheel
          :model-value="matrixMonth"
          :options="monthWheelOptions"
          class="interactive-el glass-select matrix-month-select"
          title="Месяц"
          @update:model-value="$emit('update:matrixMonth', Number($event))"
        />

        <button class="matrix-btn interactive-el" title="Следующий месяц" @click="$emit('nextMonth')">▶</button>
      </div>
    </div>

    <!-- Сетка дней -->
    <div class="matrix-grid">
      <div
        v-for="d in matrixGridDays"
        :key="d.day"
        class="matrix-day-cell interactive-el"
        :class="{
          'is-active': d.isCurrent,
          'has-holiday': d.baseMeta?.holiday || d.compHoliday
        }"
        @click="$emit('selectDay', d.baseMin)"
      >
        <div class="cell-top">
          <span class="base-day-num">{{ d.day }}</span>
          <span v-if="d.compDateStr" class="comp-day-tag" :title="`В сравнительном календаре: ${d.compDateStr}`">
            {{ d.compDateStr }}
          </span>
        </div>

        <div class="cell-body">
          <div v-if="d.baseMeta?.holiday" class="cell-holiday-tag base-holiday" :title="`Праздник: ${d.baseMeta.holiday}`">
            {{ d.baseMeta.holiday }}
          </div>
          <div v-if="d.compHoliday" class="cell-holiday-tag comp-holiday" :title="`Праздник (соседний календарь): ${d.compHoliday}`">
            ⚡ {{ d.compHoliday }}
          </div>
        </div>

        <div v-if="d.baseMeta?.moons?.length > 0" class="cell-moons">
          <span v-for="(m, mIdx) in d.baseMeta.moons" :key="mIdx" :title="`${m.moon.name}: ${m.name}`">
            {{ m.emoji }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { TimeAtlasMatrixTabProps, TimeAtlasMatrixTabEmits } from './TimeAtlasMatrixTab.model';
import { useTimeAtlasMatrixTab } from './useTimeAtlasMatrixTab';

const props = defineProps<TimeAtlasMatrixTabProps>();

defineEmits<TimeAtlasMatrixTabEmits>();

const { calendarWheelOptions, eraWheelOptions, monthWheelOptions } = useTimeAtlasMatrixTab(props);
</script>
