import { ref } from 'vue';
import { apiService } from '../../services/api.service';

export function useTagsManagerModal(props: any) {
    const isOpen = ref(false);
    const loading = ref(false);
    const tags = ref<any[]>([]);
    const newTagName = ref('');
    const newTagColor = ref('#7c3aed');

    const loadTags = async () => {
        loading.value = true;
        try {
            tags.value = await apiService.getTags(props.project);
        } catch (e) {
            console.error('[TagsManager] Load error:', e);
        } finally {
            loading.value = false;
        }
    };

    const addTag = async () => {
        if (!newTagName.value.trim()) return;
        try {
            await apiService.saveTag(props.project, {
                name: newTagName.value.trim(),
                color: newTagColor.value
            } as any);
            newTagName.value = '';
            await loadTags();
        } catch (e) {
            console.error('[TagsManager] Add error:', e);
        }
    };

    const updateTag = async (tag: any) => {
        try {
            await apiService.saveTag(props.project, tag);
        } catch (e) {
            console.error('[TagsManager] Update error:', e);
        }
    };

    const deleteTag = async (id: string) => {
        if (!confirm('Удалить этот тег? Он исчезнет из всех сущностей.')) return;
        try {
            await apiService.deleteTag(props.project, id);
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
        loadTags,
        addTag,
        updateTag,
        deleteTag,
        open,
        close
    };
}
