/**
 * environment.ts
 *
 * Configuration loader for the WebSite Automation framework.
 * Users change only BASE_URL in the .env file to target a new website.
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/** Framework configuration loaded from environment variables. */
export interface EnvironmentConfig {
  baseUrl: string;
}

/** Maximum discovery duration before stopping (30 minutes). */
export const CRAWL_TIMEOUT_MS = 30 * 60 * 1000;

/** Concurrent HTTP page fetches during discovery. */
export const PAGE_FETCH_CONCURRENCY = 20;

/** Concurrent link validation requests. */
export const VALIDATION_CONCURRENCY = 50;

/** Per-request HTTP timeout in milliseconds. */
export const HTTP_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Reads and validates BASE_URL from the environment.
 * @throws Error when BASE_URL is missing or not a valid URL.
 */
function loadBaseUrl(): string {
  const value = process.env.BASE_URL?.trim() ?? '';

  if (!value) {
    throw new Error(
      'BASE_URL is not configured. Set BASE_URL in your .env file before running tests.\n' +
        'Example: BASE_URL=https://example.com'
    );
  }

  try {
    new URL(value);
  } catch {
    throw new Error(`BASE_URL is invalid: "${value}". Provide a valid URL in your .env file.`);
  }

  return value;
}

/**
 * Loads and validates framework configuration from the .env file.
 */
export function loadEnvironment(): EnvironmentConfig {
  return {
    baseUrl: loadBaseUrl(),
  };
}

/** Validated configuration — throws at import time if BASE_URL is missing. */
export const { baseUrl } = loadEnvironment();
