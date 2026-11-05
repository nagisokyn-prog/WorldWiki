import { defineComponent, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { invoke } from '@tauri-apps/api/core';

export default defineComponent({
    setup() {
        const router = useRouter();

        const progressBarRef = ref<HTMLElement | null>(null);
        const statusTextRef = ref<HTMLElement | null>(null);
        const perfBadgeRef = ref<HTMLElement | null>(null);
        const perfDetailsRef = ref<HTMLElement | null>(null);
        const asciiArtRef = ref<HTMLElement | null>(null);

        const handleKeydown = (e: KeyboardEvent) => {
            if (e.code === 'F11') {
                e.preventDefault();
                invoke('toggle_fullscreen').catch(() => { });
            }
        };

        onMounted(() => {
            window.addEventListener('keydown', handleKeydown, true);
        });

        onUnmounted(() => {
            window.removeEventListener('keydown', handleKeydown, true);
        });

        onMounted(() => {
    function setProgress(percent: number, text: string) {
        if (progressBarRef.value) progressBarRef.value.style.width = percent + '%';
        if (statusTextRef.value) statusTextRef.value.textContent = text;
    }

    const worldAscii = `
 x=i+1;                                                      x=i+1;                                                                          float
  x=i+1;                                                    x=i+1;                                            x=arr[i]                       float
   x=i+1;                                                  x=i+1;                                               double                       float
    x=i+1;                                                x=i+1;                                                return                       float
     x=i+1;                 idx=arr[i];                  x=i+1;   idx=arr[i];idx=arr[i]  double  return;double; double                       float
      x=i+1;                x=i+1;x=i+1;                x=i+1;    idx=arr[i];idx=arr[i]  x=i+1; return;double;  return                       float
       x=i+1;              x=i+1;  x=i+1;              x=i+1;     return         return  x=i+1;return;          double                       float
        x=i+1;            x=i+1;    x=i+1;            x=i+1;      double         double  x=i+1;x=10;            return       idx=arr[i];idx=arr[i]
         x=i+1;          x=i+1;      x=i+1;          x=i+1;       return         return  return                 double       idx=arr[i];idx=arr[i]
          x=i+1;        x=i+1;        x=i+1;        x=i+1;        double         double  double                 return       double         double
           x=i+1;      x=i+1;          x=i+1;      x=i+1;         return         return  return                 double       return         return
            x=i+1;    x=i+1;            x=i+1;    x=i+1;          double         double  double                 return       double         double
             x=i+1;  x=i+1;              x=i+1;  x=i+1;           return         return  return                 double       return         return
              x=i+1;x=i+1;                x=i+1;x=i+1;            double         double  double                 return       double         double
               x=i+1;x=i+1;              x=i+1;x=i+1;             idx=arr[i];idx=arr[i]  return                 double       idx=arr[i];idx=arr[i]
                x=i+1;x=i+1;            x=i+1;x=i+1;              idx=arr[i];idx=arr[i]  double               id=compute();  idx=arr[i];idx=arr[i]

                  x=i+1;                                                      x=i+1;
                   x=i+1;                                                    x=i+1;   double                                      double
                    x=i+1;                                                  x=i+1;    return                                      return
                     x=i+1;                                                x=i+1;     double                                      double
                      x=i+1;                 idx=arr[i];                  x=i+1;                    double  return;double;
                       x=i+1;                x=i+1;x=i+1;                x=i+1;      x=arr[i]       x=i+1; return;double;        x=arr[i]
                        x=i+1;              x=i+1;  x=i+1;              x=i+1;         double       x=i+1;return;                  double
                         x=i+1;            x=i+1;    x=i+1;            x=i+1;          return       x=i+1;x=10;                    return
                          x=i+1;          x=i+1;      x=i+1;          x=i+1;           double       doublex=10;                    double
                           x=i+1;        x=i+1;        x=i+1;        x=i+1;            return       double x=10;true               return
                            x=i+1;      x=i+1;          x=i+1;      x=i+1;             double       double  x=10;x+=1;             double
                             x=i+1;    x=i+1;            x=i+1;    x=i+1;              return       double   x=10;add x;           return
                              x=i+1;  x=i+1;              x=i+1;  x=i+1;               double       double    idx=arr[i];          double
                               x=i+1;x=i+1;                x=i+1;x=i+1;                return       double     x=i+1;x=i+1;        return
                                x=i+1;x=i+1;              x=i+1;x=i+1;                 double       double      x=i+1;x=i+1;       double
                                 x=i+1;x=i+1;            x=i+1;x=i+1;                id=compute();  double       return;double;  id=compute();
`;

    if (asciiArtRef.value) asciiArtRef.value.textContent = worldAscii;

    async function runStartup() {
        try {
            setProgress(10, 'Подготовка базы данных...');
            await new Promise(r => setTimeout(r, 300));

            setProgress(30, 'Загрузка схем сущностей...');
            await new Promise(r => setTimeout(r, 200));

            setProgress(50, 'Запуск бенчмарка производительности...');

            const perf = await invoke<{ cpu_score?: number; memory_mb?: number; cores?: number; level?: string }>('run_performance_benchmark');

            setProgress(80, 'Бенчмарк: CPU ' + perf.cpu_score + 'ms, RAM ' + perf.memory_mb + 'ms, ' + perf.cores + ' ядер');
            await new Promise(r => setTimeout(r, 300));

            const levelNames: Record<string, string> = { low: '🐢 Низкая', medium: '⚡ Средняя', high: '🚀 Высокая' };
            const levelClasses: Record<string, string> = { low: 'low', medium: 'medium', high: 'high' };
            const levelKey = perf.level || 'medium';

            if (perfBadgeRef.value) {
                perfBadgeRef.value.textContent = '⚡ Производительность: ' + (levelNames[levelKey] || '---');
                perfBadgeRef.value.className = 'perf-badge visible ' + (levelClasses[levelKey] || 'medium');
            }
            if (perfDetailsRef.value) {
                perfDetailsRef.value.textContent = 'CPU: ' + perf.cpu_score + 'ms | Memory: ' + perf.memory_mb + 'ms | Cores: ' + perf.cores;
            }

            setProgress(100, 'Готово! Загрузка приложения...');
            await new Promise(r => setTimeout(r, 500));

            localStorage.setItem('perfLevel', String(perf.level || ''));
            localStorage.setItem('perfCpuScore', String(perf.cpu_score ?? ''));
            localStorage.setItem('perfMemoryMb', String(perf.memory_mb ?? ''));
            localStorage.setItem('perfCores', String(perf.cores ?? ''));

            router.push('/launcher');

        } catch (error: unknown) {
            console.error('Ошибка при запуске:', error);
            const errStr = error instanceof Error ? error.message : String(error);
            setProgress(100, 'Ошибка: ' + errStr);
            await new Promise(r => setTimeout(r, 2000));
            router.push('/launcher');
        }
    }

    runStartup();
        });

        return {
            progressBarRef,
            statusTextRef,
            perfBadgeRef,
            perfDetailsRef,
            asciiArtRef
        };
    }
});
