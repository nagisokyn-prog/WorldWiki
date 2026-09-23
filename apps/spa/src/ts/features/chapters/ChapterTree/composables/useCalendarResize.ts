import { ref, onUnmounted } from 'vue';

export function useCalendarResize() {
    const calendarHeight = ref(
        typeof window !== 'undefined'
            ? Number(localStorage.getItem('worldwiki-calendar-widget-height')) || 170
            : 170
    );

    let cleanupResize: (() => void) | null = null;

    const startResizeCalendar = (e: MouseEvent) => {
        if (cleanupResize) {
            cleanupResize();
        }
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = calendarHeight.value;

        let rafId: number | null = null;
        let latestHeight = startHeight;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = moveEvent.clientY - startY;
            latestHeight = Math.max(70, Math.min(500, startHeight + deltaY));
            if (rafId === null) {
                rafId = requestAnimationFrame(() => {
                    calendarHeight.value = latestHeight;
                    rafId = null;
                });
            }
        };

        const onMouseUp = () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            calendarHeight.value = latestHeight;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('worldwiki-calendar-widget-height', String(latestHeight));
            }
            if (cleanupResize) {
                cleanupResize();
                cleanupResize = null;
            }
        };

        cleanupResize = () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    onUnmounted(() => {
        if (cleanupResize) {
            cleanupResize();
            cleanupResize = null;
        }
    });

    return {
        calendarHeight,
        startResizeCalendar
    };
}
