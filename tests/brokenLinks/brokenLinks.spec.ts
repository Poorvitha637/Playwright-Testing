/**
 * brokenLinks.spec.ts
 *
 * HTTP-first broken link validation with Playwright fallback.
 * Flow: discover pages → extract links → validate in parallel → generate reports.
 *
 * Test fails only on INTERNAL broken links (same domain).
 * External link failures are reported but do not fail the test.
 *
 * Configuration (edit .env only):
 *   BASE_URL → target website URL
 */

import { test, expect } from '@playwright/test';
import { baseUrl, CRAWL_TIMEOUT_MS } from '../../src/config/environment';
import { discoverSite } from '../../src/utilities/SiteDiscoveryService';
import {
  getExternalFailures,
  getInternalFailures,
  validateLinksBatch,
} from '../../src/utilities/LinkValidator';
import { generateReports } from '../../src/utilities/ReportGenerator';
import { ProgressLogger } from '../../src/utilities/ProgressLogger';

test.describe('Broken Link Validation', () => {
  test('should discover pages, validate all unique links, and generate reports', async ({ page }) => {
    const progress = new ProgressLogger();
    const totalStart = Date.now();

    progress.logConfiguration(baseUrl, CRAWL_TIMEOUT_MS / 60_000);

    const discovery = await discoverSite(baseUrl, progress, page);

    expect(discovery.pagesDiscovered.length).toBeGreaterThan(0);
    expect(discovery.discoveredLinks.length).toBeGreaterThan(0);

    const results = await validateLinksBatch(discovery.discoveredLinks, baseUrl, progress);

    const totalDurationMs = Date.now() - totalStart;
    const internalFailures = getInternalFailures(results);
    const externalFailures = getExternalFailures(results);
    const passed = results.filter((r) => r.result === 'PASS').length;

    const reportOptions = {
      baseUrl,
      discoveryMethod: discovery.discoveryMethod,
      pagesCrawled: discovery.pagesDiscovered,
      timedOut: discovery.timedOut,
      crawlDurationMs: totalDurationMs,
    };

    const { jsonPath, htmlPath, failedLinksLogPath, failedLinksHtmlPath } =
      await generateReports(results, reportOptions);

    progress.logSummary({
      baseUrl,
      discoveryMethod: discovery.discoveryMethod,
      pagesDiscovered: discovery.pagesDiscovered.length,
      linksValidated: results.length,
      passed,
      internalFailed: internalFailures.length,
      externalFailed: externalFailures.length,
      durationMs: totalDurationMs,
      timedOut: discovery.timedOut,
      jsonPath,
      htmlPath,
      failedLinksLogPath,
      failedLinksHtmlPath,
    });

    if (internalFailures.length > 0) {
      console.log('Internal failed links (action required):');
      internalFailures.forEach((r) =>
        console.log(
          `  [${r.status}] "${r.linkText || r.url}" → ${r.url} (on: ${r.sourcePageTitle || r.sourcePage})`
        )
      );
      console.log('');
    }

    if (externalFailures.length > 0) {
      console.log(
        `External failed links (informational): ${externalFailures.length} — see ${failedLinksLogPath} or ${failedLinksHtmlPath}`
      );
      console.log('');
    }

    expect(
      internalFailures.length,
      `${internalFailures.length} internal broken link(s) found — see ${failedLinksLogPath} or ${failedLinksHtmlPath}`
    ).toBe(0);
  });
});
