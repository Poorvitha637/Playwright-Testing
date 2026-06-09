/**
 * SitemapDiscovery.ts
 *
 * Discovers page URLs from sitemap.xml, sitemap index, and robots.txt.
 */

import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { HTTP_REQUEST_TIMEOUT_MS } from '../config/environment';
import { isCrawlablePage, isInternalLink, normalizeUrl } from './LinkExtractor';

const SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/wp-sitemap.xml',
  '/sitemap-index.xml',
];

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

/**
 * Attempts to discover all same-domain crawlable page URLs via sitemap.
 * Returns an empty array when no sitemap is found.
 */
export async function discoverFromSitemap(baseUrl: string): Promise<string[]> {
  const origin = new URL(baseUrl).origin;
  const baseDomain = new URL(baseUrl).hostname;
  const sitemapUrls = await collectSitemapUrls(origin);

  if (sitemapUrls.length === 0) return [];

  const allUrls = new Set<string>();

  for (const sitemapUrl of sitemapUrls) {
    const urls = await parseSitemapRecursive(sitemapUrl);
    for (const url of urls) {
      if (!isInternalLink(url, baseDomain)) continue;
      if (!isCrawlablePage(url)) continue;
      allUrls.add(normalizeUrl(url));
    }
  }

  return Array.from(allUrls);
}

async function collectSitemapUrls(origin: string): Promise<string[]> {
  const found = new Set<string>();

  for (const path of SITEMAP_PATHS) {
    const url = `${origin}${path}`;
    if (await sitemapExists(url)) {
      found.add(url);
    }
  }

  const robotsSitemaps = await parseRobotsSitemaps(origin);
  for (const url of robotsSitemaps) {
    if (await sitemapExists(url)) {
      found.add(url);
    }
  }

  return Array.from(found);
}

async function sitemapExists(url: string): Promise<boolean> {
  try {
    const response = await axios.get(url, {
      timeout: HTTP_REQUEST_TIMEOUT_MS,
      validateStatus: (status) => status === 200,
      responseType: 'text',
    });
    return typeof response.data === 'string' && response.data.includes('<');
  } catch {
    return false;
  }
}

async function parseRobotsSitemaps(origin: string): Promise<string[]> {
  try {
    const response = await axios.get(`${origin}/robots.txt`, {
      timeout: HTTP_REQUEST_TIMEOUT_MS,
      validateStatus: (status) => status === 200,
      responseType: 'text',
    });

    const lines = String(response.data).split('\n');
    return lines
      .map((line) => line.trim())
      .filter((line) => line.toLowerCase().startsWith('sitemap:'))
      .map((line) => line.split(':').slice(1).join(':').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function parseSitemapRecursive(sitemapUrl: string): Promise<string[]> {
  try {
    const response = await axios.get(sitemapUrl, {
      timeout: HTTP_REQUEST_TIMEOUT_MS,
      validateStatus: (status) => status === 200,
      responseType: 'text',
    });

    const parsed = xmlParser.parse(response.data);
    const urls: string[] = [];

    const sitemapIndex = parsed.sitemapindex?.sitemap;
    if (sitemapIndex) {
      const entries = Array.isArray(sitemapIndex) ? sitemapIndex : [sitemapIndex];
      for (const entry of entries) {
        const loc = entry?.loc;
        if (loc) {
          const childUrls = await parseSitemapRecursive(loc);
          urls.push(...childUrls);
        }
      }
      return urls;
    }

    const urlSet = parsed.urlset?.url;
    if (urlSet) {
      const entries = Array.isArray(urlSet) ? urlSet : [urlSet];
      for (const entry of entries) {
        if (entry?.loc) urls.push(entry.loc);
      }
    }

    return urls;
  } catch {
    return [];
  }
}
