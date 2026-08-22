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
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { HardwareInfo } from '../../api/aiModels.api';

const props = defineProps<{
  hardware: HardwareInfo | null;
}>();

const chartContainer = ref<HTMLDivElement | null>(null);
let uplotInstance: uPlot | null = null;

const timestamps = ref<number[]>([]);
const ramUsedData = ref<number[]>([]);
const vramUsedData = ref<number[]>([]);

const totalRam = computed(() => props.hardware?.total_ram_gb || 16);
const totalVram = computed(() => props.hardware?.total_vram_gb || 8);

const currentRamUsed = computed(() => {
  const tot = totalRam.value;
  const free = props.hardware?.free_ram_gb ?? 8;
  return Math.max(0, tot - free);
});

const currentVramUsed = computed(() => {
  const tot = totalVram.value;
  const free = props.hardware?.free_vram_gb ?? 4;
  return Math.max(0, tot - free);
});

const ramPercent = computed(() => {
  return totalRam.value > 0 ? Math.round((currentRamUsed.value / totalRam.value) * 100) : 0;
});

const vramPercent = computed(() => {
  return totalVram.value > 0 ? Math.round((currentVramUsed.value / totalVram.value) * 100) : 0;
});

const maxPoints = 40;

const initChart = () => {
  if (!chartContainer.value) return;

  const now = Math.floor(Date.now() / 1000);
  timestamps.value = [];
  ramUsedData.value = [];
  vramUsedData.value = [];

  for (let i = maxPoints; i >= 0; i--) {
    timestamps.value.push(now - i * 2);
    ramUsedData.value.push(currentRamUsed.value);
    vramUsedData.value.push(currentVramUsed.value);
  }

  const maxVal = Math.max(totalRam.value, totalVram.value, 16);

  const opts: uPlot.Options = {
    width: chartContainer.value.clientWidth || 600,
    height: 140,
    cursor: {
      show: true,
      points: {
        show: true,
        size: 6,
        stroke: '#ffffff'
      }
    },
    scales: {
      x: {
        time: true,
      },
      y: {
        auto: false,
        range: [0, Math.ceil(maxVal * 1.05)],
      }
    },
    axes: [
      {
        stroke: '#8b949e',
        grid: { stroke: 'rgba(255, 255, 255, 0.05)' },
        ticks: { stroke: 'rgba(255, 255, 255, 0.1)' },
        space: 50,
        values: (_self, ticks) => ticks.map(t => {
          const d = new Date(t * 1000);
          return `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
        })
      },
      {
        stroke: '#8b949e',
        grid: { stroke: 'rgba(255, 255, 255, 0.05)' },
        ticks: { stroke: 'rgba(255, 255, 255, 0.1)' },
        size: 40,
        values: (_self, ticks) => ticks.map(v => `${v} ГБ`)
      }
    ],
    series: [
      {},
      {
        label: 'ОЗУ (RAM)',
        stroke: '#58a6ff',
        width: 2,
        fill: 'rgba(88, 166, 255, 0.15)',
        points: { show: false }
      },
      {
        label: 'Видеопамять (VRAM)',
        stroke: '#bc8cff',
        width: 2,
        fill: 'rgba(188, 140, 255, 0.15)',
        points: { show: false }
      }
    ]
  };

  const data: [number[], number[], number[]] = [
    timestamps.value,
    ramUsedData.value,
    vramUsedData.value
  ];

  if (uplotInstance) {
    uplotInstance.destroy();
  }

  uplotInstance = new uPlot(opts, data, chartContainer.value);
};

const updateDataPoint = () => {
  if (!uplotInstance) return;

  const now = Math.floor(Date.now() / 1000);
  timestamps.value.push(now);
  ramUsedData.value.push(Number(currentRamUsed.value.toFixed(2)));
  vramUsedData.value.push(Number(currentVramUsed.value.toFixed(2)));

  if (timestamps.value.length > maxPoints) {
    timestamps.value.shift();
    ramUsedData.value.shift();
    vramUsedData.value.shift();
  }

  uplotInstance.setData([
    timestamps.value,
    ramUsedData.value,
    vramUsedData.value
  ]);
};

let pollInterval: ReturnType<typeof setInterval> | null = null;

const handleResize = () => {
  if (uplotInstance && chartContainer.value) {
    uplotInstance.setSize({
      width: chartContainer.value.clientWidth || 600,
      height: 140
    });
  }
};

onMounted(() => {
  nextTick(() => {
    initChart();
    window.addEventListener('resize', handleResize);
    pollInterval = setInterval(() => {
      updateDataPoint();
    }, 2000);
  });
});

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
  window.removeEventListener('resize', handleResize);
  if (uplotInstance) {
    uplotInstance.destroy();
    uplotInstance = null;
  }
});
</script>

<style scoped>
.hardware-chart-card {
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color, #fff);
}

.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  background: rgba(35, 134, 54, 0.2);
  color: #3fb950;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 500;
}

.live-dot {
  width: 6px;
  height: 6px;
  background: #3fb950;
  border-radius: 50%;
  animation: pulse-dot 1.5s infinite;
}

@keyframes pulse-dot {
  0% { opacity: 0.4; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
  100% { opacity: 0.4; transform: scale(0.9); }
}

.chart-legends {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-muted, #8b949e);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.ram-dot {
  background: #58a6ff;
}

.vram-dot {
  background: #bc8cff;
}

.chart-container {
  width: 100%;
  height: 140px;
  overflow: hidden;
}

:deep(.uplot) {
  font-family: inherit;
}

:deep(.u-legend) {
  display: none !important;
}
</style>
