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
  MenuIcon,
} from "lucide-vue-next";
import { cn } from "~/utils/cn";
import { useAuth } from "~/composables/useAuth";
import { hasPermission } from "~/utils/permissionPolicy";

type NavigationItem = {
  name: string;
  href: string;
  icon: Component;
  disabled?: boolean;
  hidden?: boolean;
};

const navigation: NavigationItem[] = [
  // { name: "Overview", href: "/overview", icon: LayoutDashboard },
  { name: "Performance", href: "/performance-report", icon: FileBarChart },
  // { name: "Maintenance", href: "/maintenance-report", icon: Server },
  { name: "Unit Detail", href: "/unit/[unitId]", icon: Server },
  { name: "Asset Manager", href: "/admin/assets", icon: Refrigerator },
  { name: "Workspace", href: "/workspace", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

const route = useRoute();
const auth = useAuth();
const isOpen = ref(false);
const isCollapsed = ref(false);

const permissionLevel = computed(() => auth.session?.user.permissions);

const canAccessAssetManager = computed(() =>
  permissionLevel.value
    ? (
        [
          "assets.create",
          "assets.view",
          "mismatches.view",
          "device_checker.submit",
          "history.view",
        ] as const
      ).some((flag) => hasPermission(permissionLevel.value!, flag))
    : false,
);

const canAccessWorkspace = computed(() =>
  permissionLevel.value
    ? hasPermission(permissionLevel.value, "users.view")
    : false,
);

function isActive(href: string) {
  if (href === "/") return route.path === "/";
  return route.path === href || route.path.startsWith(href);
}

function handleLogout() {
  auth.logout();
  isOpen.value = false;
  navigateTo("/login");
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
    :class="
      cn(
        'bg-white border-r border-slate-200 flex flex-col max-lg:fixed inset-y-0 left-0 z-40 transition-all duration-300 ease-in-out shrink-0',
        !isOpen && 'max-lg:-translate-x-full',
        isCollapsed ? 'w-20' : 'w-64',
      )
    "
  >
    <div
      :class="
        cn(
          'h-18 flex items-center border-b border-slate-200',
          isCollapsed ? 'justify-center px-3' : 'px-4 justify-between',
        )
      "
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <img
          src="~/assets/css/img/FrostLinkLogoSymbol.svg"
          alt="Frostlink"
          :class="
            cn('h-12 w-12 shrink-0 rounded-sm', isCollapsed && 'cursor-pointer')
          "
          @click="isCollapsed ? (isCollapsed = false) : undefined"
        />
        <span
          v-if="!isCollapsed"
          class="text-xl font-semibold text-slate-900 truncate"
          >Frostlink</span
        >
      </div>
      <button
        v-if="!isCollapsed"
        class="hidden lg:flex shrink-0 h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        @click="isCollapsed = !isCollapsed"
        title="Collapse Sidebar"
      >
        <ChevronLeft class="w-4 h-4" />
      </button>
    </div>

    <nav class="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
      <template v-for="item in navigation" :key="item.name">
        <template v-if="!item.hidden">
          <template
            v-if="!(item.href === '/admin/assets' && !canAccessAssetManager)"
          >
            <template
              v-if="!(item.href === '/workspace' && !canAccessWorkspace)"
            >
              <!-- Disabled item -->
              <div
                v-if="item.disabled"
                :class="
                  cn(
                    'flex items-center rounded-lg text-sm text-slate-400 cursor-not-allowed opacity-60',
                    isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5',
                  )
                "
                :title="isCollapsed ? item.name : undefined"
              >
                <component
                  :is="item.icon"
                  :class="cn('shrink-0', isCollapsed ? 'w-6 h-6' : 'w-5 h-5')"
                />
                <span v-if="!isCollapsed" class="truncate">{{
                  item.name
                }}</span>
              </div>

              <!-- Active nav link -->
              <NuxtLink
                v-else
                :to="item.href"
                :class="
                  cn(
                    'flex items-center rounded-lg transition-colors text-sm font-medium',
                    isActive(item.href)
                      ? 'bg-[#006aea]/10 text-[#006aea]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5',
                  )
                "
                :title="isCollapsed ? item.name : undefined"
                @click="isOpen = false"
              >
                <component
                  :is="item.icon"
                  :class="cn('shrink-0', isCollapsed ? 'w-5 h-5' : 'w-5 h-5')"
                />
                <span v-if="!isCollapsed" class="truncate">{{
                  item.name
                }}</span>
              </NuxtLink>
            </template>
          </template>
        </template>
      </template>
    </nav>

    <div
      :class="
        cn(
          'border-t border-slate-200',
          isCollapsed ? 'p-3 space-y-3' : 'p-4 space-y-3',
        )
      "
    >
      <div v-if="!isCollapsed">
        <p class="text-sm font-semibold text-slate-900 truncate">
          {{ auth.session?.user.full_name || auth.session?.user.username }}
        </p>
        <p class="text-xs text-slate-500 truncate">
          {{ auth.session?.user.permissions }}
        </p>
      </div>
      <button
        type="button"
        :class="
          cn(
            'w-full flex items-center border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all text-sm',
            isCollapsed
              ? 'justify-center px-0 py-2.5'
              : 'justify-start gap-2 px-3 py-2.5',
          )
        "
        @click="handleLogout"
        :title="isCollapsed ? 'Sign out' : undefined"
      >
        <LogOut class="w-4 h-4 shrink-0" />
        <span v-if="!isCollapsed">Sign out</span>
      </button>
    </div>
  </aside>
</template>
