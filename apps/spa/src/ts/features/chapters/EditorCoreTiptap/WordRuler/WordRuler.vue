<template>
  <div class="word-ruler-container">
    <div ref="rulerRef" class="ruler-horizontal" :style="{ width: sheetWidthPx + 'px' }">
      <!-- Серая зона левого поля со шкалой обратного отсчета (2, 1) как в Word -->
      <div 
        class="ruler-margin-left-zone" 
        :style="{ width: marginLeftPx + 'px' }"
        :title="'Левое поле (' + (marginLeftPx / pxPerCm).toFixed(1) + ' см)'"
      >
        <template v-for="mCm in Math.floor(marginLeftPx / pxPerCm)" :key="'left-cm-' + mCm">
          <div 
            class="ruler-tick tick-cm" 
            :style="{ right: mCm * pxPerCm + 'px' }"
          ></div>
          <span 
            class="ruler-number" 
            :style="{ right: (mCm * pxPerCm - 4) + 'px' }"
          >
            {{ mCm }}
          </span>
          <div 
            class="ruler-tick tick-half" 
            :style="{ right: (mCm - 0.5) * pxPerCm + 'px' }"
          ></div>
        </template>
      </div>

      <!-- Белая рабочая печатная зона с делениями -->
      <div class="ruler-printable-zone">
        <!-- Сантиметровые деления рабочей зоны (1..N) -->
        <template v-for="cm in Math.floor(printableCmMax) + 1" :key="'cm-' + cm">
          <div 
            class="ruler-tick tick-cm" 
            :style="{ left: (cm - 1) * pxPerCm + 'px' }"
          ></div>
          <span 
            v-if="cm > 1" 
            class="ruler-number" 
            :style="{ left: (cm - 1) * pxPerCm + 'px' }"
          >
            {{ cm - 1 }}
          </span>

          <!-- Полусантиметровые деления -->
          <div 
            v-if="cm <= printableCmMax"
            class="ruler-tick tick-half" 
            :style="{ left: ((cm - 1) + 0.5) * pxPerCm + 'px' }"
          ></div>
        </template>

        <!-- Метка ГОСТ (1.25 см) -->
        <div 
          class="ruler-gost-magnet-mark" 
          :style="{ left: 1.25 * pxPerCm + 'px' }"
          title="Красная строка по ГОСТ 7.32 (1.25 см)"
        ></div>
        <span 
          class="ruler-gost-magnet-label" 
          :style="{ left: 1.25 * pxPerCm + 'px' }"
        >
          ГОСТ
        </span>

        <!-- Ползунок 1: Красная строка (верхний треугольник острием вниз) -->
        <div 
          class="ruler-marker-handle marker-first-line"
          :style="{ left: firstLinePx + 'px' }"
          title="Отступ первой строки (красная строка). Двойной клик: 1.25 см ГОСТ"
          @mousedown.stop="startDrag('firstLine', $event)"
          @dblclick.stop="resetToGost"
        >
          <div class="marker-triangle-down"></div>
          <div v-if="activeDrag === 'firstLine'" class="ruler-tooltip">
            {{ (firstLineCm).toFixed(2) }} см
          </div>
        </div>

        <!-- Ползунок 2: Левый отступ абзаца (нижний треугольник + прямоугольник как в Word) -->
        <div 
          class="ruler-marker-handle marker-left-indent"
          :style="{ left: leftIndentPx + 'px' }"
          title="Отступ слева"
          @mousedown.stop="startDrag('leftIndent', $event)"
        >
          <div class="marker-triangle-up"></div>
          <div class="marker-rectangle-base"></div>
          <div v-if="activeDrag === 'leftIndent'" class="ruler-tooltip">
            {{ (leftIndentCm).toFixed(2) }} см
          </div>
        </div>

        <!-- Ползунок 3: Правый отступ абзаца (правый треугольник острием вверх) -->
        <div 
          class="ruler-marker-handle marker-right-indent"
          :style="{ left: rightIndentPx + 'px' }"
          title="Отступ справа"
          @mousedown.stop="startDrag('rightIndent', $event)"
        >
          <div class="marker-triangle-up"></div>
          <div v-if="activeDrag === 'rightIndent'" class="ruler-tooltip">
            {{ (printableCmMax - rightIndentCm).toFixed(2) }} см
          </div>
        </div>
      </div>

      <!-- Серая зона правого поля с продолжением шкалы (18...) -->
      <div 
        class="ruler-margin-right-zone" 
        :style="{ width: marginRightPx + 'px' }"
        :title="'Правое поле (' + (marginRightPx / pxPerCm).toFixed(1) + ' см)'"
      >
        <template v-for="rCm in Math.floor(marginRightPx / pxPerCm)" :key="'right-cm-' + rCm">
          <div 
            class="ruler-tick tick-cm" 
            :style="{ left: rCm * pxPerCm + 'px' }"
          ></div>
          <span 
            class="ruler-number" 
            :style="{ left: (rCm * pxPerCm) + 'px' }"
          >
            {{ Math.floor(printableCmMax) + rCm }}
          </span>
        </template>
      </div>
    </div>

    <!-- Тонкая направляющая линия через весь лист при перетаскивании -->
    <div 
      v-if="guidelineX !== null" 
      class="ruler-guideline" 
      :style="{ left: guidelineX + 'px' }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { PageSize, EditorInstance } from '../WordMode/RkWordEditor.model';

const props = withDefaults(defineProps<{
  pageSize?: PageSize;
  isLandscape?: boolean;
  editor?: EditorInstance | null;
}>(), {
  pageSize: 'A4',
  isLandscape: false,
  editor: null,
});

const emit = defineEmits<{
  (e: 'update:firstLineIndent', cm: number): void;
  (e: 'update:leftIndent', cm: number): void;
  (e: 'update:rightIndent', cm: number): void;
}>();

const rulerRef = ref<HTMLElement | null>(null);

// Коэффициент пересчета: ~37.82 px на 1 см
const pxPerCm = 37.82;

const dimensions = computed(() => {
  if (props.isLandscape) {
    switch (props.pageSize) {
      case 'A5':
        return { sheetWidth: 794, marginLeft: 75, marginRight: 38, printableCm: 18.0 };
      case 'A3':
        return { sheetWidth: 1587, marginLeft: 113, marginRight: 57, printableCm: 37.5 };
      case 'Letter':
        return { sheetWidth: 1056, marginLeft: 96, marginRight: 96, printableCm: 22.8 };
      case 'B5':
        return { sheetWidth: 945, marginLeft: 94, marginRight: 57, printableCm: 21.0 };
      case 'A4':
      default:
        return { sheetWidth: 1123, marginLeft: 113, marginRight: 57, printableCm: 25.2 };
    }
  }

  switch (props.pageSize) {
    case 'A5':
      return { sheetWidth: 559, marginLeft: 75, marginRight: 38, printableCm: 11.8 };
    case 'A3':
      return { sheetWidth: 1123, marginLeft: 113, marginRight: 38, printableCm: 25.7 };
    case 'Letter':
      return { sheetWidth: 816, marginLeft: 96, marginRight: 96, printableCm: 16.5 };
    case 'B5':
      return { sheetWidth: 665, marginLeft: 94, marginRight: 57, printableCm: 13.6 };
    case 'A4':
    default:
      return { sheetWidth: 794, marginLeft: 113, marginRight: 38, printableCm: 17.0 };
  }
});

const sheetWidthPx = computed(() => dimensions.value.sheetWidth);
const marginLeftPx = computed(() => dimensions.value.marginLeft);
const marginRightPx = computed(() => dimensions.value.marginRight);
const printableCmMax = computed(() => dimensions.value.printableCm);

const firstLineCm = ref(1.25); // ГОСТ 1.25 см по умолчанию
const leftIndentCm = ref(0.0);
const rightIndentCm = ref(17.0);

const firstLinePx = computed(() => firstLineCm.value * pxPerCm);
const leftIndentPx = computed(() => leftIndentCm.value * pxPerCm);
const rightIndentPx = computed(() => rightIndentCm.value * pxPerCm);

const activeDrag = ref<'firstLine' | 'leftIndent' | 'rightIndent' | null>(null);
const guidelineX = ref<number | null>(null);

const startDrag = (type: 'firstLine' | 'leftIndent' | 'rightIndent', e: MouseEvent) => {
  e.preventDefault();
  activeDrag.value = type;
  guidelineX.value = e.clientX;

  const onMouseMove = (moveEvt: MouseEvent) => {
    moveEvt.preventDefault();
    if (!rulerRef.value || !activeDrag.value) return;
    const rect = rulerRef.value.getBoundingClientRect();
    const printableLeft = rect.left + marginLeftPx.value;
    const printableWidth = sheetWidthPx.value - marginLeftPx.value - marginRightPx.value;
    const relX = Math.max(0, Math.min(printableWidth, moveEvt.clientX - printableLeft));
    let cm = relX / pxPerCm;

    // Магнитное притяжение к ГОСТ 1.25 см
    if (activeDrag.value === 'firstLine' && !moveEvt.altKey) {
      if (Math.abs(cm - 1.25) < 0.12) {
        cm = 1.25;
      } else if (Math.abs(cm - 1.0) < 0.08) {
        cm = 1.0;
      } else if (Math.abs(cm) < 0.08) {
        cm = 0.0;
      }
    }

    if (activeDrag.value === 'firstLine') {
      firstLineCm.value = cm;
      guidelineX.value = printableLeft + cm * pxPerCm;
      emit('update:firstLineIndent', cm);
    } else if (activeDrag.value === 'leftIndent') {
      leftIndentCm.value = cm;
      guidelineX.value = printableLeft + cm * pxPerCm;
      emit('update:leftIndent', cm);
    } else if (activeDrag.value === 'rightIndent') {
      rightIndentCm.value = cm;
      guidelineX.value = printableLeft + cm * pxPerCm;
      emit('update:rightIndent', 17 - cm);
    }
  };

  const onMouseUp = () => {
    activeDrag.value = null;
    guidelineX.value = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

const resetToGost = () => {
  firstLineCm.value = 1.25;
  emit('update:firstLineIndent', 1.25);
};

watch(() => props.editor, (ed) => {
  if (!ed) return;
  const updateFromSelection = () => {
    if (activeDrag.value) return; // Не перебивать при активном перетаскивании
    try {
      const { $from } = ed.state.selection;
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name === 'paragraph') {
          const rawIndent = node.attrs.textIndent;
          if (rawIndent && typeof rawIndent === 'string' && rawIndent.endsWith('cm')) {
            firstLineCm.value = parseFloat(rawIndent);
          }
          const rawLeft = node.attrs.leftIndent;
          if (rawLeft && typeof rawLeft === 'string' && rawLeft.endsWith('cm')) {
            leftIndentCm.value = parseFloat(rawLeft);
          }
          const rawRight = node.attrs.rightIndent;
          if (rawRight && typeof rawRight === 'string' && rawRight.endsWith('cm')) {
            rightIndentCm.value = printableCmMax.value - parseFloat(rawRight);
          }
          break;
        }
      }
    } catch {
      // Игнорируем исключения при проверке пустой выборки
    }
  };

  ed.on('selectionUpdate', updateFromSelection);
}, { immediate: true });
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/WordRuler.css"></style>
