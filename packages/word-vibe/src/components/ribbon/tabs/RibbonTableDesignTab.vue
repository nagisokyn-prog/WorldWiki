<template>
  <div class="ribbon-tab-content flex">
    <div class="ribbon-group">
      <div class="ribbon-row">
        <button type="button" class="ribbon-btn" title="Вставить строку выше" @click="commands.addRowBefore?.()"><i class="fas fa-arrow-up"></i> Строка выше</button>
        <button type="button" class="ribbon-btn" title="Вставить строку ниже" @click="commands.addRowAfter?.()"><i class="fas fa-arrow-down"></i> Строка ниже</button>
        <button type="button" class="ribbon-btn" title="Вставить столбец слева" @click="commands.addColumnBefore?.()"><i class="fas fa-arrow-left"></i> Столбец слева</button>
        <button type="button" class="ribbon-btn" title="Вставить столбец справа" @click="commands.addColumnAfter?.()"><i class="fas fa-arrow-right"></i> Столбец справа</button>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Строки и столбцы</span>
      </div>
    </div>

    <div class="ribbon-group">
      <div class="ribbon-row">
        <button type="button" class="ribbon-btn" title="Объединить ячейки" @click="commands.mergeCells?.()"><i class="fas fa-compress-arrows-alt"></i> Объединить</button>
        <button type="button" class="ribbon-btn" title="Разбить ячейки" @click="commands.splitCell?.()"><i class="fas fa-expand-arrows-alt"></i> Разбить</button>
        <button type="button" class="ribbon-btn" title="Удалить строку" @click="commands.deleteRow?.()"><i class="fas fa-trash"></i> Удалить строку</button>
        <button type="button" class="ribbon-btn" title="Удалить столбец" @click="commands.deleteColumn?.()"><i class="fas fa-trash"></i> Удалить столбец</button>
        <button type="button" class="ribbon-btn" title="Удалить таблицу" @click="commands.deleteTable?.()"><i class="fas fa-trash-alt"></i> Удалить таблицу</button>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Объединение и удаление</span>
      </div>
    </div>

    <div class="ribbon-group">
      <div class="ribbon-row">
        <button type="button" class="ribbon-btn ribbon-btn-large" title="Таблица сетка — ГОСТ-стиль" @click="commands.setTableStyle?.('grid')">
          <i class="fas fa-table"></i>
          <span>Таблица сетка</span>
        </button>
        <button type="button" class="ribbon-btn ribbon-btn-large" title="Без стиля" @click="commands.setTableStyle?.('plain')">
          <i class="fas fa-table"></i>
          <span>Без стиля</span>
        </button>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Стили таблиц</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RibbonCommands } from '../../../ribbon/commands';

defineProps<{
  commands: Partial<RibbonCommands>;
}>();
</script>
