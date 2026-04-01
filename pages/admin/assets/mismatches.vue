<script setup lang="ts">
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, RefreshCw, Search } from 'lucide-vue-next'
import Card from '~/components/ui/Card.vue'
import Input from '~/components/ui/Input.vue'
import Select from '~/components/ui/Select.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import AccessDeniedCard from '~/components/auth/AccessDeniedCard.vue'
import { downloadExcel } from '~/utils/adminAssets'
import type { MismatchSortKey } from '~/types/adminAssets'

const store = useAdminAssetsStore()

definePageMeta({ middleware: 'auth' })

function renderSortDirection(key: MismatchSortKey) {
  if (store.mismatchSort.key !== key) return ArrowUpDown
  return store.mismatchSort.direction === 'asc' ? ArrowUp : ArrowDown
}

onMounted(async () => {
  if (store.canViewMismatches && store.sortedMismatches.length === 0) {
    await store.loadMismatches()
  }
})
</script>

<template>
  <AccessDeniedCard
    v-if="!store.canViewMismatches"
    title="Mismatches access denied"
    description="You do not have permission to view mismatch records."
  />

  <Card v-else>
    <div class="border-b border-slate-200 p-5">
      <h2 class="text-lg font-semibold text-slate-900">Mismatches</h2>
      <p class="mt-1 text-sm text-slate-600">Resolve mobile scan discrepancies between received and expected values.</p>
    </div>
    <div class="space-y-4 p-5">
      <div class="grid gap-3 md:grid-cols-5">
        <Select
          v-model="store.mismatchFilters.status"
          :options="[
            { value: 'open', label: 'Open' },
            { value: 'resolve', label: 'Resolve' },
            { value: 'delete', label: 'Delete' },
            { value: 'all', label: 'All' },
          ]"
        />
        <Input v-model="store.mismatchFilters.serial" placeholder="Serial contains" />
        <Input v-model="store.mismatchFilters.from" type="date" />
        <Input v-model="store.mismatchFilters.to" type="date" />
        <div class="flex gap-2">
          <Button class="flex-1" @click="store.mismatchPage = 1; store.loadMismatches(store.mismatchFilters)">
            <Search class="h-4 w-4" />
            Search
          </Button>
          <Button
            class="flex-1"
            variant="outline"
            @click="store.mismatchFilters = { status: 'open', serial: '', from: '', to: '' }; store.mismatchPage = 1; store.loadMismatches(store.mismatchFilters)"
          >
            <RefreshCw class="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      <div class="flex justify-end">
        <Button
          variant="outline"
          @click="downloadExcel(`mismatches_${new Date().toISOString().slice(0, 10)}.xls`, 'Mismatches', ['Received At', 'Serial', 'Received MAC', 'Expected MAC', 'Received C-Number', 'Expected C-Number', 'Status', 'Resolved At', 'Resolved By', 'Note'], store.mismatchExportRows)"
        >
          <Download class="h-4 w-4" />
          Download Excel
        </Button>
      </div>

      <p v-if="store.mismatchError" class="text-sm text-red-600">{{ store.mismatchError }}</p>

      <div class="overflow-x-auto rounded-xl border border-slate-200">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50">
            <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th class="px-4 py-3"><button class="inline-flex items-center gap-1 hover:text-slate-700 transition-colors" @click="store.toggleMismatchSort('received_at')">Received <component :is="renderSortDirection('received_at')" class="h-4 w-4" /></button></th>
              <th class="px-4 py-3"><button class="inline-flex items-center gap-1 hover:text-slate-700 transition-colors" @click="store.toggleMismatchSort('fridge_serial_number')">Serial <component :is="renderSortDirection('fridge_serial_number')" class="h-4 w-4" /></button></th>
              <th class="px-4 py-3">Received MAC / C</th>
              <th class="px-4 py-3">Expected MAC / C</th>
              <th class="px-4 py-3"><button class="inline-flex items-center gap-1 hover:text-slate-700 transition-colors" @click="store.toggleMismatchSort('status')">Status <component :is="renderSortDirection('status')" class="h-4 w-4" /></button></th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 bg-white text-sm text-slate-700">
            <tr v-for="row in store.paginatedMismatches" :key="row.id">
              <td class="px-4 py-3">{{ new Date(row.received_at).toLocaleString() }}</td>
              <td class="px-4 py-3 font-medium">{{ row.fridge_serial_number }}</td>
              <td class="px-4 py-3">
                <div>MAC: {{ row.received_mac || '-' }}</div>
                <div>C: {{ row.received_c_number || '-' }}</div>
              </td>
              <td class="px-4 py-3">
                <div>MAC: {{ row.expected_mac || row.db_mac || '-' }}</div>
                <div>C: {{ row.expected_c_number || row.db_c_number || '-' }}</div>
              </td>
              <td class="px-4 py-3">
                <Badge :variant="row.status === 'open' ? 'outline' : row.status === 'resolve' ? 'success' : 'destructive'">{{ row.status }}</Badge>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex flex-wrap justify-end gap-2">
                  <Button v-if="store.canResolveMismatches" size="sm" variant="success" :disabled="row.status !== 'open'" @click="store.openResolveMismatch(row)">Resolve</Button>
                  <Button v-if="store.canDeleteMismatches" size="sm" variant="destructive" :disabled="row.status !== 'open'" @click="store.openDeleteMismatch(row)">Delete</Button>
                </div>
              </td>
            </tr>
            <tr v-if="!store.mismatchLoading && store.sortedMismatches.length === 0">
              <td colspan="6" class="px-4 py-10 text-center text-sm text-slate-500">No mismatches found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" :disabled="store.safeMismatchPage <= 1" @click="store.mismatchPage = Math.max(1, store.mismatchPage - 1)">
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <span class="text-sm text-slate-500">Page {{ store.safeMismatchPage }} of {{ store.mismatchTotalPages }}</span>
        <Button variant="outline" size="sm" :disabled="store.safeMismatchPage >= store.mismatchTotalPages" @click="store.mismatchPage = Math.min(store.mismatchTotalPages, store.mismatchPage + 1)">
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </Card>
</template>
