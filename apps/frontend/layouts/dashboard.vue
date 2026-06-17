<script setup lang="ts">
import Sidebar from '~/components/layout/Sidebar.vue'
import AppHeader from '~/components/layout/AppHeader.vue'
import AIAssistantDrawer from '~/components/dashboard/AIAssistantDrawer.vue'
import { useAiAssistant } from '~/composables/useAiAssistant'

const ai = useAiAssistant()
</script>

<template>
  <div class="flex h-screen bg-slate-50">
    <Sidebar />
    <div class="flex-1 flex flex-col overflow-hidden">
      <AppHeader />
      <main class="flex-1 overflow-auto relative">
        <slot />
      </main>
    </div>
    <AIAssistantDrawer :open="ai.isOpen.value" @update:open="ai.isOpen.value = $event" />
  </div>
</template>
