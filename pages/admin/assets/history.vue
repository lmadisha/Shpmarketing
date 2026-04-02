<script setup lang="ts">
import { ArrowUpDown, ChevronLeft, ChevronRight, Clock3, Download, RefreshCw } from 'lucide-vue-next'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import AccessDeniedCard from '~/components/auth/AccessDeniedCard.vue'
import { downloadExcel } from '~/utils/adminAssets'
import type { AuditLogRow } from '~/types/adminAssets'

const store = useAdminAssetsStore()

definePageMeta({ middleware: 'auth' })

function actionLabel(actionType: AuditLogRow['action_type']) {
  switch (actionType) {
    case 'INSERT':
      return 'Added'
    case 'UPDATE':
      return 'Updated'
    case 'DELETE':
      return 'Deleted'
    case 'MISMATCH_INSERT':
      return 'Mismatch Found'
    case 'MISMATCH_UPDATE':
      return 'Mismatch Updated'
    case 'MISMATCH_RESOLVE':
      return 'Mismatch Resolved'
    case 'MISMATCH_DELETE':
      return 'Mismatch Deleted'
  }
}

function actionBadgeClass(actionType: AuditLogRow['action_type']) {
  switch (actionType) {
    case 'INSERT':
      return 'border border-sky-200 bg-sky-50 text-sky-700'
    case 'UPDATE':
      return 'border border-amber-200 bg-amber-50 text-amber-700'
    case 'DELETE':
      return 'border border-rose-200 bg-rose-50 text-rose-700'
    case 'MISMATCH_INSERT':
      return 'border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700'
    case 'MISMATCH_UPDATE':
      return 'border border-violet-200 bg-violet-50 text-violet-700'
    case 'MISMATCH_RESOLVE':
      return 'border border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'MISMATCH_DELETE':
      return 'border border-red-200 bg-red-50 text-red-700'
  }
}

function actionDotClass(actionType: AuditLogRow['action_type']) {
  switch (actionType) {
    case 'INSERT':
      return 'bg-sky-500'
    case 'UPDATE':
      return 'bg-amber-500'
    case 'DELETE':
      return 'bg-rose-500'
    case 'MISMATCH_INSERT':
      return 'bg-fuchsia-500'
    case 'MISMATCH_UPDATE':
      return 'bg-violet-500'
    case 'MISMATCH_RESOLVE':
      return 'bg-emerald-500'
    case 'MISMATCH_DELETE':
      return 'bg-red-500'
  }
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
        <Clock3 class="h-4 w-4 text-[#006aea]" />
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
              <td class="px-4 py-3">
                <span
                  :class="[
                    'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]',
                    actionBadgeClass(entry.action_type),
                  ]"
                >
                  <span :class="['h-2 w-2 rounded-full', actionDotClass(entry.action_type)]" />
                  {{ actionLabel(entry.action_type) }}
                </span>
              </td>
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
