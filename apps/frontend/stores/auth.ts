import { defineStore } from 'pinia'
import { loggedFetch } from '~/utils/loggedFetch'
import type { PermissionLevel } from '~/utils/permissionPolicy'

export type AuthUser = {
  id: number;
  username: string;
  full_name?: string | null;
  permissions: PermissionLevel;
  organisation_id?: number | null;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type SignupPayload = {
  full_name: string;
  username: string;
  password: string;
  permissions: PermissionLevel;
  organisation_id: number;
};

const STORAGE_KEY = "shpmarketing.auth";

export const useAuthStore = defineStore('auth', () => {
  const session = ref<AuthSession | null>(null);
  const isHydrated = ref(false);

  function getApiBase() {
    const config = useRuntimeConfig();
    return config.public.operationsApiBase || "http://localhost:5001";
  }

  async function callPublicAuth<T>(path: string, body: object): Promise<T> {
    const apiBase = getApiBase();
    const response = await loggedFetch(`${apiBase}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        (data &&
          typeof data === "object" &&
          (("message" in data && String((data as Record<string, unknown>).message)) ||
            ("error" in data && String((data as Record<string, unknown>).error)))) ||
        "Request failed";
      throw new Error(message);
    }

    return data as T;
  }

  function setSession(nextSession: AuthSession | null) {
    session.value = nextSession;
    if (nextSession) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  function hydrateFromStorage() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      isHydrated.value = true;
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AuthSession;
      if (parsed?.token && parsed?.user?.username) {
        session.value = parsed;
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    } finally {
      isHydrated.value = true;
    }
  }

  function logout() {
    setSession(null);
  }

  async function login(payload: LoginPayload): Promise<AuthSession> {
    const result = await callPublicAuth<AuthSession>("/login", payload);
    setSession(result);
    return result;
  }

  async function signup(payload: SignupPayload): Promise<AuthSession> {
    const result = await callPublicAuth<AuthSession>("/signup", payload);
    setSession(result);
    return result;
  }

  return {
    session,
    isHydrated,
    setSession,
    hydrateFromStorage,
    logout,
    login,
    signup,
  };
});
