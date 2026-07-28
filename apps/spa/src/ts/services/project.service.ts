/**
 * @file project.service.ts
 * @description Сервис для управления проектами
 * @rust-ready ✅ CRUD операции с проектами
 */

import * as api from './api.client';;
import { getCached, setCache, invalidateCache } from '../utils/requestCache';

interface ProjectStats {
  characters: number;
  organizations: number;
  states: number;
  chapters: number;
}

interface ProjectCalendar {
  название?: string;
  месяцы?: Array<{ название: string; дней: number }>;
  эпохи?: Array<{ название: string; год_начала: number; год_конца: number }>;
  [key: string]: unknown;
}

interface ProjectConfig {
  type: string;
  genres: string[];

  created?: string;
  updated?: string;
  [key: string]: unknown;
}

interface ProjectMetadata {
  name: string;
  type: string;
  genres: string[];
  created: string;
  updated: string;
  stats: ProjectStats;

}

interface ProjectData {
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
    const list = Array.isArray(raw) ? raw : ((raw as any)?.projects || []);
    const projects = list.map((p: any) => ({
      ...p,
      icon: p.icon || '📁',
      stats: p.data?.stats || p.stats || { characters: 0, organizations: 0, states: 0, chapters: 0 }
    }));
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

    const res: any = await api.getProjectConfig(projectName);
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
    return { success: !!result };
  },

  /**
   * Сохранить конфигурацию проекта (включая календарь, жанры и т.д.)
   */
  async saveProjectConfig(projectName: string, config: ProjectConfig): Promise<{ success: boolean }> {
    const result = await api.saveProjectConfig(projectName, config as any);
    invalidateCache(`project:config:${projectName}`);
    return result;
  },

  /**
   * Получить метаданные проекта (тип, жанры, даты)
   */
  async getProjectMetadata(projectName: string): Promise<ProjectMetadata> {
    const config = await this.getProjectConfig(projectName);
    const allProjects = await this.getProjects();
    const projectData = allProjects.find(p => p.name === projectName) || {} as ProjectData;

    return {
      name: projectName,
      type: config.type || 'novel',
      genres: config.genres || [],
      created: config.created || new Date().toISOString(),
      updated: config.updated || new Date().toISOString(),
      stats: projectData.stats || { characters: 0, organizations: 0, states: 0, chapters: 0 }
    };
  }
};
