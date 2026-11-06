import type { TemplateConf, TemplateField } from '@/shared/ui/RelationshipBlock/RelationshipBlock.model';
import type { EntityDynamicContainersProps, EntityDynamicContainersEmits } from './EntityDynamicContainers.model';
import type { DynamicContainer } from '../../EntityEditor.model';

export function useEntityDynamicContainers(
  props: EntityDynamicContainersProps,
  emit: EntityDynamicContainersEmits
) {
  const getTemplateConf = (container: DynamicContainer): TemplateConf => {
    return (props.getResolvedTemplate(container) as unknown as TemplateConf) || ({} as TemplateConf);
  };

  const getAllTemplates = (): Record<string, { fields?: TemplateField[]; [key: string]: unknown }> => {
    return (props.config?.templates as unknown as Record<string, { fields?: TemplateField[]; [key: string]: unknown }>) || {};
  };

  const handleItemUpdated = (
    container: DynamicContainer,
    idx: number,
    payload?: { item?: Record<string, unknown>; idx?: number }
  ) => {
    const itemIdx = payload?.idx ?? idx;
    const structuredArr = props.getDynamicList(container);
    if (structuredArr && Array.isArray(structuredArr) && itemIdx < structuredArr.length) {
      if (payload?.item) structuredArr[itemIdx] = payload.item;
      emit('modified');
    }
  };

  const onToggleCollapse = (path: string, i: number) => {
    emit('toggleItemCollapse', path, i);
  };

  const onRemoveItem = (path: string, i: number) => {
    emit('removeDynamicItem', path, i);
  };

  return {
    getTemplateConf,
    getAllTemplates,
    handleItemUpdated,
    onToggleCollapse,
    onRemoveItem,
  };
}

