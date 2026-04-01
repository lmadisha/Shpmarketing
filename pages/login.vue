<script setup lang="ts">
import Card from '~/components/ui/Card.vue'
import Input from '~/components/ui/Input.vue'
import Button from '~/components/ui/Button.vue'
import Label from '~/components/ui/Label.vue'

definePageMeta({ middleware: 'guest' })

const authStore = useAuthStore()
const route = useRoute()

const form = reactive({
  username: '',
  password: '',
})
const submitting = ref(false)
const error = ref('')

const nextPath = computed(() => String(route.query.redirect || '/admin/assets/inventory'))

async function handleSubmit() {
  submitting.value = true
  error.value = ''
  try {
    await authStore.login({
      username: form.username.trim(),
      password: form.password,
    })
    await navigateTo(nextPath.value, { replace: true })
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : 'Login failed'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
    <Card class="w-full max-w-md">
      <div class="p-8">
        <div class="mb-6 flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white">
            FL
          </div>
          <div>
            <p class="text-base font-semibold text-slate-900">Frostlink</p>
            <p class="text-xs text-slate-500">Operations Platform</p>
          </div>
        </div>
        <h1 class="text-2xl font-semibold text-slate-900">Welcome back</h1>
        <p class="mt-2 text-sm text-slate-600">Sign in to access the operations dashboard.</p>

        <form class="mt-6 space-y-4" @submit.prevent="handleSubmit">
          <div class="space-y-2">
            <Label for="username">Email</Label>
            <Input id="username" v-model="form.username" type="email" autocomplete="email" required />
          </div>
          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input id="password" v-model="form.password" type="password" autocomplete="current-password" required />
          </div>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          <Button type="submit" class="w-full" :disabled="submitting">
            {{ submitting ? 'Signing in...' : 'Sign in' }}
          </Button>
          <!-- Account creation is managed via the Workspace page -->
          <!--
          <p class="text-center text-sm text-slate-600">
            Need an account?
            <NuxtLink to="/signup" class="font-medium text-blue-600 hover:underline">Create one</NuxtLink>
          </p>
          -->
        </form>
      </div>
    </Card>
  </div>
</template>
