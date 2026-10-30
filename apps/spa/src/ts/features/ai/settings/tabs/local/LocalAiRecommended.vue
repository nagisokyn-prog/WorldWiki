<template>
  <div class="sub-pane">
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
              <div class="progress-fill" :style="{ '--rec-progress': downloadProgress[card.filename].percent + '%' }"></div>
            </div>
            <span class="progress-text">Загрузка: {{ (downloadProgress[card.filename].percent || 0).toFixed(1) }}%</span>
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
            @click="$emit('download', card.repo_id, card.filename)"
          >
            <i class="fas fa-download"></i> Скачать ({{ card.recommended_quant }})
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LocalAiRecommendedProps, LocalAiRecommendedEmits } from './LocalAiRecommended.model';
import type { RecommendedModelCard } from '../../../types/ai.types';

defineProps<LocalAiRecommendedProps>();

defineEmits<LocalAiRecommendedEmits>();
</script>
