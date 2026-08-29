import { ref, watch, onMounted, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  AiProfile,
  AiProfileSettings,
  HardwareInfo,
  InstalledModelInfo,
  ModelLifecycleState,
  RecommendedModelCard
} from '../../../types/ai.types';

export interface HfGgufFile {
  filename: string;
  quantization: string;
  size_bytes: number;
  size_gb: number;
}

export interface HfModelItem {
  id: string;
  name: string;
  author?: string;
  downloads: number;
  likes: number;
  tags: string[];
  gguf_files: HfGgufFile[];
}

export function useLocalAiTab(props: { activeProfile: AiProfile | null }, emit: (event: 'save-profile', payload: { settings: AiProfileSettings }) => void) {
  const subTab = ref<'recommended' | 'library' | 'explore' | 'runtime'>('recommended');
  const showChart = ref(true);
  const hardware = ref<HardwareInfo | null>(null);
  const recommendedModels = ref<RecommendedModelCard[]>([]);
  const installedModels = ref<InstalledModelInfo[]>([]);
  const hfModels = ref<HfModelItem[]>([]);
  const searchQuery = ref('');
  const isSearching = ref(false);
  const downloadProgress = ref<Record<string, { percent: number }>>({});
  const localSettings = ref<AiProfileSettings | null>(null);

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let hwPollTimer: ReturnType<typeof setInterval> | null = null;
  let unlistenProgress: UnlistenFn | null = null;

  const hfToken = ref(localStorage.getItem('worldwiki_hf_token') || '');

  const saveHfToken = () => {
    localStorage.setItem('worldwiki_hf_token', hfToken.value.trim());
  };

  watch(() => props.activeProfile?.settings, (newSettings) => {
    if (newSettings) {
      localSettings.value = { ...newSettings };
    } else {
      localSettings.value = null;
    }
  }, { immediate: true, deep: true });

  const loadHardware = async () => {
    try {
      hardware.value = await invoke<HardwareInfo>('get_hardware_info');
    } catch (e) {
      console.error('Ошибка загрузки оборудования:', e);
    }
  };

  const loadRecommended = async () => {
    try {
      recommendedModels.value = await invoke<RecommendedModelCard[]>('get_recommended_local_models');
    } catch (e) {
      console.error('Ошибка загрузки рекомендаций:', e);
    }
  };

  const loadInstalled = async () => {
    try {
      installedModels.value = await invoke<InstalledModelInfo[]>('list_installed_models');
    } catch (e) {
      console.error('Ошибка загрузки библиотеки моделей:', e);
    }
  };

  const isModelInstalled = (filename: string) => {
    return installedModels.value.some(m => m.filename === filename);
  };

  const downloadModel = async (repoId: string, filename: string) => {
    try {
      downloadProgress.value[filename] = { percent: 1 };
      await invoke('download_hf_model', { 
        repoId, 
        filename, 
        token: hfToken.value.trim() || null 
      });
      await loadInstalled();
    } catch (e) {
      delete downloadProgress.value[filename];
      console.error('Ошибка скачивания модели:', e);
      const { appAlert } = await import('@worldwiki/components');
      appAlert(typeof e === 'string' ? e : 'Не удалось скачать модель. Проверьте соединение или наличие токена.');
    }
  };

  const loadModel = async (filename: string, kind?: string) => {
    try {
      await invoke('load_local_model', { filename });
      await loadInstalled();

      if (localSettings.value) {
        const updated = { ...localSettings.value };
        if (kind === 'embedding' || filename.toLowerCase().includes('embed')) {
          updated.embed_model_path = filename;
        } else {
          updated.model = filename;
        }
        localSettings.value = updated;
        emit('save-profile', { settings: updated });
      }
    } catch (e) {
      console.error('Ошибка загрузки модели:', e);
    }
  };

  const unloadModel = async (filename: string) => {
    try {
      await invoke('unload_local_model', { filename });
      await loadInstalled();
    } catch (e) {
      console.error('Ошибка выгрузки модели:', e);
    }
  };

  const deleteModel = async (filename: string) => {
    const { appConfirm } = await import('@worldwiki/components');
    if (!await appConfirm(`Удалить файл модели ${filename} с диска?`)) return;
    try {
      await invoke('delete_local_model', { filename });
      await loadInstalled();
    } catch (e) {
      console.error('Ошибка удаления модели:', e);
    }
  };

  const onSearchInput = () => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    searchTimeout = setTimeout(async () => {
      if (!searchQuery.value.trim()) return;
      isSearching.value = true;
      try {
        hfModels.value = await invoke<HfModelItem[]>('fetch_hf_models', { 
          query: searchQuery.value.trim(),
          token: hfToken.value.trim() || null
        });
      } catch (e) {
        console.error('Ошибка поиска HF:', e);
      } finally {
        isSearching.value = false;
      }
    }, 500);
  };

  const handleSaveRuntime = (updated?: AiProfileSettings) => {
    const s = updated || localSettings.value;
    if (s) {
      localSettings.value = { ...s };
      emit('save-profile', { settings: s });
    }
  };

  const getStateIcon = (state: ModelLifecycleState) => {
    const map: Record<ModelLifecycleState, string> = {
      installed: 'fa-check',
      loading: 'fa-spinner fa-spin',
      unloading: 'fa-spinner fa-spin',
      ready: 'fa-bolt',
      idle: 'fa-clock',
      busy: 'fa-spinner fa-spin',
      sleeping: 'fa-moon',
      error: 'fa-exclamation-triangle',
    };
    return map[state] || 'fa-circle';
  };

  const getStateLabel = (state: ModelLifecycleState) => {
    const map: Record<ModelLifecycleState, string> = {
      installed: 'Готова к загрузке',
      loading: 'Загрузка в память...',
      unloading: 'Выгрузка из памяти...',
      ready: 'Активна в памяти',
      idle: 'Ожидание',
      busy: 'Генерация ответа...',
      sleeping: 'В спящем режиме',
      error: 'Ошибка',
    };
    return map[state] || state;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ru-RU').format(num || 0);
  };

  onMounted(async () => {
    loadHardware();
    loadRecommended();
    loadInstalled();
    hwPollTimer = setInterval(loadHardware, 3000);

    try {
      unlistenProgress = await listen<{ filename?: string; is_done?: boolean; percent: number }>('model_download_progress', (event) => {
        const payload = event.payload;
        if (payload && payload.filename) {
          if (payload.is_done) {
            delete downloadProgress.value[payload.filename];
            loadInstalled();
          } else {
            downloadProgress.value[payload.filename] = { percent: payload.percent };
          }
        }
      });
    } catch (e) {
      console.error('Ошибка подписки на прогресс загрузки:', e);
    }
  });

  onUnmounted(() => {
    if (hwPollTimer) clearInterval(hwPollTimer);
    if (unlistenProgress) unlistenProgress();
  });

  return {
    subTab,
    showChart,
    hardware,
    recommendedModels,
    installedModels,
    hfModels,
    searchQuery,
    isSearching,
    downloadProgress,
    localSettings,
    hfToken,
    saveHfToken,
    isModelInstalled,
    downloadModel,
    loadModel,
    unloadModel,
    deleteModel,
    onSearchInput,
    handleSaveRuntime,
    getStateIcon,
    getStateLabel,
    formatNumber
  };
}
