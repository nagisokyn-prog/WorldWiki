import { describe, it, expect, beforeEach } from 'vitest';
import { useSchemaFieldEditor } from '../useSchemaFiledEditor';

describe('useSchemaFieldEditor', () => {
  let props: any;

  beforeEach(() => {
    props = {
      item: {
        label: 'Name',
        type: 'text',
        placeholder: 'Enter name',
        hidden: false,
        options: [{ value: 'opt1', label: 'Option 1' }],
      },
    };
  });

  it('provides type options and months list', () => {
    const editor = useSchemaFieldEditor(props);

    expect(editor.typeOptions.length).toBeGreaterThan(0);
    expect(editor.monthsList.length).toBe(12);
  });

  it('updates label, placeholder, value and type', () => {
    const editor = useSchemaFieldEditor(props);

    editor.updateLabel('Full Name');
    expect(props.item.label).toBe('Full Name');

    editor.updatePlaceholder('Type your full name');
    expect(props.item.placeholder).toBe('Type your full name');

    editor.setType('textarea');
    expect(props.item.type).toBe('textarea');

    editor.updateVal('default text');
    expect(props.item._val).toBe('default text');

    editor.toggleHidden();
    expect(props.item.hidden).toBe(true);
  });

  it('manages options list', () => {
    const editor = useSchemaFieldEditor(props);

    editor.addOption();
    expect(props.item.options.length).toBe(2);

    editor.removeOption(0);
    expect(props.item.options.length).toBe(1);
  });
});
