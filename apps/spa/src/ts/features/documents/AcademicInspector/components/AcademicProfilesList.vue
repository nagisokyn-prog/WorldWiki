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
export interface AcademicProfile {
  id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

defineProps<{
  profiles: AcademicProfile[];
  activeProfileId: string;
}>();

defineEmits<{
  (e: 'switch-profile', id: string): void;
}>();
</script>
