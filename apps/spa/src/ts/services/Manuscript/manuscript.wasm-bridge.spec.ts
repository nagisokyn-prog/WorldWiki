import { describe, it, expect } from 'vitest';
import {
  extractEntityMentions,
  resolveCrossReferences,
  ensureManuscriptWasm,
} from './manuscript.wasm-bridge';

describe('manuscript.wasm-bridge', () => {
  it('extracts entity mentions from manuscript text with ((...))', async () => {
    await ensureManuscriptWasm();
    const text = 'В замок прибыл ((Артур)) и встретил ((Мерлин|Старый маг)).';
    const mentions = extractEntityMentions(text);

    expect(mentions.length).toBe(2);
    expect(mentions[0].name).toBe('Артур');
    expect(mentions[1].name).toBe('Мерлин|Старый маг');
    expect(mentions[0].char_start).toBe(15);
  });

  it('handles text without entity mentions gracefully', async () => {
    await ensureManuscriptWasm();
    const text = 'Обычный текст без каких-либо скобок и сущностей.';
    const mentions = extractEntityMentions(text);
    expect(mentions).toEqual([]);
  });

  it('resolves cross references against entity index', async () => {
    await ensureManuscriptWasm();
    const refs = [
      { id: 'ref_1', target_id: 'ent_arthur', ref_type: 'character' },
      { id: 'ref_2', target_id: 'ent_unknown', ref_type: 'location' },
    ];
    const index = {
      ent_arthur: { title: 'Король Артур', path: 'characters/arthur' },
    };

    const resolved = resolveCrossReferences(refs, index);
    expect(resolved.length).toBe(2);
    expect(resolved[0].is_resolved).toBe(true);
    expect(resolved[0].target_title).toBe('Король Артур');
    expect(resolved[1].is_resolved).toBe(false);
  });
});

