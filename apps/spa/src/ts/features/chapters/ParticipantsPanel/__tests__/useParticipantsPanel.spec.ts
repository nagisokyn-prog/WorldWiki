import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useParticipantsPanel } from '../useParticipantsPanel';
import * as api from '../../../../services/api.client';

vi.mock('../../../../services/api.client', () => ({
  getEntities: vi.fn(),
}));

describe('useParticipantsPanel', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
    props = {
      project: 'proj_1',
      participants: [{ id: 'char_1', type: 'character', name: 'Arthur' }],
    };
  });

  it('provides icons and adds / removes participants', async () => {
    vi.mocked(api.getEntities).mockResolvedValueOnce([
      { id: 'char_2', name: 'Merlin' },
    ] as any);

    const panel = useParticipantsPanel(props, emit);

    expect(panel.getIcon('character')).toBe('👤');
    expect(panel.getIcon('organization')).toBe('🛡️');

    panel.newType.value = 'character';
    panel.newId.value = 'char_2';

    panel.addParticipant();
    expect(emit).toHaveBeenCalledWith('update:participants', expect.arrayContaining([
      expect.objectContaining({ id: 'char_2' }),
    ]));

    panel.removeParticipant(0);
    expect(emit).toHaveBeenCalledWith('update:participants', []);
  });
});
