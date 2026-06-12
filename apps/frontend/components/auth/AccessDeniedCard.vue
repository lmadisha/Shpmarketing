<script setup lang="ts">
import { ShieldAlert } from 'lucide-vue-next'
import Card from '~/components/ui/Card.vue'

defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <Card class="mx-auto max-w-2xl">
    <div class="p-8 text-center">
      <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
        <ShieldAlert class="h-7 w-7" />
      </div>
      <h2 class="text-xl font-semibold text-slate-900">{{ title }}</h2>
      <p class="mt-2 text-sm text-slate-600">{{ description }}</p>
    </div>
  </Card>
</template>
