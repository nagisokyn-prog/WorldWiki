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
        globalTags.value = (await api.getTags(project.value) as any) || [];
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
      await api.saveTag(project.value, { project_id: project.value, name, color: '#3498db', id: null } as any);
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
    
    await api.saveTag(project.value, {
      project_id: project.value,
      id: existingTag?.id || null,
      name: newName,
      color: color
    } as any);
    
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
