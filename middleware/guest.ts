import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware(() => {
  const authStore = useAuthStore();

  if (!authStore.isHydrated) {
    return;
  }

  if (authStore.session) {
    return navigateTo('/admin/assets/inventory', { replace: true });
  }
});
