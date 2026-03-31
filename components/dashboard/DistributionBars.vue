<script setup lang="ts">
type Item = {
  label: string
  value: number
  color?: string
}

const props = defineProps<{
  items: Item[]
}>()

const maxValue = computed(() => Math.max(...props.items.map((item) => item.value), 1))
</script>

<template>
  <div class="space-y-3">
    <div v-for="item in props.items" :key="item.label" class="space-y-1">
      <div class="flex items-center justify-between text-sm">
        <span class="text-slate-600">{{ item.label }}</span>
        <span class="font-medium text-slate-900">{{ item.value }}</span>
      </div>
      <div class="h-2 rounded-full bg-slate-100">
        <div
          class="h-2 rounded-full"
          :style="{
            width: `${(item.value / maxValue) * 100}%`,
            backgroundColor: item.color || '#2563eb',
          }"
        />
      </div>
    </div>
  </div>
</template>
