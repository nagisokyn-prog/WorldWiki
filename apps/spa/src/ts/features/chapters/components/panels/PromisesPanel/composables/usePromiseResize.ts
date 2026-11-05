import { ref, onMounted, onUnmounted } from 'vue';

export function usePromiseResize() {
  const promisesHeight = ref(parseInt(localStorage.getItem('chapters-panel-promises-h') || '260', 10));
  const isResizing = ref(false);

  let startY = 0;
  let startH = 0;
  let rafId: number | null = null;
  let currentH = 0;

  const startVerticalResize = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.value = true;
    startY = e.clientY;
    startH = promisesHeight.value;
    currentH = startH;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isResizing.value) return;
    const deltaY = e.clientY - startY;
    currentH = Math.max(80, Math.min(1000, startH + deltaY));

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        promisesHeight.value = currentH;
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
      promisesHeight.value = currentH;
      localStorage.setItem('chapters-panel-promises-h', currentH.toString());
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  };

  onMounted(() => {
    if (isNaN(promisesHeight.value) || promisesHeight.value < 80) {
      promisesHeight.value = 260;
    }
  });

  onUnmounted(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  return {
    promisesHeight,
    isResizing,
    startVerticalResize
  };
}
