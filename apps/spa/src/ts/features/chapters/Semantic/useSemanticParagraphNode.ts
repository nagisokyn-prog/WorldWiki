import { computed } from 'vue';

export interface SemanticParagraphNodeProps {
    node?: {
        attrs?: {
            semanticTag?: string;
            [key: string]: unknown;
        };
        [key: string]: unknown;
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

    const badgeStyle = computed(() => {
        const tag = props.node?.attrs?.semanticTag || 'desc';
        let bg = 'rgba(148, 163, 184, 0.1)';
        let color = '#94a3b8';

        if (tag === 'dialog') {
            bg = 'rgba(56, 189, 248, 0.1)';
            color = '#38bdf8';
        } else if (tag === 'thought') {
            bg = 'rgba(192, 132, 252, 0.1)';
            color = '#c084fc';
        }

        return {
            background: bg,
            color: color,
            position: 'absolute' as const,
            left: '0',
            top: '2px',
            fontWeight: '800',
            fontSize: '9px',
            padding: '2px 4px',
            borderRadius: '3px',
            cursor: 'pointer',
            userSelect: 'none' as const
        };
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
        badgeStyle,
        cycleTag
    };
}
