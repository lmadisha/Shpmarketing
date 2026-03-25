import { useAuth } from "./auth-context";
import { loggedFetch } from "./logged-fetch";

const API_BASE =
  (import.meta.env.VITE_OPERATIONS_API_BASE as string | undefined) ||
  "http://localhost:5001";

type ApiRequestOptions = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
};

export function useApiClient() {
  const { session, logout } = useAuth();

  const request = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
    const { headers: extraHeaders, ...rest } = options;

    const response = await loggedFetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...(extraHeaders || {}),
      },
    });

    if (response.status === 401) {
      logout();
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
          (("message" in data && String(data.message)) ||
            ("error" in data && String(data.error)))) ||
        "";

      const fallbackMessage = rawBody
        ? `${response.status} ${response.statusText}: ${rawBody.slice(0, 220)}`
        : `${response.status} ${response.statusText}`;

      if (response.status === 403) {
        throw new Error(structuredMessage || "You do not have permission for this action.");
      }

      throw new Error(structuredMessage || fallbackMessage || "Request failed");
    }

    return data as T;
  };

  return { request };
}
