<template>
  <div class="module-help-wrapper" @mousedown.stop @click.stop>
    <button 
      ref="triggerEl"
      class="module-help-trigger interactive-el" 
      :title="'Справка и боевой вид: ' + templateKey"
      @mouseenter="showPopup"
      @mouseleave="hidePopup"
      @click="togglePopup"
    >
      <i class="fas fa-question"></i>
    </button>

    <Teleport to="body">
      <Transition name="fade-slide">
        <div 
          v-if="isVisible" 
          ref="popoverEl"
          class="module-help-popover glass-card"
          :style="{ '--popover-top': popoverStyle.top, '--popover-left': popoverStyle.left }"
          @mouseenter="showPopup"
          @mouseleave="hidePopup"
        >
          <!-- ШАПКА СПРАВКИ -->
          <div class="popover-header">
            <div class="flex justify-between items-center mb-1">
              <span class="module-main-title">{{ templateKey }}</span>
              <span class="module-type-tag">{{ isBidiType ? 'ДВУСТОРОННИЙ' : (isTimelineType ? 'ТАЙМЛАЙН' : 'ДИНАМИКА') }}</span>
            </div>

            <!-- БЫСТРАЯ НАВИГАЦИЯ ПО ПРИМЕРАМ -->
            <div v-if="usageInfo.examples.length > 1" class="examples-selector-row mt-2">
              <span class="text-micro text-muted font-bold mr-1">РЕАЛЬНЫЕ БЛОКИ В ПРОЕКТЕ ({{ usageInfo.examples.length }}):</span>
              <div class="flex gap-1 flex-wrap">
                <button
                  v-for="(ex, idx) in usageInfo.examples"
                  :key="'nav_' + ex.id"
                  class="example-tab-btn interactive-el"
                  @click="scrollToExample(idx)"
                >
                  <span class="mr-1">{{ ex.entityIcon }}</span> {{ ex.entityName }}: {{ ex.containerTitle }}
                </button>
              </div>
            </div>
          </div>

          <div class="popover-divider"></div>

          <!-- СКРОЛЛЯЩИЙСЯ СПИСОК ВСЕХ РЕАЛЬНЫХ БЛОКОВ СУЩНОСТЕЙ -->
          <div class="popover-body-scroll">
            <div 
              v-for="(example, idx) in usageInfo.examples" 
              :id="'example-card-' + idx"
              :key="example.id" 
              class="example-full-card mb-4"
            >
              <div class="example-meta-bar mb-2">
                <div class="popover-badge-row">
                  <span class="entity-badge">
                    <span class="mr-1">{{ example.entityIcon }}</span> {{ example.entityName }}
                  </span>
                  <span class="section-badge">
                    📄 {{ example.sectionTitle }}
                  </span>
                </div>
              </div>

              <!-- ТОЧНЫЙ DOM КАК В ENTITY EDITOR -->
              <div class="dynamic-container-card mb-2 relative">
                <div class="flex justify-between items-center mb-2">
                  <h4 class="text-xs font-bold text-muted uppercase tracking-wide">
                    {{ example.containerTitle }}
                  </h4>
                  <button class="btn btn-small btn-outline interactive-el pointer-events-none">➕ Добавить</button>
                </div>

                <div class="relative z-50">
                  <ModuleHelpBidiCard
                    v-if="example.isBidirectional"
                    :example="example"
                    :is-chapter-field="isChapterField"
                    :is-entity-or-chapter-select="isEntityOrChapterSelect"
                    :get-select-options="getSelectOptions"
                  />
                  <ModuleHelpDynamicCard
                    v-else
                    :example="example"
                    :is-chapter-field="isChapterField"
                    :is-entity-or-chapter-select="isEntityOrChapterSelect"
                    :get-select-options="getSelectOptions"
                  />
                </div>
              </div>

              <div v-if="idx < usageInfo.examples.length - 1" class="example-divider mt-4"></div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useModuleHelpPreview, type ModuleHelpPreviewProps } from './useModuleHelpPreview';
import ModuleHelpBidiCard from './components/ModuleHelpBidiCard.vue';
import ModuleHelpDynamicCard from './components/ModuleHelpDynamicCard.vue';

const props = defineProps<ModuleHelpPreviewProps>();

const {
  triggerEl,
  popoverEl,
  popoverStyle,
  usageInfo,
  isBidiType,
  isTimelineType,
  isVisible,
  isChapterField,
  isEntityOrChapterSelect,
  getSelectOptions,
  scrollToExample,
  showPopup,
  hidePopup,
  togglePopup
} = useModuleHelpPreview(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/schemas/ModuleHelpPreview.css"></style>
