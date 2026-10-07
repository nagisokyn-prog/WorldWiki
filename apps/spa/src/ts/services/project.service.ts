/**
 * @file project.service.ts
 * @description Сервис для управления проектами
 * @rust-ready ✅ CRUD операции с проектами
 */

import * as api from './api.client';
import { getCached, setCache, invalidateCache } from '../utils/requestCache';
import { purgeProjectStorage } from '../utils/storage.purge';

export interface ProjectStats {
  chapters?: number;
  [entityType: string]: number | undefined;
}

export interface ProjectConfig {
  type: string;
  genres: string[];
  created?: string;
  updated?: string;
  [key: string]: unknown;
}

export interface ProjectMetadata {
  name: string;
  type: string;
  genres: string[];
  created: string;
  updated: string;
  stats: ProjectStats;
}

export interface ProjectData {
  name: string;
  stats?: ProjectStats;
  [key: string]: unknown;
}

export const projectService = {
  /**
   * Получить список всех проектов (массив объектов)
   */
  async getProjects(): Promise<ProjectData[]> {
    const cacheKey = 'projects:all';
    const cached = getCached<ProjectData[]>(cacheKey);
    if (cached) return cached;

    const raw = await api.getProjects();
    console.log('[projectService] getProjects raw response:', raw);
    const list = Array.isArray(raw) ? raw : ((raw as { projects?: Array<Record<string, unknown>> })?.projects || []);
    const projects = list.map((p: Record<string, unknown>) => ({
      name: String(p.name || ''),
      ...p,
      icon: (p.icon as string) || '📁',
      stats: ((p.data as Record<string, unknown>)?.stats as ProjectStats) || (p.stats as ProjectStats) || { chapters: 0 }
    })) as ProjectData[];
    setCache(cacheKey, projects);
    return projects;
  },

  /**
   * Получить конфигурацию проекта (включая календарь)
   */
  async getProjectConfig(projectName: string): Promise<ProjectConfig> {
    const cacheKey = `project:config:${projectName}`;
    const cached = getCached<ProjectConfig>(cacheKey);
    if (cached) return cached;

    const res = await api.getProjectConfig(projectName);
    console.log('[projectService] getProjectConfig raw response:', res);
    const config = res as ProjectConfig;
    setCache(cacheKey, config);
    return config;
  },

  /**
   * Создать новый проект
   */
  async createProject(projectData: Record<string, unknown>): Promise<{ success: boolean }> {
    console.log('[projectService] createProject input:', projectData);
    const { name, ...customFields } = projectData;
    
    // SurrealDB 3.0 SCHEMAFULL использует DEFAULT time::now()
    // Строку он не схавает (требует тип datetime), поэтому просто не передаем это поле
    const payload = {
      name,
      ...customFields
    };
    
    console.log('[projectService] createProject sending payload:', payload);
    const result = await api.createProject(payload);
    console.log('[projectService] createProject result:', result);
    invalidateCache('projects:all');
    return { success: !!result };
  },

  /**
   * Удалить проект
   */
  async deleteProject(projectName: string): Promise<{ success: boolean }> {
    const result = await api.deleteProject(projectName);
    invalidateCache('projects:all');
    invalidateCache(`project:config:${projectName}`);
    purgeProjectStorage(projectName);
    return { success: !!result };
  },

  /**
   * Сохранить конфигурацию проекта (включая календарь, жанры и т.д.)
   */
  async saveProjectConfig(projectName: string, config: ProjectConfig): Promise<{ success: boolean }> {
    const result = await api.saveProjectConfig(projectName, config);
    invalidateCache(`project:config:${projectName}`);
    return (result as { success: boolean }) || { success: true };
  },

  /**
   * Получить метаданные проекта (тип, жанры, даты)
   */
  async getProjectMetadata(projectName: string): Promise<ProjectMetadata> {
    const config = await this.getProjectConfig(projectName);
    const allProjects = await this.getProjects();
    const projectData = allProjects.find(p => p.name === projectName) || ({} as ProjectData);

    return {
      name: projectName,
      type: config.type || 'novel',
      genres: config.genres || [],
      created: config.created || new Date().toISOString(),
      updated: config.updated || new Date().toISOString(),
      stats: projectData.stats || { chapters: 0 }
    };
  }
};
