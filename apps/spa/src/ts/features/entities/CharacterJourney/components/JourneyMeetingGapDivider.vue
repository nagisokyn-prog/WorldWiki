<template>
  <div class="journey-meeting-gap-divider" role="separator">
    <div class="gap-line"></div>
    <div class="gap-badge" :title="`Разрыв между совместными сценами: ${gap.chapters_count} глав`">
      <span>{{ gap.formatted_label }}</span>
    </div>
    <div class="gap-line"></div>
  </div>
</template>

<script setup lang="ts">
import type { JourneyMeetingGap } from '../CharacterJourney.model';

defineProps<{
  gap: JourneyMeetingGap;
}>();
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/CharacterJourney.css"></style>
