<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'
import Sidebar from '~/components/layout/Sidebar.vue'
import AIAssistantDrawer from '~/components/dashboard/AIAssistantDrawer.vue'
import Button from '~/components/ui/Button.vue'

const isDrawerOpen = ref(false);
</script>

<template>
  <div class="flex h-screen bg-slate-50">
    <Sidebar />
    <div class="flex-1 flex flex-col overflow-hidden">
      <header class="flex h-16 items-center justify-between border-b border-slate-200 bg-white pl-14 pr-4 lg:px-6">
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Frostlink</p>
          <h1 class="text-sm font-semibold text-slate-900 md:text-base">Operations Dashboard</h1>
        </div>
        <Button variant="outline" size="sm" @click="isDrawerOpen = true">
          <Sparkles class="h-4 w-4" />
          AI Assistant
        </Button>
      </header>
      <main class="flex-1 overflow-auto relative">
        <slot />
      </main>
    </div>
    <AIAssistantDrawer :open="isDrawerOpen" @update:open="isDrawerOpen = $event" />
  </div>
</template>
