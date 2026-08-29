<template>
  <div class="chapters-view">
    <ChaptersMain :project="project" :controlled-chapter-id="controlledChapterId" />
  </div>
</template>

<script setup lang="ts">
import ChaptersMain from './ChaptersMain/ChaptersMain.vue';

withDefaults(defineProps<{
  project: string;
  controlledChapterId?: string | null;
}>(), {
  controlledChapterId: null
});
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/ChaptersMain.css"></style>
