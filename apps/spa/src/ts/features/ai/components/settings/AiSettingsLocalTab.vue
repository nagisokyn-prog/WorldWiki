<template>
  <div class="local-ai-tab">
    <!-- Монитор оборудования ПК -->
    <div class="hardware-banner">
      <div class="hw-item">
        <i class="fas fa-microchip hw-icon"></i>
        <div class="hw-details">
          <span class="hw-title">Оперативная память (RAM)</span>
          <span class="hw-val">{{ hardware?.free_ram_gb || 0 }} ГБ свободно из {{ hardware?.total_ram_gb || 0 }} ГБ</span>
        </div>
      </div>
      <div class="hw-item">
        <i class="fas fa-desktop hw-icon" :class="{ 'text-success': hardware?.is_gpu_available }"></i>
        <div class="hw-details">
          <span class="hw-title">Видеокарта и VRAM</span>
          <span class="hw-val">{{ hardware?.free_vram_gb || 0 }} ГБ свободно из {{ hardware?.total_vram_gb || 0 }} ГБ ({{ hardware?.gpu_name || 'GPU' }})</span>
        </div>
      </div>
    </div>

    <!-- Внутренние вкладки локального ИИ -->
    <div class="local-nav">
      <button 
        class="local-nav-btn" 
        :class="{ active: subTab === 'recommended' }" 
        @click="subTab = 'recommended'"
      >
        <i class="fas fa-star"></i> Рекомендованные
      </button>
      <button 
        class="local-nav-btn" 
        :class="{ active: subTab === 'library' }" 
        @click="subTab = 'library'"
      >
        <i class="fas fa-folder"></i> Моя библиотека ({{ installedModels.length }})
      </button>
      <button 
        class="local-nav-btn" 
        :class="{ active: subTab === 'explore' }" 
        @click="subTab = 'explore'"
      >
        <i class="fas fa-search"></i> Поиск на Hugging Face
      </button>
      <button 
        class="local-nav-btn" 
        :class="{ active: subTab === 'runtime' }" 
        @click="subTab = 'runtime'"
      >
        <i class="fas fa-cogs"></i> Среда выполнения
      </button>
    </div>

    <!-- 1. РЕКОМЕНДОВАННЫЕ МОДЕЛИ -->
    <div v-if="subTab === 'recommended'" class="sub-pane">
      <p class="text-muted">
        Отобранные и протестированные модели, которые отлично владеют русским языком, пишут выразительные художественные тексты и бережно относятся к ресурсам ПК.
      </p>

      <div class="recommended-grid">
        <div v-for="card in recommendedModels" :key="card.id" class="model-rec-card">
          <div class="rec-header">
            <div class="rec-title-wrap">
              <span class="rec-name">{{ card.name }}</span>
              <span class="rec-tagline">{{ card.tagline }}</span>
            </div>
            <span class="rec-size-badge">{{ card.size_gb }} ГБ</span>
          </div>

          <p class="rec-desc">{{ card.description }}</p>

          <div class="rec-tags">
            <span v-for="tag in card.tags" :key="tag" class="tag-pill">{{ tag }}</span>
            <span class="license-pill" :class="{ 'license-ok': card.is_commercial_allowed }">
              <i class="fas fa-shield-alt"></i> {{ card.license_name }}
            </span>
          </div>

          <div class="rec-footer">
            <div v-if="downloadProgress[card.filename]" class="progress-box">
              <div class="progress-bar-bg">
                <div class="progress-fill" :style="{ width: downloadProgress[card.filename].percent + '%' }"></div>
              </div>
              <span class="progress-text">Загрузка: {{ Math.round(downloadProgress[card.filename].percent) }}%</span>
            </div>
            <button 
              v-else-if="isModelInstalled(card.filename)" 
              class="btn-installed" 
              disabled
            >
              <i class="fas fa-check-circle"></i> Уже установлена
            </button>
            <button 
              v-else 
              class="btn-primary" 
              @click="downloadModel(card.repo_id, card.filename)"
            >
              <i class="fas fa-download"></i> Скачать ({{ card.recommended_quant }})
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. МОЯ БИБЛИОТЕКА (INSTALLED) -->
    <div v-if="subTab === 'library'" class="sub-pane">
      <div v-if="installedModels.length === 0" class="empty-state">
        <i class="fas fa-folder-open empty-icon"></i>
        <p>У вас пока нет скачанных локальных моделей.</p>
        <button class="btn-primary" @click="subTab = 'recommended'">
          <i class="fas fa-star"></i> Посмотреть рекомендованные
        </button>
      </div>

      <div v-else class="installed-list">
        <div v-for="m in installedModels" :key="m.id" class="installed-card">
          <div class="installed-main">
            <div class="installed-title-row">
              <span class="installed-name">{{ m.name }}</span>
              <span class="state-badge" :class="'state-' + m.state">
                <i class="fas" :class="getStateIcon(m.state)"></i> {{ getStateLabel(m.state) }}
              </span>
            </div>
            <span class="installed-meta">Файл: <code>{{ m.filename }}</code> • Размер: {{ m.size_gb }} ГБ • Тип: {{ m.kind === 'embedding' ? 'Эмбеддинг (Лор)' : 'Генерация (Чат)' }}</span>
          </div>

          <div class="installed-actions">
            <button 
              v-if="m.state === 'installed' || m.state === 'sleeping'" 
              class="btn-secondary" 
              @click="loadModel(m.filename)"
            >
              <i class="fas fa-play"></i> Загрузить в память
            </button>
            <button 
              v-if="m.state === 'ready' || m.state === 'idle'" 
              class="btn-secondary-outline" 
              @click="unloadModel(m.filename)"
            >
              <i class="fas fa-stop"></i> Выгрузить
            </button>
            <button 
              class="btn-danger-outline" 
              title="Удалить файл модели с диска" 
              @click="deleteModel(m.filename)"
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. ПОИСК ПО HUGGING FACE -->
    <div v-if="subTab === 'explore'" class="sub-pane">
      <div class="search-bar">
        <i class="fas fa-search search-icon"></i>
        <input 
          v-model="searchQuery" 
          type="text" 
          class="input-base search-input" 
          placeholder="Поиск моделей по Hugging Face (например: Russian, Qwen, Saiga)..." 
          @input="onSearchInput" 
        />
      </div>

      <div class="hf-token-box">
        <div class="form-group" style="margin: 0;">
          <label style="font-size: 12px;">Токен Hugging Face (опционально, для моделей с ограниченным доступом):</label>
          <input 
            v-model="hfToken" 
            type="password" 
            class="input-base" 
            placeholder="hf_..." 
            style="font-size: 12px; padding: 6px 10px;"
            @change="saveHfToken" 
          />
        </div>
      </div>

      <div v-if="isSearching" class="loading-state">
        <i class="fas fa-spinner fa-spin"></i> Поиск моделей на Hugging Face...
      </div>

      <div v-else class="hf-models-list">
        <div v-for="hf in hfModels" :key="hf.id" class="hf-card">
          <div class="hf-header">
            <div>
              <span class="hf-title">{{ hf.name }}</span>
              <span class="hf-author">от {{ hf.author || hf.id.split('/')[0] }}</span>
            </div>
            <div class="hf-stats">
              <span><i class="fas fa-download"></i> {{ formatNumber(hf.downloads) }}</span>
              <span><i class="fas fa-heart"></i> {{ formatNumber(hf.likes) }}</span>
            </div>
          </div>

          <div class="hf-files-list">
            <label class="hf-files-label">Доступные файлы квантования:</label>
            <div class="files-chips">
              <div v-for="f in hf.gguf_files" :key="f.filename" class="file-chip">
                <span class="chip-name">{{ f.quantization }}</span>
                <button 
                  class="chip-btn" 
                  :disabled="isModelInstalled(f.filename) || !!downloadProgress[f.filename]"
                  @click="downloadModel(hf.id, f.filename)"
                >
                  <i class="fas" :class="isModelInstalled(f.filename) ? 'fa-check' : 'fa-download'"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. СРЕДА ВЫПОЛНЕНИЯ (ГИК-НАСТРОЙКИ) -->
    <div v-if="subTab === 'runtime'" class="sub-pane">
      <div v-if="localSettings" class="runtime-card">
        <h4>Параметры инференса llama.cpp</h4>
        <p class="text-muted">
          Тонкая настройка аппаратного ускорения и распределения памяти для локальных моделей.
        </p>

        <div class="form-row-2" style="margin-top: 14px;">
          <div class="form-group">
            <label>Размер контекста (Токены)</label>
            <input 
              v-model.number="localSettings.n_ctx" 
              type="number" 
              class="input-base" 
              placeholder="8192" 
            />
            <span class="field-hint">Рекомендуется: 8192 или 16384.</span>
          </div>

          <div class="form-group">
            <label>Слои на GPU (GPU Offload Layers)</label>
            <input 
              v-model.number="localSettings.n_gpu_layers" 
              type="number" 
              class="input-base" 
              placeholder="-1 (Все слои на GPU)" 
            />
            <span class="field-hint">Значение -1 выгружает все слои на видеокарту.</span>
          </div>
        </div>

        <div class="form-group" style="margin-top: 14px;">
          <label class="toggle-row">
            <input 
              v-model="localSettings.enable_tcq" 
              type="checkbox" 
            />
            <div class="toggle-text">
              <span class="toggle-title">Включить TurboQuant (TCQ) сжатие KV-кэша</span>
              <span class="toggle-desc">Снижает потребление видеопамяти кэшем на 60% без потери связности текста.</span>
            </div>
          </label>
        </div>

        <div class="form-actions" style="margin-top: 20px;">
          <button class="btn-primary" @click="handleSaveRuntime">
            <i class="fas fa-check"></i> Сохранить параметры среды
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { 
  AiProfile, 
  AiProfileSettings,
  HardwareInfo, 
  InstalledModelInfo, 
  ModelLifecycleState, 
  RecommendedModelCard 
} from '../../types/ai.types';

interface HfGgufFile {
  filename: string;
  quantization: string;
  size_bytes: number;
  size_gb: number;
}

interface HfModelItem {
  id: string;
  name: string;
  author?: string;
  downloads: number;
  likes: number;
  tags: string[];
  gguf_files: HfGgufFile[];
}

const props = defineProps<{
  activeProfile: AiProfile | null;
}>();

const emit = defineEmits(['save-profile']);

const subTab = ref<'recommended' | 'library' | 'explore' | 'runtime'>('recommended');
const hardware = ref<HardwareInfo | null>(null);
const recommendedModels = ref<RecommendedModelCard[]>([]);
const installedModels = ref<InstalledModelInfo[]>([]);
const hfModels = ref<HfModelItem[]>([]);
const searchQuery = ref('');
const isSearching = ref(false);
const downloadProgress = ref<Record<string, { percent: number }>>({});
const localSettings = ref<AiProfileSettings | null>(null);

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

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

onMounted(async () => {
  await loadHardware();
  await loadRecommended();
  await loadInstalled();
  listenToProgress();
});

const handleSaveRuntime = () => {
  if (localSettings.value) {
    emit('save-profile', { settings: localSettings.value });
  }
};

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

const loadModel = async (filename: string) => {
  try {
    await invoke('load_local_model', { filename });
    await loadInstalled();
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
  if (!confirm(`Удалить файл модели ${filename} с диска?`)) return;
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

const listenToProgress = async () => {
  try {
    await listen<{ filename?: string; is_done?: boolean; percent: number }>('model_download_progress', (event) => {
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
};

const getStateLabel = (state: ModelLifecycleState) => {
  const map: Record<ModelLifecycleState, string> = {
    installed: 'Выгружено (На диске)',
    loading: 'Загрузка в память...',
    ready: 'Готово к работе',
    busy: 'Генерация...',
    idle: 'Готово (В памяти)',
    sleeping: 'В режиме ожидания',
    unloading: 'Выгрузка...',
    error: 'Ошибка',
  };
  return map[state] || state;
};

const getStateIcon = (state: ModelLifecycleState) => {
  const map: Record<ModelLifecycleState, string> = {
    installed: 'fa-circle-notch',
    loading: 'fa-spinner fa-spin',
    ready: 'fa-check-circle',
    busy: 'fa-cog fa-spin',
    idle: 'fa-check',
    sleeping: 'fa-moon',
    unloading: 'fa-arrow-down',
    error: 'fa-times-circle',
  };
  return map[state] || 'fa-circle';
};

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('ru-RU').format(num || 0);
};
</script>

<style scoped>
.local-ai-tab {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.hardware-banner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  background: rgba(88, 166, 255, 0.05);
  border: 1px solid rgba(88, 166, 255, 0.18);
  border-radius: 8px;
  padding: 12px 16px;
}
.hw-item {
  display: flex;
  align-items: center;
  gap: 12px;
}
.hw-icon {
  font-size: 24px;
  color: #58a6ff;
}
.hw-icon.text-success {
  color: #3fb950;
}
.hw-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hw-title {
  font-size: 12px;
  color: var(--text-muted, #8b949e);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.hw-val {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color, #e6edf3);
}
.local-nav {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  padding-bottom: 8px;
}
.local-nav-btn {
  background: transparent;
  border: none;
  color: var(--text-muted, #8b949e);
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
}
.local-nav-btn:hover {
  color: var(--text-color, #fff);
  background: rgba(255, 255, 255, 0.04);
}
.local-nav-btn.active {
  color: #58a6ff;
  background: rgba(88, 166, 255, 0.1);
  font-weight: 600;
}
.sub-pane {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.text-muted {
  font-size: 13px;
  color: var(--text-muted, #8b949e);
  margin: 0;
  line-height: 1.5;
}
.recommended-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
.model-rec-card {
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rec-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.rec-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.rec-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color, #fff);
}
.rec-tagline {
  font-size: 12px;
  color: #58a6ff;
}
.rec-size-badge {
  background: rgba(255, 255, 255, 0.08);
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #e6edf3;
}
.rec-desc {
  font-size: 13px;
  color: var(--text-color, #c9d1d9);
  margin: 0;
  line-height: 1.4;
}
.rec-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tag-pill {
  background: rgba(255, 255, 255, 0.05);
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  color: var(--text-muted, #8b949e);
}
.license-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: #e6edf3;
}
.license-ok {
  color: #3fb950;
  background: rgba(63, 185, 80, 0.1);
}
.rec-footer {
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
}
.progress-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.progress-bar-bg {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #58a6ff;
  transition: width 0.3s ease;
}
.progress-text {
  font-size: 12px;
  color: #58a6ff;
  font-weight: 600;
}
.btn-installed {
  background: rgba(63, 185, 80, 0.15);
  color: #3fb950;
  border: 1px solid rgba(63, 185, 80, 0.3);
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
}
.installed-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.installed-card {
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.installed-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.installed-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.installed-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color, #fff);
}
.installed-meta {
  font-size: 12px;
  color: var(--text-muted, #8b949e);
}
.state-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
}
.state-ready, .state-idle {
  background: rgba(63, 185, 80, 0.15);
  color: #3fb950;
}
.state-loading, .state-busy {
  background: rgba(210, 153, 34, 0.15);
  color: #d29922;
}
.state-sleeping {
  background: rgba(188, 140, 255, 0.15);
  color: #bc8cff;
}
.state-installed {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-muted, #8b949e);
}
.state-error {
  background: rgba(248, 81, 73, 0.15);
  color: #f85149;
}
.installed-actions {
  display: flex;
  gap: 8px;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 14px;
  color: var(--text-muted, #8b949e);
}
.empty-icon {
  font-size: 40px;
  opacity: 0.5;
}
.search-bar {
  position: relative;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted, #8b949e);
}
.search-input {
  padding-left: 36px;
}
.hf-token-box {
  background: var(--bg-card, rgba(255, 255, 255, 0.02));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 6px;
  padding: 10px 12px;
}
.hf-models-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hf-card {
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hf-header {
  display: flex;
  justify-content: space-between;
}
.hf-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color, #fff);
  display: block;
}
.hf-author {
  font-size: 12px;
  color: var(--text-muted, #8b949e);
}
.hf-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted, #8b949e);
}
.hf-files-label {
  font-size: 12px;
  color: var(--text-muted, #8b949e);
  margin-bottom: 4px;
  display: block;
}
.files-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.file-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 4px 8px 4px 10px;
  border-radius: 6px;
}
.chip-name {
  font-size: 12px;
  font-weight: 600;
}
.chip-btn {
  background: #58a6ff;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 3px 7px;
  cursor: pointer;
  font-size: 11px;
}
.chip-btn:disabled {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-muted, #8b949e);
  cursor: not-allowed;
}
.runtime-card {
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 16px 18px;
}
.runtime-card h4 {
  margin: 0 0 4px 0;
  font-size: 15px;
  color: var(--text-color, #fff);
}
</style>
