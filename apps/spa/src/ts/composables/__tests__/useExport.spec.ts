import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useExport } from '../useExport';
import * as api from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  exportChapters: vi.fn(),
}));

describe('useExport', () => {
  const { exportChapters } = useExport();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws error when chapters array is empty or undefined', async () => {
    await expect(exportChapters('proj_1', [], 'pdf')).rejects.toThrow('Нет глав для экспорта');
    await expect(exportChapters('proj_1', null as any, 'pdf')).rejects.toThrow('Нет глав для экспорта');
  });

  it('exports chapters and returns path on success', async () => {
    vi.mocked(api.exportChapters).mockResolvedValue({ path: '/documents/book.pdf' } as any);

    const chapters = [{ id: 'ch1', title: 'Chapter 1', content: 'Story' }];
    const path = await exportChapters('proj_1', chapters, 'pdf', { includeFootnotes: true });

    expect(api.exportChapters).toHaveBeenCalledWith('proj_1', chapters, 'pdf');
    expect(path).toBe('/documents/book.pdf');
  });

  it('re-throws error if backend export fails', async () => {
    vi.mocked(api.exportChapters).mockRejectedValue(new Error('Pandoc not installed'));

    const chapters = [{ id: 'ch1', title: 'Chapter 1', content: 'Story' }];
    await expect(exportChapters('proj_1', chapters, 'epub')).rejects.toThrow('Pandoc not installed');
  });
});
