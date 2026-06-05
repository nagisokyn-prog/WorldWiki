/**
 * @file project.service.ts
 * @description Сервис для управления проектами
 * @rust-ready ✅ CRUD операции с проектами
 */

import { apiService } from './api.service';

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
  calendar: ProjectCalendar | null;
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
  calendar: ProjectCalendar | null;
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
    const raw = await apiService.getProjects();
    console.log('[projectService] getProjects raw response:', raw);
    const list = Array.isArray(raw) ? raw : ((raw as any)?.projects || []);
    return list.map((p: any) => ({
      ...p,
      icon: p.icon || '📁',
      stats: p.data?.stats || p.stats || { characters: 0, organizations: 0, states: 0, chapters: 0 }
    }));
  },

  /**
   * Получить конфигурацию проекта (включая календарь)
   */
  async getProjectConfig(projectName: string): Promise<ProjectConfig> {
    const res: any = await apiService.getProjectConfig(projectName);
    console.log('[projectService] getProjectConfig raw response:', res);
    return res as ProjectConfig;
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
    const result = await apiService.createProject(payload);
    console.log('[projectService] createProject result:', result);
    return result;
  },

  /**
   * Удалить проект
   */
  async deleteProject(projectName: string): Promise<{ success: boolean }> {
    return await apiService.deleteProject(projectName);
  },

  /**
   * Сохранить конфигурацию проекта (включая календарь, жанры и т.д.)
   */
  async saveProjectConfig(projectName: string, config: ProjectConfig): Promise<{ success: boolean }> {
    return await apiService.saveProjectConfig(projectName, config as any);
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
      stats: projectData.stats || { characters: 0, organizations: 0, states: 0, chapters: 0 },
      calendar: config.calendar || null
    };
  }
};

// Глобальный доступ для совместимости
declare global {
  interface Window {
    projectService: typeof projectService;
  }
}

if (typeof window !== 'undefined') {
  window.projectService = projectService;
}