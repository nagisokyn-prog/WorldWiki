import { ref, computed } from 'vue';
import { settingsService } from '@worldwiki/components';
import type { RelationshipBlockProps } from './RelationshipBlock.model';
import { useRelationshipFieldResolver } from './useRelationshipFieldResolver';
import { useRelationshipForeignSync } from './useRelationshipForeignSync';
import { useRelationshipNestedOps } from './useRelationshipNestedOps';

export function useRelationshipBlock(props: RelationshipBlockProps, emit: (event: string, ...args: unknown[]) => void) {
  const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');

  const linkClass = computed<string>(() => {
    if (props.templateConf.bidirectionalLinkClass) {
      return props.templateConf.bidirectionalLinkClass;
    }
    const tpl = props.templateConf;
    if (tpl.fields) {
      const linkField = tpl.fields.find((f) => f.type === 'select' && f.entityType);
      if (linkField && linkField.class) return linkField.class;
      const anySelect = tpl.fields.find((f) => f.type === 'select');
      if (anySelect && anySelect.class) return anySelect.class;
      return tpl.fields[0]?.class || '';
    }
    return '';
  });

  const getTargetForeignId = () => {
    return linkClass.value ? props.item[linkClass.value] : undefined;
  };

  const { getResolvedFields, getDynamicContainerFields, getOptions } = useRelationshipFieldResolver(props);

  const {
    foreignItem,
    foreignLoading,
    foreignError,
    foreignModified,
    myLabel,
    foreignLabel,
    loadForeignItem,
    fetchForeignItem,
    updateForeignField,
    updateForeignNestedField
  } = useRelationshipForeignSync(props, emit, linkClass, getTargetForeignId);

  const {
    getNestedList,
    addNestedItem,
    removeNestedItem,
    updateItemField,
    onSelectChange,
    onLinkChange,
    makeSelectHandler,
    notifyNestedItemUpdate
  } = useRelationshipNestedOps(props, emit, linkClass, getResolvedFields, foreignItem, loadForeignItem);

  const formatLabel = (str: string) => {
    if (!str) return '';
    return str.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  };

  const templateFields = computed(() => {
    return (props.templateConf?.fields || []).map((cf) => ({
      ...cf,
      displayLabel: cf.label || formatLabel(cf.class || '')
    }));
  });

  const getInputValue = (event: Event): string =>
    (event.target as HTMLInputElement | HTMLTextAreaElement).value;

  const getInputNumber = (event: Event): number =>
    Number((event.target as HTMLInputElement).value);

  return {
    wheelHorizontal,
    templateFields,
    formatLabel,
    getInputValue,
    getInputNumber,
    foreignItem,
    foreignLoading,
    foreignError,
    foreignModified,
    linkClass,
    myLabel,
    foreignLabel,
    fetchForeignItem,
    onLinkChange,
    loadForeignItem,
    getOptions,
    getResolvedFields,
    getNestedList,
    addNestedItem,
    removeNestedItem,
    getDynamicContainerFields,
    updateItemField,
    updateForeignField,
    updateForeignNestedField,
    onSelectChange,
    makeSelectHandler,
    notifyNestedItemUpdate
  };
}
