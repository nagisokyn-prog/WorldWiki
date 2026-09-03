<template>
  <!--
    HistorySidebar.vue — Git-like version history for any SurrealDB entity.

    Usage:
      <HistorySidebar
        entity-type="articles"
        :project="currentProjectId"
        :type-key="'article'"
        @restore="onRestore"
      />

    Backend requirement: Rust entity must call save_schema_history() on save,
    or use the #[versioned] attribute (future feature).
  -->
  <div class="history-sidebar">
    <div class="history-sidebar__header">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>
        <path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>
        <path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>
        <path d="M7 8l0 8"/>
        <path d="M9 18h6a2 2 0 0 0 2 -2v-5"/>
        <path d="M14 14l3 -3l3 3"/>
      </svg>
      <span>Version History</span>
      <span class="history-sidebar__count">{{ entries.length }}</span>
    </div>

    <div v-if="loading" class="history-sidebar__loader">
      <span class="history-sidebar__spinner" />
      Loading history...
    </div>

    <div v-else-if="entries.length === 0" class="history-sidebar__empty">
      <p>No history yet.</p>
      <small>Save the entity to create a snapshot.</small>
    </div>

    <div v-else class="history-sidebar__list">
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="history-entry"
        :class="{ 'history-entry--pinned': entry.is_pinned }"
      >
        <div class="history-entry__line">
          <span class="history-entry__dot" :class="{ 'history-entry__dot--pinned': entry.is_pinned }" />
        </div>
        <div class="history-entry__body">
          <div class="history-entry__time">{{ formatDate(entry.saved_at) }}</div>
          <div class="history-entry__meta">
            <span v-if="entry.is_pinned" class="history-entry__pin">📌 Pinned</span>
          </div>
          <div class="history-entry__actions">
            <button class="history-btn" title="Restore this version" @click="restore(entry)">
              ↩ Restore
            </button>
            <button
              class="history-btn history-btn--ghost"
              :title="entry.is_pinned ? 'Unpin' : 'Pin (won\'t be auto-deleted)'"
              @click="togglePin(entry)"
            >
              {{ entry.is_pinned ? '📌' : '📍' }}
            </button>
            <button class="history-btn history-btn--danger" title="Delete snapshot" @click="deleteEntry(entry)">
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  useHistorySidebar, 
  type HistorySidebarProps, 
  type HistorySidebarEmits, 
  type HistoryEntry 
} from './useHistorySidebar';

export type { HistoryEntry };

const props = defineProps<HistorySidebarProps>();
const emit = defineEmits<HistorySidebarEmits>();

const {
  entries,
  loading,
  formatDate,
  loadHistory,
  restore,
  togglePin,
  deleteEntry
} = useHistorySidebar(props, emit);

defineExpose({ refresh: loadHistory });
</script>

<style scoped src="@worldwiki/resources/styles/components/HistorySidebar.css"></style>
