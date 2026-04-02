<script setup lang="ts">
import { Map, MapPin } from 'lucide-vue-next'
import FilterBar from '~/components/layout/FilterBar.vue'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Select from '~/components/ui/Select.vue'
import TierBadge from '~/components/dashboard/TierBadge.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const selectedRegion = ref<string | null>(null)
const provinceFilter = ref('')
const tierFilter = ref('')

const regionData = [
  { name: 'Western Cape', units: 187, doorOpens: 589234, tier: 'gold', x: '26%', y: '30%' },
  { name: 'Gauteng', units: 245, doorOpens: 768921, tier: 'gold', x: '58%', y: '28%' },
  { name: 'KwaZulu-Natal', units: 156, doorOpens: 412876, tier: 'silver', x: '68%', y: '54%' },
  { name: 'Eastern Cape', units: 89, doorOpens: 187654, tier: 'bronze', x: '44%', y: '60%' },
] as const
</script>

<template>
  <div>
    <FilterBar />
    <div class="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 lg:p-8">
      <div class="flex items-center gap-2">
        <Map class="h-8 w-8 text-[#006aea]" />
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">Regional Map Performance</h1>
          <p class="text-sm text-slate-600">Interactive regional summary of fleet activity and tier balance.</p>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-[0.9fr_1.5fr_0.8fr]">
        <Card>
          <div class="border-b border-slate-200 p-5">
            <h2 class="text-lg font-semibold text-slate-900">Filters</h2>
          </div>
          <div class="space-y-4 p-5">
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700">Province</label>
              <Select
                v-model="provinceFilter"
                :options="[
                  { value: '', label: 'All provinces' },
                  { value: 'western-cape', label: 'Western Cape' },
                  { value: 'gauteng', label: 'Gauteng' },
                  { value: 'kwazulu-natal', label: 'KwaZulu-Natal' },
                  { value: 'eastern-cape', label: 'Eastern Cape' },
                ]"
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700">Tier</label>
              <Select
                v-model="tierFilter"
                :options="[
                  { value: '', label: 'All tiers' },
                  { value: 'gold', label: 'Gold' },
                  { value: 'silver', label: 'Silver' },
                  { value: 'bronze', label: 'Bronze' },
                ]"
              />
            </div>
            <Button class="w-full">Apply Filters</Button>
          </div>
        </Card>

        <Card>
          <div class="border-b border-slate-200 p-5">
            <h2 class="text-lg font-semibold text-slate-900">Interactive Map</h2>
          </div>
          <div class="p-5">
            <div class="relative h-[520px] overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 via-sky-50 to-slate-100">
              <div
                v-for="region in regionData"
                :key="region.name"
                class="absolute cursor-pointer"
                :style="{ left: region.x, top: region.y }"
                @click="selectedRegion = region.name"
              >
                <div class="group relative">
                  <MapPin class="h-9 w-9 text-[#006aea] drop-shadow-lg" />
                  <div class="absolute left-1/2 top-full z-10 mt-2 hidden w-44 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl group-hover:block">
                    <p class="font-semibold text-slate-900">{{ region.name }}</p>
                    <p class="mt-1 text-slate-600">{{ region.units }} units</p>
                    <p class="text-slate-600">{{ region.doorOpens.toLocaleString() }} opens</p>
                  </div>
                </div>
              </div>
              <div class="absolute inset-x-0 bottom-6 text-center text-sm text-slate-500">
                Click a marker to open the regional drilldown.
              </div>
            </div>
            <div v-if="selectedRegion" class="mt-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div>
                <p class="font-medium text-blue-900">{{ selectedRegion }}</p>
                <p class="text-sm text-blue-700">Open the full regional breakdown.</p>
              </div>
              <Button as="a" :href="`/region/${selectedRegion.toLowerCase().replaceAll(' ', '-')}`">View Region</Button>
            </div>
          </div>
        </Card>

        <Card>
          <div class="border-b border-slate-200 p-5">
            <h2 class="text-lg font-semibold text-slate-900">Regional KPIs</h2>
          </div>
          <div class="space-y-4 p-5">
            <div>
              <p class="text-sm text-slate-500">Total Regions</p>
              <p class="mt-1 text-2xl font-semibold text-slate-900">4</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Total Units</p>
              <p class="mt-1 text-2xl font-semibold text-slate-900">677</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Total Door Opens</p>
              <p class="mt-1 text-2xl font-semibold text-slate-900">1.96M</p>
            </div>
            <div class="space-y-2 border-t border-slate-200 pt-4">
              <p class="text-sm font-semibold text-slate-900">Current leaders</p>
              <div v-for="region in regionData" :key="region.name" class="flex items-center justify-between">
                <span class="text-sm text-slate-700">{{ region.name }}</span>
                <TierBadge :tier="region.tier" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
