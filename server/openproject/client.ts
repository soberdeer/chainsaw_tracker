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
  return `Basic ${Buffer.from(`apikey:${token()}`).toString('base64')}`;
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
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const message =
        payload?.message || payload?._embedded?.errors?.[0]?.message || response.statusText;
      console.warn(`OpenProject API ${method} ${url.pathname} failed with ${response.status}`);
      throw new OpenProjectApiError(response.status, String(message), payload);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof OpenProjectApiError || error instanceof OpenProjectConfigError)
      throw error;
    if ((error as Error).name === 'AbortError') {
      throw new OpenProjectApiError(504, 'OpenProject API request timed out');
    }
    throw new OpenProjectApiError(502, 'OpenProject API request failed');
  } finally {
    clearTimeout(timeout);
  }
}

export function openProjectWebUrl(path: string) {
  return `${baseUrl()}${path}`;
}
