<script setup lang="ts">
import { CalendarDays, Filter, Search } from 'lucide-vue-next'
import Input from '~/components/ui/Input.vue'

const dateRange = ref('30d')
const region = ref('all')
const tier = ref('all')
</script>

<template>
  <div v-if="false" class="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
          <CalendarDays class="h-4 w-4" />
          <select v-model="dateRange" class="bg-transparent outline-none">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
        <div class="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
          <Filter class="h-4 w-4" />
          <select v-model="region" class="bg-transparent outline-none">
            <option value="all">All regions</option>
            <option value="gauteng">Gauteng</option>
            <option value="western-cape">Western Cape</option>
            <option value="kwazulu-natal">KwaZulu-Natal</option>
          </select>
        </div>
        <div class="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
          <Filter class="h-4 w-4" />
          <select v-model="tier" class="bg-transparent outline-none">
            <option value="all">All tiers</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="bronze">Bronze</option>
          </select>
        </div>
      </div>
      <div class="relative w-full lg:ml-auto lg:max-w-md">
        <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input placeholder="Search by unit, C-number, or outlet" class="pl-9" />
      </div>
    </div>
  </div>
</template>
