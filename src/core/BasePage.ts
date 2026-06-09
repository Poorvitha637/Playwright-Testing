/**
 * BasePage.ts
 *
 * Base Page Object providing common navigation and page-load utilities.
 * All page objects should extend this class for consistent behavior.
 */

import { Page } from '@playwright/test';

export class BasePage {
  constructor(
    protected readonly page: Page,
    protected readonly baseUrl: string
  ) {}

  /**
   * Navigates to the configured base URL and waits for the page to load.
   */
  async navigate(): Promise<void> {
    await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' });
    await this.waitForPageLoad();
  }

  /**
   * Waits until the page has finished loading (network idle with a short timeout fallback).
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('load');

    try {
      await this.page.waitForLoadState('networkidle', { timeout: 10_000 });
    } catch {
      // Some pages keep long-polling connections open; continue after load state is reached.
    }
  }
}
