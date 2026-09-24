import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import type { GraphWebEdge, GraphWebNode, GraphWebData, GraphWebFilterState } from './GraphWeb.model';
import * as apiClient from '@/services/api.client';
import { getCSSVariable } from '@/utils/ui.css';

export function useGraphWebView(projectId: string) {
  const nodes = ref<GraphWebNode[]>([]);
  const edges = ref<GraphWebEdge[]>([]);
  const isLoading = ref(false);
  const canvasRef = ref<HTMLCanvasElement | null>(null);

  const filters = ref<GraphWebFilterState>({
    searchQuery: '',
    selectedChapterOrder: 1,
    selectedMAbs: null,
    minStrength: 0,
    showOnlyActive: true,
  });

  const loadGraphSlice = async () => {
    if (!projectId) return;
    isLoading.value = true;
    try {
      const data = (await apiClient.getGraphTimeSlice(
        projectId,
        filters.value.selectedChapterOrder,
        filters.value.selectedMAbs
      )) as GraphWebData;
      nodes.value = data?.nodes ?? [];
      edges.value = data?.edges ?? [];
    } catch (err) {
      console.error('Failed to load graph time slice:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const filteredNodes = computed<GraphWebNode[]>(() => {
    const q = filters.value.searchQuery.toLowerCase().trim();
    return nodes.value.filter((node: GraphWebNode) => {
      if (q && !node.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  });

  const filteredEdges = computed<GraphWebEdge[]>(() => {
    const activeNodeIds = new Set<string>(filteredNodes.value.map((n: GraphWebNode) => n.id));
    return edges.value.filter((edge: GraphWebEdge) => {
      if (!activeNodeIds.has(edge.source_id) || !activeNodeIds.has(edge.target_id)) {
        return false;
      }
      const st = Math.abs(edge.strength ?? 0);
      if (st < filters.value.minStrength) {
        return false;
      }
      return true;
    });
  });

  const renderCanvas = () => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    const height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    ctx.clearRect(0, 0, width, height);

    const activeNodes = filteredNodes.value;
    const activeEdges = filteredEdges.value;
    if (!activeNodes.length) return;

    // Simple circle layout
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.38;

    const nodePos = new Map<string, { x: number; y: number; name: string }>();
    activeNodes.forEach((n: GraphWebNode, idx: number) => {
      const angle = (idx / activeNodes.length) * 2 * Math.PI;
      nodePos.set(n.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        name: n.name,
      });
    });

    const successColor = getCSSVariable('--color-success') || 'currentColor';
    const dangerColor = getCSSVariable('--color-danger') || 'currentColor';
    const accentColor = getCSSVariable('--color-accent') || 'currentColor';
    const surfaceColor = getCSSVariable('--color-surface') || 'currentColor';
    const textColor = getCSSVariable('--color-text-main') || 'currentColor';

    // Draw edges (parallel Bezier curves)
    activeEdges.forEach((e: GraphWebEdge) => {
      const p1 = nodePos.get(e.source_id);
      const p2 = nodePos.get(e.target_id);
      if (!p1 || !p2) return;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);

      const midX = (p1.x + p2.x) / 2 + 15;
      const midY = (p1.y + p2.y) / 2 - 15;
      ctx.quadraticCurveTo(midX, midY, p2.x, p2.y);

      const strength = e.strength ?? 0;
      ctx.save();
      ctx.strokeStyle = strength >= 0 ? successColor : dangerColor;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = Math.max(1, Math.min(5, Math.abs(strength) / 20));
      ctx.stroke();
      ctx.restore();
    });

    // Draw nodes
    nodePos.forEach((p: { x: number; y: number; name: string }) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14, 0, 2 * Math.PI);
      ctx.fillStyle = accentColor;
      ctx.fill();
      ctx.strokeStyle = surfaceColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '11px sans-serif';
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.fillText(p.name, p.x, p.y + 26);
    });
  };

  watch([filteredNodes, filteredEdges], () => {
    requestAnimationFrame(renderCanvas);
  });

  watch(
    () => [filters.value.selectedChapterOrder, filters.value.selectedMAbs],
    () => {
      void loadGraphSlice();
    }
  );

  onMounted(() => {
    void loadGraphSlice();
    requestAnimationFrame(renderCanvas);
    window.addEventListener('resize', renderCanvas);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', renderCanvas);
  });

  return {
    filters,
    filteredNodes,
    filteredEdges,
    isLoading,
    canvasRef,
    renderCanvas,
    refresh: loadGraphSlice,
  };
}

export const useGraphWeb = useGraphWebView;
