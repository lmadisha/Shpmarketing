<script setup lang="ts">
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Input from '~/components/ui/Input.vue'
import Select from '~/components/ui/Select.vue'
import Label from '~/components/ui/Label.vue'
import Badge from '~/components/ui/Badge.vue'
import ModalDialog from '~/components/ui/ModalDialog.vue'
import AccessDeniedCard from '~/components/auth/AccessDeniedCard.vue'
import { canTargetPermissionLevel, hasPermission, USER_PERMISSION_LEVELS, type PermissionLevel } from '~/utils/permissionPolicy'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

type WorkspaceUser = {
  id: number
  username: string
  full_name: string | null
  permissions: PermissionLevel
  is_active: boolean
  created_at: string
  organisation_id: number | null
  organisation_name?: string | null
}

type OrganisationOption = {
  id: number
  name: string
  domin: string | null
}

const { request } = useApiClient()
const authStore = useAuthStore()

const permissionLevel = computed(() => authStore.session?.user.permissions)
const selfUserId = computed(() => authStore.session?.user.id ?? null)
const selfOrgId = computed(() => authStore.session?.user.organisation_id ?? null)
const isAdmin = computed(() => permissionLevel.value === 'Admin')
const forceOwnOrg = computed(() => !isAdmin.value && selfOrgId.value != null)
const canViewUsers = computed(() => permissionLevel.value ? hasPermission(permissionLevel.value, 'users.view') : false)
const canManageUsers = computed(() => permissionLevel.value ? hasPermission(permissionLevel.value, 'users.manage') : false)
const visiblePermissionLevels = computed(() =>
  permissionLevel.value
    ? USER_PERMISSION_LEVELS.filter((level) => canTargetPermissionLevel(permissionLevel.value!, level))
    : [],
)

const users = ref<WorkspaceUser[]>([])
const organisations = ref<OrganisationOption[]>([])
const loading = ref(false)
const error = ref('')
const searchTerm = ref('')
const permissionFilter = ref<PermissionLevel | 'all'>('all') // kept for backwards compat, unused in template
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const organisationFilter = ref('all')

const createUserOpen = ref(false)
const createError = ref('')
const createSubmitting = ref(false)
const createForm = reactive({
  full_name: '',
  username: '',
  password: '',
  permissions: 'User' as PermissionLevel,
  organisation_id: '',
})

const organisationForm = reactive({
  name: '',
  domin: '',
})
const organisationSaving = ref(false)
const organisationError = ref('')
const deletingOrganisation = ref<OrganisationOption | null>(null)

const permissionTarget = ref<WorkspaceUser | null>(null)
const nextPermission = ref<PermissionLevel>('User')
const permissionSaving = ref(false)
const permissionError = ref('')

const passwordTarget = ref<WorkspaceUser | null>(null)
const newPassword = ref('')
const passwordSaving = ref(false)
const passwordError = ref('')

async function loadUsers() {
  if (!canViewUsers.value) {
    users.value = []
    error.value = 'You do not have permission to view users.'
    return
  }

  loading.value = true
  error.value = ''
  try {
    const path = isAdmin.value && organisationFilter.value !== 'all'
      ? `/users?organisation_id=${encodeURIComponent(organisationFilter.value)}`
      : '/users'
    const data = await request<WorkspaceUser[]>(path)
    users.value = (Array.isArray(data) ? data : []).filter((user) =>
      permissionLevel.value ? canTargetPermissionLevel(permissionLevel.value, user.permissions) : false,
    )
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Could not load users.'
    users.value = []
  } finally {
    loading.value = false
  }
}

async function loadOrganisations() {
  if (!isAdmin.value) {
    organisations.value = []
    organisationFilter.value = 'all'
    return
  }
  try {
    const data = await request<OrganisationOption[]>('/organisations')
    organisations.value = Array.isArray(data) ? data : []
  } catch {
    organisations.value = []
    organisationFilter.value = 'all'
  }
}

const filteredUsers = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  return users.value.filter((user) => {
    if (statusFilter.value === 'active' && !user.is_active) return false
    if (statusFilter.value === 'inactive' && user.is_active) return false
    if (!term) return true
    return [user.full_name || '', user.username, user.organisation_name || '']
      .join(' ')
      .toLowerCase()
      .includes(term)
  })
})

const usersByPermission = computed(() => {
  const map = new Map<PermissionLevel, typeof filteredUsers.value>()
  for (const level of visiblePermissionLevels.value) {
    map.set(level, filteredUsers.value.filter(u => u.permissions === level))
  }
  return map
})

function openCreateUser(defaultPermission?: PermissionLevel) {
  if (defaultPermission) createForm.permissions = defaultPermission
  createUserOpen.value = true
}

async function submitCreateUser() {
  createSubmitting.value = true
  createError.value = ''
  try {
    const organisationId = createForm.organisation_id.trim() !== '' ? Number(createForm.organisation_id) : null
    if (!forceOwnOrg.value && organisationId == null) {
      createError.value = 'Organisation is required.'
      createSubmitting.value = false
      return
    }

    await request('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: createForm.full_name.trim(),
        username: createForm.username.trim(),
        password: createForm.password,
        permissions: createForm.permissions,
        organisation_id: forceOwnOrg.value ? selfOrgId.value : organisationId,
      }),
    })

    createUserOpen.value = false
    createForm.full_name = ''
    createForm.username = ''
    createForm.password = ''
    createForm.permissions = 'User'
    createForm.organisation_id = forceOwnOrg.value ? String(selfOrgId.value || '') : ''
    await loadUsers()
  } catch (submitError) {
    createError.value = submitError instanceof Error ? submitError.message : 'Could not create user.'
  } finally {
    createSubmitting.value = false
  }
}

async function toggleActive(user: WorkspaceUser) {
  try {
    await request(`/users/${user.id}/active`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active }),
    })
    await loadUsers()
  } catch (toggleError) {
    error.value = toggleError instanceof Error ? toggleError.message : 'Could not update user status.'
  }
}

async function submitPermissionChange() {
  if (!permissionTarget.value) return
  permissionSaving.value = true
  permissionError.value = ''
  try {
    await request(`/users/${permissionTarget.value.id}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: nextPermission.value }),
    })
    permissionTarget.value = null
    await loadUsers()
  } catch (submitError) {
    permissionError.value = submitError instanceof Error ? submitError.message : 'Could not update user permission.'
  } finally {
    permissionSaving.value = false
  }
}

async function submitPasswordReset() {
  if (!passwordTarget.value) return
  if (newPassword.value.length < 8) {
    passwordError.value = 'Password must be at least 8 characters.'
    return
  }
  passwordSaving.value = true
  passwordError.value = ''
  try {
    await request(`/users/${passwordTarget.value.id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: newPassword.value }),
    })
    passwordTarget.value = null
    newPassword.value = ''
  } catch (submitError) {
    passwordError.value = submitError instanceof Error ? submitError.message : 'Could not reset password.'
  } finally {
    passwordSaving.value = false
  }
}

async function submitCreateOrganisation() {
  if (!isAdmin.value) return
  organisationSaving.value = true
  organisationError.value = ''
  try {
    await request('/organisations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: organisationForm.name.trim(),
        domin: organisationForm.domin.trim() || null,
      }),
    })
    organisationForm.name = ''
    organisationForm.domin = ''
    await loadOrganisations()
  } catch (submitError) {
    organisationError.value = submitError instanceof Error ? submitError.message : 'Could not create organisation.'
  } finally {
    organisationSaving.value = false
  }
}

async function confirmDeleteOrganisation() {
  if (!deletingOrganisation.value) return
  organisationSaving.value = true
  organisationError.value = ''
  try {
    await request(`/organisations/${deletingOrganisation.value.id}`, { method: 'DELETE' })
    deletingOrganisation.value = null
    await loadOrganisations()
    await loadUsers()
  } catch (deleteError) {
    organisationError.value = deleteError instanceof Error ? deleteError.message : 'Could not delete organisation.'
  } finally {
    organisationSaving.value = false
  }
}

watch([canViewUsers, organisationFilter], () => {
  if (canViewUsers.value) {
    void loadUsers()
  }
}, { immediate: true })

watch(isAdmin, () => {
  if (isAdmin.value) {
    void loadOrganisations()
  }
}, { immediate: true })

onMounted(() => {
  createForm.organisation_id = forceOwnOrg.value ? String(selfOrgId.value || '') : ''
})
</script>

<template>
  <div class="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 lg:p-8">
    <AccessDeniedCard
      v-if="!canViewUsers"
      title="Workspace access denied"
      description="You do not have permission to view workspace users."
    />

    <template v-else>
      <!-- Top bar -->
      <Card>
        <div class="border-b border-slate-200 p-5">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 class="text-2xl font-semibold text-slate-900">Workspace</h1>
              <p class="mt-1 text-sm text-slate-600">Users grouped by permission level.</p>
            </div>
            <div class="flex gap-2">
              <Button variant="outline" :disabled="loading" @click="loadUsers">Refresh</Button>
              <Button v-if="canManageUsers" @click="openCreateUser()">Add User</Button>
            </div>
          </div>
        </div>
        <div class="p-5">
          <div :class="`grid gap-3 ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'}`">
            <Input v-model="searchTerm" placeholder="Search name, email, organisation" />
            <Select
              v-model="statusFilter"
              :options="[
                { value: 'all', label: 'All status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]"
            />
            <Select
              v-if="isAdmin"
              v-model="organisationFilter"
              :options="[
                { value: 'all', label: 'All organisations' },
                ...organisations.map(o => ({ value: String(o.id), label: o.name })),
              ]"
            />
          </div>
          <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
        </div>
      </Card>

      <!-- Organisations (admin only) -->
      <Card v-if="isAdmin">
        <div class="border-b border-slate-200 p-5">
          <h2 class="text-lg font-semibold text-slate-900">Organisations</h2>
          <p class="mt-1 text-sm text-slate-600">Create or delete organisations.</p>
        </div>
        <div class="space-y-4 p-5">
          <div class="grid gap-3 md:grid-cols-4">
            <div class="space-y-1 md:col-span-2">
              <Label for="organisation-name">Organisation Name</Label>
              <Input id="organisation-name" v-model="organisationForm.name" />
            </div>
            <div class="space-y-1">
              <Label for="organisation-domain">Email Domain</Label>
              <Input id="organisation-domain" v-model="organisationForm.domin" placeholder="example.com" />
            </div>
            <div class="flex items-end">
              <Button class="w-full" :disabled="organisationSaving" @click="submitCreateOrganisation">
                {{ organisationSaving ? 'Saving...' : 'Add Organisation' }}
              </Button>
            </div>
          </div>
          <p v-if="organisationError" class="text-sm text-red-600">{{ organisationError }}</p>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200">
              <thead class="bg-slate-50">
                <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th class="px-4 py-3">Name</th>
                  <th class="px-4 py-3">Domain</th>
                  <th class="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 bg-white text-sm text-slate-700">
                <tr v-for="organisation in organisations" :key="organisation.id">
                  <td class="px-4 py-3">{{ organisation.name }}</td>
                  <td class="px-4 py-3">{{ organisation.domin || '-' }}</td>
                  <td class="px-4 py-3 text-right">
                    <Button size="sm" variant="destructive" @click="deletingOrganisation = organisation">Delete</Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <!-- Per-permission sections -->
      <Card v-for="level in visiblePermissionLevels" :key="level">
        <div class="border-b border-slate-200 p-5">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div>
                <h2 class="text-lg font-semibold text-slate-900">{{ level }}</h2>
                <p class="text-sm text-slate-500">
                  {{ (usersByPermission.get(level) ?? []).length }}
                  {{ (usersByPermission.get(level) ?? []).length === 1 ? 'user' : 'users' }}
                </p>
              </div>
            </div>
            <Button v-if="canManageUsers" size="sm" @click="openCreateUser(level)">
              Add {{ level }} User
            </Button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th class="px-4 py-3">Full Name</th>
                <th class="px-4 py-3">Email</th>
                <th v-if="isAdmin" class="px-4 py-3">Organisation</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Created</th>
                <th v-if="canManageUsers" class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white text-sm text-slate-700">
              <tr v-for="user in usersByPermission.get(level)" :key="user.id">
                <td class="px-4 py-3 font-medium">{{ user.full_name || '-' }}</td>
                <td class="px-4 py-3 text-slate-600">{{ user.username }}</td>
                <td v-if="isAdmin" class="px-4 py-3 text-slate-600">{{ user.organisation_name || '-' }}</td>
                <td class="px-4 py-3">
                  <Badge :variant="user.is_active ? 'success' : 'secondary'">{{ user.is_active ? 'Active' : 'Inactive' }}</Badge>
                </td>
                <td class="px-4 py-3 text-slate-600">{{ new Date(user.created_at).toLocaleDateString() }}</td>
                <td v-if="canManageUsers" class="px-4 py-3 text-right">
                  <div class="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="outline" @click="permissionTarget = user; nextPermission = user.permissions">Role</Button>
                    <Button size="sm" variant="outline" @click="passwordTarget = user; newPassword = ''">Password</Button>
                    <Button
                      size="sm"
                      :variant="user.is_active ? 'secondary' : 'success'"
                      :disabled="selfUserId === user.id && user.is_active"
                      @click="toggleActive(user)"
                    >
                      {{ user.is_active ? 'Deactivate' : 'Activate' }}
                    </Button>
                  </div>
                </td>
              </tr>
              <tr v-if="(usersByPermission.get(level) ?? []).length === 0">
                <td :colspan="canManageUsers ? (isAdmin ? 6 : 5) : (isAdmin ? 5 : 4)" class="px-4 py-8 text-center text-sm text-slate-400">
                  No {{ level }} users{{ searchTerm || statusFilter !== 'all' ? ' matching filters' : '' }}.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </template>

    <ModalDialog :open="createUserOpen" title="Create User" description="Create a new workspace user." @close="createUserOpen = false; createForm.permissions = 'User'">
      <div class="space-y-3">
        <div class="space-y-1">
          <Label for="create-full-name">Full Name</Label>
          <Input id="create-full-name" v-model="createForm.full_name" />
        </div>
        <div class="space-y-1">
          <Label for="create-email">Email</Label>
          <Input id="create-email" v-model="createForm.username" type="email" />
        </div>
        <div class="space-y-1">
          <Label for="create-password">Password</Label>
          <Input id="create-password" v-model="createForm.password" type="password" />
        </div>
        <div class="space-y-1">
          <Label for="create-permission">Permission</Label>
          <Select
            id="create-permission"
            v-model="createForm.permissions"
            :options="visiblePermissionLevels.map(l => ({ value: l, label: l }))"
          />
        </div>
        <div class="space-y-1">
          <Label for="create-org">Organisation</Label>
          <Select
            id="create-org"
            v-model="createForm.organisation_id"
            :disabled="forceOwnOrg"
            :options="[
              { value: '', label: 'Select organisation' },
              ...organisations.map(o => ({ value: String(o.id), label: o.name })),
            ]"
          />
        </div>
        <p v-if="createError" class="text-sm text-red-600">{{ createError }}</p>
      </div>
      <template #footer>
        <Button variant="outline" @click="createUserOpen = false">Cancel</Button>
        <Button :disabled="createSubmitting" @click="submitCreateUser">{{ createSubmitting ? 'Creating...' : 'Create User' }}</Button>
      </template>
    </ModalDialog>

    <ModalDialog :open="Boolean(permissionTarget)" title="Update User Permission" description="Change the assigned role for this user." @close="permissionTarget = null">
      <div class="space-y-3">
        <p class="text-sm text-slate-500">{{ permissionTarget?.username }}</p>
        <Select
          v-model="nextPermission"
          :options="visiblePermissionLevels.map(l => ({ value: l, label: l }))"
        />
        <p v-if="permissionError" class="text-sm text-red-600">{{ permissionError }}</p>
      </div>
      <template #footer>
        <Button variant="outline" @click="permissionTarget = null">Cancel</Button>
        <Button :disabled="permissionSaving" @click="submitPermissionChange">{{ permissionSaving ? 'Saving...' : 'Save' }}</Button>
      </template>
    </ModalDialog>

    <ModalDialog :open="Boolean(passwordTarget)" title="Reset User Password" description="Set a new password for this user." @close="passwordTarget = null">
      <div class="space-y-3">
        <Input v-model="newPassword" type="password" placeholder="New password (min 8 characters)" />
        <p v-if="passwordError" class="text-sm text-red-600">{{ passwordError }}</p>
      </div>
      <template #footer>
        <Button variant="outline" @click="passwordTarget = null">Cancel</Button>
        <Button :disabled="passwordSaving" @click="submitPasswordReset">{{ passwordSaving ? 'Updating...' : 'Update Password' }}</Button>
      </template>
    </ModalDialog>

    <ModalDialog
      :open="Boolean(deletingOrganisation)"
      title="Delete Organisation"
      description="This action is blocked if users or fridges are still linked."
      @close="deletingOrganisation = null"
    >
      <p class="text-sm text-slate-600">Delete {{ deletingOrganisation?.name }}?</p>
      <template #footer>
        <Button variant="outline" @click="deletingOrganisation = null">Cancel</Button>
        <Button variant="destructive" :disabled="organisationSaving" @click="confirmDeleteOrganisation">
          {{ organisationSaving ? 'Deleting...' : 'Delete' }}
        </Button>
      </template>
    </ModalDialog>
  </div>
</template>
