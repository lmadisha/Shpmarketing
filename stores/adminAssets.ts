import { defineStore } from 'pinia'
import { useAuthStore } from '~/stores/auth'
import {
  canFilterOrganisation as canFilterOrganisationByRole,
  hasPermission,
} from '~/utils/permissionPolicy'
import {
  validateAssetIdentifiers,
  type OrganisationAssetValidationRules,
} from '~/utils/organisationAssetValidation'
import {
  compareValues,
  summarizeRequestBody,
  summarizeResponsePayload,
  normalizeHexIdentifier,
  normalizeCNumber,
} from '~/utils/adminAssets'
import type {
  Fridge,
  Mismatch,
  AuditLogRow,
  OrganisationOption,
  MismatchStatus,
  InventorySortKey,
  MismatchSortKey,
  HistorySortKey,
  HistoryActionFilter,
  SortDirection,
  AdminApiRequestOptions,
  BulkOperationResult,
} from '~/types/adminAssets'
import { PAGE_SIZE, ADMIN_ASSETS_LOG_PREFIX } from '~/types/adminAssets'

export const useAdminAssetsStore = defineStore('adminAssets', () => {
  const authStore = useAuthStore()
  const { request } = useApiClient()

  // ── Permissions ────────────────────────────────────────────────────────────
  const permissionLevel = computed(() => authStore.session?.user.permissions)
  const actor = computed(() => authStore.session?.user.full_name || authStore.session?.user.username || 'Unknown')
  const actorOrganisationId = computed(() => authStore.session?.user.organisation_id ?? null)

  const isOrganisationFilterEnabled = computed(() =>
    permissionLevel.value ? canFilterOrganisationByRole(permissionLevel.value) : false
  )
  const canCreateAssets = computed(() => permissionLevel.value ? hasPermission(permissionLevel.value, 'assets.create') : false)
  const canViewAssets = computed(() => permissionLevel.value ? hasPermission(permissionLevel.value, 'assets.view') : false)
  const canEditAssets = computed(() => permissionLevel.value ? hasPermission(permissionLevel.value, 'assets.edit') : false)
  const canDeleteAssets = computed(() => permissionLevel.value ? hasPermission(permissionLevel.value, 'assets.delete') : false)
  const canViewMismatches = computed(() => permissionLevel.value ? hasPermission(permissionLevel.value, 'mismatches.view') : false)
  const canResolveMismatches = computed(() => permissionLevel.value ? hasPermission(permissionLevel.value, 'mismatches.resolve') : false)
  const canDeleteMismatches = computed(() => permissionLevel.value ? hasPermission(permissionLevel.value, 'mismatches.delete') : false)
  const canViewHistory = computed(() => permissionLevel.value ? hasPermission(permissionLevel.value, 'history.view') : false)
  const canSubmitDeviceCheck = computed(() => permissionLevel.value ? hasPermission(permissionLevel.value, 'device_checker.submit') : false)
  const canSubmitPlacement = computed(() => permissionLevel.value ? hasPermission(permissionLevel.value, 'placement.submit') : false)

  // ── Organisation filter ────────────────────────────────────────────────────
  const organisationFilter = ref('')
  const organisationOptions = ref<OrganisationOption[]>([])
  const organisationsLoading = ref(false)

  function normalizeOrganisationFilterValue(rawValue: string | null | undefined): string {
    const raw = String(rawValue ?? '').trim()
    if (!raw || raw.toLowerCase() === 'all') {
      return ''
    }

    if (/^\d+$/.test(raw)) {
      const parsed = Number(raw)
      return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : ''
    }

    const byName = organisationOptions.value.find(
      (option) => option.name.trim().toLowerCase() === raw.toLowerCase(),
    )
    return byName ? String(byName.id) : ''
  }

  function setOrganisationFilter(organisationId: string) {
    organisationFilter.value = normalizeOrganisationFilterValue(organisationId)
  }

  function withOrganisationFilter(path: string) {
    const normalizedFilter = normalizeOrganisationFilterValue(organisationFilter.value)
    if (!isOrganisationFilterEnabled.value || !normalizedFilter) {
      return path
    }
    const joiner = path.includes('?') ? '&' : '?'
    return `${path}${joiner}organisation_id=${encodeURIComponent(normalizedFilter)}`
  }

  function parseOrganisationFilterSelection(rawValue: string | null | undefined): number | null {
    const normalized = normalizeOrganisationFilterValue(rawValue)
    if (!normalized) {
      return null
    }
    const parsed = Number(normalized)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }

  const selectedOrganisationId = computed(() =>
    isOrganisationFilterEnabled.value
      ? parseOrganisationFilterSelection(organisationFilter.value)
      : actorOrganisationId.value
  )

  const effectiveOrganisationIdForMutations = computed(() =>
    selectedOrganisationId.value ?? actorOrganisationId.value ?? null
  )

  const mutationOrganisationScopeValue = computed(() => {
    if (selectedOrganisationId.value != null) {
      return String(selectedOrganisationId.value)
    }
    if (isOrganisationFilterEnabled.value) {
      return 'all'
    }
    if (actorOrganisationId.value != null) {
      return String(actorOrganisationId.value)
    }
    return null
  })

  function withMutationOrganisationScope(path: string) {
    const scopeValue = mutationOrganisationScopeValue.value
    if (!scopeValue) {
      return path
    }
    const joiner = path.includes('?') ? '&' : '?'
    return `${path}${joiner}organisation_id=${encodeURIComponent(scopeValue)}`
  }

  // ── Validation rules cache ─────────────────────────────────────────────────
  const organisationValidationRulesById = ref<Record<number, OrganisationAssetValidationRules>>({})
  const actorOrganisationValidationRules = ref<OrganisationAssetValidationRules | null>(null)
  const actorOrganisationValidationLoading = ref(false)

  // ── API helper ─────────────────────────────────────────────────────────────
  async function adminRequest<T>(
    action: string,
    path: string,
    options: AdminApiRequestOptions = {},
  ): Promise<T> {
    const method = String(options.method || 'GET').toUpperCase()
    const startedAt = performance.now()
    const requestSummary = summarizeRequestBody(options.body)

    console.info(`${ADMIN_ASSETS_LOG_PREFIX} ${action} ${method} ${path} started`, { actor: actor.value, requestBody: requestSummary })

    try {
      const data = await request<T>(path, options)
      const durationMs = Math.round(performance.now() - startedAt)
      console.info(`${ADMIN_ASSETS_LOG_PREFIX} ${action} ${method} ${path} succeeded in ${durationMs}ms`, {
        actor: actor.value,
        response: summarizeResponsePayload(data),
      })
      return data
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt)
      const message = error instanceof Error ? error.message : String(error)
      console.error(`${ADMIN_ASSETS_LOG_PREFIX} ${action} ${method} ${path} failed in ${durationMs}ms: ${message}`, {
        actor: actor.value,
        requestBody: requestSummary,
      })
      throw error
    }
  }

  async function getOrganisationValidationRules(organisationId?: number | null): Promise<OrganisationAssetValidationRules> {
    const cacheKey = organisationId ?? null
    if (cacheKey != null && organisationValidationRulesById.value[cacheKey]) {
      return organisationValidationRulesById.value[cacheKey]
    }

    const params = new URLSearchParams()
    if (organisationId) {
      params.set('organisation_id', String(organisationId))
    }
    const path = params.toString()
      ? `/organisation-asset-validation?${params.toString()}`
      : '/organisation-asset-validation'
    const rules = await adminRequest<OrganisationAssetValidationRules>('loadOrganisationValidationRules', path)
    organisationValidationRulesById.value = { ...organisationValidationRulesById.value, [rules.organisation_id]: rules }
    return rules
  }

  // ── Fridges ────────────────────────────────────────────────────────────────
  const fridges = ref<Fridge[]>([])
  const fridgeLoading = ref(false)
  const fridgeError = ref('')
  const searchTerm = ref('')

  async function loadFridges(query?: string) {
    if (!canViewAssets.value) {
      fridges.value = []
      fridgeError.value = 'You do not have permission to view fridge inventory.'
      return
    }

    fridgeLoading.value = true
    fridgeError.value = ''
    selectedSerials.value = new Set()
    try {
      const term = (query ?? '').trim()
      const data = term
        ? await adminRequest<Fridge[]>('loadFridges.search', withOrganisationFilter(`/searchFridges?searchTerm=${encodeURIComponent(term)}`))
        : await adminRequest<Fridge[]>('loadFridges.list', withOrganisationFilter('/getFridges'))
      fridges.value = Array.isArray(data) ? data : []
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load fridge inventory.'
      fridgeError.value = message
    } finally {
      fridgeLoading.value = false
    }
  }

  // ── History ────────────────────────────────────────────────────────────────
  const allHistory = ref<AuditLogRow[]>([])
  const historyLoading = ref(false)
  const historyError = ref('')

  const historyFilters = ref<{
    action_type: HistoryActionFilter
    serial: string
    from: string
    to: string
  }>({
    action_type: 'all',
    serial: '',
    from: '',
    to: '',
  })

  async function loadAllHistory() {
    if (!canViewHistory.value) {
      allHistory.value = []
      historyError.value = 'You do not have permission to view history.'
      return
    }

    historyLoading.value = true
    historyError.value = ''
    try {
      const data = await adminRequest<AuditLogRow[]>('loadHistory.global', withOrganisationFilter('/auditLog'))
      allHistory.value = Array.isArray(data) ? data : []
    } catch {
      historyError.value = 'Could not load change history.'
    } finally {
      historyLoading.value = false
    }
  }

  // ── Device history dialog ──────────────────────────────────────────────────
  const deviceHistoryOpen = ref(false)
  const deviceHistorySerial = ref('')
  const deviceHistoryRows = ref<AuditLogRow[]>([])
  const deviceHistoryLoading = ref(false)
  const deviceHistoryError = ref('')

  async function loadDeviceHistory(serial: string) {
    if (!canViewHistory.value) {
      deviceHistoryError.value = 'You do not have permission to view device history.'
      return
    }

    const normalizedSerial = serial.trim().toUpperCase()
    const cachedRows = allHistory.value.filter(
      (row) => String(row.fridge_serial_number || '').trim().toUpperCase() === normalizedSerial,
    )
    deviceHistoryLoading.value = true
    deviceHistorySerial.value = serial
    deviceHistoryRows.value = cachedRows
    deviceHistoryError.value = ''
    deviceHistoryOpen.value = true
    try {
      const data = await adminRequest<AuditLogRow[]>(
        'loadHistory.device',
        withOrganisationFilter(`/auditLog/${encodeURIComponent(serial)}`),
      )
      deviceHistoryRows.value = Array.isArray(data) ? data : []
    } catch {
      if (cachedRows.length) {
        deviceHistoryError.value = 'Showing cached device history. Live refresh failed.'
      } else {
        deviceHistoryError.value = 'Could not load device history.'
      }
    } finally {
      deviceHistoryLoading.value = false
    }
  }

  // ── Mismatches ─────────────────────────────────────────────────────────────
  const mismatches = ref<Mismatch[]>([])
  const mismatchLoading = ref(false)
  const mismatchError = ref('')
  const mismatchFilters = ref<{ status: MismatchStatus; serial: string; from: string; to: string }>({
    status: 'open',
    serial: '',
    from: '',
    to: '',
  })

  async function loadMismatches(
    filters?: { status: MismatchStatus; serial: string; from: string; to: string },
  ) {
    const activeFilters = filters ?? mismatchFilters.value

    if (!canViewMismatches.value) {
      mismatches.value = []
      mismatchError.value = 'You do not have permission to view mismatches.'
      return
    }

    mismatchLoading.value = true
    mismatchError.value = ''
    try {
      const params = new URLSearchParams()
      if (activeFilters.status) params.set('status', activeFilters.status)
      if (activeFilters.serial.trim()) params.set('serial', activeFilters.serial.trim())
      if (activeFilters.from) params.set('from', activeFilters.from)
      if (activeFilters.to) params.set('to', activeFilters.to)
      const normalizedFilter = normalizeOrganisationFilterValue(organisationFilter.value)
      if (isOrganisationFilterEnabled.value && normalizedFilter) {
        params.set('organisation_id', normalizedFilter)
      }
      const data = await adminRequest<Mismatch[]>('loadMismatches', `/mismatches?${params.toString()}`)
      mismatches.value = Array.isArray(data) ? data : []
    } catch {
      mismatchError.value = 'Could not load mismatches.'
    } finally {
      mismatchLoading.value = false
    }
  }

  // ── Resolve mismatch modal ─────────────────────────────────────────────────
  const resolveModal = ref<{ open: boolean; row: Mismatch | null; note: string; submitting: boolean }>({
    open: false,
    row: null,
    note: '',
    submitting: false,
  })

  function openResolveMismatch(row: Mismatch) {
    resolveModal.value = { open: true, row, note: '', submitting: false }
  }

  async function submitResolveMismatch() {
    if (!canResolveMismatches.value) {
      mismatchError.value = 'You do not have permission to resolve mismatches.'
      return
    }

    if (!resolveModal.value.row) return
    resolveModal.value.submitting = true
    mismatchError.value = ''
    try {
      await adminRequest(
        'resolveMismatch',
        withMutationOrganisationScope(`/mismatches/${resolveModal.value.row.id}/resolve`),
        {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: resolveModal.value.note }),
        },
      )
      resolveModal.value = { open: false, row: null, note: '', submitting: false }
      if (canViewMismatches.value) await loadMismatches()
      if (canViewAssets.value) await loadFridges(searchTerm.value)
      if (canViewHistory.value) await loadAllHistory()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not resolve mismatch.'
      mismatchError.value = message
      resolveModal.value.submitting = false
    }
  }

  // ── Delete mismatch modal ──────────────────────────────────────────────────
  const deleteMismatchModal = ref<{ open: boolean; row: Mismatch | null; note: string; submitting: boolean }>({
    open: false,
    row: null,
    note: '',
    submitting: false,
  })

  function openDeleteMismatch(row: Mismatch) {
    deleteMismatchModal.value = { open: true, row, note: '', submitting: false }
  }

  async function submitDeleteMismatch() {
    if (!canDeleteMismatches.value) {
      mismatchError.value = 'You do not have permission to delete mismatches.'
      return
    }

    if (!deleteMismatchModal.value.row) return
    if (!deleteMismatchModal.value.note.trim()) {
      mismatchError.value = 'Delete reason is required.'
      return
    }
    deleteMismatchModal.value.submitting = true
    mismatchError.value = ''
    try {
      await adminRequest(
        'deleteMismatch',
        withMutationOrganisationScope(`/mismatches/${deleteMismatchModal.value.row.id}`),
        {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: deleteMismatchModal.value.note.trim() }),
        },
      )
      deleteMismatchModal.value = { open: false, row: null, note: '', submitting: false }
      if (canViewMismatches.value) await loadMismatches()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete mismatch.'
      mismatchError.value = message
      deleteMismatchModal.value.submitting = false
    }
  }

  // ── Edit / delete ──────────────────────────────────────────────────────────
  const editingSerial = ref<string | null>(null)
  const editForm = ref({ mac_address: '', c_number: '' })
  const editFormErrors = ref<{ mac_address?: string; c_number?: string }>({})
  const savingEdit = ref(false)
  const deletingSerial = ref<string | null>(null)

  function setEditForm(form: { mac_address: string; c_number: string }) {
    editFormErrors.value = {}
    editForm.value = form
  }

  function startEdit(row: Fridge) {
    if (!canEditAssets.value) {
      fridgeError.value = 'You do not have permission to edit devices.'
      return
    }
    editingSerial.value = row.fridge_serial_number
    setEditForm({ mac_address: row.iot_mac_address || '', c_number: row.c_number || '' })
    editFormErrors.value = {}
  }

  function cancelEdit() {
    editingSerial.value = null
    setEditForm({ mac_address: '', c_number: '' })
    editFormErrors.value = {}
  }

  async function submitEdit(serial: string) {
    if (!canEditAssets.value) {
      fridgeError.value = 'You do not have permission to edit devices.'
      return
    }

    const row = fridges.value.find((item) => item.fridge_serial_number === serial)
    const mac = editForm.value.mac_address ? normalizeHexIdentifier(editForm.value.mac_address) : ''
    const cNumber = editForm.value.c_number ? normalizeCNumber(editForm.value.c_number) : ''
    if (!row?.organisation_id) {
      fridgeError.value = 'Could not validate device values because the fridge organisation is not configured.'
      return
    }

    let rules: OrganisationAssetValidationRules
    try {
      rules = await getOrganisationValidationRules(row.organisation_id)
    } catch (error) {
      fridgeError.value = error instanceof Error ? error.message : 'Could not load organisation validation rules.'
      return
    }
    const validationErrors = validateAssetIdentifiers({ mac_address: mac, c_number: cNumber }, rules)
    if (Object.keys(validationErrors).length) {
      editFormErrors.value = {
        mac_address: validationErrors.mac_address,
        c_number: validationErrors.c_number,
      }
      return
    }

    editFormErrors.value = {}
    savingEdit.value = true
    try {
      await adminRequest<Fridge>('updateFridge', withMutationOrganisationScope(`/updateDevice/${encodeURIComponent(serial)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac_address: mac, c_number: cNumber }),
      })
      cancelEdit()
      if (canViewAssets.value) await loadFridges(searchTerm.value)
      if (canViewHistory.value) await loadAllHistory()
    } catch {
      // fridgeError is set by adminRequest error handling
    } finally {
      savingEdit.value = false
    }
  }

  async function deleteFridge(serial: string, reason?: string) {
    if (!canDeleteAssets.value) {
      fridgeError.value = 'You do not have permission to delete devices.'
      return
    }

    deletingSerial.value = serial
    fridgeError.value = ''
    try {
      await adminRequest('deleteFridge', withMutationOrganisationScope(`/deleteDevice/${encodeURIComponent(serial)}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      })
      if (canViewAssets.value) await loadFridges(searchTerm.value)
      if (canViewHistory.value) await loadAllHistory()
    } catch {
      fridgeError.value = 'Could not delete fridge.'
    } finally {
      deletingSerial.value = null
    }
  }

  // ── Bulk selection ────────────────────────────────────────────────────────
  const selectedSerials = ref<Set<string>>(new Set())
  const bulkDeleting = ref(false)
  const bulkMoving = ref(false)
  const bulkError = ref('')

  const selectedCount = computed(() => selectedSerials.value.size)

  const isAllSelected = computed(() =>
    sortedFridgeRows.value.length > 0 &&
    sortedFridgeRows.value.every((r) => selectedSerials.value.has(r.fridge_serial_number)),
  )

  const isPartialSelected = computed(
    () => selectedSerials.value.size > 0 && !isAllSelected.value,
  )

  function toggleSelectSerial(serial: string) {
    const next = new Set(selectedSerials.value)
    if (next.has(serial)) {
      next.delete(serial)
    } else {
      next.add(serial)
    }
    selectedSerials.value = next
  }

  function toggleSelectAll() {
    if (isAllSelected.value) {
      selectedSerials.value = new Set()
    } else {
      selectedSerials.value = new Set(sortedFridgeRows.value.map((r) => r.fridge_serial_number))
    }
  }

  function clearSelection() {
    selectedSerials.value = new Set()
    bulkError.value = ''
  }

  async function bulkDeleteFridges(serials: string[], reason?: string): Promise<BulkOperationResult> {
    if (!canDeleteAssets.value) {
      fridgeError.value = 'You do not have permission to delete devices.'
      return { succeeded: [], notFound: [], errors: [] }
    }

    bulkDeleting.value = true
    bulkError.value = ''
    try {
      const result = await adminRequest<BulkOperationResult>(
        'bulkDeleteFridges',
        withMutationOrganisationScope('/deleteDevice/bulk'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serials, reason: reason || undefined }),
        },
      )
      clearSelection()
      if (canViewAssets.value) await loadFridges(searchTerm.value)
      if (canViewHistory.value) await loadAllHistory()
      return result
    } catch (error) {
      bulkError.value = error instanceof Error ? error.message : 'Bulk delete failed.'
      return { succeeded: [], notFound: [], errors: [] }
    } finally {
      bulkDeleting.value = false
    }
  }

  async function bulkMoveFridges(serials: string[], targetOrgId: number): Promise<BulkOperationResult> {
    if (!canEditAssets.value) {
      fridgeError.value = 'You do not have permission to edit devices.'
      return { succeeded: [], notFound: [], errors: [] }
    }

    bulkMoving.value = true
    bulkError.value = ''
    try {
      const result = await adminRequest<BulkOperationResult>(
        'bulkMoveFridges',
        withMutationOrganisationScope('/moveDevice/bulk'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serials, organisation_id: targetOrgId }),
        },
      )
      clearSelection()
      if (canViewAssets.value) await loadFridges(searchTerm.value)
      if (canViewHistory.value) await loadAllHistory()
      return result
    } catch (error) {
      bulkError.value = error instanceof Error ? error.message : 'Bulk move failed.'
      return { succeeded: [], notFound: [], errors: [] }
    } finally {
      bulkMoving.value = false
    }
  }

  // ── Inventory verified filter ──────────────────────────────────────────────
  const inventoryVerifiedFilter = ref<'all' | 'verified' | 'unverified'>('all')

  // ── Sorting ────────────────────────────────────────────────────────────────
  const inventorySort = ref<{ key: InventorySortKey; direction: SortDirection }>({ key: 'fridge_serial_number', direction: 'asc' })
  const mismatchSort = ref<{ key: MismatchSortKey; direction: SortDirection }>({ key: 'received_at', direction: 'desc' })
  const historySort = ref<{ key: HistorySortKey; direction: SortDirection }>({ key: 'changed_at', direction: 'desc' })

  function toggleInventorySort(key: InventorySortKey) {
    inventorySort.value = {
      key,
      direction: inventorySort.value.key === key && inventorySort.value.direction === 'asc' ? 'desc' : 'asc',
    }
  }

  function toggleMismatchSort(key: MismatchSortKey) {
    mismatchSort.value = {
      key,
      direction: mismatchSort.value.key === key && mismatchSort.value.direction === 'asc' ? 'desc' : 'asc',
    }
  }

  function toggleHistorySort(key: HistorySortKey) {
    historySort.value = {
      key,
      direction: historySort.value.key === key && historySort.value.direction === 'asc' ? 'desc' : 'asc',
    }
  }

  // ── Pagination ─────────────────────────────────────────────────────────────
  const inventoryPage = ref(1)
  const mismatchPage = ref(1)
  const historyPage = ref(1)

  // ── Sorted / paginated computed ────────────────────────────────────────────
  const sortedFridgeRows = computed(() => {
    let rows = [...fridges.value]
    if (inventoryVerifiedFilter.value === 'verified') rows = rows.filter((f) => f.verified)
    else if (inventoryVerifiedFilter.value === 'unverified') rows = rows.filter((f) => !f.verified)
    rows.sort((a, b) => {
      const result = compareValues(a[inventorySort.value.key], b[inventorySort.value.key])
      return inventorySort.value.direction === 'asc' ? result : -result
    })
    return rows
  })

  const sortedMismatches = computed(() => {
    const rows = [...mismatches.value]
    rows.sort((a, b) => {
      const left =
        mismatchSort.value.key === 'expected'
          ? `${a.expected_mac ?? a.db_mac ?? ''}|${a.expected_c_number ?? a.db_c_number ?? ''}`
          : a[mismatchSort.value.key as keyof Mismatch]
      const right =
        mismatchSort.value.key === 'expected'
          ? `${b.expected_mac ?? b.db_mac ?? ''}|${b.expected_c_number ?? b.db_c_number ?? ''}`
          : b[mismatchSort.value.key as keyof Mismatch]
      const result = compareValues(left, right)
      return mismatchSort.value.direction === 'asc' ? result : -result
    })
    return rows
  })

  const filteredHistory = computed(() => {
    const f = historyFilters.value
    return allHistory.value.filter((row) => {
      if (f.action_type !== 'all' && row.action_type !== f.action_type) return false
      if (f.serial.trim() && !String(row.fridge_serial_number ?? '').toLowerCase().includes(f.serial.trim().toLowerCase())) return false
      if (f.from) {
        const from = new Date(f.from)
        if (!Number.isNaN(from.getTime()) && new Date(row.changed_at) < from) return false
      }
      if (f.to) {
        const to = new Date(f.to)
        to.setHours(23, 59, 59, 999)
        if (!Number.isNaN(to.getTime()) && new Date(row.changed_at) > to) return false
      }
      return true
    })
  })

  const sortedHistory = computed(() => {
    const rows = [...filteredHistory.value]
    rows.sort((a, b) => {
      const result = compareValues(a[historySort.value.key], b[historySort.value.key])
      return historySort.value.direction === 'asc' ? result : -result
    })
    return rows
  })

  const inventoryTotalPages = computed(() => Math.max(1, Math.ceil(sortedFridgeRows.value.length / PAGE_SIZE)))
  const mismatchTotalPages = computed(() => Math.max(1, Math.ceil(sortedMismatches.value.length / PAGE_SIZE)))
  const historyTotalPages = computed(() => Math.max(1, Math.ceil(sortedHistory.value.length / PAGE_SIZE)))

  const safeInventoryPage = computed(() => Math.min(inventoryPage.value, inventoryTotalPages.value))
  const safeMismatchPage = computed(() => Math.min(mismatchPage.value, mismatchTotalPages.value))
  const safeHistoryPage = computed(() => Math.min(historyPage.value, historyTotalPages.value))

  const paginatedFridgeRows = computed(() => {
    const start = (safeInventoryPage.value - 1) * PAGE_SIZE
    return sortedFridgeRows.value.slice(start, start + PAGE_SIZE)
  })

  const paginatedMismatches = computed(() => {
    const start = (safeMismatchPage.value - 1) * PAGE_SIZE
    return sortedMismatches.value.slice(start, start + PAGE_SIZE)
  })

  const paginatedHistory = computed(() => {
    const start = (safeHistoryPage.value - 1) * PAGE_SIZE
    return sortedHistory.value.slice(start, start + PAGE_SIZE)
  })

  // Reset pages when data or filters change
  watch(() => fridges.value.length, () => { inventoryPage.value = 1 })
  watch(inventoryVerifiedFilter, () => { inventoryPage.value = 1 })
  watch(() => mismatches.value.length, () => { mismatchPage.value = 1 })
  watch(() => allHistory.value.length, () => { historyPage.value = 1 })
  watch(historyFilters, () => { historyPage.value = 1 }, { deep: true })

  // ── Export rows ────────────────────────────────────────────────────────────
  const inventoryExportRows = computed(() =>
    sortedFridgeRows.value.map((row) => [
      row.fridge_serial_number,
      row.iot_mac_address || '',
      row.c_number || '',
      row.verified ? 'Verified' : 'Not Verified',
    ])
  )

  const mismatchExportRows = computed(() =>
    sortedMismatches.value.map((row) => [
      row.received_at,
      row.fridge_serial_number,
      row.received_mac || '',
      row.expected_mac ?? row.db_mac ?? '',
      row.received_c_number || '',
      row.expected_c_number ?? row.db_c_number ?? '',
      row.status,
      row.resolved_at || '',
      row.resolved_by || '',
      row.resolution_note || '',
    ])
  )

  const historyExportRows = computed(() =>
    sortedHistory.value.map((entry) => [
      entry.changed_at,
      entry.action_type,
      entry.fridge_serial_number,
      entry.old_mac || '',
      entry.new_mac || '',
      entry.old_c_num || '',
      entry.new_c_num || '',
      entry.changed_by_username ?? 'system',
      entry.deletion_reason || entry.resolution_note || '',
    ])
  )

  // ── Watchers for initial load ──────────────────────────────────────────────
  watchEffect(() => {
    if (!isOrganisationFilterEnabled.value) {
      organisationFilter.value = ''
      organisationOptions.value = []
      organisationsLoading.value = false
      return
    }

    organisationsLoading.value = true
    request<OrganisationOption[]>('/organisations')
      .then((data) => {
        organisationOptions.value = Array.isArray(data) ? data : []
      })
      .catch(() => {
        organisationOptions.value = []
      })
      .finally(() => {
        organisationsLoading.value = false
      })
  })

  watch(
    [() => authStore.session?.user.organisation_id, canCreateAssets, canEditAssets],
    async ([organisationId]) => {
      if (!organisationId || (!canCreateAssets.value && !canEditAssets.value)) {
        actorOrganisationValidationRules.value = null
        actorOrganisationValidationLoading.value = false
        return
      }

      actorOrganisationValidationLoading.value = true
      try {
        const rules = await getOrganisationValidationRules(organisationId)
        actorOrganisationValidationRules.value = rules
      } catch {
        actorOrganisationValidationRules.value = null
      } finally {
        actorOrganisationValidationLoading.value = false
      }
    },
    { immediate: true },
  )

  watch(
    organisationFilter,
    (value) => {
      const normalized = normalizeOrganisationFilterValue(value)
      if (value !== normalized) {
        organisationFilter.value = normalized
      }
    },
    { immediate: false },
  )

  watch(
    [organisationFilter, isOrganisationFilterEnabled, canViewAssets, canViewHistory, canViewMismatches],
    () => {
      if (canViewAssets.value) {
        void loadFridges(searchTerm.value)
      } else {
        fridges.value = []
        fridgeError.value = ''
      }

      if (canViewHistory.value) {
        void loadAllHistory()
      } else {
        allHistory.value = []
        historyError.value = ''
      }

      if (canViewMismatches.value) {
        void loadMismatches()
      } else {
        mismatches.value = []
        mismatchError.value = ''
      }
    },
    { immediate: false },
  )

  return {
    // Permissions
    isOrganisationFilterEnabled, organisationFilter, setOrganisationFilter,
    organisationOptions, organisationsLoading, withOrganisationFilter,
    selectedOrganisationId, effectiveOrganisationIdForMutations,
    mutationOrganisationScopeValue, withMutationOrganisationScope,
    canCreateAssets, canViewAssets, canEditAssets, canDeleteAssets,
    canViewMismatches, canResolveMismatches, canDeleteMismatches,
    canViewHistory, canSubmitDeviceCheck, canSubmitPlacement,

    // Fridges
    fridges, fridgeLoading, fridgeError, searchTerm, loadFridges,
    inventoryVerifiedFilter,
    inventorySort, toggleInventorySort, inventoryPage, safeInventoryPage,
    sortedFridgeRows, paginatedFridgeRows, inventoryTotalPages,

    // Edit / delete
    editingSerial, editForm, editFormErrors, setEditForm, savingEdit, deletingSerial,
    startEdit, cancelEdit, submitEdit, deleteFridge,

    // Bulk selection & operations
    selectedSerials, selectedCount, isAllSelected, isPartialSelected,
    toggleSelectSerial, toggleSelectAll, clearSelection,
    bulkDeleting, bulkMoving, bulkError,
    bulkDeleteFridges, bulkMoveFridges,

    // History
    allHistory, historyLoading, historyError, loadAllHistory,
    historyFilters, filteredHistory,
    historySort, toggleHistorySort, historyPage, safeHistoryPage,
    sortedHistory, paginatedHistory, historyTotalPages,

    // Device history dialog
    deviceHistoryOpen, deviceHistorySerial,
    deviceHistoryRows, deviceHistoryLoading, deviceHistoryError, loadDeviceHistory,

    // Mismatches
    mismatches, mismatchLoading, mismatchError, mismatchFilters, loadMismatches,
    mismatchSort, toggleMismatchSort, mismatchPage, safeMismatchPage,
    sortedMismatches, paginatedMismatches, mismatchTotalPages,

    // Resolve mismatch modal
    resolveModal, openResolveMismatch, submitResolveMismatch,

    // Delete mismatch modal
    deleteMismatchModal, openDeleteMismatch, submitDeleteMismatch,

    // Export
    inventoryExportRows, mismatchExportRows, historyExportRows,

    // Validation
    actorOrganisationValidationRules, actorOrganisationValidationLoading, getOrganisationValidationRules,

    // API helper
    adminRequest,
  }
})
