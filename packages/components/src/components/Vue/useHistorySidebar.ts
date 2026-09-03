import { ref, watch, onMounted } from 'vue';
import { invoke } from '../../ts/services/api.service';

export interface HistoryEntry {
  id: string;
  saved_at: string;
  is_pinned: boolean;
  snapshot: Record<string, unknown>;
  type_key: string;
  project_id: string;
}

export interface HistorySidebarProps {
  project: string;
  typeKey: string;
}

export interface HistorySidebarEmits {
  (e: 'restore', snapshot: Record<string, unknown>): void;
}

export function useHistorySidebar(
  props: HistorySidebarProps,
  emit: HistorySidebarEmits
) {
  const entries = ref<HistoryEntry[]>([]);
  const loading = ref(false);

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.round((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

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

  watch(() => [props.project, props.typeKey], loadHistory);
  onMounted(loadHistory);

  return {
    entries,
    loading,
    formatDate,
    loadHistory,
    restore,
    togglePin,
    deleteEntry
  };
}
