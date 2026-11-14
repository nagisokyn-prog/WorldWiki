import { describe, it, expect, vi, beforeEach } from 'vitest';
import { patchEntityConfig, fetchSpecialRefData } from './entityConfigLoader.utils';
import type { SchemaConfig } from '../EntityEditor.model';
import * as api from '@/services/api.client';

const mockGetCalendars = vi.fn();
const mockGetPlanets = vi.fn();

vi.mock('@/stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: mockGetCalendars,
    getPlanets: mockGetPlanets,
  }),
}));

vi.mock('@/services/api.client', () => ({
  getEntities: vi.fn(),
}));

describe('entityConfigLoader.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('patchEntityConfig', () => {
    it('returns config unchanged when cfg or cfg.sections is missing', () => {
      const empty = {} as SchemaConfig;
      expect(patchEntityConfig(empty, 'state')).toBe(empty);
      expect(patchEntityConfig(null as unknown as SchemaConfig, 'state')).toBeNull();
    });

    it('normalizes legacy items into fields and dynamicContainers', () => {
      const cfg = {
        sections: [
          {
            id: 'custom',
            title: 'Custom',
            items: [
              { id: 'f1', label: 'Field 1', type: 'text' },
              { template: 'tpl1', label: 'Dyn 1' },
              { dataPath: 'events', label: 'Dyn 2' },
              { type: 'dynamic', label: 'Dyn 3' },
              { type: 'timeline', label: 'Dyn 4' },
            ],
          },
        ],
      } as unknown as SchemaConfig;

      const patched = patchEntityConfig(cfg, 'character');
      expect(patched.sections[0].fields).toHaveLength(1);
      expect(patched.sections[0].dynamicContainers).toHaveLength(4);
      expect(patched.sections[0].dynamicContainers?.[0].id).toBe('dyn_tpl1');
      expect(patched.sections[0].dynamicContainers?.[0].dataPath).toBe('dyn_tpl1');
      expect(patched.sections[0].dynamicContainers?.[2].id).toBe('dyn_2');
    });

    it('patches state sections, adds capital, reorders calendar, and filters governance/regions', () => {
      const cfg = {
        sections: [
          { id: 'regions', title: 'Regions', fields: [] },
          {
            id: 'basic',
            title: 'Basic',
            fields: [
              { id: 'name', path: 'название', type: 'text', label: 'Название' },
              { id: 'f_date', path: 'дата_основания', type: 'text', label: 'Основание' },
              { id: 'stateOfficialCalendar', path: 'официальный_календарь', type: 'text', label: 'Календарь' },
              { id: 'stateOfficialTimezone', path: 'официальный_часовой_пояс', type: 'text', label: 'TZ' },
              { id: 'stateTerritorialRegions', path: 'территориальные_регионы', type: 'text', label: 'Reg' },
              { id: 'extraCap', type: 'text', label: 'Столица региона' },
            ],
          },
          {
            id: 'governance',
            title: 'Governance',
            dynamicContainers: [
              { id: 'adminDivisions', dataPath: 'adminDivisions' },
              {
                id: 'ruling',
                fieldOverrides: {
                  cap: { label: 'Столица провинции', type: 'text' },
                  other: { label: 'Титул', type: 'text' },
                },
              },
            ],
          },
        ],
      } as unknown as SchemaConfig;

      const patched = patchEntityConfig(cfg, 'state');
      expect(patched.sections.some((s) => s.id === 'regions')).toBe(false);

      const basic = patched.sections.find((s) => s.id === 'basic')!;
      expect(basic.fields?.some((f) => f.id === 'stateCapital')).toBe(true);
      const calIdx = basic.fields!.findIndex((f) => f.id === 'stateOfficialCalendar');
      const dateIdx = basic.fields!.findIndex((f) => f.path === 'дата_основания');
      expect(calIdx).toBeLessThan(dateIdx);
      expect(basic.fields![calIdx]).toMatchObject({ type: 'select', entityType: 'calendar' });

      const tz = basic.fields!.find((f) => f.id === 'stateOfficialTimezone')!;
      expect(tz).toMatchObject({ type: 'select', entityType: 'timezone' });

      const reg = basic.fields!.find((f) => f.id === 'stateTerritorialRegions')!;
      expect(reg).toMatchObject({ type: 'multiselect', entityType: 'location' });

      const extraCap = basic.fields!.find((f) => f.id === 'extraCap')!;
      expect(extraCap).toMatchObject({ type: 'select', entityType: 'location' });

      const gov = patched.sections.find((s) => s.id === 'governance')!;
      expect(gov.dynamicContainers).toHaveLength(1);
      expect(gov.dynamicContainers![0].fieldOverrides?.['cap']).toMatchObject({
        type: 'select',
        entityType: 'location',
      });
    });

    it('does not duplicate stateCapital if already present', () => {
      const cfg = {
        sections: [
          {
            id: 'basic',
            title: 'Basic',
            fields: [{ id: 'stateCapital', path: 'столица', type: 'text', label: 'Столица' }],
          },
        ],
      } as unknown as SchemaConfig;

      const patched = patchEntityConfig(cfg, 'state');
      expect(patched.sections[0].fields).toHaveLength(1);
      expect(patched.sections[0].fields![0].type).toBe('select');
    });

    it('patches location basic and geography sections', () => {
      const cfg = {
        sections: [
          {
            id: 'basic',
            title: 'Basic',
            fields: [
              { id: 'locType', path: 'тип_локации', type: 'select', label: 'Тип' },
              { id: 'locScale', path: 'scale_level', type: 'text', label: 'Масштаб' },
            ],
          },
          {
            id: 'geography',
            title: 'Geo',
            fields: [
              { id: 'locTimezone', path: 'часовой_пояс', type: 'text', label: 'TZ' },
              { id: 'locPlanetId', path: 'планета_id', type: 'text', label: 'Planet' },
            ],
          },
        ],
      } as unknown as SchemaConfig;

      const patched = patchEntityConfig(cfg, 'location');
      const basic = patched.sections[0];
      expect(basic.fields).toHaveLength(1);
      expect(basic.fields![0]).toMatchObject({
        isSystem: true,
        required: true,
        label: 'Масштаб и тип локации',
      });

      const geo = patched.sections[1];
      expect(geo.fields![0]).toMatchObject({ type: 'select', entityType: 'timezone' });
      expect(geo.fields![1]).toMatchObject({
        type: 'select',
        entityType: 'planet',
        placeholder: 'Автоопределение (Главная планета мира)',
      });
    });
  });

  describe('fetchSpecialRefData', () => {
    it('loads calendar, planet, timezone (from master & planet) and generic entities', async () => {
      mockGetCalendars.mockResolvedValue([
        {
          id: 'cal_1',
          name: 'Имперский',
          is_master: true,
          data: {
            timezones: [
              { id: 'tz_1', code: 'IMP', name: 'Столичный', base_offset_hours: 3 },
              { code: 'NEG', base_offset_hours: -2 },
            ],
          },
        },
        { id: '', name: '', data: { название: 'Лунный' } },
      ]);
      mockGetPlanets.mockReturnValue([
        {
          id: 'pl_1',
          name: 'Терра',
          timezones: [
            { id: 'tz_1', name: 'Дубль', base_offset_hours: 3 },
            { code: 'PLZ', name: 'Полюс', offset_hours: -5 },
          ],
        },
        { id: '', name: '' },
      ]);
      vi.mocked(api.getEntities).mockResolvedValue([
        { id: 'ent_1', name: 'Герой' },
        { id: 'ent_2', title: 'Город' },
        { id: 'ent_3', label: 'Артефакт' },
        { id: '' },
      ] as never);

      const types = new Set(['calendar', 'planet', 'timezone', 'character']);
      const data = await fetchSpecialRefData('proj_1', types);

      expect(data['calendar']).toEqual([
        { value: 'cal_1', label: 'Имперский' },
        { value: '', label: 'Лунный' },
      ]);
      expect(data['calendar_list']).toEqual(data['calendar']);

      expect(data['planet']).toEqual([
        { value: 'pl_1', label: '🪐 Терра' },
        { value: '', label: '🪐 Планета' },
      ]);

      expect(data['timezone']).toEqual([
        { value: 'tz_1', label: 'Столичный (+3 ч)' },
        { value: 'NEG', label: 'NEG (-2 ч)' },
        { value: 'PLZ', label: 'Полюс (-5 ч)' },
      ]);

      expect(data['character']).toEqual([
        { value: 'ent_1', label: 'Герой' },
        { value: 'ent_2', label: 'Город' },
        { value: 'ent_3', label: 'Артефакт' },
        { value: '', label: 'Без названия' },
      ]);
      expect(types.has('calendar')).toBe(false);
      expect(types.has('planet')).toBe(false);
      expect(types.has('timezone')).toBe(false);
    });

    it('falls back to UTC-12..+14 timezones when no calendar or planet timezones exist', async () => {
      mockGetCalendars.mockResolvedValue([]);
      mockGetPlanets.mockReturnValue([]);

      const data = await fetchSpecialRefData('proj_1', new Set(['timezone']));
      expect(data['timezone']).toHaveLength(27);
      expect(data['timezone'][0]).toEqual({ value: 'UTC-12', label: 'UTC-12 (-12 ч)' });
      expect(data['timezone'][12]).toEqual({ value: 'UTC+0', label: 'UTC+0 (Гринвич)' });
      expect(data['timezone'][26]).toEqual({ value: 'UTC+14', label: 'UTC+14 (+14 ч)' });
    });

    it('handles errors gracefully across calendar, planet, timezone and generic entities', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetCalendars.mockRejectedValue(new Error('cal err'));
      mockGetPlanets.mockImplementation(() => {
        throw new Error('planet err');
      });
      vi.mocked(api.getEntities).mockRejectedValue(new Error('api err'));

      const data = await fetchSpecialRefData('proj_1', new Set(['calendar', 'planet', 'timezone', 'faction']));
      expect(data).toEqual({});
      expect(errSpy).toHaveBeenCalledTimes(4);
      errSpy.mockRestore();
    });
  });
});

