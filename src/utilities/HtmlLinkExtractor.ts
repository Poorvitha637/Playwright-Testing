/**
 * HtmlLinkExtractor.ts
 *
 * Extracts page titles and anchor links from raw HTML using Cheerio.
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { ExtractedLink } from '../models/LinkResult';
import { resolveUrl, shouldIgnoreLink } from './LinkExtractor';

/**
 * Extracts the page title from HTML.
 */
export function extractPageTitle(html: string): string {
  const $ = cheerio.load(html);
  return $('title').first().text().replace(/\s+/g, ' ').trim();
}

/**
 * Resolves the visible label for an anchor element.
 */
function getAnchorText($: cheerio.CheerioAPI, element: Element): string {
  const ariaLabel = $(element).attr('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;

  const titleAttr = $(element).attr('title')?.trim();
  if (titleAttr) return titleAttr;

  return $(element)
    .text()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses HTML and returns all valid links with source page metadata.
 */
export function extractLinksFromHtml(html: string, sourcePage: string): ExtractedLink[] {
  const $ = cheerio.load(html);
  const sourcePageTitle = extractPageTitle(html);
  const links: ExtractedLink[] = [];
  const seen = new Set<string>();

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href') ?? '';
    if (shouldIgnoreLink(href)) return;

    const absoluteUrl = resolveUrl(href, sourcePage);
    if (!absoluteUrl) return;

    const key = `${sourcePage}|${absoluteUrl}`;
    if (seen.has(key)) return;

    seen.add(key);
    links.push({
      url: absoluteUrl,
      sourcePage,
      sourcePageTitle,
      linkText: getAnchorText($, element),
    });
  });

  return links;
}
