import { ref } from 'vue';
import * as api from '../../services/api.client';
import type { Tag } from '../../types/generated/Tag';

export function useTagsManagerModal(props: { project: string }) {
    const isOpen = ref(false);
    const loading = ref(false);
    const tags = ref<Tag[]>([]);
    const newTagName = ref('');
    const newTagColor = ref('var(--accent-hover)');

    const loadTags = async () => {
        loading.value = true;
        try {
            tags.value = await api.getTags(props.project);
        } catch (e) {
            console.error('[TagsManager] Load error:', e);
        } finally {
            loading.value = false;
        }
    };

    const addTag = async () => {
        if (!newTagName.value.trim()) return;
        try {
            await api.saveTag(props.project, {
                project_id: `projects:${props.project}`,
                name: newTagName.value.trim(),
                color: newTagColor.value,
                id: null
            });
            newTagName.value = '';
            await loadTags();
        } catch (e) {
            console.error('[TagsManager] Add error:', e);
        }
    };

    const updateTag = async (tag: Tag) => {
        try {
            if (!tag.project_id) tag.project_id = props.project;
            await api.saveTag(props.project, tag);
        } catch (e) {
            console.error('[TagsManager] Update error:', e);
        }
    };

    const deleteTag = async (id: string) => {
        const { appConfirm } = await import('@worldwiki/components');
        if (!await appConfirm('Удалить этот тег? Он исчезнет из всех сущностей.')) return;
        try {
            await api.deleteEntity(id);
            await loadTags();
        } catch (e) {
            console.error('[TagsManager] Delete error:', e);
        }
    };

    const open = () => {
        isOpen.value = true;
        loadTags();
    };

    const close = () => {
        isOpen.value = false;
    };

    return {
        isOpen,
        loading,
        tags,
        newTagName,
        newTagColor,
        open,
        close,
        addTag,
        updateTag,
        deleteTag
    };
}
