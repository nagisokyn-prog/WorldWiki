import { invoke } from '@tauri-apps/api/core';

export async function uploadPhoto(bytes: number[], filename: string): Promise<string> {
  return await invoke('upload_photo', { bytes, filename });
}

export async function copyBackgroundFile(sourcePath: string): Promise<string> {
  return await invoke('copy_background_file', { sourcePath });
}

export async function getLocalFile(path: string): Promise<number[]> {
  return await invoke('get_local_file', { path });
}

export async function runPerformanceBenchmark(): Promise<unknown> {
  return await invoke('run_performance_benchmark');
}

export async function getPerformanceStyles(level: string): Promise<Record<string, unknown>> {
  return await invoke('get_performance_styles', { level });
}

export async function saveSettings(settings: unknown): Promise<void> {
  return await invoke('save_settings', { settings });
}

export async function loadSettings(): Promise<Record<string, unknown>> {
  return await invoke('load_settings');
}

export async function toggleFullscreen(): Promise<void> {
  return await invoke('toggle_fullscreen');
}

export async function getCustomThemes(): Promise<Record<string, unknown>[]> {
  return await invoke('get_custom_themes');
}

export async function loadTheme(theme: string): Promise<Record<string, unknown>> {
  return await invoke('load_theme', { theme });
}

export async function saveCustomTheme(name: string, settings: unknown): Promise<void> {
  return await invoke('save_custom_theme', { name, settings });
}
