<script setup lang="ts">
import { Sparkles, X } from 'lucide-vue-next'
import Button from '~/components/ui/Button.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const suggestions = [
  'Show units with rising temperature drift in the last 7 days.',
  'Summarize regions with declining door activity.',
  'List unresolved mismatches that likely need technician follow-up.',
]
</script>

<template>
  <Teleport to="body">
    <div v-if="props.open" class="fixed inset-0 z-[60]">
      <div class="absolute inset-0 bg-slate-950/30" @click="emit('update:open', false)" />
      <aside class="absolute right-0 top-0 h-full w-full max-w-md border-l border-slate-200 bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div class="flex items-center gap-2">
            <Sparkles class="h-5 w-5 text-blue-600" />
            <h2 class="text-base font-semibold text-slate-900">AI Assistant</h2>
          </div>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            @click="emit('update:open', false)"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
        <div class="space-y-5 px-5 py-5">
          <div class="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p class="text-sm font-medium text-blue-900">Suggested prompts</p>
            <ul class="mt-3 space-y-2 text-sm text-blue-800">
              <li v-for="suggestion in suggestions" :key="suggestion">{{ suggestion }}</li>
            </ul>
          </div>
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-sm text-slate-600">
              This drawer is ready for a later assistant integration. The dashboard shell keeps the interaction point in place.
            </p>
          </div>
          <Button class="w-full" @click="emit('update:open', false)">Close</Button>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
