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
import { ref, watch, onMounted } from 'vue';
import { invoke } from '../../js/services/api.service';

const props = defineProps<{
  project: string;
  typeKey: string;
}>();

const emit = defineEmits<{
  restore: [snapshot: any];
}>();

interface HistoryEntry {
  id: string;
  saved_at: string;
  is_pinned: boolean;
  snapshot: any;
  type_key: string;
  project_id: string;
}

const entries = ref<HistoryEntry[]>([]);
const loading = ref(false);

async function loadHistory() {
  if (!props.project || !props.typeKey) return;
  loading.value = true;
  try {
    const result = await invoke<HistoryEntry[]>('get_schema_history', {
      project: props.project,
      type_key: props.typeKey,
    });
    entries.value = (result || []).sort(
      (a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
    );
  } catch (e) {
    console.error('[HistorySidebar] loadHistory error:', e);
  } finally {
    loading.value = false;
  }
}

async function restore(entry: HistoryEntry) {
  if (confirm(`Restore version from ${formatDate(entry.saved_at)}?`)) {
    emit('restore', entry.snapshot);
  }
}

async function togglePin(entry: HistoryEntry) {
  try {
    await invoke('toggle_history_pin', { id: entry.id, pinned: !entry.is_pinned });
    entry.is_pinned = !entry.is_pinned;
  } catch (e) {
    console.error('[HistorySidebar] togglePin error:', e);
  }
}

async function deleteEntry(entry: HistoryEntry) {
  if (!confirm('Delete this snapshot?')) return;
  try {
    await invoke('delete_history_entry', { id: entry.id });
    entries.value = entries.value.filter(e => e.id !== entry.id);
  } catch (e) {
    console.error('[HistorySidebar] deleteEntry error:', e);
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.round((now.getTime() - d.getTime()) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

watch(() => [props.project, props.typeKey], loadHistory);
onMounted(loadHistory);
defineExpose({ refresh: loadHistory });
</script>

<style scoped>
.history-sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--ws-sidebar-bg, #111127);
  color: #e2e8f0;
  font-size: 13px;
  overflow: hidden;
}

.history-sidebar__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #1e1e2e;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  flex-shrink: 0;
}
.history-sidebar__count {
  margin-left: auto;
  background: #1e1e2e;
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 11px;
  color: #8b5cf6;
}

.history-sidebar__loader,
.history-sidebar__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #334155;
  text-align: center;
  padding: 20px;
}

.history-sidebar__spinner {
  display: inline-block;
  width: 18px; height: 18px;
  border: 2px solid #1e1e2e;
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.history-sidebar__list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
}

/* ── Entry ── */
.history-entry {
  display: flex;
  gap: 0;
  padding: 0 12px 0 16px;
  position: relative;
}
.history-entry--pinned { background: #8b5cf608; }

.history-entry__line {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
}

.history-entry__dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #334155;
  border: 2px solid #1e1e2e;
  flex-shrink: 0;
  margin-top: 4px;
  transition: background 0.15s;
}
.history-entry__dot--pinned { background: #8b5cf6; border-color: #8b5cf660; }
.history-entry:hover .history-entry__dot { background: #06b6d4; }

.history-entry__body {
  flex: 1;
  padding: 6px 0 14px 10px;
  border-left: 1px solid #1e1e2e;
  min-width: 0;
}

.history-entry__time {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}
.history-entry__meta { margin: 2px 0; }
.history-entry__pin {
  font-size: 11px;
  color: #8b5cf6;
}

.history-entry__actions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  opacity: 0;
  transition: opacity 0.15s;
}
.history-entry:hover .history-entry__actions { opacity: 1; }

.history-btn {
  background: #1e1e2e;
  border: 1px solid #2d2d4e;
  color: #94a3b8;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}
.history-btn:hover { background: #2d2d4e; color: white; }
.history-btn--ghost { background: transparent; border-color: transparent; }
.history-btn--danger:hover { background: #7f1d1d40; border-color: #ef444460; color: #ef4444; }
</style>
