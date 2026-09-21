/**
 * @file shell.dataMerge.ts
 * @description Логика слияния данных сущностей и LiveSync уведомлений для Shell
 */

import type { EditorTab } from './shell.types';

export function deepMergeData(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key in source) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMergeData(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else if (Array.isArray(source[key])) {
      if (!Array.isArray(target[key])) target[key] = [];
      const targetArr = target[key] as unknown[];
      const sourceArr = source[key] as unknown[];
      for (let i = 0; i < sourceArr.length; i++) {
        if (i < targetArr.length) {
          if (typeof sourceArr[i] === 'object' && sourceArr[i] !== null) {
            deepMergeData(targetArr[i] as Record<string, unknown>, sourceArr[i] as Record<string, unknown>);
          } else {
            targetArr[i] = sourceArr[i];
          }
        } else {
          targetArr.push(sourceArr[i]);
        }
      }
      targetArr.length = sourceArr.length;
    } else {
      target[key] = source[key];
    }
  }
}

export interface UpdateDataParams {
  tabId: string;
  newData: Record<string, unknown>;
  fromLiveSync?: boolean;
  allTabs: EditorTab[];
  getEntityDisplayName: (data: Record<string, unknown>, type: string) => string;
  isLiveSyncing: boolean;
  onEmitLiveSync: (type: string, id: string, data: Record<string, unknown>) => void;
}

export function performUpdateData(params: UpdateDataParams): void {
  const { tabId, newData, fromLiveSync, allTabs, getEntityDisplayName, isLiveSyncing, onEmitLiveSync } = params;
  const tabsToUpdate = allTabs.filter((t) => t.id === tabId || t.rawId === tabId.replace('entities:', ''));
  if (tabsToUpdate.length === 0) return;

  let updatedEntityType: string | null = null;
  let updatedRawId: string | null = null;

  for (const tab of tabsToUpdate) {
    const { __foreignUpdates, ...dataToMerge } = newData as Record<string, unknown> & { __foreignUpdates?: Record<string, unknown> };
    const oldTitle = tab.title;
    deepMergeData(tab.data, dataToMerge);
    if (__foreignUpdates && Object.keys(__foreignUpdates).length > 0) {
      tab._foreignUpdates = __foreignUpdates;
    }

    const newTitle = getEntityDisplayName(tab.data as Record<string, unknown>, tab.entityType);
    if (newTitle && newTitle !== oldTitle) {
      tab.title = newTitle;
    }

    updatedEntityType = tab.entityType;
    updatedRawId = tab.rawId;
  }

  if (!fromLiveSync && !isLiveSyncing && updatedEntityType && updatedRawId) {
    onEmitLiveSync(updatedEntityType, updatedRawId, newData);
  }
}
