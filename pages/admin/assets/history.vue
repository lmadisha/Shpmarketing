<script setup lang="ts">
import { ArrowUpDown, ChevronLeft, ChevronRight, Clock3, Download, RefreshCw } from 'lucide-vue-next'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import AccessDeniedCard from '~/components/auth/AccessDeniedCard.vue'
import { downloadExcel } from '~/utils/adminAssets'

const store = useAdminAssetsStore()

definePageMeta({ middleware: 'auth' })

function actionVariant(actionType: string) {
  if (actionType === 'VERIFY') return 'success'
  if (actionType === 'UNVERIFY') return 'destructive'
  if (actionType === 'UPDATE' || actionType === 'MISMATCH_UPDATE') return 'secondary'
  if (actionType === 'DELETE' || actionType === 'MISMATCH_DELETE') return 'destructive'
  return 'outline'
}

onMounted(async () => {
  if (store.canViewHistory && store.sortedHistory.length === 0) {
    await store.loadAllHistory()
  }
})
</script>

<template>
  <AccessDeniedCard
    v-if="!store.canViewHistory"
    title="History access denied"
    description="You do not have permission to view change history."
  />

  <Card v-else>
    <div class="border-b border-slate-200 p-5">
      <div class="flex items-center gap-2">
        <Clock3 class="h-4 w-4 text-blue-600" />
        <h2 class="text-lg font-semibold text-slate-900">Global Change History</h2>
      </div>
      <p class="mt-1 text-sm text-slate-600">Most recent device changes first.</p>
    </div>
    <div class="space-y-4 p-5">
      <div class="flex justify-end gap-2">
        <Button
          variant="outline"
          @click="downloadExcel(`history_${new Date().toISOString().slice(0, 10)}.xls`, 'History', ['Changed At', 'Action', 'Serial', 'Old MAC', 'New MAC', 'Old C-Number', 'New C-Number', 'User'], store.historyExportRows)"
        >
          <Download class="h-4 w-4" />
          Download Excel
        </Button>
        <Button variant="outline" :disabled="store.historyLoading" @click="store.loadAllHistory">
          <RefreshCw class="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <p v-if="store.historyError" class="text-sm text-red-600">{{ store.historyError }}</p>

      <div class="overflow-x-auto rounded-xl border border-slate-200">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50">
            <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th class="px-4 py-3"><button class="inline-flex items-center gap-1" @click="store.toggleHistorySort('changed_at')">Time <ArrowUpDown class="h-4 w-4" /></button></th>
              <th class="px-4 py-3"><button class="inline-flex items-center gap-1" @click="store.toggleHistorySort('action_type')">Action <ArrowUpDown class="h-4 w-4" /></button></th>
              <th class="px-4 py-3"><button class="inline-flex items-center gap-1" @click="store.toggleHistorySort('fridge_serial_number')">Serial <ArrowUpDown class="h-4 w-4" /></button></th>
              <th class="px-4 py-3">Old → New MAC</th>
              <th class="px-4 py-3">Old → New C</th>
              <th class="px-4 py-3"><button class="inline-flex items-center gap-1" @click="store.toggleHistorySort('changed_by_username')">User <ArrowUpDown class="h-4 w-4" /></button></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 bg-white text-sm text-slate-700">
            <tr v-for="entry in store.paginatedHistory" :key="entry.log_id">
              <td class="px-4 py-3">{{ new Date(entry.changed_at).toLocaleString() }}</td>
              <td class="px-4 py-3"><Badge :variant="actionVariant(entry.action_type)">{{ entry.action_type }}</Badge></td>
              <td class="px-4 py-3 font-medium">{{ entry.fridge_serial_number }}</td>
              <td class="px-4 py-3">{{ entry.old_mac || '-' }} → {{ entry.new_mac || '-' }}</td>
              <td class="px-4 py-3">{{ entry.old_c_num || '-' }} → {{ entry.new_c_num || '-' }}</td>
              <td class="px-4 py-3">{{ entry.changed_by_username || 'system' }}</td>
            </tr>
            <tr v-if="!store.historyLoading && store.sortedHistory.length === 0">
              <td colspan="6" class="px-4 py-10 text-center text-sm text-slate-500">No history entries found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" :disabled="store.safeHistoryPage <= 1" @click="store.historyPage = Math.max(1, store.historyPage - 1)">
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <span class="text-sm text-slate-500">Page {{ store.safeHistoryPage }} of {{ store.historyTotalPages }}</span>
        <Button variant="outline" size="sm" :disabled="store.safeHistoryPage >= store.historyTotalPages" @click="store.historyPage = Math.min(store.historyTotalPages, store.historyPage + 1)">
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </Card>
</template>
