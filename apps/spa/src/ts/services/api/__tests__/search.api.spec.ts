import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchApi } from '../search.api';
import { invoke } from '@worldwiki/components';

vi.mock('@worldwiki/components', () => ({
  invoke: vi.fn(),
}));

describe('searchApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  describe('uploadPhoto', () => {
    it('reads file bytes and uploads photo', async () => {
      vi.mocked(invoke).mockResolvedValueOnce('photos/avatar.png');

      const file = new File([new Uint8Array([1, 2, 3])], 'avatar.png', { type: 'image/png' });
      const res = await searchApi.uploadPhoto(file);

      expect(invoke).toHaveBeenCalledWith('upload_photo', {
        bytes: [1, 2, 3],
        filename: 'avatar.png',
      });
      expect(res).toBe('photos/avatar.png');
    });
  });

  describe('getLocalPhotoUrl', () => {
    it('returns original path if empty, data: or blob:', async () => {
      expect(await searchApi.getLocalPhotoUrl('')).toBe('');
      expect(await searchApi.getLocalPhotoUrl('data:image/png;base64,123')).toBe('data:image/png;base64,123');
      expect(await searchApi.getLocalPhotoUrl('blob:http://localhost/123')).toBe('blob:http://localhost/123');
    });

    it('fetches file bytes and creates object URL with proper mimeType', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([10, 20, 30]);

      const res = await searchApi.getLocalPhotoUrl('/images/pic.png');

      expect(invoke).toHaveBeenCalledWith('get_local_file', { path: '/images/pic.png' });
      expect(res).toBe('blob:mock-url');
    });

    it('handles webp, gif, jpeg extensions', async () => {
      vi.mocked(invoke).mockResolvedValue([10]);

      await searchApi.getLocalPhotoUrl('/images/pic.webp');
      await searchApi.getLocalPhotoUrl('/images/pic.gif');
      await searchApi.getLocalPhotoUrl('/images/pic.jpg');

      expect(invoke).toHaveBeenCalledTimes(3);
    });

    it('returns original path if invoke throws', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('File not found'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await searchApi.getLocalPhotoUrl('/missing/file.png');

      expect(res).toBe('/missing/file.png');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('revokeLocalPhotoUrls', () => {
    it('revokes all created blob URLs', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([10, 20]);
      await searchApi.getLocalPhotoUrl('/img.png');

      searchApi.revokeLocalPhotoUrls();

      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});
