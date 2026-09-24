<template>
  <div class="promise-card-meta p-2.5 bg-surface-subtle border-b border-subtle flex flex-col gap-2 text-xs">
    <!-- 1. Верхняя строка: Выбор типа блока и абзац -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-1.5 flex-1 min-w-0">
        <label class="text-[11px] text-muted font-medium">Тип:</label>
        <select
          :value="item.kind"
          class="kind-select py-0.5 px-1.5 bg-input border border-border rounded text-xs text-main font-semibold"
          @change="updateKind(($event.target as HTMLSelectElement).value)"
        >
          <option value="scene">🎬 Сцена / Эпизод</option>
          <option value="gun">🔫 Чеховское ружьё</option>
          <option value="conflict">⚔️ Конфликт</option>
          <option value="mystery">🔮 Тайна / Загадка</option>
          <option value="foreshadowing">🌿 Предзнаменование</option>
          <option value="question">❓ Сюжетный вопрос</option>
        </select>
      </div>

      <span v-if="item.block_id" class="badge-block font-mono text-[10px] text-muted py-0.5 px-1 bg-panel rounded border border-border">
        🧱 {{ item.block_id }}
      </span>
    </div>

    <!-- 2. Локация (Гибридный ввод: Сущность ИЛИ произвольный текст) -->
    <div class="flex items-center gap-1.5">
      <span class="text-accent text-[11px]" title="Локация действия">📍</span>
      <input
        v-model="locationDraft"
        type="text"
        :list="`locations-list-${item.id || 'new'}`"
        placeholder="Локация (выберите или введите текст)..."
        class="flex-1 py-0.5 px-2 bg-input border border-border rounded text-xs text-main placeholder:text-muted"
        @blur="saveLocation"
        @keydown.enter="saveLocation"
      />
      <datalist :id="`locations-list-${item.id || 'new'}`">
        <option v-for="loc in projectLocations" :key="loc.id" :value="loc.name">
          {{ loc.name }} (сущность)
        </option>
      </datalist>
    </div>

    <!-- 3. Участники сцены/блока -->
    <div class="flex flex-col gap-1">
      <div class="flex items-center justify-between text-[11px] text-muted">
        <span class="flex items-center gap-1">
          <span>👥</span>
          <span>Участники сцены:</span>
        </span>
        <button
          class="btn-add-part text-accent hover:underline text-[10px]"
          @click="isAddingParticipant = !isAddingParticipant"
        >
          {{ isAddingParticipant ? '✕ Отмена' : '＋ Добавить' }}
        </button>
      </div>

      <!-- Чипы активных участников -->
      <div class="flex flex-wrap gap-1 items-center">
        <div
          v-for="pid in (item.participant_ids || [])"
          :key="pid"
          class="participant-chip flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-panel border border-border text-main"
        >
          <span>👤</span>
          <span class="font-medium">{{ pid.replace(/^entities:/, '') }}</span>
          <button
            class="chip-remove text-muted hover:text-danger ml-0.5 text-[10px]"
            title="Удалить из сцены"
            @click.stop="removeParticipant(pid)"
          >
            ×
          </button>
        </div>

        <span v-if="!item.participant_ids || item.participant_ids.length === 0" class="text-[11px] text-muted italic">
          Участники не указаны
        </span>
      </div>

      <!-- Поле быстрого добавления участника -->
      <div v-if="isAddingParticipant" class="flex items-center gap-1 mt-1">
        <input
          v-model="newParticipantDraft"
          type="text"
          :list="`chars-list-${item.id || 'new'}`"
          placeholder="Имя персонажа..."
          class="flex-1 py-0.5 px-2 bg-input border border-border rounded text-xs text-main"
          @keydown.enter.prevent="addParticipant(newParticipantDraft)"
        />
        <datalist :id="`chars-list-${item.id || 'new'}`">
          <option v-for="char in projectCharacters" :key="char.id" :value="char.name">
            {{ char.name }}
          </option>
        </datalist>
        <button
          class="px-2 py-0.5 bg-primary text-white text-xs rounded font-medium disabled:opacity-50"
          :disabled="!newParticipantDraft.trim()"
          @click="addParticipant(newParticipantDraft)"
        >
          ✓
        </button>
      </div>
    </div>

    <!-- 4. Привязка к событию таймлайна (Diegetic-время / M_abs) -->
    <div class="flex items-center gap-1.5">
      <span class="text-warning text-[11px]" title="Событие таймлайна">⏱️</span>
      <select
        :value="item.timeline_event_id || ''"
        class="flex-1 py-0.5 px-1.5 bg-input border border-border rounded text-xs text-main"
        @change="updateTimelineEvent(($event.target as HTMLSelectElement).value || null)"
      >
        <option value="">-- Без привязки к таймлайну --</option>
        <option v-for="ev in projectTimelineEvents" :key="ev.id" :value="ev.id">
          {{ ev.title }} {{ ev.m_abs !== undefined ? `(M: ${ev.m_abs})` : '' }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePromiseCardMeta } from './usePromiseCardMeta';
import type { PromiseCardMetaProps, PromiseCardMetaEmits } from './PromiseCardMeta.model';

const props = defineProps<PromiseCardMetaProps>();
const emit = defineEmits<PromiseCardMetaEmits>();

const {
  locationDraft,
  newParticipantDraft,
  isAddingParticipant,
  projectLocations,
  projectCharacters,
  projectTimelineEvents,
  saveLocation,
  addParticipant,
  removeParticipant,
  updateTimelineEvent,
  updateKind
} = usePromiseCardMeta(props, emit);
</script>

<style scoped>
.promise-card-meta {
  background: var(--bg-sunken);
  border-color: var(--border-color);
}

.kind-select {
  outline: none;
}

.participant-chip {
  background: var(--bg-panel);
  border-color: var(--border-color);
}

.chip-remove {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.btn-add-part {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
</style>
