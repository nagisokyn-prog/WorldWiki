import { computed } from 'vue';
import type { EntityHiddenManagerProps } from './EntityHiddenManager.model';

export interface HiddenDisplayItem {
  id: string;
  label: string;
}

export function useEntityHiddenManager(props: EntityHiddenManagerProps) {
  const hiddenSectionsList = computed<HiddenDisplayItem[]>(() =>
    props.hiddenSections.map((sId) => ({
      id: sId,
      label: props.sections?.find((s) => s.id === sId)?.title || sId,
    }))
  );

  const hiddenFieldsList = computed<HiddenDisplayItem[]>(() =>
    props.hiddenFields.map((fKey) => ({
      id: fKey,
      label: props.getFieldLabel(fKey),
    }))
  );

  const hiddenContainersList = computed<HiddenDisplayItem[]>(() =>
    props.hiddenContainers.map((cId) => ({
      id: cId,
      label: props.getContainerTitle(cId),
    }))
  );

  return {
    hiddenSectionsList,
    hiddenFieldsList,
    hiddenContainersList,
  };
}

