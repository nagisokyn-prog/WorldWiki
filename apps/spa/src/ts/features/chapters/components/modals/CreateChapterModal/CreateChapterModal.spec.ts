import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCreateChapterModal } from './useCreateChapterModal';
import type { CreateChapterModalEmits } from './CreateChapterModal.model';
import * as api from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  getChapterHierarchy: vi.fn(),
}));

describe('useCreateChapterModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads volumes and sets next chapter number on open', async () => {
    vi.mocked(api.getChapterHierarchy).mockResolvedValue({
      project_id: 'test',
      volumes: [
        { id: 'volumes:vol_1', title: 'Том 1. Начало', sort_order: 1, project_id: 'test', description: null, created_at: null },
      ],
      chapters: [
        { id: 'chapters:ch_1', title: 'Глава 1', volume_id: 'volumes:vol_1' },
        { id: 'chapters:ch_2', title: 'Глава 2', volume_id: 'volumes:vol_1' },
      ],
    } as unknown as Awaited<ReturnType<typeof api.getChapterHierarchy>>);

    const emit = vi.fn() as unknown as CreateChapterModalEmits;
    const modal = useCreateChapterModal(
      {
        isOpen: true,
        projectName: 'test_project',
        initialVolumeId: 'volumes:vol_1',
      },
      emit
    );

    await modal.loadVolumesAndInit();

    expect(modal.volumes.value.length).toBe(1);
    expect(modal.volumes.value[0].id).toBe('volumes:vol_1');
    expect(modal.selectedVolumeId.value).toBe('volumes:vol_1');
    expect(modal.title.value).toBe('Глава 3');
  });

  it('handles empty title validation', () => {
    const emit = vi.fn() as unknown as CreateChapterModalEmits;
    const modal = useCreateChapterModal(
      {
        isOpen: true,
        projectName: 'test_project',
      },
      emit
    );

    modal.title.value = '   ';
    modal.handleSubmit();

    expect(emit).not.toHaveBeenCalled();
    expect(modal.errorMessage.value).toBe('Название главы не может быть пустым');
  });

  it('emits create payload with selected volume and trimmed title', () => {
    const emit = vi.fn() as unknown as CreateChapterModalEmits;
    const modal = useCreateChapterModal(
      {
        isOpen: true,
        projectName: 'test_project',
      },
      emit
    );

    modal.title.value = '  Глава 1. Пробуждение  ';
    modal.selectedVolumeId.value = 'volumes:vol_2';
    modal.handleSubmit();

    expect(modal.errorMessage.value).toBeNull();
    expect(emit).toHaveBeenCalledWith('create', {
      title: 'Глава 1. Пробуждение',
      volumeId: 'volumes:vol_2',
    });
  });

  it('calculates next chapter number correctly across existing chapters', () => {
    const emit = vi.fn() as unknown as CreateChapterModalEmits;
    const modal = useCreateChapterModal(
      {
        isOpen: false,
        projectName: 'test_project',
      },
      emit
    );

    const title = modal.calculateNextChapterTitle(
      [
        { title: 'Глава 5: Финал', volume_id: 'vol1' },
        { title: 'Глава 12: Эпилог', volume_id: 'vol1' },
        { title: 'Внезапный поворот', volume_id: 'vol1' },
      ],
      'vol1'
    );

    expect(title).toBe('Глава 13');
  });
});

