<template>
  <tr>
    <td>
      <input
        type="text"
        class="table-input"
        style="font-weight: 600;"
        :value="ev.name"
        :disabled="isReadOnly"
        @input="$emit('field-change', idx, 'name', ($event.target as HTMLInputElement).value)"
      />
    </td>
    <td>
      <input
        type="number"
        class="table-input"
        :value="ev.year"
        :disabled="isReadOnly"
        @input="$emit('field-change', idx, 'year', parseInt(($event.target as HTMLInputElement).value) || 0)"
      />
    </td>
    <td>
      <input
        type="number"
        class="table-input"
        min="1"
        max="60"
        :value="(ev.month !== undefined ? ev.month + 1 : 1)"
        :disabled="isReadOnly"
        @input="$emit('field-change', idx, 'month', (parseInt(($event.target as HTMLInputElement).value) || 1) - 1)"
      />
    </td>
    <td>
      <input
        type="number"
        class="table-input"
        min="1"
        max="60"
        :value="ev.day ?? 1"
        :disabled="isReadOnly"
        @input="$emit('field-change', idx, 'day', parseInt(($event.target as HTMLInputElement).value) || 1)"
      />
    </td>
    <td>
      <input
        type="text"
        class="table-input"
        placeholder="Краткое описание..."
        :value="ev.description ?? ''"
        :disabled="isReadOnly"
        @input="$emit('field-change', idx, 'description', ($event.target as HTMLInputElement).value)"
      />
    </td>
    <td>
      <button
        v-if="!isReadOnly"
        type="button"
        class="btn-icon-table"
        title="Удалить веху"
        @click="$emit('remove', idx)"
      >
        🗑️
      </button>
    </td>
  </tr>
</template>

<script setup lang="ts">
import type { AnchorEventDto } from '../Tab2ErasSync.model';

defineProps<{
  ev: AnchorEventDto;
  idx: number;
  isReadOnly?: boolean;
}>();

defineEmits<{
  (e: 'field-change', idx: number, field: keyof AnchorEventDto, value: unknown): void;
  (e: 'remove', idx: number): void;
}>();
</script>
