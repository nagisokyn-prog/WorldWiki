<template>
  <div>
    <div class="ww-inspector-section-title">{{ sectionTitle }}</div>
    <div v-if="items.length === 0" class="ww-inspector-empty">
      {{ emptyMessage }}
    </div>
    <ul v-else class="ww-inspector-list">
      <li
        v-for="item in displayItems"
        :key="item.id"
        class="ww-inspector-item"
        :style="item.level ? { paddingLeft: `${((item.level || 1) - 1) * 12 + 8}px` } : undefined"
      >
        <div class="ww-inspector-item-content" @click="$emit('jump', item.id)">
          <span class="ww-inspector-num">
            {{ item.displayNumber }}
          </span>
          <span class="ww-inspector-label" :title="item.title">{{ item.title }}</span>
        </div>
        <div class="ww-inspector-actions">
          <button
            type="button"
            class="ww-inspector-insert-btn"
            title="Вставить ссылку в текст"
            @click="$emit('insert', item)"
          >
            + Ссылка
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { AcademicItemListProps, AcademicItemListEmits } from './AcademicItemList.model';
import { useAcademicItemList, type AcademicItemListProps } from './useAcademicItemList';
import type { InspectorItem } from '../AcademicInspector.model';

export type AcademicItem = InspectorItem;

const props = defineProps<AcademicItemListProps>();

defineEmits<AcademicItemListEmits>();

const { displayItems } = useAcademicItemList(props);
</script>
