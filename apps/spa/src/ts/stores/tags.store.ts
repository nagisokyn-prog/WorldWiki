import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as api from '../services/api.client';
import { getCached, setCache, invalidateCache } from '../utils/requestCache';

export interface TagData {
  id?: string;
  name: string;
  color: string;
}

export const useTagsStore = defineStore('tags', () => {
  const project = ref<string | null>(null);
  const globalTags = ref<TagData[]>([]);
  const isInitialized = ref(false);

  async function init(projectName: string) {
    if (isInitialized.value && project.value === projectName) return;
    project.value = projectName;

    try {
      const cacheKey = `tags:${project.value}`;
      const cached = getCached<TagData[]>(cacheKey);
      if (cached) {
        globalTags.value = cached;
      } else {
        const entities = await api.getEntities(project.value, null);
        const tagSet = new Set<string>();
        for (const e of entities || []) {
          if (Array.isArray(e.tags)) {
            for (const t of e.tags) {
              if (t && typeof t === 'string') tagSet.add(t);
            }
          }
        }
        globalTags.value = Array.from(tagSet).map((name) => ({
          id: name,
          name,
          color: 'var(--accent)',
        }));
        setCache(cacheKey, globalTags.value);
      }
    } catch (e) {
      console.error('Ошибка загрузки тегов:', e);
      globalTags.value = [];
    }

    isInitialized.value = true;
  }

  const isCreatingTag = ref(false);

  async function createNewTag(name: string) {
    if (isCreatingTag.value || !project.value) return;

    const existing = globalTags.value.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return;

    isCreatingTag.value = true;
    try {
      const newTag: TagData = { id: name, name, color: 'var(--accent)' };
      globalTags.value.push(newTag);
      invalidateCache(`tags:${project.value}`);
    } finally {
      isCreatingTag.value = false;
    }
  }

  async function deleteTag(name: string) {
    if (!project.value) return;
    globalTags.value = globalTags.value.filter((t) => t.name !== name && t.id !== name);
    invalidateCache(`tags:${project.value}`);
  }

  async function saveTag(oldName: string, newName: string, color: string) {
    if (!project.value) return;
    const existingTag = globalTags.value.find((t) => t.name === oldName || t.id === oldName);

    if (existingTag) {
      existingTag.name = newName;
      existingTag.color = color;
    } else {
      globalTags.value.push({ id: newName, name: newName, color });
    }
    invalidateCache(`tags:${project.value}`);
  }

  return {
    project,
    globalTags,
    isInitialized,
    init,
    createNewTag,
    deleteTag,
    saveTag,
  };
});
