import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import WordRuler from '../src/components/ruler/WordRuler.vue';

describe('WordRuler Component - Physical Word Ruler Fidelity', () => {
  it('1. Рендерит линейку А4 в книжной ориентации с шириной 794px и рабочим полем 17.0 см', () => {
    const wrapper = mount(WordRuler, {
      props: {
        pageSize: 'A4',
        isLandscape: false,
      },
    });

    const ruler = wrapper.find('.ruler-horizontal');
    expect(ruler.exists()).toBe(true);
    expect(ruler.attributes('style')).toContain('width: 794px');

    // Проверяем наличие левого поля и метки ГОСТ (1.25 см)
    const leftMargin = wrapper.find('.ruler-margin-left-zone');
    expect(leftMargin.exists()).toBe(true);
    expect(leftMargin.attributes('style')).toContain('width: 113px'); // Левое поле 3 см (~113px)

    const gostMark = wrapper.find('.ruler-gost-magnet-mark');
    expect(gostMark.exists()).toBe(true);

    const gostLabel = wrapper.find('.ruler-gost-magnet-label');
    expect(gostLabel.text()).toBe('ГОСТ');
  });

  it('2. Динамически растягивается до 1123px и 25.2 см при переключении в Landscape', () => {
    const wrapper = mount(WordRuler, {
      props: {
        pageSize: 'A4',
        isLandscape: true,
      },
    });

    const ruler = wrapper.find('.ruler-horizontal');
    expect(ruler.attributes('style')).toContain('width: 1123px');

    // Наличие сантиметровых делений расширенной шкалы
    const ticks = wrapper.findAll('.ruler-printable-zone .tick-cm');
    expect(ticks.length).toBeGreaterThanOrEqual(25);
  });

  it('3. Отображает три фирменных маркера Word (красная строка, левый и правый отступы)', () => {
    const wrapper = mount(WordRuler, {
      props: {
        pageSize: 'A4',
        isLandscape: false,
      },
    });

    const firstLineMarker = wrapper.find('.marker-first-line');
    const leftIndentMarker = wrapper.find('.marker-left-indent');
    const rightIndentMarker = wrapper.find('.marker-right-indent');

    expect(firstLineMarker.exists()).toBe(true);
    expect(leftIndentMarker.exists()).toBe(true);
    expect(rightIndentMarker.exists()).toBe(true);
  });

  it('4. Двойной клик по бегунку первой строки сбрасывает отступ на ГОСТ 1.25 см', async () => {
    const wrapper = mount(WordRuler, {
      props: {
        pageSize: 'A4',
        isLandscape: false,
      },
    });

    const firstLineMarker = wrapper.find('.marker-first-line');
    await firstLineMarker.trigger('dblclick');

    const emitted = wrapper.emitted('update:firstLineIndent');
    expect(emitted).toBeTruthy();
    expect(emitted?.[0]).toEqual([1.25]);
  });

  it('5. Корректно адаптируется под форматы A3, A5 и Letter', () => {
    const wrapperA5 = mount(WordRuler, {
      props: { pageSize: 'A5', isLandscape: false },
    });
    expect(wrapperA5.find('.ruler-horizontal').attributes('style')).toContain('width: 559px');

    const wrapperA3 = mount(WordRuler, {
      props: { pageSize: 'A3', isLandscape: false },
    });
    expect(wrapperA3.find('.ruler-horizontal').attributes('style')).toContain('width: 1123px');

    const wrapperLetter = mount(WordRuler, {
      props: { pageSize: 'Letter', isLandscape: false },
    });
    expect(wrapperLetter.find('.ruler-horizontal').attributes('style')).toContain('width: 816px');
  });
});

