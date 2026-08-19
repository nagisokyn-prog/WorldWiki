/**
 * @file connection.api.ts
 * @description API-методы для работы со связями между сущностями
 */

import { invoke, processIds } from '@worldwiki/components';

export interface ConnectionData {
  id?: string;
  source?: { entityType: string; entityId: string };
  sourceId?: string;
  sourceType?: string;
  target?: { entityType: string; entityId: string };
  targetId?: string;
  targetType?: string;
  type?: string;
  role?: string;
  description?: string;
  period?: { start_chapter?: string; end_chapter?: string };
  [key: string]: unknown;
}

export const connectionApi = {
  getConnections: async (project: string, chapter: string): Promise<ConnectionData[]> => {
    const list = await invoke<ConnectionData[]>('get_connections', { project, chapter });
    return list.map(processIds);
  },

  getConnectionsByEntity: (project: string, entityType: string, entityId: string): Promise<ConnectionData[]> =>
    invoke<ConnectionData[]>('get_connections_by_entity', { project, entityType, entityId }),

  removeConnectionsBySource: (project: string, entityType: string, entityId: string): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('remove_connections_by_source', { project, entityType, entityId }),

  saveConnections: (project: string, sourceId: string, data: ConnectionData[]): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('save_connections', { project, sourceId, data }),
};