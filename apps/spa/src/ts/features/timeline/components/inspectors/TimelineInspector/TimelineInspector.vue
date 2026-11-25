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

      <div v-else class="dual-axis-canvas">
        <!-- Верхняя Нарративная Ось (независимый скролл глав) -->
        <div class="axis-scroll-track narrative-scroll-track" @scroll="onNarrativeScroll">
          <div class="axis-track-wrapper narrative-wrapper" :style="{ minWidth: narrativeMinWidth }">
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
        </div>

        <!-- SVG Соединительные нити Безье поверх вьюпорта -->
        <svg class="connection-svg" width="100%" height="100%">
          <defs>
            <marker id="arrow-direct" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 2 L 8 5 L 0 8 z" fill="var(--accent)" />
            </marker>
            <marker id="arrow-flashback" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 2 L 8 5 L 0 8 z" fill="var(--warning)" />
            </marker>
            <marker id="arrow-hierarchy" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 2 L 8 5 L 0 8 z" fill="var(--info, var(--accent))" />
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
          <g v-for="hLine in sceneHierarchyLines" :key="hLine.id">
            <path
              :d="`M ${hLine.x1} ${hLine.y1} C ${hLine.x1} ${hLine.yBottom}, ${hLine.x2} ${hLine.yBottom}, ${hLine.x2} ${hLine.y2}`"
              fill="none"
              stroke="var(--info, var(--accent))"
              stroke-width="2"
              stroke-dasharray="4 3"
              marker-end="url(#arrow-hierarchy)"
              class="hierarchy-path"
            />
          </g>
        </svg>

        <!-- Нижняя Диегетическая Ось (колонки по датам, независимый скролл) -->
        <div class="axis-scroll-track diegetic-scroll-track" @scroll="onDiegeticScroll">
          <div class="axis-track-wrapper diegetic-wrapper" :style="{ minWidth: diegeticMinWidth }">
            <div class="axis-badge axis-badge-diegetic"><span>⏳</span> ВРЕМЯ МИРА</div>
            <div class="axis-rail axis-rail-diegetic"></div>

            <div v-if="!dateColumns.length" class="axis-empty-hint p-4 text-xs text-muted italic">
              <span>ℹ️ В выбранном горизонте нет связанных событий или сцен</span>
            </div>

            <div
              v-for="(col, colIdx) in dateColumns"
              :key="'date-col-' + col.key"
              class="date-cluster-column"
              :class="{ 'is-undated': col.isUndated }"
              :style="{ left: (82 + colIdx * 136) + 'px' }"
            >
              <div class="date-cluster-pin"></div>
              <div class="date-cluster-header">
                <span class="date-cluster-label">{{ col.label }}</span>
                <span class="date-cluster-count">{{ col.events.length }}</span>
              </div>

              <div class="date-cluster-stack">
                <TimelineEventNode
                  v-for="ev in col.events"
                  :key="'ev-node-' + ev.id"
                  :ev="ev"
                  :pinged-event-id="pingedEventId"
                  :is-highlighted="isEventHighlighted"
                  :is-dimmed="isEventDimmed"
                  @hover-event="hoveredEventId = $event"
                  @navigate-scene="navigateToScene"
                  @scroll-chapter="scrollToChapter"
                  @scroll-event="scrollToEvent"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTimelineInspector } from './useTimelineInspector';
import TimelineInspectorToolbar from './components/TimelineInspectorToolbar/TimelineInspectorToolbar.vue';
import TimelineChapterNode from './components/TimelineChapterNode/TimelineChapterNode.vue';
import TimelineEventNode from './components/TimelineEventNode/TimelineEventNode.vue';
import type { TimelineInspectorProps, TimelineInspectorEmits } from './TimelineInspector.model';

const props = withDefaults(defineProps<TimelineInspectorProps>(), { projectId: '', project: '' });
const emit = defineEmits<TimelineInspectorEmits>();

const {
  filters, volumeOptions, volumeSegments, filteredChapters, dateColumns, filteredEvents,
  connectionLines, sceneHierarchyLines, narrativeMinWidth, diegeticMinWidth, onNarrativeScroll, onDiegeticScroll,
  isLoading, activeChapterId, hoveredChapterId, hoveredEventId,
  pingedEventId, refresh, navigateToChapter, navigateToScene, selectChapter, jumpToFlashback,
  scrollToEvent, scrollToChapter, isEventHighlighted, isEventDimmed, normalizeId,
} = useTimelineInspector(props, emit);
</script>

<style src="@worldwiki/resources/styles/features/timeline/TimelineInspector.css"></style>
