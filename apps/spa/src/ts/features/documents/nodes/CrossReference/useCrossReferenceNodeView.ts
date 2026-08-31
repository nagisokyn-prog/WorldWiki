import { computed } from 'vue';
import type { CrossReferenceNodeViewProps } from './CrossReferenceNodeView.model';

export function useCrossReferenceNodeView(props: CrossReferenceNodeViewProps) {
  const targetId = computed(() => props.node.attrs.targetId || '');
  const kind = computed(() => props.node.attrs.kind || 'figure');
  const isBroken = computed(() => Boolean(props.node.attrs.isBroken));
  const resolvedLabel = computed(() => {
    if (isBroken.value) {
      return '⚠️ [объект удален]';
    }
    return props.node.attrs.resolvedLabel || 'Ссылка';
  });

  const icon = computed(() => {
    switch (kind.value) {
      case 'figure':
        return '🖼️';
      case 'table':
        return '📊';
      case 'equation':
        return '∑';
      case 'heading':
        return '§';
      default:
        return '🔗';
    }
  });

  function jumpToTarget(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (isBroken.value || !targetId.value) return;

    // Scroll to the targeted node element by ID attribute
    const targetEl = document.querySelector(`[data-node-id="${targetId.value}"]`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetEl.classList.add('ww-target-highlight');
      setTimeout(() => {
        targetEl.classList.remove('ww-target-highlight');
      }, 1500);
    }
  }

  return {
    targetId,
    kind,
    isBroken,
    resolvedLabel,
    icon,
    jumpToTarget
  };
}
