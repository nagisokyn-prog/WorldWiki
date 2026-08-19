import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as api from '../services/api.client';
import type { Tag } from '../types/generated/Tag';
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
        const result = await api.getTags(project.value);
        globalTags.value = (result as unknown as TagData[]) || [];
        setCache(cacheKey, globalTags.value);
      }
    } catch (e) {
      console.error("Ошибка загрузки тегов:", e);
      globalTags.value = [];
    }

    isInitialized.value = true;
  }

  const isCreatingTag = ref(false);

  async function createNewTag(name: string) {
    if (isCreatingTag.value || !project.value) return;
    
    const existing = globalTags.value.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return;

    isCreatingTag.value = true;
    try {
      const newTag: Tag = { project_id: `projects:${project.value}`, name, color: '#3498db', id: null };
      await api.saveTag(project.value, newTag);
      globalTags.value.push({ name, color: '#3498db' });
      invalidateCache(`tags:${project.value}`);
    } finally {
      isCreatingTag.value = false;
    }
  }

  async function deleteTag(name: string) {
    if (!project.value) return;
    const tag = globalTags.value.find(t => t.name === name);
    if (tag && tag.id) {
        await api.deleteTag(tag.id);
    }
    globalTags.value = globalTags.value.filter(t => t.name !== name);
    invalidateCache(`tags:${project.value}`);
  }

  async function saveTag(oldName: string, newName: string, color: string) {
    if (!project.value) return;
    const existingTag = globalTags.value.find(t => t.name === oldName);
    
    const tagToSave: Tag = {
      project_id: `projects:${project.value}`,
      id: existingTag?.id || null,
      name: newName,
      color: color
    };
    await api.saveTag(project.value, tagToSave);
    
    if (existingTag) {
      existingTag.name = newName;
      existingTag.color = color;
    } else {
      globalTags.value.push({ name: newName, color });
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
    saveTag
  };
});
