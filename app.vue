<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore();

// Ensure auth is hydrated before any page renders.
// Since ssr: false, this runs on the client before NuxtPage is shown.
await callOnce(() => {
  authStore.hydrateFromStorage();
});
</script>

<template>
  <NuxtPage />
</template>
