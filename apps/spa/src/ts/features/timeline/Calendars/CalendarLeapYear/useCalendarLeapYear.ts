import { ref, onMounted, computed } from "vue";
import { settingsService } from '@worldwiki/components';

export function useCalendarLeapYear(props: any, _emit?: any) {
  const isCollapsed = ref(false);

  const wheelHorizontal = ref(
    settingsService.getSettings()?.dropdowns?.wheelOrientation === "horizontal",
  );

  onMounted(() => {
    settingsService.onChange(
      (s: any) => (wheelHorizontal.value = s.dropdowns?.wheelOrientation === "horizontal"),
    );
    if (!props.modelValue.пользовательское_високосное_правило) {
      props.modelValue.пользовательское_високосное_правило = { месяц: 0, день_смещения: 1 };
    }
  });

  const updateRule = (val: string) => {
    props.modelValue.правило_високосного_года = val;
  };

  const customRuleMonth = computed({
    get: () => props.modelValue.пользовательское_високосное_правило?.месяц || 0,
    set: (val) => {
      if (!props.modelValue.пользовательское_високосное_правило) {
        props.modelValue.пользовательское_високосное_правило = { месяц: val, день_смещения: 1 };
      } else {
        props.modelValue.пользовательское_високосное_правило.месяц = val;
      }
    },
  });

  const customRuleDays = computed({
    get: () => props.modelValue.пользовательское_високосное_правило?.день_смещения || 1,
    set: (val) => {
      if (!props.modelValue.пользовательское_високосное_правило) {
        props.modelValue.пользовательское_високосное_правило = { месяц: 0, день_смещения: val };
      } else {
        props.modelValue.пользовательское_високосное_правило.день_смещения = val;
      }
    },
  });

  return {
    isCollapsed,
    wheelHorizontal,
    updateRule,
    customRuleMonth,
    customRuleDays
  };
}
