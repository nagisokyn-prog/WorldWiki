<template>
  <div class="graphweb-container flex flex-col h-full w-full overflow-hidden bg-surface text-main relative">
    <!-- Toolbar -->
    <div class="graphweb-toolbar flex flex-wrap items-center justify-between gap-3 p-4 border-b border-subtle bg-surface z-10">
      <div class="flex items-center gap-3">
        <h2 class="text-base font-bold m-0 flex items-center gap-2">
          <span>🕸️</span> Паутина Связей (Временной Срез)
        </h2>
        <span v-if="filteredNodes.length" class="text-xs px-2 py-0.5 rounded bg-surface-hover text-muted">
          {{ filteredNodes.length }} узлов / {{ filteredEdges.length }} связей
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="filters.searchQuery"
          type="text"
          placeholder="Поиск по имени..."
          class="text-xs px-3 py-1.5 rounded border border-subtle bg-input text-main"
        />

        <label class="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
          <input v-model="filters.showOnlyActive" type="checkbox" class="cursor-pointer" />
          <span>Только активные в срезе</span>
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

    <!-- Canvas Simulation Area -->
    <div class="canvas-area flex-1 relative overflow-hidden bg-surface-subtle">
      <canvas
        ref="canvasRef"
        class="w-full h-full cursor-grab active:cursor-grabbing"
      ></canvas>

      <!-- Bottom Floating Time Slider -->
      <div class="time-slider-box absolute bottom-6 left-1/2 -translate-x-1/2 p-4 rounded-xl border border-subtle bg-surface shadow-lg flex items-center gap-4 z-10 min-w-[360px]">
        <span class="text-xs font-bold whitespace-nowrap">⏳ Срез по Главе:</span>
        <input
          type="range"
          min="0"
          max="50"
          :value="filters.selectedChapterOrder ?? 0"
          class="flex-1 cursor-pointer"
          @input="filters.selectedChapterOrder = Number(($event.target as HTMLInputElement).value) || null"
        />
        <span class="text-xs font-mono font-bold text-accent min-w-[3rem] text-right">
          {{ filters.selectedChapterOrder !== null ? '#' + filters.selectedChapterOrder : 'Все' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GraphWebViewProps } from './GraphWebView.model';
import { useGraphWebView } from './useGraphWebView';

const props = withDefaults(
  defineProps<GraphWebViewProps>(),
  {
    projectId: '',
  }
);

const {
  filters,
  filteredNodes,
  filteredEdges,
  isLoading,
  canvasRef,
  refresh,
} = useGraphWebView(props.projectId);
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/GraphWebView.css"></style>

