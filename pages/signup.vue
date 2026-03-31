<script setup lang="ts">
import Card from '~/components/ui/Card.vue'
import Input from '~/components/ui/Input.vue'
import Select from '~/components/ui/Select.vue'
import Button from '~/components/ui/Button.vue'
import Label from '~/components/ui/Label.vue'
import { USER_PERMISSION_LEVELS, type PermissionLevel } from '~/utils/permissionPolicy'

definePageMeta({ middleware: 'guest' })

type OrganisationOption = {
  id: number
  name: string
  domin: string | null
}

const authStore = useAuthStore()
const apiBase = useRuntimeConfig().public.operationsApiBase || 'http://localhost:5001'

const form = reactive({
  full_name: '',
  username: '',
  password: '',
  permissions: 'User' as PermissionLevel,
  organisation_id: '',
})

const organisations = ref<OrganisationOption[]>([])
const organisationsLoading = ref(false)
const submitting = ref(false)
const error = ref('')

async function loadOrganisations() {
  organisationsLoading.value = true
  error.value = ''
  try {
    const response = await loggedFetch(`${apiBase}/organisations`)
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(
        (data && typeof data === 'object' && 'error' in data && String((data as Record<string, unknown>).error)) ||
        'Could not load organisations',
      )
    }
    organisations.value = Array.isArray(data) ? data : []
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Could not load organisations'
  } finally {
    organisationsLoading.value = false
  }
}

async function handleSubmit() {
  submitting.value = true
  error.value = ''

  const organisationId = Number(form.organisation_id)
  if (!Number.isInteger(organisationId) || organisationId <= 0) {
    error.value = 'Please select an organisation.'
    submitting.value = false
    return
  }

  try {
    await authStore.signup({
      full_name: form.full_name.trim(),
      username: form.username.trim(),
      password: form.password,
      permissions: form.permissions,
      organisation_id: organisationId,
    })
    await navigateTo('/admin/assets/inventory', { replace: true })
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : 'Signup failed'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void loadOrganisations()
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
    <Card class="w-full max-w-xl">
      <div class="p-8">
        <h1 class="text-2xl font-semibold text-slate-900">Create account</h1>
        <p class="mt-2 text-sm text-slate-600">Register for Frostlink access.</p>

        <form class="mt-6 space-y-4" @submit.prevent="handleSubmit">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <Label for="full_name">Full name</Label>
              <Input id="full_name" v-model="form.full_name" required />
            </div>
            <div class="space-y-2">
              <Label for="signup_email">Email</Label>
              <Input id="signup_email" v-model="form.username" type="email" required />
            </div>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <Label for="signup_password">Password</Label>
              <Input id="signup_password" v-model="form.password" type="password" required />
            </div>
            <div class="space-y-2">
              <Label for="permission">Permission</Label>
              <Select
                id="permission"
                v-model="form.permissions"
                :options="USER_PERMISSION_LEVELS.map(p => ({ value: p, label: p }))"
              />
            </div>
          </div>
          <div class="space-y-2">
            <Label for="organisation">Organisation</Label>
            <Select
              id="organisation"
              v-model="form.organisation_id"
              :disabled="organisationsLoading"
              :options="[
                { value: '', label: organisationsLoading ? 'Loading organisations...' : 'Select organisation' },
                ...organisations.map(o => ({ value: String(o.id), label: o.name + (o.domin ? ` (${o.domin})` : '') })),
              ]"
            />
          </div>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          <Button type="submit" class="w-full" :disabled="submitting">
            {{ submitting ? 'Creating account...' : 'Create account' }}
          </Button>
          <p class="text-center text-sm text-slate-600">
            Already have an account?
            <NuxtLink to="/login" class="font-medium text-blue-600 hover:underline">Sign in</NuxtLink>
          </p>
        </form>
      </div>
    </Card>
  </div>
</template>
