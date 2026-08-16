<template>
  <div class="chapters-view" style="width: 100%; height: 100%; background: var(--bg-main);">
    <ChaptersMain :project="project" :controlled-chapter-id="controlledChapterId" />
  </div>
</template>

<script setup lang="ts">
import ChaptersMain from './ChaptersMain/ChaptersMain.vue';

defineProps({
  project: { type: String, required: true },
  controlledChapterId: { type: String, default: null }
});
</script>
