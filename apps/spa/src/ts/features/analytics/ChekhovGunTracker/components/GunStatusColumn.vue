<template>
  <div class="gun-status-column flex flex-col flex-1 min-w-[280px] max-w-[420px] rounded-xl border border-border bg-surface-alt/50 overflow-hidden shadow-sm">
    <!-- Header колонки -->
    <div class="column-header p-3 border-b border-border flex items-center justify-between bg-card/60">
      <div class="flex items-center gap-2">
        <span class="text-base">{{ icon }}</span>
        <h3 class="text-sm font-bold text-main">{{ title }}</h3>
      </div>
      <span class="badge text-xs font-bold px-2 py-0.5 rounded-full" :class="colorClass">
        {{ itemCount }}
      </span>
    </div>

    <!-- Список карточек -->
    <div class="column-body flex-1 overflow-y-auto p-3 space-y-2.5">
      <div v-if="isEmpty" class="empty-placeholder p-4 text-center text-xs text-muted italic rounded-lg border border-dashed border-border/60">
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
import type { GunStatusColumnProps, GunStatusColumnEmits } from '../ChekhovGunTracker.model';
import GunItemCard from './GunItemCard.vue';
import { useGunStatusColumn } from './useGunStatusColumn';

const props = defineProps<GunStatusColumnProps>();
defineEmits<GunStatusColumnEmits>();

const { itemCount, isEmpty, emptyText } = useGunStatusColumn(() => props);
</script>
