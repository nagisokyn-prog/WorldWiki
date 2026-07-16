/**
 * @file project.api.ts
 * @description API-методы для работы с проектами
 */

import { invoke } from '@worldwiki/components';

export interface ProjectConfig {
  type: string;
  genres: string[];
  calendar: unknown;
}

export const projectRecordId = (p: string): string => {
  const cleanP = p.replace(/^projects:/, '').replace(/[`'"]/g, '');
  return `projects:${cleanP}`;
};

export const projectApi = {
  getProjects: (): Promise<unknown[]> => invoke<unknown[]>('get_projects'),
  createProject: (data: Record<string, unknown>): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('create_project', { projectData: data }),
  getProjectConfig: (name: string): Promise<ProjectConfig> =>
    invoke<ProjectConfig>('get_project_config', { name }),
  deleteProject: (name: string): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('delete_project', { name }),
  saveProjectConfig: (name: string, config: ProjectConfig): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('save_project_config', { name, config }),
};