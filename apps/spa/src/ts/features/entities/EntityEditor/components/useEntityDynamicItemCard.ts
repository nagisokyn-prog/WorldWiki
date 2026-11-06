import { computed } from 'vue';
import type { EntityDynamicItemCardProps, EntityDynamicItemCardEmits } from './EntityDynamicItemCard.model';
import type { SchemaField } from '../EntityEditor.model';

export function useEntityDynamicItemCard(
  props: EntityDynamicItemCardProps,
  emit: EntityDynamicItemCardEmits
) {
  const containerPath = computed(() => props.container.dataPath || props.container.id || '');

  const isCollapsed = computed(() => props.isItemCollapsed(containerPath.value, props.idx));

  const itemSummary = computed(() => props.getItemSummary(props.item, props.container));

  const templateFields = computed<SchemaField[]>(() => props.getResolvedTemplate(props.container)?.fields || []);

  const toggleCollapse = () => {
    emit('toggleCollapse', containerPath.value, props.idx);
  };

  const remove = () => {
    emit('remove', containerPath.value, props.idx);
  };

  const updateProp = (fieldKey: string, value: unknown) => {
    props.setProp(props.item, fieldKey, value);
    emit('modified');
  };

  const onMultiselectToggle = (fieldKey: string, optValue: string, checked: boolean) => {
    const current = [...((props.getProp(props.item, fieldKey) as unknown[]) || [])];
    if (checked) {
      current.push(optValue);
    } else {
      const idx = current.indexOf(optValue);
      if (idx > -1) current.splice(idx, 1);
    }
    updateProp(fieldKey, current);
  };

  return {
    containerPath,
    isCollapsed,
    itemSummary,
    templateFields,
    toggleCollapse,
    remove,
    updateProp,
    onMultiselectToggle,
  };
}

