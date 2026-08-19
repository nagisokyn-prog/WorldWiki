import { describe, it, expect, beforeEach } from 'vitest';
import { useSchemaContainer } from '../useSchemaContainer';

describe('useSchemaContainer', () => {
  let props: any;

  beforeEach(() => {
    props = {
      item: {
        title: 'Container 1',
        template: 'timelineEvents',
        hidden: false,
        fieldOverrides: {},
        customFields: [{ id: 'f1', label: 'Field 1' }],
      },
    };
  });

  it('computes availableEntityTypes, timeline flag variants and checks atomic bricks', () => {
    const container = useSchemaContainer(props);

    expect(container.isTimeline.value).toBe(true);
    expect(container.atomicBricks.length).toBeGreaterThan(0);
    expect(Array.isArray(container.availableEntityTypes.value)).toBe(true);

    // Non-timeline template
    const nonTimeline = useSchemaContainer({ item: { template: 'simpleList' } });
    expect(nonTimeline.isTimeline.value).toBe(false);

    // Undefined template
    const noTemplate = useSchemaContainer({ item: {} });
    expect(noTemplate.isTimeline.value).toBeUndefined();
  });

  it('fetches raw template fields for existing and non-existing templates', () => {
    const container = useSchemaContainer(props);
    container.fullConfig.value = {
      templates: {
        customTpl: { fields: [{ class: 'f1' }] },
      },
    };

    expect(container.getRawTemplateFields('customTpl')).toEqual([{ class: 'f1' }]);
    expect(container.getRawTemplateFields('unknownTpl')).toEqual([]);
  });

  it('manages field overrides and options when fieldOverrides is missing', () => {
    const bareItem: any = {};
    const container = useSchemaContainer(props);

    // getFieldOverride on bare item
    expect(container.getFieldOverride(bareItem, 'field1')).toEqual({});

    // toggleFieldOverride initializes fieldOverrides
    container.toggleFieldOverride(bareItem, 'field1');
    expect(bareItem.fieldOverrides.field1.hidden).toBe(true);

    // toggle back
    container.toggleFieldOverride(bareItem, 'field1');
    expect(bareItem.fieldOverrides.field1.hidden).toBe(false);

    // addFieldOption
    container.addFieldOption(bareItem, 'field1');
    expect(bareItem.fieldOverrides.field1.options.length).toBe(1);

    // add another option when options already exists
    container.addFieldOption(bareItem, 'field1');
    expect(bareItem.fieldOverrides.field1.options.length).toBe(2);
  });

  it('updates title, emptyMessage, hidden and removes custom fields with and without customFields array', () => {
    const container = useSchemaContainer(props);

    container.updateTitle('New Title');
    expect(props.item.title).toBe('New Title');

    container.updateEmptyMessage('No items found');
    expect(props.item.emptyMessage).toBe('No items found');

    container.toggleHidden();
    expect(props.item.hidden).toBe(true);

    container.removeCustomField(0);
    expect(props.item.customFields.length).toBe(0);

    // When customFields is undefined
    const bareContainer = useSchemaContainer({ item: {} });
    bareContainer.removeCustomField(0);
  });
});
