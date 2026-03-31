<script setup lang="ts">
import Badge from '~/components/ui/Badge.vue'

defineProps<{
  tier: 'gold' | 'silver' | 'bronze' | 'insufficient'
}>()
</script>

<template>
  <Badge
    :class="{
      'bg-amber-100 text-amber-800': tier === 'gold',
      'bg-slate-200 text-slate-700': tier === 'silver',
      'bg-orange-100 text-orange-700': tier === 'bronze',
      'bg-slate-100 text-slate-500': tier === 'insufficient',
    }"
  >
    {{ tier }}
  </Badge>
</template>
