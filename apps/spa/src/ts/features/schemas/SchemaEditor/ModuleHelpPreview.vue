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
              <!-- 1) В какой сущности 2) На какой странице 3) Заголовок блока -->
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

              <!-- 4) ТОЧНЫЙ DOM КАК В ENTITY EDITOR -->
              <div class="dynamic-container-card mb-2 relative">
                <div class="flex justify-between items-center mb-2">
                  <h4 class="text-xs font-bold text-muted uppercase tracking-wide">
                    {{ example.containerTitle }}
                  </h4>
                  <button class="btn btn-small btn-outline interactive-el pointer-events-none">➕ Добавить</button>
                </div>

                <div class="relative z-50">
                  <!-- ДВУСТОРОННИЕ СВЯЗИ -->
                  <template v-if="example.isBidirectional">
                    <div class="rel-block glass-panel">
                      <div class="rel-header flex justify-between items-center mb-2 pb-2 border-b">
                        <div class="flex items-center gap-2">
                          <span class="text-lg">🔗</span>
                          <strong class="text-main text-xs font-bold">{{ example.containerTitle }}</strong>
                        </div>
                        <button class="btn-icon danger interactive-el pointer-events-none bg-transparent border-none text-error cursor-pointer">🗑️</button>
                      </div>

                      <div class="mock-rel-split">
                        <!-- СТОРОНА А -->
                        <div class="mock-rel-side mock-side-left">
                          <div class="mock-side-header text-accent">🟣 СТОРОНА А ({{ example.entityName }})</div>
                          <div v-for="field in example.fields" :key="'fa_' + (field.class || field.id)" class="form-group mb-2">
                            <label v-if="field.label" class="form-label text-xs text-accent-light">{{ field.label }}</label>
                            <ManuscriptPointPicker v-if="isChapterField(field)" :model-value="null" :disabled="true" />
                            <!-- Dropdown: кликабелен только если не ссылается на главы и сущности -->
                            <XboxWheel 
                              v-else-if="field.type === 'select'" 
                              :options="getSelectOptions(field)" 
                              :placeholder="field.placeholder || 'Выберите...'" 
                              :disabled="isEntityOrChapterSelect(field)" 
                              :class="{ 'pointer-events-none': isEntityOrChapterSelect(field) }"
                            />
                            
                            <!-- Некликабельные поля превью -->
                            <textarea 
                              v-else-if="field.type === 'textarea'" 
                              class="input-base text-xs pointer-events-none" 
                              :rows="field.rows || 2" 
                              :placeholder="field.placeholder || ''" 
                              tabindex="-1"
                              readonly
                            ></textarea>
                            <input 
                              v-else 
                              type="text" 
                              class="input-base text-xs pointer-events-none" 
                              :placeholder="field.placeholder || ''" 
                              value="" 
                              tabindex="-1" 
                              readonly 
                            />
                            <div v-if="field.hint" class="form-hint text-micro text-muted">{{ field.hint }}</div>
                          </div>

                          <!-- Вложенные таймлайн-контейнеры Стороны А -->
                          <div v-for="sub in (example.dynamicContainers || [])" :key="'sub_a_' + sub.id" class="sub-container-wrap mt-2 p-2">
                            <div class="flex justify-between items-center mb-1">
                              <span class="text-micro font-bold text-muted">⏱️ {{ sub.title }}</span>
                            </div>
                            <div class="nested-item card-secondary p-2 mb-1">
                              <div v-for="subField in (sub.fields || [])" :key="'sfa_' + subField.class" class="form-group mb-2">
                                <label v-if="subField.label" class="form-label text-xs">{{ subField.label }}</label>
                                <ManuscriptPointPicker v-if="isChapterField(subField)" :model-value="null" :disabled="true" />
                                <XboxWheel 
                                  v-else-if="subField.type === 'select'" 
                                  :options="getSelectOptions(subField)" 
                                  :placeholder="subField.placeholder || 'Выберите...'" 
                                  :disabled="isEntityOrChapterSelect(subField)" 
                                  :class="{ 'pointer-events-none': isEntityOrChapterSelect(subField) }"
                                />
                                <textarea v-else-if="subField.type === 'textarea'" class="input-base text-xs pointer-events-none" :rows="subField.rows || 2" :placeholder="subField.placeholder || ''" tabindex="-1" readonly></textarea>
                                <input v-else type="text" class="input-base text-xs pointer-events-none" :placeholder="subField.placeholder || ''" value="" tabindex="-1" readonly />
                              </div>
                            </div>
                          </div>
                        </div>

                        <!-- СТОРОНА Б -->
                        <div class="mock-rel-side mock-side-right">
                          <div class="mock-side-header mock-side-header-b">🔵 СТОРОНА Б (Зеркало)</div>
                          <div v-for="field in example.fields" :key="'fb_' + (field.class || field.id)" class="form-group mb-2">
                            <label v-if="field.label" class="form-label form-label-b text-xs">{{ field.label }}</label>
                            <ManuscriptPointPicker v-if="isChapterField(field)" :model-value="null" :disabled="true" />
                            <!-- Dropdown: кликабелен только если не ссылается на главы и сущности -->
                            <XboxWheel 
                              v-else-if="field.type === 'select'" 
                              :options="getSelectOptions(field)" 
                              :placeholder="field.placeholder || 'Выберите...'" 
                              :disabled="isEntityOrChapterSelect(field)" 
                              :class="{ 'pointer-events-none': isEntityOrChapterSelect(field) }"
                            />
                            
                            <!-- Некликабельные поля превью -->
                            <textarea 
                              v-else-if="field.type === 'textarea'" 
                              class="input-base text-xs pointer-events-none" 
                              :rows="field.rows || 2" 
                              :placeholder="field.placeholder || ''" 
                              tabindex="-1"
                              readonly
                            ></textarea>
                            <input 
                              v-else 
                              type="text" 
                              class="input-base text-xs pointer-events-none" 
                              :placeholder="field.placeholder || ''" 
                              value="" 
                              tabindex="-1" 
                              readonly 
                            />
                            <div v-if="field.hint" class="form-hint text-micro text-muted">{{ field.hint }}</div>
                          </div>

                          <!-- Вложенные таймлайн-контейнеры Стороны Б -->
                          <div v-for="sub in (example.dynamicContainers || [])" :key="'sub_b_' + sub.id" class="sub-container-wrap mt-2 p-2">
                            <div class="flex justify-between items-center mb-1">
                              <span class="text-micro font-bold text-muted">⏱️ {{ sub.title }}</span>
                            </div>
                            <div class="nested-item card-secondary p-2 mb-1">
                              <div v-for="subField in (sub.fields || [])" :key="'sfb_' + subField.class" class="form-group mb-2">
                                <label v-if="subField.label" class="form-label text-xs">{{ subField.label }}</label>
                                <ManuscriptPointPicker v-if="isChapterField(subField)" :model-value="null" :disabled="true" />
                                <XboxWheel 
                                  v-else-if="subField.type === 'select'" 
                                  :options="getSelectOptions(subField)" 
                                  :placeholder="subField.placeholder || 'Выберите...'" 
                                  :disabled="isEntityOrChapterSelect(subField)" 
                                  :class="{ 'pointer-events-none': isEntityOrChapterSelect(subField) }"
                                />
                                <textarea v-else-if="subField.type === 'textarea'" class="input-base text-xs pointer-events-none" :rows="subField.rows || 2" :placeholder="subField.placeholder || ''" tabindex="-1" readonly></textarea>
                                <input v-else type="text" class="input-base text-xs pointer-events-none" :placeholder="subField.placeholder || ''" value="" tabindex="-1" readonly />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- ОБЫЧНЫЕ ДИНАМИЧЕСКИЕ ЭЛЕМЕНТЫ И ТАЙМЛАЙНЫ -->
                  <template v-else>
                    <div class="glass-card mb-3 p-3 relative">
                      <div class="flex justify-between mb-2 pb-2 border-b">
                        <strong class="text-accent">Элемент #1</strong>
                        <button class="btn-danger-icon pointer-events-none text-error cursor-pointer bg-transparent border-none" title="Удалить">🗑️</button>
                      </div>

                      <!-- Рендерим шаблон с реальными полями сущности -->
                      <div>
                        <div v-for="field in example.fields" :key="field.id || field.class" class="form-group mb-2">
                          <label v-if="field.label" class="form-label text-xs">{{ field.label }}</label>
                          
                          <ManuscriptPointPicker v-if="isChapterField(field)" :model-value="null" :disabled="true" />
                          <!-- Select: кликабелен только если не ссылается на главы и сущности -->
                          <XboxWheel 
                            v-else-if="field.type === 'select'" 
                            :options="getSelectOptions(field)" 
                            :placeholder="field.placeholder || 'Выберите...'" 
                            :disabled="isEntityOrChapterSelect(field)" 
                            :class="{ 'pointer-events-none': isEntityOrChapterSelect(field) }"
                          />

                          <!-- Textarea (некликабельно, чистый показ) -->
                          <textarea 
                            v-else-if="field.type === 'textarea'" 
                            class="input-base text-xs pointer-events-none" 
                            :rows="field.rows || 2" 
                            :placeholder="field.placeholder || ''" 
                            tabindex="-1"
                            readonly
                          ></textarea>

                          <!-- Date / Time (некликабельно, чистый показ) -->
                          <div v-else-if="field.type === 'calendar_date' || field.type === 'date' || field.type === 'calendar_datetime'" class="date-wheels-preview pointer-events-none">
                            <div class="date-wheel-preview-col"><div class="date-wheel-preview-label">ГОД</div><XboxWheel :options="[{value: '2026', label: '2026'}]" model-value="2026" :disabled="true" /></div>
                            <div class="date-wheel-preview-col flex-1-5"><div class="date-wheel-preview-label">МЕСЯЦ</div><XboxWheel :options="[{value: 'Май', label: 'Май'}]" model-value="Май" :disabled="true" /></div>
                            <div class="date-wheel-preview-col flex-0-8"><div class="date-wheel-preview-label">ДЕНЬ</div><XboxWheel :options="[{value: '14', label: '14'}]" model-value="14" :disabled="true" /></div>
                          </div>

                          <!-- Range (некликабельно, чистый показ) -->
                          <div v-else-if="field.type === 'range'" class="range-wrap flex items-center gap-3 pointer-events-none">
                            <input 
                              type="range" 
                              class="flex-1 range-accent" 
                              :min="field.min ?? 0" 
                              :max="field.max ?? 100" 
                              :value="field.min ? field.min + (field.max ? (field.max - field.min) / 2 : 50) : 50" 
                              tabindex="-1"
                              readonly
                            />
                            <span class="text-xs text-accent font-bold">{{ field.min ? field.min + (field.max ? (field.max - field.min) / 2 : 50) : 50 }}</span>
                          </div>

                          <!-- Text / Number input (некликабельно, чистый показ) -->
                          <input 
                            v-else 
                            type="text" 
                            class="input-base text-xs pointer-events-none" 
                            :placeholder="field.placeholder || ''" 
                            value="" 
                            tabindex="-1"
                            readonly 
                          />

                          <div v-if="field.hint" class="form-hint text-micro text-muted mt-1">{{ field.hint }}</div>
                        </div>

                        <!-- Вложенные динамические контейнеры -->
                        <div v-for="sub in (example.dynamicContainers || [])" :key="'sub_dyn_' + sub.id" class="sub-container-wrap dashed mt-3 p-2">
                          <div class="text-xs font-bold text-muted mb-2">⏱️ {{ sub.title }}</div>
                          <div class="nested-item card-secondary p-2 mb-1">
                            <div v-for="subField in (sub.fields || [])" :key="'sf_dyn_' + subField.class" class="form-group mb-2">
                              <label v-if="subField.label" class="form-label text-xs">{{ subField.label }}</label>
                              <XboxWheel 
                                v-if="subField.type === 'select'" 
                                :options="getSelectOptions(subField)" 
                                :placeholder="subField.placeholder || 'Выберите...'" 
                                :disabled="isEntityOrChapterSelect(subField)" 
                                :class="{ 'pointer-events-none': isEntityOrChapterSelect(subField) }"
                              />
                              <input v-else type="text" class="input-base text-xs pointer-events-none" :placeholder="subField.placeholder || ''" value="" tabindex="-1" readonly />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
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
import { XboxWheel } from '@worldwiki/components';
import { ManuscriptPointPicker } from '@/shared/ui';
import { useModuleHelpPreview, type ModuleHelpPreviewProps } from './useModuleHelpPreview';

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
