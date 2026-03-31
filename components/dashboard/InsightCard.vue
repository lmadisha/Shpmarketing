<script setup lang="ts">
import Card from '~/components/ui/Card.vue'

defineProps<{
  title: string
  description: string
  tone?: 'positive' | 'warning' | 'neutral'
  class?: string
}>()
</script>

<template>
  <Card
    :class="[
      tone === 'positive' ? 'border-emerald-200 bg-emerald-50' : '',
      tone === 'warning' ? 'border-amber-200 bg-amber-50' : '',
      tone === 'neutral' || !tone ? 'border-slate-200 bg-white' : '',
      $props.class,
    ]"
  >
    <div class="p-4">
      <h3 class="text-sm font-semibold text-slate-900">{{ title }}</h3>
      <p class="mt-2 text-sm leading-6 text-slate-600">{{ description }}</p>
    </div>
  </Card>
</template>
