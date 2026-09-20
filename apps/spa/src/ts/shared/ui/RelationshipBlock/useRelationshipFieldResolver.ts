import type { TemplateField, SubConf, RelationshipBlockProps } from './RelationshipBlock.model';

export function useRelationshipFieldResolver(props: RelationshipBlockProps) {
  const getResolvedFields = (
    subConf?: SubConf | { template?: string; fields?: TemplateField[]; fieldOverrides?: Record<string, { hidden?: boolean; [key: string]: unknown }> }
  ): TemplateField[] => {
    let tpl: { fields?: TemplateField[]; fieldOverrides?: Record<string, { hidden?: boolean; [key: string]: unknown }> } | undefined;
    if (subConf) {
      if (subConf.fields) {
        tpl = subConf;
      } else if (subConf.template) {
        const templateKey = subConf.template;
        tpl = props.allTemplates[templateKey] || undefined;
      }
    } else {
      tpl = props.templateConf;
    }
    if (!tpl) return [];

    let fields = tpl.fields || [];
    const overrides = (subConf ? subConf.fieldOverrides : props.templateConf.fieldOverrides) || {};

    if (overrides) {
      fields = fields
        .map((f) => {
          const override = f.class ? overrides[f.class] : undefined;
          if (override) {
            if (override.hidden) return null;
            return { ...f, ...override };
          }
          return f;
        })
        .filter((f): f is TemplateField => f !== null);
    }
    return fields;
  };

  const getDynamicContainerFields = (subConf: SubConf): TemplateField[] => {
    if (!subConf) return [];
    if (subConf.fields && subConf.fields.length > 0) {
      return subConf.fields;
    }
    if (subConf.template) {
      const templateKey = subConf.template;
      const tpl = props.allTemplates[templateKey];
      if (tpl && tpl.fields) {
        return tpl.fields;
      }
    }
    return [];
  };

  const getOptions = (field: TemplateField): unknown[] => {
    if (field?.options && field.options.length > 0) return field.options;
    const type = field?.entityType || (props.templateConf.foreign_type as string | undefined);
    if (type) {
      if (props.referenceData[`${type}_list`]) return props.referenceData[`${type}_list`];
      if (props.referenceData[type]) return props.referenceData[type];
    }
    return [];
  };

  return {
    getResolvedFields,
    getDynamicContainerFields,
    getOptions
  };
}
