import { loggedFetch } from '~/utils/loggedFetch'
import { useAuthStore } from '~/stores/auth'

type ApiRequestOptions = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
};

export function useApiClient() {
  const authStore = useAuthStore();
  const config = useRuntimeConfig();
  const API_BASE = config.public.operationsApiBase || "http://localhost:5001";

  const request = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
    const { headers: extraHeaders, ...rest } = options;

    const response = await loggedFetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        ...(authStore.session?.token ? { Authorization: `Bearer ${authStore.session.token}` } : {}),
        ...(extraHeaders || {}),
      },
    });

    if (response.status === 401) {
      authStore.logout();
      throw new Error("Your session has expired. Please sign in again.");
    }

    const rawBody = await response.text();
    let data: unknown = null;
    try {
      data = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const structuredMessage =
        (data &&
          typeof data === "object" &&
          (("message" in data && String((data as Record<string, unknown>).message)) ||
            ("error" in data && String((data as Record<string, unknown>).error)))) ||
        ""

      const fallbackMessage = rawBody
        ? `${response.status} ${response.statusText}: ${rawBody.slice(0, 220)}`
        : `${response.status} ${response.statusText}`;

      if (response.status === 403) {
        throw new Error(String(structuredMessage || "You do not have permission for this action."));
      }

      throw new Error(String(structuredMessage || fallbackMessage || "Request failed"));
    }

    return data as T;
  };

  return { request };
}
