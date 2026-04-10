<script setup lang="ts">
import { Settings as SettingsIcon, User } from "lucide-vue-next";
import Card from "~/components/ui/Card.vue";
import Button from "~/components/ui/Button.vue";
import Input from "~/components/ui/Input.vue";
import Label from "~/components/ui/Label.vue";
import OrganisationAssetValidationSettingsCard from "~/components/settings/OrganisationAssetValidationSettingsCard.vue";
import { hasPermission } from "~/utils/permissionPolicy";

definePageMeta({ layout: "dashboard", middleware: "auth" });

type ProfileDetails = {
  id: number;
  username: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  permissions: string;
  organisation_id: number | null;
  organisation_name: string | null;
  organisation_domin: string | null;
};

const { request } = useApiClient();
const authStore = useAuthStore();
const config = useRuntimeConfig();
const canViewTotalUnits = computed(() =>
  authStore.session?.user.permissions
    ? hasPermission(authStore.session.user.permissions, "assets.view")
    : false,
);

const totalUnits = ref<number | null>(null);

async function loadStats() {
  if (!canViewTotalUnits.value) return;
  try {
    const data = await request<{ total_units: number }>("/stats");
    totalUnits.value = data.total_units;
  } catch {
    totalUnits.value = null;
  }
}

const profile = ref<ProfileDetails | null>(null);
const profileLoading = ref(false);
const profileError = ref("");
const profileSaving = ref(false);
const profileSaveError = ref("");
const profileSaveSuccess = ref("");
const passwordSaving = ref(false);
const passwordError = ref("");
const passwordSuccess = ref("");

const profileForm = reactive({
  first_name: "",
  last_name: "",
  username: "",
});

const passwordForm = reactive({
  new_password: "",
  confirm_password: "",
});

async function loadProfile() {
  profileLoading.value = true;
  profileError.value = "";
  try {
    const data = await request<ProfileDetails>("/profile");
    profile.value = data;
    profileForm.first_name = data.first_name || "";
    profileForm.last_name = data.last_name || "";
    profileForm.username = data.username || "";
  } catch (error) {
    profileError.value =
      error instanceof Error
        ? error.message
        : "Could not load profile details.";
  } finally {
    profileLoading.value = false;
  }
}

async function submitProfileUpdate() {
  profileSaving.value = true;
  profileSaveError.value = "";
  profileSaveSuccess.value = "";
  try {
    const updatedProfile = await request<ProfileDetails>("/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: profileForm.username.trim(),
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
      }),
    });
    profile.value = updatedProfile;
    profileSaveSuccess.value = "Profile updated.";
    if (authStore.session) {
      authStore.setSession({
        ...authStore.session,
        user: {
          ...authStore.session.user,
          username: updatedProfile.username,
          full_name: updatedProfile.full_name,
        },
      });
    }
  } catch (error) {
    profileSaveError.value =
      error instanceof Error
        ? error.message
        : "Could not update profile details.";
  } finally {
    profileSaving.value = false;
  }
}

async function submitPasswordChange() {
  const userId = authStore.session?.user.id;
  if (!userId) {
    passwordError.value = "Could not resolve current user.";
    return;
  }
  if (passwordForm.new_password.length < 8) {
    passwordError.value = "Password must be at least 8 characters.";
    return;
  }
  if (passwordForm.new_password !== passwordForm.confirm_password) {
    passwordError.value = "Passwords do not match.";
    return;
  }
  passwordSaving.value = true;
  passwordError.value = "";
  passwordSuccess.value = "";
  try {
    await request(`/users/${userId}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: passwordForm.new_password }),
    });
    passwordForm.new_password = "";
    passwordForm.confirm_password = "";
    passwordSuccess.value = "Password updated.";
  } catch (error) {
    passwordError.value =
      error instanceof Error ? error.message : "Could not update password.";
  } finally {
    passwordSaving.value = false;
  }
}

onMounted(() => {
  void loadProfile();
  void loadStats();
});
</script>

<template>
  <div class="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 lg:p-8">
    <div>
      <div class="flex items-center gap-3">
        <SettingsIcon class="h-6 w-6 text-[#006aea]" />
        <h1 class="text-2xl font-semibold text-slate-900">Settings</h1>
      </div>
      <p class="mt-1 pl-9 text-sm text-slate-600">
        Profile, security, and data validation configuration.
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[2.2fr_0.8fr]">
      <div class="space-y-6">
        <Card>
          <div class="border-b border-slate-200 p-5">
            <div class="flex items-center gap-2">
              <User class="h-4 w-4 text-[#006aea]" />
              <h2 class="text-lg font-semibold text-slate-900">
                Profile Settings
              </h2>
            </div>
          </div>
          <div class="space-y-4 p-5">
            <p v-if="profileError" class="text-sm text-red-600">
              {{ profileError }}
            </p>
            <p v-if="profileSaveError" class="text-sm text-red-600">
              {{ profileSaveError }}
            </p>
            <p v-if="profileSaveSuccess" class="text-sm text-emerald-600">
              {{ profileSaveSuccess }}
            </p>

            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-1">
                <Label for="first-name">First Name</Label>
                <Input id="first-name" v-model="profileForm.first_name" />
              </div>
              <div class="space-y-1">
                <Label for="last-name">Last Name</Label>
                <Input id="last-name" v-model="profileForm.last_name" />
              </div>
            </div>
            <div class="space-y-1">
              <Label for="email">Email</Label>
              <Input id="email" v-model="profileForm.username" type="email" />
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-1">
                <Label for="role">Role</Label>
                <Input
                  id="role"
                  :model-value="profile?.permissions || ''"
                  readonly
                />
              </div>
              <div class="space-y-1">
                <Label for="organisation">Organisation</Label>
                <Input
                  id="organisation"
                  :model-value="profile?.organisation_name || ''"
                  readonly
                />
              </div>
            </div>
            <div class="flex gap-2">
              <Button
                :disabled="profileSaving || profileLoading"
                @click="submitProfileUpdate"
                >{{ profileSaving ? "Saving..." : "Save Profile" }}</Button
              >
              <Button
                variant="outline"
                :disabled="profileSaving || profileLoading"
                @click="loadProfile"
                >{{
                  profileLoading ? "Refreshing..." : "Refresh Profile"
                }}</Button
              >
            </div>

            <div class="border-t border-slate-200 pt-4">
              <h3 class="text-sm font-semibold text-slate-900">
                Change Password
              </h3>
              <div class="mt-3 space-y-3">
                <div class="space-y-1">
                  <Label for="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    v-model="passwordForm.new_password"
                    type="password"
                  />
                </div>
                <div class="space-y-1">
                  <Label for="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    v-model="passwordForm.confirm_password"
                    type="password"
                  />
                </div>
                <p v-if="passwordError" class="text-sm text-red-600">
                  {{ passwordError }}
                </p>
                <p v-if="passwordSuccess" class="text-sm text-emerald-600">
                  {{ passwordSuccess }}
                </p>
                <Button
                  :disabled="passwordSaving"
                  @click="submitPasswordChange"
                  >{{
                    passwordSaving ? "Updating..." : "Update Password"
                  }}</Button
                >
              </div>
            </div>
          </div>
        </Card>

        <OrganisationAssetValidationSettingsCard />
      </div>

      <Card>
        <div class="border-b border-slate-200 p-5">
          <div class="flex items-center gap-2">
            <SettingsIcon class="h-4 w-4 text-[#006aea]" />
            <h2 class="text-lg font-semibold text-slate-900">System Info</h2>
          </div>
        </div>
        <div class="space-y-4 p-5 text-sm">
          <div>
            <p class="text-slate-500">Version</p>
            <p class="font-medium text-slate-900">v{{ config.public.appVersion }}</p>
          </div>
          <div v-if="canViewTotalUnits">
            <p class="text-slate-500">Total Units</p>
            <p class="font-medium text-slate-900">
              {{ totalUnits !== null ? totalUnits : "—" }}
            </p>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
