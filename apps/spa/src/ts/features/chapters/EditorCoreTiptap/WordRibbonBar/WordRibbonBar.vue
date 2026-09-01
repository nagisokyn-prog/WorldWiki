<template>
  <div class="word-ribbon">
    <!-- Верхние вкладки Ribbon -->
    <div class="ribbon-tabs-bar">
      <button 
        type="button" 
        class="ribbon-tab-btn" 
        :class="{ 'is-active': activeTab === 'home' }" 
        @click="activeTab = 'home'"
      >
        Главная
      </button>
      <button 
        type="button" 
        class="ribbon-tab-btn" 
        :class="{ 'is-active': activeTab === 'insert' }" 
        @click="activeTab = 'insert'"
      >
        Вставка
      </button>
      <button 
        type="button" 
        class="ribbon-tab-btn" 
        :class="{ 'is-active': activeTab === 'layout' }" 
        @click="activeTab = 'layout'"
      >
        Макет
      </button>
    </div>

    <!-- Полоса инструментов активной вкладки -->
    <div class="ribbon-content-strip">
      
      <!-- ===================================================================
           ВКЛАДКА: ГЛАВНАЯ
           =================================================================== -->
      <template v-if="activeTab === 'home'">
        <!-- Группа: Шрифт -->
        <div class="ribbon-group">
          <div class="ribbon-group-rows">
            <!-- Верхний ряд: Гарнитура, Кегль, Размер+/-, Очистка -->
            <div class="ribbon-row">
              <select 
                v-model="currentFontFamily" 
                class="ribbon-select ribbon-select-font" 
                title="Шрифт (гарнитура)"
                @change="applyFontFamily"
              >
                <optgroup label="ГОСТ и Академические стандарты">
                  <option value="'Times New Roman', Times, serif">Times New Roman (ГОСТ 7.32)</option>
                  <option value="'PT Serif', Georgia, serif">PT Serif (Российский академический)</option>
                  <option value="'PT Astra Serif', 'Times New Roman', serif">PT Astra Serif (Госслужба ГОСТ)</option>
                  <option value="'PT Astra Sans', Arial, sans-serif">PT Astra Sans (Госслужба)</option>
                  <option value="'Liberation Serif', Times, serif">Liberation Serif (Академический)</option>
                </optgroup>
                <optgroup label="Офисные стандарты">
                  <option value="Calibri, sans-serif">Calibri (MS Word)</option>
                  <option value="Arial, sans-serif">Arial (ГОСТ / Отчеты)</option>
                  <option value="Georgia, serif">Georgia (Повышенная читаемость)</option>
                </optgroup>
                <optgroup label="Книжная и художественная верстка">
                  <option value="'EB Garamond', Garamond, serif">EB Garamond (Классическая литература)</option>
                  <option value="'Bookman Old Style', Georgia, serif">Bookman Old Style (Книжная печать)</option>
                  <option value="'Century Schoolbook', Georgia, serif">Century Schoolbook (Учебники)</option>
                  <option value="'Courier New', monospace">Courier New (Моноширинный / Сценарии)</option>
                </optgroup>
              </select>

              <select 
                v-model="currentFontSize" 
                class="ribbon-select ribbon-select-size" 
                title="Размер шрифта"
                @change="applyFontSize"
              >
                <option value="10pt">10</option>
                <option value="11pt">11</option>
                <option value="12pt">12</option>
                <option value="14pt">14</option>
                <option value="16pt">16</option>
                <option value="18pt">18</option>
                <option value="20pt">20</option>
                <option value="24pt">24</option>
              </select>

              <button 
                type="button" 
                class="ribbon-btn" 
                title="Увеличить размер (Ctrl+Shift+>)"
                @click="stepFontSize(1)"
              >
                A<sup>▲</sup>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                title="Уменьшить размер (Ctrl+Shift+<)"
                @click="stepFontSize(-1)"
              >
                A<sub>▼</sub>
              </button>

              <span class="ribbon-separator"></span>

              <button 
                type="button" 
                class="ribbon-btn" 
                title="Очистить всё форматирование"
                @click="commands.clearFormatting?.()"
              >
                <i class="fas fa-eraser"></i>
              </button>
            </div>

            <!-- Нижний ряд: Ж, К, Ч, Зачеркнутый, Индексы, Цвет -->
            <div class="ribbon-row">
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('bold') }" 
                title="Полужирный (Ctrl+B)"
                @click="commands.toggleBold?.()"
              >
                <b>Ж</b>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('italic') }" 
                title="Курсив (Ctrl+I)"
                @click="commands.toggleItalic?.()"
              >
                <i>К</i>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('underline') }" 
                title="Подчеркнутый (Ctrl+U)"
                @click="commands.toggleUnderline?.()"
              >
                <u class="ribbon-icon-underline">Ч</u>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('strike') }" 
                title="Зачеркнутый"
                @click="commands.toggleStrike?.()"
              >
                <s>ab</s>
              </button>

              <span class="ribbon-separator"></span>

              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('subscript') }" 
                title="Подстрочный знак (Ctrl+=)"
                @click="commands.toggleSubscript?.()"
              >
                x<sub>2</sub>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('superscript') }" 
                title="Надстрочный знак (Ctrl+Shift++)"
                @click="commands.toggleSuperscript?.()"
              >
                x<sup>2</sup>
              </button>

              <span class="ribbon-separator"></span>

              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('highlight') }" 
                title="Цвет выделения текста (маркер)"
                @click="commands.toggleHighlight?.()"
              >
                <i class="fas fa-highlighter"></i>
              </button>
            </div>
          </div>

          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Шрифт</span>
            <button 
              type="button" 
              class="ribbon-dialog-launcher" 
              title="Параметры шрифта"
              @click="$emit('open-font-dialog')"
            >
              <i class="fas fa-external-link-alt"></i>
            </button>
          </div>
        </div>

        <!-- Группа: Абзац -->
        <div class="ribbon-group">
          <div class="ribbon-group-rows">
            <!-- Верхний ряд: Списки, Отступы, Пилькроу -->
            <div class="ribbon-row">
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('bulletList') }" 
                title="Маркеры (список)"
                @click="commands.toggleBulletList?.()"
              >
                <i class="fas fa-list-ul"></i>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('orderedList') }" 
                title="Нумерация"
                @click="commands.toggleOrderedList?.()"
              >
                <i class="fas fa-list-ol"></i>
              </button>

              <span class="ribbon-separator"></span>

              <button 
                type="button" 
                class="ribbon-btn" 
                title="Уменьшить отступ"
                @click="commands.decreaseIndent?.()"
              >
                <i class="fas fa-outdent"></i>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                title="Увеличить отступ"
                @click="commands.increaseIndent?.()"
              >
                <i class="fas fa-indent"></i>
              </button>

              <span class="ribbon-separator"></span>

              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': showInvisibles }" 
                title="Отобразить все знаки (¶)"
                @click="toggleInvisibles"
              >
                ¶
              </button>
            </div>

            <!-- Нижний ряд: Выравнивание (Left, Center, Right, Justify), Межстрочный интервал -->
            <div class="ribbon-row">
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.({ textAlign: 'left' }) }" 
                title="По левому краю (Ctrl+L)"
                @click="commands.setTextAlign?.('left')"
              >
                <i class="fas fa-align-left"></i>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.({ textAlign: 'center' }) }" 
                title="По центру (Ctrl+E)"
                @click="commands.setTextAlign?.('center')"
              >
                <i class="fas fa-align-center"></i>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.({ textAlign: 'right' }) }" 
                title="По правому краю (Ctrl+R)"
                @click="commands.setTextAlign?.('right')"
              >
                <i class="fas fa-align-right"></i>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.({ textAlign: 'justify' }) }" 
                title="По ширине (Ctrl+J)"
                @click="commands.setTextAlign?.('justify')"
              >
                <i class="fas fa-align-justify"></i>
              </button>

              <span class="ribbon-separator"></span>

              <!-- Выпадающий список межстрочного интервала -->
              <select 
                v-model="currentLineHeight" 
                class="ribbon-select" 
                title="Междустрочный интервал"
                @change="applyLineHeight"
              >
                <option value="1.0">1,0</option>
                <option value="1.15">1,15</option>
                <option value="1.5">1,5 (ГОСТ)</option>
                <option value="2.0">2,0</option>
              </select>

              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('blockquote') }" 
                title="Цитата"
                @click="commands.toggleBlockquote?.()"
              >
                <i class="fas fa-quote-right"></i>
              </button>
            </div>
          </div>

          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Абзац</span>
            <button 
              type="button" 
              class="ribbon-dialog-launcher" 
              title="Параметры абзаца (Скриншот 3)"
              @click="$emit('open-paragraph-dialog')"
            >
              <i class="fas fa-external-link-alt"></i>
            </button>
          </div>
        </div>

        <!-- Группа: Стили / Заголовки -->
        <div class="ribbon-group">
          <div class="ribbon-group-rows">
            <div class="ribbon-row">
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('heading', { level: 1 }) }" 
                title="Заголовок 1 (Ctrl+Alt+1)"
                @click="commands.setHeading?.(1)"
              >
                H1
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('heading', { level: 2 }) }" 
                title="Заголовок 2 (Ctrl+Alt+2)"
                @click="commands.setHeading?.(2)"
              >
                H2
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('heading', { level: 3 }) }" 
                title="Заголовок 3 (Ctrl+Alt+3)"
                @click="commands.setHeading?.(3)"
              >
                H3
              </button>
            </div>
          </div>
          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Стили</span>
          </div>
        </div>
      </template>

      <!-- ===================================================================
           ВКЛАДКА: ВСТАВКА
           =================================================================== -->
      <template v-else-if="activeTab === 'insert'">
        <!-- Страницы -->
        <div class="ribbon-group">
          <div class="ribbon-row">
            <button 
              type="button" 
              class="ribbon-btn ribbon-btn-large" 
              title="Разрыв страницы (Ctrl+Enter)"
              @click="commands.insertPageBreak?.()"
            >
              <i class="fas fa-file-alt"></i>
              <span>Разрыв страницы</span>
            </button>
          </div>
          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Страницы</span>
          </div>
        </div>

        <!-- Таблицы -->
        <div class="ribbon-group">
          <div class="ribbon-row">
            <button 
              type="button" 
              class="ribbon-btn ribbon-btn-large" 
              title="Вставить таблицу"
              @click="commands.insertTable?.()"
            >
              <i class="fas fa-table"></i>
              <span>Таблица</span>
            </button>
          </div>
          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Таблицы</span>
          </div>
        </div>

        <!-- Иллюстрации -->
        <div class="ribbon-group">
          <div class="ribbon-row">
            <button 
              type="button" 
              class="ribbon-btn ribbon-btn-large" 
              title="Вставить рисунок по ГОСТ"
              @click="commands.insertImage?.()"
            >
              <i class="fas fa-image"></i>
              <span>Рисунок</span>
            </button>
          </div>
          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Иллюстрации</span>
          </div>
        </div>

        <!-- Ссылки и сноски -->
        <div class="ribbon-group">
          <div class="ribbon-row">
            <button 
              type="button" 
              class="ribbon-btn ribbon-btn-large" 
              title="Гиперссылка (Ctrl+K)"
              @click="commands.insertLink?.()"
            >
              <i class="fas fa-link"></i>
              <span>Ссылка</span>
            </button>
            <button 
              type="button" 
              class="ribbon-btn ribbon-btn-large" 
              title="Подстрочная сноска (Ctrl+Alt+F)"
              @click="commands.insertFootnote?.()"
            >
              <i class="fas fa-asterisk"></i>
              <span>Сноска</span>
            </button>
          </div>
          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Ссылки и примечания</span>
          </div>
        </div>

        <!-- Символы и формулы -->
        <div class="ribbon-group">
          <div class="ribbon-row">
            <button 
              type="button" 
              class="ribbon-btn ribbon-btn-large" 
              title="Вставить математическое уравнение (Alt + =)"
              @click="commands.insertEquation?.()"
            >
              <i class="fas fa-square-root-alt"></i>
              <span>Уравнение (Alt+=)</span>
            </button>
          </div>
          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Символы</span>
          </div>
        </div>
      </template>

      <!-- ===================================================================
           ВКЛАДКА: МАКЕТ
           =================================================================== -->
      <template v-else-if="activeTab === 'layout'">
        <div class="ribbon-group">
          <div class="ribbon-row">
            <!-- Поля листа -->
            <button 
              type="button" 
              class="ribbon-btn ribbon-btn-large" 
              title="Поля по ГОСТ 7.32 (30/10/20/20 мм)"
              @click="commands.setGostMargins?.()"
            >
              <i class="fas fa-border-all"></i>
              <span>Поля ГОСТ</span>
            </button>

            <!-- Ориентация листа -->
            <button 
              type="button" 
              class="ribbon-btn ribbon-btn-large" 
              title="Сменить ориентацию страницы (Книжная / Альбомная)"
              @click="commands.togglePageOrientation?.()"
            >
              <i class="fas fa-sync-alt"></i>
              <span>Ориентация</span>
            </button>

            <!-- Размер листа (А4, А5, А3, Letter, B5) -->
            <div class="ribbon-field-column">
              <label class="ribbon-mini-label">Формат</label>
              <select 
                v-model="currentPageSize" 
                class="ribbon-select" 
                title="Формат бумаги"
                @change="commands.setPageSize?.(currentPageSize)"
              >
                <option value="A4">A4 (210 × 297 мм) · ГОСТ</option>
                <option value="A5">A5 (148 × 210 мм) · Книга</option>
                <option value="A3">A3 (297 × 420 мм) · Схемы/Карты</option>
                <option value="Letter">Letter (216 × 279 мм)</option>
                <option value="B5">B5 (176 × 250 мм) · Монография</option>
              </select>
            </div>
          </div>
          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Параметры страницы</span>
          </div>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { EditorInstance } from '../WordMode/RkWordEditor.model';

export type PaperSize = 'A4' | 'A5' | 'A3' | 'Letter' | 'B5';

export interface RibbonCommands {
  toggleBold?: () => boolean | undefined;
  toggleItalic?: () => boolean | undefined;
  toggleUnderline?: () => boolean | undefined;
  toggleStrike?: () => boolean | undefined;
  toggleSubscript?: () => boolean | undefined;
  toggleSuperscript?: () => boolean | undefined;
  toggleHighlight?: () => boolean | undefined;
  setHeading?: (level: number) => boolean | undefined;
  toggleBlockquote?: () => boolean | undefined;
  toggleBulletList?: () => boolean | undefined;
  toggleOrderedList?: () => boolean | undefined;
  setTextAlign?: (align: 'left' | 'center' | 'right' | 'justify') => void | boolean | undefined;
  setFontFamily?: (font: string) => void | boolean | undefined;
  setFontSize?: (size: string) => void | boolean | undefined;
  setLineHeight?: (height: string) => void | boolean | undefined;
  decreaseIndent?: () => void | boolean | undefined;
  increaseIndent?: () => void | boolean | undefined;
  insertPageBreak?: () => void;
  insertImage?: () => void;
  insertTable?: () => void;
  insertLink?: () => void;
  insertFootnote?: () => void;
  insertEquation?: () => void;
  clearFormatting?: () => void;
  setGostMargins?: () => void;
  togglePageOrientation?: () => void;
  setPageSize?: (size: PaperSize) => void;
  [key: string]: unknown;
}

const props = defineProps<{
  editor: EditorInstance | null | undefined;
  commands: RibbonCommands;
}>();

defineEmits(['open-paragraph-dialog', 'open-font-dialog']);

const activeTab = ref<'home' | 'insert' | 'layout'>('home');
const currentPageSize = ref<PaperSize>('A4');
const currentFontFamily = ref("'Times New Roman', Times, serif");
const currentFontSize = ref('14pt');
const currentLineHeight = ref('1.5');
const showInvisibles = ref(false);

const applyFontFamily = () => {
  props.commands.setFontFamily?.(currentFontFamily.value);
};

const applyFontSize = () => {
  props.commands.setFontSize?.(currentFontSize.value);
};

const applyLineHeight = () => {
  props.commands.setLineHeight?.(currentLineHeight.value);
};

const stepFontSize = (delta: number) => {
  const currentNum = parseInt(currentFontSize.value, 10) || 14;
  const newNum = Math.max(8, Math.min(72, currentNum + delta * 2));
  currentFontSize.value = `${newNum}pt`;
  applyFontSize();
};

const toggleInvisibles = () => {
  showInvisibles.value = !showInvisibles.value;
  document.body.classList.toggle('show-invisibles', showInvisibles.value);
};
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/WordRibbonBar.css"></style>
