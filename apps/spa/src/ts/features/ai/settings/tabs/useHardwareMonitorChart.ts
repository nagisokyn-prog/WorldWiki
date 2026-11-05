import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import uPlot from 'uplot';
import type { HardwareInfo } from '@/features/ai/types/ai.types';

export interface HardwareMonitorChartProps {
  hardware: HardwareInfo | null;
}

export function useHardwareMonitorChart(props: HardwareMonitorChartProps) {
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

    const rootStyle = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const colorText = rootStyle?.getPropertyValue('--text-main').trim() || 'var(--text-main)';
    const colorMuted = rootStyle?.getPropertyValue('--text-muted').trim() || 'var(--text-muted)';
    const colorBorder = rootStyle?.getPropertyValue('--border-color').trim() || 'var(--border-color)';
    const colorInfo = rootStyle?.getPropertyValue('--info').trim() || 'var(--info)';
    const colorAccent = rootStyle?.getPropertyValue('--accent').trim() || 'var(--accent)';
    const colorInfoBg = rootStyle?.getPropertyValue('--info-bg').trim() || 'var(--info-bg)';
    const colorAccentGlow = rootStyle?.getPropertyValue('--accent-glow').trim() || 'var(--accent-glow)';

    const opts: uPlot.Options = {
      width: chartContainer.value.clientWidth || 600,
      height: 140,
      cursor: {
        show: true,
        points: {
          show: true,
          size: 6,
          stroke: colorText
        }
      },
      scales: {
        x: {
          time: true,
        },
        y: {
          auto: false,
          range: [0, maxVal + 2],
        }
      },
      axes: [
        {
          stroke: colorMuted,
          grid: { stroke: colorBorder, width: 1 },
          ticks: { stroke: colorBorder, width: 1 },
          values: (_self, ticks) => ticks.map(rawValue => {
            const d = new Date(rawValue * 1000);
            return `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
          }),
          space: 50,
          size: 20
        },
        {
          stroke: colorMuted,
          grid: { stroke: colorBorder, width: 1 },
          ticks: { stroke: colorBorder, width: 1 },
          values: (_self, ticks) => ticks.map(rawValue => `${Math.round(rawValue)} ГБ`),
          space: 30,
          size: 45
        }
      ],
      series: [
        {},
        {
          label: 'RAM (ОЗУ)',
          stroke: colorInfo,
          width: 2,
          fill: colorInfoBg,
          points: { show: false }
        },
        {
          label: 'VRAM (Видео)',
          stroke: colorAccent,
          width: 2,
          fill: colorAccentGlow,
          points: { show: false }
        }
      ]
    };

    uplotInstance = new uPlot(opts, [timestamps.value, ramUsedData.value, vramUsedData.value], chartContainer.value);
  };

  let pushTimer: ReturnType<typeof setInterval> | null = null;
  const updateData = () => {
    if (!uplotInstance) return;

    const now = Math.floor(Date.now() / 1000);
    timestamps.value.push(now);
    ramUsedData.value.push(currentRamUsed.value);
    vramUsedData.value.push(currentVramUsed.value);

    if (timestamps.value.length > maxPoints) {
      timestamps.value.shift();
      ramUsedData.value.shift();
      vramUsedData.value.shift();
    }

    uplotInstance.setData([timestamps.value, ramUsedData.value, vramUsedData.value]);
  };

  const handleResize = () => {
    if (uplotInstance && chartContainer.value) {
      uplotInstance.setSize({
        width: chartContainer.value.clientWidth,
        height: 140
      });
    }
  };

  onMounted(async () => {
    await nextTick();
    initChart();
    pushTimer = setInterval(updateData, 2000);
    window.addEventListener('resize', handleResize);
  });

  onUnmounted(() => {
    if (pushTimer) clearInterval(pushTimer);
    window.removeEventListener('resize', handleResize);
    if (uplotInstance) {
      uplotInstance.destroy();
      uplotInstance = null;
    }
  });

  return {
    chartContainer,
    totalRam,
    totalVram,
    currentRamUsed,
    currentVramUsed,
    ramPercent,
    vramPercent
  };
}
