/**
 * ProgressLogger.ts
 *
 * Emits live progress updates during discovery and validation.
 */

import { DiscoveryMethod, LinkResult } from '../models/LinkResult';

export class ProgressLogger {
  logConfiguration(baseUrl: string, crawlTimeoutMin: number): void {
    console.log('\n--- WebSite Automation Configuration ---');
    console.log(`BASE_URL          : ${baseUrl}`);
    console.log(`Discovery Strategy: Sitemap → HTTP crawl → Playwright fallback`);
    console.log(`Page Concurrency  : 20`);
    console.log(`Validation Pool   : 50`);
    console.log(`Crawl Timeout     : ${crawlTimeoutMin} minutes`);
    console.log(`Fail Policy       : Internal broken links only`);
    console.log('----------------------------------------\n');
  }

  logDiscoveryMethod(method: DiscoveryMethod, pageCount: number): void {
    const label =
      method === 'sitemap'
        ? 'sitemap.xml'
        : method === 'http-crawl'
          ? 'HTTP internal discovery'
          : 'Playwright fallback (JS-rendered)';

    console.log(`[Discovery] Method: ${label}`);
    console.log(`[Discovery] Pages discovered: ${pageCount}\n`);
  }

  logPageFetchProgress(fetched: number, total: number): void {
    console.log(`[Crawl] Fetching pages... ${fetched}/${total}`);
  }

  logPageFetchComplete(count: number, durationSec: number): void {
    console.log(`[Crawl] Page fetch complete — ${count} pages (${durationSec.toFixed(1)}s)\n`);
  }

  logLinksDiscovered(count: number): void {
    console.log(`[Extract] Links discovered: ${count}\n`);
  }

  logValidationProgress(
    validated: number,
    total: number,
    internalFailed: number,
    externalFailed: number
  ): void {
    console.log(
      `[Validate] Progress: ${validated}/${total} validated (internal failed: ${internalFailed}, external failed: ${externalFailed})`
    );
  }

  logValidationComplete(
    total: number,
    internalFailed: number,
    externalFailed: number,
    durationSec: number
  ): void {
    console.log(
      `[Validate] Complete — ${total} unique URLs validated (internal failed: ${internalFailed}, external failed: ${externalFailed}) (${durationSec.toFixed(1)}s)\n`
    );
  }

  logFailedLink(result: LinkResult): void {
    const label = result.linkText || result.url;
    console.log(
      `  [INTERNAL FAIL ${result.status}] ${label} → ${result.url} (on: ${result.sourcePageTitle || result.sourcePage})`
    );
  }

  logSummary(summary: {
    baseUrl: string;
    discoveryMethod: DiscoveryMethod;
    pagesDiscovered: number;
    linksValidated: number;
    passed: number;
    internalFailed: number;
    externalFailed: number;
    durationMs: number;
    timedOut: boolean;
    jsonPath: string;
    htmlPath: string;
    failedLinksLogPath: string;
    failedLinksHtmlPath: string;
  }): void {
    const minutes = Math.floor(summary.durationMs / 60_000);
    const seconds = Math.floor((summary.durationMs % 60_000) / 1000);

    console.log('\n========== Broken Link Validation Summary ==========');
    console.log(`Website            : ${summary.baseUrl}`);
    console.log(`Discovery Method   : ${summary.discoveryMethod}`);
    console.log(`Pages Discovered   : ${summary.pagesDiscovered}`);
    console.log(`Links Validated    : ${summary.linksValidated}`);
    console.log(`Passed             : ${summary.passed}`);
    console.log(`Internal Failed    : ${summary.internalFailed} (test fails)`);
    console.log(`External Failed    : ${summary.externalFailed} (informational)`);
    console.log(`Total Duration     : ${minutes}m ${seconds}s`);
    console.log(`Timed Out          : ${summary.timedOut ? 'Yes' : 'No'}`);
    console.log(`JSON Report        : ${summary.jsonPath}`);
    console.log(`HTML Report        : ${summary.htmlPath}`);
    console.log(`Failed Links Log   : ${summary.failedLinksLogPath}`);
    console.log(`Failed Links HTML  : ${summary.failedLinksHtmlPath}`);
    console.log('====================================================\n');
  }
}
