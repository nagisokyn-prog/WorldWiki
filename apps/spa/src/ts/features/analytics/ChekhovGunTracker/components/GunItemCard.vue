<template>
  <div class="gun-item-card">
    <!-- Верхняя строка: Тип и Статус (как на карточках Скрина 4) -->
    <div class="card-header-row">
      <span class="category-badge" :class="stateBadgeClass">
        <span class="category-icon">{{ typeIcon }}</span>
        <span>{{ item.item_type }}</span>
      </span>
      <span class="status-badge">
        {{ stateLabel }}
      </span>
    </div>

    <!-- Текст ружья (цитата) или заголовок артефакта -->
    <div v-if="isPromise" class="gun-quote-box" :title="item.name">
      <p class="gun-quote-text">«{{ item.name }}»</p>
    </div>
    <h4 v-else class="item-title" :title="item.name">
      {{ item.name }}
    </h4>

    <!-- Владелец или Участники сцены -->
    <div class="participant-row">
      <span class="participant-icon">{{ isPromise ? '🎭' : '👤' }}</span>
      <span class="participant-name">
        {{ participantOrOwnerLabel }}
      </span>
    </div>

    <!-- Хронология глав и кнопка перехода -->
    <div class="card-footer-row">
      <span class="chapter-meta">
        <span class="chapter-meta-icon">📅</span>
        <span>{{ chapterRangeLabel }}</span>
      </span>
      <button
        class="btn-journey-pill"
        @click="$emit('view-journey', item)"
      >
        <span>{{ actionButtonText }}</span>
        <span class="arrow-icon">→</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GunItemCardProps, GunItemCardEmits } from '../ChekhovGunTracker.model';
import { useGunItemCard } from './useGunItemCard';

const props = defineProps<GunItemCardProps>();
defineEmits<GunItemCardEmits>();

const {
  item,
  isPromise,
  typeIcon,
  stateBadgeClass,
  stateLabel,
  participantOrOwnerLabel,
  chapterRangeLabel,
  actionButtonText,
} = useGunItemCard(() => props.item);
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/ChekhovGunTracker.css"></style>
