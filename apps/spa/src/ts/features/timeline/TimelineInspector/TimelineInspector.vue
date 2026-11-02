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
        <!-- Режим связей стрелками -->
        <div class="inspector-control-group">
          <span class="control-label">Связи:</span>
          <select v-model="filters.linkMode" class="inspector-select">
            <option value="focus">🎯 Фокус (при наведении / клике)</option>
            <option value="all">🕸️ Все связи (паутина)</option>
            <option value="none">🚫 Без связей</option>
          </select>
        </div>

        <!-- Изоляция сцен главы -->
        <div class="inspector-control-group">
          <span class="control-label">Сцены:</span>
          <select v-model="filters.isolatedChapterId" class="inspector-select">
            <option :value="null">Все сцены рукописи</option>
            <option
              v-for="ch in filteredChapters"
              :key="'iso-' + ch.id"
              :value="ch.id"
            >
              {{ ch.title }} ({{ ch.sceneCount || 0 }} сцен)
            </option>
          </select>
        </div>

        <!-- Переключатель режима горизонтов читателя -->
        <div class="inspector-control-group">
          <span class="control-label">Горизонт:</span>
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
              📖 До: {{ ch.title }}
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
        <!-- Верхняя Нарративная Ось (Порядок глав) -->
        <div class="axis-track-wrapper narrative-wrapper">
          <div class="axis-badge axis-badge-narrative">
            <span>📚</span> ПОРЯДОК ЧТЕНИЯ ГЛАВ (НАРРАТИВ)
          </div>
          <div class="axis-rail axis-rail-narrative"></div>
          
          <div
            v-for="(ch, idx) in filteredChapters"
            :key="'ch-node-' + ch.id"
            :data-chapter-id="normalizeId(ch.id)"
            class="chapter-node interactive-el"
            :class="{
              'chapter-node--active': activeChapterId === normalizeId(ch.id),
              'chapter-node--has-flashback': (ch.flashbackCount || 0) > 0
            }"
            :style="{ left: (60 + idx * 140) + 'px' }"
            @click="selectChapter(ch)"
            @mouseenter="hoveredChapterId = ch.id"
            @mouseleave="hoveredChapterId = null"
          >
            <div class="chapter-pin-top"></div>
            
            <div class="chapter-node-header">
              <span class="chapter-badge">Гл. #{{ ch.sort_order }}</span>
              <span v-if="ch.sceneCount !== undefined" class="chapter-scene-count" :title="`Сцен в главе: ${ch.sceneCount}`">
                🎬 {{ ch.sceneCount }}
              </span>
            </div>

            <div class="chapter-node-title" :title="ch.title">
              {{ ch.title }}
            </div>

            <!-- Бейдж-радар прыжка к флешбэку -->
            <div
              v-if="(ch.flashbackCount || 0) > 0"
              class="chapter-flashback-badge"
              :title="`В этой главе ${ch.flashbackCount} флешбэк(а). Кликните, чтобы прыгнуть к сцене в прошлом`"
              @click.stop="jumpToFlashback(ch, $event)"
            >
              ⏪ Флешбэк ({{ ch.flashbackCount }})
            </div>

            <div class="chapter-node-actions">
              <button
                class="chapter-action-btn"
                title="Открыть главу в редакторе"
                @click.stop="navigateToChapter(ch)"
              >
                ✏️
              </button>
            </div>

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
              stroke-width="2.5"
              :stroke-dasharray="line.isFlashback ? '5 4' : 'none'"
              :marker-end="line.isFlashback ? 'url(#arrow-flashback)' : 'url(#arrow-direct)'"
              class="connection-path"
              :class="{ 'connection-path--flashback': line.isFlashback }"
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
            <span>ℹ️ В выбранном горизонте нет связанных событий или сцен</span>
          </div>

          <div
            v-for="(ev, idx) in formattedEvents"
            :key="'ev-node-' + ev.id"
            :data-event-id="normalizeId(ev.id)"
            class="event-node interactive-el"
            :class="{
              'event-node--active': isEventHighlighted(ev),
              'event-node--dimmed': isEventDimmed(ev),
              'event-node--ping': pingedEventId === normalizeId(ev.id),
              'event-node--flashback': ev.isFlashback,
            }"
            :style="{ left: (60 + idx * 160) + 'px' }"
            :title="`Кликните для перехода к сцене в тексте: ${ev.title}`"
            @mouseenter="hoveredEventId = ev.id"
            @mouseleave="hoveredEventId = null"
            @click="navigateToScene(ev)"
          >
            <div class="event-pin-top"></div>
            
            <div class="event-header">
              <span class="event-kind-badge" :class="ev.kindMeta.badgeClass">
                {{ ev.kindMeta.icon }} {{ ev.kindMeta.label }}
              </span>
              <span v-if="ev.isFlashback" class="flashback-tag" title="Сцена разворачивается как воспоминание / ретроспектива">
                ⏪ Флешбэк
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

            <!-- Кнопка возврата к нарративу главы -->
            <div
              v-if="ev.primaryChapterId"
              class="event-jump-back"
              :title="`Показать главу на верхней оси`"
              @click.stop="scrollToChapter(ev.primaryChapterId)"
            >
              <span>Верхняя ось: {{ ev.primaryChapterTitle || ('Гл. #' + ev.primaryChapterId) }} ⏩</span>
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
  activeChapterId,
  hoveredChapterId,
  hoveredEventId,
  pingedEventId,
  refresh,
  navigateToChapter,
  navigateToScene,
  selectChapter,
  jumpToFlashback,
  scrollToChapter,
  isEventHighlighted,
  isEventDimmed,
  normalizeId,
} = useTimelineInspector(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/TimelineInspector.css"></style>
