<template>
  <Teleport to="body">
    <Transition name="cp-fade">
      <div v-if="isOpen" class="cp-overlay" @click.self="close">
        <div class="cp-modal" role="dialog" aria-label="Command Palette">
          <!-- Input -->
          <div class="cp-input-wrap">
            <i class="fas fa-terminal cp-icon"></i>
            <input
              ref="inputRef"
              v-model="query"
              class="cp-input"
              placeholder="Type a command..."
              @keydown.down.prevent="moveDown"
              @keydown.up.prevent="moveUp"
              @keydown.enter.prevent="runActive"
              @keydown.escape.prevent="close"
            />
            <span class="cp-hint-tag">⌘⇧P</span>
          </div>

          <!-- Results -->
          <div ref="resultsRef" class="cp-results">
            <template v-if="filtered.length > 0">
              <div
                v-for="(cmd, idx) in filtered"
                :key="cmd.id"
                class="cp-item"
                :class="{ active: idx === activeIdx }"
                @click="runCmd(cmd)"
                @mousemove="activeIdx = idx"
              >
                <span class="cp-item-icon">{{ cmd.icon }}</span>
                <div class="cp-item-body">
                  <HighlightText :text="cmd.title" :query="query" class="cp-item-title" />
                  <span class="cp-item-desc">{{ cmd.desc }}</span>
                </div>
                <kbd v-if="cmd.hotkey" class="cp-kbd">{{ cmd.hotkey }}</kbd>
                <kbd v-if="idx === activeIdx" class="cp-enter-hint">↵</kbd>
              </div>
            </template>
            <div v-else class="cp-empty">No command found</div>
          </div>

          <!-- Footer -->
          <div class="cp-footer">
            <span><kbd>↑↓</kbd> select</span>
            <span><kbd>↵</kbd> run</span>
            <span><kbd>Esc</kbd> close</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import HighlightText from './HighlightText.vue';
import { 
  useCommandPalette, 
  type CommandPaletteProps, 
  type CommandPaletteEmits, 
  type PaletteCommand 
} from './useCommandPalette';

export type { PaletteCommand };

const props = defineProps<CommandPaletteProps>();
const emit = defineEmits<CommandPaletteEmits>();

const {
  isOpen,
  query,
  activeIdx,
  inputRef,
  resultsRef,
  filtered,
  open,
  close,
  moveDown,
  moveUp,
  runCmd,
  runActive
} = useCommandPalette(props, emit);

defineExpose({ open, close });
</script>

<style scoped src="@worldwiki/resources/styles/components/CommandPalette.css"></style>
