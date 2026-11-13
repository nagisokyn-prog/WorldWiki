import type { Ref } from 'vue';
import { plotApi } from '@/services/api/plot.api';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import { cleanId } from './usePromiseFiltering';
import type { RichPlotPromise } from './PromiseActions.model';
import { preparePromisePayload } from './usePromisePayloadBuilder';

export function createPromisePersister(options: {
  promises: Ref<RichPlotPromise[]>;
  getProject: () => string;
  getChapterId: () => string | null;
  syncLocalBackup: () => void;
  onChange: () => void;
}) {
  let persistQueue = Promise.resolve();

  return (item: RichPlotPromise, logMsg: string): Promise<void> => {
    persistQueue = persistQueue
      .then(async () => {
        let payloadForLog: PlotPromise | null = null;
        let attempts = 0;
        while (attempts < 4) {
          attempts++;
          try {
            console.log(logMsg, { project: options.getProject(), item });
            const payload = preparePromisePayload(item, options.getChapterId());
            payloadForLog = payload;
            const saved = (await plotApi.savePlotPromise(options.getProject(), payload)) as RichPlotPromise | null;
            if (saved) {
              const cleanSavedId = cleanId(item.id);
              const idx = options.promises.value.findIndex(
                (p) => p.id === item.id || cleanId(p.id) === cleanSavedId
              );
              if (idx !== -1) {
                options.promises.value[idx] = {
                  ...options.promises.value[idx],
                  timeline_event_id: saved.timeline_event_id || options.promises.value[idx].timeline_event_id,
                  m_abs: saved.m_abs ?? options.promises.value[idx].m_abs,
                  calendar_id: saved.calendar_id || options.promises.value[idx].calendar_id,
                };
              }
            }
            break;
          } catch (err) {
            const errStr = err instanceof Error ? err.message : String(err);
            const isConflict =
              errStr.includes('Transaction conflict') ||
              errStr.includes('write conflict') ||
              (typeof err === 'object' && err !== null && JSON.stringify(err).includes('conflict'));
            if (isConflict && attempts < 4) {
              await new Promise((r) => setTimeout(r, attempts * 150));
              continue;
            }
            console.error(`[usePromiseActions ERROR] Failed: ${logMsg}`, err, {
              errorMsg: errStr,
              item,
              payload: payloadForLog,
            });
            break;
          }
        }
        options.syncLocalBackup();
        options.onChange();
      })
      .catch((qErr) => {
        console.warn('[usePromiseActions] Queue error:', qErr);
      });
    return persistQueue;
  };
}

