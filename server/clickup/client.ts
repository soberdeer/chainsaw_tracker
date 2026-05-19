import { ClickUpApiError, ClickUpConfigError } from './errors.js';

// Migration-only helper for scripts/seed-openproject-from-clickup.ts.
// The tracker runtime is OpenProject-backed and does not import this module.
const baseUrl = 'https://api.clickup.com/api/v2';
const timeoutMs = Number(process.env.CLICKUP_TIMEOUT_MS || 15000);

function token() {
  const value = process.env.CLICKUP_TOKEN;
  if (!value) {
    throw new ClickUpConfigError();
  }
  return value;
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean | Array<string | number> | undefined | null>
) {
  const url = new URL(`${baseUrl}${path}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)));
    } else {
      url.searchParams.set(key, String(value));
    }
  });
  return url;
}

export async function clickUpRequest<T>(
  path: string,
  options: {
    method?: string;
    query?: Record<string, string | number | boolean | Array<string | number> | undefined | null>;
    body?: unknown;
    retry?: boolean;
  } = {}
): Promise<T> {
  const method = options.method || 'GET';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = buildUrl(path, options.query);

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: token(),
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const message = payload?.err || payload?.error || payload?.ECODE || response.statusText;
      console.warn(`ClickUp API ${method} ${url.pathname} failed with ${response.status}`);
      throw new ClickUpApiError(response.status, String(message), payload);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ClickUpApiError || error instanceof ClickUpConfigError) {
      throw error;
    }
    if ((error as Error).name === 'AbortError') {
      throw new ClickUpApiError(504, 'ClickUp API request timed out');
    }
    throw new ClickUpApiError(502, 'ClickUp API request failed');
  } finally {
    clearTimeout(timeout);
  }
}
