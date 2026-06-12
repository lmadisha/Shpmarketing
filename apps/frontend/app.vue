<script setup lang="ts">
import tabLogo from "~/assets/css/img/FrostLinkLogoSymbol.svg?url";

useHead({
  link: [
    { rel: "icon", type: "image/svg+xml", href: tabLogo },
    { rel: "shortcut icon", href: tabLogo },
  ],
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
