<template>
  <div class="gun-item-card p-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-all flex flex-col gap-2">
    <!-- Верхняя строка: Тип и Статус -->
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs font-semibold px-2 py-0.5 rounded border flex items-center gap-1" :class="stateBadgeClass">
        <span>{{ typeIcon }}</span>
        <span>{{ item.item_type }}</span>
      </span>
      <span class="text-[11px] font-medium text-muted">
        {{ stateLabel }}
      </span>
    </div>

    <!-- Заголовок артефакта -->
    <h4 class="text-sm font-bold text-main line-clamp-1">
      {{ item.name }}
    </h4>

    <!-- Владелец -->
    <div class="text-xs flex items-center gap-1.5 text-muted">
      <span>👤</span>
      <span v-if="item.current_owner_name" class="text-main font-medium truncate">
        {{ item.current_owner_name }}
      </span>
      <span v-else class="italic text-muted/70">
        Без постоянного владельца
      </span>
    </div>

    <!-- Хронология глав -->
    <div class="text-[11px] text-muted flex items-center justify-between border-t border-border/50 pt-2 mt-1">
      <span class="truncate">{{ chapterRangeLabel }}</span>
      <button
        class="btn-journey text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer flex-shrink-0"
        @click="$emit('view-journey', item)"
      >
        <span>Путь</span>
        <span>→</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GunItemCardProps, GunItemCardEmits } from '../ChekhovGunTracker.model';
import { useGunItemCard } from './useGunItemCard';

const props = defineProps<GunItemCardProps>();
defineEmits<GunItemCardEmits>();

const { item, typeIcon, stateBadgeClass, stateLabel, chapterRangeLabel } = useGunItemCard(() => props.item);
</script>
