<template>
  <div>
    <div class="ww-inspector-section-title">Стандарты оформления</div>
    <div
      v-for="profile in profiles"
      :key="profile.id"
      class="ww-inspector-profile-card"
      :class="{ 'is-active': activeProfileId === profile.id }"
      @click="$emit('switch-profile', profile.id)"
    >
      <div class="ww-inspector-profile-title">
        <span v-if="activeProfileId === profile.id">✓ </span>
        {{ profile.name }}
      </div>
      <div class="ww-inspector-profile-desc">{{ profile.description }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AcademicProfilesListProps, AcademicProfilesListEmits } from './AcademicProfilesList.model';
import type { DocumentProfile } from '../../../../services/document/profiles/types';

export type AcademicProfile = DocumentProfile;

defineProps<AcademicProfilesListProps>();

defineEmits<AcademicProfilesListEmits>();
</script>
