<template>
  <div class="planet-editor">
    <!-- Dashboard карточка планеты -->
    <div class="dashboard-banner">
      <div class="dashboard-left">
        <div class="dashboard-title-row">
          <span class="dashboard-icon" id="planet-icon">{{ planet.icon || '🪐' }}</span>
          <input
            v-model="planet.name"
            type="text"
            class="dashboard-title-input"
            id="planet-name-input"
            placeholder="Название планеты"
            :disabled="isReadOnly"
          />
        </div>
        <div class="dashboard-tags">
          <span class="status-chip success">
            🌍 Сутки: <strong>{{ planet.day_hours }}ч {{ planet.day_minutes }}м</strong> ({{ planet.ticks_per_day }} тиков)
          </span>
          <span class="status-chip success">
            🪐 Орбита: <strong>{{ planet.orbit_days }} сут.</strong>
          </span>
          <span class="status-chip">
            📐 Наклон: <strong>{{ decimalAxialTilt }}°</strong>
          </span>
          <span class="status-chip warning">
            🌕 Лун: <strong>{{ planet.moons.length }}</strong>
          </span>
        </div>
      </div>

      <div class="dashboard-actions">
        <button
          type="button"
          class="btn-action btn-primary"
          :disabled="isReadOnly || isSaving"
          title="Сохранить планету"
          @click="savePlanet"
        >
          {{ isSaving ? '💾 Сохранение...' : '💾 Сохранить' }}
        </button>
        <button
          v-if="!isReadOnly && planet.id"
          type="button"
          class="btn-action btn-danger"
          title="Удалить планету"
          @click="deletePlanet"
        >
          🗑️
        </button>
      </div>
    </div>

    <!-- Сообщение об ошибке, если есть -->
    <div v-if="errorMessage" class="error-banner mb-3 p-2 text-xs rounded text-danger">
      ⚠️ {{ errorMessage }}
    </div>

    <!-- Горизонтальная таб-навигация планеты -->
    <nav class="tab-nav-bar" role="tablist">
      <button
        type="button"
        class="tab-button"
        :class="{ active: activeTab === 'astrophysics' }"
        role="tab"
        :aria-selected="activeTab === 'astrophysics'"
        @click="setTab('astrophysics')"
      >
        <span>🪐 1. Астрофизика & Орбита</span>
        <span class="tab-badge">{{ planet.orbit_days }} дн</span>
      </button>

      <button
        type="button"
        class="tab-button"
        :class="{ active: activeTab === 'timezones' }"
        role="tab"
        :aria-selected="activeTab === 'timezones'"
        @click="setTab('timezones')"
      >
        <span>🌍 2. Пояса и Регионы</span>
        <span class="tab-badge">{{ planet.timezones.length }} поясов</span>
      </button>

      <button
        type="button"
        class="tab-button"
        :class="{ active: activeTab === 'moons' }"
        role="tab"
        :aria-selected="activeTab === 'moons'"
        @click="setTab('moons')"
      >
        <span>🌕 3. Спутники и Луны</span>
        <span class="tab-badge">{{ planet.moons.length }} лун</span>
      </button>
    </nav>

    <!-- ТАБ 1 ПЛАНЕТЫ: АСТРОФИЗИКА -->
    <div v-if="activeTab === 'astrophysics'" class="tab-pane active" id="planet-tab-astrophysics">
      <div class="section-card">
        <div class="section-header">
          <div class="section-title">🪐 Фундаментальные физические параметры планеты</div>
          <span class="status-chip success">
            {{ planet.rotation_direction === 'direct' ? 'Прямое вращение' : 'Ретроградное вращение' }}
          </span>
        </div>

        <div class="grid-4">
          <div class="form-group">
            <label class="form-label">Длительность суток (часы / мин / сек)</label>
            <div class="flex gap-1 items-center">
              <input
                v-model.number="planet.day_hours"
                type="number"
                class="form-input w-16"
                min="0"
                :disabled="isReadOnly"
                @input="updateDayTicks"
              /> ч
              <input
                v-model.number="planet.day_minutes"
                type="number"
                class="form-input w-14"
                min="0"
                max="59"
                :disabled="isReadOnly"
                @input="updateDayTicks"
              /> м
              <input
                v-model.number="planet.day_seconds"
                type="number"
                class="form-input w-14"
                min="0"
                max="59"
                :disabled="isReadOnly"
                @input="updateDayTicks"
              /> с
            </div>
            <span class="text-xs text-muted mt-1 block">Квант суток: {{ planet.ticks_per_day }} тиков</span>
          </div>

          <div class="form-group">
            <label class="form-label">Тропический год (дробь орбиты)</label>
            <div class="flex gap-1 items-center">
              <input
                v-model.number="planet.orbit_days_num"
                type="number"
                class="form-input w-24"
                title="Числитель (тиков/дней)"
                :disabled="isReadOnly"
                @input="updateOrbitFromFraction"
              />
              <span>/</span>
              <input
                v-model.number="planet.orbit_days_den"
                type="number"
                class="form-input w-20"
                min="1"
                title="Знаменатель"
                :disabled="isReadOnly"
                @input="updateOrbitFromFraction"
              />
            </div>
            <span class="text-xs text-muted mt-1 block">= {{ planet.orbit_days }} суток</span>
          </div>

          <div class="form-group">
            <label class="form-label">Наклон оси вращения (°)</label>
            <input
              v-model.number="decimalAxialTilt"
              type="number"
              step="0.01"
              class="form-input"
              :disabled="isReadOnly"
            />
            <span class="text-xs text-muted mt-1 block">{{ planet.axial_tilt_mdeg }} миллиградусов</span>
          </div>

          <div class="form-group">
            <label class="form-label">Направление вращения</label>
            <select
              v-model="planet.rotation_direction"
              class="form-select"
              :disabled="isReadOnly"
            >
              <option value="direct">Прямое (Восход на востоке)</option>
              <option value="retrograde">Ретроградное (Восход на западе)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Астрономические точки года -->
      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">❄️☀️ Астрономические точки года и солнцестояния</div>
            <div class="section-desc">
              Рассчитываются автоматически по орбите планеты. Наклон оси: {{ decimalAxialTilt }}°
            </div>
          </div>
          <button
            type="button"
            class="btn-ghost-sm interactive-el"
            @click="recalculateAstroPoints"
          >
            🧮 Пересчитать точки
          </button>
        </div>

        <div class="astro-cards-grid">
          <div class="astro-card">
            <span class="astro-label">🌸 Весеннее равноденствие</span>
            <span class="astro-val">{{ planet.solstices.spring }} сут.</span>
          </div>
          <div class="astro-card">
            <span class="astro-label">☀️ Летнее солнцестояние</span>
            <span class="astro-val">{{ planet.solstices.summer }} сут.</span>
          </div>
          <div class="astro-card">
            <span class="astro-label">🍂 Осеннее равноденствие</span>
            <span class="astro-val">{{ planet.solstices.autumn }} сут.</span>
          </div>
          <div class="astro-card">
            <span class="astro-label">❄️ Зимнее солнцестояние</span>
            <span class="astro-val">{{ planet.solstices.winter }} сут.</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ТАБ 2 ПЛАНЕТЫ: ПОЯСА И ГОРОДА -->
    <div v-else-if="activeTab === 'timezones'" class="tab-pane active" id="planet-tab-timezones-regions">
      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">🌍 Часовые пояса планеты</div>
            <div class="section-desc">Сетка часовых поясов мира относительно нулевого меридиана.</div>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="btn-ghost-sm interactive-el"
              @click="applyTimezonePreset('earth24')"
            >
              🌐 Стандарт (24 пояса)
            </button>
            <button
              type="button"
              class="btn-ghost-sm interactive-el"
              @click="applyTimezonePreset('single')"
            >
              0️⃣ Только меридиан
            </button>
          </div>
        </div>

        <table class="items-table mb-3">
          <thead>
            <tr>
              <th>Название часового пояса</th>
              <th class="w-32">Код</th>
              <th class="w-40">Смещение (ч)</th>
              <th class="w-40">☀️ Летнее время (DST)</th>
              <th class="w-12"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(tz, idx) in planet.timezones" :key="idx">
              <td><input v-model="tz.name" type="text" class="table-input" :disabled="isReadOnly" /></td>
              <td><input v-model="tz.code" type="text" class="table-input font-semibold" :disabled="isReadOnly" /></td>
              <td>
                <div class="flex items-center gap-1">
                  <input v-model.number="tz.offset_hours" type="number" step="0.5" class="table-input w-20" :disabled="isReadOnly" />
                  <span class="text-xs text-muted">ч</span>
                </div>
              </td>
              <td>
                <select v-model="tz.dst_rule" class="form-select text-xs py-1" :disabled="isReadOnly">
                  <option value="none">🚫 Без перевода (None)</option>
                  <option value="eu">🇪🇺 EU (+60м)</option>
                  <option value="us">🇺🇸 US (+60м)</option>
                </select>
              </td>
              <td>
                <button
                  v-if="!isReadOnly"
                  type="button"
                  class="btn-icon-table"
                  title="Удалить пояс"
                  @click="removeTimezone(idx)"
                >
                  🗑️
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <button
          v-if="!isReadOnly"
          type="button"
          class="btn-ghost-sm interactive-el"
          @click="addTimezone()"
        >
          ➕ Добавить часовой пояс
        </button>
      </div>

      <!-- Географические регионы и города -->
      <div class="section-card">
        <div class="section-header">
          <div class="section-title">🗺️ Географические регионы, города и световой день</div>
          <button
            v-if="!isReadOnly"
            type="button"
            class="btn-ghost-sm interactive-el"
            @click="addRegion()"
          >
            + Добавить регион
          </button>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Город / Регион</th>
              <th class="w-32">Часовой пояс</th>
              <th class="w-24">Широта (°)</th>
              <th class="w-24">Долгота (°)</th>
              <th class="w-36">☀️ Макс. день (лето)</th>
              <th class="w-36">❄️ Мин. день (зима)</th>
              <th class="w-12"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(reg, idx) in planet.regions" :key="idx">
              <td><input v-model="reg.name" type="text" class="table-input" :disabled="isReadOnly" /></td>
              <td>
                <select v-model="reg.timezone_code" class="form-select text-xs py-1" :disabled="isReadOnly">
                  <option v-for="tz in planet.timezones" :key="tz.code" :value="tz.code">{{ tz.code }}</option>
                </select>
              </td>
              <td><input v-model.number="reg.latitude" type="number" step="0.1" class="table-input" :disabled="isReadOnly" /></td>
              <td><input v-model.number="reg.longitude" type="number" step="0.1" class="table-input" :disabled="isReadOnly" /></td>
              <td><strong>{{ reg.max_day_hours || '12ч 00м' }}</strong></td>
              <td><strong>{{ reg.min_day_hours || '12ч 00м' }}</strong></td>
              <td>
                <button
                  v-if="!isReadOnly"
                  type="button"
                  class="btn-icon-table"
                  title="Удалить регион"
                  @click="removeRegion(idx)"
                >
                  🗑️
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ТАБ 3 ПЛАНЕТЫ: СПУТНИКИ И ЛУНЫ -->
    <div v-else-if="activeTab === 'moons'" class="tab-pane active" id="planet-tab-moons">
      <div class="section-card">
        <div class="section-header">
          <div class="section-title">🌕 Естественные спутники планеты (Физические орбиты)</div>
          <button
            v-if="!isReadOnly"
            type="button"
            class="btn-ghost-sm interactive-el"
            @click="addMoon()"
          >
            + Добавить луну
          </button>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Имя спутника</th>
              <th class="w-48">Орбитальный период (суток)</th>
              <th class="w-48">Стартовая фаза (0-1)</th>
              <th class="w-12"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(moon, idx) in planet.moons" :key="idx">
              <td><input v-model="moon.name" type="text" class="table-input" :disabled="isReadOnly" /></td>
              <td><input v-model.number="moon.orbital_period" type="number" step="0.01" class="table-input" :disabled="isReadOnly" /></td>
              <td><input v-model.number="moon.start_phase" type="number" step="0.05" min="0" max="1" class="table-input" :disabled="isReadOnly" /></td>
              <td>
                <button
                  v-if="!isReadOnly"
                  type="button"
                  class="btn-icon-table"
                  title="Удалить луну"
                  @click="removeMoon(idx)"
                >
                  🗑️
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlanetEditorProps, PlanetEditorEmits } from './PlanetEditor.model';
import { usePlanetEditor } from './usePlanetEditor';

const props = defineProps<PlanetEditorProps>();
const emit = defineEmits<PlanetEditorEmits>();

const {
  activeTab,
  planet,
  decimalAxialTilt,
  isSaving,
  errorMessage,
  setTab,
  updateDayTicks,
  updateOrbitFromFraction,
  recalculateAstroPoints,
  addTimezone,
  removeTimezone,
  applyTimezonePreset,
  addRegion,
  removeRegion,
  addMoon,
  removeMoon,
  savePlanet,
  deletePlanet,
} = usePlanetEditor(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/PlanetEditor.css"></style>
