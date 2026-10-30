<template>
  <div class="atlas-tab-pane tab-pane">
    <div class="snippets-intro">
      <p>Готовые стилизованные формулировки текущего момента времени для быстрой вставки в текст глав или сносок летописей:</p>
    </div>

    <div class="snippets-list">
      <div
        v-for="(snip, sIdx) in snippetFormats"
        :key="sIdx"
        class="snippet-card glass-panel"
      >
        <div class="snippet-header">
          <span class="snippet-title">{{ snip.title }}</span>
          <button
            class="copy-btn interactive-el"
            :class="{ copied: copiedIdx === sIdx }"
            @click="copySnippet(snip.text, sIdx)"
          >
            <i :class="copiedIdx === sIdx ? 'fas fa-check' : 'fas fa-copy'"></i>
            {{ copiedIdx === sIdx ? 'Скопировано!' : 'Копировать' }}
          </button>
        </div>
        <div class="snippet-text">«{{ snip.text }}»</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TimeAtlasSnippetsTabProps, TimeAtlasSnippetsTabEmits } from './TimeAtlasSnippetsTab.model';
defineProps<TimeAtlasSnippetsTabProps>>();
</script>
