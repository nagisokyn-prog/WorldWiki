<template>
  <div class="section-card">
    <div class="section-header">
      <div>
        <div class="section-title">📜 Исторические реформы календаря (Смена стиля и переход)</div>
        <div class="section-desc">
          Смена стиля или переход культуры с одного календаря на другой в ходе истории. Все даты разных стилей согласованы по единой шкале времени.
        </div>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <span class="status-chip success">✓ 2 активных стиля</span>
        <span class="status-chip warning">{{ modeBadgeText }}</span>
      </div>
    </div>

    <!-- Быстрые исторические пресеты -->
    <div class="form-group" style="margin-bottom: 14px;">
      <label class="form-label">Готовые исторические и фэнтези-пресеты реформ:</label>
      <div class="chip-list">
        <button
          v-for="p in presets"
          :key="p.key"
          type="button"
          class="preset-chip"
          :class="{ active: activePreset === p.key }"
          :disabled="isReadOnly"
          @click="$emit('select-preset', p.key)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <!-- Режимы перехода (3 радио-карточки) -->
    <div class="form-group" style="margin-bottom: 14px;">
      <label class="form-label">Способ перехода и смены стиля:</label>
      <div class="grid-3">
        <div
          v-for="c in modeCards"
          :key="c.mode"
          class="era-card"
          :class="{ active: mode === c.mode }"
          style="cursor: pointer; padding: 12px; border-radius: var(--radius-md);"
          @click="!isReadOnly && $emit('update-mode', c.mode)"
        >
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <input type="radio" :checked="mode === c.mode" :disabled="isReadOnly" />
            <strong :style="{ color: c.mode === 'gap' ? 'var(--accent-primary)' : 'inherit', fontSize: '13px' }">
              {{ c.icon }} {{ c.title }}
            </strong>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); line-height: 1.4;">{{ c.desc }}</div>
        </div>
      </div>
    </div>

    <!-- Параметры выбранного режима -->
    <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; margin-bottom: 14px;">
      <div v-if="mode === 'gap'" class="grid-3" style="align-items: end;">
        <div class="form-group">
          <label class="form-label">Последний день старого стиля (O.S.)</label>
          <div style="display: flex; gap: 6px; align-items: center;">
            <input type="number" class="form-input" :value="gapParams.oldDay" min="1" max="31" style="width: 65px;" :disabled="isReadOnly" @input="$emit('update-gap', { oldDay: +($event.target as HTMLInputElement).value })" />
            <select class="form-select" :value="gapParams.oldMonth" style="min-width: 130px;" :disabled="isReadOnly" @change="$emit('update-gap', { oldMonth: +($event.target as HTMLSelectElement).value })">
              <option v-for="(m, i) in monthNames" :key="i" :value="i + 1">{{ i + 1 }}. {{ m }}</option>
            </select>
            <input type="number" class="form-input" :value="gapParams.oldYear" style="width: 80px;" :disabled="isReadOnly" @input="$emit('update-gap', { oldYear: +($event.target as HTMLInputElement).value })" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Количество пропущенных дней</label>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="number" class="form-input" :value="gapParams.droppedDays" min="1" max="365" style="width: 90px;" :disabled="isReadOnly" @input="$emit('update-gap', { droppedDays: +($event.target as HTMLInputElement).value })" />
            <span style="font-size: 12px; color: var(--text-muted);">дней стёрто</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Первый день нового стиля (N.S.)</label>
          <div style="display: flex; gap: 6px; align-items: center;">
            <input type="text" class="form-input" :value="newStyleFirstDayStr" readonly style="color: var(--accent-primary); font-weight: 600; flex: 1;" />
            <span class="status-chip success" style="font-size: 11px;">Пятница</span>
          </div>
        </div>
      </div>

      <div v-else-if="mode === 'transitional'" class="grid-2">
        <div class="form-group">
          <label class="form-label">Номер переходного года (transitional_year)</label>
          <input type="number" class="form-input" :value="transParams.transitionalYear" :disabled="isReadOnly" @input="$emit('update-trans', { transitionalYear: +($event.target as HTMLInputElement).value })" />
        </div>
        <div class="form-group">
          <label class="form-label">Добавлено / вычтено дней</label>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="number" class="form-input" :value="transParams.addedDays" style="width: 100px;" :disabled="isReadOnly" @input="$emit('update-trans', { addedDays: +($event.target as HTMLInputElement).value })" />
            <span style="font-size: 12px; color: var(--text-muted);">дн. (Длина года: {{ 355 + transParams.addedDays }} дн.)</span>
          </div>
        </div>
      </div>

      <div v-else class="grid-2">
        <div class="form-group">
          <label class="form-label">Дата наступления Новой Эры</label>
          <div style="display: flex; gap: 6px; align-items: center;">
            <input type="number" class="form-input" :value="resetParams.resetDay" min="1" max="31" style="width: 65px;" :disabled="isReadOnly" @input="$emit('update-reset', { resetDay: +($event.target as HTMLInputElement).value })" />
            <select class="form-select" :value="resetParams.resetMonth" style="min-width: 130px;" :disabled="isReadOnly" @change="$emit('update-reset', { resetMonth: +($event.target as HTMLSelectElement).value })">
              <option v-for="(m, i) in monthNames" :key="i" :value="i + 1">{{ i + 1 }}. {{ m }}</option>
            </select>
            <input type="number" class="form-input" :value="resetParams.resetYearOld" style="width: 80px;" :disabled="isReadOnly" @input="$emit('update-reset', { resetYearOld: +($event.target as HTMLInputElement).value })" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Номер начального года новой эры</label>
          <input type="number" class="form-input" :value="resetParams.resetToYear" min="0" :disabled="isReadOnly" @input="$emit('update-reset', { resetToYear: +($event.target as HTMLInputElement).value })" />
        </div>
      </div>
    </div>

    <!-- Визуальная лента времени -->
    <div style="background: var(--bg-surface-elevated); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md); padding: 14px; margin-bottom: 14px;">
      <div style="font-size: 12px; font-weight: 600; color: var(--text-dim); margin-bottom: 10px;">
        🔍 Визуальная лента времени в момент реформы:
      </div>
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px;">
        <span class="status-chip success" style="padding: 6px 10px;">{{ visualTapeStart }}</span>
        <span style="color: var(--accent-warning); font-weight: 700;">➡️</span>
        <span class="status-chip" :class="mode === 'gap' ? 'danger' : 'warning'" style="padding: 6px 10px;">{{ visualTapeMiddle }}</span>
        <span style="color: var(--accent-success); font-weight: 700;">➡️</span>
        <span class="status-chip success" style="padding: 6px 10px;">{{ visualTapeEnd }}</span>
      </div>
    </div>

    <!-- Интерактивный калькулятор двойной датировки -->
    <Tab5DualDatingCard
      :month-names="monthNames"
      :dual-dating-input="dualDatingInput"
      :dual-dating-result="dualDatingResult"
      :is-read-only="isReadOnly"
      @update-dual-input="$emit('update-dual-input', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { Tab5ReformsSectionProps, Tab5ReformsSectionEmits } from './Tab5ReformsSection.model';
import type {
  DualDatingInput,
  DualDatingResult,
  GapReformParams,
  ReformMode,
  ReformPresetKey,
  ResetReformParams,
  TransitionalReformParams,
} from '../Tab5ReformsDst.model';
import Tab5DualDatingCard from './Tab5DualDatingCard.vue';

defineProps<Tab5ReformsSectionProps>();

defineEmits<Tab5ReformsSectionEmits>();

const modeCards = [
  { mode: 'gap' as ReformMode, icon: '🕳️', title: 'Выброшенные дни (Gap)', desc: 'Скачок дат без разрыва дней недели. Например, после четверга 4 октября сразу пятница 15 октября.' },
  { mode: 'transitional' as ReformMode, icon: '⏳', title: 'Переходный год (Transitional)', desc: 'Один конкретный год удлиняется или сокращается интеркалярными месяцами/днями.' },
  { mode: 'reset' as ReformMode, icon: '🔄', title: 'Новая Эра (EpochReset)', desc: 'В момент реформы номер года обнуляется (Год 1 Новой Эры), привязываясь к M_abs.' },
];
</script>
