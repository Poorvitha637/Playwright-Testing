/**
 * HttpPageCrawler.ts
 *
 * HTTP-first BFS crawler using Axios and Cheerio.
 * Fetches pages in parallel batches — no browser navigation.
 */

import axios from 'axios';
import pLimit from 'p-limit';
import {
  CRAWL_TIMEOUT_MS,
  HTTP_REQUEST_TIMEOUT_MS,
  PAGE_FETCH_CONCURRENCY,
} from '../config/environment';
import { ExtractedLink } from '../models/LinkResult';
import { extractLinksFromHtml } from './HtmlLinkExtractor';
import {
  isCrawlablePage,
  isInternalLink,
  normalizeUrl,
} from './LinkExtractor';
import { ProgressLogger } from './ProgressLogger';

export interface HttpCrawlResult {
  pagesDiscovered: string[];
  discoveredLinks: ExtractedLink[];
  timedOut: boolean;
  durationMs: number;
}

/**
 * Fetches a single page HTML via HTTP GET.
 */
export async function fetchPageHtml(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      timeout: HTTP_REQUEST_TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
      responseType: 'text',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    return typeof response.data === 'string' ? response.data : null;
  } catch {
    return null;
  }
}

/**
 * Fetches a list of pages in parallel and extracts links from each.
 */
export async function fetchPagesAndExtractLinks(
  pageUrls: string[],
  progress?: ProgressLogger
): Promise<{ pagesDiscovered: string[]; discoveredLinks: ExtractedLink[] }> {
  const limit = pLimit(PAGE_FETCH_CONCURRENCY);
  const pagesDiscovered: string[] = [];
  const discoveredLinks: ExtractedLink[] = [];
  let fetched = 0;

  await Promise.all(
    pageUrls.map((url) =>
      limit(async () => {
        const html = await fetchPageHtml(url);
        fetched += 1;
        progress?.logPageFetchProgress(fetched, pageUrls.length);

        if (!html) return;

        pagesDiscovered.push(url);
        discoveredLinks.push(...extractLinksFromHtml(html, url));
      })
    )
  );

  return { pagesDiscovered, discoveredLinks };
}

/**
 * Discovers pages via HTTP BFS when no sitemap is available.
 */
export async function crawlViaHttp(
  baseUrl: string,
  progress?: ProgressLogger
): Promise<HttpCrawlResult> {
  const startTime = Date.now();
  const baseDomain = new URL(baseUrl).hostname;
  const visited = new Set<string>();
  const queued = new Set<string>();
  const queue: string[] = [baseUrl];
  const pagesDiscovered: string[] = [];
  const discoveredLinks: ExtractedLink[] = [];
  let timedOut = false;

  queued.add(normalizeUrl(baseUrl));
  const limit = pLimit(PAGE_FETCH_CONCURRENCY);

  while (queue.length > 0) {
    if (Date.now() - startTime >= CRAWL_TIMEOUT_MS) {
      timedOut = true;
      console.log(`\n[Crawl] Timeout reached. Stopping with ${pagesDiscovered.length} pages.\n`);
      break;
    }

    const batch: string[] = [];
    while (batch.length < PAGE_FETCH_CONCURRENCY && queue.length > 0) {
      const url = queue.shift()!;
      const normalized = normalizeUrl(url);
      queued.delete(normalized);

      if (visited.has(normalized)) continue;
      visited.add(normalized);

      if (!isCrawlablePage(url)) continue;
      batch.push(url);
    }

    if (batch.length === 0) continue;

    let fetchedInBatch = 0;
    await Promise.all(
      batch.map((url) =>
        limit(async () => {
          const html = await fetchPageHtml(url);
          fetchedInBatch += 1;
          progress?.logPageFetchProgress(pagesDiscovered.length + fetchedInBatch, visited.size);

          if (!html) return;

          pagesDiscovered.push(url);
          const pageLinks = extractLinksFromHtml(html, url);
          discoveredLinks.push(...pageLinks);

          for (const link of pageLinks) {
            if (!isInternalLink(link.url, baseDomain)) continue;
            if (!isCrawlablePage(link.url)) continue;

            const target = normalizeUrl(link.url);
            if (!visited.has(target) && !queued.has(target)) {
              queued.add(target);
              queue.push(link.url);
            }
          }
        })
      )
    );
  }

  return {
    pagesDiscovered,
    discoveredLinks,
    timedOut,
    durationMs: Date.now() - startTime,
  };
}
