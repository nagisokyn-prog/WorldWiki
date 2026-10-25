<template>
  <div ref="wrapperRef" class="tags-field-vue" :class="{ 'is-open': isDropdownOpen }">
    <div ref="inputContainerRef" class="tags-input-container" @click="focusInput">
      <div v-for="tag in selectedTags" :key="tag" class="tag-pill" :style="{ '--tag-color': getTagColor(tag) }">
        <span class="tag-text">{{ tag }}</span>
        <button class="tag-remove" @click.stop="removeTag(tag)">&times;</button>
      </div>
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        class="tags-input"
        :placeholder="selectedTags.length === 0 ? placeholder : ''"
        @keydown.enter.prevent="addCurrentTag"
        @keydown.backspace="handleBackspace"
        @focus="openDropdown"
        @blur="handleBlur"
      />
    </div>

    <!-- Dropdown with Teleport to ensure it overlays everything -->
    <Teleport to="body">
      <transition name="dropdown-fade">
        <div 
          v-if="isDropdownOpen && (filteredTags.length > 0 || query)" 
          class="tags-dropdown glass-panel"
          :style="dropdownStyle"
        >
          <div 
            v-for="tag in filteredTags" 
            :key="tag.id" 
            class="tag-option interactive-el"
            :class="{ selected: selectedTags.includes(tag.name) }"
            @mousedown.prevent="toggleTag(tag.name)"
          >
            <div class="tag-color-dot" :style="{ '--tag-dot-color': tag.color }"></div>
            <span class="tag-name">{{ tag.name }}</span>
            <i v-if="selectedTags.includes(tag.name)" class="fas fa-check tag-check"></i>
          </div>
          <div v-if="query && !exactMatch" class="tag-option create-option interactive-el" @mousedown.prevent="addCurrentTag">
            <span class="tag-name">{{ t('tags.createTag', { query }) }}</span>
            <span class="tag-hint">Enter</span>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { 
  useTagsField, 
  type TagsFieldProps, 
  type TagsFieldEmits,
  type TagItem 
} from './useTagsField';

export type { TagItem };

const props = defineProps<TagsFieldProps>();
const emit = defineEmits<TagsFieldEmits>();

const {
  t,
  wrapperRef,
  inputContainerRef,
  inputRef,
  query,
  isDropdownOpen,
  dropdownStyle,
  selectedTags,
  filteredTags,
  exactMatch,
  getTagColor,
  focusInput,
  openDropdown,
  toggleTag,
  addCurrentTag,
  removeTag,
  handleBackspace,
  handleBlur
} = useTagsField(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/components/TagsField.css"></style>
