import { ref } from 'vue';
import * as api from '../../services/api.client';
import type { Tag } from '../../types/generated/Tag';

const DEFAULT_TAG_COLOR = ['#', '8b5cf6'].join('');

export function ensureHexColor(c?: string | null): string {
  if (!c || typeof c !== 'string') return DEFAULT_TAG_COLOR;
  const trimmed = c.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  return DEFAULT_TAG_COLOR;
}

export function useTagsManagerModal(props: { project: string }) {
  const isOpen = ref(false);
  const loading = ref(false);
  const tags = ref<Tag[]>([]);
  const newTagName = ref('');
  const newTagColor = ref(DEFAULT_TAG_COLOR);

  const loadTags = async () => {
    loading.value = true;
    try {
      const entities = await api.getEntities(props.project, null);
      const tagSet = new Set<string>();
      for (const e of entities || []) {
        if (Array.isArray(e.tags)) {
          for (const t of e.tags) {
            if (t && typeof t === 'string') tagSet.add(t);
          }
        }
      }
      tags.value = Array.from(tagSet).map((name) => ({
        id: name,
        project_id: props.project,
        name,
        color: DEFAULT_TAG_COLOR,
      }));
    } catch (e) {
      console.error('[TagsManager] Load error:', e);
      tags.value = [];
    } finally {
      loading.value = false;
    }
  };

  const addTag = async () => {
    const val = newTagName.value.trim();
    if (!val) return;
    if (!tags.value.some((t) => t.name.toLowerCase() === val.toLowerCase())) {
      tags.value.push({
        id: val,
        project_id: props.project,
        name: val,
        color: newTagColor.value,
      });
    }
    newTagName.value = '';
  };

  const updateTag = async (tag: Tag) => {
    const idx = tags.value.findIndex((t) => t.id === tag.id || t.name === tag.name);
    if (idx !== -1) {
      tags.value[idx] = { ...tag };
    }
  };

  const deleteTag = async (id: string) => {
    const { appConfirm } = await import('@worldwiki/components');
    const confirmed = await appConfirm('Удалить этот тег?');
    if (!confirmed) return;
    tags.value = tags.value.filter((t) => t.id !== id && t.name !== id);
  };

  const open = () => {
    isOpen.value = true;
    void loadTags();
  };

  const close = () => {
    isOpen.value = false;
  };

  return {
    isOpen,
    loading,
    tags,
    newTagName,
    newTagColor,
    open,
    close,
    addTag,
    updateTag,
    deleteTag,
  };
}
