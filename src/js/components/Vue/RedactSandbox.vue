<template>
  <div class="app-container-new glass-theme" style="width: 100%; height: 100%; overflow: hidden; display: flex; flex-direction: column;">
    <!-- PREVIEW MODE -->
    <div v-if="isPreviewMode" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg-base);">
      <header class="glass-panel" style="border-radius: 0; border: none; border-bottom: 1px solid var(--border-color); padding: 0 24px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; height: 50px; background: var(--bg-panel); backdrop-filter: blur(20px); flex-shrink: 0;">
        <div style="font-weight: 900; font-size: 16px; color: var(--text-main);">👁️ ПРЕДПРОСМОТР: {{ activeSection?.title || 'Страница' }}</div>
        <button class="btn-new" style="font-size: 10px; padding: 6px 16px;" @click="isPreviewMode = false">← ВЕРНУТЬСЯ В РЕДАКТОР</button>
      </header>
      <main style="flex: 1; padding: 24px; overflow-y: auto;">
        <div v-if="activeSection" class="glass-card-container" style="width: 100%; max-width: 1200px; margin: 0 auto;">
          <div class="glass-card-bg"></div>
          <div class="glass-card-content" style="padding: 32px;">
            <div style="margin-bottom: 32px; border-bottom: 1px solid var(--accent); padding-bottom: 12px;">
              <h1 style="font-size: 28px; font-weight: 900; color: var(--text-main); margin: 0;">{{ activeSection.title }}</h1>
            </div>
            <div class="unified-items-stack" style="display: flex; flex-direction: column; gap: 24px;">
              <div v-for="(item, iIdx) in activeSection.items" :key="iIdx">
                <!-- ATOMIC FIELD PREVIEW -->
                <div v-if="isAtomicField(item)" style="background: var(--bg-secondary); padding: 20px; border-radius: 16px; border: 1px solid var(--border-color);">
                  <label class="form-label-micro" style="margin-bottom: 12px;">{{ item.label }}</label>
                  
                  <div v-if="item.type === 'multiselect' || item.type === 'tags'" class="tags-grid" style="display: flex; flex-wrap: wrap; gap: 8px;">
                    <div v-for="(opt, oIdx) in getOptions(item)" :key="oIdx" class="glass-pill interactive-el" style="padding: 6px 14px; font-size: 11px;">{{ opt.label }}</div>
                  </div>
                  <XboxWheel v-else-if="item.type === 'select'" :options="getOptions(item)" :placeholder="item.placeholder || 'Выберите...'" />
                  <div v-else-if="item.type === 'calendar_date' || item.type === 'date'" style="display: flex; gap: 12px; align-items: flex-end;">
                    <div style="flex: 1;"><label class="form-label-micro">ГОД</label><input type="number" class="input-base" style="text-align: center; font-size: 13px;" placeholder="2026" disabled></div>
                    <div style="flex: 2;"><label class="form-label-micro">МЕСЯЦ</label><XboxWheel :options="monthsList" /></div>
                    <div style="flex: 1;"><label class="form-label-micro">ДЕНЬ</label><input type="number" class="input-base" style="text-align: center; font-size: 13px;" placeholder="1" disabled></div>
                  </div>
                  <div v-else-if="item.type === 'range'" style="display: flex; align-items: center; gap: 20px;">
                    <input type="range" :min="item.min || 0" :max="item.max || 100" style="flex: 1; accent-color: var(--accent);">
                    <div style="background: var(--accent); color: var(--text-main); padding: 4px 12px; border-radius: 8px; font-family: monospace; font-weight: 900; font-size: 16px; min-width: 60px; text-align: center; box-shadow: 0 0 15px var(--accent-glow);">0</div>
                  </div>
                  <div v-else-if="item.type === 'photo'" class="photo-placeholder-ui" style="height: 140px; background: var(--bg-panel); border: 1px dashed var(--border-color); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-muted);">
                    <span style="font-size: 32px;">🖼️</span>
                  </div>
                  <textarea v-else-if="item.type === 'textarea'" class="input-base" style="min-height: 80px; font-size: 13px;" :placeholder="item.placeholder || 'Введите текст...'" disabled></textarea>
                  <input v-else class="input-base" style="font-size: 13px; padding: 10px;" :placeholder="item.placeholder || 'Введите значение...'" :type="item.type === 'number' ? 'number' : 'text'" disabled>
                </div>

                <!-- MODULE PREVIEW -->
                <div v-else class="glass-panel" style="padding: 24px; background: var(--bg-panel); border-radius: 20px; border: 1px solid var(--border-color);">
                  <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
                    <span style="font-size: 24px;">{{ getModuleIcon(item.template) }}</span>
                    <h3 style="font-size: 18px; font-weight: 900; color: var(--text-main); margin: 0;">{{ item.title }}</h3>
                  </div>
                  <div v-if="!(item.items && item.items.length)" style="display: flex; flex-direction: column; align-items: center; padding: 40px; border: 1px dashed var(--border-color); border-radius: 16px;">
                    <span style="font-size: 32px; opacity: 0.1; margin-bottom: 8px;">{{ getModuleIcon(item.template) }}</span>
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 900;">МОДУЛЬ ПУСТ</span>
                  </div>
                  <div v-else class="items-stack" style="display: flex; flex-direction: column; gap: 16px;">
                    <div v-for="(sub, sIdx) in (item.items || [])" :key="sIdx" class="glass-card-container" style="background: var(--bg-secondary); border-radius: 12px;">
                      <div class="glass-card-content" style="padding: 20px;">
                        <div style="font-size: 10px; font-weight: 900; color: var(--accent); opacity: 0.5; margin-bottom: 12px;">#{{ Number(sIdx) + 1 }}</div>
                        
                        <!-- Template Fields -->
                        <div v-if="getResolvedFields(item.template).length > 0" style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color);">
                          <div style="font-size: 9px; font-weight: 900; color: var(--text-muted); margin-bottom: 12px; text-transform: uppercase;">📋 Стандартные</div>
                          <div class="glass-grid-2" style="gap: 20px;">
                            <div v-for="(tField, fIdx) in getResolvedFields(item.template)" :key="fIdx">
                              <label class="form-label-micro">{{ tField.label || tField.class }}</label>
                              <XboxWheel v-if="tField.type === 'select'" :options="getOptions(tField)" />
                              <div v-else-if="tField.type === 'multiselect' || tField.type === 'tags'" class="tags-grid" style="display: flex; flex-wrap: wrap; gap: 6px;">
                                <div v-for="(opt, oIdx) in getOptions(tField)" :key="oIdx" class="glass-pill" style="padding: 4px 10px; font-size: 9px;">{{ opt.label }}</div>
                              </div>
                              <textarea v-else-if="tField.type === 'textarea'" class="input-base" style="min-height: 60px; font-size: 12px;" :placeholder="tField.placeholder || '...'" disabled></textarea>
                              <input v-else class="input-base" style="font-size: 12px;" :placeholder="tField.placeholder || '...'" disabled>
                            </div>
                          </div>
                        </div>
                        
                        <!-- Custom Fields -->
                        <div v-if="item.customFields && item.customFields.length > 0">
                          <div style="font-size: 9px; font-weight: 900; color: var(--accent); margin-bottom: 12px; text-transform: uppercase;">✨ Добавленные</div>
                          <div class="glass-grid-2" style="gap: 20px;">
                            <div v-for="(cField, cIdx) in item.customFields" :key="cIdx">
                              <label class="form-label-micro">{{ cField.label }}</label>
                              <XboxWheel v-if="cField.type === 'select'" :options="cField.options || []" />
                              <div v-else-if="cField.type === 'multiselect'" class="tags-grid" style="display: flex; flex-wrap: wrap; gap: 6px;">
                                <div v-for="(opt, oIdx) in (cField.options || [])" :key="oIdx" class="glass-pill" style="padding: 4px 10px; font-size: 9px; background: rgba(255,165,0,0.1); border: 1px solid rgba(255,165,0,0.2);">{{ opt.label }}</div>
                              </div>
                              <textarea v-else-if="cField.type === 'textarea'" class="input-base" style="min-height: 60px; font-size: 12px;" :placeholder="cField.placeholder || '...'" disabled></textarea>
                              <input v-else class="input-base" style="font-size: 12px;" :placeholder="cField.placeholder || '...'" :type="cField.type === 'number' ? 'number' : cField.type === 'range' ? 'range' : 'text'" disabled>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- EDITOR MODE -->
    <div v-else style="width: 100%; height: 100%; display: flex; flex-direction: column;">
    <!-- Header -->
    <header class="glass-panel" style="border-radius: 0; border: none; border-bottom: 1px solid var(--border-color); padding: 0 24px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; height: 50px; background: var(--bg-panel); backdrop-filter: blur(20px); flex-shrink: 0;">
      <div style="display: flex; align-items: center; gap: 30px;">
        <div style="display: flex; align-items: center; gap: 10px;">
           <span class="form-label" style="margin: 0; opacity: 0.5; font-size: 9px; font-weight: 900; letter-spacing: 1px;">СУЩНОСТЬ:</span>
           <input v-model="entityName" class="input-base" style="width: 200px; background: transparent; border: none; font-weight: 900; color: var(--accent); font-size: 14px;">
        </div>
      </div>

      <div style="display: flex; gap: 8px; align-items: center;">
        <button class="btn-new btn-outline-new" style="font-size: 10px; border-color: var(--accent); color: var(--accent); padding: 4px 12px;" @click="addNewPage">+ СТРАНИЦА</button>
        <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 4px 12px; color: #f55; border-color: rgba(255,85,85,0.3);" @click="resetState">Сбросить</button>
        <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 4px 12px;" @click="openPreview">ПРЕДПРОСМОТР</button>
        <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 4px 12px;" @click="showJsonPreview = true">Схема</button>
        <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 4px 12px;" @click="exportSchema">Экспорт</button>
        <button class="btn-new" style="font-size: 10px; padding: 4px 12px; background: var(--accent);" @click="saveToProject">Сохранить в проект</button>
      </div>
    </header>

    <!-- TABS BAR -->
    <div v-if="sections.length > 0" class="editor-tabs-new" style="flex-shrink: 0; padding: 8px 24px; background: var(--bg-panel); border-bottom: 1px solid var(--bg-input); display: flex; gap: 4px; overflow-x: auto;">
       <div v-for="(sec, idx) in sections" :key="idx" 
            class="editor-tab-new interactive-el" 
            :class="{ active: activeSectionIdx === idx }"
            @click="activeSectionIdx = idx"
            style="padding: 6px 16px; font-size: 11px; border-radius: 8px;">
          {{ sec.icon || '📄' }} {{ sec.title }}
          <span v-if="sections.length > 1 && !sec.items.some((i: any) => i._isSystemName)" 
                style="margin-left: 8px; opacity: 0.5; font-size: 10px; cursor: pointer; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.1);" 
                @mousedown.stop="deleteSection(idx)">✕</span>
       </div>
    </div>

    <div style="flex: 1; display: flex; overflow: hidden; background: var(--bg-base);">
      <!-- MAIN CANVAS -->
      <main ref="mainScrollEl" class="content-area-new" style="flex: 1; padding: 24px; overflow-y: auto;" 
            @scroll="saveUiState"
            @dragenter.prevent="dragOver = true" @dragover.prevent="handleDragOverCanvas($event)" @dragleave="dragOver = false" @drop="handleDropNew">
        
        <div v-if="activeSection" style="width: 100%;">
          <div class="glass-card-container" style="width: 100%; min-height: 100%;">
             <div class="glass-card-bg"></div>
             <div class="glass-card-content" style="padding: 32px;">
                
                <div style="margin-bottom: 32px; border-bottom: 1px solid var(--accent); padding-bottom: 12px;">
                   <input v-model="activeSection.title" class="input-base" style="font-size: 24px; font-weight: 900; background: transparent; border: none; color: var(--text-main); width: 100%;" placeholder="ИМЯ СТРАНИЦЫ">
                </div>

                <!-- EMPTY STATE -->
                <div v-if="activeSection.items.length === 0" class="empty-canvas-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; border: 2px dashed var(--border-active); border-radius: 24px; margin: 20px 0; min-height: 300px;">
                   <div style="font-size: 64px; opacity: 0.15; margin-bottom: 20px;">🧩</div>
                   <div style="font-size: 18px; font-weight: 900; color: var(--text-muted); margin-bottom: 8px; text-align: center;">ПЕРЕТАЩИТЕ ЭЛЕМЕНТЫ СЮДА</div>
                   <div style="font-size: 12px; color: var(--text-muted); text-align: center; max-width: 400px; line-height: 1.6;">
                      Поля из левой панели → для атомарных данных<br>
                      Модули из левой панели → для списков и хронологий
                   </div>
                   <div style="margin-top: 24px; display: flex; gap: 12px; opacity: 0.2;">
                      <span style="font-size: 24px;">📝</span>
                      <span style="font-size: 24px;">🔽</span>
                      <span style="font-size: 24px;">📅</span>
                      <span style="font-size: 24px;">🎚️</span>
                      <span style="font-size: 24px;">⏱️</span>
                      <span style="font-size: 24px;">📋</span>
                   </div>
                </div>

                <div class="unified-items-stack" style="display: flex; flex-direction: column; gap: 20px;">
                    <div v-for="(item, iIdx) in activeSection.items" :key="iIdx" 
                         class="lego-brick-wrap draggable-item" 
                         draggable="true" 
                         @dragstart="handleItemDragStart($event, Number(iIdx))"
                         @dragenter.prevent="draggedOverIdx = Number(iIdx)"
                         @dragover.prevent="handleDragOverItem($event, Number(iIdx))"
                         @drop.stop="handleItemDrop(Number(iIdx))"
                         :class="{ 'is-dragging-over': draggedOverIdx === Number(iIdx) }">
                      
                      <!-- 1. ATOMIC FIELD -->
                      <div v-if="isAtomicField(item)" class="field-brick-card" style="background: var(--bg-secondary); padding: 20px; border-radius: 16px; border: 1px solid var(--border-color);">
                         <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', cursor: item._isSystemName ? 'default' : 'move' }">
                            <div style="display: flex; align-items: center; gap: 10px;">
                               <span v-if="!item._isSystemName" style="opacity: 0.2; font-size: 14px;">⠿</span>
                               <span v-else style="opacity: 0.5; font-size: 14px; color: var(--accent);">🔒</span>
                               <input v-model="item.label" class="form-label" style="margin: 0; background: transparent; border: none; font-size: 11px; font-weight: 900; color: #444; text-transform: uppercase; letter-spacing: 1px; width: 400px;" placeholder="НАЗВАНИЕ ПОЛЯ">
                            </div>
                            <button v-if="!item._isSystemName" style="color: #f55; background: none; border: none; font-size: 10px; cursor: pointer;" @click="activeSection.items.splice(iIdx, 1)">УДАЛИТЬ</button>
                         </div>
                         
                         <!-- PREVIEW WIDGET -->
                         <div class="brick-preview-area" style="margin-bottom: 16px; padding: 16px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px solid var(--bg-input);">
                            
                            <!-- Multiselect / Tags -->
                            <div v-if="item.type === 'multiselect' || item.type === 'tags'" class="tags-grid" style="display: flex; flex-wrap: wrap; gap: 8px;">
                               <div v-for="(opt, oIdx) in getOptions(item)" :key="oIdx" class="glass-pill interactive-el" :class="{ active: isItemSelected(item, opt.value) }" @click="toggleSelection(item, opt.value)" style="padding: 6px 14px; font-size: 11px;">{{ opt.label }}</div>
                               <div v-if="item.type === 'tags'" class="glass-pill" style="opacity: 0.3; border-style: dashed;">+ ТЕГ</div>
                            </div>

                            <!-- 3D WHEEL SELECT -->
                            <XboxWheel v-else-if="item.type === 'select'" v-model="item._val" :options="getOptions(item)" :placeholder="item.placeholder || 'Выберите...'" />

                            <!-- 3D WHEEL DATE -->
                            <div v-else-if="item.type === 'calendar_date' || item.type === 'date'" style="display: flex; gap: 12px; align-items: flex-end;">
                               <div style="flex: 1;"><label class="form-label-micro">ГОД</label><input type="number" class="input-base" style="text-align: center; font-size: 13px;" placeholder="2026"></div>
                               <div style="flex: 2;"><label class="form-label-micro">МЕСЯЦ</label><XboxWheel :options="monthsList" /></div>
                               <div style="flex: 1;"><label class="form-label-micro">ДЕНЬ</label><input type="number" class="input-base" style="text-align: center; font-size: 13px;" placeholder="1"></div>
                            </div>

                            <!-- RANGE -->
                            <div v-else-if="item.type === 'range'" style="display: flex; align-items: center; gap: 20px;">
                               <input type="range" v-model.number="item._val" :min="item.min || 0" :max="item.max || 100" style="flex: 1; accent-color: var(--accent);">
                               <div style="background: var(--accent); color: var(--text-main); padding: 4px 12px; border-radius: 8px; font-family: monospace; font-weight: 900; font-size: 16px; min-width: 60px; text-align: center; box-shadow: 0 0 15px var(--accent-glow);">{{ item._val || (item.value || 0) }}</div>
                            </div>

                            <!-- PHOTO -->
                            <div v-else-if="item.type === 'photo'" class="photo-placeholder-ui" style="height: 140px; background: var(--bg-panel); border: 1px dashed var(--border-color); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-muted);">
                               <span style="font-size: 32px;">🖼️</span>
                               <span style="font-size: 10px; font-weight: 900; letter-spacing: 2px;">ЗАГРУЗИТЬ ФОТО</span>
                            </div>

                            <textarea v-else-if="item.type === 'textarea'" class="input-base" style="min-height: 80px; font-size: 13px;" :placeholder="item.placeholder || 'Введите текст...'"></textarea>
                            <input v-else v-model="item._val" class="input-base" style="font-size: 13px; padding: 10px;" :placeholder="item.placeholder || 'Введите значение...'" :type="item.type === 'number' ? 'number' : 'text'">
                         </div>

                         <!-- INLINE SETTINGS -->
                         <div class="settings-meat-box" style="padding: 16px; background: var(--bg-input); border-radius: 12px;">
                            <div class="glass-grid-2" style="margin-bottom: 12px;">
                               <div>
                                  <label class="form-label-micro">ТИП КИРПИЧА</label>
                                  <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                                     <button v-for="t in typeOptions" :key="t.val" :class="{ active: item.type === t.val }" class="type-btn-mini" @click="!item._isSystemName && (item.type = t.val)" :disabled="item._isSystemName" :style="{ padding: '4px 8px', fontSize: '10px', opacity: item._isSystemName && item.type !== t.val ? 0.2 : 1, cursor: item._isSystemName ? 'not-allowed' : 'pointer' }">{{ t.icon }} {{ t.label }}</button>
                                  </div>
                               </div>
                               <div>
                                  <label class="form-label-micro">ПОДСКАЗКА (PLACEHOLDER)</label>
                                  <input v-model="item.placeholder" class="input-base" style="font-size: 11px; padding: 8px;" placeholder="Подсказка для пользователя...">
                               </div>
                            </div>

                            <!-- Options management -->
                            <div v-if="item.type === 'select' || item.type === 'multiselect'" style="border-top: 1px solid var(--border-color); padding-top: 12px;">
                               <label class="form-label-micro">ВАРИАНТЫ ДЛЯ СПИСКА</label>
                               <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                                  <div v-for="(opt, oIdx) in item.options" :key="oIdx" style="display: flex; gap: 6px; align-items: center; background: var(--bg-input); padding: 4px 8px; border-radius: 8px;">
                                     <input v-model="opt.label" class="input-base" style="font-size: 10px; padding: 4px;" placeholder="Имя...">
                                     <button style="color: #f55; background: none; border: none; font-size: 12px;" @click="item.options.splice(Number(oIdx), 1)">✕</button>
                                  </div>
                                  <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 6px;" @click="addOption(item)">+ ДОБАВИТЬ ВАРИАНТ</button>
                               </div>
                            </div>

                         </div>
                      </div>

                      <!-- 2. COMPLEX MODULE -->
                      <div v-else class="glass-panel" style="padding: 24px; background: var(--bg-panel); border-radius: 20px; border: 1px solid var(--border-color);">
                         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; cursor: move;">
                            <div style="display: flex; align-items: center; gap: 16px;">
                               <span style="opacity: 0.2;">⠿</span>
                               <span style="font-size: 24px;">{{ getModuleIcon(item.template) }}</span>
                               <input v-model="item.title" class="input-base" style="background: transparent; border: none; font-weight: 900; font-size: 18px; color: var(--text-main); width: 400px;" placeholder="НАЗВАНИЕ МОДУЛЯ">
                            </div>
                            <div style="display: flex; gap: 12px;">
                               <button class="btn-new" style="font-size: 10px; padding: 6px 16px;" @click="addDynamicItem(item)">+ НОВАЯ ЗАПИСЬ</button>
                               <button style="color: #f55; background: none; border: none; font-size: 16px; cursor: pointer;" @click="activeSection.items.splice(iIdx, 1)">✕</button>
                            </div>
                         </div>
                         
                         
                         <!-- TEMPLATE FIELDS SECTION -->
                         <div style="margin-bottom: 20px; padding: 16px; background: var(--bg-panel); border-radius: 12px; border: 1px solid var(--border-color);">
                            <div style="font-size: 10px; font-weight: 900; color: var(--text-muted); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">📋 Стандартные поля шаблона</div>
                            <div class="glass-grid-2" style="gap: 12px; margin-bottom: 12px;">
                               <div v-for="(tField, fIdx) in getResolvedFields(item.template)" :key="fIdx" style="padding: 8px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid var(--bg-input);">
                                  <label class="form-label-micro" style="opacity: 0.5;">{{ tField.label || tField.class }}</label>
                                  <div style="font-size: 10px; color: var(--text-muted); font-family: monospace;">{{ tField.type }}</div>
                               </div>
                            </div>
                            
                            <!-- CUSTOM FIELDS -->
                            <div v-if="item.customFields && item.customFields.length" style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-bottom: 12px;">
                               <div style="font-size: 10px; font-weight: 900; color: var(--accent); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">✨ Добавленные поля</div>
                               <div style="display: flex; flex-direction: column; gap: 12px;">
                                  <div v-for="(cField, cIdx) in item.customFields" :key="cIdx" style="padding: 12px; background: rgba(255,165,0,0.08); border-radius: 8px; border: 1px solid rgba(255,165,0,0.2);">
                                     <!-- Header with name and delete -->
                                     <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 12px;">
                                        <div style="flex: 1;">
                                           <input v-model="cField.label" class="input-base" style="font-size: 10px; padding: 4px; font-weight: 900;" placeholder="Название поля">
                                        </div>
                                        <button style="color: #f55; background: none; border: none; font-size: 12px; cursor: pointer;" @click="item.customFields.splice(Number(cIdx), 1)">✕</button>
                                     </div>

                                     <!-- Type badge -->
                                     <div style="font-size: 9px; color: rgba(255,165,0,0.6); margin-bottom: 12px; font-family: monospace;">{{ cField.type }}</div>

                                     <!-- Common settings -->
                                     <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;">
                                        <div>
                                           <label class="form-label-micro">Подсказка (Placeholder)</label>
                                           <input v-model="cField.placeholder" class="input-base" style="font-size: 10px; padding: 4px;" placeholder="...">
                                        </div>
                                     </div>

                                     <!-- Type-specific settings -->
                                     <div v-if="cField.type === 'textarea'" style="border-top: 1px solid rgba(255,165,0,0.1); padding-top: 8px;">
                                        <label class="form-label-micro">Строк</label>
                                        <input v-model.number="cField.rows" class="input-base" type="number" style="font-size: 10px; padding: 4px;" placeholder="2">
                                     </div>

                                     <div v-if="cField.type === 'range' || cField.type === 'number'" style="border-top: 1px solid rgba(255,165,0,0.1); padding-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                        <div>
                                           <label class="form-label-micro">Min</label>
                                           <input v-model.number="cField.min" class="input-base" type="number" style="font-size: 10px; padding: 4px;" placeholder="0">
                                        </div>
                                        <div>
                                           <label class="form-label-micro">Max</label>
                                           <input v-model.number="cField.max" class="input-base" type="number" style="font-size: 10px; padding: 4px;" placeholder="100">
                                        </div>
                                     </div>

                                     <div v-if="cField.type === 'range'" style="border-top: 1px solid rgba(255,165,0,0.1); padding-top: 8px;">
                                        <label class="form-label-micro">Дефолтное значение</label>
                                        <input v-model.number="cField.value" class="input-base" type="number" style="font-size: 10px; padding: 4px;" placeholder="50">
                                     </div>

                                     <!-- Select/Multiselect options -->
                                     <div v-if="cField.type === 'select' || cField.type === 'multiselect'" style="border-top: 1px solid rgba(255,165,0,0.1); padding-top: 8px;">
                                        <label class="form-label-micro">Варианты</label>
                                        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
                                           <div v-for="(opt, oIdx) in (cField.options || [])" :key="oIdx" style="display: flex; gap: 6px; align-items: center;">
                                              <input v-model="opt.label" class="input-base" style="font-size: 10px; padding: 4px; flex: 1;" placeholder="Вариант">
                                              <button style="color: #f55; background: none; border: none; font-size: 12px;" @click="cField.options.splice(Number(oIdx), 1)">✕</button>
                                           </div>
                                           <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 6px; margin-top: 6px;" @click="if (!cField.options) cField.options = []; cField.options.push({ label: 'Вариант', value: 'v' + Math.random().toString(36).substr(2, 4) })">+ ВАРИАНТ</button>
                                        </div>
                                     </div>
                                  </div>
                               </div>
                            </div>
                            
                            <!-- DROP ZONE FOR CUSTOM FIELDS -->
                            <div style="margin-top: 12px; padding: 20px; border: 2px dashed rgba(255,165,0,0.3); border-radius: 12px; text-align: center; background: rgba(255,165,0,0.05); cursor: grab;"
                                 @dragenter.prevent="draggedOverModuleIdx = Number(iIdx)" 
                                 @dragover.prevent="handleDragOverModule($event, Number(iIdx))" 
                                 @dragleave="draggedOverModuleIdx = -1"
                                 @drop.stop="handleDropIntoModule(Number(iIdx))"
                                 :style="{ borderColor: draggedOverModuleIdx === Number(iIdx) ? 'var(--accent)' : 'rgba(255,165,0,0.3)', background: draggedOverModuleIdx === Number(iIdx) ? 'rgba(255,165,0,0.1)' : 'rgba(255,165,0,0.05)' }">
                               <div style="font-size: 12px; font-weight: 900; color: rgba(255,165,0,0.6);">🎯 СЮДА КИДАЙ ПОЛЯ</div>
                               <div style="font-size: 10px; color: rgba(255,165,0,0.4); margin-top: 4px;">Захвати поле из левой панели</div>
                            </div>
                         </div>

                         <!-- EMPTY MODULE STATE -->
                         <div v-if="!(item.items && item.items.length)" style="display: flex; flex-direction: column; align-items: center; padding: 40px; border: 1px dashed var(--border-color); border-radius: 16px; margin-bottom: 16px;">
                            <span style="font-size: 32px; opacity: 0.1; margin-bottom: 8px;">{{ getModuleIcon(item.template) }}</span>
                            <span style="font-size: 11px; color: var(--text-muted); font-weight: 900;">МОДУЛЬ ПУСТ</span>
                            <span style="font-size: 10px; color: var(--border-color); margin-top: 4px;">Нажмите «+ НОВАЯ ЗАПИСЬ»</span>
                         </div>
                         
                         <!-- Complex Module Preview -->
                         <div v-if="item.type === 'relationship' || getResolvedTemplate(item.template)?.isBidirectional">
                            <RelationshipBlock v-for="(sub, sIdx) in (item.items || [])" :key="sIdx" :item="sub" :idx="Number(sIdx)" :templateConf="getResolvedTemplate(item.template)" :allTemplates="fullConfig.templates" :referenceData="mockReferenceData" :sandboxMode="true" entityId="s" entityType="g" project="s" @remove="item.items.splice(Number(sIdx), 1)" />
                         </div>
                         <div v-else class="items-stack" style="display: flex; flex-direction: column; gap: 16px;">
                            <div v-for="(sub, sIdx) in (item.items || [])" :key="sIdx" class="glass-card-container" style="background: var(--bg-secondary); border-radius: 12px;">
                               <div class="glass-card-content" style="padding: 20px;">
                                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                     <span style="font-size: 10px; font-weight: 900; color: var(--accent); opacity: 0.5;">#{{ Number(sIdx) + 1 }}</span>
                                     <button style="color: #f55; background: none; border: none; font-size: 10px; cursor: pointer;" @click="item.items.splice(Number(sIdx), 1)">УДАЛИТЬ</button>
                                  </div>
                                  <div class="glass-grid-2" style="gap: 20px;">
                                     <div v-for="(tField, fIdx) in getResolvedFields(item.template)" :key="fIdx">
                                        <label class="form-label-micro">{{ tField.label || tField.class }}</label>
                                        <XboxWheel v-if="tField.type === 'select'" v-model="sub[tField.class]" :options="getOptions(tField)" />
                                        <input v-else v-model="sub[tField.class]" class="input-base" style="font-size: 12px;" :placeholder="tField.placeholder || '...'">
                                     </div>
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>

                   </div>
                </div>
             </div>
          </div>
        </div>

        <!-- NO SECTIONS STATE -->
        <div v-else style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px;">
           <div style="font-size: 80px; opacity: 0.08; margin-bottom: 24px;">🧩</div>
           <div style="font-size: 22px; font-weight: 900; color: var(--text-muted); margin-bottom: 12px; text-align: center;">НЕТ СТРАНИЦ</div>
           <div style="font-size: 13px; color: rgba(255,255,255,0.12); text-align: center; max-width: 400px; line-height: 1.6; margin-bottom: 24px;">
              Нажмите «+ СТРАНИЦА» в шапке, чтобы создать первую страницу сущности
           </div>
           <button class="btn-new" style="font-size: 12px; padding: 10px 24px;" @click="addNewPage">+ СОЗДАТЬ ПЕРВУЮ СТРАНИЦУ</button>
        </div>
      </main>

      <!-- SIDEBAR (Catalog) -->
      <aside class="sidebar-new glass-panel" style="width: 280px; border-radius: 0; border: none; border-left: 1px solid var(--border-color); background: rgba(0,0,0,0.6); backdrop-filter: blur(40px);">
        <div class="sidebar-header" style="height: 50px; font-size: 10px; letter-spacing: 2px; font-weight: 900; color: var(--accent); display: flex; align-items: center; padding: 0 16px; border-bottom: 1px solid var(--bg-input);">LEGO CATALOG</div>
        <div ref="sidebarScrollEl" class="sidebar-list" style="padding: 12px; overflow-y: auto; height: calc(100% - 60px);" @scroll="saveUiState">
          
          <div style="margin-bottom: 12px; font-size: 9px; opacity: 0.4; font-weight: 900; letter-spacing: 1px;">🔹 ПОЛЯ</div>
          <div v-for="b in atomicBricks" :key="b.val" class="sidebar-item-brick glass-panel" draggable="true" @dragstart="startDragNew($event, b, 'atomic')" style="padding: 12px; margin-bottom: 6px; border-radius: 8px;">
             <span style="font-size: 20px;">{{ b.icon }}</span>
             <div style="display: flex; flex-direction: column;"><span style="font-weight: 900; font-size: 12px; color: var(--text-main);">{{ b.label }}</span><span style="font-size: 8px; opacity: 0.3;">FIELD</span></div>
          </div>
          
          <div style="margin: 20px 0 12px 0; font-size: 9px; opacity: 0.4; font-weight: 900; letter-spacing: 1px;">⏱️ TIMELINE-МОДУЛИ</div>
          <div v-for="(tpl, key) in timelineTemplates" :key="key" class="sidebar-item-brick glass-panel" draggable="true" @dragstart="startDragNew($event, tpl, 'module', String(key))" style="padding: 12px; margin-bottom: 6px; border-radius: 8px;">
              <span style="font-size: 20px;">⏱️</span>
              <div style="display: flex; flex-direction: column;"><span style="font-weight: 900; font-size: 12px; color: var(--text-main);">{{ key }}</span><span style="font-size: 8px; opacity: 0.3;">timeline</span></div>
          </div>
          
          <div style="margin: 20px 0 12px 0; font-size: 9px; opacity: 0.4; font-weight: 900; letter-spacing: 1px;">📋 DYNAMIC-МОДУЛИ</div>
          <div v-for="(tpl, key) in dynamicTemplates" :key="key" class="sidebar-item-brick glass-panel" draggable="true" @dragstart="startDragNew($event, tpl, 'module', String(key))" style="padding: 12px; margin-bottom: 6px; border-radius: 8px;">
              <span style="font-size: 20px;">{{ tpl.isBidirectional ? '🤝' : '📋' }}</span>
              <div style="display: flex; flex-direction: column;"><span style="font-weight: 900; font-size: 12px; color: var(--text-main);">{{ key }}</span><span style="font-size: 8px; opacity: 0.3;">{{ tpl.isBidirectional ? 'relationship' : 'dynamic' }}</span></div>
          </div>
        </div>
      </aside>
    </div>
    </div>

    <!-- JSON (IMPORT / EXPORT) -->
    <div v-if="showJsonPreview" class="glass-modal-overlay visible" @click="showJsonPreview = false">
      <div class="glass-modal glass-panel" @click.stop style="width: 1100px; height: 85vh; display: flex; flex-direction: column;">
         <div class="glass-title" style="display: flex; justify-content: space-between; align-items: center; padding-right: 20px;">
            <span>SCHEMA (IMPORT / EXPORT)</span>
            <button class="btn-new" @click="applyImportedJson" style="font-size: 10px; padding: 4px 12px; background: var(--accent);">APPLY CHANGES</button>
         </div>
         <div style="flex: 1; padding: 24px; overflow: hidden;">
            <textarea v-model="editableJson" class="input-base" style="width: 100%; height: 100%; background: #000; color: #0f0; font-family: monospace; font-size: 12px; padding: 20px; border: 1px solid var(--border-color); resize: none;"></textarea>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import XboxWheel from './XboxWheel.vue'
import RelationshipBlock from './RelationshipBlock.vue'

const entityName = ref('Universal Entity')
const sections = ref<any[]>([])
const activeSectionIdx = ref(0)
const fullConfig = ref<any>({})
const showJsonPreview = ref(false)
const dragOver = ref(false)
const draggedOverIdx = ref(-1)
const draggedOverModuleIdx = ref(-1)
const isPreviewMode = ref(false)

const activeSection = computed(() => sections.value[activeSectionIdx.value])

const atomicBricks = [
  { val: 'text', icon: '📝', label: 'Текст' },
  { val: 'textarea', icon: '📄', label: 'Абзац' },
  { val: 'select', icon: '🔽', label: 'Список' },
  { val: 'multiselect', icon: '☑️', label: 'Мульти' },
  { val: 'calendar_date', icon: '📅', label: 'Дата' },
  { val: 'range', icon: '🎚️', label: 'Шкала' },
  { val: 'number', icon: '🔢', label: 'Число' },
  { val: 'tags', icon: '🏷️', label: 'Теги' },
  { val: 'photo', icon: '🖼️', label: 'Фото' }
]

const monthsList = [
  { value: '1', label: 'Январь' }, { value: '2', label: 'Февраль' }, { value: '3', label: 'Март' },
  { value: '4', label: 'Апрель' }, { value: '5', label: 'Май' }, { value: '6', label: 'Июнь' },
  { value: '7', label: 'Июль' }, { value: '8', label: 'Август' }, { value: '9', label: 'Сентябрь' },
  { value: '10', label: 'Октябрь' }, { value: '11', label: 'Ноябрь' }, { value: '12', label: 'Декабрь' }
]

const typeOptions = atomicBricks

const mockReferenceData = ref<Record<string, any>>({
  chapter: [ { value: 'ch1', label: 'Глава 1' }, { value: 'ch2', label: 'Глава 2' } ],
  generic: [ { value: '1', label: 'Сущность А' } ],
  organization: [ { value: 'org1', label: 'Орден' } ],
  character: [ { value: 'char1', label: 'Герой' } ]
})

// Фильтруем шаблоны: убираем вспомогательные
const HELPER_TEMPLATES = ['dynamicEndDateTemplate', 'dynamicDisbandDateTemplate', 'dynamicAbolitionDateTemplate', 'stateCollapseDateTemplate']

const timelineTemplates = computed(() => {
  const all = fullConfig.value.templates || {}
  const result: Record<string, any> = {}
  Object.entries(all).forEach(([key, tpl]: [string, any]) => {
    if (HELPER_TEMPLATES.includes(key)) return
    if (tpl.type === 'timeline') result[key] = tpl
  })
  return result
})

const dynamicTemplates = computed(() => {
  const all = fullConfig.value.templates || {}
  const result: Record<string, any> = {}
  Object.entries(all).forEach(([key, tpl]: [string, any]) => {
    if (HELPER_TEMPLATES.includes(key)) return
    if (tpl.type === 'dynamic') result[key] = tpl
  })
  return result
})

const getModuleIcon = (templateKey: string) => {
  const tpl = fullConfig.value.templates?.[templateKey]
  if (!tpl) return '📦'
  if (tpl.isBidirectional) return '🤝'
  if (tpl.type === 'timeline') return '⏱️'
  return '📋'
}

const editableJson = ref('')

const mainScrollEl = ref<HTMLElement | null>(null)
const sidebarScrollEl = ref<HTMLElement | null>(null)

let uiStateTimeout: any;
const saveUiState = () => {
  clearTimeout(uiStateTimeout);
  uiStateTimeout = setTimeout(() => {
    localStorage.setItem('redact_sandbox_ui_state', JSON.stringify({
      activeSectionIdx: activeSectionIdx.value,
      mainScroll: mainScrollEl.value ? mainScrollEl.value.scrollTop : 0,
      sidebarScroll: sidebarScrollEl.value ? sidebarScrollEl.value.scrollTop : 0,
      isPreviewMode: isPreviewMode.value,
      showJsonPreview: showJsonPreview.value
    }))
  }, 100) // debounce
}

watch(activeSectionIdx, () => saveUiState())
watch(isPreviewMode, () => saveUiState())
watch(showJsonPreview, () => saveUiState())

onMounted(async () => {
  const savedState = localStorage.getItem('redact_sandbox_state')
  if (savedState) {
    try {
      const data = JSON.parse(savedState)
      // Validate that it has minimum required fields to avoid breaking the UI
      if (data && data.name && data.sections) {
        if (!data.templates || Object.keys(data.templates).length === 0) {
          data.templates = uiEditorData.templates || {}
        }
        importConfig(data)
      } else {
        await loadTemplates()
      }
    } catch (e) {
      console.warn('Failed to parse saved redact sandbox state:', e)
      await loadTemplates()
    }
  } else {
    await loadTemplates()
  }

  // Restore UI state
  const uiStateStr = localStorage.getItem('redact_sandbox_ui_state')
  if (uiStateStr) {
    try {
      const state = JSON.parse(uiStateStr)
      if (typeof state.activeSectionIdx === 'number') activeSectionIdx.value = state.activeSectionIdx
      if (typeof state.isPreviewMode === 'boolean') isPreviewMode.value = state.isPreviewMode
      if (typeof state.showJsonPreview === 'boolean') showJsonPreview.value = state.showJsonPreview
      setTimeout(() => {
        if (mainScrollEl.value) mainScrollEl.value.scrollTop = state.mainScroll || 0
        if (sidebarScrollEl.value) sidebarScrollEl.value.scrollTop = state.sidebarScroll || 0
      }, 50)
    } catch (e) {}
  }
})


import uiEditorData from '../../../struct/editor/ui_editor.json'

const loadTemplates = async () => {
  try {
    const data = uiEditorData;
    // Загружаем только шаблоны и метаданные, секции начинаются пустыми
    const { sections: _, ...metaAndTemplates } = data
    fullConfig.value = metaAndTemplates
    entityName.value = data.name || 'Universal Entity'
    sections.value = [
      {
        title: 'ОСНОВНОЕ',
        icon: '📄',
        items: [
          {
            id: 'system_name',
            type: 'text',
            label: 'НАЗВАНИЕ СУЩНОСТИ',
            path: 'name',
            placeholder: 'Введите название...',
            _isAtomic: true,
            _isSystemName: true
          }
        ]
      }
    ]
    activeSectionIdx.value = 0
  } catch (e) { console.error('Failed to load templates:', e) }
}

const importConfig = (data: any) => {
  fullConfig.value = data
  entityName.value = data.name || 'Universal Entity'
  
  if (data.sections) {
    sections.value = data.sections.map((s: any) => {
      // Собираем поля и контейнеры в один массив items для конструктора
      const items = [
        ...(s.fields || []).map((f: any) => ({ ...f, _isAtomic: true })),
        ...(s.dynamicContainers || []).map((c: any) => ({ ...c, _isAtomic: false }))
      ]
      return { ...s, items }
    })
  } else {
    sections.value = []
  }
  
  if (sections.value.length > 0) activeSectionIdx.value = 0
  editableJson.value = JSON.stringify(data, null, 2)
}

const applyImportedJson = () => {
  try {
    const data = JSON.parse(editableJson.value)
    importConfig(data)
    showJsonPreview.value = false
  } catch (e) {
    alert('Invalid JSON! Check syntax.')
  }
}

watch(showJsonPreview, (val) => {
  if (val) {
    editableJson.value = jsonPreviewContent.value
  }
})

const resetState = async () => {
  if (confirm('Сбросить состояние редактора до исходного? Все несохраненные изменения будут потеряны.')) {
    localStorage.removeItem('redact_sandbox_state')
    await loadTemplates()
  }
}

const addNewPage = () => {
  sections.value.push({ title: 'НОВАЯ СТРАНИЦА', icon: '📄', items: [] })
  activeSectionIdx.value = sections.value.length - 1
}

const deleteSection = (idx: number) => {
  const sec = sections.value[idx];
  if (sec.items.length === 0 || confirm('Удалить эту страницу? Все поля на ней будут удалены.')) {
    sections.value.splice(idx, 1);
    if (activeSectionIdx.value >= sections.value.length) {
      activeSectionIdx.value = Math.max(0, sections.value.length - 1);
    }
  }
}

const isAtomicField = (item: any) => atomicBricks.some(b => b.val === item.type)
const getResolvedTemplate = (key: string) => fullConfig.value.templates?.[key]
const getResolvedFields = (key: string) => getResolvedTemplate(key)?.fields || []
const getOptions = (field: any) => (field.entityType && mockReferenceData.value[field.entityType]) ? mockReferenceData.value[field.entityType] : (field.options || [])

const isItemSelected = (field: any, val: any) => Array.isArray(field._val) && field._val.includes(val)
const toggleSelection = (field: any, val: any) => {
  if (!Array.isArray(field._val)) field._val = []
  const idx = field._val.indexOf(val); if (idx > -1) field._val.splice(idx, 1); else field._val.push(val)
}

const addOption = (item: any) => {
  if (!item.options) item.options = []
  item.options.push({ label: 'Вариант', value: 'v' + Math.random().toString(36).substr(2, 4) })
}

// DRAG AND DROP
let currentDragSource: 'catalog' | 'canvas' = 'catalog'
let currentDragData: any = null
let currentDragType: 'atomic' | 'module' = 'atomic'
let currentDragKey: string = ''
let currentDragCanvasIdx: number = -1

const startDragNew = (e: DragEvent, data: any, type: 'atomic' | 'module', key: string = '') => {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'all';
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.setData('application/json', JSON.stringify(data));
  }
  currentDragSource = 'catalog'
  currentDragData = JSON.parse(JSON.stringify(data))
  currentDragType = type
  currentDragKey = key
}

const handleDragOverCanvas = (e: DragEvent) => {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  dragOver.value = true;
}

const handleDragOverItem = (e: DragEvent, idx: number) => {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  draggedOverIdx.value = idx;
}

const handleDragOverModule = (e: DragEvent, idx: number) => {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  draggedOverModuleIdx.value = idx;
}

const handleItemDragStart = (e: DragEvent, idx: number) => {
  if (activeSection.value?.items[idx]?._isSystemName) {
    e.preventDefault();
    return;
  }
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'all';
    e.dataTransfer.setData('text/plain', 'canvas');
  }
  currentDragSource = 'canvas'
  currentDragCanvasIdx = idx
}

const handleDropNew = () => {
  dragOver.value = false
  if (currentDragSource !== 'catalog' || !activeSection.value) return
  const newItem = currentDragType === 'atomic' 
    ? { id: 'f_'+Date.now()+'_'+Math.random().toString(36).substr(2,4), type: currentDragData.val, label: currentDragData.label, path: 'path', placeholder: '', options: [] }
    : { id: 'mod_'+Date.now()+'_'+Math.random().toString(36).substr(2,4), type: currentDragData.type, title: currentDragKey, template: currentDragKey, dataPath: 'path', items: [], customFields: [] }
  activeSection.value.items.push(newItem)
}

const handleItemDrop = (targetIdx: number) => {
  draggedOverIdx.value = -1
  if (!activeSection.value) return
  // Prevent dropping before a system field
  if (targetIdx === 0 && activeSection.value.items[0]?._isSystemName) {
    targetIdx = 1;
  }
  if (currentDragSource === 'canvas') {
    if (currentDragCanvasIdx === targetIdx) return;
    const item = activeSection.value.items[currentDragCanvasIdx];
    activeSection.value.items.splice(currentDragCanvasIdx, 1);
    
    // Adjust targetIdx if dragging downwards because array length changed
    if (currentDragCanvasIdx < targetIdx) {
      targetIdx--;
    }
    activeSection.value.items.splice(targetIdx, 0, item);
  } else if (currentDragSource === 'catalog') {
    const newItem = currentDragType === 'atomic' 
      ? { id: 'f_'+Date.now()+'_'+Math.random().toString(36).substr(2,4), type: currentDragData.val, label: currentDragData.label, path: 'path', placeholder: '', options: [] }
      : { id: 'mod_'+Date.now()+'_'+Math.random().toString(36).substr(2,4), type: currentDragData.type, title: currentDragKey, template: currentDragKey, dataPath: 'path', items: [], customFields: [] }
    activeSection.value.items.splice(targetIdx, 0, newItem)
  }
}

const handleDropIntoModule = (moduleIdx: number) => {
  draggedOverModuleIdx.value = -1
  if (currentDragSource !== 'catalog' || currentDragType !== 'atomic' || !activeSection.value) return
  const module = activeSection.value.items[moduleIdx]
  if (!module.customFields) module.customFields = []
  const newField: any = { 
    id: 'cf_'+Date.now()+'_'+Math.random().toString(36).substr(2,4), 
    type: currentDragData.val, 
    label: currentDragData.label, 
    path: '', 
    placeholder: ''
  }
  // Initialize type-specific properties
  if (currentDragData.val === 'select' || currentDragData.val === 'multiselect') {
    newField.options = []
  }
  if (currentDragData.val === 'textarea') {
    newField.rows = 2
  }
  if (currentDragData.val === 'range' || currentDragData.val === 'number') {
    newField.min = 0
    newField.max = 100
  }
  if (currentDragData.val === 'range') {
    newField.value = 50
  }
  module.customFields.push(newField)
}

const openPreview = () => {
  isPreviewMode.value = true
}

const addDynamicItem = (module: any) => {
  if (!module.items) module.items = []
  const newItem: any = { id: 'item_' + Date.now() }
  // Add fields based on template
  const templateFields = getResolvedFields(module.template)
  templateFields.forEach((f: any) => {
    newItem[f.class] = f.type === 'multiselect' || f.type === 'select' ? [] : ''
  })
  module.items.push(newItem)
}

const jsonPreviewContent = computed(() => {
  const result = {
    name: entityName.value,
    icon: fullConfig.value.icon || "fa-cube",
    iconEmoji: fullConfig.value.iconEmoji || "🧩",
    photoField: fullConfig.value.photoField || "",
    tagsField: fullConfig.value.tagsField || "",
    titleField: fullConfig.value.titleField || "",
    entityType: fullConfig.value.entityType || "generic",
    templates: fullConfig.value.templates || {},
    sections: sections.value.map(s => {
      const fields = s.items.filter((i: any) => isAtomicField(i))
      const dynamicContainers = s.items.filter((i: any) => !isAtomicField(i))
      return {
        id: s.id || s.title.toLowerCase().replace(/\s+/g, '_'),
        title: s.title,
        icon: s.icon,
        fields: fields.map(({ _isAtomic, ...f }: any) => f),
        dynamicContainers: dynamicContainers.map(({ _isAtomic, ...c }: any) => c)
      }
    })
  }
  return JSON.stringify(result, null, 2)
})

watch(() => jsonPreviewContent.value, (newVal) => {
  if (newVal) {
    localStorage.setItem('redact_sandbox_state', newVal)
  }
}, { deep: true })

const exportSchema = () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonPreviewContent.value)
  const downloadAnchorNode = document.createElement('a')
  downloadAnchorNode.setAttribute("href", dataStr)
  downloadAnchorNode.setAttribute("download", `${entityName.value}.json`)
  document.body.appendChild(downloadAnchorNode)
  downloadAnchorNode.click()
  downloadAnchorNode.remove()
}

import { apiService } from '../../services/api.service'

const saveToProject = async () => {
  try {
    const project = new URLSearchParams(window.location.search).get('project') || 'default';
    const schemaStr = jsonPreviewContent.value;
    const schemaObj = JSON.parse(schemaStr);
    
    // Construct the backend-compatible EntitySchema struct
    const payload = {
      id: null,
      project_id: null,
      type_key: schemaObj.entityType || 'generic',
      type_name: schemaObj.name || 'Unknown Entity',
      icon: schemaObj.iconEmoji || '🧩',
      color: '#8b5cf6', // default accent color
      fields_schema: [], // Minimal fields for backend logic (can be expanded later)
      full_schema: schemaObj, // The full Vue UI representation!
      created_at: null
    };
    
    await apiService.saveSchema(project, payload);
    alert(`Схема "${schemaObj.name}" успешно сохранена! Страница будет перезагружена для обновления меню.`);
    window.location.reload();
  } catch (err) {
    console.error('Failed to save schema:', err);
    alert(`Ошибка сохранения схемы: ${err}`);
  }
}
</script>

<style scoped>
.editor-tabs-new { display: flex; gap: 4px; padding: 8px 24px; background: var(--bg-panel); border-bottom: 1px solid var(--bg-input); overflow-x: auto; }
.editor-tab-new { padding: 6px 16px; background: rgba(255,255,255,0.02); border-radius: 8px; font-size: 11px; font-weight: 800; color: #555; cursor: pointer; display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.editor-tab-new.active { background: var(--accent); color: var(--text-main); box-shadow: 0 0 10px var(--accent-glow); }

.type-btn-mini { background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 4px; cursor: pointer; transition: 0.2s; }
.type-btn-mini.active { background: var(--accent); border-color: var(--accent); }

.form-label-micro { font-size: 8px; font-weight: 900; color: #444; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px; }
.is-dragging-over { border-top: 2px solid var(--accent) !important; padding-top: 10px !important; }

.sidebar-item-brick { display: flex; align-items: center; background: var(--bg-secondary); border: 1px solid var(--bg-input); cursor: grab; transition: 0.15s; }
.sidebar-item-brick:hover { border-color: var(--accent); }

.empty-canvas-state { animation: pulse-empty 3s ease-in-out infinite; }
@keyframes pulse-empty {
  0%, 100% { border-color: var(--border-color); }
  50% { border-color: rgba(255,255,255,0.12); }
}
</style>