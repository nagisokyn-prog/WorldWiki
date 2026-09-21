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

        const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = moveEvent.clientY - startY;
            const newHeight = Math.max(70, Math.min(500, startHeight + deltaY));
            calendarHeight.value = newHeight;
        };

        const onMouseUp = () => {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('worldwiki-calendar-widget-height', String(calendarHeight.value));
            }
            if (cleanupResize) {
                cleanupResize();
                cleanupResize = null;
            }
        };

        cleanupResize = () => {
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
