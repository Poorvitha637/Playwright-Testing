/**
 * ImageExtractor.ts
 *
 * Extracts image metadata from raw HTML using Cheerio.
 */

import * as cheerio from 'cheerio';
import { ExtractedImage } from '../models/ImageResult';
import { resolveUrl } from './LinkExtractor';
import { extractPageTitle } from './HtmlLinkExtractor';

/**
 * Parses HTML and returns all images with source page metadata.
 */
export function extractImagesFromHtml(
  html: string,
  sourcePage: string
): ExtractedImage[] {
  const $ = cheerio.load(html);
  const sourcePageTitle = extractPageTitle(html);

  const images: ExtractedImage[] = [];
  const seen = new Set<string>();

  $('img').each((_, element) => {
    const src = ($(element).attr('src') ?? '').trim();
    const altText = ($(element).attr('alt') ?? '').trim();
    const hasAltAttribute = $(element).attr('alt') !== undefined;

    // resolveUrl returns string | null (null when the URL cannot be resolved).
    // We coerce null → '' so that imageUrl is always a plain string, matching
    // the ExtractedImage interface. A blank imageUrl is caught downstream in
    // the validator as 'Missing Image Source'.
    const resolvedUrl = src ? resolveUrl(src, sourcePage) : '';
    const imageUrl: string = resolvedUrl ?? '';

    // FIX: Skip data: URI images. These are valid inline images embedded
    // directly in the HTML as base64 strings. They cannot be validated via
    // an HTTP request (there is no URL to fetch), and including them would
    // produce misleading "Broken Image" FAIL entries with status 0, as well
    // as bloating the JSON report with multi-kilobyte base64 strings.
    if (imageUrl.startsWith('data:')) return;

    // The dedup key intentionally includes altText so that the same image
    // URL appearing with different ALT values on the same page generates
    // separate records — each combination is a distinct ALT audit finding.
    const key = `${sourcePage}|${imageUrl}|${altText}`;
    if (seen.has(key)) return;
    seen.add(key);

    images.push({
      imageUrl,
      sourcePage,
      sourcePageTitle,
      altText,
      hasAltAttribute,
    });
  });

  return images;
}