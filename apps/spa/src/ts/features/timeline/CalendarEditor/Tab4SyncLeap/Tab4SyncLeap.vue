<template>
  <div class="tab4-sync-leap">
    <!-- Секция: Високосные правила -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">⚡ Високосное правило</div>
          <div class="section-desc">Компенсация дробного периода обращения планеты.</div>
        </div>
        <span class="drift-badge drift-ok">-0.03 сут/век</span>
      </header>

      <div class="chip-list">
        <button
          type="button"
          class="preset-chip"
          :class="{ active: leapSettings.тип_правила === 'григорианское' }"
          :disabled="isReadOnly"
          @click="setRuleType('григорианское')"
        >
          🌍 Григорианское
        </button>
        <button
          type="button"
          class="preset-chip"
          :class="{ active: leapSettings.тип_правила === 'каждый 4 год' }"
          :disabled="isReadOnly"
          @click="setRuleType('каждый 4 год')"
        >
          Юлианское (каждый 4-й)
        </button>
        <button
          type="button"
          class="preset-chip"
          :class="{ active: leapSettings.тип_правила === 'пользовательское' }"
          :disabled="isReadOnly"
          @click="setRuleType('пользовательское')"
        >
          ⚙️ Кастомное
        </button>
        <button
          type="button"
          class="preset-chip"
          :class="{ active: leapSettings.тип_правила === 'отсутствует' }"
          :disabled="isReadOnly"
          @click="setRuleType('отсутствует')"
        >
          Отсутствует
        </button>
      </div>

      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Интервал високоса (лет)</label>
          <input
            type="number"
            class="form-input"
            :value="leapSettings.интервал || 4"
            :disabled="isReadOnly"
            min="1"
            @input="updateLeapSettings({ интервал: parseInt(($event.target as HTMLInputElement).value) || 4 })"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Дней добавлять в високос</label>
          <input
            type="number"
            class="form-input"
            :value="leapSettings.дней_добавлять || 1"
            :disabled="isReadOnly"
            min="1"
            @input="updateLeapSettings({ дней_добавлять: parseInt(($event.target as HTMLInputElement).value) || 1 })"
          />
        </div>
      </div>
    </section>

    <!-- Секция: Синхронизация с Мастер-календарем -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">🔗 Синхронизация (Якорь)</div>
          <div class="section-desc">Привязка шкалы времени к Master Calendar.</div>
        </div>
      </header>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">ID Мастер-календаря</label>
          <input
            type="text"
            class="form-input"
            :value="syncAnchor?.master_calendar_id || ''"
            :disabled="isReadOnly"
            placeholder="master_calendar_id"
            @input="updateSyncAnchor({ master_calendar_id: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Tab4SyncLeapProps, Tab4SyncLeapEmits } from './Tab4SyncLeap.model';
import { useTab4SyncLeap } from './useTab4SyncLeap';

const props = defineProps<Tab4SyncLeapProps>();
const emit = defineEmits<Tab4SyncLeapEmits>();

const {
  leapSettings,
  syncAnchor,
  updateLeapSettings,
  setRuleType,
  updateSyncAnchor,
} = useTab4SyncLeap(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/Tab4SyncLeap.css"></style>
