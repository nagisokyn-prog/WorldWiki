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
import { useWordRuler } from './useWordRuler';
import type { WordRulerProps } from './useWordRuler';

const props = withDefaults(defineProps<WordRulerProps>(), {
  pageSize: 'A4',
  isLandscape: false,
  editor: null,
});

const emit = defineEmits<{
  'update:firstLineIndent': [cm: number];
  'update:leftIndent': [cm: number];
  'update:rightIndent': [cm: number];
}>();

const {
  rulerRef, pxPerCm,
  sheetWidthPx, marginLeftPx, marginRightPx, printableCmMax,
  firstLineCm, leftIndentCm, rightIndentCm,
  firstLinePx, leftIndentPx, rightIndentPx,
  activeDrag, guidelineX, startDrag, resetToGost,
} = useWordRuler(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/WordRuler.css"></style>
