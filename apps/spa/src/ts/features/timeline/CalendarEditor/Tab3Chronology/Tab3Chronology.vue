<template>
  <div class="tab3-chronology">
    <!-- Секция: Точка отсчета календаря -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">⏳ Точка отсчета календаря</div>
          <div class="section-desc">Начальная дата (Origin) для вычисления абсолютного времени M_abs.</div>
        </div>
      </header>
      <div class="grid-4">
        <div class="form-group">
          <label class="form-label">Эпоха (индекс)</label>
          <input
            type="number"
            class="form-input"
            :value="origin.эпоха"
            :disabled="isReadOnly"
            @input="updateOrigin({ эпоха: parseInt(($event.target as HTMLInputElement).value) || 0 })"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Год</label>
          <input
            type="number"
            class="form-input"
            :value="origin.год"
            :disabled="isReadOnly"
            @input="updateOrigin({ год: parseInt(($event.target as HTMLInputElement).value) || 1 })"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Месяц (индекс)</label>
          <input
            type="number"
            class="form-input"
            :value="origin.месяц"
            :disabled="isReadOnly"
            @input="updateOrigin({ месяц: parseInt(($event.target as HTMLInputElement).value) || 0 })"
          />
        </div>
        <div class="form-group">
          <label class="form-label">День</label>
          <input
            type="number"
            class="form-input"
            :value="origin.день"
            :disabled="isReadOnly"
            @input="updateOrigin({ день: parseInt(($event.target as HTMLInputElement).value) || 1 })"
          />
        </div>
      </div>
    </section>

    <!-- Секция: Эпохи летоисчисления -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">🏛️ Эпохи летоисчисления</div>
          <div class="section-desc">Исторические периоды и границы эпох.</div>
        </div>
        <button v-if="!isReadOnly" type="button" class="btn-ghost-sm" @click="addEra">+ Эпоха</button>
      </header>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th>Название</th>
            <th style="width: 120px;">Начало</th>
            <th style="width: 120px;">Конец</th>
            <th style="width: 50px;"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(era, idx) in eras" :key="idx">
            <td>{{ idx + 1 }}</td>
            <td>
              <input
                type="text"
                class="table-input"
                :value="era.название"
                :disabled="isReadOnly"
                @input="era.название = ($event.target as HTMLInputElement).value; updateEras([...eras])"
              />
            </td>
            <td>
              <input
                type="number"
                class="table-input"
                :value="era.год_начала"
                :disabled="isReadOnly"
                @input="era.год_начала = parseInt(($event.target as HTMLInputElement).value) || 1; updateEras([...eras])"
              />
            </td>
            <td>
              <input
                type="number"
                class="table-input"
                :value="era.год_конца"
                :disabled="isReadOnly"
                @input="era.год_конца = parseInt(($event.target as HTMLInputElement).value) || 0; updateEras([...eras])"
              />
            </td>
            <td>
              <button
                v-if="!isReadOnly"
                type="button"
                class="btn-icon-table"
                title="Удалить эпоху"
                @click="removeEra(idx)"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Tab3ChronologyProps, Tab3ChronologyEmits } from './Tab3Chronology.model';
import { useTab3Chronology } from './useTab3Chronology';

const props = defineProps<Tab3ChronologyProps>();
const emit = defineEmits<Tab3ChronologyEmits>();

const {
  eras,
  origin,
  updateEras,
  updateOrigin,
  addEra,
  removeEra,
} = useTab3Chronology(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/Tab3Chronology.css"></style>
