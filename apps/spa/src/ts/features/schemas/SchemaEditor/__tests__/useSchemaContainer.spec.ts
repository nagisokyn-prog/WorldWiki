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

  it('computes timeline flag and checks atomic bricks', () => {
    const container = useSchemaContainer(props);

    expect(container.isTimeline.value).toBe(true);
    expect(container.atomicBricks.length).toBeGreaterThan(0);
  });

  it('manages field overrides and options', () => {
    const container = useSchemaContainer(props);

    const override = container.ensureFieldOverride(props.item, 'status');
    expect(override).toEqual({});

    container.toggleFieldOverride(props.item, 'status');
    expect(props.item.fieldOverrides.status.hidden).toBe(true);

    container.addFieldOption(props.item, 'status');
    expect(props.item.fieldOverrides.status.options.length).toBe(1);

    expect(container.getFieldOverride(props.item, 'status').hidden).toBe(true);
  });

  it('updates title, emptyMessage, hidden and removes custom fields', () => {
    const container = useSchemaContainer(props);

    container.updateTitle('New Title');
    expect(props.item.title).toBe('New Title');

    container.updateEmptyMessage('No items found');
    expect(props.item.emptyMessage).toBe('No items found');

    container.toggleHidden();
    expect(props.item.hidden).toBe(true);

    container.removeCustomField(0);
    expect(props.item.customFields.length).toBe(0);
  });
});
