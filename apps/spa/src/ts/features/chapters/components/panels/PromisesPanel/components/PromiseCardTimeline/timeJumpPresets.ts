import { computed, ref, type Ref } from 'vue';
import type { DialDeltaChip } from '../PromiseCardMeta/PromiseCardMeta.model';

export interface TimeJumpPreset {
  id: string;
  label?: string;
  sign: 1 | -1;
  years?: number;
  months?: number;
  days?: number;
  /** Сдвиги по единицам циферблата: ключ = label чипа без '+1' (напр. 'ч', 'м'), значение = количество единиц */
  dialUnits?: Record<string, number>;
}

const presetsRegistry = new Map<string, Ref<TimeJumpPreset[]>>();

function storageKey(project: string, calendarId: string): string {
  return `ww_time_jump_presets_${project || 'default'}_${calendarId || 'default'}`;
}

function getBucket(project: string, calendarId: string): Ref<TimeJumpPreset[]> {
  const key = storageKey(project, calendarId);
  let bucket = presetsRegistry.get(key);
  if (!bucket) {
    let initial: TimeJumpPreset[] = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) initial = parsed as TimeJumpPreset[];
      }
    } catch (err) {
      console.warn('[timeJumpPresets] Failed to read presets from localStorage:', err);
    }
    bucket = ref<TimeJumpPreset[]>(initial);
    presetsRegistry.set(key, bucket);
  }
  return bucket;
}

function saveBucket(project: string, calendarId: string, list: TimeJumpPreset[]): void {
  try {
    localStorage.setItem(storageKey(project, calendarId), JSON.stringify(list));
  } catch (err) {
    console.warn('[timeJumpPresets] Failed to save presets to localStorage:', err);
  }
}

export function formatTimeJumpLabel(preset: Omit<TimeJumpPreset, 'id'>, dialChips: DialDeltaChip[] = []): string {
  if (preset.label && preset.label.trim()) return preset.label.trim();
  const signStr = preset.sign < 0 ? '−' : '+';
  const parts: string[] = [];
  if (preset.years) parts.push(`${preset.years}г`);
  if (preset.months) parts.push(`${preset.months}мес`);
  if (preset.days) parts.push(`${preset.days}д`);

  if (preset.dialUnits) {
    const orderedKeys = dialChips
      .map((c) => c.label.replace(/^\+1/, ''))
      .filter((k) => k && k !== 'д');
    const seen = new Set<string>();
    for (const k of [...orderedKeys.reverse(), ...Object.keys(preset.dialUnits)]) {
      if (seen.has(k)) continue;
      seen.add(k);
      const val = Number(preset.dialUnits[k]) || 0;
      if (val > 0) parts.push(`${val}${k}`);
    }
  }

  return parts.length > 0 ? `${signStr}${parts.join(' ')}` : `${signStr}0`;
}

export function useTimeJumpPresets(
  getProject: () => string,
  getCalendarId: () => string
) {
  const presets = computed<TimeJumpPreset[]>(() => {
    return getBucket(getProject(), getCalendarId()).value;
  });

  const addPreset = (draft: Omit<TimeJumpPreset, 'id'>, dialChips: DialDeltaChip[] = []): TimeJumpPreset => {
    const project = getProject();
    const calId = getCalendarId();
    const bucket = getBucket(project, calId);
    const created: TimeJumpPreset = {
      ...draft,
      id: `tjp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: formatTimeJumpLabel(draft, dialChips)
    };
    const next = [...bucket.value, created];
    bucket.value = next;
    saveBucket(project, calId, next);
    return created;
  };

  const removePreset = (id: string) => {
    const project = getProject();
    const calId = getCalendarId();
    const bucket = getBucket(project, calId);
    const next = bucket.value.filter((p) => p.id !== id);
    bucket.value = next;
    saveBucket(project, calId, next);
  };

  return { presets, addPreset, removePreset };
}
