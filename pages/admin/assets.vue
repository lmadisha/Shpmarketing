<script setup lang="ts">
import { Refrigerator } from 'lucide-vue-next'
import Button from '~/components/ui/Button.vue'
import Select from '~/components/ui/Select.vue'
import Badge from '~/components/ui/Badge.vue'
import Textarea from '~/components/ui/Textarea.vue'
import ModalDialog from '~/components/ui/ModalDialog.vue'
import AccessDeniedCard from '~/components/auth/AccessDeniedCard.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const store = useAdminAssetsStore()

const tabs = computed(() => [
  { label: 'Inventory', to: '/admin/assets/inventory', visible: store.canViewAssets },
  { label: 'Add Fridge', to: '/admin/assets/add', visible: store.canCreateAssets },
  { label: 'Mismatches', to: '/admin/assets/mismatches', visible: store.canViewMismatches },
  { label: 'Device Checker', to: '/admin/assets/device-checker', visible: store.canSubmitDeviceCheck },
  { label: 'History', to: '/admin/assets/history', visible: store.canViewHistory },
].filter((tab) => tab.visible))

const hasVisibleTab = computed(() => tabs.value.length > 0)

watchEffect(() => {
  if (!hasVisibleTab.value) {
    return
  }
  if (!route.path.startsWith('/admin/assets')) {
    return
  }
  const currentAllowed = tabs.value.some((tab) => route.path === tab.to || route.path.startsWith(`${tab.to}/`))
  if (!currentAllowed && route.path !== '/admin/assets') {
    void navigateTo(tabs.value[0].to, { replace: true })
  }
})

onMounted(async () => {
  if (store.canViewAssets) {
    await store.loadFridges(store.searchTerm)
  }
  if (store.canViewHistory) {
    await store.loadAllHistory()
  }
  if (store.canViewMismatches) {
    await store.loadMismatches()
  }
})
</script>

<template>
  <div class="min-h-full">
    <div v-if="!hasVisibleTab" class="p-4 md:p-6 lg:p-8">
      <AccessDeniedCard
        title="Asset Manager access denied"
        description="You do not have permission to access any Asset Manager tabs."
      />
    </div>

    <template v-else>
      <div class="border-b border-slate-200 bg-white px-4 pb-0 pt-6 md:px-6 lg:px-8">
        <div class="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex items-center gap-3">
            <Refrigerator class="h-6 w-6 text-blue-600" />
            <div>
              <h1 class="text-2xl font-semibold text-slate-900">Asset Manager</h1>
              <p class="text-sm text-slate-500">Store, register, and manage fridge device identities.</p>
            </div>
          </div>

          <div v-if="store.isOrganisationFilterEnabled" class="min-w-[240px]">
            <Select
              v-model="store.organisationFilter"
              :options="[
                { value: '', label: store.organisationsLoading ? 'Loading organisations...' : 'All organisations' },
                ...store.organisationOptions.map(o => ({ value: String(o.id), label: o.name })),
              ]"
            />
          </div>
        </div>

        <nav class="-mb-px flex gap-0 overflow-x-auto">
          <NuxtLink
            v-for="tab in tabs"
            :key="tab.to"
            :to="tab.to"
            class="border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
            :class="route.path === tab.to || route.path.startsWith(`${tab.to}/`) ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'"
          >
            {{ tab.label }}
          </NuxtLink>
        </nav>
      </div>

      <div class="p-4 md:p-6 lg:p-8">
        <NuxtPage />
      </div>

      <ModalDialog
        :open="store.deviceHistoryOpen"
        title="Device History"
        :description="store.deviceHistorySerial"
        max-width-class="max-w-5xl"
        @close="store.deviceHistoryOpen = false"
      >
        <div v-if="store.deviceHistoryError" class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {{ store.deviceHistoryError }}
        </div>
        <div class="max-h-[420px] overflow-auto rounded-xl border border-slate-200">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th class="px-4 py-3">Time</th>
                <th class="px-4 py-3">Action</th>
                <th class="px-4 py-3">Old → New MAC</th>
                <th class="px-4 py-3">Old → New C</th>
                <th class="px-4 py-3">User</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white text-sm text-slate-700">
              <tr v-for="entry in store.deviceHistoryRows" :key="entry.log_id">
                <td class="px-4 py-3">{{ new Date(entry.changed_at).toLocaleString() }}</td>
                <td class="px-4 py-3"><Badge :variant="entry.action_type === 'UPDATE' ? 'secondary' : 'outline'">{{ entry.action_type }}</Badge></td>
                <td class="px-4 py-3">{{ entry.old_mac || '-' }} → {{ entry.new_mac || '-' }}</td>
                <td class="px-4 py-3">{{ entry.old_c_num || '-' }} → {{ entry.new_c_num || '-' }}</td>
                <td class="px-4 py-3">{{ entry.changed_by_username || 'system' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <template #footer>
          <Button variant="outline" @click="store.deviceHistoryOpen = false">Close</Button>
        </template>
      </ModalDialog>

      <ModalDialog
        :open="store.resolveModal.open"
        title="Resolve Mismatch"
        description="Resolving will apply the received MAC and C-number to the fridge and mark it verified."
        @close="store.resolveModal = { open: false, row: null, note: '', submitting: false }"
      >
        <Textarea v-model="store.resolveModal.note" placeholder="Reason or context for this resolution" />
        <template #footer>
          <Button variant="outline" @click="store.resolveModal = { open: false, row: null, note: '', submitting: false }">Cancel</Button>
          <Button :disabled="store.resolveModal.submitting" @click="store.submitResolveMismatch">
            {{ store.resolveModal.submitting ? 'Resolving...' : 'Resolve' }}
          </Button>
        </template>
      </ModalDialog>

      <ModalDialog
        :open="store.deleteMismatchModal.open"
        title="Delete Mismatch"
        description="Soft-delete requires a reason that will be stored as the resolution note."
        @close="store.deleteMismatchModal = { open: false, row: null, note: '', submitting: false }"
      >
        <Textarea v-model="store.deleteMismatchModal.note" placeholder="Provide reason for deleting this mismatch" />
        <template #footer>
          <Button variant="outline" @click="store.deleteMismatchModal = { open: false, row: null, note: '', submitting: false }">Cancel</Button>
          <Button variant="destructive" :disabled="store.deleteMismatchModal.submitting" @click="store.submitDeleteMismatch">
            {{ store.deleteMismatchModal.submitting ? 'Deleting...' : 'Delete' }}
          </Button>
        </template>
      </ModalDialog>
    </template>
  </div>
</template>
