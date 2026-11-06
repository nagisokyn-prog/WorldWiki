<template>
  <div v-if="totalHiddenCount > 0" class="hidden-manager-trigger relative flex-shrink-0 ml-2 z-40">
    <button
      type="button"
      class="btn-new btn-outline-new text-xs interactive-el flex items-center gap-1"
      :title="'Скрыто элементов: ' + totalHiddenCount"
      @click="$emit('toggleOpen')"
    >
      <span>👁️‍🗨️</span>
      <span>Скрыто ({{ totalHiddenCount }})</span>
    </button>

    <!-- Подложка для закрытия по клику снаружи -->
    <div v-if="isOpen" class="fixed inset-0 z-30" @click="$emit('close')"></div>

    <!-- Дропдаун скрытых элементов -->
    <div v-if="isOpen" class="hidden-manager-menu dropdown-panel z-50">
      <div class="hidden-menu-header flex justify-between items-center pb-2 mb-2 border-b">
        <span class="font-bold text-xs">Скрытые элементы</span>
        <button type="button" class="text-xs text-accent hover:underline cursor-pointer" @click="$emit('unhideAll')">
          Восстановить всё
        </button>
      </div>

      <!-- Скрытые страницы -->
      <div v-if="hiddenSectionsList.length > 0" class="hidden-group mb-2">
        <div class="text-xs text-muted font-semibold mb-1">Страницы:</div>
        <div v-for="item in hiddenSectionsList" :key="item.id" class="hidden-item flex justify-between items-center py-1 text-xs">
          <span>{{ item.label }}</span>
          <button type="button" class="btn-restore-item text-accent cursor-pointer" @click="$emit('unhideSection', item.id)">
            Показать
          </button>
        </div>
      </div>

      <!-- Скрытые поля -->
      <div v-if="hiddenFieldsList.length > 0" class="hidden-group mb-2">
        <div class="text-xs text-muted font-semibold mb-1">Поля:</div>
        <div v-for="item in hiddenFieldsList" :key="item.id" class="hidden-item flex justify-between items-center py-1 text-xs">
          <span>{{ item.label }}</span>
          <button type="button" class="btn-restore-item text-accent cursor-pointer" @click="$emit('unhideField', item.id)">
            Показать
          </button>
        </div>
      </div>

      <!-- Скрытые контейнеры -->
      <div v-if="hiddenContainersList.length > 0" class="hidden-group">
        <div class="text-xs text-muted font-semibold mb-1">Связи и блоки:</div>
        <div v-for="item in hiddenContainersList" :key="item.id" class="hidden-item flex justify-between items-center py-1 text-xs">
          <span>{{ item.label }}</span>
          <button type="button" class="btn-restore-item text-accent cursor-pointer" @click="$emit('unhideContainer', item.id)">
            Показать
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EntityHiddenManagerProps, EntityHiddenManagerEmits } from './EntityHiddenManager.model';
import { useEntityHiddenManager } from './useEntityHiddenManager';

const props = defineProps<EntityHiddenManagerProps>();
defineEmits<EntityHiddenManagerEmits>();

const { hiddenSectionsList, hiddenFieldsList, hiddenContainersList } = useEntityHiddenManager(props);
</script>

