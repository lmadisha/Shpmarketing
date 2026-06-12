<script setup lang="ts">
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import FilterBar from '~/components/layout/FilterBar.vue'
import MetricCard from '~/components/dashboard/MetricCard.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const opportunities = [
  { from: 'KwaZulu-Natal Rural', to: 'Cape Town Waterfront', units: 4, expectedLift: '12%' },
  { from: 'Eastern Cape Inland', to: 'Johannesburg CBD', units: 6, expectedLift: '18%' },
  { from: 'Pretoria North', to: 'Durban North', units: 3, expectedLift: '9%' },
] as const
</script>

<template>
  <div>
    <FilterBar />
    <div class="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">Redistribution</h1>
        <p class="mt-1 text-sm text-slate-600">Suggested fleet moves based on demand, uptime, and tier drift.</p>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <MetricCard title="Open Opportunities" value="8" />
        <MetricCard title="Expected Revenue Lift" value="+14.2%" />
        <MetricCard title="Units Under Review" value="21" />
      </div>

      <Card>
        <div class="flex items-center justify-between border-b border-slate-200 p-5">
          <h2 class="text-lg font-semibold text-slate-900">Recommended Moves</h2>
          <Button>Export Recommendations</Button>
        </div>
        <div class="divide-y divide-slate-200">
          <div v-for="row in opportunities" :key="`${row.from}-${row.to}`" class="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="font-medium text-slate-900">{{ row.from }} → {{ row.to }}</p>
              <p class="text-sm text-slate-500">{{ row.units }} units proposed for movement</p>
            </div>
            <div class="flex items-center gap-3">
              <Badge variant="success">Expected lift {{ row.expectedLift }}</Badge>
              <Button size="sm" variant="outline">Review</Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
