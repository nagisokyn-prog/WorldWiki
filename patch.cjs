const fs = require('fs');
let c = fs.readFileSync('src/js/components/Vue/RedactSandbox.vue', 'utf8');

const target = `                                 </div>
                              </div>
                           </div>
                       </div>`;

const rep = `                                 </div>
                              </div>
                              
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
                                       <label class="form-label-micro">Варианты (Options)</label>
                                       <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                                          <div v-for="(opt, oIdx) in (cField.options || [])" :key="oIdx" style="display: flex; gap: 6px; align-items: center;">
                                             <input v-model="opt.value" class="input-base" style="font-size: 10px; padding: 4px; flex: 1; font-family: monospace;" placeholder="value">
                                             <input v-model="opt.label" class="input-base" style="font-size: 10px; padding: 4px; flex: 2;" placeholder="Label">
                                             <button style="color: #f55; background: none; border: none; font-size: 12px;" @click="cField.options.splice(Number(oIdx), 1)">✕</button>
                                          </div>
                                          <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 6px;" @click="() => { if(!cField.options) cField.options=[]; cField.options.push({label:'', value:''}) }">+ ДОБАВИТЬ ВАРИАНТ</button>
                                       </div>
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
                       </div>`;

if (c.includes(target)) {
    fs.writeFileSync('src/js/components/Vue/RedactSandbox.vue', c.replace(target, rep));
    console.log("Success with CRLF exact match!");
} else {
    // try to match ignoring \r
    const t2 = target.replace(/\r/g, '');
    const c2 = c.replace(/\r/g, '');
    if (c2.includes(t2)) {
        const result = c2.replace(t2, rep);
        fs.writeFileSync('src/js/components/Vue/RedactSandbox.vue', result);
        console.log("Success by normalizing CRLF!");
    } else {
        console.error("Target still not found!");
    }
}
