<template>
  <div class="section-card">
    <div class="section-header">
      <div>
        <div class="section-title">🏛️ Эпохи и Эры календаря</div>
        <div class="section-desc">Исторические эпохи культуры, обратный отсчет «до н.э.» и даты смены царствований.</div>
      </div>
      <button
        v-if="!isReadOnly"
        type="button"
        class="btn-ghost-sm"
        @click="$emit('add-era')"
      >
        + Добавить эпоху
      </button>
    </div>

    <!-- Список эпох с расширенными параметрами -->
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <div
        v-for="(era, idx) in eras"
        :key="idx"
        class="era-card"
        style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px;"
      >
        <div style="display: flex; gap: 10px; align-items: center;">
          <input
            v-model="era.название"
            type="text"
            class="table-input"
            style="font-weight: 600; flex: 2;"
            placeholder="Название эры (напр. Наша эра, Эра Дракона)..."
            :disabled="isReadOnly"
            @input="$emit('update-eras', [...eras])"
          />
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 11px; color: var(--text-muted)">С года:</span>
            <input
              v-model.number="era.год_начала"
              type="number"
              class="table-input"
              style="width: 70px;"
              :disabled="isReadOnly"
              @input="$emit('update-eras', [...eras])"
            />
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 11px; color: var(--text-muted)">По год:</span>
            <input
              v-model.number="era.год_конца"
              type="number"
              class="table-input"
              style="width: 70px;"
              :disabled="isReadOnly"
              @input="$emit('update-eras', [...eras])"
            />
          </div>
          <div style="display: flex; gap: 4px;">
            <button
              v-if="!isReadOnly"
              type="button"
              class="btn-icon-table"
              :disabled="idx === 0"
              title="Вверх"
              @click="$emit('reorder-era', idx, -1)"
            >
              ↑
            </button>
            <button
              v-if="!isReadOnly"
              type="button"
              class="btn-icon-table"
              :disabled="idx === eras.length - 1"
              title="Вниз"
              @click="$emit('reorder-era', idx, 1)"
            >
              ↓
            </button>
            <button
              v-if="!isReadOnly && eras.length > 1"
              type="button"
              class="btn-icon-table"
              title="Удалить эпоху"
              @click="$emit('remove-era', idx)"
            >
              🗑️
            </button>
          </div>
        </div>

        <div style="display: flex; gap: 16px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-subtle); flex-wrap: wrap; font-size: 12px;">
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;" :style="{ color: era.обратный_отсчет ? 'var(--accent-warning)' : 'var(--accent-success)' }">
            <input
              type="checkbox"
              :checked="era.обратный_отсчет"
              :disabled="isReadOnly"
              style="accent-color: var(--accent-warning);"
              @change="era.обратный_отсчет = ($event.target as HTMLInputElement).checked; $emit('update-eras', [...eras])"
            />
            <span>{{ era.обратный_отсчет ? '⬅️ Обратный отсчет (годы убывают: 500 до н.э. → 1 до н.э.)' : '➡️ Прямой отсчет (1 н.э. → 2026 н.э.)' }}</span>
          </label>

          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <input
              type="checkbox"
              :checked="era.has_anniversary"
              :disabled="isReadOnly"
              @change="era.has_anniversary = ($event.target as HTMLInputElement).checked; $emit('update-eras', [...eras])"
            />
            <span>📅 Смена эры в конкретный исторический день (по годовщине)</span>
          </label>

          <div v-if="era.has_anniversary" style="display: inline-flex; gap: 6px; align-items: center;">
            <span style="color: var(--text-muted)">Месяц:</span>
            <select
              v-model.number="era.anniversary_month"
              class="form-select"
              style="padding: 2px 6px; font-size: 11px;"
              :disabled="isReadOnly"
              @change="$emit('update-eras', [...eras])"
            >
              <option v-for="(m, mIdx) in months" :key="mIdx" :value="mIdx">
                {{ m.название || `Месяц ${mIdx + 1}` }}
              </option>
            </select>
            <span style="color: var(--text-muted)">День:</span>
            <input
              v-model.number="era.anniversary_day"
              type="number"
              class="form-input"
              style="width: 50px; padding: 2px 6px; font-size: 11px;"
              min="1"
              max="31"
              :disabled="isReadOnly"
              @input="$emit('update-eras', [...eras])"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tab2ErasSectionProps, Tab2ErasSectionEmits } from './Tab2ErasSection.model';

defineProps<Tab2ErasSectionProps>();

defineEmits<Tab2ErasSectionEmits>();
</script>
