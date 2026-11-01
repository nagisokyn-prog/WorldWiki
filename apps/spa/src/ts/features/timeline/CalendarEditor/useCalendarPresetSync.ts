import type { useCalendarStore } from '@/stores/calendar.store';
import type { CalendarData } from '@/services/Calendars/calendar.types';
import type { CalendarPreset } from '../Calendars/presets';

/**
 * Synchronizes preset timezones and regions with the parent planet.
 */
export async function syncPresetWithPlanet(
  preset: CalendarPreset,
  patchedData: CalendarData,
  projectId: string,
  calendarStore: ReturnType<typeof useCalendarStore>
): Promise<void> {
  try {
    const planets = calendarStore.getPlanets(projectId);
    const cleanTargetId = String(patchedData.planet_id || '').replace(/^planets:/, '');
    const targetPlanet = planets.find(
      (p) => String(p.id).replace(/^planets:/, '') === cleanTargetId || p.name === patchedData.planet_id
    ) || planets[0];

    if (!targetPlanet) return;

    let planetUpdated = false;
    const currentTzs = [...(targetPlanet.timezones || [])];
    const currentRegs = [...(targetPlanet.regions || [])];

    const presetTz = typeof patchedData.calendar_timezone === 'string' ? patchedData.calendar_timezone : undefined;
    if (presetTz && !currentTzs.some((tz) => tz.code === presetTz || tz.name === presetTz)) {
      const match = presetTz.match(/([+-]?\d+(?:\.\d+)?)/);
      const offsetHours = match ? parseFloat(match[1]) : 0;
      currentTzs.push({
        id: `tz_${preset.id}`,
        name: `${preset.name} (${presetTz})`,
        code: presetTz,
        base_offset_hours: offsetHours,
      });
      planetUpdated = true;
    }

    const cultureRegionName = preset.name;
    let regId = `reg_${preset.id}`;
    const foundReg = currentRegs.find((r) => r.name.toLowerCase().includes(cultureRegionName.toLowerCase()));
    if (!foundReg) {
      currentRegs.push({
        id: regId,
        name: cultureRegionName,
        timezone_id: presetTz || 'UTC+0',
        latitude: 50.0,
        longitude: 0.0,
      });
      planetUpdated = true;
    } else {
      regId = foundReg.id || regId;
    }

    if (!patchedData.region_ids) patchedData.region_ids = [];
    if (!patchedData.region_ids.includes(regId)) patchedData.region_ids.push(regId);

    if (planetUpdated) {
      await calendarStore.savePlanet(projectId, {
        ...targetPlanet,
        timezones: currentTzs,
        regions: currentRegs,
      });
    }
  } catch (err) {
    console.warn('[CalendarEditor] Failed to sync preset timezones with planet:', err);
  }
}

