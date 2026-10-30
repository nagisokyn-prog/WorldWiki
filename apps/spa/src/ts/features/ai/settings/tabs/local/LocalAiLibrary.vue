<template>
  <div class="sub-pane">
    <div v-if="installedModels.length === 0" class="empty-state">
      <i class="fas fa-folder-open empty-icon"></i>
      <p>У вас пока нет скачанных локальных моделей.</p>
      <button class="btn-primary" @click="$emit('switch-tab', 'recommended')">
        <i class="fas fa-star"></i> Посмотреть рекомендованные
      </button>
    </div>

    <div v-else class="installed-list">
      <div 
        v-for="m in installedModels" 
        :key="m.id" 
        class="installed-card" 
        :class="{ 'is-active-model': localSettings?.model === m.filename }"
      >
        <div class="installed-main">
          <div class="installed-title-row">
            <span class="installed-name">{{ m.name }}</span>
            <span v-if="localSettings?.model === m.filename" class="active-pill">
              <i class="fas fa-check-circle"></i> Активная модель чата
            </span>
            <span v-if="localSettings?.embed_model_path === m.filename" class="active-pill embed-pill">
              <i class="fas fa-brain"></i> Активный эмбеддер
            </span>
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
            @click="$emit('load', m.filename, m.kind)"
          >
            <i class="fas fa-play"></i> Загрузить в память
          </button>
          <button 
            v-if="m.state === 'ready' || m.state === 'idle'" 
            class="btn-secondary-outline" 
            @click="$emit('unload', m.filename)"
          >
            <i class="fas fa-stop"></i> Выгрузить
          </button>
          <button 
            class="btn-danger-outline" 
            title="Удалить файл модели с диска" 
            @click="$emit('delete', m.filename)"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LocalAiLibraryProps, LocalAiLibraryEmits } from './LocalAiLibrary.model';
import type { InstalledModelInfo, AiProfileSettings, ModelLifecycleState } from '../../../types/ai.types';

defineProps<LocalAiLibraryProps>();

defineEmits<LocalAiLibraryEmits>();
</script>
