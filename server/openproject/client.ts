import { OpenProjectApiError, OpenProjectConfigError } from './errors.js';

const defaultBaseUrl = 'http://localhost:8080';
const timeoutMs = Number(process.env.OPENPROJECT_TIMEOUT_MS || 15000);

function baseUrl() {
  return (process.env.OPENPROJECT_BASE_URL || defaultBaseUrl).replace(/\/$/, '');
}

function token() {
  const value = process.env.OPENPROJECT_API_TOKEN;
  if (!value) throw new OpenProjectConfigError();
  return value;
}

function authHeader() {
  const value = token();
  if (process.env.OPENPROJECT_AUTH_MODE === 'bearer') return `Bearer ${value}`;
  return `Basic ${Buffer.from(`apikey:${value}`).toString('base64')}`;
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>
) {
  const url = new URL(`${baseUrl()}${path}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url;
}

export async function openProjectRequest<T>(
  path: string,
  options: {
    method?: string;
    query?: Record<string, string | number | boolean | undefined | null>;
    body?: unknown;
  } = {}
): Promise<T> {
  const method = options.method || 'GET';
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = buildUrl(path, options.query);

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: authHeader(),
        Accept: 'application/hal+json, application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    const payload = text
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return { message: response.ok ? text : response.statusText, raw: text.slice(0, 500) };
          }
        })()
      : null;
    const duration = Date.now() - start;
    console.info(`OpenProject API ${method} ${url.pathname} ${response.status} ${duration}ms`);
    if (!response.ok) {
      const message =
        payload?.message ||
        payload?._embedded?.errors?.[0]?.message ||
        statusMessage(response.status, response.statusText);
      throw new OpenProjectApiError(response.status, String(message), payload);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof OpenProjectApiError || error instanceof OpenProjectConfigError)
      throw error;
    if ((error as Error).name === 'AbortError') {
      throw new OpenProjectApiError(504, 'OpenProject API request timed out');
    }
    throw new OpenProjectApiError(502, 'OpenProject API is unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

function statusMessage(status: number, fallback: string) {
  if (status === 401) return 'OpenProject authentication failed';
  if (status === 403) return 'OpenProject permission denied';
  if (status === 404) return 'OpenProject resource not found';
  if (status === 409) return 'OpenProject conflict: the item was changed by someone else';
  if (status === 422) return 'OpenProject validation failed';
  return fallback || 'OpenProject API request failed';
}

export function openProjectWebUrl(path: string) {
  return `${baseUrl()}${path}`;
}
