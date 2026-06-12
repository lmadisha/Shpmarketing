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
      let message = `${response.status} ${response.statusText}`
      if (data && typeof data === 'object' && 'error' in data) {
        const errorValue = (data as Record<string, unknown>).error
        if (errorValue != null) {
          message = String(errorValue)
        }
      }
      throw new Error(message)
    }

    return data as T
  }

  return { request }
}
