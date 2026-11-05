import * as api from '../../../../services/api.client';
import type {
  SchemaConfig,
  SchemaSection,
  SchemaField,
  DynamicContainer,
} from '../EntityEditor.model';

export function patchEntityConfig(cfg: SchemaConfig, entityType?: string): SchemaConfig {
  if (!cfg?.sections) return cfg;

  if (entityType === 'state') {
    cfg.sections = cfg.sections.filter((s) => s.id !== 'regions');
  }

  cfg.sections.forEach((sec: SchemaSection & { items?: Array<Record<string, unknown>> }) => {
    if (
      sec.items &&
      (!sec.fields || sec.fields.length === 0) &&
      (!sec.dynamicContainers || sec.dynamicContainers.length === 0)
    ) {
      const fields: Array<SchemaField> = [];
      const dynamicContainers: Array<DynamicContainer> = [];
      sec.items.forEach((it: Record<string, unknown>) => {
        if (it.template || it.dataPath || it.type === 'dynamic' || it.type === 'timeline') {
          dynamicContainers.push(it as unknown as DynamicContainer);
        } else {
          fields.push(it as unknown as SchemaField);
        }
      });
      sec.fields = fields;
      sec.dynamicContainers = dynamicContainers;
    }

    if (sec.fields) {
      if (entityType === 'state') {
        if (sec.id === 'basic') {
          if (!sec.fields.some((f) => f.path === 'столица' || f.id === 'stateCapital')) {
            sec.fields.push({
              id: 'stateCapital',
              type: 'select',
              entityType: 'location',
              label: 'Столица государства',
              path: 'столица',
              placeholder: 'Выберите город-столицу...',
            } as SchemaField);
          }
          const calField = sec.fields.find(
            (f) => f.path === 'официальный_календарь' || f.id === 'stateOfficialCalendar'
          );
          if (calField) {
            calField.type = 'select';
            calField.entityType = 'calendar';
            calField.label = 'Государственное летоисчисление / Календарь';
            const calIdx = sec.fields.indexOf(calField);
            const foundIdx = sec.fields.findIndex((f) => f.path === 'дата_основания');
            if (foundIdx > 0 && calIdx > foundIdx) {
              sec.fields.splice(calIdx, 1);
              sec.fields.splice(foundIdx, 0, calField);
            }
          }
          const tzField = sec.fields.find(
            (f) => f.path === 'официальный_часовой_пояс' || f.id === 'stateOfficialTimezone'
          );
          if (tzField) {
            tzField.type = 'select';
            tzField.entityType = 'timezone';
            tzField.label = 'Официальное столичное время (Часовой пояс)';
          }
          const regField = sec.fields.find(
            (f) => f.path === 'территориальные_регионы' || f.id === 'stateTerritorialRegions'
          );
          if (regField) {
            regField.type = 'multiselect';
            regField.entityType = 'location';
            regField.label = 'Административно-территориальное деление (Регионы / Провинции)';
          }
        }
        sec.fields.forEach((f: SchemaField) => {
          if (
            f.path === 'столица' ||
            f.id === 'stateCapital' ||
            String(f.label || '').startsWith('Столица')
          ) {
            f.type = 'select';
            f.entityType = 'location';
          }
        });
      }

      if (entityType === 'location') {
        if (sec.id === 'basic') {
          const hasType = sec.fields.some((f) => f.path === 'тип_локации' || f.id === 'locType');
          const scaleIdx = sec.fields.findIndex((f) => f.path === 'scale_level' || f.id === 'locScale');
          if (hasType && scaleIdx >= 0) {
            sec.fields.splice(scaleIdx, 1);
          }
          const typeField = sec.fields.find((f) => f.path === 'тип_локации' || f.id === 'locType');
          if (typeField) {
            typeField.isSystem = true;
            typeField.required = true;
            typeField.label = 'Масштаб и тип локации';
          }
        }
        if (sec.id === 'geography') {
          const tzField = sec.fields.find((f) => f.path === 'часовой_пояс' || f.id === 'locTimezone');
          if (tzField) {
            tzField.type = 'select';
            tzField.entityType = 'timezone';
          }
        }
      }
    }

    if (sec.dynamicContainers) {
      if (entityType === 'state' && sec.id === 'governance') {
        sec.dynamicContainers = sec.dynamicContainers.filter((dc) => dc.id !== 'adminDivisions');
      }
      sec.dynamicContainers.forEach((dc: DynamicContainer, idx: number) => {
        if (!dc.id) dc.id = dc.template ? `dyn_${dc.template}` : `dyn_${idx}`;
        if (!dc.dataPath) dc.dataPath = dc.id;
        if (dc.fieldOverrides) {
          Object.values(dc.fieldOverrides).forEach((ovRaw) => {
            const ov = ovRaw as Record<string, unknown>;
            if (String(ov?.['label'] || '').startsWith('Столица')) {
              ov['type'] = 'select';
              ov['entityType'] = 'location';
            }
          });
        }
      });
    }
  });

  return cfg;
}

export async function fetchSpecialRefData(
  project: string,
  entityTypesToLoad: Set<string>
): Promise<Record<string, Array<{ value: string; label: string }>>> {
  const result: Record<string, Array<{ value: string; label: string }>> = {};

  if (entityTypesToLoad.has('calendar')) {
    try {
      const { useCalendarStore } = await import('@/stores/calendar.store');
      const calStore = useCalendarStore();
      const calendars = await calStore.getCalendars(project);
      const mapped = calendars.map((c) => ({
        value: String(c.id || c.name || ''),
        label: String(c.name || (c.data as Record<string, unknown>)?.['название'] || 'Календарь'),
      }));
      result['calendar_list'] = mapped;
      result['calendar'] = mapped;
    } catch (e) {
      console.error('Error loading calendar ref data:', e);
    }
    entityTypesToLoad.delete('calendar');
  }

  if (entityTypesToLoad.has('timezone')) {
    try {
      const { useCalendarStore } = await import('@/stores/calendar.store');
      const calStore = useCalendarStore();
      const planets = calStore.getPlanets(project);
      const calendars = await calStore.getCalendars(project);
      const masterCal = calendars.find((c) => c.is_master) || calendars[0];
      const masterData = (masterCal?.data as Record<string, unknown>) || {};
      const tzList: Array<{ value: string; label: string }> = [];

      if (Array.isArray(masterData['timezones'])) {
        masterData['timezones'].forEach((tz: Record<string, unknown>) => {
          const code = String(tz.code || tz.id || '');
          const offset = Number(tz.base_offset_hours ?? 0);
          const sign = offset >= 0 ? '+' : '';
          tzList.push({
            value: String(tz.id || code),
            label: `${String(tz.name || code)} (${sign}${offset} ч)`,
          });
        });
      }
      if (planets[0]?.timezones) {
        planets[0].timezones.forEach((tz) => {
          const raw = tz as unknown as Record<string, unknown>;
          const code = String(raw.code || raw.id || raw.name || '');
          const offset = Number(raw.base_offset_hours ?? raw.offset_hours ?? 0);
          const sign = offset >= 0 ? '+' : '';
          if (!tzList.some((t) => t.value === String(raw.id || code))) {
            tzList.push({
              value: String(raw.id || code),
              label: `${String(raw.name || code)} (${sign}${offset} ч)`,
            });
          }
        });
      }
      if (tzList.length === 0) {
        for (let h = -12; h <= 14; h++) {
          const sign = h >= 0 ? '+' : '';
          const code = `UTC${sign}${h}`;
          tzList.push({ value: code, label: `${code} (${h === 0 ? 'Гринвич' : `${sign}${h} ч`})` });
        }
      }
      result['timezone_list'] = tzList;
      result['timezone'] = tzList;
    } catch (e) {
      console.error('Error loading timezone ref data:', e);
    }
    entityTypesToLoad.delete('timezone');
  }

  for (const type of entityTypesToLoad) {
    try {
      const entities = await api.getEntities(project, type);
      const mapped = entities.map((e) => {
        const item = e as Record<string, unknown>;
        return {
          value: String(item.id || ''),
          label: String(item.name || item.title || item.label || 'Без названия'),
        };
      });
      result[`${type}_list`] = mapped;
      result[type] = mapped;
    } catch (e) {
      console.error(`Error loading ref data for ${type}:`, e);
    }
  }

  return result;
}

