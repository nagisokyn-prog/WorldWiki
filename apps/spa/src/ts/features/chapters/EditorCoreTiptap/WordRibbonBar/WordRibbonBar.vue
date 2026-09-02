<template>
  <div class="word-ribbon" @mousedown="onRibbonMousedown">
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
      <button 
        v-if="isInsideTable"
        type="button" 
        class="ribbon-tab-btn ribbon-tab-btn-context" 
        :class="{ 'is-active': activeTab === 'table-design' }" 
        @click="activeTab = 'table-design'"
      >
        Конструктор таблицы
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
                @click="call('clearFormatting', commands.clearFormatting)"
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
                @click="call('toggleBold', commands.toggleBold)"
              >
                <b>Ж</b>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('italic') }" 
                title="Курсив (Ctrl+I)"
                @click="call('toggleItalic', commands.toggleItalic)"
              >
                <i>К</i>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('underline') }" 
                title="Подчеркнутый (Ctrl+U)"
                @click="call('toggleUnderline', commands.toggleUnderline)"
              >
                <u class="ribbon-icon-underline">Ч</u>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('strike') }" 
                title="Зачеркнутый"
                @click="call('toggleStrike', commands.toggleStrike)"
              >
                <s>ab</s>
              </button>

              <span class="ribbon-separator"></span>

              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('subscript') }" 
                title="Подстрочный знак (Ctrl+=)"
                @click="call('toggleSubscript', commands.toggleSubscript)"
              >
                x<sub>2</sub>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('superscript') }" 
                title="Надстрочный знак (Ctrl+Shift++)"
                @click="call('toggleSuperscript', commands.toggleSuperscript)"
              >
                x<sup>2</sup>
              </button>

              <span class="ribbon-separator"></span>

              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('highlight') }" 
                title="Цвет выделения текста (маркер)"
                @click="call('toggleHighlight', commands.toggleHighlight)"
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
                @click="call('toggleBulletList', commands.toggleBulletList)"
              >
                <i class="fas fa-list-ul"></i>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('orderedList') }" 
                title="Нумерация"
                @click="call('toggleOrderedList', commands.toggleOrderedList)"
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
                @click="call('setTextAlign', () => commands.setTextAlign?.('left'))"
              >
                <i class="fas fa-align-left"></i>
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.({ textAlign: 'center' }) }" 
                title="По центру (Ctrl+E)"
                @click="call('setTextAlign', () => commands.setTextAlign?.('center'))"
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
                @click="call('toggleBlockquote', commands.toggleBlockquote)"
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
                @click="call('setHeading', () => commands.setHeading?.(1))"
              >
                H1
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('heading', { level: 2 }) }" 
                title="Заголовок 2 (Ctrl+Alt+2)"
                @click="call('setHeading', () => commands.setHeading?.(2))"
              >
                H2
              </button>
              <button 
                type="button" 
                class="ribbon-btn" 
                :class="{ 'is-active': editor?.isActive?.('heading', { level: 3 }) }" 
                title="Заголовок 3 (Ctrl+Alt+3)"
                @click="call('setHeading', () => commands.setHeading?.(3))"
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

        <!-- Колонтитулы -->
        <div class="ribbon-group">
          <div class="ribbon-row">
            <!-- Верхний колонтитул -->
            <div class="ribbon-dropdown">
              <button type="button" class="ribbon-btn ribbon-btn-large" :class="{ 'is-open': openDropdown === 'header' }" title="Верхний колонтитул" @click="toggleDropdown($event, 'header')">
                <i class="fas fa-grip-lines"></i>
                <span>Верхний ▾</span>
              </button>
              <div v-if="openDropdown === 'header'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
                <button type="button" class="ribbon-dropdown-item" @click="applyHeaderPreset('empty')">Пусто</button>
                <button type="button" class="ribbon-dropdown-item" @click="applyHeaderPreset('chapter-left')">Название главы (слева)</button>
                <button type="button" class="ribbon-dropdown-item" @click="applyHeaderPreset('chapter-center')">Название главы (по центру)</button>
                <div class="ribbon-dropdown-sep"></div>
                <button type="button" class="ribbon-dropdown-item" @click="closeDropdown(); commands.openHeaderFooterDialog?.('header')">
                  <i class="fas fa-edit"></i> Изменить верхний колонтитул...
                </button>
              </div>
            </div>

            <!-- Нижний колонтитул -->
            <div class="ribbon-dropdown">
              <button type="button" class="ribbon-btn ribbon-btn-large" :class="{ 'is-open': openDropdown === 'footer' }" title="Нижний колонтитул" @click="toggleDropdown($event, 'footer')">
                <i class="fas fa-grip-lines"></i>
                <span>Нижний ▾</span>
              </button>
              <div v-if="openDropdown === 'footer'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
                <button type="button" class="ribbon-dropdown-item" @click="applyFooterPreset('empty')">Пусто</button>
                <button type="button" class="ribbon-dropdown-item" @click="applyFooterPreset('page-right')">Стр. {page} из {total} (справа)</button>
                <button type="button" class="ribbon-dropdown-item" @click="applyFooterPreset('page-center')">Стр. {page} из {total} (центр)</button>
                <button type="button" class="ribbon-dropdown-item" @click="applyFooterPreset('page-only-right')">{page} (справа)</button>
                <div class="ribbon-dropdown-sep"></div>
                <button type="button" class="ribbon-dropdown-item" @click="closeDropdown(); commands.openHeaderFooterDialog?.('footer')">
                  <i class="fas fa-edit"></i> Изменить нижний колонтитул...
                </button>
              </div>
            </div>

            <!-- Номер страницы -->
            <div class="ribbon-dropdown">
              <button type="button" class="ribbon-btn ribbon-btn-large" :class="{ 'is-open': openDropdown === 'pagenum' }" title="Номер страницы" @click="toggleDropdown($event, 'pagenum')">
                <i class="fas fa-hashtag"></i>
                <span>Номер страницы ▾</span>
              </button>
              <div v-if="openDropdown === 'pagenum'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
                <div class="ribbon-dropdown-title">Вверху страницы:</div>
                <button type="button" class="ribbon-dropdown-item" @click="applyPageNumberPosition('header-left')">Слева</button>
                <button type="button" class="ribbon-dropdown-item" @click="applyPageNumberPosition('header-center')">Центр</button>
                <button type="button" class="ribbon-dropdown-item" @click="applyPageNumberPosition('header-right')">Справа</button>
                <div class="ribbon-dropdown-sep"></div>
                <div class="ribbon-dropdown-title">Внизу страницы:</div>
                <button type="button" class="ribbon-dropdown-item" @click="applyPageNumberPosition('footer-left')">Слева</button>
                <button type="button" class="ribbon-dropdown-item" @click="applyPageNumberPosition('footer-center')">Центр</button>
                <button type="button" class="ribbon-dropdown-item" @click="applyPageNumberPosition('footer-right')">Справа</button>
                <div class="ribbon-dropdown-sep"></div>
                <button type="button" class="ribbon-dropdown-item" @click="applyHeaderPreset('empty'); applyFooterPreset('empty')">Убрать номера страниц</button>
              </div>
            </div>
          </div>
          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Колонтитулы</span>
          </div>
        </div>

        <!-- Текст: оглавление и текстовый блок -->
        <div class="ribbon-group">
          <div class="ribbon-row">
            <button type="button" class="ribbon-btn ribbon-btn-large" title="Вставить оглавление (Содержание)" @click="commands.insertTableOfContents?.()">
              <i class="fas fa-list-ol"></i>
              <span>Оглавление</span>
            </button>
            <button type="button" class="ribbon-btn ribbon-btn-large" title="Вставить текстовый блок" @click="commands.insertTextBox?.()">
              <i class="fas fa-text-width"></i>
              <span>Текстовый блок</span>
            </button>
          </div>
          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Текст</span>
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
            <!-- Поля: dropdown пресетов -->
            <div class="ribbon-dropdown">
              <button
                type="button"
                class="ribbon-btn ribbon-btn-large"
                :class="{ 'is-open': openDropdown === 'margins' }"
                title="Поля страницы"
                @click="toggleDropdown($event, 'margins')"
              >
                <i class="fas fa-border-all"></i>
                <span>Поля ▾</span>
              </button>
              <div v-if="openDropdown === 'margins'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
                <button type="button" class="ribbon-dropdown-item" @click="commands.setMarginPreset?.('gost'); closeDropdown()">
                  <i class="fas fa-check"></i> ГОСТ 7.32 <small>(Л:30 П:15 В:20 Н:20 мм)</small>
                </button>
                <button type="button" class="ribbon-dropdown-item" @click="commands.setMarginPreset?.('normal'); closeDropdown()">
                  <i class="fas fa-circle"></i> Нормальные <small>(все по 20 мм)</small>
                </button>
                <button type="button" class="ribbon-dropdown-item" @click="commands.setMarginPreset?.('narrow'); closeDropdown()">
                  <i class="fas fa-circle"></i> Узкие <small>(все по 12 мм)</small>
                </button>
                <button type="button" class="ribbon-dropdown-item" @click="commands.setMarginPreset?.('wide'); closeDropdown()">
                  <i class="fas fa-circle"></i> Широкие <small>(Л:50 П:50 В:20 Н:20 мм)</small>
                </button>
                <div class="ribbon-dropdown-sep"></div>
                <button type="button" class="ribbon-dropdown-item" @click="closeDropdown(); emit('open-page-setup')">
                  <i class="fas fa-sliders-h"></i> Произвольные поля...
                </button>
              </div>
            </div>

            <!-- Ориентация: dropdown -->
            <div class="ribbon-dropdown">
              <button
                type="button"
                class="ribbon-btn ribbon-btn-large"
                :class="{ 'is-open': openDropdown === 'orientation' }"
                title="Ориентация страницы"
                @click="toggleDropdown($event, 'orientation')"
              >
                <i class="fas fa-sync-alt"></i>
                <span>Ориентация ▾</span>
              </button>
              <div v-if="openDropdown === 'orientation'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
                <button type="button" class="ribbon-dropdown-item" @click="commands.togglePageOrientation?.(); closeDropdown()">
                  <i class="fas fa-file"></i> Книжная
                </button>
                <button type="button" class="ribbon-dropdown-item" @click="commands.togglePageOrientation?.(); closeDropdown()">
                  <i class="fas fa-file"></i> Альбомная
                </button>
              </div>
            </div>

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

            <!-- Разрывы: dropdown -->
            <div class="ribbon-dropdown">
              <button
                type="button"
                class="ribbon-btn ribbon-btn-large"
                :class="{ 'is-open': openDropdown === 'breaks' }"
                title="Разрывы страниц и разделов"
                @click="toggleDropdown($event, 'breaks')"
              >
                <i class="fas fa-scissors"></i>
                <span>Разрывы ▾</span>
              </button>
              <div v-if="openDropdown === 'breaks'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
                <div class="ribbon-dropdown-title">Разрывы страниц:</div>
                <button type="button" class="ribbon-dropdown-item" @click="commands.insertPageBreak?.(); closeDropdown()">
                  <i class="fas fa-file"></i> Страница
                </button>
                <div class="ribbon-dropdown-sep"></div>
                <div class="ribbon-dropdown-title">Разрывы разделов:</div>
                <button type="button" class="ribbon-dropdown-item" @click="commands.insertSectionBreak?.(); closeDropdown()">
                  <i class="fas fa-file-alt"></i> Следующая страница (Книжная)
                </button>
                <button type="button" class="ribbon-dropdown-item" @click="commands.insertSectionLandscape?.(); closeDropdown()">
                  <i class="fas fa-file-alt"></i> Следующая страница (Альбомная) ★
                </button>
                <button type="button" class="ribbon-dropdown-item" @click="commands.insertSectionPortrait?.(); closeDropdown()">
                  <i class="fas fa-file-alt"></i> Вернуть книжную
                </button>
              </div>
            </div>

            <!-- Лаунчер Параметров страницы -->
            <button
              type="button"
              class="ribbon-btn"
              title="Параметры страницы"
              @click="emit('open-page-setup')"
            >
              <i class="fas fa-external-link-alt"></i>
            </button>
          </div>
          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Параметры страницы</span>
          </div>
        </div>

        <!-- Группа: Абзац (отступы и интервалы) -->
        <div class="ribbon-group">
          <div class="ribbon-row">
            <div class="ribbon-field-column">
              <label class="ribbon-mini-label">Отступ: Слева (см)</label>
              <input v-model.number="indentLeftCm" type="number" class="ribbon-input-number" step="0.5" min="0" title="Отступ слева (выделенному абзацу)" @change="applyLeftIndent" />
            </div>
            <div class="ribbon-field-column">
              <label class="ribbon-mini-label">Отступ: Справа (см)</label>
              <input v-model.number="indentRightCm" type="number" class="ribbon-input-number" step="0.5" min="0" title="Отступ справа (выделенному абзацу)" @change="applyRightIndent" />
            </div>
            <span class="ribbon-separator"></span>
            <div class="ribbon-field-column">
              <label class="ribbon-mini-label">Интервал: До (пт)</label>
              <input v-model.number="spacingBeforePt" type="number" class="ribbon-input-number" step="6" min="0" title="Интервал до абзаца" @change="applySpacing" />
            </div>
            <div class="ribbon-field-column">
              <label class="ribbon-mini-label">Интервал: После (пт)</label>
              <input v-model.number="spacingAfterPt" type="number" class="ribbon-input-number" step="6" min="0" title="Интервал после абзаца" @change="applySpacing" />
            </div>
          </div>
          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Абзац</span>
          </div>
        </div>
      </template>

      <!-- ВКЛАДКА: КОНСТРУКТОР ТАБЛИЦЫ (контекстная) -->
      <template v-else-if="activeTab === 'table-design'">
        <div class="ribbon-group">
          <div class="ribbon-row">
            <button type="button" class="ribbon-btn" title="Вставить строку выше" @click="(commands as any).addRowBefore?.()"><i class="fas fa-arrow-up"></i> Строка выше</button>
            <button type="button" class="ribbon-btn" title="Вставить строку ниже" @click="(commands as any).addRowAfter?.()"><i class="fas fa-arrow-down"></i> Строка ниже</button>
            <button type="button" class="ribbon-btn" title="Вставить столбец слева" @click="(commands as any).addColumnBefore?.()"><i class="fas fa-arrow-left"></i> Столбец слева</button>
            <button type="button" class="ribbon-btn" title="Вставить столбец справа" @click="(commands as any).addColumnAfter?.()"><i class="fas fa-arrow-right"></i> Столбец справа</button>
          </div>
          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Строки и столбцы</span>
          </div>
        </div>

        <div class="ribbon-group">
          <div class="ribbon-row">
            <button type="button" class="ribbon-btn" title="Объединить ячейки" @click="(commands as any).mergeCells?.()"><i class="fas fa-compress-arrows-alt"></i> Объединить</button>
            <button type="button" class="ribbon-btn" title="Разбить ячейки" @click="(commands as any).splitCell?.()"><i class="fas fa-expand-arrows-alt"></i> Разбить</button>
            <button type="button" class="ribbon-btn" title="Удалить строку" @click="(commands as any).deleteRow?.()"><i class="fas fa-trash"></i> Удалить строку</button>
            <button type="button" class="ribbon-btn" title="Удалить столбец" @click="(commands as any).deleteColumn?.()"><i class="fas fa-trash"></i> Удалить столбец</button>
            <button type="button" class="ribbon-btn" title="Удалить таблицу" @click="(commands as any).deleteTable?.()"><i class="fas fa-trash-alt"></i> Удалить таблицу</button>
          </div>
          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Объединение и удаление</span>
          </div>
        </div>

        <div class="ribbon-group">
          <div class="ribbon-row">
            <button type="button" class="ribbon-btn ribbon-btn-large" title="Таблица сетка — ГОСТ-стиль" @click="(commands as any).setTableStyle?.('grid')">
              <i class="fas fa-table"></i>
              <span>Таблица сетка</span>
            </button>
            <button type="button" class="ribbon-btn ribbon-btn-large" title="Без стиля" @click="(commands as any).setTableStyle?.('plain')">
              <i class="fas fa-table"></i>
              <span>Без стиля</span>
            </button>
          </div>
          <div class="ribbon-group-footer">
            <span class="ribbon-group-label">Стили таблиц</span>
          </div>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { useWordRibbonBar } from './useWordRibbonBar';
import type { RibbonProps as WordRibbonProps } from './useWordRibbonBar';

/**
 * Focus theft fix: клик по кнопке ленты по умолчанию уводит DOM-focus
 * с редактора → ProseMirror применяет команду «вслепую», подсветка
 * выделения пропадает. preventDefault на mousedown оставляет фокус
 * в редакторе, @click при этом срабатывает как обычно.
 * select/input/textarea не трогаем — им фокус нужен для работы.
 */
const onRibbonMousedown = (e: MouseEvent): void => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.closest('select, input, textarea')) return;
  e.preventDefault();
};

const props = defineProps<WordRibbonProps>();

const emit = defineEmits<{
  (e: 'open-paragraph-dialog'): void;
  (e: 'open-font-dialog'): void;
  (e: 'open-page-setup'): void;
  (e: 'open-header-footer-dialog', tab?: 'header' | 'footer'): void;
}>();

const {
  activeTab, currentPageSize, currentFontFamily, currentFontSize, currentLineHeight,
  showInvisibles, openDropdown, dropdownPos, indentLeftCm, indentRightCm,
  spacingBeforePt, spacingAfterPt, toggleDropdown, closeDropdown,
  applyLeftIndent, applyRightIndent, applySpacing, applyHeaderPreset,
  applyFooterPreset, applyPageNumberPosition, applyFontFamily, applyFontSize,
  applyLineHeight, stepFontSize, toggleInvisibles, call,
} = useWordRibbonBar(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/WordRibbonBar.css"></style>
