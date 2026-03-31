<script setup lang="ts">
import {
  LayoutDashboard,
  FileBarChart,
  Server,
  Settings,
  Refrigerator,
  Users,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-vue-next'
import { cn } from '~/utils/cn'
import { useAuth } from '~/composables/useAuth'
import { hasPermission } from '~/utils/permissionPolicy'

type NavigationItem = {
  name: string;
  href: string;
  icon: Component;
  disabled?: boolean;
  hidden?: boolean;
};

const navigation: NavigationItem[] = [
  { name: 'Overview', href: '/overview', icon: LayoutDashboard },
  { name: 'Performance', href: '/performance-report', icon: FileBarChart },
  { name: 'Maintenance', href: '/maintenance-report', icon: Server },
  { name: 'Asset Manager', href: '/admin/assets', icon: Refrigerator },
  { name: 'Workspace', href: '/workspace', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const route = useRoute();
const auth = useAuth();
const isOpen = ref(false);
const isCollapsed = ref(false);

const permissionLevel = computed(() => auth.session?.user.permissions);

const canAccessAssetManager = computed(() =>
  permissionLevel.value
    ? (['assets.create', 'assets.view', 'mismatches.view', 'device_checker.submit', 'history.view'] as const)
        .some((flag) => hasPermission(permissionLevel.value!, flag))
    : false
);

const canAccessWorkspace = computed(() =>
  permissionLevel.value ? hasPermission(permissionLevel.value, 'users.view') : false
);

function isActive(href: string) {
  if (href === '/') return route.path === '/';
  return route.path === href || route.path.startsWith(href);
}

function handleLogout() {
  auth.logout();
  isOpen.value = false;
  navigateTo('/login');
}
</script>

<template>
  <!-- Mobile Menu Button -->
  <button
    class="fixed top-4 left-4 z-50 lg:hidden bg-white shadow-md rounded-md p-2"
    @click="isOpen = !isOpen"
  >
    <X v-if="isOpen" class="w-5 h-5" />
    <Menu v-else class="w-5 h-5" />
  </button>

  <!-- Overlay for mobile -->
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 z-30 lg:hidden"
    @click="isOpen = false"
  />

  <!-- Sidebar -->
  <aside
    :class="cn(
      'bg-white border-r border-gray-200 flex flex-col fixed lg:static inset-y-0 left-0 z-40 transition-all duration-300 ease-in-out shrink-0',
      !isOpen && '-translate-x-full lg:translate-x-0',
      isCollapsed ? 'w-20' : 'w-64'
    )"
  >
    <div :class="cn('h-16 flex items-center border-b border-gray-200', isCollapsed ? 'justify-center px-0' : 'px-6 justify-between')">
      <span v-if="isCollapsed" class="font-bold text-xl text-blue-600">F</span>
      <h1 v-else class="text-xl font-semibold text-gray-900 truncate pr-2">Frostlink</h1>
      <button
        class="hidden lg:flex shrink-0 h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100"
        :class="isCollapsed ? '' : '-mr-2'"
        @click="isCollapsed = !isCollapsed"
        :title="isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
      >
        <ChevronRight v-if="isCollapsed" class="w-5 h-5" />
        <ChevronLeft v-else class="w-5 h-5" />
      </button>
    </div>

    <nav class="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
      <template v-for="item in navigation" :key="item.name">
        <template v-if="!item.hidden">
          <template v-if="!(item.href === '/admin/assets' && !canAccessAssetManager)">
            <template v-if="!(item.href === '/workspace' && !canAccessWorkspace)">
              <!-- Disabled item -->
              <div
                v-if="item.disabled"
                :class="cn(
                  'flex items-center rounded-lg text-sm text-gray-400 cursor-not-allowed opacity-60',
                  isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
                )"
                :title="isCollapsed ? item.name : undefined"
              >
                <component :is="item.icon" :class="cn('shrink-0', isCollapsed ? 'w-6 h-6' : 'w-5 h-5')" />
                <span v-if="!isCollapsed" class="truncate">{{ item.name }}</span>
              </div>

              <!-- Active nav link -->
              <NuxtLink
                v-else
                :to="item.href"
                :class="cn(
                  'flex items-center rounded-lg transition-colors text-sm',
                  isActive(item.href)
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100',
                  isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
                )"
                :title="isCollapsed ? item.name : undefined"
                @click="isOpen = false"
              >
                <component :is="item.icon" :class="cn('shrink-0', isCollapsed ? 'w-6 h-6' : 'w-5 h-5')" />
                <span v-if="!isCollapsed" class="truncate">{{ item.name }}</span>
              </NuxtLink>
            </template>
          </template>
        </template>
      </template>
    </nav>

    <div :class="cn('border-t border-gray-200 space-y-3', isCollapsed ? 'p-3' : 'p-4')">
      <div v-if="!isCollapsed">
        <p class="text-sm font-medium text-gray-900 truncate">{{ auth.session?.user.full_name || auth.session?.user.username }}</p>
        <p class="text-xs text-gray-600 truncate">Role: {{ auth.session?.user.permissions }}</p>
      </div>
      <button
        type="button"
        :class="cn('w-full flex items-center border border-gray-200 rounded-md hover:bg-gray-50 transition-all', isCollapsed ? 'justify-center px-0 py-2' : 'justify-start gap-2 px-3 py-2')"
        @click="handleLogout"
        :title="isCollapsed ? 'Sign out' : undefined"
      >
        <LogOut class="w-4 h-4 shrink-0" />
        <span v-if="!isCollapsed">Sign out</span>
      </button>
    </div>
  </aside>
</template>
