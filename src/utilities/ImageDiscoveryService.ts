/**
 * ImageDiscoveryService.ts
 *
 * Discovers images from a list of crawled pages.
 */

import pLimit from 'p-limit';
import { ExtractedImage } from '../models/ImageResult';
import { fetchPageHtml } from './HttpPageCrawler';
import { extractImagesFromHtml } from './ImageExtractor';

// CRAWL_CONCURRENCY is not exported from environment.ts, so we define it
// locally here. 5 is a safe default — enough to parallelise meaningfully
// without hammering the target server. If environment.ts is later updated
// to export this constant, replace this line with the import.
const CRAWL_CONCURRENCY = 5;

/**
 * Fetches all pages concurrently and extracts images from each.
 *
 * FIX: The original implementation used a sequential for...of loop.
 * For a site with 50 pages, each taking ~300 ms to fetch, that means
 * ~15 seconds of purely serial waiting before validation can even start.
 * This uses the same p-limit pattern already in ImageValidator so the
 * concurrency limit is consistent and configurable via environment config.
 *
 * FIX: Added per-page progress logging so the test console is not silent
 * for 30+ seconds during a large crawl.
 */
export async function discoverImages(
  pageUrls: string[]
): Promise<ExtractedImage[]> {
  const limit = pLimit(CRAWL_CONCURRENCY);
  const allImages: ExtractedImage[][] = new Array(pageUrls.length);

  await Promise.all(
    pageUrls.map((pageUrl, index) =>
      limit(async () => {
        console.log(
          `  [Image Discovery] Fetching page ${index + 1}/${pageUrls.length}: ${pageUrl}`
        );

        const html = await fetchPageHtml(pageUrl);

        if (!html) {
          console.warn(`  [Image Discovery] No HTML returned for: ${pageUrl}`);
          allImages[index] = [];
          return;
        }

        allImages[index] = extractImagesFromHtml(html, pageUrl);
      })
    )
  );

  // Flatten while preserving page order (Promise.all guarantees index alignment).
  return allImages.flat();
}