<template>
  <aside class="ww-inspector" aria-label="Инспектор документа">
    <nav class="ww-inspector-tabs" role="tablist">
      <button
        type="button"
        class="ww-inspector-tab-btn"
        :class="{ 'is-active': activeTab === 'toc' }"
        role="tab"
        title="Оглавление документа"
        @click="activeTab = 'toc'"
      >
        📑 Оглавление
      </button>
      <button
        type="button"
        class="ww-inspector-tab-btn"
        :class="{ 'is-active': activeTab === 'figures' }"
        role="tab"
        title="Список иллюстраций"
        @click="activeTab = 'figures'"
      >
        🖼️ Рисунки
      </button>
      <button
        type="button"
        class="ww-inspector-tab-btn"
        :class="{ 'is-active': activeTab === 'tables' }"
        role="tab"
        title="Список таблиц"
        @click="activeTab = 'tables'"
      >
        📊 Таблицы
      </button>
      <button
        type="button"
        class="ww-inspector-tab-btn"
        :class="{ 'is-active': activeTab === 'equations' }"
        role="tab"
        title="Формулы"
        @click="activeTab = 'equations'"
      >
        ∑ Формулы
      </button>
      <button
        type="button"
        class="ww-inspector-tab-btn"
        :class="{ 'is-active': activeTab === 'profiles' }"
        role="tab"
        title="Профиль оформления"
        @click="activeTab = 'profiles'"
      >
        ⚙️ Профиль
      </button>
    </nav>

    <div class="ww-inspector-body">
      <!-- 1. TOC Tab -->
      <section v-if="activeTab === 'toc'">
        <div class="ww-inspector-section-title">Содержание</div>
        <div v-if="headingsList.length === 0" class="ww-inspector-empty">
          Заголовки еще не добавлены
        </div>
        <ul v-else class="ww-inspector-list">
          <li
            v-for="h in headingsList"
            :key="h.id"
            class="ww-inspector-item"
            :style="{ paddingLeft: `${((h.level || 1) - 1) * 12 + 8}px` }"
          >
            <div class="ww-inspector-item-content" @click="jumpToNode(h.id)">
              <span class="ww-inspector-num">{{ h.number }}</span>
              <span class="ww-inspector-label" :title="h.title">{{ h.title }}</span>
            </div>
            <div class="ww-inspector-actions">
              <button
                type="button"
                class="ww-inspector-insert-btn"
                title="Вставить ссылку на этот раздел в текст"
                @click="insertReference(h)"
              >
                + Ссылка
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- 2. Figures Tab -->
      <section v-else-if="activeTab === 'figures'">
        <div class="ww-inspector-section-title">Иллюстрации</div>
        <div v-if="figuresList.length === 0" class="ww-inspector-empty">
          В документе нет рисунков
        </div>
        <ul v-else class="ww-inspector-list">
          <li v-for="fig in figuresList" :key="fig.id" class="ww-inspector-item">
            <div class="ww-inspector-item-content" @click="jumpToNode(fig.id)">
              <span class="ww-inspector-num">Рис. {{ fig.number }}</span>
              <span class="ww-inspector-label" :title="fig.title">{{ fig.title }}</span>
            </div>
            <div class="ww-inspector-actions">
              <button
                type="button"
                class="ww-inspector-insert-btn"
                title="Вставить ссылку на рисунок в текст"
                @click="insertReference(fig)"
              >
                + Ссылка
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- 3. Tables Tab -->
      <section v-else-if="activeTab === 'tables'">
        <div class="ww-inspector-section-title">Таблицы</div>
        <div v-if="tablesList.length === 0" class="ww-inspector-empty">
          В документе нет таблиц
        </div>
        <ul v-else class="ww-inspector-list">
          <li v-for="tbl in tablesList" :key="tbl.id" class="ww-inspector-item">
            <div class="ww-inspector-item-content" @click="jumpToNode(tbl.id)">
              <span class="ww-inspector-num">Табл. {{ tbl.number }}</span>
              <span class="ww-inspector-label" :title="tbl.title">{{ tbl.title }}</span>
            </div>
            <div class="ww-inspector-actions">
              <button
                type="button"
                class="ww-inspector-insert-btn"
                title="Вставить ссылку на таблицу в текст"
                @click="insertReference(tbl)"
              >
                + Ссылка
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- 4. Equations Tab -->
      <section v-else-if="activeTab === 'equations'">
        <div class="ww-inspector-section-title">Математические формулы</div>
        <div v-if="equationsList.length === 0" class="ww-inspector-empty">
          В документе нет вынесенных формул
        </div>
        <ul v-else class="ww-inspector-list">
          <li v-for="eq in equationsList" :key="eq.id" class="ww-inspector-item">
            <div class="ww-inspector-item-content" @click="jumpToNode(eq.id)">
              <span class="ww-inspector-num">({{ eq.number }})</span>
              <span class="ww-inspector-label" :title="eq.title">{{ eq.title }}</span>
            </div>
            <div class="ww-inspector-actions">
              <button
                type="button"
                class="ww-inspector-insert-btn"
                title="Вставить ссылку на формулу в текст"
                @click="insertReference(eq)"
              >
                + Ссылка
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- 5. Profiles Tab -->
      <section v-else-if="activeTab === 'profiles'">
        <div class="ww-inspector-section-title">Стандарты оформления</div>
        <div
          v-for="profile in allProfiles"
          :key="profile.id"
          class="ww-inspector-profile-card"
          :class="{ 'is-active': activeProfileId === profile.id }"
          @click="switchProfile(profile.id)"
        >
          <div class="ww-inspector-profile-title">
            <span v-if="activeProfileId === profile.id">✓ </span>
            {{ profile.name }}
          </div>
          <div class="ww-inspector-profile-desc">{{ profile.description }}</div>
        </div>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { AcademicInspectorProps } from './AcademicInspector.model';
import { useAcademicInspector } from './useAcademicInspector';

const props = defineProps<AcademicInspectorProps>();

const {
  activeTab,
  headingsList,
  figuresList,
  tablesList,
  equationsList,
  activeProfileId,
  allProfiles,
  jumpToNode,
  insertReference,
  switchProfile
} = useAcademicInspector(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/documents/AcademicInspector.css"></style>
