<script setup lang="ts">
import { Menu } from 'lucide-vue-next'
import UserMenu from '~/components/layout/UserMenu.vue'
import { useSidebar } from '~/composables/useSidebar'

// Global top app bar. Lives in the content column (right of the sidebar),
// so it intentionally does not repeat the Frostlink brand — the sidebar owns
// the logo. Left side carries only the mobile drawer trigger; right side the
// user/profile menu.
const { toggle } = useSidebar()
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
    <!-- Spacer keeps the user menu right-aligned on desktop where the
         hamburger is hidden. -->
    <span class="hidden lg:block" aria-hidden="true" />

    <UserMenu />
  </header>
</template>
