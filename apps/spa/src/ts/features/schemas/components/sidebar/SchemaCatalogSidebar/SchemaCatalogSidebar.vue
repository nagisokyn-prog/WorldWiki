<template>
  <div class="schema-resizer" @mousedown="$emit('start-resize', $event)"></div>
  <aside class="schema-catalog" :style="{ '--catalog-w': catalogWidth + 'px' }">
    <div class="catalog-section-title">БАЗОВЫЕ ПОЛЯ</div>
    <div class="flex-col gap-2 p-2">
      <div
        v-for="brick in atomicBricks"
        :key="brick.val"
        class="catalog-item interactive-el"
        draggable="true"
        @dragstart="$emit('drag-start-palette', $event, 'atomic', brick.val, brick.label)"
      >
        <span class="text-lg">{{ brick.icon }}</span>
        <span class="text-xs font-bold">{{ brick.label }}</span>
      </div>
    </div>

    <div class="catalog-section-title mt-2">⏱️ TIMELINE-МОДУЛИ</div>
    <div class="flex-col gap-2 p-2">
      <div
        v-for="(tpl, key) in timelineTemplates"
        :key="key"
        class="catalog-item interactive-el flex justify-between items-center"
        draggable="true"
        @dragstart="$emit('drag-start-palette', $event, 'module', String(key), String(key))"
      >
        <div class="flex items-center gap-2">
          <span class="text-lg">⏱️</span>
          <span class="text-xs font-bold">{{ key }}</span>
        </div>
        <ModuleHelpPreview :template-key="String(key)" />
      </div>
    </div>

    <div class="catalog-section-title mt-2">📋 DYNAMIC-МОДУЛИ</div>
    <div class="flex-col gap-2 p-2">
      <div
        v-for="(tpl, key) in dynamicTemplates"
        :key="key"
        class="catalog-item interactive-el flex justify-between items-center"
        draggable="true"
        @dragstart="$emit('drag-start-palette', $event, 'module', String(key), String(key))"
      >
        <div class="flex items-center gap-2">
          <span class="text-lg">{{ tpl.isBidirectional ? '🤝' : '📋' }}</span>
          <span class="text-xs font-bold">{{ key }}</span>
        </div>
        <ModuleHelpPreview :template-key="String(key)" />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { SchemaCatalogSidebarProps, SchemaCatalogSidebarEmits } from './SchemaCatalogSidebar.model';
import ModuleHelpPreview from '@/features/schemas/components/help/ModuleHelpPreview/ModuleHelpPreview.vue';

defineProps<SchemaCatalogSidebarProps>();

defineEmits<SchemaCatalogSidebarEmits>();
</script>
