const API_LOG_PREFIX = "[api-client]";

function getRequestMethod(init?: RequestInit) {
  return String(init?.method || "GET").toUpperCase();
}

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function getDurationMs(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}

function buildNetworkErrorMessage(url: string) {
  return `Cannot reach the operations API at ${url}. Check that the API server is running and reachable from the browser.`;
}

export async function loggedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const method = getRequestMethod(init);
  const url = getRequestUrl(input);
  const startedAt = performance.now();

  console.info(`${API_LOG_PREFIX} ${method} ${url} started`);

  try {
    const response = await fetch(input, init);
    const durationMs = getDurationMs(startedAt);
    const message = `${API_LOG_PREFIX} ${method} ${url} -> ${response.status} ${response.statusText} in ${durationMs}ms`;

    if (response.ok) {
      console.info(message);
    } else {
      console.error(message);
    }

    return response;
  } catch (error) {
    const durationMs = getDurationMs(startedAt);
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`${API_LOG_PREFIX} ${method} ${url} failed in ${durationMs}ms: ${reason}`);

    if (error instanceof TypeError) {
      throw new Error(buildNetworkErrorMessage(url));
    }

    throw error;
  }
}
