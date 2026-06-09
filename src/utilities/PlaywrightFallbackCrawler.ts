/**
 * PlaywrightFallbackCrawler.ts
 *
 * Browser-based fallback for JavaScript-rendered pages.
 * Used only when HTTP discovery finds zero links on the target site.
 */

import { Page } from '@playwright/test';
import { ExtractedLink } from '../models/LinkResult';
import { BasePage } from '../core/BasePage';
import {
  isCrawlablePage,
  isInternalLink,
  normalizeUrl,
  resolveUrl,
  shouldIgnoreLink,
} from './LinkExtractor';

export interface PlaywrightFallbackResult {
  pagesDiscovered: string[];
  discoveredLinks: ExtractedLink[];
  durationMs: number;
}

async function extractLinksFromPage(page: Page): Promise<ExtractedLink[]> {
  const sourcePage = page.url();
  const sourcePageTitle = await page.title();

  const rawLinks = await page.$$eval('a[href]', (anchors) =>
    anchors.map((anchor) => ({
      href: anchor.getAttribute('href') ?? '',
      text: (anchor.getAttribute('aria-label') || anchor.textContent || '')
        .replace(/\s+/g, ' ')
        .trim(),
    }))
  );

  const links: ExtractedLink[] = [];
  const seen = new Set<string>();

  for (const { href, text } of rawLinks) {
    if (shouldIgnoreLink(href)) continue;

    const absoluteUrl = resolveUrl(href, sourcePage);
    if (!absoluteUrl) continue;

    const key = `${sourcePage}|${absoluteUrl}`;
    if (seen.has(key)) continue;

    seen.add(key);
    links.push({
      url: absoluteUrl,
      sourcePage,
      sourcePageTitle,
      linkText: text,
    });
  }

  return links;
}

/**
 * Loads the site in a browser and performs a limited BFS for JS-rendered content.
 */
export async function crawlViaPlaywright(
  page: Page,
  baseUrl: string
): Promise<PlaywrightFallbackResult> {
  const startTime = Date.now();
  const baseDomain = new URL(baseUrl).hostname;
  const visited = new Set<string>();
  const queued = new Set<string>();
  const queue: string[] = [baseUrl];
  const pagesDiscovered: string[] = [];
  const discoveredLinks: ExtractedLink[] = [];

  queued.add(normalizeUrl(baseUrl));
  const basePage = new BasePage(page, baseUrl);

  while (queue.length > 0) {
    const url = queue.shift()!;
    const normalized = normalizeUrl(url);
    queued.delete(normalized);

    if (visited.has(normalized)) continue;
    visited.add(normalized);

    if (!isCrawlablePage(url)) continue;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await basePage.waitForPageLoad();
    } catch {
      continue;
    }

    pagesDiscovered.push(page.url());
    const pageLinks = await extractLinksFromPage(page);
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
  }

  return {
    pagesDiscovered,
    discoveredLinks,
    durationMs: Date.now() - startTime,
  };
}
