<script setup lang="ts">
import { FileBarChart2, FileSpreadsheet, FileText } from 'lucide-vue-next'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import FilterBar from '~/components/layout/FilterBar.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const reports = [
  { title: 'Operational Summary', description: 'Weekly fleet activity and health rollup.', icon: FileBarChart2 },
  { title: 'Maintenance Queue Export', description: 'Current diagnostic backlog and severity distribution.', icon: FileSpreadsheet },
  { title: 'Regional Performance Brief', description: 'Regional trend snapshots for leadership review.', icon: FileText },
]
</script>

<template>
  <div>
    <FilterBar />
    <div class="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">Reports</h1>
        <p class="mt-1 text-sm text-slate-600">Prepared exports and executive-ready summaries.</p>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <Card v-for="report in reports" :key="report.title">
          <div class="space-y-4 p-5">
            <component :is="report.icon" class="h-8 w-8 text-blue-600" />
            <div>
              <h2 class="text-lg font-semibold text-slate-900">{{ report.title }}</h2>
              <p class="mt-2 text-sm text-slate-600">{{ report.description }}</p>
            </div>
            <Button class="w-full">Generate Report</Button>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
