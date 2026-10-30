<template>
  <div class="chapters-view">
    <ChaptersMain :project="project" :controlled-chapter-id="controlledChapterId" />
  </div>
</template>

<script setup lang="ts">
import type { ChaptersViewProps } from './ChaptersView.model';
import ChaptersMain from './ChaptersMain/ChaptersMain.vue';

withDefaults(defineProps<ChaptersViewProps>(), {
  controlledChapterId: null
});
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/ChaptersMain.css"></style>
