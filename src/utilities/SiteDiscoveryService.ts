/**
 * SiteDiscoveryService.ts
 *
 * Orchestrates page discovery: sitemap → HTTP crawl → Playwright fallback.
 */

import { Page } from '@playwright/test';
import { DiscoveryMethod, DiscoveryResult, ExtractedLink } from '../models/LinkResult';
import { discoverFromSitemap } from './SitemapDiscovery';
import { crawlViaHttp, fetchPagesAndExtractLinks } from './HttpPageCrawler';
import { crawlViaPlaywright } from './PlaywrightFallbackCrawler';
import { ProgressLogger } from './ProgressLogger';

/**
 * Discovers all pages and links using the priority discovery pipeline.
 */
export async function discoverSite(
  baseUrl: string,
  progress: ProgressLogger,
  page?: Page
): Promise<DiscoveryResult> {
  const startTime = Date.now();
  let discoveryMethod: DiscoveryMethod = 'http-crawl';
  let pagesDiscovered: string[] = [];
  let discoveredLinks: ExtractedLink[] = [];
  let timedOut = false;

  const sitemapPages = await discoverFromSitemap(baseUrl);

  if (sitemapPages.length > 0) {
    discoveryMethod = 'sitemap';
    progress.logDiscoveryMethod(discoveryMethod, sitemapPages.length);

    const fetchStart = Date.now();
    const result = await fetchPagesAndExtractLinks(sitemapPages, progress);
    pagesDiscovered = result.pagesDiscovered;
    discoveredLinks = result.discoveredLinks;
    progress.logPageFetchComplete(pagesDiscovered.length, (Date.now() - fetchStart) / 1000);
  } else {
    console.log('[Discovery] No sitemap found — using HTTP internal discovery\n');
    const httpResult = await crawlViaHttp(baseUrl, progress);
    discoveryMethod = 'http-crawl';
    pagesDiscovered = httpResult.pagesDiscovered;
    discoveredLinks = httpResult.discoveredLinks;
    timedOut = httpResult.timedOut;
    progress.logDiscoveryMethod(discoveryMethod, pagesDiscovered.length);
    progress.logPageFetchComplete(pagesDiscovered.length, httpResult.durationMs / 1000);
  }

  if (discoveredLinks.length === 0 && page) {
    console.log('[Discovery] No links found via HTTP — activating Playwright fallback\n');
    const pwResult = await crawlViaPlaywright(page, baseUrl);
    discoveryMethod = 'playwright-fallback';
    pagesDiscovered = pwResult.pagesDiscovered;
    discoveredLinks = pwResult.discoveredLinks;
    progress.logDiscoveryMethod(discoveryMethod, pagesDiscovered.length);
  }

  progress.logLinksDiscovered(discoveredLinks.length);

  return {
    pagesDiscovered,
    discoveredLinks,
    discoveryMethod,
    timedOut,
    discoveryDurationMs: Date.now() - startTime,
  };
}
