<script setup lang="ts">
import FilterBar from '~/components/layout/FilterBar.vue'
import Card from '~/components/ui/Card.vue'
import Badge from '~/components/ui/Badge.vue'
import MetricCard from '~/components/dashboard/MetricCard.vue'
import InsightCard from '~/components/dashboard/InsightCard.vue'
import TrendChart from '~/components/dashboard/TrendChart.vue'
import DistributionBars from '~/components/dashboard/DistributionBars.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const doorOpensData = [
  { label: 'Feb 3', value: 12450 },
  { label: 'Feb 10', value: 13200 },
  { label: 'Feb 17', value: 14100 },
  { label: 'Feb 24', value: 15300 },
  { label: 'Mar 2', value: 16800 },
]

const dayOfWeekData = [
  { label: 'Mon', value: 2100, color: '#93c5fd' },
  { label: 'Tue', value: 2300, color: '#60a5fa' },
  { label: 'Wed', value: 2400, color: '#3b82f6' },
  { label: 'Thu', value: 2800, color: '#2563eb' },
  { label: 'Fri', value: 3500, color: '#1d4ed8' },
  { label: 'Sat', value: 4200, color: '#1e40af' },
  { label: 'Sun', value: 3900, color: '#1e3a8a' },
]

const tierDistributionData = [
  { label: 'Gold', value: 156, color: '#f59e0b' },
  { label: 'Silver', value: 234, color: '#94a3b8' },
  { label: 'Bronze', value: 189, color: '#f97316' },
  { label: 'Insufficient', value: 45, color: '#e2e8f0' },
]
</script>

<template>
  <div>
    <FilterBar />
    <div class="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 lg:p-8">
      <Card class="border-blue-200 bg-blue-50">
        <div class="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">What changed since your last visit</h2>
            <ul class="mt-3 space-y-1 text-sm text-slate-700">
              <li>12 units moved from Bronze to Silver tier.</li>
              <li>3 units flagged with voltage risk in KwaZulu-Natal.</li>
              <li>Weekend performance is up 18%, strongest in Q1.</li>
              <li>Temperature compliance improved to 94.5%.</li>
            </ul>
          </div>
          <Badge variant="outline">Last visit: Feb 27</Badge>
        </div>
      </Card>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Units" value="624" subtitle="Tracked fleet" :change="2.4" />
        <MetricCard title="Door Opens (30d)" value="487.2K" subtitle="Across all outlets" :change="12.5" />
        <MetricCard title="Temp Compliance" value="94.5%" subtitle="Within target range" :change="2.3" />
        <MetricCard title="Voltage Risk Units" value="18" subtitle="Requires follow-up" :change="-25" />
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <InsightCard
          tone="positive"
          title="12 units promoted to Silver"
          description="Sustained activity growth in Gauteng pushed several stores above the promotion threshold."
        />
        <InsightCard
          tone="positive"
          title="5 units promoted to Gold"
          description="Western Cape coastal outlets continue to outperform the network average."
        />
        <InsightCard
          tone="warning"
          title="7 units fell to Bronze"
          description="Rural demand softened and several of these sites are candidates for redistribution."
        />
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <Card>
          <div class="border-b border-slate-200 p-5">
            <h3 class="text-lg font-semibold text-slate-900">Door Opens Trend</h3>
          </div>
          <div class="p-5">
            <TrendChart :points="doorOpensData" color="#2563eb" />
          </div>
        </Card>

        <Card>
          <div class="border-b border-slate-200 p-5">
            <h3 class="text-lg font-semibold text-slate-900">Day of Week Seasonality</h3>
          </div>
          <div class="p-5">
            <DistributionBars :items="dayOfWeekData" />
          </div>
        </Card>
      </div>

      <Card>
        <div class="border-b border-slate-200 p-5">
          <h3 class="text-lg font-semibold text-slate-900">Fleet Tier Distribution</h3>
        </div>
        <div class="grid gap-6 p-5 md:grid-cols-[1.2fr_0.8fr]">
          <DistributionBars :items="tierDistributionData" />
          <div class="space-y-3">
            <div
              v-for="tier in tierDistributionData"
              :key="tier.label"
              class="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
            >
              <div class="flex items-center gap-3">
                <span class="h-3 w-3 rounded-full" :style="{ backgroundColor: tier.color }" />
                <span class="text-sm font-medium text-slate-800">{{ tier.label }}</span>
              </div>
              <span class="text-sm text-slate-600">{{ tier.value }} units</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
