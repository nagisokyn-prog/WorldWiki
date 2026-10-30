<template>
  <div>
    <div v-if="isOpen" class="quick-link-info-panel fixed card-glass z-modal p-4 quick-link-popup">
      <div class="flex justify-between mb-2">
        <strong class="text-accent"><i class="fas fa-bolt"></i> Быстрые ссылки Ctrl+Q</strong>
        <div>
          <button class="text-muted cursor-pointer text-xs mr-2" @click="$emit('dismissForever')">Больше не показывать</button>
          <button class="text-muted cursor-pointer" @click="$emit('close')">✕</button>
        </div>
      </div>
      <ol class="m-0 pl-4 text-sm text-main">
        <li>Напишите текст в квадратных скобках: <code>[Имя]</code></li>
        <li>Установите курсор после скобок</li>
        <li>Нажмите <kbd>Ctrl+Q</kbd></li>
      </ol>
    </div>

    <button
      v-if="!isOpen && !hideForever"
      class="quick-link-hint-circle fixed cursor-pointer quick-link-trigger-btn"
      title="Показать подсказку Ctrl+Q"
      @click="$emit('open')"
    >
      ?
    </button>
  </div>
</template>

<script setup lang="ts">
import type { QuickLinkHintProps, QuickLinkHintEmits } from './QuickLinkHint.model';
defineProps<QuickLinkHintProps>>();

defineEmits<QuickLinkHintEmits>>();
</script>
