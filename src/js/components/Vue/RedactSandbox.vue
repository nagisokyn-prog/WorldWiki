<template>
  <div class="app-container-new glass-theme" style="width: 100%; height: 100%; overflow: hidden; display: flex; flex-direction: column;">
    <!-- PREVIEW MODE -->
    <div v-if="isPreviewMode" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg-base);">
      <header class="glass-panel" style="border-radius: 0; border: none; border-bottom: 1px solid var(--border-color); padding: 0 24px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; height: 50px; background: var(--bg-panel); backdrop-filter: blur(20px); flex-shrink: 0;">
        <div style="font-weight: 900; font-size: 16px; color: var(--text-main);">👁️ ПРЕДПРОСМОТР: {{ activeSection?.title || 'Страница' }}</div>
        <button class="btn-new" style="font-size: 10px; padding: 6px 16px;" @click="isPreviewMode = false">← ВЕРНУТЬСЯ В РЕДАКТОР</button>
      </header>
      <main style="flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative;">
        <EntityEditor
          :key="previewKey"
          entityId="preview"
          :entityType="entityName"
          project="default"
        />
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
        
        <div v-if="activeSection" style="width: 100%; max-width: 1400px; margin: 0 auto;">
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
                               <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
                                  <input v-model="item.title" class="input-base" style="background: transparent; border: none; font-weight: 900; font-size: 18px; color: var(--text-main); padding: 0;" placeholder="НАЗВАНИЕ МОДУЛЯ">
                                  <div style="display: flex; align-items: center; gap: 8px;">
                                     <span style="font-size: 10px; color: var(--text-muted); opacity: 0.5;">Текст при пустоте:</span>
                                     <input v-model="item.emptyMessage" class="input-base" style="background: transparent; border: none; border-bottom: 1px dashed rgba(255,255,255,0.2); font-size: 10px; color: var(--text-muted); padding: 0; width: 300px;" placeholder="Пусто...">
                                  </div>
                               </div>
                            </div>
                            <div style="display: flex; gap: 12px; align-items: flex-start;">
                               <button class="btn-new" style="font-size: 10px; padding: 6px 16px;" @click="addDynamicItem(item)">+ НОВАЯ ЗАПИСЬ</button>
                               <button style="color: #f55; background: none; border: none; font-size: 16px; cursor: pointer;" @click="activeSection.items.splice(iIdx, 1)">✕</button>
                            </div>
                         </div>
                         
                         
                          <!-- BIDIRECTIONAL SPLIT CONFIGURATOR -->
                          <template v-if="fullConfig.templates?.[item.template]?.isBidirectional">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
                              <!-- СТОРОНА А -->
                              <div style="background: rgba(167,139,250,0.04); border: 1px solid rgba(167,139,250,0.2); border-radius: 12px; padding: 14px;">
                                <div style="font-size: 10px; font-weight: 900; color: #a78bfa; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; border-bottom: 1px solid rgba(167,139,250,0.15); padding-bottom: 8px;">🟣 СТОРОНА А (эта сущность)</div>
                                <div v-for="(bField, fIdx) in getRawTemplateFields(item.template)" :key="'la-'+fIdx" style="margin-bottom: 14px;" :style="{ opacity: getFieldOverride(item, bField.class).hidden ? 0.3 : 1 }">
                                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                    <label class="form-label-micro" style="color: #a78bfa;">{{ getFieldOverride(item, bField.class).label || bField.label || bField.class }}</label>
                                    <button style="background:none;border:none;cursor:pointer;font-size:9px;color:var(--text-muted);opacity:0.7;" @click="toggleFieldOverride(item, bField.class)">{{ getFieldOverride(item, bField.class).hidden ? '👁️‍🗨️ скрыто' : '👁️ видимо' }}</button>
                                  </div>
                                  <XboxWheel v-if="(getFieldOverride(item, bField.class).type || bField.type) === 'select'" :model-value="''" :options="getFieldOverride(item, bField.class).options || bField.options || []" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'" />
                                  <input v-else class="input-base" style="font-size:12px;pointer-events:none;" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'">
                                  <div style="margin-top:6px;padding:8px;background:rgba(0,0,0,0.3);border-radius:6px;border:1px solid rgba(255,255,255,0.04);">
                                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">
                                      <div><label class="form-label-micro">Название</label><input v-model="ensureFieldOverride(item, bField.class).label" class="input-base" style="font-size:10px;padding:4px;" :placeholder="bField.label || bField.class"></div>
                                      <div><label class="form-label-micro">Подсказка</label><input v-model="ensureFieldOverride(item, bField.class).placeholder" class="input-base" style="font-size:10px;padding:4px;" :placeholder="bField.placeholder || '...'"></div>
                                    </div>
                                    <template v-if="bField.entityType !== undefined">
                                      <label class="form-label-micro">ТИП СУЩНОСТИ А</label>
                                      <select v-model="ensureFieldOverride(item, bField.class).entityType" class="input-base" style="font-size:10px;padding:4px;width:100%;">
                                        <option value="">— любая —</option>
                                        <option v-for="t in availableEntityTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
                                      </select>
                                    </template>
                                    <template v-else-if="(getFieldOverride(item, bField.class).type || bField.type) === 'select'">
                                      <label class="form-label-micro">Варианты</label>
                                      <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px;">
                                        <div v-for="(opt, oIdx) in (ensureFieldOverride(item, bField.class).options || [])" :key="oIdx" style="display:flex;gap:4px;align-items:center;">
                                          <input v-model="opt.value" class="input-base" style="font-size:10px;padding:3px;flex:1;font-family:monospace;" placeholder="value">
                                          <input v-model="opt.label" class="input-base" style="font-size:10px;padding:3px;flex:2;" placeholder="Label">
                                          <button style="color:#f55;background:none;border:none;font-size:11px;" @click="ensureFieldOverride(item, bField.class).options.splice(Number(oIdx),1)">✕</button>
                                        </div>
                                        <button class="btn-new btn-outline-new" style="font-size:9px;padding:4px;" @click="addFieldOption(item, bField.class)">+ вариант</button>
                                      </div>
                                    </template>
                                  </div>
                                </div>
                                <!-- dynamicContainers LEFT -->
                                <div v-for="subConf in (fullConfig.templates?.[item.template]?.dynamicContainers || [])" :key="'ldc-'+subConf.id" style="margin-top:12px;border:1px solid rgba(167,139,250,0.25);border-radius:8px;overflow:hidden;">
                                  <div style="background:rgba(167,139,250,0.12);padding:8px 12px;font-size:10px;font-weight:900;color:#a78bfa;letter-spacing:0.5px;text-transform:uppercase;">⏱️ {{ subConf.title }}</div>
                                  <div style="padding:10px;display:flex;flex-direction:column;gap:8px;">
                                    <div v-for="(nField, nIdx) in (subConf.fields || [])" :key="'lnf-'+nIdx" style="padding:8px;background:rgba(0,0,0,0.2);border-radius:6px;">
                                      <label class="form-label-micro" style="color:rgba(167,139,250,0.8);margin-bottom:4px;">{{ nField.label || nField.class }}</label>
                                      <XboxWheel v-if="nField.type === 'select'" :model-value="''" :options="nField.options || []" :placeholder="nField.placeholder || '...'" />
                                      <input v-else class="input-base" style="font-size:11px;pointer-events:none;" :placeholder="nField.placeholder || '...'">
                                    </div>
                                    <div style="text-align:center;padding:8px;opacity:0.25;font-size:10px;border:1px dashed rgba(167,139,250,0.2);border-radius:6px;">{{ subConf.emptyMessage || 'Пусто' }}</div>
                                  </div>
                                </div>
                              </div>
                              <!-- СТОРОНА Б -->
                              <div style="background:rgba(96,165,250,0.04);border:1px solid rgba(96,165,250,0.2);border-radius:12px;padding:14px;">
                                <div style="font-size:10px;font-weight:900;color:#60a5fa;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;border-bottom:1px solid rgba(96,165,250,0.15);padding-bottom:8px;">🔵 СТОРОНА Б (связанная сущность)</div>
                                <div v-for="(bField, fIdx) in getRawTemplateFields(item.template)" :key="'rb-'+fIdx" style="margin-bottom:14px;">
                                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                                    <label class="form-label-micro" style="color:#60a5fa;">{{ bField.label || bField.class }}</label>
                                    <span style="font-size:9px;color:var(--text-muted);opacity:0.4;">зеркало</span>
                                  </div>
                                  <XboxWheel v-if="bField.type === 'select'" :model-value="''" :options="bField.options || []" :placeholder="bField.placeholder || '...'" :disabled="true" />
                                  <input v-else class="input-base" style="font-size:12px;pointer-events:none;opacity:0.5;" :placeholder="bField.placeholder || '...'">
                                  <template v-if="bField.entityType !== undefined">
                                    <div style="margin-top:6px;padding:8px;background:rgba(0,0,0,0.3);border-radius:6px;border:1px solid rgba(96,165,250,0.08);">
                                      <label class="form-label-micro">ТИП СУЩНОСТИ Б</label>
                                      <select v-model="ensureFieldOverride(item, bField.class + '__b').entityType" class="input-base" style="font-size:10px;padding:4px;width:100%;">
                                        <option value="">— любая —</option>
                                        <option v-for="t in availableEntityTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
                                      </select>
                                    </div>
                                  </template>
                                </div>
                                <!-- dynamicContainers RIGHT mirror -->
                                <div v-for="subConf in (fullConfig.templates?.[item.template]?.dynamicContainers || [])" :key="'rdc-'+subConf.id" style="margin-top:12px;border:1px solid rgba(96,165,250,0.25);border-radius:8px;overflow:hidden;">
                                  <div style="background:rgba(96,165,250,0.12);padding:8px 12px;font-size:10px;font-weight:900;color:#60a5fa;letter-spacing:0.5px;text-transform:uppercase;">⏱️ {{ subConf.title }}</div>
                                  <div style="padding:10px;display:flex;flex-direction:column;gap:8px;">
                                    <div v-for="(nField, nIdx) in (subConf.fields || [])" :key="'rnf-'+nIdx" style="padding:8px;background:rgba(0,0,0,0.2);border-radius:6px;">
                                      <label class="form-label-micro" style="color:rgba(96,165,250,0.8);margin-bottom:4px;">{{ nField.label || nField.class }}</label>
                                      <XboxWheel v-if="nField.type === 'select'" :model-value="''" :options="nField.options || []" :placeholder="nField.placeholder || '...'" :disabled="true" />
                                      <input v-else class="input-base" style="font-size:11px;pointer-events:none;opacity:0.5;" :placeholder="nField.placeholder || '...'">
                                    </div>
                                    <div style="text-align:center;padding:8px;opacity:0.25;font-size:10px;border:1px dashed rgba(96,165,250,0.2);border-radius:6px;">{{ subConf.emptyMessage || 'Пусто' }}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </template>
                          <template v-else>
                          <!-- NON-BIDIRECTIONAL UNIFIED MODULE CONFIGURATOR -->
                          <div class="glass-grid-2" style="gap: 20px; padding: 16px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px solid var(--border-color); margin-top: 16px;">
                             <div v-for="(bField, fIdx) in getRawTemplateFields(item.template)" :key="fIdx" :style="{ opacity: getFieldOverride(item, bField.class).hidden ? 0.3 : 1 }">
                                
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                   <label class="form-label-micro" style="color: var(--accent); opacity: 0.8;">{{ getFieldOverride(item, bField.class).label || bField.label || bField.class }}</label>
                                   <button style="background: none; border: none; cursor: pointer; font-size: 10px; opacity: 0.8;" @click="toggleFieldOverride(item, bField.class)">
                                      {{ getFieldOverride(item, bField.class).hidden ? 'Скрыто 👁️‍🗨️' : 'Видимо 👁️' }}
                                   </button>
                                </div>

                                <XboxWheel v-if="(getFieldOverride(item, bField.class).type || bField.type) === 'select'" :model-value="''" :options="getFieldOverride(item, bField.class).options || bField.options || []" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'" />
                                <input v-else class="input-base" style="font-size: 12px; pointer-events: none;" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'">

                                <!-- INLINE SETTINGS -->
                                <div style="margin-top: 8px; padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                                   <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                      <div>
                                         <label class="form-label-micro">Название (Label)</label>
                                         <input v-model="ensureFieldOverride(item, bField.class).label" class="input-base" style="font-size: 10px; padding: 4px;" :placeholder="bField.label || bField.class">
                                      </div>
                                      <div>
                                         <label class="form-label-micro">Подсказка</label>
                                         <input v-model="ensureFieldOverride(item, bField.class).placeholder" class="input-base" style="font-size: 10px; padding: 4px;" :placeholder="bField.placeholder || '...'">
                                      </div>
                                   </div>
                                   
                                   <div style="margin-top: 8px;">
                                      <label class="form-label-micro">Переопределить тип</label>
                                      <XboxWheel :model-value="ensureFieldOverride(item, bField.class).type || ''" @update:modelValue="val => ensureFieldOverride(item, bField.class).type = val" :options="[{ value: '', label: '(Как в базе: ' + bField.type + ')' }, ...atomicBricks]" />
                                   </div>
                                   
                                   <div v-if="(ensureFieldOverride(item, bField.class).type || bField.type) === 'select' || (ensureFieldOverride(item, bField.class).type || bField.type) === 'multiselect'" style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
                                      <template v-if="fullConfig.templates[item.template]?.isBidirectional">
                                        <div style="display: flex; gap: 8px; justify-content: space-between;">
                                           <div style="flex: 1;">
                                              <label class="form-label-micro">ИСТОЧНИК (SOURCE)</label>
                                              <select v-model="ensureFieldOverride(item, bField.class).sourceType" class="input-base" style="font-size: 10px; padding: 4px; width: 100%;">
                                                <option v-for="t in availableEntityTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
                                              </select>
                                           </div>
                                           <div style="flex: 1;">
                                              <label class="form-label-micro">ЦЕЛЬ (TARGET)</label>
                                              <select v-model="ensureFieldOverride(item, bField.class).targetType" class="input-base" style="font-size: 10px; padding: 4px; width: 100%;">
                                                <option v-for="t in availableEntityTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
                                              </select>
                                           </div>
                                        </div>
                                      </template>
                                      <template v-else>
                                         <label class="form-label-micro">Варианты (Options)</label>
                                         <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                                            <div v-for="(opt, oIdx) in (ensureFieldOverride(item, bField.class).options || [])" :key="oIdx" style="display: flex; gap: 6px; align-items: center;">
                                               <input v-model="opt.value" class="input-base" style="font-size: 10px; padding: 4px; flex: 1; font-family: monospace;" placeholder="value">
                                               <input v-model="opt.label" class="input-base" style="font-size: 10px; padding: 4px; flex: 2;" placeholder="Label">
                                               <button style="color: #f55; background: none; border: none; font-size: 12px;" @click="ensureFieldOverride(item, bField.class).options.splice(Number(oIdx), 1)">✕</button>
                                            </div>
                                            <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 6px;" @click="addFieldOption(item, bField.class)">+ ДОБАВИТЬ ВАРИАНТ</button>
                                         </div>
                                      </template>
                                   </div>
                                </div>
                             </div>
                          </div>

                          </template>
                           <!-- CUSTOM FIELDS -->
                          <div v-for="(cField, cIdx) in (item.customFields || [])" :key="'cf_'+cIdx">
                             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <label class="form-label-micro" style="color: var(--accent); opacity: 0.8;">{{ cField.label || 'Новое поле' }} (Кастомное)</label>
                                <button style="background: none; border: none; cursor: pointer; color: #f55; font-size: 10px; opacity: 0.8;" @click="item.customFields.splice(Number(cIdx), 1)">
                                   Удалить ✕
                                </button>
                             </div>

                             <XboxWheel v-if="cField.type === 'select'" :model-value="''" :options="cField.options || []" :placeholder="cField.placeholder || '...'" />
                             <input v-else class="input-base" style="font-size: 12px; pointer-events: none;" :placeholder="cField.placeholder || '...'">

                             <!-- INLINE SETTINGS -->
                             <div style="margin-top: 8px; padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                   <div>
                                      <label class="form-label-micro">Название (Label)</label>
                                      <input v-model="cField.label" class="input-base" style="font-size: 10px; padding: 4px;" placeholder="Название поля">
                                   </div>
                                   <div>
                                      <label class="form-label-micro">Подсказка</label>
                                      <input v-model="cField.placeholder" class="input-base" style="font-size: 10px; padding: 4px;" placeholder="...">
                                   </div>
                                </div>
                                
                                <div style="margin-top: 8px;">
                                   <label class="form-label-micro">Тип</label>
                                   <XboxWheel :model-value="cField.type || ''" @update:modelValue="val => cField.type = val" :options="atomicBricks" />
                                </div>
                                
                                <div v-if="cField.type === 'select' || cField.type === 'multiselect'" style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
                                   <template v-if="fullConfig.templates[item.template]?.isBidirectional">
                                      <div style="display: flex; gap: 8px; justify-content: space-between;">
                                         <div style="flex: 1;">
                                            <label class="form-label-micro">ИСТОЧНИК (SOURCE)</label>
                                            <select v-model="cField.sourceType" class="input-base" style="font-size: 10px; padding: 4px; width: 100%;">
                                              <option v-for="t in availableEntityTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
                                            </select>
                                         </div>
                                         <div style="flex: 1;">
                                            <label class="form-label-micro">ЦЕЛЬ (TARGET)</label>
                                            <select v-model="cField.targetType" class="input-base" style="font-size: 10px; padding: 4px; width: 100%;">
                                              <option v-for="t in availableEntityTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
                                            </select>
                                         </div>
                                      </div>
                                   </template>
                                   <template v-else>
                                      <label class="form-label-micro">Варианты (Options)</label>
                                      <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                                         <div v-for="(opt, oIdx) in (cField.options || [])" :key="oIdx" style="display: flex; gap: 6px; align-items: center;">
                                            <input v-model="opt.value" class="input-base" style="font-size: 10px; padding: 4px; flex: 1; font-family: monospace;" placeholder="value">
                                            <input v-model="opt.label" class="input-base" style="font-size: 10px; padding: 4px; flex: 2;" placeholder="Label">
                                            <button style="color: #f55; background: none; border: none; font-size: 12px;" @click="cField.options.splice(Number(oIdx), 1)">✕</button>
                                         </div>
                                         <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 6px;" @click="() => { if(!cField.options) cField.options=[]; cField.options.push({label:'', value:''}) }">+ ДОБАВИТЬ ВАРИАНТ</button>
                                      </div>
                                   </template>
                                </div>
                             </div>
                          </div>
                       </div>
                       
                       <!-- DROP ZONE FOR CUSTOM FIELDS -->
                       <div style="margin-top: 16px; padding: 20px; border: 2px dashed rgba(255,165,0,0.3); border-radius: 12px; text-align: center; background: rgba(255,165,0,0.05); cursor: grab;"
                            @dragenter.prevent="draggedOverModuleIdx = Number(iIdx)" 
                            @dragover.prevent="handleDragOverModule($event, Number(iIdx))" 
                            @dragleave="draggedOverModuleIdx = -1"
                            @drop.stop="handleDropIntoModule(Number(iIdx))"
                            :style="{ borderColor: draggedOverModuleIdx === Number(iIdx) ? 'var(--accent)' : 'rgba(255,165,0,0.3)', background: draggedOverModuleIdx === Number(iIdx) ? 'rgba(255,165,0,0.1)' : 'rgba(255,165,0,0.05)' }">
                          <div style="font-size: 12px; font-weight: 900; color: rgba(255,165,0,0.6);">🎯 СЮДА КИДАЙ ПОЛЯ</div>
                          <div style="font-size: 10px; color: rgba(255,165,0,0.4); margin-top: 4px;">Захвати поле из левой панели</div>
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
      <div v-if="showCatalog" class="catalog-resizer" @mousedown="startResize" style="width: 8px; cursor: ew-resize; background: transparent; z-index: 100; transition: background 0.2s;" onmouseover="this.style.background='var(--accent)'" onmouseout="this.style.background='transparent'"></div>
      <aside v-if="showCatalog" class="sidebar-new glass-panel" :style="{ width: catalogWidth + 'px', borderRadius: 0, border: 'none', borderLeft: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(40px)', flexShrink: 0 }">
        <div class="sidebar-header" style="height: 50px; font-size: 10px; letter-spacing: 2px; font-weight: 900; color: var(--accent); display: flex; align-items: center; padding: 0 16px; border-bottom: 1px solid var(--bg-input);">LEGO CATALOG</div>
        <div ref="sidebarScrollEl" class="sidebar-list" style="padding: 12px; overflow-y: auto; height: calc(100% - 60px);" @scroll="saveUiState">
          
          <div style="margin-bottom: 12px; font-size: 9px; opacity: 0.4; font-weight: 900; letter-spacing: 1px;">🔹 ПОЛЯ</div>
          <div v-for="b in atomicBricks" :key="b.val" class="sidebar-item-brick glass-panel" draggable="true" @dragstart="startDragNew($event, b, 'atomic')" style="padding: 12px; margin-bottom: 6px; border-radius: 8px;">
             <span style="font-size: 20px;">{{ b.icon }}</span>
             <div style="display: flex; flex-direction: column;"><span style="font-weight: 900; font-size: 12px; color: var(--text-main);">{{ b.label }}</span><span style="font-size: 8px; opacity: 0.3;">FIELD</span></div>
          </div>
          
          <div style="margin: 20px 0 12px 0; font-size: 9px; opacity: 0.4; font-weight: 900; letter-spacing: 1px;">⏱️ TIMELINE-МОДУЛИ</div>
          <div v-for="(tpl, key) in timelineTemplates" :key="key" class="sidebar-item-brick glass-panel" draggable="true" @dragstart="startDragNew($event, tpl, 'module', String(key))" style="padding: 12px; margin-bottom: 6px; border-radius: 8px; display: flex; align-items: center;">
              <span style="font-size: 20px; margin-right: 8px;">⏱️</span>
              <div style="display: flex; flex-direction: column;"><span style="font-weight: 900; font-size: 12px; color: var(--text-main);">{{ key }}</span><span style="font-size: 8px; opacity: 0.3;">timeline</span></div>
              <div style="margin-left: auto; display: flex; gap: 8px;">
                <span :title="tpl.description || 'Нет описания'" style="cursor: help; opacity: 0.5; font-size: 14px;">❓</span>
                <span title="Посмотреть где используется" style="cursor: pointer; opacity: 0.5; font-size: 14px;" @click.stop="findTemplateUsages(String(key))">🔍</span>
              </div>
          </div>
          
          <div style="margin: 20px 0 12px 0; font-size: 9px; opacity: 0.4; font-weight: 900; letter-spacing: 1px;">📋 DYNAMIC-МОДУЛИ</div>
          <div v-for="(tpl, key) in dynamicTemplates" :key="key" class="sidebar-item-brick glass-panel" draggable="true" @dragstart="startDragNew($event, tpl, 'module', String(key))" style="padding: 12px; margin-bottom: 6px; border-radius: 8px; display: flex; align-items: center;">
              <span style="font-size: 20px; margin-right: 8px;">{{ tpl.isBidirectional ? '🤝' : '📋' }}</span>
              <div style="display: flex; flex-direction: column;"><span style="font-weight: 900; font-size: 12px; color: var(--text-main);">{{ key }}</span><span style="font-size: 8px; opacity: 0.3;">{{ tpl.isBidirectional ? 'relationship' : 'dynamic' }}</span></div>
              <div style="margin-left: auto; display: flex; gap: 8px;">
                <span :title="tpl.description || 'Нет описания'" style="cursor: help; opacity: 0.5; font-size: 14px;">❓</span>
                <span title="Посмотреть где используется" style="cursor: pointer; opacity: 0.5; font-size: 14px;" @click.stop="findTemplateUsages(String(key))">🔍</span>
              </div>
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

    <!-- USAGE MODAL -->
    <div v-if="showUsageModal" class="glass-modal-overlay visible" @click="showUsageModal = false" style="z-index: 100000;">
      <div class="glass-modal glass-panel" @click.stop style="width: 700px; max-height: 80vh; display: flex; flex-direction: column;">
         <div class="glass-title" style="display: flex; justify-content: space-between; align-items: center; padding-right: 20px;">
            <span>ГДЕ ИСПОЛЬЗУЕТСЯ: {{ usageTemplateName }}</span>
            <button class="btn-new" @click="showUsageModal = false" style="font-size: 10px; padding: 4px 12px;">ЗАКРЫТЬ</button>
         </div>
         <div style="padding: 24px; overflow-y: auto;">
            <div v-if="usageResults.length === 0" style="opacity: 0.5; text-align: center; padding: 20px;">
              Этот блок пока нигде не используется.
            </div>
            <div v-else style="display: flex; flex-direction: column; gap: 16px;">
              <div v-for="(res, idx) in usageResults" :key="idx" style="padding: 16px; background: rgba(0,0,0,0.4); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                 <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                    <div>
                      <div style="font-size: 10px; opacity: 0.5; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 1px;">Тип сущности: <span style="color: var(--accent); opacity: 1; font-weight: 900;">{{ res.entityType }}</span></div>
                      <div style="font-size: 10px; opacity: 0.5; text-transform: uppercase; letter-spacing: 1px;">Страница: <span style="color: #fff; opacity: 1;">{{ res.page }}</span></div>
                    </div>
                 </div>
                 
                 <!-- ЗДЕСЬ РЕНДЕРИМ САМ БЛОК -->
                 <div class="glass-panel" style="padding: 16px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px solid var(--border-color);">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                       <span style="font-size: 20px;">{{ getModuleIcon(res.container.template) || '📋' }}</span>
                       <span style="font-weight: 900; font-size: 16px; color: var(--text-main);">{{ res.block }}</span>
                    </div>
                    
                    <div class="glass-grid-2" style="gap: 8px;">
                       <div v-for="(tField, fIdx) in getResolvedFields(res.container)" :key="fIdx" style="padding: 8px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid var(--bg-input);">
                          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                             <label class="form-label-micro" style="opacity: 0.8; color: var(--accent);">{{ tField.label || tField.class }}</label>
                             <div style="font-size: 10px; color: var(--text-muted); font-family: monospace; opacity: 0.5;">{{ tField.class }} ({{ tField.type }})</div>
                          </div>
                          
                          <div v-if="tField.placeholder" style="font-size: 10px; color: var(--text-muted); margin-bottom: 4px; font-style: italic;">
                             "{{ tField.placeholder }}"
                          </div>
                          
                          <div v-if="tField.type === 'select' && tField.options" style="font-size: 10px; color: #fff; background: rgba(255,255,255,0.05); padding: 4px 6px; border-radius: 4px; line-height: 1.4; margin-top: 4px;">
                             <span style="opacity:0.5;">Опции: </span>
                             <span v-for="(opt, oIdx) in tField.options" :key="oIdx">
                               {{ opt.label }}<span v-if="Number(oIdx) < tField.options.length - 1">, </span>
                             </span>
                          </div>
                          <div v-else-if="tField.entityType" style="font-size: 10px; color: #fff; background: rgba(255,255,255,0.05); padding: 4px 6px; border-radius: 4px; margin-top: 4px;">
                             <span style="opacity:0.5;">Сущность: </span>{{ tField.entityType }}
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
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import XboxWheel from '../../../../tauri-surreal-kit/frontend/src/components/Vue/XboxWheel.vue'
import RelationshipBlock from './RelationshipBlock.vue'
import EntityEditor from './EntityEditor.vue'

import uiEditorData from '../../../struct/editor/ui_editor.json'


const entityName = ref('Universal Entity')

const availableEntityTypes = computed(() => {
  const rawSchemas = (import.meta as any).glob('../../../struct/editor/*.json', { eager: true });
  const types = [];
  for (const path in rawSchemas) {
    const data = (rawSchemas[path] as any).default || rawSchemas[path];
    if (data && data.name) {
      types.push({ value: data.entityType || data.name, label: data.name });
    }
  }
  
  if (entityName.value && !types.find(t => t.label === entityName.value)) {
    types.push({ value: entityName.value, label: `${entityName.value} (Черновик)` });
  }
  
  return types;
})
const sections = ref<any[]>([])
const activeSectionIdx = ref(0)
const fullConfig = ref<any>({})
const showJsonPreview = ref(false)
const dragOver = ref(false)
const draggedOverIdx = ref(-1)
const draggedOverModuleIdx = ref(-1)
const isPreviewMode = ref(false)

const showCatalog = ref(true)
const catalogWidth = ref(280)
const isResizing = ref(false)

const startResize = (e: MouseEvent) => {
  isResizing.value = true
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

const onResize = (e: MouseEvent) => {
  if (isResizing.value) {
    catalogWidth.value = Math.max(200, Math.min(800, window.innerWidth - e.clientX))
  }
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyB') {
    e.preventDefault()
    showCatalog.value = !showCatalog.value
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})

const showUsageModal = ref(false)
const usageResults = ref<any[]>([])
const usageTemplateName = ref('')

const findTemplateUsages = (templateKey: string) => {
  usageTemplateName.value = templateKey
  usageResults.value = []
  
  const rawSchemas = (import.meta as any).glob('../../../struct/editor/*.json', { eager: true });
  
  const allSchemas: any[] = [];
  for (const path in rawSchemas) {
    const data = (rawSchemas[path] as any).default || rawSchemas[path];
    if (data && data.sections) {
      allSchemas.push({ type: data.name || data.entityType || 'Сущность', data });
    }
  }
  
  for (const schema of allSchemas) {
    const sections = schema.data.sections || []
    for (const sec of sections) {
      const containers = sec.dynamicContainers || []
      for (const cont of containers) {
        if (cont.template === templateKey) {
          usageResults.value.push({
            entityType: schema.type,
            page: sec.title || sec.id,
            block: cont.title || cont.id,
            container: cont
          })
        }
      }
    }
  }
  
  showUsageModal.value = true
}

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

const getResolvedTemplate = (itemOrContainer: any) => {
  const tplName = typeof itemOrContainer === 'string' ? itemOrContainer : itemOrContainer.template;
  const baseTpl = fullConfig.value.templates?.[tplName];
  if (!baseTpl) return null;
  
  if (typeof itemOrContainer !== 'string' && itemOrContainer.fieldOverrides) {
    const resolvedFields = (baseTpl.fields || []).map((f: any) => {
      const override = itemOrContainer.fieldOverrides[f.class];
      if (override) {
        if (override.hidden) return null;
        return { ...f, ...override };
      }
      return f;
    }).filter((f: any) => f !== null);
    
    let resolvedChildContainers = baseTpl.dynamicContainers;
    if (itemOrContainer.customChildContainers) {
      resolvedChildContainers = itemOrContainer.customChildContainers;
    }
    
    return {
      ...baseTpl,
      fields: resolvedFields,
      dynamicContainers: resolvedChildContainers
    };
  }
  return baseTpl;
};

const getRawTemplateFields = (templateName: string) => {
  return fullConfig.value.templates?.[templateName]?.fields || [];
};

const ensureFieldOverride = (item: any, fieldClass: string) => {
  if (!item.fieldOverrides) item.fieldOverrides = {};
  if (!item.fieldOverrides[fieldClass]) {
    item.fieldOverrides[fieldClass] = {};
  }
  return item.fieldOverrides[fieldClass];
};

const getFieldOverride = (item: any, fieldClass: string) => {
  return item.fieldOverrides?.[fieldClass] || {};
};

const toggleFieldOverride = (item: any, fieldClass: string) => {
  const override = ensureFieldOverride(item, fieldClass);
  override.hidden = !override.hidden;
};

const addFieldOption = (item: any, fieldClass: string) => {
  const override = ensureFieldOverride(item, fieldClass);
  if (!override.options) override.options = [];
  override.options.push({ value: 'new_val', label: 'Новый вариант' });
};

const getResolvedFields = (itemOrContainer: any) => getResolvedTemplate(itemOrContainer)?.fields || [];

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
    : { id: 'mod_'+Date.now()+'_'+Math.random().toString(36).substr(2,4), type: currentDragData.type, title: currentDragKey, template: currentDragKey, dataPath: 'path', items: [{}], customFields: [] }
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
      : { id: 'mod_'+Date.now()+'_'+Math.random().toString(36).substr(2,4), type: currentDragData.type, title: currentDragKey, template: currentDragKey, dataPath: 'path', items: [{}], customFields: [] }
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

const previewKey = ref(0)
const openPreview = () => {
  sessionStorage.setItem('sandbox_preview_config', jsonPreviewContent.value);
  previewKey.value++; // Force EntityEditor remount
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
    sessionStorage.setItem('sandbox_preview_config', newVal);
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

import { apiService } from '../../services/api.service';

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
