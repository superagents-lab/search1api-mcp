import { API_KEY, API_CONFIG } from './config.js';
import { log } from './utils.js';

/**
 * A non-2xx answer from the API. `status` and `body` let a caller tell, for
 * example, a failed deepcrawl task (a task payload sent with HTTP 500) from
 * an outage.
 */
export class ApiResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: any
  ) {
    super(message);
    this.name = 'ApiResponseError';
  }
}

/**
 * Unified API request function
 * @param endpoint API endpoint
 * @param data Request data
 * @param apiKey Optional request credential (falls back to global API_KEY)
 * @returns API response
 */
export async function makeRequest<T>(endpoint: string, data: any, apiKey?: string): Promise<T> {
  return request<T>('POST', endpoint, data, apiKey);
}

/**
 * GET an API endpoint, such as a task status, with the same credential and
 * error handling as makeRequest.
 */
export async function makeGetRequest<T>(endpoint: string, apiKey?: string): Promise<T> {
  return request<T>('GET', endpoint, undefined, apiKey);
}

async function request<T>(
  method: 'GET' | 'POST',
  endpoint: string,
  data: any,
  apiKey?: string
): Promise<T> {
  const key = apiKey || API_KEY;
  if (!key) {
    throw new Error("API key is required. Provide SEARCH1API_KEY or pass apiKey explicitly.");
  }

  const startTime = Date.now();
  const baseUrl = API_CONFIG.BASE_URL.replace(/\/+$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${path}`;

  // Debug log for request details (excluding sensitive info)
  log(`Making ${method} request to: ${url}`);
  if (method === 'POST') {
    log(`Request data: ${JSON.stringify(data, null, 2)}`);
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${key}`,
        ...(method === 'POST' && { 'Content-Type': 'application/json' }),
      },
      ...(method === 'POST' && { body: JSON.stringify(data) }),
    });

    // Log response status only
    log(`Response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      log(`Error response: ${JSON.stringify(errorData, null, 2)}`);
      throw new ApiResponseError(
        `API error: ${response.status} ${errorData.message || response.statusText}`,
        response.status,
        errorData
      );
    }

    const result = await response.json();
    const duration = Date.now() - startTime;
    log(`API request to ${endpoint} completed in ${duration}ms`);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    log(`API request to ${endpoint} failed after ${duration}ms:`, error);
    throw error;
  }
}
