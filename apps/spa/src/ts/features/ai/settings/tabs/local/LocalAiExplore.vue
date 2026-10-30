<template>
  <div class="sub-pane">
    <div class="search-bar">
      <i class="fas fa-search search-icon"></i>
      <input 
        :value="searchQuery" 
        type="text" 
        class="input-base search-input" 
        placeholder="Поиск моделей по Hugging Face (например: Russian, Qwen, Saiga)..." 
        @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value); $emit('search-input')" 
      />
    </div>

    <div class="hf-token-box">
      <div class="form-group m-0">
        <label class="text-xs">Токен Hugging Face (опционально, для моделей с ограниченным доступом):</label>
        <input 
          :value="hfToken" 
          type="password" 
          class="input-base hf-token-input" 
          placeholder="hf_..." 
          @input="$emit('update:hfToken', ($event.target as HTMLInputElement).value)"
          @change="$emit('save-hf-token')" 
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
            <div 
              v-for="f in hf.gguf_files" 
              :key="f.filename" 
              class="file-chip" 
              :class="{ 'is-downloading': !!downloadProgress[f.filename] }"
            >
              <span class="chip-name">{{ f.quantization }}</span>

              <div v-if="downloadProgress[f.filename]" class="chip-progress">
                <div class="chip-progress-bar">
                  <div class="chip-progress-fill" :style="{ '--dl-progress': downloadProgress[f.filename].percent + '%' }"></div>
                </div>
                <span class="chip-progress-text">{{ (downloadProgress[f.filename].percent || 0).toFixed(1) }}%</span>
              </div>

              <button 
                v-else
                class="chip-btn" 
                :disabled="isModelInstalled(f.filename)"
                @click="$emit('download', hf.id, f.filename)"
              >
                <i class="fas" :class="isModelInstalled(f.filename) ? 'fa-check' : 'fa-download'"></i>
                <span class="ml-1">{{ isModelInstalled(f.filename) ? 'Установлено' : 'Скачать' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LocalAiExploreProps, LocalAiExploreEmits } from './LocalAiExplore.model';

defineProps<LocalAiExploreProps>();

defineEmits<LocalAiExploreEmits>();
</script>
