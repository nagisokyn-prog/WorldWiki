<template>
  <div class="gun-status-column">
    <!-- Header колонки -->
    <div class="column-header">
      <div class="column-title-group">
        <span class="column-icon">{{ icon }}</span>
        <h3 class="column-title">{{ title }}</h3>
      </div>
      <span class="column-badge" :class="colorClass">
        {{ itemCount }}
      </span>
    </div>

    <!-- Список карточек -->
    <div class="column-body">
      <div v-if="isEmpty" class="column-empty-placeholder">
        {{ emptyText }}
      </div>

      <GunItemCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        @view-journey="$emit('view-journey', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GunStatusColumnProps, GunStatusColumnEmits } from '../../ChekhovGunTracker.model';
import GunItemCard from '../GunItemCard/GunItemCard.vue';
import { useGunStatusColumn } from './useGunStatusColumn';

const props = defineProps<GunStatusColumnProps>();
defineEmits<GunStatusColumnEmits>();

const { itemCount, isEmpty, emptyText } = useGunStatusColumn(() => props);
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/ChekhovGunTracker.css"></style>
