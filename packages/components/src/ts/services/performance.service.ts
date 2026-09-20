import { ref, onScopeDispose } from 'vue';
import { settingsService } from './settings.service.js';

export type PerformanceStatus = 'Good' | 'Limited' | 'Poor';
export type GraphicsProfile = 'Automatic' | 'Eco' | 'Balanced' | 'Quality' | 'Max';

export class PerformanceManager {
  private static instance: PerformanceManager;

  public status = ref<PerformanceStatus>('Good');
  public lastP50 = ref(0);
  public lastP95 = ref(0);
  public lastP99 = ref(0);
  public lastJankRatio = ref(0);
  public batteryStatus = ref('settings.perf.optimizedAC'); // Stores i18n key or direct text
  
  // Телеметрия
  private frameTimestamps: number[] = [];
  private lastTimestamp = 0;
  private rafId: number | null = null;
  private aggregationInterval: ReturnType<typeof setInterval> | null = null;
  private batteryTarget: (EventTarget & { charging: boolean }) | null = null;
  private batteryListener: (() => void) | null = null;

  // Гистерезис
  private consecutivePoorAggregations = 0;
  private consecutiveGoodAggregations = 0;

  private constructor() {
    this.startTelemetry();
  }

  public static getInstance(): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager();
    }
    return PerformanceManager.instance;
  }

  private startTelemetry() {
    this.lastTimestamp = performance.now();
    const frameLoop = (timestamp: number) => {
      const delta = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;
      
      // Игнорируем кадры при неактивной вкладке (больше 100мс)
      if (delta > 0 && delta < 100) {
        this.frameTimestamps.push(delta);
      }
      
      this.rafId = requestAnimationFrame(frameLoop);
    };
    this.rafId = requestAnimationFrame(frameLoop);

    // Агрегация раз в 5 секунд
    this.aggregationInterval = setInterval(() => this.aggregateMetrics(), 5000);

    // Отслеживание батареи
    if ('getBattery' in navigator) {
      type BatteryManagerType = EventTarget & { charging: boolean };
      (navigator as unknown as { getBattery: () => Promise<BatteryManagerType> })
        .getBattery()
        .then((battery: BatteryManagerType) => {
          const updateBattery = () => {
            this.batteryStatus.value = battery.charging ? 'settings.perf.optimizedAC' : 'settings.perf.batteryPower';
          };
          updateBattery();
          battery.addEventListener('chargingchange', updateBattery);
        })
        .catch((e: unknown) => console.warn('Battery API error:', e));
    }
  }

  public stopTelemetry() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.aggregationInterval !== null) clearInterval(this.aggregationInterval);
  }

  private aggregateMetrics() {
    if (this.frameTimestamps.length < 30) {
      // Слишком мало данных за 5 секунд (простой)
      this.frameTimestamps = [];
      return;
    }

    const sorted = [...this.frameTimestamps].sort((a, b) => a - b);
    const count = sorted.length;
    
    // Метрики
    const p50 = sorted[Math.floor(count * 0.5)];
    const p95 = sorted[Math.floor(count * 0.95)];
    const p99 = sorted[Math.floor(count * 0.99)];
    
    // Jank ratio (кадры дольше 16.67 мс)
    const jankCount = sorted.filter(t => t > 16.67).length;
    const jankRatio = jankCount / count;

    this.lastP50.value = p50;
    this.lastP95.value = p95;
    this.lastP99.value = p99;
    this.lastJankRatio.value = jankRatio;

    // Оценка статуса
    if (p95 > 25 || jankRatio > 0.20) {
      this.status.value = 'Poor';
      this.consecutivePoorAggregations++;
      this.consecutiveGoodAggregations = 0;
    } else if (p95 > 18 || jankRatio > 0.05) {
      this.status.value = 'Limited';
      this.consecutivePoorAggregations = 0;
      this.consecutiveGoodAggregations = 0;
    } else {
      this.status.value = 'Good';
      this.consecutivePoorAggregations = 0;
      this.consecutiveGoodAggregations++;
    }

    this.checkHysteresis();
    
    // Очистка буфера
    this.frameTimestamps = [];
  }

  private checkHysteresis() {
    const settings = settingsService.getSettings();
    const currentProfile = settings.perf?.level || 'Automatic';

    // Даунгрейд только если выбран режим Automatic
    if (currentProfile === 'Automatic') {
      if (this.status.value === 'Poor' && this.consecutivePoorAggregations >= 1) { // Быстрый даунгрейд (5 сек)
        this.downgradeProfile();
        this.consecutivePoorAggregations = 0;
      } else if (this.status.value === 'Good' && this.consecutiveGoodAggregations >= 4) { // Медленный апгрейд (20 сек)
        this.upgradeProfile();
        this.consecutiveGoodAggregations = 0;
      }
    }
  }

  private downgradeProfile() {
    // Внутренняя логика понижения качества
    const settings = settingsService.getSettings();
    if (settings.glass.blur > 16) {
      this.applyProfile('Quality');
    } else if (settings.glass.blur > 8) {
      this.applyProfile('Balanced');
    } else if (settings.glass.blur > 0) {
      this.applyProfile('Eco');
    }
  }

  private upgradeProfile() {
    // Постепенное повышение, если всё хорошо
    const settings = settingsService.getSettings();
    if (settings.glass.blur === 0) {
      this.applyProfile('Balanced');
    } else if (settings.glass.blur === 8) {
      this.applyProfile('Quality');
    } else if (settings.glass.blur === 16) {
      this.applyProfile('Max');
    }
  }

  public applyProfile(profile: GraphicsProfile | string) {
    const settings = settingsService.getSettings();
    
    if (!settings.perf) {
      settings.perf = { level: 'Automatic', fpsLimit: 60, loadMeter: 0, qualityLevel: 100 };
    }
    settings.perf.level = profile; 
    
    // Применяем настройки
    switch (profile) {
      case 'Eco':
        settings.glass.blur = 0;
        settings.glass.islandAlpha = 0.0;
        settings.shadows.useInset = false;
        settings.shadows.islandBlur = 0;
        settings.animations.enabled = false;
        break;
      case 'Balanced':
        settings.glass.blur = 8;
        settings.glass.islandAlpha = 0.2;
        settings.shadows.useInset = false;
        settings.shadows.islandBlur = 10;
        settings.animations.enabled = true;
        break;
      case 'Quality':
        settings.glass.blur = 16;
        settings.glass.islandAlpha = 0.5;
        settings.shadows.useInset = true;
        settings.shadows.islandBlur = 30;
        settings.animations.enabled = true;
        break;
      case 'Max':
        settings.glass.blur = 24;
        settings.glass.islandAlpha = 0.7;
        settings.shadows.useInset = true;
        settings.shadows.islandBlur = 50;
        settings.animations.enabled = true;
        break;
      case 'Automatic':
        settings.glass.blur = 16;
        settings.glass.islandAlpha = 0.5;
        settings.shadows.islandBlur = 30;
        settings.animations.enabled = true;
        break;
    }

    settingsService.saveSettings(settings);
    settingsService.applySettings();
  }

  public getInitialCapabilitiesHint(): GraphicsProfile {
    const cores = navigator.hardwareConcurrency || 4;
    if (cores >= 8) return 'Quality';
    if (cores >= 4) return 'Balanced';
    return 'Eco';
  }

  /**
   * Запускает калибровочный тест UI в реальном compositing pipeline.
   * Создает скрытые, но рендерящиеся элементы стекла и замеряет FPS.
   */
  public async runCalibration(): Promise<void> {
    console.log('PerformanceManager: Starting UI Calibration...');
    
    const calibrationContainer = document.createElement('div');
    calibrationContainer.id = 'calibration-view';
    // Обязательно рендерим, но делаем почти невидимым и кликабельным насквозь
    calibrationContainer.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 1; pointer-events: none; opacity: 0.01;
      display: flex; flex-wrap: wrap; overflow: hidden;
    `;
    document.body.appendChild(calibrationContainer);

    const workloads = [
      { name: 'Light', count: 2, blur: 8 },
      { name: 'Normal', count: 5, blur: 16 },
      { name: 'Heavy', count: 10, blur: 24 }
    ];

    let recommendedProfile: GraphicsProfile = 'Eco';
    let failed = false;

    // Даем приложению "прогреться" перед тестами
    await new Promise(r => setTimeout(r, 1000));

    for (const workload of workloads) {
      if (failed) break;

      // Очищаем и создаем панели нагрузки
      calibrationContainer.innerHTML = '';
      for (let i = 0; i < workload.count; i++) {
        const panel = document.createElement('div');
        panel.style.cssText = `
          width: 200px; height: 200px; margin: 10px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(${workload.blur}px);
          -webkit-backdrop-filter: blur(${workload.blur}px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          border-radius: 16px;
        `;
        calibrationContainer.appendChild(panel);
      }

      // Ждем применения CSS (warm-up)
      await new Promise(r => setTimeout(r, 200));

      // Замеряем 60 кадров
      const frameTimes: number[] = [];
      await new Promise<void>((resolve) => {
        let lastTime = performance.now();
        let frameCount = 0;

        const measureFrame = (time: number) => {
          const delta = time - lastTime;
          lastTime = time;
          
          if (frameCount > 0) frameTimes.push(delta); // Пропускаем первый кадр
          frameCount++;

          if (frameCount < 60) {
            requestAnimationFrame(measureFrame);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(measureFrame);
      });

      // Анализируем метрики
      const sorted = frameTimes.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const jankRatio = sorted.filter(t => t > 16.67).length / sorted.length;

      console.log(`[Calibration] ${workload.name}: p50=${p50.toFixed(1)}ms, p95=${p95.toFixed(1)}ms, Jank=${(jankRatio * 100).toFixed(0)}%`);

      if (p95 > 20 || jankRatio > 0.1) {
        console.warn(`[Calibration] Failed at ${workload.name} workload.`);
        failed = true;
      } else {
        if (workload.name === 'Light') recommendedProfile = 'Balanced';
        if (workload.name === 'Normal') recommendedProfile = 'Quality';
        if (workload.name === 'Heavy') recommendedProfile = 'Max';
      }
    }

    calibrationContainer.remove();
    console.log(`PerformanceManager: Calibration finished. Recommended Profile: ${recommendedProfile}`);
    
    // Если пользователь стоит в Automatic или настройки девственно чисты — применяем рекомендованный
    const settings = settingsService.getSettings();
    if (!settings.perf?.level || settings.perf.level === 'Automatic') {
       this.applyProfile(recommendedProfile);
       // Сбрасываем обратно в Automatic, чтобы телеметрия работала,
       // но стартовые параметры уже подогнаны под железо
       settings.perf.level = 'Automatic';
       settingsService.saveSettings(settings);
    }
  }
}

export const performanceManager = PerformanceManager.getInstance();
