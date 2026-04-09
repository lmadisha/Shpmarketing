export function useAnalyticsClient() {
  const config = useRuntimeConfig()
  const API_BASE = config.public.analyticsApiBase || 'http://localhost:5002'

  const request = async <T>(path: string): Promise<T> => {
    const response = await fetch(`${API_BASE}${path}`)

    const rawBody = await response.text()
    let data: unknown = null
    try {
      data = rawBody ? JSON.parse(rawBody) : null
    } catch {
      data = null
    }

    if (!response.ok) {
      const message =
        (data && typeof data === 'object' && 'error' in data && String((data as Record<string, unknown>).error)) ||
        `${response.status} ${response.statusText}`
      throw new Error(message)
    }

    return data as T
  }

  return { request }
}
