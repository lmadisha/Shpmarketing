<script setup lang="ts">
import Input from "~/components/ui/Input.vue";
import Button from "~/components/ui/Button.vue";

definePageMeta({ middleware: "guest" });

const authStore = useAuthStore();
const route = useRoute();

const form = reactive({
  username: "",
  password: "",
});
const submitting = ref(false);
const error = ref("");

const nextPath = computed(() =>
  String(route.query.redirect || "/admin/assets/inventory"),
);

async function handleSubmit() {
  submitting.value = true;
  error.value = "";
  try {
    await authStore.login({
      username: form.username.trim(),
      password: form.password,
    });
    await navigateTo(nextPath.value, { replace: true });
  } catch (submitError) {
    error.value =
      submitError instanceof Error ? submitError.message : "Login failed";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12"
  >
    <div class="w-full max-w-sm">
      <!-- Card -->
      <div
        class="rounded-2xl border border-slate-200 bg-white px-8 py-9 shadow-sm"
      >
        <div class="mb-6">
          <img
            src="~/assets/css/img/FrostLinkLogoSymbol.svg"
            alt="FrostLink"
            class="mb-5 h-16 w-auto rounded-lg"
          />
          <h1 class="text-3xl font-bold text-slate-900">Welcome back</h1>
          <p class="mt-1 text-sm text-slate-500">
            Sign in to your account to continue.
          </p>
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div class="space-y-1.5">
            <label
              for="username"
              class="block text-sm font-medium text-slate-700"
              >Email</label
            >
            <Input
              id="username"
              v-model="form.username"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div class="space-y-1.5">
            <label
              for="password"
              class="block text-sm font-medium text-slate-700"
              >Password</label
            >
            <Input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>

          <p
            v-if="error"
            class="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            {{ error }}
          </p>

          <Button
            type="submit"
            size="lg"
            class="mt-1 w-full"
            :disabled="submitting"
          >
            {{ submitting ? "Signing in…" : "Sign in" }}
          </Button>

          <!-- Account creation is managed via the Workspace page -->
        </form>
      </div>
    </div>
  </div>
</template>
