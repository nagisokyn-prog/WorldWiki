<template>
  <div class="inspector-container flex flex-col h-full w-full overflow-hidden bg-surface text-main">
    <!-- Toolbar -->
    <div class="inspector-toolbar flex flex-wrap items-center justify-between gap-3 p-4 border-b border-subtle bg-surface">
      <div class="flex items-center gap-3">
        <h2 class="text-base font-bold m-0 flex items-center gap-2">
          <span>⏳</span> Хронологический Инспектор
        </h2>
        <span v-if="filteredEvents.length" class="text-xs px-2 py-0.5 rounded bg-surface-hover text-muted">
          {{ filteredEvents.length }} событий / {{ filteredChapters.length }} глав
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <!-- Reader / Author Horizon Switch -->
        <div class="flex items-center gap-1.5 text-xs">
          <span class="text-muted">Режим:</span>
          <select
            v-model="filters.readerHorizonChapterOrder"
            class="text-xs px-2 py-1.5 rounded border border-subtle bg-input text-main"
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

        <label class="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
          <input v-model="filters.showFlashbacksOnly" type="checkbox" class="cursor-pointer" />
          <span>Только ретроспективы (Flashbacks)</span>
        </label>

        <button
          class="btn-refresh text-xs px-3 py-1.5 rounded border border-subtle bg-surface-hover hover:bg-surface text-main cursor-pointer"
          :disabled="isLoading"
          @click="refresh"
        >
          🔄 {{ isLoading ? 'Загрузка...' : 'Обновить' }}
        </button>
      </div>
    </div>

    <!-- Dual-Axis Visualizer Canvas / SVG Area -->
    <div class="inspector-viewport flex-1 overflow-auto p-6 relative">
      <div v-if="isLoading && !filteredEvents.length" class="flex items-center justify-center h-48 text-muted text-sm">
        Загрузка хронологических связей...
      </div>

      <div v-else-if="!filteredEvents.length || !filteredChapters.length" class="flex items-center justify-center h-48 text-muted text-sm">
        Нет связанных событий для отображения. Привяжите события таймлайна к главам через раскрытия (reveals).
      </div>

      <div v-else class="dual-axis-canvas relative min-w-[1200px] h-[400px]">
        <!-- Top Axis: Narrative (Reading Order) -->
        <div class="narrative-axis absolute top-4 left-0 right-0 h-16 border-b-2 border-subtle flex items-center">
          <div class="axis-label absolute -top-1 left-2 text-2xs font-bold uppercase tracking-wider text-accent">
            📚 Нарративная Ось (Порядок чтения глав)
          </div>
          <div
            v-for="(ch, idx) in filteredChapters"
            :key="'ch-node-' + ch.id"
            class="chapter-node absolute top-4 -translate-x-1/2 p-2 rounded border border-subtle bg-surface shadow-xs text-center cursor-pointer hover:border-accent"
            :style="{ left: (80 + idx * 160) + 'px' }"
          >
            <div class="font-bold text-xs truncate max-w-28">{{ ch.title }}</div>
            <div class="text-2xs text-muted">Глава #{{ ch.sort_order }}</div>
          </div>
        </div>

        <!-- SVG Connection Lines -->
        <svg class="connection-svg absolute inset-0 w-full h-full pointer-events-none z-0">
          <g v-for="line in connectionLines" :key="line.id">
            <path
              :d="`M ${line.x1} ${line.y1 + 40} C ${line.x1} ${(line.y1 + line.y2) / 2}, ${line.x2} ${(line.y1 + line.y2) / 2}, ${line.x2} ${line.y2 - 10}`"
              fill="none"
              :class="line.isFlashback ? 'line-flashback' : 'line-direct'"
              stroke-width="2"
            />
          </g>
        </svg>

        <!-- Bottom Axis: Diegetic (World Time M_abs) -->
        <div class="diegetic-axis absolute top-[240px] left-0 right-0 h-24 border-t-2 border-subtle flex items-center">
          <div class="axis-label absolute top-28 left-2 text-2xs font-bold uppercase tracking-wider text-warning">
            ⏳ Diegetic Ось (Реальное время мира M_abs)
          </div>
          <div
            v-for="(ev, idx) in filteredEvents"
            :key="'ev-node-' + ev.id"
            class="event-node absolute top-4 -translate-x-1/2 p-2.5 rounded border border-subtle bg-surface shadow-xs text-left cursor-pointer hover:border-warning"
            :style="{ left: (80 + idx * 180) + 'px' }"
          >
            <div class="font-bold text-xs text-main truncate max-w-36">{{ ev.title }}</div>
            <div class="text-2xs text-warning">M_abs: {{ ev.m_abs }}</div>
            <div v-if="ev.participants.length" class="text-2xs text-muted truncate max-w-36 mt-1">
              👥 {{ ev.participants.map(p => p.name).join(', ') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTimelineInspector } from './useTimelineInspector';

const props = withDefaults(
  defineProps<{
    projectId?: string;
  }>(),
  {
    projectId: '',
  }
);

const {
  filters,
  filteredChapters,
  filteredEvents,
  connectionLines,
  isLoading,
  refresh,
} = useTimelineInspector(props.projectId);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/TimelineInspector.css"></style>

