<template>
  <div class="hardware-chart-card">
    <div class="chart-header">
      <div class="chart-title">
        <i class="fas fa-chart-line text-accent"></i>
        <span>Мониторинг ресурсов (RAM и VRAM)</span>
        <span class="live-badge">
          <span class="live-dot"></span> Живой поток
        </span>
      </div>
      <div class="chart-legends">
        <div class="legend-item">
          <span class="legend-dot ram-dot"></span>
          <span>ОЗУ: {{ currentRamUsed.toFixed(1) }} / {{ totalRam.toFixed(1) }} ГБ ({{ ramPercent }}%)</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot vram-dot"></span>
          <span>VRAM: {{ currentVramUsed.toFixed(1) }} / {{ totalVram.toFixed(1) }} ГБ ({{ vramPercent }}%)</span>
        </div>
      </div>
    </div>

    <div ref="chartContainer" class="chart-container"></div>
  </div>
</template>

<script setup lang="ts">
import type { HardwareMonitorChartProps } from './HardwareMonitorChart.model';
import 'uplot/dist/uPlot.min.css';
import { useHardwareMonitorChart } from './useHardwareMonitorChart';

const props = defineProps<HardwareMonitorChartProps>();

const {
  chartContainer,
  totalRam,
  totalVram,
  currentRamUsed,
  currentVramUsed,
  ramPercent,
  vramPercent
} = useHardwareMonitorChart(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/HardwareMonitorChart.css"></style>
