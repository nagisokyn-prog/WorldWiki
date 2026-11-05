import { computed } from 'vue';

export interface SemanticParagraphProps {
    node: {
        attrs: {
            semanticTag?: string;
            [key: string]: unknown;
        };
        [key: string]: unknown;
    };
    updateAttributes: (attrs: Record<string, unknown>) => void;
}

export function useSemanticParagraph(props: SemanticParagraphProps) {
    const tags = ['desc', 'dialog', 'thought'];
    const tagLabels: Record<string, { label: string, title: string }> = {
        'desc': { label: '!о', title: 'Описание' },
        'dialog': { label: '!д', title: 'Диалог' },
        'thought': { label: '!м', title: 'Мысли' }
    };

    const currentTag = computed(() => props.node.attrs.semanticTag || 'desc');
    const tagDisplay = computed(() => tagLabels[currentTag.value]?.label || '!о');
    const tagTitle = computed(() => tagLabels[currentTag.value]?.title || 'Описание');

    const cycleTag = () => {
        const currentIndex = tags.indexOf(currentTag.value);
        const nextIndex = (currentIndex + 1) % tags.length;
        const nextTag = tags[nextIndex];
        props.updateAttributes({ semanticTag: nextTag });
    };

    return {
        currentTag,
        tagDisplay,
        tagTitle,
        cycleTag
    };
}
