import { ref, onMounted, onUnmounted } from 'vue';

const STORAGE_KEY = 'chapter-tree-calendar-h';
const DEFAULT_HEIGHT = 170;
const MIN_HEIGHT = 70;
const MAX_HEIGHT = 500;

export function useCalendarTreeResize() {
  const calendarHeight = ref(parseInt(localStorage.getItem(STORAGE_KEY) || String(DEFAULT_HEIGHT), 10));
  const isResizing = ref(false);

  let startY = 0;
  let startH = 0;
  let rafId: number | null = null;
  let currentH = DEFAULT_HEIGHT;

  const onMouseMove = (e: MouseEvent) => {
    if (!isResizing.value) return;
    const deltaY = e.clientY - startY;
    currentH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startH + deltaY));

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        calendarHeight.value = currentH;
        rafId = null;
      });
    }
  };

  const onMouseUp = () => {
    if (isResizing.value) {
      isResizing.value = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      calendarHeight.value = currentH;
      try {
        localStorage.setItem(STORAGE_KEY, currentH.toString());
      } catch (err) {
        console.warn('[useCalendarTreeResize] Failed to save height to localStorage:', err);
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  };

  const startVerticalResize = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.value = true;
    startY = e.clientY;
    startH = calendarHeight.value;
    currentH = startH;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  onMounted(() => {
    if (isNaN(calendarHeight.value) || calendarHeight.value < MIN_HEIGHT) {
      calendarHeight.value = DEFAULT_HEIGHT;
    }
  });

  onUnmounted(() => {
    if (isResizing.value) {
      isResizing.value = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });

  return {
    calendarHeight,
    isResizing,
    startVerticalResize
  };
}
