<template>
  <div class="calendar-editor">
    <div v-if="isLoading" class="calendar-editor-loading">Загрузка календаря...</div>
    <div v-else-if="calendarRecord" class="calendar-editor-content">
      <!-- Dashboard баннер шапки -->
      <header class="calendar-dashboard-banner">
        <div class="dashboard-left">
          <div class="dashboard-title-row">
            <span class="dashboard-icon">📜</span>
            <input
              type="text"
              class="dashboard-title-input"
              :value="calendarRecord.name || calendarRecord.data?.название || 'Календарь'"
              :disabled="isReadOnly"
              @input="updateName(($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="dashboard-tags">
            <span class="status-chip">📅 Год: <strong>{{ totalDays }} дн.</strong></span>
            <span v-if="calendarRecord.is_master" class="status-chip warning">🌟 Мастер-календарь</span>
          </div>
        </div>

        <div class="dashboard-actions">
          <button type="button" class="btn-action" title="Аудит календаря" @click="openAuditModal">
            🔍 Аудит
          </button>
          <button
            type="button"
            class="btn-action btn-primary"
            :disabled="isReadOnly || isSaving"
            title="Сохранить изменения"
            @click="saveCalendar"
          >
            {{ isSaving ? '💾 Сохранение...' : '💾 Сохранить' }}
          </button>
          <button
            v-if="!isReadOnly"
            type="button"
            class="btn-action btn-danger"
            title="Удалить календарь"
            @click="deleteCalendar"
          >
            🗑️
          </button>
        </div>
      </header>

      <!-- Горизонтальная таб-навигация -->
      <nav class="calendar-tab-nav" role="tablist">
        <button
          v-for="tab in tabsList"
          :key="tab.id"
          type="button"
          class="tab-button"
          :class="{ active: activeTab === tab.id }"
          role="tab"
          :aria-selected="activeTab === tab.id"
          @click="setTab(tab.id)"
        >
          <span>{{ tab.icon }} {{ tab.label }}</span>
          <span v-if="tab.badge" class="tab-badge" :class="{ warning: tab.isWarning }">{{ tab.badge }}</span>
        </button>
      </nav>

      <!-- Контейнер активной вкладки -->
      <main class="calendar-tab-content">
        <Tab1Structure
          v-if="activeTab === 'timeGrid'"
          :calendar-data="calData"
          :is-read-only="isReadOnly"
          @update="patchCalendarData"
        />
        <Tab2ErasSync
          v-else-if="activeTab === 'erasSync'"
          :calendar-data="calData"
          :master-calendar-data="masterCalData"
          :is-read-only="isReadOnly"
          @update="patchCalendarData"
        />
        <Tab3CultureLore
          v-else-if="activeTab === 'cultureLore'"
          :calendar-data="calData"
          :is-read-only="isReadOnly"
          @update="patchCalendarData"
        />
        <Tab4Playground
          v-else-if="activeTab === 'playground'"
          :calendar-data="calData"
          :is-read-only="isReadOnly"
          @update="patchCalendarData"
        />
        <Tab5ReformsDst
          v-else-if="activeTab === 'reformsDst'"
          :calendar-data="calData"
          :is-read-only="isReadOnly"
          @update="patchCalendarData"
        />
      </main>
    </div>

    <!-- Модалка аудита календаря -->
    <CalendarAuditModal
      v-if="isAuditModalOpen && calData"
      :model-value="isAuditModalOpen"
      :calendar="calData"
      @update:model-value="isAuditModalOpen = $event"
    />
  </div>
</template>

<script setup lang="ts">
import type { CalendarEditorProps, CalendarEditorEmits } from './CalendarEditor.model';
import { useCalendarEditor } from './useCalendarEditor';
import Tab1Structure from './Tab1Structure/Tab1Structure.vue';
import Tab2ErasSync from './Tab2ErasSync/Tab2ErasSync.vue';
import Tab3CultureLore from './Tab3CultureLore/Tab3CultureLore.vue';
import Tab4Playground from './Tab4Playground/Tab4Playground.vue';
import Tab5ReformsDst from './Tab5ReformsDst/Tab5ReformsDst.vue';
import CalendarAuditModal from '../Calendars/CalendarAuditModal/CalendarAuditModal.vue';

const props = defineProps<CalendarEditorProps>();
const emit = defineEmits<CalendarEditorEmits>();

const {
  activeTab,
  calendarRecord,
  calData,
  masterCalData,
  isLoading,
  isSaving,
  isAuditModalOpen,
  tabsList,
  totalDays,
  setTab,
  saveCalendar,
  deleteCalendar,
  openAuditModal,
  patchCalendarData,
  updateName,
} = useCalendarEditor(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarEditor.css"></style>
