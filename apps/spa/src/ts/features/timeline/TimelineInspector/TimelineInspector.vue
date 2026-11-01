<template>
  <div class="inspector-container">
    <!-- Тулбар управления -->
    <div class="inspector-toolbar">
      <div class="inspector-toolbar-title">
        <h2 class="inspector-title">
          <span class="inspector-icon">⏳</span> Хронологический Инспектор
        </h2>
        <span v-if="filteredEvents.length" class="inspector-badge">
          {{ filteredEvents.length }} событий / {{ filteredChapters.length }} глав
        </span>
      </div>

      <div class="inspector-toolbar-controls">
        <!-- Переключатель режима горизонтов -->
        <div class="inspector-control-group">
          <span class="control-label">Режим:</span>
          <select
            v-model="filters.readerHorizonChapterOrder"
            class="inspector-select"
          >
            <option :value="null">👑 Режим Автора (Все главы)</option>
            <option
              v-for="ch in filteredChapters"
              :key="'opt-' + ch.id"
              :value="ch.sort_order"
            >
              📖 Горизонт: До Главы #{{ ch.sort_order }}
            </option>
          </select>
        </div>

        <label class="inspector-checkbox-label">
          <input v-model="filters.showFlashbacksOnly" type="checkbox" class="inspector-checkbox" />
          <span>Только ретроспективы (Flashbacks)</span>
        </label>

        <button
          class="btn-refresh"
          :disabled="isLoading"
          @click="refresh"
        >
          🔄 {{ isLoading ? 'Загрузка...' : 'Обновить' }}
        </button>
      </div>
    </div>

    <!-- Область визуализации осей -->
    <div class="inspector-viewport">
      <div v-if="isLoading && !filteredEvents.length" class="inspector-empty">
        <div class="empty-spinner">⏳</div>
        <p>Загрузка хронологических связей...</p>
      </div>

      <div v-else-if="!filteredEvents.length && !filteredChapters.length" class="inspector-empty">
        <div class="empty-icon">📂</div>
        <p>Нет связанных событий для отображения.</p>
        <span class="empty-hint">Привяжите события таймлайна к главам или создайте сцены с датами в редакторе.</span>
      </div>

      <div v-else class="dual-axis-canvas" :style="{ minWidth: canvasMinWidth }">
        <!-- Верхняя Нарративная Ось -->
        <div class="axis-track-wrapper narrative-wrapper">
          <div class="axis-badge axis-badge-narrative">
            <span>📚</span> ПОРЯДОК ЧТЕНИЯ ГЛАВ (НАРРАТИВ)
          </div>
          <div class="axis-rail axis-rail-narrative"></div>
          
          <div
            v-for="(ch, idx) in filteredChapters"
            :key="'ch-node-' + ch.id"
            class="chapter-node interactive-el"
            :style="{ left: (60 + idx * 135) + 'px' }"
            :title="`Кликните для перехода к главе: ${ch.title || 'Глава #' + (ch.sort_order || idx + 1)}`"
            @click="navigateToChapter(ch)"
          >
            <div class="chapter-pin-top"></div>
            <div class="chapter-badge">Гл. #{{ ch.sort_order || (idx + 1) }}</div>
            <div class="chapter-node-title" :title="ch.title">{{ ch.title || 'Без названия' }}</div>
            <div class="chapter-pin-bottom"></div>
          </div>
        </div>

        <!-- SVG Соединительные нити Безье -->
        <svg class="connection-svg" width="100%" height="100%">
          <defs>
            <marker id="arrow-direct" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 2 L 8 5 L 0 8 z" fill="var(--accent)" />
            </marker>
            <marker id="arrow-flashback" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 2 L 8 5 L 0 8 z" fill="var(--warning)" />
            </marker>
          </defs>

          <g v-for="line in connectionLines" :key="line.id">
            <path
              :d="`M ${line.x1} ${line.y1} C ${line.x1} ${(line.y1 + line.y2) / 2}, ${line.x2} ${(line.y1 + line.y2) / 2}, ${line.x2} ${line.y2}`"
              fill="none"
              :stroke="line.isFlashback ? 'var(--warning)' : 'var(--accent)'"
              stroke-width="2"
              :stroke-dasharray="line.isFlashback ? '5 4' : 'none'"
              :marker-end="line.isFlashback ? 'url(#arrow-flashback)' : 'url(#arrow-direct)'"
              class="connection-path"
            />
          </g>
        </svg>

        <!-- Нижняя Диегетическая Ось (Время мира) -->
        <div class="axis-track-wrapper diegetic-wrapper">
          <div class="axis-badge axis-badge-diegetic">
            <span>⏳</span> ВРЕМЯ МИРА (ХРОНОЛОГИЯ LORE)
          </div>
          <div class="axis-rail axis-rail-diegetic"></div>

          <div v-if="!formattedEvents.length" class="axis-empty-hint p-4 text-xs text-muted italic">
            <span>ℹ️ В главах пока нет связанных событий или сцен с датами</span>
          </div>

          <div
            v-for="(ev, idx) in formattedEvents"
            :key="'ev-node-' + ev.id"
            class="event-node interactive-el"
            :style="{ left: (60 + idx * 150) + 'px' }"
            :title="`Кликните для перехода к сцене в тексте: ${ev.title}`"
            @click="navigateToScene(ev)"
          >
            <div class="event-pin-top"></div>
            
            <div class="event-header">
              <span class="event-kind-badge" :class="ev.kindMeta.badgeClass">
                {{ ev.kindMeta.icon }} {{ ev.kindMeta.label }}
              </span>
            </div>

            <div class="event-node-title" :title="ev.title">
              {{ ev.title }}
            </div>

            <div class="event-meta-row">
              <span class="event-date-chip">
                <span class="date-icon">📅</span>
                <span class="date-text">{{ ev.formattedDate }}</span>
              </span>
              <span v-if="ev.location_id" class="event-location-chip" :title="ev.location_id">
                📍 {{ ev.location_id.replace(/^(entities|locations):/, '') }}
              </span>
            </div>

            <div v-if="ev.cleanParticipants.length" class="event-participants-list">
              <span
                v-for="p in ev.cleanParticipants.slice(0, 2)"
                :key="p.id"
                class="participant-chip"
                :title="p.name"
              >
                👤 {{ p.name }}
              </span>
              <span v-if="ev.cleanParticipants.length > 2" class="participant-more">
                +{{ ev.cleanParticipants.length - 2 }}
              </span>
            </div>

            <div class="event-pin-bottom"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTimelineInspector } from './useTimelineInspector';
import type { TimelineInspectorProps, TimelineInspectorEmits } from './TimelineInspector.model';

const props = withDefaults(defineProps<TimelineInspectorProps>(), {
  projectId: '',
  project: '',
});
const emit = defineEmits<TimelineInspectorEmits>();

const {
  filters,
  filteredChapters,
  formattedEvents,
  filteredEvents,
  connectionLines,
  canvasMinWidth,
  isLoading,
  refresh,
  navigateToChapter,
  navigateToScene,
} = useTimelineInspector(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/TimelineInspector.css"></style>

