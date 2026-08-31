import { computed, ref } from 'vue';
import type { FigureNodeViewProps } from './FigureNodeView.model';

export function useFigureNodeView(props: FigureNodeViewProps) {
  const isResizing = ref(false);
  const startX = ref(0);
  const startWidth = ref(0);

  const src = computed(() => props.node.attrs.src || '');
  const caption = computed(() => props.node.attrs.caption || '');
  const computedNumber = computed(() => props.node.attrs.computedNumber || '');
  const alignment = computed(() => props.node.attrs.alignment || 'center');
  const width = computed(() => {
    const w = props.node.attrs.width;
    if (!w) return '100%';
    return typeof w === 'number' ? `${w}px` : w;
  });

  const prefixLabel = computed(() => {
    const num = computedNumber.value;
    if (!num) return 'Рисунок';
    return `Рисунок ${num} —`;
  });

  function updateCaption(newCaption: string) {
    props.updateAttributes({ caption: newCaption });
  }

  function startResize(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isResizing.value = true;
    startX.value = e.clientX;

    const currentWidth = typeof props.node.attrs.width === 'number'
      ? props.node.attrs.width
      : parseInt(String(props.node.attrs.width || '500'), 10);

    startWidth.value = isNaN(currentWidth) ? 500 : currentWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.value) return;
      const deltaX = moveEvent.clientX - startX.value;
      const newWidth = Math.max(150, Math.min(1200, startWidth.value + deltaX));
      props.updateAttributes({ width: newWidth });
    };

    const onMouseUp = () => {
      isResizing.value = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  return {
    src,
    caption,
    computedNumber,
    alignment,
    width,
    prefixLabel,
    updateCaption,
    startResize
  };
}
