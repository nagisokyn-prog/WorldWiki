import { invoke } from '@tauri-apps/api/core';
import type { ProjectSummary } from './api.types';

export async function getProjects(): Promise<ProjectSummary[]> {
  return await invoke('get_projects');
}

export async function createProject(projectData: unknown): Promise<string> {
  return await invoke('create_project', { projectData });
}

export async function getProjectConfig(name: string): Promise<unknown> {
  return await invoke('get_project_config', { name });
}

export async function saveProjectConfig(name: string, config: unknown): Promise<unknown> {
  return await invoke('save_project_config', { name, config });
}

export async function deleteProject(name: string): Promise<string> {
  return await invoke('delete_project', { name });
}

export async function createCloudBackup(): Promise<string> {
  return await invoke('create_cloud_backup');
}

export async function exchangeYandexToken(code: string): Promise<string> {
  return await invoke('exchange_yandex_token', { code });
}

export async function uploadToYandexDisk(token: string, filePath: string): Promise<void> {
  return await invoke('upload_to_yandex_disk', { token, filePath });
}

export async function listYandexDiskBackups(token: string): Promise<unknown[]> {
  return await invoke('list_yandex_disk_backups', { token });
}

export async function downloadAndRestoreYandex(token: string, fileName: string): Promise<void> {
  return await invoke('download_and_restore_yandex', { token, fileName });
}

export async function getLaunchArgs(): Promise<string | null> {
  return await invoke('get_launch_args');
}

export async function restoreFromBackup(backupPath: string): Promise<void> {
  return await invoke('restore_from_backup', { backupPath });
}
