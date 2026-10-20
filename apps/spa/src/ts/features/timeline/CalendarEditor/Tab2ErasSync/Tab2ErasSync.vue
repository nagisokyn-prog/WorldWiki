<template>
  <div class="tab2-eras-sync">
    <!-- СЕКЦИЯ 1: ПРИВЯЗКА ЛЕТОИСЧИСЛЕНИЯ (СИНХРОНИЗАЦИЯ С МИРОМ) -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">🔗 Привязка летоисчисления (Синхронизация с миром)</div>
          <div class="section-desc">
            Согласование шкалы времени этой культуры с абсолютной осью континуума (M_abs) или Мастер-календарем.
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="isMaster" class="status-chip warning">🌟 Мастер-календарь мира</span>
          <span v-else class="status-chip success">🔗 Привязан к Мастеру</span>
        </div>
      </header>

      <div class="grid-2 mb-3">
        <div class="form-group">
          <label class="form-label">Статус мастер-календаря проекта</label>
          <label class="flex items-center gap-2 text-sm cursor-pointer mt-1">
            <input
              type="checkbox"
              :checked="isMaster"
              :disabled="isReadOnly"
              @change="toggleMasterStatus(($event.target as HTMLInputElement).checked)"
            />
            <span>Сделать этот календарь Мастером (Мировым стандартом времени)</span>
          </label>
        </div>

        <div class="form-group">
          <label class="form-label">Культурный сдвиг (Δ_offset относительно Мастера)</label>
          <div class="flex items-center gap-2 mt-1">
            <span class="status-chip font-mono text-sm">
              {{ culturalOffsetDelta >= 0 ? `+${culturalOffsetDelta}` : culturalOffsetDelta }} мин
            </span>
            <span class="text-xs text-muted">{{ offsetDescription }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- СЕКЦИЯ 2: ЭПОХИ И ЭРЫ КАЛЕНДАРЯ -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">🏛️ Эпохи и Эры календаря</div>
          <div class="section-desc">Названия эпох, границы лет и направление счета времени.</div>
        </div>
        <button
          v-if="!isReadOnly"
          type="button"
          class="btn-ghost-sm"
          @click="addEra"
        >
          ➕ Добавить эпоху
        </button>
      </header>

      <table class="items-table">
        <thead>
          <tr>
            <th class="w-10">#</th>
            <th>Название эпохи</th>
            <th class="w-28">Начало</th>
            <th class="w-28">Конец</th>
            <th class="w-24">Суффикс</th>
            <th class="w-36">Направление</th>
            <th class="w-12"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(era, idx) in eras" :key="idx">
            <td>{{ idx + 1 }}</td>
            <td>
              <input
                v-model="era.название"
                type="text"
                class="table-input"
                :disabled="isReadOnly"
                @input="updateEras([...eras])"
              />
            </td>
            <td>
              <input
                v-model.number="era.год_начала"
                type="number"
                class="table-input"
                :disabled="isReadOnly"
                @input="updateEras([...eras])"
              />
            </td>
            <td>
              <input
                v-model.number="era.год_конца"
                type="number"
                class="table-input"
                :disabled="isReadOnly"
                @input="updateEras([...eras])"
              />
            </td>
            <td>
              <input
                v-model="era.суффикс"
                type="text"
                class="table-input"
                placeholder="н.э."
                :disabled="isReadOnly"
                @input="updateEras([...eras])"
              />
            </td>
            <td>
              <select
                :value="era.обратный_отсчет ? 'down' : 'up'"
                class="form-select text-xs py-1"
                :disabled="isReadOnly"
                @change="era.обратный_отсчет = ($event.target as HTMLSelectElement).value === 'down'; updateEras([...eras])"
              >
                <option value="up">Прямой (н.э.)</option>
                <option value="down">Обратный (до н.э.)</option>
              </select>
            </td>
            <td>
              <button
                v-if="!isReadOnly && eras.length > 1"
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

    <!-- СЕКЦИЯ 3: ОПОРНЫЕ ИСТОРИЧЕСКИЕ ВЕХИ (ANCHOR EVENTS) -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">⚔️ Опорные исторические события мира (Вехи)</div>
          <div class="section-desc">Ключевые исторические вехи, зафиксированные в летоисчислении этой культуры.</div>
        </div>
        <button
          v-if="!isReadOnly"
          type="button"
          class="btn-ghost-sm"
          @click="addAnchorEvent"
        >
          ➕ Добавить веху
        </button>
      </header>

      <table class="items-table">
        <thead>
          <tr>
            <th>Название события</th>
            <th class="w-24">Год</th>
            <th class="w-20">Месяц</th>
            <th class="w-20">День</th>
            <th>Описание лора</th>
            <th class="w-12"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(ev, idx) in anchorEvents" :key="idx">
            <td>
              <input
                v-model="ev.name"
                type="text"
                class="table-input font-medium"
                :disabled="isReadOnly"
                @input="updateAnchorEvents([...anchorEvents])"
              />
            </td>
            <td>
              <input
                v-model.number="ev.year"
                type="number"
                class="table-input"
                :disabled="isReadOnly"
                @input="updateAnchorEvents([...anchorEvents])"
              />
            </td>
            <td>
              <input
                v-model.number="ev.month"
                type="number"
                class="table-input"
                min="0"
                :disabled="isReadOnly"
                @input="updateAnchorEvents([...anchorEvents])"
              />
            </td>
            <td>
              <input
                v-model.number="ev.day"
                type="number"
                class="table-input"
                min="1"
                :disabled="isReadOnly"
                @input="updateAnchorEvents([...anchorEvents])"
              />
            </td>
            <td>
              <input
                v-model="ev.description"
                type="text"
                class="table-input"
                placeholder="Контекст в истории мира..."
                :disabled="isReadOnly"
                @input="updateAnchorEvents([...anchorEvents])"
              />
            </td>
            <td>
              <button
                v-if="!isReadOnly"
                type="button"
                class="btn-icon-table"
                title="Удалить веху"
                @click="removeAnchorEvent(idx)"
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
import type { Tab2ErasSyncProps, Tab2ErasSyncEmits } from './Tab2ErasSync.model';
import { useTab2ErasSync } from './useTab2ErasSync';

const props = defineProps<Tab2ErasSyncProps>();
const emit = defineEmits<Tab2ErasSyncEmits>();

const {
  isMaster,
  eras,
  anchorEvents,
  culturalOffsetDelta,
  offsetDescription,
  updateEras,
  addEra,
  removeEra,
  updateAnchorEvents,
  addAnchorEvent,
  removeAnchorEvent,
  toggleMasterStatus,
} = useTab2ErasSync(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarEditor.css"></style>
