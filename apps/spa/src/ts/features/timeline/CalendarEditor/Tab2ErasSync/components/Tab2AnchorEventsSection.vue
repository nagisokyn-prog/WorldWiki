<template>
  <div class="section-card">
    <div class="section-header">
      <div>
        <div class="section-title">⚔️ Опорные исторические события мира (Вехи)</div>
        <div class="section-desc">Ключевые даты, сквозь которые синхронизируются все хроники разных народов.</div>
      </div>
      <button
        v-if="!isReadOnly"
        type="button"
        class="btn-ghost-sm"
        @click="showAddRow = true"
      >
        + Добавить веху
      </button>
    </div>

    <!-- Интерактивная таблица опорных событий (Пункт 11) -->
    <table v-if="anchorEvents.length > 0" class="items-table" style="margin-bottom: 12px;">
      <thead>
        <tr>
          <th>Название события (вехи)</th>
          <th style="width: 90px;">Год</th>
          <th style="width: 75px;">Месяц</th>
          <th style="width: 75px;">День</th>
          <th>Описание / исторический контекст</th>
          <th style="width: 45px;"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(ev, idx) in anchorEvents" :key="ev.id ? `${ev.id}_${idx}` : `ev_idx_${idx}`">
          <td>
            <input
              type="text"
              class="table-input"
              style="font-weight: 600;"
              :value="ev.name"
              :disabled="isReadOnly"
              @input="onFieldChange(idx, 'name', ($event.target as HTMLInputElement).value)"
            />
          </td>
          <td>
            <input
              type="number"
              class="table-input"
              :value="ev.year"
              :disabled="isReadOnly"
              @input="onFieldChange(idx, 'year', parseInt(($event.target as HTMLInputElement).value) || 0)"
            />
          </td>
          <td>
            <input
              type="number"
              class="table-input"
              min="1"
              max="60"
              :value="(ev.month !== undefined ? ev.month + 1 : 1)"
              :disabled="isReadOnly"
              @input="onFieldChange(idx, 'month', (parseInt(($event.target as HTMLInputElement).value) || 1) - 1)"
            />
          </td>
          <td>
            <input
              type="number"
              class="table-input"
              min="1"
              max="60"
              :value="ev.day ?? 1"
              :disabled="isReadOnly"
              @input="onFieldChange(idx, 'day', parseInt(($event.target as HTMLInputElement).value) || 1)"
            />
          </td>
          <td>
            <input
              type="text"
              class="table-input"
              placeholder="Краткое описание..."
              :value="ev.description ?? ''"
              :disabled="isReadOnly"
              @input="onFieldChange(idx, 'description', ($event.target as HTMLInputElement).value)"
            />
          </td>
          <td>
            <button
              v-if="!isReadOnly"
              type="button"
              class="btn-icon-table"
              title="Удалить веху"
              @click="$emit('remove-anchor-event', idx)"
            >
              🗑️
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="text-sm text-muted" style="padding: 12px 0;">
      Опорные исторические события мира пока не добавлены.
    </div>

    <!-- Форма добавления нового опорного события -->
    <div
      v-if="showAddRow && !isReadOnly"
      style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px; background: var(--bg-surface); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);"
    >
      <div style="font-size: 12px; font-weight: 600; color: var(--accent-primary);">
        ➕ Новая историческая веха
      </div>
      <div class="grid-4" style="gap: 8px;">
        <input
          v-model="newEventName"
          type="text"
          class="form-input"
          placeholder="Название (напр. Падение Империи)..."
          @keydown.enter="submitNewEvent"
        />
        <input
          v-model.number="newEventYear"
          type="number"
          class="form-input"
          placeholder="Год события"
          @keydown.enter="submitNewEvent"
        />
        <input
          v-model.number="newEventMonth"
          type="number"
          class="form-input"
          min="1"
          placeholder="Месяц (1..12)"
          @keydown.enter="submitNewEvent"
        />
        <input
          v-model.number="newEventDay"
          type="number"
          class="form-input"
          min="1"
          placeholder="День (1..31)"
          @keydown.enter="submitNewEvent"
        />
      </div>
      <input
        v-model="newEventDesc"
        type="text"
        class="form-input"
        placeholder="Описание и исторический контекст..."
        @keydown.enter="submitNewEvent"
      />
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button
          type="button"
          class="btn-ghost-sm"
          @click="showAddRow = false"
        >
          Отмена
        </button>
        <button
          type="button"
          class="btn-action btn-primary"
          style="padding: 4px 12px;"
          @click="submitNewEvent"
        >
          Сохранить веху
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { AnchorEventDto } from '../Tab2ErasSync.model';
import type { Tab2AnchorEventsSectionProps, Tab2AnchorEventsSectionEmits } from './Tab2AnchorEventsSection.model';

const props = defineProps<Tab2AnchorEventsSectionProps>();

const emit = defineEmits<Tab2AnchorEventsSectionEmits>();

const showAddRow = ref(false);
const newEventName = ref('');
const newEventYear = ref<number | null>(null);
const newEventMonth = ref<number | null>(1);
const newEventDay = ref<number | null>(1);
const newEventDesc = ref('');

function onFieldChange(idx: number, field: keyof AnchorEventDto, value: unknown) {
  const current = props.anchorEvents[idx];
  if (!current) return;
  const updated: AnchorEventDto = { ...current, [field]: value };
  emit('update-anchor-event', idx, updated);
}

function submitNewEvent() {
  const trimmed = newEventName.value.trim();
  if (!trimmed || newEventYear.value === null) return;
  emit('add-anchor-event', {
    id: `ev_${Date.now()}`,
    name: trimmed,
    year: newEventYear.value,
    month: (newEventMonth.value ?? 1) - 1,
    day: newEventDay.value ?? 1,
    description: newEventDesc.value.trim() || undefined,
  });
  newEventName.value = '';
  newEventYear.value = null;
  newEventMonth.value = 1;
  newEventDay.value = 1;
  newEventDesc.value = '';
  showAddRow.value = false;
}
</script>
