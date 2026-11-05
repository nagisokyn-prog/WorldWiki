import { computed } from 'vue';
import type { NodeViewProps } from '@tiptap/vue-3';

export interface SemanticParagraphNodeProps {
    node?: NodeViewProps['node'] | {
        attrs?: {
            semanticTag?: string;
            [key: string]: unknown;
        };
    };
    updateAttributes?: (attrs: Record<string, unknown>) => void;
}

export function useSemanticParagraphNode(props: SemanticParagraphNodeProps) {
    const tagLabel = computed(() => {
        const tag = props.node?.attrs?.semanticTag || 'desc';
        if (tag === 'desc') return '!о';
        if (tag === 'dialog') return '!д';
        if (tag === 'thought') return '!м';
        return '!о';
    });

    const tagTooltip = computed(() => {
        const tag = props.node?.attrs?.semanticTag || 'desc';
        if (tag === 'desc') return 'Описание (клик для смены)';
        if (tag === 'dialog') return 'Диалог (клик для смены)';
        if (tag === 'thought') return 'Мысль (клик для смены)';
        return 'Тег';
    });

    const tagClass = computed(() => {
        const tag = props.node?.attrs?.semanticTag || 'desc';
        return `tag-${tag}`;
    });

    const cycleTag = () => {
        if (!props.updateAttributes) return;

        const tags = ['desc', 'dialog', 'thought'];
        const currentTag = props.node?.attrs?.semanticTag || 'desc';
        const currentIndex = tags.indexOf(currentTag);
        const nextTag = tags[(currentIndex + 1) % tags.length];

        props.updateAttributes({
            semanticTag: nextTag
        });
    };

    return {
        tagLabel,
        tagTooltip,
        tagClass,
        cycleTag
    };
}
