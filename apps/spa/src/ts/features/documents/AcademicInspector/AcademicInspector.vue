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
        <AcademicItemList
          section-title="Содержание"
          empty-message="Заголовки еще не добавлены"
          :items="headingsList"
          @jump="jumpToNode"
          @insert="insertReference"
        />
      </section>

      <!-- 2. Figures Tab -->
      <section v-else-if="activeTab === 'figures'">
        <AcademicItemList
          section-title="Иллюстрации"
          empty-message="В документе нет рисунков"
          :items="figuresList"
          :format-number="(num?: string | number) => `Рис. ${num ?? ''}`"
          @jump="jumpToNode"
          @insert="insertReference"
        />
      </section>

      <!-- 3. Tables Tab -->
      <section v-else-if="activeTab === 'tables'">
        <AcademicItemList
          section-title="Таблицы"
          empty-message="В документе нет таблиц"
          :items="tablesList"
          :format-number="(num?: string | number) => `Табл. ${num ?? ''}`"
          @jump="jumpToNode"
          @insert="insertReference"
        />
      </section>

      <!-- 4. Equations Tab -->
      <section v-else-if="activeTab === 'equations'">
        <AcademicItemList
          section-title="Математические формулы"
          empty-message="В документе нет вынесенных формул"
          :items="equationsList"
          :format-number="(num?: string | number) => `(${num ?? ''})`"
          @jump="jumpToNode"
          @insert="insertReference"
        />
      </section>

      <!-- 5. Profiles Tab -->
      <section v-else-if="activeTab === 'profiles'">
        <AcademicProfilesList
          :profiles="allProfiles"
          :active-profile-id="activeProfileId"
          @switch-profile="switchProfile"
        />
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { AcademicInspectorProps } from './AcademicInspector.model';
import { useAcademicInspector } from './useAcademicInspector';
import AcademicItemList from './components/AcademicItemList.vue';
import AcademicProfilesList from './components/AcademicProfilesList.vue';

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
  switchProfile,
} = useAcademicInspector(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/documents/AcademicInspector.css"></style>
