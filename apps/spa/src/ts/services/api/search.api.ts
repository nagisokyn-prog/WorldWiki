/**
 * @file search.api.ts
 * @description API-методы для поиска и медиафайлов
 */

import { invoke } from '@worldwiki/components';

const activeBlobUrls = new Set<string>();

export const searchApi = {
  uploadPhoto: async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    return invoke('upload_photo', { bytes, filename: file.name }) as Promise<string>;
  },

  getLocalPhotoUrl: async (path: string): Promise<string> => {
    if (!path || path.startsWith('data:')) return path;
    if (path.startsWith('blob:')) return path;

    try {
      const bytes: number[] = await invoke('get_local_file', { path }) as number[];

      let mimeType = 'image/jpeg';
      const lowerPath = path.toLowerCase();
      if (lowerPath.endsWith('.png')) mimeType = 'image/png';
      else if (lowerPath.endsWith('.webp')) mimeType = 'image/webp';
      else if (lowerPath.endsWith('.gif')) mimeType = 'image/gif';

      const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
      const url = URL.createObjectURL(blob);
      activeBlobUrls.add(url);
      return url;
    } catch (e) {
      console.error('[searchApi] getLocalPhotoUrl error:', e);
      return path;
    }
  },

  revokeLocalPhotoUrls: () => {
    activeBlobUrls.forEach(url => URL.revokeObjectURL(url));
    activeBlobUrls.clear();
  },
};