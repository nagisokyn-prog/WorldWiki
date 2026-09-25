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
    const currentOrder = filters.value.selectedChapterOrder;

    return edges.value.filter((edge: GraphWebEdge) => {
      if (!activeNodeIds.has(edge.source_id) || !activeNodeIds.has(edge.target_id)) {
        return false;
      }
      const st = Math.abs(edge.strength ?? 0);
      if (st < filters.value.minStrength) {
        return false;
      }

      if (filters.value.showOnlyActive && currentOrder !== null && currentOrder !== undefined) {
        if (edge.start_order !== null && edge.start_order !== undefined && edge.start_order > currentOrder) {
          return false;
        }
        if (edge.end_order !== null && edge.end_order !== undefined && edge.end_order < currentOrder) {
          return false;
        }
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

    // Draw edges (parallel Bezier curves with offset & arrows)
    activeEdges.forEach((e: GraphWebEdge) => {
      const p1 = nodePos.get(e.source_id);
      const p2 = nodePos.get(e.target_id);
      if (!p1 || !p2) return;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;

      // Offset curve perpendicular to line
      const curvature = 18;
      const ctrlX = (p1.x + p2.x) / 2 + nx * curvature;
      const ctrlY = (p1.y + p2.y) / 2 + ny * curvature;

      const strength = e.strength ?? 0;
      const currentOrder = filters.value.selectedChapterOrder;
      const isUnrevealed = currentOrder !== null && currentOrder !== undefined && e.start_order !== null && e.start_order !== undefined && e.start_order > currentOrder;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, p2.x, p2.y);

      ctx.strokeStyle = strength >= 0 ? successColor : dangerColor;
      ctx.globalAlpha = isUnrevealed ? 0.35 : 0.75;
      ctx.lineWidth = Math.max(1, Math.min(6, Math.abs(strength) / 20));

      if (isUnrevealed) {
        ctx.setLineDash([4, 4]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.stroke();

      // Draw arrowhead at target (directed)
      const arrowAngle = Math.atan2(p2.y - ctrlY, p2.x - ctrlX);
      const arrowLen = 8;
      const targetRadius = 14;
      const endX = p2.x - Math.cos(arrowAngle) * targetRadius;
      const endY = p2.y - Math.sin(arrowAngle) * targetRadius;

      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - arrowLen * Math.cos(arrowAngle - Math.PI / 6),
        endY - arrowLen * Math.sin(arrowAngle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - arrowLen * Math.cos(arrowAngle + Math.PI / 6),
        endY - arrowLen * Math.sin(arrowAngle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = strength >= 0 ? successColor : dangerColor;
      ctx.fill();

      // Render warning badge if edge needs timeline date resolution
      if (e.needs_m_abs_warning) {
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠️', ctrlX, ctrlY - 8);
      }

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
