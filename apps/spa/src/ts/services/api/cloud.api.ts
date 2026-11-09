/**
 * @file cloud.api.ts
 * @description API-методы для облачных бэкапов и экспорта
 */

import { invoke } from '@worldwiki/components';

export const cloudApi = {
  createCloudBackup: (project?: string): Promise<string> =>
    project !== undefined ? invoke<string>('create_cloud_backup', { project }) : invoke<string>('create_cloud_backup'),
  exportLocalBackup: (destinationPath: string, project?: string): Promise<string> =>
    invoke<string>('export_local_backup', { destinationPath, project }),

  exportChapters: (project: string, chapters: unknown[], format: string, options: Record<string, unknown>): Promise<{ path: string }> =>
    invoke<{ path: string }>('export_chapters', { project, chapters, format, options }),

  exchangeYandexToken: async (code: string): Promise<string> => invoke('exchange_yandex_token', { code }),
  uploadToYandexDisk: async (token: string, filePath: string): Promise<void> => invoke('upload_to_yandex_disk', { token, filePath }),
  restoreFromBackup: async (backupPath: string): Promise<void> => invoke('restore_from_backup', { backupPath }),
  getLaunchArgs: async (): Promise<string | null> => invoke('get_launch_args'),
};