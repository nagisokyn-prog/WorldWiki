<template>
  <div class="tab5-reforms-dst">
    <!-- Секция: Календарные реформы -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">🔄 Исторические календарные реформы</div>
          <div class="section-desc">Смена стилей (Old/New Style), пропуск дней (Gap) или переходный год.</div>
        </div>
        <button v-if="!isReadOnly" type="button" class="btn-ghost-sm" @click="addReform('DiscontinuousGap')">
          + Реформа (Gap)
        </button>
      </header>

      <div v-if="reforms.length === 0" class="section-desc">
        Реформы не настроены. Календарь действует непрерывно по исходному стилю.
      </div>

      <div v-else class="reform-tape-preview">
        <div v-for="(reform, idx) in reforms" :key="idx" class="reform-pill gap">
          <strong>{{ reform.effective_year }} г.</strong>: {{ reform.name }} ({{ reform.mode }})
          <button
            v-if="!isReadOnly"
            type="button"
            class="btn-icon-table"
            title="Удалить реформу"
            @click="removeReform(idx)"
          >
            🗑️
          </button>
        </div>
      </div>
    </section>

    <!-- Секция: Сезонный перевод времени (DST) -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">☀️ Сезонный перевод стрелок (DST)</div>
          <div class="section-desc">Весенний скачок вперед (+60м) и осенний возврат (-60м).</div>
        </div>
        <button
          v-if="!isReadOnly"
          type="button"
          class="btn-ghost-sm"
          @click="toggleDst(!dstPolicy.is_enabled)"
        >
          {{ dstPolicy.is_enabled ? 'Выключить DST' : 'Включить DST' }}
        </button>
      </header>

      <div v-if="dstPolicy.is_enabled" class="grid-3">
        <div class="form-group">
          <label class="form-label">Весенний сдвиг (мин)</label>
          <input
            type="number"
            class="form-input"
            :value="dstPolicy.spring_shift_minutes"
            :disabled="isReadOnly"
            @input="updateDstPolicy({ spring_shift_minutes: parseInt(($event.target as HTMLInputElement).value) || 60 })"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Осенний сдвиг (мин)</label>
          <input
            type="number"
            class="form-input"
            :value="dstPolicy.autumn_shift_minutes"
            :disabled="isReadOnly"
            @input="updateDstPolicy({ autumn_shift_minutes: parseInt(($event.target as HTMLInputElement).value) || -60 })"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Tab5ReformsDstProps, Tab5ReformsDstEmits } from './Tab5ReformsDst.model';
import { useTab5ReformsDst } from './useTab5ReformsDst';

const props = defineProps<Tab5ReformsDstProps>();
const emit = defineEmits<Tab5ReformsDstEmits>();

const {
  reforms,
  dstPolicy,
  updateDstPolicy,
  addReform,
  removeReform,
  toggleDst,
} = useTab5ReformsDst(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/Tab5ReformsDst.css"></style>
