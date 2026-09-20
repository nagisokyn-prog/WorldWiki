import { ref, reactive, computed, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';

export interface FloatingWindowProps {
  title: string;
  isOpen: boolean;
  initialWidth?: number;
  initialHeight?: number;
  initialX?: number;
  initialY?: number;
  zIndexBase?: number;
}

export interface FloatingWindowEmits {
  (e: 'close'): void;
  (e: 'focus'): void;
}

export function useFloatingWindow(
  props: FloatingWindowProps,
  emit: FloatingWindowEmits
) {
  const { t } = useI18n();

  const windowRef = ref<HTMLElement | null>(null);
  const pos = reactive({
    x: props.initialX ?? 100,
    y: props.initialY ?? 100,
    w: props.initialWidth ?? 850,
    h: props.initialHeight ?? 650
  });

  const zIndex = ref(props.zIndexBase ?? 10000);

  const windowStyle = computed(() => ({
    left: `${pos.x}px`,
    top: `${pos.y}px`,
    width: `${pos.w}px`,
    height: `${pos.h}px`,
    zIndex: zIndex.value
  }));

  // Drag logic
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  const handleDrag = (e: MouseEvent) => {
    if (!isDragging) return;
    pos.x = e.clientX - dragOffset.x;
    pos.y = e.clientY - dragOffset.y;
  };

  const stopDrag = () => {
    isDragging = false;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
  };

  const startDrag = (e: MouseEvent) => {
    isDragging = true;
    dragOffset = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    bringToFront();
    
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
  };

  // Resize logic
  let isResizing = false;

  const handleResize = (e: MouseEvent) => {
    if (!isResizing) return;
    pos.w = Math.max(300, e.clientX - pos.x);
    pos.h = Math.max(200, e.clientY - pos.y);
  };

  const stopResize = () => {
    isResizing = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  };

  const startResize = (e: MouseEvent) => {
    isResizing = true;
    bringToFront();
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    e.preventDefault();
  };

  const bringToFront = () => {
    emit('focus');
  };

  const close = () => {
    emit('close');
  };

  const updateZIndex = (val: number) => {
    zIndex.value = val;
  };

  onUnmounted(() => {
    stopDrag();
    stopResize();
  });

  return {
    t,
    windowRef,
    pos,
    zIndex,
    windowStyle,
    startDrag,
    startResize,
    bringToFront,
    close,
    updateZIndex
  };
}
