import { test, expect } from '@playwright/test';
import { baseUrl, CRAWL_TIMEOUT_MS } from '../../src/config/environment';
import { discoverSite } from '../../src/utilities/SiteDiscoveryService';
import { discoverImages } from '../../src/utilities/ImageDiscoveryService';
import { validateImagesBatch } from '../../src/utilities/ImageValidator';
import { generateImageReports } from '../../src/utilities/ImageReportGenerator';
import { ProgressLogger } from '../../src/utilities/ProgressLogger';

test.describe('Image Validation', () => {
  test('should discover and validate images across all pages', async ({ page }) => {
    const progress = new ProgressLogger();
    const totalStart = Date.now();

    progress.logConfiguration(baseUrl, CRAWL_TIMEOUT_MS / 60_000);

    // --- Site discovery ---
    const discovery = await discoverSite(baseUrl, progress, page);

    expect(
      discovery.pagesDiscovered.length,
      'Site discovery should find at least one page'
    ).toBeGreaterThan(0);

    console.log(
      `Discovered ${discovery.pagesDiscovered.length} page(s). Starting image discovery...`
    );

    // FIX: Pass the full list of discovered pages, not just the first one.
    // The original code was:
    //
    //   const firstPage = discovery.pagesDiscovered[0];
    //   const images = await discoverImages([firstPage]);
    //
    // This silently discarded every page except the first, so the test
    // reported "N images validated" while having only checked 1 of potentially
    // 40+ pages. The variable name "firstPage" made this look intentional,
    // but the test title says "discover and validate images" — implying the
    // full site. This single line change makes the test match its intent.
    const images = await discoverImages(discovery.pagesDiscovered);

    console.log(`Found ${images.length} image(s) across all pages. Starting validation...`);

    // FIX: Removed the debug console.log block that was printing raw image
    // objects inside the test body. Debug output like this belongs in the
    // discovery service's own logging (now handled in ImageDiscoveryService)
    // or behind a verbose flag — not hardcoded in a test file that runs in CI.
    //
    // Original code:
    //   console.log('Images found on page 1:');
    //   images.slice(0, 10).forEach((img, index) => {
    //     console.log(`${index + 1}. ${img.imageUrl} | ALT="${img.altText}" | Page=${img.sourcePage}`);
    //   });

    expect(
      images.length,
      'At least one image should be found across the discovered pages'
    ).toBeGreaterThan(0);

    // --- Validation ---
    const results = await validateImagesBatch(images);

    const totalDurationMs = Date.now() - totalStart;

    const passed = results.filter((r) => r.result === 'PASS').length;
    const failed = results.filter((r) => r.result === 'FAIL').length;

    const failedResults = results.filter((r) => r.result === 'FAIL');

    // --- Report generation ---
    const { jsonPath, htmlPath } = await generateImageReports(results);

    // --- Summary ---
    console.log('');
    console.log('========== Image Validation Summary ==========');
    console.log(`Pages Crawled    : ${discovery.pagesDiscovered.length}`);
    console.log(`Images Validated : ${results.length}`);
    console.log(`Passed           : ${passed}`);
    console.log(`Failed           : ${failed}`);
    console.log(`Duration         : ${Math.round(totalDurationMs / 1000)}s`);
    console.log(`JSON Report      : ${jsonPath}`);
    console.log(`HTML Report      : ${htmlPath}`);
    console.log('==============================================');
    console.log('');

    // Log the first 10 failures so CI output is immediately useful
    // without having to open the report file.
    if (failedResults.length > 0) {
      console.log('--- First 10 failures ---');
      failedResults.slice(0, 10).forEach((r, i) => {
        console.log(
          `  ${i + 1}. [${r.issue}] ${r.imageUrl || '(no src)'} on ${r.sourcePage}`
        );
      });
    }

    expect(
      results.length,
      'Validation should produce at least one result'
    ).toBeGreaterThan(0);

    // FIX: Added a meaningful quality assertion. The original test had no
    // assertion about the validation outcome — it always passed regardless
    // of how many broken images existed on the site. That is a report
    // generator, not a test. This assertion is what gives the test value.
    //
    // expect(failed).toBe(0) is the strict version.
    // Using a soft assertion here so the test still generates the full
    // report even when failures exist, making triage easier.
    expect.soft(
      failed,
      `${failed} image(s) failed validation. Open the HTML report for details: ${htmlPath}`
    ).toBe(0);
  });
});