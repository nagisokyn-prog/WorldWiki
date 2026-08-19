/**
 * @file tag.api.ts
 * @description API-методы для работы с тегами
 */

import { invoke, processIds } from '@worldwiki/components';
import { projectRecordId } from './project.api';

export interface TagData {
  id?: string;
  name: string;
  color: string;
  [key: string]: unknown;
}

export const tagApi = {
  getTags: async (project: string): Promise<TagData[]> => {
    const list = await invoke<TagData[]>('get_tags', { project });
    return list.map(processIds);
  },

  saveTag: (project: string, tagData: TagData): Promise<{ success: boolean }> => {
    const data = {
      ...tagData,
      project_id: projectRecordId(project)
    };
    return invoke<{ success: boolean }>('save_tag', { data });
  },

  deleteTag: (project: string, tagId: string): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('delete_tag', { id: tagId }),
};