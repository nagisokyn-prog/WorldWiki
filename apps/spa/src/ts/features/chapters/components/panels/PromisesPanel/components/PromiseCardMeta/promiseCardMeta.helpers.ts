import type { RichPlotPromise } from '../../usePromisesPanel';
import type { DatePrecision, TimeOfDayPreset } from '@/types/narrative';
import type { DatePickerModelValue } from '@/shared/ui/UniversalDatePicker/useUniversalDatePicker';

export function buildDateUpdatedPromise(
  item: RichPlotPromise,
  params: {
    model: DatePickerModelValue | null;
    calendarId: string | null;
    mAbsEnd: number | null;
    datePrecision: DatePrecision;
    isApproximate: boolean;
    timeOfDay: TimeOfDayPreset | null;
    fallbackFields: { era_index: number; year: number; month: number; day: number; hour: number; minute: number };
  }
): RichPlotPromise {
  const inp = params.model?.original_input;
  return {
    ...item,
    m_abs: params.model?.absolute_minute ?? null,
    m_abs_end: params.mAbsEnd,
    date_precision: params.datePrecision,
    is_approximate: params.isApproximate,
    time_of_day: params.timeOfDay,
    calendar_id: params.calendarId || params.model?.calendar_id || null,
    date_fields: inp
      ? { era_index: inp.era_index, year: inp.year, month: inp.month, day: inp.day, hour: inp.hour, minute: inp.minute }
      : params.fallbackFields
  };
}

export function buildCopiedDatePromise(item: RichPlotPromise, prev: RichPlotPromise): RichPlotPromise {
  return {
    ...item,
    m_abs: prev.m_abs ?? null,
    m_abs_end: prev.m_abs_end ?? null,
    date_precision: prev.date_precision ?? 'exact',
    is_approximate: Boolean(prev.is_approximate),
    time_of_day: prev.time_of_day ?? null,
    calendar_id: prev.calendar_id ?? item.calendar_id ?? null,
    date_fields: prev.date_fields ? { ...prev.date_fields } : null
  };
}

export function buildCopiedContextPromise(item: RichPlotPromise, prev: RichPlotPromise): RichPlotPromise {
  const prevArcs = Array.isArray(prev.arcs) ? prev.arcs.map((a) => ({ ...a })) : [];
  const primaryArc = prevArcs[0];
  return {
    ...item,
    location_id: prev.location_id ?? null,
    participant_ids: Array.isArray(prev.participant_ids) ? [...prev.participant_ids] : [],
    arcs: prevArcs,
    arc_id: primaryArc?.arc_id ? String(primaryArc.arc_id) : (prev.arc_id ?? null),
    arc_phase: primaryArc?.arc_phase ? String(primaryArc.arc_phase) : (prev.arc_phase ?? null)
  };
}
