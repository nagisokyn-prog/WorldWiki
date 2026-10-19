<template>
  <div v-if="props.isPreviewing" class="history-preview-banner">
    <span>👁️ Вы просматриваете сохраненную версию от <strong>{{ props.formattedDate }}</strong></span>
    <div class="flex gap-2">
      <button class="btn btn-small btn-primary" @click="emit('restore')">Восстановить эту версию</button>
      <button class="btn btn-small btn-outline" @click="emit('exit')">Выйти</button>
    </div>
  </div>
  <div v-else-if="props.isSandbox" class="history-preview-banner banner-sandbox-preview">
    <span>🧪 <strong>Песочница:</strong> Предпросмотр кастомной схемы</span>
  </div>
</template>

<script setup lang="ts">
import type { EntityHistoryBannerProps, EntityHistoryBannerEmits } from '../EntityEditor.model';

const props = defineProps<EntityHistoryBannerProps>();
const emit = defineEmits<EntityHistoryBannerEmits>();
</script>
