<template>
  <div class="calendar-entity-adapter">
    <CalendarEditor
      :calendar-id="props.calendarId"
      :project-id="props.projectId"
      :is-read-only="props.isPreview"
      @update:calendar="onCalendarUpdate"
      @save="onCalendarSave"
    />
  </div>
</template>

<script setup lang="ts">
import CalendarEditor from '@/features/timeline/CalendarEditor/CalendarEditor.vue';
import type {
  CalendarEntityAdapterProps,
  CalendarEntityAdapterEmits,
} from './CalendarEntityAdapter.model';
import { useCalendarEntityAdapter } from './useCalendarEntityAdapter';

const props = defineProps<CalendarEntityAdapterProps>();
const emit = defineEmits<CalendarEntityAdapterEmits>();

const { onCalendarUpdate, onCalendarSave } = useCalendarEntityAdapter(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/CalendarEntityAdapter.css"></style>
