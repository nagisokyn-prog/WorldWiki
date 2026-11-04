<template>
  <div class="inspector-container">
    <TimelineInspectorToolbar
      :filters="filters"
      :filtered-events-count="filteredEvents.length"
      :filtered-chapters-count="filteredChapters.length"
      :filtered-chapters="filteredChapters"
      :volume-options="volumeOptions"
      :is-loading="isLoading"
      @refresh="refresh"
    />

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
          <div class="axis-badge axis-badge-narrative"><span>📚</span> ПОРЯДОК ЧТЕНИЯ ГЛАВ (НАРРАТИВ)</div>

          <div
            v-for="seg in volumeSegments"
            :key="'vol-seg-' + seg.volumeId + '-' + seg.startIndex"
            class="timeline-volume-bracket"
            :style="{ left: seg.leftPx + 'px', width: seg.widthPx + 'px' }"
          >
            <div class="bracket-arm bracket-arm-left"></div>
            <div class="bracket-pill" :title="`Том: ${seg.volumeTitle} (${seg.count} гл.)`">
              <span class="vol-icon">📚</span>
              <span class="vol-name">{{ seg.volumeTitle }}</span>
              <span class="vol-count">({{ seg.count }} гл.)</span>
            </div>
            <div class="bracket-arm bracket-arm-right"></div>
          </div>

          <div
            v-for="seg in volumeSegments.filter(s => s.boundaryLeftPx !== undefined)"
            :key="'vol-bound-' + seg.volumeId"
            class="timeline-volume-boundary-marker"
            :style="{ left: seg.boundaryLeftPx + 'px' }"
            :title="`Граница между томами: переход к «${seg.volumeTitle}»`"
          >
            <div class="boundary-line"></div>
            <div class="boundary-dot"></div>
          </div>

          <div class="axis-rail axis-rail-narrative"></div>

          <TimelineChapterNode
            v-for="(ch, idx) in filteredChapters"
            :key="'ch-node-' + ch.id"
            :chapter="ch"
            :index="idx"
            :is-active="activeChapterId === normalizeId(ch.id)"
            @select="selectChapter"
            @navigate="navigateToChapter"
            @jump-flashback="jumpToFlashback"
            @set-hover="hoveredChapterId = $event"
          />
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

        <!-- Нижняя Диегетическая Ось -->
        <div class="axis-track-wrapper diegetic-wrapper">
          <div class="axis-badge axis-badge-diegetic"><span>⏳</span> ВРЕМЯ МИРА (ХРОНОЛОГИЯ LORE)</div>
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
              <span class="event-kind-badge" :class="ev.kindMeta.badgeClass">{{ ev.kindMeta.icon }} {{ ev.kindMeta.label }}</span>
              <span v-if="ev.isFlashback" class="flashback-tag" title="Сцена разворачивается как воспоминание / ретроспектива">⏪ Флешбэк</span>
            </div>
            <div class="event-node-title" :title="ev.title">{{ ev.title }}</div>
            <div class="event-meta-row">
              <span class="event-date-chip"><span class="date-icon">📅</span><span class="date-text">{{ ev.formattedDate }}</span></span>
              <span v-if="ev.location_id" class="event-location-chip" :title="ev.localTimeHint || ev.locationName || ev.location_id">
                📍 {{ ev.locationName || ev.location_id.replace(/^(entities|locations):/, '') }}
              </span>
              <span v-if="ev.localTimeBadge" class="event-date-chip" :title="ev.localTimeHint || ''">
                <span>{{ ev.localTimeBadge }}</span>
                <span v-if="ev.hasTimezoneDiscrepancy" title="Разница часового пояса локации с мировым временем">⚠️</span>
              </span>
            </div>
            <div v-if="ev.cleanParticipants.length" class="event-participants-list">
              <span v-for="p in ev.cleanParticipants.slice(0, 2)" :key="p.id" class="participant-chip" :title="p.name">👤 {{ p.name }}</span>
              <span v-if="ev.cleanParticipants.length > 2" class="participant-more">+{{ ev.cleanParticipants.length - 2 }}</span>
            </div>
            <div v-if="ev.primaryChapterId" class="event-jump-back" title="Показать главу на верхней оси" @click.stop="scrollToChapter(ev.primaryChapterId)">
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
import TimelineInspectorToolbar from './components/TimelineInspectorToolbar.vue';
import TimelineChapterNode from './components/TimelineChapterNode.vue';
import type { TimelineInspectorProps, TimelineInspectorEmits } from './TimelineInspector.model';

const props = withDefaults(defineProps<TimelineInspectorProps>(), { projectId: '', project: '' });
const emit = defineEmits<TimelineInspectorEmits>();

const {
  filters, volumeOptions, volumeSegments, filteredChapters, formattedEvents, filteredEvents,
  connectionLines, canvasMinWidth, isLoading, activeChapterId, hoveredChapterId, hoveredEventId,
  pingedEventId, refresh, navigateToChapter, navigateToScene, selectChapter, jumpToFlashback,
  scrollToChapter, isEventHighlighted, isEventDimmed, normalizeId,
} = useTimelineInspector(props, emit);
</script>

<style src="@worldwiki/resources/styles/features/timeline/TimelineInspector.css"></style>
