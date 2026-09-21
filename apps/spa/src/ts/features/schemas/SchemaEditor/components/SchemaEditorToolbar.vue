<template>
  <header class="schema-header">
    <div class="flex items-center gap-6">
      <div class="schema-header-title">
        ⚙️ СХЕМА:
        <input 
          :value="localEntityType" 
          class="input-base schema-header-input" 
          placeholder="ИМЯ СХЕМЫ" 
          @input="$emit('update:localEntityType', ($event.target as HTMLInputElement).value)" 
        />
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button v-if="isHistoryPreviewMode" class="btn-new btn-warning-outline text-xs" @click="$emit('exit-preview')">Вернуться к текущей</button>
      <button class="btn-new btn-danger-outline text-xs" @click="$emit('reset-changes')">Сбросить изменения</button>
      <button class="btn-new btn-outline-new text-xs" @click="$emit('open-preview')">ПРЕДПРОСМОТР</button>
      <button class="btn-new btn-outline-new text-xs" @click="$emit('open-json')">Схема</button>
      <button class="btn-new btn-primary text-xs" @click="$emit('save')">Сохранить</button>
      <button class="btn-new btn-outline-new p-1" title="История изменений" @click="$emit('toggle-history')">
        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 8l0 8"></path><path d="M9 18h6a2 2 0 0 0 2 -2v-5"></path><path d="M14 14l3 -3l3 3"></path></svg>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  localEntityType: string;
  isHistoryPreviewMode: boolean;
}>();

defineEmits<{
  (e: 'update:localEntityType', value: string): void;
  (e: 'exit-preview'): void;
  (e: 'reset-changes'): void;
  (e: 'open-preview'): void;
  (e: 'open-json'): void;
  (e: 'save'): void;
  (e: 'toggle-history'): void;
}>();
</script>
