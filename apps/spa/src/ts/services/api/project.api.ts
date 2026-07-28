/**
 * @file project.api.ts
 * @description API-методы для работы с проектами
 */

import * as api from '../api.client';

export interface ProjectConfig {
  type: string;
  genres: string[];
  calendar: unknown;
}

export const projectRecordId = (p: string): string => {
  const pStr = p || 'default';
  const cleanP = pStr.replace(/^projects:/, '').replace(/[`'"]/g, '');
  return `projects:${cleanP}`;
};

export const projectApi = {
  getProjects: async (): Promise<unknown[]> => {
    return (await api.getProjects()) as unknown[];
  },
  createProject: async (data: Record<string, unknown>): Promise<{ success: boolean }> => {
    await api.createProject(data);
    return { success: true };
  },
  getProjectConfig: async (name: string): Promise<ProjectConfig> => {
    return (await api.getProjectConfig(name)) as ProjectConfig;
  },
  deleteProject: async (name: string): Promise<{ success: boolean }> => {
    await api.deleteProject(name);
    return { success: true };
  },
  saveProjectConfig: async (name: string, config: ProjectConfig): Promise<{ success: boolean }> => {
    await api.saveProjectConfig(name, config);
    return { success: true };
  },
};