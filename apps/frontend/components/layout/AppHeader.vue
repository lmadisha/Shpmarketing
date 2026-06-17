<script setup lang="ts">
import { Menu, Sparkles } from 'lucide-vue-next'
import UserMenu from '~/components/layout/UserMenu.vue'
import { useSidebar } from '~/composables/useSidebar'
import { useAiAssistant } from '~/composables/useAiAssistant'

// Global top app bar. Lives in the content column (right of the sidebar),
// so it intentionally does not repeat the Frostlink brand — the sidebar owns
// the logo. Left side carries only the mobile drawer trigger; right side the
// AI Assistant trigger and the user/profile menu.
const { toggle } = useSidebar()
const ai = useAiAssistant()
</script>

<template>
  <header
    class="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6"
  >
    <button
      type="button"
      class="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 lg:hidden"
      aria-label="Open navigation"
      @click="toggle"
    >
      <Menu class="h-5 w-5" />
    </button>
    <!-- Spacer keeps the right cluster right-aligned on desktop where the
         hamburger is hidden. -->
    <span class="hidden lg:block" aria-hidden="true" />

    <div class="flex items-center gap-1.5">
      <button
        type="button"
        class="flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
        aria-label="Open AI Assistant"
        @click="ai.open()"
      >
        <Sparkles class="h-4 w-4 shrink-0 text-[#006aea]" />
        <span class="hidden sm:inline">AI Assistant</span>
      </button>
      <UserMenu />
    </div>
  </header>
</template>
